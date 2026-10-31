"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Clock3, SearchX, Sparkles, X } from "lucide-react";
import { artists, genres, getArtist, getArtistTracks } from "@/lib/catalog";
import { getSearchSuggestions, searchCatalog, type SearchSuggestion } from "@/lib/search";
import { useAppStore } from "@/store/app-store";
import { Artwork } from "@/components/music/artwork";
import { AlbumCard } from "@/components/music/album-card";
import { ArtistCard } from "@/components/music/artist-card";
import { EmptyState } from "@/components/music/empty-state";
import { GenreCard } from "@/components/music/genre-card";
import { PlayButton } from "@/components/music/play-button";
import { PlaylistCard } from "@/components/music/playlist-card";
import { TrackList } from "@/components/music/track-list";
import { SearchInput } from "@/components/search/search-input";
import { SearchResultsSkeleton } from "@/components/search/search-results-skeleton";
import { YouTubeSearchResults, type YouTubeSearchStatus } from "@/components/search/youtube-search-results";
import { cn } from "@/lib/utils";

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

const searchSuggestionsPool = [
  "Mira Vale",
  "KAIROS",
  "Ambient",
  "Halcyon Hours",
  "Soft Static",
  "Late night",
  "Iris Ember",
  "Blue Hour Cinema",
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [catalogStatus, setCatalogStatus] = useState<YouTubeSearchStatus>({
    count: 0,
    loading: false,
    unavailable: false,
  });
  const recentSearches = useAppStore((state) => state.recentSearches);
  const addRecentSearch = useAppStore((state) => state.addRecentSearch);
  const clearRecentSearches = useAppStore((state) => state.clearRecentSearches);

  const results = useMemo(() => searchCatalog(query), [query]);
  const suggestions = useMemo(() => getSearchSuggestions(query), [query]);
  const hasQuery = query.trim().length > 0;
  const onCatalogStatusChange = useCallback((status: YouTubeSearchStatus) => {
    setCatalogStatus(status);
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

  const chooseSuggestion = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.label);
    addRecentSearch(suggestion.label);
  };

  return (
    <div className="page-container">
      <div className="mb-7 max-w-[820px]">
        <p className="eyebrow mb-3">Find your next favourite</p>
        <h1 className="text-[36px] font-medium leading-none tracking-[-0.045em] sm:text-[48px]">
          Search
        </h1>
      </div>

      <div className="relative max-w-[760px]">
        <SearchInput
          value={query}
          onChange={setQuery}
          onSubmit={() => addRecentSearch(query)}
          autoFocus
        />
        {hasQuery && suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.slice(0, 5).map((suggestion) => (
              <button
                key={`${suggestion.type}-${suggestion.label}`}
                type="button"
                onClick={() => chooseSuggestion(suggestion)}
                className="flex items-center gap-2 rounded-full border border-white/[.065] bg-white/[.025] py-1 pl-1 pr-3 text-[11px] text-muted-foreground transition hover:border-white/[.12] hover:bg-white/[.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Artwork src={suggestion.artwork} alt="" className="h-6 w-6 rounded-full" />
                <span className="font-medium">{suggestion.label}</span>
                <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground/50">
                  {suggestion.type}
                </span>
              </button>
            ))}
          </div>
        )}
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
                    className="group flex items-center gap-2 rounded-full border border-white/[.07] bg-white/[.025] px-3.5 py-2 text-xs text-muted-foreground transition hover:border-white/[.13] hover:bg-white/[.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Clock3 className="h-3.5 w-3.5 text-muted-foreground/65" />
                    {item}
                    <X
                      className="h-3 w-3 opacity-0 transition group-hover:opacity-60"
                      onClick={(event) => {
                        event.stopPropagation();
                        const next = recentSearches.filter((entry) => entry !== item);
                        useAppStore.setState({ recentSearches: next });
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
                  className="rounded-full border border-white/[.065] bg-white/[.025] px-4 py-2 text-xs text-muted-foreground transition hover:border-primary/30 hover:bg-primary/[.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {term}
                </button>
              ))}
            </div>
          </section>

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
                <div className="group relative rounded-xl border border-white/[.06] bg-white/[.025] p-4 transition-colors hover:bg-white/[.04]">
                  <Link
                    href={top.href}
                    className="block outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`Open ${top.title}`}
                  >
                    <Artwork
                      src={top.image}
                      alt={`${top.title} artwork`}
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
                <div className="rounded-xl border border-white/[.045] bg-white/[.012] px-2 py-2">
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
                    className="flex items-center gap-2 rounded-full border border-white/[.07] bg-white/[.025] px-4 py-2 text-xs text-muted-foreground transition hover:border-white/[.15] hover:text-foreground"
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

    </div>
  );
}
