"use client";

import * as React from "react";
import { Pause, Play } from "lucide-react";
import { getArtist } from "@/lib/catalog";
import type { Track } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import { Artwork } from "./artwork";
import { Equalizer } from "./equalizer";

export const QuickTrackTile = React.memo(function QuickTrackTile({
  track,
  contextIds,
  contextLabel,
  className,
}: {
  track: Track;
  contextIds: string[];
  contextLabel: string;
  className?: string;
}) {
  const isCurrent = usePlayerStore((state) => state.currentTrackId === track.id);
  const isPlaying = usePlayerStore((state) =>
    state.currentTrackId === track.id ? state.isPlaying : false,
  );
  const playTrack = usePlayerStore((state) => state.playTrack);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const artist = getArtist(track.artistId);

  return (
    <button
      type="button"
      onClick={() => {
        if (isCurrent) togglePlay();
        else playTrack(track.id, contextIds, contextLabel);
      }}
      className={cn(
        "group flex h-[58px] min-w-0 items-center gap-2.5 overflow-hidden rounded-xl border border-white/[0.07] bg-card p-0 pr-3 text-left transition duration-150 hover:border-white/[0.14] hover:bg-elevated active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isCurrent && "border-primary/45 bg-primary/[0.08] hover:border-primary/55 hover:bg-primary/[0.11]",
        className,
      )}
      aria-label={`${isCurrent && isPlaying ? "Pause" : "Play"} ${track.title}`}
    >
      <div className="relative h-[58px] w-[58px] shrink-0 overflow-hidden rounded-none bg-elevated">
        <Artwork
          src={track.artwork}
          alt=""
          res="sm"
          priority
          className="h-full w-full rounded-none object-cover"
        />
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity",
            isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          {isCurrent && isPlaying ? (
            <Pause className="h-4 w-4 fill-white text-white" />
          ) : (
            <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
          )}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "line-clamp-2 text-[13px] font-semibold leading-tight sm:text-[13.5px]",
            isCurrent ? "text-primary" : "text-foreground",
          )}
        >
          {track.title}
        </p>
        {artist?.name && (
          <p className="mt-0.5 hidden truncate text-[11px] text-muted-foreground sm:block">
            {artist.name}
          </p>
        )}
      </div>
      {isCurrent ? (
        <Equalizer playing={isPlaying} className="mr-0.5 shrink-0 text-primary" />
      ) : (
        <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:flex">
          <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
        </span>
      )}
    </button>
  );
});
