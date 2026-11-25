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
import { cn, formatTime, pickHeroColor } from "@/lib/utils";

const SLEEP_OPTIONS = [
  { label: "Off", minutes: null as number | null },
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "45 min", minutes: 45 },
  { label: "60 min", minutes: 60 }
];

type SheetTab = "player" | "lyrics" | "queue";
type DesktopRightTab = "lyrics" | "queue";

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

  const activeLyricRef = useRef<HTMLButtonElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sleepWrapRef = useRef<HTMLDivElement | null>(null);
  const dismissTimerRef = useRef<number | null>(null);
  const dragRef = useRef({
    active: false,
    engaged: false,
    startY: 0,
    startX: 0,
    startTime: 0,
    lastY: 0,
    fromHeader: false
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

  const dismissAnimated = useCallback(() => {
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
    }
    setSleepMenuOpen(false);
    setIsDragging(false);
    setIsClosing(true);
    dismissTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
      setEntered(false);
      setDragY(0);
      dismissTimerRef.current = null;
    }, 260);
  }, []);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      setDragY(0);
      setIsDragging(false);
      setIsClosing(false);
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
      setIsClosing(false);
      setDragY(0);
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
  }, [dismissAnimated]);

  const activeLyricIdx = getActiveLyricIndex(lyrics?.synced ?? [], currentTime);

  useEffect(() => {
    if (open && (tab === "lyrics" || desktopRightTab === "lyrics")) {
      activeLyricRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }, [activeLyricIdx, open, tab, desktopRightTab]);

  const startDrag = useCallback(
    (
      clientX: number,
      clientY: number,
      target: EventTarget | null,
      fromHeader: boolean
    ) => {
      if (isClosing) return;
      if (
        target instanceof HTMLElement &&
        (target.closest('input[type="range"]') ||
          target.closest("[data-sleep-popover]"))
      ) {
        return;
      }
      if (!fromHeader && scrollRef.current && scrollRef.current.scrollTop > 0) {
        return;
      }
      dragRef.current = {
        active: true,
        engaged: false,
        startY: clientY,
        startX: clientX,
        startTime: performance.now(),
        lastY: 0,
        fromHeader
      };
    },
    [isClosing]
  );

  const moveDrag = useCallback((clientX: number, clientY: number) => {
    const state = dragRef.current;
    if (!state.active) return;
    const deltaY = clientY - state.startY;
    const deltaX = clientX - state.startX;

    if (!state.engaged) {
      if (deltaY > 6 && Math.abs(deltaY) > Math.abs(deltaX)) {
        if (
          !state.fromHeader &&
          scrollRef.current &&
          scrollRef.current.scrollTop > 0
        ) {
          state.active = false;
          return;
        }
        state.engaged = true;
        setIsDragging(true);
        state.lastY = deltaY;
        setDragY(deltaY);
      } else if (deltaY < -6 || Math.abs(deltaX) > 14) {
        state.active = false;
      }
      return;
    }

    const clampedY = Math.max(0, deltaY);
    state.lastY = clampedY;
    setDragY(clampedY);
  }, []);

  const endDrag = useCallback(() => {
    const state = dragRef.current;
    if (!state.active) return;
    const wasEngaged = state.engaged;
    const finalY = state.lastY;
    const elapsed = Math.max(1, performance.now() - state.startTime);
    const velocity = finalY / elapsed;

    state.active = false;
    state.engaged = false;

    if (!wasEngaged) return;

    if (finalY > 105 || velocity > 0.55) {
      dismissAnimated();
    } else {
      setIsDragging(false);
      setDragY(0);
    }
  }, [dismissAnimated]);

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
  const veilAlpha = isClosing || !entered ? 0 : 0.72 * (1 - progress);

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

  const handleDownload = async () => {
    if (isWeb) {
      dismissAnimated();
      openDownloadAppModal(
        `Download "${currentTrack.title}" in 1 click using the Sangeet Android APK or Windows app.`
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
          backgroundColor: `rgba(7, 8, 12, ${veilAlpha.toFixed(2)})`,
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
          if (t) startDrag(t.clientX, t.clientY, e.target, false);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) moveDrag(t.clientX, t.clientY);
        }}
        onTouchEnd={endDrag}
        onTouchCancel={endDrag}
        onPointerMove={(e) => {
          if (e.pointerType === "touch") return;
          moveDrag(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (e.pointerType === "touch") return;
          endDrag();
        }}
        onPointerCancel={(e) => {
          if (e.pointerType === "touch") return;
          endDrag();
        }}
        className="fixed inset-0 z-[85] flex flex-col overflow-hidden text-white will-change-transform"
        style={{
          transform: sheetTransform,
          borderRadius: sheetRadius,
          opacity: sheetOpacity,
          transition: isDragging
            ? "none"
            : "transform 280ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 280ms ease, opacity 260ms ease",
          backgroundColor: "#07080c"
        }}
      >
        {/* Ambient blurred artwork backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <TrackArtwork
            src={currentTrack.thumbnail}
            trackId={currentTrack.id}
            alt=""
            loading="eager"
            className="h-full w-full scale-125 opacity-25 blur-3xl saturate-150"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${bg}cc 0%, rgba(13, 16, 28, 0.9) 52%, rgba(7, 8, 12, 0.98) 100%)`
            }}
          />
        </div>

        {/* Drag Pill + Balanced Header (NO duplicate Download button) */}
        <div
          onPointerDown={(e) => {
            if (e.pointerType === "touch") return;
            startDrag(e.clientX, e.clientY, e.target, true);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            const t = e.touches[0];
            if (t) startDrag(t.clientX, t.clientY, e.target, true);
          }}
          className="relative z-10 shrink-0 select-none px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))] sm:px-6"
        >
          <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-white/30" />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={dismissAnimated}
              aria-label="Close Now Playing"
              className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/[0.1] hover:text-white active:scale-90"
            >
              <ChevronDown className="h-6 w-6" />
            </button>

            {/* Centered Player | Lyrics | Queue pill on mobile/tablet (< lg) */}
            <div className="flex items-center gap-1 rounded-full bg-white/[0.08] p-1 text-xs font-medium backdrop-blur-xl lg:hidden">
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
                    "min-h-[40px] rounded-full px-3.5 capitalize transition-colors duration-150",
                    tab === t
                      ? "bg-encore-accent font-semibold text-white"
                      : "text-white/75 hover:text-white"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Subtle centered title on wide viewports (lg+) */}
            <span className="hidden text-xs font-semibold uppercase tracking-widest text-white/60 lg:inline">
              Now Playing
            </span>

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
            className={cn(
              "mx-auto flex w-full max-w-md flex-1 flex-col justify-between py-2 lg:mx-0 lg:max-w-none lg:flex-none",
              tab !== "player" && "hidden lg:flex"
            )}
          >
            {/* Artwork — borderless with soft depth shadow */}
            <div className="mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.68)] sm:max-w-[350px] lg:max-w-[370px]">
              <TrackArtwork
                src={currentTrack.thumbnail}
                trackId={currentTrack.id}
                alt={currentTrack.title}
                loading="eager"
                iconClassName="h-12 w-12"
              />
            </div>

            {/* Track Info & Like */}
            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold text-white sm:text-2xl">
                  {currentTrack.title}
                </h2>
                <p className="truncate text-sm text-white/70">
                  {currentTrack.artist}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleLike(currentTrack)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/[0.12] active:scale-90"
                aria-label="Toggle Like"
              >
                <Heart
                  className={cn(
                    "h-5 w-5",
                    isLiked
                      ? "fill-encore-accent text-encore-accent"
                      : "text-white/80"
                  )}
                />
              </button>
            </div>

            {/* Drag-safe Seekbar */}
            <div className="mt-4">
              <div className="relative flex h-6 items-center">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-encore-accent"
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
              <div className="mt-1 flex justify-between font-mono text-xs tabular-nums text-white/65">
                <span>{formatTime(displayedTime)}</span>
                <span>{formatTime(safeDuration)}</span>
              </div>
            </div>

            {/* Main Transport Controls */}
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={toggleShuffle}
                aria-label="Shuffle"
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/[0.08] active:scale-90",
                  shuffle ? "text-[#93c5fd]" : "text-white/75"
                )}
              >
                <Shuffle className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={prevTrack}
                aria-label="Previous"
                className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/[0.08] active:scale-90"
              >
                <SkipBack className="h-7 w-7 fill-current" />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="btn-cobalt flex h-16 w-16 items-center justify-center rounded-full text-white transition-transform active:scale-95"
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
                className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/[0.08] active:scale-90"
              >
                <SkipForward className="h-7 w-7 fill-current" />
              </button>
              <button
                type="button"
                onClick={cycleRepeat}
                aria-label={`Repeat: ${repeat}`}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/[0.08] active:scale-90",
                  repeat !== "off" ? "text-[#93c5fd]" : "text-white/75"
                )}
              >
                {repeat === "one" ? (
                  <Repeat1 className="h-5 w-5" />
                ) : (
                  <Repeat className="h-5 w-5" />
                )}
              </button>
            </div>

            {/* Clean borderless utility strip: Full Sleep Timer Popover & ONE Single Download */}
            <div className="mt-4 flex items-center justify-center gap-3">
              <div ref={sleepWrapRef} className="relative">
                <button
                  type="button"
                  onClick={() => setSleepMenuOpen((v) => !v)}
                  aria-label="Sleep timer"
                  aria-expanded={sleepMenuOpen}
                  className={cn(
                    "inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-colors",
                    hasSleepTimer
                      ? "bg-[#3b82f6]/25 text-[#93c5fd]"
                      : "bg-white/[0.07] text-white/85 hover:bg-white/[0.12]"
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
                    className="absolute bottom-14 left-1/2 z-50 w-48 -translate-x-1/2 rounded-2xl bg-[#131726]/95 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
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
                        <Check className="h-3.5 w-3.5 text-[#93c5fd]" />
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
                          <Check className="h-3.5 w-3.5 text-[#93c5fd]" />
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
                  "inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-colors disabled:opacity-60",
                  isOfflineSaved
                    ? "bg-[#3b82f6]/25 text-[#93c5fd]"
                    : "bg-white/[0.07] text-white/85 hover:bg-white/[0.12]"
                )}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#93c5fd]" />
                    <span className="font-mono tabular-nums">
                      {activeDownload ? `${activeDownload.progress}%` : "Downloading"}
                    </span>
                  </>
                ) : isOfflineSaved ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#93c5fd]" />
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

          {/* Right Column (Lyrics / Queue on desktop lg+, or active tab on mobile) */}
          <div
            className={cn(
              "mx-auto flex w-full max-w-md flex-col overflow-hidden lg:mx-0 lg:h-full lg:max-h-[78vh] lg:max-w-none",
              tab === "player" ? "hidden lg:flex" : "flex"
            )}
          >
            {/* Desktop Lyrics | Up Next Switcher */}
            <div className="mb-4 hidden lg:flex">
              <div className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] p-1 text-xs font-medium backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => setDesktopRightTab("lyrics")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-4 py-2 transition-colors",
                    desktopRightTab === "lyrics"
                      ? "bg-encore-accent font-semibold text-white"
                      : "text-white/70 hover:text-white"
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
                      ? "bg-encore-accent font-semibold text-white"
                      : "text-white/70 hover:text-white"
                  )}
                >
                  <ListMusic className="h-3.5 w-3.5" />
                  Up Next ({queue.length})
                </button>
              </div>
            </div>

            {/* Lyrics / Queue Content */}
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {(desktopRightTab === "lyrics" && tab !== "queue") ||
              tab === "lyrics" ? (
                <div className="space-y-3 py-4">
                  {lyrics?.synced && lyrics.synced.length > 0 ? (
                    lyrics.synced.map((line, idx) => (
                      <button
                        key={`${line.time}-${idx}`}
                        ref={idx === activeLyricIdx ? activeLyricRef : null}
                        type="button"
                        onClick={() => requestSeek(line.time)}
                        className={cn(
                          "block min-h-[44px] w-full py-1 text-left text-xl font-bold leading-snug transition-all duration-200 sm:text-2xl",
                          idx === activeLyricIdx
                            ? "text-white drop-shadow-[0_0_20px_rgba(147,197,253,0.45)]"
                            : idx < activeLyricIdx
                              ? "text-white/35"
                              : "text-white/65 hover:text-white/90"
                        )}
                      >
                        {line.text}
                      </button>
                    ))
                  ) : lyrics?.plain ? (
                    <pre className="whitespace-pre-wrap font-sans text-base font-medium leading-relaxed text-white/90">
                      {lyrics.plain}
                    </pre>
                  ) : (
                    <div className="flex flex-col items-center py-20 text-white/65">
                      <Mic2 className="mb-3 h-8 w-8 opacity-50" />
                      <p className="text-sm">
                        No lyrics available for this track.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 py-4">
                  <p className="text-xs font-medium text-white/65 lg:hidden">
                    Next up ({queue.length})
                  </p>
                  {queue.length === 0 ? (
                    <div className="flex flex-col items-center py-16 text-white/65">
                      <ListMusic className="mb-3 h-8 w-8 opacity-50" />
                      <p className="text-sm">Queue is empty.</p>
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
                            <p className="truncate text-xs text-white/65">
                              {t.artist}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromQueue(idx)}
                          aria-label={`Remove ${t.title} from queue`}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/[0.1] hover:text-encore-negative"
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
