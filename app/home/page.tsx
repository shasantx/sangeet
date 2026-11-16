"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Flame, FolderOpen, Heart, Pause, Play, Shuffle } from "lucide-react";
import {
  albums,
  featuredPlaylists,
  getArtist,
  getTracks,
  tracks,
} from "@/lib/catalog";
import { cn, getFirstName, getGreeting } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useAppStore } from "@/store/app-store";
import { useLibraryStore } from "@/store/library-store";
import { AlbumCard } from "@/components/music/album-card";
import { ArtistCard } from "@/components/music/artist-card";
import { Artwork } from "@/components/music/artwork";
import { PlaylistCard } from "@/components/music/playlist-card";
import { SectionHeader } from "@/components/music/section-header";
import { TrackList } from "@/components/music/track-list";
import { registerYouTubeSearchResult, type YouTubeSearchResult } from "@/lib/dynamic-tracks";
import { LiveMusicHome } from "@/components/search/live-music-discovery";
import { OpenMusicHome } from "@/components/search/open-music-results";
import { InstallPromptBanner } from "@/components/site/install-prompt-banner";
import { isAndroidNativeApp } from "@/lib/android-bridge";
import { usePlayerStore } from "@/store/player-store";

export default function HomePage() {
  const session = useAuthStore((state) => state.session);
  const preferredArtistIds = useAppStore((state) => state.preferredArtistIds);
  const recentlyPlayed = useLibraryStore((state) => state.recentlyPlayed);
  const likedTrackIds = useLibraryStore((state) => state.likedTrackIds);
  const [greeting, setGreeting] = useState("Good evening");
  const [inNativeAndroid, setInNativeAndroid] = useState(false);
  const [artistTrackIds, setArtistTrackIds] = useState<string[]>([]);
  const [loadingArtistTracks, setLoadingArtistTracks] = useState(false);
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const displayName = session?.displayName;

  useEffect(() => {
    setGreeting(getGreeting());
    setInNativeAndroid(isAndroidNativeApp());
  }, []);

  const recentIds = useMemo(() => {
    const ids = recentlyPlayed.length ? recentlyPlayed : likedTrackIds;
    return ids.slice(0, 6);
  }, [recentlyPlayed, likedTrackIds]);
  const recentTracks = getTracks(recentIds);

  const quickPicks = useMemo(() => {
    if (recentTracks.length >= 4) return recentTracks;
    const popularYouTubeTracks = tracks
      .filter((t) => Boolean(t.youtubeId) && t.artwork && t.artwork.startsWith("https://"))
      .slice(0, 6);
    return popularYouTubeTracks.length ? popularYouTubeTracks : recentTracks;
  }, [recentTracks]);

  const popularSingers = useMemo(() => {
    const desired = [
      "the-weeknd",
      "taylor-swift",
      "billie-eilish",
      "coldplay",
      "arijit-singh",
      "sajjan-raj-vaidya",
      "shreya-ghoshal",
      "diljit-dosanjh",
      "sushant-kc",
      "bipul-chettri",
      "yabesh-thapa",
      "ar-rahman",
    ];
    return desired
      .map((id) => getArtist(id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a));
  }, []);

  const popularAlbumsList = useMemo(() => {
    const online = albums.filter((a) => a.artwork && a.artwork.startsWith("https://"));
    return online.length ? online.slice(0, 6) : albums.slice(0, 6);
  }, []);

  useEffect(() => {
    let active = true;
    const preferred = new Set(preferredArtistIds);
    const localTracks = tracks.filter((track) => preferred.has(track.artistId)).slice(0, 12);
    setArtistTrackIds(localTracks.map((track) => track.id));
    const artistsToFind = preferredArtistIds
      .map((id) => getArtist(id))
      .filter((artist): artist is NonNullable<typeof artist> => artist !== undefined && !localTracks.some((track) => track.artistId === artist.id))
      .slice(0, 3);
    if (!artistsToFind.length) {
      setLoadingArtistTracks(false);
      return () => { active = false; };
    }
    setLoadingArtistTracks(true);
    void Promise.all(artistsToFind.map(async (artist) => {
      try {
        const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(artist.name)}`, { signal: AbortSignal.timeout(7000) });
        if (!response.ok) return [];
        const payload = await response.json() as { results?: YouTubeSearchResult[] };
        return (payload.results ?? []).slice(0, 4).map((result) => registerYouTubeSearchResult({ ...result, artist: artist.name }).id);
      } catch {
        return [];
      }
    })).then((groups) => {
      if (!active) return;
      setArtistTrackIds((current) => Array.from(new Set([...current, ...groups.flat()])).slice(0, 12));
      setLoadingArtistTracks(false);
    });
    return () => { active = false; };
  }, [preferredArtistIds]);

  return (
    <div className="page-container max-w-[1480px] pt-4 sm:pt-8">
      <InstallPromptBanner />
      <header className="mb-5 sm:mb-7">
        <h1 className="text-2xl font-bold tracking-[-0.04em] sm:text-4xl">
          {greeting}{displayName ? `, ${getFirstName(displayName)}` : ""}
        </h1>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 sm:flex-wrap">
          <button
            type="button"
            onClick={() => usePlayerStore.getState().playShuffled(tracks.map((t) => t.id), "Shuffle all")}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[#1ed760] px-3.5 text-xs font-semibold text-black transition hover:brightness-110 active:scale-95"
          >
            <Shuffle className="h-3.5 w-3.5" />
            Shuffle all
          </button>
          <Link
            href="/liked"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 text-xs font-medium text-white transition hover:bg-white/[0.14] active:scale-95"
          >
            <Heart className="h-3.5 w-3.5 text-[#1ed760]" />
            Liked songs
          </Link>
          <Link
            href="/library?tab=local"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 text-xs font-medium text-white transition hover:bg-white/[0.14] active:scale-95"
          >
            <FolderOpen className="h-3.5 w-3.5 text-white/75" />
            Local files
          </Link>
          {!inNativeAndroid && (
            <a
              href="/api/download/android"
              download="sangeet-android.apk"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[#1ed760]/30 bg-[#1ed760]/10 px-3.5 text-xs font-semibold text-[#1ed760] transition hover:bg-[#1ed760]/20 active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              Download APK
            </a>
          )}
        </div>
      </header>

      {/* Spotify-style 2-column compact Quick-Pick Grid */}
      {quickPicks.length > 0 && (
        <section aria-label="Quick picks" className="mb-8 sm:mb-10">
          <div className="mb-3 flex items-center gap-2">
            <Flame className="h-4 w-4 text-[#1ed760]" />
            <h2 className="text-lg font-bold tracking-[-0.025em] sm:text-xl">
              {recentTracks.length >= 4 ? "Jump back in" : "Quick picks"}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
            {quickPicks.slice(0, 6).map((track) => {
              const isCurrent = currentTrackId === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => {
                    if (isCurrent) togglePlay();
                    else playTrack(track.id, quickPicks.map((t) => t.id), "Quick picks");
                  }}
                  aria-label={`${isCurrent && isPlaying ? "Pause" : "Play"} ${track.title}`}
                  className={cn(
                    "group flex h-14 min-w-0 items-center gap-2.5 overflow-hidden rounded-lg bg-white/[0.06] pr-2.5 text-left transition hover:bg-white/[0.1] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isCurrent && "bg-white/[0.12] ring-1 ring-[#1ed760]/35",
                  )}
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-[#18181c]">
                    <Artwork src={track.artwork} alt="" priority className="h-full w-full object-cover" />
                    <span
                      className={cn(
                        "absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity",
                        isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                      )}
                    >
                      {isCurrent && isPlaying ? (
                        <Pause className="h-4 w-4 fill-white text-white" />
                      ) : (
                        <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
                      )}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "line-clamp-2 min-w-0 flex-1 text-[12px] font-semibold leading-tight sm:text-[13px]",
                      isCurrent ? "text-[#1ed760]" : "text-white",
                    )}
                  >
                    {track.title}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Featured Playlists */}
      {featuredPlaylists.length > 0 && (
        <section className="section-space" aria-label="Featured playlists">
          <SectionHeader
            title="Featured Playlists"
            eyebrow="Curated & trending"
            description="The most played playlists on Sangeet and YouTube Music."
            href="/explore"
          />
          <div className="-mx-3.5 flex gap-3 overflow-x-auto px-3.5 pb-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0 sm:pb-0 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 [&>*]:w-[144px] [&>*]:shrink-0 sm:[&>*]:w-auto">
            {featuredPlaylists.slice(0, 6).map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        </section>
      )}

      {/* Popular Singers & Artists */}
      {popularSingers.length > 0 && (
        <section className="section-space" aria-label="Popular singers and artists">
          <SectionHeader
            title="Popular Artists"
            eyebrow="Global & Regional Icons"
            description="Explore discography, albums, and top songs."
            href="/explore"
          />
          <div className="-mx-3.5 flex gap-3 overflow-x-auto px-3.5 pb-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0 sm:pb-0 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 [&>*]:w-[144px] [&>*]:shrink-0 sm:[&>*]:w-auto">
            {popularSingers.slice(0, 6).map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </section>
      )}

      {/* Popular Albums */}
      {popularAlbumsList.length > 0 && (
        <section className="section-space" aria-label="Popular albums">
          <SectionHeader
            title="Popular Albums"
            eyebrow="Essential releases"
            description="Full-length records with original tracklists and high-res covers."
            href="/explore"
          />
          <div className="-mx-3.5 flex gap-3 overflow-x-auto px-3.5 pb-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0 sm:pb-0 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 [&>*]:w-[144px] [&>*]:shrink-0 sm:[&>*]:w-auto">
            {popularAlbumsList.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        </section>
      )}

      {/* Picked for you from preferences */}
      {preferredArtistIds.length > 0 && (
        <section className="section-space" aria-label="Recommended from your artist picks">
          <SectionHeader title="Picked for you" eyebrow="Your artist picks" description="Songs from the artists you chose." href="/library" />
          {artistTrackIds.length ? (
            <div className="rounded-xl border border-white/[.06] bg-white/[.015] px-2 py-2 sm:px-4">
              <TrackList trackIds={artistTrackIds} label="Songs from your chosen artists" showAlbum />
            </div>
          ) : (
            <p className="rounded-xl border border-white/[.06] bg-white/[.025] p-4 text-sm text-muted-foreground">
              {loadingArtistTracks ? "Finding songs from your artists…" : "We couldn’t load artist recommendations right now. Try Search or Explore."}
            </p>
          )}
        </section>
      )}

      {/* Regional Live Music */}
      <LiveMusicHome />

      {/* Independent Music */}
      <OpenMusicHome />
    </div>
  );
}
