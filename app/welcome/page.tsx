"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SangeetMark } from "@/components/brand/sangeet-mark";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowRight, AudioLines, Github, Heart, MonitorDown, Play, Smartphone } from "lucide-react";
import { getArtist, tracks } from "@/lib/catalog";
import { registerYouTubeSearchResults, type YouTubeSearchResult } from "@/lib/dynamic-tracks";
import type { Track } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";
import { Artwork } from "@/components/music/artwork";
import { MusicDiscovery } from "@/components/landing/music-discovery";
import { DonationSection } from "@/components/support/donation-section";
import { toast } from "@/store/ui-store";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function InstallAppButton({ label, icon: Icon }: { label: string; icon: typeof Smartphone }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
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
  return <button type="button" onClick={() => void install()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-semibold text-white/85 transition hover:border-primary/60 hover:bg-primary/10"><Icon className="h-4 w-4 text-primary" />{label}</button>;
}

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();
  return <motion.div
    className={className}
    initial={reduceMotion ? false : { opacity: 0, y: 22, filter: "blur(8px)" }}
    whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
    viewport={{ once: true, amount: 0.18, margin: "0px 0px -55px 0px" }}
    transition={{ duration: reduceMotion ? 0 : 0.58, delay: reduceMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
  >{children}</motion.div>;
}

export default function WelcomePage() {
  const router = useRouter();
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [discoveryTracks, setDiscoveryTracks] = useState<Track[]>([]);
  const [discovering, setDiscovering] = useState(true);
  const heroTracks = discoveryTracks.length ? discoveryTracks.slice(0, 3) : tracks.filter((track) => track.youtubeId).slice(0, 3);
  const apiTracks = heroTracks;
  const heroRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const artworkY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : 110]);
  const artworkScale = useTransform(scrollYProgress, [0, 1], [1, reduceMotion ? 1 : 0.92]);
  const glowOneY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : 130]);
  const glowTwoY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : -95]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all(["Nepali songs", "Hindi songs"].map(async (query) => {
      try {
        const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) return [];
        const payload = await response.json() as { results?: YouTubeSearchResult[] };
        return payload.results ?? [];
      } catch {
        return [];
      }
    })).then((groups) => {
      if (controller.signal.aborted) return;
      const nepali = registerYouTubeSearchResults(groups[0] ?? []);
      const hindi = registerYouTubeSearchResults(groups[1] ?? []);
      const mixed = [...nepali.slice(0, 2), ...hindi.slice(0, 2), ...nepali.slice(2), ...hindi.slice(2)];
      setDiscoveryTracks(Array.from(new Map(mixed.map((track) => [track.id, track])).values()));
      setDiscovering(false);
    });
    return () => controller.abort();
  }, []);

  const listenOnline = () => {
    if (isAuthenticated) router.push("/home");
    else openAuthModal("signin");
  };
  const signUp = () => openAuthModal("signup");

  return (
    <main className="min-h-screen overflow-hidden bg-[#0b0c0b] text-white selection:bg-primary/40">
      <header className="sticky top-0 z-40 border-b border-white/[.055] bg-[#0b0c0b]/85 backdrop-blur-lg">
        <div className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between gap-3 px-5 sm:h-[78px] sm:px-9">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Sangeet home">
            <SangeetMark size={38} />
            <span className="font-display text-[19px] font-semibold tracking-[-.045em]">Sangeet</span>
          </Link>
          <nav className="hidden items-center gap-9 text-[13px] text-white/60 md:flex" aria-label="Landing page">
            <a href="#discover" className="transition hover:text-white">Discover</a>
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#opensource" className="transition hover:text-white">Open source</a>
            <a href="#install" className="transition hover:text-white">Get the app</a>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <a href="https://github.com/shasantx/sangeet" target="_blank" rel="noopener noreferrer" className="hidden items-center gap-2 rounded-full px-3 py-2.5 text-xs font-semibold text-white/70 transition hover:text-white lg:inline-flex"><Github className="h-4 w-4" />GitHub</a>
            <button type="button" onClick={() => openAuthModal("signin")} className="rounded-full px-3 py-2.5 text-xs font-semibold text-white/70 transition hover:text-white sm:px-4">Log in</button>
            <button type="button" onClick={signUp} className="rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-black transition hover:brightness-110 active:scale-[.98] sm:px-5">Join free</button>
          </div>
        </div>
      </header>

      <section ref={heroRef} className="relative isolate overflow-hidden border-b border-white/[.06]">
        <motion.div aria-hidden="true" style={reduceMotion ? undefined : { y: glowOneY }} className="pointer-events-none absolute -left-20 top-[-180px] -z-10 h-[520px] w-[520px] rounded-full bg-primary/20 blur-[130px]" />
        <motion.div aria-hidden="true" style={reduceMotion ? undefined : { y: glowTwoY }} className="pointer-events-none absolute -right-28 top-[220px] -z-10 h-[460px] w-[460px] rounded-full bg-sky-400/10 blur-[130px]" />
        <div className="relative mx-auto max-w-[1320px] px-5 pb-20 pt-16 text-center sm:px-9 sm:pb-28 sm:pt-24">
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .42 }} className="eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[.06] px-4 py-2 text-primary backdrop-blur-md"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Free listening · Open source</motion.p>
          <motion.h1 initial={{ opacity: 0, y: 16, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: .66, delay: .05, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-5xl font-display text-[clamp(3.3rem,8vw,7rem)] font-medium leading-[.93] tracking-[-.075em]">The songs you love,<br /><span className="bg-gradient-to-r from-primary via-emerald-200 to-sky-300 bg-clip-text text-transparent">always within reach.</span></motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, delay: .16 }} className="mx-auto mt-6 max-w-2xl text-[15px] leading-7 text-white/58 sm:text-[17px]">A listening home rooted in Nepali and Hindi music, open to every language, artist, and mood. No paid tiers—just music, discovery, and your own library.</motion.p>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .46, delay: .24 }} className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={listenOnline} className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-primary px-6 text-sm font-bold text-black transition hover:brightness-110 active:scale-[.98]"><Play className="h-4 w-4 fill-current" />Listen free<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></button>
            <a href="https://github.com/shasantx/sangeet" target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 px-6 text-sm font-semibold text-white/85 transition hover:border-white/35 hover:bg-white/[.04]"><Github className="h-4 w-4" />View the source</a>
          </motion.div>
          <motion.div style={reduceMotion ? undefined : { y: artworkY, scale: artworkScale }} initial={{ opacity: 0, y: 24, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: .72, delay: .18, ease: [0.22, 1, .36, 1] }} className="relative mx-auto mt-16 max-w-[1040px] text-left sm:mt-20">
            <div aria-hidden="true" className="absolute -inset-10 -z-10 rounded-[40px] bg-primary/[.08] blur-[80px]" />
            <div className="overflow-hidden rounded-[24px] border border-white/[.1] bg-[#0c0f0c]/80 p-3 shadow-[0_35px_100px_rgba(0,0,0,.5)] backdrop-blur-2xl sm:rounded-[30px] sm:p-5">
              <div className="mb-4 flex items-center justify-between border-b border-white/[.07] px-1 pb-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-400/80"/><span className="h-2 w-2 rounded-full bg-amber-300/80"/><span className="h-2 w-2 rounded-full bg-primary/90"/><span className="ml-2 text-[10px] text-white/35 sm:text-xs">Sangeet · Nepali, Hindi &amp; more</span></div><span className="hidden text-[10px] uppercase tracking-[.15em] text-white/35 sm:block">Your music space</span></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{heroTracks.map((track,index)=><button key={track.id} type="button" onClick={listenOnline} className={`group relative overflow-hidden rounded-[16px] border border-white/[.06] bg-white/[.025] text-left transition duration-500 hover:-translate-y-1 hover:border-primary/35 ${index>1?"hidden sm:block":""}`}><Artwork src={track.artwork} alt={`${track.title} artwork`} priority={index<2} className="aspect-square w-full transition-transform duration-700 group-hover:scale-[1.04]"/><span className="block p-3 sm:p-4"><span className="block truncate text-sm font-semibold text-white">{track.title}</span><span className="mt-1 block truncate text-xs text-white/45">{getArtist(track.artistId)?.name ?? "Sangeet discovery"}</span></span></button>)}</div>
            </div>
            <div className="mt-4 flex items-center justify-between px-1 text-[10px] uppercase tracking-[.16em] text-white/35"><span>A familiar song can feel like home</span><span className="hidden sm:inline">Discover · Save · Listen</span></div>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .45 }} className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[11px] font-medium text-white/40"><span className="text-primary">NEPALI</span><span className="text-white/20">/</span><span className="text-primary">HINDI</span><span className="text-white/20">/</span><span>ENGLISH &amp; MORE</span></motion.div>
        </div>
        <a href="#discover" aria-label="Scroll to discover music" className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 items-center text-white/35 transition hover:text-white/75 sm:flex"><ArrowDown className="h-4 w-4" /></a>
      </section>
      <section className="border-b border-white/[.06] bg-[#111411]">
        <Reveal className="mx-auto max-w-4xl px-5 py-16 text-center sm:px-9 sm:py-20">
          <p className="eyebrow mb-4 text-primary">Rooted here. Open to everywhere.</p>
          <h2 className="font-display text-3xl font-medium leading-tight tracking-[-.055em] text-white sm:text-5xl">Nepali and Hindi, at the heart of it.<br className="hidden sm:block" /><span className="text-white/45">Every other sound, right alongside.</span></h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-white/45 sm:text-base">Find songs by language, mood, artist, or the memory they bring back.</p>
        </Reveal>
      </section>
      <section id="features" className="relative overflow-hidden border-b border-white/[.06] bg-[#101310]">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_8%_50%,rgba(30,215,96,.1),transparent_36%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-9 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:gap-24 lg:py-28">
          <Reveal className="relative mx-auto w-full max-w-[560px] lg:order-1">
            <div className="relative overflow-hidden rounded-[22px] border border-white/[.09] bg-[#111511] p-3 shadow-[0_28px_80px_rgba(0,0,0,.38)] sm:rounded-[26px] sm:p-4">
              <div className="overflow-hidden rounded-[16px] bg-[#0c0e0c] p-3.5 sm:p-4">
                <div className="flex items-center justify-between border-b border-white/[.06] pb-3 text-[10px] text-white/45"><span>YOUR LIBRARY</span><span className="text-primary">RECENTLY ADDED</span></div>
                <div className="mt-3 space-y-2.5">{apiTracks.map((track) => <div key={track.id} className="flex items-center gap-3 rounded-xl bg-white/[.035] p-2"><Artwork src={track.artwork} alt={`${track.title} cover`} className="h-12 w-12 shrink-0 rounded-lg" /><span className="min-w-0"><span className="block truncate text-xs font-medium">{track.title}</span><span className="mt-1 block truncate text-[10px] text-white/40">Track · {getArtist(track.artistId)?.name}</span></span></div>)}</div>
                <div className="mt-4 rounded-xl border border-white/[.07] bg-[#171a17] p-3"><div className="flex items-center gap-2"><Heart className="h-3.5 w-3.5 fill-primary text-primary" /><span className="text-[10px] font-medium">Liked Songs</span></div><div className="mt-3 flex gap-1"><span className="h-1 flex-1 rounded-full bg-primary" /><span className="h-1 flex-1 rounded-full bg-primary/55" /><span className="h-1 flex-1 rounded-full bg-white/10" /><span className="h-1 flex-1 rounded-full bg-white/10" /></div></div>
              </div>
            </div>
          </Reveal>
          <Reveal className="max-w-xl lg:order-2">
            <p className="eyebrow mb-4 text-primary">01 / Your collection</p>
            <h2 className="font-display text-4xl font-medium leading-[1.02] tracking-[-.06em] sm:text-5xl lg:text-6xl">Keep the songs that feel like yours.</h2>
            <p className="mt-5 max-w-lg text-sm leading-relaxed text-white/55 sm:text-base">Save favorites, follow the voices you love, and build a library that changes with you. Everything you keep stays close at hand.</p>
            <Link href="/explore" className="group mt-7 inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:text-white">Explore the collection <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
          </Reveal>
        </div>
      </section>

      <section id="discover" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <Reveal><MusicDiscovery liveTracks={discoveryTracks} loading={discovering} /></Reveal>
      </section>

      <section className="relative isolate overflow-hidden border-y border-white/[.06] bg-[#101410]">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_18%_45%,rgba(30,215,96,.09),transparent_36%)]" />
        <div className="mx-auto grid max-w-[1320px] items-center gap-12 px-5 py-16 sm:px-9 sm:py-24 lg:grid-cols-[.9fr_1.1fr] lg:gap-20">
          <Reveal>
            <p className="eyebrow mb-4 text-primary">Find your way into the music</p>
            <h2 className="max-w-xl font-display text-4xl font-medium leading-[1.04] tracking-[-.06em] sm:text-5xl lg:text-[58px]">A song can take you somewhere.</h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-white/50 sm:text-base">Search by artist, album, or feeling. Save what stays with you, then let your library grow into something personal.</p>
            <Link href="/search" className="group mt-7 inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:text-white">Explore the music <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
          </Reveal>
          <Reveal className="relative mx-auto w-full max-w-[650px]">
            <div aria-hidden="true" className="absolute -inset-5 -z-10 rounded-[32px] bg-primary/[.06] blur-3xl" />
            <div className="overflow-hidden rounded-[22px] border border-white/[.09] bg-[#0c0f0c] shadow-[0_32px_90px_rgba(0,0,0,.4)]">
              <div className="flex items-center justify-between border-b border-white/[.07] px-4 py-3.5 sm:px-5"><div className="flex items-center gap-2"><SangeetMark size={24} /><span className="text-xs font-semibold">Your listening space</span></div><span className="text-[10px] text-white/35">MADE FOR YOU</span></div>
              <div className="grid grid-cols-[.9fr_1.1fr] gap-4 p-4 sm:gap-6 sm:p-6">
                <div className="relative aspect-square overflow-hidden rounded-xl"><Artwork src={heroTracks[0]?.artwork} alt={`${heroTracks[0]?.title ?? "Featured song"} cover`} priority className="h-full w-full" /><span className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" /><span className="absolute bottom-3 left-3 right-3"><span className="block truncate text-xs font-semibold">{heroTracks[0]?.title ?? "A song for the road"}</span><span className="mt-1 block truncate text-[10px] text-white/60">{heroTracks[0] ? getArtist(heroTracks[0].artistId)?.name : "Sangeet"}</span></span></div>
                <div className="flex min-w-0 flex-col justify-center"><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-primary">Your recent finds</p><div className="mt-3 space-y-3">{apiTracks.slice(0, 3).map((track) => <div key={track.id} className="flex min-w-0 items-center gap-2.5"><Artwork src={track.artwork} alt={`${track.title} cover`} className="h-9 w-9 shrink-0 rounded-md" /><span className="min-w-0"><span className="block truncate text-[10px] font-medium sm:text-xs">{track.title}</span><span className="mt-1 block truncate text-[9px] text-white/40">{getArtist(track.artistId)?.name}</span></span></div>)}</div><div className="mt-4 border-t border-white/[.07] pt-3"><div className="flex items-center gap-2 text-[10px] text-white/55"><Heart className="h-3.5 w-3.5 fill-primary text-primary" />Songs you keep</div><div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full w-2/3 rounded-full bg-primary" /></div></div></div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
      <section id="install" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <Reveal className="mb-9 max-w-2xl"><p className="eyebrow mb-3 text-primary">Take it with you</p><h2 className="font-display text-3xl font-semibold tracking-[-.05em] sm:text-5xl">Your music space, wherever you listen.</h2><p className="mt-4 text-sm leading-relaxed text-white/50 sm:text-base">Add Sangeet to your desktop or Android home screen. It opens like an app and keeps your listening close.</p></Reveal>
        <div className="grid gap-3 sm:grid-cols-2">
          {[{ icon: MonitorDown, title: "On desktop", text: "Install from your browser for a focused app window." }, { icon: Smartphone, title: "On Android", text: "Add Sangeet from Chrome to your home screen." }].map(({ icon: Icon, title, text }, index) => <Reveal key={title} delay={index * .08} className="group flex flex-col items-start rounded-2xl border border-white/[.07] bg-white/[.025] p-5 transition hover:border-primary/25 hover:bg-primary/[.035] sm:p-7"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-black"><Icon className="h-5 w-5" /></span><h3 className="mt-5 font-display text-xl font-medium">{title}</h3><p className="mt-2 max-w-sm text-sm leading-relaxed text-white/48">{text}</p><InstallAppButton label={`Install for ${title.replace("On ", "")}`} icon={Icon} /></Reveal>)}
        </div>
      </section>

      <section className="px-5 pb-16 sm:px-8 sm:pb-24">
        <Reveal className="relative mx-auto max-w-7xl overflow-hidden rounded-[28px] border border-primary/15 bg-[#111711] px-6 py-12 text-center sm:rounded-[36px] sm:px-12 sm:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_115%,rgba(30,215,96,.22),transparent_55%)]" />
          <span className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-black"><AudioLines className="h-5 w-5" /></span>
          <h2 className="relative mx-auto mt-5 max-w-2xl font-display text-3xl font-semibold tracking-[-.055em] sm:text-5xl">A better listening day starts with one song.</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-sm text-white/50 sm:text-base">Find a record, save a favorite, and make this space your own.</p>
          <button type="button" onClick={signUp} className="relative mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-black transition hover:brightness-110">Get started <ArrowRight className="h-4 w-4" /></button>
        </Reveal>
      </section>

      <DonationSection />

      <footer className="border-t border-white/[.07] bg-[#080908]">
        <div className="mx-auto grid max-w-7xl gap-9 px-5 py-10 sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:px-8 sm:py-14">
          <div><Link href="/" className="flex w-fit items-center gap-2.5" aria-label="Sangeet home"><SangeetMark size={36} /><span className="font-display text-lg font-semibold">Sangeet</span></Link><p className="mt-3 max-w-[220px] text-xs leading-relaxed text-white/38">A calmer home for the music you come back to.</p></div>
          {[{ title: "Discover", items: [["Explore", "/explore"], ["Search", "/search"], ["New releases", "/new-releases"]] }, { title: "Your music", items: [["Your library", "/library"], ["Liked songs", "/liked"], ["Made for you", "/made-for-you"]] }, { title: "Community", items: [["Support the project", "#support-project"], ["GitHub source", "https://github.com/shasantx/sangeet"], ["Sign in", "#signin"]] }].map((group) => <nav key={group.title} aria-label={group.title}><p className="mb-3 text-[10px] font-semibold uppercase tracking-[.16em] text-white/35">{group.title}</p><ul className="space-y-2.5">{group.items.map(([label, href]) => <li key={label}>{href.startsWith("#") ? <button type="button" onClick={() => href === "#support-project" ? document.getElementById("support-project")?.scrollIntoView({ behavior: "smooth" }) : openAuthModal("signin")} className="text-left text-xs text-white/55 transition hover:text-primary">{label}</button> : <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-white/55 transition hover:text-primary">{label}</a>}</li>)}</ul></nav>)}
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-white/[.06] px-5 py-4 text-[10px] text-white/30 sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>© {new Date().getFullYear()} Sangeet. Made for listening.</span><span>Independent music discovery experience</span><span>Made by <a href="https://shasant.xyz" target="_blank" rel="noopener noreferrer" className="font-medium text-white/55 transition hover:text-primary">Shasant ↗</a></span></div>
      </footer>
    </main>
  );
}
