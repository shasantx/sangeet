"use client";

import * as React from "react";
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

export const PlaylistCard = React.memo(function PlaylistCard({
  playlist,
  className,
  priority = false,
  hideDescription = false,
}: PlaylistCardProps) {
  const isCurated = "curator" in playlist;
  const description = "description" in playlist ? playlist.description : "";
  const trackCount = playlist.trackIds.length;

  return (
    <article
      className={cn(
        "group min-w-0 rounded-2xl border border-transparent p-2 -m-2 transition-colors duration-200 hover:border-white/[0.08] hover:bg-card",
        className,
      )}
    >
      <div className="relative">
        <Link
          href={`/playlist/${playlist.id}`}
          className="block overflow-hidden rounded-2xl border border-white/[0.08] bg-elevated shadow-[0_14px_34px_-18px_rgba(0,0,0,0.85)] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`${playlist.title} playlist`}
        >
          <Artwork
            src={playlist.artwork}
            alt={`${playlist.title} playlist cover`}
            res="md"
            className="aspect-square w-full transition-transform duration-300 ease-out group-hover:scale-[1.02]"
            priority={priority}
          />
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-black/30 via-transparent to-white/[0.04] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        </Link>
        <PlayButton
          trackIds={playlist.trackIds}
          label={playlist.title}
          size="md"
          className="absolute bottom-2.5 right-2.5 translate-y-1 opacity-100 shadow-2xl transition-all duration-200 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:focus-visible:translate-y-0 sm:focus-visible:opacity-100"
        />
      </div>
      <div className="mt-3 min-w-0 px-0.5">
        <Link
          href={`/playlist/${playlist.id}`}
          className="line-clamp-1 text-[13.5px] font-semibold leading-5 text-foreground transition hover:underline"
        >
          {playlist.title}
        </Link>
        {!hideDescription ? (
          <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
            {description || `${trackCount} ${trackCount === 1 ? "song" : "songs"}`}
          </p>
        ) : (
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            {isCurated ? "Playlist" : "Made by you"} · {trackCount}{" "}
            {trackCount === 1 ? "song" : "songs"}
          </p>
        )}
      </div>
    </article>
  );
});
