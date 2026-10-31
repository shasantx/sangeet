"use client";

import { usePathname } from "next/navigation";
import { getTrack } from "@/lib/catalog";
import { usePlayerStore } from "@/store/player-store";

/** The embedded source player lives in the full player page, never in a floating window. */
export function YouTubeDock() {
  const pathname = usePathname();
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const current = currentTrackId ? getTrack(currentTrackId) : undefined;

  if (pathname !== "/now-playing" || !current?.youtubeId) return null;

  return (
    <section className="mx-auto w-full max-w-[920px] px-5 pb-10 sm:px-8" aria-label="Music player">
      <div className="overflow-hidden rounded-2xl border border-white/[.08] bg-black shadow-2xl">
        <div className="aspect-video w-full">
          <div id="aura-youtube-frame" className="h-full w-full" />
        </div>
      </div>
    </section>
  );
}
