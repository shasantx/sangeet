"use client";

import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";

interface PlayButtonProps {
  trackIds: string[];
  label: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "primary" | "ghost" | "glass";
}

export function PlayButton({
  trackIds,
  label,
  className,
  size = "md",
  variant = "primary",
}: PlayButtonProps) {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const isActive = Boolean(currentTrackId && trackIds.includes(currentTrackId));
  const showingPause = isActive && isPlaying;
  const sizes = {
    sm: "h-9 w-9",
    md: "h-11 w-11",
    lg: "h-14 w-14",
    xl: "h-16 w-16",
  };
  const icons = {
    sm: "h-4 w-4",
    md: "h-[18px] w-[18px]",
    lg: "h-6 w-6",
    xl: "h-7 w-7",
  };
  const variants = {
    primary:
      "bg-[#1ED760] text-black font-bold shadow-[0_12px_30px_-10px_rgba(29,185,84,.75)] hover:scale-105 hover:bg-[#46E982]",
    ghost: "bg-white/[.08] text-foreground backdrop-blur hover:bg-white/[.14]",
    glass: "bg-black/35 text-white backdrop-blur-md border border-white/10 hover:bg-black/55",
  };

  return (
    <button
      type="button"
      aria-label={`${showingPause ? "Pause" : "Play"} ${label}`}
      disabled={trackIds.length === 0}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isActive) {
          togglePlay();
          return;
        }
        playTrack(trackIds[0], trackIds, label);
      }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40",
        sizes[size],
        variants[variant],
        className,
      )}
    >
      {showingPause ? (
        <Pause className={cn(icons[size], "fill-current")} strokeWidth={0} />
      ) : (
        <Play className={cn(icons[size], "ml-0.5 fill-current")} strokeWidth={0} />
      )}
    </button>
  );
}
