"use client";

import Link from "next/link";
import { Pause, Play } from "lucide-react";
import type { Track } from "@/lib/types";
import { getAlbum, getArtist } from "@/lib/catalog";
import { cn, formatDuration } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
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

export function TrackRow({
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

  const handlePlay = () => {
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track.id, queue, contextLabel ?? track.title);
    }
  };

  return (
    <div
      className={cn(
        "group relative flex min-w-0 items-center gap-3 rounded-lg py-2 pl-2 pr-1.5 transition-colors duration-200 hover:bg-white/[.06]",
        isCurrent && "bg-[#1ED760]/[0.08] hover:bg-[#1ED760]/[0.12]",
        className,
      )}
      aria-current={isCurrent ? "true" : undefined}
    >
      {showIndex && (
        <button
          type="button"
          onClick={handlePlay}
          className="hidden h-6 w-5 shrink-0 items-center justify-center text-right text-xs tabular-nums text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex"
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
          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`${isCurrent && isPlaying ? "Pause" : "Play"} ${track.title}`}
        >
          <Artwork src={track.artwork} alt={`${album?.title ?? track.title} artwork`} className="h-full w-full rounded-md" />
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
              isCurrent ? "text-[#1ED760] font-semibold" : "text-foreground",
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

      <LikeButton trackId={track.id} size="sm" className="hidden sm:flex" />
      <span className="hidden w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
        {formatDuration(track.duration)}
      </span>
      <TrackContextMenu track={track} onRemove={onRemove} removeLabel={removeLabel} />
    </div>
  );
}
