"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RepeatMode, Track } from "@/types/music";

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  history: Track[];
  isPlaying: boolean;
  isBuffering: boolean;
  playbackError: string | null;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  seekNonce: number;
  seekTarget: number | null;
  trackLoadNonce: number;
  radioLoading: boolean;
  sleepTimerEndsAt: number | null;
  sleepAtTrackEnd: boolean;
  autoplayRadio: boolean;
  sponsorBlockEnabled: boolean;

  playTrack: (track: Track, contextQueue?: Track[]) => void;
  playShuffled: (tracks: Track[]) => void;
  retryCurrentTrack: () => void;
  togglePlay: () => void;
  setIsPlaying: (playing: boolean) => void;
  setIsBuffering: (buffering: boolean) => void;
  setPlaybackError: (err: string | null) => void;
  setProgress: (currentTime: number, duration?: number) => void;
  requestSeek: (seconds: number) => void;
  clearSeekTarget: () => void;
  nextTrack: (fromTrackEnd?: boolean) => Promise<void>;
  prevTrack: () => void;
  playNext: (track: Track) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  moveQueueItem: (from: number, to: number) => void;
  shuffleQueue: () => void;
  clearQueue: () => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setSleepTimer: (minutes: number | null) => void;
  setSleepAtTrackEnd: (enabled: boolean) => void;
  setAutoplayRadio: (enabled: boolean) => void;
  setSponsorBlockEnabled: (enabled: boolean) => void;
  fetchRadioForTrack: (videoId: string) => Promise<void>;
}

/** Strip ephemeral blob URLs before persisting to localStorage. */
function sanitizeTrackForStorage(track: Track | null): Track | null {
  if (!track) return null;
  if (track.localUrl && !track.offlineId) return null;
  const copy = { ...track };
  delete copy.localUrl;
  return copy;
}

function fisherYates<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      queue: [],
      history: [],
      isPlaying: false,
      isBuffering: false,
      playbackError: null,
      currentTime: 0,
      duration: 0,
      volume: 80,
      muted: false,
      shuffle: false,
      repeat: "off",
      seekNonce: 0,
      seekTarget: null,
      trackLoadNonce: 0,
      radioLoading: false,
      sleepTimerEndsAt: null,
      sleepAtTrackEnd: false,
      autoplayRadio: true,
      sponsorBlockEnabled: true,

      playTrack: (track, contextQueue) => {
        const prev = get().currentTrack;
        const nextHistory =
          prev && prev.id !== track.id
            ? [prev, ...get().history.filter((t) => t.id !== prev.id)].slice(0, 50)
            : get().history;

        let nextQueue = get().queue;
        if (contextQueue && contextQueue.length > 0) {
          const idx = contextQueue.findIndex((t) => t.id === track.id);
          if (idx >= 0) {
            nextQueue = contextQueue.slice(idx + 1);
          } else {
            nextQueue = contextQueue.filter((t) => t.id !== track.id);
          }
        }

        set((s) => ({
          currentTrack: track,
          queue: nextQueue,
          history: nextHistory,
          isPlaying: true,
          isBuffering: true,
          playbackError: null,
          currentTime: 0,
          duration: track.duration || 0,
          trackLoadNonce: s.trackLoadNonce + 1
        }));

        const isDirectAudio = Boolean(
          track.localUrl || track.offlineId || track.streamUrl
        );
        if (nextQueue.length < 3 && get().autoplayRadio && !isDirectAudio) {
          void get().fetchRadioForTrack(track.id);
        }
      },

      playShuffled: (tracks) => {
        if (!tracks || tracks.length === 0) return;
        const shuffled = fisherYates(tracks);
        set({ shuffle: true });
        get().playTrack(shuffled[0], shuffled);
      },

      retryCurrentTrack: () => {
        const track = get().currentTrack;
        if (!track) return;
        set((s) => ({
          playbackError: null,
          isBuffering: true,
          isPlaying: true,
          trackLoadNonce: s.trackLoadNonce + 1
        }));
      },

      togglePlay: () => {
        if (!get().currentTrack) return;
        set((s) => ({
          isPlaying: !s.isPlaying,
          playbackError: null
        }));
      },

      setIsPlaying: (isPlaying) => set({ isPlaying }),
      setIsBuffering: (isBuffering) => set({ isBuffering }),
      setPlaybackError: (playbackError) =>
        set(() =>
          playbackError
            ? { playbackError, isBuffering: false, isPlaying: false }
            : { playbackError: null }
        ),

      setProgress: (currentTime, duration) =>
        set((s) => {
          const nextDuration =
            duration && Number.isFinite(duration) && duration > 0
              ? duration
              : s.duration;
          if (
            Math.abs(currentTime - s.currentTime) < 0.2 &&
            nextDuration === s.duration
          ) {
            return s;
          }
          return {
            currentTime: Math.max(0, currentTime),
            duration: nextDuration
          };
        }),

      requestSeek: (seconds) =>
        set((s) => ({
          currentTime: Math.max(0, seconds),
          seekTarget: Math.max(0, seconds),
          seekNonce: s.seekNonce + 1
        })),

      clearSeekTarget: () => set({ seekTarget: null }),

      nextTrack: async (fromTrackEnd = false) => {
        const {
          currentTrack,
          queue,
          repeat,
          shuffle,
          history,
          autoplayRadio,
          sleepAtTrackEnd
        } = get();
        if (!currentTrack) return;

        if (fromTrackEnd && sleepAtTrackEnd) {
          set({
            isPlaying: false,
            isBuffering: false,
            sleepAtTrackEnd: false
          });
          return;
        }

        if (repeat === "one" && fromTrackEnd) {
          get().requestSeek(0);
          set({ isPlaying: true, playbackError: null });
          return;
        }

        const isDirectAudio = Boolean(
          currentTrack.localUrl ||
            currentTrack.offlineId ||
            currentTrack.streamUrl
        );
        if (queue.length === 0 && autoplayRadio && !isDirectAudio && repeat !== "all") {
          await get().fetchRadioForTrack(currentTrack.id);
        }

        const updatedQueue = get().queue;
        if (updatedQueue.length === 0) {
          if (repeat === "all") {
            if (history.length > 0) {
              const cycle = [...history].reverse();
              const [first, ...rest] = cycle;
              set((s) => ({
                currentTrack: first,
                queue: [...rest, currentTrack],
                history: [],
                isPlaying: true,
                isBuffering: true,
                playbackError: null,
                currentTime: 0,
                duration: first.duration || 0,
                trackLoadNonce: s.trackLoadNonce + 1
              }));
            } else {
              get().requestSeek(0);
              set({ isPlaying: true, playbackError: null });
            }
          } else {
            set({ isPlaying: false, isBuffering: false });
          }
          return;
        }

        let pickIndex = 0;
        if (shuffle && updatedQueue.length > 1) {
          pickIndex = Math.floor(Math.random() * updatedQueue.length);
        }

        const next = updatedQueue[pickIndex];
        const remaining = updatedQueue.filter((_, i) => i !== pickIndex);

        set((s) => ({
          currentTrack: next,
          queue: remaining,
          history: [
            currentTrack,
            ...history.filter((t) => t.id !== currentTrack.id)
          ].slice(0, 50),
          isPlaying: true,
          isBuffering: true,
          playbackError: null,
          currentTime: 0,
          duration: next.duration || 0,
          trackLoadNonce: s.trackLoadNonce + 1
        }));

        const nextIsDirect = Boolean(
          next.localUrl || next.offlineId || next.streamUrl
        );
        if (remaining.length < 3 && autoplayRadio && !nextIsDirect) {
          void get().fetchRadioForTrack(next.id);
        }
      },

      prevTrack: () => {
        const { currentTime, history, currentTrack, queue } = get();
        if (!currentTrack) return;

        if (currentTime > 3 || history.length === 0) {
          get().requestSeek(0);
          set({ isPlaying: true, playbackError: null });
          return;
        }

        const [prev, ...restHistory] = history;
        set((s) => ({
          currentTrack: prev,
          queue: [currentTrack, ...queue],
          history: restHistory,
          isPlaying: true,
          isBuffering: true,
          playbackError: null,
          currentTime: 0,
          duration: prev.duration || 0,
          trackLoadNonce: s.trackLoadNonce + 1
        }));
      },

      playNext: (track) =>
        set((s) => ({
          queue: [track, ...s.queue.filter((t) => t.id !== track.id)]
        })),

      addToQueue: (track) =>
        set((s) => ({
          queue: [...s.queue.filter((t) => t.id !== track.id), track]
        })),

      removeFromQueue: (index) =>
        set((s) => ({
          queue: s.queue.filter((_, i) => i !== index)
        })),

      moveQueueItem: (from, to) =>
        set((s) => {
          if (to < 0 || to >= s.queue.length || from === to) return s;
          const next = [...s.queue];
          const [item] = next.splice(from, 1);
          next.splice(to, 0, item);
          return { queue: next };
        }),

      shuffleQueue: () =>
        set((s) => ({
          queue: fisherYates(s.queue)
        })),

      clearQueue: () => set({ queue: [] }),

      setVolume: (volume) =>
        set({
          volume: Math.max(0, Math.min(100, volume)),
          muted: volume === 0
        }),

      toggleMute: () => set((s) => ({ muted: !s.muted })),

      toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),

      cycleRepeat: () =>
        set((s) => ({
          repeat:
            s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off"
        })),

      setSleepTimer: (minutes) =>
        set({
          sleepTimerEndsAt:
            minutes && minutes > 0 ? Date.now() + minutes * 60 * 1000 : null,
          sleepAtTrackEnd: false
        }),

      setSleepAtTrackEnd: (enabled) =>
        set({
          sleepAtTrackEnd: enabled,
          sleepTimerEndsAt: enabled ? null : get().sleepTimerEndsAt
        }),

      setAutoplayRadio: (autoplayRadio) => set({ autoplayRadio }),

      setSponsorBlockEnabled: (sponsorBlockEnabled) =>
        set({ sponsorBlockEnabled }),

      fetchRadioForTrack: async (videoId) => {
        if (get().radioLoading || !videoId) return;
        set({ radioLoading: true });
        try {
          const res = await fetch(
            `/api/music/radio?videoId=${encodeURIComponent(videoId)}`
          );
          if (!res.ok) return;
          const data = await res.json();
          const incoming: Track[] = Array.isArray(data?.tracks)
            ? data.tracks
            : [];
          if (incoming.length > 0) {
            const existingIds = new Set([
              get().currentTrack?.id,
              ...get().queue.map((t) => t.id)
            ]);
            const fresh = incoming.filter((t) => !existingIds.has(t.id));
            if (fresh.length > 0) {
              set((s) => ({ queue: [...s.queue, ...fresh] }));
            }
          }
        } catch {
          // Ignore transient radio fetch errors
        } finally {
          set({ radioLoading: false });
        }
      }
    }),
    {
      name: "sangeet-v2-player",
      partialize: (s) => ({
        currentTrack: sanitizeTrackForStorage(s.currentTrack),
        queue: s.queue
          .map((t) => sanitizeTrackForStorage(t))
          .filter((t): t is Track => t !== null)
          .slice(0, 20),
        volume: s.volume,
        muted: s.muted,
        shuffle: s.shuffle,
        repeat: s.repeat,
        autoplayRadio: s.autoplayRadio,
        sponsorBlockEnabled: s.sponsorBlockEnabled
      })
    }
  )
);
