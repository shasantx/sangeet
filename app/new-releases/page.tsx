"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Disc3 } from "lucide-react";
import { albums, getArtist } from "@/lib/catalog";
import { formatDate } from "@/lib/utils";
import { Artwork } from "@/components/music/artwork";
import { AlbumCard } from "@/components/music/album-card";
import { CollectionPlayButton } from "@/components/music/collection-actions";
import { EmptyState } from "@/components/music/empty-state";
import { SectionHeader } from "@/components/music/section-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ReleaseFilter = "all" | "Album" | "EP" | "Single";

const sorted = [...albums].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
const latest = sorted[0];

export default function NewReleasesPage() {
  const [filter, setFilter] = useState<ReleaseFilter>("all");

  const releases = useMemo(
    () => (filter === "all" ? sorted : sorted.filter((album) => album.type === filter)),
    [filter],
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof sorted>();
    for (const album of releases) {
      const month = new Date(`${album.releaseDate}T12:00:00`).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      groups.set(month, [...(groups.get(month) ?? []), album]);
    }
    return Array.from(groups.entries());
  }, [releases]);

  return (
    <div className="page-container">
      <div className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow mb-3">Fresh from the studio</p>
          <h1 className="text-[38px] font-medium leading-none tracking-[-0.05em] sm:text-[52px]">
            New releases
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            New records, EPs and singles from across the Sangeet catalogue. Everything is available to
            play right here.
          </p>
        </div>
        <Tabs value={filter} onValueChange={(value) => setFilter(value as ReleaseFilter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="Album">Albums</TabsTrigger>
            <TabsTrigger value="EP">EPs</TabsTrigger>
            <TabsTrigger value="Single">Singles</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {latest && filter === "all" && (
        <section className="relative isolate overflow-hidden rounded-2xl border border-white/[.06] bg-surface">
          <Artwork
            src={latest.artwork}
            alt=""
            className="absolute inset-0 -z-20 h-full w-full rounded-none opacity-25 blur-2xl"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0d0c11] via-[#121017]/92 to-[#121017]/55" />
          <div className="grid gap-7 p-6 sm:p-9 lg:grid-cols-[260px_1fr] lg:items-center lg:p-10">
            <Link
              href={`/album/${latest.id}`}
              className="mx-auto block w-[min(68vw,230px)] lg:mx-0"
            >
              <Artwork
                src={latest.artwork}
                alt={`${latest.title} album artwork`}
                className="aspect-square w-full rounded-xl shadow-[0_30px_70px_-24px_rgba(0,0,0,.95)] transition-transform duration-500 hover:scale-[1.015]"
                priority
              />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/45">
                <CalendarDays className="h-3.5 w-3.5" />
                Out now · {formatDate(latest.releaseDate)}
              </div>
              <h2 className="mt-4 font-display text-[36px] font-medium leading-none tracking-[-0.05em] text-white sm:text-[46px]">
                {latest.title}
              </h2>
              <Link
                href={`/artist/${latest.artistId}`}
                className="mt-3 inline-block font-display text-xl text-white/70 transition hover:text-white hover:underline"
              >
                {getArtist(latest.artistId)?.name}
              </Link>
              <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-white/50">
                {latest.description}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <CollectionPlayButton
                  trackIds={latest.trackIds}
                  label={latest.title}
                  className="bg-[#F0E9E4] text-[#171418] hover:bg-white hover:text-[#171418]"
                />
                <Link
                  href={`/album/${latest.id}`}
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 px-6 text-sm font-medium text-white/80 transition hover:border-white/30 hover:bg-white/[.06] hover:text-white"
                >
                  View release
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="mt-10 flex items-center justify-between border-b border-white/[.055] pb-3">
        <p className="text-xs text-muted-foreground">
          {releases.length} {releases.length === 1 ? "release" : "releases"}
          {filter !== "all" ? ` · ${filter === "EP" ? "EPs" : `${filter}s`}` : ""}
        </p>
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/50">
          Newest first
        </p>
      </div>

      {releases.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Disc3 className="h-5 w-5" />}
            title="Nothing here yet"
            description="There are no releases of this type in the current catalogue. Try another filter."
            action={
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="rounded-full bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground transition hover:bg-secondary"
              >
                Show all releases
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-9 space-y-12">
          {grouped.map(([month, monthReleases]) => (
            <section key={month}>
              <div className="mb-5 flex items-center gap-3">
                <h2 className="text-lg font-medium tracking-[-0.025em]">{month}</h2>
                <span className="h-px flex-1 bg-white/[.055]" />
                <span className="text-[10px] tabular-nums text-muted-foreground/55">
                  {monthReleases.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
                {monthReleases.map((album) => (
                  <AlbumCard key={album.id} album={album} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="section-space pb-2">
        <SectionHeader
          title="Looking for something older?"
          eyebrow="The full catalogue"
          href="/explore"
          linkLabel="Explore Sangeet"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {["Jazz after dark", "Ambient for focus", "Modern soul"].map((label, index) => {
            const pick = [
              { href: "/genre/jazz", copy: "Piano, space and late-night clarity.", accent: "#71A39B" },
              { href: "/genre/ambient", copy: "Wide-open sound for a quieter room.", accent: "#7C83FD" },
              { href: "/genre/soul", copy: "Warm voices and unhurried arrangements.", accent: "#D3A26B" },
            ][index];
            return (
              <Link
                key={label}
                href={pick.href}
                className="group flex items-center justify-between gap-4 rounded-xl border border-white/[.055] bg-white/[.018] p-5 transition hover:border-white/[.12] hover:bg-white/[.035]"
              >
                <span>
                  <span className="block font-display text-xl font-medium tracking-[-0.03em]">{label}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">{pick.copy}</span>
                </span>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[.08] transition group-hover:border-white/20"
                  style={{ color: pick.accent }}
                >
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
