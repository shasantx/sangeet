"use client";

import { Pause, Play } from "lucide-react";
import { getArtist } from "@/lib/catalog";
import type { Track } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import { Artwork } from "./artwork";
import { Equalizer } from "./equalizer";

export function QuickTrackTile({
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
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const artist = getArtist(track.artistId);
  const isCurrent = currentTrackId === track.id;

  return (
    <button
      type="button"
      onClick={() => {
        if (isCurrent) togglePlay();
        else playTrack(track.id, contextIds, contextLabel);
      }}
      className={cn(
        "group flex min-w-0 items-center gap-3 overflow-hidden rounded-lg border border-transparent bg-white/[.025] p-2 pr-3 text-left transition hover:border-white/[.06] hover:bg-white/[.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isCurrent && "border-primary/20 bg-primary/[.06]",
        className,
      )}
      aria-label={`${isCurrent && isPlaying ? "Pause" : "Play"} ${track.title}`}
    >
      <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-md">
        <Artwork src={track.artwork} alt="" priority className="h-full w-full rounded-md" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition group-hover:opacity-100">
          {isCurrent && isPlaying ? (
            <Pause className="h-4 w-4 fill-white text-white" />
          ) : (
            <Play className="h-4 w-4 fill-white text-white" />
          )}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[13px] font-bold", isCurrent ? "text-[#1ED760]" : "text-foreground")}>
          {track.title}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{artist?.name}</p>
      </div>
      {isCurrent ? (
        <Equalizer playing={isPlaying} className="mr-1 hidden sm:flex text-[#1ED760]" />
      ) : (
        <div className="h-8 w-8 rounded-full bg-[#1ED760] text-black shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0 shrink-0">
          <Play className="h-4 w-4 fill-current ml-0.5" />
        </div>
      )}
    </button>
  );
}
