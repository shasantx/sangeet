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
  pause?: () => void;
  resume?: () => void;
  seekTo?: (seconds: number) => void;
  stop?: () => void;
  setVolume?: (volume: number) => void;
  setPlaybackRate?: (rate: number) => void;
  hasAudioPermission?: () => boolean;
  requestAudioPermission?: () => void;
  scanLocalAudio?: () => string;
}

declare global {
  interface Window {
    SangeetAndroid?: SangeetAndroidBridge;
    __sangeetAndroidEvent?: (type: string, payload?: string) => void;
  }
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
    return parsed.filter(
      (item): item is LocalScannedTrack =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as LocalScannedTrack).id === "string" &&
        typeof (item as LocalScannedTrack).uri === "string",
    );
  } catch {
    return [];
  }
}
