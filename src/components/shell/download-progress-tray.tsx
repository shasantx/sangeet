"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  X
} from "lucide-react";
import { useOfflineStore } from "@/store/offline-store";
import { usePlayerStore } from "@/store/player-store";
import { TrackArtwork } from "@/components/music/track-artwork";
import { formatBytes } from "@/lib/offline-db";
import { cn } from "@/lib/utils";

/**
 * Floating Zentra-styled global download progress tray.
 * Automatically appears whenever tracks are downloading, completed, or need retry.
 */
export function DownloadProgressTray() {
  const downloads = useOfflineStore((s) => s.downloads);
  const cancelDownload = useOfflineStore((s) => s.cancelDownload);
  const retryDownload = useOfflineStore((s) => s.retryDownload);
  const hasTrack = usePlayerStore((s) => Boolean(s.currentTrack));
  const [collapsed, setCollapsed] = useState(false);

  const entries = Object.values(downloads);
  if (entries.length === 0) return null;

  const activeCount = entries.filter((e) => e.status === "downloading").length;
  const completedCount = entries.filter((e) => e.status === "completed").length;
  const avgProgress =
    activeCount > 0
      ? Math.round(
          entries
            .filter((e) => e.status === "downloading")
            .reduce((sum, e) => sum + e.progress, 0) / activeCount
        )
      : 100;

  return (
    <aside
      aria-label="Active downloads"
      className={cn(
        "studio-enter fixed right-3 z-40 w-[min(350px,calc(100vw-24px))] overflow-hidden rounded-2xl bg-encore-elevated shadow-[var(--shadow-elevated)] md:bottom-24 md:right-4",
        hasTrack
          ? "bottom-[calc(158px+env(safe-area-inset-bottom))]"
          : "bottom-[calc(88px+env(safe-area-inset-bottom))]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="btn-cobalt flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
            {activeCount > 0 ? (
              <Download className="h-3.5 w-3.5 animate-bounce" strokeWidth={2.2} />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.2} />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-encore-text">
              {activeCount > 0
                ? `Downloading ${activeCount} track${activeCount === 1 ? "" : "s"}`
                : completedCount > 0
                  ? "Saved for offline playback"
                  : "Download needs attention"}
            </p>
            <p className="font-mono text-[10px] tabular-nums text-encore-accent">
              {activeCount > 0 ? `${avgProgress}% overall` : "Ready in Offline"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/offline"
            className="rounded-full bg-encore-base/75 px-2.5 py-1 text-[11px] font-semibold text-encore-subdued transition hover:text-encore-text"
          >
            View
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand downloads" : "Collapse downloads"}
            className="flex h-7 w-7 items-center justify-center rounded-full text-encore-subdued hover:bg-encore-base/75 hover:text-encore-text"
          >
            {collapsed ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Aggregate progress hairline when collapsed */}
      {collapsed && activeCount > 0 && (
        <div className="h-1 w-full bg-encore-rail/60">
          <div
            className="h-full bg-encore-accent transition-[width] duration-200"
            style={{ width: `${Math.max(6, avgProgress)}%` }}
          />
        </div>
      )}

      {/* Individual Track Progress Rows */}
      {!collapsed && (
        <div className="max-h-56 space-y-1.5 overflow-y-auto px-3 pb-3">
          {entries.map((dl) => {
            const isDone = dl.status === "completed";
            const isErr = dl.status === "error";
            return (
              <div
                key={dl.track.id}
                className="rounded-xl bg-encore-base p-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <TrackArtwork
                    src={dl.track.thumbnail}
                    trackId={dl.track.id}
                    alt={dl.track.title}
                    className="h-9 w-9 shrink-0 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-encore-text">
                      {dl.track.title}
                    </p>
                    <p className="truncate text-[11px] text-encore-subdued">
                      {isErr ? (
                        <span className="inline-flex items-center gap-1 text-encore-negative">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          {dl.error || "Download failed"}
                        </span>
                      ) : isDone ? (
                        <span className="text-encore-accent">
                          Saved offline
                          {dl.totalBytes ? ` • ${formatBytes(dl.totalBytes)}` : ""}
                        </span>
                      ) : dl.receivedBytes && dl.totalBytes ? (
                        <span className="font-mono tabular-nums">
                          {formatBytes(dl.receivedBytes)} /{" "}
                          {formatBytes(dl.totalBytes)}
                        </span>
                      ) : (
                        dl.track.artist
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {!isErr && !isDone && (
                      <span className="font-mono text-[11px] font-semibold tabular-nums text-encore-accent">
                        {dl.progress}%
                      </span>
                    )}
                    {isDone && (
                      <CheckCircle2 className="h-4 w-4 text-encore-accent" />
                    )}
                    {isErr && (
                      <button
                        type="button"
                        onClick={() => void retryDownload(dl.track.id)}
                        aria-label={`Retry ${dl.track.title}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-encore-tinted text-encore-accent hover:bg-encore-tinted-highlight"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => cancelDownload(dl.track.id)}
                      aria-label={`Dismiss ${dl.track.title}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-encore-muted hover:bg-encore-elevated hover:text-encore-text"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Enhanced Cobalt Progress Bar */}
                {!isErr && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-encore-rail/70">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-200 ease-out",
                        isDone
                          ? "bg-encore-accent"
                          : "bg-encore-accent"
                      )}
                      style={{
                        width: `${isDone ? 100 : Math.max(5, dl.progress)}%`
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
