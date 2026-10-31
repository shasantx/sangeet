"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLibraryStore } from "@/store/library-store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface LikeButtonProps {
  trackId: string;
  className?: string;
  iconClassName?: string;
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
}

export function LikeButton({
  trackId,
  className,
  iconClassName,
  showTooltip = true,
  size = "md",
}: LikeButtonProps) {
  const liked = useLibraryStore((state) => state.likedTrackIds.includes(trackId));
  const toggleLike = useLibraryStore((state) => state.toggleLike);
  const sizeClasses = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const iconSize = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-5 w-5" : "h-[18px] w-[18px]";

  const button = (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        toggleLike(trackId);
      }}
      aria-label={liked ? "Remove from Liked Songs" : "Add to Liked Songs"}
      aria-pressed={liked}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        liked && "text-[#1ED760] hover:text-[#46E982]",
        sizeClasses,
        className,
      )}
    >
      <Heart
        className={cn(iconSize, "transition-transform duration-200", liked && "scale-105 fill-current", iconClassName)}
        strokeWidth={1.8}
      />
    </button>
  );

  if (!showTooltip) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{liked ? "Remove from Liked Songs" : "Save to Liked Songs"}</TooltipContent>
    </Tooltip>
  );
}
