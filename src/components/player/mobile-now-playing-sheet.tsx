"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Download,
  Heart,
  ListMusic,
  Loader2,
  Mic2,
  Moon,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2
} from "lucide-react";
import { usePlayerStore } from "@/store/player-store";
import { useLibraryStore } from "@/store/library-store";
import { useLyricsStore } from "@/store/lyrics-store";
import { useOfflineStore } from "@/store/offline-store";
import { useUIStore } from "@/store/ui-store";
import { useToastStore } from "@/store/toast-store";
import { usePlatform } from "@/lib/platform";
import { useClickOutside } from "@/lib/use-click-outside";
import { getActiveLyricIndex } from "@/lib/lyrics-parser";
import { TrackArtwork } from "@/components/music/track-artwork";
import { SangeetLogo } from "@/components/ui/sangeet-logo";
import { cn, formatTime, pickHeroColor } from "@/lib/utils";
import { FormatBadge } from "@/components/player/format-badge";

const SLEEP_OPTIONS = [
  { label: "Off", minutes: null as number | null },
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "45 min", minutes: 45 },
  { label: "60 min", minutes: 60 }
];

type SheetTab = "player" | "lyrics" | "queue";
type DesktopRightTab = "lyrics" | "queue";
type GestureAxis = "none" | "vertical" | "horizontal";
type SwipePhase = "idle" | "exiting" | "entering";

export function MobileNowPlayingSheet() {
  const { isWeb } = usePlatform();
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [tab, setTab] = useState<SheetTab>("player");
  const [desktopRightTab, setDesktopRightTab] =
    useState<DesktopRightTab>("lyrics");
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [isSwipingX, setIsSwipingX] = useState(false);
  const [swipePhase, setSwipePhase] = useState<SwipePhase>("idle");

  const activeLyricRef = useRef<HTMLButtonElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sleepWrapRef = useRef<HTMLDivElement | null>(null);
  const dismissTimerRef = useRef<number | null>(null);
  const swipeTimerRef = useRef<number | null>(null);
  const swipeRafRef = useRef<number | null>(null);
  const gestureAxisRef = useRef<GestureAxis>("none");
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    lastX: 0,
    lastY: 0,
    fromHeader: false,
    canSwipeHorizontal: false,
    innerScrollEl: null as HTMLElement | null
  });

  const lyrics = useLyricsStore((s) => s.lyrics);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const sleepTimerEndsAt = usePlayerStore((s) => s.sleepTimerEndsAt);
  const sleepAtTrackEnd = usePlayerStore((s) => s.sleepAtTrackEnd);

  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const prevTrack = usePlayerStore((s) => s.prevTrack);
  const requestSeek = usePlayerStore((s) => s.requestSeek);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer);
  const setSleepAtTrackEnd = usePlayerStore((s) => s.setSleepAtTrackEnd);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);

  const likedTracks = useLibraryStore((s) => s.likedTracks);
  const toggleLike = useLibraryStore((s) => s.toggleLike);

  const offlineItems = useOfflineStore((s) => s.items);
  const nativeOfflineItems = useOfflineStore((s) => s.nativeItems);
  const activeDownloads = useOfflineStore((s) => s.downloads);
  const downloadTrackOneClick = useOfflineStore((s) => s.downloadTrackOneClick);
  const exportOfflineTrack = useOfflineStore((s) => s.exportOfflineTrack);
  const openDownloadAppModal = useUIStore((s) => s.openDownloadAppModal);
  const showToast = useToastStore((s) => s.showToast);

  const closeSleep = useCallback(() => setSleepMenuOpen(false), []);
  useClickOutside(sleepWrapRef, sleepMenuOpen, closeSleep);

  const clearSwipeTimers = useCallback(() => {
    if (swipeTimerRef.current !== null) {
      window.clearTimeout(swipeTimerRef.current);
      swipeTimerRef.current = null;
    }
    if (swipeRafRef.current !== null) {
      window.cancelAnimationFrame(swipeRafRef.current);
      swipeRafRef.current = null;
    }
  }, []);

  const dismissAnimated = useCallback(() => {
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
    }
    clearSwipeTimers();
    setSleepMenuOpen(false);
    setIsDragging(false);
    setIsSwipingX(false);
    setSwipePhase("idle");
    setSwipeX(0);
    setIsClosing(true);
    dismissTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
      setEntered(false);
      setDragY(0);
      dismissTimerRef.current = null;
    }, 260);
  }, [clearSwipeTimers]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
      }
      clearSwipeTimers();
    };
  }, [clearSwipeTimers]);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      setDragY(0);
      setIsDragging(false);
      setIsClosing(false);
      setSwipeX(0);
      setIsSwipingX(false);
      setSwipePhase("idle");
      gestureAxisRef.current = "none";
      return;
    }
    const raf = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!sleepTimerEndsAt) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [sleepTimerEndsAt]);

  useEffect(() => {
    const onOpen = () => {
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      clearSwipeTimers();
      setIsClosing(false);
      setDragY(0);
      setSwipeX(0);
      setSwipePhase("idle");
      setOpen(true);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen((prev) => {
          if (prev) dismissAnimated();
          return prev;
        });
      }
    };
    window.addEventListener("sangeet:open-mobile-player", onOpen);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("sangeet:open-mobile-player", onOpen);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dismissAnimated, clearSwipeTimers]);

  const activeLyricIdx = getActiveLyricIndex(lyrics?.synced ?? [], currentTime);

  useEffect(() => {
    if (open && (tab === "lyrics" || desktopRightTab === "lyrics")) {
      activeLyricRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }, [activeLyricIdx, open, tab, desktopRightTab]);

  const commitTrackSwipe = useCallback(
    (direction: "next" | "prev") => {
      clearSwipeTimers();
      setIsSwipingX(false);
      setSwipePhase("exiting");
      setSwipeX(direction === "next" ? -320 : 320);

      swipeTimerRef.current = window.setTimeout(() => {
        if (direction === "next") {
          void nextTrack();
        } else {
          prevTrack();
        }
        setSwipePhase("entering");
        setSwipeX(direction === "next" ? 44 : -44);

        swipeRafRef.current = window.requestAnimationFrame(() => {
          swipeRafRef.current = window.requestAnimationFrame(() => {
            setSwipePhase("idle");
            setSwipeX(0);
            swipeRafRef.current = null;
          });
        });
        swipeTimerRef.current = null;
      }, 180);
    },
    [clearSwipeTimers, nextTrack, prevTrack]
  );

  const startGesture = useCallback(
    (
      clientX: number,
      clientY: number,
      target: EventTarget | null,
      fromHeader: boolean
    ) => {
      if (isClosing || swipePhase !== "idle") return;
      if (
        target instanceof HTMLElement &&
        (target.closest('input[type="range"]') ||
          target.closest("[data-sleep-popover]") ||
          (target.closest("button") && !target.closest("[data-artwork-stage]")))
      ) {
        return;
      }

      const innerScrollEl =
        target instanceof HTMLElement
          ? target.closest<HTMLElement>("[data-panel-scroll]")
          : null;
      const inRightPanel =
        target instanceof HTMLElement &&
        Boolean(target.closest("[data-right-panel]"));
      const inPlayerArea =
        target instanceof HTMLElement &&
        Boolean(target.closest("[data-artwork-stage], [data-player-column]"));
      const canSwipeHorizontal =
        !fromHeader && !inRightPanel && (tab === "player" || inPlayerArea);

      gestureAxisRef.current = "none";
      dragRef.current = {
        active: true,
        startX: clientX,
        startY: clientY,
        startTime: performance.now(),
        lastX: 0,
        lastY: 0,
        fromHeader,
        canSwipeHorizontal,
        innerScrollEl
      };
    },
    [isClosing, swipePhase, tab]
  );

  const moveGesture = useCallback((clientX: number, clientY: number) => {
    const state = dragRef.current;
    if (!state.active) return;
    const dx = clientX - state.startX;
    const dy = clientY - state.startY;

    if (gestureAxisRef.current === "none") {
      if (Math.abs(dx) <= 10 && Math.abs(dy) <= 10) return;

      if (Math.abs(dx) > Math.abs(dy)) {
        if (!state.canSwipeHorizontal) {
          state.active = false;
          return;
        }
        gestureAxisRef.current = "horizontal";
        setIsSwipingX(true);
      } else {
        const atTop =
          state.fromHeader ||
          ((!scrollRef.current || scrollRef.current.scrollTop <= 0) &&
            (!state.innerScrollEl || state.innerScrollEl.scrollTop <= 0));
        if (dy > 0 && atTop) {
          gestureAxisRef.current = "vertical";
          setIsDragging(true);
        } else {
          state.active = false;
          return;
        }
      }
    }

    if (gestureAxisRef.current === "horizontal") {
      const clampedX = Math.max(-220, Math.min(220, dx));
      state.lastX = clampedX;
      setSwipeX(clampedX);
      return;
    }

    if (gestureAxisRef.current === "vertical") {
      const clampedY = Math.max(0, dy);
      state.lastY = clampedY;
      setDragY(clampedY);
    }
  }, []);

  const endGesture = useCallback(() => {
    const state = dragRef.current;
    if (!state.active) return;

    const axis = gestureAxisRef.current;
    const finalX = state.lastX;
    const finalY = state.lastY;
    const elapsed = Math.max(1, performance.now() - state.startTime);

    state.active = false;
    gestureAxisRef.current = "none";

    if (axis === "horizontal") {
      const vx = finalX / elapsed;
      if (finalX < -72 || (finalX < -28 && vx < -0.55)) {
        commitTrackSwipe("next");
      } else if (finalX > 72 || (finalX > 28 && vx > 0.55)) {
        commitTrackSwipe("prev");
      } else {
        setIsSwipingX(false);
        setSwipeX(0);
      }
      return;
    }

    if (axis === "vertical") {
      const vy = finalY / elapsed;
      if (finalY > 105 || vy > 0.55) {
        dismissAnimated();
      } else {
        setIsDragging(false);
        setDragY(0);
      }
    }
  }, [commitTrackSwipe, dismissAnimated]);

  if (!open || !currentTrack) return null;

  const isLiked = likedTracks.some((t) => t.id === currentTrack.id);
  const isOfflineSaved = Boolean(
    currentTrack.offlineId ||
      offlineItems.some((i) => i.id === `dl_${currentTrack.id}`) ||
      nativeOfflineItems.some((i) => i.id === currentTrack.id)
  );
  const activeDownload = activeDownloads[currentTrack.id];
  const isDownloading = Boolean(
    activeDownload && activeDownload.status === "downloading"
  );

  const safeDuration = duration > 0 ? duration : currentTrack.duration || 0;
  const displayedTime = scrubTime !== null ? scrubTime : currentTime;
  const remainingTime = Math.max(0, safeDuration - displayedTime);
  const progressPct =
    safeDuration > 0 ? Math.min(100, (displayedTime / safeDuration) * 100) : 0;
  const bg = pickHeroColor(currentTrack.id);

  const sleepRemainingSec = sleepTimerEndsAt
    ? Math.max(0, Math.ceil((sleepTimerEndsAt - nowMs) / 1000))
    : 0;
  const sleepLabel = sleepAtTrackEnd
    ? "End of track"
    : sleepTimerEndsAt
      ? `${Math.floor(sleepRemainingSec / 60)}:${String(sleepRemainingSec % 60).padStart(2, "0")}`
      : "Sleep timer";
  const hasSleepTimer = Boolean(sleepTimerEndsAt || sleepAtTrackEnd);

  const progress = Math.min(1, dragY / 320);
  const blurPx = isClosing || !entered ? 0 : Math.round((1 - progress) * 28);
  const veilAlpha = isClosing || !entered ? 0 : 0.74 * (1 - progress);

  const sheetTransform = isClosing
    ? "translate3d(0, 100%, 0) scale(0.92)"
    : !entered
      ? "translate3d(0, 100%, 0) scale(0.97)"
      : dragY > 0
        ? `translate3d(0, ${dragY}px, 0) scale(${(1 - progress * 0.065).toFixed(4)})`
        : "translate3d(0, 0, 0) scale(1)";
  const sheetRadius = isClosing
    ? "30px"
    : dragY > 0
      ? `${Math.round(progress * 30)}px`
      : "0px";
  const sheetOpacity = isClosing
    ? 0
    : !entered
      ? 0.6
      : Number((1 - progress * 0.25).toFixed(3));

  const artworkTransition =
    isSwipingX || swipePhase === "entering"
      ? "none"
      : swipePhase === "exiting"
        ? "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease"
        : "transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease";
  const artworkOpacity =
    swipePhase === "exiting" || swipePhase === "entering"
      ? 0
      : Number(Math.max(0.45, 1 - Math.abs(swipeX) / 360).toFixed(3));
  const artworkTransform = `translate3d(${swipeX}px, 0, 0) rotate(${(swipeX * 0.02).toFixed(2)}deg)`;
  const swipeIndicatorOpacity = Math.min(
    1,
    Math.max(0, (Math.abs(swipeX) - 24) / 48)
  );

  const handleDownload = async () => {
    if (isWeb) {
      dismissAnimated();
      openDownloadAppModal(
        `Download "${currentTrack.title}" in 1 click using the Dhun Android APK or Windows app.`
      );
      return;
    }
    if (isOfflineSaved) {
      const targetId =
        currentTrack.offlineId ||
        offlineItems.find((i) => i.id === `dl_${currentTrack.id}`)?.id ||
        currentTrack.id;
      const ok = await exportOfflineTrack(targetId);
      showToast(
        ok ? `Saved "${currentTrack.title}" to device` : "Already saved offline",
        ok ? "success" : "default"
      );
      return;
    }
    showToast(`Downloading "${currentTrack.title}"...`);
    const ok = await downloadTrackOneClick(currentTrack);
    showToast(
      ok
        ? `Downloaded "${currentTrack.title}" for offline playback`
        : "Download could not complete",
      ok ? "success" : "error"
    );
  };

  return (
    <>
      {/* Full-screen blurred backdrop veil that smoothly dissolves as you pull down */}
      <div
        aria-hidden="true"
        onClick={dismissAnimated}
        className="fixed inset-0 z-[84]"
        style={{
          backdropFilter: `blur(${blurPx}px)`,
          WebkitBackdropFilter: `blur(${blurPx}px)`,
          backgroundColor: `rgba(8, 4, 4, ${veilAlpha.toFixed(2)})`,
          transition: isDragging
            ? "none"
            : "backdrop-filter 260ms ease, -webkit-backdrop-filter 260ms ease, background-color 260ms ease"
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Now Playing"
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) startGesture(t.clientX, t.clientY, e.target, false);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) moveGesture(t.clientX, t.clientY);
        }}
        onTouchEnd={endGesture}
        onTouchCancel={endGesture}
        onPointerDown={(e) => {
          if (e.pointerType === "touch" || e.button !== 0) return;
          startGesture(e.clientX, e.clientY, e.target, false);
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "touch") return;
          moveGesture(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (e.pointerType === "touch") return;
          endGesture();
        }}
        onPointerCancel={(e) => {
          if (e.pointerType === "touch") return;
          endGesture();
        }}
        className="fixed inset-0 z-[85] flex flex-col overflow-hidden text-white will-change-transform"
        style={{
          transform: sheetTransform,
          borderRadius: sheetRadius,
          opacity: sheetOpacity,
          transition: isDragging
            ? "none"
            : "transform 280ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 280ms ease, opacity 260ms ease",
          backgroundColor: "#0a0908"
        }}
      >
        {/* Deep atmospheric radial cobalt-indigo-obsidian backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <TrackArtwork
            src={currentTrack.thumbnail}
            trackId={currentTrack.id}
            alt=""
            loading="eager"
            className="h-full w-full scale-125 opacity-[0.18] blur-3xl saturate-150"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 88% 62% at 50% 20%, rgba(82, 14, 22, 0.88) 0%, rgba(20, 8, 9, 0.94) 55%, rgba(8, 4, 4, 0.99) 100%)`
            }}
          />
          <div
            className="absolute inset-0 opacity-35"
            style={{
              background: `radial-gradient(circle at 50% 24%, ${bg}55 0%, transparent 62%)`
            }}
          />
        </div>

        {/* Drag Pill + Balanced Header (NO duplicate Download button) */}
        <div
          onPointerDown={(e) => {
            if (e.pointerType === "touch" || e.button !== 0) return;
            e.stopPropagation();
            startGesture(e.clientX, e.clientY, e.target, true);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            const t = e.touches[0];
            if (t) startGesture(t.clientX, t.clientY, e.target, true);
          }}
          className="relative z-10 shrink-0 select-none px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))] sm:px-6"
        >
          <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-white/25" />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={dismissAnimated}
              aria-label="Close Now Playing"
              className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white active:scale-90"
            >
              <ChevronDown className="h-6 w-6" />
            </button>

            {/* Centered Player | Lyrics | Queue pill on mobile/tablet (< lg) */}
            <div className="flex items-center gap-1 rounded-full bg-white/[0.07] p-1 text-xs font-medium backdrop-blur-xl lg:hidden">
              {(["player", "lyrics", "queue"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTab(t);
                    if (t === "lyrics" || t === "queue") {
                      setDesktopRightTab(t);
                    }
                  }}
                  className={cn(
                    "min-h-[38px] rounded-full px-3.5 capitalize transition-colors duration-150",
                    tab === t
                      ? "bg-white/[0.16] font-semibold text-white"
                      : "text-white/65 hover:text-white"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Subtle brand mark + title on wide viewports (lg+) */}
            <div className="hidden items-center gap-2.5 lg:flex">
              <SangeetLogo className="h-8 w-8" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">
                Now Playing
              </span>
            </div>

            {/* Invisible right spacer for dead-center alignment */}
            <div aria-hidden="true" className="h-11 w-11 shrink-0" />
          </div>
        </div>

        {/* Body — single column on mobile (< lg), responsive 2-column split on wide viewports (lg+) */}
        <div
          ref={scrollRef}
          className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-y-auto px-5 pb-[max(24px,env(safe-area-inset-bottom))] sm:px-8 lg:grid lg:grid-cols-[minmax(340px,440px)_1fr] lg:items-center lg:gap-12 lg:overflow-hidden lg:py-4"
        >
          {/* Left / Player Column */}
          <div
            data-player-column
            className={cn(
              "mx-auto flex w-full max-w-md flex-1 flex-col justify-between py-2 lg:mx-0 lg:max-w-none lg:flex-none",
              tab !== "player" && "hidden lg:flex"
            )}
          >
            {/* Swipeable Artwork Stage with Soft Ambient Aura & Directional Indicator */}
            <div
              data-artwork-stage
              onDragStart={(e) => e.preventDefault()}
              className="relative mx-auto w-full max-w-[300px] cursor-grab select-none touch-pan-y active:cursor-grabbing sm:max-w-[350px] lg:max-w-[376px]"
            >
              {/* Soft ambient aura glow behind the album artwork */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-5 -z-10 overflow-hidden rounded-[36px] blur-3xl saturate-150"
                style={{
                  transform: `translate3d(${(swipeX * 0.45).toFixed(1)}px, 10px, 0) scale(0.94)`,
                  opacity:
                    swipePhase === "exiting" || swipePhase === "entering"
                      ? 0.1
                      : Number((0.5 * artworkOpacity).toFixed(3)),
                  transition: artworkTransition
                }}
              >
                <TrackArtwork
                  src={currentTrack.thumbnail}
                  trackId={currentTrack.id}
                  alt=""
                  loading="eager"
                  className="h-full w-full"
                />
              </div>

              {/* Floating directional swipe indicators */}
              {swipeX < -24 && swipePhase !== "entering" && (
                <div
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute right-2 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold shadow-[var(--shadow-elevated)] backdrop-blur-xl transition-colors duration-150",
                    swipeX <= -72
                      ? "bg-[#e2363e]/90 text-white"
                      : "bg-[#181716]/85 text-white/90"
                  )}
                  style={{ opacity: swipeIndicatorOpacity }}
                >
                  <span>Next</span>
                  <SkipForward className="h-3.5 w-3.5 fill-current" />
                </div>
              )}

              {swipeX > 24 && swipePhase !== "entering" && (
                <div
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute left-2 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold shadow-[var(--shadow-elevated)] backdrop-blur-xl transition-colors duration-150",
                    swipeX >= 72
                      ? "bg-[#e2363e]/90 text-white"
                      : "bg-[#181716]/85 text-white/90"
                  )}
                  style={{ opacity: swipeIndicatorOpacity }}
                >
                  <SkipBack className="h-3.5 w-3.5 fill-current" />
                  <span>Previous</span>
                </div>
              )}

              {/* Centered rounded artwork — zero harsh border */}
              <div
                className="aspect-square w-full overflow-hidden rounded-[24px] shadow-[var(--shadow-elevated)] will-change-transform"
                style={{
                  transform: artworkTransform,
                  opacity: artworkOpacity,
                  transition: artworkTransition
                }}
              >
                <TrackArtwork
                  src={currentTrack.thumbnail}
                  trackId={currentTrack.id}
                  alt={currentTrack.title}
                  loading="eager"
                  className="pointer-events-none h-full w-full"
                  iconClassName="h-12 w-12"
                />
              </div>
            </div>

            {/* Track Info & Like */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-[22px] font-bold tracking-[-0.02em] text-white sm:text-2xl">
                  {currentTrack.title}
                </h2>
                <p className="mt-0.5 truncate text-sm font-medium text-white/65">
                  {currentTrack.artist}
                </p>
                <FormatBadge className="mt-1.5" />
              </div>
              <button
                type="button"
                onClick={() => toggleLike(currentTrack)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/[0.08] active:scale-90"
                aria-label="Toggle Like"
              >
                <Heart
                  className={cn(
                    "h-5 w-5 transition-colors",
                    isLiked
                      ? "fill-[#d6a648] text-[#d6a648]"
                      : "text-white/75 hover:text-white"
                  )}
                />
              </button>
            </div>

            {/* Slim Drag-safe Seekbar with Elapsed & Remaining Time */}
            <div className="mt-4">
              <div className="group relative flex h-6 items-center">
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.18] transition-[height] duration-150 group-hover:h-1.5">
                  <div
                    className="h-full rounded-full bg-white transition-colors group-hover:bg-[#d6a648]"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={safeDuration || 100}
                  step={0.5}
                  value={Math.min(displayedTime, safeDuration || 100)}
                  onPointerDown={() => setScrubTime(currentTime)}
                  onChange={(e) => setScrubTime(Number(e.target.value))}
                  onPointerUp={(e) => {
                    const val = Number((e.target as HTMLInputElement).value);
                    setScrubTime(null);
                    requestSeek(val);
                  }}
                  onKeyUp={(e) => {
                    const val = Number((e.target as HTMLInputElement).value);
                    setScrubTime(null);
                    requestSeek(val);
                  }}
                  aria-label="Seek position"
                  className="encore-slider absolute inset-0 h-full w-full"
                />
              </div>
              <div className="mt-1 flex justify-between font-mono text-[11px] font-medium tabular-nums text-white/55">
                <span>{formatTime(displayedTime)}</span>
                <span>-{formatTime(remainingTime)}</span>
              </div>
            </div>

            {/* Crisp Transport Controls — zero messy outer halos */}
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={toggleShuffle}
                aria-label="Shuffle"
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/[0.08] active:scale-90",
                  shuffle ? "text-[#d6a648]" : "text-white/65 hover:text-white"
                )}
              >
                <Shuffle className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={prevTrack}
                aria-label="Previous"
                className="flex h-12 w-12 items-center justify-center rounded-full text-white transition-colors hover:bg-white/[0.08] active:scale-90"
              >
                <SkipBack className="h-7 w-7 fill-current" />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#0d0c0b] shadow-[var(--shadow-elevated)] transition-transform hover:scale-[1.03] active:scale-95"
              >
                {isBuffering ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-7 w-7 fill-current" />
                ) : (
                  <Play className="h-7 w-7 translate-x-0.5 fill-current" />
                )}
              </button>
              <button
                type="button"
                onClick={() => void nextTrack()}
                aria-label="Next"
                className="flex h-12 w-12 items-center justify-center rounded-full text-white transition-colors hover:bg-white/[0.08] active:scale-90"
              >
                <SkipForward className="h-7 w-7 fill-current" />
              </button>
              <button
                type="button"
                onClick={cycleRepeat}
                aria-label={`Repeat: ${repeat}`}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/[0.08] active:scale-90",
                  repeat !== "off"
                    ? "text-[#d6a648]"
                    : "text-white/65 hover:text-white"
                )}
              >
                {repeat === "one" ? (
                  <Repeat1 className="h-5 w-5" />
                ) : (
                  <Repeat className="h-5 w-5" />
                )}
              </button>
            </div>

            {/* Clean borderless utility strip: Sleek Lyrics Pill (mobile), Full Sleep Timer Popover & ONE Single Download */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setTab("lyrics");
                  setDesktopRightTab("lyrics");
                }}
                aria-label="Open Lyrics"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-white/[0.07] px-4 py-2 text-xs font-medium text-white/85 transition-colors hover:bg-white/[0.13] active:scale-95 lg:hidden"
              >
                <Mic2 className="h-3.5 w-3.5 text-[#d6a648]" />
                <span>Lyrics</span>
              </button>

              <div ref={sleepWrapRef} className="relative">
                <button
                  type="button"
                  onClick={() => setSleepMenuOpen((v) => !v)}
                  aria-label="Sleep timer"
                  aria-expanded={sleepMenuOpen}
                  className={cn(
                    "inline-flex min-h-[42px] items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-colors",
                    hasSleepTimer
                      ? "bg-[#e2363e]/25 text-[#d6a648]"
                      : "bg-white/[0.07] text-white/85 hover:bg-white/[0.13]"
                  )}
                >
                  <Moon className="h-3.5 w-3.5" />
                  <span className={cn(sleepTimerEndsAt && "font-mono tabular-nums")}>
                    {sleepLabel}
                  </span>
                </button>

                {sleepMenuOpen && (
                  <div
                    data-sleep-popover
                    className="absolute bottom-14 left-1/2 z-50 w-48 -translate-x-1/2 rounded-2xl bg-[#181716]/95 p-1.5 shadow-[var(--shadow-elevated)] backdrop-blur-2xl"
                  >
                    <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                      Sleep timer
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSleepAtTrackEnd(true);
                        setSleepMenuOpen(false);
                        showToast("Sleep timer: end of track", "success");
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium text-white/90 transition-colors hover:bg-white/[0.08]"
                    >
                      <span>End of track</span>
                      {sleepAtTrackEnd && (
                        <Check className="h-3.5 w-3.5 text-[#d6a648]" />
                      )}
                    </button>
                    {SLEEP_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => {
                          if (opt.minutes === null) {
                            setSleepAtTrackEnd(false);
                          }
                          setSleepTimer(opt.minutes);
                          setSleepMenuOpen(false);
                          showToast(
                            opt.minutes
                              ? `Sleep timer set for ${opt.minutes} min`
                              : "Sleep timer off",
                            opt.minutes ? "success" : "default"
                          );
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium text-white/90 transition-colors hover:bg-white/[0.08]"
                      >
                        <span>{opt.label}</span>
                        {opt.minutes === null && !hasSleepTimer && (
                          <Check className="h-3.5 w-3.5 text-[#d6a648]" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={isDownloading}
                onClick={() => void handleDownload()}
                aria-label="Download track"
                className={cn(
                  "inline-flex min-h-[42px] items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-colors disabled:opacity-60",
                  isOfflineSaved
                    ? "bg-[#e2363e]/25 text-[#d6a648]"
                    : "bg-white/[0.07] text-white/85 hover:bg-white/[0.13]"
                )}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d6a648]" />
                    <span className="font-mono tabular-nums">
                      {activeDownload ? `${activeDownload.progress}%` : "Downloading"}
                    </span>
                  </>
                ) : isOfflineSaved ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#d6a648]" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column (Synced Lyrics / Queue on desktop lg+, or active tab on mobile) */}
          <div
            data-right-panel
            className={cn(
              "mx-auto flex w-full max-w-md flex-col overflow-hidden lg:mx-0 lg:h-full lg:max-h-[78vh] lg:max-w-none",
              tab === "player" ? "hidden lg:flex" : "flex"
            )}
          >
            {/* Desktop Lyrics | Up Next Switcher */}
            <div className="mb-4 hidden lg:flex">
              <div className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] p-1 text-xs font-medium backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => setDesktopRightTab("lyrics")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-4 py-2 transition-colors",
                    desktopRightTab === "lyrics"
                      ? "bg-white/[0.16] font-semibold text-white"
                      : "text-white/65 hover:text-white"
                  )}
                >
                  <Mic2 className="h-3.5 w-3.5" />
                  Lyrics
                </button>
                <button
                  type="button"
                  onClick={() => setDesktopRightTab("queue")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-4 py-2 transition-colors",
                    desktopRightTab === "queue"
                      ? "bg-white/[0.16] font-semibold text-white"
                      : "text-white/65 hover:text-white"
                  )}
                >
                  <ListMusic className="h-3.5 w-3.5" />
                  Up Next ({queue.length})
                </button>
              </div>
            </div>

            {/* Lyrics / Queue Content */}
            <div
              data-panel-scroll
              className="min-h-0 flex-1 overflow-y-auto pr-1 sm:pr-2"
            >
              {(desktopRightTab === "lyrics" && tab !== "queue") ||
              tab === "lyrics" ? (
                <div className="space-y-5 py-6 sm:py-8">
                  {lyrics?.synced && lyrics.synced.length > 0 ? (
                    lyrics.synced.map((line, idx) => (
                      <button
                        key={`${line.time}-${idx}`}
                        ref={idx === activeLyricIdx ? activeLyricRef : null}
                        type="button"
                        onClick={() => requestSeek(line.time)}
                        className={cn(
                          "block min-h-[44px] w-full origin-left py-0.5 text-left text-[22px] font-bold leading-[1.28] tracking-[-0.02em] transition-all duration-300 sm:text-[26px]",
                          idx === activeLyricIdx
                            ? "scale-[1.01] text-white"
                            : idx < activeLyricIdx
                              ? "text-white/25 hover:text-white/60"
                              : "text-white/40 hover:text-white/70"
                        )}
                      >
                        {line.text}
                      </button>
                    ))
                  ) : lyrics?.plain ? (
                    <pre className="whitespace-pre-wrap font-sans text-lg font-semibold leading-relaxed text-white/85">
                      {lyrics.plain}
                    </pre>
                  ) : (
                    <div className="flex flex-col items-center py-20 text-white/55">
                      <Mic2 className="mb-3 h-8 w-8 opacity-45" />
                      <p className="text-sm font-medium">
                        No lyrics available for this track.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 py-4">
                  <p className="text-xs font-medium text-white/60 lg:hidden">
                    Next up ({queue.length})
                  </p>
                  {queue.length === 0 ? (
                    <div className="flex flex-col items-center py-16 text-white/55">
                      <ListMusic className="mb-3 h-8 w-8 opacity-45" />
                      <p className="text-sm font-medium">Queue is empty.</p>
                    </div>
                  ) : (
                    queue.map((t, idx) => (
                      <div
                        key={`${t.id}-${idx}`}
                        className="flex w-full items-center gap-2 rounded-2xl bg-white/[0.06] p-2 transition-colors hover:bg-white/[0.11]"
                      >
                        <button
                          type="button"
                          onClick={() => playTrack(t, queue.slice(idx))}
                          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <TrackArtwork
                            src={t.thumbnail}
                            trackId={t.id}
                            alt={t.title}
                            className="h-11 w-11 shrink-0 rounded-lg"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">
                              {t.title}
                            </p>
                            <p className="truncate text-xs text-white/60">
                              {t.artist}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromQueue(idx)}
                          aria-label={`Remove ${t.title} from queue`}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/[0.1] hover:text-encore-negative"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
