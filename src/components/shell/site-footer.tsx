import Link from "next/link";
import { Github } from "lucide-react";
import { SangeetLogo } from "@/components/ui/sangeet-logo";

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <footer className="mt-10 border-t border-encore-hairline px-4 py-6 text-xs text-encore-muted sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-medium text-encore-text">
              <SangeetLogo className="h-4 w-4" />
              Sangeet
            </span>
            <span>•</span>
            <span>
              Crafted by{" "}
              <a
                href="https://github.com/shasantx"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-encore-accent hover:underline"
              >
                Shasant
              </a>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="https://github.com/shasantx/sangeet"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-encore-subdued transition-colors hover:text-encore-accent"
            >
              <Github className="h-3.5 w-3.5" strokeWidth={1.6} />
              <span>shasantx/sangeet</span>
            </a>
            <Link href="/privacy" className="hover:text-encore-text">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-encore-text">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-encore-hairline bg-encore-shell px-6 py-16 text-encore-subdued">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          {/* Brand + Signature */}
          <div className="space-y-3">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <SangeetLogo className="h-8 w-8" />
              <span className="text-lg font-semibold tracking-tight text-encore-text">
                Sangeet
              </span>
            </Link>
            <p className="max-w-xs text-xs leading-relaxed text-encore-muted">
              Free, open-source music discovery and playback studio built for
              web, Android, and Rust Windows desktop.
            </p>
            <p className="pt-1 text-xs text-encore-subdued">
              Signed &amp; maintained by{" "}
              <a
                href="https://github.com/shasantx"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-encore-accent hover:underline"
              >
                Shasant (@shasantx)
              </a>
            </p>
          </div>

          {/* Product */}
          <div className="space-y-2.5 text-xs">
            <p className="font-medium text-encore-muted">Player</p>
            <ul className="space-y-2">
              <li>
                <Link href="/home" className="hover:text-encore-accent">
                  Web Studio
                </Link>
              </li>
              <li>
                <Link href="/explore" className="hover:text-encore-accent">
                  Explore
                </Link>
              </li>
              <li>
                <Link href="/lyrics" className="hover:text-encore-accent">
                  Synced Lyrics
                </Link>
              </li>
              <li>
                <Link href="/offline" className="hover:text-encore-accent">
                  Offline Library
                </Link>
              </li>
            </ul>
          </div>

          {/* Platforms */}
          <div className="space-y-2.5 text-xs">
            <p className="font-medium text-encore-muted">Downloads</p>
            <ul className="space-y-2">
              <li>
                <a
                  href="/api/download/android"
                  className="hover:text-encore-accent"
                >
                  Android APK
                </a>
              </li>
              <li>
                <a
                  href="/api/download/windows"
                  className="hover:text-encore-accent"
                >
                  Windows (Rust)
                </a>
              </li>
              <li>
                <Link href="/more" className="hover:text-encore-accent">
                  All Features
                </Link>
              </li>
              <li>
                <Link href="/auth" className="hover:text-encore-accent">
                  Sign in
                </Link>
              </li>
            </ul>
          </div>

          {/* Open Source */}
          <div className="space-y-2.5 text-xs">
            <p className="font-medium text-encore-muted">Open Source</p>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com/shasantx/sangeet"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-encore-accent"
                >
                  GitHub Repository
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/shasantx/sangeet/releases"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-encore-accent"
                >
                  Releases
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/shasantx/sangeet/blob/main/LICENSE"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-encore-accent"
                >
                  MIT License
                </a>
              </li>
            </ul>
          </div>

          {/* Social icon pill */}
          <div className="flex items-start gap-2.5">
            <a
              href="https://github.com/shasantx/sangeet"
              target="_blank"
              rel="noreferrer"
              aria-label="Sangeet on GitHub"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-encore-hairline bg-encore-elevated text-encore-text transition-colors duration-150 hover:border-encore-accent hover:bg-encore-accent hover:text-encore-on-accent"
            >
              <Github className="h-4 w-4" strokeWidth={1.8} />
            </a>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-encore-hairline pt-6 text-xs text-encore-muted">
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/privacy" className="hover:text-encore-text">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-encore-text">
              Terms
            </Link>
            <a
              href="https://github.com/shasantx/sangeet"
              target="_blank"
              rel="noreferrer"
              className="hover:text-encore-accent"
            >
              github.com/shasantx/sangeet
            </a>
          </div>
          <p className="font-mono text-[11px]">
            © {new Date().getFullYear()} Shasant • MIT License
          </p>
        </div>
      </div>
    </footer>
  );
}
