"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Download,
  Headphones,
  Music2,
  Sparkles,
  Monitor,
  Smartphone,
  Globe,
  Disc3,
  Mic2,
  Heart,
  Volume2,
  ShieldCheck,
  Play,
  Pause,
  SkipForward,
  Radio,
  CheckCircle2,
  Laptop,
} from "lucide-react";
import { useState } from "react";
import { SangeetMark } from "@/components/brand/sangeet-mark";
import { usePlayerStore } from "@/store/player-store";

const APK_URL = "https://github.com/shasantx/sangeet/releases/latest/download/sangeet-android.apk";
const EXE_URL = "https://github.com/shasantx/sangeet/releases/latest/download/Sangeet.exe";

interface FeaturedTrack {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  genre: string;
  duration: string;
}

const FEATURED_TRACKS: FeaturedTrack[] = [
  {
    id: "suna-kaanchi",
    title: "Suna Kaanchi",
    artist: "Sajjan Raj Vaidya",
    artwork: "https://lh3.googleusercontent.com/9Rz3U2K_v1V_G19uH1v4b2c1=w800-h800-l90-rj",
    genre: "Indie Pop · Nepali",
    duration: "4:47",
  },
  {
    id: "bistarai-bistarai",
    title: "Bistarai Bistarai",
    artist: "Rohit John Chettri",
    artwork: "https://lh3.googleusercontent.com/7123912389123=w800-h800-l90-rj",
    genre: "Acoustic · Classic",
    duration: "4:12",
  },
  {
    id: "guras-ko-phedmuni",
    title: "Guras Ko Phedmuni",
    artist: "1974 AD",
    artwork: "https://lh3.googleusercontent.com/92384723984=w800-h800-l90-rj",
    genre: "Rock / Folk",
    duration: "5:08",
  },
  {
    id: "kesariya",
    title: "Kesariya",
    artist: "Arijit Singh",
    artwork: "https://lh3.googleusercontent.com/123491823=w800-h800-l90-rj",
    genre: "Bollywood · Romantic",
    duration: "4:28",
  },
];

export function LandingPage() {
  const reduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<"features" | "lyrics" | "desktop">("lyrics");
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#070907] text-white selection:bg-[#1ed760]/30">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[160px]" />
        <div className="absolute top-[40%] -left-48 h-[500px] w-[500px] rounded-full bg-emerald-600/5 blur-[140px]" />
        <div className="absolute top-[70%] -right-48 h-[600px] w-[600px] rounded-full bg-emerald-400/5 blur-[150px]" />
      </div>

      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#070907]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3 group" aria-label="Sangeet Home">
            <SangeetMark size={34} />
            <div className="flex flex-col">
              <span className="font-display text-[19px] font-bold tracking-tight text-white group-hover:text-primary transition-colors">
                Sangeet
              </span>
            </div>
          </Link>

          <div className="hidden items-center gap-7 text-[13px] font-medium text-white/70 md:flex">
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#lyrics" className="hover:text-white transition-colors">
              Synced Lyrics
            </a>
            <a href="#desktop" className="hover:text-white transition-colors">
              Windows App (.exe)
            </a>
            <a href="#platforms" className="hover:text-white transition-colors">
              Platforms
            </a>
            <Link
              href="https://github.com/shasantx/sangeet"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/auth"
              className="hidden sm:inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Sign In
            </Link>
            <Link
              href="/home"
              className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-black shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.03] hover:brightness-110"
            >
              Launch Player <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-5 pt-16 pb-20 sm:px-8 lg:pt-24 lg:pb-32">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            {/* Left copy */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-400 mb-6">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                <span>Next-Gen Music Streaming · 100M+ Songs Free</span>
              </div>

              <h1 className="font-display text-[clamp(2.8rem,6.5vw,5.5rem)] font-extrabold leading-[1.02] tracking-tight text-white">
                Music without limits.{" "}
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-green-500 bg-clip-text text-transparent">
                  Every beat, every emotion.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-white/70">
                Experience Nepali, Hindi, and global music like never before. Real-time karaoke-style synchronized
                lyrics, studio-grade audio streaming, zero intrusive ads, and seamless sync across Web, Android, and
                Windows desktop.
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/home"
                  className="inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-primary px-7 text-sm font-bold text-black shadow-xl shadow-emerald-500/25 transition-all hover:scale-105 hover:brightness-110"
                >
                  <Headphones className="h-4 w-4" /> Start Listening Now
                </Link>

                <a
                  href={EXE_URL}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 text-sm font-semibold text-white backdrop-blur-md transition-all hover:border-emerald-500/50 hover:bg-white/10"
                >
                  <Monitor className="h-4 w-4 text-emerald-400" /> Download for Windows (.exe)
                </a>

                <a
                  href={APK_URL}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-5 text-sm font-semibold text-white/80 transition-all hover:text-white hover:bg-white/10"
                >
                  <Smartphone className="h-4 w-4 text-emerald-400" /> Android APK
                </a>
              </div>

              <div className="mt-8 flex items-center gap-6 text-xs text-white/50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Guest listening enabled</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Cloud library sync</span>
                </div>
              </div>
            </motion.div>

            {/* Right: Live Interactive Mockup Card */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.15 }}
              className="relative mx-auto w-full max-w-md lg:max-w-none"
            >
              <div className="relative rounded-3xl border border-white/15 bg-gradient-to-b from-[#141814] to-[#0c0e0c] p-6 shadow-2xl shadow-black/80 backdrop-blur-xl">
                {/* Header of Mockup */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500/80" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                    <div className="h-3 w-3 rounded-full bg-green-500/80" />
                    <span className="ml-2 text-xs font-medium text-white/40">Sangeet Desktop & Web</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    <Radio className="h-2.5 w-2.5 animate-pulse" /> Studio Hi-Fi
                  </span>
                </div>

                {/* Track Card */}
                <div className="mt-6 flex flex-col sm:flex-row items-center gap-5">
                  <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl shadow-xl ring-1 ring-white/10">
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
                      style={{
                        backgroundImage:
                          "url('https://lh3.googleusercontent.com/9Rz3U2K_v1V_G19uH1v4b2c1=w800-h800-l90-rj')",
                        backgroundColor: "#192219",
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>

                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                      Now Streaming
                    </span>
                    <h3 className="text-xl font-bold tracking-tight text-white truncate">Suna Kaanchi</h3>
                    <p className="text-sm font-medium text-white/60 truncate">Sajjan Raj Vaidya</p>
                    <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] text-white/70">
                        Synchronized Lyrics
                      </span>
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] text-white/70">
                        320 kbps Stream
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Synchronized Lyrics Preview Box */}
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4">
                  <div className="flex items-center justify-between text-xs text-white/45 mb-2.5">
                    <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                      <Mic2 className="h-3.5 w-3.5" /> Real-time Karaoke Lyrics
                    </span>
                    <span>0:53 / 4:47</span>
                  </div>
                  <div className="space-y-1.5 font-medium text-center">
                    <p className="text-xs text-white/35 transition-all">Suna kanchha kanchi ko maaya laagdaina ra...</p>
                    <p className="text-sm sm:text-base font-bold text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.5)] scale-[1.02]">
                      ♪ Suna kaanchi kancha ko maaya laagdaina ra... ♪
                    </p>
                    <p className="text-xs text-white/35 transition-all">Gham jhai chamkiney tyo muhar timro...</p>
                  </div>
                </div>

                {/* Scrubber & Controls */}
                <div className="mt-5 space-y-3">
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[38%] rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-white/50">
                    <span>1:24</span>
                    <span>4:47</span>
                  </div>

                  <div className="flex items-center justify-center gap-5 pt-1">
                    <button
                      type="button"
                      aria-label="Previous track"
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      <SkipForward className="h-5 w-5 rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePlay()}
                      aria-label="Play or pause track"
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400 text-black shadow-lg shadow-emerald-400/30 transition-transform hover:scale-105"
                    >
                      {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
                    </button>
                    <button
                      type="button"
                      aria-label="Next track"
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      <SkipForward className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Feature Showcase Tabs */}
      <section id="features" className="border-t border-white/[0.06] bg-[#090c09] py-20 sm:py-28">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Engineered For Pure Sound</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold sm:text-5xl tracking-tight">
              Everything Spotify does. Built with zero compromises.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-white/60">
              Designed for true music lovers with full high-resolution artwork, synced karaoke lyrics, and native desktop power.
            </p>
          </div>

          {/* 6 High-Impact Feature Cards */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: Synced Lyrics */}
            <div className="group rounded-3xl border border-white/10 bg-white/[0.02] p-8 transition-all hover:border-emerald-500/40 hover:bg-white/[0.04]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                <Mic2 className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-white">Synchronized Karaoke Lyrics</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Word-for-word and line-by-line timed lyrics. Tap or click any lyric line to jump directly to that point in the song.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <span>Powered by LRCLIB & YouTube</span>
              </div>
            </div>

            {/* Card 2: 100M+ Songs */}
            <div className="group rounded-3xl border border-white/10 bg-white/[0.02] p-8 transition-all hover:border-emerald-500/40 hover:bg-white/[0.04]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                <Disc3 className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-white">100M+ Global & Regional Tracks</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Nepali folk, rock, modern indie, Hindi, Bollywood, English billboard, and global hits. Instant search across the entire YouTube Music catalog.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <span>Fast search & discovery</span>
              </div>
            </div>

            {/* Card 3: Windows Desktop (.exe) */}
            <div className="group rounded-3xl border border-white/10 bg-white/[0.02] p-8 transition-all hover:border-emerald-500/40 hover:bg-white/[0.04]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                <Laptop className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-white">Windows Standalone Desktop App</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Complete with global media shortcuts (`Fn+Media keys`), system tray minimize, taskbar thumbnail playback buttons, and offline caching.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <span>Direct .exe download</span>
              </div>
            </div>

            {/* Card 4: Supabase Cloud Sync */}
            <div className="group rounded-3xl border border-white/10 bg-white/[0.02] p-8 transition-all hover:border-emerald-500/40 hover:bg-white/[0.04]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                <Heart className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-white">Cloud Library & Google Sync</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Sign in with Google. Your liked tracks, created playlists, recently played queue, and settings sync across all your devices via Supabase.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <span>Seamless real-time synchronization</span>
              </div>
            </div>

            {/* Card 5: HD Retina Artwork */}
            <div className="group rounded-3xl border border-white/10 bg-white/[0.02] p-8 transition-all hover:border-emerald-500/40 hover:bg-white/[0.04]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-white">Ultra-HD Artwork Engine</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                No pixelation. Automated 800px to 1200px retina image transformation with adaptive ambient glow backgrounds matching every album.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <span>Studio clarity</span>
              </div>
            </div>

            {/* Card 6: Zero Ad Interruptions */}
            <div className="group rounded-3xl border border-white/10 bg-white/[0.02] p-8 transition-all hover:border-emerald-500/40 hover:bg-white/[0.04]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-white">Ad-Free & Unlimited Skips</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                No 30-second audio ads between tracks. Skip as many tracks as you want, rearrange your queue, and enjoy background playback.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <span>Pure musical immersion</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Desktop App Spotlight Section */}
      <section id="desktop" className="relative border-t border-white/[0.06] bg-[#070907] py-20 sm:py-28 overflow-hidden">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
          <div className="rounded-3xl border border-white/15 bg-gradient-to-r from-emerald-950/40 via-black to-[#0e140f] p-8 sm:p-12 lg:p-16">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <Monitor className="h-3.5 w-3.5" /> Windows Desktop Edition
                </span>
                <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
                  Bring Sangeet to your PC as a native Windows app.
                </h2>
                <p className="mt-4 text-base text-white/70 leading-relaxed">
                  Enjoy hardware media keyboard controls, background system tray playback, taskbar preview buttons, and
                  zero browser tab clutter. Download the standalone executable and start listening in seconds.
                </p>

                <div className="mt-6 space-y-3 text-sm text-white/80">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <span>Global Windows Media Keys (Play/Pause, Next, Prev)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <span>System tray minimizing & background audio</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <span>Persistent session: Supabase library & playlists automatically synced</span>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-4">
                  <a
                    href={EXE_URL}
                    className="inline-flex h-12 items-center gap-2.5 rounded-full bg-emerald-400 px-7 text-sm font-bold text-black shadow-lg shadow-emerald-400/25 transition-all hover:scale-105 hover:bg-emerald-300"
                  >
                    <Download className="h-4 w-4" /> Download Sangeet.exe for Windows
                  </a>
                  <Link
                    href="/home"
                    className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Use in Web Browser <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Windows UI Showcase mockup */}
              <div className="relative rounded-2xl border border-white/15 bg-[#111612] p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs text-white/50">
                  <span className="font-semibold text-white/80">Sangeet for Windows</span>
                  <div className="flex gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                    <Volume2 className="h-5 w-5 text-emerald-400" />
                    <div>
                      <p className="text-xs font-bold text-white">Taskbar Thumbnail Controls</p>
                      <p className="text-[11px] text-white/50">Hover over the taskbar icon to play, pause, or skip tracks</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                    <Headphones className="h-5 w-5 text-emerald-400" />
                    <div>
                      <p className="text-xs font-bold text-white">Native Media Session (SMTC)</p>
                      <p className="text-[11px] text-white/50">Integrated with Windows volume flyout overlay</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    <div>
                      <p className="text-xs font-bold text-white">Standalone & Portable</p>
                      <p className="text-[11px] text-white/50">No installer needed, run directly from any folder</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cross-Platform Comparison */}
      <section id="platforms" className="border-t border-white/[0.06] bg-[#090c09] py-20 sm:py-28">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Available Everywhere</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold sm:text-5xl tracking-tight">
              One account. Any device.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-white/60">
              Pick up right where you left off, whether on your desktop, phone, or browser.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Windows */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 flex flex-col justify-between">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                  <Monitor className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-bold text-white">Windows Desktop</h3>
                <p className="mt-2 text-sm text-white/60">
                  Native Windows performance with media keys, system tray background playback, and instant launch.
                </p>
              </div>
              <div className="mt-6 pt-6 border-t border-white/10">
                <a
                  href={EXE_URL}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-white/10 py-3 text-xs font-bold text-white hover:bg-emerald-400 hover:text-black transition-colors"
                >
                  <Download className="h-4 w-4" /> Download .exe (Windows)
                </a>
              </div>
            </div>

            {/* Android */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 flex flex-col justify-between">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                  <Smartphone className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-bold text-white">Android Mobile</h3>
                <p className="mt-2 text-sm text-white/60">
                  Dedicated Android APK with notification drawer audio controls, lock screen metadata, and fast caching.
                </p>
              </div>
              <div className="mt-6 pt-6 border-t border-white/10">
                <a
                  href={APK_URL}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-white/10 py-3 text-xs font-bold text-white hover:bg-emerald-400 hover:text-black transition-colors"
                >
                  <Download className="h-4 w-4" /> Download Android APK
                </a>
              </div>
            </div>

            {/* Web */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 flex flex-col justify-between">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                  <Globe className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-bold text-white">Web Browser</h3>
                <p className="mt-2 text-sm text-white/60">
                  Instant access on Chrome, Safari, Firefox, Edge, and Brave. Zero installation necessary.
                </p>
              </div>
              <div className="mt-6 pt-6 border-t border-white/10">
                <Link
                  href="/home"
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-400 py-3 text-xs font-bold text-black hover:brightness-110 transition-all"
                >
                  Launch Web App <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-[#050705] py-12">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-8 px-5 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <SangeetMark size={32} />
            <div>
              <p className="font-display text-base font-bold text-white">Sangeet</p>
              <p className="text-xs text-white/50">Made with love for Nepali and South Asian music.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-white/60">
            <Link href="/home" className="hover:text-white transition-colors">
              Web Player
            </Link>
            <a href={EXE_URL} className="hover:text-white transition-colors">
              Windows App (.exe)
            </a>
            <a href={APK_URL} className="hover:text-white transition-colors">
              Android APK
            </a>
            <Link
              href="https://github.com/shasantx/sangeet"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub Source
            </Link>
            <a
              href="https://shasant.xyz"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-emerald-400 hover:underline"
            >
              Created by Shasant ↗
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
