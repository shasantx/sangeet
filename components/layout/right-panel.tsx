"use client";

import Link from "next/link";
import { ChevronRight, ListMusic, PanelRightClose, Play, UserPlus } from "lucide-react";
import { albumMap, artistMap, getAlbum, getArtist, getTrack } from "@/lib/catalog";
import { cn, formatDuration } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { useUIStore, toast } from "@/store/ui-store";
import { Artwork } from "@/components/music/artwork";
import { LikeButton } from "@/components/music/like-button";
import { PlayButton } from "@/components/music/play-button";

export function RightPanel() {
  const open = useAppStore((state) => state.rightPanelOpen);
  const setOpen = useAppStore((state) => state.setRightPanelOpen);
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const queue = usePlayerStore((state) => state.queue);
  const queueIndex = usePlayerStore((state) => state.queueIndex);
  const playQueueIndex = usePlayerStore((state) => state.playQueueIndex);
  const toggleQueue = useUIStore((state) => state.toggleQueuePanel);
  const followedArtists = useLibraryStore((state) => state.followedArtistIds);
  const toggleFollow = useLibraryStore((state) => state.toggleFollowArtist);

  const current = currentTrackId ? getTrack(currentTrackId) : undefined;
  const artist = current ? getArtist(current.artistId) : undefined;
  const album = current ? getAlbum(current.albumId) : undefined;
  const albumHref =
    current && albumMap.has(current.albumId) ? `/album/${current.albumId}` : "/explore";
  const artistHref = artist && artistMap.has(artist.id) ? `/artist/${artist.id}` : "/explore";
  const followed = artist ? followedArtists.includes(artist.id) : false;
  const upcoming = queue
    .slice(queueIndex + 1)
    .map((id, index) => ({ track: getTrack(id), index: queueIndex + 1 + index }))
    .filter((entry) => Boolean(entry.track))
    .slice(0, 4);

  if (!open) return null;

  return (
    <aside
      className="fixed right-0 top-0 z-30 hidden h-[calc(100dvh-88px)] w-[340px] flex-col border-l border-white/[.045] bg-[#0e0e13]/92 backdrop-blur-xl xl:flex"
      aria-label="Now playing details"
    >
      <div className="flex h-[70px] shrink-0 items-center justify-between px-5">
        <span className="eyebrow">Now playing</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Hide panel"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.055] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {current && artist && album ? (
          <>
            <div className="relative">
              <Link
                href={albumHref}
                className="block overflow-hidden rounded-xl shadow-[0_24px_50px_-20px_rgba(0,0,0,.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`Open ${album.title}`}
              >
                <Artwork
                  src={current.artwork}
                  alt={`${album.title} artwork`}
                  className="aspect-square w-full rounded-xl"
                />
              </Link>
              <PlayButton
                trackIds={[current.id]}
                label={current.title}
                size="md"
                className="absolute bottom-3 right-3"
              />
            </div>

            <div className="mt-5 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={albumHref}
                  className="block font-display text-[22px] font-medium leading-tight tracking-[-0.03em] text-foreground transition hover:underline"
                >
                  {current.title}
                </Link>
                <Link
                  href={artistHref}
                  className="mt-1.5 block text-[13px] text-muted-foreground transition hover:text-foreground hover:underline"
                >
                  {artist.name}
                </Link>
              </div>
              <LikeButton trackId={current.id} className="mt-1" />
            </div>

            <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="rounded-full border border-white/[.07] bg-white/[.025] px-2.5 py-1">
                {current.mood}
              </span>
              <span>{formatDuration(current.duration)}</span>
              <span className="text-muted-foreground/40">·</span>
              <span>{album.year}</span>
            </div>

            <div className="mt-7 rounded-xl border border-white/[.06] bg-white/[.025] p-4">
              <div className="flex items-center gap-3">
                <Link href={artistHref} className="shrink-0">
                  <Artwork
                    src={artist.image}
                    alt={`${artist.name} portrait`}
                    className="h-10 w-10 rounded-full"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">About {artist.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Artist profile</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = toggleFollow(artist.id);
                    toast.show(next ? "Following artist" : "Unfollowed artist", artist.name, next ? "success" : "default");
                  }}
                  aria-pressed={followed}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    followed
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-white/[.09] hover:border-white/20",
                  )}
                  aria-label={followed ? `Unfollow ${artist.name}` : `Follow ${artist.name}`}
                >
                  {followed ? <ChevronRight className="h-3.5 w-3.5 rotate-45" /> : <UserPlus className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="mt-3 line-clamp-3 text-[11px] leading-[1.65] text-muted-foreground">
                {artist.shortBio}
              </p>
              <Link
                href={artistHref}
                className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium text-foreground transition hover:text-primary"
              >
                View artist
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between">
                <span className="eyebrow">Up next</span>
                <button
                  type="button"
                  onClick={toggleQueue}
                  className="text-[10px] text-muted-foreground transition hover:text-foreground"
                >
                  See queue
                </button>
              </div>
              {upcoming.length > 0 ? (
                <div className="space-y-1">
                  {upcoming.map(({ track, index }) =>
                    track ? (
                      <button
                        key={`${track.id}-${index}`}
                        type="button"
                        onClick={() => playQueueIndex(index)}
                        className="group flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition hover:bg-white/[.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Artwork src={track.artwork} alt="" className="h-9 w-9 shrink-0 rounded-md" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11.5px] font-medium text-foreground">
                            {track.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                            {getArtist(track.artistId)?.name}
                          </span>
                        </span>
                        <Play className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" fill="currentColor" />
                      </button>
                    ) : null,
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-white/[.075] px-3 py-5 text-center">
                  <ListMusic className="mx-auto h-4 w-4 text-muted-foreground/45" />
                  <p className="mt-2 text-[10px] text-muted-foreground">Queue is clear</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-[60vh] flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/[.07] bg-white/[.025]">
              <ListMusic className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="mt-4 font-display text-lg text-foreground">Your listening room</p>
            <p className="mt-1.5 max-w-[210px] text-xs leading-relaxed text-muted-foreground">
              Play something and artist details, credits and what is next will appear here.
            </p>
            <Link
              href="/"
              className="mt-5 rounded-full bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground transition hover:bg-secondary"
            >
              Find something to play
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
