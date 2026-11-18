"use client";

import { Heart, Pause, Play, SkipForward } from "lucide-react";
import { getArtist, getTrack } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import { useLibraryStore } from "@/store/library-store";
import { Artwork } from "@/components/music/artwork";
import { Equalizer } from "@/components/music/equalizer";
import { toast, useUIStore } from "@/store/ui-store";

function MiniPlayerProgress() {
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[2.5px] overflow-hidden bg-border">
      <div
        className="h-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.45)] transition-[width] duration-300 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export function MobileMiniPlayer() {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const next = usePlayerStore((state) => state.next);

  const isLiked = useLibraryStore((state) =>
    currentTrackId ? state.isLiked(currentTrackId) : false,
  );
  const toggleLike = useLibraryStore((state) => state.toggleLike);
  const openNowPlaying = useUIStore((state) => state.openNowPlaying);

  const current = currentTrackId ? getTrack(currentTrackId) : undefined;
  const artist = current ? getArtist(current.artistId) : undefined;

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
      className="mobile-mini-player pointer-events-auto fixed inset-x-3 z-[41] touch-pan-y select-none overflow-hidden rounded-xl border border-border bg-elevated md:hidden"
      style={{ bottom: "calc(var(--mobile-dock-clearance, 74px) + env(safe-area-inset-bottom))" }}
      aria-label="Mini music player"
    >
      <MiniPlayerProgress />

      <div className="flex h-[var(--mini-player-height,62px)] items-center gap-2 p-0 pr-2">
        <button
          type="button"
          onClick={openNowPlaying}
          className="flex h-full min-w-0 flex-1 items-center gap-3 rounded-l-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          aria-label={`Open now playing: ${current.title} by ${artist?.name ?? "Sangeet artist"}`}
        >
          <div className="relative h-[var(--mini-player-height,62px)] w-[var(--mini-player-height,62px)] shrink-0 overflow-hidden rounded-none border-r border-border bg-card">
            <Artwork
              src={current.artwork}
              alt=""
              res="sm"
              priority
              className="h-full w-full rounded-none object-cover"
            />
          </div>

          <div className="min-w-0 flex-1 pr-1">
            <p className="truncate font-display text-[13.5px] font-bold leading-snug tracking-tight text-foreground">
              {current.title}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
              {isPlaying ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-1.5 py-[1px] text-[9.5px] font-semibold text-primary">
                  <Equalizer playing className="h-2.5 w-2.5" />
                </span>
              ) : (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/45" />
              )}
              <span className="truncate">{artist?.name ?? "Sangeet artist"}</span>
            </div>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={handleToggleLike}
            aria-label={isLiked ? "Unlike" : "Like"}
            className="double-tap-none flex h-11 w-11 items-center justify-center rounded-full text-foreground/80 transition hover:bg-card hover:text-foreground active:scale-90"
          >
            <Heart
              className={cn(
                "h-[18px] w-[18px] transition",
                isLiked ? "fill-primary text-primary" : "text-foreground/80",
              )}
            />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="double-tap-none flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_14px_hsl(var(--primary)/0.25)] transition hover:scale-105 active:scale-95"
          >
            {isPlaying ? (
              <Pause className="h-[18px] w-[18px] fill-current" strokeWidth={0} />
            ) : (
              <Play className="ml-0.5 h-[18px] w-[18px] fill-current" strokeWidth={0} />
            )}
          </button>

          <button
            type="button"
            onClick={() => next()}
            aria-label="Next track"
            className="double-tap-none flex h-11 w-11 items-center justify-center rounded-full text-foreground/80 transition hover:bg-card hover:text-foreground active:scale-90"
          >
            <SkipForward className="h-[18px] w-[18px] fill-current" strokeWidth={1} />
          </button>
        </div>
      </div>
    </aside>
  );
}
