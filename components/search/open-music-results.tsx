"use client";

import { useEffect, useState } from "react";
import { Disc3, LoaderCircle, Music2, Play } from "lucide-react";
import { Artwork } from "@/components/music/artwork";
import { getDynamicTrack, registerAudiusSearchResult, type AudiusSearchResult } from "@/lib/dynamic-tracks";
import { usePlayerStore } from "@/store/player-store";
import { cn } from "@/lib/utils";

const cache = new Map<string, AudiusSearchResult[]>();

function useOpenMusic(query: string) {
  const [results, setResults] = useState<AudiusSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setResults([]); setLoading(false); return; }
    const key = term.toLowerCase();
    const saved = cache.get(key);
    if (saved) { saved.forEach(registerAudiusSearchResult); setResults(saved); setLoading(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/audius/search?q=${encodeURIComponent(term)}&limit=12`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search unavailable");
        const payload = await response.json() as { results?: AudiusSearchResult[] };
        const items = (payload.results ?? []).filter((item) => item.id && item.title && item.audioUrl).slice(0, 12);
        cache.set(key, items);
        items.forEach(registerAudiusSearchResult);
        setResults(items);
      } catch { if (!controller.signal.aborted) setResults([]); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 280);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query]);
  return { results, loading };
}

export function OpenMusicSearchResults({ query }: { query: string }) {
  const { results, loading } = useOpenMusic(query);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const currentId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  if (query.trim().length < 2 || (!loading && results.length === 0)) return null;
  const registered = results.map((result) => getDynamicTrack(`aud-${result.id}`)).filter((track): track is NonNullable<typeof track> => Boolean(track));
  return <section className="mt-9" aria-label="Independent music search results">
    <div className="mb-4 flex items-center gap-2"><Music2 className="h-4 w-4 text-primary"/><h2 className="text-xl font-medium tracking-[-.025em]">Independent releases</h2>{loading && <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground"/>}</div>
    {results.length > 0 && <div className="overflow-hidden rounded-xl border border-white/[.06] bg-white/[.015]">{results.map((result, index) => { const track = registered[index]; const active = currentId === track.id; return <button key={result.id} type="button" onClick={() => playTrack(track.id, registered.map((row) => row.id), `Independent music · ${query.trim()}`)} className="group flex min-h-[66px] w-full items-center gap-3 border-b border-white/[.04] px-3 text-left transition hover:bg-white/[.045] last:border-0 sm:px-4">
      <span className="w-5 text-right text-[11px] tabular-nums text-muted-foreground">{index + 1}</span><Artwork src={result.artwork} alt={`${result.title} cover`} className="h-11 w-11 shrink-0 rounded-md"/><span className="min-w-0 flex-1"><span className={cn("block truncate text-sm font-medium", active && "text-primary")}>{result.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{result.artist}{result.album ? ` · ${result.album}` : ""}</span></span><span className="hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex"><Disc3 className="h-3.5 w-3.5"/>{result.genre || "Independent"}</span><span className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 group-hover:bg-primary group-hover:text-black">{active && isPlaying ? <span className="h-2 w-2 rounded-sm bg-current"/> : <Play className="h-4 w-4 fill-current"/>}</span>
    </button>; })}</div>}
  </section>;
}

function OpenMusicShelf({ query, title }: { query: string; title: string }) {
  const { results, loading } = useOpenMusic(query);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const tracks = results.map((result) => getDynamicTrack(`aud-${result.id}`)).filter((track): track is NonNullable<typeof track> => Boolean(track));
  if (!loading && !results.length) return null;
  return <section className="mt-9" aria-label={title}>
    <div className="mb-3 flex items-center gap-2"><Music2 className="h-4 w-4 text-primary"/><h3 className="text-lg font-medium tracking-[-.02em]">{title}</h3>{loading && !results.length && <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground"/>}</div>
    {results.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{results.slice(0, 6).map((result, index) => <button key={result.id} type="button" onClick={() => playTrack(tracks[index].id, tracks.map((track) => track.id), title)} className="group min-w-0 rounded-xl p-2 text-left transition hover:bg-white/[.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <span className="relative block"><Artwork src={result.artwork} alt={`${result.title} cover`} className="aspect-square w-full rounded-lg shadow-lg"/><span className="absolute bottom-2 right-2 flex h-10 w-10 translate-y-1 items-center justify-center rounded-full bg-primary text-black opacity-0 shadow-xl transition duration-200 group-hover:translate-y-0 group-hover:opacity-100"><Play className="ml-0.5 h-4 w-4 fill-current"/></span></span><span className="mt-3 block truncate text-[13px] font-semibold">{result.title}</span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{result.artist}</span>
    </button>)}</div>}
  </section>;
}

export function OpenMusicHome() {
  return <div className="section-space border-t border-white/[.06] pt-2"><div className="mb-2 flex items-center gap-2"><Music2 className="h-4 w-4 text-primary"/><p className="eyebrow">Independent music</p></div><p className="max-w-xl text-sm text-muted-foreground">New voices from the open music catalog, searchable and ready to play.</p><OpenMusicShelf query="Nepali" title="Nepali independent music"/><OpenMusicShelf query="Hindi" title="Hindi independent music"/></div>;
}
