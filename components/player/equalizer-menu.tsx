"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  EQ_BANDS,
  EQ_PRESETS,
  type EqPresetId,
  applyEqPreset,
  getCurrentEqPreset,
  getEqPreset,
} from "@/lib/audio-eq";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function gainToBarPercent(gain: number): number {
  // Map gain (-6 dB .. +6 dB) to 22% .. 100% bar height
  const normalized = (gain + 6) / 12;
  return Math.round(Math.max(0.22, Math.min(1, normalized)) * 100);
}

export function EqualizerMenu({ className }: { className?: string }) {
  const [presetId, setPresetId] = useState<EqPresetId>(() => getCurrentEqPreset());
  const activePreset = getEqPreset(presetId);
  const isActive = presetId !== "flat";

  const handleSelect = (nextId: EqPresetId) => {
    applyEqPreset(nextId);
    setPresetId(nextId);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Equalizer: ${activePreset.label}`}
          className={cn(
            "relative flex h-8 items-center justify-center gap-1.5 rounded-full px-2 text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            isActive && "text-[#1ed760]",
            className,
          )}
        >
          <SlidersHorizontal className="h-[15px] w-[15px]" strokeWidth={1.8} />
          {isActive && (
            <span
              className="flex h-3 items-end gap-[2px]"
              aria-hidden="true"
            >
              {activePreset.gains.map((gain, idx) => (
                <span
                  key={EQ_BANDS[idx].label}
                  className="w-[2px] rounded-full bg-[#1ed760] transition-all duration-200"
                  style={{ height: `${gainToBarPercent(gain)}%` }}
                />
              ))}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-2">
            <SlidersHorizontal
              className={cn("h-3.5 w-3.5", isActive ? "text-[#1ed760]" : "text-muted-foreground")}
            />
            Equalizer
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              isActive
                ? "bg-[#1ed760]/15 text-[#1ed760]"
                : "bg-white/[.06] text-muted-foreground",
            )}
          >
            {activePreset.label}
          </span>
        </DropdownMenuLabel>

        <div className="mx-2 my-1.5 rounded-lg border border-white/[.06] bg-white/[.025] px-3 py-2.5">
          <div className="flex h-9 items-end justify-between gap-2">
            {EQ_BANDS.map((band, idx) => {
              const gain = activePreset.gains[idx] ?? 0;
              return (
                <div key={band.label} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-6 w-full items-end justify-center">
                    <div
                      className={cn(
                        "w-1.5 rounded-full transition-all duration-200",
                        isActive ? "bg-[#1ed760]" : "bg-white/25",
                      )}
                      style={{ height: `${gainToBarPercent(gain)}%` }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {band.label.replace("Hz", "")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <DropdownMenuSeparator />

        {EQ_PRESETS.map((preset) => {
          const selected = preset.id === presetId;
          return (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => handleSelect(preset.id)}
              className={cn(
                "flex items-center justify-between gap-2 py-2 text-xs",
                selected && "font-semibold text-[#1ed760]",
              )}
            >
              <div className="min-w-0">
                <p className="truncate">{preset.label}</p>
                <p className="truncate text-[10px] font-normal text-muted-foreground">
                  {preset.description}
                </p>
              </div>
              {selected && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1ed760]" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
