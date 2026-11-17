"use client";

import Link from "next/link";
import { ArrowUpRight, Compass, Play } from "lucide-react";
import {
  albums,
  artists,
  featuredPlaylists,
  genres,
  getArtist,
  getTracks,
  playlists,
  selectedTracks,
} from "@/lib/catalog";
import { getAlbumMosaic } from "@/lib/mixes";
import { Artwork } from "@/components/music/artwork";
import { AlbumCard } from "@/components/music/album-card";
import { ArtistCard } from "@/components/music/artist-card";
import {
  CollectionPlayButton,
  CollectionShuffleButton,
} from "@/components/music/collection-actions";
import { GenreCard } from "@/components/music/genre-card";
import { PlaylistCard } from "@/components/music/playlist-card";
import { SectionHeader } from "@/components/music/section-header";
import { TrackList } from "@/components/music/track-list";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const editorial = featuredPlaylists[0] ?? playlists[0];
const editorialTracks = editorial ? getTracks(editorial.trackIds) : [];
const mosaic = editorial ? getAlbumMosaic(editorial.trackIds) : [];

export default function ExplorePage() {
  return (
    <div className="w-full max-w-full min-w-0 overflow-x-clip">
      <div className="page-container min-w-0">
        <div className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl min-w-0">
            <p className="eyebrow mb-2">A wider view</p>
            <h1 className="font-display text-[36px] font-bold leading-none tracking-[-0.04em] text-foreground sm:text-[48px]">
              Explore
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              New worlds, old favourites and everything in between. Follow a feeling and see where it
              takes you.
            </p>
          </div>
          <Link
            href="/search"
            className="group inline-flex w-fit max-w-full shrink-0 items-center gap-2 rounded-full border border-white/[0.08] bg-card px-4 py-2.5 text-xs font-semibold text-foreground/90 transition hover:border-white/[0.16] hover:bg-elevated hover:text-foreground"
          >
            <Compass className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>Search the catalogue</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        {editorial && (
          <section className="relative isolate overflow-hidden rounded-3xl border border-white/[0.08] bg-card">
            <div className="absolute inset-0 -z-10 grid grid-cols-2 opacity-20 sm:grid-cols-4">
              {mosaic.slice(0, 4).map((album) => (
                <Artwork
                  key={album.id}
                  src={album.artwork}
                  alt=""
                  res="md"
                  className="h-full w-full rounded-none"
                />
              ))}
            </div>
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background/95 via-background/85 to-background/50" />
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.14),transparent_55%)]" />

            <div className="grid min-w-0 grid-cols-1 gap-6 p-5 sm:p-9 lg:grid-cols-2 lg:items-center lg:gap-8 lg:p-11">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                    Editor’s pick
                  </span>
                </div>
                <h2 className="mt-4 max-w-lg font-display text-[30px] font-bold leading-[1.04] tracking-[-0.04em] text-foreground sm:text-[44px]">
                  {editorial.title}
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                  {editorial.description}
                </p>
                <div className="mt-6 flex min-w-0 flex-wrap items-center gap-3">
                  <CollectionPlayButton
                    trackIds={editorial.trackIds}
                    label={editorial.title}
                    className="max-w-full"
                  />
                  <CollectionShuffleButton
                    trackIds={editorial.trackIds}
                    label={editorial.title}
                    className="max-w-full border-white/[0.12] bg-elevated text-foreground hover:bg-elevated/80"
                  />
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-muted-foreground sm:gap-x-4">
                  <span>{editorial.curator}</span>
                  <span className="h-1 w-1 rounded-full bg-white/25" />
                  <span>{editorialTracks.length} tracks</span>
                  <span className="h-1 w-1 rounded-full bg-white/25" />
                  <span>48 min</span>
                </div>
              </div>

              <div className="hidden min-w-0 lg:block">
                <div className="space-y-1 border-l border-white/[0.08] pl-6">
                  {editorialTracks.slice(0, 5).map((track, index) => (
                    <div key={track.id} className="flex min-w-0 items-center gap-3 py-2">
                      <span className="w-4 shrink-0 font-sans text-[11px] font-medium tabular-nums text-muted-foreground/60">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-foreground/90">
                          {track.title}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {getArtist(track.artistId)?.name}
                        </p>
                      </div>
                      <Play className="h-3 w-3 shrink-0 text-muted-foreground/60" fill="currentColor" />
                    </div>
                  ))}
                </div>
                <Link
                  href={`/playlist/${editorial.id}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground"
                >
                  Open playlist
                  <ArrowUpRight className="h-3 w-3 shrink-0" />
                </Link>
              </div>
            </div>
          </section>
        )}

        <section className="section-space min-w-0">
          <SectionHeader
            title="Browse by genre"
            eyebrow="Find your feeling"
            description="Doorways into the Sangeet catalogue, from quiet ambient to late-night electronics."
          />
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
            {genres.map((genre, index) => (
              <GenreCard
                key={genre.id}
                genre={genre}
                size={index < 2 ? "large" : "default"}
                className={cn("min-w-0", index < 2 && "col-span-2")}
              />
            ))}
          </div>
        </section>

        <section className="section-space min-w-0">
          <SectionHeader
            title="Music to explore"
            eyebrow="From the catalog"
            description="Browse songs and albums across the Sangeet catalog."
            href="/new-releases"
            linkLabel="More releases"
          />
          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
            <div className="grid min-w-0 grid-cols-2 gap-3">
              {selectedTracks.slice(0, 4).map((track) => {
                const album = albums.find((item) => item.id === track.albumId);
                return (
                  <Link
                    key={track.id}
                    href={`/album/${track.albumId}`}
                    className="group relative isolate flex min-h-[168px] min-w-0 flex-col justify-end overflow-hidden rounded-2xl border border-white/[.08] bg-card p-3.5 transition hover:border-white/[0.16] sm:min-h-[180px] sm:p-4"
                  >
                    <Artwork
                      src={track.artwork}
                      alt=""
                      res="md"
                      className="absolute inset-0 -z-20 h-full w-full rounded-none opacity-65 transition duration-300 group-hover:scale-105 group-hover:opacity-80"
                    />
                    <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">
                      {album?.year ?? "Sangeet"}
                    </p>
                    <p className="mt-1 line-clamp-2 font-display text-base font-bold leading-tight tracking-[-0.025em] text-white sm:text-lg">
                      {track.title}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-white/65">
                      {getArtist(track.artistId)?.name}
                    </p>
                  </Link>
                );
              })}
            </div>
            <div className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-card px-2 py-3 sm:px-3">
              <TrackList
                trackIds={selectedTracks.map((track) => track.id)}
                label="Music to explore"
                showAlbum
              />
              <div className="mx-2 mt-4 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-3">
                <p className="text-[10px] text-muted-foreground/70">More music</p>
                <Link
                  href="/new-releases"
                  className="shrink-0 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground"
                >
                  New releases
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="section-space min-w-0">
          <SectionHeader
            title="Selected for you"
            eyebrow="Playlists"
            description="Browse playlists and find your next listen."
            href="/made-for-you"
            linkLabel="Playlists"
          />
          <div
            data-no-tab-swipe="true"
            className="-mx-3.5 flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto px-3.5 py-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0 sm:py-0 lg:grid-cols-5 [&>*]:w-[146px] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto"
          >
            {playlists.slice(0, 5).map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        </section>

        <section className="section-space min-w-0">
          <SectionHeader
            title="Artists in focus"
            eyebrow="New voices, lasting records"
            href="/new-releases"
            linkLabel="Browse releases"
          />
          <div
            data-no-tab-swipe="true"
            className="-mx-3.5 flex min-w-0 snap-x snap-mandatory gap-3.5 overflow-x-auto px-3.5 py-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0 sm:py-0 lg:grid-cols-6 [&>*]:w-[138px] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto"
          >
            {artists.slice(0, 6).map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </section>

        <section className="section-space min-w-0">
          <SectionHeader
            title="New & noteworthy"
            eyebrow="Recent additions"
            href="/new-releases"
            linkLabel="See all releases"
          />
          <div
            data-no-tab-swipe="true"
            className="-mx-3.5 flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto px-3.5 py-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0 sm:py-0 lg:grid-cols-6 [&>*]:w-[146px] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto"
          >
            {[...albums]
              .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
              .slice(0, 6)
              .map((album) => (
                <AlbumCard key={album.id} album={album} showSave={false} />
              ))}
          </div>
        </section>

        <section className="section-space min-w-0 pb-2">
          <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-white/[0.08] bg-card p-6 sm:flex-row sm:items-center sm:p-8">
            <div className="min-w-0">
              <p className="eyebrow mb-2">Sangeet Radio</p>
              <h2 className="font-display text-2xl font-bold tracking-[-0.035em] text-foreground">
                There is always another station.
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Artist radios built around the records you keep coming back to.
              </p>
            </div>
            <Link
              href="/made-for-you"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "max-w-full shrink-0 rounded-full border-white/[0.12] bg-elevated text-foreground hover:bg-elevated/80",
              )}
            >
              Open radios
              <ArrowUpRight className="h-4 w-4 shrink-0" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
