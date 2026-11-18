"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  Disc3,
  Download,
  Flame,
  FolderOpen,
  HardDrive,
  Heart,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Settings2,
  Shuffle,
  Trash2,
  TrendingUp,
  WifiOff,
  X,
} from "lucide-react";
import { getArtist, getTrack, tracks } from "@/lib/catalog";
import { buildPersonalizedFeed } from "@/lib/recommendations";
import {
  registerAudiusSearchResult,
  registerYouTubeSearchResult,
} from "@/lib/dynamic-tracks";
import {
  isNativeOfflineSupported,
  listOfflineTracks,
  removeOfflineTrack,
  subscribeOfflineChanges,
} from "@/lib/offline-audio";
import { isAndroidNativeApp } from "@/lib/android-bridge";
import type { Track } from "@/lib/types";
import { cn, formatDuration, getFirstName, getGreeting } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useAppStore } from "@/store/app-store";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { toast, useUIStore } from "@/store/ui-store";
import { AlbumCard } from "@/components/music/album-card";
import { ArtistCard } from "@/components/music/artist-card";
import { Artwork } from "@/components/music/artwork";
import { Equalizer } from "@/components/music/equalizer";
import { LikeButton } from "@/components/music/like-button";
import { PlaylistCard } from "@/components/music/playlist-card";
import { QuickTrackTile } from "@/components/music/quick-track-tile";
import { SectionHeader } from "@/components/music/section-header";
import { TrackContextMenu } from "@/components/music/track-context-menu";
import { LocalFilesSection } from "@/components/library/local-files-section";
import { InstallPromptBanner } from "@/components/site/install-prompt-banner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type HomeFilter = "all" | "music" | "trending" | "offline";

interface TrendingApiItem {
  id: string;
  videoId?: string;
  title: string;
  artist: string;
  album?: string;
  durationSeconds: number;
  thumbnail: string;
  views?: string;
  genre?: string;
  source: "youtube" | "audius" | "catalog";
  audioUrl?: string;
}

interface TrendingCacheEntry {
  at: number;
  tracks: Track[];
  viewsById: Record<string, string>;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
let trendingCache: TrendingCacheEntry | null = null;
const tasteSearchCache = new Map<string, { at: number; tracks: Track[] }>();
const ytFeedCache = new Map<
  string,
  {
    at: number;
    connected: boolean;
    suggested: Track[];
    liked: Track[];
    seeds: string[];
  }
>();

const TUNE_DISMISS_KEY = "sangeet-tune-feed-dismissed-v1";

const STARTER_TASTE_ARTISTS = [
  { id: "arijit-singh", label: "Arijit Singh" },
  { id: "the-weeknd", label: "The Weeknd" },
  { id: "sajjan-raj-vaidya", label: "Sajjan Raj Vaidya" },
  { id: "taylor-swift", label: "Taylor Swift" },
  { id: "billie-eilish", label: "Billie Eilish" },
  { id: "diljit-dosanjh", label: "Diljit Dosanjh" },
  { id: "coldplay", label: "Coldplay" },
  { id: "bipul-chettri", label: "Bipul Chettri" },
  { id: "shreya-ghoshal", label: "Shreya Ghoshal" },
  { id: "ar-rahman", label: "A.R. Rahman" },
];

const BASE_FILTERS: Array<{ id: HomeFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "music", label: "Music" },
  { id: "trending", label: "Trending" },
];

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function registerTrendingItem(item: TrendingApiItem): Track | undefined {
  try {
    if (item.source === "youtube" && item.videoId) {
      return registerYouTubeSearchResult({
        videoId: item.videoId,
        title: item.title,
        artist: item.artist,
        album: item.album,
        durationSeconds: item.durationSeconds,
        thumbnail: item.thumbnail,
        views: item.views,
      });
    }
    if (item.source === "audius") {
      return registerAudiusSearchResult({
        id: item.id.replace(/^aud-/, ""),
        title: item.title,
        artist: item.artist,
        album: item.album,
        durationSeconds: item.durationSeconds,
        artwork: item.thumbnail,
        genre: item.genre,
        audioUrl: item.audioUrl,
      });
    }
    const existing = getTrack(item.id);
    if (existing) return existing;
    if (item.videoId) {
      return registerYouTubeSearchResult({
        videoId: item.videoId,
        title: item.title,
        artist: item.artist,
        album: item.album,
        durationSeconds: item.durationSeconds,
        thumbnail: item.thumbnail,
        views: item.views,
      });
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function CarouselTrackCard({
  track,
  contextIds,
  contextLabel,
}: {
  track: Track;
  contextIds: string[];
  contextLabel: string;
}) {
  const isCurrent = usePlayerStore((state) => state.currentTrackId === track.id);
  const isPlaying = usePlayerStore((state) =>
    state.currentTrackId === track.id ? state.isPlaying : false,
  );
  const playTrack = usePlayerStore((state) => state.playTrack);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const artist = getArtist(track.artistId);

  return (
    <article className="group min-w-0 rounded-2xl border border-transparent p-2 -m-2 transition-colors duration-200 hover:border-border hover:bg-card">
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (isCurrent) togglePlay();
            else playTrack(track.id, contextIds, contextLabel);
          }}
          aria-label={`${isCurrent && isPlaying ? "Pause" : "Play"} ${track.title}`}
          className="relative block w-full overflow-hidden rounded-2xl border border-border bg-elevated text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Artwork
            src={track.artwork}
            alt={track.title}
            res="md"
            className="aspect-square w-full transition-transform duration-300 ease-out group-hover:scale-[1.02]"
          />
          <span
            className={cn(
              "absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all duration-150",
              isCurrent
                ? "opacity-100 translate-y-0"
                : "opacity-100 sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100",
            )}
          >
            {isCurrent && isPlaying ? (
              <Pause className="h-4 w-4 fill-current" strokeWidth={0} />
            ) : (
              <Play className="ml-0.5 h-4 w-4 fill-current" strokeWidth={0} />
            )}
          </span>
        </button>
      </div>
      <div className="mt-3 min-w-0 px-0.5">
        <p
          className={cn(
            "truncate text-[13.5px] font-semibold leading-5",
            isCurrent ? "text-primary" : "text-foreground",
          )}
        >
          {track.title}
        </p>
        <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
          {artist?.name ?? "Sangeet"}
        </p>
      </div>
    </article>
  );
}

export default function HomePage() {
  const session = useAuthStore((state) => state.session);
  const profile = useAppStore((state) => state.profile);
  const preferredArtistIds = useAppStore((state) => state.preferredArtistIds);
  const setPreferredArtists = useAppStore((state) => state.setPreferredArtists);
  const recentSearches = useAppStore((state) => state.recentSearches);

  const recentlyPlayed = useLibraryStore((state) => state.recentlyPlayed);
  const recentlyPlayedAt = useLibraryStore((state) => state.recentlyPlayedAt);
  const likedTrackIds = useLibraryStore((state) => state.likedTrackIds);
  const followedArtistIds = useLibraryStore((state) => state.followedArtistIds);
  const savedAlbumIds = useLibraryStore((state) => state.savedAlbumIds);

  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const playShuffled = usePlayerStore((state) => state.playShuffled);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const toggleMobileSidebar = useUIStore((state) => state.toggleMobileSidebar);

  const [filter, setFilter] = useState<HomeFilter>("all");
  const [greeting, setGreeting] = useState("Good evening");
  const [inNativeAndroid, setInNativeAndroid] = useState(false);
  const [nativeOffline, setNativeOffline] = useState(false);
  const [clientDevice, setClientDevice] = useState<"android" | "desktop" | "other">("desktop");
  const [tuneDismissed, setTuneDismissed] = useState(false);

  const [trendingTracks, setTrendingTracks] = useState<Track[]>(() =>
    trendingCache && Date.now() - trendingCache.at < CACHE_TTL_MS ? trendingCache.tracks : [],
  );
  const [trendingViews, setTrendingViews] = useState<Record<string, string>>(() =>
    trendingCache && Date.now() - trendingCache.at < CACHE_TTL_MS ? trendingCache.viewsById : {},
  );
  const [loadingTrending, setLoadingTrending] = useState<boolean>(
    () => !(trendingCache && Date.now() - trendingCache.at < CACHE_TTL_MS),
  );

  const [tasteTracks, setTasteTracks] = useState<Track[]>([]);
  const [loadingTaste, setLoadingTaste] = useState(false);

  const [ytFeedConnected, setYtFeedConnected] = useState(false);
  const [ytSuggestedTracks, setYtSuggestedTracks] = useState<Track[]>([]);
  const [ytLikedTracks, setYtLikedTracks] = useState<Track[]>([]);
  const [ytSeeds, setYtSeeds] = useState<string[]>([]);
  const [loadingYtFeed, setLoadingYtFeed] = useState(false);

  const [offlineItems, setOfflineItems] = useState<
    Array<{ track: Track; artistName: string; sizeBytes: number; savedAt: number }>
  >([]);

  const displayName = session?.displayName || profile.name;
  const initials = session?.initials || profile.initials;
  const avatarColor = session?.avatarColor || profile.avatarColor;

  useEffect(() => {
    setGreeting(getGreeting());
    setInNativeAndroid(isAndroidNativeApp());
    setNativeOffline(isNativeOfflineSupported());
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent;
      if (/Android/i.test(ua)) setClientDevice("android");
      else if (/iPhone|iPad|iPod|Mobile/i.test(ua)) setClientDevice("other");
      else setClientDevice("desktop");
    }
    try {
      if (window.localStorage.getItem(TUNE_DISMISS_KEY) === "1") {
        setTuneDismissed(true);
      }
    } catch {
      // Ignore storage errors.
    }
  }, []);

  const feed = useMemo(
    () =>
      buildPersonalizedFeed({
        recentlyPlayed,
        recentlyPlayedAt,
        likedTrackIds,
        followedArtistIds,
        savedAlbumIds,
        preferredArtistIds,
        recentSearches,
        displayName: session?.displayName ?? null,
      }),
    [
      recentlyPlayed,
      recentlyPlayedAt,
      likedTrackIds,
      followedArtistIds,
      savedAlbumIds,
      preferredArtistIds,
      recentSearches,
      session?.displayName,
    ],
  );

  // Single cached fetch for /api/youtube/trending?limit=12
  useEffect(() => {
    if (trendingCache && Date.now() - trendingCache.at < CACHE_TTL_MS) {
      setTrendingTracks(trendingCache.tracks);
      setTrendingViews(trendingCache.viewsById);
      setLoadingTrending(false);
      return;
    }

    let active = true;
    setLoadingTrending(true);

    fetch("/api/youtube/trending?limit=12", { signal: AbortSignal.timeout(9000) })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { results?: TrendingApiItem[] };
      })
      .then((payload) => {
        if (!active || !payload?.results) return;
        const registered: Track[] = [];
        const viewsById: Record<string, string> = {};
        for (const item of payload.results) {
          const track = registerTrendingItem(item);
          if (track) {
            registered.push(track);
            if (item.views) viewsById[track.id] = item.views;
          }
        }
        trendingCache = { at: Date.now(), tracks: registered, viewsById };
        setTrendingTracks(registered);
        setTrendingViews(viewsById);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingTrending(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Personalized YouTube Music feed for signed-in Google accounts
  useEffect(() => {
    if (!session) {
      setYtFeedConnected(false);
      setYtSuggestedTracks([]);
      setYtLikedTracks([]);
      setYtSeeds([]);
      setLoadingYtFeed(false);
      return;
    }

    const cacheKey = session.email || session.displayName || "user";
    const cached = ytFeedCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setYtFeedConnected(cached.connected);
      setYtSuggestedTracks(cached.suggested);
      setYtLikedTracks(cached.liked);
      setYtSeeds(cached.seeds);
      setLoadingYtFeed(false);
      return;
    }

    let active = true;
    setLoadingYtFeed(true);

    fetch("/api/youtube/feed", { signal: AbortSignal.timeout(10000) })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as {
          connected?: boolean;
          suggested?: Array<{
            videoId: string;
            title: string;
            artist: string;
            durationSeconds?: number;
            thumbnail?: string;
          }>;
          liked?: Array<{
            videoId: string;
            title: string;
            artist: string;
            durationSeconds?: number;
            thumbnail?: string;
          }>;
          seeds?: string[];
        };
      })
      .then((payload) => {
        if (!active || !payload) return;
        const suggested = (payload.suggested ?? []).map((item) =>
          registerYouTubeSearchResult({
            videoId: item.videoId,
            title: item.title,
            artist: item.artist,
            durationSeconds: item.durationSeconds,
            thumbnail: item.thumbnail,
          }),
        );
        const liked = (payload.liked ?? []).map((item) =>
          registerYouTubeSearchResult({
            videoId: item.videoId,
            title: item.title,
            artist: item.artist,
            durationSeconds: item.durationSeconds,
            thumbnail: item.thumbnail,
          }),
        );
        const seeds = Array.isArray(payload.seeds) ? payload.seeds : [];
        const connected = Boolean(payload.connected);
        ytFeedCache.set(cacheKey, {
          at: Date.now(),
          connected,
          suggested,
          liked,
          seeds,
        });
        setYtFeedConnected(connected);
        setYtSuggestedTracks(suggested);
        setYtLikedTracks(liked);
        setYtSeeds(seeds);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingYtFeed(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  // Single cached fetch for feed.tasteSeedQuery
  useEffect(() => {
    const query = feed.tasteSeedQuery.trim();
    if (!query) {
      setTasteTracks([]);
      setLoadingTaste(false);
      return;
    }

    const cached = tasteSearchCache.get(query);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setTasteTracks(cached.tracks);
      setLoadingTaste(false);
      return;
    }

    let active = true;
    setLoadingTaste(true);

    fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(8000),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as {
          results?: Array<{
            videoId: string;
            title: string;
            artist: string;
            album?: string;
            durationSeconds?: number;
            thumbnail?: string;
            views?: string;
          }>;
        };
      })
      .then((payload) => {
        if (!active || !payload?.results) return;
        const resolved = payload.results
          .slice(0, 12)
          .map((item) =>
            registerYouTubeSearchResult({
              videoId: item.videoId,
              title: item.title,
              artist: item.artist,
              album: item.album,
              durationSeconds: item.durationSeconds,
              thumbnail: item.thumbnail,
              views: item.views,
            }),
          );
        tasteSearchCache.set(query, { at: Date.now(), tracks: resolved });
        setTasteTracks(resolved);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingTaste(false);
      });

    return () => {
      active = false;
    };
  }, [feed.tasteSeedQuery]);

  // Offline tracks subscription
  const loadOffline = useCallback(async () => {
    try {
      const items = await listOfflineTracks();
      setOfflineItems(items);
    } catch {
      setOfflineItems([]);
    }
  }, []);

  useEffect(() => {
    if (!nativeOffline) return;
    void loadOffline();
    return subscribeOfflineChanges(() => {
      void loadOffline();
    });
  }, [loadOffline, nativeOffline]);

  const likedPlaying = Boolean(currentTrackId && likedTrackIds.includes(currentTrackId));
  const resolvedQuickPicks = useMemo(() => {
    const personalCount = Math.min(4, recentlyPlayed.length + likedTrackIds.length);
    const base = feed.quickPicks.slice(0, personalCount > 0 ? Math.max(personalCount, 3) : 0);
    const seen = new Set(base.map((t) => t.id));
    const combined = [...base];
    for (const t of trendingTracks) {
      if (combined.length >= 7) break;
      if (!seen.has(t.id)) {
        seen.add(t.id);
        combined.push(t);
      }
    }
    for (const t of feed.quickPicks) {
      if (combined.length >= 7) break;
      if (!seen.has(t.id)) {
        seen.add(t.id);
        combined.push(t);
      }
    }
    return combined;
  }, [feed.quickPicks, trendingTracks, recentlyPlayed.length, likedTrackIds.length]);

  const quickPickIds = useMemo(
    () => resolvedQuickPicks.map((t) => t.id),
    [resolvedQuickPicks],
  );
  const trendingIds = useMemo(
    () => trendingTracks.map((t) => t.id),
    [trendingTracks],
  );
  const personalizedTracks = useMemo(
    () => (tasteTracks.length > 0 ? tasteTracks : feed.tracks.slice(0, 12)),
    [tasteTracks, feed.tracks],
  );
  const personalizedIds = useMemo(
    () => personalizedTracks.map((t) => t.id),
    [personalizedTracks],
  );

  const toggleTuneArtist = (artistId: string) => {
    const exists = preferredArtistIds.includes(artistId);
    const next = exists
      ? preferredArtistIds.filter((id) => id !== artistId)
      : [...preferredArtistIds, artistId].slice(0, 5);
    setPreferredArtists(next);
  };

  const dismissTuneBar = () => {
    setTuneDismissed(true);
    try {
      window.localStorage.setItem(TUNE_DISMISS_KEY, "1");
    } catch {
      // Ignore storage errors.
    }
  };

  const spotlight = feed.spotlight;
  const spotlightTrackIds = spotlight
    ? spotlight.album.trackIds.length > 0
      ? spotlight.album.trackIds
      : [spotlight.track.id]
    : [];
  const isSpotlightActive = Boolean(
    currentTrackId && spotlightTrackIds.includes(currentTrackId),
  );

  const filters = useMemo(
    () =>
      nativeOffline
        ? [...BASE_FILTERS, { id: "offline" as const, label: "Offline" }]
        : BASE_FILTERS,
    [nativeOffline],
  );
  const isNativeApp = nativeOffline || inNativeAndroid;

  const showAll = filter === "all" || (!nativeOffline && filter === "offline");
  const showMusic = filter === "music";
  const showTrending = filter === "trending";
  const showOffline = nativeOffline && filter === "offline";

  const carouselTrackClass =
    "no-scrollbar hide-scrollbar -mx-4 flex min-w-0 snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 py-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0 sm:py-0 md:grid-cols-4 lg:grid-cols-6 [&>*]:w-[146px] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto";

  return (
    <div className="min-h-dvh w-full max-w-full min-w-0 overflow-x-clip bg-background">
      {/* Mobile Sticky Header */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] backdrop-blur-md md:hidden">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={toggleMobileSidebar}
            aria-label="Open navigation and account menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold text-white transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            style={{ background: avatarColor }}
          >
            {session?.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.picture}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </button>

          <div
            data-no-tab-swipe="true"
            className="no-scrollbar hide-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pr-6"
            role="tablist"
            aria-label="Home feed filters"
            style={{
              maskImage:
                "linear-gradient(to right, black 0%, black calc(100% - 24px), transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to right, black 0%, black calc(100% - 24px), transparent 100%)",
            }}
          >
            {filters.map((item) => {
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-muted-foreground hover:bg-elevated hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Activity and settings menu"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-elevated hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Bell className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-2xl border-border bg-popover shadow-lg"
            >
              <DropdownMenuLabel className="text-xs font-semibold">
                Quick Menu
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() =>
                  playShuffled(
                    tracks.map((t) => t.id),
                    "Shuffle all",
                  )
                }
                className="cursor-pointer"
              >
                <Shuffle className="mr-2 h-3.5 w-3.5 text-primary" />
                Shuffle all
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/new-releases" className="cursor-pointer">
                  <Disc3 className="mr-2 h-3.5 w-3.5 text-primary" />
                  New releases
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/recently-played" className="cursor-pointer">
                  <TrendingUp className="mr-2 h-3.5 w-3.5" />
                  Recently played
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings2 className="mr-2 h-3.5 w-3.5" />
                  Settings &amp; Audio
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="page-container min-w-0 max-w-[1480px] px-4 pt-5 sm:px-6 md:pt-7 lg:px-8">
        {/* Page Header */}
        <header className="mb-6 sm:mb-7">
          <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl lg:text-[34px]">
                {greeting}
                {session?.displayName
                  ? `, ${getFirstName(session.displayName)}`
                  : displayName &&
                      !displayName.toLowerCase().includes("local") &&
                      displayName.toLowerCase() !== "listener"
                    ? `, ${getFirstName(displayName)}`
                    : ""}
              </h1>
              <p className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">
                Live trends &amp; personalized picks
              </p>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <button
                type="button"
                onClick={() =>
                  playShuffled(
                    tracks.map((t) => t.id),
                    "Shuffle all",
                  )
                }
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Shuffle className="h-3.5 w-3.5" />
                Shuffle all
              </button>
              {!isNativeApp && (
                <a
                  href={
                    clientDevice === "android"
                      ? "/api/download/android"
                      : "/api/download/windows"
                  }
                  download={
                    clientDevice === "android"
                      ? "sangeet-android.apk"
                      : "Sangeet.exe"
                  }
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:bg-elevated active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Download className="h-3.5 w-3.5 text-primary" />
                  {clientDevice === "android"
                    ? "Download Android APK"
                    : "Download Windows .exe"}
                </a>
              )}
            </div>
          </div>

          {/* Desktop Segmented Filter Pills */}
          <div
            className="mt-4 hidden items-center gap-2 md:flex"
            role="tablist"
            aria-label="Home feed filters"
          >
            {filters.map((item) => {
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full px-4 text-xs font-semibold transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-muted-foreground hover:bg-elevated hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </header>

        {/* ALL & MUSIC: 8-Tile Rectangular Quick-Pick Grid */}
        {(showAll || showMusic) && (
          <section aria-label="Quick picks" className="mb-7 sm:mb-8">
            <div className="grid min-w-0 grid-cols-2 gap-2.5 lg:grid-cols-4">
              {/* Tile 1: Liked Songs */}
              <Link
                href="/liked"
                className={cn(
                  "group flex h-[56px] w-full min-w-0 items-center gap-2 overflow-hidden rounded-xl border border-border bg-card p-0 pr-2.5 text-left transition duration-150 hover:border-white/[0.16] hover:bg-elevated active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:gap-2.5 sm:pr-3",
                  likedPlaying &&
                    "border-primary/45 bg-primary/[0.08] hover:border-primary/55 hover:bg-primary/[0.11]",
                )}
              >
                <span className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-none bg-gradient-to-br from-[#450af5] via-[#6d3df5] to-[#8e8ee5]">
                  <Heart className="h-5 w-5 fill-white text-white" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold leading-tight text-foreground sm:text-[13.5px]">
                    Liked Songs
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground tabular-nums">
                    {likedTrackIds.length}{" "}
                    {likedTrackIds.length === 1 ? "song" : "songs"}
                  </span>
                </span>
                {likedPlaying && (
                  <Equalizer
                    playing={isPlaying}
                    className="shrink-0 text-primary"
                  />
                )}
              </Link>

              {/* Tiles 2-8: Quick Picks */}
              {resolvedQuickPicks.slice(0, 7).map((track) => (
                <QuickTrackTile
                  key={track.id}
                  track={track}
                  contextIds={quickPickIds}
                  contextLabel="Quick picks"
                  className="h-[56px] w-full min-w-0 border-border"
                />
              ))}
            </div>
          </section>
        )}

        {/* ALL & MUSIC: Editorial Spotlight Release */}
        {(showAll || showMusic) && spotlight && (
          <section aria-label="Featured release spotlight" className="mb-7 sm:mb-9">
            <div className="mb-3 flex min-w-0 items-center gap-2.5">
              <Link
                href={`/artist/${spotlight.artist.id}`}
                className="shrink-0 overflow-hidden rounded-full ring-1 ring-border"
              >
                <Artwork
                  src={spotlight.artist.image}
                  alt={spotlight.artist.name}
                  res="sm"
                  className="h-8 w-8 rounded-full"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium leading-none text-muted-foreground">
                  {spotlight.eyebrow || "New release from"}
                </p>
                <Link
                  href={`/artist/${spotlight.artist.id}`}
                  className="mt-1 block truncate font-display text-[17px] font-bold tracking-tight text-foreground hover:underline sm:text-xl"
                >
                  {spotlight.artist.name}
                </Link>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] items-stretch gap-x-3.5 gap-y-3 overflow-hidden rounded-2xl border border-border bg-card p-3.5 min-[420px]:grid-cols-[144px_minmax(0,1fr)] min-[420px]:gap-0 min-[420px]:p-0 sm:grid-cols-[160px_minmax(0,1fr)]">
              <Link
                href={`/album/${spotlight.album.id}`}
                className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-elevated min-[420px]:row-span-2 min-[420px]:aspect-auto min-[420px]:h-full min-[420px]:min-h-[144px] min-[420px]:rounded-none min-[420px]:border-0 min-[420px]:border-r sm:min-h-[160px]"
              >
                <Artwork
                  src={spotlight.album.artwork || spotlight.track.artwork}
                  alt={spotlight.album.title}
                  res="md"
                  priority
                  className="h-full w-full rounded-none object-cover"
                />
              </Link>

              <div className="flex min-w-0 flex-col justify-center min-[420px]:justify-start min-[420px]:p-4 min-[420px]:pb-2 sm:p-5 sm:pb-2">
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                  New release · {spotlight.album.type || "Single"}
                </p>
                <Link
                  href={`/album/${spotlight.album.id}`}
                  className="mt-1 block line-clamp-2 font-display text-[15px] font-bold leading-snug tracking-tight text-foreground hover:underline min-[420px]:truncate sm:text-xl"
                >
                  {spotlight.album.title}
                </Link>
                <Link
                  href={`/artist/${spotlight.artist.id}`}
                  className="mt-0.5 block truncate text-xs font-medium text-muted-foreground hover:text-foreground sm:text-sm"
                >
                  {spotlight.artist.name}
                </Link>
              </div>

              <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 min-[420px]:col-span-1 min-[420px]:col-start-2 min-[420px]:border-t-0 min-[420px]:px-4 min-[420px]:pb-4 min-[420px]:pt-2 sm:px-5 sm:pb-5">
                <div className="flex shrink-0 items-center gap-1">
                  <LikeButton
                    trackId={spotlight.track.id}
                    size="sm"
                    showTooltip={false}
                  />
                  <TrackContextMenu track={spotlight.track} />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (isSpotlightActive) togglePlay();
                    else {
                      playTrack(
                        spotlightTrackIds[0] ?? spotlight.track.id,
                        spotlightTrackIds,
                        spotlight.album.title,
                      );
                    }
                  }}
                  aria-label={`${
                    isSpotlightActive && isPlaying ? "Pause" : "Play"
                  } ${spotlight.album.title}`}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-10 sm:px-5"
                >
                  {isSpotlightActive && isPlaying ? (
                    <>
                      <Pause className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
                      <span>Play</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Compact Taste Tuner for new listeners */}
        {feed.isNewListener && !tuneDismissed && (showAll || showMusic) && (
          <section
            aria-label="Personalize your feed"
            className="mb-7 rounded-2xl border border-border bg-card p-4 sm:mb-8"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-foreground">
                  Personalize your feed
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Pick a few artists to shape your recommendations.
                </p>
              </div>
              <button
                type="button"
                onClick={dismissTuneBar}
                aria-label="Dismiss feed personalization"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div
              data-no-tab-swipe="true"
              className="no-scrollbar hide-scrollbar mt-3 flex items-center gap-2 overflow-x-auto pb-0.5 sm:flex-wrap"
            >
              {STARTER_TASTE_ARTISTS.map((artist) => {
                const selected = preferredArtistIds.includes(artist.id);
                return (
                  <button
                    key={artist.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleTuneArtist(artist.id)}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      selected
                        ? "border-primary bg-primary font-semibold text-primary-foreground"
                        : "border-border bg-elevated/70 text-foreground/90 hover:bg-elevated hover:text-foreground",
                    )}
                  >
                    {selected ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Plus className="h-3 w-3 text-muted-foreground" />
                    )}
                    {artist.label}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {showAll && <InstallPromptBanner />}

        {/* Personalized Feed */}
        {(showAll || showMusic) && session && ytFeedConnected && (ytSuggestedTracks.length > 0 || ytLikedTracks.length > 0) && (
          <>
            {ytSuggestedTracks.length > 0 && (
              <section className="section-space" aria-label="Picked for you">
                <SectionHeader
                  title="Picked for you"
                  description={
                    ytSeeds.length > 0
                      ? `Inspired by ${ytSeeds.join(", ")}`
                      : "Curated for your listening taste"
                  }
                  action={
                    <button
                      type="button"
                      onClick={() =>
                        playShuffled(
                          ytSuggestedTracks.map((t) => t.id),
                          "Picked for you",
                        )
                      }
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground transition hover:bg-elevated active:scale-95"
                    >
                      <Shuffle className="h-3.5 w-3.5 text-primary" />
                      Shuffle
                    </button>
                  }
                />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {ytSuggestedTracks.slice(0, 12).map((track) => (
                    <CarouselTrackCard
                      key={track.id}
                      track={track}
                      contextIds={ytSuggestedTracks.map((t) => t.id)}
                      contextLabel="Picked for you"
                    />
                  ))}
                </div>
              </section>
            )}

            {ytLikedTracks.length > 0 && (
              <section className="section-space" aria-label="Your favorites">
                <SectionHeader
                  title="Your favorites"
                  description="Tracks you've loved recently"
                />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {ytLikedTracks.slice(0, 6).map((track) => (
                    <CarouselTrackCard
                      key={track.id}
                      track={track}
                      contextIds={ytLikedTracks.map((t) => t.id)}
                      contextLabel="Your favorites"
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ALL: Trending Now Carousel */}
        {showAll && (
          <section className="section-space" aria-label="Trending now">
            <SectionHeader
              title="Trending now"
              action={
                <button
                  type="button"
                  onClick={() => setFilter("trending")}
                  className="inline-flex h-7 items-center rounded-full border border-border bg-card px-3 text-[11px] font-semibold text-muted-foreground transition hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  See all
                </button>
              }
            />
            {loadingTrending && trendingTracks.length === 0 ? (
              <div data-no-tab-swipe="true" className={carouselTrackClass}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="space-y-2.5">
                    <div className="skeleton aspect-square w-full rounded-2xl" />
                    <div className="skeleton h-3.5 w-3/4 rounded-md" />
                    <div className="skeleton h-3 w-1/2 rounded-md" />
                  </div>
                ))}
              </div>
            ) : (
              <div data-no-tab-swipe="true" className={carouselTrackClass}>
                {trendingTracks.slice(0, 6).map((track) => (
                  <CarouselTrackCard
                    key={track.id}
                    track={track}
                    contextIds={trendingIds}
                    contextLabel="Trending now"
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ALL: Personalized Picks */}
        {showAll && (
          <section className="section-space" aria-label="Picked for you">
            <SectionHeader
              title="Picked for you"
              href="/search"
              linkLabel="See all"
            />
            {loadingTaste && tasteTracks.length === 0 ? (
              <div data-no-tab-swipe="true" className={carouselTrackClass}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="space-y-2.5">
                    <div className="skeleton aspect-square w-full rounded-2xl" />
                    <div className="skeleton h-3.5 w-3/4 rounded-md" />
                    <div className="skeleton h-3 w-1/2 rounded-md" />
                  </div>
                ))}
              </div>
            ) : (
              <div data-no-tab-swipe="true" className={carouselTrackClass}>
                {personalizedTracks.slice(0, 6).map((track) => (
                  <CarouselTrackCard
                    key={track.id}
                    track={track}
                    contextIds={personalizedIds}
                    contextLabel={feed.tasteSeedLabel}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ALL & MUSIC: Recommended Artists */}
        {(showAll || showMusic) && feed.artists.length > 0 && (
          <section className="section-space" aria-label="Recommended artists">
            <SectionHeader title="Recommended artists" href="/explore" />
            <div data-no-tab-swipe="true" className={carouselTrackClass}>
              {feed.artists.slice(0, 6).map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </div>
          </section>
        )}

        {/* ALL & MUSIC: New Releases for You */}
        {(showAll || showMusic) && feed.albums.length > 0 && (
          <section className="section-space" aria-label="New releases for you">
            <SectionHeader title="New releases for you" href="/new-releases" />
            <div data-no-tab-swipe="true" className={carouselTrackClass}>
              {feed.albums.slice(0, 6).map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </div>
          </section>
        )}

        {/* ALL & MUSIC: Your Mixes */}
        {(showAll || showMusic) && feed.playlists.length > 0 && (
          <section className="section-space" aria-label="Your mixes">
            <SectionHeader title="Your mixes" href="/made-for-you" />
            <div data-no-tab-swipe="true" className={carouselTrackClass}>
              {feed.playlists.slice(0, 6).map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
            </div>
          </section>
        )}

        {/* TRENDING FILTER VIEW */}
        {showTrending && (
          <section aria-label="Trending chart">
            <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Flame className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                    Live Top 12
                  </p>
                  <h2 className="truncate font-display text-xl font-bold text-foreground sm:text-2xl">
                    Trending Chart
                  </h2>
                </div>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={trendingIds.length === 0}
                  onClick={() =>
                    trendingIds[0] &&
                    playTrack(trendingIds[0], trendingIds, "Trending Chart")
                  }
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Play all
                </button>
                <button
                  type="button"
                  disabled={trendingIds.length === 0}
                  onClick={() => playShuffled(trendingIds, "Trending Chart")}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-elevated px-4 text-xs font-semibold text-foreground transition hover:bg-white/[0.09] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  Shuffle
                </button>
              </div>
            </div>

            {loadingTrending && trendingTracks.length === 0 ? (
              <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div key={idx} className="flex min-h-[56px] items-center gap-3 px-4 py-2.5">
                    <div className="skeleton h-4 w-6 rounded" />
                    <div className="skeleton h-11 w-11 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3.5 w-48 max-w-full rounded" />
                      <div className="skeleton h-3 w-32 max-w-full rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
                {trendingTracks.map((track, idx) => {
                  const isCurrent = currentTrackId === track.id;
                  const artist = getArtist(track.artistId);
                  const views = trendingViews[track.id];
                  const rank = idx + 1;
                  return (
                    <div
                      key={track.id}
                      className={cn(
                        "group flex min-h-[56px] min-w-0 items-center gap-2 px-2.5 py-2 transition-colors hover:bg-elevated/70 sm:gap-3 sm:px-4",
                        isCurrent && "bg-primary/[0.08] hover:bg-primary/[0.11]",
                      )}
                    >
                      <span
                        className={cn(
                          "w-5 shrink-0 text-center font-sans text-xs font-semibold tabular-nums sm:w-7",
                          isCurrent || idx < 3 ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {rank}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          if (isCurrent) togglePlay();
                          else playTrack(track.id, trendingIds, "Trending Chart");
                        }}
                        aria-label={`${isCurrent && isPlaying ? "Pause" : "Play"} ${track.title}`}
                        className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Artwork
                          src={track.artwork}
                          alt={track.title}
                          res="sm"
                          className="h-full w-full"
                        />
                        <span
                          className={cn(
                            "absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity",
                            isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                          )}
                        >
                          {isCurrent && isPlaying ? (
                            <Pause className="h-4 w-4 fill-white text-white" />
                          ) : (
                            <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
                          )}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (isCurrent) togglePlay();
                          else playTrack(track.id, trendingIds, "Trending Chart");
                        }}
                        className="min-w-0 flex-1 text-left focus-visible:outline-none"
                      >
                        <p
                          className={cn(
                            "truncate text-[13.5px] font-semibold",
                            isCurrent ? "text-primary" : "text-foreground",
                          )}
                        >
                          {track.title}
                        </p>
                        <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                          {artist?.name ?? "Sangeet"}
                          {views ? ` · ${views}` : ""}
                        </p>
                      </button>

                      {track.duration > 0 && (
                        <span className="hidden shrink-0 font-sans text-xs tabular-nums text-muted-foreground sm:inline">
                          {formatDuration(track.duration)}
                        </span>
                      )}
                      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                        <LikeButton trackId={track.id} size="sm" showTooltip={false} />
                        <TrackContextMenu track={track} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* OFFLINE & LOCAL FILTER VIEW */}
        {showOffline && (
          <div className="min-w-0 space-y-8">
            <section aria-label="Offline downloads" className="min-w-0">
              <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <WifiOff className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                      Auto-scanned local music &amp; offline downloads
                    </p>
                    <h2 className="truncate font-display text-xl font-bold text-foreground sm:text-2xl">
                      Offline Songs ({offlineItems.length})
                    </h2>
                  </div>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {offlineItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const ids = offlineItems.map((item) => item.track.id);
                        if (ids[0]) playTrack(ids[0], ids, "Offline songs");
                      }}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Play offline
                    </button>
                  )}
                  <Link
                    href="/library?tab=local"
                    className="inline-flex h-9 max-w-full shrink-0 items-center gap-1.5 rounded-full border border-border bg-elevated px-4 text-xs font-semibold text-foreground transition hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Open Scanner &amp; Local Library</span>
                  </Link>
                </div>
              </div>

              {offlineItems.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
                  <HardDrive className="mx-auto h-7 w-7 text-muted-foreground" />
                  <p className="mt-3 text-sm font-semibold text-foreground">
                    No offline songs saved yet
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Auto-scanned local music &amp; offline downloads appear here. Tap Download in Now Playing or any track&apos;s{" "}
                    <MoreHorizontal className="inline h-3.5 w-3.5" /> menu to save songs for offline playback.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
                  {offlineItems.map(({ track, artistName, sizeBytes }, idx) => {
                    const isCurrent = currentTrackId === track.id;
                    const offlineIds = offlineItems.map((i) => i.track.id);
                    const indexLabel = idx + 1;
                    return (
                      <div
                        key={track.id}
                        className={cn(
                          "group flex min-h-[56px] min-w-0 items-center gap-2 px-2.5 py-2 transition-colors hover:bg-elevated/70 sm:gap-3 sm:px-4",
                          isCurrent && "bg-primary/[0.08] hover:bg-primary/[0.11]",
                        )}
                      >
                        <span
                          className={cn(
                            "w-5 shrink-0 text-center font-sans text-xs font-semibold tabular-nums sm:w-7",
                            isCurrent ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {indexLabel}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            if (isCurrent) togglePlay();
                            else playTrack(track.id, offlineIds, "Offline songs");
                          }}
                          aria-label={`${isCurrent && isPlaying ? "Pause" : "Play"} ${track.title}`}
                          className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Artwork
                            src={track.artwork}
                            alt={track.title}
                            res="sm"
                            className="h-full w-full"
                          />
                          <span
                            className={cn(
                              "absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity",
                              isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                            )}
                          >
                            {isCurrent && isPlaying ? (
                              <Pause className="h-4 w-4 fill-white text-white" />
                            ) : (
                              <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
                            )}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (isCurrent) togglePlay();
                            else playTrack(track.id, offlineIds, "Offline songs");
                          }}
                          className="min-w-0 flex-1 text-left focus-visible:outline-none"
                        >
                          <p
                            className={cn(
                              "truncate text-[13.5px] font-semibold",
                              isCurrent ? "text-primary" : "text-foreground",
                            )}
                          >
                            {track.title}
                          </p>
                          <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground tabular-nums">
                            {artistName}
                            {sizeBytes > 0 ? ` · ${formatBytes(sizeBytes)}` : ""}
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            void removeOfflineTrack(track.id).then(() => {
                              toast.show("Removed offline copy", track.title, "default");
                            });
                          }}
                          aria-label={`Remove offline copy of ${track.title}`}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-elevated hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <LocalFilesSection className="mt-0 min-w-0" />
          </div>
        )}
      </div>
    </div>
  );
}
