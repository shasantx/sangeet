"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, AudioLines, Headphones, Search, Sparkles, Play, Library, Heart, MonitorDown, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { albums, getArtist, selectedAlbums } from "@/lib/catalog";
import { useAuthStore } from "@/store/auth-store";
import { Artwork } from "@/components/music/artwork";
import { AlbumCard } from "@/components/music/album-card";
import { toast } from "@/store/ui-store";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function InstallAppButton({ label }: { label: string }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    return () => window.removeEventListener("beforeinstallprompt", capturePrompt);
  }, []);

  const install = async () => {
    if (!installPrompt) {
      toast.info("Install Sangeet", "Open your browser menu and choose Install app or Add to Home screen.");
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return <button type="button" onClick={() => void install()} className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-white/[.08] px-4 text-xs font-semibold text-white transition hover:bg-white/[.13]"><Smartphone className="h-4 w-4" />{label}</button>;
}

export default function WelcomePage() {
  const router = useRouter();
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const featured = selectedAlbums[0] ?? albums[0];
  const artist = featured ? getArtist(featured.artistId) : undefined;
  const listenOnline = () => {
    if (isAuthenticated) router.push("/home");
    else openAuthModal("signin");
  };

  return (
    <main className="min-h-screen bg-[#0b0c0b] text-white">
      <header className="sticky top-0 z-30 border-b border-white/[.06] bg-[#0b0c0b]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[64px] max-w-7xl items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Sangeet home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-[#17130c]"><AudioLines className="h-5 w-5" /></span>
            <span className="font-display text-xl font-semibold tracking-tight">Sangeet</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-white/60 md:flex" aria-label="Main navigation">
            <a href="#discover" className="transition hover:text-white">Discover</a>
            <a href="#features" className="transition hover:text-white">Features</a>
            <Link href="/plans" className="transition hover:text-white">Plans</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => openAuthModal("signin")} className="rounded-full px-3 py-2 text-xs font-semibold text-white/75 transition hover:text-white sm:px-4">Sign in</button>
            <button type="button" onClick={() => openAuthModal("signup")} className="rounded-full bg-white px-4 py-2.5 text-xs font-bold text-[#111] transition hover:scale-[1.02] sm:px-5">Sign up</button>
          </div>
        </div>
      </header>

      <section className="relative isolate min-h-[600px] overflow-hidden border-b border-white/[.05] sm:min-h-[680px]">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_78%_25%,rgba(30,215,96,.2),transparent_38%),radial-gradient(ellipse_at_10%_90%,rgba(97,124,107,.12),transparent_32%)]" />
        <div className="mx-auto grid min-h-[600px] max-w-7xl items-center gap-10 px-4 py-12 sm:min-h-[680px] sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_.95fr] lg:gap-12 lg:py-24">
          <div>
            <p className="eyebrow mb-5 flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /> A more personal way to listen</p>
            <h1 className="max-w-2xl font-display text-[2.65rem] font-semibold leading-[1.02] tracking-[-.055em] sm:text-6xl lg:text-[76px]">Let the next song <span className="text-primary">find you.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/55 sm:text-lg">A calmer place for discovery, albums, and the tracks you keep coming back to. Follow your mood, build a library that feels like yours, and press play.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={listenOnline} className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-[#17130c] transition hover:brightness-110"><Play className="h-4 w-4 fill-current" /> Listen online <ArrowRight className="h-4 w-4" /></button>
              <a href="#install" className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-medium text-white/80 transition hover:border-white/30 hover:bg-white/[.04]"><MonitorDown className="h-4 w-4" /> Get the app</a>
            </div>
            <p className="mt-4 text-xs text-white/35">Browse the catalog freely. Sign in with Google to start playback.</p>
          </div>

          {featured && (
            <div className="relative mx-auto w-full max-w-[440px]">
              <div aria-hidden="true" className="absolute -inset-10 -z-10 rounded-full bg-primary/[.12] blur-[70px]" />
              <div className="relative rounded-[28px] border border-white/[.09] bg-[#151612]/90 p-4 shadow-2xl backdrop-blur sm:p-5">
                <Artwork src={featured.artwork} alt={`${featured.title} album artwork`} className="aspect-square w-full rounded-xl" priority />
                <div className="flex items-end justify-between gap-4 px-1 pb-1 pt-4">
                  <div className="min-w-0"><p className="eyebrow mb-1">Featured from the catalog</p><p className="truncate font-display text-xl font-medium">{featured.title}</p><p className="mt-1 truncate text-sm text-white/50">{artist?.name ?? "Sangeet selection"}</p></div>
                  <Link href={`/album/${featured.id}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-[#17130c] transition hover:scale-105" aria-label={`Open ${featured.title}`}><ArrowRight className="h-4 w-4" /></Link>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-8 hidden items-center gap-3 rounded-2xl border border-white/10 bg-[#171814]/95 p-3 shadow-xl backdrop-blur sm:flex">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Headphones className="h-5 w-5" /></span>
                <span><span className="block text-xs font-semibold">Your next favorite</span><span className="mt-1 block text-[10px] text-white/45">A few taps away</span></span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section id="discover" className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
        <div className="mb-7 flex items-end justify-between gap-4"><div><p className="eyebrow mb-2">A few places to begin</p><h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Listen your way</h2></div><Link href="/explore" className="hidden items-center gap-1 text-xs font-medium text-white/50 transition hover:text-white sm:flex">Browse catalog <ArrowRight className="h-3.5 w-3.5" /></Link></div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{selectedAlbums.slice(0, 5).map((album) => <AlbumCard key={album.id} album={album} />)}</div>
      </section>

      <section id="features" className="border-y border-white/[.05] bg-white/[.015]">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-12 sm:px-8 md:grid-cols-3">
          {[
            { icon: Search, title: "Find your next favorite", text: "Search a broad catalog and explore new artists, albums, and sounds whenever the mood strikes." },
            { icon: Library, title: "Make it your own", text: "Save favorites, shape playlists, follow your listening history, and keep everything close at hand." },
            { icon: Heart, title: "A player that stays out of the way", text: "Settle into your music with a clean listening space, familiar controls, and your queue always nearby." },
          ].map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-white/[.06] bg-[#10110e] p-5 sm:p-6"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><h3 className="mt-5 font-display text-lg font-medium">{title}</h3><p className="mt-2 text-sm leading-relaxed text-white/50">{text}</p></article>)}
        </div>
      </section>

      <section id="install" className="mx-auto grid max-w-7xl gap-5 px-5 py-14 sm:grid-cols-2 sm:px-8 sm:py-16">
        <article className="rounded-2xl border border-white/[.07] bg-[#10110e] p-6 sm:p-8">
          <MonitorDown className="h-6 w-6 text-primary" />
          <h2 className="mt-4 font-display text-2xl font-semibold">Sangeet on desktop</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/50">Install Sangeet from your browser to keep it close, with its own window and app icon.</p>
          <InstallAppButton label="Install for desktop" />
        </article>
        <article className="rounded-2xl border border-white/[.07] bg-[#10110e] p-6 sm:p-8">
          <Smartphone className="h-6 w-6 text-primary" />
          <h2 className="mt-4 font-display text-2xl font-semibold">Sangeet on Android</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/50">Install the web app from Chrome on Android. No separate APK download is provided.</p>
          <InstallAppButton label="Install for Android" />
        </article>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>Sangeet · Independent music discovery</span>
        <div className="flex gap-5"><Link href="/search" className="transition hover:text-white">Search</Link><Link href="/explore" className="transition hover:text-white">Explore</Link><Link href="/plans" className="transition hover:text-white">Plans</Link></div>
      </footer>
    </main>
  );
}
