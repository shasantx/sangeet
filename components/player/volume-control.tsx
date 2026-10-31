"use client";

import { Volume1, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePlayerStore } from "@/store/player-store";

export function VolumeControl({ className }: { className?: string }) {
  const volume = usePlayerStore((state) => state.volume);
  const muted = usePlayerStore((state) => state.muted);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const toggleMute = usePlayerStore((state) => state.toggleMute);
  const effective = muted ? 0 : volume;
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={toggleMute}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon className="h-[17px] w-[17px]" strokeWidth={1.7} />
          </button>
        </TooltipTrigger>
        <TooltipContent>{muted ? "Unmute" : "Mute"}</TooltipContent>
      </Tooltip>
      <Slider
        min={0}
        max={1}
        step={0.01}
        value={[effective]}
        onValueChange={(next) => setVolume(next[0] ?? 0)}
        aria-label="Volume"
        className="w-[88px]"
      />
    </div>
  );
}
