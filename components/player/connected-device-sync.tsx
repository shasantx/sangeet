"use client";

import { useEffect, useRef } from "react";
import { getAlbum, getArtist, getTrack } from "@/lib/catalog";
import { restoreAudiusTrack, restoreYouTubeTrack } from "@/lib/dynamic-tracks";
import { useAuthStore } from "@/store/auth-store";
import { usePlayerStore } from "@/store/player-store";

export const DEVICE_KEY = "sangeet-device-id-v1";
export const GUEST_SYNC_KEY = "sangeet-sync-session-id-v1";
export const CUSTOM_DEVICE_NAME_KEY = "sangeet-custom-device-name-v1";

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
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, "");
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function getGuestSyncId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(GUEST_SYNC_KEY);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    window.localStorage.setItem(GUEST_SYNC_KEY, id);
  }
  return id;
}

export function setGuestSyncId(id: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUEST_SYNC_KEY, id.trim());
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

  useEffect(() => {
    let active = true;
    const deviceId = getDeviceId();
    const guestSyncId = getGuestSyncId();

    // 1. Cross-tab fast local sync via BroadcastChannel
    let broadcast: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        broadcast = new BroadcastChannel("sangeet_device_bus");
        broadcast.onmessage = (event) => {
          if (!active || !event.data) return;
          const { targetId, action, track, currentTime, volume } = event.data;
          if (targetId && targetId !== "all" && targetId !== deviceId) return;

          const player = usePlayerStore.getState();
          if (action === "pause" && player.isPlaying) {
            player.togglePlay();
          } else if (action === "play") {
            if (track) {
              const restored =
                track.source === "youtube"
                  ? restoreYouTubeTrack({
                      videoId: track.videoId,
                      title: track.title,
                      artist: track.artist,
                      album: track.album,
                      thumbnail: track.artwork,
                      durationSeconds: track.duration,
                    })
                  : restoreAudiusTrack({
                      id: track.trackId,
                      title: track.title,
                      artist: track.artist,
                      album: track.album,
                      artwork: track.artwork,
                      durationSeconds: track.duration,
                    });
              if (restored) {
                player.playTrack(restored.id, [restored.id], "Playing on this device");
                if (Number(currentTime) > 0) {
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
            player.seek(Number(currentTime));
          } else if (action === "volume" && Number.isFinite(volume)) {
            player.setVolume(Number(volume));
          }
        };
      }
    } catch {
      // BroadcastChannel optional fallback
    }

    // 2. Server polling heartbeat and command dispatcher
    const cycle = async () => {
      if (!active) return;
      const state = usePlayerStore.getState();
      const syncId = getGuestSyncId();

      try {
        const track = describeTrack();
        const type = getDeviceType();
        const name = getDeviceName();

        const session = useAuthStore.getState().session;
        const requestHeaders: Record<string, string> = {
          "content-type": "application/json",
          "x-sangeet-sync-id": syncId,
        };
        if (session?.userId) {
          requestHeaders["x-sangeet-user-id"] = session.userId;
        }

        // Send Heartbeat (PUT)
        await fetch(`/api/devices?syncId=${encodeURIComponent(syncId)}`, {
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

        // Pull active commands (GET)
        const ackParam = lastAckRef.current ? `&ack=${encodeURIComponent(lastAckRef.current)}` : "";
        lastAckRef.current = null;

        const response = await fetch(
          `/api/devices?deviceId=${encodeURIComponent(deviceId)}&syncId=${encodeURIComponent(syncId)}${ackParam}`,
          {
            cache: "no-store",
            headers: requestHeaders,
          },
        );

        if (!response.ok) return;
        const data = (await response.json()) as {
          command?: {
            id?: string;
            value?: {
              action?: string;
              sentAt?: string;
              currentTime?: number;
              volume?: number;
              track?: {
                source: "youtube";
                videoId: string;
                title: string;
                artist: string;
                album: string;
                artwork: string;
                duration: number;
              } | {
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

        const command = data.command;
        if (!command?.id || window.localStorage.getItem(`sangeet-cmd-${deviceId}`) === command.id) {
          return;
        }

        window.localStorage.setItem(`sangeet-cmd-${deviceId}`, command.id);
        lastAckRef.current = command.id;

        const value = command.value;
        if (value?.sentAt && Date.now() - Date.parse(value.sentAt) > 60_000) return;

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
                window.setTimeout(() => usePlayerStore.getState().seek(value.currentTime ?? 0), 1200);
              }
            }
          } else if (!player.isPlaying) {
            player.togglePlay();
          }
        }
      } catch {
        // Best-effort network recovery
      }
    };

    void cycle();
    // Fast 1.8s polling interval for instant Spotify Connect responsiveness
    const timer = window.setInterval(cycle, 1800);

    return () => {
      active = false;
      window.clearInterval(timer);
      if (broadcast) {
        broadcast.close();
      }
    };
  }, [authenticated]);

  return null;
}
