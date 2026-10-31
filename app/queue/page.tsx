"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Clock3,
  GripVertical,
  ListMusic,
  Play,
  Trash2,
  X,
} from "lucide-react";
import { getAlbum, getArtist, getTrack } from "@/lib/catalog";
import { cn, formatDuration, formatTotalDuration } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import { toast } from "@/store/ui-store";
import { Artwork } from "@/components/music/artwork";
import { EmptyState } from "@/components/music/empty-state";
import { Equalizer } from "@/components/music/equalizer";
import { PlayButton } from "@/components/music/play-button";
import { PlaybackControls } from "@/components/player/playback-controls";
import { ProgressBar } from "@/components/player/progress-bar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function QueuePage() {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const queue = usePlayerStore((state) => state.queue);
  const queueIndex = usePlayerStore((state) => state.queueIndex);
  const contextLabel = usePlayerStore((state) => state.contextLabel);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playQueueIndex = usePlayerStore((state) => state.playQueueIndex);
  const removeFromQueue = usePlayerStore((state) => state.removeFromQueue);
  const reorderQueue = usePlayerStore((state) => state.reorderQueue);
  const clearQueue = usePlayerStore((state) => state.clearQueue);
  const current = currentTrackId ? getTrack(currentTrackId) : undefined;
  const artist = current ? getArtist(current.artistId) : undefined;
  const album = current ? getAlbum(current.albumId) : undefined;
  const [clearOpen, setClearOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const upcoming = queue
    .slice(queueIndex + 1)
    .map((id, relativeIndex) => ({
      track: getTrack(id),
      index: queueIndex + 1 + relativeIndex,
    }))
    .filter((entry): entry is { track: NonNullable<ReturnType<typeof getTrack>>; index: number } =>
      Boolean(entry.track),
    );
  const earlier = queue
    .slice(0, queueIndex)
    .map((id, index) => ({ track: getTrack(id), index }))
    .filter((entry): entry is { track: NonNullable<ReturnType<typeof getTrack>>; index: number } =>
      Boolean(entry.track),
    );
  const upcomingDuration = upcoming.reduce((total, item) => total + item.track.duration, 0);

  const handleDrop = (to: number) => {
    if (dragIndex === null) return;
    reorderQueue(dragIndex, to);
    setDragIndex(null);
    setDragOverIndex(null);
    toast.show("Queue reordered", "Your new sequence is ready.", "info");
  };

  return (
    <div className="page-container">
      <Link
        href="/now-playing"
        className="mb-5 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Now playing
      </Link>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-3">The listening session</p>
          <h1 className="text-[38px] font-medium leading-none tracking-[-0.05em] sm:text-[52px]">
            Queue
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {queue.length} {queue.length === 1 ? "track" : "tracks"} in session
            {contextLabel ? ` · ${contextLabel}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {upcoming.length > 0 && (
            <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
              <Clock3 className="h-3.5 w-3.5" />
              {formatTotalDuration(upcomingDuration)} remaining
            </span>
          )}
          <button
            type="button"
            disabled={queue.length <= 1}
            onClick={() => setClearOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[.09] px-4 text-xs font-medium text-muted-foreground transition hover:border-white/[.16] hover:bg-white/[.045] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear queue
          </button>
        </div>
      </div>

      {!current ? (
        <EmptyState
          icon={<ListMusic className="h-5 w-5" />}
          title="Your queue is empty"
          description="Play a record or add a track from anywhere in Sangeet to start building a session."
          action={
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground transition hover:bg-secondary"
            >
              <Play className="h-4 w-4 fill-current" />
              Discover music
            </Link>
          }
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <p className="eyebrow">Now playing</p>
                {contextLabel && (
                  <span className="rounded-full border border-white/[.07] px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60">
                    {contextLabel}
                  </span>
                )}
              </div>
              <div className="relative isolate overflow-hidden rounded-2xl border border-primary/20 bg-primary/[.065] p-4 sm:p-5">
                <div className="absolute -right-10 -top-16 -z-10 h-48 w-48 rounded-full bg-primary/20 blur-[70px]" />
                <div className="flex gap-4">
                  <Link
                    href={`/album/${current.albumId}`}
                    className="relative h-[82px] w-[82px] shrink-0 overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-[96px] sm:w-[96px]"
                  >
                    <Artwork
                      src={current.artwork}
                      alt={`${album?.title ?? current.title} artwork`}
                      className="h-full w-full rounded-lg"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition hover:opacity-100">
                      <Equalizer playing={isPlaying} />
                    </span>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/album/${current.albumId}`}
                          className="line-clamp-2 font-display text-2xl font-medium leading-tight tracking-[-0.035em] transition hover:underline sm:text-[28px]"
                        >
                          {current.title}
                        </Link>
                        <Link
                          href={`/artist/${current.artistId}`}
                          className="mt-1.5 block truncate text-[12.5px] text-muted-foreground transition hover:text-foreground hover:underline"
                        >
                          {artist?.name ?? "Unknown artist"}
                        </Link>
                        <p className="mt-1 truncate text-[10px] text-muted-foreground/55">
                          {album?.title} · {album?.year} · {current.mood}
                        </p>
                      </div>
                      <PlayButton trackIds={[current.id]} label={current.title} size="sm" />
                    </div>
                    <div className="mt-4">
                      <ProgressBar className="w-full" timeClassName="w-8 shrink-0 text-[9px] tabular-nums text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-9">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="eyebrow">Next up</p>
                  {upcoming.length > 0 && (
                    <span className="rounded-full bg-white/[.06] px-2 py-0.5 text-[9px] tabular-nums text-muted-foreground">
                      {upcoming.length}
                    </span>
                  )}
                </div>
                {upcoming.length > 1 && (
                  <span className="text-[10px] text-muted-foreground/50">Drag or use arrows to reorder</span>
                )}
              </div>

              {upcoming.length === 0 ? (
                <EmptyState
                  compact
                  icon={<ListMusic className="h-5 w-5" />}
                  title="Nothing queued"
                  description="Add a track with the ··· menu to keep the music going after this one."
                  action={
                    <Link
                      href="/explore"
                      className="rounded-full border border-white/[.1] px-5 py-2.5 text-xs font-medium transition hover:border-white/20 hover:bg-white/[.04]"
                    >
                      Explore music
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-1.5">
                  {upcoming.map(({ track, index }, position) => {
                    const trackArtist = getArtist(track.artistId);
                    const trackAlbum = getAlbum(track.albumId);
                    const isDragging = dragIndex === index;
                    const isDragOver = dragOverIndex === index;
                    return (
                      <div
                        key={`${track.id}-${index}`}
                        draggable
                        onDragStart={(event) => {
                          setDragIndex(index);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnter={() => setDragOverIndex(index)}
                        onDragOver={(event) => event.preventDefault()}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setDragOverIndex(null);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleDrop(index);
                        }}
                        className={cn(
                          "group flex items-center gap-2 rounded-xl border border-transparent bg-white/[.018] p-2 transition sm:gap-3",
                          isDragging && "opacity-45",
                          isDragOver && "border-primary/35 bg-primary/[.06]",
                        )}
                      >
                        <button
                          type="button"
                          aria-label={`Drag ${track.title} to reorder`}
                          className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground/40 transition hover:text-muted-foreground active:cursor-grabbing"
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                        <span className="w-4 shrink-0 text-center text-[10px] tabular-nums text-muted-foreground/45">
                          {position + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => playQueueIndex(index)}
                          className="h-10 w-10 shrink-0 overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label={`Play ${track.title}`}
                        >
                          <Artwork src={track.artwork} alt="" className="h-full w-full rounded-md" />
                        </button>
                        <button
                          type="button"
                          onClick={() => playQueueIndex(index)}
                          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <p className="truncate text-[12.5px] font-medium text-foreground">{track.title}</p>
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                            {trackArtist?.name}
                            {trackAlbum && (
                              <>
                                <span className="mx-1 text-muted-foreground/35">·</span>
                                {trackAlbum.title}
                              </>
                            )}
                          </p>
                        </button>
                        <span className="hidden w-9 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground/55 sm:block">
                          {formatDuration(track.duration)}
                        </span>
                        <div className="flex shrink-0 items-center">
                          <button
                            type="button"
                            aria-label={`Move ${track.title} up`}
                            disabled={position === 0}
                            onClick={() => {
                              reorderQueue(index, index - 1);
                              toast.show("Moved up", track.title, "info");
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/45 transition hover:bg-white/[.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-20"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${track.title} down`}
                            disabled={position === upcoming.length - 1}
                            onClick={() => {
                              reorderQueue(index, index + 1);
                              toast.show("Moved down", track.title, "info");
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/45 transition hover:bg-white/[.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-20"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${track.title} from queue`}
                            onClick={() => {
                              removeFromQueue(index);
                              toast.show("Removed from queue", track.title, "info");
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/45 transition hover:bg-white/[.06] hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {earlier.length > 0 && (
              <section className="mt-9">
                <p className="eyebrow mb-3">Earlier in this session</p>
                <div className="space-y-1">
                  {earlier.map(({ track, index }) => (
                    <button
                      key={`${track.id}-${index}`}
                      type="button"
                      onClick={() => playQueueIndex(index)}
                      className="flex w-full items-center gap-3 rounded-lg p-2 text-left opacity-60 transition hover:bg-white/[.035] hover:opacity-100"
                    >
                      <span className="w-4 text-center text-[10px] tabular-nums text-muted-foreground/45">
                        {index + 1}
                      </span>
                      <Artwork src={track.artwork} alt="" className="h-9 w-9 shrink-0 rounded-md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium">{track.title}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                          {getArtist(track.artistId)?.name}
                        </span>
                      </span>
                      <span className="text-[10px] tabular-nums text-muted-foreground/55">
                        {formatDuration(track.duration)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-5">
            <div className="rounded-xl border border-white/[.055] bg-white/[.018] p-5">
              <p className="eyebrow mb-4">Session</p>
              <div className="space-y-2.5 text-[11px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">In queue</span>
                  <span className="tabular-nums">{queue.length}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Up next</span>
                  <span className="tabular-nums">{upcoming.length}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Remaining</span>
                  <span>{formatTotalDuration(upcomingDuration)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Autoplay</span>
                  <span className="text-primary">On</span>
                </div>
              </div>
              <div className="mt-4 border-t border-white/[.06] pt-4">
                <PlaybackControls showExtras={false} className="justify-start" />
              </div>
            </div>

            <div className="rounded-xl border border-white/[.055] bg-surface/70 p-5">
              <p className="eyebrow mb-3">Sangeet note</p>
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                Your queue is part of the current session. Reorder it freely, remove what you do not
                need, and autoplay will keep the room going when the queue runs out.
              </p>
              <Link
                href="/made-for-you"
                className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
              >
                <ListMusic className="h-3.5 w-3.5" />
                Find another station
              </Link>
            </div>

            {album && (
              <Link
                href={`/album/${album.id}`}
                className="group flex items-center gap-3 rounded-xl border border-white/[.055] bg-white/[.018] p-3 transition hover:border-white/[.11] hover:bg-white/[.035]"
              >
                <Artwork src={album.artwork} alt="" className="h-12 w-12 shrink-0 rounded-md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium">{album.title}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                    From the current record
                  </span>
                </span>
                <span className="text-[10px] text-muted-foreground/40 transition group-hover:text-foreground">Open</span>
              </Link>
            )}
          </aside>
        </div>
      )}

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the queue?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes everything after the current track. The song playing now will keep
              playing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep queue</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearQueue();
                toast.show("Queue cleared", "Only the current track remains.", "info");
              }}
            >
              Clear queue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
