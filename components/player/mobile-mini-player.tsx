"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Pause, Play, SkipForward } from "lucide-react";
import { getArtist, getTrack } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import { useLibraryStore } from "@/store/library-store";
import { Artwork } from "@/components/music/artwork";
import { Equalizer } from "@/components/music/equalizer";
import { toast } from "@/store/ui-store";

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
  const router = useRouter();
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const next = usePlayerStore((state) => state.next);
  const previous = usePlayerStore((state) => state.previous);

  const isLiked = useLibraryStore((state) =>
    currentTrackId ? state.isLiked(currentTrackId) : false,
  );
  const toggleLike = useLibraryStore((state) => state.toggleLike);

  const [dragX, setDragX] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, []);

  const current = currentTrackId ? getTrack(currentTrackId) : undefined;
  const artist = current ? getArtist(current.artistId) : undefined;

  if (!current) return null;

  const scheduleSwipeReset = () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      swipedRef.current = false;
      resetTimerRef.current = null;
    }, 160);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (!touch) return;
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    swipedRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    if (e.touches.length !== 1) return;
    const start = touchStartRef.current;
    const touch = e.touches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      swipedRef.current = true;
    }

    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      setDragX(Math.max(-96, Math.min(96, dx)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    const start = touchStartRef.current;
    const touch = e.changedTouches[0];
    if (start && touch) {
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        swipedRef.current = true;
      }
      if (dy < -42 && Math.abs(dy) > Math.abs(dx) * 1.2) {
        swipedRef.current = true;
        setDragX(0);
        touchStartRef.current = null;
        scheduleSwipeReset();
        router.push("/now-playing");
        return;
      }
      if (dx < -54 && Math.abs(dx) > Math.abs(dy)) {
        swipedRef.current = true;
        next();
      } else if (dx > 54 && Math.abs(dx) > Math.abs(dy)) {
        swipedRef.current = true;
        previous();
      }
    }
    setDragX(0);
    touchStartRef.current = null;
    if (swipedRef.current) {
      scheduleSwipeReset();
    }
  };

  const handleTouchCancel = () => {
    setDragX(0);
    touchStartRef.current = null;
    if (swipedRef.current) {
      scheduleSwipeReset();
    }
  };

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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onClickCapture={(e) => {
        if (swipedRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className="mobile-mini-player pointer-events-auto fixed inset-x-3 z-[41] touch-none select-none overflow-hidden rounded-xl border border-border bg-elevated md:hidden"
      style={{
        bottom: "calc(74px + env(safe-area-inset-bottom))",
        transform: `translate3d(${dragX}px, 0, 0)`,
        transition: dragX !== 0 ? "none" : "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      aria-label="Mini music player"
    >
      <MiniPlayerProgress />

      <div className="flex h-[62px] items-center gap-2 p-0 pr-2">
        <Link
          href="/now-playing"
          draggable={false}
          className="flex h-full min-w-0 flex-1 items-center gap-3 rounded-l-xl outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          aria-label={`Open now playing: ${current.title} by ${artist?.name ?? "Sangeet artist"}`}
        >
          <div className="relative h-[62px] w-[62px] shrink-0 overflow-hidden rounded-none border-r border-border bg-card">
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
        </Link>

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
