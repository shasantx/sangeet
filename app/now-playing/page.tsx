"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Disc3,
  ListMusic,
  Menu,
  MoreHorizontal,
  Plus,
  Radio,
  Share2,
} from "lucide-react";
import { albumMap, artistMap, getAlbum, getArtist, getTrack } from "@/lib/catalog";
import { formatDuration } from "@/lib/utils";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { useUIStore, toast } from "@/store/ui-store";
import { Artwork } from "@/components/music/artwork";
import { EmptyState } from "@/components/music/empty-state";
import { LikeButton } from "@/components/music/like-button";
import { PlayButton } from "@/components/music/play-button";
import { PlaybackControls } from "@/components/player/playback-controls";
import { ProgressBar } from "@/components/player/progress-bar";
import { VolumeControl } from "@/components/player/volume-control";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function NowPlayingPage() {
  const router = useRouter();
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const queue = usePlayerStore((state) => state.queue);
  const queueIndex = usePlayerStore((state) => state.queueIndex);
  const contextLabel = usePlayerStore((state) => state.contextLabel);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const duration = usePlayerStore((state) => state.duration);
  const playQueueIndex = usePlayerStore((state) => state.playQueueIndex);
  const current = currentTrackId ? getTrack(currentTrackId) : undefined;
  const artist = current ? getArtist(current.artistId) : undefined;
  const album = current ? getAlbum(current.albumId) : undefined;
  const albumHref =
    current && albumMap.has(current.albumId) ? `/album/${current.albumId}` : "/explore";
  const artistHref = artist && artistMap.has(artist.id) ? `/artist/${artist.id}` : "/explore";
  const openAddToPlaylist = useUIStore((state) => state.openAddToPlaylist);
  const toggleQueue = useUIStore((state) => state.toggleQueuePanel);
  const toggleMobileSidebar = useUIStore((state) => state.toggleMobileSidebar);
  const mobileSidebarOpen = useUIStore((state) => state.mobileSidebarOpen);
  const toggleFollow = useLibraryStore((state) => state.toggleFollowArtist);
  const followed = artist ? useLibraryStore.getState().followedArtistIds.includes(artist.id) : false;
  const upcoming = queue
    .slice(queueIndex + 1)
    .map((id) => getTrack(id))
    .filter((track): track is NonNullable<typeof track> => Boolean(track))
    .slice(0, 5);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied", "The now playing page is on your clipboard.");
    } catch {
      toast.error("Could not copy link", "Your browser blocked clipboard access.");
    }
  };

  if (!current) {
    return (
      <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(139,92,246,.12),transparent_60%)]" />
        <header className="flex h-[72px] shrink-0 items-center justify-between px-5 sm:px-8">
          <Link
            href="/home"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground"
            aria-label="Close now playing"
          >
            <ChevronDown className="h-5 w-5" />
          </Link>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Now playing
          </p>
          <span className="h-9 w-9" />
        </header>
        <main className="page-container flex flex-1 items-center justify-center pb-16">
          <EmptyState
            icon={<Radio className="h-5 w-5" />}
            title="The stage is quiet"
            description="Start a record and the full player will open here with artwork, credits and what comes next."
            action={
              <Link
                href="/home"
                className="rounded-full bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground transition hover:bg-secondary"
              >
                Find something to play
              </Link>
            }
          />
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(ellipse_at_50%_0%,rgba(76,96,76,.18),transparent_48%),linear-gradient(180deg,#10110f_0%,#0b0b0f_60%)]" />

      <header className="relative z-10 flex h-[76px] shrink-0 items-center gap-3 px-4 sm:px-7 lg:px-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Close now playing"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
        <button type="button" onClick={toggleMobileSidebar} aria-label={mobileSidebarOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileSidebarOpen} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 flex flex-col items-center justify-center">
          {current.youtubeId ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Now playing</p>
          ) : (
            <>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {contextLabel || "Now playing"}
              </p>
              {album && (
                <Link
                  href={albumHref}
                  className="mt-1 hidden truncate text-[11px] text-muted-foreground/65 transition hover:text-foreground sm:block"
                >
                  From {album.title}
                </Link>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copyLink}
            aria-label="Copy link to this page"
            className="hidden h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Track options"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[225px]">
              <DropdownMenuItem onSelect={() => openAddToPlaylist(current.id)}>
                <Plus className="h-3.5 w-3.5" />
                Add to playlist
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toggleQueue()}>
                <ListMusic className="h-3.5 w-3.5" />
                Open queue
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {artist && (
                <DropdownMenuItem
                  onSelect={() => {
                    const next = toggleFollow(artist.id);
                    toast.show(
                      next ? "Following artist" : "Unfollowed artist",
                      artist.name,
                      next ? "success" : "default",
                    );
                  }}
                >
                  {followed ? "Unfollow artist" : "Follow artist"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => router.push(albumHref)}>
                <Disc3 className="h-3.5 w-3.5" />
                Go to album
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col px-5 pb-8 pt-2 sm:px-8 lg:px-10 lg:pb-10 lg:pt-4">
        <div className="mx-auto grid w-full max-w-[1260px] flex-1 items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)] lg:gap-16">
          <div className="mx-auto w-full max-w-[420px] lg:max-w-[520px]">
            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-[32px] bg-white/[.035] blur-2xl" />
              <Artwork
                src={current.artwork}
                alt={`${album?.title ?? current.title} artwork`}
                className="aspect-square w-full rounded-2xl border border-white/[.08] shadow-[0_50px_100px_-30px_rgba(0,0,0,.95)]"
                priority
              />
              <div className="absolute inset-x-0 -bottom-2 flex justify-center sm:hidden">
                <span className="rounded-full border border-white/[.09] bg-[#111116]/85 px-3 py-1 text-[9px] uppercase tracking-[0.14em] text-white/55 backdrop-blur">
                  {current.mood}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full max-w-[560px] lg:mx-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="eyebrow mb-2 hidden text-white/40 sm:block">Now playing</p>
                <h1 className="font-display text-[32px] font-medium leading-[1.02] tracking-[-0.05em] text-white sm:text-[44px] lg:text-[50px]">
                  {current.title}
                </h1>
                <Link
                  href={artistHref}
                  className="mt-2 inline-block font-display text-lg text-white/65 transition hover:text-white hover:underline sm:text-xl"
                >
                  {artist?.name ?? "Unknown artist"}
                </Link>
                {album && (
                  <Link
                    href={albumHref}
                    className="mt-1 block text-[11px] text-white/35 transition hover:text-white/60"
                  >
                    {album.title} · {album.year} · {album.type}
                  </Link>
                )}
              </div>
              <LikeButton trackId={current.id} size="lg" className="bg-white/[.05] text-white/75 hover:bg-white/[.1] hover:text-white" />
            </div>

            <div className="mt-7">
              <ProgressBar
                className="w-full"
                timeClassName="w-10 shrink-0 text-center text-[10px] tabular-nums text-white/45"
              />
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="hidden flex-1 sm:block">
                <VolumeControl />
              </div>
              <PlaybackControls size="large" className="flex-1 justify-center" />
              <div className="flex flex-1 justify-end">
                <button
                  type="button"
                  onClick={toggleQueue}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Open queue"
                >
                  <ListMusic className="h-[19px] w-[19px]" />
                </button>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-2 border-t border-white/[.07] pt-5">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">
                  Mood
                </p>
                <p className="mt-1 text-[12px] text-white/65">{current.mood}</p>
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">
                  Duration
                </p>
                <p className="mt-1 text-[12px] text-white/65">
                  {formatDuration(duration || current.duration)}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">
                  Written by
                </p>
                <p className="mt-1 truncate text-[12px] text-white/65">{artist?.name ?? "Sangeet"}</p>
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">
                  {current.youtubeId ? "Collection" : "Label"}
                </p>
                <p className="mt-1 text-[12px] text-white/65">
                  {current.youtubeId ? "Sangeet selection" : "Sangeet Recordings"}
                </p>
              </div>
            </div>

            {upcoming.length > 0 && (
              <div className="mt-7">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">
                    Up next
                  </p>
                  <Link
                    href="/queue"
                    className="text-[10px] text-white/35 transition hover:text-white/70"
                  >
                    Full queue
                  </Link>
                </div>
                <div className="space-y-0.5">
                  {upcoming.slice(0, 3).map((track, index) => (
                    <button
                      key={`${track.id}-${index}`}
                      type="button"
                      onClick={() => playQueueIndex(queueIndex + 1 + index)}
                      className="group flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition hover:bg-white/[.05]"
                    >
                      <Artwork src={track.artwork} alt="" className="h-8 w-8 shrink-0 rounded-md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11.5px] font-medium text-white/70">
                          {track.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-white/35">
                          {getArtist(track.artistId)?.name}
                        </span>
                      </span>
                      <span className="text-[9px] tabular-nums text-white/25">
                        {formatDuration(track.duration)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="relative z-10 hidden shrink-0 items-center justify-between border-t border-white/[.05] px-10 py-3 text-[9px] text-white/25 sm:flex">
        <span>Sangeet · Music beyond boundaries</span>
        <span className="flex items-center gap-1.5">
          <span className={isPlaying ? "h-1.5 w-1.5 rounded-full bg-primary" : "h-1.5 w-1.5 rounded-full bg-white/20"} />
          {isPlaying ? "Playing locally" : "Paused"}
        </span>
      </footer>
    </div>
  );
}
