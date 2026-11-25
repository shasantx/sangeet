"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Download,
  Heart,
  ListMusic,
  Loader2,
  Maximize2,
  Mic2,
  Moon,
  PanelRight,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Volume1,
  Volume2,
  VolumeX
} from "lucide-react";
import { usePlayerStore } from "@/store/player-store";
import { useLibraryStore } from "@/store/library-store";
import { useOfflineStore } from "@/store/offline-store";
import { useUIStore } from "@/store/ui-store";
import { useToastStore } from "@/store/toast-store";
import { usePlatform } from "@/lib/platform";
import { useClickOutside } from "@/lib/use-click-outside";
import { TrackArtwork } from "@/components/music/track-artwork";
import { cn, formatTime } from "@/lib/utils";

const SLEEP_OPTIONS = [
  { label: "Off", minutes: null as number | null },
  { label: "15 minutes", minutes: 15 },
  { label: "30 minutes", minutes: 30 },
  { label: "45 minutes", minutes: 45 },
  { label: "60 minutes", minutes: 60 }
];

export function NowPlayingBar() {
  const { isWeb } = usePlatform();
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const playbackError = usePlayerStore((s) => s.playbackError);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const sleepTimerEndsAt = usePlayerStore((s) => s.sleepTimerEndsAt);
  const sleepAtTrackEnd = usePlayerStore((s) => s.sleepAtTrackEnd);

  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const retryCurrentTrack = usePlayerStore((s) => s.retryCurrentTrack);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const prevTrack = usePlayerStore((s) => s.prevTrack);
  const requestSeek = usePlayerStore((s) => s.requestSeek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer);
  const setSleepAtTrackEnd = usePlayerStore((s) => s.setSleepAtTrackEnd);
  const fetchRadioForTrack = usePlayerStore((s) => s.fetchRadioForTrack);

  const likedTracks = useLibraryStore((s) => s.likedTracks);
  const toggleLike = useLibraryStore((s) => s.toggleLike);

  const offlineItems = useOfflineStore((s) => s.items);
  const nativeOfflineItems = useOfflineStore((s) => s.nativeItems);
  const activeDownloads = useOfflineStore((s) => s.downloads);
  const downloadTrackOneClick = useOfflineStore((s) => s.downloadTrackOneClick);
  const exportOfflineTrack = useOfflineStore((s) => s.exportOfflineTrack);

  const rightTab = useUIStore((s) => s.rightTab);
  const toggleRightTab = useUIStore((s) => s.toggleRightTab);
  const openDownloadAppModal = useUIStore((s) => s.openDownloadAppModal);
  const showToast = useToastStore((s) => s.showToast);

  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const sleepWrapRef = useRef<HTMLDivElement | null>(null);
  const closeSleep = useCallback(() => setSleepMenuOpen(false), []);
  useClickOutside(sleepWrapRef, sleepMenuOpen, closeSleep);

  useEffect(() => {
    if (!sleepTimerEndsAt) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [sleepTimerEndsAt]);

  const isLiked = currentTrack
    ? likedTracks.some((t) => t.id === currentTrack.id)
    : false;

  const isOfflineSaved = currentTrack
    ? Boolean(
        currentTrack.offlineId ||
          offlineItems.some((i) => i.id === `dl_${currentTrack.id}`) ||
          nativeOfflineItems.some((i) => i.id === currentTrack.id)
      )
    : false;
  const activeDownload = currentTrack ? activeDownloads[currentTrack.id] : null;
  const isDownloading = Boolean(
    activeDownload && activeDownload.status === "downloading"
  );

  const safeDuration = duration > 0 ? duration : currentTrack?.duration || 0;
  const displayedTime = scrubTime !== null ? scrubTime : currentTime;
  const progressPct =
    safeDuration > 0 ? Math.min(100, (displayedTime / safeDuration) * 100) : 0;
  const effectiveVolume = muted ? 0 : volume;

  const sleepRemainingSec = sleepTimerEndsAt
    ? Math.max(0, Math.ceil((sleepTimerEndsAt - nowMs) / 1000))
    : 0;
  const sleepBadgeText = sleepAtTrackEnd
    ? "END"
    : sleepTimerEndsAt
      ? `${Math.floor(sleepRemainingSec / 60)}:${String(sleepRemainingSec % 60).padStart(2, "0")}`
      : null;

  const handleDownloadAction = async () => {
    if (!currentTrack) return;
    if (isWeb) {
      openDownloadAppModal(
        `Download "${currentTrack.title}" in 1 click using the Sangeet Android APK or Windows Rust app.`
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
      {/* Playback Error Recovery Strip */}
      {playbackError && currentTrack && (
        <div
          role="alert"
          className="fixed inset-x-3 bottom-[calc(154px+env(safe-area-inset-bottom))] z-40 flex items-center justify-between gap-2 rounded-2xl border-0 bg-encore-elevated/95 px-3.5 py-2 text-xs text-encore-text shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl md:static md:rounded-none md:px-4"
        >
          <div className="flex min-w-0 items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-encore-negative" />
            <span className="truncate">{playbackError}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={retryCurrentTrack}
              className="btn-cobalt inline-flex min-h-[36px] items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold text-white hover:opacity-95"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
            <button
              type="button"
              onClick={() => void nextTrack()}
              className="min-h-[36px] rounded-full bg-encore-base px-3 py-1 text-[11px] font-medium text-encore-text transition-colors hover:bg-encore-elevated-highlight"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Floating Mobile Mini-Player (< md) hovering cleanly above LiquidGlass FloatingNav */}
      {currentTrack && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(86px+env(safe-area-inset-bottom))] z-30 flex justify-center px-3 md:hidden">
          <div className="pointer-events-auto relative flex h-[60px] w-full max-w-[420px] items-center gap-1 overflow-hidden rounded-[18px] border-0 bg-encore-elevated px-2 shadow-[0_14px_36px_rgba(0,0,0,0.48)] backdrop-blur-2xl transition-transform duration-200">
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new Event("sangeet:open-mobile-player"))
              }
              aria-label={`Open full player for ${currentTrack.title}`}
              className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 pl-0.5 text-left"
            >
              <TrackArtwork
                src={currentTrack.thumbnail}
                trackId={currentTrack.id}
                alt={currentTrack.title}
                className="h-10 w-10 shrink-0 rounded-[10px] shadow"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-encore-text">
                  {currentTrack.title}
                </p>
                <p className="truncate text-xs text-encore-subdued">
                  {currentTrack.artist}
                </p>
              </div>
            </button>

            <Link
              href="/lyrics"
              aria-label="Open synced lyrics"
              title="Synced lyrics"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-encore-subdued transition-colors hover:text-encore-accent active:scale-90"
            >
              <Mic2 className="h-4 w-4" strokeWidth={1.6} />
            </Link>

            <button
              type="button"
              onClick={() => toggleLike(currentTrack)}
              aria-label={isLiked ? "Unlike" : "Like"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-encore-subdued active:scale-90"
            >
              <Heart
                className={cn(
                  "h-4 w-4",
                  isLiked && "fill-encore-accent text-encore-accent"
                )}
                strokeWidth={1.6}
              />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="btn-cobalt flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow active:scale-90"
            >
              {isBuffering ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 translate-x-0.5 fill-current" />
              )}
            </button>

            <div className="pointer-events-none absolute inset-x-3 bottom-0 h-[2.5px] overflow-hidden rounded-full bg-encore-rail">
              <div
                className="h-full bg-encore-accent transition-[width] duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Desktop & Tablet Studio Now Playing Bar (>= md) */}
      <footer
        data-testid="now-playing-bar"
        className="hidden h-[72px] shrink-0 items-center justify-between gap-2 bg-encore-shell/95 px-3 shadow-[0_-1px_0_var(--hairline)] backdrop-blur-xl select-none md:flex lg:gap-4 lg:px-4"
      >
        {/* Left: Now Playing Widget */}
        <div
          data-testid="now-playing-widget"
          className="flex w-[26%] min-w-[160px] shrink-0 items-center gap-2 lg:w-[29%] lg:gap-3"
        >
          {currentTrack ? (
            <>
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new Event("sangeet:open-fullscreen"))
                }
                title="Open Fullscreen Player (F)"
                aria-label="Open Fullscreen Player"
                className="shrink-0 overflow-hidden rounded-[8px] shadow transition-transform duration-200 hover:scale-105"
              >
                <TrackArtwork
                  src={currentTrack.thumbnail}
                  trackId={currentTrack.id}
                  alt={currentTrack.title}
                  className="h-12 w-12 lg:h-14 lg:w-14"
                />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-encore-text">
                  {currentTrack.title}
                </p>
                {currentTrack.artistId ? (
                  <Link
                    href={`/artist/${encodeURIComponent(currentTrack.artistId)}?name=${encodeURIComponent(currentTrack.artist)}`}
                    className="block truncate text-xs text-encore-subdued hover:text-encore-accent hover:underline"
                  >
                    {currentTrack.artist}
                  </Link>
                ) : (
                  <p className="truncate text-xs text-encore-subdued">
                    {currentTrack.artist}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => toggleLike(currentTrack)}
                aria-label={
                  isLiked ? "Remove from Liked Songs" : "Save to Liked Songs"
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-encore-subdued transition-colors duration-150 hover:bg-encore-elevated hover:text-encore-text active:scale-90"
              >
                <Heart
                  className={cn(
                    "h-4 w-4",
                    isLiked && "fill-encore-accent text-encore-accent"
                  )}
                  strokeWidth={1.6}
                />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3 opacity-55">
              <div className="h-12 w-12 rounded-[8px] bg-encore-elevated/80 lg:h-14 lg:w-14" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-encore-text">
                  Sangeet
                </p>
                <p className="truncate text-xs text-encore-subdued">
                  Select a song to play
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Center: Player Controls + Seekbar */}
        <div
          data-testid="player-controls"
          className="flex min-w-0 max-w-[560px] flex-1 flex-col items-center gap-1"
        >
          <div className="flex items-center gap-1.5 lg:gap-2.5">
            <button
              type="button"
              onClick={toggleShuffle}
              aria-label="Shuffle"
              title="Shuffle (S)"
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150 hover:bg-encore-elevated",
                shuffle
                  ? "text-encore-accent"
                  : "text-encore-subdued hover:text-encore-text"
              )}
            >
              <Shuffle className="h-4 w-4" strokeWidth={1.7} />
              {shuffle && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-encore-accent" />
              )}
            </button>

            <button
              type="button"
              onClick={prevTrack}
              aria-label="Previous"
              title="Previous (Shift+←)"
              className="flex h-9 w-9 items-center justify-center rounded-full text-encore-subdued transition-colors duration-150 hover:bg-encore-elevated hover:text-encore-text active:scale-90"
            >
              <SkipBack className="h-5 w-5 fill-current" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              title="Play / Pause (Space)"
              className="btn-cobalt flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform duration-150 hover:scale-[1.04] active:scale-95"
            >
              {isBuffering ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 translate-x-0.5 fill-current" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void nextTrack()}
              aria-label="Next"
              title="Next (Shift+→)"
              className="flex h-9 w-9 items-center justify-center rounded-full text-encore-subdued transition-colors duration-150 hover:bg-encore-elevated hover:text-encore-text active:scale-90"
            >
              <SkipForward className="h-5 w-5 fill-current" />
            </button>

            <button
              type="button"
              onClick={cycleRepeat}
              aria-label={`Repeat: ${repeat}`}
              title={`Repeat: ${repeat} (R)`}
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150 hover:bg-encore-elevated",
                repeat !== "off"
                  ? "text-encore-accent"
                  : "text-encore-subdued hover:text-encore-text"
              )}
            >
              {repeat === "one" ? (
                <Repeat1 className="h-4 w-4" strokeWidth={1.7} />
              ) : (
                <Repeat className="h-4 w-4" strokeWidth={1.7} />
              )}
              {repeat !== "off" && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-encore-accent" />
              )}
            </button>
          </div>

          {/* Progress Bar (drag-safe, mono timecodes) */}
          <div className="group flex w-full items-center gap-2.5">
            <span className="w-10 text-right font-mono text-[11px] tabular-nums text-encore-muted">
              {formatTime(displayedTime)}
            </span>
            <div className="relative flex h-3 flex-1 items-center">
              <div className="h-1 w-full overflow-hidden rounded-full bg-encore-rail">
                <div
                  className="h-full rounded-full bg-encore-accent transition-colors duration-150"
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
                aria-label="Playback position"
                className="encore-slider absolute inset-0 h-full w-full"
              />
            </div>
            <span className="w-10 font-mono text-[11px] tabular-nums text-encore-muted">
              {formatTime(safeDuration)}
            </span>
          </div>
        </div>

        {/* Right: Radio, EQ, Download, Sleep, Panel Toggles, Volume, Fullscreen */}
        <div
          data-testid="general-controls"
          className="flex shrink-0 items-center justify-end gap-0.5 lg:w-[29%] lg:min-w-[290px] xl:gap-1"
        >
          {currentTrack && !currentTrack.localUrl && !currentTrack.offlineId && (
            <button
              type="button"
              onClick={() => {
                void fetchRadioForTrack(currentTrack.id);
                showToast(`Added similar radio tracks to queue`, "success");
              }}
              title="Start Song Radio"
              aria-label="Start Song Radio"
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-encore-subdued transition-colors duration-150 hover:bg-encore-elevated hover:text-encore-accent xl:inline-flex"
            >
              <Radio className="h-4 w-4" strokeWidth={1.6} />
            </button>
          )}

          <Link
            href="/settings#equalizer"
            title="5-Band Equalizer"
            aria-label="5-Band Equalizer"
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-encore-subdued transition-colors duration-150 hover:bg-encore-elevated hover:text-encore-accent xl:inline-flex"
          >
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.6} />
          </Link>

          <button
            type="button"
            disabled={!currentTrack || isDownloading}
            onClick={() => void handleDownloadAction()}
            title={
              isWeb
                ? "Get Android / Windows app for 1-click offline downloads"
                : isOfflineSaved
                  ? "Export offline file to device"
                  : "1-click fast download offline"
            }
            aria-label="Download track"
            className={cn(
              "inline-flex h-9 min-w-[36px] shrink-0 items-center justify-center gap-1 rounded-full px-1.5 transition-colors duration-150 hover:bg-encore-elevated disabled:opacity-35",
              isOfflineSaved
                ? "text-encore-accent"
                : "text-encore-subdued hover:text-encore-accent"
            )}
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-encore-accent" />
                {activeDownload && (
                  <span className="font-mono text-[10px] font-semibold tabular-nums text-encore-accent">
                    {activeDownload.progress}%
                  </span>
                )}
              </>
            ) : isOfflineSaved ? (
              <Check className="h-4 w-4 text-encore-accent" strokeWidth={2} />
            ) : (
              <Download className="h-4 w-4" strokeWidth={1.6} />
            )}
          </button>

          {/* Sleep Timer */}
          <div ref={sleepWrapRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setSleepMenuOpen((o) => !o)}
              title="Sleep Timer"
              aria-label="Sleep Timer"
              aria-expanded={sleepMenuOpen}
              className={cn(
                "flex h-9 min-w-[36px] items-center justify-center gap-1 rounded-full px-1.5 transition-colors duration-150 hover:bg-encore-elevated",
                sleepTimerEndsAt || sleepAtTrackEnd
                  ? "text-encore-accent"
                  : "text-encore-subdued hover:text-encore-text"
              )}
            >
              <Moon className="h-4 w-4" strokeWidth={1.6} />
              {sleepBadgeText && (
                <span className="hidden font-mono text-[10px] font-medium tabular-nums xl:inline">
                  {sleepBadgeText}
                </span>
              )}
            </button>

            {sleepMenuOpen && (
              <div className="absolute bottom-11 right-0 z-50 w-44 rounded-2xl border-0 bg-encore-elevated/95 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                <p className="px-2.5 py-1 text-xs font-medium text-encore-muted">
                  Sleep timer
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSleepAtTrackEnd(true);
                    setSleepMenuOpen(false);
                    showToast("Sleep timer set to end of track", "success");
                  }}
                  className="flex w-full items-center justify-between rounded-[8px] px-2.5 py-1.5 text-left text-xs text-encore-text transition-colors hover:bg-encore-elevated-highlight"
                >
                  <span>End of track</span>
                  {sleepAtTrackEnd && (
                    <Check className="h-3.5 w-3.5 text-encore-accent" />
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
                          ? `Sleep timer set for ${opt.minutes}m`
                          : "Sleep timer off"
                      );
                    }}
                    className="flex w-full items-center justify-between rounded-[8px] px-2.5 py-1.5 text-left text-xs text-encore-text transition-colors hover:bg-encore-elevated-highlight"
                  >
                    <span>{opt.label}</span>
                    {opt.minutes === null &&
                      !sleepTimerEndsAt &&
                      !sleepAtTrackEnd && (
                        <Check className="h-3.5 w-3.5 text-encore-accent" />
                      )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => toggleRightTab("now-playing")}
            title="Now Playing panel"
            aria-label="Now Playing panel"
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150 hover:bg-encore-elevated",
              rightTab === "now-playing"
                ? "text-encore-accent"
                : "text-encore-subdued hover:text-encore-text"
            )}
          >
            <PanelRight className="h-4 w-4" strokeWidth={1.6} />
          </button>

          <button
            type="button"
            onClick={() => toggleRightTab("lyrics")}
            title="Lyrics panel"
            aria-label="Lyrics panel"
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150 hover:bg-encore-elevated",
              rightTab === "lyrics"
                ? "text-encore-accent"
                : "text-encore-subdued hover:text-encore-text"
            )}
          >
            <Mic2 className="h-4 w-4" strokeWidth={1.6} />
          </button>

          <button
            type="button"
            onClick={() => toggleRightTab("queue")}
            title="Queue panel (Q)"
            aria-label="Queue panel"
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150 hover:bg-encore-elevated",
              rightTab === "queue"
                ? "text-encore-accent"
                : "text-encore-subdued hover:text-encore-text"
            )}
          >
            <ListMusic className="h-4 w-4" strokeWidth={1.6} />
          </button>

          <div className="group hidden w-24 shrink-0 items-center gap-1 lg:flex xl:w-28">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
              title="Mute / Unmute (M)"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-encore-subdued transition-colors hover:bg-encore-elevated hover:text-encore-text"
            >
              {effectiveVolume === 0 ? (
                <VolumeX className="h-4 w-4" strokeWidth={1.6} />
              ) : effectiveVolume < 50 ? (
                <Volume1 className="h-4 w-4" strokeWidth={1.6} />
              ) : (
                <Volume2 className="h-4 w-4" strokeWidth={1.6} />
              )}
            </button>

            <div className="relative flex h-3 flex-1 items-center">
              <div className="h-1 w-full overflow-hidden rounded-full bg-encore-rail">
                <div
                  className="h-full rounded-full bg-encore-accent transition-colors"
                  style={{ width: `${effectiveVolume}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={effectiveVolume}
                onChange={(e) => setVolume(Number(e.target.value))}
                aria-label="Volume"
                className="encore-slider absolute inset-0 h-full w-full"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={!currentTrack}
            onClick={() =>
              window.dispatchEvent(new Event("sangeet:open-fullscreen"))
            }
            title="Fullscreen Cinema Mode (F)"
            aria-label="Fullscreen Cinema Mode"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-encore-subdued transition-colors duration-150 hover:bg-encore-elevated hover:text-encore-text disabled:opacity-35"
          >
            <Maximize2 className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>
      </footer>
    </>
  );
}
