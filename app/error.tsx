"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-container flex min-h-[calc(100dvh-220px)] items-center justify-center">
      <div className="w-full max-w-xl text-center">
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#c44d58]/10 blur-2xl" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[#c44d58]/20 bg-[#c44d58]/[.07] text-[#e7a3a9]">
            <AlertTriangle className="h-6 w-6" />
          </span>
        </div>
        <p className="eyebrow mt-6">Something skipped</p>
        <h1 className="mt-3 font-display text-[42px] font-medium leading-none tracking-[-0.05em] sm:text-[56px]">
          The needle jumped.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
          Sangeet hit an unexpected error while loading this page. Your library and player state are
          still safe in this browser.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/[.1] bg-white/[.025] px-5 text-sm font-medium text-foreground transition hover:border-white/[.18] hover:bg-white/[.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Home className="h-4 w-4" />
            Back home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 text-[10px] uppercase tracking-[0.13em] text-muted-foreground/45">
            Error reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
