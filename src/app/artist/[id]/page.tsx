"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, Play } from "lucide-react";
import type { AlbumSummary, Track } from "@/types/music";
import { TrackRow } from "@/components/music/track-row";
import { MediaShelf } from "@/components/music/media-shelf";
import { usePlayerStore } from "@/store/player-store";
import { useLibraryStore } from "@/store/library-store";
import { cn, pickHeroColor } from "@/lib/utils";

interface ArtistDetail {
  id: string;
  name: string;
  description: string;
  subscribers: string;
  banner: string;
  topTracks: Track[];
  albums: AlbumSummary[];
}

function ArtistPageInner({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const fallbackName = searchParams.get("name") ?? "";

  const [artist, setArtist] = useState<ArtistDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const playTrack = usePlayerStore((s) => s.playTrack);
  const savedArtists = useLibraryStore((s) => s.savedArtists);
  const toggleSaveArtist = useLibraryStore((s) => s.toggleSaveArtist);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(
      `/api/music/artist?id=${encodeURIComponent(id)}&name=${encodeURIComponent(fallbackName)}`
    )
      .then((r) => r.json())
      .then((data: ArtistDetail) => {
        if (!cancelled) setArtist(data);
      })
      .catch(() => {
        if (!cancelled) setArtist(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, fallbackName]);

  if (loading) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="h-64 animate-pulse rounded-2xl bg-encore-elevated" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-encore-elevated" />
          ))}
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="p-12 text-center text-encore-subdued">
        Could not load artist details.
      </div>
    );
  }

  const isFollowing = savedArtists.some((a) => a.id === artist.id);
  const heroColor = pickHeroColor(artist.id);

  return (
    <div className="min-h-full overflow-x-hidden pb-12">
      {/* Artist Hero — dark cinematic scrim guarantees white text contrast in both themes */}
      <div
        className="relative flex min-h-[260px] flex-col justify-end overflow-hidden border-b border-encore-hairline p-4 pt-14 sm:min-h-[280px] sm:p-6 sm:pt-16"
        style={{
          background: `linear-gradient(180deg, ${heroColor} 0%, #0d0c0b 100%)`
        }}
      >
        {artist.banner && (
          <img
            src={artist.banner}
            alt={artist.name}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-luminosity"
          />
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0d0c0b]/90 via-[#0d0c0b]/35 to-transparent"
        />
        <div className="relative z-10">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <BadgeCheck className="h-5 w-5 fill-[#e2363e] text-white" />
            <span>Verified Artist</span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-white sm:text-5xl">
            {artist.name}
          </h1>
          {artist.subscribers && (
            <p className="mt-2 text-sm text-white/80">{artist.subscribers}</p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 px-4 py-5 sm:px-6">
        <button
          type="button"
          disabled={artist.topTracks.length === 0}
          onClick={() => playTrack(artist.topTracks[0], artist.topTracks)}
          className="btn-cobalt flex h-14 w-14 items-center justify-center rounded-full transition hover:scale-105 disabled:opacity-40"
          aria-label={`Play ${artist.name}`}
        >
          <Play className="h-6 w-6 translate-x-0.5 fill-current" />
        </button>

        <button
          type="button"
          onClick={() =>
            toggleSaveArtist({
              id: artist.id,
              name: artist.name,
              thumbnail: artist.banner,
              subscribers: artist.subscribers
            })
          }
          className={cn(
            "min-h-[44px] rounded-full border px-5 text-xs font-bold uppercase tracking-wider transition",
            isFollowing
              ? "border-encore-accent bg-encore-tinted text-encore-accent"
              : "border-encore-hairline bg-encore-elevated text-encore-text hover:border-encore-accent/60 hover:bg-encore-elevated-highlight"
          )}
        >
          {isFollowing ? "Following" : "Follow"}
        </button>
      </div>

      <div className="space-y-8 px-4 sm:px-6">
        {/* Popular tracks */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-encore-text">Popular</h2>
          <div className="space-y-0.5">
            {artist.topTracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                contextQueue={artist.topTracks}
              />
            ))}
          </div>
        </section>

        {/* Discography */}
        {artist.albums.length > 0 && (
          <section>
            <h2 className="mb-3 text-xl font-bold text-encore-text">Discography</h2>
            <MediaShelf>
              {artist.albums.map((album) => (
                <Link
                  key={album.id}
                  href={`/album/${encodeURIComponent(album.id)}?title=${encodeURIComponent(album.title)}`}
                  className="flex w-[160px] shrink-0 flex-col rounded-2xl border border-encore-hairline bg-encore-elevated p-3 transition hover:border-encore-accent/35 hover:bg-encore-elevated-highlight sm:w-[176px]"
                >
                  <img
                    src={album.thumbnail}
                    alt={album.title}
                    className="mb-3 aspect-square w-full rounded-lg object-cover shadow"
                  />
                  <p className="truncate text-sm font-bold text-encore-text">
                    {album.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-encore-subdued">
                    {album.year || "Album"}
                  </p>
                </Link>
              ))}
            </MediaShelf>
          </section>
        )}
      </div>
    </div>
  );
}

export default function ArtistPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="p-6 text-sm text-encore-subdued">Loading artist...</div>}>
      <ArtistPageInner id={id} />
    </Suspense>
  );
}
