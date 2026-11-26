"use client";

import { create } from "zustand";
import type { Track } from "@/types/music";
import {
  clearAllOfflineAudio,
  deleteOfflineAudio,
  getOfflineAudioRecord,
  getStorageUsage,
  listOfflineAudioMeta,
  saveOfflineAudio,
  type OfflineAudioMeta
} from "@/lib/offline-db";
import {
  extractAudioMetadata,
  parseFilenameMeta
} from "@/lib/audio-metadata";
import {
  getAndroidBridge,
  getWindowsBridge,
  isExcludedNonMusicAudio,
  type ScannedDeviceTrack
} from "@/lib/platform";
import { formatTime } from "@/lib/utils";
import { convertBlobToAac } from "@/lib/aac-transcoder";
import { getPreferredAudioFormat } from "@/store/audio-format-store";

export interface ActiveDownload {
  track: Track;
  progress: number; // 0-100
  status: "downloading" | "completed" | "error";
  receivedBytes?: number;
  totalBytes?: number;
  error?: string;
}

export interface NativeOfflineEntry {
  id: string;
  track: Track;
  sizeBytes: number;
  path?: string;
  savedAt: number;
}

const NATIVE_OFFLINE_STORAGE_KEY = "sangeet-v2-native-offline";
const controllers = new Map<string, AbortController>();
const pendingAndroidDownloads = new Map<
  string,
  { track: Track; resolve: (ok: boolean) => void }
>();

const LOCAL_AUDIO_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Crect width='256' height='256' fill='%230c1226'/%3E%3Ccircle cx='128' cy='128' r='56' fill='%233b82f6' opacity='0.28'/%3E%3Ctext x='128' y='142' font-size='44' text-anchor='middle' fill='%2393c5fd' font-family='sans-serif'%3E%E2%99%AB%3C/text%3E%3C/svg%3E";

function readNativeOfflineCatalog(): NativeOfflineEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NATIVE_OFFLINE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNativeOfflineCatalog(entries: NativeOfflineEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NATIVE_OFFLINE_STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

async function probeAudioDuration(file: Blob): Promise<number> {
  if (typeof window === "undefined") return 0;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (val: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(val) && val > 0 ? Math.round(val) : 0);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => done(audio.duration);
    audio.onerror = () => done(0);
    audio.src = url;
  });
}

function extensionFromMime(mime: string): string {
  if (mime.includes("flac")) return "flac";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac"))
    return "m4a";
  if (mime.includes("opus")) return "opus";
  return "mp3";
}

export function offlineMetaToTrack(meta: OfflineAudioMeta): Track {
  return {
    id: meta.id,
    title: meta.title,
    artist: meta.artist,
    album: meta.album,
    duration: meta.duration,
    durationText: meta.durationText || formatTime(meta.duration),
    thumbnail: meta.thumbnail,
    source: meta.kind === "local" ? "local" : "offline",
    offlineId: meta.id
  };
}

export function scannedDeviceTrackToTrack(item: ScannedDeviceTrack): Track {
  const duration =
    typeof item.duration === "number" && Number.isFinite(item.duration)
      ? Math.round(item.duration)
      : 0;
  return {
    id: `device_${item.id}`,
    title: item.title || "Unknown Title",
    artist: item.artist || "Unknown Artist",
    album: item.album || "On This Device",
    duration,
    durationText: duration > 0 ? formatTime(duration) : "Local",
    thumbnail: LOCAL_AUDIO_ICON,
    source: "local",
    localUrl: item.uri
  };
}

interface OfflineState {
  items: OfflineAudioMeta[];
  nativeItems: NativeOfflineEntry[];
  scannedTracks: ScannedDeviceTrack[];
  scanningDevice: boolean;
  audioPermissionStatus: "unknown" | "granted" | "denied";
  downloads: Record<string, ActiveDownload>;
  loading: boolean;
  error: string | null;
  usedBytes: number;
  quotaBytes: number;

  refresh: () => Promise<void>;
  importLocalFiles: (
    files: File[]
  ) => Promise<{ added: number; failed: number; skippedNonMusic: number }>;
  scanDeviceAudio: () => Promise<{
    status: "scanned" | "permission_requested" | "unsupported" | "error";
    count: number;
  }>;
  handleAndroidDownloadEvent: (
    type:
      | "offline_audio_progress"
      | "offline_audio_saved"
      | "offline_audio_error"
      | "audio_permission",
    payload: string
  ) => void;
  downloadTrackOneClick: (track: Track) => Promise<boolean>;
  downloadPermittedTrack: (track: Track) => Promise<boolean>;
  exportOfflineTrack: (id: string) => Promise<boolean>;
  cancelDownload: (trackId: string) => void;
  retryDownload: (trackId: string) => Promise<boolean>;
  removeItem: (id: string) => Promise<void>;
  removeNativeItem: (trackId: string) => void;
  clearAll: () => Promise<void>;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  items: [],
  nativeItems: [],
  scannedTracks: [],
  scanningDevice: false,
  audioPermissionStatus: "unknown",
  downloads: {},
  loading: false,
  error: null,
  usedBytes: 0,
  quotaBytes: 0,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const [items, usage] = await Promise.all([
        listOfflineAudioMeta(),
        getStorageUsage()
      ]);

      // Reconcile native Android/Windows offline catalog
      const android = getAndroidBridge();
      let nativeItems = readNativeOfflineCatalog();
      if (android && typeof android.hasOfflineAudio === "function") {
        nativeItems = nativeItems.filter((entry) =>
          android.hasOfflineAudio!(entry.id)
        );
        writeNativeOfflineCatalog(nativeItems);
      }

      set({
        items,
        nativeItems,
        audioPermissionStatus: android?.hasAudioPermission?.()
          ? "granted"
          : get().audioPermissionStatus,
        usedBytes: usage.usedBytes,
        quotaBytes: usage.quotaBytes,
        loading: false
      });
    } catch (err) {
      set({
        loading: false,
        error:
          err instanceof Error ? err.message : "Could not load offline storage."
      });
    }
  },

  importLocalFiles: async (files) => {
    let added = 0;
    let failed = 0;
    let skippedNonMusic = 0;
    for (const file of files) {
      try {
        if (
          !file.type.startsWith("audio/") &&
          !/\.(mp3|wav|flac|ogg|m4a|aac|opus)$/i.test(file.name)
        ) {
          failed++;
          continue;
        }
        const relPath =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
          file.name;
        if (
          isExcludedNonMusicAudio({
            pathOrName: relPath,
            sizeBytes: file.size
          })
        ) {
          skippedNonMusic++;
          continue;
        }
        const [duration, id3] = await Promise.all([
          probeAudioDuration(file),
          extractAudioMetadata(file)
        ]);
        if (
          duration > 0 &&
          isExcludedNonMusicAudio({ durationSec: duration })
        ) {
          skippedNonMusic++;
          continue;
        }
        const fallback = parseFilenameMeta(file.name);
        const id = `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        await saveOfflineAudio({
          id,
          title: id3.title || fallback.title,
          artist: id3.artist || fallback.artist || "Local Audio",
          album: id3.album || "On This Device",
          duration,
          durationText: duration > 0 ? formatTime(duration) : "Local",
          thumbnail: id3.coverDataUrl || LOCAL_AUDIO_ICON,
          mimeType: file.type || "audio/mpeg",
          sizeBytes: file.size,
          kind: "local",
          sourceLabel: "Local File",
          addedAt: Date.now(),
          blob: file
        });
        added++;
      } catch (err) {
        failed++;
        set({
          error:
            err instanceof Error
              ? err.message
              : "Could not save one or more local files."
        });
      }
    }
    await get().refresh();
    return { added, failed, skippedNonMusic };
  },

  scanDeviceAudio: async () => {
    const android = getAndroidBridge();
    if (android) {
      if (!android.hasAudioPermission?.()) {
        set({ audioPermissionStatus: "unknown" });
        android.requestAudioPermission?.();
        return { status: "permission_requested", count: 0 };
      }
      set({
        scanningDevice: true,
        error: null,
        audioPermissionStatus: "granted"
      });
      try {
        const raw = android.scanLocalAudio?.() ?? "[]";
        const parsed = JSON.parse(raw);
        const filtered: ScannedDeviceTrack[] = (
          Array.isArray(parsed) ? parsed : []
        ).filter(
          (item: ScannedDeviceTrack) =>
            !isExcludedNonMusicAudio({
              pathOrName: `${item.path || ""} ${item.title || ""}`,
              durationSec: item.duration
            })
        );
        set({ scannedTracks: filtered, scanningDevice: false });
        return { status: "scanned", count: filtered.length };
      } catch (err) {
        set({
          scanningDevice: false,
          error:
            err instanceof Error
              ? err.message
              : "Could not scan device music."
        });
        return { status: "error", count: 0 };
      }
    }

    const win = getWindowsBridge();
    if (win && typeof win.scanLocalAudio === "function") {
      set({ scanningDevice: true, error: null });
      try {
        const rawTracks = await win.scanLocalAudio();
        const filtered = (Array.isArray(rawTracks) ? rawTracks : []).filter(
          (item) =>
            !isExcludedNonMusicAudio({
              pathOrName: item.path || item.title,
              durationSec: item.duration,
              sizeBytes: item.sizeBytes
            })
        );
        set({
          scannedTracks: filtered,
          scanningDevice: false,
          audioPermissionStatus: "granted"
        });
        return { status: "scanned", count: filtered.length };
      } catch (err) {
        set({
          scanningDevice: false,
          error:
            err instanceof Error
              ? err.message
              : "Could not scan local Music folders."
        });
        return { status: "error", count: 0 };
      }
    }

    return { status: "unsupported", count: 0 };
  },

  handleAndroidDownloadEvent: (type, payload) => {
    if (type === "audio_permission") {
      const granted = payload === "granted";
      set({ audioPermissionStatus: granted ? "granted" : "denied" });
      if (granted) {
        void get().scanDeviceAudio();
      }
      return;
    }

    try {
      const data = JSON.parse(payload);
      const reqId = String(data?.requestId || "");
      const pending = pendingAndroidDownloads.get(reqId);
      if (!pending) return;

      if (type === "offline_audio_progress") {
        const pct = Math.max(0, Math.min(99, Number(data?.progress ?? 0)));
        set((s) => {
          const cur = s.downloads[pending.track.id];
          if (!cur) return s;
          return {
            downloads: {
              ...s.downloads,
              [pending.track.id]: { ...cur, progress: pct }
            }
          };
        });
      } else if (type === "offline_audio_saved") {
        pendingAndroidDownloads.delete(reqId);
        const sizeBytes = Number(data?.sizeBytes ?? 0);
        const existing = readNativeOfflineCatalog().filter(
          (e) => e.id !== pending.track.id
        );
        const nextEntry: NativeOfflineEntry = {
          id: pending.track.id,
          track: { ...pending.track, source: "offline" },
          sizeBytes,
          savedAt: Date.now()
        };
        const updated = [nextEntry, ...existing];
        writeNativeOfflineCatalog(updated);
        const savedTrackId = pending.track.id;
        set((s) => ({
          downloads: {
            ...s.downloads,
            [savedTrackId]: {
              track: pending.track,
              progress: 100,
              status: "completed",
              receivedBytes: sizeBytes,
              totalBytes: sizeBytes
            }
          },
          nativeItems: updated
        }));
        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            set((s) => {
              if (s.downloads[savedTrackId]?.status !== "completed") return s;
              const nextDownloads = { ...s.downloads };
              delete nextDownloads[savedTrackId];
              return { downloads: nextDownloads };
            });
          }, 3500);
        }
        pending.resolve(true);
      } else if (type === "offline_audio_error") {
        pendingAndroidDownloads.delete(reqId);
        const msg = String(data?.message || "Offline download failed.");
        set((s) => ({
          downloads: {
            ...s.downloads,
            [pending.track.id]: {
              track: pending.track,
              progress: 0,
              status: "error",
              error: msg
            }
          }
        }));
        pending.resolve(false);
      }
    } catch {}
  },

  downloadTrackOneClick: async (track) => {
    const android = getAndroidBridge();
    const win = getWindowsBridge();

    // Already downloadable open audio (Audius)
    if (track.downloadable && track.streamUrl) {
      if (win && typeof win.downloadAudioTrack === "function") {
        const safeName = `${track.artist} - ${track.title}`
          .replace(/[<>:"/\\|?*]+/g, "")
          .trim();
        set((s) => ({
          downloads: {
            ...s.downloads,
            [track.id]: { track, progress: 15, status: "downloading" }
          }
        }));
        const absUrl = track.streamUrl.startsWith("http")
          ? track.streamUrl
          : `${window.location.origin}${track.streamUrl}`;
        const setWinProgress = (progress: number) =>
          set((s) => {
            const cur = s.downloads[track.id];
            if (!cur || cur.status !== "downloading") return s;
            return { downloads: { ...s.downloads, [track.id]: { ...cur, progress } } };
          });

        let res: Awaited<ReturnType<NonNullable<typeof win.downloadAudioTrack>>> | null =
          null;
        // AAC mode: keep native AAC as-is, otherwise convert on-device, then save via the Rust bridge.
        if (getPreferredAudioFormat() === "aac" && typeof win.saveAudioBytes === "function") {
          try {
            const fetched = await fetch(absUrl);
            if (fetched.ok) {
              setWinProgress(55);
              const converted = await convertBlobToAac(await fetched.blob(), (f) =>
                setWinProgress(55 + Math.round(f * 40))
              );
              res = await win.saveAudioBytes(
                {
                  trackId: track.id,
                  filename: `${safeName || track.id}.${converted.extension}`
                },
                new Uint8Array(await converted.blob.arrayBuffer())
              );
            }
          } catch {
            res = null;
          }
        }
        if (!res?.ok) {
          res = await win.downloadAudioTrack({
            trackId: track.id,
            url: absUrl,
            title: track.title,
            artist: track.artist,
            filename: `${safeName || track.id}.mp3`
          });
        }
        if (res?.ok) {
          const existing = readNativeOfflineCatalog().filter(
            (e) => e.id !== track.id
          );
          const updated = [
            {
              id: track.id,
              track: { ...track, source: "offline" as const },
              sizeBytes: res.sizeBytes || 0,
              path: res.path,
              savedAt: Date.now()
            },
            ...existing
          ];
          writeNativeOfflineCatalog(updated);
          set((s) => ({
            downloads: {
              ...s.downloads,
              [track.id]: {
                track,
                progress: 100,
                status: "completed",
                receivedBytes: res.sizeBytes || 0,
                totalBytes: res.sizeBytes || 0
              }
            },
            nativeItems: updated
          }));
          if (typeof window !== "undefined") {
            window.setTimeout(() => {
              set((s) => {
                if (s.downloads[track.id]?.status !== "completed") return s;
                const nextDownloads = { ...s.downloads };
                delete nextDownloads[track.id];
                return { downloads: nextDownloads };
              });
            }, 3500);
          }
          return true;
        }
      }
      return get().downloadPermittedTrack(track);
    }

    // Native Android 1-click fast parallel download for YouTube Music tracks
    if (
      android &&
      typeof android.downloadYouTubeAudioToOffline === "function" &&
      /^[A-Za-z0-9_-]{11}$/.test(track.id)
    ) {
      const reqId = `dl_${track.id}_${Date.now().toString(36)}`;
      set((s) => ({
        error: null,
        downloads: {
          ...s.downloads,
          [track.id]: { track, progress: 2, status: "downloading" }
        }
      }));
      return new Promise<boolean>((resolve) => {
        pendingAndroidDownloads.set(reqId, { track, resolve });
        android.downloadYouTubeAudioToOffline!(reqId, track.id, track.id);
      });
    }

    // Native Windows 1-click download: match streamable audio & save to Music/Sangeet
    if (win) {
      set((s) => ({
        error: null,
        downloads: {
          ...s.downloads,
          [track.id]: { track, progress: 10, status: "downloading" }
        }
      }));
      try {
        const searchRes = await fetch(
          `/api/audius/search?q=${encodeURIComponent(`${track.title} ${track.artist}`)}&limit=3`
        );
        const searchData = searchRes.ok ? await searchRes.json() : null;
        const match: Track | undefined = Array.isArray(searchData?.tracks)
          ? searchData.tracks[0]
          : undefined;
        if (match?.streamUrl) {
          return get().downloadTrackOneClick({
            ...track,
            streamUrl: match.streamUrl,
            downloadable: true
          });
        }
        throw new Error("No direct downloadable stream available for this track.");
      } catch (err) {
        set((s) => ({
          downloads: {
            ...s.downloads,
            [track.id]: {
              track,
              progress: 0,
              status: "error",
              error:
                err instanceof Error ? err.message : "Download failed."
            }
          }
        }));
        return false;
      }
    }

    return get().downloadPermittedTrack(track);
  },

  downloadPermittedTrack: async (track) => {
    if (!track.streamUrl || !track.downloadable) {
      set({
        error:
          "Use the Sangeet Android or Windows app for 1-click offline downloads."
      });
      return false;
    }

    controllers.get(track.id)?.abort();
    const controller = new AbortController();
    controllers.set(track.id, controller);

    set((s) => ({
      error: null,
      downloads: {
        ...s.downloads,
        [track.id]: { track, progress: 0, status: "downloading" }
      }
    }));

    try {
      const res = await fetch(track.streamUrl, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(
          res.status === 404
            ? "Track audio is unavailable for download."
            : `Download failed (HTTP ${res.status})`
        );
      }

      const contentLength = Number(res.headers.get("content-length") || 0);
      let mimeType = res.headers.get("content-type") || "audio/mpeg";
      let blob: Blob;
      const wantsAac = getPreferredAudioFormat() === "aac";
      // In AAC mode the download fills 0-80% and on-device conversion the rest.
      const downloadScale = wantsAac ? 0.8 : 1;

      if (res.body) {
        const reader = res.body.getReader();
        const chunks: BlobPart[] = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.byteLength;
            const pct = Math.round(
              (contentLength > 0
                ? Math.min(99, (received / contentLength) * 100)
                : Math.min(95, received / 40000)) * downloadScale
            );
            set((s) => {
              const cur = s.downloads[track.id];
              if (!cur) return s;
              return {
                downloads: {
                  ...s.downloads,
                  [track.id]: {
                    ...cur,
                    progress: pct,
                    receivedBytes: received,
                    totalBytes: contentLength > 0 ? contentLength : undefined
                  }
                }
              };
            });
          }
        }
        blob = new Blob(chunks, { type: mimeType });
      } else {
        blob = await res.blob();
      }

      if (blob.size < 1024) {
        throw new Error("Downloaded audio stream was empty.");
      }

      if (wantsAac) {
        const converted = await convertBlobToAac(blob, (f) =>
          set((s) => {
            const cur = s.downloads[track.id];
            if (!cur) return s;
            return {
              downloads: {
                ...s.downloads,
                [track.id]: { ...cur, progress: 80 + Math.round(f * 19) }
              }
            };
          })
        );
        blob = converted.blob;
        mimeType = converted.mimeType;
      }

      const offlineId = `dl_${track.id}`;
      const duration = track.duration || (await probeAudioDuration(blob));
      await saveOfflineAudio({
        id: offlineId,
        title: track.title,
        artist: track.artist,
        album: track.album || "Offline Downloads",
        duration,
        durationText: track.durationText || formatTime(duration),
        thumbnail: track.thumbnail || LOCAL_AUDIO_ICON,
        mimeType,
        sizeBytes: blob.size,
        kind: "download",
        sourceLabel: "Offline Download",
        addedAt: Date.now(),
        blob
      });

      controllers.delete(track.id);
      set((s) => ({
        downloads: {
          ...s.downloads,
          [track.id]: {
            track,
            progress: 100,
            status: "completed",
            receivedBytes: blob.size,
            totalBytes: blob.size
          }
        }
      }));
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          set((s) => {
            if (s.downloads[track.id]?.status !== "completed") return s;
            const next = { ...s.downloads };
            delete next[track.id];
            return { downloads: next };
          });
        }, 3500);
      }
      await get().refresh();
      return true;
    } catch (err) {
      controllers.delete(track.id);
      if (controller.signal.aborted) {
        set((s) => {
          const next = { ...s.downloads };
          delete next[track.id];
          return { downloads: next };
        });
        return false;
      }
      set((s) => ({
        downloads: {
          ...s.downloads,
          [track.id]: {
            track,
            progress: 0,
            status: "error",
            error:
              err instanceof Error ? err.message : "Offline download failed."
          }
        }
      }));
      return false;
    }
  },

  exportOfflineTrack: async (id) => {
    const android = getAndroidBridge();
    if (android && android.hasOfflineAudio?.(id)) {
      const entry = get().nativeItems.find((e) => e.id === id);
      const name = entry
        ? `${entry.track.artist} - ${entry.track.title}`
        : id;
      return Boolean(android.exportOfflineAudio?.(id, name));
    }

    try {
      const record = await getOfflineAudioRecord(id);
      if (!record?.blob) return false;
      const url = URL.createObjectURL(record.blob);
      const ext = extensionFromMime(record.mimeType);
      const safeName = `${record.artist} - ${record.title}`
        .replace(/[<>:"/\\|?*]+/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 90);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName || "sangeet-track"}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      return true;
    } catch {
      return false;
    }
  },

  cancelDownload: (trackId) => {
    controllers.get(trackId)?.abort();
    controllers.delete(trackId);
    set((s) => {
      const next = { ...s.downloads };
      delete next[trackId];
      return { downloads: next };
    });
  },

  retryDownload: async (trackId) => {
    const entry = get().downloads[trackId];
    if (!entry) return false;
    return get().downloadTrackOneClick(entry.track);
  },

  removeItem: async (id) => {
    await deleteOfflineAudio(id);
    await get().refresh();
  },

  removeNativeItem: (trackId) => {
    getAndroidBridge()?.removeOfflineAudio?.(trackId);
    const updated = readNativeOfflineCatalog().filter((e) => e.id !== trackId);
    writeNativeOfflineCatalog(updated);
    set({ nativeItems: updated });
  },

  clearAll: async () => {
    const android = getAndroidBridge();
    if (android) {
      for (const entry of get().nativeItems) {
        android.removeOfflineAudio?.(entry.id);
      }
      writeNativeOfflineCatalog([]);
    }
    await clearAllOfflineAudio();
    await get().refresh();
  }
}));
