"use client";

import { cn } from "@/lib/utils";

interface SangeetLogoProps {
  className?: string;
  alt?: string;
}

/**
 * Dhun app mark (a lowercase "d" whose bowl is a record). Component name kept for existing imports.
 */
export function SangeetLogo({
  className = "h-8 w-8",
  alt = "Dhun"
}: SangeetLogoProps) {
  return (
    <img
      src="/brand/sangeet-logo.png?v=3"
      alt={alt}
      draggable={false}
      className={cn(
        "shrink-0 select-none rounded-[23%] object-cover",
        className
      )}
    />
  );
}
