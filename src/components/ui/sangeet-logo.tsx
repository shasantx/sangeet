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
      src="/brand/sangeet-logo.png?v=2"
      alt={alt}
      draggable={false}
      className={cn(
        "shrink-0 select-none rounded-[23%] object-cover",
        className
      )}
    />
  );
}
