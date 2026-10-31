"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CloudOff,
  Crown,
  Disc3,
  Download,
  Heart,
  HeartOff,
  ListEnd,
  ListPlus,
  MoreHorizontal,
  Play,
  PlusCircle,
  LoaderCircle,
  Trash2,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/types";
import { getAlbum, getArtist } from "@/lib/catalog";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { useUIStore, toast } from "@/store/ui-store";
import { useAuthStore } from "@/store/auth-store";
import { canDownloadOffline, isOfflineAvailable, removeOfflineTrack, saveTrackOffline } from "@/lib/offline-audio";
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
  const canSaveOffline = canDownloadOffline(track);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`More options for ${track.title}`}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary data-[state=open]:bg-white/[.07] data-[state=open]:text-foreground",
            className,
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-[225px]">
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
        {canSaveOffline ? <OfflineDownloadItem track={track} /> : <DropdownMenuItem disabled><CloudOff className="h-3.5 w-3.5" />Offline copy unavailable for this source</DropdownMenuItem>}
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
  const router = useRouter();
  const artist = getArtist(track.artistId);
  const session = useAuthStore((state) => state.session);
  const [downloaded, setDownloaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void isOfflineAvailable(track).then((available) => { if (active) setDownloaded(available); }).catch(() => undefined);
    return () => { active = false; };
  }, [track]);

  const toggleDownload = async () => {
    if (session?.plan !== "premium") {
      router.push("/plans");
      toast.info("Premium access required", "Offline saving is available to Premium-enabled accounts; this build does not yet sell upgrades.");
      return;
    }
    setBusy(true);
    try {
      if (downloaded) {
        await removeOfflineTrack(track);
        setDownloaded(false);
        toast.success("Removed offline copy", track.title);
      } else {
        await saveTrackOffline(track, artist?.name ?? "Sangeet");
        setDownloaded(true);
        toast.success("Saved for offline listening", track.title);
      }
    } catch (error) {
      toast.error("Offline save failed", error instanceof Error ? error.message : "Try again when you’re online.");
    } finally {
      setBusy(false);
    }
  };

  return <DropdownMenuItem disabled={busy} onSelect={() => void toggleDownload()}>
    {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : downloaded ? <Trash2 className="h-3.5 w-3.5" /> : session?.plan === "premium" ? <Download className="h-3.5 w-3.5" /> : <Crown className="h-3.5 w-3.5" />}
    {busy ? "Saving offline…" : downloaded ? "Remove offline copy" : session?.plan === "premium" ? "Download for offline" : "Premium offline listening"}
  </DropdownMenuItem>;
}
