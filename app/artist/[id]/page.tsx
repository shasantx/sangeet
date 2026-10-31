import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import {
  artists,
  getArtist,
  getArtistAlbums,
  getArtistTracks,
  getRelatedArtists,
  playlists,
} from "@/lib/catalog";
import { AlbumCard } from "@/components/music/album-card";
import { ArtistCard } from "@/components/music/artist-card";
import { CollectionHero } from "@/components/music/collection-hero";
import { CollectionPlayButton, CollectionShuffleButton } from "@/components/music/collection-actions";
import { FollowArtistButton } from "@/components/music/follow-artist-button";
import { PlaylistCard } from "@/components/music/playlist-card";
import { SectionHeader } from "@/components/music/section-header";
import { TrackList } from "@/components/music/track-list";

export function generateStaticParams() {
  return artists.map((artist) => ({ id: artist.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const artist = getArtist(id);
  if (!artist) return { title: "Artist not found" };
  return {
    title: artist.name,
    description: artist.shortBio,
  };
}

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const artist = getArtist(id);
  if (!artist) notFound();

  const artistTracks = getArtistTracks(artist.id);
  const artistTrackIds = artistTracks.map((track) => track.id);
  const artistAlbums = getArtistAlbums(artist.id);
  const related = getRelatedArtists(artist);
  const appearsOn = playlists.filter((playlist) =>
    playlist.trackIds.some((trackId) => artistTracks.some((track) => track.id === trackId)),
  ).slice(0, 4);

  return (
    <div className="page-container">
      <Link
        href="/explore"
        className="mb-5 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Explore
      </Link>

      <CollectionHero
        eyebrow="Artist"
        title={artist.name}
        description={artist.shortBio}
        image={artist.image}
        alt={`${artist.name} portrait`}
        round
        meta={
          <>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {artist.location}
            </span>
          </>
        }
        actions={
          <>
            <CollectionPlayButton trackIds={artistTrackIds} label={artist.name} />
            <CollectionShuffleButton trackIds={artistTrackIds} label={artist.name} />
            <FollowArtistButton artist={artist} />
          </>
        }
      />

      <div className="mt-9 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0">
          <SectionHeader
            title="Selected tracks"
            eyebrow="From the catalog"
          />
          <div className="rounded-xl border border-white/[.045] bg-white/[.012] px-2 py-3 sm:px-3">
            <TrackList trackIds={artistTrackIds} label={`${artist.name} selected tracks`} showAlbum />
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-xl border border-white/[.055] bg-white/[.018] p-5">
            <p className="eyebrow mb-3">About</p>
            <p className="text-[12.5px] leading-[1.75] text-muted-foreground">{artist.bio}</p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {artist.genreIds.map((genreId) => (
                <Link
                  key={genreId}
                  href={`/genre/${genreId}`}
                  className="rounded-full border border-white/[.07] px-2.5 py-1 text-[10px] capitalize text-muted-foreground transition hover:border-white/[.15] hover:text-foreground"
                >
                  {genreId}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/[.055] bg-surface/70 p-5">
            <p className="eyebrow mb-4">Artist details</p>
            <dl className="space-y-3 text-[12px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Releases</dt>
                <dd className="font-medium">{artistAlbums.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Based in</dt>
                <dd className="font-medium">{artist.location}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      {artistAlbums.length > 0 && (
        <section className="section-space">
          <SectionHeader
            title="Discography"
            eyebrow="Records & singles"
            description={`Every release from ${artist.name}, newest first.`}
          />
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {[...artistAlbums]
              .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
              .map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="section-space">
          <SectionHeader
            title="Related artists"
            eyebrow="In the same orbit"
            description="Artists who share a room, a frequency or a feeling."
          />
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
            {related.map((item) => (
              <ArtistCard key={item.id} artist={item} />
            ))}
          </div>
        </section>
      )}

      {appearsOn.length > 0 && (
        <section className="section-space pb-2">
          <SectionHeader
            title="Appears on"
            eyebrow="Playlists"
            href="/explore"
            linkLabel="All playlists"
          />
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {appearsOn.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} hideDescription />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
