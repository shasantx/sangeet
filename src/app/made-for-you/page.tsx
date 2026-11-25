"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import type { Track } from "@/types/music";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { MediaCard } from "@/components/music/media-card";
import { MediaShelf } from "@/components/music/media-shelf";
import { TrackRow } from "@/components/music/track-row";

export default function MadeForYouPage() {
  const likedTracks = useLibraryStore((s) => s.likedTracks);
  const recentlyPlayed = useLibraryStore((s) => s.recentlyPlayed);
  const playTrack = usePlayerStore((s) => s.playTrack);

  const [mixTracks, setMixTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  const seedId =
    likedTracks.find((t) => !t.offlineId && !t.localUrl)?.id ||
    recentlyPlayed.find((t) => !t.offlineId && !t.localUrl)?.id ||
    "";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const url = seedId
      ? `/api/music/radio?videoId=${encodeURIComponent(seedId)}`
      : "/api/music/home?mood=all";

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.tracks)) {
          setMixTracks(data.tracks);
        } else if (Array.isArray(data?.shelves)) {
          setMixTracks(data.shelves.flatMap((s: { items: Track[] }) => s.items).slice(0, 18));
        }
      })
      .catch(() => {
        if (!cancelled) setMixTracks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [seedId]);

  return (
    <div className="min-h-full overflow-x-hidden space-y-8 p-4 pb-16 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.015em] text-encore-text sm:text-3xl">
            Made for you
          </h1>
          <p className="mt-1 text-sm text-encore-subdued">
            {seedId
              ? "Daily radio mix adapted from your liked and recently played tracks"
              : "Like or play a few songs to seed your daily mix"}
          </p>
        </div>

        {mixTracks.length > 0 && (
          <button
            type="button"
            onClick={() => playTrack(mixTracks[0], mixTracks)}
            className="btn-cobalt inline-flex h-11 items-center gap-2 rounded-full px-5 text-xs font-semibold transition active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Play daily mix
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-xl bg-encore-elevated" />
          ))}
        </div>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-lg font-bold text-encore-text">Daily Mix 1</h2>
            <MediaShelf>
              {mixTracks.slice(0, 10).map((track) => (
                <MediaCard
                  key={`dm-${track.id}`}
                  track={track}
                  contextQueue={mixTracks}
                />
              ))}
            </MediaShelf>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-encore-text">
              Recommended Tracks
            </h2>
            <div className="space-y-0.5">
              {mixTracks.map((track, idx) => (
                <TrackRow
                  key={`rec-${track.id}`}
                  track={track}
                  index={idx}
                  contextQueue={mixTracks}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
