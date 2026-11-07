"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Disc3,
  ListMusic,
  Mic2,
  MoreHorizontal,
  Music2,
  Plus,
  Radio,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
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
import { ConnectedDevices } from "@/components/player/connected-devices";
import { LyricsView } from "@/components/player/lyrics-view";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function QueueTrackRow({
  track,
  active,
  onClick,
}: {
  track: Track;
  active?: boolean;
  onClick: () => void;
}) {
  const artist = getArtist(track.artistId);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`group flex min-h-[60px] w-full items-center gap-3.5 rounded-xl px-3 py-2 text-left transition hover:bg-white/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        active ? "bg-white/[.07] border border-white/[.08]" : ""
      }`}
    >
      <Artwork
        src={track.artwork}
        alt=""
        className="h-11 w-11 shrink-0 rounded-lg shadow"
      />
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[13.5px] font-semibold ${
            active ? "text-primary" : "text-foreground group-hover:text-primary"
          }`}
        >
          {track.title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {artist?.name ?? "Unknown artist"}
        </span>
      </span>
      {active ? (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          Playing
        </span>
      ) : (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
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

  const [activeTab, setActiveTab] = useState<string>("lyrics");

  const upcoming = useMemo(() => {
    return queue
      .slice(queueIndex + 1)
      .map((id) => getTrack(id))
      .filter((track): track is Track => Boolean(track));
  }, [queue, queueIndex]);

  const recentTracks = useMemo(() => {
    return getTracks(recentIds.filter((id) => id !== currentTrackId)).slice(0, 8);
  }, [recentIds, currentTrackId]);

  const relatedTracks = useMemo(() => {
    if (!current) return [];
    return tracks
      .filter(
        (track) =>
          track.id !== current.id &&
          (track.artistId === current.artistId ||
            track.genreIds.some((genre) => current.genreIds.includes(genre))),
      )
      .slice(0, 8);
  }, [current]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied", "The now playing page is on your clipboard.");
    } catch {
      toast.error("Could not copy link", "Your browser blocked clipboard access.");
    }
  };

  return (
    <main className="relative isolate min-h-[calc(100vh-5rem)] overflow-hidden pb-12 pt-4 sm:pt-6">
      {/* Dynamic Ambient Background Glow */}
      {current?.artwork && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <div
            className="absolute -top-32 left-1/2 h-[720px] w-[1000px] -translate-x-1/2 scale-150 rounded-full opacity-20 blur-[130px] transition-all duration-700"
            style={{
              backgroundImage: `radial-gradient(circle, #1ed760 0%, #111713 70%, transparent 100%)`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#090b09]/80 to-[#090b09]" />
        </div>
      )}

      <div className="page-container max-w-[1520px] space-y-6 sm:space-y-8">
        {/* Top bar navigation */}
        <header className="flex items-center justify-between gap-4 border-b border-white/[.06] pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/home"
              className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/[.08] bg-white/[.035] px-3.5 text-xs font-semibold text-muted-foreground transition hover:border-white/[.15] hover:bg-white/[.07] hover:text-foreground"
              aria-label="Back to Sangeet"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Sangeet</span>
            </Link>
            <div className="min-w-0">
              <p className="eyebrow text-primary">Now playing</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {current ? contextLabel || "Sangeet Session" : "Your music space"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <ConnectedDevices />
            {current && (
              <>
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  aria-label="Copy link to this song"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Track options"
                      className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[220px]">
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
        </header>

        {/* Main Content Grid */}
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(320px,460px)_minmax(0,1fr)] xl:gap-10">
          {/* Left Column: Huge High-Res Artwork & Primary Controls */}
          <section
            aria-label="Current track details"
            className="flex flex-col rounded-3xl border border-white/[.07] bg-white/[.018] p-6 shadow-2xl backdrop-blur-xl sm:p-8"
          >
            {current ? (
              <div className="flex flex-col">
                {/* Artwork */}
                <div className="relative mx-auto w-full aspect-square overflow-hidden rounded-2xl border border-white/[.08] shadow-[0_24px_60px_-12px_rgba(0,0,0,.7)]">
                  <Artwork
                    key={current.id}
                    src={current.artwork}
                    alt={`${current.title} cover`}
                    priority
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Track Metadata */}
                <div className="mt-6 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="truncate font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                      {current.title}
                    </h1>
                    <Link
                      href={artist ? `/artist/${artist.id}` : "/explore"}
                      className="mt-1 block truncate text-base font-medium text-muted-foreground transition hover:text-white hover:underline"
                    >
                      {artist?.name ?? "Unknown artist"}
                    </Link>
                    {album && (
                      <Link
                        href={`/album/${album.id}`}
                        className="mt-0.5 block truncate text-xs text-muted-foreground/75 transition hover:text-white"
                      >
                        {album.title}
                        {album.year ? ` · ${album.year}` : ""}
                      </Link>
                    )}
                  </div>
                  <LikeButton
                    trackId={current.id}
                    size="lg"
                    className="h-11 w-11 shrink-0 rounded-full bg-white/[.04] text-muted-foreground hover:bg-white/[.08] hover:text-foreground"
                  />
                </div>

                {/* Progress Scrubber */}
                <div className="mt-7">
                  <ProgressBar
                    className="w-full"
                    timeClassName="w-10 shrink-0 text-center text-xs tabular-nums text-muted-foreground"
                  />
                </div>

                {/* Large Playback Controls */}
                <div className="mt-4 flex items-center justify-center">
                  <PlaybackControls size="large" className="gap-3 sm:gap-4" />
                </div>

                {/* Bottom Bar inside Card: Volume & Extras */}
                <div className="mt-6 flex items-center justify-between border-t border-white/[.06] pt-4">
                  <div className="text-xs text-muted-foreground">
                    <span className="rounded-full border border-white/[.08] bg-white/[.03] px-2.5 py-1">
                      {current.mood || "Music"}
                    </span>
                  </div>
                  <div className="w-40">
                    <VolumeControl />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Disc3 className="h-16 w-16 text-muted-foreground/40 animate-spin" />
                <h2 className="mt-4 text-xl font-semibold">Nothing playing yet</h2>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Pick any song from Explore or Search to start listening.
                </p>
                <Link
                  href="/explore"
                  className="mt-6 rounded-full bg-primary px-6 py-2.5 text-xs font-bold text-black"
                >
                  Explore music
                </Link>
              </div>
            )}
          </section>

          {/* Right Column: Interactive Tabs for Lyrics, Up Next Queue, Related, and Artist */}
          <section aria-label="Music discovery panels" className="min-w-0">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              {/* Tabs Navigation Header */}
              <TabsList className="mb-6 grid h-12 w-full grid-cols-4 rounded-2xl border border-white/[.08] bg-[#141814]/90 p-1 shadow-lg backdrop-blur-xl">
                <TabsTrigger
                  value="lyrics"
                  className="gap-2 rounded-xl text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-black"
                >
                  <Mic2 className="h-3.5 w-3.5" />
                  <span>Lyrics</span>
                </TabsTrigger>
                <TabsTrigger
                  value="queue"
                  className="gap-2 rounded-xl text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-black"
                >
                  <ListMusic className="h-3.5 w-3.5" />
                  <span>Up Next ({upcoming.length})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="related"
                  className="gap-2 rounded-xl text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-black"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Related</span>
                </TabsTrigger>
                <TabsTrigger
                  value="artist"
                  className="gap-2 rounded-xl text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-black"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Artist</span>
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Synchronized Lyrics */}
              <TabsContent value="lyrics" className="focus-visible:outline-none">
                {current ? (
                  <LyricsView
                    trackTitle={current.title}
                    artistName={artist?.name}
                    videoId={current.youtubeId}
                    duration={current.duration}
                  />
                ) : (
                  <div className="rounded-2xl border border-white/[.07] bg-white/[.018] p-12 text-center text-sm text-muted-foreground">
                    Play a song to see live synchronized lyrics.
                  </div>
                )}
              </TabsContent>

              {/* Tab 2: Queue */}
              <TabsContent value="queue" className="focus-visible:outline-none">
                <div className="rounded-2xl border border-white/[.07] bg-white/[.018] p-4 sm:p-6">
                  {current && (
                    <div className="mb-4">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
                        Now Playing
                      </p>
                      <QueueTrackRow track={current} active onClick={() => undefined} />
                    </div>
                  )}

                  <div className="border-t border-white/[.06] pt-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Next in Queue
                    </p>
                    {upcoming.length > 0 ? (
                      <div className="space-y-1">
                        {upcoming.map((track, idx) => (
                          <QueueTrackRow
                            key={`${track.id}-${idx}`}
                            track={track}
                            onClick={() => playQueueIndex(queueIndex + 1 + idx)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="py-10 text-center">
                        <p className="text-xs text-muted-foreground">
                          No more tracks in the current queue.
                        </p>
                        <button
                          type="button"
                          onClick={toggleQueue}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/[.1] bg-white/[.04] px-4 py-2 text-xs font-semibold text-primary transition hover:bg-white/[.08]"
                        >
                          <Plus className="h-3.5 w-3.5" /> Browse & add music
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Tab 3: Related Music */}
              <TabsContent value="related" className="focus-visible:outline-none">
                <div className="rounded-2xl border border-white/[.07] bg-white/[.018] p-4 sm:p-6">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Recommended based on this song
                  </p>
                  {relatedTracks.length > 0 ? (
                    <div className="space-y-1">
                      {relatedTracks.map((track) => (
                        <QueueTrackRow
                          key={track.id}
                          track={track}
                          onClick={() =>
                            playTrack(
                              track.id,
                              relatedTracks.map((t) => t.id),
                              `Related to ${current?.title}`,
                            )
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-xs text-muted-foreground">
                      No related tracks found for this song.
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* Tab 4: Artist Details */}
              <TabsContent value="artist" className="focus-visible:outline-none">
                {artist ? (
                  <div className="rounded-2xl border border-white/[.07] bg-white/[.018] p-6 sm:p-8">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                      <Artwork
                        src={artist.image}
                        alt={artist.name}
                        className="h-24 w-24 shrink-0 rounded-full shadow-xl border border-white/[.1]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-wider text-primary font-semibold">
                          Artist
                        </p>
                        <Link
                          href={`/artist/${artist.id}`}
                          className="mt-1 block font-display text-2xl font-bold text-white hover:underline"
                        >
                          {artist.name}
                        </Link>
                        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                          {artist.bio || artist.shortBio}
                        </p>
                      </div>
                      <Link
                        href={`/artist/${artist.id}`}
                        className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-xs font-bold text-black transition hover:brightness-110"
                      >
                        View Profile
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/[.07] bg-white/[.018] p-8 text-center text-xs text-muted-foreground">
                    Artist information will display here when a song is playing.
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </div>
    </main>
  );
}
