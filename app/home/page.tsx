"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, Flame, Heart, History, Music, Search, Shuffle, Trophy } from "lucide-react";
import {
  albums,
  artists,
  featuredPlaylists,
  getArtist,
  getTracks,
  tracks,
} from "@/lib/catalog";
import { getFirstName, getGreeting } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useAppStore } from "@/store/app-store";
import { useLibraryStore } from "@/store/library-store";
import { AlbumCard } from "@/components/music/album-card";
import { ArtistCard } from "@/components/music/artist-card";
import { PlaylistCard } from "@/components/music/playlist-card";
import { QuickTrackTile } from "@/components/music/quick-track-tile";
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
    <div className="page-container max-w-[1480px] pt-8 sm:pt-10">
      <InstallPromptBanner />
      <header className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
            {greeting}{displayName ? `, ${getFirstName(displayName)}` : ""}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Pick up where you left off, or start a mix.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => usePlayerStore.getState().playShuffled(tracks.map((t) => t.id), "Shuffle all")}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white text-black px-3.5 text-xs font-semibold transition hover:bg-white/90"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Shuffle all
            </button>
            <Link
              href="/liked"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-xs font-medium text-foreground transition hover:bg-white/[0.08]"
            >
              <Heart className="h-3.5 w-3.5 text-[#1ed760]" />
              Liked songs
            </Link>
            <Link
              href="/recently-played"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-xs font-medium text-foreground transition hover:bg-white/[0.08]"
            >
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              History
            </Link>
            {!inNativeAndroid && (
              <a
                href="/api/download/android"
                download="sangeet-android.apk"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#1ed760]/30 bg-[#1ed760]/10 px-3.5 text-xs font-semibold text-[#1ed760] transition hover:bg-[#1ed760]/20"
              >
                <Download className="h-3.5 w-3.5" />
                Download APK
              </a>
            )}
          </div>
        </div>
        <Link
          href="/search"
          className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 sm:self-auto"
        >
          <Search className="h-4 w-4" /> Find music <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      {/* Quick Picks / Continue Listening */}
      {quickPicks.length > 0 && (
        <section aria-label="Quick picks" className="mb-10">
          <div className="mb-3 flex items-center gap-2">
            <Flame className="h-4 w-4 text-primary" />
            <h2 className="text-xl font-semibold tracking-[-.025em]">
              {recentTracks.length >= 4 ? "Continue listening" : "Popular quick picks"}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 sm:gap-2.5">
            {quickPicks.map((track) => (
              <QuickTrackTile
                key={track.id}
                track={track}
                contextIds={quickPicks.map((t) => t.id)}
                contextLabel="Quick picks"
              />
            ))}
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
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
