"use client";

import { create } from "zustand";

/**
 * What is actually playing right now, for the format badge and the
 * EQ / spatial availability notes. Not persisted.
 */
export type EffectsPath = "web" | "native" | "unavailable";

export interface NowPlayingFormat {
  /** e.g. "AAC", "Opus", "MP3" */
  codec: string;
  /** e.g. "128 kbps · 44.1 kHz" */
  detail: string;
  /** how we got it: straight from the source, converted on this device, or untouched original */
  origin: "source" | "converted" | "original" | "youtube-player";
}

interface PlaybackInfoState {
  format: NowPlayingFormat | null;
  effects: EffectsPath;
  setFormat: (format: NowPlayingFormat | null) => void;
  setEffects: (effects: EffectsPath) => void;
}

export const usePlaybackInfoStore = create<PlaybackInfoState>()((set) => ({
  format: null,
  effects: "unavailable",
  setFormat: (format) => set({ format }),
  setEffects: (effects) => set({ effects })
}));

export function describeFormat(f: NowPlayingFormat | null): string {
  if (!f) return "";
  if (f.origin === "youtube-player") return "YouTube player";
  const origin = f.origin === "converted" ? "converted on this device" : f.origin === "source" ? "from the source" : "original";
  return [f.codec, f.detail, origin].filter(Boolean).join(" · ");
}

/** Parse the Android native player's audio_format event. */
export function formatFromNative(json: string, preferredAac: boolean): NowPlayingFormat | null {
  try {
    const o = JSON.parse(json) as { codec?: string; bitrate?: number; sampleRate?: number };
    const parts: string[] = [];
    if (o.bitrate && o.bitrate > 0) parts.push(`${Math.round(o.bitrate / 1000)} kbps`);
    if (o.sampleRate && o.sampleRate > 0) parts.push(`${(o.sampleRate / 1000).toFixed(1).replace(/\.0$/, "")} kHz`);
    const codec = o.codec || "Audio";
    return {
      codec,
      detail: parts.join(" · "),
      origin: preferredAac && codec === "AAC" ? "source" : "original"
    };
  } catch {
    return null;
  }
}
