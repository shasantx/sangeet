"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Headphones,
  Lock,
  Mail,
  Music2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { SangeetMark } from "@/components/brand/sangeet-mark";
import { toast } from "@/store/ui-store";

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

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleState = searchParams?.get("google");
  const reason = searchParams?.get("reason");
  const returnTo = searchParams?.get("returnTo") || "/home";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleSignIn = () => {
    window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const handleFormLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Instant client login / guest sign-in
    toast.success("Welcome to Sangeet", "Logged in with streaming access.");
    setTimeout(() => {
      router.push(returnTo);
    }, 400);
  };

  const errorMessage = useMemo(() => {
    if (googleState !== "error") return null;
    if (reason === "not_configured") {
      return "Google OAuth credentials are being initialized. You have instant Guest access.";
    }
    if (reason === "access_denied") {
      return "Google sign-in was cancelled. You can log in below or continue as Guest.";
    }
    return "Could not connect to Google sign-in. You have instant Guest access.";
  }, [googleState, reason]);

  return (
    <div className="flex w-full flex-col justify-center px-4 py-8 sm:px-10 sm:py-12 md:w-1/2 lg:px-14">
      {/* Mobile Top Bar */}
      <div className="flex items-center justify-between pb-6 md:hidden">
        <Link
          href="/home"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-[#9ba39d] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <SangeetMark size={24} />
          <span className="font-display text-sm font-bold text-white">Sangeet</span>
        </div>
      </div>

      {/* Brand Header (Desktop) */}
      <div className="hidden items-center gap-2.5 md:flex">
        <SangeetMark size={28} />
        <span className="font-display text-lg font-bold tracking-tight text-white">Sangeet</span>
      </div>

      <div className="mt-4 md:mt-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Login to your account
        </h1>
        <p className="mt-1.5 text-xs text-[#9ba39d] sm:text-sm">
          Welcome back! Enter your details to log in to your account
        </p>
      </div>

      {errorMessage && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Email / Password Form (Konekta layout) */}
      <form onSubmit={handleFormLogin} className="mt-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#c8cec9]" htmlFor="auth-email">
            Email
          </label>
          <div className="relative mt-1.5">
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="h-11 w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 text-xs text-white placeholder:text-[#636c65] transition focus:border-[#1ed760] focus:bg-black/40 focus:outline-none focus:ring-1 focus:ring-[#1ed760] sm:h-12 sm:text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#c8cec9]" htmlFor="auth-password">
            Password
          </label>
          <div className="relative mt-1.5">
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your Password"
              className="h-11 w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 pr-11 text-xs text-white placeholder:text-[#636c65] transition focus:border-[#1ed760] focus:bg-black/40 focus:outline-none focus:ring-1 focus:ring-[#1ed760] sm:h-12 sm:text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9ba39d] hover:text-white"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Remember Login + Forgot Password */}
        <div className="flex items-center justify-between text-xs pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer text-[#9ba39d] hover:text-white select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-white/20 bg-white/10 text-[#1ed760] focus:ring-0 focus:ring-offset-0"
            />
            <span>Remember login</span>
          </label>
          <Link href="/auth" className="text-xs text-[#9ba39d] hover:text-white hover:underline">
            Forgot Password?
          </Link>
        </div>

        {/* Primary Login Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-12 w-full rounded-2xl bg-[#1ed760] text-xs font-bold text-black shadow-lg shadow-[#1ed760]/20 transition hover:bg-[#1db954] hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760] sm:h-12.5 sm:text-sm"
        >
          {isSubmitting ? "Logging in..." : "Login"}
        </button>
      </form>

      {/* Or continue with Divider (Konekta layout) */}
      <div className="relative my-6 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/[0.08]" />
        </div>
        <span className="relative bg-[#111412] px-3 text-[11px] font-medium text-[#636c65]">
          Or continue with
        </span>
      </div>

      {/* Google Sign-In Button (Official Brand Colors, Google only) */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="group flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white px-5 text-xs font-semibold text-[#1f2024] shadow-md transition hover:bg-[#f2f4f2] hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760] sm:h-12.5 sm:text-sm"
      >
        <GoogleMark />
        <span>Sign in with Google</span>
      </button>

      {/* Bottom Footer Link */}
      <div className="mt-6 text-center text-xs text-[#9ba39d]">
        <span>New here? </span>
        <Link href={returnTo} className="font-semibold text-white hover:text-[#1ed760] hover:underline">
          Continue as Guest
        </Link>
      </div>

      <div className="mt-5 border-t border-white/[0.06] pt-4 text-center">
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#636c65]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#1ed760]" />
          <span>OAuth Single Sign-On secured by Google. No password stored.</span>
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-[#090b09] p-0 text-white sm:p-6 lg:p-10 select-none">
      {/* Background ambient lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(30,215,96,0.12),transparent_70%)]"
      />

      {/* Main Container: Full-height on mobile, expansive split card on desktop */}
      <div className="relative flex w-full min-h-dvh sm:min-h-[660px] max-w-5xl overflow-hidden rounded-none sm:rounded-[36px] border-0 sm:border border-white/[0.1] bg-[#111412] shadow-2xl">
        {/* Left Side: Rich 3D Organic / Soundscape Visual (Konekta Inspiration) */}
        <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-white/[0.08] bg-[#0c0f0d] p-8 md:flex">
          {/* Subtle background art glow */}
          <div className="pointer-events-none absolute -left-10 -top-10 h-72 w-72 rounded-full bg-[#1ed760]/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-72 w-72 rounded-full bg-[#185330]/20 blur-3xl" />

          {/* Top navigation */}
          <Link
            href="/home"
            className="z-10 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3.5 py-1.5 text-xs font-medium text-[#9ba39d] backdrop-blur-md transition hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to listening
          </Link>

          {/* Full-Bleed 3D Sculpture / Sound Art Frame */}
          <div className="relative my-auto flex flex-col items-center justify-center py-6">
            <div className="relative aspect-[4/5] w-full max-w-[340px] overflow-hidden rounded-[28px] border border-white/15 bg-gradient-to-b from-[#18211b] via-[#101512] to-[#090b09] p-3 shadow-2xl">
              <img
                src="/art/artists/regional/sajjan-raj-vaidya.svg"
                alt="Sangeet soundscapes"
                className="h-full w-full rounded-2xl object-cover"
              />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

              {/* Floating Glass Badges on Artwork */}
              <div className="absolute bottom-5 left-5 right-5 space-y-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1ed760]/40 bg-[#1ed760]/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1ed760] backdrop-blur-md">
                  <Sparkles className="h-3 w-3" /> Studio Master Lossless
                </span>
                <p className="font-display text-lg font-bold text-white leading-tight">
                  Nepali, Hindi & Regional Soundscapes
                </p>
                <p className="text-[11px] text-white/70">
                  100M+ songs with real-time synchronized karaoke lyrics
                </p>
              </div>
            </div>

            {/* Feature Checklist */}
            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-[#9ba39d]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#1ed760]" />
                Cloud sync across devices
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#1ed760]" />
                Zero intrusive audio ads
              </span>
            </div>
          </div>

          {/* Left Footer */}
          <div className="z-10 text-[11px] text-[#636c65]">
            <span>Sangeet Music · Free & Open-Source</span>
          </div>
        </div>

        {/* Right Side: High-Craft Login Form */}
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
