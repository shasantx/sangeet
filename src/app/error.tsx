"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Sangeet Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center bg-encore-base p-8 text-center">
      <h2 className="text-2xl font-black text-encore-text">Something went wrong</h2>
      <p className="mt-2 max-w-md text-sm text-encore-subdued">
        An unexpected error occurred while rendering this view. Try reloading
        the section or returning home.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="btn-cobalt inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-xs font-semibold transition active:scale-[0.98]"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
        <Link
          href="/home"
          className="inline-flex min-h-[44px] items-center rounded-full border border-encore-hairline bg-encore-elevated px-5 text-xs font-semibold text-encore-text transition hover:border-encore-accent/50 hover:bg-encore-elevated-highlight"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
