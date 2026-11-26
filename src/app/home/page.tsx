"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Heart, ListCheck, ListPlus, Pause, Play } from "lucide-react";
import type { HomeShelf, Track } from "@/types/music";
import { MediaCard } from "@/components/music/media-card";
import { MediaShelf } from "@/components/music/media-shelf";
import { MoodShelf } from "@/components/music/mood-shelf";
import { TrackArtwork } from "@/components/music/track-artwork";
import { SiteFooter } from "@/components/shell/site-footer";
import { usePlayerStore } from "@/store/player-store";
import { useLibraryStore } from "@/store/library-store";
import { useToastStore } from "@/store/toast-store";
import { cn } from "@/lib/utils";

const MOOD_CHIPS = [
  { id: "all", label: "All" },
  { id: "music", label: "Music" },
  { id: "desi", label: "Hindi & Desi" },
  { id: "chill", label: "Chill" },
  { id: "workout", label: "Workout" }
] as const;

export default function HomePage() {
  const [mood, setMood] = useState<string>("all");
  const [shelves, setShelves] = useState<HomeShelf[]>([]);
  const [madeForYou, setMadeForYou] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const toggleQueueTrack = usePlayerStore((s) => s.toggleQueueTrack);
  const fetchRadioForTrack = usePlayerStore((s) => s.fetchRadioForTrack);

  const recentlyPlayed = useLibraryStore((s) => s.recentlyPlayed);
  const likedTracks = useLibraryStore((s) => s.likedTracks);
  const toggleLike = useLibraryStore((s) => s.toggleLike);
  const showToast = useToastStore((s) => s.showToast);

  // Personalized Made For You shelf seeded from user's top recent or liked track
  const seedTrackId = likedTracks[0]?.id || recentlyPlayed[0]?.id || "";
  useEffect(() => {
    if (!seedTrackId || seedTrackId.startsWith("local_")) return;
    let cancelled = false;
    fetch(`/api/music/radio?videoId=${encodeURIComponent(seedTrackId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data?.tracks)) {
          setMadeForYou(data.tracks.slice(0, 12));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [seedTrackId]);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `sangeet-v2-feed-${mood}`;

    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw);
        if (Array.isArray(cached?.shelves) && cached.shelves.length > 0) {
          setShelves(cached.shelves);
          setLoading(false);
        }
      }
    } catch {}

    fetch(`/api/music/home?mood=${encodeURIComponent(mood)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data?.shelves) && data.shelves.length > 0) {
          setShelves(data.shelves);
          try {
            localStorage.setItem(
              cacheKey,
              JSON.stringify({ updatedAt: Date.now(), shelves: data.shelves })
            );
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mood]);

  // Up to 16 tracks chunked into 4-row vertical columns (authentic YouTube Music Quick Picks)
  const quickPicks: Track[] = useMemo(() => {
    const combined = [
      ...recentlyPlayed,
      ...(shelves[0]?.items ?? []),
      ...(shelves[1]?.items ?? []),
      ...(shelves[2]?.items ?? [])
    ];
    const seen = new Set<string>();
    const unique: Track[] = [];
    for (const t of combined) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        unique.push(t);
      }
      if (unique.length >= 16) break;
    }
    return unique;
  }, [recentlyPlayed, shelves]);

  const quickPickColumns = useMemo(() => {
    const cols: Track[][] = [];
    for (let i = 0; i < quickPicks.length; i += 4) {
      cols.push(quickPicks.slice(i, i + 4));
    }
    return cols;
  }, [quickPicks]);

  const handleQuickPickPlay = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
      return;
    }
    playTrack(track, quickPicks);
    if (!track.offlineId && !track.localUrl && !track.streamUrl) {
      void fetchRadioForTrack(track.id);
    }
  };

  return (
    <div className="min-h-full overflow-x-hidden bg-transparent">
      {/* Mood Filter Chips Bar — blends seamlessly beneath the floating Liquid Glass TopBar */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto bg-transparent px-4 pb-2 pt-1 sm:px-6">
        {MOOD_CHIPS.map((chip) => {
          const active = mood === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setMood(chip.id)}
              aria-pressed={active}
              className={cn(
                "inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-full px-4 text-xs font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.97]",
                active
                  ? "btn-cobalt font-semibold shadow-sm"
                  : "bg-encore-elevated/75 text-encore-subdued hover:bg-encore-elevated-highlight hover:text-encore-text"
              )}
            >
              {chip.label}
            </button>
          );
        })}
        <Link
          href="/made-for-you"
          className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-full bg-encore-elevated/75 px-4 text-xs font-medium text-encore-subdued transition-colors duration-150 hover:bg-encore-elevated-highlight hover:text-encore-text"
        >
          Made for you
        </Link>
        <Link
          href="/new-releases"
          className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-full bg-encore-elevated/75 px-4 text-xs font-medium text-encore-subdued transition-colors duration-150 hover:bg-encore-elevated-highlight hover:text-encore-text"
        >
          New releases
        </Link>
      </div>

      <div className="studio-enter space-y-8 px-4 pt-5 sm:px-6">
        {/* YouTube Music-Style Quick Picks (4 stacked rows per swipeable column) */}
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-encore-accent">
                Start radio from a song
              </p>
              <h1 className="mt-1 text-2xl font-medium tracking-[-0.02em] text-encore-text sm:text-3xl">
                Quick picks
              </h1>
            </div>
            {quickPicks.length > 0 && (
              <button
                type="button"
                onClick={() => playTrack(quickPicks[0], quickPicks)}
                className="btn-cobalt inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-full px-4 text-xs font-semibold transition-transform duration-150 active:scale-[0.97]"
              >
                Play all
              </button>
            )}
          </div>

          {loading && quickPicks.length === 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-[10px] bg-encore-elevated"
                />
              ))}
            </div>
          ) : (
            <MediaShelf className="snap-x snap-mandatory gap-4 sm:gap-5">
              {quickPickColumns.map((col, colIdx) => (
                <div
                  key={`qp-col-${colIdx}`}
                  className="w-[calc(100vw-2.5rem)] max-w-[340px] shrink-0 snap-start space-y-1.5 sm:w-[340px]"
                >
                  {col.map((track) => {
                    const isCurrent = currentTrack?.id === track.id;
                    const isLiked = likedTracks.some((t) => t.id === track.id);
                    const inQueue = queue.some((q) => q.id === track.id);
                    return (
                      <div
                        key={track.id}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-[10px] p-1.5 pr-1.5 transition-colors duration-150 sm:gap-3 sm:pr-2",
                          isCurrent
                            ? "bg-encore-tinted/75"
                            : "hover:bg-encore-elevated/70"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => handleQuickPickPlay(track)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[8px] bg-encore-elevated shadow">
                            <TrackArtwork
                              src={track.thumbnail}
                              trackId={track.id}
                              alt={track.title}
                              className="h-full w-full transition-transform duration-300 ease-studio group-hover:scale-105"
                            />
                            <span
                              className={cn(
                                "absolute inset-0 flex items-center justify-center bg-black/50 text-white transition-opacity duration-150",
                                isCurrent
                                  ? "opacity-100"
                                  : "opacity-0 group-hover:opacity-100"
                              )}
                            >
                              {isCurrent && isPlaying ? (
                                <Pause className="h-4 w-4 fill-current text-encore-accent" />
                              ) : (
                                <Play className="h-4 w-4 translate-x-0.5 fill-current" />
                              )}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                "truncate text-sm font-medium",
                                isCurrent
                                  ? "text-encore-accent"
                                  : "text-encore-text"
                              )}
                            >
                              {track.title}
                            </p>
                            <p className="truncate text-xs text-encore-subdued">
                              {track.artist}
                              {track.durationText
                                ? ` • ${track.durationText}`
                                : ""}
                            </p>
                          </div>
                        </button>

                        <div
                          className={cn(
                            "flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity duration-150",
                            inQueue || isLiked
                              ? "sm:opacity-100"
                              : "sm:opacity-0 sm:group-hover:opacity-100"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              const liked = toggleLike(track);
                              showToast(
                                liked
                                  ? "Saved to Liked Songs"
                                  : "Removed from Liked Songs",
                                liked ? "success" : "default"
                              );
                            }}
                            aria-label={isLiked ? "Unlike" : "Like"}
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-encore-elevated-highlight",
                              isLiked
                                ? "text-encore-accent"
                                : "text-encore-muted hover:text-encore-text"
                            )}
                          >
                            <Heart
                              className={cn(
                                "h-4 w-4",
                                isLiked && "fill-current"
                              )}
                              strokeWidth={1.6}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const added = toggleQueueTrack(track);
                              showToast(
                                added ? "Added to queue" : "Removed from queue",
                                added ? "success" : "default"
                              );
                            }}
                            aria-label={
                              inQueue ? "Remove from queue" : "Add to queue"
                            }
                            aria-pressed={inQueue}
                            title={
                              inQueue ? "Remove from queue" : "Add to queue"
                            }
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                              inQueue
                                ? "bg-encore-tinted text-encore-accent hover:bg-encore-tinted-highlight"
                                : "text-encore-muted hover:bg-encore-elevated-highlight hover:text-encore-text"
                            )}
                          >
                            {inQueue ? (
                              <ListCheck className="h-4 w-4" strokeWidth={2} />
                            ) : (
                              <ListPlus className="h-4 w-4" strokeWidth={1.6} />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </MediaShelf>
          )}
        </section>

        {/* Time-of-day mood picks (on-device listening model) */}
        <MoodShelf />

        {/* Recently Played shelf */}
        {recentlyPlayed.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight text-encore-text">
                Recently played
              </h2>
              <Link
                href="/recently-played"
                className="flex items-center gap-0.5 text-xs font-medium text-encore-subdued hover:text-encore-accent"
              >
                Show all <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.6} />
              </Link>
            </div>
            <MediaShelf>
              {recentlyPlayed.slice(0, 10).map((track) => (
                <MediaCard
                  key={`recent-${track.id}`}
                  track={track}
                  contextQueue={recentlyPlayed}
                />
              ))}
            </MediaShelf>
          </section>
        )}

        {/* Personalized Made For You Mix */}
        {madeForYou.length > 0 && (
          <section>
            <div className="mb-3">
              <h2 className="text-xl font-semibold tracking-tight text-encore-text">
                Made for you
              </h2>
              <p className="text-xs text-encore-subdued">
                Radio mix tuned to your likes and recent plays
              </p>
            </div>
            <MediaShelf>
              {madeForYou.map((track) => (
                <MediaCard
                  key={`mfy-${track.id}`}
                  track={track}
                  contextQueue={madeForYou}
                />
              ))}
            </MediaShelf>
          </section>
        )}

        {/* Discovery Shelves */}
        {loading && shelves.length === 0 ? (
          <div className="space-y-8">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="space-y-3">
                <div className="h-5 w-44 animate-pulse rounded-[6px] bg-encore-elevated" />
                <div className="flex gap-4 overflow-hidden">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <div
                      key={j}
                      className="h-56 w-[180px] shrink-0 animate-pulse rounded-[14px] bg-encore-elevated"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          shelves.map((shelf) => (
            <section key={shelf.id}>
              <div className="mb-3">
                <h2 className="text-xl font-semibold tracking-tight text-encore-text">
                  {shelf.title}
                </h2>
                {shelf.subtitle && (
                  <p className="text-xs text-encore-subdued">
                    {shelf.subtitle}
                  </p>
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
      </div>

      <SiteFooter compact />
    </div>
  );
}
