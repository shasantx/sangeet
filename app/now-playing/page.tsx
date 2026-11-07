"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
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
import { getAlbum, getArtist, getTrack, tracks } from "@/lib/catalog";
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
      className={`group flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
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

  // Desktop active tab: lyrics | queue | related | artist
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
    <div className="h-dvh max-h-dvh w-full overflow-hidden flex flex-col bg-[#090b09] text-white select-none">
      {/* Background ambient lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(30,215,96,0.06),transparent_70%)]"
      />

      {/* Top Header - Responsive for Mobile & Desktop */}
      <header className="h-14 sm:h-16 shrink-0 border-b border-white/[0.08] bg-[#090b09]/95 px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2">
        {/* Left Side: Back action */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href="/home"
            className="flex h-9 w-9 sm:w-auto shrink-0 items-center justify-center sm:justify-start gap-1.5 rounded-full sm:rounded-lg border border-white/[0.08] bg-white/[0.03] sm:px-3 text-xs font-medium text-[#9ba39d] transition hover:bg-white/[0.07] hover:text-white"
            aria-label="Back to home"
          >
            <ChevronDown className="h-4 w-4 sm:hidden" />
            <ArrowLeft className="hidden sm:inline h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back</span>
          </Link>

          <div className="hidden sm:block min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1ed760]">
              Now Playing
            </span>
            <p className="truncate text-xs text-[#9ba39d]">
              {current ? `${current.title} · ${artist?.name ?? "Sangeet"}` : "Nothing playing"}
            </p>
          </div>
        </div>

        {/* Center: Mobile 3-Way Mode Switcher (visible on < lg) */}
        <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMode("player")}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
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
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
              mobileMode === "lyrics"
                ? "bg-[#1ed760] text-black"
                : "text-[#9ba39d] hover:text-white"
            }`}
          >
            Lyrics
          </button>
          <button
            type="button"
            onClick={() => setMobileMode("queue")}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
              mobileMode === "queue"
                ? "bg-white/[0.12] text-white"
                : "text-[#9ba39d] hover:text-white"
            }`}
          >
            Queue
          </button>
        </div>

        {/* Right Header Extras */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <ConnectedDevices />

          {current && (
            <>
              <button
                type="button"
                onClick={() => void copyLink()}
                aria-label="Copy song link"
                className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#9ba39d] transition hover:text-white"
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
                  <DropdownMenuItem onSelect={() => void copyLink()}>
                    <Share2 className="mr-2 h-3.5 w-3.5" /> Share song
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

      {/* Main Content Area - Strictly Viewport Height Constrained */}
      <main className="flex-1 min-h-0 overflow-hidden p-2.5 sm:p-5 lg:p-6">
        {current ? (
          <div className="h-full grid items-stretch gap-4 sm:gap-5 lg:grid-cols-[minmax(320px,390px)_1fr] overflow-hidden">
            {/* Left Column: Player Deck (Never scrolls away!) */}
            <div
              className={`h-full flex flex-col justify-between rounded-2xl sm:rounded-3xl border border-white/[0.08] bg-[#111412] p-4 sm:p-5 shadow-2xl overflow-hidden ${
                mobileMode !== "player" ? "hidden lg:flex" : "flex"
              }`}
            >
              {/* Artwork Box */}
              <div className="flex flex-col items-center">
                <div className="relative aspect-square w-full max-w-[240px] sm:max-w-[310px] max-h-[32vh] sm:max-h-[38vh] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#161a17] shadow-2xl shrink-0">
                  <Artwork
                    key={current.id}
                    src={current.artwork}
                    alt={`${current.title} cover`}
                    priority
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Song Meta */}
                <div className="mt-3 sm:mt-4 flex w-full items-start justify-between gap-3 shrink-0">
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate font-display text-base font-bold tracking-tight text-white sm:text-xl">
                      {current.title}
                    </h1>
                    <Link
                      href={artist ? `/artist/${artist.id}` : "/explore"}
                      className="mt-0.5 block truncate text-xs font-medium text-[#9ba39d] transition hover:text-white hover:underline"
                    >
                      {artist?.name ?? "Unknown artist"}
                    </Link>
                    {album && (
                      <p className="mt-0.5 truncate text-[11px] text-[#636c65]">
                        {album.title}
                        {album.year ? ` · ${album.year}` : ""}
                      </p>
                    )}
                  </div>
                  <LikeButton
                    trackId={current.id}
                    size="sm"
                    className="h-9 w-9 shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] text-[#9ba39d] hover:text-white"
                  />
                </div>
              </div>

              {/* Mobile Lyrics Teaser / Drawer Peek */}
              <button
                type="button"
                onClick={() => setMobileMode("lyrics")}
                className="my-1 flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 text-left text-xs transition hover:bg-white/[0.06] lg:hidden"
              >
                <div className="flex items-center gap-2 text-[#1ed760]">
                  <Mic2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-semibold text-white">View Synced Lyrics</span>
                </div>
                <span className="text-[11px] text-[#9ba39d]">Tap to open →</span>
              </button>

              {/* Controls Deck */}
              <div className="mt-2 sm:mt-3 space-y-2.5 sm:space-y-3 pt-2.5 sm:pt-3 border-t border-white/[0.06] shrink-0">
                <ProgressBar
                  className="w-full"
                  timeClassName="w-9 shrink-0 text-center font-mono text-[10px] text-[#636c65]"
                />

                <div className="flex items-center justify-center">
                  <PlaybackControls size="large" className="gap-3 sm:gap-4" />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="font-mono text-[9px] text-[#636c65] uppercase tracking-wider">
                    Lossless · 320 kbps
                  </span>
                  <div className="hidden sm:block w-32">
                    <VolumeControl />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Context Panels (Lyrics, Queue, Related, Artist) */}
            <div
              className={`h-full flex flex-col rounded-2xl sm:rounded-3xl border border-white/[0.08] bg-[#111412] p-3 sm:p-5 shadow-2xl overflow-hidden ${
                mobileMode === "player" ? "hidden lg:flex" : "flex"
              }`}
            >
              {/* Desktop Segmented Tab Switcher */}
              <div className="hidden shrink-0 items-center justify-between border-b border-white/[0.06] pb-3 lg:flex">
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

                <span className="font-mono text-[10px] text-[#636c65]">
                  {activeTab === "lyrics" && "Synced Karaoke"}
                  {activeTab === "queue" && `${upcoming.length + 1} tracks scheduled`}
                  {activeTab === "related" && "Discovery mix"}
                  {activeTab === "artist" && "Artist Bio"}
                </span>
              </div>

              {/* Viewport for Active Tab - Internally Scrollable Only */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col pt-2 sm:pt-3">
                {/* 1. Lyrics Panel */}
                {(activeTab === "lyrics" || mobileMode === "lyrics") && (
                  <div className="h-full flex-1 min-h-0 overflow-hidden flex flex-col">
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
                  <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-4">
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
                          <span className="text-[10px] text-[#636c65]">Click any track to play</span>
                        )}
                      </div>

                      {upcoming.length > 0 ? (
                        <div className="space-y-1">
                          {upcoming.map((track, idx) => (
                            <QueueTrackRow
                              key={`${track.id}-${idx}`}
                              track={track}
                              onClick={() => {
                                playQueueIndex(queueIndex + 1 + idx);
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-xs text-[#9ba39d]">
                          <Music2 className="mx-auto mb-2 h-6 w-6 text-[#636c65]" />
                          <p className="font-semibold text-white">Queue is empty</p>
                          <p className="mt-1 text-[11px] text-[#636c65]">
                            Pick songs from Search or Explore to schedule them next.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Related Panel */}
                {activeTab === "related" && mobileMode !== "lyrics" && mobileMode !== "queue" && (
                  <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-2">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#1ed760]">
                      Recommended Based On Current Track
                    </p>
                    {relatedTracks.map((track) => (
                      <QueueTrackRow
                        key={track.id}
                        track={track}
                        onClick={() => playTrack(track.id, [track.id], "Related tracks")}
                      />
                    ))}
                  </div>
                )}

                {/* 4. Artist Panel */}
                {activeTab === "artist" && mobileMode !== "lyrics" && mobileMode !== "queue" && (
                  <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                    {artist ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <Artwork
                            src={artist.image}
                            alt=""
                            className="h-16 w-16 rounded-full object-cover shadow-lg"
                          />
                          <div>
                            <h3 className="font-display text-lg font-bold text-white">{artist.name}</h3>
                            <p className="text-xs text-[#9ba39d]">
                              {artist.location || "Regional Artist"}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                const next = toggleFollow(artist.id);
                                toast.show(
                                  next ? "Following" : "Unfollowed",
                                  artist.name,
                                  next ? "success" : "default",
                                );
                              }}
                              className={`mt-2 rounded-full px-3 py-1 text-xs font-semibold transition ${
                                followed
                                  ? "border border-white/20 text-white"
                                  : "bg-[#1ed760] text-black hover:bg-[#1db954]"
                              }`}
                            >
                              {followed ? "Following" : "Follow"}
                            </button>
                          </div>
                        </div>

                        <p className="text-xs leading-relaxed text-[#9ba39d]">{artist.bio}</p>

                        <div>
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#1ed760]">
                            Top Tracks
                          </p>
                          <div className="space-y-1">
                            {tracks
                              .filter((t) => t.artistId === artist.id)
                              .slice(0, 5)
                              .map((track) => (
                                <QueueTrackRow
                                  key={track.id}
                                  track={track}
                                  onClick={() => playTrack(track.id, [track.id], artist.name)}
                                />
                              ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-[#9ba39d]">No artist information available.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <Music2 className="h-12 w-12 text-[#636c65]" />
            <h2 className="mt-4 font-display text-lg font-bold text-white">No track is playing</h2>
            <p className="mt-1 text-xs text-[#9ba39d]">
              Choose any song from Home, Explore, or Search to start listening.
            </p>
            <Link
              href="/home"
              className="mt-4 rounded-full bg-[#1ed760] px-5 py-2 text-xs font-bold text-black hover:bg-[#1db954]"
            >
              Go to Home
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
