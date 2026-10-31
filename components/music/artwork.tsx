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
  ["#633F77", "#20182C", "#D59AFF"],
  ["#17615C", "#102A2C", "#7FE6CC"],
  ["#865036", "#301C22", "#FFC28F"],
  ["#31528C", "#172440", "#A3C3FF"],
  ["#803D6E", "#311D3C", "#FFABD8"],
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
          <span className="absolute h-[72%] aspect-square rounded-full border border-white/15" />
          <span className="absolute h-[52%] aspect-square rounded-full border border-white/20" />
          <AudioLines className="relative h-[28%] w-[28%] text-white/75" strokeWidth={1.4} />
        </div>
      )}
      {children}
    </div>
  );
}
