"use client";

import Link from "next/link";
import { Pause, Play, SkipForward } from "lucide-react";
import { getArtist, getTrack } from "@/lib/catalog";
import { usePlayerStore } from "@/store/player-store";
import { Artwork } from "@/components/music/artwork";
import { ConnectedDevices } from "./connected-devices";

export function MobileMiniPlayer() {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isLoading = usePlayerStore((state) => state.isLoading);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const next = usePlayerStore((state) => state.next);
  const current = currentTrackId ? getTrack(currentTrackId) : undefined;
  const artist = current ? getArtist(current.artistId) : undefined;
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  if (!current) return null;

  return (
    <div
      className="mobile-mini-player fixed inset-x-2 z-40 overflow-hidden rounded-2xl border border-white/[.1] md:hidden"
      style={{ bottom: "calc(80px + env(safe-area-inset-bottom))" }}
    >
      <div className="absolute inset-x-0 top-0 h-[2px] bg-white/[.08]">
        <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex h-[64px] items-center gap-2.5 px-2.5">
        <Link
          href="/now-playing"
          className="flex min-w-0 flex-1 items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Open now playing: ${current.title} by ${artist?.name ?? "Unknown artist"}`}
        >
          <Artwork src={current.artwork} alt="" className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[12.5px] font-medium leading-4 text-foreground">{current.title}</p>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{artist?.name ?? "Unknown artist"}</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {isPlaying ? (
            <Pause className="h-[18px] w-[18px] fill-current" strokeWidth={0} />
          ) : (
            <Play className="ml-0.5 h-[18px] w-[18px] fill-current" strokeWidth={0} />
          )}
        </button>
        <ConnectedDevices />
        <button
          type="button"
          onClick={() => next()}
          aria-label="Next track"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition active:scale-95 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <SkipForward className="h-[18px] w-[18px] fill-current" strokeWidth={1.2} />
        </button>
      </div>
    </div>
  );
}
