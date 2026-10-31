"use client";

import { Minimize2, Theater } from "lucide-react";
import { getTrack } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";

interface SongVideoToggleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

/** Switches the visible YouTube embed between compact and theater layouts. */
export function SongVideoToggle({ className, size = "md" }: SongVideoToggleProps) {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const videoMode = usePlayerStore((state) => state.videoMode);
  const setVideoMode = usePlayerStore((state) => state.setVideoMode);
  const current = currentTrackId ? getTrack(currentTrackId) : undefined;
  if (!current?.youtubeId) return null;

  const compact = size === "sm";
  const large = size === "lg";
  return (
    <div role="group" aria-label="YouTube player size" className={cn("inline-flex items-center rounded-full border border-white/[.08] bg-black/40 p-1", className)}>
      <button type="button" onClick={() => setVideoMode(false)} aria-pressed={!videoMode} className={cn("inline-flex items-center gap-1.5 rounded-full font-medium transition", compact ? "px-2.5 py-1 text-[10px]" : large ? "px-4 py-1.5 text-xs" : "px-3 py-1.5 text-[11px]", !videoMode ? "bg-white text-black" : "text-muted-foreground hover:text-foreground")}>
        <Minimize2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /><span>Compact</span>
      </button>
      <button type="button" onClick={() => setVideoMode(true)} aria-pressed={videoMode} className={cn("inline-flex items-center gap-1.5 rounded-full font-medium transition", compact ? "px-2.5 py-1 text-[10px]" : large ? "px-4 py-1.5 text-xs" : "px-3 py-1.5 text-[11px]", videoMode ? "bg-[#ff0000] text-white" : "text-muted-foreground hover:text-foreground")}>
        <Theater className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /><span>Theater</span>
      </button>
    </div>
  );
}
