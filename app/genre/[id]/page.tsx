import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Disc3, Users } from "lucide-react";
import {
  albums,
  artists,
  genres,
  getArtist,
  getGenre,
  getGenreTracks,
} from "@/lib/catalog";
import { formatCount, formatTotalDuration } from "@/lib/utils";
import { AlbumCard } from "@/components/music/album-card";
import { ArtistCard } from "@/components/music/artist-card";
import { CollectionHero } from "@/components/music/collection-hero";
import { CollectionPlayButton, CollectionShuffleButton } from "@/components/music/collection-actions";
import { GenreCard } from "@/components/music/genre-card";
import { SectionHeader } from "@/components/music/section-header";
import { TrackList } from "@/components/music/track-list";

export function generateStaticParams() {
  return genres.map((genre) => ({ id: genre.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const genre = getGenre(id);
  if (!genre) return { title: "Genre not found" };
  return {
    title: `${genre.name} music`,
    description: genre.description,
  };
}

export default async function GenrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const genre = getGenre(id);
  if (!genre) notFound();

  const genreTracks = getGenreTracks(genre.id);
  const genreArtists = artists.filter((artist) => artist.genreIds.includes(genre.id));
  const genreAlbums = Array.from(
    new Set(genreTracks.map((track) => track.albumId)),
  )
    .map((albumId) => albums.find((album) => album.id === albumId))
    .filter((album): album is NonNullable<typeof album> => Boolean(album));
  const totalDuration = genreTracks.reduce((total, track) => total + track.duration, 0);
  const related = genres
    .filter((item) => item.id !== genre.id)
    .filter((item) => genreArtists.some((artist) => artist.genreIds.includes(item.id)))
    .slice(0, 4);

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
        eyebrow="Genre"
        title={genre.name}
        description={genre.description}
        image={genre.image}
        alt={`${genre.name} genre artwork`}
        accent={genre.accent}
        meta={
          <>
            <span>{formatCount(genreTracks.length)} tracks</span>
            <span className="text-muted-foreground/35">·</span>
            <span>{formatTotalDuration(totalDuration)}</span>
            <span className="text-muted-foreground/35">·</span>
            <span>{genreArtists.length} artists</span>
          </>
        }
        actions={
          <>
            <CollectionPlayButton trackIds={genre.trackIds} label={`${genre.name} genre`} />
            <CollectionShuffleButton trackIds={genre.trackIds} label={`${genre.name} genre`} />
          </>
        }
      />

      <section className="section-space">
        <SectionHeader
          title={`Essential ${genre.name.toLowerCase()}`}
          eyebrow="The first hour"
          description={`The defining records and deep cuts that sit at the heart of ${genre.name.toLowerCase()}.`}
          action={
            <Link
              href="/search"
              className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground sm:flex"
            >
              Find something else
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <div className="rounded-xl border border-white/[.045] bg-white/[.012] px-2 py-3 sm:px-3">
          <TrackList trackIds={genreTracks.map((track) => track.id)} label={`${genre.name} tracks`} showAlbum />
        </div>
      </section>

      {genreAlbums.length > 0 && (
        <section className="section-space">
          <SectionHeader
            title="Albums in this world"
            eyebrow="Full records"
            description="Start at the beginning and let the sequence do the work."
          />
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {genreAlbums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        </section>
      )}

      {genreArtists.length > 0 && (
        <section className="section-space">
          <SectionHeader
            title={`${genre.name} artists`}
            eyebrow="The people behind the sound"
            description="Follow an artist and their new records will find their way into your library."
            action={
              <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
                <Users className="h-3.5 w-3.5" />
                {genreArtists.length} artists
              </span>
            }
          />
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {genreArtists.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="section-space pb-2">
          <SectionHeader
            title="If this is your frequency"
            eyebrow="Keep exploring"
            action={
              <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
                <Disc3 className="h-3.5 w-3.5" />
                Adjacent sounds
              </span>
            }
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {related.map((item) => (
              <GenreCard key={item.id} genre={item} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-16 border-t border-white/[.055] pt-6 text-[10px] text-muted-foreground/55">
        <p>
          {genre.name} on Sangeet · {genreTracks.length} local demo tracks. All audio and artwork are
          original assets.
        </p>
      </div>
    </div>
  );
}
