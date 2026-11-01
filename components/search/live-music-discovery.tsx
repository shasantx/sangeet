"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Disc3, LoaderCircle, Music2, UsersRound } from "lucide-react";
import { Artwork } from "@/components/music/artwork";
import { registerYouTubeSearchResults, type YouTubeSearchResult } from "@/lib/dynamic-tracks";
import { usePlayerStore } from "@/store/player-store";

interface CatalogItem { browseId: string; title: string; artist: string; thumbnail: string; year?: number | null; type?: string; subscribers?: string }
interface LiveDetails { title: string; artist: string; description: string; thumbnail: string; year?: number | null; tracks: YouTubeSearchResult[] }

const cache = new Map<string, CatalogItem[]>();

function CatalogSection({ query, kind, title }: { query: string; kind: "artists" | "albums"; title: string }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2) { setItems([]); setLoading(false); return; }
    const key = `${kind}:${query.trim().toLowerCase()}`;
    const cached = cache.get(key);
    if (cached) { setItems(cached); setLoading(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/youtube/discover?q=${encodeURIComponent(query.trim())}&kind=${kind}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Discovery unavailable");
        const data = await response.json() as { results?: CatalogItem[] };
        const rows = (data.results ?? []).filter((row) => row.browseId && row.title).slice(0, 8);
        cache.set(key, rows);
        setItems(rows);
      } catch { if (!controller.signal.aborted) setItems([]); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 420);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, kind]);

  if (items.length === 0 && !loading) return null;
  const Icon = kind === "artists" ? UsersRound : Disc3;
  return <section className="mt-9" aria-label={`Live ${title.toLowerCase()} results`}>
    <div className="mb-4 flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><h2 className="text-xl font-medium tracking-[-.025em]">{title}</h2>{loading && <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />}</div>
    {items.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{items.map((item) => <Link key={item.browseId} href={`/${kind === "artists" ? "artist" : "album"}/ytm-${item.browseId}`} className="group min-w-0 rounded-xl p-2 transition hover:bg-white/[.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <Artwork src={item.thumbnail} alt={`${item.title} cover`} className={`aspect-square w-full shadow-lg ${kind === "artists" ? "rounded-full" : "rounded-lg"}`} imgClassName="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
      <span className="mt-3 block truncate text-[13px] font-semibold">{item.title}</span>
      <span className="mt-1 block truncate text-[11px] text-muted-foreground">{kind === "artists" ? (item.subscribers || "Artist") : [item.artist, item.year].filter(Boolean).join(" · ") || "Album"}</span>
    </Link>)}</div>}
  </section>;
}

export function LiveMusicDiscovery({ query }: { query: string }) {
  const cleaned = query.trim();
  if (cleaned.length < 2) return null;
  return <div className="mt-10 border-t border-white/[.06] pt-1"><CatalogSection query={cleaned} kind="artists" title="Artists" /><CatalogSection query={cleaned} kind="albums" title="Albums" /></div>;
}

export function LiveMusicHome() {
  return <section className="section-space border-y border-white/[.055] py-1" aria-label="Nepali and Hindi artist and album discovery">
    <p className="eyebrow mb-2">Fresh from the music catalog</p>
    <p className="mb-6 max-w-xl text-sm text-muted-foreground">Discover artists and albums across Nepali and Hindi music, with current artwork and tracks.</p>
    <CatalogSection query="Nepali music" kind="artists" title="Nepali artists" />
    <CatalogSection query="Nepali songs" kind="albums" title="Nepali albums" />
    <CatalogSection query="Hindi songs" kind="albums" title="Hindi albums" />
  </section>;
}

export function LiveCatalogPage({ kind, browseId }: { kind: "artist" | "album"; browseId: string }) {
  const [details, setDetails] = useState<LiveDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const trackIds = details ? details.tracks.map((track) => `yt-${track.videoId}`) : [];
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/youtube/details?kind=${kind}&browseId=${encodeURIComponent(browseId)}`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("Not available"); return response.json(); })
      .then((payload: { details?: LiveDetails }) => { if (!payload.details) throw new Error("Not available"); registerYouTubeSearchResults(payload.details.tracks); setDetails(payload.details); })
      .catch(() => { if (!controller.signal.aborted) setUnavailable(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, browseId]);

  if (loading) return <div className="page-container py-16"><div className="h-64 animate-pulse rounded-2xl bg-white/[.04]" /><p className="mt-4 text-sm text-muted-foreground">Loading {kind}…</p></div>;
  if (!details || unavailable) return <div className="page-container py-20"><h1 className="text-3xl font-semibold">This {kind} is unavailable right now.</h1><p className="mt-3 text-sm text-muted-foreground">Try searching again in a moment.</p><Link href="/search" className="mt-5 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-black">Search music</Link></div>;

  return <div className="page-container max-w-[1360px] pt-6 sm:pt-10">
    <Link href="/search" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-white">← Search</Link>
    <header className="relative isolate overflow-hidden rounded-2xl border border-white/[.07] bg-[#111713] p-5 sm:p-8 lg:p-10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_10%,rgba(30,215,96,.18),transparent_58%)]" />
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        {details.thumbnail && <Artwork src={details.thumbnail} alt={`${details.title} artwork`} className={`h-44 w-44 shrink-0 shadow-2xl sm:h-56 sm:w-56 ${kind === "artist" ? "rounded-full" : "rounded-xl"}`} priority />}
        <div className="min-w-0"><p className="eyebrow mb-3">{kind === "artist" ? "Artist" : details.year ? `Album · ${details.year}` : "Album"}</p>
          <h1 className="break-words font-display text-4xl font-semibold tracking-[-.05em] sm:text-6xl">{details.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{details.description || (kind === "album" ? details.artist : `Songs and releases by ${details.title}.`)}</p>
          <div className="mt-5 flex items-center gap-3"><button type="button" disabled={!trackIds.length} onClick={() => playTrack(trackIds[0], trackIds, details.title)} className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-40"><Music2 className="h-4 w-4" /> Play {kind === "artist" ? "songs" : "album"}</button><span className="text-sm text-muted-foreground">{trackIds.length} playable tracks</span></div>
        </div>
      </div>
    </header>
    <section className="mt-9"><h2 className="mb-4 text-2xl font-semibold tracking-tight">{kind === "artist" ? "Popular tracks" : "Track list"}</h2>
      {details.tracks.length ? <div className="overflow-hidden rounded-xl border border-white/[.06] bg-white/[.015]">{details.tracks.map((row, index) => { const track = registerYouTubeSearchResults([row])[0]; return <button key={row.videoId} type="button" onClick={() => playTrack(track.id, trackIds, details.title)} className="group flex min-h-[68px] w-full items-center gap-3 border-b border-white/[.045] px-3 text-left last:border-0 hover:bg-white/[.045] sm:gap-4 sm:px-4">
        <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{index + 1}</span><Artwork src={row.thumbnail || details.thumbnail} alt="" className="h-11 w-11 shrink-0 rounded-md" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium group-hover:text-primary">{row.title}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{row.artist || details.artist || details.title}</span></span><span className="text-xs tabular-nums text-muted-foreground">{row.durationSeconds ? `${Math.floor(row.durationSeconds / 60)}:${String(row.durationSeconds % 60).padStart(2, "0")}` : ""}</span>
      </button>; })}</div> : <p className="rounded-xl border border-white/[.06] p-5 text-sm text-muted-foreground">No playable tracks were returned for this {kind}.</p>}
    </section>
  </div>;
}
