import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SyncedLine {
  timeMs: number;
  timeSec: number;
  text: string;
}

const cache = new Map<string, { at: number; data: unknown }>();

function parseLrc(lrcText: string): SyncedLine[] {
  const lines = lrcText.split("\n");
  const result: SyncedLine[] = [];
  const timeRegex = /^\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]\s*(.*)$/;

  for (const line of lines) {
    const match = line.trim().match(timeRegex);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = match[3] ? (match[3].length === 2 ? parseInt(match[3], 10) * 10 : parseInt(match[3], 10)) : 0;
      const timeMs = min * 60000 + sec * 1000 + ms;
      const text = (match[4] || "").trim();
      if (text) {
        result.push({ timeMs, timeSec: timeMs / 1000, text });
      }
    }
  }

  return result.sort((a, b) => a.timeMs - b.timeMs);
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[\(\[](official\s*)?(music\s*)?(video|audio|lyric(s)?|visualizer|remix|hd|4k)[\)\]]/gi, "")
    .replace(/\s*-\s*(official\s*)?(music\s*)?(video|audio)/gi, "")
    .replace(/\s*ft\.?.*$/i, "")
    .replace(/\s*feat\.?.*$/i, "")
    .trim();
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const videoId = (params.get("videoId") || "").trim();
  const rawTitle = (params.get("title") || "").trim();
  const rawArtist = (params.get("artist") || "").trim();
  const duration = parseInt(params.get("duration") || "0", 10);

  const title = cleanTitle(rawTitle);
  const artist = rawArtist.split(",")[0].trim();

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
        const data = await res.json();
        if (data.syncedLyrics) {
          syncedLines = parseLrc(data.syncedLyrics);
        }
        if (data.plainLyrics) {
          plainLyrics = data.plainLyrics;
        }
        if (syncedLines.length > 0 || plainLyrics) {
          source = "LRCLIB";
        }
      }
    } catch {}

    // If direct get didn't match, try LRCLIB search
    if (syncedLines.length === 0 && !plainLyrics) {
      try {
        const query = `${title} ${artist}`.trim();
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
        const res = await fetch(searchUrl, {
          headers: { "User-Agent": "SangeetMusic/1.0 (https://sangeet.shasant.xyz)" },
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const results = await res.json();
          if (Array.isArray(results) && results.length > 0) {
            const best = results[0];
            if (best.syncedLyrics) {
              syncedLines = parseLrc(best.syncedLyrics);
            }
            if (best.plainLyrics) {
              plainLyrics = best.plainLyrics;
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
    const serviceUrl = process.env.YTMUSIC_SERVICE_URL || "http://127.0.0.1:8765";
    try {
      const res = await fetch(`${serviceUrl.replace(/\/$/, "")}/api/lyrics?videoId=${encodeURIComponent(videoId)}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.lyrics && typeof data.lyrics === "string" && data.lyrics.trim()) {
          plainLyrics = data.lyrics.trim();
          source = data.source || "YouTube Music";
        }
      }
    } catch {}
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
    cache.delete(cache.keys().next().value!);
  }

  return NextResponse.json(payload, {
    headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
