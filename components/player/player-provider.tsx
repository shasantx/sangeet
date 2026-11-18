"use client";

import { useEffect, useRef } from "react";
import {
  addAndroidEventListener,
  androidHasAudioPermission,
  androidScanLocalAudio,
  isAndroidNativeApp,
} from "@/lib/android-bridge";
import { ensureAudioEffectsSynced } from "@/lib/audio-eq";
import { getAudioElement, registerAudioElement } from "@/lib/audio-engine";
import { getAlbum, getArtist, getTrack } from "@/lib/catalog";
import { registerLocalAudioTrack } from "@/lib/dynamic-tracks";
import {
  registerScannedAndroidTracks,
  restoreLocalAudio,
  scanDesktopAudioLibrary,
} from "@/lib/local-audio";
import { listOfflineTracks } from "@/lib/offline-audio";
import {
  getYouTubeDuration,
  getYouTubeTime,
  initYouTubePlayer,
  loadYouTubeVideo,
  muteYouTube,
  pauseYouTube,
  setYouTubePlaybackRate,
  setYouTubeVolume,
} from "@/lib/youtube-engine";
import { isTypingTarget } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { useLibraryStore } from "@/store/library-store";
import { markYouTubeAudioProxyUnavailable, usePlayerStore } from "@/store/player-store";
import { toast, useUIStore } from "@/store/ui-store";
import { NowPlayingOverlay } from "./now-playing-overlay";
import { YouTubeDock } from "./youtube-dock";

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isLoading = usePlayerStore((state) => state.isLoading);
  const audioRef = useRef<HTMLAudioElement>(null);
  const errorReportedFor = useRef<string | null>(null);
  const androidIframeFallbackTrack = useRef<string | null>(null);

  useEffect(() => {
    const track = currentTrackId ? getTrack(currentTrackId) : undefined;
    if (!track?.youtubeId || !isPlaying || !isLoading) return;
    if (isAndroidNativeApp() && !usePlayerStore.getState().videoMode) return;
    // Never interrupt or reload a track that is already playing mid-song during a brief buffer.
    if (usePlayerStore.getState().currentTime >= 1 || getYouTubeTime() >= 0.5) return;
    const retryTimer = window.setTimeout(() => {
      const state = usePlayerStore.getState();
      if (isAndroidNativeApp() && !state.videoMode) return;
      if (state.currentTrackId !== currentTrackId || !state.isLoading) return;
      if (state.currentTime >= 1 || getYouTubeTime() >= 0.5) return;
      const audio = getAudioElement();
      if (!audio?.src) {
        loadYouTubeVideo(track.youtubeId!, true, state.currentTime);
      }
    }, 4500);
    const timer = window.setTimeout(() => {
      const state = usePlayerStore.getState();
      if (isAndroidNativeApp() && !state.videoMode) return;
      if (state.currentTrackId !== currentTrackId || !state.isLoading) return;
      if (state.currentTime >= 1 || getYouTubeTime() >= 0.5) {
        state.syncFromAudio({ isLoading: false });
        return;
      }
      state.syncFromAudio({
        isPlaying: false,
        isLoading: false,
        error: "Tap Play to start this track.",
      });
    }, 18000);
    return () => {
      window.clearTimeout(retryTimer);
      window.clearTimeout(timer);
    };
  }, [currentTrackId, isPlaying, isLoading]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    registerAudioElement(audio);

    let active = true;
    let lastReportedTime = -1;

    const currentIsYouTube = () => {
      const state = usePlayerStore.getState();
      const activeTrack = state.currentTrackId ? getTrack(state.currentTrackId) : undefined;
      // On Android the native Media3 service owns YouTube playback. The hidden
      // HTML audio element is stopped during handoff; its pause/time events are
      // unrelated and must not overwrite native play state or lyric position.
      if (isAndroidNativeApp() && activeTrack?.youtubeId && !state.videoMode) return true;
      if (audio.src && audio.src !== window.location.href && !audio.error) {
        return false;
      }
      return Boolean(activeTrack?.youtubeId);
    };

    const syncAudioElementSettings = () => {
      const state = usePlayerStore.getState();
      audio.defaultPlaybackRate = state.playbackRate;
      audio.playbackRate = state.playbackRate;
      audio.loop = state.repeat === "one";
      ensureAudioEffectsSynced();
    };

    const setDuration = () => {
      if (currentIsYouTube()) return;
      syncAudioElementSettings();
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        usePlayerStore.getState().syncFromAudio({ duration: audio.duration });
      }
    };
    const onTimeUpdate = () => {
      if (currentIsYouTube()) return;
      if (!audio.seeking) {
        const shouldReport =
          lastReportedTime < 0 ||
          Math.abs(audio.currentTime - lastReportedTime) >= 0.35 ||
          (audio.currentTime < 0.5 && Math.abs(audio.currentTime - lastReportedTime) >= 0.1);
        if (shouldReport) {
          lastReportedTime = audio.currentTime;
          usePlayerStore.getState().syncFromAudio({ currentTime: audio.currentTime });
        }
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
    const onSeeked = () => {
      if (currentIsYouTube()) return;
      lastReportedTime = audio.currentTime;
      usePlayerStore.getState().syncFromAudio({ currentTime: audio.currentTime });
    };
    const onPlay = () => {
      if (currentIsYouTube()) return;
      syncAudioElementSettings();
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
      lastReportedTime = -1;
      if (usePlayerStore.getState().isPlaying) {
        usePlayerStore.getState().syncFromAudio({ isLoading: true });
      }
    };
    const onEnded = () => {
      if (currentIsYouTube()) return;
      lastReportedTime = -1;
      usePlayerStore.getState().handleEnded();
    };
    const onError = () => {
      if (currentIsYouTube()) return;
      const source = audio.currentSrc || audio.src;
      if (errorReportedFor.current === source) return;
      errorReportedFor.current = source;

      const state = usePlayerStore.getState();
      const track = state.currentTrackId ? getTrack(state.currentTrackId) : undefined;
      if (track?.youtubeId && source.includes("/api/youtube/audio")) {
        // Fallback to YouTube IFrame if direct audio stream extraction failed for this video.
        markYouTubeAudioProxyUnavailable();
        audio.removeAttribute("src");
        loadYouTubeVideo(track.youtubeId, state.isPlaying);
        setYouTubePlaybackRate(state.playbackRate);
        return;
      }

      if (
        track?.source === "audius" &&
        source.includes("/api/audius/stream") &&
        track.audioUrl &&
        !track.audioUrl.includes("/api/audius/stream")
      ) {
        audio.src = track.audioUrl;
        audio.load();
        syncAudioElementSettings();
        if (state.isPlaying) {
          void audio.play().catch(() => {});
        }
        return;
      }

      state.syncFromAudio({
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
    audio.addEventListener("seeked", onSeeked);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("loadstart", onLoadStart);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    const restoreOfflineTracksIntoRegistry = async () => {
      const offlineItems = await listOfflineTracks().catch(() => []);
      for (const item of offlineItems) {
        if (!getTrack(item.track.id)) {
          registerLocalAudioTrack(
            item.track,
            {
              id: item.track.artistId,
              name: item.artistName || "Sangeet",
              bio: `${item.artistName || "Sangeet"} (saved offline)`,
              shortBio: "Saved for offline listening.",
              image: item.track.artwork,
              location: "Offline",
              genreIds: item.track.genreIds ?? [],
              relatedArtistIds: [],
            },
            {
              id: item.track.albumId,
              title: item.track.title,
              artistId: item.track.artistId,
              year: new Date(item.savedAt || Date.now()).getFullYear(),
              releaseDate: new Date(item.savedAt || Date.now()).toISOString().slice(0, 10),
              type: "Single",
              artwork: item.track.artwork,
              genreIds: item.track.genreIds ?? [],
              description: "Saved for offline listening.",
              trackIds: [item.track.id],
            },
          );
        }
      }
    };

    const restoreNativeDeviceAudio = async () => {
      if (isAndroidNativeApp() && androidHasAudioPermission()) {
        const scanned = androidScanLocalAudio();
        if (scanned.length > 0) {
          registerScannedAndroidTracks(scanned);
        }
      }
      if (typeof window !== "undefined" && window.sangeetDesktop?.scanMusicLibrary) {
        await scanDesktopAudioLibrary();
      }
    };

    Promise.all([
      restoreLocalAudio().catch(() => undefined),
      restoreOfflineTracksIntoRegistry().catch(() => undefined),
      restoreNativeDeviceAudio().catch(() => undefined),
    ]).then(async () => {
      if (!active) return;
      await Promise.all([
        Promise.resolve(useAppStore.persist.rehydrate()),
        Promise.resolve(useLibraryStore.persist.rehydrate()),
        Promise.resolve(usePlayerStore.persist.rehydrate()),
      ]);
      if (!active) return;
      syncAudioElementSettings();
      usePlayerStore.getState().primeAudio();
    });

    return () => {
      active = false;
      audio.removeEventListener("loadedmetadata", setDuration);
      audio.removeEventListener("durationchange", setDuration);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("seeked", onSeeked);
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
    const iframeOwnsPlayback = () => {
      const state = usePlayerStore.getState();
      const id = state.currentTrackId;
      if (!id || !getTrack(id)?.youtubeId) return false;
      // Android uses Media3 for YouTube audio. The hidden iframe emits stale
      // pause/play events when it is stopped during native handoff; only listen
      // to it again when the native extractor explicitly falls back to iframe.
      if (
        isAndroidNativeApp() &&
        !state.videoMode &&
        androidIframeFallbackTrack.current !== id
      ) return false;
      return true;
    };

    initYouTubePlayer("aura-youtube-frame", {
      onReady: () => {
        if (iframeOwnsPlayback()) {
          usePlayerStore.getState().syncFromAudio({ isLoading: false });
        }
      },
      onPlay: () => {
        if (!iframeOwnsPlayback()) return;
        usePlayerStore.getState().syncFromAudio({ isPlaying: true, isLoading: false, error: null });
      },
      onPause: () => {
        if (!iframeOwnsPlayback()) return;
        usePlayerStore.getState().syncFromAudio({ isPlaying: false, isLoading: false });
      },
      onBuffering: () => {
        if (!iframeOwnsPlayback()) return;
        usePlayerStore.getState().syncFromAudio({ isLoading: true });
      },
      onEnded: () => {
        if (!iframeOwnsPlayback()) return;
        usePlayerStore.getState().handleEnded();
      },
      onError: (message) => {
        if (!iframeOwnsPlayback()) return;
        usePlayerStore.getState().syncFromAudio({
          isPlaying: false,
          isLoading: false,
          error: message,
        });
        toast.error("YouTube playback stopped", message);
      },
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const state = usePlayerStore.getState();
      if (!state.currentTrackId || !state.isPlaying) return;
      const track = getTrack(state.currentTrackId);
      if (!track?.youtubeId) return;

      // On Android the Media3 service is the clock for audio playback. The
      // hidden YouTube iframe is idle and reports zero, so polling it here
      // overwrote native time events and made lyrics/progress jump backwards.
      if (isAndroidNativeApp() && !state.videoMode) {
        const duration = state.duration;
        if ("mediaSession" in navigator && duration > 0) {
          try {
            navigator.mediaSession.setPositionState({
              duration,
              playbackRate: state.playbackRate || 1,
              position: Math.min(state.currentTime, duration),
            });
          } catch {
            // Position state is a progressive enhancement.
          }
        }
        return;
      }

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
            playbackRate: state.playbackRate || 1,
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
  const accent = useAppStore((state) => state.accent);
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
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  useEffect(() => {
    document.documentElement.dataset.native = isAndroidNativeApp()
      ? "android"
      : window.sangeetDesktop?.isDesktop
        ? "desktop"
        : "web";
  }, []);

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
        const bindAction = (action: MediaSessionAction, handler: (details: MediaSessionActionDetails) => void) => {
          try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* Unsupported device action. */ }
        };
        bindAction("play", () => { if (!usePlayerStore.getState().isPlaying) usePlayerStore.getState().togglePlay(); });
        bindAction("pause", () => { if (usePlayerStore.getState().isPlaying) usePlayerStore.getState().togglePlay(); });
        bindAction("stop", () => {
          const audio = getAudioElement();
          if (audio) { audio.pause(); audio.currentTime = 0; }
          usePlayerStore.getState().syncFromAudio({ currentTime: 0, isPlaying: false, isLoading: false });
        });
        bindAction("nexttrack", () => usePlayerStore.getState().next());
        bindAction("previoustrack", () => usePlayerStore.getState().previous());
        bindAction("seekto", (details) => {
          if (typeof details.seekTime === "number") usePlayerStore.getState().seek(details.seekTime);
        });
        bindAction("seekbackward", (details) => usePlayerStore.getState().seek(usePlayerStore.getState().currentTime - (details.seekOffset ?? 10)));
        bindAction("seekforward", (details) => usePlayerStore.getState().seek(usePlayerStore.getState().currentTime + (details.seekOffset ?? 10)));
      } catch {
        // Media Session support is a progressive enhancement.
      }
    }
    // Keep MediaSession metadata alive across track transitions so Android/iOS background audio doesn't drop.
  }, [currentTrackId, addRecentlyPlayed]);

  // Sleep timer countdown enforcement
  const sleepTimerEndsAt = usePlayerStore((state) => state.sleepTimerEndsAt);
  useEffect(() => {
    if (!sleepTimerEndsAt) return;
    const remaining = sleepTimerEndsAt - Date.now();
    const triggerPause = () => {
      const state = usePlayerStore.getState();
      const audio = getAudioElement();
      audio?.pause();
      pauseYouTube();
      state.syncFromAudio({
        isPlaying: false,
        isLoading: false,
        sleepTimerEndsAt: null,
        sleepAfterTrack: false,
      });
      toast.show("Sleep timer finished", "Playback paused.");
    };
    if (remaining <= 0) {
      triggerPause();
      return;
    }
    const timer = window.setTimeout(triggerPause, remaining);
    return () => window.clearTimeout(timer);
  }, [sleepTimerEndsAt]);

  // Native Android bridge events
  useEffect(() => {
    if (typeof window === "undefined") return;
    return addAndroidEventListener((type, payload) => {
      const state = usePlayerStore.getState();
      if (type === "time" && payload) {
        const [posStr, durStr] = payload.split(":");
        const currentTime = Number(posStr);
        const duration = Number(durStr);
        if (Number.isFinite(currentTime) && currentTime >= 0) {
          state.syncFromAudio({
            currentTime,
            ...(Number.isFinite(duration) && duration > 0 ? { duration } : {}),
          });
        }
      } else if (type === "state") {
        if (payload === "playing") {
          state.syncFromAudio({ isPlaying: true, isLoading: false, error: null });
        } else if (payload === "paused") {
          // The native service filters buffering transitions before emitting
          // "paused", so this event is authoritative even during loading.
          state.syncFromAudio({ isPlaying: false, isLoading: false });
        } else if (payload === "buffering") {
          if (isAndroidNativeApp() && !state.videoMode) {
            androidIframeFallbackTrack.current = null;
          }
          state.syncFromAudio({ isLoading: true });
        } else if (payload === "ended") {
          state.handleEnded();
        }
      } else if (type === "error") {
        if (payload === "fallback_iframe") {
          const track = state.currentTrackId ? getTrack(state.currentTrackId) : undefined;
          if (track?.youtubeId) {
            androidIframeFallbackTrack.current = track.id;
            loadYouTubeVideo(track.youtubeId, true);
            setYouTubePlaybackRate(state.playbackRate);
            return;
          }
        }
        state.syncFromAudio({
          isPlaying: false,
          isLoading: false,
          error: payload || "Could not play this track.",
        });
        toast.error("Playback error", payload || "Could not play this track.");
      } else if (type === "next") {
        state.next();
      } else if (type === "previous") {
        state.previous();
      }
    });
  }, []);

  // Desktop native app integration (Windows media keys, tray status, presence)
  useEffect(() => {
    if (typeof window === "undefined" || !window.sangeetDesktop) return;
    const desktop = window.sangeetDesktop;

    const cleanup = desktop.onMediaAction((action) => {
      const state = usePlayerStore.getState();
      if (action === "play-pause") {
        state.togglePlay();
      } else if (action === "next") {
        state.next();
      } else if (action === "previous") {
        state.previous();
      } else if (action === "stop") {
        const audio = getAudioElement();
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
        state.syncFromAudio({ currentTime: 0, isPlaying: false, isLoading: false });
      }
    });

    return cleanup;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.sangeetDesktop) return;
    const track = currentTrackId ? getTrack(currentTrackId) : null;
    const artist = track ? getArtist(track.artistId) : null;
    window.sangeetDesktop.sendPlaybackState({
      isPlaying,
      track: track
        ? {
            title: track.title,
            artist: artist?.name ?? "Featured artist",
            artwork: track.artwork,
          }
        : undefined,
    });
  }, [currentTrackId, isPlaying]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!useAppStore.getState().shortcuts) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if ((event.target as HTMLElement | null)?.closest?.("button, a, [role='button']")) return;

      if (event.code === "Space" || event.key.toLowerCase() === "k") {
        event.preventDefault();
        usePlayerStore.getState().togglePlay();
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        usePlayerStore.getState().seek(usePlayerStore.getState().currentTime + 5);
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        usePlayerStore.getState().seek(usePlayerStore.getState().currentTime - 5);
      } else if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        usePlayerStore.getState().seek(usePlayerStore.getState().currentTime + 10);
      } else if (event.key.toLowerCase() === "j") {
        event.preventDefault();
        usePlayerStore.getState().seek(usePlayerStore.getState().currentTime - 10);
      } else if (event.key.toLowerCase() === "r") {
        usePlayerStore.getState().cycleRepeat();
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

  // Keep the persistent audio element's volume, loop, and playbackRate synchronized.
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
      if (previous.repeat !== state.repeat) {
        if (audio) audio.loop = state.repeat === "one";
      }
      if (previous.playbackRate !== state.playbackRate) {
        setYouTubePlaybackRate(state.playbackRate);
        if (audio) {
          audio.defaultPlaybackRate = state.playbackRate;
          audio.playbackRate = state.playbackRate;
        }
      }
    });
    return unsubscribe;
  }, []);

  // Close the Now Playing overlay if playback is cleared
  useEffect(() => {
    if (!currentTrackId && useUIStore.getState().nowPlayingOpen) {
      useUIStore.getState().closeNowPlaying();
    }
  }, [currentTrackId]);

  return (
    <>
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        playsInline
        tabIndex={-1}
        className="pointer-events-none fixed bottom-0 left-0 z-[1] h-px w-px opacity-[0.01]"
        aria-label="Sangeet audio playback"
      />
      <YouTubeDock />
      <NowPlayingOverlay />
    </>
  );
}
