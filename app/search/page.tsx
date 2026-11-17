"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Clock3, Flame, Pause, Play, SearchX, Sparkles, X } from "lucide-react";
import { artists, genres, getArtist, getArtistTracks, getTrack } from "@/lib/catalog";
import {
  registerAudiusSearchResult,
  registerYouTubeSearchResult,
} from "@/lib/dynamic-tracks";
import { getSearchSuggestions, getSuggestionHref, searchCatalog } from "@/lib/search";
import { useAppStore } from "@/store/app-store";
import { usePlayerStore } from "@/store/player-store";
import { Artwork } from "@/components/music/artwork";
import { AlbumCard } from "@/components/music/album-card";
import { ArtistCard } from "@/components/music/artist-card";
import { EmptyState } from "@/components/music/empty-state";
import { GenreCard } from "@/components/music/genre-card";
import { PlayButton } from "@/components/music/play-button";
import { PlaylistCard } from "@/components/music/playlist-card";
import { TrackList } from "@/components/music/track-list";
import { SearchInput, type LiveSearchSuggestion } from "@/components/search/search-input";
import { SearchResultsSkeleton } from "@/components/search/search-results-skeleton";
import { YouTubeSearchResults, type YouTubeSearchStatus } from "@/components/search/youtube-search-results";
import { LiveMusicDiscovery } from "@/components/search/live-music-discovery";
import { OpenMusicSearchResults } from "@/components/search/open-music-results";
import { cn, formatDuration } from "@/lib/utils";

interface TopResult {
  kind: "artist" | "album" | "playlist";
  id: string;
  title: string;
  subtitle: string;
  image: string;
  href: string;
  trackIds: string[];
  round?: boolean;
}

interface TrendingItem {
  videoId?: string;
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationSeconds: number;
  thumbnail: string;
  views?: string;
  source: "youtube" | "audius" | "catalog";
  audioUrl?: string;
}

const searchSuggestionsPool = [
  "Arijit Singh",
  "Sajjan Raj Vaidya",
  "Narayan Gopal",
  "Shreya Ghoshal",
  "Tribal Rain",
  "Hindi indie",
  "Nepali pop",
  "A.R. Rahman",
];

const suggestCache = new Map<string, LiveSearchSuggestion[]>();
let trendingCache: TrendingItem[] | null = null;

function mapTrendingItemToTrackId(item: TrendingItem): string | null {
  if (item.source === "youtube" || item.videoId) {
    const videoId = item.videoId || item.id.replace(/^yt-/, "");
    if (!videoId) return null;
    return registerYouTubeSearchResult({
      videoId,
      title: item.title,
      artist: item.artist,
      album: item.album,
      durationSeconds: item.durationSeconds,
      thumbnail: item.thumbnail,
      views: item.views,
    }).id;
  }
  if (item.source === "audius") {
    const cleanId = item.id.replace(/^aud-/, "");
    if (!cleanId) return null;
    return registerAudiusSearchResult({
      id: cleanId,
      title: item.title,
      artist: item.artist,
      album: item.album,
      durationSeconds: item.durationSeconds,
      artwork: item.thumbnail,
      audioUrl: item.audioUrl,
    }).id;
  }
  return getTrack(item.id)?.id ?? null;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [remoteSuggestions, setRemoteSuggestions] = useState<LiveSearchSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [trending, setTrending] = useState<TrendingItem[]>(() => trendingCache ?? []);
  const [loadingTrending, setLoadingTrending] = useState(() => trendingCache === null);
  const [catalogStatus, setCatalogStatus] = useState<YouTubeSearchStatus>({
    count: 0,
    loading: false,
    unavailable: false,
  });

  const recentSearches = useAppStore((state) => state.recentSearches);
  const addRecentSearch = useAppStore((state) => state.addRecentSearch);
  const clearRecentSearches = useAppStore((state) => state.clearRecentSearches);

  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const results = useMemo(() => searchCatalog(query), [query]);
  const localSuggestions = useMemo(() => {
    if (!query.trim()) return [];
    return getSearchSuggestions(query).map((item): LiveSearchSuggestion => ({
      query: item.label,
      type:
        item.type === "artist" || item.type === "album" || item.type === "track"
          ? item.type
          : "youtube",
      subtitle: item.detail,
      artwork: item.artwork,
      href: getSuggestionHref(item) ?? undefined,
    }));
  }, [query]);

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;
  const onCatalogStatusChange = useCallback((status: YouTubeSearchStatus) => {
    setCatalogStatus(status);
  }, []);

  // Debounced YouTube-style live suggestions
  useEffect(() => {
    if (!trimmedQuery) {
      setRemoteSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    const cacheKey = trimmedQuery.toLowerCase();
    const cached = suggestCache.get(cacheKey);
    if (cached) {
      setRemoteSuggestions(cached);
      setLoadingSuggestions(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoadingSuggestions(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/youtube/suggest?q=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Suggest failed");
        const payload = (await response.json()) as {
          suggestions?: Array<{
            query: string;
            type: "youtube" | "artist" | "album" | "track";
            subtitle?: string;
            artwork?: string;
            href?: string;
          }>;
        };
        if (!active) return;
        const next: LiveSearchSuggestion[] = (payload.suggestions ?? [])
          .filter((item) => item && typeof item.query === "string" && item.query.trim())
          .map((item) => ({
            query: item.query.trim(),
            type: item.type ?? "youtube",
            subtitle: item.subtitle,
            artwork: item.artwork,
            href: item.href,
          }));
        suggestCache.set(cacheKey, next);
        setRemoteSuggestions(next);
      } catch {
        if (active && !controller.signal.aborted) {
          setRemoteSuggestions([]);
        }
      } finally {
        if (active) setLoadingSuggestions(false);
      }
    }, 160);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmedQuery]);

  // Merge remote + local suggestions cleanly without duplicates
  const mergedSuggestions = useMemo(() => {
    const merged: LiveSearchSuggestion[] = [];
    const seen = new Set<string>();
    for (const item of [...localSuggestions, ...remoteSuggestions]) {
      const key = item.query.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
      if (merged.length >= 10) break;
    }
    return merged;
  }, [localSuggestions, remoteSuggestions]);

  // Fetch Trending on Sangeet when viewing empty search page
  useEffect(() => {
    if (trendingCache !== null) {
      setTrending(trendingCache);
      setLoadingTrending(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoadingTrending(true);

    fetch("/api/youtube/trending?limit=12", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Trending unavailable"))))
      .then((payload: { results?: TrendingItem[] }) => {
        if (!active) return;
        const rows = Array.isArray(payload.results) ? payload.results.slice(0, 12) : [];
        trendingCache = rows;
        setTrending(rows);
      })
      .catch(() => {
        if (active && !controller.signal.aborted) {
          setTrending([]);
        }
      })
      .finally(() => {
        if (active) setLoadingTrending(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!hasQuery) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      setLoading(false);
      if (results.total > 0) addRecentSearch(query);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query, hasQuery, results.total, addRecentSearch]);

  const top: TopResult | null = useMemo(() => {
    if (results.artists[0]) {
      const artist = results.artists[0];
      return {
        kind: "artist",
        id: artist.id,
        title: artist.name,
        subtitle: "Artist",
        image: artist.image,
        href: `/artist/${artist.id}`,
        trackIds: getArtistTracks(artist.id).map((track) => track.id),
        round: true,
      };
    }
    if (results.albums[0]) {
      const album = results.albums[0];
      return {
        kind: "album",
        id: album.id,
        title: album.title,
        subtitle: `Album · ${getArtist(album.artistId)?.name ?? "Sangeet"}`,
        image: album.artwork,
        href: `/album/${album.id}`,
        trackIds: album.trackIds,
      };
    }
    if (results.playlists[0]) {
      const playlist = results.playlists[0];
      return {
        kind: "playlist",
        id: playlist.id,
        title: playlist.title,
        subtitle: "Playlist",
        image: playlist.artwork,
        href: `/playlist/${playlist.id}`,
        trackIds: playlist.trackIds,
      };
    }
    if (results.genres[0]) {
      const genre = results.genres[0];
      return {
        kind: "artist",
        id: genre.id,
        title: genre.name,
        subtitle: "Genre",
        image: genre.image,
        href: `/genre/${genre.id}`,
        trackIds: genre.trackIds,
      };
    }
    return null;
  }, [results]);

  const handleSelectSuggestion = useCallback(
    (suggestion: LiveSearchSuggestion) => {
      setQuery(suggestion.query);
      addRecentSearch(suggestion.query);
    },
    [addRecentSearch],
  );

  const handleFillSuggestion = useCallback((value: string) => {
    setQuery(value);
  }, []);

  const handleRemoveRecentSearch = useCallback((item: string) => {
    const next = useAppStore
      .getState()
      .recentSearches.filter((entry) => entry.toLowerCase() !== item.toLowerCase());
    useAppStore.setState({ recentSearches: next });
  }, []);

  const playTrendingAt = useCallback(
    (index: number) => {
      const queueIds = trending
        .map(mapTrendingItemToTrackId)
        .filter((id): id is string => Boolean(id));
      const targetId = queueIds[index];
      if (!targetId) return;
      if (currentTrackId === targetId) {
        togglePlay();
      } else {
        playTrack(targetId, queueIds, "Trending on Sangeet");
      }
    },
    [trending, currentTrackId, togglePlay, playTrack],
  );

  return (
    <div className="page-container">
      <div className="mb-7 max-w-[820px]">
        <p className="eyebrow mb-3">Find your next favourite</p>
        <h1 className="text-[36px] font-medium leading-none tracking-[-0.045em] sm:text-[48px]">
          Search
        </h1>
      </div>

      <div className="relative z-30 max-w-[760px]">
        <SearchInput
          value={query}
          onChange={setQuery}
          onSubmit={() => addRecentSearch(query)}
          suggestions={mergedSuggestions}
          onSelectSuggestion={handleSelectSuggestion}
          onFillSuggestion={handleFillSuggestion}
          recentSearches={recentSearches}
          onRemoveRecentSearch={handleRemoveRecentSearch}
          isLoadingSuggestions={loadingSuggestions}
          autoFocus
        />
      </div>

      {!hasQuery ? (
        <div className="mt-10">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-medium tracking-[-0.025em]">Recent searches</h2>
              {recentSearches.length > 0 && (
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-[11px] text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Clear
                </button>
              )}
            </div>
            {recentSearches.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setQuery(item)}
                    className="group flex items-center gap-2 rounded-full border border-white/[.08] bg-card px-3.5 py-2 text-xs text-muted-foreground transition hover:border-white/[.16] hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Clock3 className="h-3.5 w-3.5 text-muted-foreground/65" />
                    {item}
                    <X
                      className="h-3 w-3 opacity-0 transition group-hover:opacity-60"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRemoveRecentSearch(item);
                      }}
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Your recent searches will appear here.</p>
            )}
          </section>

          <section className="mt-10">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-xl font-medium tracking-[-0.025em]">Try a feeling</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Late night", "Deep focus", "Sunday slow", "Warm soul", "Electronic"].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setQuery(term)}
                  className="rounded-full border border-white/[.08] bg-card px-4 py-2 text-xs text-muted-foreground transition hover:border-primary/35 hover:bg-primary/[.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {term}
                </button>
              ))}
            </div>
          </section>

          {(loadingTrending || trending.length > 0) && (
            <section className="mt-12" aria-label="Trending on Sangeet">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-primary" />
                  <h2 className="text-xl font-medium tracking-[-0.025em]">Trending on Sangeet</h2>
                </div>
                {trending.length > 0 && (
                  <button
                    type="button"
                    onClick={() => playTrendingAt(0)}
                    className="rounded-full border border-white/[.08] bg-card px-3.5 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-white/[.16] hover:bg-elevated hover:text-foreground"
                  >
                    Play all
                  </button>
                )}
              </div>

              {loadingTrending ? (
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex animate-pulse items-center gap-3 rounded-xl border border-white/[.08] bg-card p-2.5"
                    >
                      <div className="h-5 w-7 rounded bg-white/[.06]" />
                      <div className="h-12 w-12 shrink-0 rounded-md bg-white/[.06]" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-3 w-2/3 rounded bg-white/[.06]" />
                        <div className="h-2.5 w-1/2 rounded bg-white/[.04]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {trending.map((item, index) => {
                    const expectedTrackId =
                      item.source === "youtube" || item.videoId
                        ? `yt-${item.videoId || item.id.replace(/^yt-/, "")}`
                        : item.source === "audius"
                          ? `aud-${item.id.replace(/^aud-/, "")}`
                          : item.id;
                    const isCurrent = currentTrackId === expectedTrackId;

                    return (
                      <button
                        key={`${item.id}-${index}`}
                        type="button"
                        onClick={() => playTrendingAt(index)}
                        className={cn(
                          "group flex min-w-0 items-center gap-3 rounded-xl border border-white/[.08] bg-card p-2.5 text-left transition hover:border-white/[.16] hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          isCurrent && "border-primary/35 bg-primary/[0.08]",
                        )}
                      >
                        <span
                          className={cn(
                            "w-7 shrink-0 text-center font-mono text-xs font-semibold tabular-nums",
                            index < 3 ? "text-primary" : "text-muted-foreground/75",
                          )}
                        >
                          #{index + 1}
                        </span>

                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md">
                          <Artwork
                            src={item.thumbnail}
                            alt={item.title}
                            res="sm"
                            className="h-full w-full rounded-md"
                          />
                          <span
                            className={cn(
                              "absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity",
                              isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                            )}
                          >
                            {isCurrent && isPlaying ? (
                              <Pause className="h-4 w-4 fill-current" />
                            ) : (
                              <Play className="ml-0.5 h-4 w-4 fill-current" />
                            )}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "truncate text-[13px] font-semibold",
                              isCurrent ? "text-primary" : "text-foreground",
                            )}
                          >
                            {item.title}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                            <span className="truncate">{item.artist}</span>
                            {item.durationSeconds > 0 && (
                              <>
                                <span className="text-muted-foreground/40">·</span>
                                <span className="shrink-0 tabular-nums">
                                  {formatDuration(item.durationSeconds)}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          <section className="mt-12">
            <h2 className="mb-5 text-xl font-medium tracking-[-0.025em]">Browse everything</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {genres.map((genre) => (
                <GenreCard key={genre.id} genre={genre} />
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h2 className="mb-5 text-xl font-medium tracking-[-0.025em]">Explore artists</h2>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
              {artists.slice(0, 6).map((artist) => (
                <ArtistCard key={artist.id} artist={artist} showFollow={false} />
              ))}
            </div>
          </section>
        </div>
      ) : loading ? (
        <SearchResultsSkeleton />
      ) : results.total === 0 && !catalogStatus.loading && catalogStatus.count === 0 ? (
        <div className="mt-12 max-w-xl">
          <EmptyState
            icon={<SearchX className="h-5 w-5" />}
            title="No results for that search"
            description={`We couldn’t find anything for “${query}”. Try an artist, mood, album or a broader phrase.`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {searchSuggestionsPool.slice(0, 3).map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setQuery(term)}
                    className="rounded-full border border-white/[.08] px-3.5 py-2 text-xs text-muted-foreground transition hover:border-white/20 hover:text-foreground"
                  >
                    {term}
                  </button>
                ))}
              </div>
            }
          />
        </div>
      ) : (
        <div className="mt-9">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {results.total + catalogStatus.count}{" "}
              {results.total + catalogStatus.count === 1 ? "result" : "results"} for{" "}
              <span className="font-medium text-foreground">“{query}”</span>
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-[11px] text-muted-foreground transition hover:text-foreground"
            >
              Clear search
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[.82fr_1.18fr]">
            {top && (
              <section>
                <h2 className="mb-3 text-xl font-medium tracking-[-0.025em]">Top result</h2>
                <div className="group relative rounded-xl border border-white/[.08] bg-card p-4 transition-colors hover:border-white/[.16] hover:bg-elevated">
                  <Link
                    href={top.href}
                    className="block outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`Open ${top.title}`}
                  >
                    <Artwork
                      src={top.image}
                      alt={`${top.title} artwork`}
                      res="md"
                      className={cn("h-[96px] w-[96px] shadow-lg", top.round ? "rounded-full" : "rounded-lg")}
                    />
                    <h3 className="mt-5 line-clamp-2 font-display text-2xl font-medium leading-tight tracking-[-0.04em]">
                      {top.title}
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground">{top.subtitle}</p>
                  </Link>
                  <PlayButton
                    trackIds={top.trackIds}
                    label={top.title}
                    size="md"
                    className="absolute right-4 top-4 translate-y-1 opacity-100 transition-all duration-200 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100"
                  />
                </div>
              </section>
            )}

            {results.tracks.length > 0 && (
              <section className="min-w-0">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xl font-medium tracking-[-0.025em]">Tracks</h2>
                  <span className="text-[10px] text-muted-foreground">{results.tracks.length}</span>
                </div>
                <div className="rounded-xl border border-white/[.08] bg-card px-2 py-2">
                  <TrackList
                    trackIds={results.tracks.slice(0, 5).map((track) => track.id)}
                    label={`Search results for ${query}`}
                    showAlbum
                  />
                </div>
              </section>
            )}
          </div>

          {results.artists.length > 0 && (
            <section className="mt-10">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-medium tracking-[-0.025em]">Artists</h2>
                <span className="text-[10px] text-muted-foreground">{results.artists.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
                {results.artists.slice(0, 6).map((artist) => (
                  <ArtistCard key={artist.id} artist={artist} showFollow={false} />
                ))}
              </div>
            </section>
          )}

          {results.albums.length > 0 && (
            <section className="mt-10">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-medium tracking-[-0.025em]">Albums</h2>
                <span className="text-[10px] text-muted-foreground">{results.albums.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
                {results.albums.slice(0, 6).map((album) => (
                  <AlbumCard key={album.id} album={album} />
                ))}
              </div>
            </section>
          )}

          {results.playlists.length > 0 && (
            <section className="mt-10">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-medium tracking-[-0.025em]">Playlists</h2>
                <span className="text-[10px] text-muted-foreground">{results.playlists.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
                {results.playlists.slice(0, 6).map((playlist) => (
                  <PlaylistCard key={playlist.id} playlist={playlist} hideDescription />
                ))}
              </div>
            </section>
          )}

          {results.genres.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-5 text-xl font-medium tracking-[-0.025em]">Genres</h2>
              <div className="flex flex-wrap gap-2">
                {results.genres.map((genre) => (
                  <Link
                    key={genre.id}
                    href={`/genre/${genre.id}`}
                    className="flex items-center gap-2 rounded-full border border-white/[.08] bg-card px-4 py-2 text-xs text-muted-foreground transition hover:border-white/[.16] hover:bg-elevated hover:text-foreground"
                  >
                    {genre.name}
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {hasQuery && (
        <YouTubeSearchResults query={query} onStatusChange={onCatalogStatusChange} />
      )}
      {hasQuery && <LiveMusicDiscovery query={query} />}
      {hasQuery && <OpenMusicSearchResults query={query} />}
    </div>
  );
}
