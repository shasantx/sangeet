"use client";

import * as React from "react";
import { AudioLines } from "lucide-react";
import { cn, hashString } from "@/lib/utils";
import { toHighResArtwork, toMediumResArtwork } from "@/lib/artwork";

export type ArtworkResolution = "sm" | "md" | "lg";

interface ArtworkProps {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  res?: ArtworkResolution;
  children?: React.ReactNode;
}

// Remember URLs that 404ed so we never re-request them across navigations.
const failedUrls = new Set<string>();

const fallbackPalettes = [
  ["#633F77", "#20182C", "#D59AFF"],
  ["#17615C", "#102A2C", "#7FE6CC"],
  ["#865036", "#301C22", "#FFC28F"],
  ["#31528C", "#172440", "#A3C3FF"],
  ["#803D6E", "#311D3C", "#FFABD8"],
];

function getInitialCandidate(src: string | null | undefined, res: ArtworkResolution): string {
  const preferred = res === "lg" ? toHighResArtwork(src) : toMediumResArtwork(src);
  if (!preferred) return "";

  const candidates: string[] = [preferred];
  if (preferred.includes("maxresdefault.jpg")) {
    candidates.push(preferred.replace("maxresdefault.jpg", "sddefault.jpg"));
    candidates.push(preferred.replace("maxresdefault.jpg", "hqdefault.jpg"));
  } else if (preferred.includes("sddefault.jpg")) {
    candidates.push(preferred.replace("sddefault.jpg", "hqdefault.jpg"));
  }
  if (src && src !== preferred && !src.includes("maxresdefault.jpg")) {
    const safeOrig = toMediumResArtwork(src);
    if (safeOrig && !candidates.includes(safeOrig)) {
      candidates.push(safeOrig);
    }
  }

  for (const candidate of candidates) {
    if (!failedUrls.has(candidate)) return candidate;
  }
  return "";
}

export const Artwork = React.memo(function Artwork({
  src,
  alt,
  className,
  imgClassName,
  priority = false,
  res = "md",
  children,
}: ArtworkProps) {
  const resolvedInitial = React.useMemo(() => getInitialCandidate(src, res), [src, res]);
  const [currentSrc, setCurrentSrc] = React.useState<string>(resolvedInitial);
  const [failed, setFailed] = React.useState<boolean>(() => !resolvedInitial);

  React.useEffect(() => {
    setCurrentSrc(resolvedInitial);
    setFailed(!resolvedInitial);
  }, [resolvedInitial]);

  const handleError = () => {
    if (currentSrc) {
      failedUrls.add(currentSrc);
    }

    // Try YouTube thumbnail downgrade chain (maxres -> sd -> hq), skipping known 404s.
    if (currentSrc.includes("maxresdefault.jpg")) {
      const sd = currentSrc.replace("maxresdefault.jpg", "sddefault.jpg");
      if (!failedUrls.has(sd)) {
        setCurrentSrc(sd);
        return;
      }
      const hq = currentSrc.replace("maxresdefault.jpg", "hqdefault.jpg");
      if (!failedUrls.has(hq)) {
        setCurrentSrc(hq);
        return;
      }
    }
    if (currentSrc.includes("sddefault.jpg")) {
      const hq = currentSrc.replace("sddefault.jpg", "hqdefault.jpg");
      if (!failedUrls.has(hq)) {
        setCurrentSrc(hq);
        return;
      }
    }
    // If upgraded googleusercontent/CDN URL failed, try sanitized original src.
    if (src) {
      const fallback = res === "lg" ? toMediumResArtwork(src) : src;
      if (
        fallback &&
        fallback !== currentSrc &&
        !fallback.includes("maxresdefault.jpg") &&
        !failedUrls.has(fallback)
      ) {
        setCurrentSrc(fallback);
        return;
      }
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
});
