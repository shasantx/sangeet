"use client";

import { usePlaybackInfoStore } from "@/store/playback-info-store";
import { useEQStore } from "@/store/eq-store";
import { cn } from "@/lib/utils";

/** Tiny "AAC · 128 kbps · Spatial" line so format / effect changes are visible. */
export function FormatBadge({ className }: { className?: string }) {
  const format = usePlaybackInfoStore((s) => s.format);
  const effects = usePlaybackInfoStore((s) => s.effects);
  const spatial = useEQStore((s) => s.spatial);
  const eqOn = useEQStore((s) => s.enabled && s.gains.some((g) => g !== 0));
  if (!format || format.origin === "youtube-player") return null;

  const parts = [format.codec, format.detail];
  if (format.origin === "converted") parts.push("converted");
  if (effects !== "unavailable") {
    if (spatial !== "off") parts.push(spatial === "immersive" ? "Immersive" : "Spatial");
    if (eqOn) parts.push("EQ");
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/70",
        className
      )}
    >
      {parts.filter(Boolean).join(" · ")}
    </span>
  );
}
