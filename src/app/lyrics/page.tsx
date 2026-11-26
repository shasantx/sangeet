"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Download, ListMusic, Mic2, Share2, X } from "lucide-react";
import { usePlayerStore } from "@/store/player-store";
import { useToastStore } from "@/store/toast-store";
import { useLyricsStore } from "@/store/lyrics-store";
import { getActiveLyricIndex } from "@/lib/lyrics-parser";
import { cn, pickHeroColor } from "@/lib/utils";

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export default function FullLyricsPage() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const requestSeek = usePlayerStore((s) => s.requestSeek);
  const showToast = useToastStore((s) => s.showToast);

  const lyrics = useLyricsStore((s) => s.lyrics);
  const loading = useLyricsStore((s) => s.loading);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setSelectedIndices([]);
    setSelectMode(false);
  }, [currentTrack]);

  const activeIdx = getActiveLyricIndex(lyrics?.synced ?? [], currentTime);

  useEffect(() => {
    if (!selectMode) {
      activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIdx, selectMode]);

  const playbackSwitcher = (
    <nav
      aria-label="Playback views"
      className="inline-flex items-center gap-1 rounded-full border border-encore-hairline bg-encore-elevated p-1"
    >
      <Link
        href="/queue"
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-xs font-medium text-encore-subdued transition-colors hover:text-encore-text"
      >
        <ListMusic className="h-4 w-4" strokeWidth={1.6} />
        Queue
      </Link>
      <Link
        href="/lyrics"
        aria-current="page"
        className="btn-cobalt inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-xs font-semibold"
      >
        <Mic2 className="h-4 w-4" strokeWidth={1.6} />
        Lyrics
      </Link>
    </nav>
  );

  if (!currentTrack) {
    return (
      <div className="mx-auto flex h-full max-w-4xl flex-col p-4 sm:p-6">
        <div className="mb-6">{playbackSwitcher}</div>
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-encore-subdued">
          <Mic2 className="mb-4 h-12 w-12 opacity-40" />
          <h1 className="text-xl font-bold text-encore-text">No song playing</h1>
          <p className="mt-2 text-sm">
            Play any track to view synchronized lyrics and create shareable
            lyric cards.
          </p>
        </div>
      </div>
    );
  }

  const bg = pickHeroColor(currentTrack.id);
  const displayLines =
    lyrics?.synced && lyrics.synced.length > 0
      ? lyrics.synced.map((l) => ({ time: l.time, text: l.text }))
      : (lyrics?.plain ?? "")
          .split(/\r?\n/)
          .map((t) => t.trim())
          .filter(Boolean)
          .map((text) => ({ time: null as number | null, text }));

  const toggleLine = (idx: number) => {
    setSelectedIndices((prev) => {
      if (prev.includes(idx)) return prev.filter((i) => i !== idx);
      if (prev.length >= 4) {
        showToast("Select up to 4 lyric lines for a card");
        return prev;
      }
      return [...prev, idx].sort((a, b) => a - b);
    });
  };

  const handleExportCard = () => {
    const chosen = selectedIndices
      .map((i) => displayLines[i]?.text)
      .filter(Boolean);
    if (chosen.length === 0) {
      showToast("Tap 1 to 4 lyric lines first", "error");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Flat background: shell colour with a wash of the track colour
    ctx.fillStyle = "#0d0c0b";
    ctx.fillRect(0, 0, 1080, 1350);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1350);
    ctx.globalAlpha = 1;

    // Subtle card frame
    ctx.fillStyle = "rgba(10, 6, 6, 0.35)";
    ctx.fillRect(72, 72, 936, 1206);

    // Header: Track + Artist
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 42px system-ui, -apple-system, sans-serif";
    ctx.fillText(currentTrack.title.slice(0, 34), 120, 180);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "600 30px system-ui, -apple-system, sans-serif";
    ctx.fillText(currentTrack.artist.slice(0, 42), 120, 228);

    // Lyric lines
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 54px system-ui, -apple-system, sans-serif";
    let y = 390;
    for (const line of chosen) {
      const wrapped = wrapCanvasText(ctx, line, 840);
      for (const w of wrapped) {
        ctx.fillText(w, 120, y);
        y += 74;
      }
      y += 28;
    }

    // Footer Dhun badge
    ctx.fillStyle = "#e2363e";
    ctx.beginPath();
    ctx.arc(146, 1188, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 28px system-ui, -apple-system, sans-serif";
    ctx.fillText("S", 136, 1198);

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "700 28px system-ui, -apple-system, sans-serif";
    ctx.fillText("Dhun", 186, 1198);

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentTrack.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-lyric-card.png`;
    a.click();
    showToast("Lyric card PNG saved", "success");
    setSelectMode(false);
    setSelectedIndices([]);
  };

  return (
    <div className="min-h-full overflow-x-hidden bg-encore-base px-4 py-6 sm:px-10 sm:py-10 md:px-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">{playbackSwitcher}</div>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-encore-text">
                {currentTrack.title}
              </h1>
              <p className="truncate text-sm text-encore-subdued">{currentTrack.artist}</p>
            </div>
          </div>

          {displayLines.length > 0 && (
            <div className="flex items-center gap-2">
              {selectMode ? (
                <>
                  <button
                    type="button"
                    onClick={handleExportCard}
                    disabled={selectedIndices.length === 0}
                    className="btn-cobalt inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition disabled:opacity-40"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Card ({selectedIndices.length}/4)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectMode(false);
                      setSelectedIndices([]);
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-encore-hairline bg-encore-elevated text-encore-text transition hover:bg-encore-elevated-highlight"
                    aria-label="Cancel selection"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectMode(true)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-encore-hairline bg-encore-elevated px-4 text-xs font-semibold text-encore-text transition hover:border-encore-accent/45 hover:bg-encore-elevated-highlight"
                >
                  <Share2 className="h-3.5 w-3.5 text-encore-accent" />
                  Share Lyric Card
                </button>
              )}
            </div>
          )}
        </div>

        {selectMode && (
          <p className="mb-6 rounded-xl border border-encore-accent/30 bg-encore-tinted px-4 py-2.5 text-xs font-medium text-encore-text">
            Tap 1–4 lines below to include them on your shareable Lyric Card.
          </p>
        )}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-7 animate-pulse rounded-lg bg-encore-elevated"
                style={{ width: `${50 + ((i * 17) % 45)}%` }}
              />
            ))}
          </div>
        ) : displayLines.length > 0 ? (
          <div className="space-y-4 pb-24">
            {displayLines.map((line, idx) => {
              const isActive = line.time !== null && idx === activeIdx;
              const isPast = line.time !== null && idx < activeIdx;
              const isSelected = selectedIndices.includes(idx);

              return (
                <button
                  key={`${idx}-${line.text.slice(0, 12)}`}
                  ref={isActive ? activeRef : null}
                  type="button"
                  onClick={() => {
                    if (selectMode) {
                      toggleLine(idx);
                    } else if (line.time !== null) {
                      requestSeek(line.time);
                    }
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-[8px] px-3 py-1.5 text-left text-2xl font-medium leading-snug tracking-[-0.015em] transition-colors duration-150 sm:text-3xl",
                    selectMode && isSelected
                      ? "bg-encore-elevated-highlight text-encore-text ring-1 ring-encore-accent"
                      : selectMode
                        ? "text-encore-subdued hover:bg-encore-elevated hover:text-encore-text"
                        : isActive
                          ? "text-encore-accent"
                          : isPast
                            ? "text-encore-muted hover:text-encore-subdued"
                            : "text-encore-subdued dark:text-white/60 hover:text-encore-text"
                  )}
                >
                  {selectMode && (
                    <span
                      className={cn(
                        "mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                        isSelected
                          ? "border-encore-accent bg-encore-accent text-encore-on-accent"
                          : "border-encore-muted"
                      )}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                    </span>
                  )}
                  <span>{line.text}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="py-12 text-lg font-semibold text-encore-subdued">
            Lyrics aren&apos;t available for this track yet.
          </p>
        )}
      </div>
    </div>
  );
}
