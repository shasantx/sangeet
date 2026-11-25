"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  ListMusic,
  ListPlus,
  Mic2,
  Play,
  Shuffle,
  Trash2
} from "lucide-react";
import { usePlayerStore } from "@/store/player-store";
import { useLibraryStore } from "@/store/library-store";
import { useToastStore } from "@/store/toast-store";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

export default function QueuePage() {
  const router = useRouter();
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const history = usePlayerStore((s) => s.history);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const moveQueueItem = usePlayerStore((s) => s.moveQueueItem);
  const shuffleQueue = usePlayerStore((s) => s.shuffleQueue);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);

  const importPlaylist = useLibraryStore((s) => s.importPlaylist);
  const showToast = useToastStore((s) => s.showToast);

  const [confirmClear, setConfirmClear] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleSaveAsPlaylist = () => {
    const tracks = [...(currentTrack ? [currentTrack] : []), ...queue];
    if (tracks.length === 0) return;
    const dateLabel = new Date().toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
    const created = importPlaylist(
      `Queue Mix (${dateLabel})`,
      tracks,
      `Saved from playback queue (${tracks.length} tracks)`
    );
    showToast(`Saved "${created.name}" (${created.tracks.length} songs)`, "success");
    router.push(`/playlist/${created.id}`);
  };

  return (
    <div className="mx-auto max-w-4xl overflow-x-hidden space-y-6 p-4 pb-16 sm:p-6">
      {/* Quick playback view switcher (Queue <-> Lyrics) */}
      <nav
        aria-label="Playback views"
        className="inline-flex items-center gap-1 rounded-full border border-encore-hairline bg-encore-elevated p-1"
      >
        <Link
          href="/queue"
          aria-current="page"
          className="btn-cobalt inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-xs font-semibold"
        >
          <ListMusic className="h-4 w-4" strokeWidth={1.6} />
          Queue
        </Link>
        <Link
          href="/lyrics"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-xs font-medium text-encore-subdued transition-colors hover:text-encore-text"
        >
          <Mic2 className="h-4 w-4" strokeWidth={1.6} />
          Lyrics
        </Link>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.015em] text-encore-text sm:text-3xl">
            Queue
          </h1>
          <p className="mt-1 font-mono text-xs tabular-nums text-encore-muted">
            {queue.length} {queue.length === 1 ? "track" : "tracks"} up next
          </p>
        </div>

        {queue.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                shuffleQueue();
                showToast("Queue shuffled");
              }}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-encore-hairline bg-encore-elevated px-4 text-xs font-medium text-encore-text transition-colors duration-150 hover:border-encore-accent/40 hover:bg-encore-elevated-highlight"
            >
              <Shuffle className="h-3.5 w-3.5 text-encore-muted" strokeWidth={1.6} />
              Shuffle
            </button>
            <button
              type="button"
              onClick={handleSaveAsPlaylist}
              className="btn-cobalt inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition active:scale-[0.98]"
            >
              <ListPlus className="h-3.5 w-3.5" strokeWidth={1.6} />
              Save playlist
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="h-11 rounded-full border border-encore-hairline bg-encore-base px-4 text-xs font-medium text-encore-subdued transition-colors duration-150 hover:border-encore-negative/50 hover:text-encore-negative"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {currentTrack && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-encore-subdued">
            Now Playing
          </h2>
          <div className="flex items-center gap-3 rounded-xl bg-encore-elevated p-3">
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className="h-12 w-12 shrink-0 rounded object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-encore-accent">
                {currentTrack.title}
              </p>
              <p className="truncate text-xs text-encore-subdued">
                {currentTrack.artist}
              </p>
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-encore-subdued">
          Next Up
        </h2>
        {queue.length === 0 ? (
          <div className="rounded-xl border border-encore-divider bg-encore-elevated/40 p-8 text-center text-sm text-encore-subdued">
            Queue is empty. Play any song or use &ldquo;Add to queue&rdquo; to
            line up tracks.
          </div>
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
                  "flex items-center justify-between gap-2 rounded-lg bg-encore-elevated/50 p-2 transition hover:bg-encore-elevated-highlight",
                  dragOverIndex === idx &&
                    dragIndex !== idx &&
                    "bg-encore-accent/15 ring-1 ring-encore-accent",
                  dragIndex === idx && "opacity-50"
                )}
              >
                <span
                  title="Drag to reorder"
                  className="hidden cursor-grab pl-1 text-encore-subdued/60 hover:text-encore-text active:cursor-grabbing sm:inline-flex"
                >
                  <GripVertical className="h-4 w-4" />
                </span>
                <button
                  type="button"
                  onClick={() => playTrack(track, queue.slice(idx))}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <img
                    src={track.thumbnail}
                    alt={track.title}
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
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

                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveQueueItem(idx, idx - 1)}
                    aria-label="Move track up"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-encore-subdued hover:bg-encore-base hover:text-encore-text disabled:opacity-25"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === queue.length - 1}
                    onClick={() => moveQueueItem(idx, idx + 1)}
                    aria-label="Move track down"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-encore-subdued hover:bg-encore-base hover:text-encore-text disabled:opacity-25"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromQueue(idx)}
                    aria-label="Remove from queue"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-encore-subdued hover:bg-encore-base hover:text-encore-negative"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-encore-subdued">
            Previously Played
          </h2>
          <div className="space-y-1">
            {history.slice(0, 10).map((track, idx) => (
              <button
                key={`hist-${track.id}-${idx}`}
                type="button"
                onClick={() => playTrack(track, history)}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-encore-hover"
              >
                <img
                  src={track.thumbnail}
                  alt={track.title}
                  className="h-10 w-10 shrink-0 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-encore-text">
                    {track.title}
                  </p>
                  <p className="truncate text-xs text-encore-subdued">
                    {track.artist}
                  </p>
                </div>
                <Play className="h-4 w-4 shrink-0 text-encore-subdued" />
              </button>
            ))}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear playback queue?"
        description={`Remove all ${queue.length} upcoming tracks from your queue?`}
        confirmLabel="Clear queue"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          clearQueue();
          showToast("Queue cleared");
        }}
      />
    </div>
  );
}
