"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock3, History, Play, Search, Sparkles, Trash2 } from "lucide-react";
import { getArtist, getTracks } from "@/lib/catalog";
import { formatTotalDuration } from "@/lib/utils";
import { useLibraryStore } from "@/store/library-store";
import { toast } from "@/store/ui-store";
import { Artwork } from "@/components/music/artwork";
import { CollectionPlayButton, CollectionShuffleButton } from "@/components/music/collection-actions";
import { EmptyState } from "@/components/music/empty-state";
import { TrackList } from "@/components/music/track-list";
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

export default function RecentlyPlayedPage() {
  const recentlyPlayed = useLibraryStore((state) => state.recentlyPlayed);
  const clearHistory = useLibraryStore((state) => state.clearHistory);
  const [clearOpen, setClearOpen] = useState(false);
  const tracks = getTracks(recentlyPlayed);
  const totalDuration = tracks.reduce((total, track) => total + track.duration, 0);

  const uniqueArtists = Array.from(
    new Map(
      tracks
        .map((track) => getArtist(track.artistId))
        .filter((artist): artist is NonNullable<typeof artist> => Boolean(artist))
        .map((artist) => [artist.id, artist]),
    ).values(),
  ).slice(0, 8);

  return (
    <div className="page-container">
      <section className="relative isolate overflow-hidden rounded-2xl border border-white/[.06] bg-surface">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_15%_15%,rgba(94,124,226,.26),transparent_55%),radial-gradient(ellipse_at_90%_75%,rgba(139,92,246,.15),transparent_55%)]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0b0b0f]/85 via-[#0b0b0f]/45 to-transparent" />
        <div className="flex flex-col gap-6 p-5 sm:p-7 md:flex-row md:items-end lg:gap-9 lg:p-10">
          <div className="relative flex aspect-square w-[min(60vw,205px)] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#3B4B78] via-[#26304D] to-[#161A27] shadow-[0_30px_70px_-24px_rgba(0,0,0,.92)] sm:w-[210px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.16),transparent_45%)]" />
            <Clock3 className="relative h-[32%] w-[32%] text-white/85" strokeWidth={1.2} />
            <span className="absolute bottom-3 left-4 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Your listening
            </span>
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <p className="eyebrow mb-3">Pick up where you left off</p>
            <h1 className="font-display text-[40px] font-medium leading-[.94] tracking-[-0.055em] sm:text-[54px] lg:text-[66px]">
              Recently played
            </h1>
            <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              The last 30 tracks you listened to, kept locally so you can find your way back.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Your history</span>
              <span className="text-muted-foreground/35">·</span>
              <span>{tracks.length} {tracks.length === 1 ? "track" : "tracks"}</span>
              <span className="text-muted-foreground/35">·</span>
              <span>{formatTotalDuration(totalDuration)}</span>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <CollectionPlayButton trackIds={recentlyPlayed} label="Recently played" />
              <CollectionShuffleButton trackIds={recentlyPlayed} label="Recently played" />
              {tracks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setClearOpen(true)}
                  className="inline-flex h-12 items-center gap-2 rounded-full px-4 text-sm font-medium text-muted-foreground transition hover:bg-white/[.045] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear history
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {tracks.length === 0 ? (
        <div className="mt-9">
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title="Nothing played yet"
            description="Start a record and your listening history will build here automatically. It stays on this device."
            action={
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground transition hover:bg-secondary"
              >
                <Play className="h-4 w-4 fill-current" />
                Start listening
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-9 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section className="min-w-0">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-medium tracking-[-0.025em]">Listening history</h2>
                <span className="text-[10px] text-muted-foreground/55">Newest first</span>
              </div>
              <div className="rounded-xl border border-white/[.045] bg-white/[.012] px-2 py-3 sm:px-3">
                <TrackList trackIds={recentlyPlayed} label="Recently played" showAlbum />
              </div>
            </section>

            <aside className="space-y-5">
              <div className="rounded-xl border border-white/[.055] bg-white/[.018] p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <p className="eyebrow">Observed</p>
                </div>
                <p className="mt-3 text-[12.5px] leading-[1.7] text-muted-foreground">
                  {uniqueArtists.length > 0
                    ? `You have been moving between ${uniqueArtists
                        .slice(0, 3)
                        .map((artist) => artist.name)
                        .join(", ")} and a few familiar rooms.`
                    : "Your listening patterns will appear here after a few plays."}
                </p>
                {uniqueArtists.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center -space-x-2">
                    {uniqueArtists.slice(0, 6).map((artist) => (
                      <Link key={artist.id} href={`/artist/${artist.id}`} className="relative rounded-full ring-2 ring-[#141419]">
                        <Artwork
                          src={artist.image}
                          alt={`${artist.name} portrait`}
                          className="h-9 w-9 rounded-full"
                        />
                      </Link>
                    ))}
                    {uniqueArtists.length > 6 && (
                      <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-elevated text-[10px] text-muted-foreground ring-2 ring-[#141419]">
                        +{uniqueArtists.length - 6}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-white/[.055] bg-surface/70 p-5">
                <p className="eyebrow mb-3">Your history, privately</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Sangeet is a local demo. Your history is stored in this browser only and is never
                  uploaded. Clearing it cannot be undone.
                </p>
                <Link
                  href="/liked"
                  className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
                >
                  <Search className="h-3.5 w-3.5" />
                  Browse your liked songs
                </Link>
              </div>
            </aside>
          </div>
        </>
      )}

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear your listening history?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes all recently played tracks from this browser. Liked songs, albums and
              playlists will stay exactly as they are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep history</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearHistory();
                toast.show("Listening history cleared", "Your saved library is unchanged.", "info");
              }}
            >
              Clear history
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
