"use client";

import { useEffect, useRef } from "react";
import { getAlbum, getArtist, getTrack } from "@/lib/catalog";
import { restoreAudiusTrack, restoreYouTubeTrack } from "@/lib/dynamic-tracks";
import { useAuthStore } from "@/store/auth-store";
import { usePlayerStore } from "@/store/player-store";

export const DEVICE_KEY = "sangeet-device-id-v1";
export const GUEST_SYNC_KEY = "sangeet-sync-session-id-v1";
export const CUSTOM_DEVICE_NAME_KEY = "sangeet-custom-device-name-v1";
export const GROUP_LISTEN_KEY = "sangeet-group-listen-v1";

export function isGroupListenEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(GROUP_LISTEN_KEY) === "1";
}

export function setGroupListenEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  if (enabled) {
    window.localStorage.setItem(GROUP_LISTEN_KEY, "1");
  } else {
    window.localStorage.removeItem(GROUP_LISTEN_KEY);
  }
}

export function getCustomDeviceName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(CUSTOM_DEVICE_NAME_KEY) || "";
}

export function setCustomDeviceName(name: string): void {
  if (typeof window === "undefined") return;
  const clean = name.trim().slice(0, 40);
  if (!clean) {
    window.localStorage.removeItem(CUSTOM_DEVICE_NAME_KEY);
  } else {
    window.localStorage.setItem(CUSTOM_DEVICE_NAME_KEY, clean);
  }
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id || !/^[A-Za-z0-9_-]{16,80}$/.test(id)) {
    id = crypto.randomUUID().replace(/-/g, "");
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function getGuestSyncId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(GUEST_SYNC_KEY);
  if (!id || !/^[A-Za-z0-9_-]{16,80}$/.test(id)) {
    // 128-bit cryptographic random identifier (32 hex chars)
    id = crypto.randomUUID().replace(/-/g, "");
    window.localStorage.setItem(GUEST_SYNC_KEY, id);
  }
  return id;
}

export function setGuestSyncId(id: string): boolean {
  if (typeof window === "undefined") return false;
  const trimmed = id.trim();
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(trimmed)) return false;
  window.localStorage.setItem(GUEST_SYNC_KEY, trimmed);
  return true;
}

export function getDeviceType(): "phone" | "tablet" | "computer" | "browser" {
  if (typeof navigator === "undefined") return "browser";
  const ua = navigator.userAgent;
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/android|iphone|mobile/i.test(ua)) return "phone";
  return "computer";
}

export function getDeviceName(): string {
  const custom = getCustomDeviceName();
  if (custom) return custom;
  if (typeof navigator === "undefined") return "Browser";
  const ua = navigator.userAgent;
  const isWindows = /windows/i.test(ua);
  const isMac = /macintosh|mac os/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isIPhone = /iphone/i.test(ua);

  const type = getDeviceType();
  let os = "Web";
  if (isWindows) os = "Windows";
  else if (isMac) os = "Mac";
  else if (isAndroid) os = "Android";
  else if (isIPhone) os = "iPhone";

  return `${os} ${type === "phone" ? "Phone" : type === "tablet" ? "Tablet" : "PC"}`;
}

function describeTrack() {
  const state = usePlayerStore.getState();
  const track = state.currentTrackId ? getTrack(state.currentTrackId) : undefined;
  if (!track) return null;
  const common = {
    title: track.title,
    artist: getArtist(track.artistId)?.name ?? "Sangeet artist",
    album: getAlbum(track.albumId)?.title ?? "",
    artwork: track.artwork,
    duration: track.duration,
  };
  if (track.youtubeId) return { ...common, source: "youtube" as const, videoId: track.youtubeId };
  if (track.source === "audius") return { ...common, source: "audius" as const, trackId: track.id.replace(/^aud-/, "") };
  return null;
}

export function ConnectedDeviceSync() {
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const lastAckRef = useRef<string | null>(null);
  const knownDeviceCountRef = useRef<number>(1);
  const lastPutAtRef = useRef<number>(0);
  const lastPutStateRef = useRef<{
    currentTrackId: string | null;
    isPlaying: boolean;
    volume: number;
  }>({
    currentTrackId: null,
    isPlaying: false,
    volume: -1,
  });

  useEffect(() => {
    let active = true;
    let timer: number | null = null;
    let stateChangeTimer: number | null = null;
    let inFlight = false;
    const deviceId = getDeviceId();

    const clearScheduled = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const getPollIntervalMs = () => {
      const state = usePlayerStore.getState();
      const groupListen = isGroupListenEnabled();
      const deviceCount = knownDeviceCountRef.current;

      if ((state.isPlaying && deviceCount > 1) || groupListen) {
        return 5_000;
      }
      if (!state.isPlaying && deviceCount <= 1 && !groupListen) {
        return 18_000;
      }
      return 12_000;
    };

    const scheduleNext = () => {
      clearScheduled();
      if (!active) return;
      if (typeof document !== "undefined" && document.hidden) return;
      timer = window.setTimeout(() => {
        void cycle();
      }, getPollIntervalMs());
    };

    // Check URL for ?syncId= pairing parameter and clean it from the address bar immediately
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        const urlSyncId = url.searchParams.get("syncId");
        const urlGroup = url.searchParams.get("group");
        if (urlSyncId && setGuestSyncId(urlSyncId)) {
          if (urlGroup === "1") {
            setGroupListenEnabled(true);
          }
          url.searchParams.delete("syncId");
          url.searchParams.delete("group");
          window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
        }
      } catch {
        // Ignore URL parse errors
      }
    }

    // 1. Cross-tab fast local sync via BroadcastChannel with strict payload validation
    let broadcast: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        broadcast = new BroadcastChannel("sangeet_device_bus");
        broadcast.onmessage = (event) => {
          if (!active || !event.data || typeof event.data !== "object") return;
          const { targetId, action, track, currentTime, volume } = event.data as Record<string, unknown>;
          if (typeof targetId === "string" && targetId !== "all" && targetId !== deviceId) return;
          if (typeof action !== "string") return;

          const player = usePlayerStore.getState();
          if (action === "pause" && player.isPlaying) {
            player.togglePlay();
          } else if (action === "play") {
            if (track && typeof track === "object") {
              const t = track as Record<string, unknown>;
              const restored =
                t.source === "youtube" && typeof t.videoId === "string"
                  ? restoreYouTubeTrack({
                      videoId: t.videoId,
                      title: String(t.title ?? ""),
                      artist: String(t.artist ?? ""),
                      album: String(t.album ?? ""),
                      thumbnail: String(t.artwork ?? ""),
                      durationSeconds: Number(t.duration) || 0,
                    })
                  : t.source === "audius" && typeof t.trackId === "string"
                    ? restoreAudiusTrack({
                        id: t.trackId,
                        title: String(t.title ?? ""),
                        artist: String(t.artist ?? ""),
                        album: String(t.album ?? ""),
                        artwork: String(t.artwork ?? ""),
                        durationSeconds: Number(t.duration) || 0,
                      })
                    : undefined;
              if (restored) {
                player.playTrack(restored.id, [restored.id], "Playing on this device");
                if (Number(currentTime) > 0 && Number.isFinite(Number(currentTime))) {
                  window.setTimeout(() => usePlayerStore.getState().seek(Number(currentTime)), 600);
                }
              }
            } else if (!player.isPlaying) {
              player.togglePlay();
            }
          } else if (action === "next") {
            player.next();
          } else if (action === "previous") {
            player.previous();
          } else if (action === "seek" && Number.isFinite(currentTime)) {
            player.seek(Math.max(0, Math.min(86400, Number(currentTime))));
          } else if (action === "volume" && Number.isFinite(volume)) {
            player.setVolume(Math.max(0, Math.min(1, Number(volume))));
          }
        };
      }
    } catch {
      // BroadcastChannel optional fallback
    }

    // 2. Adaptive server polling heartbeat and command dispatcher
    const cycle = async () => {
      if (!active) return;
      if (typeof document !== "undefined" && document.hidden) {
        clearScheduled();
        return;
      }
      if (inFlight) return;
      inFlight = true;
      clearScheduled();

      const state = usePlayerStore.getState();
      const syncId = getGuestSyncId();

      try {
        const requestHeaders: Record<string, string> = {
          "content-type": "application/json",
          "x-sangeet-sync-id": syncId,
        };

        const prevPut = lastPutStateRef.current;
        const stateChanged =
          prevPut.currentTrackId !== state.currentTrackId ||
          prevPut.isPlaying !== state.isPlaying ||
          Math.abs(prevPut.volume - state.volume) > 0.005;
        const now = Date.now();
        const shouldPut = stateChanged || now - lastPutAtRef.current >= 15_000;

        if (shouldPut) {
          const track = describeTrack();
          const type = getDeviceType();
          const name = getDeviceName();

          lastPutStateRef.current = {
            currentTrackId: state.currentTrackId,
            isPlaying: state.isPlaying,
            volume: state.volume,
          };
          lastPutAtRef.current = now;

          // Send Heartbeat (PUT) - server authenticates via HttpOnly session cookie or x-sangeet-sync-id
          await fetch("/api/devices", {
            method: "PUT",
            headers: requestHeaders,
            body: JSON.stringify({
              deviceId,
              name,
              type,
              isPlaying: state.isPlaying,
              currentTime: state.currentTime,
              volume: state.volume,
              track,
            }),
          });
        }

        // Pull active commands (GET)
        const ackParam = lastAckRef.current ? `&ack=${encodeURIComponent(lastAckRef.current)}` : "";
        lastAckRef.current = null;

        const response = await fetch(
          `/api/devices?deviceId=${encodeURIComponent(deviceId)}${ackParam}`,
          {
            cache: "no-store",
            headers: requestHeaders,
          },
        );

        if (!response.ok) return;
        const data = (await response.json()) as {
          devices?: Array<{
            deviceId: string;
            isPlaying: boolean;
            currentTime: number;
            track:
              | {
                  source: "youtube";
                  videoId: string;
                  title: string;
                  artist: string;
                  album: string;
                  artwork: string;
                  duration: number;
                }
              | {
                  source: "audius";
                  trackId: string;
                  title: string;
                  artist: string;
                  album: string;
                  artwork: string;
                  duration: number;
                }
              | null;
          }>;
          command?: {
            id?: string;
            value?: {
              action?: string;
              sentAt?: string;
              currentTime?: number;
              volume?: number;
              track?:
                | {
                    source: "youtube";
                    videoId: string;
                    title: string;
                    artist: string;
                    album: string;
                    artwork: string;
                    duration: number;
                  }
                | {
                    source: "audius";
                    trackId: string;
                    title: string;
                    artist: string;
                    album: string;
                    artwork: string;
                    duration: number;
                  };
            };
          } | null;
        };

        if (Array.isArray(data.devices)) {
          knownDeviceCountRef.current = data.devices.length;
        }

        const command = data.command;
        if (command?.id && window.localStorage.getItem(`sangeet-cmd-${deviceId}`) !== command.id) {
          window.localStorage.setItem(`sangeet-cmd-${deviceId}`, command.id);
          lastAckRef.current = command.id;

          const value = command.value;
          if (!value?.sentAt || Date.now() - Date.parse(value.sentAt) <= 60_000) {
            const action = value?.action;
            const player = usePlayerStore.getState();

            if (action === "pause") {
              if (player.isPlaying) player.togglePlay();
            } else if (action === "next") {
              player.next();
            } else if (action === "previous") {
              player.previous();
            } else if (action === "seek" && Number.isFinite(value?.currentTime)) {
              player.seek(Number(value?.currentTime));
            } else if (action === "volume" && Number.isFinite(value?.volume)) {
              player.setVolume(Number(value?.volume));
            } else if (action === "play") {
              if (value?.track) {
                const metadata = value.track;
                const restored =
                  metadata.source === "youtube"
                    ? restoreYouTubeTrack({
                        videoId: metadata.videoId,
                        title: metadata.title,
                        artist: metadata.artist,
                        album: metadata.album,
                        thumbnail: metadata.artwork,
                        durationSeconds: metadata.duration,
                      })
                    : restoreAudiusTrack({
                        id: metadata.trackId,
                        title: metadata.title,
                        artist: metadata.artist,
                        album: metadata.album,
                        artwork: metadata.artwork,
                        durationSeconds: metadata.duration,
                      });
                if (restored) {
                  player.playTrack(restored.id, [restored.id], "Playing on this device");
                  if ((value.currentTime ?? 0) > 0) {
                    const targetSec = value.currentTime ?? 0;
                    window.setTimeout(() => usePlayerStore.getState().seek(targetSec), 1500);
                  }
                }
              } else if (!player.isPlaying) {
                player.togglePlay();
              }
            }
          }
          return;
        }

        // Group Listen (Jam Together): mirror active host device if enabled
        if (isGroupListenEnabled() && Array.isArray(data.devices)) {
          const host = data.devices.find(
            (d) => d.deviceId !== deviceId && d.isPlaying && d.track,
          );
          if (host?.track) {
            const player = usePlayerStore.getState();
            const current = player.currentTrackId ? getTrack(player.currentTrackId) : undefined;
            const sameTrack =
              host.track.source === "youtube"
                ? current?.youtubeId === host.track.videoId
                : current?.id === `aud-${host.track.trackId}`;

            if (!sameTrack) {
              const restored =
                host.track.source === "youtube"
                  ? restoreYouTubeTrack({
                      videoId: host.track.videoId,
                      title: host.track.title,
                      artist: host.track.artist,
                      album: host.track.album,
                      thumbnail: host.track.artwork,
                      durationSeconds: host.track.duration,
                    })
                  : restoreAudiusTrack({
                      id: host.track.trackId,
                      title: host.track.title,
                      artist: host.track.artist,
                      album: host.track.album,
                      artwork: host.track.artwork,
                      durationSeconds: host.track.duration,
                    });
              if (restored) {
                player.playTrack(restored.id, [restored.id], "Group Listen");
                if (host.currentTime > 2) {
                  const targetSec = host.currentTime;
                  window.setTimeout(() => usePlayerStore.getState().seek(targetSec), 1600);
                }
              }
            } else {
              if (!player.isPlaying) {
                player.togglePlay();
              }
              if (Math.abs(player.currentTime - host.currentTime) > 5) {
                player.seek(host.currentTime);
              }
            }
          }
        }
      } catch {
        // Best-effort network recovery
      } finally {
        inFlight = false;
        scheduleNext();
      }
    };

    const handleVisibilityChange = () => {
      if (!active) return;
      if (document.hidden) {
        clearScheduled();
      } else {
        void cycle();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    const unsubscribePlayer = usePlayerStore.subscribe((state, prevState) => {
      if (!active || (typeof document !== "undefined" && document.hidden)) return;
      const changed =
        state.currentTrackId !== prevState.currentTrackId ||
        state.isPlaying !== prevState.isPlaying ||
        Math.abs(state.volume - prevState.volume) > 0.02;
      if (!changed) return;

      if (stateChangeTimer !== null) {
        window.clearTimeout(stateChangeTimer);
      }
      stateChangeTimer = window.setTimeout(() => {
        stateChangeTimer = null;
        if (active && !document.hidden) {
          void cycle();
        }
      }, 200);
    });

    if (typeof document === "undefined" || !document.hidden) {
      void cycle();
    }

    return () => {
      active = false;
      clearScheduled();
      if (stateChangeTimer !== null) {
        window.clearTimeout(stateChangeTimer);
      }
      unsubscribePlayer();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      if (broadcast) {
        broadcast.close();
      }
    };
  }, [authenticated]);

  return null;
}
