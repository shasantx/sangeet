import { isAndroidNativeApp } from "./android-bridge";
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
  blob: Blob;
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

export function canDownloadOffline(track: Track): boolean {
  if (!isNativeOfflineSupported()) return false;
  return Boolean(
    track.youtubeId ||
      track.source === "audius" ||
      track.audioUrl.startsWith("/audio/"),
  );
}

function resolveDownloadUrl(track: Track): string {
  if (track.youtubeId) {
    return `/api/youtube/audio?videoId=${encodeURIComponent(track.youtubeId)}`;
  }
  if (track.source === "audius") {
    return `/api/audius/stream?id=${encodeURIComponent(track.id.replace(/^aud-/, ""))}`;
  }
  if (track.audioUrl.startsWith("/audio/")) {
    return track.audioUrl;
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
  if (typeof indexedDB === "undefined") return false;
  try {
    const record = await getRecord(id);
    if (record?.blob) {
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

async function fetchAudioBlob(
  url: string,
  onProgress?: (pct: number) => void,
): Promise<{ blob: Blob; mimeType: string }> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) {
    throw new Error("Could not download this audio file.");
  }

  const rawType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (
    rawType &&
    !rawType.startsWith("audio/") &&
    !rawType.startsWith("video/") &&
    rawType !== "application/octet-stream"
  ) {
    throw new Error("The server returned an invalid audio response.");
  }

  const mimeType = rawType && rawType !== "application/octet-stream" ? rawType : "audio/mpeg";
  const contentLengthHeader = response.headers.get("content-length");
  const totalBytes = contentLengthHeader ? Number(contentLengthHeader) : 0;

  if (!response.body) {
    const blob = await response.blob();
    onProgress?.(100);
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
        onProgress?.(pct);
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
  onProgress?.(100);
  return { blob, mimeType };
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

  const downloadUrl = resolveDownloadUrl(track);
  const { blob, mimeType } = await fetchAudioBlob(downloadUrl, onProgress);

  const record: OfflineTrackRecord = {
    id: track.id,
    track: { ...track },
    artistName: artistName || "Sangeet",
    sizeBytes: blob.size,
    savedAt: Date.now(),
    mimeType,
    blob,
  };

  await putRecord(record);

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
  getOrCacheBlobUrl(track.id, blob);
  notifyOfflineChanges();
}

export async function removeOfflineTrack(trackOrId: Track | string): Promise<void> {
  const id = typeof trackOrId === "string" ? trackOrId : trackOrId.id;
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
    const valid = records.filter((item) => Boolean(item?.id && item?.track && item?.blob));
    valid.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));

    for (const item of valid) {
      downloadedIds.add(item.id);
      getOrCacheBlobUrl(item.id, item.blob);
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

export async function exportTrackAudioFile(track: Track, artistName: string): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") return;

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
      const downloadUrl = resolveDownloadUrl(track);
      const fetched = await fetchAudioBlob(downloadUrl);
      blob = fetched.blob;
      mimeType = fetched.mimeType;
      temporaryUrl = URL.createObjectURL(blob);
      href = temporaryUrl;
    }

    const ext = extensionFromMime(mimeType);
    const safeBase = `${artistName || "Sangeet"} - ${track.title || "Track"}`
      .replace(/[\\/:*?"<>|]+/g, "_")
      .trim()
      .slice(0, 120);
    const filename = `${safeBase || "sangeet-track"}.${ext}`;

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
