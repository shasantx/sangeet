"use client";

import Link from "next/link";
import { Heart, Pause, Play, SkipForward } from "lucide-react";
import { getArtist, getTrack } from "@/lib/catalog";
import { usePlayerStore } from "@/store/player-store";
import { useLibraryStore } from "@/store/library-store";
import { Artwork } from "@/components/music/artwork";
import { toast } from "@/store/ui-store";

export function MobileMiniPlayer() {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const next = usePlayerStore((state) => state.next);

  const isLiked = useLibraryStore((state) => (currentTrackId ? state.isLiked(currentTrackId) : false));
  const toggleLike = useLibraryStore((state) => state.toggleLike);

  const current = currentTrackId ? getTrack(currentTrackId) : undefined;
  const artist = current ? getArtist(current.artistId) : undefined;
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  if (!current) return null;

  const handleToggleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentTrackId) return;
    const nextState = toggleLike(currentTrackId);
    toast.success(
      nextState ? "Added to Liked Songs" : "Removed from Liked Songs",
      current.title,
    );
  };

  return (
    <aside
      className="mobile-mini-player fixed inset-x-2.5 sm:inset-x-4 z-40 overflow-hidden rounded-2xl border border-white/[0.12] bg-[#121613]/95 shadow-[0_14px_36px_rgba(0,0,0,0.65)] backdrop-blur-2xl md:hidden pointer-events-auto transition-all duration-300"
      style={{ bottom: "calc(62px + env(safe-area-inset-bottom))" }}
      aria-label="Mini music player"
    >
      {/* Top Hairline Progress Bar */}
      <div className="absolute inset-x-0 top-0 h-[2.5px] bg-white/[0.08]">
        <div
          className="h-full bg-gradient-to-r from-[#1ed760] to-[#34d399] transition-[width] duration-300 ease-linear shadow-[0_0_8px_#1ed760]"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex h-[60px] items-center gap-3 px-3 py-1.5">
        {/* Artwork & Track Info (Tappable to expand now playing) */}
        <Link
          href="/now-playing"
          className="flex min-w-0 flex-1 items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760] rounded-lg"
          aria-label={`Open now playing: ${current.title} by ${artist?.name ?? "Sangeet artist"}`}
        >
          <div className="relative aspect-square h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#161a17] shadow-md">
            <Artwork
              src={current.artwork}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[13px] font-bold tracking-tight text-white leading-snug">
              {current.title}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-[#9ba39d]">
              {isPlaying && (
                <span className="flex items-end gap-0.5 h-2.5 shrink-0" aria-hidden="true">
                  <span className="w-0.5 h-full rounded-full bg-[#1ed760] animate-pulse" />
                  <span className="w-0.5 h-1.5 rounded-full bg-[#1ed760] animate-pulse delay-75" />
                  <span className="w-0.5 h-2 rounded-full bg-[#1ed760] animate-pulse delay-150" />
                </span>
              )}
              <span className="truncate">{artist?.name ?? "Sangeet artist"}</span>
            </div>
          </div>
        </Link>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Like / Favorite Button */}
          <button
            type="button"
            onClick={handleToggleLike}
            aria-label={isLiked ? "Unlike" : "Like"}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:text-white transition active:scale-90"
          >
            <Heart
              className={`h-4 w-4 transition ${
                isLiked ? "fill-[#1ed760] text-[#1ed760]" : "text-white/60"
              }`}
            />
          </button>

          {/* Clean White Circular Play/Pause Button */}
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-md hover:scale-105 active:scale-95 transition"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 fill-current" strokeWidth={0} />
            ) : (
              <Play className="ml-0.5 h-4 w-4 fill-current" strokeWidth={0} />
            )}
          </button>

          {/* Next Button */}
          <button
            type="button"
            onClick={() => next()}
            aria-label="Next track"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#9ba39d] hover:text-white transition active:scale-90"
          >
            <SkipForward className="h-4 w-4 fill-current" strokeWidth={1} />
          </button>
        </div>
      </div>
    </aside>
  );
}
