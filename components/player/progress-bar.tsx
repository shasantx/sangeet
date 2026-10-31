"use client";

import { useEffect, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { formatDuration } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";

interface ProgressBarProps {
  className?: string;
  showTimes?: boolean;
  timeClassName?: string;
}

export function ProgressBar({ className, showTimes = true, timeClassName }: ProgressBarProps) {
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const seek = usePlayerStore((state) => state.seek);
  const [dragValue, setDragValue] = useState<number | null>(null);

  useEffect(() => {
    setDragValue(null);
  }, [currentTrackId]);

  const value = dragValue ?? currentTime;
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;

  return (
    <div className={className}>
      <div className="flex items-center gap-2.5">
        {showTimes && (
          <span className={timeClassName ?? "w-9 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground"}>
            {formatDuration(value)}
          </span>
        )}
        <Slider
          min={0}
          max={safeDuration || 1}
          step={0.1}
          value={[Math.min(value, safeDuration || 1)]}
          disabled={!currentTrackId || safeDuration === 0}
          onValueChange={(next) => setDragValue(next[0] ?? 0)}
          onValueCommit={(next) => {
            seek(next[0] ?? 0);
            setDragValue(null);
          }}
          aria-label="Seek through track"
          className="flex-1"
        />
        {showTimes && (
          <span className={timeClassName ?? "w-9 shrink-0 text-[10px] tabular-nums text-muted-foreground"}>
            {formatDuration(safeDuration)}
          </span>
        )}
      </div>
    </div>
  );
}
