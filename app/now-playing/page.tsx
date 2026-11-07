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
  Volume2,
  Shuffle,
  Repeat,
  Repeat1,
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
      className={`group flex min-h-[56px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
        active
          ? "bg-white/[0.08] border border-white/[0.1]"
          : "hover:bg-white/[0.05] border border-transparent"
      }`}
    >
      <Artwork
        src={track.artwork}
        alt=""
        className="h-10 w-10 shrink-0 rounded-lg shadow-sm"
      />
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-xs font-semibold ${
            active ? "text-[#1ed760]" : "text-white group-hover:text-[#1ed760]"
          }`}
        >
          {track.title}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-[#9ba39d]">
          {artist?.name ?? "Unknown artist"}
        </p>
      </div>
      {active ? (
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#1ed760]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#1ed760] animate-pulse" />
          Playing
        </span>
      ) : (
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#636c65]">
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

  const followedArtistIds = useLibraryStore((state) => state.followedArtistIds);
  const toggleFollow = useLibraryStore((state) => state.toggleFollowArtist);
  const openAddToPlaylist = useUIStore((state) => state.openAddToPlaylist);
  const toggleQueue = useUIStore((state) => state.toggleQueuePanel);
  const followed = Boolean(artist && followedArtistIds.includes(artist.id));

  // Desktop tab: lyrics | queue | related | artist
  const [activeTab, setActiveTab] = useState<"lyrics" | "queue" | "related" | "artist">("lyrics");

  // Mobile mode: player | lyrics | queue
  const [mobileMode, setMobileMode] = useState<"player" | "lyrics" | "queue">("player");

  const upcoming = useMemo(() => {
    return queue
      .slice(queueIndex + 1)
      .map((id) => getTrack(id))
      .filter((track): track is Track => Boolean(track));
  }, [queue, queueIndex]);

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
      toast.success("Link copied", "The now playing link is on your clipboard.");
    } catch {
      toast.error("Could not copy link", "Your browser blocked clipboard access.");
    }
  };

  return (
    <div className="relative min-h-[calc(100dvh-4.5rem)] bg-[#090b09] text-white">
      {/* Dynamic ambient color background (quiet, not slop) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(30,215,96,0.06),transparent_70%)]"
      />

      <div className="mx-auto flex h-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        {/* Unified Top Header */}
        <header className="mb-4 flex items-center justify-between border-b border-white/[0.07] pb-3 sm:mb-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/home"
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-xs font-medium text-[#9ba39d] transition hover:bg-white/[0.07] hover:text-white"
              aria-label="Back to home"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back</span>
            </Link>

            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1ed760]">
                Now Playing
              </span>
              <p className="truncate text-xs text-[#9ba39d]">
                {current ? current.title : "Nothing playing"}
                {artist ? ` · ${artist.name}` : ""}
              </p>
            </div>
          </div>

          {/* Right Header Extras */}
          <div className="flex items-center gap-2">
            {/* Mobile View Mode Switcher (visible on < lg) */}
            <div className="flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMode("player")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  mobileMode === "player"
                    ? "bg-white/[0.12] text-white"
                    : "text-[#9ba39d] hover:text-white"
                }`}
              >
                Player
              </button>
              <button
                type="button"
                onClick={() => setMobileMode("lyrics")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  mobileMode === "lyrics"
                    ? "bg-[#1ed760] text-black font-semibold"
                    : "text-[#9ba39d] hover:text-white"
                }`}
              >
                Lyrics
              </button>
              <button
                type="button"
                onClick={() => setMobileMode("queue")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  mobileMode === "queue"
                    ? "bg-white/[0.12] text-white"
                    : "text-[#9ba39d] hover:text-white"
                }`}
              >
                Queue ({upcoming.length})
              </button>
            </div>

            <ConnectedDevices />

            {current && (
              <>
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  aria-label="Copy song link"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#9ba39d] transition hover:text-white"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="More options"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#9ba39d] transition hover:text-white"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-[#141814] border-white/[0.1] text-xs">
                    <DropdownMenuItem onSelect={() => openAddToPlaylist(current.id)}>
                      <Plus className="mr-2 h-3.5 w-3.5" /> Add to playlist
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={toggleQueue}>
                      <ListMusic className="mr-2 h-3.5 w-3.5" /> Full queue
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/[0.06]" />
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
                        <Disc3 className="mr-2 h-3.5 w-3.5" /> View album
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </header>

        {/* Content Section: Fully Responsive */}
        {current ? (
          <div className="grid flex-1 items-stretch gap-6 lg:grid-cols-[minmax(340px,440px)_1fr] lg:gap-8">
            {/* Left Column: Player Deck (Hidden on mobile if user switched to Lyrics/Queue mode) */}
            <div
              className={`flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#111412] p-6 shadow-xl ${
                mobileMode !== "player" ? "hidden lg:flex" : "flex"
              }`}
            >
              {/* Artwork Container */}
              <div className="flex flex-col items-center">
                <div className="relative aspect-square w-full max-w-[340px] overflow-hidden rounded-xl border border-white/[0.08] shadow-2xl bg-[#191d1a]">
                  <Artwork
                    key={current.id}
                    src={current.artwork}
                    alt={`${current.title} cover`}
                    priority
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Song Meta */}
                <div className="mt-5 flex w-full items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
                      {current.title}
                    </h1>
                    <Link
                      href={artist ? `/artist/${artist.id}` : "/explore"}
                      className="mt-0.5 block truncate text-sm font-medium text-[#9ba39d] transition hover:text-white hover:underline"
                    >
                      {artist?.name ?? "Unknown artist"}
                    </Link>
                    {album && (
                      <Link
                        href={`/album/${album.id}`}
                        className="mt-0.5 block truncate text-xs text-[#636c65] transition hover:text-[#9ba39d]"
                      >
                        {album.title}
                        {album.year ? ` · ${album.year}` : ""}
                      </Link>
                    )}
                  </div>
                  <LikeButton
                    trackId={current.id}
                    size="md"
                    className="h-10 w-10 shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] text-[#9ba39d] hover:text-white"
                  />
                </div>
              </div>

              {/* Player Controls Deck */}
              <div className="mt-6 space-y-4 pt-4 border-t border-white/[0.06]">
                <ProgressBar
                  className="w-full"
                  timeClassName="w-10 shrink-0 text-center font-mono text-[11px] text-[#636c65]"
                />

                <div className="flex items-center justify-center">
                  <PlaybackControls size="large" className="gap-4" />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="font-mono text-[10px] text-[#636c65] uppercase tracking-wider">
                    Lossless · 320 kbps
                  </span>
                  <div className="w-36">
                    <VolumeControl />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Context Panels (Lyrics, Queue, Related, Artist) */}
            <div
              className={`flex flex-col rounded-2xl border border-white/[0.08] bg-[#111412] p-5 shadow-xl min-h-[460px] ${
                mobileMode === "player" ? "hidden lg:flex" : "flex"
              }`}
            >
              {/* Desktop Segmented Tab Switcher */}
              <div className="hidden items-center justify-between border-b border-white/[0.06] pb-3 lg:flex">
                <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("lyrics")}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      activeTab === "lyrics"
                        ? "bg-[#1ed760] text-black"
                        : "text-[#9ba39d] hover:text-white"
                    }`}
                  >
                    <Mic2 className="h-3.5 w-3.5" />
                    <span>Lyrics</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("queue")}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      activeTab === "queue"
                        ? "bg-[#1ed760] text-black"
                        : "text-[#9ba39d] hover:text-white"
                    }`}
                  >
                    <ListMusic className="h-3.5 w-3.5" />
                    <span>Queue ({upcoming.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("related")}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      activeTab === "related"
                        ? "bg-[#1ed760] text-black"
                        : "text-[#9ba39d] hover:text-white"
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Related ({relatedTracks.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("artist")}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      activeTab === "artist"
                        ? "bg-[#1ed760] text-black"
                        : "text-[#9ba39d] hover:text-white"
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Artist</span>
                  </button>
                </div>

                <span className="font-mono text-[11px] text-[#636c65]">
                  {activeTab === "lyrics" && "Synced Karaoke"}
                  {activeTab === "queue" && `${upcoming.length + 1} tracks scheduled`}
                  {activeTab === "related" && "Discovery mix"}
                  {activeTab === "artist" && "Artist Bio"}
                </span>
              </div>

              {/* Viewport for Active Tab */}
              <div className="flex-1 min-h-0 pt-3">
                {/* 1. Lyrics Panel */}
                {(activeTab === "lyrics" || mobileMode === "lyrics") && (
                  <div className="h-full">
                    <LyricsView
                      trackTitle={current.title}
                      artistName={artist?.name}
                      videoId={current.youtubeId}
                      duration={current.duration}
                    />
                  </div>
                )}

                {/* 2. Queue Panel */}
                {(activeTab === "queue" || mobileMode === "queue") && (
                  <div className="flex h-full flex-col space-y-4 overflow-y-auto pr-2">
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#1ed760]">
                        Currently Playing
                      </p>
                      <QueueTrackRow track={current} active onClick={() => undefined} />
                    </div>

                    <div className="border-t border-white/[0.06] pt-3">
                      <div className="mb-2.5 flex items-center justify-between text-xs text-[#9ba39d]">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#636c65]">
                          Next in Session ({upcoming.length})
                        </span>
                        {upcoming.length > 0 && (
                          <span className="text-[11px] text-[#636c65]">Tap any track to play</span>
                        )}
                      </div>

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
                        <div className="py-12 text-center text-xs text-[#636c65]">
                          <p>You&apos;ve reached the end of the current queue.</p>
                          <Link
                            href="/explore"
                            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs font-semibold text-[#1ed760] transition hover:bg-white/[0.07]"
                          >
                            <Plus className="h-3 w-3" /> Find songs to add
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Related Tracks Panel */}
                {activeTab === "related" && mobileMode !== "lyrics" && mobileMode !== "queue" && (
                  <div className="space-y-2 overflow-y-auto pr-2">
                    <p className="mb-3 text-xs text-[#9ba39d]">
                      Tracks similar to &ldquo;{current.title}&rdquo; from the Sangeet catalog:
                    </p>
                    {relatedTracks.length > 0 ? (
                      relatedTracks.map((track) => (
                        <QueueTrackRow
                          key={track.id}
                          track={track}
                          onClick={() =>
                            playTrack(
                              track.id,
                              relatedTracks.map((t) => t.id),
                              `Related to ${current.title}`,
                            )
                          }
                        />
                      ))
                    ) : (
                      <p className="py-12 text-center text-xs text-[#636c65]">
                        No related tracks found for this title.
                      </p>
                    )}
                  </div>
                )}

                {/* 4. Artist Panel */}
                {activeTab === "artist" && mobileMode !== "lyrics" && mobileMode !== "queue" && (
                  <div>
                    {artist ? (
                      <div className="space-y-5">
                        <div className="flex items-center gap-4">
                          <Artwork
                            src={artist.image}
                            alt={artist.name}
                            className="h-20 w-20 shrink-0 rounded-full border border-white/[0.1] object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1ed760]">
                              Artist
                            </span>
                            <Link
                              href={`/artist/${artist.id}`}
                              className="mt-0.5 block truncate font-display text-xl font-bold text-white hover:underline"
                            >
                              {artist.name}
                            </Link>
                            <p className="mt-1 text-xs text-[#9ba39d]">
                              {artist.location || "South Asian Independent Music"}
                            </p>
                          </div>
                        </div>

                        <p className="text-xs leading-relaxed text-[#9ba39d] whitespace-pre-line">
                          {artist.bio || artist.shortBio || "No bio available for this artist."}
                        </p>

                        <div className="pt-2">
                          <Link
                            href={`/artist/${artist.id}`}
                            className="inline-flex h-9 items-center justify-center rounded-lg bg-[#1ed760] px-4 text-xs font-semibold text-black transition hover:brightness-105"
                          >
                            Explore discography & albums
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-xs text-[#636c65]">
                        Artist details unavailable.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
            <Disc3 className="h-12 w-12 text-[#636c65] animate-spin" />
            <h2 className="mt-4 text-lg font-semibold text-white">No track is playing</h2>
            <p className="mt-1 text-xs text-[#9ba39d]">
              Choose any song from Home, Search, or Explore to start your session.
            </p>
            <Link
              href="/home"
              className="mt-5 rounded-lg bg-[#1ed760] px-5 py-2 text-xs font-semibold text-black transition hover:brightness-105"
            >
              Browse music
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
