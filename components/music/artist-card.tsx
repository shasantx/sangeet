"use client";

import Link from "next/link";
import { Check, Plus } from "lucide-react";
import type { Artist } from "@/lib/types";
import { getArtistTracks } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { useLibraryStore } from "@/store/library-store";
import { toast } from "@/store/ui-store";
import { Artwork } from "./artwork";
import { PlayButton } from "./play-button";

interface ArtistCardProps {
  artist: Artist;
  className?: string;
  showFollow?: boolean;
  priority?: boolean;
}

export function ArtistCard({ artist, className, showFollow = true, priority = false }: ArtistCardProps) {
  const followed = useLibraryStore((state) => state.followedArtistIds.includes(artist.id));
  const toggleFollow = useLibraryStore((state) => state.toggleFollowArtist);
  const popularTracks = getArtistTracks(artist.id).map((track) => track.id);

  return (
    <article className={cn("group flex min-w-0 flex-col items-center text-center", className)}>
      <div className="relative w-full">
        <Link
          href={`/artist/${artist.id}`}
          className="block overflow-hidden rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`${artist.name} artist profile`}
        >
          <Artwork
            src={artist.image}
            alt={`${artist.name} portrait`}
            className="aspect-square w-full rounded-full shadow-[0_16px_40px_-22px_rgba(0,0,0,.9)] transition-transform duration-500 group-hover:scale-[1.025]"
            priority={priority}
          />
          <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
        {showFollow && (
          <button
            type="button"
            aria-label={followed ? `Unfollow ${artist.name}` : `Follow ${artist.name}`}
            aria-pressed={followed}
            onClick={() => {
              const next = toggleFollow(artist.id);
              toast.show(
                next ? "Following artist" : "Unfollowed artist",
                artist.name,
                next ? "success" : "default",
              );
            }}
            className={cn(
              "absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/[.08] bg-black/45 text-white backdrop-blur-md transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
              followed && "bg-primary text-primary-foreground sm:opacity-100",
            )}
          >
            {followed ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
        )}
        <PlayButton
          trackIds={popularTracks}
          label={artist.name}
          size="sm"
          className="absolute bottom-2 left-1/2 -translate-x-1/2 translate-y-1 opacity-100 shadow-2xl transition-all duration-300 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:focus-visible:translate-y-0 sm:focus-visible:opacity-100"
        />
      </div>
      <div className="mt-3.5 min-w-0 w-full">
        <Link
          href={`/artist/${artist.id}`}
          className="line-clamp-1 text-[13.5px] font-medium text-foreground transition hover:underline"
        >
          {artist.name}
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">Artist</p>
      </div>
    </article>
  );
}
