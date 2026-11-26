"use client";

import { useEffect, useState } from "react";
import { Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrackArtworkProps {
  src?: string | null;
  trackId?: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  iconClassName?: string;
  loading?: "lazy" | "eager";
}

const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Resilient album/track artwork image that gracefully cascades through
 * fallback YouTube resolutions and ends on a flat placeholder tile
 * so broken image icons or overflowing alt text NEVER appear.
 */
export function TrackArtwork({
  src,
  trackId,
  alt,
  className,
  imgClassName,
  iconClassName,
  loading = "lazy"
}: TrackArtworkProps) {
  const candidates: string[] = [];
  if (src && src.trim() && !src.startsWith("data:image/svg")) {
    candidates.push(src.trim());
  }
  if (trackId && YT_ID_RE.test(trackId)) {
    const hq = `https://i.ytimg.com/vi/${trackId}/hqdefault.jpg`;
    const mq = `https://i.ytimg.com/vi/${trackId}/mqdefault.jpg`;
    if (!candidates.includes(hq)) candidates.push(hq);
    if (!candidates.includes(mq)) candidates.push(mq);
  }

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [src, trackId]);

  const activeSrc = candidates[attempt];

  if (!activeSrc) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "flex h-full w-full items-center justify-center bg-encore-highlight text-encore-muted",
          className
        )}
      >
        <Music2
          className={cn("h-5 w-5 opacity-75", iconClassName)}
          strokeWidth={1.6}
        />
      </div>
    );
  }

  return (
    <img
      src={activeSrc}
      alt={alt}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={() => setAttempt((prev) => prev + 1)}
      className={cn("h-full w-full object-cover", className, imgClassName)}
    />
  );
}
