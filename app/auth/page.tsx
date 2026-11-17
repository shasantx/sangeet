"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Headphones,
  Laptop,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
  Sparkles,
  User,
} from "lucide-react";
import { SangeetMark } from "@/components/brand/sangeet-mark";
import { Artwork } from "@/components/music/artwork";
import { albums, getArtist, selectedAlbums } from "@/lib/catalog";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/store/ui-store";

const APK_URL = "/api/download/android";
const EXE_URL = "/api/download/windows";

const LYRIC_SNIPPETS = [
  {
    prev: "City lights blur into neon green",
    active: "Lossless studio warmth in every frame",
    next: "Synced word by word, zero interruptions",
  },
  {
    prev: "Lossless studio warmth in every frame",
    active: "Synced word by word, zero interruptions",
    next: "Take your queue from browser to pocket",
  },
  {
    prev: "Synced word by word, zero interruptions",
    active: "Take your queue from browser to pocket",
    next: "City lights blur into neon green",
  },
];

function sanitizeClientReturnTo(value: string | null | undefined, fallback = "/home"): string {
  if (!value || typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(trimmed)
  ) {
    return fallback;
  }
  try {
    const base = new URL("https://sangeet.local");
    const parsed = new URL(trimmed, base);
    if (parsed.origin !== base.origin) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function getPasswordStrength(password: string): {
  label: "Weak" | "Good" | "Strong";
  level: 1 | 2 | 3;
  barColor: string;
  textColor: string;
} {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  if (password.length < 6 || score <= 1) {
    return {
      label: "Weak",
      level: 1,
      barColor: "bg-rose-400",
      textColor: "text-rose-300",
    };
  }
  if (score <= 3) {
    return {
      label: "Good",
      level: 2,
      barColor: "bg-amber-400",
      textColor: "text-amber-300",
    };
  }
  return {
    label: "Strong",
    level: 3,
    barColor: "bg-[#1ed760]",
    textColor: "text-[#1ed760]",
  };
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09a7 7 0 0 1 0-4.18V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.85z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function LiquidShowcasePanel() {
  const [lyricIndex, setLyricIndex] = useState(0);
  const [activeStackIndex, setActiveStackIndex] = useState<number | null>(null);

  const stackAlbums = useMemo(() => {
    const source = selectedAlbums.length >= 3 ? selectedAlbums : albums;
    return source.slice(0, 3);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLyricIndex((prev) => (prev + 1) % LYRIC_SNIPPETS.length);
    }, 3400);
    return () => window.clearInterval(timer);
  }, []);

  const currentLyric = LYRIC_SNIPPETS[lyricIndex];
  const selectedMiniAlbum =
    activeStackIndex !== null ? stackAlbums[activeStackIndex] : undefined;
  const selectedMiniArtist = selectedMiniAlbum
    ? getArtist(selectedMiniAlbum.artistId)
    : undefined;

  const heroArtSrc = selectedMiniAlbum?.artwork || "/art/albums/the-weeknd-sao-paulo.jpg";
  const heroTitle = selectedMiniAlbum?.title || "São Paulo · Spatial Mix";
  const heroSubtitle =
    selectedMiniArtist?.name || "The Weeknd · 320 kbps Lossless Stream";

  return (
    <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-white/[0.1] bg-[radial-gradient(circle_at_15%_12%,rgba(30,215,96,0.14),transparent_48%),radial-gradient(circle_at_88%_88%,rgba(99,102,241,0.14),transparent_48%),#0a0d0b] p-7 lg:p-8 md:flex">
      <style>{`
        @keyframes sangeetEqPulse {
          0%, 100% { transform: scaleY(0.32); opacity: 0.72; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>

      {/* Specular ambient blooms */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-12 -top-12 h-72 w-72 rounded-full bg-[#1ed760]/18 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-14 -right-12 h-72 w-72 rounded-full bg-indigo-500/18 blur-3xl"
      />

      {/* Top Navigation */}
      <div className="z-10 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.06] px-4 text-xs font-medium text-[#b5bdb7] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-xl transition hover:border-white/25 hover:bg-white/[0.1] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to home
        </Link>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1ed760]/30 bg-[#1ed760]/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#1ed760] backdrop-blur-xl">
          <Sparkles className="h-3 w-3" /> iOS 26 Glass
        </span>
      </div>

      {/* Interactive Liquid Glass Now Streaming Preview Card */}
      <div className="z-10 my-auto py-5">
        <div className="relative overflow-hidden rounded-[28px] border border-white/[0.14] bg-gradient-to-br from-white/[0.09] via-white/[0.035] to-white/[0.06] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-2xl">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
          />

          {/* Live Status + Animated Equalizer */}
          <div className="mb-3.5 flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-black/40 px-3 py-1 text-[11px] font-semibold text-white">
              <span className="h-2 w-2 rounded-full bg-[#1ed760] shadow-[0_0_10px_#1ed760]" />
              <span>Now Streaming on Sangeet</span>
            </div>

            <div
              aria-hidden="true"
              className="flex h-5 items-end gap-1 rounded-full border border-white/[0.1] bg-black/35 px-2.5 py-1"
            >
              {[0, 140, 280, 90].map((delay, idx) => (
                <span
                  key={idx}
                  className="h-3 w-0.5 origin-bottom rounded-full bg-[#1ed760]"
                  style={{
                    animation: `sangeetEqPulse ${0.85 + idx * 0.12}s ease-in-out ${delay}ms infinite`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Primary Artwork + Stacked Mini Catalog Albums */}
          <div className="grid grid-cols-[1fr_72px] gap-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/[0.14] bg-black/40">
              <img
                src={heroArtSrc}
                alt={heroTitle}
                className="h-full w-full object-cover transition duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
              <div className="absolute inset-x-3.5 bottom-3">
                <p className="truncate font-display text-sm font-bold text-white">
                  {heroTitle}
                </p>
                <p className="truncate text-[11px] text-white/75">{heroSubtitle}</p>
              </div>
            </div>

            {/* Interactive Stacked Mini Album Cards from @/lib/catalog */}
            <div className="flex flex-col justify-between gap-2">
              {stackAlbums.map((album, idx) => {
                const isSelected = activeStackIndex === idx;
                return (
                  <button
                    key={album.id}
                    type="button"
                    onClick={() =>
                      setActiveStackIndex((curr) => (curr === idx ? null : idx))
                    }
                    title={`Preview ${album.title}`}
                    aria-label={`Preview ${album.title}`}
                    className={`group relative aspect-square w-full overflow-hidden rounded-xl border transition ${
                      isSelected
                        ? "border-[#1ed760] ring-2 ring-[#1ed760]/40 scale-[1.03]"
                        : "border-white/[0.15] opacity-85 hover:opacity-100 hover:border-white/30"
                    }`}
                  >
                    <Artwork
                      src={album.artwork}
                      alt={album.title}
                      className="h-full w-full"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Synchronized Lyrics Snippet Preview */}
          <button
            type="button"
            onClick={() => setLyricIndex((prev) => (prev + 1) % LYRIC_SNIPPETS.length)}
            className="mt-3.5 w-full rounded-2xl border border-white/[0.1] bg-black/45 px-3.5 py-2.5 text-left transition hover:border-white/20"
            aria-label="Cycle synchronized lyrics preview"
          >
            <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8e9690]">
              <span>Live Synced Lyrics</span>
              <span className="text-[#1ed760]">Tap to sync</span>
            </div>
            <p className="truncate text-[11px] text-white/40">{currentLyric.prev}</p>
            <p className="truncate py-0.5 text-xs font-semibold text-white">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#1ed760] align-middle" />
              {currentLyric.active}
            </p>
            <p className="truncate text-[11px] text-white/40">{currentLyric.next}</p>
          </button>

          {/* Platform Badges */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-white/85">
              <CheckCircle2 className="h-3 w-3 text-[#1ed760]" /> Web
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-white/85">
              <Smartphone className="h-3 w-3 text-[#1ed760]" /> Android APK
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-white/85">
              <Laptop className="h-3 w-3 text-[#1ed760]" /> Windows .exe
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Quick-Download Bar (Website Routes Only) */}
      <div className="z-10 space-y-2.5 border-t border-white/[0.08] pt-4">
        <div className="flex items-center justify-between text-[11px] text-[#8e9690]">
          <span>Direct native apps · Offline playback included</span>
          <span className="text-[#1ed760] font-medium">Free &amp; Ad-free</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <a
            href={APK_URL}
            download="sangeet-android.apk"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-white/[0.14] bg-white/[0.06] px-3 text-xs font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-xl transition hover:border-[#1ed760]/40 hover:bg-white/[0.1]"
          >
            <Smartphone className="h-3.5 w-3.5 text-[#1ed760]" />
            <span>Android APK</span>
            <Download className="h-3 w-3 text-white/55" />
          </a>
          <a
            href={EXE_URL}
            download="Sangeet.exe"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-white/[0.14] bg-white/[0.06] px-3 text-xs font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-xl transition hover:border-white/30 hover:bg-white/[0.1]"
          >
            <Laptop className="h-3.5 w-3.5 text-indigo-300" />
            <span>Windows .exe</span>
            <Download className="h-3 w-3 text-white/55" />
          </a>
        </div>
      </div>
    </div>
  );
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleState = searchParams?.get("google");
  const reason = searchParams?.get("reason");
  const initialTab = searchParams?.get("tab") === "signup" ? "signup" : "signin";
  const returnTo = useMemo(
    () => sanitizeClientReturnTo(searchParams?.get("returnTo"), "/home"),
    [searchParams],
  );

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const session = useAuthStore((state) => state.session);
  const loginWithEmail = useAuthStore((state) => state.loginWithEmail);
  const isAdminReturn =
    returnTo === "/admin" || returnTo.startsWith("/admin/") || returnTo.startsWith("/admin?");

  const [mode, setMode] = useState<"signin" | "signup">(initialTab);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (isAdminReturn && !session?.isAdmin) {
      return;
    }
    router.replace(returnTo);
  }, [isAuthenticated, isAdminReturn, returnTo, router, session?.isAdmin]);

  const handleGoogleSignIn = () => {
    window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const handleFormLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) {
      toast.error("Valid email required", "Please enter a valid email address.");
      return;
    }
    if (mode === "signup" && (!name.trim() || name.trim().length > 80)) {
      toast.error("Name required", "Please enter your name (up to 80 characters).");
      return;
    }
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          name: mode === "signup" ? name.trim().slice(0, 80) : undefined,
          requireAdmin: isAdminReturn,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        session?: { isAdmin?: boolean };
      };
      if (!res.ok) {
        setIsSubmitting(false);
        toast.error("Sign in failed", data.error || "Unable to sign in.");
        return;
      }
      const isAdmin = Boolean(data.session?.isAdmin);
      loginWithEmail(cleanEmail, mode === "signup" ? name.trim().slice(0, 80) : undefined, isAdmin);
      toast.success(
        mode === "signup" ? "Welcome to Sangeet!" : "Welcome back!",
        isAdmin ? "Admin access unlocked." : "Streaming access unlocked. Enjoy your music.",
      );
      router.replace(returnTo);
    } catch {
      loginWithEmail(cleanEmail, mode === "signup" ? name.trim().slice(0, 80) : undefined, false);
      router.replace(isAdminReturn ? "/home" : returnTo);
    }
  };

  const playRequiredNotice = reason === "play_required";

  const errorMessage = useMemo(() => {
    if (googleState !== "error") return null;
    if (reason === "not_configured") {
      return "Google OAuth credentials are being configured. You can log in directly with your email below.";
    }
    if (reason === "access_denied" || reason === "cancelled") {
      return "Google sign-in was cancelled. You can log in with email below.";
    }
    if (reason === "suspended") {
      return "This account has been suspended by an administrator.";
    }
    return "Could not connect to Google sign-in. You can log in with email below.";
  }, [googleState, reason]);

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  return (
    <div className="flex w-full flex-col justify-center px-5 py-7 sm:px-10 sm:py-11 md:w-1/2 lg:px-12">
      {/* Mobile Top Bar */}
      <div className="flex items-center justify-between pb-5 md:hidden">
        <Link
          href={returnTo === "/auth" ? "/" : returnTo}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.06] px-4 text-xs font-medium text-[#b5bdb7] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-xl transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <SangeetMark size={26} />
          <span className="font-display text-sm font-bold text-white">Sangeet</span>
        </div>
      </div>

      {/* Brand Header (Desktop) */}
      <div className="hidden items-center gap-2.5 md:flex">
        <SangeetMark size={30} />
        <span className="font-display text-lg font-bold tracking-tight text-white">Sangeet</span>
      </div>

      <div className="mt-3 md:mt-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          {mode === "signup" ? "Create your account" : "Login to your account"}
        </h1>
        <p className="mt-1.5 text-xs leading-relaxed text-[#9ba39d] sm:text-sm">
          {mode === "signup"
            ? "Sign up to unlock ad-free streaming, personalized mixes, and synced lyrics."
            : "Welcome back! Enter your details to start listening."}
        </p>
      </div>

      {/* Liquid Glass Segmented Switcher */}
      <div className="mt-6 grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.12] bg-white/[0.05] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`min-h-[44px] rounded-xl text-xs font-semibold transition sm:text-sm ${
            mode === "signin"
              ? "bg-[#1ed760] text-black shadow-[0_6px_20px_rgba(30,215,96,0.3)]"
              : "text-[#a4aca6] hover:bg-white/[0.05] hover:text-white"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`min-h-[44px] rounded-xl text-xs font-semibold transition sm:text-sm ${
            mode === "signup"
              ? "bg-[#1ed760] text-black shadow-[0_6px_20px_rgba(30,215,96,0.3)]"
              : "text-[#a4aca6] hover:bg-white/[0.05] hover:text-white"
          }`}
        >
          Create Account
        </button>
      </div>

      {/* Play Required Alert Banner */}
      {playRequiredNotice && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#1ed760]/30 bg-[#1ed760]/10 p-3.5 text-xs text-[#a0f0bd] backdrop-blur-md">
          <Headphones className="mt-0.5 h-4 w-4 shrink-0 text-[#1ed760]" />
          <div>
            <p className="font-semibold text-white">Login required to play songs</p>
            <p className="mt-0.5 text-[#9ba39d]">
              Sign in with Google or your email to stream 100M+ ad-free tracks with live synced lyrics.
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs text-amber-200 backdrop-blur-md">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Email / Password Form */}
      <form onSubmit={handleFormLogin} className="mt-5 space-y-4">
        {mode === "signup" && (
          <div>
            <label className="block text-xs font-semibold text-[#c8cec9]" htmlFor="auth-name">
              Your Name
            </label>
            <div className="relative mt-1.5">
              <User
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7c857e]"
              />
              <input
                id="auth-name"
                type="text"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="h-12 w-full rounded-2xl border border-white/[0.14] bg-white/[0.05] pl-11 pr-4 text-sm text-white placeholder:text-[#636c65] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition focus:border-[#1ed760] focus:bg-black/45 focus:outline-none focus:ring-1 focus:ring-[#1ed760]"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#c8cec9]" htmlFor="auth-email">
            Email
          </label>
          <div className="relative mt-1.5">
            <Mail
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7c857e]"
            />
            <input
              id="auth-email"
              type="email"
              value={email}
              maxLength={254}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="h-12 w-full rounded-2xl border border-white/[0.14] bg-white/[0.05] pl-11 pr-4 text-sm text-white placeholder:text-[#636c65] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition focus:border-[#1ed760] focus:bg-black/45 focus:outline-none focus:ring-1 focus:ring-[#1ed760]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#c8cec9]" htmlFor="auth-password">
            Password
          </label>
          <div className="relative mt-1.5">
            <Lock
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7c857e]"
            />
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              value={password}
              maxLength={128}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="h-12 w-full rounded-2xl border border-white/[0.14] bg-white/[0.05] pl-11 pr-12 text-sm text-white placeholder:text-[#636c65] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition focus:border-[#1ed760] focus:bg-black/45 focus:outline-none focus:ring-1 focus:ring-[#1ed760]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1 top-1/2 flex h-11 min-h-[44px] w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[#9ba39d] transition hover:bg-white/[0.08] hover:text-white"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {mode === "signup" && password.length > 0 && (
            <div className="mt-2.5 space-y-1.5" aria-live="polite">
              <div className="grid grid-cols-3 gap-1.5">
                {[1, 2, 3].map((step) => (
                  <span
                    key={step}
                    className={`h-1.5 rounded-full transition-colors ${
                      passwordStrength.level >= step
                        ? passwordStrength.barColor
                        : "bg-white/[0.1]"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#7c857e]">Password strength</span>
                <span className={`font-semibold ${passwordStrength.textColor}`}>
                  {passwordStrength.label}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Remember Login */}
        <div className="flex items-center justify-between text-xs">
          <label className="flex min-h-[44px] cursor-pointer select-none items-center gap-2.5 text-[#9ba39d] hover:text-white">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-white/25 bg-white/10 text-[#1ed760] focus:ring-0 focus:ring-offset-0"
            />
            <span>Remember login</span>
          </label>
          <span className="text-xs text-[#6d766f]">Instant session setup</span>
        </div>

        {/* Primary Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-12 w-full rounded-2xl bg-[#1ed760] text-sm font-bold text-black shadow-[0_12px_32px_rgba(30,215,96,0.28)] transition hover:scale-[1.01] hover:bg-[#1db954] active:scale-[0.99] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]"
        >
          {isSubmitting
            ? "Signing in..."
            : mode === "signup"
              ? "Create Account & Start Listening"
              : "Sign In"}
        </button>
      </form>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/[0.1]" />
        <span className="text-[11px] font-medium text-[#757e77]">Or continue with</span>
        <div className="h-px flex-1 bg-white/[0.1]" />
      </div>

      {/* Google Sign-In Button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="group flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-white/25 bg-white px-5 text-sm font-semibold text-[#1f2024] shadow-md transition hover:scale-[1.01] hover:bg-[#f2f4f2] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]"
      >
        <GoogleMark />
        <span>Continue with Google</span>
      </button>

      {/* Guest / Platform Footer */}
      <div className="mt-5 space-y-2 border-t border-white/[0.08] pt-4 text-center">
        {!isAdminReturn && (
          <Link
            href="/home"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl border border-white/[0.1] bg-white/[0.04] px-4 text-xs font-semibold text-white/85 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
          >
            <span>Continue listening as guest</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#1ed760]" />
          </Link>
        )}
        <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-[#757e77]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#1ed760]" />
          <span>Stream anywhere across Web, Windows, and Android.</span>
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <main className="relative flex min-h-dvh select-none items-center justify-center overflow-hidden bg-[#080909] p-0 text-white sm:p-6 lg:p-10">
      {/* Layered Obsidian, Emerald & Indigo Ambient Glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_75%_55%_at_18%_0%,rgba(30,215,96,0.16),transparent_62%),radial-gradient(ellipse_60%_50%_at_88%_100%,rgba(99,102,241,0.14),transparent_62%),radial-gradient(ellipse_55%_40%_at_50%_50%,rgba(255,255,255,0.025),transparent_70%)]"
      />

      {/* Main Liquid Glass Split Card */}
      <div className="relative flex min-h-dvh w-full max-w-5xl overflow-hidden rounded-none border-0 border-white/[0.12] bg-[#0d110f]/88 backdrop-blur-2xl shadow-[0_32px_90px_rgba(0,0,0,0.75)] sm:min-h-[670px] sm:rounded-[32px] sm:border">
        {/* Top Specular Rim Highlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        />

        {/* Left Side: Interactive Liquid Glass Showcase */}
        <LiquidShowcasePanel />

        {/* Right Side: Auth Form */}
        <Suspense
          fallback={
            <div className="flex w-full flex-col justify-center p-8 text-center text-sm text-[#9ba39d] md:w-1/2">
              Loading sign in...
            </div>
          }
        >
          <AuthForm />
        </Suspense>
      </div>
    </main>
  );
}
