"use client";

import { useEffect, useState } from "react";
import type { HomeShelf, Track } from "@/types/music";
import { MediaCard } from "@/components/music/media-card";
import { MediaShelf } from "@/components/music/media-shelf";
import { SiteFooter } from "@/components/shell/site-footer";
import { cn } from "@/lib/utils";

const GENRES = [
  { id: "all", label: "For you", tint: "from-[#2563eb] to-[#0b132b]" },
  { id: "music", label: "Pop & Rock", tint: "from-[#4f46e5] to-[#111533]" },
  {
    id: "desi",
    label: "Hindi, Nepali & Punjabi",
    tint: "from-[#7c3aed] to-[#1a1038]"
  },
  { id: "chill", label: "Chill & Lo-Fi", tint: "from-[#0284c7] to-[#0a1d33]" },
  {
    id: "workout",
    label: "Workout & Energy",
    tint: "from-[#1d4ed8] to-[#0f172a]"
  }
];

export default function ExplorePage() {
  const [selected, setSelected] = useState("all");
  const [shelves, setShelves] = useState<HomeShelf[]>([]);
  const [genreCovers, setGenreCovers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/music/home?mood=${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          const nextShelves: HomeShelf[] = Array.isArray(data?.shelves)
            ? data.shelves
            : [];
          setShelves(nextShelves);
          setGenreCovers((prev) => {
            if (prev.length >= GENRES.length) return prev;
            const thumbs = nextShelves
              .flatMap((s) => s.items)
              .map((t: Track) => t.thumbnail)
              .filter(Boolean);
            return thumbs.slice(0, GENRES.length);
          });
        }
      })
      .catch(() => {
        if (!cancelled) setShelves([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  return (
    <div className="studio-enter overflow-x-hidden space-y-8 p-4 pb-12 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-encore-text sm:text-3xl">
          Explore
        </h1>
        <p className="mt-1 text-sm text-encore-subdued">
          Browse curated shelves across moods, genres, and regions
        </p>
      </div>

      {/* Rich Mood Cards with Dynamic Song Cover Art */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {GENRES.map((g, idx) => {
          const active = selected === g.id;
          const cover = genreCovers[idx];
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelected(g.id)}
              aria-pressed={active}
              className={cn(
                "group relative min-h-[96px] overflow-hidden rounded-xl border bg-gradient-to-br p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]",
                g.tint,
                active
                  ? "border-encore-accent ring-2 ring-encore-accent/40 shadow-lg"
                  : "border-white/15 hover:border-white/30"
              )}
            >
              <span className="relative z-10 block max-w-[75%] text-sm font-bold leading-snug text-white drop-shadow-sm">
                {g.label}
              </span>
              {active && (
                <span className="btn-cobalt relative z-10 mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold">
                  Active
                </span>
              )}
              {cover && (
                <img
                  src={cover}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-2 -right-2 h-16 w-16 rotate-[18deg] rounded-lg object-cover shadow-lg ring-1 ring-white/20 transition-transform duration-300 group-hover:rotate-[12deg] group-hover:scale-110"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Curated Shelves */}
      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-4 overflow-hidden">
              {Array.from({ length: 6 }).map((__, j) => (
                <div
                  key={j}
                  className="h-56 w-[180px] shrink-0 animate-pulse rounded-[12px] bg-encore-elevated"
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        shelves.map((shelf) => (
          <section key={shelf.id}>
            <div className="mb-3">
              <h2 className="text-lg font-bold text-encore-text">
                {shelf.title}
              </h2>
              {shelf.subtitle && (
                <p className="text-xs text-encore-muted">{shelf.subtitle}</p>
              )}
            </div>
            <MediaShelf>
              {shelf.items.map((track) => (
                <MediaCard
                  key={`${shelf.id}-${track.id}`}
                  track={track}
                  contextQueue={shelf.items}
                />
              ))}
            </MediaShelf>
          </section>
        ))
      )}

      <SiteFooter compact />
    </div>
  );
}
