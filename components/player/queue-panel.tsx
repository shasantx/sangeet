"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ListMusic, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { getArtist, getTrack } from "@/lib/catalog";
import { formatDuration } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import { useUIStore, toast } from "@/store/ui-store";
import { Artwork } from "@/components/music/artwork";
import { EmptyState } from "@/components/music/empty-state";
import { PlayButton } from "@/components/music/play-button";

export function QueuePanel() {
  const open = useUIStore((state) => state.queuePanelOpen);
  const setOpen = useUIStore((state) => state.setQueuePanelOpen);
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const queue = usePlayerStore((state) => state.queue);
  const queueIndex = usePlayerStore((state) => state.queueIndex);
  const playQueueIndex = usePlayerStore((state) => state.playQueueIndex);
  const removeFromQueue = usePlayerStore((state) => state.removeFromQueue);
  const clearQueue = usePlayerStore((state) => state.clearQueue);
  const pathname = usePathname();
  const current = currentTrackId ? getTrack(currentTrackId) : undefined;
  const currentArtist = current ? getArtist(current.artistId) : undefined;
  const upcoming = queue
    .slice(queueIndex + 1)
    .map((id, relativeIndex) => ({ track: getTrack(id), index: queueIndex + 1 + relativeIndex }))
    .filter((entry) => Boolean(entry.track));

  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="queue-overlay fixed inset-0 z-[110] bg-black/55 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className="queue-panel fixed right-0 top-0 z-[120] flex h-dvh w-full max-w-[420px] flex-col border-l border-white/[.07] bg-[#121218] shadow-float focus:outline-none"
          aria-describedby={undefined}
        >
          <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/[.055] px-5">
            <div>
              <DialogPrimitive.Title className="font-display text-xl font-medium tracking-[-0.03em]">
                Queue
              </DialogPrimitive.Title>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {queue.length} {queue.length === 1 ? "track" : "tracks"} in session
              </p>
            </div>
            <div className="flex items-center gap-1">
              {queue.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    clearQueue();
                    toast.show("Queue cleared", "Only the current track remains.", "info");
                  }}
                  className="rounded-full px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Clear
                </button>
              )}
              <DialogPrimitive.Close className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <X className="h-4 w-4" />
                <span className="sr-only">Close queue</span>
              </DialogPrimitive.Close>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {current ? (
              <>
                <p className="eyebrow mb-3">Now playing</p>
                <div className="rounded-xl border border-white/[.06] bg-white/[.03] p-3">
                  <div className="flex items-center gap-3">
                    <Artwork
                      src={current.artwork}
                      alt={`${current.title} artwork`}
                      className="h-[58px] w-[58px] shrink-0 rounded-md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-primary">{current.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {currentArtist?.name ?? "Unknown artist"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatDuration(current.duration)}
                      </p>
                    </div>
                    <PlayButton trackIds={[current.id]} label={current.title} size="sm" />
                  </div>
                </div>

                <div className="mb-3 mt-7 flex items-center justify-between">
                  <p className="eyebrow">Next up</p>
                  <Link
                    href="/queue"
                    onClick={() => setOpen(false)}
                    className="text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    Open full queue
                  </Link>
                </div>

                {upcoming.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<ListMusic className="h-5 w-5" />}
                    title="Nothing queued"
                    description="Add tracks with the ··· menu or play an album to keep the music going."
                  />
                ) : (
                  <div className="space-y-1">
                    {upcoming.map(({ track, index }) =>
                      track ? (
                        <div
                          key={`${track.id}-${index}`}
                          className="group flex items-center gap-3 rounded-lg px-1.5 py-2 transition hover:bg-white/[.045]"
                        >
                          <button
                            type="button"
                            onClick={() => playQueueIndex(index)}
                            className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label={`Play ${track.title}`}
                          >
                            <Artwork src={track.artwork} alt="" className="h-full w-full rounded-md" />
                          </button>
                          <button
                            type="button"
                            onClick={() => playQueueIndex(index)}
                            className="min-w-0 flex-1 text-left focus-visible:outline-none"
                          >
                            <p className="truncate text-[13px] font-medium text-foreground">
                              {track.title}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {getArtist(track.artistId)?.name ?? "Unknown artist"}
                            </p>
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${track.title} from queue`}
                            onClick={() => removeFromQueue(index)}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground opacity-100 transition hover:bg-white/[.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : null,
                    )}
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={<ListMusic className="h-5 w-5" />}
                title="Your queue is empty"
                description="Start a record or add a track to queue from anywhere in Sangeet."
                action={
                  <DialogPrimitive.Close asChild>
                    <Link
                      href="/home"
                      className="rounded-full bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground transition hover:bg-secondary"
                    >
                      Discover music
                    </Link>
                  </DialogPrimitive.Close>
                }
              />
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-white/[.055] px-5 py-3.5">
            <span className="text-[11px] text-muted-foreground">Autoplay continues after the queue</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground/40" />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
