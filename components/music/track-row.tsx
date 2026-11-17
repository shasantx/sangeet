"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Download, LoaderCircle, Pause, Play } from "lucide-react";
import type { Track } from "@/lib/types";
import { getAlbum, getArtist } from "@/lib/catalog";
import {
  canDownloadOffline,
  isOfflineAvailable,
  removeOfflineTrack,
  saveTrackOffline,
  subscribeOfflineChanges,
} from "@/lib/offline-audio";
import { cn, formatDuration } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import { toast } from "@/store/ui-store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Artwork } from "./artwork";
import { Equalizer } from "./equalizer";
import { LikeButton } from "./like-button";
import { TrackContextMenu } from "./track-context-menu";

interface TrackRowProps {
  track: Track;
  index?: number;
  contextIds?: string[];
  contextLabel?: string;
  showIndex?: boolean;
  showAlbum?: boolean;
  showArtwork?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
}

export const TrackRow = React.memo(function TrackRow({
  track,
  index,
  contextIds,
  contextLabel,
  showIndex = true,
  showAlbum = true,
  showArtwork = true,
  onRemove,
  removeLabel,
  className,
}: TrackRowProps) {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const artist = getArtist(track.artistId);
  const album = getAlbum(track.albumId);
  const isCurrent = currentTrackId === track.id;
  const queue = contextIds && contextIds.length > 0 ? contextIds : [track.id];

  const [canSaveOffline, setCanSaveOffline] = React.useState(false);
  const [offline, setOffline] = React.useState(false);
  const [savingOffline, setSavingOffline] = React.useState(false);
  const [downloadPct, setDownloadPct] = React.useState<number | null>(null);

  React.useEffect(() => {
    setCanSaveOffline(canDownloadOffline(track));
  }, [track]);

  React.useEffect(() => {
    if (!canSaveOffline) {
      setOffline(false);
      return;
    }
    let active = true;
    const syncStatus = () => {
      void isOfflineAvailable(track)
        .then((available) => {
          if (active) setOffline(available);
        })
        .catch(() => undefined);
    };
    syncStatus();
    const unsubscribe = subscribeOfflineChanges(syncStatus);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [canSaveOffline, track]);

  const handlePlay = () => {
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track.id, queue, contextLabel ?? track.title);
    }
  };

  const handleQuickOfflineToggle = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!canSaveOffline || savingOffline) return;
    setSavingOffline(true);
    setDownloadPct(null);
    try {
      if (offline) {
        await removeOfflineTrack(track);
        setOffline(false);
        toast.success("Removed offline copy", track.title);
      } else {
        await saveTrackOffline(track, artist?.name ?? "Sangeet", (pct) => {
          setDownloadPct(Math.max(0, Math.min(100, Math.round(pct))));
        });
        setOffline(true);
        toast.success("Saved for offline listening", track.title);
      }
    } catch (error) {
      toast.error(
        "Offline save failed",
        error instanceof Error ? error.message : "Try again when you’re online.",
      );
    } finally {
      setSavingOffline(false);
      setDownloadPct(null);
    }
  };

  return (
    <div
      className={cn(
        "group relative flex min-h-[60px] min-w-0 items-center gap-3 rounded-lg py-2.5 pl-2 pr-1.5 transition-colors duration-200 hover:bg-white/[.06]",
        isCurrent && "bg-primary/[0.08] hover:bg-primary/[0.12]",
        className,
      )}
      aria-current={isCurrent ? "true" : undefined}
    >
      {showIndex && (
        <button
          type="button"
          onClick={handlePlay}
          className="hidden h-6 w-5 shrink-0 items-center justify-center text-right font-sans text-xs tabular-nums text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex"
          aria-label={`${isCurrent && isPlaying ? "Pause" : "Play"} ${track.title}`}
        >
          {isCurrent ? (
            <Equalizer playing={isPlaying} className="mr-0.5" />
          ) : (
            <>
              <span className="group-hover:hidden">{typeof index === "number" ? index + 1 : ""}</span>
              <Play className="hidden h-3 w-3 fill-current group-hover:block" />
            </>
          )}
        </button>
      )}

      {showArtwork && (
        <button
          type="button"
          onClick={handlePlay}
          className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`${isCurrent && isPlaying ? "Pause" : "Play"} ${track.title}`}
        >
          <Artwork
            src={track.artwork}
            alt={`${album?.title ?? track.title} artwork`}
            res="sm"
            className="h-full w-full rounded-md"
          />
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity",
              isCurrent
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            )}
          >
            {isCurrent && isPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
          </span>
        </button>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={handlePlay}
            className={cn(
              "min-w-0 truncate text-left text-[13px] font-medium leading-5 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isCurrent ? "text-primary font-semibold" : "text-foreground",
            )}
          >
            {track.title}
          </button>
          {track.explicit && (
            <span className="rounded bg-white/[.1] px-1 py-0.5 text-[8px] font-semibold text-muted-foreground">
              E
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {artist ? (
            <Link href={`/artist/${artist.id}`} className="truncate transition hover:text-foreground hover:underline">
              {artist.name}
            </Link>
          ) : (
            <span>Unknown artist</span>
          )}
          <span className="text-muted-foreground/40 md:hidden">·</span>
          <span className="shrink-0 tabular-nums md:hidden">{formatDuration(track.duration)}</span>
        </div>
      </div>

      {showAlbum && album && (
        <div className="hidden w-[22%] min-w-0 md:block">
          <Link
            href={`/album/${album.id}`}
            className="block truncate text-xs text-muted-foreground transition hover:text-foreground hover:underline"
          >
            {album.title}
          </Link>
        </div>
      )}

      {canSaveOffline && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={savingOffline}
              onClick={(event) => void handleQuickOfflineToggle(event)}
              aria-label={
                savingOffline
                  ? `Saving ${track.title} offline`
                  : offline
                    ? `Remove offline copy of ${track.title}`
                    : `Download ${track.title} for offline`
              }
              aria-pressed={offline}
              className={cn(
                "flex min-h-[42px] min-w-[42px] shrink-0 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:h-8 md:w-8 md:min-h-0 md:min-w-0",
                offline
                  ? "text-primary opacity-100 hover:bg-primary/10"
                  : savingOffline
                    ? "text-primary opacity-100"
                    : "text-muted-foreground opacity-100 hover:bg-white/[.06] hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100",
              )}
            >
              {savingOffline ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : offline ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {savingOffline
              ? downloadPct !== null && downloadPct > 0
                ? `Saving offline… ${downloadPct}%`
                : "Saving offline…"
              : offline
                ? "Saved offline · Click to remove"
                : "Download for offline"}
          </TooltipContent>
        </Tooltip>
      )}

      <LikeButton
        trackId={track.id}
        size="sm"
        className="hidden min-h-[42px] min-w-[42px] sm:flex md:h-8 md:w-8 md:min-h-0 md:min-w-0"
      />
      <span className="hidden w-10 shrink-0 text-right font-sans text-xs tabular-nums text-muted-foreground sm:block">
        {formatDuration(track.duration)}
      </span>
      <TrackContextMenu
        track={track}
        onRemove={onRemove}
        removeLabel={removeLabel}
        className="min-h-[42px] min-w-[42px] md:h-8 md:w-8 md:min-h-0 md:min-w-0"
      />
    </div>
  );
});
