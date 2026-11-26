"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuthStore } from "@/store/auth-store";
import {
  buildMoodProfile,
  inferTags,
  rankTracks,
  type ListenEvent,
  type ListenOutcome,
  type ListenTrackSnapshot,
  type MoodProfile
} from "@/lib/mood-engine";
import type { Track } from "@/types/music";

/**
 * On-device listening history per profile (Google, local profile or guest).
 * Feeds the mood / time-of-day engine. Never sent to any server.
 */

const GUEST_KEY = "guest";
const MAX_EVENTS_PER_USER = 500;
const CONTEXT_TTL_MS = 45 * 60_000;

interface UserListening {
  enabled: boolean;
  events: ListenEvent[];
}

interface ListeningState {
  byUser: Record<string, UserListening>;
  record: (userKey: string, event: ListenEvent) => void;
  setEnabled: (userKey: string, enabled: boolean) => void;
  clear: (userKey: string) => void;
}

const EMPTY: UserListening = { enabled: true, events: [] };
const NO_EVENTS: ListenEvent[] = [];

export const useListeningStore = create<ListeningState>()(
  persist(
    (set) => ({
      byUser: {},
      record: (userKey, event) =>
        set((s) => {
          const cur = s.byUser[userKey] ?? EMPTY;
          if (!cur.enabled) return s;
          const events = [...cur.events, event].slice(-MAX_EVENTS_PER_USER);
          return { byUser: { ...s.byUser, [userKey]: { ...cur, events } } };
        }),
      setEnabled: (userKey, enabled) =>
        set((s) => {
          const cur = s.byUser[userKey] ?? EMPTY;
          return { byUser: { ...s.byUser, [userKey]: { ...cur, enabled } } };
        }),
      clear: (userKey) =>
        set((s) => {
          const cur = s.byUser[userKey] ?? EMPTY;
          return { byUser: { ...s.byUser, [userKey]: { ...cur, events: [] } } };
        })
    }),
    { name: "sangeet-v2-listening" }
  )
);

export function listeningUserKey(userId?: string | null): string {
  return userId && userId.trim() ? userId : GUEST_KEY;
}

function currentKey(): string {
  return listeningUserKey(useAuthStore.getState().user?.id);
}

export function getListeningEvents(): ListenEvent[] {
  return useListeningStore.getState().byUser[currentKey()]?.events ?? [];
}

export function isMoodLearningEnabled(): boolean {
  return useListeningStore.getState().byUser[currentKey()]?.enabled ?? true;
}

/** Mood profile for the current profile at the current time. */
export function getCurrentMoodProfile(now: Date = new Date()): MoodProfile {
  return buildMoodProfile(getListeningEvents(), now);
}

/** Re-rank autoplay / radio candidates for the current mood (no-op if learning is off). */
export function rankForCurrentMood<T extends Track>(tracks: T[]): T[] {
  if (tracks.length < 2 || !isMoodLearningEnabled()) return tracks;
  try {
    return rankTracks(tracks, getCurrentMoodProfile());
  } catch {
    return tracks;
  }
}

// ---- Play context: where the user is listening from (genre tile, mood chip, search) ----

let playContext: { tags: string[]; source: string; setAt: number } | null = null;

/** Tell the engine what the user is browsing; attached to plays for the next 45 min. */
export function setListeningContext(tags: string[], source: string): void {
  playContext = tags.length ? { tags, source, setAt: Date.now() } : null;
}

/** Context from free text such as a search query or a mood chip label. */
export function setListeningContextFromText(text: string, source: string): void {
  setListeningContext(inferTags(text), source);
}

function activeContextTags(): string[] {
  if (!playContext) return [];
  if (Date.now() - playContext.setAt > CONTEXT_TTL_MS) {
    playContext = null;
    return [];
  }
  return playContext.tags;
}

export function snapshotTrack(track: Track): ListenTrackSnapshot {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    artistId: track.artistId,
    // Blob/object URLs die with the page, so never persist them.
    thumbnail: track.thumbnail?.startsWith("blob:") ? "" : track.thumbnail,
    duration: track.duration || 0,
    source: track.source
  };
}

/** Called by the ListeningTracker when a track stops being the current track. */
export function recordListen(
  track: Track,
  startedAt: number,
  listened: number,
  outcome: ListenOutcome,
  contextTags: string[]
): void {
  const tags = Array.from(new Set([...inferTags(track.title, track.artist, track.album), ...contextTags]));
  useListeningStore.getState().record(currentKey(), {
    track: snapshotTrack(track),
    ts: startedAt,
    listened: Math.round(listened),
    outcome,
    tags
  });
}

export function captureContextTags(): string[] {
  return activeContextTags();
}

/** Reactive hook for Settings: enabled flag, event count and actions for this profile. */
export function useMoodLearning() {
  const userId = useAuthStore((s) => s.user?.id);
  const key = listeningUserKey(userId);
  const enabled = useListeningStore((s) => s.byUser[key]?.enabled ?? true);
  const count = useListeningStore((s) => s.byUser[key]?.events.length ?? 0);
  const setEnabled = useListeningStore((s) => s.setEnabled);
  const clear = useListeningStore((s) => s.clear);
  return {
    enabled,
    count,
    setEnabled: (v: boolean) => setEnabled(key, v),
    clear: () => clear(key)
  };
}

/** Reactive hook: events for the current profile (for the Home mood shelf). */
export function useListeningEvents(): ListenEvent[] {
  const userId = useAuthStore((s) => s.user?.id);
  const key = listeningUserKey(userId);
  return useListeningStore((s) => s.byUser[key]?.events ?? NO_EVENTS);
}
