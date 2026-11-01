"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, Heart, ListMusic, LoaderCircle, Play, ShieldCheck, Unplug } from "lucide-react";
import { restoreYouTubeTrack } from "@/lib/dynamic-tracks";
import { usePlayerStore } from "@/store/player-store";
import { useAuthStore } from "@/store/auth-store";

type Entry = { id: string; title: string; channelTitle: string; description: string; thumbnail: string; itemCount?: number };

export default function MyYouTubeLibraryPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [section, setSection] = useState<"playlists" | "liked">("playlists");
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Entry | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const load = useCallback(async (kind: "playlists" | "liked", playlistId?: string, pageToken?: string) => {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ type: playlistId ? "playlist-items" : kind, ...(playlistId ? { playlistId } : {}), ...(pageToken ? { pageToken } : {}) });
      const response = await fetch(`/api/youtube/library?${query}`, { cache: "no-store" });
      const result = await response.json() as { items?: Entry[]; error?: string; nextPageToken?: string | null };
      if (!response.ok) throw new Error(result.error ?? "Could not load your YouTube library.");
      setItems((current) => pageToken ? [...current, ...(result.items ?? [])] : (result.items ?? []));
      setNextPageToken(result.nextPageToken ?? null);
    } catch (cause) { if (!pageToken) setItems([]); setError(cause instanceof Error ? cause.message : "Could not load your library."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetch("/api/youtube/connection", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { connected?: boolean; error?: string };
      if (!response.ok && result.error === "storage_unconfigured") setError("Finish the YouTube setup first: apply the connection migration and add YOUTUBE_TOKEN_ENCRYPTION_KEY to your server environment.");
      setConnected(Boolean(result.connected));
    }).catch(() => setConnected(false));
    const query = new URLSearchParams(window.location.search);
    if (query.has("youtube")) {
      const outcome = query.get("youtube");
      setError(outcome === "connected" ? "YouTube is connected. Choose a section to load your data." : "Could not connect YouTube. Check consent and try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [isAuthenticated]);

  useEffect(() => { if (connected) void load(section); }, [connected, section, load]);

  const disconnect = async () => {
    setLoading(true);
    const response = await fetch("/api/youtube/connection", { method: "DELETE" });
    if (response.ok) { setConnected(false); setItems([]); setSelected(null); }
    else setError("Could not disconnect right now. Try again.");
    setLoading(false);
  };

  const playEntry = (entry: Entry) => {
    const track = restoreYouTubeTrack({ videoId: entry.id, title: entry.title, artist: entry.channelTitle || "YouTube", thumbnail: entry.thumbnail });
    if (track) playTrack(track.id, [track.id], "My YouTube Library");
  };

  if (!isAuthenticated) return <main className="page-container max-w-3xl"><h1 className="text-3xl">Sign in to view your library</h1><p className="mt-3 text-muted-foreground">Your YouTube account is an optional, read-only connection.</p><Link className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 font-medium text-primary-foreground" href="/auth">Sign in</Link></main>;

  return <main className="page-container max-w-[1120px]">
    <Link href="/settings" className="mb-7 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"><ArrowLeft className="h-4 w-4"/>Settings</Link>
    <section className="relative isolate overflow-hidden rounded-[28px] border border-white/[.09] bg-[#121317] px-6 py-8 sm:px-10 sm:py-11">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-28 -z-10 h-72 w-72 rounded-full bg-primary/20 blur-[90px]"/>
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 left-1/3 -z-10 h-64 w-64 rounded-full bg-violet-500/10 blur-[90px]"/>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl"><p className="eyebrow flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-primary"/>Optional account connection</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.045em] sm:text-5xl">My YouTube Library</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Browse your own playlists and liked videos, then play eligible videos through YouTube’s official player. Sangeet never edits your YouTube account.</p></div>
        {connected && <button type="button" onClick={disconnect} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-sm transition hover:bg-white/[.06] disabled:opacity-50"><Unplug className="h-4 w-4"/>Disconnect</button>}
      </div>
      <div className="mt-7 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-2"><Check className="h-3.5 w-3.5 text-primary"/>Read-only access</span><span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-2">Refresh tokens stored encrypted on server</span></div>
      {connected === false && <a href="/api/youtube/connect" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:brightness-110"><ExternalLink className="h-4 w-4"/>Connect YouTube account</a>}
      {connected === null && <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin"/>Checking connection…</p>}
    </section>

    {connected && <section className="mt-9">
      <div className="flex flex-col gap-4 border-b border-white/[.08] pb-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Your collection</p><h2 className="mt-2 text-2xl font-medium">Browse what you saved</h2></div><div className="flex gap-2"><button onClick={() => {setSection("playlists"); setSelected(null);}} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm ${section === "playlists" ? "bg-white text-black" : "border border-white/10 text-muted-foreground hover:bg-white/[.05]"}`}><ListMusic className="h-4 w-4"/>Playlists</button><button onClick={() => {setSection("liked"); setSelected(null);}} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm ${section === "liked" ? "bg-white text-black" : "border border-white/10 text-muted-foreground hover:bg-white/[.05]"}`}><Heart className="h-4 w-4"/>Liked videos</button></div></div>
      {selected && <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="min-w-0"><p className="truncate font-medium">{selected.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{selected.itemCount ?? 0} videos · Playlist contents</p></div><button type="button" onClick={() => void load(section, selected.id)} className="min-h-10 rounded-full border border-white/10 px-4 text-xs">Load videos</button></div>}
      {loading && <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin"/>Loading from YouTube…</p>}
      {error && <p role="status" className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[.06] px-4 py-3 text-sm text-amber-100">{error}</p>}
      {!loading && !error && items.length === 0 && <p className="mt-7 rounded-2xl border border-white/[.07] bg-white/[.02] p-6 text-sm text-muted-foreground">Nothing to show here yet.</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((entry) => <article key={entry.id} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.025] p-3 transition hover:border-white/[.14] hover:bg-white/[.045]">{entry.thumbnail ? <img src={entry.thumbnail} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover"/> : <div className="h-14 w-14 shrink-0 rounded-xl bg-white/[.06]"/>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{entry.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{entry.channelTitle || `${entry.itemCount ?? 0} videos`}</p></div>{section === "playlists" && !selected ? <button type="button" aria-label={`Open ${entry.title}`} onClick={() => setSelected(entry)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground"><ListMusic className="h-4 w-4"/></button> : <button type="button" aria-label={`Play ${entry.title}`} onClick={() => playEntry(entry)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"><Play className="ml-0.5 h-4 w-4 fill-current"/></button>}</article>)}</div>
      {nextPageToken && <button type="button" disabled={loading} onClick={() => void load(section, selected?.id, nextPageToken)} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-5 text-sm transition hover:bg-white/[.05] disabled:opacity-50">{loading && <LoaderCircle className="h-4 w-4 animate-spin"/>}Load more</button>}
    </section>}
  </main>;
}
