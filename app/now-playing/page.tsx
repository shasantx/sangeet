"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Disc3,
  Download,
  ListMusic,
  Loader2,
  Mic2,
  MoreHorizontal,
  Music2,
  Plus,
  Radio,
  RotateCcw,
  RotateCw,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { getAlbum, getArtist, getTrack, tracks } from "@/lib/catalog";
import {
  canDownloadOffline,
  isOfflineAvailable,
  removeOfflineTrack,
  saveTrackOffline,
  subscribeOfflineChanges,
} from "@/lib/offline-audio";
import { cn, formatDuration } from "@/lib/utils";
import type { Track } from "@/lib/types";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { useUIStore, toast } from "@/store/ui-store";
import { Artwork } from "@/components/music/artwork";
import { LikeButton } from "@/components/music/like-button";
import { PlaybackControls } from "@/components/player/playback-controls";
import { ProgressBar } from "@/components/player/progress-bar";
import { VolumeControl } from "@/components/player/volume-control";
import { EqualizerMenu } from "@/components/player/equalizer-menu";
import { LyricsView } from "@/components/player/lyrics-view";
import { SleepTimerMenu } from "@/components/player/sleep-timer-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function QueueTrackRow({
  track,
  active,
  onClick,
}: {
  track: Track;
  active?: boolean;
  onClick: () => void;
}) {
  const artist = getArtist(track.artistId);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
        active
          ? "border-white/[0.12] bg-elevated"
          : "border-transparent hover:bg-white/[0.05]",
      )}
    >
      <Artwork
        src={track.artwork}
        alt=""
        res="sm"
        className="h-10 w-10 shrink-0 rounded-lg border border-white/10 shadow-sm"
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-xs font-semibold",
            active ? "text-primary" : "text-foreground group-hover:text-primary",
          )}
        >
          {track.title}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {artist?.name ?? "Unknown artist"}
        </p>
      </div>
      {active ? (
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          Playing
        </span>
      ) : (
        <span className="shrink-0 font-sans text-[11px] tabular-nums text-muted-foreground">
          {formatDuration(track.duration)}
        </span>
      )}
    </button>
  );
}

export default function NowPlayingPage() {
  const router = useRouter();
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const queue = usePlayerStore((state) => state.queue);
  const queueIndex = usePlayerStore((state) => state.queueIndex);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const playQueueIndex = usePlayerStore((state) => state.playQueueIndex);
  const nextTrack = usePlayerStore((state) => state.next);
  const previousTrack = usePlayerStore((state) => state.previous);
  const seek = usePlayerStore((state) => state.seek);

  const current = currentTrackId ? getTrack(currentTrackId) : undefined;
  const artist = current ? getArtist(current.artistId) : undefined;
  const album = current ? getAlbum(current.albumId) : undefined;

  const followedArtistIds = useLibraryStore((state) => state.followedArtistIds);
  const toggleFollow = useLibraryStore((state) => state.toggleFollowArtist);
  const openAddToPlaylist = useUIStore((state) => state.openAddToPlaylist);
  const toggleQueue = useUIStore((state) => state.toggleQueuePanel);
  const followed = Boolean(artist && followedArtistIds.includes(artist.id));

  const [activeTab, setActiveTab] = useState<"lyrics" | "queue" | "related" | "artist">("lyrics");
  const [mobileMode, setMobileMode] = useState<"player" | "lyrics" | "queue">("player");

  // YouTube-style double-tap seek (-10s / +10s) & Spotify-style swipe gestures
  const [seekBurst, setSeekBurst] = useState<{ side: "left" | "right"; seconds: number; key: number } | null>(null);
  const [dismissOffsetY, setDismissOffsetY] = useState(0);
  const [isDismissDragging, setIsDismissDragging] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [artOffsetX, setArtOffsetX] = useState(0);
  const [isArtDragging, setIsArtDragging] = useState(false);

  const lastTapRef = useRef<{ time: number; side: "left" | "right" }>({ time: 0, side: "left" });
  const lastTouchSeekTimeRef = useRef(0);
  const seekClearTimerRef = useRef<number | null>(null);
  const dismissTimerRef = useRef<number | null>(null);
  const touchDragResetTimerRef = useRef<number | null>(null);

  const touchDraggedRef = useRef(false);
  const dragDistanceRef = useRef<{ dx: number; dy: number; distance: number }>({
    dx: 0,
    dy: 0,
    distance: 0,
  });
  const gestureRef = useRef<{
    x: number;
    y: number;
    startTime: number;
    mode: "none" | "dismiss" | "art";
    source: "header" | "deck";
    canDismiss: boolean;
    ignoreDeckTransform: boolean;
  } | null>(null);

  const dismissToHome = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/home");
    }
  }, [router]);

  const scheduleTouchDraggedReset = useCallback(() => {
    if (touchDragResetTimerRef.current) {
      window.clearTimeout(touchDragResetTimerRef.current);
    }
    touchDragResetTimerRef.current = window.setTimeout(() => {
      touchDraggedRef.current = false;
      touchDragResetTimerRef.current = null;
    }, 150);
  }, []);

  const triggerSheetDismiss = useCallback(() => {
    if (isDismissing) return;
    setIsDismissing(true);
    setIsDismissDragging(false);
    setIsArtDragging(false);
    setArtOffsetX(0);
    const exitY = typeof window !== "undefined" ? Math.max(window.innerHeight, 640) : 720;
    setDismissOffsetY(exitY);
    if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = window.setTimeout(() => {
      dismissToHome();
    }, 190);
  }, [dismissToHome, isDismissing]);

  const triggerDoubleTapSeek = useCallback(
    (side: "left" | "right", stepSeconds = 10) => {
      const state = usePlayerStore.getState();
      const delta = side === "left" ? -stepSeconds : stepSeconds;
      const target = Math.max(
        0,
        Math.min(state.duration || state.currentTime + stepSeconds, state.currentTime + delta),
      );
      seek(target);

      setSeekBurst((prev) => {
        const stacked = prev && prev.side === side ? prev.seconds + stepSeconds : stepSeconds;
        return { side, seconds: stacked, key: Date.now() };
      });
      if (seekClearTimerRef.current) window.clearTimeout(seekClearTimerRef.current);
      seekClearTimerRef.current = window.setTimeout(() => setSeekBurst(null), 850);
    },
    [seek],
  );

  useEffect(() => {
    return () => {
      if (seekClearTimerRef.current) window.clearTimeout(seekClearTimerRef.current);
      if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
      if (touchDragResetTimerRef.current) window.clearTimeout(touchDragResetTimerRef.current);
    };
  }, []);

  const handleGestureClickCapture = useCallback((e: React.MouseEvent) => {
    if (!(e.target instanceof Node) || !e.currentTarget.contains(e.target)) return;
    if (touchDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const handleArtworkTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];
    const drag = gestureRef.current;
    const endDx = touch && drag ? touch.clientX - drag.x : dragDistanceRef.current.dx;
    const endDy = touch && drag ? touch.clientY - drag.y : dragDistanceRef.current.dy;
    const totalDragDist = Math.max(dragDistanceRef.current.distance, Math.hypot(endDx, endDy));

    // Only count as tap if user wasn't dragging/swiping
    if (
      touchDraggedRef.current ||
      totalDragDist > 10 ||
      artOffsetX !== 0 ||
      dismissOffsetY !== 0 ||
      (drag && drag.mode !== "none")
    ) {
      lastTapRef.current = { time: 0, side: "left" };
      return;
    }

    if (!touch) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const side: "left" | "right" = touch.clientX - rect.left < rect.width / 2 ? "left" : "right";
    const now = Date.now();
    if (now - lastTapRef.current.time < 340 && lastTapRef.current.side === side) {
      lastTouchSeekTimeRef.current = now;
      triggerDoubleTapSeek(side, 10);
      lastTapRef.current = { time: now, side };
    } else {
      lastTapRef.current = { time: now, side };
    }
  };

  const handleArtworkDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (touchDraggedRef.current || Date.now() - lastTouchSeekTimeRef.current < 450) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const side: "left" | "right" = e.clientX - rect.left < rect.width / 2 ? "left" : "right";
    triggerDoubleTapSeek(side, 10);
  };

  const handleHeaderTouchStart = (e: React.TouchEvent) => {
    if (isDismissing) return;
    if (!(e.target instanceof Node) || !e.currentTarget.contains(e.target)) return;
    if (e.touches.length !== 1) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, [role='slider']")) return;
    const touch = e.touches[0];
    if (!touch) return;

    if (touchDragResetTimerRef.current) {
      window.clearTimeout(touchDragResetTimerRef.current);
      touchDragResetTimerRef.current = null;
    }
    touchDraggedRef.current = false;
    dragDistanceRef.current = { dx: 0, dy: 0, distance: 0 };
    gestureRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      startTime: Date.now(),
      mode: "none",
      source: "header",
      canDismiss: true,
      ignoreDeckTransform: false,
    };
  };

  const handleHeaderTouchMove = (e: React.TouchEvent) => {
    const drag = gestureRef.current;
    const touch = e.touches[0];
    if (!drag || !touch || drag.source !== "header" || isDismissing) return;

    const dx = touch.clientX - drag.x;
    const dy = touch.clientY - drag.y;
    const dist = Math.hypot(dx, dy);
    dragDistanceRef.current = {
      dx,
      dy,
      distance: Math.max(dragDistanceRef.current.distance, dist),
    };
    if (dragDistanceRef.current.distance > 10) {
      touchDraggedRef.current = true;
    }

    if (drag.mode === "none") {
      if (dy > 8 && dy > Math.abs(dx) * 1.15) {
        drag.mode = "dismiss";
        setIsDismissDragging(true);
      } else if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
        return;
      }
    }

    if (drag.mode === "dismiss") {
      setDismissOffsetY(Math.max(0, dy));
    }
  };

  const handleHeaderTouchEnd = (e: React.TouchEvent) => {
    const drag = gestureRef.current;
    if (!drag || drag.source !== "header") return;

    const touch = e.changedTouches[0];
    const dx = touch ? touch.clientX - drag.x : dragDistanceRef.current.dx;
    const dy = touch ? touch.clientY - drag.y : dragDistanceRef.current.dy;
    const dist = Math.max(dragDistanceRef.current.distance, Math.hypot(dx, dy));
    if (dist > 10) {
      touchDraggedRef.current = true;
    }

    const elapsedMs = Math.max(1, Date.now() - drag.startTime);
    const currentOffsetY = drag.mode === "dismiss" ? Math.max(0, dy) : 0;
    const isQuickFlick = dy > 36 && dy / elapsedMs > 0.45 && dy > Math.abs(dx) * 1.15;

    gestureRef.current = null;
    setIsDismissDragging(false);
    scheduleTouchDraggedReset();

    if ((drag.mode === "dismiss" && currentOffsetY > 85) || isQuickFlick) {
      triggerSheetDismiss();
      return;
    }

    setDismissOffsetY(0);
  };

  const handleHeaderTouchCancel = () => {
    if (gestureRef.current?.source === "header") {
      gestureRef.current = null;
    }
    setIsDismissDragging(false);
    setDismissOffsetY(0);
    scheduleTouchDraggedReset();
  };

  const handleDeckTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isDismissing) return;
    if (!(e.target instanceof Node) || !e.currentTarget.contains(e.target)) return;
    if (e.touches.length !== 1) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, [role='slider']")) return;
    const touch = e.touches[0];
    if (!touch) return;

    if (touchDragResetTimerRef.current) {
      window.clearTimeout(touchDragResetTimerRef.current);
      touchDragResetTimerRef.current = null;
    }
    touchDraggedRef.current = false;
    dragDistanceRef.current = { dx: 0, dy: 0, distance: 0 };

    const ignoreDeckTransform = Boolean(target?.closest("button, a"));
    const atTopOfPage = typeof window === "undefined" || window.scrollY <= 4;
    gestureRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      startTime: Date.now(),
      mode: "none",
      source: "deck",
      canDismiss: !ignoreDeckTransform && atTopOfPage,
      ignoreDeckTransform,
    };
  };

  const handleDeckTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const drag = gestureRef.current;
    const touch = e.touches[0];
    if (!drag || !touch || drag.source !== "deck" || isDismissing) return;

    const dx = touch.clientX - drag.x;
    const dy = touch.clientY - drag.y;
    const dist = Math.hypot(dx, dy);
    dragDistanceRef.current = {
      dx,
      dy,
      distance: Math.max(dragDistanceRef.current.distance, dist),
    };
    if (dragDistanceRef.current.distance > 10) {
      touchDraggedRef.current = true;
    }

    if (drag.ignoreDeckTransform) return;

    if (drag.mode === "none") {
      const atTopOfPage = typeof window === "undefined" || window.scrollY <= 4;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        drag.mode = "art";
        setIsArtDragging(true);
      } else if (dy > 8 && dy > Math.abs(dx) * 1.15 && drag.canDismiss && atTopOfPage) {
        drag.mode = "dismiss";
        setIsDismissDragging(true);
      }
    }

    if (drag.mode === "art") {
      setArtOffsetX(Math.max(-140, Math.min(140, dx)));
    } else if (drag.mode === "dismiss") {
      setDismissOffsetY(Math.max(0, dy));
    }
  };

  const handleDeckTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const drag = gestureRef.current;
    if (!drag || drag.source !== "deck") return;

    const touch = e.changedTouches[0];
    const dx = touch ? touch.clientX - drag.x : dragDistanceRef.current.dx;
    const dy = touch ? touch.clientY - drag.y : dragDistanceRef.current.dy;
    const dist = Math.max(dragDistanceRef.current.distance, Math.hypot(dx, dy));
    if (dist > 10) {
      touchDraggedRef.current = true;
    }

    const elapsedMs = Math.max(1, Date.now() - drag.startTime);
    gestureRef.current = null;
    scheduleTouchDraggedReset();

    if (drag.ignoreDeckTransform) {
      setIsArtDragging(false);
      setIsDismissDragging(false);
      return;
    }

    if (drag.mode === "art") {
      const isHorizontalFlick =
        Math.abs(dx) > 36 && Math.abs(dx) / elapsedMs > 0.45 && Math.abs(dx) > Math.abs(dy) * 1.15;
      if (dx < -64 || (dx < 0 && isHorizontalFlick)) {
        nextTrack();
      } else if (dx > 64 || (dx > 0 && isHorizontalFlick)) {
        previousTrack();
      }
      setIsArtDragging(false);
      setArtOffsetX(0);
      return;
    }

    const atTopOfPage = typeof window === "undefined" || window.scrollY <= 4;
    const isQuickFlick =
      drag.canDismiss &&
      atTopOfPage &&
      dy > 36 &&
      dy / elapsedMs > 0.45 &&
      dy > Math.abs(dx) * 1.15;
    const currentOffsetY = drag.mode === "dismiss" ? Math.max(0, dy) : 0;

    setIsArtDragging(false);
    setIsDismissDragging(false);

    if ((drag.mode === "dismiss" && currentOffsetY > 85) || isQuickFlick) {
      setArtOffsetX(0);
      triggerSheetDismiss();
      return;
    }

    setArtOffsetX(0);
    setDismissOffsetY(0);
  };

  const handleDeckTouchCancel = () => {
    if (gestureRef.current?.source === "deck") {
      gestureRef.current = null;
    }
    setIsArtDragging(false);
    setIsDismissDragging(false);
    setArtOffsetX(0);
    setDismissOffsetY(0);
    scheduleTouchDraggedReset();
  };

  const [mounted, setMounted] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [offlinePct, setOfflinePct] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const downloadable = mounted && current ? canDownloadOffline(current) : false;

  useEffect(() => {
    if (!current || !downloadable) {
      setOfflineSaved(false);
      return;
    }
    let active = true;
    const sync = () => {
      void isOfflineAvailable(current.id)
        .then((available) => {
          if (active) setOfflineSaved(available);
        })
        .catch(() => undefined);
    };
    sync();
    const unsub = subscribeOfflineChanges(sync);
    return () => {
      active = false;
      unsub();
    };
  }, [current, downloadable]);

  const handleToggleOffline = async () => {
    if (!current || !downloadable || offlineBusy) return;
    setOfflineBusy(true);
    setOfflinePct(null);
    try {
      if (offlineSaved) {
        await removeOfflineTrack(current.id);
        setOfflineSaved(false);
        toast.show("Removed offline copy", current.title, "default");
      } else {
        await saveTrackOffline(current, artist?.name ?? "Sangeet", (pct) => {
          setOfflinePct(pct);
        });
        setOfflineSaved(true);
        toast.success("Saved for offline listening", current.title);
      }
    } catch (error) {
      toast.error(
        "Offline download failed",
        error instanceof Error ? error.message : "Try again when online.",
      );
    } finally {
      setOfflineBusy(false);
      setOfflinePct(null);
    }
  };

  const upcoming = useMemo(() => {
    return queue
      .slice(queueIndex + 1)
      .map((id) => getTrack(id))
      .filter((track): track is Track => Boolean(track));
  }, [queue, queueIndex]);

  const relatedTracks = useMemo(() => {
    if (!current) return [];
    return tracks
      .filter(
        (track) =>
          track.id !== current.id &&
          (track.artistId === current.artistId ||
            track.genreIds.some((genre) => current.genreIds.includes(genre))),
      )
      .slice(0, 8);
  }, [current]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied", "The now playing link is on your clipboard.");
    } catch {
      toast.error("Could not copy link", "Your browser blocked clipboard access.");
    }
  };

  const dismissProgress = Math.min(1, Math.max(0, dismissOffsetY / 300));
  const sheetStyle: CSSProperties = isDismissing
    ? {
        transform: `translate3d(0, ${dismissOffsetY}px, 0) scale(0.96)`,
        opacity: 0,
        transition: "transform 200ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease-out",
        willChange: "transform, opacity",
      }
    : dismissOffsetY > 0 || isDismissDragging
      ? {
          transform: `translate3d(0, ${dismissOffsetY}px, 0) scale(${1 - dismissProgress * 0.04})`,
          opacity: 1 - dismissProgress * 0.45,
          transition: isDismissDragging
            ? "none"
            : "transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease-out",
          willChange: "transform, opacity",
        }
      : {
          transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease-out",
        };

  const artworkStyle: CSSProperties =
    artOffsetX !== 0 || isArtDragging
      ? {
          transform: `translate3d(${artOffsetX}px, 0, 0) rotate(${artOffsetX * 0.035}deg)`,
          transition: isArtDragging ? "none" : "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: "transform",
        }
      : {
          transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
        };

  return (
    <div
      className="flex h-dvh max-h-dvh w-full max-w-full select-none flex-col overflow-x-clip overflow-y-hidden overscroll-y-contain bg-background pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] text-foreground"
      style={sheetStyle}
    >
      {/* Mobile swipe-down pull handle */}
      <div
        onTouchStart={handleHeaderTouchStart}
        onTouchMove={handleHeaderTouchMove}
        onTouchEnd={handleHeaderTouchEnd}
        onTouchCancel={handleHeaderTouchCancel}
        className="flex shrink-0 touch-none items-center justify-center pt-1.5 pb-0.5 lg:hidden"
        aria-hidden="true"
      >
        <span className="h-1 w-10 rounded-full bg-white/25" />
      </div>

      {/* Background ambient lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_75%_55%_at_50%_0%,hsl(var(--primary)/0.12),transparent_72%)]"
      />
      {current?.artwork && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[55dvh] opacity-20 blur-[90px] saturate-150 transition-opacity duration-700"
          style={{
            backgroundImage: `url(${current.artwork})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}

      {/* Top Header (Swipe down to dismiss) */}
      <header
        onTouchStart={handleHeaderTouchStart}
        onTouchMove={handleHeaderTouchMove}
        onTouchEnd={handleHeaderTouchEnd}
        onTouchCancel={handleHeaderTouchCancel}
        onClickCapture={handleGestureClickCapture}
        className="flex min-h-14 w-full max-w-full shrink-0 touch-none items-center justify-between gap-1 border-b border-white/[0.08] bg-background/85 px-2 py-1.5 backdrop-blur-md sm:h-16 sm:gap-2 sm:px-6 sm:py-0 lg:px-8"
      >
        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/home"
            className="flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/[0.08] bg-elevated text-xs font-medium text-foreground/85 transition hover:bg-elevated/80 hover:text-foreground min-[390px]:h-10 min-[390px]:w-10 sm:h-9 sm:w-auto sm:justify-start sm:px-3.5"
            aria-label="Back to home"
          >
            <ChevronDown className="h-4 w-4 sm:hidden" />
            <ArrowLeft className="hidden h-3.5 w-3.5 sm:inline" />
            <span className="hidden sm:inline">Back</span>
          </Link>

          <div className="hidden min-w-0 sm:block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Now Playing
            </span>
            <p className="truncate text-xs text-muted-foreground">
              {current ? `${current.title} · ${artist?.name ?? "Sangeet"}` : "Nothing playing"}
            </p>
          </div>
        </div>

        {/* Center: Mobile 3-Way Switcher */}
        <div className="flex shrink-0 items-center rounded-full border border-white/[0.08] bg-card p-0.5 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMode("player")}
            className={cn(
              "min-h-[32px] rounded-full px-2 py-1 text-[11px] font-semibold transition min-[390px]:min-h-[34px] min-[390px]:px-2.5 sm:min-h-[36px] sm:px-3",
              mobileMode === "player"
                ? "bg-elevated text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Player
          </button>
          <button
            type="button"
            onClick={() => setMobileMode("lyrics")}
            className={cn(
              "min-h-[32px] rounded-full px-2 py-1 text-[11px] font-semibold transition min-[390px]:min-h-[34px] min-[390px]:px-2.5 sm:min-h-[36px] sm:px-3",
              mobileMode === "lyrics"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Lyrics
          </button>
          <button
            type="button"
            onClick={() => setMobileMode("queue")}
            className={cn(
              "min-h-[32px] rounded-full px-2 py-1 text-[11px] font-semibold transition min-[390px]:min-h-[34px] min-[390px]:px-2.5 sm:min-h-[36px] sm:px-3",
              mobileMode === "queue"
                ? "bg-elevated text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Queue
          </button>
        </div>

        {/* Right Header Extras: EQ, Speed/SleepTimer, Offline Download, Share, More */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <EqualizerMenu className="h-9 min-h-[36px] min-w-[36px] border border-white/[0.08] bg-elevated px-1.5 min-[390px]:h-10 min-[390px]:min-w-[40px] min-[390px]:px-2 sm:h-9 sm:min-h-0 sm:min-w-0 sm:px-2.5" />
          <SleepTimerMenu className="h-9 min-h-[36px] min-w-[36px] border border-white/[0.08] bg-elevated px-1.5 min-[390px]:h-10 min-[390px]:min-w-[40px] min-[390px]:px-2 sm:h-9 sm:min-h-0 sm:min-w-0 sm:px-2.5" />

          {current && downloadable && (
            <button
              type="button"
              onClick={() => void handleToggleOffline()}
              disabled={offlineBusy}
              aria-label={offlineSaved ? "Remove offline copy" : "Download for offline listening"}
              title={offlineSaved ? "Saved offline" : "Download for offline"}
              className={cn(
                "hidden min-h-[42px] min-w-[42px] items-center gap-1.5 rounded-full border border-white/[0.08] bg-elevated px-3 text-xs font-semibold transition hover:bg-elevated/80 sm:flex sm:h-9 sm:min-h-0 sm:min-w-0",
                offlineSaved ? "border-primary/40 bg-primary/15 text-primary" : "text-foreground/85",
              )}
            >
              {offlineBusy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {offlinePct !== null && (
                    <span className="font-sans text-[10px] tabular-nums">{offlinePct}%</span>
                  )}
                </>
              ) : offlineSaved ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Offline</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Save</span>
                </>
              )}
            </button>
          )}

          {current && (
            <>
              <button
                type="button"
                onClick={() => void copyLink()}
                aria-label="Copy song link"
                className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-elevated text-foreground/80 transition hover:bg-elevated/80 hover:text-foreground sm:flex"
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="More options"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-elevated text-foreground/80 transition hover:bg-elevated/80 hover:text-foreground min-[390px]:h-10 min-[390px]:w-10 sm:h-9 sm:w-9"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 rounded-2xl border-white/[0.08] bg-popover text-xs"
                >
                  <DropdownMenuItem onSelect={() => openAddToPlaylist(current.id)}>
                    <Plus className="mr-2 h-3.5 w-3.5" /> Add to playlist
                  </DropdownMenuItem>
                  {downloadable && (
                    <DropdownMenuItem
                      disabled={offlineBusy}
                      onSelect={() => void handleToggleOffline()}
                    >
                      {offlineSaved ? (
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                      ) : (
                        <Download className="mr-2 h-3.5 w-3.5" />
                      )}
                      {offlineSaved ? "Remove offline copy" : "Download for offline"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={toggleQueue}>
                    <ListMusic className="mr-2 h-3.5 w-3.5" /> Full queue
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void copyLink()}>
                    <Share2 className="mr-2 h-3.5 w-3.5" /> Share song
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/[0.08]" />
                  {artist && (
                    <DropdownMenuItem
                      onSelect={() => {
                        const next = toggleFollow(artist.id);
                        toast.show(
                          next ? "Following artist" : "Unfollowed artist",
                          artist.name,
                          next ? "success" : "default",
                        );
                      }}
                    >
                      {followed ? "Unfollow artist" : "Follow artist"}
                    </DropdownMenuItem>
                  )}
                  {album && (
                    <DropdownMenuItem onSelect={() => router.push(`/album/${album.id}`)}>
                      <Disc3 className="mr-2 h-3.5 w-3.5" /> View album
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="min-h-0 w-full max-w-full flex-1 overflow-x-clip overflow-y-hidden p-2.5 sm:p-5 lg:p-6">
        {current ? (
          <div className="grid h-full w-full min-w-0 grid-cols-1 items-stretch gap-4 overflow-hidden sm:gap-5 lg:grid-cols-[minmax(330px,400px)_1fr]">
            {/* Left Column: Matte Studio Player Deck (Swipe down to dismiss, swipe art left/right to skip, double-tap left/right for -10s/+10s) */}
            <div
              onTouchStart={handleDeckTouchStart}
              onTouchMove={handleDeckTouchMove}
              onTouchEnd={handleDeckTouchEnd}
              onTouchCancel={handleDeckTouchCancel}
              onClickCapture={handleGestureClickCapture}
              className={cn(
                "relative flex h-full w-full min-w-0 flex-col justify-between overflow-hidden rounded-3xl border border-white/[0.08] bg-card p-3.5 sm:p-5",
                mobileMode !== "player" ? "hidden lg:flex" : "flex",
              )}
            >
              {current.artwork && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-12 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full opacity-20 blur-3xl saturate-150 transition-opacity duration-700"
                  style={{
                    backgroundImage: `url(${current.artwork})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              )}

              {/* Artwork Box + Dynamic Ambient Glow */}
              <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center">
                <div className="relative flex items-center justify-center">
                  {current.artwork && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-5 rounded-3xl opacity-45 blur-2xl saturate-150 transition-all duration-700"
                      style={{
                        backgroundImage: `url(${current.artwork})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    />
                  )}
                  <div
                    onTouchEnd={handleArtworkTouchEnd}
                    onDoubleClick={handleArtworkDoubleClick}
                    className="relative aspect-square w-[min(68vw,31dvh,276px)] shrink-0 cursor-pointer touch-none overflow-hidden rounded-2xl border border-white/[0.14] bg-elevated shadow-[0_24px_56px_rgba(0,0,0,0.72)] sm:w-[min(100%,36dvh,304px)]"
                    style={artworkStyle}
                    title="Double-tap left/right to seek 10s · Swipe left/right for next/previous"
                  >
                    <Artwork
                      key={current.id}
                      src={current.artwork}
                      alt={`${current.title} cover`}
                      res="lg"
                      priority
                      className="h-full w-full object-cover"
                    />

                    {/* YouTube-style Double-Tap Seek Overlay */}
                    {seekBurst && (
                      <div
                        key={seekBurst.key}
                        className={cn(
                          "pointer-events-none absolute inset-y-0 flex w-1/2 flex-col items-center justify-center bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-150",
                          seekBurst.side === "left"
                            ? "left-0 rounded-r-full"
                            : "right-0 rounded-l-full",
                        )}
                      >
                        {seekBurst.side === "left" ? (
                          <RotateCcw className="h-7 w-7 text-white" />
                        ) : (
                          <RotateCw className="h-7 w-7 text-white" />
                        )}
                        <span className="mt-1 font-sans text-xs font-bold tabular-nums text-white">
                          {seekBurst.side === "left" ? `-${seekBurst.seconds}s` : `+${seekBurst.seconds}s`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Song Meta + Offline Download + Like Button Row */}
                <div className="mt-4 flex w-full shrink-0 items-center justify-between gap-2.5 sm:mt-5">
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
                      {current.title}
                    </h1>
                    <Link
                      href={artist ? `/artist/${artist.id}` : "/explore"}
                      className="mt-0.5 block truncate text-sm font-medium text-muted-foreground transition hover:text-foreground hover:underline sm:text-xs"
                    >
                      {artist?.name ?? "Unknown artist"}
                    </Link>
                    {album && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
                        {album.title}
                        {album.year ? ` · ${album.year}` : ""}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {downloadable && (
                      <button
                        type="button"
                        onClick={() => void handleToggleOffline()}
                        disabled={offlineBusy}
                        aria-label={offlineSaved ? "Saved offline" : "Download for offline"}
                        className={cn(
                          "flex h-[42px] min-h-[42px] w-[42px] min-w-[42px] items-center justify-center rounded-full border border-white/[0.08] bg-elevated transition active:scale-95 sm:h-9 sm:min-h-0 sm:w-9 sm:min-w-0",
                          offlineSaved
                            ? "border-primary/45 bg-primary/15 text-primary"
                            : "text-foreground/75 hover:text-foreground",
                        )}
                      >
                        {offlineBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : offlineSaved ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    <LikeButton
                      trackId={current.id}
                      size="md"
                      className="h-[42px] min-h-[42px] w-[42px] min-w-[42px] border border-white/[0.08] bg-elevated text-foreground/80 hover:bg-elevated/80 hover:text-foreground sm:h-9 sm:min-h-0 sm:w-9 sm:min-w-0"
                    />
                  </div>
                </div>
              </div>

              {/* Controls Deck (Includes Shuffle, Prev, Play/Pause, Next, Loop/Repeat) */}
              <div className="relative z-10 mt-2 shrink-0 space-y-3 border-t border-white/[0.08] pt-3 sm:mt-3 sm:space-y-3.5">
                <ProgressBar
                  className="w-full"
                  timeClassName="w-9 shrink-0 text-center font-sans text-[11px] tabular-nums text-muted-foreground"
                />

                <div className="flex items-center justify-center">
                  <PlaybackControls
                    size="large"
                    className="w-full justify-between sm:w-auto sm:justify-center sm:gap-5"
                  />
                </div>

                {/* Mobile Quick Bottom Bar: Lyrics / Queue / Share */}
                <div className="flex items-center justify-around gap-2 pt-0.5 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileMode("lyrics")}
                    aria-label="Open synced lyrics"
                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground transition hover:bg-elevated hover:text-primary active:scale-95"
                  >
                    <Mic2 className="h-4 w-4" />
                    <span>Lyrics</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMobileMode("queue")}
                    aria-label="Open playback queue"
                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground transition hover:bg-elevated hover:text-foreground active:scale-95"
                  >
                    <ListMusic className="h-4 w-4" />
                    <span>Queue</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    aria-label="Share song link"
                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground transition hover:bg-elevated hover:text-foreground active:scale-95"
                  >
                    <Share2 className="h-4 w-4" />
                    <span>Share</span>
                  </button>
                </div>

                {/* Desktop Footer Row */}
                <div className="hidden items-center justify-between pt-1 lg:flex">
                  <span className="font-sans text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {offlineSaved ? "Offline Ready · Local Cache" : "Lossless · 320 kbps"}
                  </span>
                  <div className="w-32">
                    <VolumeControl />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Matte Studio Context Panels */}
            <div
              className={cn(
                "flex h-full w-full min-w-0 flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-card p-3 sm:p-5",
                mobileMode === "player" ? "hidden lg:flex" : "flex",
              )}
            >
              {/* Desktop Segmented Tab Switcher */}
              <div className="hidden shrink-0 items-center justify-between border-b border-white/[0.08] pb-3 lg:flex">
                <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-elevated p-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("lyrics")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                      activeTab === "lyrics"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Mic2 className="h-3.5 w-3.5" />
                    <span>Lyrics</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("queue")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                      activeTab === "queue"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <ListMusic className="h-3.5 w-3.5" />
                    <span>Queue ({upcoming.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("related")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                      activeTab === "related"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Radio className="h-3.5 w-3.5" />
                    <span>Related ({relatedTracks.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("artist")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                      activeTab === "artist"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Artist</span>
                  </button>
                </div>

                <span className="font-sans text-[11px] tabular-nums text-muted-foreground">
                  {activeTab === "lyrics" && "Synced Karaoke"}
                  {activeTab === "queue" && `${upcoming.length + 1} tracks scheduled`}
                  {activeTab === "related" && "Discovery mix"}
                  {activeTab === "artist" && "Artist Bio"}
                </span>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-2 sm:pt-3">
                {(activeTab === "lyrics" || mobileMode === "lyrics") && (
                  <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                    <LyricsView
                      trackTitle={current.title}
                      artistName={artist?.name}
                      videoId={current.youtubeId}
                      duration={current.duration}
                    />
                  </div>
                )}

                {(activeTab === "queue" || mobileMode === "queue") && (
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2 pr-1 sm:pr-2">
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        Currently Playing
                      </p>
                      <QueueTrackRow track={current} active onClick={() => undefined} />
                    </div>

                    <div className="border-t border-white/[0.08] pt-3">
                      <div className="mb-2.5 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                          Next in Session ({upcoming.length})
                        </span>
                        {upcoming.length > 0 && (
                          <span className="text-[10px] text-muted-foreground/80">Click any track to play</span>
                        )}
                      </div>

                      {upcoming.length > 0 ? (
                        <div className="space-y-1">
                          {upcoming.map((track, idx) => (
                            <QueueTrackRow
                              key={`${track.id}-${idx}`}
                              track={track}
                              onClick={() => playQueueIndex(queueIndex + 1 + idx)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-white/[0.08] bg-elevated/60 p-6 text-center text-xs text-muted-foreground">
                          <Music2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
                          <p className="font-semibold text-foreground">Queue is empty</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Pick songs from Search or Explore to schedule them next.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "related" &&
                  mobileMode !== "lyrics" &&
                  mobileMode !== "queue" && (
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        Recommended Based On Current Track
                      </p>
                      {relatedTracks.map((track) => (
                        <QueueTrackRow
                          key={track.id}
                          track={track}
                          onClick={() => playTrack(track.id, [track.id], "Related tracks")}
                        />
                      ))}
                    </div>
                  )}

                {activeTab === "artist" &&
                  mobileMode !== "lyrics" &&
                  mobileMode !== "queue" && (
                    <div className="min-h-0 flex-1 overflow-y-auto pr-2">
                      {artist ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-4">
                            <Artwork
                              src={artist.image}
                              alt=""
                              res="md"
                              className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-white/20 shadow-lg"
                            />
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate font-display text-lg font-bold text-foreground">
                                {artist.name}
                              </h3>
                              <p className="truncate text-xs text-muted-foreground">
                                {artist.location || "Regional Artist"}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = toggleFollow(artist.id);
                                  toast.show(
                                    next ? "Following" : "Unfollowed",
                                    artist.name,
                                    next ? "success" : "default",
                                  );
                                }}
                                className={cn(
                                  "mt-2 rounded-full px-3.5 py-1 text-xs font-semibold transition",
                                  followed
                                    ? "border border-white/[0.14] bg-elevated text-foreground hover:bg-elevated/80"
                                    : "bg-primary text-primary-foreground hover:brightness-110",
                                )}
                              >
                                {followed ? "Following" : "Follow"}
                              </button>
                            </div>
                          </div>

                          <p className="text-xs leading-relaxed text-muted-foreground">{artist.bio}</p>

                          <div>
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-primary">
                              Top Tracks
                            </p>
                            <div className="space-y-1">
                              {tracks
                                .filter((t) => t.artistId === artist.id)
                                .slice(0, 5)
                                .map((track) => (
                                  <QueueTrackRow
                                    key={track.id}
                                    track={track}
                                    onClick={() => playTrack(track.id, [track.id], artist.name)}
                                  />
                                ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No artist information available.
                        </p>
                      )}
                    </div>
                  )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <Music2 className="h-12 w-12 text-muted-foreground/50" />
            <h2 className="mt-4 font-display text-lg font-bold text-foreground">No track is playing</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose any song from Home, Explore, or Search to start listening.
            </p>
            <Link
              href="/home"
              className="mt-4 rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:brightness-110"
            >
              Go to Home
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
