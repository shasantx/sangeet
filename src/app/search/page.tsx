"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Pause, Play } from "lucide-react";
import type { SearchResult, Track } from "@/types/music";
import { TrackRow } from "@/components/music/track-row";
import { MediaShelf } from "@/components/music/media-shelf";
import { usePlayerStore } from "@/store/player-store";
import { useOfflineStore } from "@/store/offline-store";
import { useToastStore } from "@/store/toast-store";
import { cn } from "@/lib/utils";

const BROWSE_CATEGORIES = [
  { label: "Pop", query: "top pop hits", color: "#c41e2e" },
  { label: "Hindi", query: "Arijit Singh latest hindi hits", color: "#e11d48" },
  { label: "Nepali", query: "Sajjan Raj Vaidya nepali songs", color: "#6e0b17" },
  { label: "Hip-Hop", query: "hip hop rap hits", color: "#c2410c" },
  { label: "Indie", query: "indie alternative songs", color: "#8f1d3b" },
  { label: "Chill", query: "chill lofi r&b songs", color: "#b7791f" },
  { label: "Workout", query: "workout gym energy music", color: "#57534e" },
  { label: "Rock", query: "classic rock anthems", color: "#9b1c1c" },
  { label: "R&B", query: "The Weeknd SZA R&B", color: "#be185d" },
  { label: "Electronic", query: "electronic dance edm hits", color: "#d4a017" },
  { label: "Lo-Fi", query: "lofi study beats", color: "#7a1f2b" },
  { label: "Punjabi", query: "Diljit Dosanjh Karan Aujla punjabi", color: "#ea580c" }
];

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = (searchParams.get("q") ?? "").trim();

  const [result, setResult] = useState<SearchResult | null>(null);
  const [openAudio, setOpenAudio] = useState<Track[]>([]);
  const [browseCovers, setBrowseCovers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const downloadPermittedTrack = useOfflineStore((s) => s.downloadPermittedTrack);
  const offlineItems = useOfflineStore((s) => s.items);
  const showToast = useToastStore((s) => s.showToast);

  useEffect(() => {
    if (query) return;
    let cancelled = false;
    fetch("/api/music/home?mood=all")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data?.shelves)) return;
        const thumbs = data.shelves
          .flatMap((s: { items?: Track[] }) => s.items ?? [])
          .map((t: Track) => t.thumbnail)
          .filter(Boolean);
        setBrowseCovers(Array.from(new Set<string>(thumbs)).slice(0, 12));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    if (!query) {
      setResult(null);
      setOpenAudio([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/music/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .catch(() => null),
      fetch(`/api/audius/search?q=${encodeURIComponent(query)}&limit=6`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    ])
      .then(([ytData, audiusData]) => {
        if (cancelled) return;
        setResult(ytData);
        setOpenAudio(
          Array.isArray(audiusData?.tracks) ? audiusData.tracks : []
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  if (!query) {
    return (
      <div className="studio-enter overflow-x-hidden p-4 pb-12 sm:p-6">
        <h1 className="mb-5 text-2xl font-semibold tracking-tight text-encore-text">
          Browse genres &amp; moods
        </h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-4">
          {BROWSE_CATEGORIES.map((cat, idx) => {
            const cover = browseCovers[idx];
            return (
              <button
                key={cat.label}
                type="button"
                onClick={() =>
                  router.push(`/search?q=${encodeURIComponent(cat.query)}`)
                }
                style={{
                  backgroundColor: `color-mix(in srgb, ${cat.color} 62%, #131211)`
                }}
                className="group relative flex h-32 flex-col justify-between overflow-hidden rounded-[14px] border border-white/15 p-4 text-left transition-all duration-200 ease-studio hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]"
              >
                <span className="relative z-10 text-lg font-semibold tracking-tight text-white">
                  {cat.label}
                </span>
                {cover ? (
                  <img
                    src={cover}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    className="pointer-events-none absolute -bottom-3 -right-3 h-20 w-20 rotate-[18deg] rounded-[10px] object-cover ring-1 ring-white/20 transition-transform duration-300 ease-studio group-hover:rotate-[12deg] group-hover:scale-105"
                  />
                ) : (
                  <div className="pointer-events-none absolute -bottom-4 -right-4 h-20 w-20 rotate-[20deg] rounded-[10px] bg-black/25" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
          <div className="h-56 animate-pulse rounded-2xl bg-encore-elevated" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-encore-elevated" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!result || result.tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <h2 className="text-xl font-bold text-encore-text">
          No results found for &ldquo;{query}&rdquo;
        </h2>
        <p className="mt-2 text-sm text-encore-subdued">
          Check your spelling or try searching for another artist, song, or album.
        </p>
      </div>
    );
  }

  const top = result.topResult;
  const isTopCurrent = top && currentTrack?.id === top.id;

  return (
    <div className="overflow-x-hidden space-y-8 p-4 pb-12 sm:p-6">
      {/* Top Result + Top Songs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        {top && (
          <section>
            <h2 className="mb-3 text-xl font-bold text-encore-text">Top result</h2>
            <div
              onClick={() =>
                isTopCurrent ? togglePlay() : playTrack(top, result.tracks)
              }
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (isTopCurrent) togglePlay();
                  else playTrack(top, result.tracks);
                }
              }}
              className="group relative flex h-[228px] cursor-pointer flex-col justify-between rounded-2xl border border-encore-hairline bg-encore-elevated p-5 transition hover:border-encore-accent/35 hover:bg-encore-elevated-highlight"
            >
              <img
                src={top.thumbnail}
                alt={top.title}
                className="h-24 w-24 rounded-xl object-cover"
              />
              <div className="pr-14">
                <h3 className="truncate text-2xl font-extrabold text-encore-text">
                  {top.title}
                </h3>
                <p className="mt-1 truncate text-sm text-encore-subdued">
                  Song • <span className="font-semibold text-encore-text">{top.artist}</span>
                </p>
              </div>
              <button
                type="button"
                aria-label="Play top result"
                className={cn(
                  "btn-cobalt absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-full transition",
                  isTopCurrent && isPlaying
                    ? "translate-y-0 opacity-100"
                    : "opacity-100 sm:translate-y-2 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100"
                )}
              >
                {isTopCurrent && isPlaying ? (
                  <Pause className="h-5 w-5 fill-current" />
                ) : (
                  <Play className="h-5 w-5 translate-x-0.5 fill-current" />
                )}
              </button>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-xl font-bold text-encore-text">Songs</h2>
          <div className="space-y-0.5">
            {result.tracks.slice(0, 4).map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                contextQueue={result.tracks}
                showAlbum={false}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Artists */}
      {result.artists.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold text-encore-text">Artists</h2>
          <MediaShelf>
            {result.artists.map((artist) => (
              <Link
                key={artist.id}
                href={`/artist/${encodeURIComponent(artist.id)}?name=${encodeURIComponent(artist.name)}`}
                className="group flex w-[158px] shrink-0 flex-col rounded-2xl border border-encore-hairline bg-encore-elevated p-3 transition hover:bg-encore-elevated-highlight sm:w-[170px]"
              >
                <img
                  src={artist.thumbnail}
                  alt={artist.name}
                  className="mb-3 aspect-square w-full rounded-full object-cover shadow-md"
                />
                <p className="truncate text-sm font-bold text-encore-text">
                  {artist.name}
                </p>
                <p className="mt-1 text-xs text-encore-subdued">Artist</p>
              </Link>
            ))}
          </MediaShelf>
        </section>
      )}

      {/* Albums */}
      {result.albums.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold text-encore-text">Albums</h2>
          <MediaShelf>
            {result.albums.map((album) => (
              <Link
                key={album.id}
                href={`/album/${encodeURIComponent(album.id)}?title=${encodeURIComponent(album.title)}`}
                className="group flex w-[158px] shrink-0 flex-col rounded-2xl border border-encore-hairline bg-encore-elevated p-3 transition hover:bg-encore-elevated-highlight sm:w-[170px]"
              >
                <img
                  src={album.thumbnail}
                  alt={album.title}
                  className="mb-3 aspect-square w-full rounded-lg object-cover shadow-md"
                />
                <p className="truncate text-sm font-bold text-encore-text">
                  {album.title}
                </p>
                <p className="mt-1 truncate text-xs text-encore-subdued">
                  {album.year ? `${album.year} • ` : ""}
                  {album.artist}
                </p>
              </Link>
            ))}
          </MediaShelf>
        </section>
      )}

      {/* Open-Licensed Audio (Audius) */}
      {openAudio.length > 0 && (
        <section>
          <div className="mb-3">
            <h2 className="text-xl font-bold text-encore-text">
              Open Audio
            </h2>
            <p className="text-xs text-encore-subdued">
              Independent tracks on Audius
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {openAudio.map((track) => {
              const saved = offlineItems.some((i) => i.id === `dl_${track.id}`);
              return (
                <div
                  key={`aud-${track.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-encore-hairline bg-encore-elevated p-2.5 transition hover:bg-encore-elevated-highlight"
                >
                  <button
                    type="button"
                    onClick={() => playTrack(track, openAudio)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <img
                      src={track.thumbnail}
                      alt={track.title}
                      className="h-11 w-11 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-encore-text">
                        {track.title}
                      </p>
                      <p className="truncate text-xs text-encore-subdued">
                        {track.artist} • {track.durationText}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={saved}
                    onClick={() => {
                      void downloadPermittedTrack(track).then((ok) => {
                        if (ok) {
                          showToast(`Saved "${track.title}" offline`, "success");
                        }
                      });
                    }}
                    className="btn-cobalt inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition disabled:opacity-45"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {saved ? "Saved" : "Save"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* More Songs */}
      {result.tracks.length > 4 && (
        <section>
          <h2 className="mb-3 text-xl font-bold text-encore-text">More songs</h2>
          <div className="space-y-0.5">
            {result.tracks.slice(4).map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx + 4}
                contextQueue={result.tracks}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-encore-subdued">Loading search...</div>}>
      <SearchContent />
    </Suspense>
  );
}
