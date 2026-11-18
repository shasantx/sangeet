import Link from "next/link";
import { ArrowRight, Compass, Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="page-container flex min-h-[calc(100dvh-220px)] items-center justify-center">
      <div className="w-full max-w-xl text-center">
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/[.08] bg-white/[.025] text-primary">
            <Compass className="h-6 w-6" />
          </span>
        </div>
        <p className="eyebrow mt-6">404 · Off the map</p>
        <h1 className="mt-3 font-display text-[42px] font-medium leading-none tracking-[-0.05em] sm:text-[56px]">
          This track is missing.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
          The page you were looking for is not part of the Sangeet catalogue. It may have moved, or the
          link may be incomplete.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Home className="h-4 w-4" />
            Back home
          </Link>
          <Link
            href="/search"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/[.1] bg-white/[.025] px-5 text-sm font-medium text-foreground transition hover:border-white/[.18] hover:bg-white/[.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Search className="h-4 w-4" />
            Search Sangeet
          </Link>
        </div>
        <Link
          href="/explore"
          className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          Or explore the catalogue
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
