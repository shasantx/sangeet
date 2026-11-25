"use client";

import { cn } from "@/lib/utils";

interface SangeetLogoProps {
  className?: string;
  alt?: string;
}

/**
 * Official Sangeet Cobalt Glass App Logo.
 */
export function SangeetLogo({
  className = "h-8 w-8",
  alt = "Sangeet"
}: SangeetLogoProps) {
  return (
    <img
      src="/brand/sangeet-logo.png"
      alt={alt}
      draggable={false}
      className={cn(
        "shrink-0 select-none rounded-[22%] object-cover",
        className
      )}
    />
  );
}
