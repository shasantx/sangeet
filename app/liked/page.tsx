"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Heart, ListMusic, Search, Shuffle, Sparkles } from "lucide-react";
import { albums, getArtist, getTracks } from "@/lib/catalog";
import { formatTotalDuration } from "@/lib/utils";
import { useLibraryStore } from "@/store/library-store";
import { AlbumCard } from "@/components/music/album-card";
import { CollectionPlayButton, CollectionShuffleButton } from "@/components/music/collection-actions";
import { EmptyState } from "@/components/music/empty-state";
import { SectionHeader } from "@/components/music/section-header";
import { TrackList } from "@/components/music/track-list";
import { Input } from "@/components/ui/input";

type SortMode = "recent" | "title" | "artist";

export default function LikedSongsPage() {
  const likedTrackIds = useLibraryStore((state) => state.likedTrackIds);
  const [sort, setSort] = useState<SortMode>("recent");
  const [query, setQuery] = useState("");

  const likedTracks = getTracks(likedTrackIds);
  const totalDuration = likedTracks.reduce((total, track) => total + track.duration, 0);

  const visibleTracks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = likedTracks.filter((track) => {
      if (!normalized) return true;
      const artist = getArtist(track.artistId)?.name ?? "";
      return `${track.title} ${artist}`.toLowerCase().includes(normalized);
    });
    if (sort === "title") return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "artist") {
      return [...filtered].sort((a, b) => {
        const artistA = getArtist(a.artistId)?.name ?? "";
        const artistB = getArtist(b.artistId)?.name ?? "";
        return artistA.localeCompare(artistB);
      });
    }
    return filtered;
  }, [likedTracks, query, sort]);

  const recommended = albums.slice(0, 4);

  return (
    <div className="page-container">
      <section className="relative isolate overflow-hidden rounded-2xl border border-white/[.06] bg-surface">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_20%_20%,rgba(139,92,246,.32),transparent_55%),radial-gradient(ellipse_at_90%_80%,rgba(94,124,226,.18),transparent_55%)]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0b0b0f]/85 via-[#0b0b0f]/45 to-transparent" />
        <div className="flex flex-col gap-6 p-5 sm:p-7 md:flex-row md:items-end lg:gap-9 lg:p-10">
          <div className="relative flex aspect-square w-[min(60vw,205px)] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#9B6CF7] via-[#6E45D8] to-[#35225C] shadow-[0_30px_70px_-24px_rgba(0,0,0,.92)] sm:w-[210px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.22),transparent_45%)]" />
            <Heart className="relative h-[34%] w-[34%] fill-white text-white drop-shadow-lg" strokeWidth={1.2} />
            <span className="absolute bottom-3 left-4 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/55">
              Sangeet collection
            </span>
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <p className="eyebrow mb-3">Your collection</p>
            <h1 className="font-display text-[44px] font-medium leading-[.94] tracking-[-0.055em] sm:text-[58px] lg:text-[72px]">
              Liked Songs
            </h1>
            <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              The songs you have saved across Sangeet. A living collection, kept in this browser.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Your library</span>
              <span className="text-muted-foreground/35">·</span>
              <span>{likedTracks.length} {likedTracks.length === 1 ? "song" : "songs"}</span>
              <span className="text-muted-foreground/35">·</span>
              <span>{formatTotalDuration(totalDuration)}</span>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <CollectionPlayButton trackIds={likedTrackIds} label="Liked Songs" />
              <CollectionShuffleButton trackIds={likedTrackIds} label="Liked Songs" />
            </div>
          </div>
        </div>
      </section>

      {likedTracks.length === 0 ? (
        <div className="mt-9">
          <EmptyState
            icon={<Heart className="h-5 w-5" />}
            title="No liked songs yet"
            description="Tap the heart on any track and it will be saved here. Nothing leaves this browser."
            action={
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground transition hover:bg-secondary"
              >
                <Sparkles className="h-4 w-4" />
                Find music to love
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-9">
          <div className="flex flex-col gap-4 border-b border-white/[.055] pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-1.5">
              <span className="mr-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/55">
                Sort
              </span>
              {(
                [
                  ["recent", "Recently liked"],
                  ["title", "Title"],
                  ["artist", "Artist"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSort(value)}
                  aria-pressed={sort === value}
                  className={
                    sort === value
                      ? "rounded-full bg-white/[.1] px-3 py-1.5 text-[11px] font-medium text-foreground"
                      : "rounded-full px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:bg-white/[.045] hover:text-foreground"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:max-w-[260px]">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search liked songs…"
                className="h-9 rounded-full pl-9 text-xs"
                aria-label="Search liked songs"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {visibleTracks.length} {visibleTracks.length === 1 ? "song" : "songs"}
              {query ? ` matching “${query}”` : ""}
            </p>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
              <Shuffle className="h-3 w-3" />
              Shuffle from above
            </span>
          </div>

          {visibleTracks.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                compact
                icon={<Search className="h-5 w-5" />}
                title="No matching liked songs"
                description="Try a different title or artist name."
                action={
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="rounded-full border border-white/[.1] px-5 py-2.5 text-xs font-medium transition hover:border-white/20 hover:bg-white/[.04]"
                  >
                    Clear search
                  </button>
                }
              />
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-white/[.045] bg-white/[.012] px-2 py-3 sm:px-3">
              <TrackList
                trackIds={visibleTracks.map((track) => track.id)}
                label="Liked Songs"
                showAlbum
               
              />
            </div>
          )}

          <p className="mt-4 flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
            <Heart className="h-3 w-3" />
            Use the heart beside a song to remove it from this collection.
          </p>
        </div>
      )}

      <section className="section-space pb-2">
        <SectionHeader
          title="You might also like"
          eyebrow="From the same shelf"
          href="/explore"
          linkLabel="Explore more"
        />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {recommended.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
        <Link
          href="/library"
          className="mt-8 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ListMusic className="h-3.5 w-3.5" />
          Back to your library
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </section>
    </div>
  );
}
