"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getTrack } from "@/lib/catalog";
import { registerYouTubeSearchResult } from "@/lib/dynamic-tracks";
import { usePlayerStore } from "@/store/player-store";
import { NowPlayingView } from "@/components/player/now-playing-view";

export default function NowPlayingPage() {
  const router = useRouter();
  const playTrack = usePlayerStore((state) => state.playTrack);
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sharedTrackId = params.get("track")?.trim();
    if (!sharedTrackId || sharedTrackId === currentTrackId) return;

    const existing = getTrack(sharedTrackId);
    if (existing) {
      playTrack(existing.id, [existing.id], "Shared song");
      return;
    }

    if (sharedTrackId.startsWith("yt-") && sharedTrackId.length === 14) {
      const videoId = sharedTrackId.slice(3);
      const title = params.get("title")?.trim() || "YouTube Track";
      const artist = params.get("artist")?.trim() || "YouTube Music";
      const thumbnail = params.get("art")?.trim() || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      const registered = registerYouTubeSearchResult({
        videoId,
        title,
        artist,
        thumbnail,
      });
      playTrack(registered.id, [registered.id], "Shared song");
    }
  }, [currentTrackId, playTrack]);

  return <NowPlayingView onDismiss={() => router.back()} />;
}
