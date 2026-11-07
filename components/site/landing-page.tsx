"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Headphones,
  Laptop,
  Mic2,
  Monitor,
  Music2,
  Pause,
  Play,
  QrCode,
  Radio,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Smartphone,
  Sparkles,
  Volume2,
} from "lucide-react";
import { SangeetMark } from "@/components/brand/sangeet-mark";
import { usePlayerStore } from "@/store/player-store";

const APK_URL = "https://github.com/shasantx/sangeet/releases/latest/download/sangeet-android.apk";
const EXE_URL = "https://github.com/shasantx/sangeet/releases/latest/download/Sangeet.exe";

export function LandingPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push("/home");
    }
  };

  return (
    <div className="min-h-screen bg-[#090b09] text-white antialiased selection:bg-[#1ed760]/30 selection:text-white">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#090b09]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 sm:h-20 max-w-6xl items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group" aria-label="Sangeet home">
            <SangeetMark size={28} />
            <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-white group-hover:text-[#1ed760] transition">
              Sangeet
            </span>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-medium text-[#9ba39d] md:flex">
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#lyrics" className="transition hover:text-white">
              Synced Lyrics
            </a>
            <a href="#platforms" className="transition hover:text-white">
              Windows (.exe)
            </a>
            <Link
              href="https://github.com/shasantx/sangeet"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-white"
            >
              Open Source
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/auth"
              className="inline-flex h-9 sm:h-10 items-center px-3 sm:px-4 text-xs font-semibold text-[#9ba39d] transition hover:text-white"
            >
              Sign In
            </Link>
            <Link
              href="/home"
              className="inline-flex h-9 sm:h-11 items-center justify-center rounded-full bg-[#1ed760] px-4 sm:px-6 text-xs font-bold text-black shadow-lg shadow-[#1ed760]/20 transition hover:bg-[#1db954] hover:scale-[1.02] active:scale-[0.98]"
            >
              Launch Player
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-8 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28">
        {/* Subtle ambient lighting */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 -z-10 h-[480px] w-full max-w-5xl bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(30,215,96,0.12),transparent_70%)]"
        />

        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          {/* Left Hero Column */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1ed760]/30 bg-[#1ed760]/10 px-3.5 py-1 text-xs font-semibold text-[#1ed760]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Free & Open-Source Music Engine</span>
            </div>

            <h1 className="mt-5 font-display text-[clamp(2.5rem,5.2vw,4.2rem)] font-extrabold leading-[1.08] tracking-tight text-white">
              Are you ready <span className="font-medium text-[#1ed760]">+</span>
              <br />
              for a revolution in
              <br />
              music streaming?
              <br />
              <span className="text-[#1ed760] underline decoration-[#1ed760]/30 underline-offset-8">
                Explore Sangeet
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-[#9ba39d] sm:text-base">
              Nepali, Hindi, and South Asian music at the center. Stream 100M+ songs with zero intrusive audio ads,
              real-time synchronized karaoke lyrics, and studio master sound across web, Android, and Windows.
            </p>

            {/* Email / Search Input Pill */}
            <form
              onSubmit={handleSearchSubmit}
              className="mt-8 flex max-w-md items-center rounded-full border border-white/15 bg-[#121513] p-1.5 shadow-xl focus-within:border-[#1ed760] focus-within:ring-2 focus-within:ring-[#1ed760]/20 transition"
            >
              <div className="flex flex-1 items-center gap-2.5 px-4 text-sm text-[#9ba39d]">
                <Search className="h-4 w-4 shrink-0 text-[#636c65]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search artist, song, or album..."
                  className="w-full bg-transparent text-sm text-white placeholder:text-[#636c65] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-full bg-[#1ed760] px-5 text-xs font-bold text-black shadow-sm transition hover:bg-[#1db954]"
              >
                Start Listening
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#636c65]">
              <span>Direct downloads:</span>
              <a href={EXE_URL} className="font-medium text-[#1ed760] hover:underline">
                Download Sangeet.exe (Windows)
              </a>
              <span>·</span>
              <a href={APK_URL} className="font-medium text-[#1ed760] hover:underline">
                Android APK
              </a>
            </div>
          </div>

          {/* Right Hero Column: Smartphone Device Frame */}
          <div className="relative mx-auto flex w-full justify-center lg:justify-end">
            <div className="relative w-full max-w-[300px] sm:max-w-[320px] mx-auto">
              {/* Colored backdrop card glow */}
              <div className="absolute -inset-4 -z-10 rounded-[44px] bg-[#1ed760]/20 blur-2xl opacity-60 sm:-inset-6" />

              {/* iPhone Hardware Outer Body */}
              <div className="relative overflow-hidden rounded-[38px] border-[5px] border-[#222823] bg-[#0c0e0c] p-3.5 sm:p-4 text-white shadow-2xl">
                {/* Notch / Dynamic Island */}
                <div className="mx-auto mb-4 flex h-4 w-28 items-center justify-center rounded-full bg-[#1a1f1b]">
                  <div className="h-2 w-2 rounded-full bg-[#2a332c]" />
                </div>

                {/* Status Bar */}
                <div className="flex items-center justify-between px-2 text-[10px] font-medium text-white/60">
                  <span>9:41</span>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#1ed760] animate-pulse" />
                    <span>Hi-Res Audio</span>
                  </div>
                </div>

                {/* Now Playing Presentation */}
                <div className="mt-4 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#1ed760]">
                    Now Streaming
                  </p>
                  <h3 className="mt-1 text-base sm:text-lg font-bold tracking-tight text-white">Suna Kaanchi</h3>
                  <p className="text-xs text-white/60">Sajjan Raj Vaidya</p>
                </div>

                {/* Album Cover: using reliable local SVG asset */}
                <div className="relative mx-auto mt-4 aspect-square w-full max-w-[192px] overflow-hidden rounded-2xl border border-white/10 bg-[#161a17] shadow-lg">
                  <img
                    src="/art/artists/regional/sajjan-raj-vaidya.svg"
                    alt="Suna Kaanchi - Sajjan Raj Vaidya cover"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                </div>

                {/* Real-time Synced Lyrics Ticker */}
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
                  <div className="flex items-center justify-between text-[9px] font-mono text-white/50">
                    <span className="flex items-center gap-1 text-[#1ed760]">
                      <Mic2 className="h-2.5 w-2.5" /> Karaoke Sync
                    </span>
                    <span>0:53 / 4:47</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#1ed760]">
                    Suna kaanchi kancha ko maaya laagdaina ra
                  </p>
                </div>

                {/* Playback Scrubber & Action Controls */}
                <div className="mt-4 space-y-2">
                  <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/15">
                    <div className="h-full w-[42%] rounded-full bg-[#1ed760]" />
                  </div>
                  <div className="flex items-center justify-between font-mono text-[9px] text-white/40">
                    <span>1:24</span>
                    <span>4:47</span>
                  </div>

                  <div className="flex items-center justify-center gap-4 pt-1">
                    <SkipBack className="h-4 w-4 text-white/60" />
                    <button
                      type="button"
                      onClick={() => togglePlay()}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1ed760] text-black transition hover:scale-105 active:scale-95"
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4 fill-current" />
                      ) : (
                        <Play className="ml-0.5 h-4 w-4 fill-current" />
                      )}
                    </button>
                    <SkipForward className="h-4 w-4 text-white/60" />
                  </div>
                </div>

                {/* Bottom App Navigation Mockup */}
                <div className="mt-5 flex items-center justify-around border-t border-white/10 pt-3 text-[10px] text-white/50">
                  <span className="font-semibold text-[#1ed760]">Home</span>
                  <span>Search</span>
                  <span>Library</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Brand / Ecosystem Strip */}
        <div className="mt-16 border-t border-white/[0.08] pt-10 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#636c65]">
            Integrated with official APIs, audio backends & operating systems
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8 text-sm font-semibold text-[#9ba39d] sm:gap-14">
            <span className="tracking-tight hover:text-[#1ed760] transition">YouTube Music API</span>
            <span className="tracking-tight hover:text-[#1ed760] transition">Spotify Metadata</span>
            <span className="tracking-tight hover:text-[#1ed760] transition">Windows 11 Native (.exe)</span>
            <span className="tracking-tight hover:text-[#1ed760] transition">Android Media Session</span>
            <span className="tracking-tight hover:text-[#1ed760] transition">Supabase Database</span>
            <span className="tracking-tight hover:text-[#1ed760] transition">LRCLIB Real-time Sync</span>
          </div>
        </div>
      </section>

      {/* Feature Section: High-Contrast Dark Pod */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="overflow-hidden rounded-[28px] sm:rounded-[36px] border border-white/[0.08] bg-[#111412] px-4 py-10 sm:px-12 sm:py-20 text-white shadow-2xl">
          <div className="text-center">
            <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-5xl text-white">
              We Made Music Streaming <span className="text-[#1ed760]">Sangeet-Simple.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-xs sm:text-base leading-relaxed text-[#9ba39d]">
              No paywalls. No 30-second audio advertisements interrupting your quiet moments. Designed from Kathmandu for everyone who cares about sound.
            </p>
          </div>

          {/* 3 Dark Feature Cards */}
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {/* Card 1: Synced Lyrics */}
            <div className="flex flex-col items-center rounded-3xl border border-white/[0.08] bg-[#161a17] p-6 text-center text-white shadow-xl transition hover:border-[#1ed760]/40">
              <h3 className="text-base font-bold tracking-tight text-white">
                Synchronized lyrics;
                <br />
                a piece of cake!
              </h3>
              <p className="mt-2 text-xs text-[#9ba39d]">
                Word-for-word timed karaoke lines scrolling smoothly as the vocals land.
              </p>

              {/* Phone Mockup Inside Card */}
              <div className="mt-6 w-full max-w-[210px] rounded-[28px] border-4 border-[#222823] bg-[#0c0e0c] p-3 text-white shadow-lg">
                <div className="mx-auto mb-2 h-2.5 w-16 rounded-full bg-[#1a1f1b]" />
                <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-[#1ed760] font-mono">00:53 Active</p>
                  <p className="mt-1 text-[11px] font-bold text-white">
                    Suna kaanchi kancha ko maaya laagdaina ra
                  </p>
                  <p className="mt-1 text-[9px] text-white/40">Gham jhai chamkiney tyo muhar</p>
                </div>
                <div className="mt-3 flex justify-center">
                  <span className="rounded-full bg-[#1ed760] px-3 py-1 text-[9px] font-bold text-black">
                    Tap any line to seek
                  </span>
                </div>
              </div>

              <p className="mt-5 text-[11px] font-semibold text-[#1ed760]">
                Real-time LRCLIB + YouTube integration
              </p>
            </div>

            {/* Card 2: Instant Search & Catalog */}
            <div className="flex flex-col items-center rounded-3xl border border-white/[0.08] bg-[#161a17] p-6 text-center text-white shadow-xl transition hover:border-[#1ed760]/40">
              <h3 className="text-base font-bold tracking-tight text-white">
                Access any regional track
                <br />
                in a second
              </h3>
              <p className="mt-2 text-xs text-[#9ba39d]">
                Every Nepali folk classic, modern indie release, and Bollywood billboard hit.
              </p>

              {/* Phone Mockup Inside Card */}
              <div className="mt-6 w-full max-w-[210px] rounded-[28px] border-4 border-[#222823] bg-[#0c0e0c] p-3 text-white shadow-lg">
                <div className="mx-auto mb-2 h-2.5 w-16 rounded-full bg-[#1a1f1b]" />
                <div className="space-y-2 text-left">
                  <div className="flex items-center gap-2 rounded-lg bg-white/[0.08] p-1.5">
                    <span className="h-6 w-6 rounded bg-[#1ed760]/20 flex items-center justify-center text-[10px] font-bold text-[#1ed760]">
                      1
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-bold text-white">Parelima</p>
                      <p className="truncate text-[8px] text-white/50">1974 AD</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] p-1.5">
                    <span className="h-6 w-6 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/60">
                      2
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-bold text-white">Bistarai Bistarai</p>
                      <p className="truncate text-[8px] text-white/50">Rohit John Chettri</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <span className="font-mono text-[9px] text-[#1ed760]">100M+ songs indexed</span>
                </div>
              </div>

              <p className="mt-5 text-[11px] font-semibold text-[#1ed760]">
                Fast YouTube Music search engine
              </p>
            </div>

            {/* Card 3: Windows & Cross-Device Sync */}
            <div className="flex flex-col items-center rounded-3xl border border-white/[0.08] bg-[#161a17] p-6 text-center text-white shadow-xl transition hover:border-[#1ed760]/40">
              <h3 className="text-base font-bold tracking-tight text-white">
                Control playback,
                <br />
                before it happens.
              </h3>
              <p className="mt-2 text-xs text-[#9ba39d]">
                Windows system tray, global media keys, and mobile notification controls.
              </p>

              {/* Phone Mockup Inside Card */}
              <div className="mt-6 w-full max-w-[210px] rounded-[28px] border-4 border-[#222823] bg-[#0c0e0c] p-3 text-white shadow-lg">
                <div className="mx-auto mb-2 h-2.5 w-16 rounded-full bg-[#1a1f1b]" />
                <div className="rounded-xl border border-white/10 bg-white/[0.06] p-2.5 text-center">
                  <div className="flex items-center justify-center gap-2 text-[#1ed760]">
                    <Laptop className="h-3 w-3" />
                    <span className="text-[9px] font-bold">Windows .exe Synced</span>
                  </div>
                  <p className="mt-1 text-[10px] font-semibold text-white">Global Media Hotkeys</p>
                  <p className="text-[8px] text-white/50">Play/Pause without leaving apps</p>
                </div>
                <div className="mt-2.5 flex items-center justify-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1ed760]" />
                  <span className="font-mono text-[9px] text-white/60">Supabase Cloud Sync</span>
                </div>
              </div>

              <p className="mt-5 text-[11px] font-semibold text-[#1ed760]">
                Cross-platform session persistence
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* App Release / Platform Showcase Section */}
      <section id="platforms" className="mx-auto max-w-6xl px-6 py-16 sm:px-8 sm:py-24">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1 text-xs font-medium text-[#9ba39d]">
            <Monitor className="h-3.5 w-3.5 text-[#1ed760]" />
            <span>Cross-Platform Music Experience</span>
          </div>

          <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Available on Windows Desktop, Android & Web
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm text-[#9ba39d] sm:text-base">
            Install the standalone Windows .exe application for hardware media shortcuts and background system tray audio, or use the Android APK on your phone.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href={EXE_URL}
              className="inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-[#1ed760] px-7 text-xs font-bold text-black shadow-lg shadow-[#1ed760]/20 transition hover:bg-[#1db954] hover:scale-[1.02] active:scale-[0.98]"
            >
              <Monitor className="h-4 w-4" /> Download for Windows (.exe)
            </a>
            <a
              href={APK_URL}
              className="inline-flex h-12 items-center justify-center gap-2.5 rounded-full border border-white/15 bg-white/[0.04] px-6 text-xs font-semibold text-white shadow-sm transition hover:bg-white/[0.08]"
            >
              <Smartphone className="h-4 w-4" /> Download Android APK
            </a>
            <Link
              href="/home"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-6 text-xs font-semibold text-white shadow-sm transition hover:bg-white/[0.08]"
            >
              Open Web App <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Dramatic angled device rising from bottom */}
        <div className="relative mx-auto mt-16 max-w-2xl overflow-hidden rounded-t-[40px] border-x-4 border-t-4 border-[#222823] bg-[#0c0e0c] p-6 text-white shadow-2xl">
          <div className="mx-auto mb-4 h-3.5 w-24 rounded-full bg-[#1a1f1b]" />
          <div className="flex items-center justify-between border-b border-white/10 pb-4 text-xs text-white/60">
            <span className="font-semibold text-white">Sangeet Desktop & Web</span>
            <span className="text-[#1ed760] font-mono text-[11px]">v1.0.0 Stable</span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <Laptop className="h-5 w-5 text-[#1ed760]" />
              <h4 className="mt-2 text-xs font-bold text-white">Windows Standalone</h4>
              <p className="mt-1 text-[11px] text-white/50">
                Direct executable without browser memory bloat. Global media shortcuts.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <Mic2 className="h-5 w-5 text-[#1ed760]" />
              <h4 className="mt-2 text-xs font-bold text-white">Synchronized Karaoke</h4>
              <p className="mt-1 text-[11px] text-white/50">
                Timestamped lyrics synchronized line by line with click-to-seek.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <Radio className="h-5 w-5 text-[#1ed760]" />
              <h4 className="mt-2 text-xs font-bold text-white">Cloud Library Sync</h4>
              <p className="mt-1 text-[11px] text-white/50">
                Playlists, liked songs, and listening history saved to Supabase.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Column Footer */}
      <footer className="border-t border-white/[0.08] bg-[#070907] py-14 text-xs text-[#9ba39d]">
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
            {/* Column 1: Brand & Search Pill */}
            <div>
              <Link href="/" className="flex items-center gap-2 group">
                <SangeetMark size={28} />
                <span className="font-display text-lg font-bold tracking-tight text-white group-hover:text-[#1ed760] transition">
                  Sangeet
                </span>
              </Link>
              <p className="mt-3 max-w-sm text-xs leading-relaxed text-[#636c65]">
                © Sangeet 2026. Free, open-source music streaming client dedicated to Nepali, Hindi, and regional independent artists.
              </p>

              {/* Input pill */}
              <form
                onSubmit={handleSearchSubmit}
                className="mt-5 flex max-w-xs items-center rounded-full border border-white/15 bg-[#121513] p-1 focus-within:border-[#1ed760]"
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find music..."
                  className="w-full bg-transparent px-3 text-xs text-white placeholder:text-[#636c65] focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex h-8 items-center justify-center rounded-full bg-[#1ed760] px-4 text-[11px] font-bold text-black transition hover:bg-[#1db954]"
                >
                  Search
                </button>
              </form>
            </div>

            {/* Column 2: Platforms */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white">Platforms</p>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <a href={EXE_URL} className="hover:text-white transition">
                    Windows Desktop (.exe)
                  </a>
                </li>
                <li>
                  <a href={APK_URL} className="hover:text-white transition">
                    Android APK
                  </a>
                </li>
                <li>
                  <Link href="/home" className="hover:text-white transition">
                    Web Player
                  </Link>
                </li>
                <li>
                  <Link href="/now-playing" className="hover:text-white transition">
                    Now Playing
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Features */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white">Features</p>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <a href="#lyrics" className="hover:text-white transition">
                    Synchronized Lyrics
                  </a>
                </li>
                <li>
                  <Link href="/explore" className="hover:text-white transition">
                    Regional Music Discovery
                  </Link>
                </li>
                <li>
                  <Link href="/library" className="hover:text-white transition">
                    Cloud Playlists & Likes
                  </Link>
                </li>
                <li>
                  <Link href="/settings" className="hover:text-white transition">
                    Audio Settings
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Project */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white">Open Project</p>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <Link
                    href="https://github.com/shasantx/sangeet"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition"
                  >
                    GitHub Repository
                  </Link>
                </li>
                <li>
                  <a
                    href="https://shasant.xyz"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[#1ed760] hover:underline"
                  >
                    Created by Shasant ↗
                  </a>
                </li>
                <li>
                  <Link href="/auth" className="hover:text-white transition">
                    Sign In
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
