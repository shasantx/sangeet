"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Download,
  GripVertical,
  Heart,
  Link2,
  ListPlus,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  PlaySquare,
  Radio
} from "lucide-react";
import type { Track } from "@/types/music";
import { TrackArtwork } from "@/components/music/track-artwork";
import { usePlayerStore } from "@/store/player-store";
import { useLibraryStore } from "@/store/library-store";
import { useOfflineStore } from "@/store/offline-store";
import { useUIStore } from "@/store/ui-store";
import { useToastStore } from "@/store/toast-store";
import { usePlatform } from "@/lib/platform";
import { useClickOutside } from "@/lib/use-click-outside";
import { cn, formatTime } from "@/lib/utils";

interface TrackRowProps {
  track: Track;
  index: number;
  contextQueue?: Track[];
  showAlbum?: boolean;
  onRemove?: () => void;
  draggable?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}

export function TrackRow({
  track,
  index,
  contextQueue,
  showAlbum = true,
  onRemove,
  draggable = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd
}: TrackRowProps) {
  const { isWeb, isNative } = usePlatform();
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const playNext = usePlayerStore((s) => s.playNext);
  const toggleQueueTrack = usePlayerStore((s) => s.toggleQueueTrack);
  const fetchRadioForTrack = usePlayerStore((s) => s.fetchRadioForTrack);

  const likedTracks = useLibraryStore((s) => s.likedTracks);
  const playlists = useLibraryStore((s) => s.playlists);
  const toggleLike = useLibraryStore((s) => s.toggleLike);
  const addTrackToPlaylist = useLibraryStore((s) => s.addTrackToPlaylist);

  const offlineItems = useOfflineStore((s) => s.items);
  const nativeOfflineItems = useOfflineStore((s) => s.nativeItems);
  const activeDownloads = useOfflineStore((s) => s.downloads);
  const downloadTrackOneClick = useOfflineStore((s) => s.downloadTrackOneClick);
  const exportOfflineTrack = useOfflineStore((s) => s.exportOfflineTrack);
  const openDownloadAppModal = useUIStore((s) => s.openDownloadAppModal);
  const showToast = useToastStore((s) => s.showToast);

  const [menuOpen, setMenuOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useClickOutside(menuWrapRef, menuOpen, closeMenu);

  const isCurrent = currentTrack?.id === track.id;
  const inQueue = queue.some((q) => q.id === track.id);
  const isLiked = likedTracks.some((t) => t.id === track.id);
  const savedOfflineRecord = offlineItems.find(
    (i) => i.id === track.offlineId || i.id === `dl_${track.id}`
  );
  const savedNativeRecord = nativeOfflineItems.find((i) => i.id === track.id);
  const isSavedOffline = Boolean(
    track.offlineId || savedOfflineRecord || savedNativeRecord
  );
  const activeDownload = activeDownloads[track.id];
  const isDownloading = Boolean(
    activeDownload && activeDownload.status === "downloading"
  );

  const toggleMenu = (triggerEl?: HTMLElement | null) => {
    if (!menuOpen && triggerEl) {
      const rect = triggerEl.getBoundingClientRect();
      setOpenUpward(window.innerHeight - rect.bottom < 300);
    }
    setMenuOpen((o) => !o);
  };

  const handleRowPlay = () => {
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track, contextQueue);
    }
  };

  const handleLike = () => {
    const likedNow = toggleLike(track);
    showToast(
      likedNow ? "Saved to Liked Songs" : "Removed from Liked Songs",
      likedNow ? "success" : "default"
    );
  };

  const handleDownload = async () => {
    setMenuOpen(false);
    if (isWeb) {
      openDownloadAppModal(
        `1-click fast offline downloads are available in the Sangeet Android APK and Windows Rust app.`
      );
      return;
    }
    if (isSavedOffline) {
      const targetId =
        track.offlineId || savedOfflineRecord?.id || savedNativeRecord?.id || track.id;
      const ok = await exportOfflineTrack(targetId);
      showToast(
        ok ? `Saved "${track.title}" to device` : "Already saved offline",
        ok ? "success" : "default"
      );
      return;
    }
    showToast(`Downloading "${track.title}"...`);
    const ok = await downloadTrackOneClick(track);
    showToast(
      ok
        ? `Downloaded "${track.title}" for offline playback`
        : "Download could not complete",
      ok ? "success" : "error"
    );
  };

  const handleShare = async () => {
    const url =
      track.localUrl || track.offlineId
        ? window.location.href
        : track.source === "audius"
          ? `https://audius.co/tracks/${track.id}`
          : `https://music.youtube.com/watch?v=${track.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Track link copied to clipboard", "success");
    } catch {
      showToast("Could not copy link", "error");
    }
    setMenuOpen(false);
  };

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onDoubleClick={handleRowPlay}
      onContextMenu={(e) => {
        e.preventDefault();
        setOpenUpward(window.innerHeight - e.clientY < 300);
        setMenuOpen(true);
      }}
      className={cn(
        "group relative grid items-center gap-2 rounded-xl px-2 py-2 text-sm transition-colors duration-150 hover:bg-encore-hover sm:gap-3 sm:px-3",
        showAlbum
          ? "grid-cols-[28px_1fr_auto] sm:grid-cols-[28px_1fr_minmax(0,0.55fr)_auto]"
          : "grid-cols-[28px_1fr_auto] sm:grid-cols-[28px_1fr_auto]",
        isCurrent && "bg-encore-tinted/75",
        isDragOver && "bg-encore-accent/15"
      )}
    >
      {/* Index / Play toggle / Eq */}
      <button
        type="button"
        onClick={handleRowPlay}
        aria-label={isCurrent && isPlaying ? "Pause" : `Play ${track.title}`}
        className="flex h-8 w-8 items-center justify-center text-encore-subdued"
      >
        {isCurrent && isPlaying ? (
          <span className="flex h-3.5 items-end gap-[2px] group-hover:hidden">
            <span className="w-[3px] animate-eq-1 rounded-full bg-encore-accent" />
            <span className="w-[3px] animate-eq-2 rounded-full bg-encore-accent" />
            <span className="w-[3px] animate-eq-3 rounded-full bg-encore-accent" />
          </span>
        ) : (
          <span
            className={cn(
              "font-mono text-xs tabular-nums group-hover:hidden",
              isCurrent
                ? "font-semibold text-encore-accent"
                : "text-encore-muted"
            )}
          >
            {index + 1}
          </span>
        )}
        <span className="hidden text-encore-accent group-hover:inline-flex">
          {isCurrent && isPlaying ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="h-4 w-4 fill-current" />
          )}
        </span>
      </button>

      {/* Artwork + Title + Artist */}
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        {draggable && (
          <span
            title="Drag to reorder"
            className="hidden cursor-grab text-encore-subdued/60 hover:text-encore-text active:cursor-grabbing sm:inline-flex"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        )}
        <TrackArtwork
          src={track.thumbnail}
          trackId={track.id}
          alt={track.title}
          className="h-10 w-10 shrink-0 rounded-lg shadow-sm"
        />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={handleRowPlay}
            className={cn(
              "block max-w-full truncate text-left font-medium hover:underline",
              isCurrent ? "text-encore-accent" : "text-encore-text"
            )}
          >
            {track.title}
          </button>
          <div className="flex items-center gap-1.5 text-xs text-encore-subdued">
            {track.explicit && (
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] bg-encore-muted/30 text-[10px] font-bold text-encore-text">
                E
              </span>
            )}
            {track.artistId ? (
              <Link
                href={`/artist/${encodeURIComponent(track.artistId)}?name=${encodeURIComponent(track.artist)}`}
                className="truncate hover:text-encore-accent hover:underline"
              >
                {track.artist}
              </Link>
            ) : (
              <span className="truncate">{track.artist}</span>
            )}
          </div>
        </div>
      </div>

      {/* Album */}
      {showAlbum && (
        <div className="hidden min-w-0 truncate text-xs text-encore-subdued sm:block">
          {track.album && track.albumId ? (
            <Link
              href={`/album/${encodeURIComponent(track.albumId)}?title=${encodeURIComponent(track.album)}`}
              className="hover:text-encore-accent hover:underline"
            >
              {track.album}
            </Link>
          ) : (
            track.album || "—"
          )}
        </div>
      )}

      {/* Actions + Duration */}
      <div className="relative flex items-center justify-end gap-0.5 sm:gap-1">
        {/* Instant 1-Click Native Download button on Android & Windows */}
        {isNative && (
          <button
            type="button"
            disabled={isDownloading}
            onClick={() => void handleDownload()}
            title={
              isSavedOffline
                ? "Saved offline — tap to export"
                : "1-click fast offline download"
            }
            aria-label={
              isSavedOffline
                ? `${track.title} downloaded`
                : `Download ${track.title}`
            }
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
              isSavedOffline || isDownloading
                ? "text-encore-accent"
                : "text-encore-subdued hover:bg-encore-elevated hover:text-encore-accent"
            )}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSavedOffline ? (
              <Check className="h-4 w-4" strokeWidth={2.2} />
            ) : (
              <Download className="h-4 w-4" strokeWidth={1.7} />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={handleLike}
          aria-label={isLiked ? "Unlike" : "Like"}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
            isLiked
              ? "text-encore-accent opacity-100"
              : "text-encore-subdued opacity-100 hover:bg-encore-elevated hover:text-encore-text sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          )}
        >
          <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
        </button>

        <div ref={menuWrapRef} className="relative">
          <button
            type="button"
            onClick={(e) => toggleMenu(e.currentTarget)}
            title="More options"
            aria-label="More options"
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full text-encore-subdued opacity-100 transition hover:bg-encore-elevated hover:text-encore-text sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div
              className={cn(
                "absolute right-0 z-50 w-56 rounded-2xl bg-encore-elevated/95 p-1.5 shadow-[var(--shadow-elevated)] backdrop-blur-2xl",
                openUpward ? "bottom-10" : "top-10"
              )}
            >
              <button
                type="button"
                onClick={() => {
                  playNext(track);
                  showToast(`"${track.title}" will play next`, "success");
                  setMenuOpen(false);
                }}
                className="flex min-h-[40px] w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-encore-text hover:bg-encore-elevated-highlight"
              >
                <PlaySquare className="h-3.5 w-3.5 text-encore-accent" />
                Play next
              </button>
              <button
                type="button"
                onClick={() => {
                  const added = toggleQueueTrack(track);
                  showToast(
                    added ? "Added to queue" : "Removed from queue",
                    added ? "success" : "default"
                  );
                  setMenuOpen(false);
                }}
                className="flex min-h-[40px] w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-encore-text hover:bg-encore-elevated-highlight"
              >
                {inQueue ? (
                  <>
                    <Check
                      className="h-3.5 w-3.5 text-encore-accent"
                      strokeWidth={2.2}
                    />
                    <span className="font-medium text-encore-accent">
                      Remove from queue
                    </span>
                  </>
                ) : (
                  <>
                    <ListPlus className="h-3.5 w-3.5 text-encore-accent" />
                    Add to queue
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => void handleDownload()}
                className="flex min-h-[40px] w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-encore-text hover:bg-encore-elevated-highlight"
              >
                <Download className="h-3.5 w-3.5 text-encore-accent" />
                {isWeb
                  ? "Download in native app"
                  : isSavedOffline
                    ? "Save file to device"
                    : "Download offline"}
              </button>
              {!track.localUrl && !track.offlineId && !track.streamUrl && (
                <button
                  type="button"
                  onClick={() => {
                    playTrack(track);
                    void fetchRadioForTrack(track.id);
                    showToast(`Started radio for "${track.title}"`, "success");
                    setMenuOpen(false);
                  }}
                  className="flex min-h-[40px] w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-encore-text hover:bg-encore-elevated-highlight"
                >
                  <Radio className="h-3.5 w-3.5 text-encore-accent" />
                  Start song radio
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleShare()}
                className="flex min-h-[40px] w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-encore-text hover:bg-encore-elevated-highlight"
              >
                <Link2 className="h-3.5 w-3.5 text-encore-subdued" />
                Copy link
              </button>

              {playlists.length > 0 && (
                <>
                  <div className="my-1 h-px bg-encore-hairline" />
                  <p className="px-2.5 py-1 text-xs font-medium text-encore-muted">
                    Add to playlist
                  </p>
                  <div className="max-h-32 overflow-y-auto">
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => {
                          addTrackToPlaylist(pl.id, track);
                          showToast(`Added to "${pl.name}"`, "success");
                          setMenuOpen(false);
                        }}
                        className="block min-h-[36px] w-full truncate rounded-[6px] px-2.5 py-1.5 text-left text-xs text-encore-text hover:bg-encore-elevated-highlight"
                      >
                        {pl.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {onRemove && (
                <>
                  <div className="my-1 h-px bg-encore-hairline" />
                  <button
                    type="button"
                    onClick={() => {
                      onRemove();
                      showToast("Removed from playlist");
                      setMenuOpen(false);
                    }}
                    className="block min-h-[40px] w-full rounded-[6px] px-2.5 py-2 text-left text-xs font-medium text-encore-negative hover:bg-encore-elevated-highlight"
                  >
                    Remove from playlist
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <span className="w-10 text-right font-mono text-xs tabular-nums text-encore-muted">
          {track.durationText || formatTime(track.duration)}
        </span>
      </div>
    </div>
  );
}
