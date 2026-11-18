"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Compass,
  Pause,
  Play,
  RefreshCw,
  Shuffle,
} from "lucide-react";
import { getArtist, getTrack } from "@/lib/catalog";
import {
  registerAudiusSearchResult,
  registerYouTubeSearchResult,
} from "@/lib/dynamic-tracks";
import type { Track } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { usePlayerStore } from "@/store/player-store";
import { Artwork } from "@/components/music/artwork";
import { Equalizer } from "@/components/music/equalizer";
import { LikeButton } from "@/components/music/like-button";
import { SectionHeader } from "@/components/music/section-header";
import { TrackContextMenu } from "@/components/music/track-context-menu";

interface TrendingApiItem {
  id: string;
  videoId?: string;
  title: string;
  artist: string;
  album?: string;
  durationSeconds: number;
  thumbnail: string;
  views?: string;
  genre?: string;
  source: "youtube" | "audius" | "catalog";
  audioUrl?: string;
}

interface SearchApiItem {
  videoId: string;
  title: string;
  artist: string;
  album?: string;
  durationSeconds?: number;
  thumbnail?: string;
  views?: string;
}

interface CachedTrackList {
  at: number;
  tracks: Track[];
  viewsById: Record<string, string>;
}

interface CachedYtFeed {
  at: number;
  connected: boolean;
  suggested: Track[];
  seeds: string[];
}

const CACHE_TTL_MS = 10 * 60 * 1000;
let trendingCache: CachedTrackList | null = null;
const moodSearchCache = new Map<string, CachedTrackList>();
const ytFeedCache = new Map<string, CachedYtFeed>();

const MOOD_PILLS = [
  { id: "all", label: "All", query: "" },
  { id: "pop", label: "Pop", query: "top pop hits music" },
  { id: "hip-hop", label: "Hip-Hop", query: "hip hop rap hits music" },
  { id: "indie", label: "Indie", query: "indie alternative music" },
  { id: "electronic", label: "Electronic", query: "electronic dance music" },
  { id: "lo-fi", label: "Lo-Fi", query: "lofi chill beats" },
  { id: "chill", label: "Chill", query: "chill acoustic music" },
  { id: "workout", label: "Workout", query: "workout gym motivation music" },
  { id: "nepali", label: "Nepali", query: "nepali hit songs" },
  { id: "hindi", label: "Hindi", query: "hindi bollywood hit songs" },
] as const;

type MoodPillId = (typeof MOOD_PILLS)[number]["id"];

function registerTrendingItem(item: TrendingApiItem): Track | undefined {
  try {
    if (item.source === "youtube" && item.videoId) {
      return registerYouTubeSearchResult({
        videoId: item.videoId,
        title: item.title,
        artist: item.artist,
        album: item.album,
        durationSeconds: item.durationSeconds,
        thumbnail: item.thumbnail,
        views: item.views,
      });
    }
    if (item.source === "audius") {
      return registerAudiusSearchResult({
        id: item.id.replace(/^aud-/, ""),
        title: item.title,
        artist: item.artist,
        album: item.album,
        durationSeconds: item.durationSeconds,
        artwork: item.thumbnail,
        genre: item.genre,
        audioUrl: item.audioUrl,
      });
    }
    const existing = getTrack(item.id);
    if (existing) return existing;
    if (item.videoId) {
      return registerYouTubeSearchResult({
        videoId: item.videoId,
        title: item.title,
        artist: item.artist,
        album: item.album,
        durationSeconds: item.durationSeconds,
        thumbnail: item.thumbnail,
        views: item.views,
      });
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function CarouselTrackCard({
  track,
  contextIds,
  contextLabel,
  views,
}: {
  track: Track;
  contextIds: string[];
  contextLabel: string;
  views?: string;
}) {
  const isCurrent = usePlayerStore((state) => state.currentTrackId === track.id);
  const isPlaying = usePlayerStore((state) =>
    state.currentTrackId === track.id ? state.isPlaying : false,
  );
  const playTrack = usePlayerStore((state) => state.playTrack);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const artist = getArtist(track.artistId);

  const subtitleParts = [artist?.name ?? "Unknown artist"];
  if (views) {
    subtitleParts.push(views);
  } else if (track.duration > 0) {
    subtitleParts.push(formatDuration(track.duration));
  }

  return (
    <article className="group min-w-0 rounded-2xl border border-transparent p-2 -m-2 transition-colors duration-200 hover:border-border hover:bg-card">
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (isCurrent) togglePlay();
            else playTrack(track.id, contextIds, contextLabel);
          }}
          aria-label={`${isCurrent && isPlaying ? "Pause" : "Play"} ${track.title}`}
          className="relative block w-full overflow-hidden rounded-2xl border border-border bg-elevated text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Artwork
            src={track.artwork}
            alt={track.title}
            res="md"
            className="aspect-square w-full transition-transform duration-300 ease-out group-hover:scale-[1.02]"
          />
          <span
            className={cn(
              "absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all duration-150",
              isCurrent
                ? "translate-y-0 opacity-100"
                : "opacity-100 sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100",
            )}
          >
            {isCurrent && isPlaying ? (
              <Pause className="h-4 w-4 fill-current" strokeWidth={0} />
            ) : (
              <Play className="ml-0.5 h-4 w-4 fill-current" strokeWidth={0} />
            )}
          </span>
        </button>
      </div>
      <div className="mt-2.5 flex min-w-0 items-start justify-between gap-1.5 px-0.5">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-[13.5px] font-semibold leading-5",
              isCurrent ? "text-primary" : "text-foreground",
            )}
          >
            {track.title}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
            {subtitleParts.join(" · ")}
          </p>
        </div>
        <TrackContextMenu
          track={track}
          className="-mr-1.5 h-7 w-7 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 data-[state=open]:opacity-100"
        />
      </div>
    </article>
  );
}

function ChartTrackRow({
  track,
  rank,
  contextIds,
  contextLabel,
}: {
  track: Track;
  rank: number;
  contextIds: string[];
  contextLabel: string;
}) {
  const isCurrent = usePlayerStore((state) => state.currentTrackId === track.id);
  const isPlaying = usePlayerStore((state) =>
    state.currentTrackId === track.id ? state.isPlaying : false,
  );
  const playTrack = usePlayerStore((state) => state.playTrack);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const artist = getArtist(track.artistId);

  const handleToggle = () => {
    if (isCurrent) togglePlay();
    else playTrack(track.id, contextIds, contextLabel);
  };

  return (
    <div
      onClick={handleToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleToggle();
        }
      }}
      className={cn(
        "group flex min-w-0 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary sm:gap-3.5 sm:px-3",
        isCurrent ? "bg-white/[0.06]" : "hover:bg-white/[0.04]",
      )}
    >
      <div className="flex w-6 shrink-0 items-center justify-center">
        {isCurrent && isPlaying ? (
          <Equalizer className="h-3.5" />
        ) : (
          <>
            <span
              className={cn(
                "text-xs font-semibold tabular-nums group-hover:hidden",
                isCurrent ? "text-primary" : "text-muted-foreground",
              )}
            >
              {rank}
            </span>
            <Play
              className="hidden h-3.5 w-3.5 fill-current text-foreground group-hover:block"
              strokeWidth={0}
            />
          </>
        )}
      </div>

      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-elevated">
        <Artwork
          src={track.artwork}
          alt={track.title}
          res="sm"
          className="h-full w-full"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-[13.5px] font-semibold leading-tight",
            isCurrent ? "text-primary" : "text-foreground",
          )}
        >
          {track.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {artist?.name ?? "Unknown artist"}
        </p>
      </div>

      <div
        className="flex shrink-0 items-center gap-1 sm:gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <LikeButton
          trackId={track.id}
          size="sm"
          showTooltip={false}
          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 data-[pressed=true]:opacity-100"
        />
        {track.duration > 0 && (
          <span className="hidden w-11 text-right text-xs tabular-nums text-muted-foreground sm:inline-block">
            {formatDuration(track.duration)}
          </span>
        )}
        <TrackContextMenu track={track} />
      </div>
    </div>
  );
}

function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="min-w-0 animate-pulse">
          <div className="aspect-square w-full rounded-2xl bg-white/[0.06]" />
          <div className="mt-2.5 h-3.5 w-3/4 rounded bg-white/[0.08]" />
          <div className="mt-1.5 h-3 w-1/2 rounded bg-white/[0.05]" />
        </div>
      ))}
    </div>
  );
}

function ChartListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-1 lg:grid-cols-2 lg:gap-x-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex animate-pulse items-center gap-3 rounded-xl px-3 py-2"
        >
          <div className="h-3.5 w-5 rounded bg-white/[0.06]" />
          <div className="h-11 w-11 shrink-0 rounded-lg bg-white/[0.08]" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-2/3 rounded bg-white/[0.08]" />
            <div className="h-3 w-1/3 rounded bg-white/[0.05]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ExplorePage() {
  const session = useAuthStore((state) => state.session);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const shuffle = usePlayerStore((state) => state.shuffle);

  const [selectedMood, setSelectedMood] = useState<MoodPillId>("all");

  const [trendingTracks, setTrendingTracks] = useState<Track[]>(
    () => trendingCache?.tracks ?? [],
  );
  const [trendingViews, setTrendingViews] = useState<Record<string, string>>(
    () => trendingCache?.viewsById ?? {},
  );
  const [loadingTrending, setLoadingTrending] = useState(
    () => !(trendingCache && Date.now() - trendingCache.at < CACHE_TTL_MS),
  );
  const [trendingError, setTrendingError] = useState(false);

  const [ytFeedConnected, setYtFeedConnected] = useState(false);
  const [ytSuggestedTracks, setYtSuggestedTracks] = useState<Track[]>([]);
  const [ytSeeds, setYtSeeds] = useState<string[]>([]);
  const [loadingYtFeed, setLoadingYtFeed] = useState(false);

  const [moodTracks, setMoodTracks] = useState<Track[]>([]);
  const [moodViews, setMoodViews] = useState<Record<string, string>>({});
  const [loadingMood, setLoadingMood] = useState(false);
  const [moodError, setMoodError] = useState(false);

  const activePill = useMemo(
    () => MOOD_PILLS.find((p) => p.id === selectedMood) ?? MOOD_PILLS[0],
    [selectedMood],
  );

  const fetchTrending = useCallback((force = false) => {
    if (
      !force &&
      trendingCache &&
      Date.now() - trendingCache.at < CACHE_TTL_MS
    ) {
      setTrendingTracks(trendingCache.tracks);
      setTrendingViews(trendingCache.viewsById);
      setLoadingTrending(false);
      setTrendingError(false);
      return () => undefined;
    }

    let active = true;
    setLoadingTrending(true);
    setTrendingError(false);

    fetch("/api/youtube/trending?limit=18", {
      signal: AbortSignal.timeout(9000),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load trending");
        return (await res.json()) as { results?: TrendingApiItem[] };
      })
      .then((payload) => {
        if (!active) return;
        const registered: Track[] = [];
        const viewsById: Record<string, string> = {};
        for (const item of payload?.results ?? []) {
          const track = registerTrendingItem(item);
          if (track) {
            registered.push(track);
            if (item.views) viewsById[track.id] = item.views;
          }
        }
        trendingCache = { at: Date.now(), tracks: registered, viewsById };
        setTrendingTracks(registered);
        setTrendingViews(viewsById);
      })
      .catch(() => {
        if (active) setTrendingError(true);
      })
      .finally(() => {
        if (active) setLoadingTrending(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return fetchTrending(false);
  }, [fetchTrending]);

  // Personalized YouTube Music feed if user has YouTube connected
  useEffect(() => {
    if (!session) {
      setYtFeedConnected(false);
      setYtSuggestedTracks([]);
      setYtSeeds([]);
      setLoadingYtFeed(false);
      return;
    }

    const cacheKey = session.email || session.displayName || "user";
    const cached = ytFeedCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setYtFeedConnected(cached.connected);
      setYtSuggestedTracks(cached.suggested);
      setYtSeeds(cached.seeds);
      setLoadingYtFeed(false);
      return;
    }

    let active = true;
    setLoadingYtFeed(true);

    fetch("/api/youtube/feed", { signal: AbortSignal.timeout(10000) })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as {
          connected?: boolean;
          suggested?: SearchApiItem[];
          seeds?: string[];
        };
      })
      .then((payload) => {
        if (!active || !payload) return;
        const connected = Boolean(payload.connected);
        const suggested = (payload.suggested ?? [])
          .filter((item) => Boolean(item.videoId))
          .map((item) =>
            registerYouTubeSearchResult({
              videoId: item.videoId,
              title: item.title,
              artist: item.artist,
              durationSeconds: item.durationSeconds,
              thumbnail: item.thumbnail,
            }),
          );
        const seeds = Array.isArray(payload.seeds) ? payload.seeds : [];
        ytFeedCache.set(cacheKey, {
          at: Date.now(),
          connected,
          suggested,
          seeds,
        });
        setYtFeedConnected(connected);
        setYtSuggestedTracks(suggested);
        setYtSeeds(seeds);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingYtFeed(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  // Mood & Genre pill fetch with module-level Map cache
  const fetchMood = useCallback((pillId: MoodPillId, query: string, force = false) => {
    if (pillId === "all" || !query) {
      setMoodTracks([]);
      setMoodViews({});
      setLoadingMood(false);
      setMoodError(false);
      return () => undefined;
    }

    const cached = !force ? moodSearchCache.get(pillId) : undefined;
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setMoodTracks(cached.tracks);
      setMoodViews(cached.viewsById);
      setLoadingMood(false);
      setMoodError(false);
      return () => undefined;
    }

    let active = true;
    setLoadingMood(true);
    setMoodError(false);

    fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(9000),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load mood tracks");
        return (await res.json()) as { results?: SearchApiItem[] };
      })
      .then((payload) => {
        if (!active) return;
        const resolved: Track[] = [];
        const viewsById: Record<string, string> = {};
        for (const item of (payload?.results ?? []).slice(0, 18)) {
          if (!item.videoId) continue;
          const track = registerYouTubeSearchResult({
            videoId: item.videoId,
            title: item.title,
            artist: item.artist,
            album: item.album,
            durationSeconds: item.durationSeconds,
            thumbnail: item.thumbnail,
            views: item.views,
          });
          resolved.push(track);
          if (item.views) viewsById[track.id] = item.views;
        }
        moodSearchCache.set(pillId, {
          at: Date.now(),
          tracks: resolved,
          viewsById,
        });
        setMoodTracks(resolved);
        setMoodViews(viewsById);
      })
      .catch(() => {
        if (active) setMoodError(true);
      })
      .finally(() => {
        if (active) setLoadingMood(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return fetchMood(activePill.id, activePill.query, false);
  }, [activePill, fetchMood]);

  const isAll = selectedMood === "all";
  const activeTracks = isAll ? trendingTracks : moodTracks;
  const activeViews = isAll ? trendingViews : moodViews;
  const isLoadingActive = isAll ? loadingTrending : loadingMood;
  const hasActiveError = isAll ? trendingError : moodError;

  const activeTrackIds = useMemo(
    () => activeTracks.map((t) => t.id),
    [activeTracks],
  );
  const ytSuggestedIds = useMemo(
    () => ytSuggestedTracks.map((t) => t.id),
    [ytSuggestedTracks],
  );

  const featuredGridTracks = useMemo(
    () => activeTracks.slice(0, 6),
    [activeTracks],
  );
  const chartTracks = useMemo(
    () => activeTracks.slice(0, 18),
    [activeTracks],
  );

  const playCollection = (ids: string[], label: string, shouldShuffle = false) => {
    if (ids.length === 0) return;
    if (shouldShuffle && !shuffle) toggleShuffle();
    const firstId = shouldShuffle
      ? ids[Math.floor(Math.random() * ids.length)]
      : ids[0];
    playTrack(firstId, ids, label);
  };

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-clip">
      <div className="page-container min-w-0">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-[32px] font-bold leading-none tracking-[-0.04em] text-foreground sm:text-[42px]">
              Explore
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Trending music, top charts, and genres on YouTube Music
            </p>
          </div>
          <Link
            href="/search"
            className="group inline-flex w-fit max-w-full shrink-0 items-center gap-2 rounded-full border border-white/[0.08] bg-card px-4 py-2 text-xs font-semibold text-foreground/90 transition hover:border-white/[0.16] hover:bg-elevated hover:text-foreground"
          >
            <Compass className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>Search</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Mood & Genre Pills */}
        <div
          data-no-tab-swipe="true"
          className="-mx-3.5 mb-8 flex min-w-0 items-center gap-2 overflow-x-auto px-3.5 py-1 no-scrollbar sm:mx-0 sm:px-0"
          role="tablist"
          aria-label="Moods and genres"
        >
          {MOOD_PILLS.map((pill) => {
            const active = selectedMood === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedMood(pill.id)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-white/[0.08] bg-card text-muted-foreground hover:border-white/[0.16] hover:bg-elevated hover:text-foreground",
                )}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Personalized Picked For You (YouTube connected) */}
        {isAll && ytFeedConnected && (loadingYtFeed || ytSuggestedTracks.length > 0) && (
          <section className="mb-10 min-w-0">
            <SectionHeader
              title="Picked for you"
              eyebrow={
                ytSeeds.length > 0
                  ? `Based on ${ytSeeds.slice(0, 2).join(" & ")}`
                  : "From your YouTube Music"
              }
              action={
                ytSuggestedTracks.length > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      playCollection(ytSuggestedIds, "Picked for you", false)
                    }
                    className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/[0.1] bg-card px-3 text-[11px] font-semibold text-foreground/90 transition hover:border-white/[0.18] hover:bg-elevated"
                  >
                    <Play className="h-3 w-3 fill-current" strokeWidth={0} />
                    <span>Play all</span>
                  </button>
                ) : undefined
              }
            />
            {loadingYtFeed ? (
              <CardGridSkeleton count={6} />
            ) : (
              <div
                data-no-tab-swipe="true"
                className="-mx-3.5 flex min-w-0 snap-x snap-mandatory gap-3.5 overflow-x-auto px-3.5 py-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0 sm:py-0 lg:grid-cols-6 [&>*]:w-[152px] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto"
              >
                {ytSuggestedTracks.slice(0, 12).map((track) => (
                  <CarouselTrackCard
                    key={track.id}
                    track={track}
                    contextIds={ytSuggestedIds}
                    contextLabel="Picked for you"
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Featured / Trending Now (or Selected Mood) */}
        <section className="mb-10 min-w-0">
          <SectionHeader
            title={isAll ? "Trending now" : `${activePill.label} highlights`}
            eyebrow={isAll ? "YouTube Music" : "Genre & mood"}
            action={
              activeTracks.length > 0 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      playCollection(
                        activeTrackIds,
                        isAll ? "Trending Now" : activePill.label,
                        false,
                      )
                    }
                    className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition hover:brightness-110"
                  >
                    <Play className="h-3 w-3 fill-current" strokeWidth={0} />
                    <span>Play</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      playCollection(
                        activeTrackIds,
                        isAll ? "Trending Now" : activePill.label,
                        true,
                      )
                    }
                    aria-label="Shuffle tracks"
                    className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/[0.1] bg-card px-3 text-[11px] font-semibold text-foreground/90 transition hover:border-white/[0.18] hover:bg-elevated"
                  >
                    <Shuffle className="h-3 w-3" />
                    <span className="hidden sm:inline">Shuffle</span>
                  </button>
                </div>
              ) : undefined
            }
          />

          {isLoadingActive ? (
            <CardGridSkeleton count={6} />
          ) : hasActiveError && activeTracks.length === 0 ? (
            <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/[0.08] bg-card p-6 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Could not load tracks right now
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Check your connection and try again.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  isAll
                    ? fetchTrending(true)
                    : fetchMood(activePill.id, activePill.query, true)
                }
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-elevated px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-elevated/80"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : (
            <div
              data-no-tab-swipe="true"
              className="-mx-3.5 flex min-w-0 snap-x snap-mandatory gap-3.5 overflow-x-auto px-3.5 py-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0 sm:py-0 lg:grid-cols-6 [&>*]:w-[152px] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto"
            >
              {featuredGridTracks.map((track) => (
                <CarouselTrackCard
                  key={track.id}
                  track={track}
                  contextIds={activeTrackIds}
                  contextLabel={isAll ? "Trending Now" : activePill.label}
                  views={activeViews[track.id]}
                />
              ))}
            </div>
          )}
        </section>

        {/* Top Charts / Numbered Track List */}
        {(isLoadingActive || chartTracks.length > 0) && (
          <section className="mb-8 min-w-0">
            <SectionHeader
              title={isAll ? "Top charts" : `Top ${activePill.label} tracks`}
              eyebrow="Charts"
            />
            {isLoadingActive ? (
              <div className="rounded-2xl border border-white/[0.08] bg-card p-3 sm:p-4">
                <ChartListSkeleton count={10} />
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.08] bg-card p-2 sm:p-3">
                <div className="grid min-w-0 grid-cols-1 gap-0.5 lg:grid-cols-2 lg:gap-x-4">
                  {chartTracks.map((track, index) => (
                    <ChartTrackRow
                      key={track.id}
                      track={track}
                      rank={index + 1}
                      contextIds={activeTrackIds}
                      contextLabel={isAll ? "Top Charts" : `${activePill.label} Charts`}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
