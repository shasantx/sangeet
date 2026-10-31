"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SangeetMark } from "@/components/brand/sangeet-mark";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowRight, AudioLines, Compass, Headphones, Heart, Library, MonitorDown, Play, Search, Smartphone, Sparkles, Waves } from "lucide-react";
import { getArtist, tracks } from "@/lib/catalog";
import { registerYouTubeSearchResults, type YouTubeSearchResult } from "@/lib/dynamic-tracks";
import type { Track } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";
import { Artwork } from "@/components/music/artwork";
import { MusicDiscovery } from "@/components/landing/music-discovery";
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
    initial={reduceMotion ? false : { opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.18, margin: "0px 0px -55px 0px" }}
    transition={{ duration: reduceMotion ? 0 : 0.48, delay: reduceMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
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
      <header className="sticky top-0 z-40 border-b border-white/[.07] bg-[#0b0c0b]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[66px] max-w-7xl items-center justify-between gap-3 px-4 sm:h-[76px] sm:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Sangeet home">
            <SangeetMark size={38} />
            <span className="font-display text-xl font-semibold tracking-[-.04em]">Sangeet</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-white/60 md:flex" aria-label="Landing page">
            <a href="#discover" className="transition hover:text-white">Discover</a>
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#install" className="transition hover:text-white">Get the app</a>
            <Link href="/plans" className="transition hover:text-white">Plans</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button type="button" onClick={() => openAuthModal("signin")} className="rounded-full px-3 py-2.5 text-xs font-semibold text-white/70 transition hover:text-white sm:px-4">Log in</button>
            <button type="button" onClick={signUp} className="rounded-full bg-white px-4 py-2.5 text-xs font-bold text-[#10110f] transition hover:scale-[1.03] active:scale-[.98] sm:px-5">Sign up</button>
          </div>
        </div>
      </header>

      <section ref={heroRef} className="relative isolate min-h-[690px] overflow-hidden border-b border-white/[.06] sm:min-h-[760px] lg:min-h-[820px]">
        <div aria-hidden="true" className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_73%_42%,rgba(30,215,96,.16),transparent_38%),radial-gradient(ellipse_at_12%_10%,rgba(86,108,72,.15),transparent_38%),linear-gradient(180deg,#111511_0%,#0b0c0b_88%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-36 top-10 -z-10 h-[540px] w-[540px] rounded-full bg-primary/[.055] blur-[90px] sm:right-[7%] sm:top-16 sm:h-[650px] sm:w-[650px]" />
        <div className="mx-auto grid min-h-[690px] max-w-7xl items-center gap-5 px-5 pb-12 pt-12 sm:min-h-[760px] sm:px-8 sm:pb-16 lg:min-h-[820px] lg:grid-cols-[.95fr_1.05fr] lg:gap-2 lg:py-16">
          <div className="relative z-10 max-w-[640px]">
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }} className="eyebrow mb-5 flex items-center gap-2 text-primary"><span className="h-px w-7 bg-primary" />From Kathmandu to everywhere</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .62, delay: .06, ease: [0.22, 1, .36, 1] }} className="max-w-[680px] font-display text-[clamp(3.3rem,11vw,6.8rem)] font-semibold leading-[.91] tracking-[-.075em]">
              The songs<br className="hidden sm:block" />that bring you<br className="hidden sm:block" /><span className="text-primary">home.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, delay: .22 }} className="mt-6 max-w-[460px] text-[15px] leading-relaxed text-white/58 sm:text-lg">Nepali and Hindi favorites up front. English and the rest of the world, one search away. Find the songs you know and the ones you’ll keep.</motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, delay: .32 }} className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={listenOnline} className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-primary px-6 text-sm font-bold text-black shadow-[0_8px_34px_rgba(30,215,96,.2)] transition hover:brightness-110 active:scale-[.98]"><Play className="h-4 w-4 fill-current" />Listen online<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></button>
              <button type="button" onClick={signUp} className="inline-flex h-12 items-center rounded-full border border-white/15 px-6 text-sm font-semibold text-white/85 transition hover:border-white/35 hover:bg-white/[.04]">Create your account</button>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .5 }} className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/38"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Nepali <span className="text-white/20">/</span> Hindi <span className="text-white/20">/</span> English <span className="text-white/20">/</span> and more</motion.div>
          </div>

          <motion.div style={reduceMotion ? undefined : { y: artworkY, scale: artworkScale }} initial={{ opacity: 0, scale: .94, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: .9, delay: .18, ease: [0.22, 1, .36, 1] }} className="relative mx-auto w-full max-w-[410px] lg:max-w-[520px]">
            <div aria-hidden="true" className="absolute -inset-6 -z-10 rounded-[42px] bg-primary/[.1] blur-[50px] sm:-inset-10 sm:blur-[75px]" />
            <div className="relative overflow-hidden rounded-[28px] border border-white/[.12] bg-[#171a17]/90 p-4 shadow-[0_40px_100px_rgba(0,0,0,.55)] backdrop-blur-sm sm:rounded-[34px] sm:p-5">
              <div className="mb-4 flex items-end justify-between gap-3 px-1"><div><p className="eyebrow mb-1 text-primary">Your first listen</p><p className="font-display text-xl font-semibold tracking-tight sm:text-2xl">A little closer to home.</p></div><span className="text-[10px] font-medium text-white/40">NEPAL · INDIA · EVERYWHERE</span></div>
              <div className="grid grid-cols-2 grid-rows-2 gap-2.5 sm:gap-3">
                {heroTracks.map((track, index) => <button key={track.id} type="button" onClick={listenOnline} className={`group relative min-h-0 overflow-hidden rounded-2xl border border-white/[.06] text-left transition duration-300 hover:-translate-y-1 hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${index === 0 ? "row-span-2" : ""}`}>
                  <Artwork src={track.artwork} alt={`${track.title} cover art`} priority={index < 2} className="absolute inset-0 h-full w-full transition duration-500 group-hover:scale-[1.04]" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-transparent" />
                  <span className="absolute bottom-0 left-0 right-0 p-3 sm:p-4"><span className="block text-[9px] font-semibold uppercase tracking-[.14em] text-primary">{index === 0 ? "Nepali listening" : index === 1 ? "Hindi listening" : "Fresh discovery"}</span><span className="mt-1 block truncate font-display text-sm font-semibold text-white sm:text-base">{track.title}</span><span className="mt-0.5 block truncate text-[10px] text-white/70">{getArtist(track.artistId)?.name ?? "Sangeet selection"}</span></span>
                </button>)}
              </div>
              <button type="button" onClick={signUp} className="group mt-3 flex w-full items-center justify-between rounded-xl border border-white/[.08] bg-white/[.025] px-3.5 py-3 text-left transition hover:border-primary/25 hover:bg-primary/[.06]"><span><span className="block text-xs font-semibold">Choose the artists you love</span><span className="mt-1 block text-[10px] text-white/45">We’ll shape your first recommendations around them.</span></span><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-black"><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span></button>
            </div>
          </motion.div>
        </div>
        <a href="#discover" className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-[10px] uppercase tracking-[.18em] text-white/35 transition hover:text-white/70 sm:flex"><ArrowDown className="h-3.5 w-3.5" />Scroll to explore</a>
      </section>

      <section className="border-b border-white/[.06] bg-[#111411]">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-10 sm:grid-cols-3 sm:gap-10 sm:px-8 sm:py-12">
        {[{ n: "01", title: "Nepali, right at home", text: "Find the voices and bands you grew up with." }, { n: "02", title: "Hindi, from classics to now", text: "Build a library around the songs you love." }, { n: "03", title: "More of your world", text: "Explore every mood, genre and new favorite." }].map((item, index) => <Reveal key={item.n} delay={index * .08} className="flex gap-4 sm:block"><span className="font-display text-sm text-primary/65 sm:text-xs">{item.n}</span><div><h2 className="font-display text-lg font-medium tracking-tight sm:mt-4 sm:text-xl">{item.title}</h2><p className="mt-1 text-sm text-white/45">{item.text}</p></div></Reveal>)}
        </div>
      </section>

      <section id="features" className="relative overflow-hidden border-b border-white/[.06] bg-[#101310]">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_8%_50%,rgba(30,215,96,.1),transparent_36%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-9 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:gap-24 lg:py-28">
          <Reveal className="relative mx-auto w-full max-w-[410px] lg:order-1">
            <div aria-hidden="true" className="absolute -inset-8 -z-10 rounded-full bg-primary/[.08] blur-[55px]" />
            <div className="relative mx-auto w-[min(72vw,330px)] rounded-[38px] border border-white/15 bg-[#181b18] p-2.5 shadow-[0_30px_90px_rgba(0,0,0,.5)] sm:w-[300px]">
              <div className="overflow-hidden rounded-[29px] bg-[#0c0e0c] p-3.5">
                <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-white/20" />
                <div className="flex items-center justify-between text-[10px] text-white/45"><span>YOUR LIBRARY</span><span className="text-primary">EDIT</span></div>
                <div className="mt-3 space-y-2.5">{apiTracks.map((track) => <div key={track.id} className="flex items-center gap-3 rounded-xl bg-white/[.035] p-2"><Artwork src={track.artwork} alt={`${track.title} cover`} className="h-12 w-12 shrink-0 rounded-lg" /><span className="min-w-0"><span className="block truncate text-xs font-medium">{track.title}</span><span className="mt-1 block truncate text-[10px] text-white/40">Track · {getArtist(track.artistId)?.name}</span></span></div>)}</div>
                <div className="mt-4 rounded-xl border border-white/[.07] bg-[#171a17] p-3"><div className="flex items-center gap-2"><Heart className="h-3.5 w-3.5 fill-primary text-primary" /><span className="text-[10px] font-medium">Liked Songs</span></div><div className="mt-3 flex gap-1"><span className="h-1 flex-1 rounded-full bg-primary" /><span className="h-1 flex-1 rounded-full bg-primary/55" /><span className="h-1 flex-1 rounded-full bg-white/10" /><span className="h-1 flex-1 rounded-full bg-white/10" /></div></div>
              </div>
            </div>
            <motion.div animate={reduceMotion ? undefined : { y: [0, 8, 0], rotate: [0, -2, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-3 -left-1 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#171a17] text-primary shadow-xl sm:-left-8"><Library className="h-6 w-6" /></motion.div>
          </Reveal>
          <Reveal className="max-w-xl lg:order-2">
            <p className="eyebrow mb-4 text-primary">Your collection, your call</p>
            <h2 className="font-display text-4xl font-semibold leading-[1.02] tracking-[-.06em] sm:text-5xl lg:text-6xl">Make a home for the music you love.</h2>
            <p className="mt-5 max-w-lg text-sm leading-relaxed text-white/55 sm:text-base">Save albums, follow the artists you care about, and build playlists for every version of your day. Your library stays one tap away.</p>
            <Link href="/explore" className="group mt-7 inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:text-white">Explore the collection <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
          </Reveal>
        </div>
      </section>

      <section id="discover" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <Reveal><MusicDiscovery liveTracks={discoveryTracks} loading={discovering} /></Reveal>
      </section>

      <section className="relative isolate overflow-hidden border-y border-primary/10 bg-[#111811]">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_76%_48%,rgba(30,215,96,.15),transparent_44%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1fr_.9fr] lg:gap-20">
          <Reveal>
            <div className="flex items-center gap-2 text-primary"><Waves className="h-4 w-4" /><p className="eyebrow">Listening, made simple</p></div>
            <h2 className="mt-4 max-w-xl font-display text-4xl font-semibold leading-[1.03] tracking-[-.06em] sm:text-5xl lg:text-6xl">From first search to full-volume feeling.</h2>
            <p className="mt-5 max-w-lg text-sm leading-relaxed text-white/55 sm:text-base">Search across a broad catalog, follow the trail to new artists, then settle into a player made to keep the music in focus.</p>
          </Reveal>
          <div className="grid gap-3 sm:grid-cols-2">
            {[{ icon: Search, title: "Search your way", text: "Look up songs, albums and artists." }, { icon: Compass, title: "Follow a new sound", text: "Explore by artist, album and mood." }, { icon: Heart, title: "Keep your favorites", text: "Like tracks and save the albums you love." }, { icon: Headphones, title: "Stay in the music", text: "Control playback and see what’s next." }].map(({ icon: Icon, title, text }, index) => <Reveal key={title} delay={index * .06} className="rounded-2xl border border-white/[.07] bg-[#0c0f0c]/80 p-4 sm:p-5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><h3 className="mt-4 font-display text-base font-medium">{title}</h3><p className="mt-1.5 text-xs leading-relaxed text-white/45">{text}</p></Reveal>)}
          </div>
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

      <footer className="border-t border-white/[.07] bg-[#080908]">
        <div className="mx-auto grid max-w-7xl gap-9 px-5 py-10 sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:px-8 sm:py-14">
          <div><Link href="/" className="flex w-fit items-center gap-2.5" aria-label="Sangeet home"><SangeetMark size={36} /><span className="font-display text-lg font-semibold">Sangeet</span></Link><p className="mt-3 max-w-[220px] text-xs leading-relaxed text-white/38">A calmer home for the music you come back to.</p></div>
          {[{ title: "Discover", items: [["Explore", "/explore"], ["Search", "/search"], ["New releases", "/new-releases"]] }, { title: "Your music", items: [["Your library", "/library"], ["Liked songs", "/liked"], ["Made for you", "/made-for-you"]] }, { title: "Sangeet", items: [["Plans", "/plans"], ["Sign in", "#signin"], ["Create account", "#signup"]] }].map((group) => <nav key={group.title} aria-label={group.title}><p className="mb-3 text-[10px] font-semibold uppercase tracking-[.16em] text-white/35">{group.title}</p><ul className="space-y-2.5">{group.items.map(([label, href]) => <li key={label}>{href.startsWith("#") ? <button type="button" onClick={() => openAuthModal(href === "#signup" ? "signup" : "signin")} className="text-left text-xs text-white/55 transition hover:text-primary">{label}</button> : <Link href={href} className="text-xs text-white/55 transition hover:text-primary">{label}</Link>}</li>)}</ul></nav>)}
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-white/[.06] px-5 py-4 text-[10px] text-white/30 sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>© {new Date().getFullYear()} Sangeet. Made for listening.</span><span>Independent music discovery experience</span><span>Made by <a href="https://shasant.xyz" target="_blank" rel="noopener noreferrer" className="font-medium text-white/55 transition hover:text-primary">Shasant ↗</a></span></div>
      </footer>
    </main>
  );
}
