"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Disc3, ListMusic, MoreHorizontal, Plus, Radio, Share2 } from "lucide-react";
import { getAlbum, getArtist, getTrack, getTracks, tracks } from "@/lib/catalog";
import { formatDuration } from "@/lib/utils";
import type { Track } from "@/lib/types";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { useUIStore, toast } from "@/store/ui-store";
import { Artwork } from "@/components/music/artwork";
import { LikeButton } from "@/components/music/like-button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function QueueTrack({ track, active, onClick }: { track: Track; active?: boolean; onClick: () => void }) {
  const artist = getArtist(track.artistId);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`group flex min-h-[58px] w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? "bg-white/[.06]" : ""}`}
    >
      <Artwork src={track.artwork} alt="" className="h-10 w-10 shrink-0 rounded-md" />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[13px] font-medium ${active ? "text-primary" : "text-foreground"}`}>
          {track.title}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {artist?.name ?? "Unknown artist"}
        </span>
      </span>
      {active ? (
        <Radio className="h-4 w-4 shrink-0 text-primary" aria-label="Now playing" />
      ) : (
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
          {formatDuration(track.duration)}
        </span>
      )}
    </button>
  );
}

export default function NowPlayingPage() {
  const router = useRouter();
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const queue = usePlayerStore((state) => state.queue);
  const queueIndex = usePlayerStore((state) => state.queueIndex);
  const contextLabel = usePlayerStore((state) => state.contextLabel);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const playQueueIndex = usePlayerStore((state) => state.playQueueIndex);
  const current = currentTrackId ? getTrack(currentTrackId) : undefined;
  const artist = current ? getArtist(current.artistId) : undefined;
  const album = current ? getAlbum(current.albumId) : undefined;
  const recentIds = useLibraryStore((state) => state.recentlyPlayed);
  const followedArtistIds = useLibraryStore((state) => state.followedArtistIds);
  const toggleFollow = useLibraryStore((state) => state.toggleFollowArtist);
  const openAddToPlaylist = useUIStore((state) => state.openAddToPlaylist);
  const toggleQueue = useUIStore((state) => state.toggleQueuePanel);
  const followed = Boolean(artist && followedArtistIds.includes(artist.id));

  const upcoming = queue
    .slice(queueIndex + 1)
    .map((id) => getTrack(id))
    .filter((track): track is Track => Boolean(track));
  const recentTracks = getTracks(recentIds.filter((id) => id !== currentTrackId)).slice(0, 8);
  const relatedTracks = current
    ? tracks
        .filter((track) => track.id !== current.id && track.genreIds.some((genre) => current.genreIds.includes(genre)))
        .slice(0, 8)
    : [];

  const playFrom = (track: Track, list: Track[], label: string) => {
    playTrack(track.id, list.map((item) => item.id), label);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied", "The now playing page is on your clipboard.");
    } catch {
      toast.error("Could not copy link", "Your browser blocked clipboard access.");
    }
  };

  return (
    <main className="page-container max-w-[1480px] space-y-6 pb-8 pt-5 sm:space-y-8 sm:pt-8">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow text-primary">Now playing</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {current ? contextLabel || "Your listening session" : "Your listening space"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {current && (
            <>
              <button
                type="button"
                onClick={() => void copyLink()}
                aria-label="Copy link to this page"
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Track options"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[225px]">
                  <DropdownMenuItem onSelect={() => openAddToPlaylist(current.id)}>
                    <Plus className="h-3.5 w-3.5" /> Add to playlist
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={toggleQueue}>
                    <ListMusic className="h-3.5 w-3.5" /> Open full queue
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {artist && (
                    <DropdownMenuItem
                      onSelect={() => {
                        const next = toggleFollow(artist.id);
                        toast.show(next ? "Following artist" : "Unfollowed artist", artist.name, next ? "success" : "default");
                      }}
                    >
                      {followed ? "Unfollow artist" : "Follow artist"}
                    </DropdownMenuItem>
                  )}
                  {album && (
                    <DropdownMenuItem onSelect={() => router.push(`/album/${album.id}`)}>
                      <Disc3 className="h-3.5 w-3.5" /> Go to album
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-7">
        <section className="min-w-0 rounded-2xl border border-white/[.07] bg-white/[.018] p-4 sm:p-6 lg:p-7">
          {current ? (
            <div className="grid items-center gap-6 lg:grid-cols-[minmax(240px,.88fr)_minmax(300px,1.12fr)] lg:gap-8 xl:gap-10">
              <div className="mx-auto w-full max-w-[440px]">
                <Artwork
                  key={current.id}
                  src={current.artwork}
                  alt={`${album?.title ?? current.title} cover artwork`}
                  priority
                  className="aspect-square w-full rounded-xl border border-white/[.08] shadow-[0_22px_60px_rgba(0,0,0,.3)] transition-opacity duration-300"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="truncate text-[clamp(1.5rem,3vw,2.25rem)] font-semibold leading-tight tracking-[-.04em] text-foreground">
                      {current.title}
                    </h1>
                    <Link href={artist ? `/artist/${artist.id}` : "/explore"} className="mt-1 block truncate text-base text-muted-foreground transition hover:text-foreground">
                      {artist?.name ?? "Unknown artist"}
                    </Link>
                    {album && (
                      <Link href={`/album/${album.id}`} className="mt-1 block truncate text-sm text-muted-foreground/70 transition hover:text-foreground">
                        {album.title}{album.year ? ` · ${album.year}` : ""}
                      </Link>
                    )}
                  </div>
                  <LikeButton trackId={current.id} size="lg" className="h-11 w-11 shrink-0 bg-white/[.04] text-muted-foreground hover:bg-white/[.08] hover:text-foreground" />
                </div>

                <div className="mt-7 sm:mt-9">
                  <ProgressBar className="w-full" timeClassName="w-10 shrink-0 text-center text-[11px] tabular-nums text-muted-foreground" />
                </div>
                <div className="mt-4 flex items-center justify-center gap-2 sm:mt-5">
                  <PlaybackControls size="large" className="gap-2 sm:gap-3" />
                </div>
                <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/[.06] pt-4">
                  <div className="min-w-0 text-xs text-muted-foreground">
                    {current.mood ? <span>{current.mood}</span> : <span>{contextLabel || "Sangeet"}</span>}
                    {album?.type && <span className="text-muted-foreground/50"> · {album.type}</span>}
                  </div>
                  <div className="hidden sm:block"><VolumeControl /></div>
                  <button type="button" onClick={toggleQueue} className="flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-xs text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary xl:hidden" aria-label="Open full queue">
                    <ListMusic className="h-4 w-4" /> Queue
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid items-center gap-6 lg:grid-cols-[minmax(240px,.88fr)_minmax(300px,1.12fr)] lg:gap-8">
              <div className="mx-auto flex aspect-square w-full max-w-[440px] items-center justify-center rounded-xl border border-white/[.07] bg-white/[.025] text-muted-foreground/55">
                <Disc3 className="h-14 w-14 stroke-[1.2]" aria-hidden="true" />
              </div>
              <div className="min-w-0 py-2 text-center lg:text-left">
                <p className="eyebrow text-primary">Your listening session</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-[-.04em] text-foreground sm:text-3xl">Nothing playing yet</h1>
                <p className="mt-2 text-sm text-muted-foreground">Choose a track to start listening.</p>
                <Link href="/explore" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">Explore music <span aria-hidden="true">→</span></Link>
                {recentTracks.length > 0 && <p className="mt-4 text-xs text-muted-foreground">Your recent tracks are ready below.</p>}
              </div>
            </div>
          )}
        </section>

        <aside className="hidden min-w-0 rounded-2xl border border-white/[.07] bg-white/[.018] p-3.5 xl:block" aria-label="Queue">
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Up next</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{queue.length ? `${queue.length} tracks in this session` : "Your listening queue"}</p>
            </div>
            <Link href="/queue" className="rounded-full px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground">Full queue</Link>
          </div>
          {current && <div className="mt-1 border-t border-white/[.06] pt-2"><p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[.12em] text-muted-foreground/70">Now playing</p><QueueTrack track={current} active onClick={() => undefined} /></div>}
          <div className="mt-2 border-t border-white/[.06] pt-2">
            <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[.12em] text-muted-foreground/70">Next in queue</p>
            {upcoming.length ? upcoming.slice(0, 7).map((track, index) => (
              <QueueTrack key={`${track.id}-${index}`} track={track} onClick={() => playQueueIndex(queueIndex + 1 + index)} />
            )) : (
              <div className="px-2 py-5 text-center">
                <p className="text-xs text-muted-foreground">No upcoming tracks</p>
                <button type="button" onClick={toggleQueue} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Plus className="h-3.5 w-3.5" /> Add music</button>
              </div>
            )}
          </div>
        </aside>
      </div>

      <section className="min-w-0 border-t border-white/[.06] pt-5 sm:pt-6" aria-label="More about your music">
        <Tabs defaultValue="queue" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-5 rounded-xl border-0 bg-white/[.025] p-1 sm:inline-flex sm:w-auto sm:rounded-full sm:border sm:border-white/[.05] sm:bg-white/[.035]">
            <TabsTrigger value="queue" className="min-h-10 px-2 text-[11px] sm:px-4 sm:text-xs">Up next</TabsTrigger>
            <TabsTrigger value="lyrics" className="min-h-10 px-2 text-[11px] sm:px-4 sm:text-xs">Lyrics</TabsTrigger>
            <TabsTrigger value="related" className="min-h-10 px-2 text-[11px] sm:px-4 sm:text-xs">Related</TabsTrigger>
            <TabsTrigger value="recent" className="min-h-10 min-w-0 px-1 text-[11px] sm:px-4 sm:text-xs"><span className="sm:hidden">Recent</span><span className="hidden sm:inline">Recently played</span></TabsTrigger>
            <TabsTrigger value="artist" className="min-h-10 px-2 text-[11px] sm:px-4 sm:text-xs">Artist</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-4 xl:hidden">
            <div className="space-y-1">
              {current && <QueueTrack track={current} active onClick={() => undefined} />}
              {upcoming.length ? upcoming.map((track, index) => <QueueTrack key={`${track.id}-${index}`} track={track} onClick={() => playQueueIndex(queueIndex + 1 + index)} />) : <p className="px-3 py-5 text-sm text-muted-foreground">Nothing else queued. Add a few tracks from Explore.</p>}
            </div>
          </TabsContent>

          <TabsContent value="lyrics" className="mt-4">
            <div className="rounded-xl border border-white/[.06] bg-white/[.02] px-4 py-6 text-center sm:py-8">
              <p className="text-sm font-medium text-foreground">Lyrics aren’t available for this track</p>
              <p className="mt-1 text-xs text-muted-foreground">When verified lyrics are available, they’ll appear here.</p>
            </div>
          </TabsContent>

          <TabsContent value="related" className="mt-4">
            {relatedTracks.length ? <div className="divide-y divide-white/[.05]">{relatedTracks.map((track) => <QueueTrack key={track.id} track={track} onClick={() => playFrom(track, relatedTracks, "Related tracks")} />)}</div> : <p className="py-6 text-sm text-muted-foreground">Play a catalogue track to see related music.</p>}
          </TabsContent>

          <TabsContent value="recent" className="mt-4">
            {recentTracks.length ? <div className="divide-y divide-white/[.05]">{recentTracks.map((track) => <QueueTrack key={track.id} track={track} onClick={() => playFrom(track, recentTracks, "Recently played")} />)}</div> : <p className="py-6 text-sm text-muted-foreground">Tracks you play will appear here.</p>}
          </TabsContent>

          <TabsContent value="artist" className="mt-4">
            {artist ? (
              <div className="flex flex-col gap-4 rounded-xl border border-white/[.06] bg-white/[.02] p-4 sm:flex-row sm:items-center sm:p-5">
                <Artwork src={artist.image} alt={`${artist.name} artist image`} className="h-16 w-16 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">About the artist</p><Link href={`/artist/${artist.id}`} className="mt-1 block text-lg font-semibold text-foreground hover:underline">{artist.name}</Link><p className="mt-1 line-clamp-3 text-sm leading-6 text-muted-foreground">{artist.bio || artist.shortBio || "Artist details are not available yet."}</p></div>
                <button type="button" onClick={() => { const next = toggleFollow(artist.id); toast.show(next ? "Following artist" : "Unfollowed artist", artist.name, next ? "success" : "default"); }} aria-pressed={followed} className="min-h-10 shrink-0 rounded-full border border-white/[.12] px-4 text-xs font-medium text-foreground transition hover:bg-white/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{followed ? "Following" : "Follow"}</button>
              </div>
            ) : <p className="py-6 text-sm text-muted-foreground">Artist details will appear when a track is playing.</p>}
          </TabsContent>
        </Tabs>
      </section>
      <span className="sr-only" aria-live="polite">{current ? `${current.title} by ${artist?.name ?? "unknown artist"}, ${isPlaying ? "playing" : "paused"}` : "Nothing playing"}</span>
    </main>
  );
}
