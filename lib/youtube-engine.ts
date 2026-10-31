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

let player: YouTubePlayer | null = null;
let apiPromise: Promise<void> | null = null;
let initPromise: Promise<void> | null = null;
let ready = false;
let destroyed = false;
let handlers: YouTubeHandlers = {};
let pending: { videoId: string; shouldPlay: boolean; startSeconds: number } | null = null;
let lastVideoId = "";
let desiredVolume = 0.78;
let desiredMuted = false;

function loadApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("YouTube player could not be loaded."));
    document.head.appendChild(script);
  });

  return apiPromise;
}

function applyVolume() {
  if (!player) return;
  player.setVolume(Math.round(desiredVolume * 100));
  if (desiredMuted) player.mute();
  else player.unMute();
}

function applyPending() {
  if (!ready || !player || !pending) return;
  const { videoId, shouldPlay, startSeconds } = pending;
  pending = null;
  try {
    if (shouldPlay) player.loadVideoById(videoId, startSeconds);
    else player.cueVideoById(videoId, startSeconds);
    applyVolume();
  } catch {
    // The player will surface a useful error through onError.
  }
}

const errorMessages: Record<number, string> = {
  2: "This YouTube video has an invalid request.",
  5: "This YouTube video cannot play in the current browser.",
  100: "This YouTube video is unavailable.",
  101: "The owner of this YouTube video does not allow it to be embedded.",
  150: "The owner of this YouTube video does not allow it to be embedded.",
};

export function initYouTubePlayer(containerId: string, nextHandlers: YouTubeHandlers): void {
  if (typeof window === "undefined" || destroyed) return;
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
          controls: 1,
          disablekb: 0,
          fs: 1,
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
            if (event.data === 1) handlers.onPlay?.();
            else if (event.data === 2) handlers.onPause?.();
            else if (event.data === 3) handlers.onBuffering?.();
            else if (event.data === 0) handlers.onEnded?.();
          },
          onError: (event) => {
            handlers.onError?.(
              errorMessages[event.data] ?? "This YouTube video could not be played.",
              event.data,
            );
          },
        },
      });
    } catch {
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
  if (ready && player) {
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
}

export function playYouTube(): void {
  if (pending) {
    pending.shouldPlay = true;
    return;
  }
  if (!ready || !player) {
    if (lastVideoId) {
      pending = {
        videoId: lastVideoId,
        shouldPlay: true,
        startSeconds: getYouTubeTime(),
      };
    }
    return;
  }
  try {
    player.playVideo();
    // The embed can reject playVideo while it is still attaching a cued video.
    window.setTimeout(() => {
      try {
        const state = player?.getPlayerState();
        if (state !== 1 && state !== 3) player?.playVideo();
      } catch {
        // Ignore late player races.
      }
    }, 450);
  } catch {
    // Ignore player race conditions.
  }
}

export function pauseYouTube(): void {
  if (pending) {
    pending.shouldPlay = false;
    return;
  }
  try {
    player?.pauseVideo();
  } catch {
    // Ignore player race conditions.
  }
}

export function seekYouTube(seconds: number): void {
  if (pending) pending.startSeconds = seconds;
  try {
    player?.seekTo(Math.max(0, seconds), true);
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

export function stopYouTube(): void {
  pending = null;
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

export function isYouTubeReady(): boolean {
  return ready && Boolean(player);
}

export function destroyYouTubePlayer(): void {
  destroyed = true;
  pending = null;
  try {
    player?.stopVideo();
  } catch {
    // Ignore teardown races.
  }
  player = null;
  ready = false;
}
