import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CalendarDays, Disc3, Music2 } from "lucide-react";
import {
  albums,
  getAlbum,
  getArtist,
  getArtistAlbums,
  getTracks,
} from "@/lib/catalog";
import { formatDate, formatTotalDuration } from "@/lib/utils";
import { AlbumCard } from "@/components/music/album-card";
import { CollectionHero } from "@/components/music/collection-hero";
import { CollectionPlayButton, CollectionShuffleButton } from "@/components/music/collection-actions";
import { SaveAlbumButton } from "@/components/music/save-album-button";
import { SectionHeader } from "@/components/music/section-header";
import { TrackList } from "@/components/music/track-list";

export function generateStaticParams() {
  return albums.map((album) => ({ id: album.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const album = getAlbum(id);
  if (!album) return { title: "Album not found" };
  const artist = getArtist(album.artistId);
  return {
    title: `${album.title} — ${artist?.name ?? "Sangeet"}`,
    description: album.description,
  };
}

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const album = getAlbum(id);
  if (!album) notFound();

  const artist = getArtist(album.artistId);
  const albumTracks = getTracks(album.trackIds);
  const isYouTubeAlbum = albumTracks.some((track) => Boolean(track.youtubeId));
  const totalDuration = albumTracks.reduce((total, track) => total + track.duration, 0);
  const moreByArtist = getArtistAlbums(album.artistId).filter((item) => item.id !== album.id);
  const moreAlbums = albums
    .filter(
      (item) =>
        item.id !== album.id &&
        item.genreIds.some((genreId) => album.genreIds.includes(genreId)),
    )
    .slice(0, 5);
  const relatedAlbums = moreByArtist.length > 0 ? moreByArtist : moreAlbums;

  return (
    <div className="page-container">
      <Link
        href={artist ? `/artist/${artist.id}` : "/explore"}
        className="mb-5 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {artist?.name ?? "Explore"}
      </Link>

      <CollectionHero
        eyebrow={album.type}
        title={album.title}
        description={album.description}
        image={album.artwork}
        alt={`${album.title} album artwork`}
        meta={
          <>
            {artist && (
              <Link
                href={`/artist/${artist.id}`}
                className="inline-flex items-center gap-2 font-medium text-foreground transition hover:underline"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[.08]">
                  <Music2 className="h-3 w-3" />
                </span>
                {artist.name}
              </Link>
            )}
            <span className="text-muted-foreground/35">·</span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {album.year}
            </span>
            <span className="text-muted-foreground/35">·</span>
            <span>{albumTracks.length} tracks</span>
            <span className="text-muted-foreground/35">·</span>
            <span>{formatTotalDuration(totalDuration)}</span>
          </>
        }
        actions={
          <>
            <CollectionPlayButton trackIds={album.trackIds} label={album.title} />
            <CollectionShuffleButton trackIds={album.trackIds} label={album.title} />
            <SaveAlbumButton album={album} />
          </>
        }
      />

      <div className="mt-9 grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-medium tracking-[-0.025em]">Tracklist</h2>
            <span className="text-[10px] tabular-nums text-muted-foreground/55">
              {albumTracks.length} songs · {formatTotalDuration(totalDuration)}
            </span>
          </div>
          <div className="rounded-xl border border-white/[.045] bg-white/[.012] px-2 py-3 sm:px-3">
            <TrackList
              trackIds={album.trackIds}
              label={album.title}
              showAlbum={false}
             
              showArtwork={false}
            />
          </div>
          <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground/50">
            {formatDate(album.releaseDate)} · {album.type} · All tracks are original Sangeet demo
            recordings.
          </p>
        </section>

        <aside className="space-y-5">
          <div className="rounded-xl border border-white/[.055] bg-white/[.018] p-5">
            <p className="eyebrow mb-4">Credits</p>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground/55">
                  Artist
                </p>
                {artist ? (
                  <Link
                    href={`/artist/${artist.id}`}
                    className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium transition hover:text-primary"
                  >
                    {artist.name}
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                ) : (
                  <p className="mt-1 text-[13px]">Sangeet</p>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground/55">
                  Released
                </p>
                <p className="mt-1 text-[13px]">{formatDate(album.releaseDate)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground/55">
                  Genres
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {album.genreIds.map((genreId) => (
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
              <div>
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground/55">
                  {isYouTubeAlbum ? "Collection" : "Label"}
                </p>
                <p className="mt-1 text-[13px]">
                  {isYouTubeAlbum ? "Sangeet selection" : "Sangeet Recordings"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/[.055] bg-surface/70 p-5">
            <div className="flex items-center gap-2">
              <Disc3 className="h-3.5 w-3.5 text-primary" />
              <p className="eyebrow">Album note</p>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
              “{album.description}”
            </p>
            <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/45">
              Sangeet Editorial
            </p>
          </div>
        </aside>
      </div>

      {relatedAlbums.length > 0 && (
        <section className="section-space">
          <SectionHeader
            title={artist ? `More from ${artist.name}` : "More like this"}
            eyebrow="Keep listening"
            href={artist ? `/artist/${artist.id}` : "/explore"}
            linkLabel={artist ? "View artist" : "Explore"}
          />
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {relatedAlbums.map((item) => (
              <AlbumCard key={item.id} album={item} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-16 border-t border-white/[.055] pt-6 text-[10px] text-muted-foreground/55">
        <p>
          {album.title} · {album.type} · {album.year} · Sangeet local demo. No external audio or
          artwork is used.
        </p>
      </div>
    </div>
  );
}
