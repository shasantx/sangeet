"use client";

import * as React from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck } from "lucide-react";
import type { Album } from "@/lib/types";
import { getArtist } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { useLibraryStore } from "@/store/library-store";
import { toast } from "@/store/ui-store";
import { Artwork } from "./artwork";
import { PlayButton } from "./play-button";

interface AlbumCardProps {
  album: Album;
  className?: string;
  priority?: boolean;
  showSave?: boolean;
}

export const AlbumCard = React.memo(function AlbumCard({
  album,
  className,
  priority = false,
  showSave = true,
}: AlbumCardProps) {
  const artist = getArtist(album.artistId);
  const saved = useLibraryStore((state) => state.savedAlbumIds.includes(album.id));
  const toggleSave = useLibraryStore((state) => state.toggleSaveAlbum);

  return (
    <article
      className={cn(
        "group min-w-0 rounded-2xl border border-transparent p-2 -m-2 transition-colors duration-200 hover:border-white/[0.08] hover:bg-card",
        className,
      )}
    >
      <div className="relative">
        <Link
          href={`/album/${album.id}`}
          className="block overflow-hidden rounded-2xl border border-white/[0.08] bg-elevated shadow-[0_14px_34px_-18px_rgba(0,0,0,0.85)] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`${album.title} by ${artist?.name ?? "Unknown artist"}`}
        >
          <Artwork
            src={album.artwork}
            alt={`${album.title} album artwork`}
            res="md"
            className="aspect-square w-full transition-transform duration-300 ease-out group-hover:scale-[1.02]"
            priority={priority}
          />
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-black/25 via-transparent to-white/[0.04] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        </Link>
        <PlayButton
          trackIds={album.trackIds}
          label={album.title}
          size="md"
          className="absolute bottom-2.5 right-2.5 translate-y-1 opacity-100 shadow-2xl transition-all duration-200 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:focus-visible:translate-y-0 sm:focus-visible:opacity-100"
        />
        {showSave && (
          <button
            type="button"
            aria-label={saved ? `Remove ${album.title} from library` : `Save ${album.title} to library`}
            aria-pressed={saved}
            onClick={(event) => {
              event.preventDefault();
              const next = toggleSave(album.id);
              toast.show(
                next ? "Saved to library" : "Removed from library",
                `${album.title} · ${artist?.name ?? "Unknown artist"}`,
                next ? "success" : "default",
              );
            }}
            className={cn(
              "absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.15] bg-black/60 text-white transition-all duration-200 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:-translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:focus-visible:translate-y-0 sm:focus-visible:opacity-100",
              saved && "border-primary/45 bg-primary/20 text-primary sm:opacity-100",
            )}
          >
            {saved ? (
              <BookmarkCheck className="h-4 w-4 fill-current" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      <div className="mt-3 min-w-0 px-0.5">
        <Link
          href={`/album/${album.id}`}
          className="line-clamp-1 text-[13.5px] font-semibold leading-5 text-foreground transition hover:underline"
        >
          {album.title}
        </Link>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          {artist ? (
            <Link
              href={`/artist/${artist.id}`}
              className="truncate transition hover:text-foreground hover:underline"
            >
              {artist.name}
            </Link>
          ) : (
            <span>Unknown artist</span>
          )}
          <span className="text-muted-foreground/45">·</span>
          <span className="shrink-0">{album.year}</span>
        </div>
      </div>
    </article>
  );
});
