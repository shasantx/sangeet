"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Compass,
  Download,
  HardDrive,
  Laptop,
  ListMusic,
  Palette,
  Search,
  SlidersHorizontal,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { SangeetMark } from "@/components/brand/sangeet-mark";
import { useAppStore, type ThemePreference } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/store/ui-store";

const APK_URL = "/api/download/android";
const EXE_URL = "/api/download/windows";

const THEMES: Array<{
  id: ThemePreference;
  name: string;
  swatch: string;
  surface: string;
  accent: string;
  note: string;
}> = [
  {
    id: "dark",
    name: "Obsidian Studio",
    swatch: "#09090B",
    surface: "#16161A",
    accent: "#1ED760",
    note: "Graphite noir with neutral framing",
  },
  {
    id: "midnight",
    name: "Midnight Slate",
    swatch: "#070B14",
    surface: "#111A2E",
    accent: "#3898FF",
    note: "Deep ink sapphire studio blue",
  },
  {
    id: "dusk",
    name: "Warm Espresso",
    swatch: "#0E0B09",
    surface: "#1F1814",
    accent: "#E58E49",
    note: "Roasted charcoal & copper depth",
  },
  {
    id: "emerald",
    name: "Evergreen Nocturne",
    swatch: "#060D0A",
    surface: "#11221B",
    accent: "#20E070",
    note: "Deep botanical pine slate",
  },
  {
    id: "aurora",
    name: "Velvet Indigo",
    swatch: "#0A0812",
    surface: "#1A142E",
    accent: "#A874FF",
    note: "Editorial plum & soft indigo",
  },
  {
    id: "crimson",
    name: "Noir Crimson",
    swatch: "#10080B",
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
    bullets: [
      "Real-time trending charts alongside your saved tastes",
      "Unified desktop sidebar and mobile swipe tab bar",
      "Responsive layout engineered for mobile and wide displays",
    ],
    image: "/showcase/home.png",
    imageAlt: "Sangeet Home screen featuring Quick Picks, Featured Release, and personalized rows",
    href: "/home",
    cta: "Explore Home",
    icon: Compass,
  },
  {
    eyebrow: "Search, Discovery & Studio Audio FX",
    title: "Find any song fast and shape every frequencies.",
    description:
      "YouTube-style instant autocomplete, catalog browsing, synced karaoke lyrics, loop controls, and a Web Audio DSP chain with 5-band EQ, Reverb, 3D Width, Slowed + Reverb, and speed presets.",
    bullets: [
      "Live autocomplete dropdown with artist & query suggestions",
      "Built-in 5-band Equalizer, Reverb, 3D Width & Nightcore/Slowed modes",
      "Word-synced lyrics drawer, Up Next queue, and sleep timer",
    ],
    image: "/showcase/search.png",
    imageAlt: "Sangeet Search screen with live discovery categories and trending rankings",
    href: "/search",
    cta: "Try Search",
    icon: SlidersHorizontal,
  },
  {
    eyebrow: "Theme Studio & Customization",
    title: "Six studio dark themes tuned for long sessions.",
    description:
      "Switch the entire workspace between six carefully balanced studio surfaces and six accent palettes with live previewing across navigation, cards, controls, and mobile mini-player.",
    bullets: [
      "Six matte dark themes including Obsidian Studio and Midnight Slate",
      "Cohesive accent system across sliders, badges, buttons, and dock",
      "Preferences persist seamlessly across browser, Android, and desktop",
    ],
    image: "/showcase/themes.png",
    imageAlt: "Sangeet Theme Studio inside Settings showing live surface previews and accents",
    href: "/settings?tab=appearance",
    cta: "Customize Themes",
    icon: Palette,
  },
];

export function LandingPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const session = useAuthStore((state) => state.session);
  const activeTheme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);

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
    <div className="min-h-screen bg-background text-foreground antialiased transition-colors duration-200">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link
            href="/"
            className="flex min-h-[44px] items-center gap-2.5"
            aria-label="Sangeet home"
          >
            <SangeetMark size={26} />
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
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

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link
                href="/profile"
                className="flex min-h-[40px] items-center gap-2 rounded-full border border-border bg-card px-3.5 text-xs font-medium text-foreground transition hover:bg-elevated"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {session?.initials ?? "U"}
                </span>
                <span className="hidden sm:inline">{session?.displayName ?? "Profile"}</span>
              </Link>
            ) : (
              <Link
                href="/auth"
                className="inline-flex min-h-[40px] items-center rounded-full px-3.5 text-xs font-medium text-muted-foreground transition hover:bg-elevated hover:text-foreground"
              >
                Sign in
              </Link>
            )}
            <Link
              href="/home"
              className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground transition hover:brightness-110"
            >
              Open player
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero with Real Live Desktop & Mobile Screenshots */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16">
          <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Open Source Music Platform
              </p>
              <h1 className="mt-3 font-display text-[clamp(2.35rem,4.6vw,3.75rem)] font-bold leading-[1.06] tracking-[-0.035em] text-foreground">
                Music, engineered cleanly.
              </h1>
              <p className="mt-4 max-w-[50ch] text-[15px] leading-relaxed text-muted-foreground sm:text-base">
                Ad-free streaming for Nepali, Hindi, and global music on the web, paired with
                dedicated Windows desktop and Android applications featuring automatic local audio
                scanning and true offline playback.
              </p>

              <form
                onSubmit={handleSearchSubmit}
                className="mt-7 flex max-w-md items-center rounded-full border border-border bg-card p-1.5 transition focus-within:border-primary"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5 px-3.5">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search artists, songs, or albums..."
                    className="min-h-[38px] w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-full bg-foreground px-5 text-xs font-semibold text-background transition hover:opacity-90"
                >
                  Search
                </button>
              </form>

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <Link
                  href="/home"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-primary-foreground transition hover:brightness-110"
                >
                  Open Web Player <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <a
                  href={EXE_URL}
                  download="Sangeet.exe"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:bg-elevated"
                >
                  <Laptop className="h-4 w-4 text-primary" />
                  <span>Windows .exe</span>
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
                <a
                  href={APK_URL}
                  download="sangeet-android.apk"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:bg-elevated"
                >
                  <Smartphone className="h-4 w-4 text-primary" />
                  <span>Android APK</span>
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              </div>

              <dl className="mt-8 grid max-w-md grid-cols-3 gap-4 border-t border-border pt-6 text-xs">
                <div>
                  <dt className="text-muted-foreground">Web Player</dt>
                  <dd className="mt-1 font-semibold text-foreground">Instant streaming</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Windows &amp; Android</dt>
                  <dd className="mt-1 font-semibold text-foreground">Native offline apps</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Audio Engine</dt>
                  <dd className="mt-1 font-semibold text-foreground">5-Band EQ &amp; FX</dd>
                </div>
              </dl>
            </div>

            {/* Right: Real Framed Website Screenshot Showcase */}
            <div className="mx-auto w-full max-w-[660px]">
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_28px_72px_-20px_rgba(0,0,0,0.85)]">
                <div className="flex items-center justify-between border-b border-border bg-elevated/80 px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  </div>
                  <span className="rounded-md border border-border bg-background/60 px-3 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Sangeet · Web &amp; Desktop Workspace
                  </span>
                  <span className="w-8" />
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

        {/* Product Features Paired with Real Website Screenshots */}
        <section id="features" className="border-t border-border bg-surface/50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Platform Features
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
                Built like a dedicated music studio.
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Every view is designed for fast discovery, responsive touch gestures, and
                consistent typography across browser, desktop, and mobile.
              </p>
            </div>

            <div className="mt-12 space-y-16">
              {FEATURE_SHOWCASES.map((item, idx) => {
                const Icon = item.icon;
                const reverse = idx % 2 === 1;
                return (
                  <div
                    key={item.title}
                    className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12"
                  >
                    <div className={`lg:col-span-5 ${reverse ? "lg:order-2" : ""}`}>
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                        {item.eyebrow}
                      </p>
                      <h3 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-foreground">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                      <ul className="mt-5 space-y-2.5 text-xs text-foreground/90 sm:text-[13px]">
                        {item.bullets.map((bullet) => (
                          <li key={bullet} className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-6">
                        <Link
                          href={item.href}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:bg-elevated"
                        >
                          {item.cta}
                          <ArrowRight className="h-3.5 w-3.5 text-primary" />
                        </Link>
                      </div>
                    </div>

                    <div className={`lg:col-span-7 ${reverse ? "lg:order-1" : ""}`}>
                      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image}
                          alt={item.imageAlt}
                          loading="lazy"
                          className="block w-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Dedicated Standalone Apps: Windows .exe & Android .apk */}
        <section id="platforms" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Standalone Applications
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Separate native apps for Windows &amp; Android
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Not a home-screen shortcut. Install dedicated apps with built-in offline caching
                  and automatic local device song scanning.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary">
                <WifiOff className="h-3.5 w-3.5" />
                Direct website download · Offline player built in
              </span>
            </div>

            <div className="mt-9 grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 sm:p-7">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 text-base font-semibold text-foreground">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                        <Laptop className="h-4 w-4" />
                      </span>
                      <span>Sangeet for Windows (.exe)</span>
                    </div>
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      Portable Desktop App
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Standalone Windows desktop executable with automatic Music folder scanning,
                    hardware media-key support, system tray controls, offline track downloads, and a
                    full built-in offline player when disconnected.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="h-3.5 w-3.5 text-primary" />
                      Auto PC folder scan
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ListMusic className="h-3.5 w-3.5 text-primary" />
                      Hardware media keys
                    </span>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={EXE_URL}
                    download="Sangeet.exe"
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-primary-foreground transition hover:brightness-110"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Sangeet.exe
                  </a>
                  <Link
                    href="/library"
                    className="inline-flex min-h-[42px] items-center rounded-full border border-border bg-elevated px-4 text-xs font-medium text-foreground transition hover:bg-white/[0.08]"
                  >
                    Library overview
                  </Link>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 sm:p-7">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 text-base font-semibold text-foreground">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                        <Smartphone className="h-4 w-4" />
                      </span>
                      <span>Sangeet for Android (.apk)</span>
                    </div>
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      Native APK App
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Dedicated Android app featuring a native background foreground service,
                    automatic MediaStore audio scanning on your phone, lock-screen media controls,
                    gesture navigation, and an embedded offline music player.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="h-3.5 w-3.5 text-primary" />
                      Phone MediaStore scan
                    </span>
                    <span className="flex items-center gap-1.5">
                      <WifiOff className="h-3.5 w-3.5 text-primary" />
                      Offline downloads ready
                    </span>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={APK_URL}
                    download="sangeet-android.apk"
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-primary-foreground transition hover:brightness-110"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Android APK
                  </a>
                  <Link
                    href="/home"
                    className="inline-flex min-h-[42px] items-center rounded-full border border-border bg-elevated px-4 text-xs font-medium text-foreground transition hover:bg-white/[0.08]"
                  >
                    Launch Web App
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Live Studio Theme Switcher */}
        <section id="themes" className="border-t border-border bg-surface/50">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xs">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Appearance
                </p>
                <h2 className="mt-1.5 font-display text-xl font-bold text-foreground">
                  Six studio themes
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Try any surface theme right here or fine-tune accent colors inside Settings.
                </p>
              </div>
              <div className="grid flex-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {THEMES.map((item) => {
                  const active = activeTheme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTheme(item.id)}
                      className={`flex min-h-[56px] items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                        active
                          ? "border-primary bg-primary/[0.08]"
                          : "border-border bg-card hover:bg-elevated"
                      }`}
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
            </div>
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
            <Link href="/home" className="inline-flex min-h-[36px] items-center hover:text-foreground transition">
              Player
            </Link>
            <Link href="/explore" className="inline-flex min-h-[36px] items-center hover:text-foreground transition">
              Explore
            </Link>
            <Link href="/library" className="inline-flex min-h-[36px] items-center hover:text-foreground transition">
              Library
            </Link>
            <a
              href={APK_URL}
              download="sangeet-android.apk"
              className="inline-flex min-h-[36px] items-center hover:text-foreground transition"
            >
              Android APK
            </a>
            <a
              href={EXE_URL}
              download="Sangeet.exe"
              className="inline-flex min-h-[36px] items-center hover:text-foreground transition"
            >
              Windows .exe
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
