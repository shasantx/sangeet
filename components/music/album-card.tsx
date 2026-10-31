"use client";

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

export function AlbumCard({ album, className, priority = false, showSave = true }: AlbumCardProps) {
  const artist = getArtist(album.artistId);
  const saved = useLibraryStore((state) => state.savedAlbumIds.includes(album.id));
  const toggleSave = useLibraryStore((state) => state.toggleSaveAlbum);

  return (
    <article className={cn("group min-w-0", className)}>
      <div className="relative">
        <Link
          href={`/album/${album.id}`}
          className="block overflow-hidden rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`${album.title} by ${artist?.name ?? "Unknown artist"}`}
        >
          <Artwork
            src={album.artwork}
            alt={`${album.title} album artwork`}
            className="aspect-square w-full shadow-[0_16px_40px_-22px_rgba(0,0,0,.9)] transition-transform duration-500 group-hover:scale-[1.015]"
            priority={priority}
          />
          <div className="pointer-events-none absolute inset-0 rounded-[10px] bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </Link>
        <PlayButton
          trackIds={album.trackIds}
          label={album.title}
          size="md"
          className="absolute bottom-3 right-3 translate-y-1.5 opacity-100 shadow-2xl transition-all duration-300 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:focus-visible:translate-y-0 sm:focus-visible:opacity-100"
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
              "absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-all duration-200 hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:translate-y-[-4px] sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:focus-visible:translate-y-0 sm:focus-visible:opacity-100",
              saved && "sm:opacity-100",
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
      <div className="mt-3.5 min-w-0">
        <Link
          href={`/album/${album.id}`}
          className="line-clamp-1 text-[13.5px] font-medium leading-5 text-foreground transition hover:underline"
        >
          {album.title}
        </Link>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {artist ? (
            <Link href={`/artist/${artist.id}`} className="truncate transition hover:text-foreground hover:underline">
              {artist.name}
            </Link>
          ) : (
            <span>Unknown artist</span>
          )}
          <span className="text-muted-foreground/45">·</span>
          <span>{album.year}</span>
        </div>
      </div>
    </article>
  );
}
