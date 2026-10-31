"use client";

import Link from "next/link";
import { ArrowLeft, Music } from "lucide-react";

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09a7 7 0 0 1 0-4.18V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.85z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export default function AuthPage() {
  const handleGoogleSignIn = () => {
    const requestedReturn = new URLSearchParams(window.location.search).get("returnTo");
    const returnTo = requestedReturn || `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0c0b] px-4 py-12 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute -top-64 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-primary/[.09] blur-[120px]" />
      <section className="relative w-full max-w-[420px] rounded-3xl border border-white/[.08] bg-[#141511] p-8 shadow-2xl sm:p-10">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 text-xs text-white/55 transition hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to listening
        </Link>
        <div className="mb-7 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-black"><Music className="h-5 w-5" /></span>
          <span className="font-display text-xl font-semibold tracking-tight">Sangeet</span>
        </div>
        <p className="eyebrow mb-2">Listener account</p>
        <h1 className="text-3xl font-semibold tracking-[-.04em]">Sign in to your music.</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/55">Connect your Google account to access your Sangeet profile on this device.</p>
        <button type="button" onClick={handleGoogleSignIn} className="mt-8 inline-flex h-12 w-full items-center justify-center gap-3 rounded-full bg-white text-sm font-semibold text-[#202124] transition hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#141511]">
          <GoogleMark /> Continue with Google
        </button>
        <p className="mt-5 text-center text-xs leading-relaxed text-white/40">No Sangeet password to remember. Google handles account verification and password recovery.</p>
        <div className="mt-8 border-t border-white/[.08] pt-6 text-center">
          <Link href="/" className="text-sm font-medium text-primary transition hover:text-secondary">Continue listening without an account</Link>
        </div>
      </section>
    </main>
  );
}
