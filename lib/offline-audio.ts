import {
  androidDownloadAudioFile,
  androidDownloadYouTubeAudioToOffline,
  androidExportOfflineAudio,
  androidFetchYouTubeAudio,
  androidHasOfflineAudio,
  androidRemoveOfflineAudio,
  androidStoreOfflineAudio,
  isAndroidNativeApp,
} from "./android-bridge";
import type { Track } from "./types";

export const OFFLINE_AUDIO_CACHE = "sangeet-offline-audio-v1";

const DB_NAME = "sangeet-offline-downloads-v1";
const DB_VERSION = 1;
const STORE_NAME = "tracks";

interface OfflineTrackRecord {
  id: string;
  track: Track;
  artistName: string;
  sizeBytes: number;
  savedAt: number;
  mimeType: string;
  blob?: Blob;
}

const downloadedIds = new Set<string>();
const offlineUrlCache = new Map<string, string>();
const changeSubscribers = new Set<() => void>();
let registryHydrated = false;

function notifyOfflineChanges(): void {
  for (const cb of Array.from(changeSubscribers)) {
    try {
      cb();
    } catch {
      // Isolate listener errors.
    }
  }
}

export function isDesktopNativeApp(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(
      (window as { sangeetDesktop?: { isDesktop?: boolean } }).sangeetDesktop?.isDesktop,
    )
  );
}

export function isNativeOfflineSupported(): boolean {
  return isAndroidNativeApp() || isDesktopNativeApp();
}

export function resolveYouTubeVideoId(track: Track): string | null {
  const videoId = track.youtubeId || (track.id.startsWith("yt-") ? track.id.slice(3) : null);
  return videoId ? videoId : null;
}

export function canDownloadOffline(track: Track): boolean {
  if (!isNativeOfflineSupported()) return false;
  const audioUrl = track.audioUrl ?? "";
  return Boolean(
    resolveYouTubeVideoId(track) ||
      track.source === "audius" ||
      audioUrl.startsWith("/audio/") ||
      /^https?:\/\//i.test(audioUrl),
  );
}

function resolveDownloadUrl(track: Track): string {
  const youtubeId = resolveYouTubeVideoId(track);
  if (youtubeId) {
    return `/api/youtube/audio?videoId=${encodeURIComponent(youtubeId)}`;
  }
  if (track.source === "audius") {
    return `/api/audius/stream?id=${encodeURIComponent(track.id.replace(/^aud-/, ""))}`;
  }
  const audioUrl = track.audioUrl ?? "";
  if (audioUrl.startsWith("/audio/") || /^https?:\/\//i.test(audioUrl)) {
    return audioUrl;
  }
  throw new Error("This track cannot be downloaded for offline listening.");
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Offline storage is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline storage."));
  });
}

async function getRecord(trackId: string): Promise<OfflineTrackRecord | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  const db = await openOfflineDb();
  try {
    return await new Promise<OfflineTrackRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(trackId);
      req.onsuccess = () => resolve(req.result as OfflineTrackRecord | undefined);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function putRecord(record: OfflineTrackRecord): Promise<void> {
  const db = await openOfflineDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function deleteRecord(trackId: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openOfflineDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(trackId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function getOrCacheBlobUrl(trackId: string, blob: Blob): string {
  const existing = offlineUrlCache.get(trackId);
  if (existing) return existing;
  const created = URL.createObjectURL(blob);
  offlineUrlCache.set(trackId, created);
  return created;
}

export function isOfflineRegistryHydrated(): boolean {
  return registryHydrated;
}

export function hasOfflineTrackSync(trackId: string): boolean {
  return downloadedIds.has(trackId);
}

export function getCachedOfflineAudioUrl(trackId: string): string | null {
  return offlineUrlCache.get(trackId) ?? null;
}

export async function isOfflineAvailable(track: Track | string): Promise<boolean> {
  const id = typeof track === "string" ? track : track.id;
  if (downloadedIds.has(id)) return true;
  if (isAndroidNativeApp() && androidHasOfflineAudio(id)) {
    downloadedIds.add(id);
    return true;
  }
  if (typeof indexedDB === "undefined") return false;
  try {
    const record = await getRecord(id);
    if (record?.blob || (record?.track && isAndroidNativeApp() && androidHasOfflineAudio(id))) {
      downloadedIds.add(id);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function getOfflineAudioUrl(trackId: string): Promise<string | null> {
  const cached = offlineUrlCache.get(trackId);
  if (cached) {
    downloadedIds.add(trackId);
    return cached;
  }
  if (typeof indexedDB === "undefined") return null;
  try {
    const record = await getRecord(trackId);
    if (!record?.blob) return null;
    downloadedIds.add(trackId);
    return getOrCacheBlobUrl(trackId, record.blob);
  } catch {
    return null;
  }
}

export async function ensureAndroidOfflineAudio(trackId: string): Promise<boolean> {
  if (!isAndroidNativeApp()) return false;
  if (androidHasOfflineAudio(trackId)) return true;
  try {
    const record = await getRecord(trackId);
    return record?.blob ? androidStoreOfflineAudio(trackId, record.blob) : false;
  } catch {
    return false;
  }
}

async function fetchAudioBlob(
  url: string,
  onProgress?: (pct: number) => void,
): Promise<{ blob: Blob; mimeType: string }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 35_000);
  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new Error(`Could not download this audio file (${response.status}).`);
  }

  const rawType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (
    rawType &&
    !rawType.startsWith("audio/") &&
    !rawType.startsWith("video/") &&
    rawType !== "application/octet-stream" &&
    rawType !== "binary/octet-stream"
  ) {
    throw new Error("The server returned an invalid audio response.");
  }

  const mimeType =
    rawType && rawType !== "application/octet-stream" && rawType !== "binary/octet-stream"
      ? rawType
      : "audio/mpeg";
  const contentLengthHeader = response.headers.get("content-length");
  const totalBytes = contentLengthHeader ? Number(contentLengthHeader) : 0;

  if (!response.body) {
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error("Downloaded audio file was empty.");
    }
    onProgress?.(90);
    return { blob, mimeType: blob.type || mimeType };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      receivedBytes += value.byteLength;
      if (totalBytes > 0 && Number.isFinite(totalBytes)) {
        const pct = Math.min(99, Math.max(1, Math.round((receivedBytes / totalBytes) * 100)));
        onProgress?.(Math.min(90, Math.round(pct * 0.9)));
      }
    }
  }

  const blobParts: BlobPart[] = chunks.map(
    (chunk) => chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer,
  );
  const blob = new Blob(blobParts, { type: mimeType });
  if (blob.size === 0) {
    throw new Error("Downloaded audio file was empty.");
  }
  onProgress?.(90);
  return { blob, mimeType };
}

function bytesToAudioBlob(
  bytes: Uint8Array,
  rawMimeType?: string,
): { blob: Blob; mimeType: string } {
  const cleanedMime = (rawMimeType ?? "").split(";")[0].trim().toLowerCase();
  const mimeType =
    cleanedMime &&
    cleanedMime !== "application/octet-stream" &&
    cleanedMime !== "binary/octet-stream"
      ? cleanedMime
      : "audio/mp4";
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: mimeType });
  if (blob.size === 0) {
    throw new Error("Downloaded audio file was empty.");
  }
  return { blob, mimeType };
}

async function fetchTrackAudioResilient(
  track: Track,
  onProgress?: (pct: number) => void,
): Promise<{ blob: Blob; mimeType: string }> {
  const downloadUrl = resolveDownloadUrl(track);
  const youtubeId = resolveYouTubeVideoId(track);
  let primaryError: unknown = null;
  let nativeError: unknown = null;

  // On Android prefer the device-side extractor. The website proxy can be
  // slow or blocked by upstream rate limits; waiting for it first made a
  // single tap appear frozen before the APK's working native path was tried.
  if (youtubeId && isAndroidNativeApp()) {
    try {
      const nativeRes = await androidFetchYouTubeAudio(youtubeId, (percent) => {
        onProgress?.(Math.min(88, Math.round(percent * 0.88)));
      });
      return bytesToAudioBlob(nativeRes.bytes, nativeRes.mimeType);
    } catch (error) {
      nativeError = error;
    }
  }

  try {
    return await fetchAudioBlob(downloadUrl, onProgress);
  } catch (error) {
    primaryError = error;
  }

  if (youtubeId) {
    if (!isAndroidNativeApp() && isDesktopNativeApp() && window.sangeetDesktop?.fetchYouTubeAudio) {
      try {
        onProgress?.(15);
        const desktopRes = await window.sangeetDesktop.fetchYouTubeAudio(youtubeId);
        if (desktopRes?.ok && desktopRes.bytes && desktopRes.bytes.byteLength > 0) {
          onProgress?.(90);
          return bytesToAudioBlob(desktopRes.bytes, desktopRes.mimeType);
        }
        nativeError = new Error(desktopRes?.error || "Desktop audio download failed.");
      } catch (error) {
        nativeError = error;
      }
    }
  }

  // Retry primary HTTP fetch once in case of a transient network hiccup.
  await new Promise((resolve) => setTimeout(resolve, 350));
  try {
    return await fetchAudioBlob(downloadUrl, onProgress);
  } catch (retryError) {
    if (
      track.source === "audius" &&
      track.audioUrl &&
      /^https?:\/\//i.test(track.audioUrl) &&
      track.audioUrl !== downloadUrl
    ) {
      try {
        return await fetchAudioBlob(track.audioUrl, onProgress);
      } catch {
        // Fall through to throw most relevant error below.
      }
    }
    const finalError = retryError ?? primaryError ?? nativeError;
    throw finalError instanceof Error
      ? finalError
      : new Error("Could not download this audio file.");
  }
}

export async function saveTrackOffline(
  track: Track,
  artistName: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  if (!isNativeOfflineSupported()) {
    throw new Error(
      "Offline downloads are available in the Sangeet Android APK and Windows .exe app.",
    );
  }
  if (!canDownloadOffline(track) || typeof indexedDB === "undefined") {
    throw new Error("Offline downloads are unavailable for this track or browser.");
  }

  const youtubeId = resolveYouTubeVideoId(track);
  if (youtubeId && isAndroidNativeApp()) {
    const sizeBytes = await androidDownloadYouTubeAudioToOffline(track.id, youtubeId, onProgress);
    const record: OfflineTrackRecord = {
      id: track.id,
      track: { ...track },
      artistName: artistName || "Sangeet",
      sizeBytes,
      savedAt: Date.now(),
      mimeType: "audio/mp4",
    };
    try {
      await putRecord(record);
    } catch (error) {
      androidRemoveOfflineAudio(track.id);
      throw error;
    }
    downloadedIds.add(track.id);
    const previousUrl = offlineUrlCache.get(track.id);
    if (previousUrl) {
      try { URL.revokeObjectURL(previousUrl); } catch { /* Ignore stale URL cleanup errors. */ }
      offlineUrlCache.delete(track.id);
    }
    notifyOfflineChanges();
    onProgress?.(100);
    return;
  }

  const { blob, mimeType } = await fetchTrackAudioResilient(track, onProgress);
  if (blob.size === 0) {
    throw new Error("Downloaded audio file was empty.");
  }

  let storedNatively = false;
  if (isAndroidNativeApp()) {
    onProgress?.(92);
    storedNatively = await androidStoreOfflineAudio(track.id, blob, (percent) => {
      onProgress?.(92 + Math.round(percent * 0.07));
    });
  }

  const record: OfflineTrackRecord = {
    id: track.id,
    track: { ...track },
    artistName: artistName || "Sangeet",
    sizeBytes: blob.size,
    savedAt: Date.now(),
    mimeType,
    // Android's native file becomes the source of truth when it is available,
    // avoiding a second full copy in WebView IndexedDB.
    ...(!storedNatively ? { blob } : {}),
  };

  try {
    await putRecord(record);
  } catch (error) {
    if (storedNatively) androidRemoveOfflineAudio(track.id);
    throw error;
  }
  onProgress?.(100);

  const previousUrl = offlineUrlCache.get(track.id);
  if (previousUrl) {
    try {
      URL.revokeObjectURL(previousUrl);
    } catch {
      // Ignore revoke errors.
    }
    offlineUrlCache.delete(track.id);
  }
  downloadedIds.add(track.id);
  if (!storedNatively) getOrCacheBlobUrl(track.id, blob);
  notifyOfflineChanges();
}

export async function removeOfflineTrack(trackOrId: Track | string): Promise<void> {
  const id = typeof trackOrId === "string" ? trackOrId : trackOrId.id;
  androidRemoveOfflineAudio(id);
  downloadedIds.delete(id);

  const cachedUrl = offlineUrlCache.get(id);
  if (cachedUrl) {
    try {
      URL.revokeObjectURL(cachedUrl);
    } catch {
      // Ignore revoke errors.
    }
    offlineUrlCache.delete(id);
  }

  await deleteRecord(id);
  notifyOfflineChanges();
}

export async function listOfflineTracks(): Promise<
  Array<{ track: Track; artistName: string; sizeBytes: number; savedAt: number }>
> {
  if (typeof indexedDB === "undefined") {
    registryHydrated = true;
    return [];
  }

  const db = await openOfflineDb();
  try {
    const records = await new Promise<OfflineTrackRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as OfflineTrackRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });

    registryHydrated = true;
    const valid = records.filter((item) => Boolean(
      item?.id && item?.track &&
      (item.blob || (isAndroidNativeApp() && androidHasOfflineAudio(item.id))),
    ));
    valid.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));

    for (const item of valid) {
      downloadedIds.add(item.id);
      if (item.blob) getOrCacheBlobUrl(item.id, item.blob);
    }

    return valid.map((item) => ({
      track: item.track,
      artistName: item.artistName,
      sizeBytes: item.sizeBytes,
      savedAt: item.savedAt,
    }));
  } finally {
    db.close();
  }
}

function extensionFromMime(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes("mp4") || lower.includes("m4a") || lower.includes("aac")) return "m4a";
  if (lower.includes("webm")) return "webm";
  if (lower.includes("ogg") || lower.includes("opus")) return "ogg";
  if (lower.includes("wav")) return "wav";
  if (lower.includes("flac")) return "flac";
  return "mp3";
}

function resolveAndroidServerExportUrl(track: Track, safeBase: string): string | null {
  const youtubeId = resolveYouTubeVideoId(track);
  if (youtubeId) {
    return `/api/youtube/audio?videoId=${encodeURIComponent(youtubeId)}&download=1&filename=${encodeURIComponent(safeBase)}`;
  }
  if (track.source === "audius") {
    return `/api/audius/stream?id=${encodeURIComponent(track.id.replace(/^aud-/, ""))}`;
  }
  const audioUrl = track.audioUrl ?? "";
  if (audioUrl.startsWith("/audio/") || /^https?:\/\//i.test(audioUrl)) {
    return audioUrl;
  }
  return null;
}

export async function exportTrackAudioFile(track: Track, artistName: string): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const safeBase =
    `${artistName || "Sangeet"} - ${track.title || "Track"}`
      .replace(/[\\/:*?"<>|]+/g, "_")
      .trim()
      .slice(0, 120) || "sangeet-track";

  if (isAndroidNativeApp()) {
    const urlExtMatch = track.audioUrl
      .split("?")[0]
      .match(/\.(mp3|m4a|webm|ogg|opus|wav|flac|aac)$/i);
    const fallbackExt = urlExtMatch?.[1]?.toLowerCase() || (resolveYouTubeVideoId(track) ? "m4a" : "mp3");
    const filename = `${safeBase}.${fallbackExt}`;
    if (androidExportOfflineAudio(track.id, filename)) return;
    if (
      await ensureAndroidOfflineAudio(track.id) &&
      androidExportOfflineAudio(track.id, filename)
    ) return;

    const serverDownloadUrl = resolveAndroidServerExportUrl(track, safeBase);
    const sourceUrl = serverDownloadUrl ?? track.audioUrl;
    if (!sourceUrl) throw new Error("This audio file cannot be exported on Android.");
    const mimeType = fallbackExt === "mp3" ? "audio/mpeg"
      : fallbackExt === "m4a" || fallbackExt === "aac" ? "audio/mp4"
      : fallbackExt === "ogg" || fallbackExt === "opus" ? "audio/ogg"
      : fallbackExt === "webm" ? "audio/webm"
      : fallbackExt === "flac" ? "audio/flac"
      : fallbackExt === "wav" ? "audio/wav"
      : "application/octet-stream";
    if (!androidDownloadAudioFile(sourceUrl, filename, mimeType)) {
      throw new Error("Android could not start this audio download.");
    }
    return;
  }

  let blob: Blob | null = null;
  let mimeType = "audio/mpeg";
  let temporaryUrl: string | null = null;
  let href: string;

  try {
    const existing = await getRecord(track.id);
    if (existing?.blob) {
      blob = existing.blob;
      mimeType = existing.mimeType || existing.blob.type || mimeType;
      href = getOrCacheBlobUrl(track.id, existing.blob);
    } else if (track.audioUrl.startsWith("blob:")) {
      const fetched = await fetchAudioBlob(track.audioUrl);
      blob = fetched.blob;
      mimeType = fetched.mimeType;
      temporaryUrl = URL.createObjectURL(blob);
      href = temporaryUrl;
    } else {
      const fetched = await fetchTrackAudioResilient(track);
      blob = fetched.blob;
      mimeType = fetched.mimeType;
      temporaryUrl = URL.createObjectURL(blob);
      href = temporaryUrl;
    }

    const ext = extensionFromMime(mimeType);
    const filename = `${safeBase}.${ext}`;

    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    if (temporaryUrl) {
      const urlToRevoke = temporaryUrl;
      window.setTimeout(() => {
        try {
          URL.revokeObjectURL(urlToRevoke);
        } catch {
          // Ignore revoke failures.
        }
      }, 10_000);
    }
  }
}

export function subscribeOfflineChanges(cb: () => void): () => void {
  changeSubscribers.add(cb);
  return () => {
    changeSubscribers.delete(cb);
  };
}
