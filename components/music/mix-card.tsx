"use client";

import Link from "next/link";
import { AudioLines } from "lucide-react";
import type { DailyMix } from "@/lib/mixes";
import { cn } from "@/lib/utils";
import { Artwork } from "./artwork";
import { PlayButton } from "./play-button";

export function MixCard({ mix, featured = false }: { mix: DailyMix; featured?: boolean }) {
  if (featured) {
    return (
      <article className="group relative min-h-[268px] overflow-hidden rounded-xl border border-white/[.06] bg-surface p-5 sm:p-6 lg:min-h-[310px]">
        <div className="absolute inset-0 grid grid-cols-2 opacity-35 transition-opacity duration-500 group-hover:opacity-45 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Artwork
              key={index}
              src={mix.covers[index % Math.max(1, mix.covers.length)]}
              alt=""
              className="h-full w-full rounded-none"
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d12] via-[#0d0d12]/82 to-[#0d0d12]/10" />
        <div
          className="absolute -left-20 top-0 h-64 w-64 rounded-full opacity-20 blur-[90px]"
          style={{ background: mix.accent }}
        />
        <div className="relative flex h-full min-h-[228px] flex-col justify-end lg:min-h-[262px]">
          <div className="mb-auto flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70 backdrop-blur">
              Curated selection
            </span>
            <AudioLines className="h-3.5 w-3.5 text-white/40" />
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-display text-[30px] font-medium leading-none tracking-[-0.04em] text-white lg:text-[36px]">
                {mix.title}
              </h3>
              <p className="mt-2 text-[13px] text-white/65">{mix.subtitle}</p>
              <p className="mt-2 max-w-[360px] text-[11px] leading-relaxed text-white/40">
                {mix.description}
              </p>
            </div>
            <PlayButton trackIds={mix.trackIds} label={mix.title} size="lg" className="mb-1" />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/[.055] bg-surface/80 transition-colors duration-300 hover:border-white/[.1]">
      <div className="relative grid aspect-[1.6/1] grid-cols-2 overflow-hidden">
        {[0, 1, 2, 3].map((index) => (
          <Artwork
            key={index}
            src={mix.covers[index % Math.max(1, mix.covers.length)]}
            alt=""
            className="h-full w-full rounded-none transition-transform duration-500 group-hover:scale-[1.025]"
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.15em] text-white/70 backdrop-blur">
          Sangeet mix
        </span>
        <PlayButton
          trackIds={mix.trackIds}
          label={mix.title}
          size="sm"
          className="absolute bottom-3 right-3 translate-y-1 opacity-100 transition-all duration-300 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100"
        />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/playlist/${mix.playlistId}`}
            className="line-clamp-1 font-display text-lg font-medium tracking-[-0.03em] transition hover:underline"
          >
            {mix.title}
          </Link>
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: mix.accent }}
            aria-hidden="true"
          />
        </div>
        <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{mix.subtitle}</p>
      </div>
    </article>
  );
}
