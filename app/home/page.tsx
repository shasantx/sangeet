"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { getArtist, getTracks, tracks } from "@/lib/catalog";
import { getFirstName, getGreeting } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useAppStore } from "@/store/app-store";
import { useLibraryStore } from "@/store/library-store";
import { QuickTrackTile } from "@/components/music/quick-track-tile";
import { SectionHeader } from "@/components/music/section-header";
import { TrackList } from "@/components/music/track-list";
import { registerYouTubeSearchResult, type YouTubeSearchResult } from "@/lib/dynamic-tracks";
import { LiveMusicHome } from "@/components/search/live-music-discovery";
import { OpenMusicHome } from "@/components/search/open-music-results";

export default function HomePage() {
  const session = useAuthStore((state) => state.session);
  const preferredArtistIds = useAppStore((state) => state.preferredArtistIds);
  const recentlyPlayed = useLibraryStore((state) => state.recentlyPlayed);
  const likedTrackIds = useLibraryStore((state) => state.likedTrackIds);
  const [greeting, setGreeting] = useState("Good evening");
  const [artistTrackIds, setArtistTrackIds] = useState<string[]>([]);
  const [loadingArtistTracks, setLoadingArtistTracks] = useState(false);
  const displayName = session?.displayName;

  useEffect(() => setGreeting(getGreeting()), []);

  const recentIds = useMemo(() => {
    const ids = recentlyPlayed.length ? recentlyPlayed : likedTrackIds;
    return ids.slice(0, 6);
  }, [recentlyPlayed, likedTrackIds]);
  const recentTracks = getTracks(recentIds);

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
      <header className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Your listening space</p>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">{greeting}{displayName ? `, ${getFirstName(displayName)}` : ""}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Pick up where you left off, or find something new.</p>
        </div>
        <Link href="/search" className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 sm:self-auto">
          <Search className="h-4 w-4" /> Find music <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      {recentTracks.length > 0 && <section aria-label="Continue listening" className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {recentTracks.map((track) => <QuickTrackTile key={track.id} track={track} contextIds={recentIds} contextLabel="Your listening" />)}
      </section>}

      {preferredArtistIds.length > 0 && (
        <section className="section-space" aria-label="Recommended from your artist picks">
          <SectionHeader title="Picked for you" eyebrow="Your artist picks" description="Songs from the artists you chose." href="/library" />
          {artistTrackIds.length ? <div className="rounded-xl border border-white/[.06] bg-white/[.015] px-2 py-2 sm:px-4"><TrackList trackIds={artistTrackIds} label="Songs from your chosen artists" showAlbum /></div> : (
            <p className="rounded-xl border border-white/[.06] bg-white/[.025] p-4 text-sm text-muted-foreground">{loadingArtistTracks ? "Finding songs from your artists…" : "We couldn’t load artist recommendations right now. Try Search or Explore."}</p>
          )}
        </section>
      )}

      <OpenMusicHome />
      <LiveMusicHome />
    </div>
  );
}
