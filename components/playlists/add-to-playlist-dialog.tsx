"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { getTrack } from "@/lib/catalog";
import { useLibraryStore } from "@/store/library-store";
import { useUIStore, toast } from "@/store/ui-store";
import { Artwork } from "@/components/music/artwork";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AddToPlaylistDialog() {
  const trackId = useUIStore((state) => state.addToPlaylistTrackId);
  const close = useUIStore((state) => state.closeAddToPlaylist);
  const openCreate = useUIStore((state) => state.openCreatePlaylist);
  const playlists = useLibraryStore((state) => state.playlists);
  const addTrackToPlaylist = useLibraryStore((state) => state.addTrackToPlaylist);
  const [added, setAdded] = useState<string[]>([]);
  const track = trackId ? getTrack(trackId) : undefined;

  const handleAdd = (playlistId: string, playlistTitle: string) => {
    if (!trackId) return;
    const success = addTrackToPlaylist(playlistId, trackId);
    if (success) {
      setAdded((current) => [...current, playlistId]);
      toast.success("Added to playlist", `${track?.title ?? "Track"} was added to “${playlistTitle}”.`);
    }
  };

  return (
    <Dialog
      open={Boolean(trackId)}
      onOpenChange={(next) => {
        if (!next) {
          setAdded([]);
          close();
        }
      }}
    >
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add to playlist</DialogTitle>
          <DialogDescription>
            Choose a playlist for “{track?.title ?? "this track"}”.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-2 max-h-[340px] space-y-1 overflow-y-auto px-2">
          {playlists.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/[.09] px-5 py-8 text-center">
              <p className="text-sm font-medium">No playlists yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create one and this track will be the first song in it.
              </p>
            </div>
          ) : (
            playlists.map((playlist) => {
              const alreadyIncluded = Boolean(trackId && playlist.trackIds.includes(trackId));
              const wasAdded = added.includes(playlist.id) || alreadyIncluded;
              return (
                <button
                  key={playlist.id}
                  type="button"
                  disabled={wasAdded}
                  onClick={() => handleAdd(playlist.id, playlist.title)}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-white/[.05] disabled:cursor-default"
                >
                  <Artwork
                    src={playlist.artwork}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{playlist.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {playlist.trackIds.length} {playlist.trackIds.length === 1 ? "song" : "songs"}
                    </p>
                  </div>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[.08] text-muted-foreground">
                    {wasAdded ? <Check className="h-3.5 w-3.5 text-primary" /> : <Plus className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 border-t border-white/[.06] pt-4 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={close}>
            <X className="h-4 w-4" />
            Done
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const seed = trackId;
              close();
              if (seed) openCreate(seed);
            }}
          >
            <Plus className="h-4 w-4" />
            New playlist
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
