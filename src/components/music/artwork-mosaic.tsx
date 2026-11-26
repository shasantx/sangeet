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
          "relative grid grid-cols-2 grid-rows-2 overflow-hidden bg-encore-elevated shadow-lg ring-1 ring-white/10",
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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/5" />
      </div>
    );
  }

  if (uniqueThumbs.length >= 2) {
    return (
      <div
        className={cn(
          "relative grid grid-cols-2 overflow-hidden bg-encore-elevated shadow-lg ring-1 ring-white/10",
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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/5" />
      </div>
    );
  }

  const singleSrc = uniqueThumbs[0] || cover;
  if (singleSrc) {
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-encore-elevated shadow-lg ring-1 ring-white/10",
          className
        )}
      >
        <img
          src={singleSrc}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-studio group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/5" />
      </div>
    );
  }

  const gradientClass =
    accent === "mint" || accent === "sapphire"
      ? "from-[#ec4a4f] via-[#c8102e] to-[#3a0d14]"
      : accent === "forest" || accent === "midnight"
        ? "from-[#6e0b17] via-[#3d0a10] to-[#140607]"
        : accent === "indigo"
          ? "from-[#f5c451] via-[#b7791f] to-[#2a1a06]"
          : "from-[#e5303f] via-[#a50e22] to-[#220a0e]";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br shadow-lg ring-1 ring-white/10",
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
      <span className="relative z-10 text-white drop-shadow">
        {icon ?? <Disc3 className="h-7 w-7 opacity-90" strokeWidth={1.6} />}
      </span>
    </div>
  );
}
