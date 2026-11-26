"use client";

import { useEffect, useMemo, useState } from "react";
import type { SearchResult, Track } from "@/types/music";
import { MediaCard } from "@/components/music/media-card";
import { MediaShelf } from "@/components/music/media-shelf";
import {
  SLOT_LABEL,
  buildMoodProfile,
  describeProfile,
  discoveryQueries,
  familiarForSlot,
  rankTracks,
  slotForDate,
  topTags
} from "@/lib/mood-engine";
import { setListeningContext, useListeningEvents, useMoodLearning } from "@/store/listening-store";

const SHELF_SIZE = 14;
const CACHE_TTL_MS = 30 * 60_000;
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { signal });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

function snapshotToTrack(s: { id: string; title: string; artist: string; artistId?: string; thumbnail: string; duration: number; source?: string }): Track {
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    artistId: s.artistId,
    thumbnail: s.thumbnail,
    duration: s.duration,
    source: (s.source as Track["source"]) ?? "youtube"
  };
}

/**
 * "Made for this evening" — songs picked for the current time of day from this
 * profile's on-device listening history (or sensible starter picks).
 */
export function MoodShelf() {
  const events = useListeningEvents();
  const { enabled } = useMoodLearning();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [slot, setSlot] = useState(() => slotForDate(new Date()));

  // Re-evaluate the time slot every 5 minutes so the shelf follows the day.
  useEffect(() => {
    const id = window.setInterval(() => setSlot(slotForDate(new Date())), 5 * 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Rebuild only when the slot changes or a few more plays have been logged.
  const bucket = Math.floor(events.length / 5);
  const profile = useMemo(
    () => buildMoodProfile(enabled ? events : [], new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slot, bucket, enabled]
  );
  const learned = enabled && profile.evidence >= 3;

  useEffect(() => {
    const controller = new AbortController();
    const cacheKey = `sangeet-v2-mood-shelf-${profile.slot}-${bucket}-${enabled ? 1 : 0}`;

    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as { at: number; tracks: Track[] };
        if (Date.now() - cached.at < CACHE_TTL_MS && cached.tracks.length) {
          setTracks(cached.tracks);
          return () => controller.abort();
        }
      }
    } catch {}

    (async () => {
      const familiar = familiarForSlot(events, profile, 4).map(snapshotToTrack);
      const queries = discoveryQueries(profile);
      const seed = familiar.find((t) => YT_ID.test(t.id));

      const [searches, radio] = await Promise.all([
        Promise.all(
          queries.map((q) =>
            fetchJson<SearchResult>(`/api/music/search?q=${encodeURIComponent(q)}`, controller.signal)
          )
        ),
        seed
          ? fetchJson<{ tracks: Track[] }>(
              `/api/music/radio?videoId=${encodeURIComponent(seed.id)}`,
              controller.signal
            )
          : Promise.resolve(null)
      ]);
      if (controller.signal.aborted) return;

      // Interleave the discovery lists so one query doesn't dominate.
      const lists = [...searches.map((r) => r?.tracks?.slice(0, 8) ?? []), radio?.tracks?.slice(0, 10) ?? []];
      const discovered: Track[] = [];
      for (let i = 0; i < 10; i++) for (const l of lists) if (l[i]) discovered.push(l[i]);

      const familiarIds = new Set(familiar.map((t) => t.id));
      const seen = new Set<string>();
      const fresh = rankTracks(
        discovered.filter((t) => !familiarIds.has(t.id) && !seen.has(t.id) && seen.add(t.id)),
        profile
      );

      // Roughly one familiar favourite for every three new songs.
      const out: Track[] = [];
      let f = 0;
      for (const t of fresh) {
        if (out.length % 4 === 0 && f < familiar.length) out.push(familiar[f++]);
        out.push(t);
        if (out.length >= SHELF_SIZE) break;
      }
      while (out.length < SHELF_SIZE && f < familiar.length) out.push(familiar[f++]);

      setTracks(out);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), tracks: out }));
      } catch {}
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  if (tracks.length === 0) return null;

  const reason = describeProfile(profile);
  return (
    <section
      // Plays started here teach the engine the same moods it suggested.
      onClickCapture={() => setListeningContext(topTags(profile, 3), "mood-shelf")}
    >
      <div className="mb-3">
        <h2 className="text-xl font-semibold tracking-tight text-encore-text">
          Made for {SLOT_LABEL[profile.slot]}
        </h2>
        <p className="text-xs text-encore-subdued">
          {learned
            ? `Based on what you play ${SLOT_LABEL[profile.slot]}${reason ? ` · ${reason}` : ""}`
            : `Starter picks for ${SLOT_LABEL[profile.slot]} · gets more personal as you listen`}
        </p>
      </div>
      <MediaShelf>
        {tracks.map((track) => (
          <MediaCard key={`mood-${track.id}`} track={track} contextQueue={tracks} />
        ))}
      </MediaShelf>
    </section>
  );
}
