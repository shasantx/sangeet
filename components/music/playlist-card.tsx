"use client";

import Link from "next/link";
import type { Playlist, UserPlaylist } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Artwork } from "./artwork";
import { PlayButton } from "./play-button";

interface PlaylistCardProps {
  playlist: Playlist | UserPlaylist;
  className?: string;
  priority?: boolean;
  hideDescription?: boolean;
}

export function PlaylistCard({
  playlist,
  className,
  priority = false,
  hideDescription = false,
}: PlaylistCardProps) {
  const isCurated = "curator" in playlist;
  const description = "description" in playlist ? playlist.description : "";
  const trackCount = playlist.trackIds.length;

  return (
    <article className={cn("group min-w-0", className)}>
      <div className="relative">
        <Link
          href={`/playlist/${playlist.id}`}
          className="block overflow-hidden rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`${playlist.title} playlist`}
        >
          <Artwork
            src={playlist.artwork}
            alt={`${playlist.title} playlist cover`}
            className="aspect-square w-full shadow-[0_16px_40px_-22px_rgba(0,0,0,.9)] transition-transform duration-500 group-hover:scale-[1.015]"
            priority={priority}
          />
          <div className="pointer-events-none absolute inset-0 rounded-[10px] bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </Link>
        <PlayButton
          trackIds={playlist.trackIds}
          label={playlist.title}
          size="md"
          className="absolute bottom-3 right-3 translate-y-1.5 opacity-100 shadow-2xl transition-all duration-300 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:focus-visible:translate-y-0 sm:focus-visible:opacity-100"
        />
      </div>
      <div className="mt-3.5 min-w-0">
        <Link
          href={`/playlist/${playlist.id}`}
          className="line-clamp-1 text-[13.5px] font-medium leading-5 text-foreground transition hover:underline"
        >
          {playlist.title}
        </Link>
        {!hideDescription ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {description || `${trackCount} ${trackCount === 1 ? "song" : "songs"}`}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            {isCurated ? "Playlist" : "Made by you"} · {trackCount} {trackCount === 1 ? "song" : "songs"}
          </p>
        )}
      </div>
    </article>
  );
}
