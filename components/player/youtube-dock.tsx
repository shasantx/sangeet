"use client";

import { getTrack } from "@/lib/catalog";
import { usePlayerStore } from "@/store/player-store";

/** Keeps the source player available for audio playback without showing video UI. */
export function YouTubeDock() {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const current = currentTrackId ? getTrack(currentTrackId) : undefined;

  if (!current?.youtubeId) return null;

  return (
    <div
      className="fixed -left-[10000px] top-0 h-[200px] w-[200px] overflow-hidden opacity-0 pointer-events-none"
      aria-hidden="true"
    >
      <div id="aura-youtube-frame" className="h-full w-full" />
    </div>
  );
}
