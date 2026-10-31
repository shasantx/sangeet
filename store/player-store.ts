"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getAudioElement } from "@/lib/audio-engine";
import { getTrack, tracks } from "@/lib/catalog";
import {
  loadYouTubeVideo,
  muteYouTube,
  pauseYouTube,
  playYouTube,
  seekYouTube,
  setYouTubeVolume,
  stopYouTube,
} from "@/lib/youtube-engine";
import { safeStorage } from "@/lib/storage";
import { clamp } from "@/lib/utils";
import type { Track } from "@/lib/types";
import { useAppStore } from "./app-store";
import { useAuthStore } from "./auth-store";
import { toast } from "./ui-store";

export type RepeatMode = "off" | "all" | "one";

interface PlayerState {
  currentTrackId: string | null;
  queue: string[];
  queueIndex: number;
  contextLabel: string;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  error: string | null;
  videoMode: boolean;

  playTrack: (trackId: string, contextIds?: string[], contextLabel?: string) => void;
  playShuffled: (trackIds: string[], contextLabel?: string) => void;
  togglePlay: () => void;
  setVideoMode: (mode: boolean) => void;
  toggleVideoMode: () => void;
  next: (automatic?: boolean) => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (trackId: string) => boolean;
  playNext: (trackId: string) => boolean;
  removeFromQueue: (index: number) => void;
  reorderQueue: (from: number, to: number) => void;
  clearQueue: () => void;
  playQueueIndex: (index: number) => void;
  handleEnded: () => void;
  primeAudio: () => void;
  syncFromAudio: (patch: Partial<PlayerState>) => void;
  resetPlayer: () => void;
}

const initialPlayer = {
  currentTrackId: null,
  queue: [] as string[],
  queueIndex: 0,
  contextLabel: "",
  isPlaying: false,
  isLoading: false,
  currentTime: 0,
  duration: 0,
  volume: 0.78,
  muted: false,
  shuffle: false,
  repeat: "off" as RepeatMode,
  error: null,
  videoMode: false,
};

function uniqueValid(ids: string[]): string[] {
  return Array.from(new Set(ids.filter((id) => Boolean(getTrack(id)))));
}

function autoplayQueue(track: Track): string[] {
  const matching = tracks.filter(
    (candidate) =>
      candidate.id !== track.id &&
      candidate.genreIds.some((genre) => track.genreIds.includes(genre)),
  );
  const list = matching.slice(0, 18).map((item) => item.id);
  return uniqueValid([...list]).slice(0, 18);
}

function playableError() {
  return "This track could not start playing. Check your connection and try another track.";
}

function requireListenerAccount(): boolean {
  if (useAuthStore.getState().isAuthenticated) return true;
  useAuthStore.getState().openAuthModal("signin");
  toast.info("Sign in to listen", "Continue with Google to start playing music.");
  return false;
}

function resumeAudio(audio: HTMLAudioElement) {
  if (audio.currentTime >= audio.duration - 0.2 && Number.isFinite(audio.duration)) {
    audio.currentTime = 0;
  }
  const promise = audio.play();
  if (promise) {
    promise.catch((error: DOMException) => {
      const state = usePlayerStore.getState();
      if (error.name === "AbortError") return;
      state.syncFromAudio({
        isPlaying: false,
        isLoading: false,
        error:
          error.name === "NotAllowedError"
            ? "Playback was paused by your browser. Press play to continue."
            : playableError(),
      });
      toast.error(
        "Playback stopped",
        error.name === "NotAllowedError"
          ? "Your browser needs a tap on play before audio can continue."
          : "The audio source could not be reached. Try another track.",
      );
    });
  }
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => {
      const startTrack = (trackId: string, shouldPlay: boolean) => {
        if (shouldPlay && !requireListenerAccount()) return;
        const track = getTrack(trackId);
        if (!track) {
          set({ error: "That track is no longer available." });
          return;
        }
        const audio = getAudioElement();
        set({
          currentTrackId: trackId,
          currentTime: 0,
          duration: track.duration,
          isPlaying: shouldPlay,
          isLoading: shouldPlay,
          error: null,
        });

        if (track.youtubeId) {
          audio?.pause();
          loadYouTubeVideo(track.youtubeId, shouldPlay);
          return;
        }

        stopYouTube();
        if (!audio) {
          set({
            isPlaying: false,
            isLoading: false,
            error: "The audio engine is unavailable. Reload the app and try again.",
          });
          return;
        }
        try {
          audio.pause();
          const expectedUrl = new URL(track.audioUrl, window.location.href).href;
          if (audio.src !== expectedUrl) {
            audio.src = track.audioUrl;
            audio.load();
          } else {
            audio.currentTime = 0;
          }
          audio.volume = get().volume;
          audio.muted = get().muted;
          if (shouldPlay) resumeAudio(audio);
        } catch {
          set({ isPlaying: false, isLoading: false, error: playableError() });
          toast.error("Playback unavailable", "This track could not be loaded. Try another track.");
        }
      };

      return {
        ...initialPlayer,

        playTrack: (trackId, contextIds, contextLabel) => {
          if (!requireListenerAccount()) return;
          const track = getTrack(trackId);
          if (!track) {
            toast.error("Track unavailable", "This track is no longer in the AURA catalogue.");
            return;
          }
          const current = get();
          const sameTrack = current.currentTrackId === trackId;
          if (sameTrack) {
            if (track.youtubeId) {
              if (current.isPlaying) {
                pauseYouTube();
                set({ isPlaying: false, isLoading: false });
              } else {
                set({ isPlaying: true, isLoading: true, error: null });
                playYouTube();
              }
              return;
            }
            const audio = getAudioElement();
            if (current.isPlaying) {
              audio?.pause();
              set({ isPlaying: false, isLoading: false });
            } else {
              set({ isPlaying: true, isLoading: true, error: null });
              if (audio) resumeAudio(audio);
            }
            return;
          }
          if (contextIds && contextIds.length > 0) {
            const validQueue = uniqueValid(contextIds);
            const index = validQueue.indexOf(trackId);
            set({
              queue: validQueue,
              queueIndex: index >= 0 ? index : 0,
              contextLabel: contextLabel ?? "",
            });
          } else {
            set({
              queue: [trackId],
              queueIndex: 0,
              contextLabel: "",
            });
          }
          startTrack(trackId, true);
        },

        playShuffled: (trackIds, contextLabel) => {
          if (!requireListenerAccount()) return;
          const valid = uniqueValid(trackIds);
          if (valid.length === 0) return;
          const shuffled = [...valid].sort(() => Math.random() - 0.5);
          set({
            queue: shuffled,
            queueIndex: 0,
            contextLabel: contextLabel ?? "",
            shuffle: true,
          });
          startTrack(shuffled[0], true);
        },

        togglePlay: () => {
          const state = get();
          if (!state.isPlaying && !requireListenerAccount()) return;
          const audio = getAudioElement();
          if (!state.currentTrackId) {
            const fallback = tracks[15] ?? tracks[0];
            if (fallback) {
              state.playTrack(fallback.id, [fallback.id], "AURA selection");
            }
            return;
          }
          const track = getTrack(state.currentTrackId);
          if (track?.youtubeId) {
            if (state.isPlaying) {
              pauseYouTube();
              set({ isPlaying: false, isLoading: false });
            } else {
              set({ isPlaying: true, isLoading: true, error: null });
              playYouTube();
            }
            return;
          }
          if (!audio) {
            set({ error: "The audio engine is still loading. Please try again." });
            return;
          }
          if (state.isPlaying) {
            audio.pause();
            set({ isPlaying: false, isLoading: false });
            return;
          }
          set({ isPlaying: true, isLoading: true, error: null });
          resumeAudio(audio);
        },

        next: (automatic = false) => {
          const state = get();
          if (state.repeat === "one" && automatic) {
            const current = state.currentTrackId ? getTrack(state.currentTrackId) : undefined;
            if (current?.youtubeId) {
              seekYouTube(0);
              set({ currentTime: 0 });
              playYouTube();
              return;
            }
            const audio = getAudioElement();
            if (audio) {
              audio.currentTime = 0;
              set({ currentTime: 0 });
              resumeAudio(audio);
            }
            return;
          }
          const shouldPlay = automatic ? true : state.isPlaying;
          if (state.queue.length === 0) return;

          if (state.shuffle && state.queue.length > 1) {
            const candidates = state.queue
              .map((_, index) => index)
              .filter((index) => index !== state.queueIndex);
            const chosen = candidates[Math.floor(Math.random() * candidates.length)];
            if (chosen !== undefined) {
              set({ queueIndex: chosen });
              startTrack(state.queue[chosen], shouldPlay);
              return;
            }
          }

          if (state.queueIndex < state.queue.length - 1) {
            const index = state.queueIndex + 1;
            set({ queueIndex: index });
            startTrack(state.queue[index], shouldPlay);
            return;
          }

          if (state.repeat === "all") {
            set({ queueIndex: 0 });
            startTrack(state.queue[0], true);
            return;
          }

          if (automatic) {
            const currentTrack = state.currentTrackId ? getTrack(state.currentTrackId) : undefined;
            if (useAppStore.getState().autoplay && currentTrack) {
              const autoplay = autoplayQueue(currentTrack);
              if (autoplay.length > 0) {
                set({ queue: autoplay, queueIndex: 0, contextLabel: "AURA autoplay" });
                startTrack(autoplay[0], true);
                return;
              }
            }
            set({ isPlaying: false, isLoading: false });
            return;
          }
          set({ isPlaying: false });
        },

        previous: () => {
          const state = get();
          const audio = getAudioElement();
          const current = state.currentTrackId ? getTrack(state.currentTrackId) : undefined;
          const isYouTube = Boolean(current?.youtubeId);
          const elapsed = isYouTube ? state.currentTime : audio?.currentTime ?? 0;
          if (elapsed > 3.5) {
            if (isYouTube) seekYouTube(0);
            else if (audio) audio.currentTime = 0;
            set({ currentTime: 0 });
            return;
          }
          if (state.queue.length === 0) return;
          const shouldPlay = state.isPlaying;
          if (state.shuffle && state.queue.length > 1) {
            const candidates = state.queue
              .map((_, index) => index)
              .filter((index) => index !== state.queueIndex);
            const chosen = candidates[Math.floor(Math.random() * candidates.length)];
            if (chosen !== undefined) {
              set({ queueIndex: chosen });
              startTrack(state.queue[chosen], shouldPlay);
              return;
            }
          }
          if (state.queueIndex > 0) {
            const index = state.queueIndex - 1;
            set({ queueIndex: index });
            startTrack(state.queue[index], shouldPlay);
            return;
          }
          if (state.repeat === "all") {
            const index = state.queue.length - 1;
            set({ queueIndex: index });
            startTrack(state.queue[index], shouldPlay);
            return;
          }
          if (isYouTube) seekYouTube(0);
          else if (audio) audio.currentTime = 0;
          set({ currentTime: 0 });
        },

        seek: (seconds) => {
          const state = get();
          const audio = getAudioElement();
          const current = state.currentTrackId ? getTrack(state.currentTrackId) : undefined;
          const target = clamp(seconds, 0, state.duration || 0);
          if (current?.youtubeId) seekYouTube(target);
          else if (audio) audio.currentTime = target;
          set({ currentTime: target, error: null });
        },

        setVolume: (volume) => {
          const next = clamp(volume, 0, 1);
          const audio = getAudioElement();
          if (audio) {
            audio.volume = next;
            audio.muted = next === 0 ? true : false;
          }
          setYouTubeVolume(next);
          muteYouTube(next === 0);
          set({ volume: next, muted: next === 0 });
        },

        toggleMute: () => {
          const audio = getAudioElement();
          const next = !get().muted;
          if (audio) audio.muted = next;
          muteYouTube(next);
          set({ muted: next });
        },

        toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),

        setVideoMode: (mode) => set({ videoMode: mode }),
        toggleVideoMode: () => set((state) => ({ videoMode: !state.videoMode })),

        cycleRepeat: () =>
          set((state) => ({
            repeat: state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off",
          })),

        addToQueue: (trackId) => {
          if (!getTrack(trackId)) return false;
          const state = get();
          if (state.queue.slice(state.queueIndex).includes(trackId)) return false;
          if (!state.currentTrackId) {
            set({ queue: [trackId], queueIndex: 0, contextLabel: "Queue" });
            startTrack(trackId, false);
            return true;
          }
          set({ queue: [...state.queue, trackId] });
          return true;
        },

        playNext: (trackId) => {
          if (!getTrack(trackId)) return false;
          const state = get();
          const filtered = state.queue.filter((id, index) => index !== state.queueIndex && id !== trackId);
          const base = state.currentTrackId ? state.currentTrackId : filtered[0];
          if (!base) {
            set({ queue: [trackId], queueIndex: 0 });
            startTrack(trackId, false);
            return true;
          }
          if (!state.currentTrackId) return false;
          const newQueue = [...filtered];
          newQueue.splice(state.queueIndex + 1, 0, trackId);
          set({ queue: newQueue, queueIndex: newQueue.indexOf(state.currentTrackId) });
          return true;
        },

        removeFromQueue: (index) => {
          const state = get();
          if (index < 0 || index >= state.queue.length) return;
          if (index === state.queueIndex) {
            const remaining = state.queue.filter((_, itemIndex) => itemIndex !== index);
            if (remaining.length === 0) {
              const audio = getAudioElement();
              audio?.pause();
              stopYouTube();
              set({
                queue: [],
                queueIndex: 0,
                currentTrackId: null,
                isPlaying: false,
                currentTime: 0,
                duration: 0,
                error: null,
              });
              return;
            }
            const nextIndex = Math.min(index, remaining.length - 1);
            set({ queue: remaining, queueIndex: nextIndex });
            startTrack(remaining[nextIndex], state.isPlaying);
            return;
          }
          set({
            queue: state.queue.filter((_, itemIndex) => itemIndex !== index),
            queueIndex: index < state.queueIndex ? state.queueIndex - 1 : state.queueIndex,
          });
        },

        reorderQueue: (from, to) => {
          const state = get();
          if (
            from === to ||
            from < 0 ||
            to < 0 ||
            from >= state.queue.length ||
            to >= state.queue.length
          ) {
            return;
          }
          const nextQueue = [...state.queue];
          const [moved] = nextQueue.splice(from, 1);
          nextQueue.splice(to, 0, moved);
          const currentTrackId = state.currentTrackId;
          set({
            queue: nextQueue,
            queueIndex: currentTrackId ? nextQueue.indexOf(currentTrackId) : state.queueIndex,
          });
        },

        clearQueue: () => {
          const state = get();
          if (!state.currentTrackId) {
            set({ queue: [], queueIndex: 0, contextLabel: "" });
            return;
          }
          set({
            queue: [state.currentTrackId],
            queueIndex: 0,
            contextLabel: "Now playing",
          });
        },

        playQueueIndex: (index) => {
          const state = get();
          const trackId = state.queue[index];
          if (!trackId) return;
          set({ queueIndex: index });
          startTrack(trackId, true);
        },

        handleEnded: () => {
          const state = get();
          if (state.repeat === "one") {
            const current = state.currentTrackId ? getTrack(state.currentTrackId) : undefined;
            if (current?.youtubeId) {
              seekYouTube(0);
              set({ currentTime: 0 });
              playYouTube();
              return;
            }
            const audio = getAudioElement();
            if (audio) {
              audio.currentTime = 0;
              set({ currentTime: 0 });
              resumeAudio(audio);
            }
            return;
          }
          get().next(true);
        },

        primeAudio: () => {
          const state = get();
          if (!state.currentTrackId) return;
          const track = getTrack(state.currentTrackId);
          const audio = getAudioElement();
          if (!track) return;
          if (track.youtubeId) {
            loadYouTubeVideo(track.youtubeId, state.isPlaying);
            setYouTubeVolume(state.volume);
            muteYouTube(state.muted);
            if (!state.duration) set({ duration: track.duration });
            return;
          }
          if (!audio) return;
          try {
            if (!audio.src) {
              audio.src = track.audioUrl;
              audio.load();
            }
            audio.volume = state.volume;
            audio.muted = state.muted;
            if (!state.duration) set({ duration: track.duration });
          } catch {
            // The next explicit play attempt will surface a useful error.
          }
        },

        syncFromAudio: (patch) => set(patch),

        resetPlayer: () => {
          const audio = getAudioElement();
          audio?.pause();
          stopYouTube();
          if (audio) {
            audio.removeAttribute("src");
            audio.load();
          }
          set({ ...initialPlayer });
        },
      };
    },
    {
      name: "aura-player-v1",
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
      version: 1,
      partialize: (state) => ({
        currentTrackId: state.currentTrackId,
        queue: state.queue,
        queueIndex: state.queueIndex,
        contextLabel: state.contextLabel,
        volume: state.volume,
        muted: state.muted,
        shuffle: state.shuffle,
        repeat: state.repeat,
        videoMode: state.videoMode,
      }),
      merge: (persisted, current) => {
        const source = (persisted ?? {}) as Partial<PlayerState>;
        const queue = Array.isArray(source.queue) ? uniqueValid(source.queue) : [];
        const currentTrackId =
          typeof source.currentTrackId === "string" && getTrack(source.currentTrackId)
            ? source.currentTrackId
            : queue[0] ?? null;
        const safeQueue =
          currentTrackId && !queue.includes(currentTrackId) ? [currentTrackId, ...queue] : queue;
        const requestedIndex =
          typeof source.queueIndex === "number" && Number.isFinite(source.queueIndex)
            ? Math.floor(source.queueIndex)
            : 0;
        return {
          ...current,
          ...source,
          currentTrackId,
          queue: safeQueue,
          queueIndex: currentTrackId
            ? Math.max(0, safeQueue.indexOf(currentTrackId))
            : clamp(requestedIndex, 0, Math.max(0, safeQueue.length - 1)),
          volume:
            typeof source.volume === "number" ? clamp(source.volume, 0, 1) : current.volume,
          muted: typeof source.muted === "boolean" ? source.muted : current.muted,
          shuffle: typeof source.shuffle === "boolean" ? source.shuffle : current.shuffle,
          videoMode: typeof source.videoMode === "boolean" ? source.videoMode : false,
          repeat: ["off", "all", "one"].includes(source.repeat as string)
            ? (source.repeat as RepeatMode)
            : "off",
          isPlaying: false,
          isLoading: false,
          currentTime: 0,
          duration: currentTrackId ? getTrack(currentTrackId)?.duration ?? 0 : 0,
          error: null,
        };
      },
    },
  ),
);
