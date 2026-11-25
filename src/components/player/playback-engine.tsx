"use client";

import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/store/player-store";
import { useLibraryStore } from "@/store/library-store";
import { useToastStore } from "@/store/toast-store";
import { useLyricsStore } from "@/store/lyrics-store";
import { useUIStore } from "@/store/ui-store";
import { EQ_FREQUENCIES, useEQStore } from "@/store/eq-store";
import { useOfflineStore } from "@/store/offline-store";
import { getAndroidBridge } from "@/lib/platform";
import {
  getOfflineObjectUrl,
  revokeAllOfflineObjectUrls
} from "@/lib/offline-db";

interface SkipSegment {
  start: number;
  end: number;
  category: string;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    __sangeetAndroidEvent?: (type: string, payload: string) => void;
  }
}

export function PlaybackEngine() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const readyRef = useRef(false);
  const loadedVideoIdRef = useRef<string | null>(null);
  const loadRequestIdRef = useRef(0);
  // Grace window + playing flag so transient PAUSED/UNSTARTED events during loadVideoById NEVER stop playback
  const loadGraceUntilRef = useRef<number>(0);
  const hasEnteredPlayingRef = useRef<boolean>(false);
  const lastLoadNonceRef = useRef<number>(-1);
  const lastTrackLoadAtRef = useRef<number>(0);
  const androidSyncedTrackIdRef = useRef<string | null>(null);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const trackLoadNonce = usePlayerStore((s) => s.trackLoadNonce);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const seekNonce = usePlayerStore((s) => s.seekNonce);
  const seekTarget = usePlayerStore((s) => s.seekTarget);
  const sleepTimerEndsAt = usePlayerStore((s) => s.sleepTimerEndsAt);
  const sponsorBlockEnabled = usePlayerStore((s) => s.sponsorBlockEnabled);

  const eqEnabled = useEQStore((s) => s.enabled);
  const eqGains = useEQStore((s) => s.gains);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);

  const segmentsRef = useRef<SkipSegment[]>([]);
  const skippedIdsRef = useRef<Set<string>>(new Set());

  const isAudioElementTrack = Boolean(
    currentTrack?.offlineId ||
      (currentTrack?.localUrl && !currentTrack.localUrl.startsWith("content://")) ||
      currentTrack?.streamUrl
  );

  // Sync Web Audio 5-band Equalizer for HTML5 audio playback
  useEffect(() => {
    const filters = eqFiltersRef.current;
    if (filters.length !== EQ_FREQUENCIES.length) return;
    filters.forEach((filter, idx) => {
      filter.gain.value = eqEnabled ? (eqGains[idx] ?? 0) : 0;
    });
  }, [eqEnabled, eqGains]);

  // Sync shared lyrics store to active track (single consolidated fetch)
  useEffect(() => {
    void useLyricsStore.getState().fetchLyricsForTrack(currentTrack);
  }, [currentTrack]);

  // Native Android ExoPlayer + Native Download/Scan event listener
  useEffect(() => {
    const bridge = getAndroidBridge();
    if (!bridge) return;
    bridge.setSystemTheme?.(useUIStore.getState().theme);

    window.__sangeetAndroidEvent = (type: string, payload: string) => {
      if (
        type === "offline_audio_progress" ||
        type === "offline_audio_saved" ||
        type === "offline_audio_error" ||
        type === "audio_permission"
      ) {
        useOfflineStore
          .getState()
          .handleAndroidDownloadEvent(type, payload);
        return;
      }

      const store = usePlayerStore.getState();
      if (type === "state") {
        if (payload === "playing") {
          hasEnteredPlayingRef.current = true;
          store.setIsBuffering(false);
          if (store.playbackError) store.setPlaybackError(null);
          if (!usePlayerStore.getState().isPlaying) {
            store.setIsPlaying(true);
          }
        } else if (payload === "buffering") {
          store.setIsBuffering(true);
        } else if (payload === "paused") {
          store.setIsBuffering(false);
          if (
            Date.now() > loadGraceUntilRef.current &&
            hasEnteredPlayingRef.current &&
            store.isPlaying
          ) {
            store.setIsPlaying(false);
          }
        } else if (payload === "ended") {
          store.setIsBuffering(false);
          const wasSleepAtEnd = store.sleepAtTrackEnd;
          void store.nextTrack(true).then(() => {
            if (wasSleepAtEnd) {
              useToastStore
                .getState()
                .showToast("Sleep timer paused at end of track");
            }
          });
        }
      } else if (type === "time") {
        const [curStr, durStr] = payload.split(":");
        const cur = Number(curStr);
        const dur = Number(durStr);
        if (Number.isFinite(cur)) {
          store.setProgress(cur, Number.isFinite(dur) && dur > 0 ? dur : undefined);
        }
      } else if (type === "next") {
        void store.nextTrack();
      } else if (type === "prev") {
        store.prevTrack();
      } else if (type === "track_changed" && payload) {
        let changedId = payload.trim();
        let meta: Partial<{
          id: string;
          videoId: string;
          trackId: string;
          title: string;
          artist: string;
          thumbnail: string;
          duration: number;
        }> | null = null;
        if (changedId.startsWith("{")) {
          try {
            meta = JSON.parse(changedId);
            changedId = (
              meta?.id ||
              meta?.videoId ||
              meta?.trackId ||
              ""
            ).trim();
          } catch {
            // Keep raw payload as ID fallback
          }
        }
        if (!changedId) return;
        if (store.currentTrack?.id === changedId) {
          loadedVideoIdRef.current = changedId;
          if (store.playbackError) store.setPlaybackError(null);
          return;
        }

        const queueIdx = store.queue.findIndex((t) => t.id === changedId);
        const histMatch =
          queueIdx < 0
            ? store.history.find((t) => t.id === changedId)
            : undefined;
        const matched =
          queueIdx >= 0
            ? store.queue[queueIdx]
            : histMatch ||
              (meta?.title
                ? {
                    id: changedId,
                    title: meta.title,
                    artist: meta.artist || "Unknown Artist",
                    thumbnail: meta.thumbnail || "",
                    duration: Number.isFinite(meta.duration)
                      ? Number(meta.duration)
                      : 0
                  }
                : null);

        if (matched) {
          androidSyncedTrackIdRef.current = matched.id;
          loadedVideoIdRef.current = matched.id;
          hasEnteredPlayingRef.current = false;
          loadGraceUntilRef.current = Date.now() + 2500;
          lastTrackLoadAtRef.current = Date.now();
          usePlayerStore.setState((s) => ({
            currentTrack: matched,
            queue:
              queueIdx >= 0
                ? s.queue.filter((_, i) => i !== queueIdx)
                : s.queue.filter((t) => t.id !== matched.id),
            history: s.currentTrack
              ? [
                  s.currentTrack,
                  ...s.history.filter((t) => t.id !== s.currentTrack?.id)
                ].slice(0, 50)
              : s.history,
            currentTime: 0,
            duration: matched.duration || 0,
            playbackError: null,
            isBuffering: false
          }));
        }
      } else if (type === "error" && payload) {
        store.setPlaybackError(payload);
      }
    };

    return () => {
      delete window.__sangeetAndroidEvent;
    };
  }, []);

  // Fetch SponsorBlock non-music segments for active YouTube track
  useEffect(() => {
    segmentsRef.current = [];
    skippedIdsRef.current.clear();
    if (!currentTrack || isAudioElementTrack || !sponsorBlockEnabled) return;
    const controller = new AbortController();
    fetch(
      `/api/music/sponsorblock?videoId=${encodeURIComponent(currentTrack.id)}`,
      { signal: controller.signal }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!controller.signal.aborted && Array.isArray(data?.segments)) {
          segmentsRef.current = data.segments;
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [currentTrack, isAudioElementTrack, sponsorBlockEnabled]);

  // Listening stats timer (adds 5s every 5s while actively playing)
  useEffect(() => {
    if (!isPlaying || !currentTrack) return;
    const id = window.setInterval(() => {
      useLibraryStore.getState().addListeningSeconds(5);
    }, 5000);
    return () => window.clearInterval(id);
  }, [isPlaying, currentTrack]);

  // Sleep Timer watcher
  useEffect(() => {
    if (!sleepTimerEndsAt) return;
    const id = window.setInterval(() => {
      if (Date.now() >= sleepTimerEndsAt) {
        usePlayerStore.getState().setIsPlaying(false);
        usePlayerStore.getState().setSleepTimer(null);
        useToastStore.getState().showToast("Sleep timer paused playback");
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [sleepTimerEndsAt]);

  // Buffering watchdog — recovers gracefully if a track stalls
  useEffect(() => {
    if (!isBuffering || !isPlaying || !currentTrack) return;
    const startTime = usePlayerStore.getState().currentTime;
    const startId = currentTrack.id;
    const timer = window.setTimeout(() => {
      const state = usePlayerStore.getState();
      if (
        state.isBuffering &&
        state.isPlaying &&
        state.currentTrack?.id === startId &&
        Math.abs(state.currentTime - startTime) < 0.25
      ) {
        // Attempt one gentle nudge before surfacing an error
        try {
          if (!isAudioElementTrack && readyRef.current && playerRef.current) {
            playerRef.current.playVideo?.();
          }
        } catch {}
        window.setTimeout(() => {
          const latest = usePlayerStore.getState();
          if (
            latest.isBuffering &&
            latest.isPlaying &&
            latest.currentTrack?.id === startId &&
            Math.abs(latest.currentTime - startTime) < 0.25
          ) {
            latest.setIsBuffering(false);
            if (!latest.playbackError) {
              latest.setPlaybackError(
                "Stream took too long to start. Tap Retry or Skip."
              );
            }
          }
        }, 5000);
      }
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [isBuffering, isPlaying, currentTrack, trackLoadNonce, isAudioElementTrack]);

  // Mount YouTube IFrame API inside a 200x200 viewport-safe container (prevents Chrome/YT instant-pause)
  useEffect(() => {
    if (getAndroidBridge()) return; // Native Android uses Media3 ExoPlayer directly
    let disposed = false;

    const initPlayer = () => {
      if (
        disposed ||
        playerRef.current ||
        !hostRef.current ||
        !window.YT?.Player
      ) {
        return;
      }

      hostRef.current.innerHTML = "";
      const mountNode = document.createElement("div");
      mountNode.style.width = "200px";
      mountNode.style.height = "200px";
      hostRef.current.appendChild(mountNode);

      playerRef.current = new window.YT.Player(mountNode, {
        height: "200",
        width: "200",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          origin:
            typeof window !== "undefined" ? window.location.origin : undefined
        },
        events: {
          onReady: () => {
            if (disposed) return;
            readyRef.current = true;
            const state = usePlayerStore.getState();
            try {
              if (state.muted) {
                playerRef.current?.mute?.();
              } else {
                playerRef.current?.unMute?.();
                playerRef.current?.setVolume?.(state.volume);
              }
              const t = state.currentTrack;
              const direct = Boolean(t?.offlineId || t?.localUrl || t?.streamUrl);
              if (t && !direct) {
                loadedVideoIdRef.current = t.id;
                lastLoadNonceRef.current = state.trackLoadNonce;
                hasEnteredPlayingRef.current = false;
                loadGraceUntilRef.current = Date.now() + 2500;
                if (state.isPlaying) {
                  playerRef.current?.loadVideoById?.({ videoId: t.id, startSeconds: 0 });
                } else {
                  playerRef.current?.cueVideoById?.({ videoId: t.id, startSeconds: 0 });
                  state.setIsBuffering(false);
                }
              }
            } catch {
              // Ignore transient ready errors
            }
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onStateChange: (event: any) => {
            if (disposed) return;
            const store = usePlayerStore.getState();
            const t = store.currentTrack;
            if (!t || t.offlineId || t.localUrl || t.streamUrl) return;
            const YTState = window.YT?.PlayerState;
            if (!YTState) return;

            if (event.data === YTState.BUFFERING) {
              store.setIsBuffering(true);
            } else if (event.data === YTState.PLAYING) {
              hasEnteredPlayingRef.current = true;
              store.setIsBuffering(false);
              if (store.playbackError) store.setPlaybackError(null);
              if (!usePlayerStore.getState().isPlaying) {
                store.setIsPlaying(true);
              }
              const dur = playerRef.current?.getDuration?.() ?? 0;
              const cur = playerRef.current?.getCurrentTime?.() ?? 0;
              store.setProgress(cur, dur);
            } else if (event.data === YTState.PAUSED) {
              // CRITICAL FIX: Ignore transient PAUSED emitted by YouTube during loadVideoById transitions
              const fresh = usePlayerStore.getState();
              if (
                Date.now() < loadGraceUntilRef.current ||
                !hasEnteredPlayingRef.current
              ) {
                if (fresh.isPlaying) {
                  try {
                    playerRef.current?.playVideo?.();
                  } catch {}
                }
                return;
              }
              fresh.setIsBuffering(false);
              if (fresh.isPlaying) fresh.setIsPlaying(false);
            } else if (event.data === YTState.CUED) {
              const fresh = usePlayerStore.getState();
              if (fresh.isPlaying && Date.now() < loadGraceUntilRef.current) {
                try {
                  playerRef.current?.playVideo?.();
                } catch {}
                return;
              }
              fresh.setIsBuffering(false);
            } else if (event.data === YTState.ENDED) {
              store.setIsBuffering(false);
              const wasSleepAtEnd = store.sleepAtTrackEnd;
              void store.nextTrack(true).then(() => {
                if (wasSleepAtEnd) {
                  useToastStore
                    .getState()
                    .showToast("Sleep timer paused at end of track");
                }
              });
            }
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onError: (event: any) => {
            if (disposed) return;
            const store = usePlayerStore.getState();
            const t = store.currentTrack;
            if (!t || t.offlineId || t.localUrl || t.streamUrl) return;
            const code = Number(event?.data);
            const reason =
              code === 101 || code === 150
                ? "This track cannot be embedded by its rights holder. Tap Skip for next track."
                : code === 100
                  ? "This track is unavailable or was removed."
                  : "Playback failed due to a network or player error.";
            store.setPlaybackError(reason);
          }
        }
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      const prevCb = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevCb?.();
        initPlayer();
      };

      if (!document.getElementById("yt-iframe-api")) {
        const script = document.createElement("script");
        script.id = "yt-iframe-api";
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.onerror = () => {
          const store = usePlayerStore.getState();
          const t = store.currentTrack;
          if (t && !t.offlineId && !t.localUrl && !t.streamUrl) {
            store.setPlaybackError(
              "Could not load YouTube Player API. Check your internet connection or play an offline track."
            );
          }
        };
        document.head.appendChild(script);
      }
    }

    return () => {
      disposed = true;
      readyRef.current = false;
      loadedVideoIdRef.current = null;
      try {
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
      if (hostRef.current) {
        hostRef.current.innerHTML = "";
      }
      revokeAllOfflineObjectUrls();
    };
  }, []);

  // Load new track (Android ExoPlayer, IndexedDB offline, local Blob, Audius stream, or YouTube audio)
  useEffect(() => {
    if (!currentTrack) return;
    const reqId = ++loadRequestIdRef.current;
    lastLoadNonceRef.current = trackLoadNonce;
    lastTrackLoadAtRef.current = Date.now();
    hasEnteredPlayingRef.current = false;
    loadGraceUntilRef.current = Date.now() + 3000;

    useLibraryStore.getState().recordPlay(currentTrack);

    const bridge = getAndroidBridge();

    const loadDirectAudio = async () => {
      try {
        playerRef.current?.pauseVideo?.();
      } catch {}

      const audio = audioRef.current;
      if (!audio) return;

      let resolvedSrc = currentTrack.localUrl || currentTrack.streamUrl || "";
      if (currentTrack.offlineId) {
        try {
          const objUrl = await getOfflineObjectUrl(currentTrack.offlineId);
          if (loadRequestIdRef.current !== reqId) return;
          if (!objUrl) {
            usePlayerStore
              .getState()
              .setPlaybackError(
                "Offline audio file is missing from browser storage. Remove and re-import it."
              );
            return;
          }
          resolvedSrc = objUrl;
        } catch {
          if (loadRequestIdRef.current !== reqId) return;
          usePlayerStore
            .getState()
            .setPlaybackError("Could not read offline audio from IndexedDB.");
          return;
        }
      }

      if (!resolvedSrc) {
        usePlayerStore
          .getState()
          .setPlaybackError("Audio source URL is missing for this track.");
        return;
      }

      const isCorsSafeSrc =
        resolvedSrc.startsWith("blob:") ||
        resolvedSrc.startsWith("/") ||
        (typeof window !== "undefined" &&
          resolvedSrc.startsWith(window.location.origin));

      if (isCorsSafeSrc) {
        audio.crossOrigin = "anonymous";
      } else {
        audio.removeAttribute("crossorigin");
      }

      audio.src = resolvedSrc;
      audio.volume = muted ? 0 : volume / 100;
      audio.load();

      // Only attach Web Audio 5-band Equalizer graph for CORS-safe sources (blob, same-origin, relative)
      if (isCorsSafeSrc) {
        if (!audioCtxRef.current && typeof window !== "undefined") {
          try {
            const AudioCtx =
              window.AudioContext ||
              (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext;
            if (AudioCtx) {
              const ctx = new AudioCtx();
              const source = ctx.createMediaElementSource(audio);
              const eqState = useEQStore.getState();
              const filters = EQ_FREQUENCIES.map((freq, idx) => {
                const f = ctx.createBiquadFilter();
                f.type =
                  idx === 0
                    ? "lowshelf"
                    : idx === EQ_FREQUENCIES.length - 1
                      ? "highshelf"
                      : "peaking";
                f.frequency.value = freq;
                f.Q.value = 1.1;
                f.gain.value = eqState.enabled ? (eqState.gains[idx] ?? 0) : 0;
                return f;
              });
              source.connect(filters[0]);
              for (let i = 0; i < filters.length - 1; i++) {
                filters[i].connect(filters[i + 1]);
              }
              filters[filters.length - 1].connect(ctx.destination);
              audioCtxRef.current = ctx;
              eqFiltersRef.current = filters;
            }
          } catch {}
        }
        if (audioCtxRef.current?.state === "suspended") {
          void audioCtxRef.current.resume().catch(() => {});
        }
      }

      if (usePlayerStore.getState().isPlaying) {
        try {
          await audio.play();
        } catch (err) {
          if (loadRequestIdRef.current !== reqId) return;
          const name = err instanceof Error ? err.name : "";
          if (name === "NotAllowedError") {
            usePlayerStore.getState().setIsPlaying(false);
            usePlayerStore.getState().setIsBuffering(false);
            useToastStore
              .getState()
              .showToast("Tap Play to start audio playback");
          } else if (name !== "AbortError") {
            usePlayerStore
              .getState()
              .setPlaybackError("Could not decode or play this audio file.");
          }
        }
      } else {
        usePlayerStore.getState().setIsBuffering(false);
      }
    };

    if (bridge && androidSyncedTrackIdRef.current === currentTrack.id) {
      androidSyncedTrackIdRef.current = null;
      loadedVideoIdRef.current = currentTrack.id;
    } else if (isAudioElementTrack) {
      loadedVideoIdRef.current = null;
      void loadDirectAudio();
    } else if (
      bridge &&
      currentTrack.localUrl?.startsWith("content://") &&
      typeof bridge.playLocalContent === "function"
    ) {
      loadedVideoIdRef.current = currentTrack.id;
      if (usePlayerStore.getState().isPlaying) {
        bridge.playLocalContent(
          currentTrack.localUrl,
          currentTrack.title,
          currentTrack.artist
        );
      } else {
        usePlayerStore.getState().setIsBuffering(false);
      }
    } else if (
      bridge &&
      typeof bridge.hasOfflineAudio === "function" &&
      bridge.hasOfflineAudio(currentTrack.id) &&
      typeof bridge.playOfflineAudio === "function"
    ) {
      loadedVideoIdRef.current = currentTrack.id;
      if (usePlayerStore.getState().isPlaying) {
        bridge.playOfflineAudio(
          currentTrack.id,
          currentTrack.title,
          currentTrack.artist,
          currentTrack.thumbnail || ""
        );
      } else {
        usePlayerStore.getState().setIsBuffering(false);
      }
    } else if (bridge && typeof bridge.playYouTube === "function") {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      }
      loadedVideoIdRef.current = currentTrack.id;
      if (usePlayerStore.getState().isPlaying) {
        bridge.playYouTube(
          currentTrack.id,
          currentTrack.title,
          currentTrack.artist,
          currentTrack.thumbnail || ""
        );
      } else {
        usePlayerStore.getState().setIsBuffering(false);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      }
      if (readyRef.current && playerRef.current) {
        loadedVideoIdRef.current = currentTrack.id;
        try {
          if (usePlayerStore.getState().isPlaying) {
            playerRef.current.loadVideoById?.({
              videoId: currentTrack.id,
              startSeconds: 0
            });
          } else {
            playerRef.current.cueVideoById?.({
              videoId: currentTrack.id,
              startSeconds: 0
            });
            usePlayerStore.getState().setIsBuffering(false);
          }
        } catch {
          usePlayerStore
            .getState()
            .setPlaybackError("Could not start audio playback.");
        }
      }
    }

    // Update OS / Android Media Session metadata
    try {
      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album || "Sangeet",
          artwork: [
            { src: currentTrack.thumbnail, sizes: "512x512", type: "image/jpeg" }
          ]
        });
        navigator.mediaSession.setActionHandler("play", () =>
          usePlayerStore.getState().setIsPlaying(true)
        );
        navigator.mediaSession.setActionHandler("pause", () =>
          usePlayerStore.getState().setIsPlaying(false)
        );
        navigator.mediaSession.setActionHandler("nexttrack", () => {
          void usePlayerStore.getState().nextTrack();
        });
        navigator.mediaSession.setActionHandler("previoustrack", () =>
          usePlayerStore.getState().prevTrack()
        );
        navigator.mediaSession.setActionHandler("seekto", (details) => {
          if (typeof details.seekTime === "number") {
            usePlayerStore.getState().requestSeek(details.seekTime);
          }
        });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, trackLoadNonce]);

  // Play / Pause sync (respects load grace period and avoids double-triggering on track switch)
  useEffect(() => {
    if (!currentTrack) return;
    // If the track-load effect just triggered play in this same commit, do not double-call playVideo/play
    if (isPlaying && Date.now() - lastTrackLoadAtRef.current < 150) {
      return;
    }

    if (isAudioElementTrack) {
      const audio = audioRef.current;
      if (!audio || !audio.src) return;
      if (isPlaying) {
        if (audio.paused) {
          void audio.play().catch((err) => {
            const name = err instanceof Error ? err.name : "";
            if (name === "NotAllowedError") {
              usePlayerStore.getState().setIsPlaying(false);
              useToastStore
                .getState()
                .showToast("Tap Play to start audio playback");
            }
          });
        }
      } else {
        audio.pause();
      }
      return;
    }

    const bridge = getAndroidBridge();
    if (bridge) {
      if (isPlaying) {
        if (loadedVideoIdRef.current !== currentTrack.id) {
          loadedVideoIdRef.current = currentTrack.id;
          loadGraceUntilRef.current = Date.now() + 2800;
          hasEnteredPlayingRef.current = false;
          bridge.playYouTube?.(
            currentTrack.id,
            currentTrack.title,
            currentTrack.artist,
            currentTrack.thumbnail || ""
          );
        } else {
          bridge.resume?.();
        }
      } else {
        bridge.pause?.();
      }
      return;
    }

    if (!readyRef.current || !playerRef.current) return;

    try {
      if (isPlaying) {
        if (loadedVideoIdRef.current !== currentTrack.id) {
          loadedVideoIdRef.current = currentTrack.id;
          loadGraceUntilRef.current = Date.now() + 2800;
          hasEnteredPlayingRef.current = false;
          playerRef.current.loadVideoById?.({
            videoId: currentTrack.id,
            startSeconds: 0
          });
        } else {
          const st = playerRef.current.getPlayerState?.();
          const YTState = window.YT?.PlayerState;
          if (!YTState || st !== YTState.PLAYING) {
            playerRef.current.playVideo?.();
          }
        }
      } else {
        playerRef.current.pauseVideo?.();
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, isAudioElementTrack]);

  // Volume / Mute sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume / 100;
    }
    const bridge = getAndroidBridge();
    if (bridge) {
      bridge.setVolume?.(muted ? 0 : volume / 100);
      return;
    }
    if (!readyRef.current || !playerRef.current) return;
    try {
      if (muted) {
        playerRef.current.mute?.();
      } else {
        playerRef.current.unMute?.();
        playerRef.current.setVolume?.(volume);
      }
    } catch {}
  }, [volume, muted]);

  // Seek sync (also resumes playback cleanly on repeat-one / restart)
  useEffect(() => {
    if (seekTarget === null) return;
    const shouldPlay = usePlayerStore.getState().isPlaying;

    if (isAudioElementTrack && audioRef.current) {
      try {
        audioRef.current.currentTime = seekTarget;
        if (shouldPlay && audioRef.current.paused) {
          void audioRef.current.play().catch(() => {});
        }
      } catch {}
    } else if (getAndroidBridge()) {
      getAndroidBridge()?.seekTo?.(seekTarget);
      if (shouldPlay) getAndroidBridge()?.resume?.();
    } else if (readyRef.current && playerRef.current) {
      try {
        loadGraceUntilRef.current = Date.now() + 1200;
        playerRef.current.seekTo?.(seekTarget, true);
        if (shouldPlay) {
          playerRef.current.playVideo?.();
        }
      } catch {}
    }
    usePlayerStore.getState().clearSeekTarget();
  }, [seekNonce, seekTarget, isAudioElementTrack]);

  // Throttled 400ms progress polling + MediaSession positionState sync
  useEffect(() => {
    if (!isPlaying) return;
    if (getAndroidBridge() && !isAudioElementTrack) return;

    const id = window.setInterval(() => {
      let cur = 0;
      let dur = 0;

      if (isAudioElementTrack && audioRef.current) {
        cur = audioRef.current.currentTime;
        dur = Number.isFinite(audioRef.current.duration)
          ? audioRef.current.duration
          : 0;
      } else if (readyRef.current && playerRef.current) {
        try {
          cur = playerRef.current.getCurrentTime?.() ?? 0;
          dur = playerRef.current.getDuration?.() ?? 0;

          if (usePlayerStore.getState().sponsorBlockEnabled) {
            for (const seg of segmentsRef.current) {
              const key = `${seg.start}-${seg.end}`;
              if (
                cur >= seg.start &&
                cur < seg.end - 0.5 &&
                !skippedIdsRef.current.has(key)
              ) {
                skippedIdsRef.current.add(key);
                playerRef.current.seekTo?.(seg.end, true);
                useToastStore
                  .getState()
                  .showToast(
                    `SponsorBlock skipped ${seg.category.replace("_", " ")}`,
                    "success"
                  );
                break;
              }
            }
          }
        } catch {}
      } else {
        return;
      }

      if (Number.isFinite(cur)) {
        usePlayerStore.getState().setProgress(cur, dur > 0 ? dur : undefined);
        try {
          if (
            typeof navigator !== "undefined" &&
            "mediaSession" in navigator &&
            typeof navigator.mediaSession.setPositionState === "function" &&
            dur > 0
          ) {
            navigator.mediaSession.setPositionState({
              duration: dur,
              playbackRate: 1,
              position: Math.min(cur, dur)
            });
          }
        } catch {}
      }
    }, 400);
    return () => window.clearInterval(id);
  }, [isPlaying, isAudioElementTrack]);

  // Global keyboard shortcuts (audio-focused, never hijacks browser Ctrl/Meta/Alt combos)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const player = usePlayerStore.getState();

      if (e.code === "Space") {
        if (target?.tagName === "BUTTON" || target?.tagName === "A") return;
        e.preventDefault();
        player.togglePlay();
      } else if (e.key === "m" || e.key === "M") {
        player.toggleMute();
      } else if (e.shiftKey && e.key === "ArrowRight") {
        e.preventDefault();
        void player.nextTrack();
      } else if (e.shiftKey && e.key === "ArrowLeft") {
        e.preventDefault();
        player.prevTrack();
      } else if (e.key === "ArrowRight" && player.currentTrack) {
        e.preventDefault();
        const maxDur = player.duration || player.currentTrack.duration || 0;
        const nextPos =
          maxDur > 0
            ? Math.min(maxDur, player.currentTime + 5)
            : player.currentTime + 5;
        player.requestSeek(nextPos);
      } else if (e.key === "ArrowLeft" && player.currentTrack) {
        e.preventDefault();
        player.requestSeek(Math.max(0, player.currentTime - 5));
      } else if (e.shiftKey && e.key === "ArrowUp") {
        e.preventDefault();
        player.setVolume(player.volume + 5);
      } else if (e.shiftKey && e.key === "ArrowDown") {
        e.preventDefault();
        player.setVolume(player.volume - 5);
      } else if ((e.key === "l" || e.key === "L") && player.currentTrack) {
        const liked = useLibraryStore.getState().toggleLike(player.currentTrack);
        useToastStore
          .getState()
          .showToast(
            liked ? "Saved to Liked Songs" : "Removed from Liked Songs",
            liked ? "success" : "default"
          );
      } else if (e.key === "s" || e.key === "S") {
        player.toggleShuffle();
        useToastStore
          .getState()
          .showToast(
            usePlayerStore.getState().shuffle ? "Shuffle ON" : "Shuffle OFF"
          );
      } else if (e.key === "r" || e.key === "R") {
        player.cycleRepeat();
        const mode = usePlayerStore.getState().repeat;
        useToastStore
          .getState()
          .showToast(
            mode === "one"
              ? "Repeat One"
              : mode === "all"
                ? "Repeat All"
                : "Repeat Off"
          );
      } else if (e.key === "q" || e.key === "Q") {
        useUIStore.getState().toggleRightTab("queue");
      } else if (e.key === "t" || e.key === "T") {
        useUIStore.getState().toggleTheme();
        const nextTheme = useUIStore.getState().theme;
        useToastStore
          .getState()
          .showToast(`Switched to ${nextTheme} theme`, "success");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) {
            usePlayerStore
              .getState()
              .setProgress(e.currentTarget.currentTime, d);
          }
        }}
        onPlaying={() => {
          hasEnteredPlayingRef.current = true;
          const store = usePlayerStore.getState();
          store.setIsBuffering(false);
          if (store.playbackError) store.setPlaybackError(null);
          if (!usePlayerStore.getState().isPlaying) {
            store.setIsPlaying(true);
          }
        }}
        onPause={() => {
          const store = usePlayerStore.getState();
          store.setIsBuffering(false);
          if (
            Date.now() > loadGraceUntilRef.current &&
            hasEnteredPlayingRef.current &&
            store.isPlaying &&
            !audioRef.current?.ended
          ) {
            store.setIsPlaying(false);
          }
        }}
        onWaiting={() => usePlayerStore.getState().setIsBuffering(true)}
        onCanPlay={() => usePlayerStore.getState().setIsBuffering(false)}
        onError={() => {
          const store = usePlayerStore.getState();
          if (store.currentTrack && isAudioElementTrack) {
            store.setPlaybackError(
              "Audio format unsupported or stream interrupted."
            );
          }
        }}
        onEnded={() => {
          const store = usePlayerStore.getState();
          const wasSleepAtEnd = store.sleepAtTrackEnd;
          void store.nextTrack(true).then(() => {
            if (wasSleepAtEnd) {
              useToastStore
                .getState()
                .showToast("Sleep timer paused at end of track");
            }
          });
        }}
      />

      {/* Non-zero opacity 200x200 viewport-safe YouTube audio host (prevents Chrome/YT visibility throttling) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-0 right-0 z-0 h-[200px] w-[200px] overflow-hidden opacity-[0.01]"
      >
        <div ref={hostRef} className="h-[200px] w-[200px]" />
      </div>
    </>
  );
}
