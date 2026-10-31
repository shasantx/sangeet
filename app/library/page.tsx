"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Clock3,
  Disc3,
  Heart,
  Library,
  ListMusic,
  Plus,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { albums, artists, getTracks, playlists } from "@/lib/catalog";
import { formatTotalDuration } from "@/lib/utils";
import { useLibraryStore } from "@/store/library-store";
import { useUIStore } from "@/store/ui-store";
import { AlbumCard } from "@/components/music/album-card";
import { ArtistCard } from "@/components/music/artist-card";
import { CollectionPlayButton } from "@/components/music/collection-actions";
import { EmptyState } from "@/components/music/empty-state";
import { PlaylistCard } from "@/components/music/playlist-card";
import { QuickTrackTile } from "@/components/music/quick-track-tile";
import { SectionHeader } from "@/components/music/section-header";
import { Input } from "@/components/ui/input";

type Filter = "all" | "playlists" | "albums" | "artists";

const quickLinks = [
  {
    href: "/liked",
    title: "Liked Songs",
    description: "Every track you have saved",
    icon: Heart,
    accent: "#8B5CF6",
  },
  {
    href: "/recently-played",
    title: "Recently Played",
    description: "Pick up where you left off",
    icon: Clock3,
    accent: "#5E7CE2",
  },
  {
    href: "/made-for-you",
    title: "Sangeet mixes",
    description: "Curated mixes and artist picks",
    icon: Sparkles,
    accent: "#C7A76C",
  },
];

export default function LibraryPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const likedTrackIds = useLibraryStore((state) => state.likedTrackIds);
  const savedAlbumIds = useLibraryStore((state) => state.savedAlbumIds);
  const followedArtistIds = useLibraryStore((state) => state.followedArtistIds);
  const userPlaylists = useLibraryStore((state) => state.playlists);
  const recentlyPlayed = useLibraryStore((state) => state.recentlyPlayed);
  const openCreate = useUIStore((state) => state.openCreatePlaylist);

  const savedAlbums = savedAlbumIds
    .map((albumId) => albums.find((album) => album.id === albumId))
    .filter((album): album is NonNullable<typeof album> => Boolean(album));
  const followedArtists = followedArtistIds
    .map((artistId) => artists.find((artist) => artist.id === artistId))
    .filter((artist): artist is NonNullable<typeof artist> => Boolean(artist));
  const recentTracks = getTracks(recentlyPlayed.slice(0, 6));
  const likedTracks = getTracks(likedTrackIds);
  const likedDuration = likedTracks.reduce((total, track) => total + track.duration, 0);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredPlaylists = useMemo(
    () =>
      userPlaylists.filter((playlist) =>
        playlist.title.toLowerCase().includes(normalizedQuery),
      ),
    [normalizedQuery, userPlaylists],
  );
  const filteredAlbums = useMemo(
    () =>
      savedAlbums.filter((album) => album.title.toLowerCase().includes(normalizedQuery)),
    [normalizedQuery, savedAlbums],
  );
  const filteredArtists = useMemo(
    () =>
      followedArtists.filter((artist) => artist.name.toLowerCase().includes(normalizedQuery)),
    [normalizedQuery, followedArtists],
  );

  const showPlaylists = filter === "all" || filter === "playlists";
  const showAlbums = filter === "all" || filter === "albums";
  const showArtists = filter === "all" || filter === "artists";

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: userPlaylists.length + savedAlbums.length + followedArtists.length },
    { id: "playlists", label: "Playlists", count: userPlaylists.length },
    { id: "albums", label: "Albums", count: savedAlbums.length },
    { id: "artists", label: "Artists", count: followedArtists.length },
  ];

  return (
    <div className="page-container">
      <div className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow mb-3">Saved for later</p>
          <h1 className="text-[38px] font-medium leading-none tracking-[-0.05em] sm:text-[52px]">
            Your library
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Everything you have kept close: albums, playlists, artists and the songs you return to.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[0_12px_30px_-14px_rgba(231,168,75,.4)] transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Plus className="h-4 w-4" />
          New playlist
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/liked"
          className="group relative isolate flex min-h-[132px] flex-col justify-between overflow-hidden rounded-xl border border-primary/20 bg-primary/[.075] p-5 transition hover:border-primary/35 hover:bg-primary/[.11]"
        >
          <div className="absolute -right-10 -top-14 -z-10 h-40 w-40 rounded-full bg-primary/20 blur-[50px]" />
          <div className="flex items-start justify-between gap-3">
            <Heart className="h-4 w-4 text-primary" fill="currentColor" />
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 transition group-hover:text-foreground" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-medium tracking-[-0.035em]">Liked Songs</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {likedTrackIds.length} songs · {formatTotalDuration(likedDuration)}
            </p>
          </div>
        </Link>
        {quickLinks.slice(1).map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group relative isolate flex min-h-[132px] flex-col justify-between overflow-hidden rounded-xl border border-white/[.055] bg-white/[.018] p-5 transition hover:border-white/[.11] hover:bg-white/[.035]"
            >
              <div
                className="absolute -right-10 -top-14 -z-10 h-40 w-40 rounded-full opacity-14 blur-[50px] transition-opacity group-hover:opacity-25"
                style={{ background: item.accent }}
              />
              <div className="flex items-start justify-between gap-3">
                <Icon className="h-4 w-4" style={{ color: item.accent }} />
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 transition group-hover:text-foreground" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-medium tracking-[-0.035em]">{item.title}</h2>
                <p className="mt-1 text-[11px] text-muted-foreground">{item.description}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-10 flex flex-col gap-4 border-b border-white/[.055] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="hide-scrollbar flex items-center gap-1.5 overflow-x-auto">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              aria-pressed={filter === item.id}
              className={
                filter === item.id
                  ? "flex shrink-0 items-center gap-2 rounded-full bg-white/[.11] px-3.5 py-1.5 text-[11.5px] font-medium text-foreground"
                  : "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-[11.5px] font-medium text-muted-foreground transition hover:bg-white/[.045] hover:text-foreground"
              }
            >
              {item.label}
              <span className="text-[9px] tabular-nums text-muted-foreground/55">{item.count}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-[280px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter your library…"
            className="h-9 rounded-full pl-9 text-xs"
            aria-label="Filter your library"
          />
        </div>
      </div>

      {showPlaylists && (
        <section className="mt-9">
          <SectionHeader
            title="Playlists"
            eyebrow="Made by you"
            action={
              <button
                type="button"
                onClick={() => openCreate()}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Create
              </button>
            }
          />
          {filteredPlaylists.length === 0 ? (
            <EmptyState
              compact
              icon={<ListMusic className="h-5 w-5" />}
              title={query ? "No playlists match" : "No playlists yet"}
              description={
                query
                  ? "Try a different name, or clear the filter to see everything."
                  : "Build a private sequence from the songs you love. Playlists are saved in this browser."
              }
              action={
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground transition hover:bg-secondary"
                >
                  <Plus className="h-4 w-4" />
                  Create playlist
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredPlaylists.map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
            </div>
          )}
        </section>
      )}

      {showAlbums && (
        <section className="section-space">
          <SectionHeader
            title="Saved albums"
            eyebrow="On the shelf"
            action={
              <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
                <Disc3 className="h-3.5 w-3.5" />
                {savedAlbums.length}
              </span>
            }
          />
          {filteredAlbums.length === 0 ? (
            <EmptyState
              compact
              icon={<Disc3 className="h-5 w-5" />}
              title={query ? "No albums match" : "No saved albums yet"}
              description={
                query
                  ? "Try a different title, or clear the filter to see everything."
                  : "Save an album from anywhere in Sangeet and it will live here."
              }
              action={
                <Link
                  href="/explore"
                  className="rounded-full border border-white/[.1] px-5 py-2.5 text-xs font-medium transition hover:border-white/20 hover:bg-white/[.04]"
                >
                  Explore albums
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredAlbums.map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </div>
          )}
        </section>
      )}

      {showArtists && (
        <section className="section-space">
          <SectionHeader
            title="Artists you follow"
            eyebrow="In your orbit"
            action={
              <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
                <UserRound className="h-3.5 w-3.5" />
                {followedArtists.length}
              </span>
            }
          />
          {filteredArtists.length === 0 ? (
            <EmptyState
              compact
              icon={<UserRound className="h-5 w-5" />}
              title={query ? "No artists match" : "No followed artists yet"}
              description={
                query
                  ? "Try a different name, or clear the filter to see everything."
                  : "Follow an artist to keep their new records close."
              }
              action={
                <Link
                  href="/explore"
                  className="rounded-full border border-white/[.1] px-5 py-2.5 text-xs font-medium transition hover:border-white/20 hover:bg-white/[.04]"
                >
                  Find artists
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {filteredArtists.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="section-space">
        <SectionHeader
          title="Recently played"
          eyebrow="Back to it"
          href="/recently-played"
          linkLabel="Full history"
        />
        {recentTracks.length === 0 ? (
          <EmptyState
            compact
            icon={<Library className="h-5 w-5" />}
            title="No listening history yet"
            description="Press play on anything and it will appear here."
            action={
              <Link
                href="/home"
                className="rounded-full bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground transition hover:bg-secondary"
              >
                Discover music
              </Link>
            }
          />
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {recentTracks.map((track) => (
                <QuickTrackTile
                  key={track.id}
                  track={track}
                  contextIds={recentlyPlayed.slice(0, 12)}
                  contextLabel="Recently played"
                />
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3">
              {recentTracks.length > 0 && (
                <CollectionPlayButton
                  trackIds={recentlyPlayed.slice(0, 12)}
                  label="Recently played"
                  size="default"
                />
              )}
              <Link
                href="/recently-played"
                className="text-[11px] text-muted-foreground transition hover:text-foreground"
              >
                See all listening history
              </Link>
            </div>
          </>
        )}
      </section>

      <section className="section-space pb-2">
        <div className="grid gap-3 sm:grid-cols-2">
          {playlists.slice(0, 2).map((playlist) => (
            <div
              key={playlist.id}
              className="flex items-center gap-4 rounded-xl border border-white/[.055] bg-white/[.018] p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="eyebrow mb-2">From Sangeet</p>
                <Link
                  href={`/playlist/${playlist.id}`}
                  className="block font-display text-lg font-medium tracking-[-0.03em] transition hover:underline"
                >
                  {playlist.title}
                </Link>
                <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                  {playlist.description}
                </p>
              </div>
              <CollectionPlayButton
                trackIds={playlist.trackIds}
                label="Play"
                size="default"
                className="shrink-0 px-4"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
