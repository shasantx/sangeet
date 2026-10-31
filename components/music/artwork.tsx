"use client";

import * as React from "react";
import { AudioLines } from "lucide-react";
import { cn, hashString } from "@/lib/utils";

interface ArtworkProps {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  children?: React.ReactNode;
}

const fallbackPalettes = [
  ["#302438", "#191521", "#A883EF"],
  ["#1D2C31", "#10181B", "#7BA9A4"],
  ["#35241E", "#1A1310", "#CB9471"],
  ["#1A2438", "#101520", "#8398D6"],
  ["#322832", "#181318", "#C99ABD"],
];

export function Artwork({
  src,
  alt,
  className,
  imgClassName,
  priority = false,
  children,
}: ArtworkProps) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  const palette = fallbackPalettes[hashString(alt) % fallbackPalettes.length];

  return (
    <div className={cn("relative isolate overflow-hidden bg-elevated", className)}>
      {src && !failed ? (
        // Local SVG artwork is intentionally rendered with a plain img to support graceful fallbacks.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className={cn("h-full w-full object-cover", imgClassName)}
          draggable={false}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            background: `radial-gradient(circle at 30% 20%, ${palette[2]}33, transparent 55%), linear-gradient(145deg, ${palette[0]}, ${palette[1]})`,
          }}
          role="img"
          aria-label={`${alt} — artwork fallback`}
        >
          <AudioLines className="h-1/4 w-1/4 opacity-30" strokeWidth={1.2} />
        </div>
      )}
      {children}
    </div>
  );
}
