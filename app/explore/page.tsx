"use client";

import Link from "next/link";
import { ArrowUpRight, Compass, Play, Sparkles } from "lucide-react";
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
import { CollectionPlayButton, CollectionShuffleButton } from "@/components/music/collection-actions";
import { GenreCard } from "@/components/music/genre-card";
import { PlaylistCard } from "@/components/music/playlist-card";
import { SectionHeader } from "@/components/music/section-header";
import { TrackList } from "@/components/music/track-list";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatCount } from "@/lib/utils";

const editorial = playlists.find((playlist) => playlist.id === "violet-hours") ?? featuredPlaylists[0];
const editorialTracks = editorial ? getTracks(editorial.trackIds) : [];
const mosaic = editorial ? getAlbumMosaic(editorial.trackIds) : [];

export default function ExplorePage() {
  return (
    <div className="page-container">
      <div className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow mb-3">A wider view</p>
          <h1 className="text-[38px] font-medium leading-none tracking-[-0.05em] sm:text-[52px]">
            Explore
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            New worlds, old favourites and everything in between. Follow a feeling and see where it
            takes you.
          </p>
        </div>
        <Link
          href="/search"
          className="group inline-flex w-fit items-center gap-2 rounded-full border border-white/[.07] bg-white/[.03] px-4 py-2.5 text-xs font-medium text-muted-foreground transition hover:border-white/[.13] hover:bg-white/[.055] hover:text-foreground"
        >
          <Compass className="h-3.5 w-3.5 text-primary" />
          Search the catalogue
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>

      {editorial && (
        <section className="relative isolate overflow-hidden rounded-2xl border border-white/[.06] bg-[#121017]">
          <div className="absolute inset-0 -z-10 grid grid-cols-2 opacity-25 sm:grid-cols-4">
            {mosaic.slice(0, 4).map((album) => (
              <Artwork key={album.id} src={album.artwork} alt="" className="h-full w-full rounded-none" />
            ))}
          </div>
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0c0b10] via-[#0c0b10]/92 to-[#0c0b10]/45" />
          <div className="absolute -left-20 top-0 -z-10 h-72 w-72 rounded-full bg-primary/15 blur-[110px]" />

          <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1fr_360px] lg:items-center lg:p-11">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#C9B5F5]">
                  Editor’s pick
                </span>
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <h2 className="mt-5 max-w-lg font-display text-[36px] font-medium leading-[.98] tracking-[-0.05em] text-white sm:text-[48px]">
                {editorial.title}
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/50">
                {editorial.description}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <CollectionPlayButton trackIds={editorial.trackIds} label={editorial.title} />
                <CollectionShuffleButton
                  trackIds={editorial.trackIds}
                  label={editorial.title}
                  className="border-white/15 bg-white/[.04] text-white hover:border-white/25 hover:bg-white/[.08]"
                />
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-white/40">
                <span>{editorial.curator}</span>
                <span className="h-1 w-1 rounded-full bg-white/25" />
                <span>{editorialTracks.length} tracks</span>
                <span className="h-1 w-1 rounded-full bg-white/25" />
                <span>48 min</span>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="space-y-1 border-l border-white/[.09] pl-6">
                {editorialTracks.slice(0, 5).map((track, index) => (
                  <div key={track.id} className="flex items-center gap-3 py-2">
                    <span className="w-4 text-[10px] tabular-nums text-white/25">
                      {(index + 1).toString().padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-white/75">{track.title}</p>
                      <p className="truncate text-[10px] text-white/35">
                        {getArtist(track.artistId)?.name}
                      </p>
                    </div>
                    <Play className="h-3 w-3 text-white/25" fill="currentColor" />
                  </div>
                ))}
              </div>
              <Link
                href={`/playlist/${editorial.id}`}
                className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-white/55 transition hover:text-white"
              >
                Open playlist
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="section-space">
        <SectionHeader
          title="Browse by genre"
          eyebrow="Find your feeling"
          description="Eight doorways into the Sangeet catalogue, from quiet ambient to late-night electronics."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {genres.map((genre, index) => (
            <GenreCard
              key={genre.id}
              genre={genre}
              size={index < 2 ? "large" : "default"}
              className={index < 2 ? "col-span-2" : ""}
            />
          ))}
        </div>
      </section>

      <section className="section-space">
        <SectionHeader
          title="Sangeet selections"
          eyebrow="From the catalog"
          description="A hand-picked route into the sample catalog."
          href="/new-releases"
          linkLabel="More releases"
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
          <div className="grid grid-cols-2 gap-3">
            {selectedTracks.slice(0, 4).map((track) => {
              const album = albums.find((item) => item.id === track.albumId);
              return (
                <Link
                  key={track.id}
                  href={`/album/${track.albumId}`}
                  className="group relative isolate flex min-h-[180px] flex-col justify-end overflow-hidden rounded-xl border border-white/[.05] p-4"
                >
                  <Artwork
                    src={track.artwork}
                    alt=""
                    className="absolute inset-0 -z-20 h-full w-full rounded-none opacity-65 transition duration-500 group-hover:scale-105 group-hover:opacity-80"
                  />
                  <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#08080b] via-[#08080b]/30 to-transparent" />
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
                    {album?.year ?? "Sangeet"}
                  </p>
                  <p className="mt-1 line-clamp-2 font-display text-xl font-medium leading-tight tracking-[-0.03em] text-white">
                    {track.title}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-white/45">
                    {getArtist(track.artistId)?.name}
                  </p>
                </Link>
              );
            })}
          </div>
          <div className="min-w-0 rounded-xl border border-white/[.045] bg-white/[.012] px-2 py-3 sm:px-3">
            <TrackList
              trackIds={selectedTracks.map((track) => track.id)}
              label="Sangeet selections"
              showAlbum
            />
            <div className="mx-2 mt-4 flex items-center justify-between border-t border-white/[.055] pt-3">
              <p className="text-[10px] text-muted-foreground/60">Curated selection</p>
              <Link
                href="/new-releases"
                className="text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
              >
                New releases
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-space">
        <SectionHeader
          title="Selected for you"
          eyebrow="Sangeet editorial"
          description="Sequenced records for a particular hour, not just a collection of songs."
          href="/made-for-you"
          linkLabel="Sangeet mixes"
        />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {playlists.slice(0, 5).map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </div>
      </section>

      <section className="section-space">
        <SectionHeader
          title="Artists in focus"
          eyebrow="New voices, lasting records"
          href="/new-releases"
          linkLabel="Browse releases"
        />
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {artists.slice(0, 6).map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      </section>

      <section className="section-space">
        <SectionHeader
          title="New & noteworthy"
          eyebrow="Recent additions"
          href="/new-releases"
          linkLabel="See all releases"
        />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {[...albums]
            .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
            .slice(0, 6)
            .map((album) => (
              <AlbumCard key={album.id} album={album} showSave={false} />
            ))}
        </div>
      </section>

      <section className="section-space pb-2">
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/[.055] bg-white/[.018] p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <p className="eyebrow mb-2">Sangeet Radio</p>
            <h2 className="font-display text-2xl font-medium tracking-[-0.035em]">
              There is always another station.
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Artist radios built around the records you keep coming back to.
            </p>
          </div>
          <Link
            href="/made-for-you"
            className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
          >
            Open radios
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
