import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SyncedLine {
  timeMs: number;
  timeSec: number;
  text: string;
}

const cache = new Map<string, { at: number; data: unknown }>();

function parseLrc(lrcText: string): SyncedLine[] {
  const safeText = lrcText.slice(0, 50_000);
  const lines = safeText.split("\n").slice(0, 600);
  const result: SyncedLine[] = [];
  const timeRegex = /^\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]\s*(.*)$/;

  for (const line of lines) {
    const match = line.trim().slice(0, 400).match(timeRegex);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = match[3] ? (match[3].length === 2 ? parseInt(match[3], 10) * 10 : parseInt(match[3], 10)) : 0;
      const timeMs = min * 60000 + sec * 1000 + ms;
      const text = (match[4] || "").trim().slice(0, 300);
      if (text) {
        result.push({ timeMs, timeSec: timeMs / 1000, text });
      }
    }
  }

  return result.sort((a, b) => a.timeMs - b.timeMs);
}

function cleanTitle(title: string): string {
  const bounded = title.slice(0, 200);
  return bounded
    .replace(/\s*[\(\[](official\s*)?(music\s*)?(video|audio|lyric(s)?|visualizer|remix|hd|4k)[\)\]]/gi, "")
    .replace(/\s*-\s*(official\s*)?(music\s*)?(video|audio)/gi, "")
    .replace(/\s*ft\.?.*$/i, "")
    .replace(/\s*feat\.?.*$/i, "")
    .trim();
}

export async function GET(request: Request) {
  const rateLimited = enforceRateLimit(request, "lyrics:get", 45, 60_000);
  if (rateLimited) return rateLimited;

  const params = new URL(request.url).searchParams;
  const rawVideoId = (params.get("videoId") || "").trim();
  const videoId = /^[A-Za-z0-9_-]{11}$/.test(rawVideoId) ? rawVideoId : "";
  const rawTitle = (params.get("title") || "").trim().slice(0, 200);
  const rawArtist = (params.get("artist") || "").trim().slice(0, 140);
  const parsedDuration = parseInt(params.get("duration") || "0", 10);
  const duration = Number.isFinite(parsedDuration) ? Math.max(0, Math.min(86400, parsedDuration)) : 0;

  if (!videoId && !rawTitle) {
    return NextResponse.json(
      { ok: false, error: "invalid_request", syncedLines: [], plainLyrics: "", hasTimestamps: false },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const title = cleanTitle(rawTitle);
  const artist = rawArtist.split(",")[0].trim().slice(0, 100);

  const cacheKey = `${videoId}:${artist.toLowerCase()}:${title.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < 3600_000) {
    return NextResponse.json(cached.data);
  }

  let plainLyrics = "";
  let syncedLines: SyncedLine[] = [];
  let source = "";

  // 1. Try LRCLIB for synchronized lyrics (first priority for timing accuracy)
  if (title) {
    try {
      const lrcUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}${duration > 0 ? `&duration=${duration}` : ""}`;
      const res = await fetch(lrcUrl, {
        headers: { "User-Agent": "SangeetMusic/1.0 (https://sangeet.shasant.xyz)" },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = (await res.json()) as { syncedLyrics?: unknown; plainLyrics?: unknown };
        if (typeof data.syncedLyrics === "string") {
          syncedLines = parseLrc(data.syncedLyrics);
        }
        if (typeof data.plainLyrics === "string") {
          plainLyrics = data.plainLyrics.slice(0, 20_000);
        }
        if (syncedLines.length > 0 || plainLyrics) {
          source = "LRCLIB";
        }
      }
    } catch {}

    // If direct get didn't match, try LRCLIB search
    if (syncedLines.length === 0 && !plainLyrics) {
      try {
        const query = `${title} ${artist}`.trim().slice(0, 200);
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
        const res = await fetch(searchUrl, {
          headers: { "User-Agent": "SangeetMusic/1.0 (https://sangeet.shasant.xyz)" },
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const results = await res.json();
          if (Array.isArray(results) && results.length > 0) {
            const best = results[0] as { syncedLyrics?: unknown; plainLyrics?: unknown };
            if (typeof best?.syncedLyrics === "string") {
              syncedLines = parseLrc(best.syncedLyrics);
            }
            if (typeof best?.plainLyrics === "string") {
              plainLyrics = best.plainLyrics.slice(0, 20_000);
            }
            if (syncedLines.length > 0 || plainLyrics) {
              source = "LRCLIB";
            }
          }
        }
      } catch {}
    }
  }

  // 2. Fallback to YouTube Music service lyrics
  if (videoId && syncedLines.length === 0 && !plainLyrics) {
    const serviceUrl = process.env.YTMUSIC_SERVICE_URL || (process.env.VERCEL ? "" : "http://127.0.0.1:8765");
    if (serviceUrl) {
      try {
        const res = await fetch(`${serviceUrl.replace(/\/$/, "")}/api/lyrics?videoId=${encodeURIComponent(videoId)}`, {
          headers: process.env.YTMUSIC_SERVICE_TOKEN
            ? { authorization: `Bearer ${process.env.YTMUSIC_SERVICE_TOKEN}` }
            : undefined,
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          const data = (await res.json()) as { lyrics?: unknown; source?: unknown };
          if (typeof data.lyrics === "string" && data.lyrics.trim()) {
            plainLyrics = data.lyrics.trim().slice(0, 20_000);
            source = typeof data.source === "string" && data.source ? data.source.slice(0, 80) : "YouTube Music";
          }
        }
      } catch {}
    }
  }

  const payload = {
    ok: Boolean(syncedLines.length > 0 || plainLyrics),
    hasTimestamps: syncedLines.length > 0,
    syncedLines,
    plainLyrics,
    source: source || "Not available",
  };

  cache.set(cacheKey, { at: Date.now(), data: payload });
  if (cache.size > 300) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }

  return NextResponse.json(payload, {
    headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
