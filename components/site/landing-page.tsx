"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Download, Search } from "lucide-react";
import { SangeetMark } from "@/components/brand/sangeet-mark";
import { cn } from "@/lib/utils";
import { useAppStore, type ThemePreference } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/store/ui-store";

const APK_URL = "/api/download/android";
const EXE_URL = "/api/download/windows";

const THEMES: Array<{
  id: ThemePreference;
  name: string;
  surface: string;
  accent: string;
  note: string;
}> = [
  {
    id: "dark",
    name: "Obsidian Studio",
    surface: "#16161A",
    accent: "#1ED760",
    note: "Graphite noir with neutral framing",
  },
  {
    id: "midnight",
    name: "Midnight Slate",
    surface: "#111A2E",
    accent: "#3898FF",
    note: "Deep ink sapphire studio blue",
  },
  {
    id: "dusk",
    name: "Warm Espresso",
    surface: "#1F1814",
    accent: "#E58E49",
    note: "Roasted charcoal & copper depth",
  },
  {
    id: "emerald",
    name: "Evergreen Nocturne",
    surface: "#11221B",
    accent: "#20E070",
    note: "Deep botanical pine slate",
  },
  {
    id: "aurora",
    name: "Velvet Indigo",
    surface: "#1A142E",
    accent: "#A874FF",
    note: "Editorial plum & soft indigo",
  },
  {
    id: "crimson",
    name: "Noir Crimson",
    surface: "#241217",
    accent: "#F4516C",
    note: "Burgundy charcoal with rose edge",
  },
];

const FEATURE_SHOWCASES = [
  {
    eyebrow: "Personalized Home & Live Charts",
    title: "Your music taste, cleanly organized.",
    description:
      "Home blends live trending music charts with your listening history, Quick Picks, featured releases, and mood filters—without visual clutter.",
    points: [
      "Real-time trending charts alongside your saved tastes",
      "Unified desktop sidebar and sliding mobile dock",
      "Responsive layout engineered for phones and desktops",
    ],
    image: "/showcase/home.png",
    imageAlt: "Sangeet Home screen featuring Quick Picks, Featured Release, and personalized rows",
    href: "/home",
    cta: "Explore Home",
  },
  {
    eyebrow: "Search, Discovery & Studio Audio FX",
    title: "Find any song fast and shape every frequency.",
    description:
      "YouTube-style instant autocomplete, catalog browsing, synced lyrics, loop controls, and a Web Audio DSP chain with 5-band EQ, Reverb, 3D Width, Slowed + Reverb, and speed presets.",
    points: [
      "Live autocomplete dropdown with artist & query suggestions",
      "Built-in 5-band Equalizer, Reverb, 3D Width & speed presets",
      "Synced lyrics drawer, Up Next queue, and sleep timer",
    ],
    image: "/showcase/search.png",
    imageAlt: "Sangeet Search screen with live discovery categories and trending rankings",
    href: "/search",
    cta: "Try Search",
  },
  {
    eyebrow: "Theme Studio & Customization",
    title: "Six studio dark themes tuned for long sessions.",
    description:
      "Switch the entire workspace between six balanced matte dark surfaces and six accent palettes with live previewing across navigation, cards, sliders, and mobile mini-player.",
    points: [
      "Six matte dark themes including Obsidian Studio and Midnight Slate",
      "Cohesive accent system across controls, buttons, and dock",
      "Preferences persist seamlessly across browser, Android, and desktop",
    ],
    image: "/showcase/themes.png",
    imageAlt: "Sangeet Theme Studio inside Settings showing live surface previews and accents",
    href: "/settings?tab=appearance",
    cta: "Customize Themes",
  },
];

function Reveal({
  children,
  direction = "up",
  delay = 0,
  className,
}: {
  children: ReactNode;
  direction?: "up" | "left" | "right";
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -36px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hiddenTransform =
    direction === "left"
      ? "translate-y-6 lg:translate-y-0 lg:-translate-x-8 scale-[0.985]"
      : direction === "right"
        ? "translate-y-6 lg:translate-y-0 lg:translate-x-8 scale-[0.985]"
        : "translate-y-7 scale-[0.985]";

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
        shown ? "translate-x-0 translate-y-0 scale-100 opacity-100" : `${hiddenTransform} opacity-0`,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function LandingPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [heroReady, setHeroReady] = useState(false);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const session = useAuthStore((state) => state.session);
  const activeTheme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setHeroReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push("/home");
    }
  };

  const handleSelectTheme = (themeId: ThemePreference) => {
    setTheme(themeId);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = themeId;
    }
    const label = THEMES.find((t) => t.id === themeId)?.name ?? themeId;
    toast.success("Theme updated", `Switched to ${label}.`);
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-background text-foreground antialiased transition-colors duration-200">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:gap-4 sm:px-8">
          <Link
            href="/"
            className="flex min-h-[40px] shrink-0 items-center gap-2.5"
            aria-label="Sangeet home"
          >
            <SangeetMark size={24} />
            <span className="font-display text-base font-bold tracking-tight text-foreground sm:text-lg">
              Sangeet
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-[13px] font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition hover:text-foreground">
              Features
            </a>
            <a href="#platforms" className="transition hover:text-foreground">
              Windows &amp; Android
            </a>
            <a href="#themes" className="transition hover:text-foreground">
              Themes
            </a>
            <Link href="/explore" className="transition hover:text-foreground">
              Catalog
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {isAuthenticated ? (
              <Link
                href="/profile"
                className="flex min-h-[38px] items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground transition hover:bg-elevated sm:min-h-[40px] sm:px-3.5"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {session?.initials ?? "U"}
                </span>
                <span className="hidden sm:inline">{session?.displayName ?? "Profile"}</span>
              </Link>
            ) : (
              <Link
                href="/auth"
                className="inline-flex min-h-[38px] items-center rounded-full px-3 text-xs font-medium text-muted-foreground transition hover:bg-elevated hover:text-foreground sm:min-h-[40px] sm:px-3.5"
              >
                Sign in
              </Link>
            )}
            <Link
              href="/home"
              className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-primary px-3.5 text-xs font-bold text-primary-foreground transition hover:brightness-110 sm:min-h-[40px] sm:px-4"
            >
              Open player
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero with Smooth Entrance & Framed Real Website Screenshot */}
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-8 sm:pb-20 sm:pt-14 lg:pb-24 lg:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
            <div
              className={cn(
                "min-w-0 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
                heroReady ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary sm:text-xs">
                Open Source Music Platform
              </p>
              <h1 className="mt-2.5 font-display text-[clamp(2.1rem,6vw,3.75rem)] font-bold leading-[1.06] tracking-[-0.035em] text-foreground">
                Music, engineered cleanly.
              </h1>
              <p className="mt-3.5 max-w-[50ch] text-sm leading-relaxed text-muted-foreground sm:mt-4 sm:text-base">
                Ad-free streaming for Nepali, Hindi, and global music on the web, paired with
                dedicated Windows desktop and Android applications featuring automatic local audio
                scanning and true offline playback.
              </p>

              <form
                onSubmit={handleSearchSubmit}
                className="mt-6 flex w-full max-w-md items-center rounded-full border border-border bg-card p-1.5 transition focus-within:border-primary sm:mt-7"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2 px-3 sm:gap-2.5 sm:px-3.5">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search artists, songs, or albums..."
                    className="min-h-[36px] w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none sm:min-h-[38px]"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex min-h-[38px] shrink-0 items-center justify-center rounded-full bg-foreground px-4 text-xs font-semibold text-background transition hover:opacity-90 sm:min-h-[40px] sm:px-5"
                >
                  Search
                </button>
              </form>

              <div className="mt-5 flex flex-col gap-2.5 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href="/home"
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-primary-foreground transition hover:brightness-110 active:scale-[0.98] sm:w-auto"
                >
                  Open Web Player
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <div className="grid grid-cols-2 gap-2.5 sm:flex sm:items-center">
                  <a
                    href={EXE_URL}
                    download="Sangeet.exe"
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:bg-elevated active:scale-[0.98]"
                  >
                    <span>Windows .exe</span>
                    <Download className="h-3.5 w-3.5 text-primary" />
                  </a>
                  <a
                    href={APK_URL}
                    download="sangeet-android.apk"
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:bg-elevated active:scale-[0.98]"
                  >
                    <span>Android APK</span>
                    <Download className="h-3.5 w-3.5 text-primary" />
                  </a>
                </div>
              </div>

              <dl className="mt-7 grid max-w-md grid-cols-3 gap-3 border-t border-border pt-5 text-[11px] sm:mt-8 sm:gap-4 sm:pt-6 sm:text-xs">
                <div>
                  <dt className="text-muted-foreground">Web Player</dt>
                  <dd className="mt-1 font-semibold text-foreground">Instant streaming</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Native Apps</dt>
                  <dd className="mt-1 font-semibold text-foreground">Windows &amp; Android</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Audio Engine</dt>
                  <dd className="mt-1 font-semibold text-foreground">5-Band EQ &amp; FX</dd>
                </div>
              </dl>
            </div>

            {/* Right: Real Framed Website Screenshot Showcase */}
            <div
              className={cn(
                "mx-auto w-full max-w-[660px] transition-all duration-700 delay-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
                heroReady ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-[0.98] opacity-0",
              )}
            >
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_28px_72px_-20px_rgba(0,0,0,0.85)] transition-transform duration-500 ease-out hover:-translate-y-1">
                <div className="flex items-center justify-between border-b border-border bg-elevated/80 px-3.5 py-2 sm:px-4 sm:py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-white/15 sm:h-2.5 sm:w-2.5" />
                    <span className="h-2 w-2 rounded-full bg-white/15 sm:h-2.5 sm:w-2.5" />
                    <span className="h-2 w-2 rounded-full bg-white/15 sm:h-2.5 sm:w-2.5" />
                  </div>
                  <span className="rounded-md border border-border bg-background/60 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:px-3 sm:text-[11px]">
                    Sangeet · Workspace
                  </span>
                  <span className="w-6 sm:w-8" />
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/showcase/home.png"
                  alt="Sangeet desktop interface screenshot showing personalized Quick Picks and live trending releases"
                  className="block w-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Product Features Paired with Real Website Screenshots & Scroll Reveal Slides */}
        <section id="features" className="border-t border-border bg-surface/50">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-16 lg:py-20">
            <Reveal direction="up" className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary sm:text-xs">
                Platform Features
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
                Built like a dedicated music studio.
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Every view is designed for fast discovery, responsive touch gestures, and consistent
                typography across browser, desktop, and mobile.
              </p>
            </Reveal>

            <div className="mt-10 space-y-14 sm:mt-12 sm:space-y-16 lg:space-y-20">
              {FEATURE_SHOWCASES.map((item, idx) => {
                const reverse = idx % 2 === 1;
                return (
                  <div
                    key={item.title}
                    className="grid items-center gap-7 sm:gap-8 lg:grid-cols-12 lg:gap-12"
                  >
                    <Reveal
                      direction={reverse ? "right" : "left"}
                      delay={50}
                      className={`lg:col-span-5 ${reverse ? "lg:order-2" : ""}`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary sm:text-xs">
                        {item.eyebrow}
                      </p>
                      <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                      <ul className="mt-4 space-y-2 border-l-2 border-primary/35 pl-3.5 text-xs text-foreground/90 sm:mt-5 sm:space-y-2.5 sm:text-[13px]">
                        {item.points.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                      <div className="mt-5 sm:mt-6">
                        <Link
                          href={item.href}
                          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:bg-elevated"
                        >
                          <span>{item.cta}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-primary" />
                        </Link>
                      </div>
                    </Reveal>

                    <Reveal
                      direction={reverse ? "left" : "right"}
                      delay={120}
                      className={`lg:col-span-7 ${reverse ? "lg:order-1" : ""}`}
                    >
                      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)] transition-transform duration-500 ease-out hover:-translate-y-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image}
                          alt={item.imageAlt}
                          loading="lazy"
                          className="block w-full object-cover"
                        />
                      </div>
                    </Reveal>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Dedicated Standalone Apps: Windows .exe & Android .apk */}
        <section id="platforms" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-16 lg:py-20">
            <Reveal direction="up" className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary sm:text-xs">
                  Standalone Applications
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Separate native apps for Windows &amp; Android
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Dedicated applications with built-in offline caching and automatic local device
                  music scanning—downloaded directly from Sangeet.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-[11px] font-semibold text-primary sm:text-xs">
                Direct website download · Built-in offline player
              </span>
            </Reveal>

            <div className="mt-8 grid gap-5 sm:mt-9 sm:gap-6 md:grid-cols-2">
              <Reveal direction="up" delay={60}>
                <div className="flex h-full flex-col justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-white/[0.15] sm:p-7">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-display text-base font-bold text-foreground sm:text-lg">
                        Sangeet for Windows (.exe)
                      </h3>
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        Desktop App
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      Portable Windows executable with automatic Music folder scanning, hardware
                      media-key support, system tray controls, offline track downloads, and a full
                      standalone player when offline.
                    </p>
                    <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Local library</dt>
                        <dd className="mt-0.5 font-medium text-foreground">Auto PC folder scan</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Controls</dt>
                        <dd className="mt-0.5 font-medium text-foreground">Hardware media keys</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
                    <a
                      href={EXE_URL}
                      download="Sangeet.exe"
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-primary-foreground transition hover:brightness-110"
                    >
                      <span>Download Sangeet.exe</span>
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <Link
                      href="/library"
                      className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-border bg-elevated px-4 text-xs font-medium text-foreground transition hover:bg-white/[0.08]"
                    >
                      Library overview
                    </Link>
                  </div>
                </div>
              </Reveal>

              <Reveal direction="up" delay={140}>
                <div className="flex h-full flex-col justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-white/[0.15] sm:p-7">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-display text-base font-bold text-foreground sm:text-lg">
                        Sangeet for Android (.apk)
                      </h3>
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        Android APK
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      Native Android application featuring a background audio service, automatic
                      MediaStore scanning on your phone, lock-screen media controls, gesture
                      navigation, and an embedded offline player.
                    </p>
                    <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Local library</dt>
                        <dd className="mt-0.5 font-medium text-foreground">Auto MediaStore scan</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Offline mode</dt>
                        <dd className="mt-0.5 font-medium text-foreground">Saved tracks ready</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
                    <a
                      href={APK_URL}
                      download="sangeet-android.apk"
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-primary-foreground transition hover:brightness-110"
                    >
                      <span>Download Android APK</span>
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <Link
                      href="/home"
                      className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-border bg-elevated px-4 text-xs font-medium text-foreground transition hover:bg-white/[0.08]"
                    >
                      Launch Web App
                    </Link>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Live Studio Theme Switcher */}
        <section id="themes" className="border-t border-border bg-surface/50">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-14">
            <Reveal
              direction="up"
              className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="max-w-xs">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary sm:text-xs">
                  Appearance
                </p>
                <h2 className="mt-1.5 font-display text-xl font-bold text-foreground">
                  Six studio themes
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Try any surface theme right here or fine-tune accent colors inside Settings.
                </p>
              </div>
              <div className="grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {THEMES.map((item) => {
                  const active = activeTheme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTheme(item.id)}
                      className={cn(
                        "flex min-h-[56px] items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition active:scale-[0.985]",
                        active
                          ? "border-primary bg-primary/[0.08]"
                          : "border-border bg-card hover:bg-elevated",
                      )}
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/15"
                        style={{ backgroundColor: item.surface }}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.accent }}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground">{item.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{item.note}</p>
                      </div>
                      {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-border py-8 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 sm:flex-row sm:items-center sm:px-8">
          <div className="flex items-center gap-2.5">
            <SangeetMark size={20} />
            <span>Sangeet · Open-source ad-free music platform</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:gap-5">
            <Link href="/home" className="inline-flex min-h-[36px] items-center transition hover:text-foreground">
              Player
            </Link>
            <Link href="/explore" className="inline-flex min-h-[36px] items-center transition hover:text-foreground">
              Explore
            </Link>
            <Link href="/library" className="inline-flex min-h-[36px] items-center transition hover:text-foreground">
              Library
            </Link>
            <a
              href={APK_URL}
              download="sangeet-android.apk"
              className="inline-flex min-h-[36px] items-center transition hover:text-foreground"
            >
              Android APK
            </a>
            <a
              href={EXE_URL}
              download="Sangeet.exe"
              className="inline-flex min-h-[36px] items-center transition hover:text-foreground"
            >
              Windows .exe
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
