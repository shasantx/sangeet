"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Check, Loader2, Music2, Mic2 } from "lucide-react";
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
    <div className="flex h-full min-h-[380px] flex-col rounded-xl border border-white/[0.06] bg-[#0b0d0c] p-4 sm:p-6">
      {/* Header controls */}
      <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2 text-xs">
          <Mic2 className="h-3.5 w-3.5 text-[#1ed760]" />
          <span className="font-semibold text-white">
            {data.hasTimestamps ? "Synchronized Lyrics" : "Plain Lyrics"}
          </span>
          <span className="font-mono text-[11px] text-[#636c65]">· {data.source}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-[#9ba39d] transition hover:bg-white/[0.07] hover:text-white"
          aria-label="Copy lyrics text"
        >
          {copied ? <Check className="h-3 w-3 text-[#1ed760]" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      {/* Synchronized karaoke lines */}
      {data.hasTimestamps && data.syncedLines.length > 0 ? (
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto pr-2 space-y-3.5 scroll-smooth"
        >
          {data.syncedLines.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = idx < activeIndex;
            return (
              <p
                key={`${line.timeMs}-${idx}`}
                ref={isActive ? activeLineRef : null}
                onClick={() => seek(line.timeSec)}
                className={`cursor-pointer transition-all duration-200 select-none ${
                  isActive
                    ? "text-xl sm:text-2xl font-bold text-[#1ed760]"
                    : isPast
                    ? "text-sm sm:text-base font-normal text-[#9ba39d] hover:text-white"
                    : "text-sm sm:text-base font-normal text-[#636c65] hover:text-[#9ba39d]"
                }`}
              >
                {line.text}
              </p>
            );
          })}
        </div>
      ) : (
        /* Plain text lyrics formatted in stanzas */
        <div className="flex-1 overflow-y-auto pr-2 whitespace-pre-line text-sm sm:text-base leading-relaxed text-[#9ba39d]">
          {data.plainLyrics}
        </div>
      )}

      {data.hasTimestamps && (
        <p className="mt-3 border-t border-white/[0.06] pt-2 font-mono text-[10px] text-[#636c65]">
          Click any lyric line to jump directly to that point in the song.
        </p>
      )}
    </div>
  );
}
