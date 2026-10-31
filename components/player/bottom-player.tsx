"use client";

import Link from "next/link";
import { Expand, ListMusic, RotateCcw } from "lucide-react";
import { albumMap, artistMap, getArtist, getTrack } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import { useUIStore } from "@/store/ui-store";
import { Artwork } from "@/components/music/artwork";
import { LikeButton } from "@/components/music/like-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PlaybackControls } from "./playback-controls";
import { ProgressBar } from "./progress-bar";
import { VolumeControl } from "./volume-control";

export function BottomPlayer() {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const error = usePlayerStore((state) => state.error);
  const next = usePlayerStore((state) => state.next);
  const toggleQueue = useUIStore((state) => state.toggleQueuePanel);
  const current = currentTrackId ? getTrack(currentTrackId) : undefined;
  const artist = current ? getArtist(current.artistId) : undefined;
  const albumHref =
    current && albumMap.has(current.albumId) ? `/album/${current.albumId}` : "/explore";
  const artistHref = artist && artistMap.has(artist.id) ? `/artist/${artist.id}` : "/explore";

  return (
    <footer
      className="fixed inset-x-0 bottom-0 z-50 hidden h-[88px] border-t border-white/[.065] bg-[#0e0e13]/95 backdrop-blur-2xl md:flex"
      aria-label="Music player"
    >
      {error && (
        <div className="absolute inset-x-0 -top-[38px] flex items-center justify-center gap-3 border-t border-[#c44d58]/20 bg-[#2a171b]/95 px-4 py-2 text-[11px] text-[#f0b6ba] backdrop-blur-md">
          <span className="line-clamp-1">{error}</span>
          <button
            type="button"
            onClick={() => next()}
            className="shrink-0 font-medium text-foreground underline-offset-2 hover:underline"
          >
            Try next track
          </button>
        </div>
      )}

      <div className="grid h-full w-full grid-cols-[minmax(0,.9fr)_minmax(360px,1.3fr)_minmax(0,.9fr)] items-center gap-5 px-4 xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {current ? (
            <>
              <Link
                href="/now-playing"
                className="group relative shrink-0 overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Open now playing"
              >
                <Artwork
                  src={current.artwork}
                  alt={`${current.title} artwork`}
                  className="h-[54px] w-[54px] rounded-md"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                  <Expand className="h-4 w-4 text-white" />
                </span>
              </Link>
              <div className="min-w-0">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Link
                    href={albumHref}
                    className="block truncate text-[13px] font-medium text-foreground transition hover:underline"
                  >
                    {current.title}
                  </Link>
                </span>
                <Link
                  href={artistHref}
                  className="mt-0.5 block truncate text-[11px] text-muted-foreground transition hover:text-foreground hover:underline"
                >
                  {artist?.name ?? "Unknown artist"}
                </Link>
              </div>
              <LikeButton trackId={current.id} className="ml-1 hidden xl:flex" />
            </>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-md border border-white/[.06] bg-white/[.025]">
                <RotateCcw className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground">Nothing playing</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Choose a track to begin</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col items-center gap-1.5">
          <PlaybackControls />
          <ProgressBar className="w-full max-w-[660px]" timeClassName="w-9 shrink-0 text-center text-[10px] tabular-nums text-muted-foreground" />
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleQueue}
                aria-label="Open queue"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ListMusic className="h-[17px] w-[17px]" strokeWidth={1.7} />
              </button>
            </TooltipTrigger>
            <TooltipContent>Queue</TooltipContent>
          </Tooltip>
          <VolumeControl className="hidden 2xl:flex" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/now-playing"
                aria-label="Open full-screen player"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Expand className="h-[16px] w-[16px]" strokeWidth={1.7} />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Full screen</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </footer>
  );
}
