"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { LiquidGlass } from "glasskit-liquid-glass";
import {
  Check,
  Download,
  Github,
  Globe,
  HardDriveDownload,
  Laptop,
  Mic2,
  Moon,
  Pause,
  Play,
  Radio,
  Search,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Smartphone,
  Sun
} from "lucide-react";
import type { Track } from "@/types/music";
import { useAuthStore } from "@/store/auth-store";
import { usePlayerStore } from "@/store/player-store";
import { useUIStore } from "@/store/ui-store";
import { usePlatform } from "@/lib/platform";
import { MediaShelf } from "@/components/music/media-shelf";
import { TrackArtwork } from "@/components/music/track-artwork";
import { SiteFooter } from "@/components/shell/site-footer";
import { SangeetLogo } from "@/components/ui/sangeet-logo";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface ReleaseMeta {
  available: boolean;
  tag?: string;
  sizeBytes?: number;
  downloadUrl?: string;
}

const FALLBACK_TRACKS: Track[] = [
  {
    id: "preview-1",
    title: "Midnight Sessions",
    artist: "Sangeet Radio",
    thumbnail: "",
    duration: 214,
    source: "youtube"
  },
  {
    id: "preview-2",
    title: "Acoustic Late Night",
    artist: "Indie Unplugged",
    thumbnail: "",
    duration: 198,
    source: "youtube"
  },
  {
    id: "preview-3",
    title: "Desi Unplugged",
    artist: "Curated Shelf",
    thumbnail: "",
    duration: 242,
    source: "youtube"
  },
  {
    id: "preview-4",
    title: "Analog Lo-Fi",
    artist: "Focus Beats",
    thumbnail: "",
    duration: 185,
    source: "youtube"
  },
  {
    id: "preview-5",
    title: "Cobalt Horizon",
    artist: "Chill Mix",
    thumbnail: "",
    duration: 227,
    source: "youtube"
  },
  {
    id: "preview-6",
    title: "Velvet Echoes",
    artist: "After Hours",
    thumbnail: "",
    duration: 205,
    source: "youtube"
  }
];

export default function LandingPage() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const { isNative } = usePlatform();

  const enterAsGuest = useAuthStore((s) => s.enterAsGuest);
  const user = useAuthStore((s) => s.user);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  const [query, setQuery] = useState("");
  const [previewTracks, setPreviewTracks] = useState<Track[]>([]);
  const [phoneSlide, setPhoneSlide] = useState(0);
  const [apkMeta, setApkMeta] = useState<ReleaseMeta | null>(null);
  const [winMeta, setWinMeta] = useState<ReleaseMeta | null>(null);

  // Android & Windows native apps always land directly in /home (never the web landing page)
  useEffect(() => {
    if (!isNative) return;
    if (!user) enterAsGuest();
    router.replace("/home");
  }, [isNative, user, enterAsGuest, router]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/music/home?mood=all")
      .then((r) => r.json())
      .then((data) => {
        const shelves = Array.isArray(data?.shelves) ? data.shelves : [];
        const collected: Track[] = [];
        const seen = new Set<string>();
        for (const shelf of shelves) {
          for (const item of shelf?.items ?? []) {
            if (item?.id && !seen.has(item.id)) {
              seen.add(item.id);
              collected.push(item);
            }
            if (collected.length >= 10) break;
          }
          if (collected.length >= 10) break;
        }
        if (!cancelled && collected.length > 0) {
          setPreviewTracks(collected);
        }
      })
      .catch(() => {});

    fetch("/api/download/android?meta=1")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setApkMeta(data);
      })
      .catch(() => {
        if (!cancelled) setApkMeta({ available: false });
      });

    fetch("/api/download/windows?meta=1")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setWinMeta(data);
      })
      .catch(() => {
        if (!cancelled) setWinMeta({ available: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useGSAP(
    () => {
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      gsap.from(".hero-stagger", {
        y: 12,
        opacity: 0,
        duration: 0.45,
        stagger: 0.05,
        ease: "power2.out",
        clearProps: "transform,opacity"
      });
    },
    { scope: rootRef }
  );

  const handleGuestStart = () => {
    enterAsGuest();
    router.push("/home");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) enterAsGuest();
    const q = query.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  const handlePlayPreview = (track: Track) => {
    if (!user) enterAsGuest();
    const queue = previewTracks.length > 0 ? previewTracks : [track];
    playTrack(track, queue);
    router.push("/home");
  };

  const isDark = theme === "dark";
  const showcaseTracks =
    previewTracks.length > 0 ? previewTracks : FALLBACK_TRACKS;
  const featuredTrack =
    showcaseTracks[phoneSlide % showcaseTracks.length] ?? showcaseTracks[0];
  const lyricsTrack =
    showcaseTracks[(phoneSlide + 1) % showcaseTracks.length] ??
    showcaseTracks[0];

  if (isNative) {
    return <div className="min-h-[100dvh] w-full bg-encore-shell" />;
  }

  return (
    <div
      ref={rootRef}
      className="min-h-[100dvh] w-full bg-encore-shell text-encore-text"
    >
      {/* Clean Sticky Header with Compact Floating Center LiquidGlass Nav Pill */}
      <header
        className={cn(
          "sangeet-glass-navbar sticky top-0 z-30 h-16 bg-gradient-to-b from-encore-shell/90 via-encore-shell/55 to-transparent px-4 sm:px-6",
          isDark ? "stage-tone-dark" : "stage-tone-light"
        )}
      >
        <div className="mx-auto grid h-full max-w-6xl grid-cols-[1fr_auto] items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
          {/* Left: Brand Mark */}
          <Link href="/" className="inline-flex w-fit items-center gap-2.5">
            <SangeetLogo className="h-8 w-8" />
            <span className="text-base font-semibold tracking-tight text-encore-text">
              Sangeet
            </span>
          </Link>

          {/* Center (Desktop md+): Compact Floating LiquidGlass Pill */}
          <nav aria-label="Primary" className="hidden justify-center md:flex">
            <LiquidGlass
              radius={999}
              bezelWidth={18}
              interactive
              renderMode="css"
              variant={isDark ? "dark" : "clear"}
              className="sangeet-topbar-glass !w-auto"
            >
              <div className="flex h-10 items-center gap-1 px-2 text-sm font-medium text-encore-subdued">
                <a
                  href="#offline"
                  className="rounded-full px-3.5 py-1.5 transition-colors duration-150 hover:bg-encore-hover hover:text-encore-text"
                >
                  Offline
                </a>
                <a
                  href="#trending"
                  className="rounded-full px-3.5 py-1.5 transition-colors duration-150 hover:bg-encore-hover hover:text-encore-text"
                >
                  Discover
                </a>
                <a
                  href="#apps"
                  className="rounded-full px-3.5 py-1.5 transition-colors duration-150 hover:bg-encore-hover hover:text-encore-text"
                >
                  Download
                </a>
                <a
                  href="https://github.com/shasantx/sangeet"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors duration-150 hover:bg-encore-hover hover:text-encore-text"
                >
                  <Github className="h-3.5 w-3.5" strokeWidth={1.7} />
                  <span>GitHub</span>
                </a>
              </div>
            </LiquidGlass>
          </nav>

          {/* Right: Borderless Theme Toggle, Sign In, Cobalt Launch CTA */}
          <div className="flex items-center justify-end gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                isDark ? "Switch to light theme" : "Switch to dark theme"
              }
              className="flex h-9 w-9 items-center justify-center rounded-full text-encore-accent transition-colors duration-150 hover:bg-encore-elevated/80"
            >
              {isDark ? (
                <Sun className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Moon className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>

            <Link
              href="/auth"
              className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-encore-subdued transition-colors duration-150 hover:bg-encore-hover hover:text-encore-text sm:inline-flex"
            >
              Sign in
            </Link>

            <button
              type="button"
              onClick={handleGuestStart}
              className="btn-cobalt h-9 rounded-full px-4 text-xs font-semibold text-white sm:px-5 sm:text-sm"
            >
              {user ? "Open player" : "Launch app"}
            </button>
          </div>
        </div>
      </header>

      {/* Band 1: Zentra Cobalt Aurora Hero */}
      <section className="zentra-aurora-mesh relative overflow-hidden px-6 pb-20 pt-16 sm:pb-28 sm:pt-24">
        <div
          aria-hidden="true"
          className="sangeet-starfield pointer-events-none absolute inset-0 opacity-65"
        />

        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
          <h1
            className={cn(
              "hero-stagger bg-clip-text text-[42px] font-semibold leading-[1.04] tracking-[-0.035em] text-transparent sm:text-[66px]",
              isDark
                ? "bg-gradient-to-b from-white via-[#e6efff] to-[#8eb6ff]"
                : "bg-gradient-to-b from-[#09122b] via-[#132968] to-[#2563eb]"
            )}
          >
            Your music, your way
          </h1>

          <p className="hero-stagger mt-5 max-w-xl text-base leading-7 text-encore-subdued sm:text-lg">
            Stream YouTube Music audio, read synced LRCLIB lyrics, and keep
            offline songs across Web, Android, and Rust Windows
          </p>

          {/* Primary Cobalt + Soft Tonal Secondary Actions */}
          <div className="hero-stagger mt-9 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleGuestStart}
              className="btn-cobalt inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-semibold text-white"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Launch Sangeet free</span>
            </button>

            <a
              href="#apps"
              className={cn(
                "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-encore-elevated/85 px-7 text-sm font-medium text-encore-text backdrop-blur-xl transition-colors duration-150 hover:bg-encore-elevated-highlight active:scale-[0.98]",
                isDark
                  ? "shadow-[0_10px_28px_rgba(0,0,0,0.3)]"
                  : "shadow-[0_8px_22px_rgba(15,23,42,0.08)]"
              )}
            >
              <Download className="h-4 w-4 text-encore-accent" strokeWidth={1.7} />
              <span>Download apps</span>
            </a>
          </div>

          {/* Instant Search Bar */}
          <form
            onSubmit={handleSearch}
            className={cn(
              "hero-stagger mt-9 flex h-[52px] w-full max-w-md items-center gap-2 rounded-full bg-encore-base/85 pl-4 pr-2 backdrop-blur-xl transition-shadow duration-150 focus-within:ring-2 focus-within:ring-encore-accent/45",
              isDark
                ? "shadow-[0_12px_36px_rgba(0,0,0,0.35)]"
                : "shadow-[0_12px_32px_rgba(15,23,42,0.1)]"
            )}
          >
            <Search
              className="h-4 w-4 shrink-0 text-encore-muted"
              strokeWidth={1.7}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search songs, artists, albums"
              className="w-full bg-transparent text-sm text-encore-text placeholder:text-encore-muted outline-none"
            />
            <button
              type="submit"
              className="btn-cobalt h-9 shrink-0 rounded-full px-4 text-xs font-semibold text-white"
            >
              Play
            </button>
          </form>

          <p className="hero-stagger mt-5 text-xs font-medium text-encore-muted">
            No account required • Local-first storage • MIT License
          </p>
        </div>
      </section>

      {/* Band 2: Native Offline & Local Audio Showcase */}
      <section
        id="offline"
        className={cn(
          "relative overflow-hidden px-6 py-20 sm:py-28",
          isDark
            ? "bg-gradient-to-br from-[#12265c] via-[#0d1530] to-[#080b14] text-white"
            : "bg-gradient-to-br from-[#e4ecff] via-[#eef3ff] to-[#f7f9ff] text-[#0a0f1e]"
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full blur-[110px]",
            isDark ? "bg-[#2563eb]/30" : "bg-[#60a5fa]/25"
          )}
        />

        <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          {/* Overlapping Matte Obsidian Phone Mockups */}
          <div className="relative mx-auto flex h-[390px] w-full max-w-[448px] items-end justify-center sm:h-[430px]">
            {/* Back Phone: Quick Picks */}
            <div className="absolute bottom-0 left-2 w-[206px] overflow-hidden rounded-[28px] bg-[#0b0e17] text-white shadow-[0_24px_56px_rgba(3,8,24,0.45)] ring-1 ring-[#93c5fd]/15 sm:left-4 sm:w-[232px]">
              <div className="flex items-center justify-between px-4 py-3 text-xs text-[#9ca6be]">
                <span className="font-medium text-white/90">Sangeet</span>
                <span className="font-medium text-[#6ea8ff]">Quick picks</span>
              </div>
              <div className="space-y-1 px-2 pb-2.5">
                {showcaseTracks.slice(0, 5).map((t) => (
                  <button
                    key={`back-${t.id}`}
                    type="button"
                    onClick={() =>
                      previewTracks.length > 0
                        ? handlePlayPreview(t)
                        : handleGuestStart()
                    }
                    className="flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors duration-150 hover:bg-white/10"
                  >
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                      <TrackArtwork
                        src={t.thumbnail}
                        trackId={t.id}
                        alt={t.title}
                        iconClassName="h-4 w-4"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white">
                        {t.title}
                      </p>
                      <p className="truncate text-[11px] text-[#8d98b2]">
                        {t.artist}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Front Phone: Offline Player Preview */}
            <div className="relative z-10 ml-24 w-[228px] overflow-hidden rounded-[30px] bg-[#0e121e] text-white shadow-[0_28px_68px_rgba(2,6,20,0.62)] ring-1 ring-[#93c5fd]/18 sm:ml-28 sm:w-[260px]">
              <div className="flex items-center justify-between px-4 pb-2 pt-3.5 text-[11px] text-[#9ca6be]">
                <span>Offline library</span>
                <span className="inline-flex items-center gap-1 font-medium text-[#6ea8ff]">
                  <Check className="h-3.5 w-3.5" strokeWidth={2} />
                  Saved
                </span>
              </div>

              <div className="px-4 pb-4 pt-1">
                <div className="aspect-square w-full overflow-hidden rounded-2xl bg-[#151b2d] shadow-inner">
                  <TrackArtwork
                    src={featuredTrack.thumbnail}
                    trackId={featuredTrack.id}
                    alt={featuredTrack.title}
                    loading="eager"
                    iconClassName="h-8 w-8"
                  />
                </div>

                <div className="mt-3.5 text-center">
                  <p className="truncate text-sm font-semibold text-white">
                    {featuredTrack.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#9ca6be]">
                    {featuredTrack.artist}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-xl bg-white/[0.06] px-3 py-2 text-xs text-[#c7d3eb]">
                  <span className="inline-flex items-center gap-1.5">
                    <HardDriveDownload
                      className="h-3.5 w-3.5 text-[#6ea8ff]"
                      strokeWidth={1.7}
                    />
                    Saved locally
                  </span>
                  <span className="h-4 w-7 rounded-full bg-[#3b82f6] p-0.5">
                    <span className="block h-3 w-3 translate-x-3 rounded-full bg-white" />
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    previewTracks.length > 0
                      ? handlePlayPreview(featuredTrack)
                      : handleGuestStart()
                  }
                  className="btn-cobalt mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-xs font-semibold text-white"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Play track
                </button>
              </div>
            </div>
          </div>

          {/* Right Editorial Copy */}
          <div className="max-w-md">
            <h2
              className={cn(
                "text-3xl font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[44px]",
                isDark ? "text-white" : "text-[#0a0f1e]"
              )}
            >
              Download music, listen offline
            </h2>
            <p
              className={cn(
                "mt-4 text-base leading-7",
                isDark ? "text-[#b6c4e0]" : "text-[#394867]"
              )}
            >
              Save tracks in one click or scan your own MP3, FLAC, and WAV
              folders with automatic ID3 tag and cover art parsing. Everything
              lives in local storage for instant offline playback anywhere.
            </p>

            {/* Cobalt Accent Rule + Interactive Preview Switcher */}
            <div className="mt-8 flex items-center gap-5">
              <span
                className={cn(
                  "h-[2px] w-8 rounded-full",
                  isDark ? "bg-[#6ea8ff]" : "bg-[#2563eb]"
                )}
              />
              <div className="flex items-center gap-2.5">
                {[0, 1, 2].map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPhoneSlide(idx)}
                    aria-label={`Show preview ${idx + 1}`}
                    className={cn(
                      "h-2.5 rounded-full transition-all duration-200",
                      phoneSlide % 3 === idx
                        ? isDark
                          ? "w-6 bg-[#6ea8ff]"
                          : "w-6 bg-[#2563eb]"
                        : isDark
                          ? "w-2.5 bg-white/30 hover:bg-white/55"
                          : "w-2.5 bg-[#1e3a8a]/25 hover:bg-[#1e3a8a]/50"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Band 3: "No ads, just tracks" Live Playable Shelf */}
      <section
        id="trending"
        className="bg-encore-shell px-6 py-16 sm:py-24"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.02em] text-encore-text sm:text-3xl">
                No ads, just tracks
              </h2>
              <p className="mt-1.5 text-sm text-encore-subdued">
                Trending right now — select any cover to start playing
              </p>
            </div>
            <button
              type="button"
              onClick={handleGuestStart}
              className="h-9 rounded-full bg-encore-elevated px-4 text-xs font-semibold text-encore-text transition-colors duration-150 hover:bg-encore-elevated-highlight active:scale-[0.98]"
            >
              Open full library
            </button>
          </div>

          <MediaShelf>
            {showcaseTracks.slice(0, 8).map((track) => {
              const active = currentTrack?.id === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() =>
                    previewTracks.length > 0
                      ? handlePlayPreview(track)
                      : handleGuestStart()
                  }
                  className="group flex w-[172px] shrink-0 flex-col rounded-2xl bg-encore-elevated/65 p-3 text-left transition-[background-color,transform] duration-150 hover:bg-encore-elevated-highlight active:scale-[0.98] sm:w-[192px]"
                >
                  <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-xl bg-encore-elevated">
                    <TrackArtwork
                      src={track.thumbnail}
                      trackId={track.id}
                      alt={track.title}
                      loading="lazy"
                      iconClassName="h-7 w-7"
                      imgClassName="transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <span
                      className={cn(
                        "btn-cobalt absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full text-white transition-[transform,opacity] duration-150",
                        active && isPlaying
                          ? "translate-y-0 opacity-100"
                          : "translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                      )}
                    >
                      {active && isPlaying ? (
                        <Pause className="h-4 w-4 fill-current" />
                      ) : (
                        <Play className="h-4 w-4 translate-x-0.5 fill-current" />
                      )}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "w-full truncate text-sm font-semibold",
                      active ? "text-encore-accent" : "text-encore-text"
                    )}
                  >
                    {track.title}
                  </p>
                  <p className="mt-1 w-full truncate text-xs text-encore-subdued">
                    {track.artist}
                  </p>
                </button>
              );
            })}
          </MediaShelf>
        </div>
      </section>

      {/* Band 4: Synced Lyrics & Pure Audio Showcase */}
      <section className="bg-encore-base px-6 py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Player Mockup: Now Playing + Synced Lyrics */}
          <div className="mx-auto w-full max-w-[304px]">
            <div
              className={cn(
                "overflow-hidden rounded-[32px] bg-encore-elevated p-4",
                isDark
                  ? "shadow-[0_24px_60px_rgba(0,0,0,0.48)]"
                  : "shadow-[0_20px_52px_rgba(15,23,42,0.12)]"
              )}
            >
              <div className="aspect-square w-full overflow-hidden rounded-2xl bg-encore-shell">
                <TrackArtwork
                  src={lyricsTrack.thumbnail}
                  trackId={lyricsTrack.id}
                  alt={lyricsTrack.title}
                  loading="lazy"
                  iconClassName="h-9 w-9"
                />
              </div>

              <div className="mt-4">
                <p className="truncate text-sm font-semibold text-encore-text">
                  {lyricsTrack.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-encore-subdued">
                  {lyricsTrack.artist}
                </p>
              </div>

              {/* Synced Lyrics Lines with Glowing Cobalt Active Line */}
              <div className="mt-3.5 space-y-1.5 rounded-2xl bg-encore-base/90 p-3 text-xs">
                <div className="flex items-baseline gap-2.5 px-2 py-1 text-encore-muted">
                  <span className="tabular-nums">01:12</span>
                  <span>Static fades out after midnight</span>
                </div>
                <div className="flex items-baseline gap-2.5 rounded-xl bg-encore-tinted px-2 py-1.5 font-semibold text-encore-text">
                  <span className="tabular-nums text-encore-accent">01:18</span>
                  <span>Synced line-by-line in real time</span>
                </div>
                <div className="flex items-baseline gap-2.5 px-2 py-1 text-encore-subdued">
                  <span className="tabular-nums">01:24</span>
                  <span>Tap any line to seek immediately</span>
                </div>
              </div>

              {/* Audio Transport */}
              <div className="mt-4">
                <div className="h-1 w-full overflow-hidden rounded-full bg-encore-rail">
                  <div className="h-full w-1/2 rounded-full bg-encore-accent" />
                </div>
                <div className="mt-3.5 flex items-center justify-center gap-6 text-encore-text">
                  <SkipBack className="h-4 w-4 fill-current opacity-65" />
                  <button
                    type="button"
                    onClick={() =>
                      previewTracks.length > 0
                        ? handlePlayPreview(lyricsTrack)
                        : handleGuestStart()
                    }
                    aria-label="Play featured track"
                    className="btn-cobalt flex h-10 w-10 items-center justify-center rounded-full text-white"
                  >
                    <Play className="h-4 w-4 translate-x-0.5 fill-current" />
                  </button>
                  <SkipForward className="h-4 w-4 fill-current opacity-65" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Editorial Copy + 3 Tonal Feature Cards */}
          <div className="max-w-lg">
            <h2 className="text-3xl font-semibold leading-[1.1] tracking-[-0.025em] text-encore-text sm:text-[44px]">
              Play any song, read every line
            </h2>
            <p className="mt-4 text-base leading-7 text-encore-subdued">
              Audio-first streaming paired with time-synced LRCLIB lyrics,
              automatic SponsorBlock intro skipping, and Quick Picks radio that
              keeps your queue full.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  icon: Mic2,
                  title: "Synced lyrics",
                  desc: "Click-to-seek lines and PNG lyric cards"
                },
                {
                  icon: ShieldCheck,
                  title: "SponsorBlock",
                  desc: "Skips non-music intros and spoken skits"
                },
                {
                  icon: Radio,
                  title: "Quick picks",
                  desc: "Start endless radio from any song"
                }
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-2xl bg-encore-elevated/80 p-4 transition-colors duration-150 hover:bg-encore-elevated-highlight"
                >
                  <Icon
                    className="h-4 w-4 text-encore-accent"
                    strokeWidth={1.75}
                  />
                  <p className="mt-2.5 text-sm font-semibold text-encore-text">
                    {title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-encore-subdued">
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Band 5: Sangeet on Every Device — 3 Cobalt Device Cards */}
      <section id="apps" className="bg-encore-shell px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-encore-text sm:text-3xl">
              Sangeet on every device
            </h2>
            <p className="mt-2.5 text-sm leading-6 text-encore-subdued">
              Free and open-source across Web, Android, and native Rust for
              Windows
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Card 1: Web Studio */}
            <div
              className={cn(
                "flex flex-col overflow-hidden rounded-3xl bg-encore-base transition-transform duration-200 hover:-translate-y-0.5",
                isDark
                  ? "shadow-[0_18px_48px_rgba(2,6,18,0.45)]"
                  : "shadow-[0_14px_36px_rgba(15,23,42,0.08)]"
              )}
            >
              <div
                className={cn(
                  "px-6 pb-11 pt-8 text-center",
                  isDark
                    ? "bg-gradient-to-b from-[#162a63]/85 via-[#111c3d]/70 to-transparent"
                    : "bg-gradient-to-b from-[#dce8ff] via-[#ecf2ff] to-transparent"
                )}
              >
                <Globe
                  className="mx-auto h-5 w-5 text-encore-accent"
                  strokeWidth={1.7}
                />
                <p className="mt-3 text-xs font-medium text-encore-mint">
                  Browser
                </p>
                <h3 className="mt-1 text-xl font-semibold text-encore-text">
                  Web Studio
                </h3>
                <p className="mt-1 text-xs text-encore-subdued">
                  Instant streaming, zero install
                </p>
              </div>
              <div className="-mt-5 flex flex-1 flex-col items-center px-6 pb-8 text-center">
                <button
                  type="button"
                  onClick={handleGuestStart}
                  className="btn-cobalt inline-flex h-10 items-center justify-center rounded-full px-6 text-sm font-semibold text-white"
                >
                  Open web player
                </button>
                <p className="mt-5 text-xs leading-6 text-encore-subdued">
                  Three-panel desktop layout, floating mobile navigation, synced
                  lyrics, and IndexedDB offline audio storage.
                </p>
              </div>
            </div>

            {/* Card 2: Android App */}
            <div
              className={cn(
                "flex flex-col overflow-hidden rounded-3xl bg-encore-base transition-transform duration-200 hover:-translate-y-0.5",
                isDark
                  ? "shadow-[0_18px_48px_rgba(2,4,12,0.5)]"
                  : "shadow-[0_14px_36px_rgba(15,23,42,0.08)]"
              )}
            >
              <div
                className={cn(
                  "px-6 pb-11 pt-8 text-center",
                  isDark
                    ? "bg-gradient-to-b from-[#1d46a8]/90 via-[#132559]/75 to-transparent"
                    : "bg-gradient-to-b from-[#cfe0ff] via-[#e6eeff] to-transparent"
                )}
              >
                <Smartphone
                  className="mx-auto h-5 w-5 text-encore-accent"
                  strokeWidth={1.7}
                />
                <p className="mt-3 text-xs font-medium text-encore-mint">
                  Native Media3 ExoPlayer
                </p>
                <h3 className="mt-1 text-xl font-semibold text-encore-text">
                  Android App
                </h3>
                <p className="mt-1 text-xs tabular-nums text-encore-subdued">
                  {apkMeta?.available && apkMeta.sizeBytes
                    ? `v2.3 • ${(apkMeta.sizeBytes / (1024 * 1024)).toFixed(1)} MB APK`
                    : "Background audio & lock-screen controls"}
                </p>
              </div>
              <div className="-mt-5 flex flex-1 flex-col items-center px-6 pb-8 text-center">
                <a
                  href="/api/download/android"
                  download="sangeet-android.apk"
                  className="btn-cobalt inline-flex h-10 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white"
                >
                  <Download className="h-4 w-4" strokeWidth={1.8} />
                  Download APK
                </a>
                <p className="mt-5 text-xs leading-6 text-encore-subdued">
                  Native foreground audio service, lock-screen media
                  notifications, Google sign-in deep link, and 120 Hz UI.
                </p>
              </div>
            </div>

            {/* Card 3: Windows Desktop in Rust */}
            <div
              className={cn(
                "flex flex-col overflow-hidden rounded-3xl bg-encore-base transition-transform duration-200 hover:-translate-y-0.5",
                isDark
                  ? "shadow-[0_18px_48px_rgba(2,6,18,0.45)]"
                  : "shadow-[0_14px_36px_rgba(15,23,42,0.08)]"
              )}
            >
              <div
                className={cn(
                  "px-6 pb-11 pt-8 text-center",
                  isDark
                    ? "bg-gradient-to-b from-[#172852]/85 via-[#101833]/70 to-transparent"
                    : "bg-gradient-to-b from-[#e0e9ff] via-[#eff4ff] to-transparent"
                )}
              >
                <Laptop
                  className="mx-auto h-5 w-5 text-encore-accent"
                  strokeWidth={1.7}
                />
                <p className="mt-3 text-xs font-medium text-encore-mint">
                  Built in Rust • Tauri v2
                </p>
                <h3 className="mt-1 text-xl font-semibold text-encore-text">
                  Windows App
                </h3>
                <p className="mt-1 text-xs tabular-nums text-encore-subdued">
                  {winMeta?.available && winMeta.sizeBytes
                    ? `Portable • ${(winMeta.sizeBytes / (1024 * 1024)).toFixed(1)} MB .exe`
                    : "Lightweight native Windows binary"}
                </p>
              </div>
              <div className="-mt-5 flex flex-1 flex-col items-center px-6 pb-8 text-center">
                <a
                  href="/api/download/windows"
                  download="Sangeet.exe"
                  className="btn-cobalt inline-flex h-10 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white"
                >
                  <Download className="h-4 w-4" strokeWidth={1.8} />
                  Download .exe
                </a>
                <p className="mt-5 text-xs leading-6 text-encore-subdued">
                  Compiled in Rust with native WebView2, ~3 MB footprint, system
                  tray playback controls, and single-instance windowing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Band 6: Multi-Column Footer with Shasant Signature & GitHub Link */}
      <SiteFooter />
    </div>
  );
}
