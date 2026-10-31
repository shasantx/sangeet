"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowRight, AudioLines, Compass, Headphones, Heart, Library, MonitorDown, Music2, Play, Search, Smartphone, Sparkles, Waves } from "lucide-react";
import { albums, getArtist, selectedAlbums } from "@/lib/catalog";
import { useAuthStore } from "@/store/auth-store";
import { Artwork } from "@/components/music/artwork";
import { AlbumCard } from "@/components/music/album-card";
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
    initial={reduceMotion ? false : { opacity: 0, y: 34, filter: "blur(10px)" }}
    whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
    viewport={{ once: true, amount: 0.18, margin: "0px 0px -55px 0px" }}
    transition={{ duration: reduceMotion ? 0 : 0.72, delay: reduceMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
  >{children}</motion.div>;
}

export default function WelcomePage() {
  const router = useRouter();
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const featured = selectedAlbums[0] ?? albums[0];
  const artist = featured ? getArtist(featured.artistId) : undefined;
  const heroRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const artworkY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : 110]);
  const artworkScale = useTransform(scrollYProgress, [0, 1], [1, reduceMotion ? 1 : 0.92]);

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
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-black shadow-[0_0_28px_rgba(30,215,96,.22)]"><AudioLines className="h-[18px] w-[18px]" /></span>
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
        <div aria-hidden="true" className="pointer-events-none absolute -right-36 top-20 -z-10 h-[440px] w-[440px] rounded-full border border-primary/[.09] sm:right-[7%] sm:top-24 sm:h-[610px] sm:w-[610px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-36 -z-10 h-[310px] w-[310px] rounded-full border border-white/[.05] sm:right-[13%] sm:top-40 sm:h-[470px] sm:w-[470px]" />
        <div className="mx-auto grid min-h-[690px] max-w-7xl items-center gap-5 px-5 pb-12 pt-12 sm:min-h-[760px] sm:px-8 sm:pb-16 lg:min-h-[820px] lg:grid-cols-[.95fr_1.05fr] lg:gap-2 lg:py-16">
          <div className="relative z-10 max-w-[640px]">
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }} className="eyebrow mb-5 flex items-center gap-2 text-primary"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10"><Sparkles className="h-3.5 w-3.5" /></span>Your music, your space</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 22, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: .8, delay: .08, ease: [0.22, 1, .36, 1] }} className="max-w-[680px] font-display text-[clamp(3.3rem,11vw,6.8rem)] font-semibold leading-[.91] tracking-[-.075em]">
              Find your <span className="text-primary">next</span><br className="hidden sm:block" /> favorite sound.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, delay: .22 }} className="mt-6 max-w-[480px] text-[15px] leading-relaxed text-white/58 sm:text-lg">Explore records, build a library that feels like yours, and let the right track find its way into your day.</motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, delay: .32 }} className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={listenOnline} className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-primary px-6 text-sm font-bold text-black shadow-[0_8px_34px_rgba(30,215,96,.2)] transition hover:brightness-110 active:scale-[.98]"><Play className="h-4 w-4 fill-current" />Listen online<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></button>
              <button type="button" onClick={signUp} className="inline-flex h-12 items-center rounded-full border border-white/15 px-6 text-sm font-semibold text-white/85 transition hover:border-white/35 hover:bg-white/[.04]">Create your account</button>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .65 }} className="mt-5 flex items-center gap-2 text-xs text-white/38"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Start free. Sign in to save your music.</motion.div>
          </div>

          {featured && <motion.div style={reduceMotion ? undefined : { y: artworkY, scale: artworkScale }} initial={{ opacity: 0, scale: .94, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: .9, delay: .18, ease: [0.22, 1, .36, 1] }} className="relative mx-auto w-full max-w-[410px] lg:max-w-[520px]">
            <div aria-hidden="true" className="absolute -inset-6 -z-10 rounded-[42px] bg-primary/[.1] blur-[50px] sm:-inset-10 sm:blur-[75px]" />
            <div className="relative rotate-[2deg] rounded-[26px] border border-white/[.12] bg-[#171a17]/85 p-3 shadow-[0_40px_100px_rgba(0,0,0,.55)] backdrop-blur-sm transition-transform duration-700 hover:rotate-0 sm:rounded-[32px] sm:p-4">
              <Artwork src={featured.artwork} alt={`${featured.title} album cover`} priority className="aspect-square w-full rounded-[19px] sm:rounded-[24px]" />
              <div className="flex items-center gap-3 px-1 pb-1 pt-4 sm:px-2 sm:pt-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-black"><Music2 className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><p className="eyebrow mb-1 text-primary">A place to begin</p><p className="truncate font-display text-lg font-medium">{featured.title}</p><p className="truncate text-xs text-white/50">{artist?.name ?? "Sangeet selection"}</p></div>
                <Link href={`/album/${featured.id}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/80 transition hover:border-primary hover:bg-primary hover:text-black" aria-label={`Explore ${featured.title}`}><ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
            <motion.div animate={reduceMotion ? undefined : { y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="absolute -left-4 top-[18%] hidden items-center gap-2.5 rounded-2xl border border-white/10 bg-[#151915]/95 p-3 shadow-xl sm:flex lg:-left-12">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Headphones className="h-4 w-4" /></span><span><span className="block text-[11px] font-semibold">Made for the moment</span><span className="mt-0.5 block text-[10px] text-white/45">Your next listen starts here</span></span>
            </motion.div>
          </motion.div>}
        </div>
        <a href="#discover" className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-[10px] uppercase tracking-[.18em] text-white/35 transition hover:text-white/70 sm:flex"><ArrowDown className="h-3.5 w-3.5" />Scroll to explore</a>
      </section>

      <section className="border-b border-white/[.06] bg-[#111411]">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-10 sm:grid-cols-3 sm:gap-10 sm:px-8 sm:py-12">
          {[{ n: "01", title: "Discover freely", text: "Find records, artists and new sounds." }, { n: "02", title: "Keep what matters", text: "Save favorites and make playlists." }, { n: "03", title: "Stay in the moment", text: "A focused player with your queue close by." }].map((item, index) => <Reveal key={item.n} delay={index * .08} className="flex gap-4 sm:block"><span className="font-display text-sm text-primary/65 sm:text-xs">{item.n}</span><div><h2 className="font-display text-lg font-medium tracking-tight sm:mt-4 sm:text-xl">{item.title}</h2><p className="mt-1 text-sm text-white/45">{item.text}</p></div></Reveal>)}
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
                <div className="mt-3 space-y-2.5">{selectedAlbums.slice(0, 4).map((album) => <Link key={album.id} href={`/album/${album.id}`} className="flex items-center gap-3 rounded-xl bg-white/[.035] p-2 transition hover:bg-white/[.08]"><Artwork src={album.artwork} alt="" className="h-12 w-12 shrink-0 rounded-lg" /><span className="min-w-0"><span className="block truncate text-xs font-medium">{album.title}</span><span className="mt-1 block truncate text-[10px] text-white/40">Album · {getArtist(album.artistId)?.name}</span></span></Link>)}</div>
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
        <Reveal className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="eyebrow mb-3 text-primary">A good place to start</p><h2 className="font-display text-3xl font-semibold tracking-[-.05em] sm:text-5xl">Find something that feels like you.</h2><p className="mt-3 max-w-xl text-sm text-white/45 sm:text-base">A few albums to press play on. There’s always more around the corner.</p></div>
          <Link href="/explore" className="group inline-flex items-center gap-2 text-sm font-semibold text-white/65 transition hover:text-primary">Browse all <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
        </Reveal>
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-5">
          {selectedAlbums.slice(0, 5).map((album, index) => <Reveal key={album.id} delay={index * .055}><AlbumCard album={album} priority={index < 2} /></Reveal>)}
        </div>
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
          <div><Link href="/" className="flex w-fit items-center gap-2.5" aria-label="Sangeet home"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-black"><AudioLines className="h-4 w-4" /></span><span className="font-display text-lg font-semibold">Sangeet</span></Link><p className="mt-3 max-w-[220px] text-xs leading-relaxed text-white/38">A calmer home for the music you come back to.</p></div>
          {[{ title: "Discover", items: [["Explore", "/explore"], ["Search", "/search"], ["New releases", "/new-releases"]] }, { title: "Your music", items: [["Your library", "/library"], ["Liked songs", "/liked"], ["Made for you", "/made-for-you"]] }, { title: "Sangeet", items: [["Plans", "/plans"], ["Sign in", "#signin"], ["Create account", "#signup"]] }].map((group) => <nav key={group.title} aria-label={group.title}><p className="mb-3 text-[10px] font-semibold uppercase tracking-[.16em] text-white/35">{group.title}</p><ul className="space-y-2.5">{group.items.map(([label, href]) => <li key={label}>{href.startsWith("#") ? <button type="button" onClick={() => openAuthModal(href === "#signup" ? "signup" : "signin")} className="text-left text-xs text-white/55 transition hover:text-primary">{label}</button> : <Link href={href} className="text-xs text-white/55 transition hover:text-primary">{label}</Link>}</li>)}</ul></nav>)}
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-white/[.06] px-5 py-4 text-[10px] text-white/30 sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>© {new Date().getFullYear()} Sangeet. Made for listening.</span><span>Independent music discovery experience</span></div>
      </footer>
    </main>
  );
}
