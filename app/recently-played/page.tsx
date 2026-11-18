"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock3, History, Play, Search, Trash2 } from "lucide-react";
import { getArtist, getTracks } from "@/lib/catalog";
import { formatTotalDuration } from "@/lib/utils";
import { useLibraryStore } from "@/store/library-store";
import { HISTORY_RETENTION_LIMIT } from "@/lib/plan-limits";
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
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_15%_15%,rgba(94,124,226,.24),transparent_55%),radial-gradient(ellipse_at_90%_75%,rgba(139,92,246,.14),transparent_55%)]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0b0b0f]/85 via-[#0b0b0f]/45 to-transparent" />
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#3B4B78] via-[#26304D] to-[#161A27] shadow-lg sm:h-16 sm:w-16">
              <Clock3 className="h-6 w-6 text-white/90 sm:h-7 sm:w-7" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="eyebrow">History</p>
              <h1 className="mt-0.5 truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Recently Played
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {tracks.length} {tracks.length === 1 ? "track" : "tracks"} · {formatTotalDuration(totalDuration)} (up to {HISTORY_RETENTION_LIMIT.toLocaleString()})
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <CollectionPlayButton trackIds={recentlyPlayed} label="Recently played" />
            <CollectionShuffleButton trackIds={recentlyPlayed} label="Recently played" />
            {tracks.length > 0 && (
              <button
                type="button"
                onClick={() => setClearOpen(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-medium text-muted-foreground transition hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      {tracks.length === 0 ? (
        <div className="mt-9">
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title="Nothing played yet"
            description="Start a record and your listening history will build here automatically. Sign in to keep it in sync across devices."
            action={
              <Link
                href="/home"
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
                  <Clock3 className="h-3.5 w-3.5 text-primary" />
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
                  Your history is private to your Sangeet account when signed in. Clearing it removes the saved history from this device and syncs that change.
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
