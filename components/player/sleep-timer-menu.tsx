"use client";

import { useEffect, useState } from "react";
import { Gauge, Moon, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TIMER_OPTIONS: Array<{ label: string; value: number | "track" | null }> = [
  { label: "Off", value: null },
  { label: "End of track", value: "track" },
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "45 minutes", value: 45 },
  { label: "60 minutes", value: 60 },
];

const SPEED_OPTIONS: Array<{ rate: number; label: string; title?: string }> = [
  { rate: 0.75, label: "0.75x" },
  { rate: 0.85, label: "0.85x", title: "Slowed (0.85x)" },
  { rate: 1, label: "1x", title: "Normal speed" },
  { rate: 1.25, label: "1.25x" },
  { rate: 1.5, label: "1.5x" },
];

export function SleepTimerMenu({ className }: { className?: string }) {
  const sleepTimerEndsAt = usePlayerStore((state) => state.sleepTimerEndsAt);
  const sleepAfterTrack = usePlayerStore((state) => state.sleepAfterTrack);
  const playbackRate = usePlayerStore((state) => state.playbackRate);
  const setSleepTimer = usePlayerStore((state) => state.setSleepTimer);
  const setPlaybackRate = usePlayerStore((state) => state.setPlaybackRate);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!sleepTimerEndsAt) {
      setMinutesLeft(null);
      return;
    }
    const update = () => {
      const diff = Math.max(0, Math.ceil((sleepTimerEndsAt - Date.now()) / 60_000));
      setMinutesLeft(diff);
    };
    update();
    const id = window.setInterval(update, 15_000);
    return () => window.clearInterval(id);
  }, [sleepTimerEndsAt]);

  const timerActive = Boolean(sleepTimerEndsAt || sleepAfterTrack);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Sleep timer and playback speed"
          className={cn(
            "relative flex h-8 items-center justify-center gap-1 rounded-full px-2 text-muted-foreground transition hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            (timerActive || playbackRate !== 1) && "text-primary",
            className,
          )}
        >
          {timerActive ? (
            <Moon className="h-[15px] w-[15px]" strokeWidth={1.8} />
          ) : (
            <Timer className="h-[15px] w-[15px]" strokeWidth={1.8} />
          )}
          {minutesLeft !== null && (
            <span className="font-mono text-[10px] font-semibold tabular-nums">{minutesLeft}m</span>
          )}
          {sleepAfterTrack && (
            <span className="font-mono text-[10px] font-semibold">1T</span>
          )}
          {playbackRate !== 1 && !timerActive && (
            <span className="font-mono text-[10px] font-semibold tabular-nums">{playbackRate}x</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 border-border bg-popover">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs">
          <Moon className="h-3.5 w-3.5 text-primary" />
          Sleep timer
        </DropdownMenuLabel>
        {TIMER_OPTIONS.map((option) => {
          const isSelected =
            (option.value === null && !timerActive) ||
            (option.value === "track" && sleepAfterTrack) ||
            (typeof option.value === "number" && sleepTimerEndsAt !== null && minutesLeft !== null && Math.abs(minutesLeft - option.value) <= 1);
          return (
            <DropdownMenuItem
              key={String(option.value)}
              onClick={() => setSleepTimer(option.value)}
              className={cn("justify-between text-xs", isSelected && "text-primary font-semibold")}
            >
              <span>{option.label}</span>
              {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
            Playback speed
          </span>
          {playbackRate === 0.85 && (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9.5px] font-medium text-primary">
              Slowed
            </span>
          )}
        </DropdownMenuLabel>
        <div
          className="grid grid-cols-5 gap-1 px-2 py-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {SPEED_OPTIONS.map((option) => (
            <button
              key={option.rate}
              type="button"
              title={option.title ?? `${option.rate}x speed`}
              onClick={() => setPlaybackRate(option.rate)}
              className={cn(
                "rounded-md py-1 font-mono text-[10.5px] font-medium transition",
                playbackRate === option.rate
                  ? "bg-primary text-primary-foreground font-bold"
                  : "bg-card text-muted-foreground hover:bg-elevated hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
