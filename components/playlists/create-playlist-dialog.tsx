"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ListMusic, Plus } from "lucide-react";
import { getTrack } from "@/lib/catalog";
import { useLibraryStore } from "@/store/library-store";
import { useUIStore, toast } from "@/store/ui-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function CreatePlaylistDialog() {
  const open = useUIStore((state) => state.createPlaylistOpen);
  const seedTrackId = useUIStore((state) => state.createPlaylistSeedTrackId);
  const close = useUIStore((state) => state.closeCreatePlaylist);
  const createPlaylist = useLibraryStore((state) => state.createPlaylist);
  const addTrackToPlaylist = useLibraryStore((state) => state.addTrackToPlaylist);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const seedTrack = seedTrackId ? getTrack(seedTrackId) : undefined;

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setError("");
    }
  }, [open]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError("Give your playlist a name.");
      return;
    }
    const id = createPlaylist(title, description);
    if (seedTrackId) {
      addTrackToPlaylist(id, seedTrackId);
    }
    close();
    toast.success(
      "Playlist created",
      seedTrack ? `“${title.trim()}” now includes ${seedTrack.title}.` : `“${title.trim()}” is ready for music.`,
    );
    router.push(`/playlist/${id}`);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent className="max-w-[480px]">
        <form onSubmit={submit}>
          <DialogHeader>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <ListMusic className="h-5 w-5" />
            </div>
            <DialogTitle>Create a playlist</DialogTitle>
            <DialogDescription>
              A private space for the songs you want to keep close. You can rename it any time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface/60 px-3.5 py-3 text-[11px] text-muted-foreground">
              <span>Free and open. Create as many playlists as you like.</span>
            </div>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-foreground">Playlist name</span>
              <Input
                autoFocus
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setError("");
                }}
                maxLength={80}
                placeholder="e.g. Late Night, Softly"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "playlist-title-error" : undefined}
              />
              {error && (
                <span id="playlist-title-error" className="mt-1.5 block text-[11px] text-[#EF8B92]">
                  {error}
                </span>
              )}
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-foreground">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={240}
                rows={3}
                placeholder="What does this playlist feel like?"
                className="w-full resize-none rounded-xl border border-border bg-surface/80 px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/65 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
              <span className="mt-1 block text-right text-[10px] tabular-nums text-muted-foreground/55">
                {description.length}/240
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit">
              <Plus className="h-4 w-4" />
              Create playlist
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
