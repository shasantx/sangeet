"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import type { Album } from "@/lib/types";
import { getArtist } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { useLibraryStore } from "@/store/library-store";
import { toast } from "@/store/ui-store";

export function SaveAlbumButton({ album, className }: { album: Album; className?: string }) {
  const saved = useLibraryStore((state) => state.savedAlbumIds.includes(album.id));
  const toggleSave = useLibraryStore((state) => state.toggleSaveAlbum);
  const artist = getArtist(album.artistId);

  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => {
        const next = toggleSave(album.id);
        toast.show(
          next ? "Saved to library" : "Removed from library",
          `${album.title} · ${artist?.name ?? "Sangeet"}`,
          next ? "success" : "default",
        );
      }}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/[.1] bg-white/[.025] px-5 text-sm font-medium text-foreground transition hover:border-white/[.18] hover:bg-white/[.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        saved && "border-primary/30 bg-primary/[.08] text-primary hover:border-primary/40 hover:bg-primary/[.12]",
        className,
      )}
    >
      {saved ? <BookmarkCheck className="h-4 w-4 fill-current" /> : <Bookmark className="h-4 w-4" />}
      {saved ? "Saved" : "Save"}
    </button>
  );
}
