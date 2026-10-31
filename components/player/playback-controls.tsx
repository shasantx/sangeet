"use client";

import { Loader2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PlaybackControlsProps {
  size?: "compact" | "large";
  showExtras?: boolean;
  className?: string;
}

export function PlaybackControls({
  size = "compact",
  showExtras = true,
  className,
}: PlaybackControlsProps) {
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isLoading = usePlayerStore((state) => state.isLoading);
  const shuffle = usePlayerStore((state) => state.shuffle);
  const repeat = usePlayerStore((state) => state.repeat);
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const queueLength = usePlayerStore((state) => state.queue.length);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const next = usePlayerStore((state) => state.next);
  const previous = usePlayerStore((state) => state.previous);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const cycleRepeat = usePlayerStore((state) => state.cycleRepeat);

  const large = size === "large";
  const playSize = large ? "h-[68px] w-[68px]" : "h-10 w-10";
  const iconSize = large ? "h-7 w-7" : "h-4 w-4";
  const sideSize = large ? "h-11 w-11" : "h-8 w-8";
  const sideIcon = large ? "h-5 w-5" : "h-[17px] w-[17px]";

  const shuffleButton = (
    <button
      type="button"
      aria-label={shuffle ? "Turn shuffle off" : "Turn shuffle on"}
      aria-pressed={shuffle}
      onClick={toggleShuffle}
      className={cn(
        "relative flex items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        sideSize,
        shuffle ? "text-[#1ED760]" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Shuffle className={sideIcon} strokeWidth={1.8} />
      {shuffle && (
        <span className="absolute bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-[#1ED760]" />
      )}
    </button>
  );

  const repeatButton = (
    <button
      type="button"
      aria-label={`Repeat ${repeat === "off" ? "off" : repeat === "all" ? "all" : "one"}`}
      aria-pressed={repeat !== "off"}
      onClick={cycleRepeat}
      className={cn(
        "relative flex items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        sideSize,
        repeat !== "off" ? "text-[#1ED760]" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {repeat === "one" ? (
        <Repeat1 className={sideIcon} strokeWidth={1.8} />
      ) : (
        <Repeat className={sideIcon} strokeWidth={1.8} />
      )}
      {repeat !== "off" && (
        <span className="absolute bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-[#1ED760]" />
      )}
    </button>
  );

  return (
    <div className={cn("flex items-center justify-center gap-1.5 sm:gap-2.5", className)}>
      {showExtras &&
        (large ? (
          <Tooltip>
            <TooltipTrigger asChild>{shuffleButton}</TooltipTrigger>
            <TooltipContent>{shuffle ? "Shuffle on" : "Shuffle"}</TooltipContent>
          </Tooltip>
        ) : (
          shuffleButton
        ))}
      <button
        type="button"
        aria-label="Previous track"
        onClick={previous}
        disabled={!currentTrackId && queueLength === 0}
        className={cn(
          "flex items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-35",
          sideSize,
        )}
      >
        <SkipBack className={sideIcon} fill="currentColor" strokeWidth={1.2} />
      </button>
      <button
        type="button"
        aria-label={isPlaying ? "Pause" : "Play"}
        onClick={togglePlay}
        className={cn(
          "flex items-center justify-center rounded-full bg-foreground text-background shadow-lg transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95",
          playSize,
        )}
      >
        {isLoading ? (
          <Loader2 className={cn(iconSize, "animate-spin")} strokeWidth={2} />
        ) : isPlaying ? (
          <Pause className={cn(iconSize, "fill-current")} strokeWidth={0} />
        ) : (
          <Play className={cn(iconSize, "ml-0.5 fill-current")} strokeWidth={0} />
        )}
      </button>
      <button
        type="button"
        aria-label="Next track"
        onClick={() => next()}
        disabled={!currentTrackId && queueLength === 0}
        className={cn(
          "flex items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-35",
          sideSize,
        )}
      >
        <SkipForward className={sideIcon} fill="currentColor" strokeWidth={1.2} />
      </button>
      {showExtras &&
        (large ? (
          <Tooltip>
            <TooltipTrigger asChild>{repeatButton}</TooltipTrigger>
            <TooltipContent>
              Repeat {repeat === "off" ? "off" : repeat === "all" ? "all" : "one"}
            </TooltipContent>
          </Tooltip>
        ) : (
          repeatButton
        ))}
    </div>
  );
}
