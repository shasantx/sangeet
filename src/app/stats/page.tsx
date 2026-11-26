"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { useToastStore } from "@/store/toast-store";
import { TrackRow } from "@/components/music/track-row";
import type { Track } from "@/types/music";
import { cn } from "@/lib/utils";

export default function StatsPage() {
  const playCounts = useLibraryStore((s) => s.playCounts);
  const trackCatalog = useLibraryStore((s) => s.trackCatalog);
  const listeningSeconds = useLibraryStore((s) => s.listeningSeconds);
  const likedTracks = useLibraryStore((s) => s.likedTracks);
  const playlists = useLibraryStore((s) => s.playlists);

  const playTrack = usePlayerStore((s) => s.playTrack);
  const showToast = useToastStore((s) => s.showToast);

  const { totalPlays, topTracks, topArtists } = useMemo(() => {
    let plays = 0;
    const rankedTracks: Array<{ track: Track; count: number }> = [];
    const artistMap = new Map<string, number>();

    for (const [id, count] of Object.entries(playCounts)) {
      plays += count;
      const track = trackCatalog[id];
      if (!track) continue;
      rankedTracks.push({ track, count });
      const primaryArtist = track.artist.split(",")[0]?.trim() || track.artist;
      artistMap.set(primaryArtist, (artistMap.get(primaryArtist) || 0) + count);
    }

    rankedTracks.sort((a, b) => b.count - a.count);
    const rankedArtists = Array.from(artistMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      totalPlays: plays,
      topTracks: rankedTracks.slice(0, 10),
      topArtists: rankedArtists
    };
  }, [playCounts, trackCatalog]);

  const minutes = Math.max(0, Math.round(listeningSeconds / 60));

  const handleDownloadWrapped = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0d0c0b";
    ctx.fillRect(0, 0, 1080, 1350);

    ctx.strokeStyle = "rgba(229,48,63,0.24)";
    ctx.lineWidth = 2;
    ctx.strokeRect(56, 56, 968, 1238);

    ctx.fillStyle = "#e2363e";
    ctx.font = "600 26px monospace";
    ctx.fillText("Dhun listening summary", 96, 130);

    ctx.fillStyle = "#fbfaf8";
    ctx.font = "600 72px system-ui, sans-serif";
    ctx.fillText(`${minutes} min listened`, 96, 226);

    ctx.fillStyle = "#c4b1aa";
    ctx.font = "400 30px monospace";
    ctx.fillText(`${totalPlays} plays • ${likedTracks.length} liked`, 96, 286);

    ctx.fillStyle = "#78716c";
    ctx.font = "500 26px system-ui, sans-serif";
    ctx.fillText("Top artists", 96, 396);

    ctx.fillStyle = "#fbfaf8";
    ctx.font = "500 38px system-ui, sans-serif";
    topArtists.slice(0, 5).forEach((a, idx) => {
      ctx.fillText(
        `${idx + 1}. ${a.name.slice(0, 28)} (${a.count})`,
        96,
        458 + idx * 62
      );
    });

    ctx.fillStyle = "#78716c";
    ctx.font = "500 26px system-ui, sans-serif";
    ctx.fillText("Top tracks", 96, 840);

    ctx.fillStyle = "#fbfaf8";
    ctx.font = "500 34px system-ui, sans-serif";
    topTracks.slice(0, 5).forEach((item, idx) => {
      ctx.fillText(
        `${idx + 1}. ${item.track.title.slice(0, 34)}`,
        96,
        900 + idx * 58
      );
    });

    ctx.fillStyle = "#78716c";
    ctx.font = "400 24px monospace";
    ctx.fillText("sangeet.shasant.xyz", 96, 1245);

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "sangeet-listening-stats.png";
    a.click();
    showToast("Listening summary PNG exported", "success");
  };

  const maxArtistPlays = topArtists[0]?.count || 1;

  return (
    <div className="mx-auto max-w-5xl overflow-x-hidden space-y-8 p-4 pb-16 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.015em] text-encore-text sm:text-3xl">
            Listening stats
          </h1>
          <p className="mt-1 text-sm text-encore-subdued">
            Tracked locally in your browser across all playback sources
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadWrapped}
          disabled={totalPlays === 0}
          className="btn-cobalt inline-flex h-11 items-center gap-2 rounded-full px-5 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.6} />
          Export PNG summary
        </button>
      </div>

      {/* Stat Cards — Numbers Only (No Decorative Icons) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Minutes listened", value: `${minutes}m` },
          { label: "Total plays", value: String(totalPlays) },
          { label: "Liked tracks", value: String(likedTracks.length) },
          { label: "Playlists", value: String(playlists.length) }
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-[12px] border border-encore-hairline bg-encore-elevated p-5"
          >
            <p className="text-xs text-encore-muted">{label}</p>
            <p className="mt-2 font-mono text-[28px] font-medium leading-none tabular-nums text-encore-text sm:text-[32px]">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Top Artists — Accent Leads on #1 Only */}
      <section className="rounded-[12px] border border-encore-hairline bg-encore-elevated p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-base font-medium text-encore-text">
            Top artists
          </h2>
          <span className="font-mono text-xs text-encore-muted">Plays</span>
        </div>
        {topArtists.length === 0 ? (
          <p className="text-sm text-encore-muted">
            Play a few tracks to build your top artists breakdown
          </p>
        ) : (
          <div className="space-y-3.5">
            {topArtists.map((artist, idx) => (
              <div key={artist.name} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-4 text-xs">
                  <span className="truncate font-medium text-encore-text">
                    <span className="mr-2 font-mono tabular-nums text-encore-muted">
                      {idx + 1}
                    </span>
                    {artist.name}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-encore-muted">
                    {artist.count}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-[4px] bg-encore-rail">
                  <div
                    className={cn(
                      "h-full rounded-[4px]",
                      idx === 0 ? "bg-encore-accent" : "bg-encore-muted/45"
                    )}
                    style={{
                      width: `${Math.max(8, (artist.count / maxArtistPlays) * 100)}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Top Tracks */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium text-encore-text">
            Most played tracks
          </h2>
          {topTracks.length > 0 && (
            <button
              type="button"
              onClick={() =>
                playTrack(
                  topTracks[0].track,
                  topTracks.map((t) => t.track)
                )
              }
              className="inline-flex min-h-[38px] items-center rounded-full border border-encore-hairline bg-encore-elevated px-3.5 text-xs font-semibold text-encore-text transition hover:border-encore-accent/45 hover:bg-encore-elevated-highlight"
            >
              Play top mix
            </button>
          )}
        </div>
        {topTracks.length === 0 ? (
          <p className="text-sm text-encore-muted">
            No plays recorded yet. Start listening to see your most-played
            tracks
          </p>
        ) : (
          <div className="space-y-0.5">
            {topTracks.map((item, idx) => (
              <TrackRow
                key={item.track.id}
                track={item.track}
                index={idx}
                contextQueue={topTracks.map((t) => t.track)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
