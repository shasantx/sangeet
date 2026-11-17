"use client";

import { Check, UserPlus } from "lucide-react";
import type { Artist } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLibraryStore } from "@/store/library-store";
import { toast } from "@/store/ui-store";

export function FollowArtistButton({
  artist,
  className,
  compact = false,
}: {
  artist: Artist;
  className?: string;
  compact?: boolean;
}) {
  const followed = useLibraryStore((state) => state.followedArtistIds.includes(artist.id));
  const toggleFollow = useLibraryStore((state) => state.toggleFollowArtist);

  return (
    <button
      type="button"
      aria-pressed={followed}
      onClick={() => {
        const next = toggleFollow(artist.id);
        toast.show(
          next ? "Following artist" : "Unfollowed artist",
          artist.name,
          next ? "success" : "default",
        );
      }}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/[.1] bg-white/[.025] px-5 text-sm font-medium text-foreground transition hover:border-white/[.18] hover:bg-white/[.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        followed && "border-primary/30 bg-primary/[.08] text-primary hover:border-primary/40 hover:bg-primary/[.12]",
        compact && "h-9 px-4 text-xs",
        className,
      )}
    >
      {followed ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
      {followed ? "Following" : "Follow"}
    </button>
  );
}
