"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Clock, Heart, Play } from "lucide-react";
import type { Track } from "@/types/music";
import { TrackRow } from "@/components/music/track-row";
import { usePlayerStore } from "@/store/player-store";
import { useLibraryStore } from "@/store/library-store";
import { cn } from "@/lib/utils";

interface AlbumDetail {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  subtitle: string;
  cover: string;
  tracks: Track[];
}

function AlbumPageInner({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const fallbackTitle = searchParams.get("title") ?? "";

  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const playTrack = usePlayerStore((s) => s.playTrack);
  const savedAlbums = useLibraryStore((s) => s.savedAlbums);
  const toggleSaveAlbum = useLibraryStore((s) => s.toggleSaveAlbum);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(
      `/api/music/album?id=${encodeURIComponent(id)}&title=${encodeURIComponent(fallbackTitle)}`
    )
      .then((r) => r.json())
      .then((data: AlbumDetail) => {
        if (!cancelled) setAlbum(data);
      })
      .catch(() => {
        if (!cancelled) setAlbum(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, fallbackTitle]);

  if (loading) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="h-56 animate-pulse rounded-2xl bg-encore-elevated" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-encore-elevated" />
          ))}
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="p-12 text-center text-encore-subdued">
        Could not load album details.
      </div>
    );
  }

  const isSaved = savedAlbums.some((a) => a.id === album.id);

  return (
    <div className="min-h-full overflow-x-hidden pb-12">
      <div
        className="flex flex-col gap-5 border-b border-encore-hairline p-4 pt-6 sm:flex-row sm:items-end sm:gap-6 sm:p-6 sm:pt-10"
        style={{
          background:
            "var(--background-base)"
        }}
      >
        <img
          src={album.cover}
          alt={album.title}
          className="h-36 w-36 shrink-0 rounded-[14px] object-cover sm:h-44 sm:w-44"
        />
        <div className="min-w-0">
          <p className="text-xs font-medium text-encore-muted">Album</p>
          <h1 className="mt-1.5 truncate text-3xl font-medium tracking-[-0.02em] text-encore-text sm:text-5xl">
            {album.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-encore-subdued">
            {album.artistId ? (
              <Link
                href={`/artist/${encodeURIComponent(album.artistId)}?name=${encodeURIComponent(album.artist)}`}
                className="font-medium text-encore-text hover:underline"
              >
                {album.artist}
              </Link>
            ) : (
              <span className="font-medium text-encore-text">
                {album.artist}
              </span>
            )}
            <span>•</span>
            <span className="font-mono tabular-nums">
              {album.tracks.length}{" "}
              {album.tracks.length === 1 ? "track" : "tracks"}
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-5 sm:px-6">
        <button
          type="button"
          disabled={album.tracks.length === 0}
          onClick={() => playTrack(album.tracks[0], album.tracks)}
          className="btn-cobalt flex h-14 w-14 items-center justify-center rounded-full transition hover:scale-105 disabled:opacity-40"
          aria-label={`Play ${album.title}`}
        >
          <Play className="h-6 w-6 translate-x-0.5 fill-current" />
        </button>

        <button
          type="button"
          onClick={() =>
            toggleSaveAlbum({
              id: album.id,
              title: album.title,
              artist: album.artist,
              artistId: album.artistId,
              thumbnail: album.cover
            })
          }
          aria-label={isSaved ? "Remove album from library" : "Save album"}
          className="flex h-11 w-11 items-center justify-center rounded-full text-encore-subdued transition hover:scale-105 hover:bg-encore-elevated hover:text-encore-text"
        >
          <Heart
            className={cn(
              "h-6 w-6",
              isSaved && "fill-encore-accent text-encore-accent"
            )}
          />
        </button>
      </div>

      {/* Tracklist */}
      <div className="px-4 sm:px-6">
        <div className="mb-2 grid grid-cols-[24px_1fr_auto] items-center gap-2 border-b border-encore-hairline px-2 pb-2 text-xs font-medium uppercase tracking-wider text-encore-subdued sm:grid-cols-[28px_1fr_110px] sm:gap-3 sm:px-3">
          <span className="text-center">#</span>
          <span>Title</span>
          <span className="flex justify-end pr-2">
            <Clock className="h-4 w-4" />
          </span>
        </div>
        <div className="space-y-0.5">
          {album.tracks.map((track, idx) => (
            <TrackRow
              key={track.id}
              track={track}
              index={idx}
              contextQueue={album.tracks}
              showAlbum={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AlbumPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="p-6 text-sm text-encore-subdued">Loading album...</div>}>
      <AlbumPageInner id={id} />
    </Suspense>
  );
}
