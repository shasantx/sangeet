"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Flame,
  Keyboard,
  Laptop,
  Maximize2,
  Moon,
  Radio,
  Search,
  Settings,
  Shield,
  Smartphone,
  Sun,
  User
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { useUIStore } from "@/store/ui-store";
import { usePlatform } from "@/lib/platform";
import { SiteFooter } from "@/components/shell/site-footer";
import { formatBytes } from "@/lib/offline-db";

interface ReleaseMeta {
  available: boolean;
  tag?: string;
  sizeBytes?: number;
}

export default function MoreHubPage() {
  const { isWeb } = usePlatform();
  const user = useAuthStore((s) => s.user);
  const likedTracks = useLibraryStore((s) => s.likedTracks);
  const playlists = useLibraryStore((s) => s.playlists);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  const [androidMeta, setAndroidMeta] = useState<ReleaseMeta | null>(null);
  const [windowsMeta, setWindowsMeta] = useState<ReleaseMeta | null>(null);

  useEffect(() => {
    if (!isWeb) return;
    let cancelled = false;
    fetch("/api/download/android?meta=1")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setAndroidMeta(d);
      })
      .catch(() => {});
    fetch("/api/download/windows?meta=1")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setWindowsMeta(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isWeb]);

  const rowBase =
    "flex min-h-[50px] w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-encore-elevated-highlight";

  return (
    <div className="studio-enter mx-auto max-w-2xl overflow-x-hidden space-y-6 p-4 pb-12 sm:p-6">
      {/* Account Header Card */}
      <Link
        href="/auth"
        className="flex min-h-[72px] items-center justify-between gap-4 rounded-2xl border border-encore-hairline bg-encore-elevated p-4 transition-colors duration-150 hover:border-encore-accent/35 hover:bg-encore-elevated-highlight"
      >
        <div className="flex min-w-0 items-center gap-3">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-encore-accent/40"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-encore-tinted text-encore-accent">
              <User className="h-5 w-5" strokeWidth={1.5} />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-base font-medium text-encore-text">
              {user?.name || "Guest Listener"}
            </h1>
            <p className="truncate text-xs text-encore-subdued">
              {user?.email ||
                `${likedTracks.length} liked • ${playlists.length} playlists • Sign in`}
            </p>
          </div>
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-encore-muted"
          strokeWidth={1.5}
        />
      </Link>

      {/* Group 1: Curated Discovery (Explore lives in the top bar) */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-medium text-encore-muted">Curated</h2>
        <div className="divide-y divide-encore-hairline overflow-hidden rounded-2xl border border-encore-hairline bg-encore-elevated">
          <Link href="/made-for-you" className={rowBase}>
            <span className="flex items-center gap-3">
              <Radio className="h-4 w-4 text-encore-accent" strokeWidth={1.6} />
              <span className="text-sm text-encore-text">Made for you</span>
            </span>
            <ChevronRight className="h-4 w-4 text-encore-muted" strokeWidth={1.5} />
          </Link>

          <Link href="/new-releases" className={rowBase}>
            <span className="flex items-center gap-3">
              <Flame className="h-4 w-4 text-encore-accent" strokeWidth={1.6} />
              <span className="text-sm text-encore-text">New releases</span>
            </span>
            <ChevronRight className="h-4 w-4 text-encore-muted" strokeWidth={1.5} />
          </Link>
        </div>
      </section>

      {/* Group 2: Native Apps (Web only — hidden inside Android/Windows native apps) */}
      {isWeb && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-medium text-encore-muted">
            Native apps
          </h2>
          <div className="divide-y divide-encore-hairline overflow-hidden rounded-2xl border border-encore-hairline bg-encore-elevated">
            <a
              href="/api/download/android"
              download="sangeet-android.apk"
              className={rowBase}
            >
              <span className="flex items-center gap-3">
                <Smartphone
                  className="h-4 w-4 text-encore-accent"
                  strokeWidth={1.6}
                />
                <span className="text-sm text-encore-text">
                  Download Android APK
                </span>
              </span>
              <span className="flex items-center gap-2 text-xs text-encore-muted">
                <span className="font-mono tabular-nums">
                  {androidMeta?.available && androidMeta.sizeBytes
                    ? formatBytes(androidMeta.sizeBytes)
                    : "APK"}
                </span>
                <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
              </span>
            </a>

            <a
              href="/api/download/windows"
              download="Sangeet.exe"
              className={rowBase}
            >
              <span className="flex items-center gap-3">
                <Laptop
                  className="h-4 w-4 text-encore-accent"
                  strokeWidth={1.6}
                />
                <span className="text-sm text-encore-text">
                  Download Windows app (Rust)
                </span>
              </span>
              <span className="flex items-center gap-2 text-xs text-encore-muted">
                <span className="font-mono tabular-nums">
                  {windowsMeta?.available && windowsMeta.sizeBytes
                    ? formatBytes(windowsMeta.sizeBytes)
                    : ".exe"}
                </span>
                <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
              </span>
            </a>
          </div>
        </section>
      )}

      {/* Group 3: App & Tools (Playback toggles live in Settings; Stats in Profile) */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-medium text-encore-muted">
          App &amp; tools
        </h2>
        <div className="divide-y divide-encore-hairline overflow-hidden rounded-2xl border border-encore-hairline bg-encore-elevated">
          <Link href="/settings" className={rowBase}>
            <span className="flex items-center gap-3">
              <Settings
                className="h-4 w-4 text-encore-accent"
                strokeWidth={1.6}
              />
              <span className="text-sm text-encore-text">
                Settings, Equalizer &amp; playback
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-encore-muted" strokeWidth={1.5} />
          </Link>

          <button type="button" onClick={toggleTheme} className={rowBase}>
            <span className="flex items-center gap-3">
              {theme === "dark" ? (
                <Moon className="h-4 w-4 text-encore-accent" strokeWidth={1.6} />
              ) : (
                <Sun className="h-4 w-4 text-encore-accent" strokeWidth={1.6} />
              )}
              <span className="text-sm text-encore-text">Theme</span>
            </span>
            <span className="rounded-full bg-encore-tinted px-2.5 py-1 text-xs font-semibold capitalize text-encore-accent">
              {theme}
            </span>
          </button>

          {currentTrack && (
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new Event("sangeet:open-fullscreen"))
              }
              className={rowBase}
            >
              <span className="flex items-center gap-3">
                <Maximize2
                  className="h-4 w-4 text-encore-subdued"
                  strokeWidth={1.6}
                />
                <span className="text-sm text-encore-text">
                  Fullscreen cinema mode
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-encore-muted" strokeWidth={1.5} />
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new Event("sangeet:open-command"))
            }
            className={rowBase}
          >
            <span className="flex items-center gap-3">
              <Search className="h-4 w-4 text-encore-subdued" strokeWidth={1.6} />
              <span className="text-sm text-encore-text">Command palette</span>
            </span>
            <span className="flex items-center gap-2 text-xs text-encore-muted">
              <kbd className="rounded border border-encore-hairline bg-encore-base px-1.5 py-0.5 font-mono text-[11px]">
                Ctrl K
              </kbd>
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new Event("sangeet:open-shortcuts"))
            }
            className={rowBase}
          >
            <span className="flex items-center gap-3">
              <Keyboard
                className="h-4 w-4 text-encore-subdued"
                strokeWidth={1.6}
              />
              <span className="text-sm text-encore-text">
                Keyboard shortcuts
              </span>
            </span>
            <span className="flex items-center gap-2 text-xs text-encore-muted">
              <kbd className="rounded border border-encore-hairline bg-encore-base px-1.5 py-0.5 font-mono text-[11px]">
                ?
              </kbd>
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            </span>
          </button>

          <Link href="/privacy" className={rowBase}>
            <span className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-encore-subdued" strokeWidth={1.6} />
              <span className="text-sm text-encore-text">
                Privacy &amp; terms
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-encore-muted" strokeWidth={1.5} />
          </Link>
        </div>
      </section>

      <SiteFooter compact />
    </div>
  );
}
