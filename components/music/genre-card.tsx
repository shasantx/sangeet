import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Genre } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Artwork } from "./artwork";

interface GenreCardProps {
  genre: Genre;
  className?: string;
  size?: "default" | "large";
}

export function GenreCard({ genre, className, size = "default" }: GenreCardProps) {
  return (
    <Link
      href={`/genre/${genre.id}`}
      className={cn(
        "group relative isolate flex overflow-hidden rounded-xl border border-white/[.045] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        size === "default"
          ? "aspect-[1.42/1] min-h-[86px] sm:min-h-[112px]"
          : "aspect-[2/1] min-h-[120px] sm:min-h-[160px]",
        className,
      )}
    >
      <Artwork
        src={genre.image}
        alt=""
        className="absolute inset-0 -z-10 h-full w-full rounded-none opacity-75 transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-tr from-black/75 via-black/25 to-transparent" />
      <div className="flex w-full flex-col justify-between p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="eyebrow text-white/50">Genre</span>
          <span className="flex h-7 w-7 translate-y-[-3px] items-center justify-center rounded-full border border-white/10 bg-black/20 text-white opacity-0 backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
        <div>
          <h3
            className={cn(
              "font-display font-medium tracking-[-0.03em] text-white",
              size === "default" ? "text-[22px]" : "text-3xl sm:text-[34px]",
            )}
          >
            {genre.name}
          </h3>
          {size === "large" && (
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-white/55">{genre.description}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
