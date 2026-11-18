"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Disc3,
  Download,
  FileDown,
  Heart,
  HeartOff,
  ListEnd,
  ListPlus,
  LoaderCircle,
  MoreHorizontal,
  Play,
  PlusCircle,
  Trash2,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/types";
import { getAlbum, getArtist } from "@/lib/catalog";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { useUIStore, toast } from "@/store/ui-store";
import { isAndroidNativeApp } from "@/lib/android-bridge";
import {
  canDownloadOffline,
  exportTrackAudioFile,
  isOfflineAvailable,
  removeOfflineTrack,
  saveTrackOffline,
  subscribeOfflineChanges,
} from "@/lib/offline-audio";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TrackContextMenuProps {
  track: Track;
  className?: string;
  align?: "start" | "center" | "end";
  onRemove?: () => void;
  removeLabel?: string;
  includeNavigation?: boolean;
}

export function TrackContextMenu({
  track,
  className,
  align = "end",
  onRemove,
  removeLabel = "Remove from playlist",
  includeNavigation = true,
}: TrackContextMenuProps) {
  const router = useRouter();
  const liked = useLibraryStore((state) => state.likedTrackIds.includes(track.id));
  const toggleLike = useLibraryStore((state) => state.toggleLike);
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const addToQueue = usePlayerStore((state) => state.addToQueue);
  const playNext = usePlayerStore((state) => state.playNext);
  const openAddToPlaylist = useUIStore((state) => state.openAddToPlaylist);
  const album = getAlbum(track.albumId);
  const artist = getArtist(track.artistId);
  const isCurrent = currentTrackId === track.id;
  const [canSaveOffline, setCanSaveOffline] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number; pointerType: string } | null>(null);

  useEffect(() => {
    setCanSaveOffline(canDownloadOffline(track));
  }, [track]);

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`More options for ${track.title}`}
          onPointerDown={(e) => {
            pointerStartRef.current = {
              x: e.clientX,
              y: e.clientY,
              pointerType: e.pointerType,
            };
            if (e.pointerType === "touch") {
              // Prevent Radix's pointer-down auto-open so horizontal touch swipes do not open the menu.
              e.preventDefault();
            }
          }}
          onPointerCancel={() => {
            pointerStartRef.current = null;
          }}
          onClick={(e) => {
            e.stopPropagation();
            const start = pointerStartRef.current;
            pointerStartRef.current = null;
            if (start) {
              if (start.pointerType !== "touch") {
                return;
              }
              if (Math.hypot(e.clientX - start.x, e.clientY - start.y) >= 8) {
                return;
              }
            }
            setMenuOpen((prev) => !prev);
          }}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary data-[state=open]:bg-white/[.07] data-[state=open]:text-foreground",
            className,
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-[235px]">
        <DropdownMenuItem onSelect={() => playTrack(track.id, [track.id], track.title)}>
          <Play className="h-3.5 w-3.5" />
          {isCurrent && isPlaying ? "Restart track" : "Play now"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            const added = playNext(track.id);
            toast.show(
              added ? "Playing next" : "Already queued",
              added ? `${track.title} will play after the current track.` : "This track is already in the queue.",
              added ? "success" : "info",
            );
          }}
        >
          <ListPlus className="h-3.5 w-3.5" />
          Play next
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            const added = addToQueue(track.id);
            toast.show(
              added ? "Added to queue" : "Already in queue",
              added ? `${track.title} by ${artist?.name ?? "Unknown artist"}.` : "This track is already lined up.",
              added ? "success" : "info",
            );
          }}
        >
          <ListEnd className="h-3.5 w-3.5" />
          Add to queue
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => toggleLike(track.id)}>
          {liked ? <HeartOff className="h-3.5 w-3.5" /> : <Heart className="h-3.5 w-3.5" />}
          {liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openAddToPlaylist(track.id)}>
          <PlusCircle className="h-3.5 w-3.5" />
          Add to playlist
        </DropdownMenuItem>
        {canSaveOffline && (
          <>
            <OfflineDownloadItem track={track} />
            <ExportAudioItem track={track} artistName={artist?.name ?? "Sangeet"} />
          </>
        )}
        {includeNavigation && (
          <>
            <DropdownMenuSeparator />
            {album && (
              <DropdownMenuItem onSelect={() => router.push(`/album/${album.id}`)}>
                <Disc3 className="h-3.5 w-3.5" />
                Go to album
              </DropdownMenuItem>
            )}
            {artist && (
              <DropdownMenuItem onSelect={() => router.push(`/artist/${artist.id}`)}>
                <UserRound className="h-3.5 w-3.5" />
                Go to artist
              </DropdownMenuItem>
            )}
          </>
        )}
        {onRemove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onRemove}>
              <span className="flex h-3.5 w-3.5 items-center justify-center">−</span>
              {removeLabel}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OfflineDownloadItem({ track }: { track: Track }) {
  const artist = getArtist(track.artistId);
  const [downloaded, setDownloaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const syncAvailability = () => {
      void isOfflineAvailable(track)
        .then((available) => {
          if (active) setDownloaded(available);
        })
        .catch(() => undefined);
    };
    syncAvailability();
    const unsubscribe = subscribeOfflineChanges(syncAvailability);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [track]);

  const toggleDownload = async () => {
    setBusy(true);
    setProgress(null);
    try {
      if (downloaded) {
        await removeOfflineTrack(track);
        setDownloaded(false);
        toast.success("Removed offline copy", track.title);
      } else {
        await saveTrackOffline(track, artist?.name ?? "Sangeet", (pct) => {
          setProgress(Math.max(0, Math.min(100, Math.round(pct))));
        });
        setDownloaded(true);
        toast.success("Saved for offline listening", track.title);
      }
    } catch (error) {
      toast.error(
        "Offline save failed",
        error instanceof Error ? error.message : "Try again when you’re online.",
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <DropdownMenuItem disabled={busy} onSelect={() => void toggleDownload()}>
      {busy ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      ) : downloaded ? (
        <Trash2 className="h-3.5 w-3.5" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {busy
        ? progress !== null && progress > 0
          ? `Saving offline… ${progress}%`
          : "Saving offline…"
        : downloaded
          ? "Remove offline copy"
          : "Download for offline"}
    </DropdownMenuItem>
  );
}

function ExportAudioItem({ track, artistName }: { track: Track; artistName: string }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportTrackAudioFile(track, artistName);
      toast.success(
        isAndroidNativeApp() ? "Download started" : "Exported audio file",
        isAndroidNativeApp() ? track.title : `${track.title} saved to Downloads.`,
      );
    } catch (error) {
      toast.error(
        "Export failed",
        error instanceof Error ? error.message : "Could not export this audio file.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenuItem disabled={exporting} onSelect={() => void handleExport()}>
      {exporting ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileDown className="h-3.5 w-3.5" />
      )}
      {exporting ? "Exporting audio…" : "Export audio file"}
    </DropdownMenuItem>
  );
}
