"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Headphones,
  Music2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { SangeetMark } from "@/components/brand/sangeet-mark";

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
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

function AuthForm() {
  const searchParams = useSearchParams();
  const googleState = searchParams?.get("google");
  const reason = searchParams?.get("reason");
  const returnTo = searchParams?.get("returnTo") || "/home";

  const handleGoogleSignIn = () => {
    window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const errorMessage = useMemo(() => {
    if (googleState !== "error") return null;
    if (reason === "not_configured") {
      return "Google OAuth credentials are being initialized on the server. You can still continue as Guest with full streaming access.";
    }
    if (reason === "access_denied") {
      return "Google sign-in was cancelled. Please try again or continue as Guest.";
    }
    return "Could not connect to Google sign-in. You can still enjoy full music streaming as a Guest.";
  }, [googleState, reason]);

  return (
    <div className="flex w-full flex-col justify-center p-8 sm:p-12 md:w-1/2">
      {/* Mobile Back button */}
      <Link
        href="/home"
        className="mb-6 inline-flex w-fit items-center gap-2 text-xs text-[#9ba39d] hover:text-white md:hidden"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to listening
      </Link>

      {/* Logo & Header */}
      <div className="flex items-center gap-3">
        <SangeetMark size={32} />
        <span className="font-display text-xl font-bold tracking-tight text-white">Sangeet</span>
      </div>

      <h1 className="mt-6 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
        Sign in to your music
      </h1>
      <p className="mt-2 text-xs leading-relaxed text-[#9ba39d] sm:text-sm">
        Connect your Google account to sync your playlists, favorites, and listening history across Web, Windows, and Android.
      </p>

      {errorMessage && (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
          <p className="leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* Single Google Sign-In Action (Google only, no Apples, no Facebooks) */}
      <div className="mt-8 space-y-3">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="group flex h-13 w-full items-center justify-center gap-3.5 rounded-full bg-white px-6 text-sm font-semibold text-[#1f2024] shadow-lg transition hover:bg-[#eef0ee] hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111412]"
        >
          <GoogleMark />
          <span>Continue with Google</span>
        </button>

        <Link
          href={returnTo}
          className="flex h-11 w-full items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03] text-xs font-medium text-[#9ba39d] transition hover:bg-white/[0.07] hover:text-white"
        >
          Continue as Guest (Full streaming access)
        </Link>
      </div>

      {/* Security & Verification Footnote */}
      <div className="mt-8 border-t border-white/[0.06] pt-6">
        <div className="flex items-start gap-2.5 text-xs text-[#636c65]">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#1ed760] mt-0.5" />
          <p className="leading-relaxed">
            Single sign-on is secured by Google OAuth. Sangeet never asks for or stores passwords.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090b09] p-4 text-white sm:p-8">
      {/* Subtle background ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(30,215,96,0.1),transparent_70%)]"
      />

      {/* Main Split Authentication Card */}
      <div className="relative flex w-full max-w-4xl overflow-hidden rounded-3xl border border-white/[0.09] bg-[#111412] shadow-2xl">
        {/* Left Side: Editorial Music Showcase (Hidden on small mobile) */}
        <div className="relative hidden w-1/2 flex-col justify-between border-r border-white/[0.08] bg-[#0d100e] p-8 md:flex">
          <Link
            href="/home"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-[#9ba39d] transition hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to listening
          </Link>

          {/* Visual Showcase Card */}
          <div className="my-auto py-8 text-center">
            <div className="relative mx-auto aspect-square w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#161a17] shadow-2xl">
              <img
                src="/art/albums/afterglow.svg"
                alt="Sangeet soundscapes"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-left">
                <span className="rounded-full bg-[#1ed760]/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1ed760]">
                  Studio Master
                </span>
                <p className="mt-1 font-display text-base font-bold text-white">
                  Nepali & Hindi Soundscapes
                </p>
                <p className="text-[11px] text-white/60">100M+ songs with synced karaoke lyrics</p>
              </div>
            </div>

            <div className="mt-6 space-y-2 text-left">
              <div className="flex items-center gap-2.5 text-xs text-[#9ba39d]">
                <CheckCircle2 className="h-4 w-4 text-[#1ed760] shrink-0" />
                <span>Cloud sync for playlists & liked songs</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-[#9ba39d]">
                <CheckCircle2 className="h-4 w-4 text-[#1ed760] shrink-0" />
                <span>Synchronized word-for-word lyrics with seek</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-[#9ba39d]">
                <CheckCircle2 className="h-4 w-4 text-[#1ed760] shrink-0" />
                <span>Connected playback on Windows .exe & Android</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-[#636c65]">
            <span>Sangeet Music · Free & Open Source</span>
          </div>
        </div>

        {/* Right Side: Google Login Form inside Suspense */}
        <Suspense
          fallback={
            <div className="flex w-full flex-col justify-center p-8 sm:p-12 md:w-1/2 text-center text-sm text-[#9ba39d]">
              Loading sign-in...
            </div>
          }
        >
          <AuthForm />
        </Suspense>
      </div>
    </main>
  );
}
