"use client";

import { useEffect } from "react";
import { getAlbum, getArtist, getTrack } from "@/lib/catalog";
import { restoreAudiusTrack, restoreYouTubeTrack } from "@/lib/dynamic-tracks";
import { useAuthStore } from "@/store/auth-store";
import { usePlayerStore } from "@/store/player-store";

const DEVICE_KEY = "sangeet-device-id-v1";

function getDeviceId() {
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) { id = crypto.randomUUID().replaceAll("-", ""); window.localStorage.setItem(DEVICE_KEY, id); }
  return id;
}

function getDeviceType() {
  const ua = navigator.userAgent;
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/android|iphone|mobile/i.test(ua)) return "phone";
  return "computer";
}

function describeTrack() {
  const state = usePlayerStore.getState();
  const track = state.currentTrackId ? getTrack(state.currentTrackId) : undefined;
  if (!track) return null;
  const common = { title: track.title, artist: getArtist(track.artistId)?.name ?? "Sangeet artist", album: getAlbum(track.albumId)?.title ?? "", artwork: track.artwork, duration: track.duration };
  if (track.youtubeId) return { ...common, source: "youtube", videoId: track.youtubeId };
  if (track.source === "audius") return { ...common, source: "audius", trackId: track.id.replace(/^aud-/, "") };
  return null;
}

export function ConnectedDeviceSync() {
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    const id = getDeviceId();
    const cycle = async () => {
      if (!active) return;
      const state = usePlayerStore.getState();
      try {
        const track = describeTrack();
        const type = getDeviceType();
        const platform = navigator.platform || "Browser";
        await fetch("/api/devices", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ deviceId: id, name: `${platform} · ${type === "phone" ? "Phone" : type === "tablet" ? "Tablet" : "Computer"}`.slice(0, 48), type, isPlaying: state.isPlaying, currentTime: state.currentTime, track }) });
        const response = await fetch(`/api/devices?deviceId=${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { command?: { id?: string; value?: { action?: string; sentAt?: string; currentTime?: number; track?: { source: "youtube"; videoId: string; title: string; artist: string; album: string; artwork: string; duration: number } | { source: "audius"; trackId: string; title: string; artist: string; album: string; artwork: string; duration: number } } } | null };
        const command = data.command;
        if (!command?.id || window.localStorage.getItem(`sangeet-command-${id}`) === command.id) return;
        window.localStorage.setItem(`sangeet-command-${id}`, command.id);
        const value = command.value;
        if (value?.sentAt && Date.now() - Date.parse(value.sentAt) > 60_000) return;
        const action = value?.action;
        const player = usePlayerStore.getState();
        if (action === "pause") { if (player.isPlaying) player.togglePlay(); }
        else if (action === "next") player.next();
        else if (action === "previous") player.previous();
        else if (action === "play" && value?.track) {
          const metadata = value.track;
          const restored = metadata.source === "youtube"
            ? restoreYouTubeTrack({ videoId: metadata.videoId, title: metadata.title, artist: metadata.artist, album: metadata.album, thumbnail: metadata.artwork, durationSeconds: metadata.duration })
            : restoreAudiusTrack({ id: metadata.trackId, title: metadata.title, artist: metadata.artist, album: metadata.album, artwork: metadata.artwork, durationSeconds: metadata.duration });
          if (restored) {
            player.playTrack(restored.id, [restored.id], "Playing on this device");
            if ((value.currentTime ?? 0) > 0) window.setTimeout(() => usePlayerStore.getState().seek(value.currentTime ?? 0), 2200);
          }
        }
      } catch { /* Device sync is best-effort while the network is unavailable. */ }
    };
    void cycle();
    const timer = window.setInterval(cycle, 8000);
    return () => { active = false; window.clearInterval(timer); };
  }, [authenticated]);
  return null;
}
