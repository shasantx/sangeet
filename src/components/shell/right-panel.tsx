"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Heart,
  ListMusic,
  ListPlus,
  Mic2,
  Play,
  Radio,
  Shuffle,
  Trash2,
  X
} from "lucide-react";
import { usePlayerStore } from "@/store/player-store";
import { useLibraryStore } from "@/store/library-store";
import { useUIStore } from "@/store/ui-store";
import { useLyricsStore } from "@/store/lyrics-store";
import { useToastStore } from "@/store/toast-store";
import { getActiveLyricIndex } from "@/lib/lyrics-parser";
import { TrackArtwork } from "@/components/music/track-artwork";
import { cn } from "@/lib/utils";
import type { Track } from "@/types/music";

function getTrackSourceLabel(track: Track): string {
  if (track.source === "local") return "Local File";
  if (track.source === "offline" || track.offlineId) return "Offline Library";
  if (track.source === "audius" || track.streamUrl) return "Audius Open Audio";
  return "YouTube Music";
}

export function RightPanel() {
  const router = useRouter();
  const rightTab = useUIStore((s) => s.rightTab);
  const setRightTab = useUIStore((s) => s.setRightTab);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const moveQueueItem = usePlayerStore((s) => s.moveQueueItem);
  const shuffleQueue = usePlayerStore((s) => s.shuffleQueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);
  const requestSeek = usePlayerStore((s) => s.requestSeek);
  const fetchRadioForTrack = usePlayerStore((s) => s.fetchRadioForTrack);
  const radioLoading = usePlayerStore((s) => s.radioLoading);

  const toggleLike = useLibraryStore((s) => s.toggleLike);
  const likedTracks = useLibraryStore((s) => s.likedTracks);
  const importPlaylist = useLibraryStore((s) => s.importPlaylist);
  const showToast = useToastStore((s) => s.showToast);

  const lyrics = useLyricsStore((s) => s.lyrics);
  const lyricsLoading = useLyricsStore((s) => s.loading);
  const activeLineRef = useRef<HTMLButtonElement | null>(null);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const activeLyricIndex = getActiveLyricIndex(
    lyrics?.synced ?? [],
    currentTime
  );

  useEffect(() => {
    activeLineRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }, [activeLyricIndex]);

  // Close drawer with Escape on smaller viewports (< xl)
  useEffect(() => {
    if (!rightTab) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && window.innerWidth < 1280) {
        setRightTab(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rightTab, setRightTab]);

  if (!rightTab) return null;

  const isLiked = currentTrack
    ? likedTracks.some((t) => t.id === currentTrack.id)
    : false;

  const handleSaveQueueAsPlaylist = () => {
    const tracksToSave = [
      ...(currentTrack ? [currentTrack] : []),
      ...queue
    ];
    if (tracksToSave.length === 0) return;
    const dateLabel = new Date().toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
    const created = importPlaylist(
      `Queue Mix (${dateLabel})`,
      tracksToSave,
      `Saved from playback queue (${tracksToSave.length} tracks)`
    );
    showToast(`Saved "${created.name}" (${created.tracks.length} songs)`, "success");
    router.push(`/playlist/${created.id}`);
  };

  return (
    <>
      {/* Overlay backdrop on tablets & laptops (md to < xl) */}
      <div
        onClick={() => setRightTab(null)}
        aria-hidden="true"
        className="fixed inset-0 z-40 hidden bg-black/55 md:block xl:hidden"
      />

      <aside className="animate-drawer-in fixed bottom-2 right-2 top-[68px] z-50 hidden w-[min(350px,calc(100vw-16px))] shrink-0 flex-col rounded-panel bg-encore-base shadow-[var(--shadow-elevated)] md:flex xl:static xl:inset-auto xl:z-auto xl:h-full xl:w-[320px] xl:bg-encore-base xl:shadow-[var(--shadow-elevated)] dark:xl:shadow-[var(--shadow-elevated)]">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5">
          <div className="flex items-center gap-1">
            {(
              [
                { id: "now-playing", label: "Now playing" },
                { id: "queue", label: "Queue" },
                { id: "lyrics", label: "Lyrics" }
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRightTab(tab.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150",
                  rightTab === tab.id
                    ? "bg-encore-tinted text-encore-accent"
                    : "text-encore-subdued hover:bg-encore-elevated hover:text-encore-text"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setRightTab(null)}
            aria-label="Close panel"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-encore-muted transition-colors duration-150 hover:bg-encore-elevated hover:text-encore-text"
          >
            <X className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 pt-2">
          {rightTab === "now-playing" && (
            <>
              {!currentTrack ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-encore-subdued">
                  <ListMusic className="mb-3 h-10 w-10 opacity-40" />
                  <p className="text-sm font-semibold text-encore-text">
                    Nothing playing
                  </p>
                  <p className="mt-1 text-xs">
                    Pick any song from Home or Search to start listening.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-xl bg-encore-elevated shadow-[var(--shadow-elevated)]">
                    <TrackArtwork
                      src={currentTrack.thumbnail}
                      trackId={currentTrack.id}
                      alt={currentTrack.title}
                      className="aspect-square w-full"
                      iconClassName="h-12 w-12"
                    />
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold text-encore-text">
                        {currentTrack.title}
                      </h2>
                      {currentTrack.artistId ? (
                        <Link
                          href={`/artist/${encodeURIComponent(currentTrack.artistId)}?name=${encodeURIComponent(currentTrack.artist)}`}
                          className="truncate text-sm text-encore-subdued hover:text-encore-accent hover:underline"
                        >
                          {currentTrack.artist}
                        </Link>
                      ) : (
                        <p className="truncate text-sm text-encore-subdued">
                          {currentTrack.artist}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleLike(currentTrack)}
                      aria-label={isLiked ? "Unlike" : "Like"}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-encore-subdued transition hover:bg-encore-elevated hover:text-encore-accent active:scale-90"
                    >
                      <Heart
                        className={cn(
                          "h-5 w-5",
                          isLiked && "fill-encore-accent text-encore-accent"
                        )}
                      />
                    </button>
                  </div>

                  {/* 1-Click Start Song Radio */}
                  {!currentTrack.localUrl && !currentTrack.offlineId && (
                    <button
                      type="button"
                      disabled={radioLoading}
                      onClick={() => {
                        void fetchRadioForTrack(currentTrack.id);
                        showToast(
                          `Added similar radio tracks for "${currentTrack.title}"`,
                          "success"
                        );
                      }}
                      className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-encore-tinted px-3.5 py-2 text-xs font-semibold text-encore-accent transition-colors duration-150 hover:bg-encore-tinted-highlight active:scale-[0.98] disabled:opacity-50"
                    >
                      <Radio className="h-4 w-4" strokeWidth={1.7} />
                      <span>
                        {radioLoading ? "Loading Song Radio..." : "Start Song Radio"}
                      </span>
                    </button>
                  )}

                  {/* Next in queue card */}
                  {queue.length > 0 && (
                    <div className="rounded-xl bg-encore-elevated/75 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold text-encore-text">
                          Next in queue
                        </span>
                        <button
                          type="button"
                          onClick={() => setRightTab("queue")}
                          className="text-xs font-semibold text-encore-accent hover:underline"
                        >
                          Open queue
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => playTrack(queue[0], queue)}
                        className="group flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition hover:bg-encore-elevated-highlight"
                      >
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md">
                          <TrackArtwork
                            src={queue[0].thumbnail}
                            trackId={queue[0].id}
                            alt={queue[0].title}
                            className="h-full w-full"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                            <Play className="h-4 w-4 fill-white text-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-encore-text">
                            {queue[0].title}
                          </p>
                          <p className="truncate text-xs text-encore-subdued">
                            {queue[0].artist}
                          </p>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Credits / Accurate Source card */}
                  <div className="rounded-xl bg-encore-elevated/75 p-3.5 text-xs">
                    <p className="mb-2 font-bold text-encore-text">Credits</p>
                    <div className="flex items-center justify-between gap-2 py-1">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-encore-text">
                          {currentTrack.artist}
                        </p>
                        <p className="text-encore-subdued">Main Artist</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-encore-base/70 px-2.5 py-0.5 text-[11px] text-encore-subdued">
                        {getTrackSourceLabel(currentTrack)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {rightTab === "queue" && (
            <div className="space-y-4">
              {currentTrack && (
                <div>
                  <p className="mb-2 text-xs font-medium text-encore-muted">
                    Now playing
                  </p>
                  <div className="flex items-center gap-3 rounded-xl bg-encore-elevated/75 p-2">
                    <TrackArtwork
                      src={currentTrack.thumbnail}
                      trackId={currentTrack.id}
                      alt={currentTrack.title}
                      className="h-10 w-10 shrink-0 rounded-md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-encore-accent">
                        {currentTrack.title}
                      </p>
                      <p className="truncate text-xs text-encore-muted">
                        {currentTrack.artist}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-encore-muted">
                    Next up{" "}
                    <span className="font-mono tabular-nums">
                      ({queue.length})
                    </span>
                  </p>
                  {queue.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          shuffleQueue();
                          showToast("Queue shuffled");
                        }}
                        title="Shuffle queue"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-encore-subdued hover:text-encore-text"
                      >
                        <Shuffle className="h-3 w-3" />
                        Shuffle
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveQueueAsPlaylist}
                        title="Save queue as playlist"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-encore-accent hover:underline"
                      >
                        <ListPlus className="h-3.5 w-3.5" />
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          clearQueue();
                          showToast("Queue cleared");
                        }}
                        className="text-[11px] font-semibold text-encore-subdued hover:text-encore-text"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {queue.length === 0 ? (
                  <p className="py-6 text-center text-xs text-encore-subdued">
                    Queue is empty. Play a song to auto-fill radio tracks.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {queue.map((track, idx) => (
                      <div
                        key={`${track.id}-${idx}`}
                        draggable
                        onDragStart={() => setDragIndex(idx)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverIndex !== idx) setDragOverIndex(idx);
                        }}
                        onDragLeave={() => {
                          if (dragOverIndex === idx) setDragOverIndex(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragIndex !== null && dragIndex !== idx) {
                            moveQueueItem(dragIndex, idx);
                          }
                          setDragIndex(null);
                          setDragOverIndex(null);
                        }}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setDragOverIndex(null);
                        }}
                        className={cn(
                          "group flex items-center gap-1.5 rounded-md p-1.5 transition hover:bg-encore-highlight",
                          dragOverIndex === idx &&
                            dragIndex !== idx &&
                            "ring-1 ring-encore-accent bg-encore-accent/10",
                          dragIndex === idx && "opacity-50"
                        )}
                      >
                        <span
                          title="Drag to reorder"
                          className="cursor-grab text-encore-subdued/60 hover:text-encore-text active:cursor-grabbing"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                        <button
                          type="button"
                          onClick={() => playTrack(track, queue.slice(idx))}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                        >
                          <TrackArtwork
                            src={track.thumbnail}
                            trackId={track.id}
                            alt={track.title}
                            className="h-10 w-10 shrink-0 rounded-md"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-encore-text">
                              {track.title}
                            </p>
                            <p className="truncate text-xs text-encore-subdued">
                              {track.artist}
                            </p>
                          </div>
                        </button>
                        <div className="flex shrink-0 items-center opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => moveQueueItem(idx, idx - 1)}
                            disabled={idx === 0}
                            aria-label="Move up"
                            className="rounded p-1 text-encore-subdued hover:text-encore-text disabled:opacity-25"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveQueueItem(idx, idx + 1)}
                            disabled={idx === queue.length - 1}
                            aria-label="Move down"
                            className="rounded p-1 text-encore-subdued hover:text-encore-text disabled:opacity-25"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromQueue(idx)}
                            aria-label="Remove from queue"
                            className="rounded p-1 text-encore-subdued hover:text-encore-negative"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {rightTab === "lyrics" && (
            <div className="space-y-3">
              {!currentTrack ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-encore-subdued">
                  <Mic2 className="mb-3 h-8 w-8 opacity-40" />
                  <p className="text-sm font-semibold text-encore-text">
                    No active track
                  </p>
                  <p className="mt-1 text-xs">
                    Play a song to view synced lyrics.
                  </p>
                </div>
              ) : lyricsLoading ? (
                <div className="space-y-3 py-6">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-4 animate-pulse rounded bg-encore-elevated-highlight"
                      style={{ width: `${65 + ((i * 13) % 30)}%` }}
                    />
                  ))}
                </div>
              ) : lyrics?.synced && lyrics.synced.length > 0 ? (
                <div className="space-y-2.5 py-2">
                  {lyrics.synced.map((line, idx) => {
                    const isActive = idx === activeLyricIndex;
                    const isPast = idx < activeLyricIndex;
                    return (
                      <button
                        key={`${line.time}-${idx}`}
                        ref={isActive ? activeLineRef : null}
                        type="button"
                        onClick={() => requestSeek(line.time)}
                        className={cn(
                          "block w-full text-left text-base font-bold leading-snug transition-colors",
                          isActive
                            ? "scale-[1.01] text-encore-accent"
                            : isPast
                              ? "text-encore-muted hover:text-encore-text"
                              : "text-encore-subdued hover:text-encore-text"
                        )}
                      >
                        {line.text}
                      </button>
                    );
                  })}
                </div>
              ) : lyrics?.plain ? (
                <pre className="whitespace-pre-wrap font-sans text-sm font-medium leading-relaxed text-encore-text">
                  {lyrics.plain}
                </pre>
              ) : (
                <div className="py-12 text-center text-xs text-encore-subdued">
                  No lyrics found for &ldquo;{currentTrack.title}&rdquo;.
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
