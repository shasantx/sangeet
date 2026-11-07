"use client";

import * as React from "react";
import { AudioLines } from "lucide-react";
import { cn, hashString } from "@/lib/utils";
import { toHighResArtwork } from "@/lib/artwork";

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
  const [currentSrc, setCurrentSrc] = React.useState<string>(() => toHighResArtwork(src));
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setCurrentSrc(toHighResArtwork(src));
    setFailed(false);
  }, [src]);

  const handleError = () => {
    // If maxres failed on ytimg, try sddefault or hqdefault fallback
    if (currentSrc.includes("maxresdefault.jpg")) {
      setCurrentSrc(currentSrc.replace("maxresdefault.jpg", "sddefault.jpg"));
      return;
    }
    if (currentSrc.includes("sddefault.jpg")) {
      setCurrentSrc(currentSrc.replace("sddefault.jpg", "hqdefault.jpg"));
      return;
    }
    // If upgraded googleusercontent failed, try original src
    if (src && currentSrc !== src) {
      setCurrentSrc(src);
      return;
    }
    setFailed(true);
  };

  const palette = fallbackPalettes[hashString(alt) % fallbackPalettes.length];

  return (
    <div className={cn("relative isolate overflow-hidden bg-elevated", className)}>
      {currentSrc && !failed ? (
        // Plain img for high-res CDN flexibility and seamless fallback chain
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentSrc}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={handleError}
          className={cn("h-full w-full object-cover transition-opacity duration-300", imgClassName)}
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
