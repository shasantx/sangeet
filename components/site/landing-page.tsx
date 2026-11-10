"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  CheckCircle2,
  Circle,
  Download,
  Flame,
  Headphones,
  Heart,
  Laptop,
  Mic2,
  Monitor,
  Moon,
  Music2,
  Pause,
  Play,
  Radio,
  Repeat,
  Search,
  ShieldCheck,
  Shuffle,
  SkipBack,
  SkipForward,
  Smartphone,
  Sparkles,
  Sun,
  Volume2,
} from "lucide-react";
import { SangeetMark } from "@/components/brand/sangeet-mark";
import { useAuthStore } from "@/store/auth-store";
import { useAppStore, type ThemePreference } from "@/store/app-store";
import { usePlayerStore } from "@/store/player-store";
import { toast } from "@/store/ui-store";

const APK_URL = "https://github.com/shasantx/sangeet/releases/latest/download/sangeet-android.apk";
const EXE_URL = "https://github.com/shasantx/sangeet/releases/latest/download/Sangeet.exe";

interface GenreCardItem {
  id: string;
  name: string;
  description: string;
  gradient: string;
  accent: string;
  badge?: string;
  patternType: "waves" | "radar" | "concentric" | "radial";
}

const FEATURED_GENRES: GenreCardItem[] = [
  {
    id: "ambient",
    name: "Ambient",
    description: "Wide-open soundscapes for deep focus and quiet rooms.",
    gradient: "from-[#141b27] via-[#0e131d] to-[#080b11]",
    accent: "#60a5fa",
    patternType: "waves",
  },
  {
    id: "electronic",
    name: "Electronic",
    description: "Future-facing rhythm, texture and nocturnal energy.",
    gradient: "from-[#1d1228] via-[#150d1e] to-[#0c0812]",
    accent: "#a855f7",
    patternType: "radar",
  },
  {
    id: "alternative",
    name: "Alternative",
    description: "Guitars, voices and pop songs from the outside looking in.",
    gradient: "from-[#281313] via-[#1a0c0c] to-[#0d0707]",
    accent: "#ef4444",
    patternType: "concentric",
  },
  {
    id: "soul",
    name: "Soul & R&B",
    description: "Warm voices, deep grooves and modern slow motion.",
    gradient: "from-[#281b11] via-[#1b120a] to-[#0d0905]",
    accent: "#f59e0b",
    patternType: "concentric",
  },
  {
    id: "jazz",
    name: "Jazz",
    description: "Modern players, quiet rooms and old harmonies made new.",
    gradient: "from-[#0d221e] via-[#091714] to-[#050c0a]",
    accent: "#10b981",
    patternType: "radial",
  },
  {
    id: "indie",
    name: "Indie",
    description: "Independent hearts, homespun records and wide skies.",
    gradient: "from-[#1a1f11] via-[#12160b] to-[#080b05]",
    accent: "#84cc16",
    patternType: "radial",
  },
];

export function LandingPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isLiked, setIsLiked] = useState(false);
  const [showLyricsPreview, setShowLyricsPreview] = useState(false);
  const [activePreviewPlaying, setActivePreviewPlaying] = useState(false);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const session = useAuthStore((state) => state.session);
  const activeTheme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);

  const isPlayerPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlayerPlay = usePlayerStore((state) => state.togglePlay);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push("/home");
    }
  };

  const handleInteractivePlay = () => {
    if (!isAuthenticated) {
      toast.error(
        "Login Required",
        "Sign in to start playing music, saving favorites, and streaming in lossless audio."
      );
      router.push("/auth?reason=play_required&returnTo=/");
      return;
    }
    setActivePreviewPlaying((prev) => !prev);
    togglePlayerPlay();
  };

  const handleSelectTheme = (themeId: ThemePreference) => {
    setTheme(themeId);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = themeId;
    }
    toast.success("Theme changed", `Applied ${themeId} theme.`);
  };

  return (
    <div className="min-h-screen bg-[#090b09] text-white antialiased selection:bg-[#1ed760]/30 selection:text-white">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#090b09]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 sm:h-20 max-w-6xl items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 group" aria-label="Sangeet home">
            <SangeetMark size={28} />
            <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-white group-hover:text-[#1ed760] transition">
              Sangeet
            </span>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-medium text-[#9ba39d] md:flex">
            <a href="#player-showcase" className="transition hover:text-white">
              Player
            </a>
            <a href="#genres" className="transition hover:text-white">
              Genres
            </a>
            <a href="#themes" className="transition hover:text-white">
              Themes
            </a>
            <a href="#platforms" className="transition hover:text-white">
              Platforms
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
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white hover:border-[#1ed760]/40 transition"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1ed760] text-[10px] font-bold text-black">
                    {session?.initials ?? "U"}
                  </span>
                  <span className="hidden sm:inline">{session?.displayName ?? "Listener"}</span>
                </Link>
                <Link
                  href="/home"
                  className="inline-flex h-9 sm:h-10 items-center justify-center rounded-full bg-[#1ed760] px-4 sm:px-5 text-xs font-bold text-black shadow-lg shadow-[#1ed760]/20 transition hover:bg-[#1db954]"
                >
                  Open Player
                </Link>
              </div>
            ) : (
              <>
                <Link
                  href="/auth"
                  className="inline-flex h-9 sm:h-10 items-center px-3 sm:px-4 text-xs font-semibold text-[#c8cec9] transition hover:text-white"
                >
                  Sign In
                </Link>
                <Link
                  href="/home"
                  className="inline-flex h-9 sm:h-10 items-center justify-center rounded-full bg-[#1ed760] px-4 sm:px-5 text-xs font-bold text-black shadow-lg shadow-[#1ed760]/20 transition hover:bg-[#1db954] hover:scale-[1.02] active:scale-[0.98]"
                >
                  Launch Player
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section with Interactive Player Mockup (Image 2) */}
      <section
        id="player-showcase"
        className="relative mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-8 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28"
      >
        {/* Ambient radial glow backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 -z-10 h-[500px] w-full max-w-5xl bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(30,215,96,0.14),transparent_70%)]"
        />

        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          {/* Left Column: Headlines & Search */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1ed760]/30 bg-[#1ed760]/10 px-3.5 py-1 text-xs font-semibold text-[#1ed760]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Studio Master Lossless Audio Engine</span>
            </div>

            <h1 className="mt-5 font-display text-[clamp(2.4rem,5vw,4.1rem)] font-extrabold leading-[1.08] tracking-tight text-white">
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
              Stream 100M+ songs with zero intrusive audio advertisements, real-time synchronized
              karaoke lyrics, and studio master 320 KBPS lossless sound across Web, Android, and Windows.
            </p>

            {/* Instant Search Pill */}
            <form
              onSubmit={handleSearchSubmit}
              className="mt-8 flex max-w-md items-center rounded-full border border-white/15 bg-[#121513] p-1.5 shadow-2xl focus-within:border-[#1ed760] focus-within:ring-2 focus-within:ring-[#1ed760]/20 transition"
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

            {/* Direct Downloads Chips */}
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

            {/* Quick value badges */}
            <div className="mt-8 flex flex-wrap items-center gap-6 text-xs text-[#9ba39d]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#1ed760]" />
                320 KBPS Studio Sound
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#1ed760]" />
                Word-for-Word Synced Lyrics
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#1ed760]" />
                Zero Audio Ads
              </span>
            </div>
          </div>

          {/* Right Column: High-Craft Now Playing Showcase Card (Image 2 Direct Design) */}
          <div className="relative mx-auto flex w-full max-w-[340px] sm:max-w-[360px] flex-col items-center justify-center">
            {/* Ambient behind-card glow */}
            <div className="absolute -inset-4 -z-10 rounded-[44px] bg-[#1ed760]/15 blur-3xl opacity-70" />
            <div className="absolute -inset-8 -z-10 rounded-[44px] bg-purple-600/10 blur-3xl opacity-50" />

            {/* Main Player Card */}
            <div className="w-full overflow-hidden rounded-[36px] border border-white/[0.12] bg-[#101211] p-5 sm:p-6 text-white shadow-2xl transition hover:border-white/20">
              {/* Album Art Cover with Parental Advisory badge */}
              <div className="relative aspect-square w-full overflow-hidden rounded-[22px] border border-white/10 bg-[#161a17] shadow-xl">
                <img
                  src="/art/albums/the-weeknd-sao-paulo.jpg"
                  alt="São Paulo - The Weeknd"
                  className="h-full w-full object-cover transition duration-500 hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
              </div>

              {/* Title & Artist Row with Heart Icon */}
              <div className="mt-5 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <h3 className="truncate font-display text-lg sm:text-xl font-bold tracking-tight text-white">
                    São Paulo
                  </h3>
                  <p className="mt-0.5 truncate text-xs sm:text-sm text-[#9ba39d]">
                    The Weeknd
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[#636c65]">
                    The Weeknd Essentials · 2024
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsLiked((prev) => !prev);
                    toast.success(
                      isLiked ? "Removed from Favorites" : "Saved to Favorites",
                      isLiked ? "Removed from your library." : "Added to your Liked Songs."
                    );
                  }}
                  aria-label={isLiked ? "Unlike song" : "Like song"}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <Heart
                    className={`h-5 w-5 transition ${
                      isLiked ? "fill-[#1ed760] text-[#1ed760]" : "text-white/60"
                    }`}
                  />
                </button>
              </div>

              {/* Synced Lyrics Banner Pill */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowLyricsPreview((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-xs transition hover:bg-white/[0.07] hover:border-[#1ed760]/30"
                >
                  <span className="flex items-center gap-2 font-semibold text-white/90">
                    <Mic2 className="h-4 w-4 text-[#1ed760]" />
                    View Synced Lyrics
                  </span>
                  <span className="font-mono text-[11px] text-[#9ba39d] hover:text-white transition">
                    {showLyricsPreview ? "Close preview ↑" : "Tap to open →"}
                  </span>
                </button>

                {/* Lyrics Live Dropdown / Drawer Preview */}
                {showLyricsPreview && (
                  <div className="mt-2.5 rounded-xl border border-white/10 bg-black/40 p-3.5 text-center transition animate-in fade-in duration-200">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[#1ed760]">
                      Synced Lyrics Live
                    </p>
                    <p className="mt-1.5 text-xs font-bold text-white">
                      "Bailando en São Paulo con las luces apagadas"
                    </p>
                    <p className="mt-1 text-[11px] text-[#9ba39d]">
                      Suna kaanchi kancha ko maaya laagdaina ra
                    </p>
                    <Link
                      href="/now-playing"
                      className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-semibold text-[#1ed760] hover:underline"
                    >
                      Open Full Karaoke Screen <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Progress Scrubber Bar */}
              <div className="mt-5 space-y-1.5">
                <div className="relative flex h-3 w-full cursor-pointer items-center">
                  <div className="h-1 w-full rounded-full bg-white/15">
                    <div
                      className="relative h-full rounded-full bg-[#1ed760]"
                      style={{ width: "24%" }}
                    >
                      {/* White scrub handle */}
                      <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow-md transition hover:scale-125" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between font-mono text-[11px] tabular-nums text-[#636c65]">
                  <span>0:16</span>
                  <span>5:01</span>
                </div>
              </div>

              {/* Playback Controls Row */}
              <div className="mt-3 flex items-center justify-between px-2 pt-1">
                {/* Shuffle with active dot */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    aria-label="Toggle shuffle"
                    className="p-1 text-[#1ed760] transition hover:scale-110"
                  >
                    <Shuffle className="h-4 w-4" />
                  </button>
                  <span className="h-1 w-1 rounded-full bg-[#1ed760] mt-0.5" />
                </div>

                {/* Previous */}
                <button
                  type="button"
                  aria-label="Previous track"
                  className="p-1 text-white/70 transition hover:scale-110 hover:text-white"
                >
                  <SkipBack className="h-5 w-5 fill-current" />
                </button>

                {/* Main White Play/Pause Button */}
                <button
                  type="button"
                  onClick={handleInteractivePlay}
                  aria-label={activePreviewPlaying || isPlayerPlaying ? "Pause" : "Play"}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-lg shadow-white/10 transition hover:scale-105 active:scale-95"
                >
                  {activePreviewPlaying || isPlayerPlaying ? (
                    <Pause className="h-5 w-5 fill-current" />
                  ) : (
                    <Play className="ml-0.5 h-5 w-5 fill-current" />
                  )}
                </button>

                {/* Next */}
                <button
                  type="button"
                  aria-label="Next track"
                  className="p-1 text-white/70 transition hover:scale-110 hover:text-white"
                >
                  <SkipForward className="h-5 w-5 fill-current" />
                </button>

                {/* Repeat with active dot */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    aria-label="Toggle repeat"
                    className="p-1 text-[#1ed760] transition hover:scale-110"
                  >
                    <Repeat className="h-4 w-4" />
                  </button>
                  <span className="h-1 w-1 rounded-full bg-[#1ed760] mt-0.5" />
                </div>
              </div>

              {/* Audio Quality Footer Badge */}
              <div className="mt-5 border-t border-white/[0.08] pt-3 text-center">
                <span className="font-mono text-[10px] font-semibold tracking-widest text-[#636c65] uppercase">
                  Lossless · 320 KBPS
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Atmospheric Genre Cards Section (Image 0 Direct Design) */}
      <section id="genres" className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24 border-t border-white/[0.08]">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#1ed760]">
            Curated Soundscapes
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Atmospheric Genres Designed for Deep Focus & Energy
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#9ba39d] sm:text-base">
            From glacial ambient soundscapes to future-facing nocturnal electronic rhythms, dive into
            handcrafted sonic spaces tailored for every mood.
          </p>
        </div>

        {/* Genre Cards Container matching Image 0 */}
        <div className="mt-10 space-y-4">
          {/* Top Row: Two Wide Cards (Ambient & Electronic) */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Ambient Card */}
            <Link
              href="/genre/ambient"
              className="group relative overflow-hidden rounded-[26px] border border-white/[0.1] bg-gradient-to-br from-[#151c28] via-[#0f141f] to-[#0a0d14] p-7 transition duration-300 hover:border-white/25 hover:shadow-2xl"
            >
              {/* Concentric organic curves background pattern */}
              <svg
                className="pointer-events-none absolute right-0 top-0 h-full w-2/3 opacity-30 transition duration-500 group-hover:scale-105 group-hover:opacity-40"
                viewBox="0 0 400 300"
                fill="none"
              >
                <circle cx="320" cy="80" r="140" stroke="#60a5fa" strokeWidth="1" opacity="0.3" />
                <circle cx="320" cy="80" r="220" stroke="#60a5fa" strokeWidth="1" opacity="0.2" />
                <circle cx="320" cy="80" r="300" stroke="#60a5fa" strokeWidth="1" opacity="0.1" />
              </svg>

              <div className="relative z-10 flex h-full flex-col justify-between min-h-[160px]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold tracking-widest text-[#8b99ac] uppercase">
                    Genre
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/80 transition duration-200 group-hover:bg-white group-hover:text-black">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>

                <div className="mt-8">
                  <h3 className="font-display text-3xl font-bold tracking-tight text-white transition group-hover:text-[#60a5fa]">
                    Ambient
                  </h3>
                  <p className="mt-2 max-w-sm text-xs sm:text-sm text-[#94a3b8] leading-relaxed">
                    Wide-open soundscapes for deep focus and quiet rooms.
                  </p>
                </div>
              </div>
            </Link>

            {/* Electronic Card with Radar Grid & Violet Dot */}
            <Link
              href="/genre/electronic"
              className="group relative overflow-hidden rounded-[26px] border border-white/[0.1] bg-gradient-to-br from-[#1e1329] via-[#140c1d] to-[#0b0710] p-7 transition duration-300 hover:border-white/25 hover:shadow-2xl"
            >
              {/* Radar Grid Pattern */}
              <div
                className="pointer-events-none absolute inset-0 opacity-20 transition duration-500 group-hover:opacity-30"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(168,85,247,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(168,85,247,0.2) 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />
              {/* Concentric radar circle */}
              <div className="pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 h-52 w-52 rounded-full border border-purple-500/25">
                <div className="absolute inset-6 rounded-full border border-purple-500/20" />
                <div className="absolute inset-14 rounded-full border border-purple-500/15" />
              </div>

              <div className="relative z-10 flex h-full flex-col justify-between min-h-[160px]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold tracking-widest text-[#a895b8] uppercase">
                    Genre
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/80 transition duration-200 group-hover:bg-white group-hover:text-black">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>

                <div className="mt-8">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-display text-3xl font-bold tracking-tight text-white transition group-hover:text-[#c084fc]">
                      Electronic
                    </h3>
                    <span className="h-3 w-3 rounded-full bg-[#a855f7] shadow-[0_0_12px_#a855f7]" />
                  </div>
                  <p className="mt-2 max-w-sm text-xs sm:text-sm text-[#c4b5d4] leading-relaxed">
                    Future-facing rhythm, texture and nocturnal energy.
                  </p>
                </div>
              </div>
            </Link>
          </div>

          {/* Bottom Grid: 4 Cards (Alternative, Soul & R&B, Jazz, Indie) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Alternative */}
            <Link
              href="/genre/alternative"
              className="group relative overflow-hidden rounded-[24px] border border-white/[0.09] bg-gradient-to-br from-[#271313] via-[#1a0c0c] to-[#0c0606] p-6 transition duration-300 hover:border-white/20 hover:scale-[1.01]"
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full bg-red-600/15 blur-2xl transition group-hover:scale-125" />
              <span className="font-mono text-[10px] font-semibold tracking-widest text-[#a37c7c] uppercase">
                Genre
              </span>
              <h3 className="mt-8 font-display text-2xl font-bold text-white transition group-hover:text-[#f87171]">
                Alternative
              </h3>
              <p className="mt-1 text-xs text-[#b89a9a]">Pop and guitars from outside.</p>
            </Link>

            {/* Soul & R&B */}
            <Link
              href="/genre/soul"
              className="group relative overflow-hidden rounded-[24px] border border-white/[0.09] bg-gradient-to-br from-[#271a0f] via-[#1a110a] to-[#0d0805] p-6 transition duration-300 hover:border-white/20 hover:scale-[1.01]"
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full bg-amber-600/15 blur-2xl transition group-hover:scale-125" />
              <span className="font-mono text-[10px] font-semibold tracking-widest text-[#aa8e74] uppercase">
                Genre
              </span>
              <h3 className="mt-8 font-display text-2xl font-bold text-white transition group-hover:text-[#fbbf24]">
                Soul & R&B
              </h3>
              <p className="mt-1 text-xs text-[#beaa94]">Warm voices and slow motion.</p>
            </Link>

            {/* Jazz */}
            <Link
              href="/genre/jazz"
              className="group relative overflow-hidden rounded-[24px] border border-white/[0.09] bg-gradient-to-br from-[#0c201c] via-[#081512] to-[#040b09] p-6 transition duration-300 hover:border-white/20 hover:scale-[1.01]"
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full bg-teal-600/15 blur-2xl transition group-hover:scale-125" />
              <span className="font-mono text-[10px] font-semibold tracking-widest text-[#729b92] uppercase">
                Genre
              </span>
              <h3 className="mt-8 font-display text-2xl font-bold text-white transition group-hover:text-[#34d399]">
                Jazz
              </h3>
              <p className="mt-1 text-xs text-[#95b8b0]">Quiet rooms and old harmonies.</p>
            </Link>

            {/* Indie */}
            <Link
              href="/genre/indie"
              className="group relative overflow-hidden rounded-[24px] border border-white/[0.09] bg-gradient-to-br from-[#1a1e0f] via-[#11140a] to-[#080a05] p-6 transition duration-300 hover:border-white/20 hover:scale-[1.01]"
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full bg-lime-600/15 blur-2xl transition group-hover:scale-125" />
              <span className="font-mono text-[10px] font-semibold tracking-widest text-[#8d9b6e] uppercase">
                Genre
              </span>
              <h3 className="mt-8 font-display text-2xl font-bold text-white transition group-hover:text-[#a3e635]">
                Indie
              </h3>
              <p className="mt-1 text-xs text-[#adbb92]">Independent records & skies.</p>
            </Link>
          </div>
        </div>
      </section>

      {/* Theme & Visual Moods Section (Image 1 Direct Design) */}
      <section id="themes" className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24 border-t border-white/[0.08]">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          {/* Description */}
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#1ed760]">
              <Moon className="h-4 w-4" />
              <span>Calm Interface</span>
            </div>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Three Dark Moods,
              <br />
              One Calm Interface.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#9ba39d]">
              Designed for late-night listening and zero eye strain. Pick your favorite aesthetic mood
              — changes apply instantly across your player and library.
            </p>
            <div className="mt-6 flex items-center gap-3 text-xs text-[#636c65]">
              <span className="h-2 w-2 rounded-full bg-[#1ed760] animate-pulse" />
              <span>Live interactive preview — tap any card to switch</span>
            </div>
          </div>

          {/* Theme Selector Pod (Image 1 Layout) */}
          <div className="rounded-[32px] border border-white/[0.09] bg-[#0d0f0e] p-6 sm:p-8 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#889289]">
                  Theme
                </span>
                <p className="mt-0.5 text-xs text-[#636c65]">
                  Three dark moods, one calm interface. Changes apply immediately.
                </p>
              </div>
              <Moon className="h-4 w-4 text-[#889289]" />
            </div>

            {/* Options List */}
            <div className="mt-6 space-y-4">
              {/* Option 1: Sangeet Dark */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleSelectTheme("dark")}
                onKeyDown={(e) => e.key === "Enter" && handleSelectTheme("dark")}
                className={`group relative flex cursor-pointer items-center justify-between rounded-[22px] border p-4 sm:p-5 transition duration-200 ${
                  activeTheme === "dark"
                    ? "border-[#1ed760] bg-[#121613] shadow-lg ring-1 ring-[#1ed760]"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Miniature Mockup Box with Purple Dot */}
                  <div className="hidden sm:flex h-14 w-24 shrink-0 flex-col justify-between rounded-xl border border-white/10 bg-[#0a0a0f] p-2">
                    <div className="space-y-1">
                      <div className="h-1.5 w-12 rounded bg-white/20" />
                      <div className="h-1.5 w-8 rounded bg-white/10" />
                    </div>
                    <div className="h-3 w-3 rounded-full bg-[#8b5cf6]" />
                  </div>

                  <div>
                    <h4 className="font-display text-sm sm:text-base font-bold text-white">
                      Sangeet Dark
                    </h4>
                    <p className="text-xs text-[#9ba39d]">
                      The signature charcoal black and violet.
                    </p>
                    <span className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] text-[#636c65]">
                      <Moon className="h-2.5 w-2.5" /> dark
                    </span>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="shrink-0 pl-3">
                  {activeTheme === "dark" ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1ed760] text-black shadow-md">
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </span>
                  ) : (
                    <span className="h-5 w-5 rounded-full border border-white/20 block" />
                  )}
                </div>
              </div>

              {/* Option 2: Midnight */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleSelectTheme("midnight")}
                onKeyDown={(e) => e.key === "Enter" && handleSelectTheme("midnight")}
                className={`group relative flex cursor-pointer items-center justify-between rounded-[22px] border p-4 sm:p-5 transition duration-200 ${
                  activeTheme === "midnight"
                    ? "border-[#1ed760] bg-[#121613] shadow-lg ring-1 ring-[#1ed760]"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Miniature Mockup Box with Indigo Dot */}
                  <div className="hidden sm:flex h-14 w-24 shrink-0 flex-col justify-between rounded-xl border border-white/10 bg-[#06060c] p-2">
                    <div className="space-y-1">
                      <div className="h-1.5 w-12 rounded bg-white/20" />
                      <div className="h-1.5 w-8 rounded bg-white/10" />
                    </div>
                    <div className="h-3 w-3 rounded-full bg-[#7c83fd]" />
                  </div>

                  <div>
                    <h4 className="font-display text-sm sm:text-base font-bold text-white">
                      Midnight
                    </h4>
                    <p className="text-xs text-[#9ba39d]">
                      Deeper, cooler and almost weightless.
                    </p>
                    <span className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] text-[#636c65]">
                      <AudioLines className="h-2.5 w-2.5" /> midnight
                    </span>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="shrink-0 pl-3">
                  {activeTheme === "midnight" ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1ed760] text-black shadow-md">
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </span>
                  ) : (
                    <span className="h-5 w-5 rounded-full border border-white/20 block" />
                  )}
                </div>
              </div>

              {/* Option 3: Dusk */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleSelectTheme("dusk")}
                onKeyDown={(e) => e.key === "Enter" && handleSelectTheme("dusk")}
                className={`group relative flex cursor-pointer items-center justify-between rounded-[22px] border p-4 sm:p-5 transition duration-200 ${
                  activeTheme === "dusk"
                    ? "border-[#1ed760] bg-[#121613] shadow-lg ring-1 ring-[#1ed760]"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Miniature Mockup Box with Amber Dot */}
                  <div className="hidden sm:flex h-14 w-24 shrink-0 flex-col justify-between rounded-xl border border-white/10 bg-[#120f0a] p-2">
                    <div className="space-y-1">
                      <div className="h-1.5 w-12 rounded bg-white/20" />
                      <div className="h-1.5 w-8 rounded bg-white/10" />
                    </div>
                    <div className="h-3 w-3 rounded-full bg-[#e27766]" />
                  </div>

                  <div>
                    <h4 className="font-display text-sm sm:text-base font-bold text-white">
                      Dusk
                    </h4>
                    <p className="text-xs text-[#9ba39d]">
                      Warm graphite warmth for low eye-strain sessions.
                    </p>
                    <span className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] text-[#636c65]">
                      <Sun className="h-2.5 w-2.5" /> dusk
                    </span>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="shrink-0 pl-3">
                  {activeTheme === "dusk" ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1ed760] text-black shadow-md">
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </span>
                  ) : (
                    <span className="h-5 w-5 rounded-full border border-white/20 block" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cross-Platform Ecosystem Section */}
      <section id="platforms" className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24 border-t border-white/[0.08]">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1 text-xs font-medium text-[#9ba39d]">
            <Monitor className="h-3.5 w-3.5 text-[#1ed760]" />
            <span>Cross-Platform Music Experience</span>
          </div>

          <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Available on Windows Desktop, Android & Web
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm text-[#9ba39d] sm:text-base">
            Install the standalone Windows .exe application for global media hotkeys and background
            system tray audio, or install the Android APK on your phone.
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

        {/* Feature Pods */}
        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.08] bg-[#111412] p-6 text-left">
            <Laptop className="h-6 w-6 text-[#1ed760]" />
            <h3 className="mt-3 text-sm font-bold text-white">Windows Standalone (.exe)</h3>
            <p className="mt-1.5 text-xs text-[#9ba39d] leading-relaxed">
              Global keyboard media shortcuts, system tray minimized playback, and lightweight memory footprint.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#111412] p-6 text-left">
            <Mic2 className="h-6 w-6 text-[#1ed760]" />
            <h3 className="mt-3 text-sm font-bold text-white">Word-by-Word Karaoke</h3>
            <p className="mt-1.5 text-xs text-[#9ba39d] leading-relaxed">
              Timestamped synced lyrics synchronized smoothly as vocals land. Tap any lyric line to jump directly.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#111412] p-6 text-left">
            <Radio className="h-6 w-6 text-[#1ed760]" />
            <h3 className="mt-3 text-sm font-bold text-white">Cloud Sync & Persistence</h3>
            <p className="mt-1.5 text-xs text-[#9ba39d] leading-relaxed">
              Playlists, favorited songs, and listening history saved securely to Supabase cloud storage.
            </p>
          </div>
        </div>
      </section>

      {/* Multi-Column Clean Footer */}
      <footer className="border-t border-white/[0.08] bg-[#070907] py-14 text-xs text-[#9ba39d]">
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
            {/* Brand & Search */}
            <div>
              <Link href="/" className="flex items-center gap-2 group">
                <SangeetMark size={28} />
                <span className="font-display text-lg font-bold tracking-tight text-white group-hover:text-[#1ed760] transition">
                  Sangeet
                </span>
              </Link>
              <p className="mt-3 max-w-sm text-xs leading-relaxed text-[#636c65]">
                © Sangeet 2026. Free, open-source music streaming client dedicated to Nepali, Hindi,
                and global independent artists.
              </p>

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

            {/* Platforms */}
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

            {/* Features */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white">Features</p>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <a href="#genres" className="hover:text-white transition">
                    Atmospheric Genres
                  </a>
                </li>
                <li>
                  <a href="#themes" className="hover:text-white transition">
                    Custom Themes
                  </a>
                </li>
                <li>
                  <Link href="/explore" className="hover:text-white transition">
                    Music Discovery
                  </Link>
                </li>
                <li>
                  <Link href="/library" className="hover:text-white transition">
                    Cloud Playlists & Likes
                  </Link>
                </li>
              </ul>
            </div>

            {/* Project */}
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
                    Sign In to Sangeet
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
