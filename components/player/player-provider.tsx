"use client";

import { useEffect, useRef } from "react";
import { getAudioElement, registerAudioElement } from "@/lib/audio-engine";
import { getAlbum, getArtist, getTrack } from "@/lib/catalog";
import {
  getYouTubeDuration,
  getYouTubeTime,
  initYouTubePlayer,
  muteYouTube,
  setYouTubeVolume,
} from "@/lib/youtube-engine";
import { isTypingTarget } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { toast } from "@/store/ui-store";
import { YouTubeDock } from "./youtube-dock";

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isLoading = usePlayerStore((state) => state.isLoading);
  const audioRef = useRef<HTMLAudioElement>(null);
  const errorReportedFor = useRef<string | null>(null);

  useEffect(() => {
    const track = currentTrackId ? getTrack(currentTrackId) : undefined;
    if (!track?.youtubeId || !isPlaying || !isLoading) return;
    const timer = window.setTimeout(() => {
      const state = usePlayerStore.getState();
      if (state.currentTrackId !== currentTrackId || !state.isLoading) return;
      state.syncFromAudio({
        isPlaying: false,
        isLoading: false,
        error: "This song did not start. Check your connection or try another video.",
      });
      toast.error("Playback could not start", "YouTube did not respond in time. Try another song or reload the player.");
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [currentTrackId, isPlaying, isLoading]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    registerAudioElement(audio);

    let active = true;

    const currentIsYouTube = () => {
      const id = usePlayerStore.getState().currentTrackId;
      return Boolean(id && getTrack(id)?.youtubeId);
    };

    const setDuration = () => {
      if (currentIsYouTube()) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        usePlayerStore.getState().syncFromAudio({ duration: audio.duration });
      }
    };
    const onTimeUpdate = () => {
      if (currentIsYouTube()) return;
      if (!audio.seeking) {
        usePlayerStore.getState().syncFromAudio({ currentTime: audio.currentTime });
      }
      if (Number.isFinite(audio.duration) && audio.duration > 0 && "mediaSession" in navigator) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: Math.min(audio.currentTime, audio.duration),
          });
        } catch {
          // Some browsers reject position state updates before metadata is ready.
        }
      }
    };
    const onPlay = () => {
      if (currentIsYouTube()) return;
      usePlayerStore.getState().syncFromAudio({ isPlaying: true, isLoading: false, error: null });
      errorReportedFor.current = null;
    };
    const onPause = () => {
      if (currentIsYouTube()) return;
      usePlayerStore.getState().syncFromAudio({ isPlaying: false, isLoading: false });
    };
    const onWaiting = () => {
      if (currentIsYouTube()) return;
      if (usePlayerStore.getState().isPlaying) {
        usePlayerStore.getState().syncFromAudio({ isLoading: true });
      }
    };
    const onCanPlay = () => {
      if (currentIsYouTube()) return;
      usePlayerStore.getState().syncFromAudio({ isLoading: false });
      setDuration();
    };
    const onLoadStart = () => {
      if (currentIsYouTube()) return;
      if (usePlayerStore.getState().isPlaying) {
        usePlayerStore.getState().syncFromAudio({ isLoading: true });
      }
    };
    const onEnded = () => {
      if (currentIsYouTube()) return;
      usePlayerStore.getState().handleEnded();
    };
    const onError = () => {
      if (currentIsYouTube()) return;
      const source = audio.currentSrc || audio.src;
      if (errorReportedFor.current === source) return;
      errorReportedFor.current = source;
      usePlayerStore.getState().syncFromAudio({
        isPlaying: false,
        isLoading: false,
        error:
          audio.error?.code === 4
            ? "This audio format is not supported in your browser. Try another track."
            : "This track could not be loaded. The audio source may be unavailable.",
      });
      toast.error(
        "Couldn’t play this track",
        "Something interrupted the audio source. You can pick another track and keep listening.",
      );
    };

    audio.addEventListener("loadedmetadata", setDuration);
    audio.addEventListener("durationchange", setDuration);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("loadstart", onLoadStart);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    Promise.all([
      Promise.resolve(useAppStore.persist.rehydrate()),
      Promise.resolve(useLibraryStore.persist.rehydrate()),
      Promise.resolve(usePlayerStore.persist.rehydrate()),
    ]).then(() => {
      if (!active) return;
      usePlayerStore.getState().primeAudio();
    });

    return () => {
      active = false;
      audio.removeEventListener("loadedmetadata", setDuration);
      audio.removeEventListener("durationchange", setDuration);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("loadstart", onLoadStart);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      registerAudioElement(null);
    };
  }, []);

  useEffect(() => {
    const current = currentTrackId ? getTrack(currentTrackId) : undefined;
    if (!current?.youtubeId) return;
    const activeYouTube = () => {
      const id = usePlayerStore.getState().currentTrackId;
      return Boolean(id && getTrack(id)?.youtubeId);
    };

    initYouTubePlayer("aura-youtube-frame", {
      onReady: () => {
        if (activeYouTube()) {
          usePlayerStore.getState().syncFromAudio({ isLoading: false });
        }
      },
      onPlay: () => {
        if (!activeYouTube()) return;
        usePlayerStore.getState().syncFromAudio({ isPlaying: true, isLoading: false, error: null });
      },
      onPause: () => {
        if (!activeYouTube()) return;
        usePlayerStore.getState().syncFromAudio({ isPlaying: false, isLoading: false });
      },
      onBuffering: () => {
        if (!activeYouTube()) return;
        usePlayerStore.getState().syncFromAudio({ isLoading: true });
      },
      onEnded: () => {
        if (!activeYouTube()) return;
        usePlayerStore.getState().handleEnded();
      },
      onError: (message) => {
        if (!activeYouTube()) return;
        usePlayerStore.getState().syncFromAudio({
          isPlaying: false,
          isLoading: false,
          error: message,
        });
        toast.error("YouTube playback stopped", message);
      },
    });
  }, [currentTrackId, isPlaying]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const state = usePlayerStore.getState();
      if (!state.currentTrackId || !state.isPlaying) return;
      const track = getTrack(state.currentTrackId);
      if (!track?.youtubeId) return;

      const currentTime = getYouTubeTime();
      const duration = getYouTubeDuration();
      if (Number.isFinite(currentTime) && currentTime >= 0) {
        state.syncFromAudio({
          currentTime,
          ...(duration > 0 ? { duration } : {}),
        });
      }

      if ("mediaSession" in navigator && duration > 0) {
        try {
          navigator.mediaSession.setPositionState({
            duration,
            playbackRate: 1,
            position: Math.min(currentTime, duration),
          });
        } catch {
          // Position state is a progressive enhancement.
        }
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const theme = useAppStore((state) => state.theme);
  const addRecentlyPlayed = useLibraryStore((state) => state.addRecentlyPlayed);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Offline playback is an enhancement; online playback remains available without a worker.
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    } catch {
      // Mobile lock-screen playback controls are a progressive enhancement.
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!currentTrackId) return;
    addRecentlyPlayed(currentTrackId);
    const track = getTrack(currentTrackId);
    if (!track) return;
    const artist = getArtist(track.artistId);
    const album = getAlbum(track.albumId);
    document.title = `${track.title} · ${artist?.name ?? "Sangeet"}`;

    if ("mediaSession" in navigator && typeof MediaMetadata !== "undefined") {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: artist?.name ?? "Sangeet",
          album: album?.title ?? "",
          artwork: [
            {
              src: new URL(track.artwork, window.location.origin).href,
              sizes: "1000x1000",
              type: track.artwork.includes(".svg") ? "image/svg+xml" : "image/jpeg",
            },
          ],
        });
        navigator.mediaSession.setActionHandler("play", () => usePlayerStore.getState().togglePlay());
        navigator.mediaSession.setActionHandler("pause", () => usePlayerStore.getState().togglePlay());
        navigator.mediaSession.setActionHandler("nexttrack", () => usePlayerStore.getState().next());
        navigator.mediaSession.setActionHandler("previoustrack", () =>
          usePlayerStore.getState().previous(),
        );
        navigator.mediaSession.setActionHandler("seekto", (details) => {
          if (typeof details.seekTime === "number") usePlayerStore.getState().seek(details.seekTime);
        });
      } catch {
        // Media Session support is a progressive enhancement.
      }
    }
    return () => {
      if ("mediaSession" in navigator) {
        try {
          navigator.mediaSession.metadata = null;
        } catch {
          // Ignore cleanup failures.
        }
      }
    };
  }, [currentTrackId, addRecentlyPlayed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!useAppStore.getState().shortcuts) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if ((event.target as HTMLElement | null)?.closest?.("button, a, [role='button']")) return;

      if (event.code === "Space") {
        event.preventDefault();
        usePlayerStore.getState().togglePlay();
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        usePlayerStore.getState().seek(usePlayerStore.getState().currentTime + 5);
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        usePlayerStore.getState().seek(usePlayerStore.getState().currentTime - 5);
      } else if (event.key.toLowerCase() === "m") {
        usePlayerStore.getState().toggleMute();
      } else if (event.key.toLowerCase() === "n") {
        usePlayerStore.getState().next();
      } else if (event.key.toLowerCase() === "p") {
        usePlayerStore.getState().previous();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Keep the persistent audio element's volume synchronized after hydration.
  useEffect(() => {
    const audio = getAudioElement();
    const unsubscribe = usePlayerStore.subscribe((state, previous) => {
      if (previous.volume !== state.volume) {
        setYouTubeVolume(state.volume);
        if (audio) audio.volume = state.volume;
      }
      if (previous.muted !== state.muted) {
        muteYouTube(state.muted);
        if (audio) audio.muted = state.muted;
      }
    });
    return unsubscribe;
  }, []);

  return (
    <>
      {children}
      <audio ref={audioRef} preload="metadata" playsInline className="hidden" aria-hidden="true" />
      <YouTubeDock />
    </>
  );
}
