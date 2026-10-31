"use client";

import { Pause, Play, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";

interface CollectionActionsProps {
  trackIds: string[];
  label: string;
  className?: string;
  size?: "default" | "lg";
}

export function CollectionPlayButton({
  trackIds,
  label,
  className,
  size = "lg",
}: CollectionActionsProps) {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const active = Boolean(currentTrackId && trackIds.includes(currentTrackId));
  const showingPause = active && isPlaying;

  return (
    <button
      type="button"
      disabled={trackIds.length === 0}
      onClick={() => {
        if (active) togglePlay();
        else playTrack(trackIds[0], trackIds, label);
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2.5 rounded-full bg-[#1ED760] text-black font-bold shadow-[0_14px_34px_-16px_rgba(29,185,84,.8)] transition hover:bg-[#46E982] hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40",
        size === "lg" ? "h-12 px-7 text-sm" : "h-10 px-5 text-xs",
        className,
      )}
    >
      {showingPause ? (
        <Pause className="h-4 w-4 fill-current" strokeWidth={0} />
      ) : (
        <Play className="h-4 w-4 fill-current" strokeWidth={0} />
      )}
      {label}
    </button>
  );
}

export function CollectionShuffleButton({
  trackIds,
  label,
  className,
}: Omit<CollectionActionsProps, "size">) {
  const playShuffled = usePlayerStore((state) => state.playShuffled);

  return (
    <button
      type="button"
      disabled={trackIds.length === 0}
      onClick={() => playShuffled(trackIds, label)}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/[.1] bg-white/[.025] px-6 text-sm font-medium text-foreground transition hover:border-white/[.18] hover:bg-white/[.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40",
        className,
      )}
    >
      <Shuffle className="h-4 w-4" />
      Shuffle
    </button>
  );
}
