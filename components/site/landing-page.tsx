"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Download,
  Heart,
  Laptop,
  ListMusic,
  Mic2,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { SangeetMark } from "@/components/brand/sangeet-mark";
import { Artwork } from "@/components/music/artwork";
import { getArtist, getTrack, tracks } from "@/lib/catalog";
import { formatDuration } from "@/lib/utils";
import { useAppStore, type ThemePreference } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { toast } from "@/store/ui-store";

const APK_URL = "/api/download/android";
const EXE_URL = "/api/download/windows";

const GENRE_LINKS = [
  { id: "ambient", name: "Ambient", note: "Long-form quiet and focus" },
  { id: "electronic", name: "Electronic", note: "Nocturnal synth & rhythm" },
  { id: "soul", name: "Soul & R&B", note: "Warm keys and vocals" },
  { id: "indie", name: "Indie", note: "Independent guitars & bands" },
  { id: "jazz", name: "Jazz", note: "Acoustic rooms & brass" },
  { id: "alternative", name: "Alternative", note: "Left-of-center pop" },
];

const THEMES: Array<{ id: ThemePreference; name: string; swatch: string; note: string }> = [
  { id: "dark", name: "Obsidian Glass", swatch: "#080909", note: "Deep obsidian + emerald glow" },
  { id: "midnight", name: "Midnight OLED", swatch: "#05070e", note: "Sapphire OLED black" },
  { id: "dusk", name: "Amber Dusk", swatch: "#100b08", note: "Warm espresso & copper" },
  { id: "emerald", name: "Emerald Forest", swatch: "#06110b", note: "Rich jade glass wash" },
  { id: "aurora", name: "Aurora Violet", swatch: "#0a0712", note: "Cosmic plum & violet" },
  { id: "crimson", name: "Velvet Crimson", swatch: "#110609", note: "Deep wine & rose glow" },
];

export function LandingPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const session = useAuthStore((state) => state.session);
  const activeTheme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);

  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isLoading = usePlayerStore((state) => state.isLoading);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const next = usePlayerStore((state) => state.next);
  const previous = usePlayerStore((state) => state.previous);
  const seek = usePlayerStore((state) => state.seek);

  const likedTrackIds = useLibraryStore((state) => state.likedTrackIds);
  const toggleLike = useLibraryStore((state) => state.toggleLike);

  // Pick 6 real tracks with artwork for the live landing player & quick crate
  const showcaseTracks = useMemo(() => {
    const withArt = tracks.filter(
      (t) => t.artwork && (t.artwork.startsWith("https://") || t.artwork.startsWith("/art/")),
    );
    return (withArt.length >= 6 ? withArt : tracks).slice(0, 6);
  }, []);

  const showcaseIds = useMemo(() => showcaseTracks.map((t) => t.id), [showcaseTracks]);

  const activeTrack = useMemo(() => {
    if (currentTrackId) {
      const found = getTrack(currentTrackId);
      if (found) return found;
    }
    return showcaseTracks[0] ?? tracks[0];
  }, [currentTrackId, showcaseTracks]);

  const activeArtist = activeTrack ? getArtist(activeTrack.artistId) : undefined;
  const activeDuration =
    currentTrackId === activeTrack?.id && duration > 0 ? duration : activeTrack?.duration ?? 0;
  const activeTime = currentTrackId === activeTrack?.id ? currentTime : 0;
  const progressPct = activeDuration > 0 ? Math.min(100, (activeTime / activeDuration) * 100) : 0;
  const isCurrentActive = Boolean(activeTrack && currentTrackId === activeTrack.id);
  const liked = activeTrack ? likedTrackIds.includes(activeTrack.id) : false;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push("/home");
    }
  };

  const handlePlayShowcase = () => {
    if (!activeTrack) return;
    if (isCurrentActive) {
      togglePlay();
    } else {
      playTrack(activeTrack.id, showcaseIds, "Sangeet Showcase");
    }
  };

  const handleSelectTheme = (themeId: ThemePreference) => {
    setTheme(themeId);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = themeId;
    }
    toast.success("Theme updated", `Switched to ${themeId}.`);
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground antialiased selection:bg-[#1ed760]/30 selection:text-white transition-colors duration-300">
      {/* Subtle Ambient Liquid Glass Lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_75%_48%_at_16%_0%,rgba(30,215,96,0.12),transparent_60%),radial-gradient(ellipse_60%_45%_at_86%_12%,rgba(99,102,241,0.1),transparent_62%)]"
      />

      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#080909]/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          <Link
            href="/"
            className="flex min-h-[44px] items-center gap-2.5"
            aria-label="Sangeet home"
          >
            <SangeetMark size={26} />
            <span className="font-display text-lg font-bold tracking-tight text-white">Sangeet</span>
          </Link>

          <nav className="hidden items-center gap-7 text-[13px] font-medium text-[#8e9690] md:flex">
            <a href="#listen" className="transition hover:text-white">
              Listen
            </a>
            <a href="#platforms" className="transition hover:text-white">
              Android &amp; Desktop
            </a>
            <a href="#themes" className="transition hover:text-white">
              Themes
            </a>
            <Link href="/explore" className="transition hover:text-white">
              Explore
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link
                href="/profile"
                className="flex min-h-[44px] items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.06] px-3.5 text-xs font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl transition hover:border-white/25 hover:bg-white/[0.1]"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1ed760] text-[10px] font-bold text-black">
                  {session?.initials ?? "U"}
                </span>
                <span className="hidden sm:inline">{session?.displayName ?? "Profile"}</span>
              </Link>
            ) : (
              <Link
                href="/auth"
                className="inline-flex min-h-[44px] items-center rounded-full px-3.5 text-xs font-medium text-[#a4aca6] transition hover:bg-white/[0.06] hover:text-white"
              >
                Sign in
              </Link>
            )}
            <Link
              href="/home"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#1ed760] px-4 text-xs font-bold text-black shadow-[0_6px_20px_rgba(30,215,96,0.28)] transition hover:bg-[#1db954]"
            >
              Open player
            </Link>
          </div>
        </div>
      </header>

      {/* Hero: Direct Value + Live Playable Deck */}
      <main>
        <section className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-8 sm:pt-16 sm:pb-24">
          <div className="grid items-start gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
            {/* Left: Editorial Copy & Search */}
            <div className="pt-2 lg:pt-6">
              <h1 className="font-display text-[clamp(2.35rem,5vw,3.9rem)] font-bold leading-[1.06] tracking-[-0.035em] text-white">
                Music without the noise.
              </h1>

              <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-[#8e9690] sm:text-base">
                An open, ad-free music player for Nepali, Hindi, and global records. Play instantly in
                your browser, keep audio running in the background on Android, and follow word-synced
                lyrics.
              </p>

              <form
                onSubmit={handleSearchSubmit}
                className="mt-7 flex max-w-md items-center rounded-full border border-white/[0.14] bg-white/[0.05] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl transition focus-within:border-[#1ed760]/70"
              >
                <div className="flex flex-1 items-center gap-2.5 px-3.5">
                  <Search className="h-4 w-4 shrink-0 text-[#7c857e]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search an artist, song, or album..."
                    className="min-h-[40px] w-full bg-transparent text-sm text-white placeholder:text-[#6d766f] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-white px-5 text-xs font-semibold text-black transition hover:bg-white/90"
                >
                  Search
                </button>
              </form>

              {/* Prominent Liquid Glass Download & Launch Actions */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/home"
                  className="inline-flex min-h-[46px] items-center gap-2 rounded-full bg-[#1ed760] px-5 text-xs font-bold text-black shadow-[0_10px_28px_rgba(30,215,96,0.3)] transition hover:bg-[#1db954]"
                >
                  Start listening <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <a
                  href={APK_URL}
                  download="sangeet-android.apk"
                  className="liquid-glass inline-flex min-h-[46px] items-center gap-2 rounded-full px-4.5 text-xs font-semibold text-white transition hover:border-[#1ed760]/45 hover:bg-white/[0.11]"
                >
                  <Smartphone className="h-4 w-4 text-[#1ed760]" />
                  <span>Android APK</span>
                  <Download className="h-3.5 w-3.5 text-white/60" />
                </a>
                <a
                  href={EXE_URL}
                  download="Sangeet.exe"
                  className="liquid-glass inline-flex min-h-[46px] items-center gap-2 rounded-full px-4.5 text-xs font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.11]"
                >
                  <Laptop className="h-4 w-4 text-indigo-300" />
                  <span>Windows .exe</span>
                  <Download className="h-3.5 w-3.5 text-white/60" />
                </a>
              </div>

              <div className="mt-3.5 inline-flex items-center gap-2 rounded-full border border-[#1ed760]/25 bg-[#1ed760]/10 px-3.5 py-1.5 text-xs font-medium text-[#b8f7cd] backdrop-blur-md">
                <WifiOff className="h-3.5 w-3.5 shrink-0 text-[#1ed760]" />
                <span>Offline playback included in APK &amp; .exe</span>
              </div>

              <dl className="mt-9 grid max-w-md grid-cols-3 gap-4 border-t border-white/[0.08] pt-6 text-xs">
                <div>
                  <dt className="text-[#727a74]">Playback</dt>
                  <dd className="mt-1 font-medium text-white">Background audio</dd>
                </div>
                <div>
                  <dt className="text-[#727a74]">Lyrics</dt>
                  <dd className="mt-1 font-medium text-white">Synced karaoke</dd>
                </div>
                <div>
                  <dt className="text-[#727a74]">Offline</dt>
                  <dd className="mt-1 font-medium text-white">APK &amp; .exe ready</dd>
                </div>
              </dl>
            </div>

            {/* Right: Live, Actually-Playable Liquid Glass Sangeet Deck */}
            <div className="mx-auto w-full max-w-[390px]">
              <div className="relative overflow-hidden rounded-[28px] border border-white/[0.14] bg-gradient-to-br from-white/[0.085] via-[#121614]/85 to-[#0c0f0d]/95 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-2xl">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
                />

                <div className="flex items-center justify-between pb-3.5 text-[11px] text-[#8e9690]">
                  <span className="flex items-center gap-2 font-medium text-white">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isCurrentActive && isPlaying ? "bg-[#1ed760] animate-pulse" : "bg-white/25"
                      }`}
                    />
                    {isCurrentActive && isPlaying ? "Playing now" : "Ready to play"}
                  </span>
                  <Link
                    href="/now-playing"
                    className="inline-flex min-h-[32px] items-center rounded-full px-2 transition hover:text-white"
                  >
                    Full player
                  </Link>
                </div>

                {activeTrack && (
                  <>
                    <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/[0.12] bg-[#181b18] shadow-inner">
                      <Artwork
                        src={activeTrack.artwork}
                        alt={activeTrack.title}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-lg font-bold text-white">
                          {activeTrack.title}
                        </h2>
                        <p className="truncate text-xs text-[#9ba39d]">
                          {activeArtist?.name ?? "Sangeet"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextLiked = toggleLike(activeTrack.id);
                          toast.success(
                            nextLiked ? "Saved to Liked Songs" : "Removed from Liked Songs",
                            activeTrack.title,
                          );
                        }}
                        aria-label={liked ? "Unlike track" : "Like track"}
                        className="flex h-11 min-h-[44px] w-11 shrink-0 items-center justify-center rounded-full text-[#8e9690] transition hover:bg-white/[0.08] hover:text-white"
                      >
                        <Heart className={`h-4 w-4 ${liked ? "fill-[#1ed760] text-[#1ed760]" : ""}`} />
                      </button>
                    </div>

                    {/* Interactive Scrubber */}
                    <div className="mt-4">
                      <div
                        role="slider"
                        tabIndex={0}
                        aria-label="Seek track position"
                        aria-valuemin={0}
                        aria-valuemax={activeDuration}
                        aria-valuenow={activeTime}
                        onClick={(e) => {
                          if (!isCurrentActive || activeDuration <= 0) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                          seek(ratio * activeDuration);
                        }}
                        className="group relative flex h-5 cursor-pointer items-center"
                      >
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/12">
                          <div
                            className="h-full rounded-full bg-[#1ed760] transition-[width] duration-150"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between font-mono text-[11px] tabular-nums text-[#727a74]">
                        <span>{formatDuration(activeTime)}</span>
                        <span>{formatDuration(activeDuration)}</span>
                      </div>
                    </div>

                    {/* Real Controls */}
                    <div className="mt-3 flex items-center justify-between px-1">
                      <Link
                        href="/now-playing"
                        aria-label="Open lyrics"
                        className="flex h-11 min-h-[44px] w-11 items-center justify-center rounded-full text-[#8e9690] transition hover:bg-white/[0.08] hover:text-white"
                      >
                        <Mic2 className="h-4 w-4" />
                      </Link>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (!isCurrentActive) {
                              playTrack(activeTrack.id, showcaseIds, "Sangeet Showcase");
                            } else {
                              previous();
                            }
                          }}
                          aria-label="Previous track"
                          className="flex h-11 min-h-[44px] w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/[0.08] hover:text-white"
                        >
                          <SkipBack className="h-5 w-5 fill-current" />
                        </button>

                        <button
                          type="button"
                          onClick={handlePlayShowcase}
                          aria-label={isCurrentActive && isPlaying ? "Pause" : "Play"}
                          className="flex h-12 min-h-[48px] w-12 items-center justify-center rounded-full bg-white text-black shadow-[0_8px_24px_rgba(255,255,255,0.2)] transition hover:scale-105 active:scale-95"
                        >
                          {isCurrentActive && isLoading ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                          ) : isCurrentActive && isPlaying ? (
                            <Pause className="h-5 w-5 fill-current" />
                          ) : (
                            <Play className="ml-0.5 h-5 w-5 fill-current" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!isCurrentActive) {
                              const second = showcaseTracks[1] ?? activeTrack;
                              playTrack(second.id, showcaseIds, "Sangeet Showcase");
                            } else {
                              next();
                            }
                          }}
                          aria-label="Next track"
                          className="flex h-11 min-h-[44px] w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/[0.08] hover:text-white"
                        >
                          <SkipForward className="h-5 w-5 fill-current" />
                        </button>
                      </div>

                      <Link
                        href="/queue"
                        aria-label="Open queue"
                        className="flex h-11 min-h-[44px] w-11 items-center justify-center rounded-full text-[#8e9690] transition hover:bg-white/[0.08] hover:text-white"
                      >
                        <ListMusic className="h-4 w-4" />
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Crate: Click any track to play right now */}
        <section id="listen" className="border-t border-white/[0.07] bg-[#0b0d0b]/80">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8 sm:py-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Listen right now
                </h2>
                <p className="mt-1 text-sm text-[#8e9690]">
                  Click any track below to start playing immediately.
                </p>
              </div>
              <Link
                href="/explore"
                className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-[#1ed760] hover:underline"
              >
                Browse full catalog <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-7 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {showcaseTracks.map((track) => {
                const artist = getArtist(track.artistId);
                const selected = currentTrackId === track.id;
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => playTrack(track.id, showcaseIds, "Sangeet Showcase")}
                    className={`group flex min-h-[64px] items-center gap-3 rounded-2xl border p-2.5 text-left transition ${
                      selected
                        ? "border-[#1ed760]/45 bg-[#151a16]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                        : "border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#181b18]">
                      <Artwork src={track.artwork} alt={track.title} className="h-full w-full object-cover" />
                      <span
                        className={`absolute inset-0 flex items-center justify-center bg-black/50 transition ${
                          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        {selected && isPlaying ? (
                          <Pause className="h-4 w-4 fill-white text-white" />
                        ) : (
                          <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
                        )}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-semibold ${
                          selected ? "text-[#1ed760]" : "text-white"
                        }`}
                      >
                        {track.title}
                      </p>
                      <p className="truncate text-xs text-[#8e9690]">{artist?.name ?? "Sangeet"}</p>
                    </div>
                    <span className="pr-1 font-mono text-[11px] tabular-nums text-[#666e68]">
                      {formatDuration(track.duration)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Compact Genre Row */}
            <div className="mt-8 flex flex-wrap gap-2">
              {GENRE_LINKS.map((genre) => (
                <Link
                  key={genre.id}
                  href={`/genre/${genre.id}`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/[0.11] bg-white/[0.04] px-4 py-2 text-xs font-medium text-white transition hover:border-white/25 hover:bg-white/[0.08]"
                >
                  <span>{genre.name}</span>
                  <span className="text-[#727a74]">{genre.note}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Platforms & Offline Playback */}
        <section id="platforms" className="border-t border-white/[0.07]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8 sm:py-16">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Download Sangeet Apps
                </h2>
                <p className="mt-1 text-sm text-[#8e9690]">
                  Offline playback included in APK &amp; .exe — save tracks and listen anywhere.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1ed760]/30 bg-[#1ed760]/12 px-3.5 py-1.5 text-xs font-semibold text-[#1ed760]">
                <WifiOff className="h-3.5 w-3.5" />
                Offline playback included in APK &amp; .exe
              </span>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="liquid-glass-dark relative overflow-hidden rounded-[26px] p-6 sm:p-7">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
                    <Smartphone className="h-4 w-4 text-[#1ed760]" />
                    <span>Android APK</span>
                  </div>
                  <span className="rounded-full border border-[#1ed760]/30 bg-[#1ed760]/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1ed760]">
                    Offline Ready
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#9ba39d]">
                  Install the native Android APK directly from Sangeet. Enjoy background audio,
                  lock-screen media controls, and offline playback included in APK &amp; .exe.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={APK_URL}
                    download="sangeet-android.apk"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#1ed760] px-5 text-xs font-bold text-black shadow-[0_8px_24px_rgba(30,215,96,0.28)] transition hover:bg-[#1db954]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Android APK
                  </a>
                  <Link
                    href="/home"
                    className="liquid-glass inline-flex min-h-[44px] items-center rounded-full px-4 text-xs font-medium text-white transition hover:bg-white/[0.1]"
                  >
                    Open Web App
                  </Link>
                </div>
              </div>

              <div className="liquid-glass-dark relative overflow-hidden rounded-[26px] p-6 sm:p-7">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
                    <Laptop className="h-4 w-4 text-indigo-300" />
                    <span>Windows Desktop (.exe)</span>
                  </div>
                  <span className="rounded-full border border-indigo-400/30 bg-indigo-400/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-200">
                    Offline Ready
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#9ba39d]">
                  Run Sangeet as a standalone Windows app with hardware media-key support, system tray
                  minimization, your synced library, and offline playback included in APK &amp; .exe.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={EXE_URL}
                    download="Sangeet.exe"
                    className="liquid-glass inline-flex min-h-[44px] items-center gap-2 rounded-full border-white/25 bg-white/95 px-5 text-xs font-bold text-black shadow-md transition hover:bg-white"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Sangeet.exe
                  </a>
                  <Link
                    href="/settings"
                    className="liquid-glass inline-flex min-h-[44px] items-center rounded-full px-4 text-xs font-medium text-white transition hover:bg-white/[0.1]"
                  >
                    App settings
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Compact Live Theme Switcher */}
        <section id="themes" className="border-t border-white/[0.07] bg-[#0b0d0b]/80">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-white">Player surface</h2>
                <p className="mt-1 text-xs text-[#8e9690]">
                  Choose a dark palette for the app. Saved to your device.
                </p>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {THEMES.map((item) => {
                  const active = activeTheme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTheme(item.id)}
                      className={`flex min-h-[52px] items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition ${
                        active
                          ? "border-[#1ed760] bg-[#141a15]"
                          : "border-white/[0.1] bg-white/[0.04] hover:border-white/25"
                      }`}
                    >
                      <span
                        className="h-5 w-5 shrink-0 rounded-full border border-white/20"
                        style={{ backgroundColor: item.swatch }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white">{item.name}</p>
                        <p className="truncate text-[11px] text-[#8e9690]">{item.note}</p>
                      </div>
                      {active && <Check className="h-3.5 w-3.5 shrink-0 text-[#1ed760]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Footer (Website Routes Only) */}
      <footer className="border-t border-white/[0.07] py-8 text-xs text-[#6d766f]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 sm:flex-row sm:items-center sm:px-8">
          <div className="flex items-center gap-2.5">
            <SangeetMark size={20} />
            <span>Sangeet · Ad-free music player</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:gap-5">
            <Link href="/home" className="inline-flex min-h-[36px] items-center hover:text-white transition">
              Player
            </Link>
            <Link href="/explore" className="inline-flex min-h-[36px] items-center hover:text-white transition">
              Explore
            </Link>
            <Link href="/library" className="inline-flex min-h-[36px] items-center hover:text-white transition">
              Library
            </Link>
            <a
              href={APK_URL}
              download="sangeet-android.apk"
              className="inline-flex min-h-[36px] items-center hover:text-white transition"
            >
              Android APK
            </a>
            <a
              href={EXE_URL}
              download="Sangeet.exe"
              className="inline-flex min-h-[36px] items-center hover:text-white transition"
            >
              Windows .exe
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
