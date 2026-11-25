"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Clock, Heart, Pause, Play, Search, Shuffle } from "lucide-react";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { TrackRow } from "@/components/music/track-row";
import { ArtworkMosaic } from "@/components/music/artwork-mosaic";

type SortMode = "recent" | "title" | "artist" | "duration";

export default function LikedSongsPage() {
  const likedTracks = useLibraryStore((s) => s.likedTracks);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const playShuffled = usePlayerStore((s) => s.playShuffled);
  const togglePlay = usePlayerStore((s) => s.togglePlay);

  const [filterQuery, setFilterQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  const displayedTracks = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    const filtered = q
      ? likedTracks.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            (t.album ?? "").toLowerCase().includes(q)
        )
      : [...likedTracks];

    if (sortMode === "title") {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortMode === "artist") {
      filtered.sort((a, b) => a.artist.localeCompare(b.artist));
    } else if (sortMode === "duration") {
      filtered.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    }
    return filtered;
  }, [likedTracks, filterQuery, sortMode]);

  const isLikedPlaying =
    isPlaying &&
    Boolean(currentTrack) &&
    likedTracks.some((t) => t.id === currentTrack?.id);

  const handlePlayAll = () => {
    if (displayedTracks.length === 0) return;
    if (isLikedPlaying) {
      togglePlay();
    } else {
      playTrack(displayedTracks[0], displayedTracks);
    }
  };

  return (
    <div className="min-h-full overflow-x-hidden pb-12">
      {/* Dynamic Song-Cover Mosaic Hero */}
      <div
        className="flex flex-col gap-5 border-b border-encore-hairline p-4 pt-6 sm:flex-row sm:items-end sm:gap-6 sm:p-6 sm:pt-10"
        style={{
          background:
            "linear-gradient(180deg, var(--background-tinted-highlight) 0%, var(--background-base) 100%)"
        }}
      >
        <ArtworkMosaic
          tracks={likedTracks}
          alt="Liked songs"
          accent="mint"
          icon={<Heart className="h-14 w-14 fill-white text-white" />}
          className="h-40 w-40 shrink-0 rounded-[14px] sm:h-48 sm:w-48"
        />
        <div className="min-w-0">
          <p className="text-xs font-medium text-encore-muted">Collection</p>
          <h1 className="mt-1.5 text-3xl font-medium tracking-[-0.02em] text-encore-text sm:text-5xl">
            Liked songs
          </h1>
          <p className="mt-3 font-mono text-xs tabular-nums text-encore-subdued">
            {likedTracks.length}{" "}
            {likedTracks.length === 1 ? "track" : "tracks"}
          </p>
        </div>
      </div>

      {/* Controls + Search / Sort */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handlePlayAll}
            disabled={displayedTracks.length === 0}
            className="btn-cobalt flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform duration-150 hover:scale-105 active:scale-[0.97] disabled:opacity-40"
            aria-label={isLikedPlaying ? "Pause Liked Songs" : "Play Liked Songs"}
          >
            {isLikedPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 translate-x-0.5 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={() => playShuffled(displayedTracks)}
            disabled={displayedTracks.length === 0}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-encore-hairline bg-encore-elevated px-4 text-xs font-medium text-encore-text transition-colors duration-150 hover:border-encore-accent/40 hover:bg-encore-elevated-highlight disabled:opacity-40"
            title="Shuffle play"
            aria-label="Shuffle play"
          >
            <Shuffle className="h-4 w-4 text-encore-subdued" strokeWidth={1.6} />
            Shuffle
          </button>
        </div>

        {likedTracks.length > 1 && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-encore-muted"
                strokeWidth={1.6}
              />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter tracks"
                className="h-11 w-full rounded-full border border-encore-hairline bg-encore-elevated pl-9 pr-3 text-xs text-encore-text placeholder:text-encore-muted outline-none focus:border-encore-accent/60 sm:w-52"
              />
            </div>

            <div className="relative flex items-center">
              <ArrowUpDown
                className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-encore-muted"
                strokeWidth={1.6}
              />
              <select
                aria-label="Sort liked songs"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="h-11 rounded-full border border-encore-hairline bg-encore-elevated pl-8 pr-4 text-xs font-medium text-encore-text outline-none focus:border-encore-accent/60"
              >
                <option value="recent">Recently liked</option>
                <option value="title">Title (A–Z)</option>
                <option value="artist">Artist (A–Z)</option>
                <option value="duration">Duration</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Tracklist */}
      <div className="px-4 sm:px-6">
        {likedTracks.length === 0 ? (
          <div className="rounded-[12px] border border-encore-hairline bg-encore-elevated p-10 text-center">
            <p className="text-base font-medium text-encore-text">
              Songs you like appear here
            </p>
            <p className="mt-1 text-sm text-encore-muted">
              Select the heart icon on any track to save it
            </p>
          </div>
        ) : displayedTracks.length === 0 ? (
          <p className="py-10 text-center text-sm text-encore-muted">
            No liked songs match &ldquo;{filterQuery}&rdquo;
          </p>
        ) : (
          <>
            <div className="mb-2 grid grid-cols-[24px_1fr_auto] items-center gap-2 border-b border-encore-hairline px-2 pb-2 text-xs font-medium text-encore-muted sm:grid-cols-[28px_1fr_minmax(0,0.6fr)_110px] sm:gap-3 sm:px-3">
              <span className="text-center font-mono">#</span>
              <span>Title</span>
              <span className="hidden sm:block">Album</span>
              <span className="flex justify-end pr-2">
                <Clock className="h-3.5 w-3.5" strokeWidth={1.6} />
              </span>
            </div>
            <div className="space-y-0.5">
              {displayedTracks.map((track, idx) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={idx}
                  contextQueue={displayedTracks}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
