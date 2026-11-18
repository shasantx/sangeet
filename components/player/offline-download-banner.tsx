"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, CheckCircle2, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import { useUIStore } from "@/store/ui-store";

export function OfflineDownloadBanner() {
  const offlineDownloads = useUIStore((state) => state.offlineDownloads);
  const dismissOfflineDownload = useUIStore((state) => state.dismissOfflineDownload);
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const reduceMotion = useReducedMotion();

  const items = Object.values(offlineDownloads);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-3 z-[160] flex flex-col gap-2 md:inset-x-auto md:bottom-[104px] md:right-6 md:left-auto md:w-[340px]",
        currentTrackId
          ? "bottom-[calc(146px+env(safe-area-inset-bottom))]"
          : "bottom-[calc(84px+env(safe-area-inset-bottom))]",
      )}
      aria-live="polite"
      aria-label="Offline downloads"
    >
      <AnimatePresence initial={false}>
        {items.map((item) => {
          const isDone = item.status === "done";
          const isError = item.status === "error";
          const pct = Math.max(0, Math.min(100, Math.round(item.progress)));

          return (
            <motion.div
              key={item.trackId}
              layout={!reduceMotion}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              role="status"
              className="pointer-events-auto w-full overflow-hidden rounded-xl border border-white/[.09] bg-[#17171f]/95 p-3 shadow-[0_20px_50px_-18px_rgba(0,0,0,0.85)] backdrop-blur-xl"
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                    isError
                      ? "border-[#F09A9F]/25 bg-[#F09A9F]/10 text-[#F09A9F]"
                      : isDone
                        ? "border-[#7ED0AE]/25 bg-[#7ED0AE]/10 text-[#7ED0AE]"
                        : "border-primary/25 bg-primary/10 text-primary",
                  )}
                >
                  {isError ? (
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Download
                      className={cn("h-3.5 w-3.5", !reduceMotion && "animate-pulse")}
                      aria-hidden="true"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[12.5px] font-semibold leading-tight text-foreground">
                      {item.title}
                    </p>
                    {!isError && (
                      <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
                        {pct}%
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "mt-0.5 truncate text-[11px] leading-tight",
                      isError ? "text-[#F09A9F]" : "text-muted-foreground",
                    )}
                  >
                    {isError
                      ? item.error || "Download failed"
                      : isDone
                        ? "Saved for offline listening"
                        : item.artistName || "Downloading offline copy"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => dismissOfflineDownload(item.trackId)}
                  aria-label={`Dismiss download for ${item.title}`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition hover:bg-white/[.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[.08]">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-300 ease-out",
                    isError ? "bg-[#F09A9F]" : "bg-primary",
                  )}
                  style={{ width: `${isError ? 100 : pct}%` }}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
