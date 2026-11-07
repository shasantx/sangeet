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
      className="mobile-mini-player fixed inset-x-2 z-50 overflow-hidden rounded-xl border border-white/[.12] md:hidden shadow-2xl backdrop-blur-xl pointer-events-auto"
      style={{ bottom: "calc(70px + env(safe-area-inset-bottom))" }}
    >
      <div className="absolute inset-x-0 top-0 h-[2px] bg-white/[.08]">
        <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex h-[58px] items-center gap-2.5 px-3">
        <Link
          href="/now-playing"
          className="flex min-w-0 flex-1 items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Open now playing: ${current.title} by ${artist?.name ?? "Unknown artist"}`}
        >
          <Artwork src={current.artwork} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold leading-tight text-white">{current.title}</p>
            <p className="mt-0.5 truncate text-[11px] text-[#9ba39d]">{artist?.name ?? "Unknown artist"}</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.1] text-white transition active:scale-95 hover:bg-white/[0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 fill-current" strokeWidth={0} />
          ) : (
            <Play className="ml-0.5 h-4 w-4 fill-current" strokeWidth={0} />
          )}
        </button>
        <button
          type="button"
          onClick={() => next()}
          aria-label="Next track"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#9ba39d] transition active:scale-95 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <SkipForward className="h-4 w-4 fill-current" strokeWidth={1} />
        </button>
      </div>
    </div>
  );
}
