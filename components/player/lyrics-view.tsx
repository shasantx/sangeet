"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Check, Loader2, Music2, Sparkles } from "lucide-react";
import { usePlayerStore } from "@/store/player-store";
import { toast } from "@/store/ui-store";

interface SyncedLine {
  timeMs: number;
  timeSec: number;
  text: string;
}

interface LyricsData {
  ok: boolean;
  hasTimestamps: boolean;
  syncedLines: SyncedLine[];
  plainLyrics: string;
  source: string;
}

interface LyricsViewProps {
  trackTitle?: string;
  artistName?: string;
  videoId?: string;
  duration?: number;
}

export function LyricsView({ trackTitle, artistName, videoId, duration }: LyricsViewProps) {
  const [data, setData] = useState<LyricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const seek = usePlayerStore((state) => state.seek);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!trackTitle) {
      setData(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    const query = new URLSearchParams({
      title: trackTitle,
      artist: artistName || "",
      videoId: videoId || "",
      duration: duration ? String(Math.round(duration)) : "",
    });

    fetch(`/api/lyrics?${query.toString()}`)
      .then((res) => res.json())
      .then((res: LyricsData) => {
        if (!active) return;
        setData(res);
      })
      .catch(() => {
        if (!active) return;
        setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [trackTitle, artistName, videoId, duration]);

  // Find active line index based on current playback time
  const activeIndex = data?.hasTimestamps && data.syncedLines.length
    ? data.syncedLines.reduce((acc, line, idx) => {
        if (currentTime >= line.timeSec) {
          return idx;
        }
        return acc;
      }, -1)
    : -1;

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLineRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const element = activeLineRef.current;
      const offset = element.offsetTop - container.offsetTop - container.clientHeight / 2 + element.clientHeight / 2;
      container.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
    }
  }, [activeIndex]);

  const handleCopy = async () => {
    if (!data) return;
    const text = data.plainLyrics || data.syncedLines.map((l) => l.text).join("\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Lyrics copied", "Copied song lyrics to your clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy", "Clipboard access was denied.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm font-medium text-foreground">Searching verified lyrics…</p>
        <p className="mt-1 text-xs text-muted-foreground">Looking up {trackTitle}</p>
      </div>
    );
  }

  if (!data || (!data.syncedLines.length && !data.plainLyrics)) {
    return (
      <div className="rounded-2xl border border-white/[.07] bg-white/[.015] px-6 py-16 text-center sm:py-20">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/[.04] text-muted-foreground/60">
          <Music2 className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-foreground">Lyrics aren’t available for this track yet</h3>
        <p className="mt-1.5 max-w-md mx-auto text-sm text-muted-foreground">
          We couldn’t find verified synchronized lyrics for &ldquo;{trackTitle || "this song"}&rdquo;. Enjoy the music or check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl border border-white/[.07] bg-white/[.018] p-5 sm:p-8">
      {/* Header controls */}
      <div className="mb-6 flex items-center justify-between border-b border-white/[.06] pb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            {data.hasTimestamps ? "Synchronized Lyrics" : "Song Lyrics"}
          </span>
          <span className="text-[11px] text-muted-foreground/60">· {data.source}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/[.08] bg-white/[.03] px-3 py-1.5 text-xs text-muted-foreground transition hover:border-white/[.15] hover:bg-white/[.06] hover:text-foreground"
          aria-label="Copy lyrics text"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy lyrics"}
        </button>
      </div>

      {/* Synchronized karaoke lines */}
      {data.hasTimestamps && data.syncedLines.length > 0 ? (
        <div
          ref={scrollContainerRef}
          className="max-h-[520px] overflow-y-auto pr-3 space-y-4 scroll-smooth scrollbar-thin scrollbar-thumb-white/10"
        >
          {data.syncedLines.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = idx < activeIndex;
            return (
              <p
                key={`${line.timeMs}-${idx}`}
                ref={isActive ? activeLineRef : null}
                onClick={() => seek(line.timeSec)}
                className={`cursor-pointer transition-all duration-300 select-none ${
                  isActive
                    ? "text-2xl sm:text-3xl font-bold text-white scale-[1.02] origin-left drop-shadow-[0_2px_12px_rgba(30,215,96,.3)]"
                    : isPast
                    ? "text-lg sm:text-xl font-medium text-white/45 hover:text-white/80"
                    : "text-lg sm:text-xl font-medium text-white/30 hover:text-white/70"
                }`}
              >
                {line.text}
              </p>
            );
          })}
        </div>
      ) : (
        /* Plain text lyrics formatted in stanzas */
        <div className="max-h-[520px] overflow-y-auto pr-3 whitespace-pre-line text-base sm:text-lg leading-relaxed text-white/85">
          {data.plainLyrics}
        </div>
      )}

      {data.hasTimestamps && (
        <p className="mt-6 border-t border-white/[.06] pt-3 text-[11px] text-muted-foreground/60">
          Tip: Tap any lyric line to jump directly to that part of the song.
        </p>
      )}
    </div>
  );
}
