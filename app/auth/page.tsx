"use client";

import Link from "next/link";
import { useState } from "react";
import { SangeetMark } from "@/components/brand/sangeet-mark";
import { ArrowLeft, Check, Lock, Mail } from "lucide-react";
import { toast } from "@/store/ui-store";

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

function AppleMark() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 fill-current" viewBox="0 0 24 24">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.77 1.06-1.85.94-2.93-1 .04-2.22.67-2.92 1.49-.6.69-1.12 1.8-1 2.86 1.12.09 2.26-.57 2.98-1.42z" />
    </svg>
  );
}

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  const handleGoogleSignIn = () => {
    const requestedReturn = new URLSearchParams(window.location.search).get("returnTo");
    const returnTo = requestedReturn || "/home";
    window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const handleAppleNotice = () => {
    toast.show("Apple Sign-In", "Google Sign-In is active for your Sangeet account sync.", "info");
  };

  const handleEmailNotice = (e: React.FormEvent) => {
    e.preventDefault();
    handleGoogleSignIn();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f5f4] p-4 sm:p-8">
      {/* Split Modal Card (Inspired directly by Image 1 Konekta) */}
      <div className="flex w-full max-w-4xl overflow-hidden rounded-[32px] bg-white shadow-2xl border border-black/[0.06]">
        {/* Left Side: High-Aesthetic Artwork Composition (Image 1 style) */}
        <div className="relative hidden w-1/2 overflow-hidden bg-[#e8ebe8] p-8 md:flex md:flex-col md:justify-between">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[#3d423d] backdrop-blur-md transition hover:bg-white"
          >
            <ArrowLeft className="h-3 w-3" /> Back to listening
          </Link>

          {/* Center Art Piece (high-craft visual sculpture) */}
          <div className="relative my-auto flex flex-col items-center justify-center py-8">
            <div className="relative aspect-[3/4] w-full max-w-[280px] overflow-hidden rounded-[26px] bg-[#d9ded9] shadow-xl">
              <img
                src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80"
                alt="Aesthetic musical composition"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#1ed760]">Studio Master</p>
                <p className="font-display text-sm font-bold">Nepali & Hindi Soundscapes</p>
                <p className="text-[10px] text-white/70">Synced playlists across all devices</p>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-[#717871]">
            <span>Sangeet Listening Network · Open Source</span>
          </div>
        </div>

        {/* Right Side: Clean Form (Exact match to Image 1 Konekta layout) */}
        <div className="flex w-full flex-col justify-center px-8 py-12 sm:px-12 md:w-1/2">
          {/* Top Brand Logo */}
          <div className="mb-6 flex items-center gap-2.5">
            <SangeetMark size={28} />
            <span className="font-display text-lg font-bold tracking-tight text-[#111311]">Sangeet</span>
          </div>

          {/* Header */}
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#111311]">
            Login to your account
          </h1>
          <p className="mt-1 text-xs text-[#717871]">
            Welcome back! Enter your details to log in to your account
          </p>

          {/* Form Inputs (Image 1 style) */}
          <form onSubmit={handleEmailNotice} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#3d423d]">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="mt-1.5 h-11 w-full rounded-xl border border-black/15 bg-white px-3.5 text-xs text-[#111311] placeholder:text-[#a0a6a0] transition focus:border-[#58339c] focus:outline-none focus:ring-1 focus:ring-[#58339c]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3d423d]">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your Password"
                className="mt-1.5 h-11 w-full rounded-xl border border-black/15 bg-white px-3.5 text-xs text-[#111311] placeholder:text-[#a0a6a0] transition focus:border-[#58339c] focus:outline-none focus:ring-1 focus:ring-[#58339c]"
              />
            </div>

            {/* Remember Login + Forgot Password */}
            <div className="flex items-center justify-between pt-1 text-xs text-[#525752]">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-black/20 text-[#58339c] focus:ring-0"
                />
                <span>Remember login</span>
              </label>

              <button
                type="button"
                onClick={() => toast.show("Password Help", "Google handles single sign-on security. Use Google Sign-In below.", "info")}
                className="text-[#58339c] font-medium hover:underline text-xs"
              >
                Forgot Password?
              </button>
            </div>

            {/* Login Primary Button (Image 1 purple/indigo button) */}
            <button
              type="submit"
              className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#58339c] text-xs font-semibold text-white shadow-md shadow-[#58339c]/20 transition hover:bg-[#4a2b85]"
            >
              Login
            </button>
          </form>

          {/* "Or continue with" Divider (Image 1) */}
          <div className="relative my-6 text-center text-xs text-[#8e948e]">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-black/10" />
            </div>
            <span className="relative bg-white px-3 text-[11px] text-[#8e948e]">Or continue with</span>
          </div>

          {/* Social Auth Buttons (Image 1 style) */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleAppleNotice}
              className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-black/10 bg-[#f4f5f4] text-xs font-semibold text-[#111311] transition hover:bg-[#eaecea]"
            >
              <AppleMark /> Sign in with Apple
            </button>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-black/10 bg-[#f4f5f4] text-xs font-semibold text-[#111311] transition hover:bg-[#eaecea]"
            >
              <GoogleMark /> Sign in with Google
            </button>
          </div>

          {/* Bottom Footnote */}
          <div className="mt-6 text-center text-xs text-[#717871]">
            <span>New here? </span>
            <Link href="/home" className="font-semibold text-[#58339c] hover:underline">
              Continue as guest
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
