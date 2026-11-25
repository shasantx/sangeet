"use client";

import { create } from "zustand";
import type { LyricsResponse, Track } from "@/types/music";

const MAX_CACHE_ENTRIES = 40;
const STORAGE_KEY = "sangeet-v2-lyrics-cache";
const lyricsCache = new Map<string, LyricsResponse>();
let hydratedFromStorage = false;
let activeController: AbortController | null = null;

function cacheKey(track: Track): string {
  return `${track.id}::${track.title.toLowerCase()}::${track.artist.toLowerCase()}`;
}

function hydrateCache() {
  if (hydratedFromStorage || typeof window === "undefined") return;
  hydratedFromStorage = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw) as Array<[string, LyricsResponse]>;
    if (!Array.isArray(entries)) return;
    for (const [k, v] of entries.slice(-MAX_CACHE_ENTRIES)) {
      if (typeof k === "string" && v && typeof v === "object") {
        lyricsCache.set(k, v);
      }
    }
  } catch {
    // Ignore corrupted cache
  }
}

function persistCache() {
  if (typeof window === "undefined") return;
  try {
    const entries = Array.from(lyricsCache.entries()).slice(-MAX_CACHE_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore quota errors
  }
}

interface LyricsState {
  trackId: string | null;
  lyrics: LyricsResponse | null;
  loading: boolean;
  error: string | null;
  fetchLyricsForTrack: (track: Track | null) => Promise<void>;
}

export const useLyricsStore = create<LyricsState>((set, get) => ({
  trackId: null,
  lyrics: null,
  loading: false,
  error: null,

  fetchLyricsForTrack: async (track) => {
    hydrateCache();

    if (!track) {
      activeController?.abort();
      activeController = null;
      set({ trackId: null, lyrics: null, loading: false, error: null });
      return;
    }

    const key = cacheKey(track);
    if (get().trackId === track.id && (get().lyrics !== null || get().loading)) {
      return;
    }

    const cached = lyricsCache.get(key);
    if (cached) {
      // Touch LRU position
      lyricsCache.delete(key);
      lyricsCache.set(key, cached);
      set({ trackId: track.id, lyrics: cached, loading: false, error: null });
      return;
    }

    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;

    set({ trackId: track.id, lyrics: null, loading: true, error: null });

    try {
      const res = await fetch(
        `/api/music/lyrics?title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}`,
        { signal: controller.signal }
      );
      if (!res.ok) {
        throw new Error(`Lyrics request failed (${res.status})`);
      }
      const data = (await res.json()) as LyricsResponse;
      if (controller.signal.aborted) return;

      if (lyricsCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = lyricsCache.keys().next().value;
        if (oldestKey) lyricsCache.delete(oldestKey);
      }
      lyricsCache.set(key, data);
      persistCache();
      set({ trackId: track.id, lyrics: data, loading: false, error: null });
    } catch (err) {
      if (controller.signal.aborted) return;
      set({
        trackId: track.id,
        lyrics: { synced: [], plain: null, source: "none" },
        loading: false,
        error: err instanceof Error ? err.message : "Could not load lyrics"
      });
    }
  }
}));
