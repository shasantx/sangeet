"use client";

import { Pause, Play } from "lucide-react";
import type { Track } from "@/types/music";
import { TrackArtwork } from "@/components/music/track-artwork";
import { usePlayerStore } from "@/store/player-store";
import { cn } from "@/lib/utils";

interface MediaCardProps {
  track: Track;
  contextQueue?: Track[];
  rounded?: "square" | "circle";
}

export function MediaCard({
  track,
  contextQueue,
  rounded = "square"
}: MediaCardProps) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.togglePlay);

  const isCurrent = currentTrack?.id === track.id;

  const handlePlay = () => {
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track, contextQueue);
    }
  };

  return (
    <button
      type="button"
      onClick={handlePlay}
      aria-label={
        isCurrent && isPlaying
          ? `Pause ${track.title} by ${track.artist}`
          : `Play ${track.title} by ${track.artist}`
      }
      className={cn(
        "group flex w-[164px] shrink-0 flex-col rounded-2xl p-3 text-left transition-all duration-200 ease-studio hover:bg-encore-elevated-highlight/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encore-accent active:scale-[0.98] sm:w-[184px]",
        isCurrent ? "bg-encore-tinted/80" : "bg-encore-elevated/55"
      )}
    >
      <div
        className={cn(
          "relative mb-3 aspect-square w-full overflow-hidden bg-encore-base shadow-[var(--shadow-elevated)]",
          rounded === "circle" ? "rounded-full" : "rounded-xl"
        )}
      >
        <TrackArtwork
          src={track.thumbnail}
          trackId={track.id}
          alt={track.title}
          className={cn(
            "h-full w-full transition-transform duration-300 ease-studio group-hover:scale-[1.04]",
            rounded === "circle" ? "rounded-full" : "rounded-xl"
          )}
          iconClassName="h-8 w-8"
        />

        {isCurrent && isPlaying && (
          <span className="absolute left-2 top-2 flex items-end gap-0.5 rounded-md bg-black/75 px-2 py-1">
            <span className="h-2.5 w-0.5 animate-eq-1 rounded-full bg-encore-accent" />
            <span className="h-2.5 w-0.5 animate-eq-2 rounded-full bg-encore-accent" />
            <span className="h-2.5 w-0.5 animate-eq-3 rounded-full bg-encore-accent" />
          </span>
        )}

        <span
          aria-hidden="true"
          className={cn(
            "btn-cobalt absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md transition-[transform,opacity] duration-150 ease-studio",
            isCurrent && isPlaying
              ? "translate-y-0 opacity-100"
              : "translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
          )}
        >
          {isCurrent && isPlaying ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="h-4 w-4 translate-x-0.5 fill-current" />
          )}
        </span>
      </div>

      <p
        className={cn(
          "w-full truncate text-sm font-medium",
          isCurrent ? "text-encore-accent" : "text-encore-text"
        )}
      >
        {track.title}
      </p>
      <p className="mt-1 line-clamp-2 w-full text-xs text-encore-subdued">
        {track.artist}
      </p>
    </button>
  );
}
