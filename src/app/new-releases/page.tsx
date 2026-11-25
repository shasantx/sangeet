"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import type { HomeShelf } from "@/types/music";
import { MediaCard } from "@/components/music/media-card";
import { MediaShelf } from "@/components/music/media-shelf";
import { usePlayerStore } from "@/store/player-store";

export default function NewReleasesPage() {
  const [shelves, setShelves] = useState<HomeShelf[]>([]);
  const [loading, setLoading] = useState(true);
  const playTrack = usePlayerStore((s) => s.playTrack);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/music/home?mood=music").then((r) => r.json()),
      fetch("/api/music/home?mood=desi").then((r) => r.json())
    ])
      .then(([music, desi]) => {
        if (cancelled) return;
        const combined: HomeShelf[] = [
          ...(Array.isArray(music?.shelves) ? music.shelves : []),
          ...(Array.isArray(desi?.shelves) ? desi.shelves : [])
        ];
        setShelves(combined);
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
  }, []);

  const firstTracks = shelves[0]?.items ?? [];

  return (
    <div className="min-h-full overflow-x-hidden space-y-8 p-4 pb-16 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.015em] text-encore-text sm:text-3xl">
            New releases
          </h1>
          <p className="mt-1 text-sm text-encore-subdued">
            Recent drops across Pop, Rock, Electronic, Hindi, Nepali, and
            Punjabi
          </p>
        </div>

        {firstTracks.length > 0 && (
          <button
            type="button"
            onClick={() => playTrack(firstTracks[0], firstTracks)}
            className="btn-cobalt inline-flex h-11 items-center gap-2 rounded-full px-5 text-xs font-semibold transition active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Play latest
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 overflow-hidden">
              {Array.from({ length: 6 }).map((__, j) => (
                <div
                  key={j}
                  className="h-52 w-[170px] shrink-0 animate-pulse rounded-xl bg-encore-elevated"
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        shelves.map((shelf) => (
          <section key={shelf.id}>
            <div className="mb-3">
              <h2 className="text-lg font-bold text-encore-text sm:text-xl">
                {shelf.title}
              </h2>
              {shelf.subtitle && (
                <p className="text-xs text-encore-subdued">{shelf.subtitle}</p>
              )}
            </div>
            <MediaShelf>
              {shelf.items.map((track) => (
                <MediaCard
                  key={`nr-${shelf.id}-${track.id}`}
                  track={track}
                  contextQueue={shelf.items}
                />
              ))}
            </MediaShelf>
          </section>
        ))
      )}
    </div>
  );
}
