"use client";

import { Disc3 } from "lucide-react";
import type { Track } from "@/types/music";
import { cn } from "@/lib/utils";

interface ArtworkMosaicProps {
  tracks?: Track[];
  cover?: string;
  alt: string;
  className?: string;
  icon?: React.ReactNode;
  accent?:
    | "cobalt"
    | "indigo"
    | "sapphire"
    | "midnight"
    | "emerald"
    | "mint"
    | "forest";
}

/**
 * Dynamic cover art mosaic for playlists, liked songs, offline collections, and albums.
 * Builds a rich 2x2 collage from real track covers instead of showing static placeholders.
 */
export function ArtworkMosaic({
  tracks = [],
  cover,
  alt,
  className,
  icon,
  accent = "cobalt"
}: ArtworkMosaicProps) {
  const uniqueThumbs = Array.from(
    new Set(
      tracks
        .map((t) => t.thumbnail)
        .filter((u): u is string => Boolean(u) && !u.startsWith("data:image/svg"))
    )
  ).slice(0, 4);

  if (uniqueThumbs.length >= 4) {
    return (
      <div
        className={cn(
          "relative grid grid-cols-2 grid-rows-2 overflow-hidden bg-encore-elevated ring-1 ring-white/10",
          className
        )}
      >
        {uniqueThumbs.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt={i === 0 ? alt : ""}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-studio group-hover:scale-105"
          />
        ))}
      </div>
    );
  }

  if (uniqueThumbs.length >= 2) {
    return (
      <div
        className={cn(
          "relative grid grid-cols-2 overflow-hidden bg-encore-elevated ring-1 ring-white/10",
          className
        )}
      >
        {uniqueThumbs.slice(0, 2).map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt={i === 0 ? alt : ""}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-studio group-hover:scale-105"
          />
        ))}
      </div>
    );
  }

  const singleSrc = uniqueThumbs[0] || cover;
  if (singleSrc) {
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-encore-elevated ring-1 ring-white/10",
          className
        )}
      >
        <img
          src={singleSrc}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-studio group-hover:scale-105"
        />
      </div>
    );
  }

  const gradientClass =
    accent === "mint" || accent === "sapphire"
      ? "bg-[#c41e2e]"
      : accent === "forest" || accent === "midnight"
        ? "bg-[#2a2624]"
        : accent === "indigo"
          ? "bg-[#8f6406]"
          : "bg-[#e2363e]";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden",
        gradientClass,
        className
      )}
    >
      {/* Subtle vinyl groove rings */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute h-[86%] w-[86%] rounded-full border border-white/15"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute h-[58%] w-[58%] rounded-full border border-white/10"
      />
      <span className="relative z-10 text-white">
        {icon ?? <Disc3 className="h-7 w-7 opacity-90" strokeWidth={1.6} />}
      </span>
    </div>
  );
}
