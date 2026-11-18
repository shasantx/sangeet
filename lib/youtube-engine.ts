"use client";

type YouTubePlayer = {
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  cueVideoById: (videoId: string, startSeconds?: number) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setPlaybackRate?: (suggestedRate: number) => void;
};

type YouTubeApi = {
  Player: new (
    element: HTMLElement | string,
    options: {
      width?: string | number;
      height?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YouTubeHandlers {
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onBuffering?: () => void;
  onEnded?: () => void;
  onError?: (message: string, code: number) => void;
}

type QueuedCommand =
  | { type: "play" }
  | { type: "pause" }
  | { type: "seek"; seconds: number };

let player: YouTubePlayer | null = null;
let apiPromise: Promise<void> | null = null;
let initPromise: Promise<void> | null = null;
let lastContainerId = "";
let ready = false;
let destroyed = false;
let handlers: YouTubeHandlers = {};
let pending: { videoId: string; shouldPlay: boolean; startSeconds: number } | null = null;
let queuedCommands: QueuedCommand[] = [];
let lastVideoId = "";
let desiredPlaying = false;
let hasPlayedCurrentLoad = false;
let suppressPauseUntil = 0;
let playRetryTimer: number | null = null;
let desiredVolume = 0.78;
let desiredMuted = false;
let desiredPlaybackRate = 1;

function clearPlayRetryTimer(): void {
  if (playRetryTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(playRetryTimer);
    playRetryTimer = null;
  }
}

function schedulePlayRetry(): void {
  if (typeof window === "undefined") return;
  clearPlayRetryTimer();
  playRetryTimer = window.setTimeout(() => {
    playRetryTimer = null;
    if (destroyed || !desiredPlaying || !ready || !player) return;
    try {
      const state = player.getPlayerState();
      if (state !== 1 && state !== 3) {
        player.playVideo();
      }
    } catch {
      // Ignore late player races.
    }
  }, 450);
}

function loadApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      apiPromise = null;
      reject(new Error("YouTube player initialization timed out."));
    }, 12000);
    const finish = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        previous?.();
      } finally {
        finish();
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (existing) {
      // Remove stale script from a previously timed-out attempt so retry can load cleanly.
      existing.remove();
    }

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timeout);
      apiPromise = null;
      script.remove();
      reject(new Error("YouTube player could not be loaded."));
    };
    document.head.appendChild(script);
  });

  return apiPromise;
}

function applyVolume() {
  if (!player) return;
  player.setVolume(Math.round(desiredVolume * 100));
  if (desiredMuted) player.mute();
  else player.unMute();
  try {
    player.setPlaybackRate?.(desiredPlaybackRate);
  } catch {
    // Ignore unsupported playback rates on embedded videos.
  }
}

function applyPending() {
  if (!ready || !player) return;
  if (pending) {
    const { videoId, shouldPlay, startSeconds } = pending;
    pending = null;
    desiredPlaying = shouldPlay;
    hasPlayedCurrentLoad = false;
    suppressPauseUntil = shouldPlay ? Date.now() + 2500 : 0;
    try {
      if (shouldPlay) player.loadVideoById(videoId, startSeconds);
      else player.cueVideoById(videoId, startSeconds);
      applyVolume();
    } catch {
      // The player will surface a useful error through onError.
    }
  }

  if (queuedCommands.length > 0) {
    const commands = queuedCommands;
    queuedCommands = [];
    for (const cmd of commands) {
      try {
        if (cmd.type === "seek") {
          if (desiredPlaying) {
            suppressPauseUntil = Math.max(suppressPauseUntil, Date.now() + 1200);
          }
          player.seekTo(cmd.seconds, true);
        } else if (cmd.type === "play") {
          desiredPlaying = true;
          suppressPauseUntil = Math.max(suppressPauseUntil, Date.now() + 2500);
          player.playVideo();
          schedulePlayRetry();
        } else if (cmd.type === "pause") {
          desiredPlaying = false;
          clearPlayRetryTimer();
          player.pauseVideo();
        }
      } catch {
        // Ignore player race conditions while flushing queued commands.
      }
    }
  }
}

const errorMessages: Record<number, string> = {
  2: "This YouTube video has an invalid request.",
  5: "This YouTube video cannot play in the current browser.",
  100: "This YouTube video is unavailable.",
  101: "The owner of this YouTube video does not allow it to be embedded.",
  150: "The owner of this YouTube video does not allow it to be embedded.",
  153: "YouTube could not verify this player. Reload Sangeet and try again.",
};

export function initYouTubePlayer(containerId: string, nextHandlers: YouTubeHandlers): void {
  if (typeof window === "undefined") return;
  destroyed = false;
  lastContainerId = containerId;
  handlers = nextHandlers;
  if (initPromise) return;

  initPromise = (async () => {
    try {
      await loadApi();
      if (destroyed || player) return;
      const container = document.getElementById(containerId);
      if (!container || !window.YT?.Player) {
        initPromise = null;
        return;
      }

      player = new window.YT.Player(container, {
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            ready = true;
            applyVolume();
            applyPending();
            handlers.onReady?.();
          },
          onStateChange: (event) => {
            if (event.data === 1) {
              hasPlayedCurrentLoad = true;
              suppressPauseUntil = 0;
              clearPlayRetryTimer();
              handlers.onPlay?.();
            } else if (event.data === 2) {
              // Ignore transient PAUSED events emitted during load/seek handoffs while playback is desired.
              if (desiredPlaying && (!hasPlayedCurrentLoad || Date.now() < suppressPauseUntil)) {
                return;
              }
              desiredPlaying = false;
              clearPlayRetryTimer();
              handlers.onPause?.();
            } else if (event.data === 3) {
              handlers.onBuffering?.();
            } else if (event.data === 0) {
              desiredPlaying = false;
              clearPlayRetryTimer();
              handlers.onEnded?.();
            } else if (event.data === 5 && desiredPlaying) {
              try {
                player?.playVideo();
              } catch {
                // Ignore race condition
              }
            }
          },
          onError: (event) => {
            desiredPlaying = false;
            clearPlayRetryTimer();
            handlers.onError?.(
              errorMessages[event.data] ?? "This YouTube video could not be played.",
              event.data,
            );
          },
        },
      });
    } catch {
      initPromise = null;
      handlers.onError?.(
        "YouTube could not be loaded. Check your connection and try again.",
        0,
      );
    }
  })();
}

export function loadYouTubeVideo(videoId: string, shouldPlay: boolean, startSeconds = 0): void {
  if (!videoId) return;
  lastVideoId = videoId;
  desiredPlaying = shouldPlay;
  clearPlayRetryTimer();
  if (!initPromise && !player && lastContainerId) {
    initYouTubePlayer(lastContainerId, handlers);
  }
  if (ready && player) {
    pending = null;
    queuedCommands = [];
    hasPlayedCurrentLoad = false;
    suppressPauseUntil = shouldPlay ? Date.now() + 2500 : 0;
    try {
      if (shouldPlay) player.loadVideoById(videoId, startSeconds);
      else player.cueVideoById(videoId, startSeconds);
      applyVolume();
      return;
    } catch {
      // Fall through to the pending queue so onReady can retry.
    }
  }
  pending = { videoId, shouldPlay, startSeconds };
  queuedCommands = [];
}

export function playYouTube(): void {
  desiredPlaying = true;
  clearPlayRetryTimer();
  if (pending) {
    pending.shouldPlay = true;
    return;
  }
  if (!ready || !player) {
    if (lastVideoId) {
      const queuedSeek = [...queuedCommands].reverse().find((cmd) => cmd.type === "seek");
      pending = {
        videoId: lastVideoId,
        shouldPlay: true,
        startSeconds: queuedSeek?.type === "seek" ? queuedSeek.seconds : getYouTubeTime(),
      };
      queuedCommands = [];
    } else {
      queuedCommands = queuedCommands.filter((cmd) => cmd.type !== "play" && cmd.type !== "pause");
      queuedCommands.push({ type: "play" });
    }
    return;
  }
  suppressPauseUntil = Math.max(suppressPauseUntil, Date.now() + 1500);
  try {
    player.playVideo();
    // The embed can reject playVideo while it is still attaching a cued video.
    schedulePlayRetry();
  } catch {
    // Ignore player race conditions.
  }
}

export function pauseYouTube(): void {
  desiredPlaying = false;
  clearPlayRetryTimer();
  if (pending) {
    pending.shouldPlay = false;
    return;
  }
  if (!ready || !player) {
    queuedCommands = queuedCommands.filter((cmd) => cmd.type !== "play" && cmd.type !== "pause");
    queuedCommands.push({ type: "pause" });
    return;
  }
  try {
    player.pauseVideo();
  } catch {
    // Ignore player race conditions.
  }
}

export function seekYouTube(seconds: number): void {
  const target = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  if (pending) {
    pending.startSeconds = target;
    return;
  }
  if (!ready || !player) {
    queuedCommands = queuedCommands.filter((cmd) => cmd.type !== "seek");
    queuedCommands.push({ type: "seek", seconds: target });
    return;
  }
  if (desiredPlaying) {
    suppressPauseUntil = Math.max(suppressPauseUntil, Date.now() + 1200);
  }
  try {
    player.seekTo(target, true);
  } catch {
    // Ignore player race conditions.
  }
}

export function setYouTubeVolume(volume: number): void {
  desiredVolume = Math.min(1, Math.max(0, volume));
  if (!player) return;
  player.setVolume(Math.round(desiredVolume * 100));
}

export function muteYouTube(muted: boolean): void {
  desiredMuted = muted;
  if (!player) return;
  if (muted) player.mute();
  else player.unMute();
}

export function setYouTubePlaybackRate(rate: number): void {
  desiredPlaybackRate = rate;
  if (!player) return;
  try {
    player.setPlaybackRate?.(rate);
  } catch {
    // Ignore player race conditions or unsupported rates.
  }
}

export function replayYouTube(): void {
  desiredPlaying = true;
  clearPlayRetryTimer();
  if (pending) {
    pending.startSeconds = 0;
    pending.shouldPlay = true;
    return;
  }
  if (!ready || !player) {
    if (lastVideoId) {
      pending = {
        videoId: lastVideoId,
        shouldPlay: true,
        startSeconds: 0,
      };
      queuedCommands = [];
    } else {
      queuedCommands = [
        { type: "seek", seconds: 0 },
        { type: "play" },
      ];
    }
    return;
  }
  suppressPauseUntil = Math.max(suppressPauseUntil, Date.now() + 1500);
  try {
    player.seekTo(0, true);
    player.playVideo();
  } catch {
    // Ignore player race conditions.
  }
}

export function stopYouTube(): void {
  desiredPlaying = false;
  clearPlayRetryTimer();
  pending = null;
  queuedCommands = [];
  try {
    player?.stopVideo();
  } catch {
    // Ignore player race conditions.
  }
}

export function getYouTubeTime(): number {
  try {
    return player?.getCurrentTime() ?? 0;
  } catch {
    return 0;
  }
}

export function getYouTubeDuration(): number {
  try {
    return player?.getDuration() ?? 0;
  } catch {
    return 0;
  }
}

export function getYouTubePlayerState(): number | null {
  if (!ready || !player) return null;
  try {
    return player.getPlayerState();
  } catch {
    return null;
  }
}

export function getLoadedYouTubeVideoId(): string {
  return lastVideoId;
}

export function hasPendingYouTubeLoad(): boolean {
  return Boolean(pending);
}

export function isYouTubeReady(): boolean {
  return ready && Boolean(player);
}

export function destroyYouTubePlayer(): void {
  destroyed = true;
  desiredPlaying = false;
  clearPlayRetryTimer();
  pending = null;
  queuedCommands = [];
  try {
    player?.stopVideo();
  } catch {
    // Ignore teardown races.
  }
  player = null;
  ready = false;
  initPromise = null;
}
