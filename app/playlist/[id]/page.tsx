"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ListMusic,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Shuffle,
  Trash2,
} from "lucide-react";
import {
  getArtist,
  getPlaylist,
  getTracks,
  playlists,
  tracks,
} from "@/lib/catalog";
import type { UserPlaylist } from "@/lib/types";
import { formatTotalDuration } from "@/lib/utils";
import { useLibraryStore } from "@/store/library-store";
import { toast } from "@/store/ui-store";
import { Artwork } from "@/components/music/artwork";
import { CollectionHero } from "@/components/music/collection-hero";
import { CollectionPlayButton, CollectionShuffleButton } from "@/components/music/collection-actions";
import { EmptyState } from "@/components/music/empty-state";
import { PlaylistCard } from "@/components/music/playlist-card";
import { SectionHeader } from "@/components/music/section-header";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export default function PlaylistPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const router = useRouter();
  const userPlaylists = useLibraryStore((state) => state.playlists);
  const renamePlaylist = useLibraryStore((state) => state.renamePlaylist);
  const deletePlaylist = useLibraryStore((state) => state.deletePlaylist);
  const removeTrackFromPlaylist = useLibraryStore((state) => state.removeTrackFromPlaylist);
  const addTracksToPlaylist = useLibraryStore((state) => state.addTracksToPlaylist);

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [pickQuery, setPickQuery] = useState("");

  const curated = getPlaylist(id);
  const userPlaylist = userPlaylists.find((playlist) => playlist.id === id);
  const playlist: UserPlaylist | null = !curated && userPlaylist ? userPlaylist : null;
  const trackIds = curated?.trackIds ?? playlist?.trackIds ?? [];
  const playlistTracks = getTracks(trackIds);
  const totalDuration = playlistTracks.reduce((total, track) => total + track.duration, 0);
  const title = curated?.title ?? playlist?.title ?? "Playlist";
  const description =
    curated?.description ??
    playlist?.description ??
    "A playlist from your library.";
  const artwork =
    curated?.artwork ??
    playlist?.artwork ??
    playlistTracks[0]?.artwork ??
    "/art/playlists/user-01.svg";

  const pickable = useMemo(() => {
    const query = pickQuery.trim().toLowerCase();
    return tracks
      .filter((track) => {
        if (!query) return true;
        const artist = getArtist(track.artistId)?.name ?? "";
        return `${track.title} ${artist}`.toLowerCase().includes(query);
      })
      .slice(0, 40);
  }, [pickQuery]);

  const related = playlists
    .filter((item) => item.id !== curated?.id)
    .filter((item) =>
      curated ? item.genreIds.some((genreId) => curated.genreIds.includes(genreId)) : true,
    )
    .slice(0, 4);

  if (!curated && !playlist) {
    return (
      <div className="page-container">
        <Link
          href="/library"
          className="mb-5 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Your library
        </Link>
        <EmptyState
          icon={<ListMusic className="h-5 w-5" />}
          title="Playlist not found"
          description="This playlist may have been deleted, or the link may be wrong. Your other playlists are waiting in the library."
          action={
            <Link
              href="/library"
              className="rounded-full bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground transition hover:bg-secondary"
            >
              Back to library
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      <Link
        href={curated ? "/explore" : "/library"}
        className="mb-5 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {curated ? "Explore" : "Your library"}
      </Link>

      <CollectionHero
        eyebrow={curated ? "Curated playlist" : "Your playlist"}
        title={title}
        description={description || "A private collection, made by you."}
        image={artwork}
        alt={`${title} playlist cover`}
        accent={curated?.accent}
        meta={
          <>
            <span>{curated?.curator ?? "Made by you"}</span>
            <span className="text-muted-foreground/35">·</span>
            <span>
              {playlistTracks.length} {playlistTracks.length === 1 ? "song" : "songs"}
            </span>
            <span className="text-muted-foreground/35">·</span>
            <span>{formatTotalDuration(totalDuration)}</span>
          </>
        }
        actions={
          <>
            <CollectionPlayButton trackIds={trackIds} label={title} />
            <CollectionShuffleButton trackIds={trackIds} label={title} />
            {playlist && (
              <button
                type="button"
                onClick={() => {
                  setPickQuery("");
                  setAddOpen(true);
                }}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/[.1] bg-white/[.025] px-5 text-sm font-medium text-foreground transition hover:border-white/[.18] hover:bg-white/[.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Plus className="h-4 w-4" />
                Add songs
              </button>
            )}
            {playlist && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Playlist options"
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/[.1] bg-white/[.025] text-muted-foreground transition hover:border-white/[.18] hover:bg-white/[.055] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[200px]">
                  <DropdownMenuItem
                    onSelect={() => {
                      setDraftTitle(playlist.title);
                      setDraftDescription(playlist.description);
                      setRenameOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit playlist
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      addTracksToPlaylist(playlist.id, trackIds);
                    }}
                    disabled
                  >
                    <Check className="h-3.5 w-3.5" />
                    All songs included
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete playlist
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      <div className="mt-9 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-medium tracking-[-0.025em]">
              {playlistTracks.length > 0 ? "Songs" : "No songs yet"}
            </h2>
            {playlist && trackIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPickQuery("");
                  setAddOpen(true);
                }}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Add songs
              </button>
            )}
          </div>

          {playlistTracks.length === 0 ? (
            <EmptyState
              icon={<ListMusic className="h-5 w-5" />}
              title="This playlist is waiting"
              description="Add a few songs and start shaping the sequence. You can add music from any track menu or right here."
              action={
                playlist ? (
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground transition hover:bg-secondary"
                  >
                    <Plus className="h-4 w-4" />
                    Add songs
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="rounded-xl border border-white/[.045] bg-white/[.012] px-2 py-3 sm:px-3">
              <TrackList
                trackIds={trackIds}
                label={title}
                showAlbum
                onRemove={
                  playlist
                    ? (trackId) => {
                        removeTrackFromPlaylist(playlist.id, trackId);
                        toast.show("Removed from playlist", title, "info");
                      }
                    : undefined
                }
                removeLabel="Remove from playlist"
              />
            </div>
          )}

          {curated && (
            <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground/50">
              Curated by {curated.curator}. All tracks are original Sangeet demo recordings.
            </p>
          )}
        </section>

        <aside className="space-y-5">
          <div className="rounded-xl border border-white/[.055] bg-white/[.018] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">Playlist</p>
              <Shuffle className="h-3.5 w-3.5 text-muted-foreground/50" />
            </div>
            <p className="mt-3 text-[12.5px] leading-[1.7] text-muted-foreground">
              {curated
                ? "A sequence designed to be heard in order. Let it run, or take it apart and follow a thread."
                : "A private collection in your local library. Changes are saved automatically in this browser."}
            </p>
            <div className="mt-5 space-y-2.5 border-t border-white/[.06] pt-4 text-[11px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Songs</span>
                <span className="tabular-nums">{playlistTracks.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Runtime</span>
                <span>{formatTotalDuration(totalDuration)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Owner</span>
                <span>{curated?.curator ?? "You"}</span>
              </div>
            </div>
          </div>

          {playlistTracks.length > 0 && (
            <div className="rounded-xl border border-white/[.055] bg-surface/70 p-5">
              <p className="eyebrow mb-3">Starts with</p>
              <div className="flex items-center gap-3">
                <Artwork
                  src={playlistTracks[0].artwork}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-md"
                />
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium">{playlistTracks[0].title}</p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {getArtist(playlistTracks[0].artistId)?.name}
                  </p>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground/55">
                {playlistTracks[0].mood}
              </p>
            </div>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="section-space pb-2">
          <SectionHeader
            title={curated ? "In a similar key" : "More to explore"}
            eyebrow="Keep listening"
            href="/explore"
            linkLabel="All playlists"
          />
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((item) => (
              <PlaylistCard key={item.id} playlist={item} hideDescription />
            ))}
          </div>
        </section>
      )}

      <Dialog
        open={renameOpen}
        onOpenChange={(next) => {
          if (!next) setRenameOpen(false);
        }}
      >
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit playlist</DialogTitle>
            <DialogDescription>Give this collection a new name or description.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!playlist) return;
              renamePlaylist(playlist.id, draftTitle, draftDescription);
              setRenameOpen(false);
              toast.success("Playlist updated", "Your changes have been saved.");
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="mb-2 block text-xs font-medium">Playlist name</span>
              <Input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                maxLength={80}
                autoFocus
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <textarea
                value={draftDescription}
                onChange={(event) => setDraftDescription(event.target.value)}
                maxLength={240}
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-surface/80 px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/65 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setRenameOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-border px-5 text-sm text-foreground transition hover:border-white/20 hover:bg-white/[.04]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-secondary"
              >
                Save changes
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addOpen}
        onOpenChange={(next) => {
          if (!next) setAddOpen(false);
        }}
      >
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Add songs</DialogTitle>
            <DialogDescription>
              Search the catalogue and add tracks to “{title}”.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={pickQuery}
              onChange={(event) => setPickQuery(event.target.value)}
              placeholder="Search tracks or artists…"
              className="pl-10"
              autoFocus
            />
          </div>
          <div className="-mx-2 mt-4 max-h-[360px] space-y-0.5 overflow-y-auto px-2">
            {pickable.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Nothing matched that search.
              </p>
            ) : (
              pickable.map((track) => {
                const included = Boolean(playlist?.trackIds.includes(track.id));
                return (
                  <button
                    key={track.id}
                    type="button"
                    disabled={included}
                    onClick={() => {
                      if (!playlist) return;
                      const added = addTracksToPlaylist(playlist.id, [track.id]);
                      if (added > 0) {
                        toast.success("Added to playlist", `${track.title} · ${title}`);
                      }
                    }}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-white/[.045] disabled:cursor-default disabled:opacity-55"
                  >
                    <Artwork src={track.artwork} alt="" className="h-10 w-10 shrink-0 rounded-md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium">{track.title}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                        {getArtist(track.artistId)?.name}
                      </span>
                    </span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[.08] text-muted-foreground">
                      {included ? <Check className="h-3.5 w-3.5 text-primary" /> : <Plus className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="mt-4 flex justify-end border-t border-white/[.06] pt-4">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="inline-flex h-10 items-center justify-center rounded-full bg-elevated px-5 text-sm font-medium text-foreground transition hover:bg-[#2a2a35]"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the playlist from your library. The songs themselves will stay in the
              Sangeet catalogue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep playlist</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!playlist) return;
                deletePlaylist(playlist.id);
                toast.show("Playlist deleted", title, "info");
                router.push("/library");
              }}
            >
              Delete playlist
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
