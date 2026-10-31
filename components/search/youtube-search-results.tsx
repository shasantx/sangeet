"use client";

import { useEffect, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import {
  registerYouTubeSearchResults,
  type YouTubeSearchResult,
} from "@/lib/dynamic-tracks";
import { cn, formatDuration } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import { Artwork } from "@/components/music/artwork";

export interface YouTubeSearchStatus {
  count: number;
  loading: boolean;
  unavailable: boolean;
}

interface YouTubeSearchResultsProps {
  query: string;
  onStatusChange?: (status: YouTubeSearchStatus) => void;
  className?: string;
}

const resultCache = new Map<string, YouTubeSearchResult[]>();

export function YouTubeSearchResults({
  query,
  onStatusChange,
  className,
}: YouTubeSearchResultsProps) {
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [failureMessage, setFailureMessage] = useState("Search is unavailable right now. Please try again shortly.");
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setUnavailable(false);
      setFailureMessage("Search is unavailable right now. Please try again shortly.");
      onStatusChange?.({ count: 0, loading: false, unavailable: false });
      return;
    }

    const key = trimmed.toLowerCase();
    const cached = resultCache.get(key);
    if (cached) {
      setResults(cached);
      setLoading(false);
      setUnavailable(false);
      setFailureMessage("Search is unavailable right now. Please try again shortly.");
      onStatusChange?.({ count: cached.length, loading: false, unavailable: false });
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setUnavailable(false);
    setFailureMessage("Search is unavailable right now. Please try again shortly.");
    onStatusChange?.({ count: 0, loading: true, unavailable: false });

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          if (response.status === 429) throw new Error("Search limit reached. Wait a minute before trying again.");
          throw new Error("Search could not connect. Check your connection and try again.");
        }
        const payload = (await response.json()) as {
          results?: YouTubeSearchResult[];
          unavailable?: boolean;
        };
        if (!active) return;
        const next = payload.results ?? [];
        if (!payload.unavailable) resultCache.set(key, next);
        setResults(next);
        setUnavailable(Boolean(payload.unavailable));
        if (payload.unavailable) setFailureMessage("Search is unavailable right now. Please try again shortly.");
        onStatusChange?.({
          count: next.length,
          loading: false,
          unavailable: Boolean(payload.unavailable),
        });
      } catch (error) {
        if (!active) return;
        setResults([]);
        const message = error instanceof Error ? error.message : "Search is unavailable right now. Please try again shortly.";
        setFailureMessage(message);
        setUnavailable(true);
        onStatusChange?.({ count: 0, loading: false, unavailable: true });
      } finally {
        if (active) setLoading(false);
      }
    }, 320);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed, onStatusChange]);

  const play = (videoId: string) => {
    const tracks = registerYouTubeSearchResults(results);
    const target = tracks.find((track) => track.youtubeId === videoId);
    if (!target) return;
    playTrack(
      target.id,
      tracks.map((track) => track.id),
      `Search · ${trimmed}`,
    );
  };

  if (trimmed.length < 2) return null;
  if (!loading && !unavailable && results.length === 0) return null;

  return (
    <section className={cn("mt-10", className)} aria-label="Search results">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight">More results</h2>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <span className="text-[10px] text-muted-foreground">{results.length}</span>
          )}
        </div>
        {!loading && results.length > 0 && (
          <button
            type="button"
            onClick={() => play(results[0].videoId)}
            className="rounded-full border border-white/[.08] bg-white/[.025] px-3.5 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-white/[.16] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Play all
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-1 rounded-xl border border-white/[.045] bg-white/[.012] px-2 py-2">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex animate-pulse items-center gap-3 px-2 py-2">
              <div className="h-11 w-11 shrink-0 rounded-md bg-white/[.05]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-2.5 w-1/3 rounded bg-white/[.06]" />
                <div className="h-2 w-1/5 rounded bg-white/[.04]" />
              </div>
            </div>
          ))}
        </div>
      ) : unavailable && results.length === 0 ? (
        <p className="rounded-xl border border-white/[.055] bg-white/[.015] px-4 py-3 text-[11px] text-muted-foreground">
          {failureMessage}
        </p>
      ) : (
        <div className="rounded-xl border border-white/[.045] bg-white/[.012] px-2 py-2">
          {unavailable && results.length > 0 && <p className="px-2 pb-2 text-[10px] text-muted-foreground">Live search is unavailable; showing matching Sangeet catalog results.</p>}
          {results.map((result) => {
            const active = currentTrackId === `yt-${result.videoId}`;
            return (
              <div
                key={result.videoId}
                className="group flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[.035]"
              >
                <button
                  type="button"
                  onClick={() => play(result.videoId)}
                  className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={`Play ${result.title}`}
                >
                  <Artwork
                    src={result.thumbnail}
                    alt=""
                    className="h-full w-full"
                    imgClassName="h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                    {active && isPlaying ? (
                      <Pause className="h-4 w-4 fill-current text-white" />
                    ) : (
                      <Play className="h-4 w-4 fill-current text-white" />
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => play(result.videoId)}
                  className="min-w-0 flex-1 text-left focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "block truncate text-[13px] font-medium leading-5",
                      active ? "text-[#1ED760] font-bold" : "text-foreground",
                    )}
                  >
                    {result.title}
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="truncate">{result.artist}</span>
                    {result.views && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="shrink-0">{result.views} views</span>
                      </>
                    )}
                  </span>
                </button>

                <span className="hidden w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground sm:block">
                  {formatDuration(result.durationSeconds ?? 0)}
                </span>

              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
