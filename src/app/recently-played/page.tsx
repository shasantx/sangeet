"use client";

import { Clock, Play } from "lucide-react";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { TrackRow } from "@/components/music/track-row";

export default function RecentlyPlayedPage() {
  const recentlyPlayed = useLibraryStore((s) => s.recentlyPlayed);
  const playTrack = usePlayerStore((s) => s.playTrack);

  return (
    <div className="min-h-full overflow-x-hidden p-4 pb-12 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.015em] text-encore-text sm:text-3xl">
            Recently played
          </h1>
          <p className="mt-1 font-mono text-xs tabular-nums text-encore-muted">
            {recentlyPlayed.length}{" "}
            {recentlyPlayed.length === 1 ? "track" : "tracks"}
          </p>
        </div>

        {recentlyPlayed.length > 0 && (
          <button
            type="button"
            onClick={() => playTrack(recentlyPlayed[0], recentlyPlayed)}
            className="btn-cobalt inline-flex h-11 items-center gap-2 rounded-full px-5 text-xs font-semibold transition active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Play all
          </button>
        )}
      </div>

      {recentlyPlayed.length === 0 ? (
        <div className="rounded-2xl border border-encore-hairline bg-encore-elevated p-12 text-center">
          <p className="text-base font-bold text-encore-text">
            No listening history yet
          </p>
          <p className="mt-1 text-sm text-encore-subdued">
            Tracks you play will show up here automatically.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-2 grid grid-cols-[24px_1fr_auto] items-center gap-2 border-b border-encore-hairline px-2 pb-2 text-xs font-medium uppercase tracking-wider text-encore-subdued sm:grid-cols-[28px_1fr_minmax(0,0.6fr)_110px] sm:gap-3 sm:px-3">
            <span className="text-center">#</span>
            <span>Title</span>
            <span className="hidden sm:block">Album</span>
            <span className="flex justify-end pr-2">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div className="space-y-0.5">
            {recentlyPlayed.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                contextQueue={recentlyPlayed}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
