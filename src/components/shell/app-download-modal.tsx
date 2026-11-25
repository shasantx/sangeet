"use client";

import { useEffect, useState } from "react";
import {
  Download,
  FolderSearch,
  Laptop,
  Smartphone,
  Sparkles,
  X,
  Zap
} from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { usePlayerStore } from "@/store/player-store";
import { usePlatform } from "@/lib/platform";
import { formatBytes } from "@/lib/offline-db";
import { cn } from "@/lib/utils";

interface ReleaseMeta {
  available: boolean;
  sizeBytes?: number;
}

const BANNER_DISMISSED_KEY = "sangeet-web-app-popup-dismissed-v3";

/**
 * Web-only native app download popup & modal.
 * Strictly disabled inside Android and Windows native apps so native users
 * never see web install prompts.
 */
export function AppDownloadModal() {
  const { isWeb } = usePlatform();
  const hasTrack = usePlayerStore((s) => Boolean(s.currentTrack));
  const open = useUIStore((s) => s.downloadAppModalOpen);
  const reason = useUIStore((s) => s.downloadAppReason);
  const openModal = useUIStore((s) => s.openDownloadAppModal);
  const closeModal = useUIStore((s) => s.closeDownloadAppModal);

  const [showFloatingPrompt, setShowFloatingPrompt] = useState(false);
  const [apkMeta, setApkMeta] = useState<ReleaseMeta | null>(null);
  const [winMeta, setWinMeta] = useState<ReleaseMeta | null>(null);

  useEffect(() => {
    if (!isWeb) return;
    let cancelled = false;

    fetch("/api/download/android?meta=1")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setApkMeta(d);
      })
      .catch(() => {});

    fetch("/api/download/windows?meta=1")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setWinMeta(d);
      })
      .catch(() => {});

    let dismissed = false;
    try {
      dismissed = localStorage.getItem(BANNER_DISMISSED_KEY) === "1";
    } catch {}

    const timer = dismissed
      ? null
      : window.setTimeout(() => {
          if (!cancelled) setShowFloatingPrompt(true);
        }, 4000);

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [isWeb]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeModal]);

  // Never show download-APK / web prompts inside Android or Windows native apps
  if (!isWeb) return null;

  const dismissPrompt = () => {
    setShowFloatingPrompt(false);
    try {
      localStorage.setItem(BANNER_DISMISSED_KEY, "1");
    } catch {}
  };

  return (
    <>
      {/* Subtle, dismissible Web-only APK & Desktop prompt */}
      {showFloatingPrompt && !open && (
        <div
          role="region"
          aria-label="Download Sangeet native app"
          className={cn(
            "studio-enter fixed right-3 z-40 w-[min(340px,calc(100vw-24px))] rounded-2xl bg-encore-elevated/95 p-4 shadow-[0_24px_70px_rgba(2,6,18,0.55)] backdrop-blur-xl md:bottom-24 md:right-4",
            hasTrack
              ? "bottom-[calc(154px+env(safe-area-inset-bottom))]"
              : "bottom-[calc(86px+env(safe-area-inset-bottom))]"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="btn-cobalt flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm">
                <Smartphone className="h-4 w-4" strokeWidth={2} />
              </span>
              <div>
                <p className="text-xs font-semibold text-encore-text">
                  Get Sangeet Native App
                </p>
                <p className="text-[11px] text-encore-subdued">
                  1-click offline downloads &amp; local music scan
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissPrompt}
              aria-label="Dismiss app download prompt"
              className="flex h-8 w-8 items-center justify-center rounded-full text-encore-muted hover:bg-encore-elevated-highlight hover:text-encore-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <a
              href="/api/download/android"
              download="sangeet-android.apk"
              onClick={dismissPrompt}
              className="btn-cobalt inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold text-white transition active:scale-95"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
              Android APK
            </a>
            <button
              type="button"
              onClick={() => {
                dismissPrompt();
                openModal();
              }}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full bg-encore-base/85 px-3.5 text-xs font-medium text-encore-text shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition hover:bg-encore-elevated-highlight"
            >
              <Laptop className="h-3.5 w-3.5 text-encore-accent" />
              Windows
            </button>
          </div>
        </div>
      )}

      {/* Full Native App Download Modal */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sangeet-app-modal-title"
          onClick={closeModal}
          className="fixed inset-0 z-[96] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="studio-enter w-full max-w-md overflow-hidden rounded-3xl bg-encore-base shadow-[0_24px_70px_rgba(2,6,18,0.55)]"
          >
            <div className="relative bg-gradient-to-br from-encore-tinted via-encore-elevated to-encore-base p-6 pb-5 dark:from-[#142554]/80 dark:via-encore-elevated/95 dark:to-encore-base">
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close download modal"
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-encore-subdued hover:bg-encore-elevated-highlight hover:text-encore-text"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="inline-flex items-center gap-1.5 rounded-full bg-encore-tinted px-3 py-1 text-[11px] font-semibold text-encore-accent">
                <Sparkles className="h-3.5 w-3.5" />
                Native Sangeet Experience
              </div>

              <h2
                id="sangeet-app-modal-title"
                className="mt-3 text-xl font-bold tracking-tight text-encore-text"
              >
                Download Sangeet App
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-encore-subdued">
                {reason ||
                  "The Web Player is built for instant streaming, playlists, and lyrics. Get the Android or Windows app for 1-click offline downloads and local device music scanning."}
              </p>
            </div>

            <div className="space-y-3 p-6 pt-4">
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl bg-encore-elevated/85 p-3">
                  <Zap className="h-4 w-4 text-encore-accent" />
                  <p className="mt-1.5 font-semibold text-encore-text">
                    1-Click Fast Download
                  </p>
                  <p className="mt-0.5 text-[11px] text-encore-subdued">
                    Parallel segmented downloads straight to offline storage
                  </p>
                </div>
                <div className="rounded-xl bg-encore-elevated/85 p-3">
                  <FolderSearch className="h-4 w-4 text-encore-accent" />
                  <p className="mt-1.5 font-semibold text-encore-text">
                    Smart Local Scan
                  </p>
                  <p className="mt-0.5 text-[11px] text-encore-subdued">
                    Auto-imports device music &amp; skips ringtones/recordings
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <a
                  href="/api/download/android"
                  download="sangeet-android.apk"
                  onClick={closeModal}
                  className="btn-cobalt flex min-h-[48px] w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2.5">
                    <Smartphone className="h-5 w-5" strokeWidth={1.8} />
                    <span>Download Android APK</span>
                  </span>
                  <span className="font-mono text-xs opacity-85">
                    {apkMeta?.available && apkMeta.sizeBytes
                      ? formatBytes(apkMeta.sizeBytes)
                      : "APK"}
                  </span>
                </a>

                <a
                  href="/api/download/windows"
                  download="Sangeet.exe"
                  onClick={closeModal}
                  className="flex min-h-[48px] w-full items-center justify-between rounded-2xl bg-encore-elevated/85 px-4 py-3 text-sm font-semibold text-encore-text shadow-[0_8px_24px_rgba(0,0,0,0.2)] transition hover:bg-encore-elevated-highlight active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2.5">
                    <Laptop
                      className="h-5 w-5 text-encore-accent"
                      strokeWidth={1.8}
                    />
                    <span>Download Windows App (Rust)</span>
                  </span>
                  <span className="font-mono text-xs text-encore-muted">
                    {winMeta?.available && winMeta.sizeBytes
                      ? formatBytes(winMeta.sizeBytes)
                      : ".exe"}
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
