"use client";

import { useEffect, useState } from "react";
import { AudioLines, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  type AudioEffectsState,
  EQ_BANDS,
  EQ_PRESETS,
  type EqPresetId,
  applyEqPreset,
  getAudioEffectsState,
  getEffectiveEqGains,
  getEqPreset,
  isPresetActive,
  setAudioEffectsState,
  subscribeAudioEffects,
} from "@/lib/audio-eq";
import { getTrack } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function gainToBarPercent(gain: number): number {
  const normalized = (gain + 8) / 20;
  return Math.round(Math.max(0.18, Math.min(1, normalized)) * 100);
}

function formatDb(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)} dB`;
}

export function EqualizerMenu({ className }: { className?: string }) {
  const [fx, setFx] = useState<AudioEffectsState>({
    presetId: "flat",
    bassBoostDb: 0,
    trebleBoostDb: 0,
    reverbMix: 0,
    stereoWidth: 0,
  });
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const videoMode = usePlayerStore((state) => state.videoMode);
  const playbackRate = usePlayerStore((state) => state.playbackRate);
  const currentTrack = currentTrackId ? getTrack(currentTrackId) : undefined;
  const isYouTubeVideoMode = Boolean(videoMode && currentTrack?.youtubeId);

  useEffect(() => {
    setFx(getAudioEffectsState());
    return subscribeAudioEffects((next) => setFx(next));
  }, []);

  const activePreset = getEqPreset(fx.presetId);
  const effectiveGains = getEffectiveEqGains(fx);
  const isActive =
    isPresetActive() ||
    Math.abs(fx.bassBoostDb) > 0.05 ||
    Math.abs(fx.trebleBoostDb) > 0.05 ||
    fx.reverbMix > 0.01 ||
    fx.stereoWidth > 0.01 ||
    playbackRate !== 1;

  const handleSelectPreset = (nextId: EqPresetId) => {
    const result = applyEqPreset(nextId);
    if (result.recommendedSpeed !== undefined) {
      usePlayerStore.getState().setPlaybackRate(result.recommendedSpeed);
    }
  };

  const handleReset = () => {
    applyEqPreset("flat");
    usePlayerStore.getState().setPlaybackRate(1);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Audio Effects & Equalizer: ${activePreset.label}`}
          className={cn(
            "relative flex h-8 items-center justify-center gap-1.5 rounded-full px-2 text-muted-foreground transition hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            isActive && "text-primary",
            className,
          )}
        >
          <SlidersHorizontal className="h-[15px] w-[15px]" strokeWidth={1.8} />
          {isActive && (
            <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
              {effectiveGains.map((gain, idx) => (
                <span
                  key={EQ_BANDS[idx].label}
                  className="w-[2px] rounded-full bg-primary transition-all duration-200"
                  style={{ height: `${gainToBarPercent(gain)}%` }}
                />
              ))}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[310px] border-border bg-popover p-1.5"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuLabel className="flex items-center justify-between px-2 py-1.5 text-xs">
          <span className="flex items-center gap-2">
            <AudioLines
              className={cn("h-3.5 w-3.5", isActive ? "text-primary" : "text-muted-foreground")}
            />
            Audio Effects & EQ
          </span>
          <div className="flex items-center gap-1.5">
            {isActive && (
              <button
                type="button"
                onClick={handleReset}
                title="Reset effects and speed"
                className="inline-flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition hover:bg-card hover:text-foreground"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Reset
              </button>
            )}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "bg-elevated text-muted-foreground",
              )}
            >
              {activePreset.label}
            </span>
          </div>
        </DropdownMenuLabel>

        {isYouTubeVideoMode && (
          <div className="mx-1.5 mb-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[10.5px] leading-snug text-amber-200">
            Switch to Compact Audio for Web Audio FX
          </div>
        )}

        <div className="mx-1.5 my-1 rounded-lg border border-border bg-card px-3 py-2">
          <div className="flex h-8 items-end justify-between gap-2">
            {EQ_BANDS.map((band, idx) => {
              const gain = effectiveGains[idx] ?? 0;
              return (
                <div key={band.label} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-5 w-full items-end justify-center">
                    <div
                      className={cn(
                        "w-1.5 rounded-full transition-all duration-200",
                        isActive ? "bg-primary" : "bg-muted-foreground/35",
                      )}
                      style={{ height: `${gainToBarPercent(gain)}%` }}
                    />
                  </div>
                  <span className="font-sans text-[9px] tabular-nums text-muted-foreground">
                    {band.label.replace("Hz", "")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-1.5 py-1">
          <div className="grid grid-cols-2 gap-1">
            {EQ_PRESETS.map((preset) => {
              const selected = preset.id === fx.presetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id)}
                  title={preset.description}
                  className={cn(
                    "flex items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition",
                    selected
                      ? "border-primary/40 bg-primary/15 font-semibold text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-elevated hover:text-foreground",
                  )}
                >
                  <span className="truncate">{preset.label}</span>
                  {preset.recommendedSpeed && preset.recommendedSpeed !== 1 && (
                    <span className="shrink-0 font-sans text-[9.5px] tabular-nums opacity-80">
                      {preset.recommendedSpeed}x
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <DropdownMenuSeparator />

        <div
          className="space-y-2.5 px-2.5 py-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <label className="block space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Bass</span>
              <span className="font-sans text-[10.5px] tabular-nums text-foreground">
                {formatDb(fx.bassBoostDb)}
              </span>
            </div>
            <input
              type="range"
              min={-6}
              max={12}
              step={0.5}
              value={fx.bassBoostDb}
              aria-label="Bass boost"
              onChange={(e) => setAudioEffectsState({ bassBoostDb: Number(e.target.value) })}
              className="h-1.5 w-full cursor-pointer accent-primary"
            />
          </label>

          <label className="block space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Treble</span>
              <span className="font-sans text-[10.5px] tabular-nums text-foreground">
                {formatDb(fx.trebleBoostDb)}
              </span>
            </div>
            <input
              type="range"
              min={-6}
              max={12}
              step={0.5}
              value={fx.trebleBoostDb}
              aria-label="Treble boost"
              onChange={(e) => setAudioEffectsState({ trebleBoostDb: Number(e.target.value) })}
              className="h-1.5 w-full cursor-pointer accent-primary"
            />
          </label>

          <label className="block space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Reverb</span>
              <span className="font-sans text-[10.5px] tabular-nums text-foreground">
                {Math.round(fx.reverbMix * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(fx.reverbMix * 100)}
              aria-label="Reverb mix"
              onChange={(e) => setAudioEffectsState({ reverbMix: Number(e.target.value) / 100 })}
              className="h-1.5 w-full cursor-pointer accent-primary"
            />
          </label>

          <label className="block space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">3D Width</span>
              <span className="font-sans text-[10.5px] tabular-nums text-foreground">
                {Math.round(fx.stereoWidth * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(fx.stereoWidth * 100)}
              aria-label="3D stereo width"
              onChange={(e) => setAudioEffectsState({ stereoWidth: Number(e.target.value) / 100 })}
              className="h-1.5 w-full cursor-pointer accent-primary"
            />
          </label>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
