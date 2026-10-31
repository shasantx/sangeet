"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle, Play } from "lucide-react";
import { getArtist, tracks } from "@/lib/catalog";
import { usePlayerStore } from "@/store/player-store";
import { Artwork } from "@/components/music/artwork";
import type { Track } from "@/lib/types";

export function MusicDiscovery({ liveTracks, loading }: { liveTracks: Track[]; loading: boolean }) {
  const bundledApiTracks = useMemo(() => tracks.filter((track) => track.youtubeId && track.source === "youtube"), []);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const visibleTracks = liveTracks.length ? liveTracks : bundledApiTracks.slice(0, 15);
  const trackIds = visibleTracks.map((track) => track.id);

  return <section aria-labelledby="api-discovery-title">
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="eyebrow mb-3 text-primary">Nepali · Hindi · and everywhere</p><h2 id="api-discovery-title" className="font-display text-3xl font-semibold tracking-[-.05em] sm:text-5xl">Find your next favorite.</h2><p className="mt-3 max-w-xl text-sm text-white/45 sm:text-base">Start with the sounds you know. Follow the trail to something new, with artwork for every discovery.</p></div>
      <Link href="/search" className="group inline-flex items-center gap-2 text-sm font-semibold text-white/65 transition hover:text-primary">Search the catalog <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
    </div>
    {loading && <p className="mb-3 flex items-center gap-2 text-xs text-white/40"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Refreshing music and artwork</p>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
      {visibleTracks.slice(0, 10).map((track, index) => {
        const artist = getArtist(track.artistId);
        return <article key={track.id} className="group min-w-0 rounded-2xl border border-white/[.06] bg-white/[.025] p-2.5 transition hover:-translate-y-1 hover:border-primary/20 hover:bg-white/[.045] sm:p-3">
          <div className="relative overflow-hidden rounded-xl">
            <Artwork src={track.artwork} alt={`${track.title} cover art`} priority={index < 2} className="aspect-square w-full" />
            <button type="button" onClick={() => playTrack(track.id, trackIds, "Fresh finds")} aria-label={`Play ${track.title}`} className="absolute bottom-2 right-2 flex h-10 w-10 translate-y-1 items-center justify-center rounded-full bg-primary text-black opacity-100 shadow-lg transition sm:translate-y-2 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100"><Play className="ml-0.5 h-4 w-4 fill-current" /></button>
          </div>
          <p className="mt-3 truncate text-sm font-semibold text-white">{track.title}</p>
          <p className="mt-1 truncate text-xs text-white/45">{artist?.name ?? "Featured artist"}</p>
        </article>;
      })}
    </div>
  </section>;
}
