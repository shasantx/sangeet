"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Clock3,
  CloudDownload,
  Disc3,
  FileDown,
  Heart,
  ListMusic,
  Monitor,
  Pause,
  Play,
  Plus,
  Search,
  Shuffle,
  Smartphone,
  Trash2,
  UserRound,
} from "lucide-react";
import { albums, artists, getTrack } from "@/lib/catalog";
import { restoreAudiusTrack, restoreYouTubeTrack } from "@/lib/dynamic-tracks";
import {
  exportTrackAudioFile,
  isNativeOfflineSupported,
  listOfflineTracks,
  removeOfflineTrack,
  subscribeOfflineChanges,
} from "@/lib/offline-audio";
import type { Track } from "@/lib/types";
import { cn, formatDuration, pluralize } from "@/lib/utils";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { toast, useUIStore } from "@/store/ui-store";
import { isAndroidNativeApp } from "@/lib/android-bridge";
import { AlbumCard } from "@/components/music/album-card";
import { ArtistCard } from "@/components/music/artist-card";
import { Artwork } from "@/components/music/artwork";
import { EmptyState } from "@/components/music/empty-state";
import { Equalizer } from "@/components/music/equalizer";
import { PlaylistCard } from "@/components/music/playlist-card";
import { SectionHeader } from "@/components/music/section-header";
import { LocalFilesSection } from "@/components/library/local-files-section";
import { Input } from "@/components/ui/input";

type Filter = "all" | "playlists" | "albums" | "artists" | "local" | "offline";

interface OfflineEntry {
  track: Track;
  artistName: string;
  sizeBytes: number;
  savedAt: number;
}

function formatMb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0.0 MB";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ensureRegisteredTrack(entry: OfflineEntry): Track {
  const existing = getTrack(entry.track.id);
  if (existing) return existing;
  if (entry.track.youtubeId) {
    return (
      restoreYouTubeTrack({
        videoId: entry.track.youtubeId,
        title: entry.track.title,
        artist: entry.artistName,
        durationSeconds: entry.track.duration,
        thumbnail: entry.track.artwork,
      }) ?? entry.track
    );
  }
  if (entry.track.source === "audius") {
    return (
      restoreAudiusTrack({
        id: entry.track.id.replace(/^aud-/, ""),
        title: entry.track.title,
        artist: entry.artistName,
        durationSeconds: entry.track.duration,
        artwork: entry.track.artwork,
        audioUrl: entry.track.audioUrl,
      }) ?? entry.track
    );
  }
  return entry.track;
}

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-full min-w-0 overflow-x-clip">
          <div className="page-container min-w-0" />
        </div>
      }
    >
      <LibraryContent />
    </Suspense>
  );
}

function LibraryContent() {
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const initialTab: Filter =
    rawTab === "local" ||
    rawTab === "offline" ||
    rawTab === "playlists" ||
    rawTab === "albums" ||
    rawTab === "artists"
      ? rawTab
      : "all";
  const [filter, setFilter] = useState<Filter>(initialTab);
  const [query, setQuery] = useState("");
  const [localCount, setLocalCount] = useState(0);
  const [nativeOffline, setNativeOffline] = useState(false);
  const [offlineItems, setOfflineItems] = useState<OfflineEntry[]>([]);

  useEffect(() => {
    setNativeOffline(isNativeOfflineSupported());
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (
      tab === "local" ||
      tab === "offline" ||
      tab === "playlists" ||
      tab === "albums" ||
      tab === "artists" ||
      tab === "all"
    ) {
      setFilter(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!nativeOffline) {
      setOfflineItems([]);
      return;
    }
    let active = true;
    const loadOffline = () => {
      void listOfflineTracks()
        .then((items) => {
          if (active) setOfflineItems(items);
        })
        .catch(() => {
          if (active) setOfflineItems([]);
        });
    };
    loadOffline();
    const unsubscribe = subscribeOfflineChanges(loadOffline);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [nativeOffline]);

  const likedTrackIds = useLibraryStore((state) => state.likedTrackIds);
  const savedAlbumIds = useLibraryStore((state) => state.savedAlbumIds);
  const followedArtistIds = useLibraryStore((state) => state.followedArtistIds);
  const userPlaylists = useLibraryStore((state) => state.playlists);
  const recentlyPlayed = useLibraryStore((state) => state.recentlyPlayed);
  const openCreate = useUIStore((state) => state.openCreatePlaylist);

  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const playShuffled = usePlayerStore((state) => state.playShuffled);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const savedAlbums = useMemo(
    () =>
      savedAlbumIds
        .map((albumId) => albums.find((album) => album.id === albumId))
        .filter((album): album is NonNullable<typeof album> => Boolean(album)),
    [savedAlbumIds],
  );

  const followedArtists = useMemo(
    () =>
      followedArtistIds
        .map((artistId) => artists.find((artist) => artist.id === artistId))
        .filter((artist): artist is NonNullable<typeof artist> => Boolean(artist)),
    [followedArtistIds],
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredPlaylists = useMemo(
    () =>
      userPlaylists.filter((playlist) =>
        playlist.title.toLowerCase().includes(normalizedQuery),
      ),
    [normalizedQuery, userPlaylists],
  );
  const filteredAlbums = useMemo(
    () =>
      savedAlbums.filter((album) => album.title.toLowerCase().includes(normalizedQuery)),
    [normalizedQuery, savedAlbums],
  );
  const filteredArtists = useMemo(
    () =>
      followedArtists.filter((artist) => artist.name.toLowerCase().includes(normalizedQuery)),
    [normalizedQuery, followedArtists],
  );
  const filteredOffline = useMemo(
    () =>
      offlineItems.filter(
        (item) =>
          item.track.title.toLowerCase().includes(normalizedQuery) ||
          item.artistName.toLowerCase().includes(normalizedQuery),
      ),
    [normalizedQuery, offlineItems],
  );

  const totalOfflineBytes = useMemo(
    () => offlineItems.reduce((sum, item) => sum + (item.sizeBytes || 0), 0),
    [offlineItems],
  );

  const offlineTrackIds = useMemo(
    () => filteredOffline.map((item) => item.track.id),
    [filteredOffline],
  );
  const isOfflineCollectionActive = Boolean(
    currentTrackId && offlineTrackIds.includes(currentTrackId),
  );

  const playOfflineEntry = useCallback(
    (entry: OfflineEntry) => {
      const registeredAll = filteredOffline.map(ensureRegisteredTrack);
      const ids = registeredAll.map((t) => t.id);
      if (currentTrackId === entry.track.id) {
        togglePlay();
      } else {
        playTrack(entry.track.id, ids, "Offline Downloads");
      }
    },
    [filteredOffline, currentTrackId, togglePlay, playTrack],
  );

  const handleRemoveOffline = useCallback(async (entry: OfflineEntry) => {
    try {
      await removeOfflineTrack(entry.track);
      toast.success("Removed offline copy", entry.track.title);
    } catch {
      toast.error("Could not remove offline track", entry.track.title);
    }
  }, []);

  const handleExportOffline = useCallback(async (entry: OfflineEntry) => {
    try {
      await exportTrackAudioFile(entry.track, entry.artistName);
      toast.success(
        isAndroidNativeApp() ? "Download started" : "Exported audio file",
        isAndroidNativeApp() ? entry.track.title : `${entry.track.title} saved to Downloads.`,
      );
    } catch (error) {
      toast.error(
        "Export failed",
        error instanceof Error ? error.message : "Could not export audio file.",
      );
    }
  }, []);

  const activeFilter: Filter = !nativeOffline && filter === "offline" ? "all" : filter;
  const showPlaylists = activeFilter === "all" || activeFilter === "playlists";
  const showAlbums = activeFilter === "all" || activeFilter === "albums";
  const showArtists = activeFilter === "all" || activeFilter === "artists";
  const showLocal = activeFilter === "all" || activeFilter === "local";
  const showOffline =
    nativeOffline &&
    (activeFilter === "offline" || (activeFilter === "all" && offlineItems.length > 0));

  const filters: { id: Filter; label: string; count: number }[] = [
    {
      id: "all",
      label: "All",
      count:
        userPlaylists.length +
        savedAlbums.length +
        followedArtists.length +
        localCount +
        (nativeOffline ? offlineItems.length : 0),
    },
    ...(nativeOffline
      ? [{ id: "offline" as const, label: "Offline", count: offlineItems.length }]
      : []),
    { id: "playlists", label: "Playlists", count: userPlaylists.length },
    { id: "albums", label: "Albums", count: savedAlbums.length },
    { id: "artists", label: "Artists", count: followedArtists.length },
    { id: "local", label: "Local music", count: localCount },
  ];

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-clip">
      <div className="page-container min-w-0">
        <div className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl min-w-0">
            <p className="eyebrow mb-3">On this device &amp; saved</p>
            <h1 className="text-[38px] font-medium leading-none tracking-[-0.05em] sm:text-[52px]">
              Your library
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Everything you have kept close: albums, playlists, artists, offline downloads and scanned local music.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openCreate()}
            className="inline-flex h-11 w-fit shrink-0 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[0_12px_30px_-14px_hsl(var(--primary)/0.45)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Plus className="h-4 w-4 shrink-0" />
            New playlist
          </button>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 sm:gap-3.5">
          <Link
            href="/liked"
            className="group flex min-w-0 items-center gap-3.5 rounded-2xl border border-white/[.08] bg-card p-3.5 transition duration-200 hover:border-primary/35 hover:bg-elevated active:scale-[0.985] sm:p-4"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-primary to-fuchsia-500 text-white shadow-[0_8px_20px_-6px_hsl(var(--primary)/0.55)]">
              <Heart className="h-4.5 w-4.5 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-base font-medium tracking-[-0.02em] text-foreground sm:text-lg">
                Liked Songs
              </h2>
              <p className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
                {pluralize(likedTrackIds.length, "song")}
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/45 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
          </Link>

          <Link
            href="/recently-played"
            className="group flex min-w-0 items-center gap-3.5 rounded-2xl border border-white/[.08] bg-card p-3.5 transition duration-200 hover:border-sky-400/35 hover:bg-elevated active:scale-[0.985] sm:p-4"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 text-white shadow-[0_8px_20px_-6px_rgba(59,130,246,0.5)]">
              <Clock3 className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-base font-medium tracking-[-0.02em] text-foreground sm:text-lg">
                Recently Played
              </h2>
              <p className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
                {pluralize(recentlyPlayed.length, "track")}
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/45 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
          </Link>
        </div>

        <div className="mt-10 flex min-w-0 flex-col gap-4 border-b border-white/[.06] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div
            data-no-tab-swipe="true"
            className="hide-scrollbar flex min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5"
          >
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                aria-pressed={activeFilter === item.id}
                className={
                  activeFilter === item.id
                    ? "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-3.5 py-1.5 text-[11.5px] font-semibold text-primary-foreground"
                    : "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-white/[.08] bg-card px-3.5 py-1.5 text-[11.5px] font-medium text-muted-foreground transition hover:bg-elevated hover:text-foreground"
                }
              >
                {item.label}
                <span
                  className={cn(
                    "text-[9px] tabular-nums",
                    activeFilter === item.id
                      ? "text-primary-foreground/75"
                      : "text-muted-foreground/60",
                  )}
                >
                  {item.count}
                </span>
              </button>
            ))}
          </div>
          <div className="relative w-full min-w-0 sm:max-w-[280px] lg:shrink-0">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter your library…"
              className="h-9 rounded-full pl-9 text-xs"
              aria-label="Filter your library"
            />
          </div>
        </div>

        {showOffline && (
          <section className="mt-9 min-w-0" aria-label="Offline downloads">
            <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-6">
              <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/15 text-primary">
                    <CloudDownload className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow mb-1">Saved for offline</p>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="font-display text-xl font-medium tracking-[-0.03em] sm:text-2xl">
                        Offline Downloads
                      </h2>
                      <span className="inline-flex items-center rounded-full border border-border bg-elevated px-2.5 py-0.5 font-sans text-[11px] font-medium tabular-nums text-muted-foreground">
                        {pluralize(offlineItems.length, "track")}
                      </span>
                    </div>
                    <p className="mt-1 font-sans text-xs text-muted-foreground">
                      {offlineItems.length > 0
                        ? `${formatMb(totalOfflineBytes)} cached on this device`
                        : "Download any track from the menu or track row to listen without an internet connection."}
                    </p>
                  </div>
                </div>

                {offlineItems.length > 0 && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={offlineTrackIds.length === 0}
                      onClick={() => {
                        if (isOfflineCollectionActive) {
                          togglePlay();
                        } else if (filteredOffline[0]) {
                          playOfflineEntry(filteredOffline[0]);
                        }
                      }}
                      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-primary px-5 font-sans text-xs font-semibold text-primary-foreground transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
                    >
                      {isOfflineCollectionActive && isPlaying ? (
                        <Pause className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
                      ) : (
                        <Play className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
                      )}
                      Play all
                    </button>
                    <button
                      type="button"
                      disabled={offlineTrackIds.length === 0}
                      onClick={() => {
                        const registered = filteredOffline.map(ensureRegisteredTrack);
                        playShuffled(
                          registered.map((t) => t.id),
                          "Offline Downloads",
                        );
                      }}
                      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-elevated px-4 font-sans text-xs font-medium text-foreground transition hover:border-foreground/20 disabled:opacity-40"
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      Shuffle
                    </button>
                  </div>
                )}
              </div>

              {filteredOffline.length === 0 ? (
                <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background/40 px-4 py-10 text-center">
                  <CloudDownload className="mb-3 h-7 w-7 text-muted-foreground/60" />
                  <p className="font-sans text-sm font-medium text-foreground">
                    {offlineItems.length > 0 && normalizedQuery
                      ? "No offline tracks match your filter"
                      : "No offline downloads yet"}
                  </p>
                  <p className="mt-1 max-w-md font-sans text-xs text-muted-foreground">
                    {offlineItems.length > 0 && normalizedQuery
                      ? "Try clearing the filter to see all offline downloads."
                      : "Tap the download button on any track to save it for offline listening."}
                  </p>
                </div>
              ) : (
                <div className="mt-5 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
                  {filteredOffline.map((entry, index) => {
                    const isCurrent = currentTrackId === entry.track.id;
                    return (
                      <div
                        key={entry.track.id}
                        className={cn(
                          "group flex min-w-0 items-center gap-2 px-2.5 py-2.5 transition hover:bg-white/[0.04] sm:gap-3 sm:px-4",
                          isCurrent && "bg-primary/[0.08]",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => playOfflineEntry(entry)}
                          aria-label={`${isCurrent && isPlaying ? "Pause" : "Play"} ${entry.track.title}`}
                          className="flex h-8 w-6 shrink-0 items-center justify-center rounded-full font-sans text-xs text-muted-foreground transition hover:text-foreground sm:w-7"
                        >
                          {isCurrent && isPlaying ? (
                            <Equalizer playing className="text-primary" />
                          ) : isCurrent ? (
                            <Play className="h-3.5 w-3.5 fill-current text-primary" />
                          ) : (
                            <>
                              <span className="font-sans text-xs font-medium tabular-nums group-hover:hidden">
                                {index + 1}
                              </span>
                              <Play className="hidden h-3.5 w-3.5 fill-current text-foreground group-hover:block" />
                            </>
                          )}
                        </button>

                        <Artwork
                          src={entry.track.artwork}
                          alt=""
                          res="sm"
                          className="h-10 w-10 shrink-0 rounded-lg"
                        />

                        <button
                          type="button"
                          onClick={() => playOfflineEntry(entry)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p
                            className={cn(
                              "truncate font-sans text-sm font-medium",
                              isCurrent ? "text-primary" : "text-foreground",
                            )}
                          >
                            {entry.track.title}
                          </p>
                          <p className="mt-0.5 truncate font-sans text-xs text-muted-foreground">
                            {entry.artistName}
                            {entry.sizeBytes > 0 ? ` · ${formatMb(entry.sizeBytes)}` : ""}
                          </p>
                        </button>

                        {entry.track.duration > 0 && (
                          <span className="hidden shrink-0 font-sans text-xs tabular-nums text-muted-foreground sm:block">
                            {formatDuration(entry.track.duration)}
                          </span>
                        )}

                        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                          <button
                            type="button"
                            onClick={() => void handleExportOffline(entry)}
                            aria-label={`Export ${entry.track.title}`}
                            title="Export audio file"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/65 opacity-100 transition hover:bg-white/[.08] hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleRemoveOffline(entry)}
                            aria-label={`Remove ${entry.track.title} from offline`}
                            title="Remove offline copy"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/65 opacity-100 transition hover:bg-white/[.08] hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {showLocal && (
          <div className="min-w-0">
            <LocalFilesSection
              searchQuery={query}
              onCountChange={setLocalCount}
              className="mt-8 sm:mt-9"
            />
          </div>
        )}

        {showPlaylists && (
          <section className="section-space min-w-0">
            <SectionHeader
              title="Your playlists"
              eyebrow="Made by you"
              action={
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create
                </button>
              }
            />
            {filteredPlaylists.length === 0 ? (
              <EmptyState
                compact
                icon={<ListMusic className="h-5 w-5" />}
                title={query ? "No playlists match" : "No playlists yet"}
                description={
                  query
                    ? "Try a different name, or clear the filter to see everything."
                    : "Build a private sequence from the songs you love. Playlists are saved in this browser."
                }
                action={
                  <button
                    type="button"
                    onClick={() => openCreate()}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground transition hover:bg-secondary"
                  >
                    <Plus className="h-4 w-4" />
                    Create playlist
                  </button>
                }
              />
            ) : (
              <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-y-8 lg:grid-cols-4 xl:grid-cols-5">
                {filteredPlaylists.map((playlist) => (
                  <PlaylistCard key={playlist.id} playlist={playlist} />
                ))}
              </div>
            )}
          </section>
        )}

        {showAlbums && (
          <section className="section-space min-w-0">
            <SectionHeader
              title="Saved albums"
              eyebrow="On the shelf"
              action={
                <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums sm:flex">
                  <Disc3 className="h-3.5 w-3.5" />
                  {savedAlbums.length}
                </span>
              }
            />
            {filteredAlbums.length === 0 ? (
              <EmptyState
                compact
                icon={<Disc3 className="h-5 w-5" />}
                title={query ? "No albums match" : "No saved albums yet"}
                description={
                  query
                    ? "Try a different title, or clear the filter to see everything."
                    : "Save an album from anywhere in Sangeet and it will live here."
                }
                action={
                  <Link
                    href="/explore"
                    className="rounded-full border border-white/[.1] px-5 py-2.5 text-xs font-medium transition hover:border-white/20 hover:bg-white/[.04]"
                  >
                    Explore albums
                  </Link>
                }
              />
            ) : (
              <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-y-8 lg:grid-cols-4 xl:grid-cols-5">
                {filteredAlbums.map((album) => (
                  <AlbumCard key={album.id} album={album} />
                ))}
              </div>
            )}
          </section>
        )}

        {showArtists && (
          <section className="section-space min-w-0">
            <SectionHeader
              title="Followed artists"
              eyebrow="In your orbit"
              action={
                <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums sm:flex">
                  <UserRound className="h-3.5 w-3.5" />
                  {followedArtists.length}
                </span>
              }
            />
            {filteredArtists.length === 0 ? (
              <EmptyState
                compact
                icon={<UserRound className="h-5 w-5" />}
                title={query ? "No artists match" : "No followed artists yet"}
                description={
                  query
                    ? "Try a different name, or clear the filter to see everything."
                    : "Follow an artist to keep their new records close."
                }
                action={
                  <Link
                    href="/explore"
                    className="rounded-full border border-white/[.1] px-5 py-2.5 text-xs font-medium transition hover:border-white/20 hover:bg-white/[.04]"
                  >
                    Find artists
                  </Link>
                }
              />
            ) : (
              <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-4 xl:grid-cols-6">
                {filteredArtists.map((artist) => (
                  <ArtistCard key={artist.id} artist={artist} />
                ))}
              </div>
            )}
          </section>
        )}

        {!nativeOffline && (
          <section className="section-space min-w-0 pb-2" aria-label="Offline listening in Sangeet apps">
            <div className="relative overflow-hidden rounded-2xl border border-white/[.08] bg-card p-4 sm:p-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.1),transparent_55%)]" />
              <div className="relative flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/15 text-primary">
                    <CloudDownload className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow mb-1">Native App Exclusive</p>
                    <h2 className="font-display text-xl font-medium tracking-[-0.03em] sm:text-2xl">
                      Offline Listening in Sangeet Apps
                    </h2>
                    <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
                      Offline track downloads are exclusive to the Sangeet Android APK and Windows .exe desktop app. Install the native app directly from this website to save songs for offline playback.
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <a
                    href="/api/download/windows"
                    download="Sangeet.exe"
                    className="inline-flex min-h-[42px] max-w-full shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-[0_12px_28px_-14px_hsl(var(--primary)/0.6)] transition hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] sm:px-5"
                  >
                    <Monitor className="h-4 w-4 shrink-0" />
                    <span>Windows .exe</span>
                  </a>
                  <a
                    href="/api/download/android"
                    download="sangeet-android.apk"
                    className="inline-flex min-h-[42px] max-w-full shrink-0 items-center gap-2 rounded-full border border-white/[.08] bg-elevated px-4 py-2.5 text-xs font-semibold text-foreground transition hover:border-white/[.18] hover:bg-elevated/80 sm:px-5"
                  >
                    <Smartphone className="h-4 w-4 shrink-0" />
                    <span>Android APK</span>
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
