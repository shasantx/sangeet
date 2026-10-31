"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Headphones, Search, Sparkles } from "lucide-react";
import { albums, getAlbum, getArtist, getTracks, selectedAlbums, playlists, tracks } from "@/lib/catalog";
import { dailyMixes } from "@/lib/mixes";
import { getFirstName, getGreeting } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useAppStore } from "@/store/app-store";
import { useLibraryStore } from "@/store/library-store";
import { AlbumCard } from "@/components/music/album-card";
import { MixCard } from "@/components/music/mix-card";
import { PlayButton } from "@/components/music/play-button";
import { QuickTrackTile } from "@/components/music/quick-track-tile";
import { SectionHeader } from "@/components/music/section-header";
import { TrackList } from "@/components/music/track-list";
import { Artwork } from "@/components/music/artwork";
import { registerYouTubeSearchResult, type YouTubeSearchResult } from "@/lib/dynamic-tracks";

const selectionTrackIds = ["t07", "t16", "t04", "t28", "t22", "t01", "t25", "t10"];

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
    return ids.length ? ids.slice(0, 6) : tracks.slice(0, 6).map((track) => track.id);
  }, [recentlyPlayed, likedTrackIds]);
  const recentTracks = getTracks(recentIds);
  const heroAlbum = selectedAlbums[0] ?? albums[0];
  const heroArtist = heroAlbum ? getArtist(heroAlbum.artistId) : undefined;

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
        return (payload.results ?? []).slice(0, 4).map((result) => registerYouTubeSearchResult(result).id);
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

      <section aria-label="Quick access" className="grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {recentTracks.map((track) => <QuickTrackTile key={track.id} track={track} contextIds={recentIds} contextLabel="Your listening" />)}
      </section>

      {preferredArtistIds.length > 0 && (
        <section className="section-space" aria-label="Recommended from your artist picks">
          <SectionHeader title="Picked for you" eyebrow="Your artist picks" description="Songs from the artists you chose." href="/library" />
          {artistTrackIds.length ? <div className="rounded-xl border border-white/[.06] bg-white/[.015] px-2 py-2 sm:px-4"><TrackList trackIds={artistTrackIds} label="Songs from your chosen artists" showAlbum /></div> : (
            <p className="rounded-xl border border-white/[.06] bg-white/[.025] p-4 text-sm text-muted-foreground">{loadingArtistTracks ? "Finding songs from your artists…" : "We couldn’t load artist recommendations right now. Try Search or Explore."}</p>
          )}
        </section>
      )}

      {heroAlbum && (
        <section className="relative mt-10 grid overflow-hidden rounded-2xl border border-white/[.07] bg-[#151b17] md:min-h-[300px] md:grid-cols-[1fr_300px]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_15%,rgba(96,190,120,.18),transparent_50%)]" />
          <div className="relative flex flex-col items-start justify-center p-6 sm:p-9 lg:p-11">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-white/65">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Sangeet selection
            </span>
            <h2 className="mt-5 max-w-xl text-3xl font-semibold leading-tight tracking-[-.045em] sm:text-4xl">A good place to start listening.</h2>
            <p className="mt-2 text-sm text-white/60">{heroAlbum.title}{heroArtist ? ` · ${heroArtist.name}` : ""}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <PlayButton trackIds={heroAlbum.trackIds} label={heroAlbum.title} size="md" />
              <Link href={`/album/${heroAlbum.id}`} className="inline-flex h-11 items-center rounded-full border border-white/15 px-5 text-sm font-medium text-white/85 transition hover:bg-white/[.08]">View album</Link>
            </div>
          </div>
          <Link href={`/album/${heroAlbum.id}`} className="relative order-first mx-auto w-full max-w-[220px] p-5 sm:max-w-[260px] md:order-last md:mx-0 md:max-w-none md:p-8" aria-label={`Open ${heroAlbum.title}`}>
            <Artwork src={heroAlbum.artwork} alt={`${heroAlbum.title} cover`} priority className="aspect-square w-full rounded-xl shadow-2xl" />
          </Link>
        </section>
      )}

      <section className="section-space">
        <SectionHeader title="A mix for the moment" eyebrow="Sangeet mixes" description="Curated listening paths from the bundled catalog." href="/made-for-you" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {dailyMixes.slice(0, 3).map((mix) => <MixCard key={mix.id} mix={mix} />)}
        </div>
      </section>

      <section className="section-space">
        <SectionHeader title="A few to explore" eyebrow="Selected from the catalog" href="/explore" />
        <div className="rounded-xl border border-white/[.06] bg-white/[.015] px-2 py-2 sm:px-4">
          <TrackList trackIds={selectionTrackIds} label="Selected tracks" showAlbum />
        </div>
      </section>

      <section className="section-space">
        <SectionHeader title="Albums for a closer listen" eyebrow="From the catalog" href="/new-releases" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {selectedAlbums.slice(0, 5).map((album) => <AlbumCard key={album.id} album={album} />)}
        </div>
      </section>

      <section className="section-space pb-3">
        <SectionHeader title="Curated playlists" eyebrow="Playlists" href="/explore" />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {playlists.filter((playlist) => playlist.featured).slice(0, 6).map((playlist) => {
            const firstTrack = getTracks(playlist.trackIds.slice(0, 1))[0];
            return (
              <Link key={playlist.id} href={`/playlist/${playlist.id}`} className="group flex min-w-0 items-center gap-3 rounded-lg border border-white/[.04] bg-white/[.025] p-2 transition hover:bg-white/[.06]">
                <Artwork src={firstTrack?.artwork ?? playlist.artwork} alt="" className="h-14 w-14 shrink-0 rounded-md" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{playlist.title}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{playlist.description}</span></span>
                <Headphones className="mr-2 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
              </Link>
            );
          })}
        </div>
      </section>
      <p className="mt-12 border-t border-white/[.06] pt-5 text-xs text-muted-foreground">Sangeet is an independent music discovery experience.</p>
    </div>
  );
}
