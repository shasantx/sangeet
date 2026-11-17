"use client";

export interface LocalScannedTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  uri: string;
}

export interface SangeetAndroidBridge {
  isNativeApp?: () => boolean;
  playYouTube?: (videoId: string, title: string, artist: string, artworkUrl: string) => void;
  playAudioUrl?: (url: string, title: string, artist: string, artworkUrl: string) => void;
  playLocalContent?: (contentUri: string, title: string, artist: string) => void;
  pause?: () => void;
  resume?: () => void;
  seekTo?: (seconds: number) => void;
  stop?: () => void;
  setVolume?: (volume: number) => void;
  setPlaybackRate?: (rate: number) => void;
  hasAudioPermission?: () => boolean;
  requestAudioPermission?: () => void;
  scanLocalAudio?: () => string;
  reloadOnline?: () => void;
  fetchYouTubeAudioBase64?: (requestId: string, videoId: string) => void;
  downloadYouTubeAudioToOffline?: (requestId: string, trackId: string, videoId: string) => void;
  downloadAudioFile?: (url: string, filename: string, mimeType: string) => boolean;
  beginOfflineAudioWrite?: (trackId: string, extension: string) => boolean;
  writeOfflineAudioChunk?: (trackId: string, base64: string) => boolean;
  finishOfflineAudioWrite?: (trackId: string) => boolean;
  abortOfflineAudioWrite?: (trackId: string) => void;
  playOfflineAudio?: (trackId: string, title: string, artist: string, artworkUrl: string) => boolean;
  removeOfflineAudio?: (trackId: string) => void;
  hasOfflineAudio?: (trackId: string) => boolean;
  exportOfflineAudio?: (trackId: string, filename: string) => boolean;
}

declare global {
  interface Window {
    SangeetAndroid?: SangeetAndroidBridge;
    __sangeetAndroidEvent?: (type: string, payload?: string) => void;
  }
}

type AndroidEventListener = (type: string, payload?: string) => void;

const androidEventListeners = new Set<AndroidEventListener>();
let installedDispatcher: AndroidEventListener | null = null;
let previousExternalHandler: AndroidEventListener | undefined;

/**
 * Subscribe to native Android bridge events without clobbering other listeners
 * on `window.__sangeetAndroidEvent`. Returns an unsubscribe function.
 */
export function addAndroidEventListener(listener: AndroidEventListener): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  androidEventListeners.add(listener);

  if (!installedDispatcher || window.__sangeetAndroidEvent !== installedDispatcher) {
    const existing = window.__sangeetAndroidEvent;
    if (existing && existing !== installedDispatcher) {
      previousExternalHandler = existing;
    }

    installedDispatcher = (type: string, payload?: string) => {
      try {
        previousExternalHandler?.(type, payload);
      } catch {
        // Ignore external handler errors so remaining subscribers still receive events.
      }
      for (const subscriber of Array.from(androidEventListeners)) {
        try {
          subscriber(type, payload);
        } catch {
          // Isolate listener errors.
        }
      }
    };

    window.__sangeetAndroidEvent = installedDispatcher;
  }

  return () => {
    androidEventListeners.delete(listener);
    if (
      androidEventListeners.size === 0 &&
      typeof window !== "undefined" &&
      window.__sangeetAndroidEvent === installedDispatcher
    ) {
      if (previousExternalHandler) {
        window.__sangeetAndroidEvent = previousExternalHandler;
      } else {
        delete window.__sangeetAndroidEvent;
      }
      installedDispatcher = null;
      previousExternalHandler = undefined;
    }
  };
}

export function isAndroidNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.SangeetAndroid?.isNativeApp?.());
  } catch {
    return false;
  }
}

export function androidPlayYouTube(
  videoId: string,
  title: string,
  artist: string,
  artworkUrl: string,
): boolean {
  if (!isAndroidNativeApp()) return false;
  try {
    window.SangeetAndroid?.playYouTube?.(videoId, title, artist, artworkUrl);
    return true;
  } catch {
    return false;
  }
}

export function androidPlayAudioUrl(
  url: string,
  title: string,
  artist: string,
  artworkUrl: string,
): boolean {
  if (!isAndroidNativeApp()) return false;
  try {
    const absoluteUrl = url.startsWith("content://")
      ? url
      : new URL(url, window.location.origin).href;
    const absoluteArt = artworkUrl ? new URL(artworkUrl, window.location.origin).href : "";
    window.SangeetAndroid?.playAudioUrl?.(absoluteUrl, title, artist, absoluteArt);
    return true;
  } catch {
    return false;
  }
}

export function androidPause(): void {
  if (!isAndroidNativeApp()) return;
  try { window.SangeetAndroid?.pause?.(); } catch { /* ignore */ }
}

export function androidResume(): void {
  if (!isAndroidNativeApp()) return;
  try { window.SangeetAndroid?.resume?.(); } catch { /* ignore */ }
}

export function androidSeek(seconds: number): void {
  if (!isAndroidNativeApp()) return;
  try { window.SangeetAndroid?.seekTo?.(seconds); } catch { /* ignore */ }
}

export function androidStop(): void {
  if (!isAndroidNativeApp()) return;
  try { window.SangeetAndroid?.stop?.(); } catch { /* ignore */ }
}

export function androidDownloadAudioFile(
  url: string,
  filename: string,
  mimeType = "audio/mpeg",
): boolean {
  if (!isAndroidNativeApp() || !window.SangeetAndroid?.downloadAudioFile) return false;
  try {
    const absoluteUrl = url.startsWith("content://")
      ? url
      : new URL(url, window.location.origin).href;
    return Boolean(window.SangeetAndroid.downloadAudioFile(absoluteUrl, filename, mimeType));
  } catch {
    return false;
  }
}

export async function androidStoreOfflineAudio(
  trackId: string,
  blob: Blob,
  onProgress?: (percent: number) => void,
): Promise<boolean> {
  const bridge = typeof window !== "undefined" ? window.SangeetAndroid : undefined;
  if (
    !isAndroidNativeApp() ||
    !bridge?.beginOfflineAudioWrite ||
    !bridge.writeOfflineAudioChunk ||
    !bridge.finishOfflineAudioWrite ||
    blob.size === 0
  ) return false;

  const mime = blob.type.toLowerCase();
  const extension = mime.includes("webm") ? "webm"
    : mime.includes("ogg") || mime.includes("opus") ? "ogg"
    : mime.includes("flac") ? "flac"
    : mime.includes("wav") ? "wav"
    : mime.includes("mpeg") || mime.includes("mp3") ? "mp3"
    : "m4a";
  const chunkSize = 196608;
  try {
    if (!bridge.beginOfflineAudioWrite(trackId, extension)) return false;
    for (let offset = 0; offset < blob.size; offset += chunkSize) {
      const bytes = new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index]);
      }
      if (!bridge.writeOfflineAudioChunk(trackId, btoa(binary))) {
        bridge.abortOfflineAudioWrite?.(trackId);
        return false;
      }
      onProgress?.(Math.round(Math.min(99, ((offset + bytes.length) / blob.size) * 100)));
    }
    if (!bridge.finishOfflineAudioWrite(trackId)) {
      bridge.abortOfflineAudioWrite?.(trackId);
      return false;
    }
    onProgress?.(100);
    return true;
  } catch {
    try { bridge.abortOfflineAudioWrite?.(trackId); } catch { /* ignore */ }
    return false;
  }
}

export function androidPlayOfflineAudio(
  trackId: string,
  title: string,
  artist: string,
  artworkUrl: string,
): boolean {
  if (!isAndroidNativeApp() || !window.SangeetAndroid?.playOfflineAudio) return false;
  try {
    const absoluteArt = artworkUrl ? new URL(artworkUrl, window.location.origin).href : "";
    return Boolean(window.SangeetAndroid.playOfflineAudio(trackId, title, artist, absoluteArt));
  } catch {
    return false;
  }
}

export function androidRemoveOfflineAudio(trackId: string): void {
  if (!isAndroidNativeApp()) return;
  try { window.SangeetAndroid?.removeOfflineAudio?.(trackId); } catch { /* ignore */ }
}

export function androidHasOfflineAudio(trackId: string): boolean {
  if (!isAndroidNativeApp() || !window.SangeetAndroid?.hasOfflineAudio) return false;
  try { return Boolean(window.SangeetAndroid.hasOfflineAudio(trackId)); } catch { return false; }
}

export function androidExportOfflineAudio(trackId: string, filename: string): boolean {
  if (!isAndroidNativeApp() || !window.SangeetAndroid?.exportOfflineAudio) return false;
  try { return Boolean(window.SangeetAndroid.exportOfflineAudio(trackId, filename)); } catch { return false; }
}

export function androidSetVolume(volume: number): void {
  if (!isAndroidNativeApp()) return;
  try { window.SangeetAndroid?.setVolume?.(volume); } catch { /* ignore */ }
}

export function androidSetPlaybackRate(rate: number): void {
  if (!isAndroidNativeApp()) return;
  try { window.SangeetAndroid?.setPlaybackRate?.(rate); } catch { /* ignore */ }
}

export function androidHasAudioPermission(): boolean {
  if (!isAndroidNativeApp()) return false;
  try {
    return Boolean(window.SangeetAndroid?.hasAudioPermission?.());
  } catch {
    return false;
  }
}

export function androidRequestAudioPermission(): void {
  if (!isAndroidNativeApp()) return;
  try {
    window.SangeetAndroid?.requestAudioPermission?.();
  } catch {
    /* ignore */
  }
}

export function androidScanLocalAudio(): LocalScannedTrack[] {
  if (!isAndroidNativeApp()) return [];
  try {
    const raw = window.SangeetAndroid?.scanLocalAudio?.();
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const tracks: LocalScannedTrack[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const rawId = record.id;
      const rawUri = record.uri;
      const validId =
        typeof rawId === "string" || (typeof rawId === "number" && Number.isFinite(rawId));
      if (!validId || typeof rawUri !== "string") continue;

      const id = String(rawId).trim();
      const uri = rawUri.trim();
      if (!id || !uri) continue;

      const rawTitle = typeof record.title === "string" ? record.title.trim() : "";
      const rawArtist = typeof record.artist === "string" ? record.artist.trim() : "";
      const rawAlbum = typeof record.album === "string" ? record.album.trim() : "";
      const rawDuration = Number(record.duration);

      tracks.push({
        id,
        title: rawTitle && rawTitle.toLowerCase() !== "<unknown>" ? rawTitle : "Unknown Title",
        artist:
          rawArtist && rawArtist.toLowerCase() !== "<unknown>" ? rawArtist : "Unknown Artist",
        album: rawAlbum && rawAlbum.toLowerCase() !== "<unknown>" ? rawAlbum : "",
        duration: Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0,
        uri,
      });
    }
    return tracks;
  } catch {
    return [];
  }
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function androidFetchYouTubeAudio(
  videoId: string,
  onProgress?: (pct: number) => void,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const cleanVideoId = videoId.trim();
  if (!cleanVideoId) {
    return Promise.reject(new Error("Invalid YouTube video ID."));
  }
  if (
    typeof window === "undefined" ||
    !isAndroidNativeApp() ||
    typeof window.SangeetAndroid?.fetchYouTubeAudioBase64 !== "function"
  ) {
    return Promise.reject(new Error("Android native YouTube audio bridge is unavailable."));
  }

  const requestId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `yt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return new Promise<{ bytes: Uint8Array; mimeType: string }>((resolve, reject) => {
    const chunks = new Map<number, string>();
    let resolvedMimeType = "audio/mp4";
    let settled = false;
    let lastProgress = 0;
    let timeoutId: number | null = null;
    let unsubscribe = () => {};

    const cleanup = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      unsubscribe();
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    const resetTimeout = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        fail("Timed out downloading audio on Android.");
      }, 120_000);
    };

    const reportProgress = (pct: number) => {
      const clamped = Math.max(lastProgress, Math.min(99, Math.round(pct)));
      if (clamped > lastProgress) {
        lastProgress = clamped;
        onProgress?.(clamped);
      }
    };

    unsubscribe = addAndroidEventListener((type, payload) => {
      if (settled) return;
      if (
        type !== "offline_audio_chunk" &&
        type !== "offline_audio_data" &&
        type !== "offline_audio_error" &&
        type !== "offline_audio_progress"
      ) {
        return;
      }
      if (!payload) return;

      let parsed: Record<string, unknown>;
      try {
        const raw = JSON.parse(payload) as unknown;
        if (!raw || typeof raw !== "object") return;
        parsed = raw as Record<string, unknown>;
      } catch {
        return;
      }

      if (parsed.requestId !== requestId) return;

      if (type === "offline_audio_error") {
        const message =
          typeof parsed.error === "string" && parsed.error.trim()
            ? parsed.error.trim()
            : "Android could not download this YouTube track.";
        fail(message);
        return;
      }

      if (type === "offline_audio_progress") {
        resetTimeout();
        const rawProgress = Number(parsed.progress);
        if (Number.isFinite(rawProgress) && rawProgress > 0) {
          reportProgress(rawProgress * 0.85);
        }
        return;
      }

      if (type === "offline_audio_data") {
        if (parsed.ok === false) {
          const message =
            typeof parsed.error === "string" && parsed.error.trim()
              ? parsed.error.trim()
              : "Android could not download this YouTube track.";
          fail(message);
          return;
        }
        if (typeof parsed.base64 !== "string" || !parsed.base64) {
          fail("Android returned empty audio data.");
          return;
        }
        try {
          const bytes = decodeBase64ToBytes(parsed.base64);
          if (bytes.byteLength === 0) {
            fail("Downloaded audio file was empty.");
            return;
          }
          const mimeType =
            typeof parsed.mimeType === "string" && parsed.mimeType.trim()
              ? parsed.mimeType.trim()
              : resolvedMimeType;
          settled = true;
          cleanup();
          onProgress?.(100);
          resolve({ bytes, mimeType });
        } catch {
          fail("Failed to decode downloaded audio bytes.");
        }
        return;
      }

      // type === "offline_audio_chunk"
      const index = parsed.index;
      const total = parsed.total;
      const chunk = parsed.chunk;
      if (
        typeof index !== "number" ||
        !Number.isInteger(index) ||
        typeof total !== "number" ||
        !Number.isInteger(total) ||
        total <= 0 ||
        index < 0 ||
        index >= total ||
        typeof chunk !== "string"
      ) {
        return;
      }

      resetTimeout();

      if (typeof parsed.mimeType === "string" && parsed.mimeType.trim()) {
        resolvedMimeType = parsed.mimeType.trim();
      }
      chunks.set(index, chunk);
      reportProgress((chunks.size / total) * 99);

      if (chunks.size === total) {
        try {
          const decodedParts: Uint8Array[] = [];
          let totalByteLength = 0;
          for (let i = 0; i < total; i++) {
            const partB64 = chunks.get(i);
            if (typeof partB64 !== "string") {
              fail("Missing audio chunk from Android bridge.");
              return;
            }
            const partBytes = decodeBase64ToBytes(partB64);
            decodedParts.push(partBytes);
            totalByteLength += partBytes.byteLength;
          }
          if (totalByteLength === 0) {
            fail("Downloaded audio file was empty.");
            return;
          }
          const combined = new Uint8Array(totalByteLength);
          let offset = 0;
          for (const part of decodedParts) {
            combined.set(part, offset);
            offset += part.byteLength;
          }
          settled = true;
          cleanup();
          onProgress?.(100);
          resolve({ bytes: combined, mimeType: resolvedMimeType });
        } catch {
          fail("Failed to reassemble downloaded audio chunks.");
        }
      }
    });

    resetTimeout();
    try {
      window.SangeetAndroid?.fetchYouTubeAudioBase64?.(requestId, cleanVideoId);
    } catch (error) {
      fail(
        error instanceof Error && error.message
          ? error.message
          : "Could not invoke Android audio download.",
      );
    }
  });
}

export function androidDownloadYouTubeAudioToOffline(
  trackId: string,
  videoId: string,
  onProgress?: (pct: number) => void,
): Promise<number> {
  const bridge = typeof window === "undefined" ? undefined : window.SangeetAndroid;
  if (!isAndroidNativeApp() || typeof bridge?.downloadYouTubeAudioToOffline !== "function") {
    return Promise.reject(new Error("Android offline download bridge is unavailable. Update the Sangeet APK."));
  }
  const requestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return new Promise<number>((resolve, reject) => {
    let settled = false;
    let timeoutId: number | null = null;
    let lastProgress = 0;
    let unsubscribe = () => {};
    const cleanup = () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      unsubscribe();
    };
    const resetTimeout = () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("Timed out saving audio on Android."));
      }, 120_000);
    };
    unsubscribe = addAndroidEventListener((type, payload) => {
      if (settled || !payload || !["offline_audio_progress", "offline_audio_error", "offline_audio_saved"].includes(type)) return;
      let event: Record<string, unknown>;
      try { event = JSON.parse(payload) as Record<string, unknown>; } catch { return; }
      if (event.requestId !== requestId) return;
      resetTimeout();
      if (type === "offline_audio_error") {
        settled = true;
        cleanup();
        reject(new Error(typeof event.error === "string" ? event.error : "Android could not save this track."));
      } else if (type === "offline_audio_progress") {
        const pct = Number(event.progress);
        if (Number.isFinite(pct)) {
          lastProgress = Math.max(lastProgress, Math.min(99, Math.round(pct)));
          onProgress?.(lastProgress);
        }
      } else {
        settled = true;
        cleanup();
        onProgress?.(100);
        resolve(Math.max(0, Number(event.sizeBytes) || 0));
      }
    });
    resetTimeout();
    try {
      bridge.downloadYouTubeAudioToOffline?.(requestId, trackId, videoId);
    } catch (error) {
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error("Could not start Android offline download."));
    }
  });
}
