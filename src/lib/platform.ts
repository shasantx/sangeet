"use client";

import { useEffect, useState } from "react";

export type AppPlatform = "web" | "android" | "windows";

export interface ScannedDeviceTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  uri: string;
  path?: string;
  sizeBytes?: number;
}

export interface SangeetAndroidBridge {
  isNativeApp?: () => boolean;
  setSystemTheme?: (theme: string) => void;
  playYouTube?: (
    videoId: string,
    title: string,
    artist: string,
    artworkUrl: string
  ) => void;
  prefetchYouTube?: (videoId: string) => void;
  playAudioUrl?: (
    url: string,
    title: string,
    artist: string,
    artworkUrl: string
  ) => void;
  playLocalContent?: (
    contentUri: string,
    title: string,
    artist: string
  ) => void;
  playOfflineAudio?: (
    trackId: string,
    title: string,
    artist: string,
    artworkUrl: string
  ) => boolean;
  hasOfflineAudio?: (trackId: string) => boolean;
  removeOfflineAudio?: (trackId: string) => void;
  exportOfflineAudio?: (trackId: string, filename: string) => boolean;
  downloadYouTubeAudioToOffline?: (
    requestId: string,
    trackId: string,
    videoId: string
  ) => void;
  downloadAudioFile?: (
    url: string,
    filename: string,
    mimeType: string
  ) => boolean;
  pause?: () => void;
  resume?: () => void;
  syncPlaybackState?: () => void;
  seekTo?: (seconds: number) => void;
  setVolume?: (volume: number) => void;
  hasAudioPermission?: () => boolean;
  requestAudioPermission?: () => void;
  scanLocalAudio?: () => string;
  /** "aac" prefers YouTube's native AAC stream; "original" picks the highest-bitrate stream. */
  setPreferredAudioFormat?: (format: string) => void;
  /** Native EQ + spatial: gainsCsv = 5 dB values, spatial = "off" | "natural" | "immersive". */
  setAudioEffects?: (eqEnabled: boolean, gainsCsv: string, spatial: string) => void;
}

export interface DesktopSaveResult {
  ok: boolean;
  path?: string;
  sizeBytes?: number;
  error?: string;
}

type TauriInvoke = <T = unknown>(
  cmd: string,
  args?: Record<string, unknown> | Uint8Array,
  options?: { headers?: Record<string, string> }
) => Promise<T>;

function saveAudioBytesVia(invoke: TauriInvoke) {
  return (meta: { trackId: string; filename: string }, bytes: Uint8Array) =>
    invoke<DesktopSaveResult>("save_audio_bytes", bytes, {
      headers: {
        "x-sangeet-track-id": encodeURIComponent(meta.trackId),
        "x-sangeet-filename": encodeURIComponent(meta.filename)
      }
    });
}

export interface SangeetDesktopBridge {
  isNativeApp?: () => boolean;
  platform?: string;
  setSystemTheme?: (theme: string) => void;
  scanLocalAudio?: () => Promise<ScannedDeviceTrack[]>;
  downloadAudioTrack?: (payload: {
    trackId: string;
    url: string;
    title: string;
    artist: string;
    filename: string;
  }) => Promise<{ ok: boolean; path?: string; sizeBytes?: number; error?: string }>;
  /** Saves already-converted audio bytes (e.g. AAC .m4a) into Music/Sangeet. */
  saveAudioBytes?: (
    meta: { trackId: string; filename: string },
    bytes: Uint8Array
  ) => Promise<DesktopSaveResult>;
  openDownloadsFolder?: () => Promise<void>;
}

declare global {
  interface Window {
    SangeetAndroid?: SangeetAndroidBridge;
    SangeetDesktop?: SangeetDesktopBridge;
    __TAURI__?: {
      core?: {
        invoke?: TauriInvoke;
      };
    };
    __TAURI_INTERNALS__?: {
      invoke?: TauriInvoke;
    };
  }
}

/** Patterns for ringtones, notifications, alarms, call/voice recordings & chat voice notes. */
const EXCLUDED_AUDIO_PATH_REGEX =
  /(^|[\\/_\-\s.])(ringtones?|notifications?|alarms?|recordings?|sound[\s_-]?recorder|voice[\s_-]?recorder|call[\s_-]?recordings?|callrecord|voicemail|whatsapp[\s_-]?(audio|voice)|telegram[\s_-]?(audio|voice)|messenger|wechat|signal|dictaphone|screen[\s_-]?record|ptt-\d{6}|aud-\d{6}|voice[\s_-]?notes?|memo|ui[\s_-]?sounds?|system[\\/]media)($|[\\/_\-\s.])/i;

export const MIN_MUSIC_DURATION_SECONDS = 15;
export const MIN_MUSIC_SIZE_BYTES = 180 * 1024; // 180 KB

/**
 * Returns true if a file path, filename, duration, or size indicates a
 * non-music clip (ringtone, alarm, notification, call/voice recording, etc.).
 */
export function isExcludedNonMusicAudio(opts: {
  pathOrName?: string;
  durationSec?: number;
  sizeBytes?: number;
}): boolean {
  const { pathOrName = "", durationSec, sizeBytes } = opts;
  if (pathOrName && EXCLUDED_AUDIO_PATH_REGEX.test(pathOrName)) {
    return true;
  }
  if (
    typeof durationSec === "number" &&
    Number.isFinite(durationSec) &&
    durationSec > 0 &&
    durationSec < MIN_MUSIC_DURATION_SECONDS
  ) {
    return true;
  }
  if (
    typeof sizeBytes === "number" &&
    Number.isFinite(sizeBytes) &&
    sizeBytes > 0 &&
    sizeBytes < MIN_MUSIC_SIZE_BYTES
  ) {
    return true;
  }
  return false;
}

export function getAndroidBridge(): SangeetAndroidBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = window.SangeetAndroid;
  if (
    bridge &&
    typeof bridge.isNativeApp === "function" &&
    bridge.isNativeApp()
  ) {
    return bridge;
  }
  return null;
}

export function getWindowsBridge(): SangeetDesktopBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = window.SangeetDesktop;
  if (
    bridge &&
    typeof bridge.isNativeApp === "function" &&
    bridge.isNativeApp()
  ) {
    return bridge;
  }
  const tauriInvoke =
    window.__TAURI__?.core?.invoke || window.__TAURI_INTERNALS__?.invoke;
  if (typeof tauriInvoke === "function") {
    return {
      isNativeApp: () => true,
      platform: "windows",
      scanLocalAudio: () =>
        tauriInvoke<ScannedDeviceTrack[]>("scan_local_audio"),
      downloadAudioTrack: (payload) =>
        tauriInvoke<{
          ok: boolean;
          path?: string;
          sizeBytes?: number;
          error?: string;
        }>("download_audio_track", { payload }),
      saveAudioBytes: saveAudioBytesVia(tauriInvoke),
      openDownloadsFolder: () => tauriInvoke<void>("open_downloads_folder")
    };
  }
  return null;
}

export function getPlatform(): AppPlatform {
  if (typeof window === "undefined") return "web";
  if (getAndroidBridge()) return "android";
  if (getWindowsBridge()) return "windows";
  return "web";
}

export function usePlatform() {
  const [platform, setPlatform] = useState<AppPlatform>("web");

  useEffect(() => {
    setPlatform(getPlatform());
  }, []);

  return {
    platform,
    isWeb: platform === "web",
    isAndroid: platform === "android",
    isWindows: platform === "windows",
    isNative: platform === "android" || platform === "windows"
  };
}
