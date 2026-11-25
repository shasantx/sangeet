"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  HardDrive,
  Heart,
  History,
  ListMusic,
  Plus
} from "lucide-react";
import { useLibraryStore } from "@/store/library-store";
import { offlineMetaToTrack, useOfflineStore } from "@/store/offline-store";
import { ArtworkMosaic } from "@/components/music/artwork-mosaic";
import { TrackArtwork } from "@/components/music/track-artwork";
import { SiteFooter } from "@/components/shell/site-footer";
import { cn } from "@/lib/utils";

type Filter = "all" | "playlists" | "artists" | "albums";

export default function LibraryPage() {
  const likedTracks = useLibraryStore((s) => s.likedTracks);
  const playlists = useLibraryStore((s) => s.playlists);
  const savedArtists = useLibraryStore((s) => s.savedArtists);
  const savedAlbums = useLibraryStore((s) => s.savedAlbums);
  const recentlyPlayed = useLibraryStore((s) => s.recentlyPlayed);

  const offlineItems = useOfflineStore((s) => s.items);
  const refreshOffline = useOfflineStore((s) => s.refresh);

  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    void refreshOffline();
  }, [refreshOffline]);

  const offlineTracks = offlineItems.map(offlineMetaToTrack);

  const handleCreate = () => {
    window.dispatchEvent(new Event("sangeet:create-playlist"));
  };

  const collections = [
    {
      href: "/liked",
      label: "Liked songs",
      sub: `${likedTracks.length} tracks`,
      tracks: likedTracks,
      icon: <Heart className="h-4 w-4 fill-white text-white" strokeWidth={1.5} />,
      accent: "mint" as const
    },
    {
      href: "/offline",
      label: "Offline & local",
      sub: `${offlineItems.length} saved`,
      tracks: offlineTracks,
      icon: <HardDrive className="h-4 w-4 text-white" strokeWidth={1.5} />,
      accent: "forest" as const
    },
    {
      href: "/recently-played",
      label: "Recently played",
      sub: `${recentlyPlayed.length} tracks`,
      tracks: recentlyPlayed,
      icon: <History className="h-4 w-4 text-white" strokeWidth={1.5} />,
      accent: "emerald" as const
    }
  ];

  return (
    <div className="studio-enter min-h-full overflow-x-hidden space-y-6 p-4 pb-12 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.02em] text-encore-text sm:text-3xl">
            Library
          </h1>
          <p className="mt-1 font-mono text-xs tabular-nums text-encore-subdued">
            {playlists.length} playlists • {likedTracks.length} liked
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreate}
          className="btn-cobalt inline-flex h-11 items-center gap-2 rounded-full px-5 text-xs font-semibold transition-transform duration-150 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          New playlist
        </button>
      </div>

      {/* Filter Chips */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
        {(["all", "playlists", "artists", "albums"] as const).map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setFilter(chip)}
            aria-pressed={filter === chip}
            className={cn(
              "min-h-[44px] shrink-0 rounded-full px-4 text-xs font-semibold capitalize transition-colors duration-150",
              filter === chip
                ? "btn-cobalt"
                : "bg-encore-elevated/70 text-encore-subdued hover:bg-encore-elevated-highlight hover:text-encore-text"
            )}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Personal Collections with Song-Cover Mosaics */}
      {filter === "all" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {collections.map(({ href, label, sub, tracks, icon, accent }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 rounded-2xl bg-encore-elevated/70 p-3 transition-colors duration-150 hover:bg-encore-elevated-highlight"
            >
              <ArtworkMosaic
                tracks={tracks}
                alt={label}
                icon={icon}
                accent={accent}
                className="h-14 w-14 shrink-0 rounded-lg"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-encore-text">
                  {label}
                </p>
                <p className="mt-1 truncate font-mono text-xs tabular-nums text-encore-subdued">
                  {sub}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Playlists with Dynamic 2x2 Song-Cover Mosaics */}
      {(filter === "all" || filter === "playlists") && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-encore-subdued">
            Playlists{" "}
            <span className="font-mono text-xs tabular-nums text-encore-muted">
              ({playlists.length})
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {playlists.map((pl) => (
              <Link
                key={pl.id}
                href={`/playlist/${pl.id}`}
                className="group flex items-center gap-3 rounded-2xl bg-encore-elevated/70 p-3 transition-colors duration-150 hover:bg-encore-elevated-highlight"
              >
                <ArtworkMosaic
                  tracks={pl.tracks}
                  cover={pl.cover}
                  alt={pl.name}
                  icon={<ListMusic className="h-4 w-4 text-white" strokeWidth={1.5} />}
                  className="h-14 w-14 shrink-0 rounded-lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-encore-text">
                    {pl.name}
                  </p>
                  <p className="mt-1 truncate font-mono text-xs tabular-nums text-encore-subdued">
                    {pl.tracks.length}{" "}
                    {pl.tracks.length === 1 ? "track" : "tracks"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Saved Artists */}
      {(filter === "all" || filter === "artists") &&
        savedArtists.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-encore-subdued">
              Following artists{" "}
              <span className="font-mono text-xs tabular-nums text-encore-muted">
                ({savedArtists.length})
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {savedArtists.map((artist) => (
                <Link
                  key={artist.id}
                  href={`/artist/${encodeURIComponent(artist.id)}?name=${encodeURIComponent(artist.name)}`}
                  className="group flex flex-col items-center rounded-2xl bg-encore-elevated/70 p-3 text-center transition-colors duration-150 hover:bg-encore-elevated-highlight"
                >
                  <div className="mb-3 h-20 w-20 shrink-0 overflow-hidden rounded-full">
                    <TrackArtwork
                      src={artist.thumbnail}
                      alt={artist.name}
                      className="rounded-full"
                      iconClassName="h-5 w-5"
                    />
                  </div>
                  <p className="w-full truncate text-xs font-medium text-encore-text">
                    {artist.name}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

      {/* Saved Albums */}
      {(filter === "all" || filter === "albums") && savedAlbums.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-encore-subdued">
            Saved albums{" "}
            <span className="font-mono text-xs tabular-nums text-encore-muted">
              ({savedAlbums.length})
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {savedAlbums.map((album) => (
              <Link
                key={album.id}
                href={`/album/${encodeURIComponent(album.id)}?title=${encodeURIComponent(album.title)}`}
                className="group flex flex-col rounded-2xl bg-encore-elevated/70 p-3 transition-colors duration-150 hover:bg-encore-elevated-highlight"
              >
                <div className="mb-3 aspect-square w-full overflow-hidden rounded-lg">
                  <TrackArtwork
                    src={album.thumbnail}
                    alt={album.title}
                    className="rounded-lg"
                    iconClassName="h-5 w-5"
                  />
                </div>
                <p className="truncate text-xs font-medium text-encore-text">
                  {album.title}
                </p>
                <p className="truncate text-xs text-encore-muted">
                  {album.artist}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <SiteFooter compact />
    </div>
  );
}
