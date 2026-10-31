import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { getArtist, tracks } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const SERVICE_URL = process.env.YTMUSIC_SERVICE_URL ?? "http://127.0.0.1:8765";
const CACHE_TTL_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 30;
const cache = new Map<string, { at: number; results: ServiceResult[]; unavailable: boolean }>();
const requestWindows = new Map<string, { start: number; count: number }>();

interface ServiceResult {
  videoId: string;
  title: string;
  artist: string;
  album?: string;
  durationSeconds?: number;
  thumbnail?: string;
  year?: number;
  views?: string;
}

function requestKey(request: Request): string {
  // Configure the edge proxy to overwrite these headers before using this in production.
  return request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

function allowSearch(request: Request): boolean {
  const key = requestKey(request);
  const now = Date.now();
  const current = requestWindows.get(key);
  if (!current || now - current.start >= RATE_WINDOW_MS) {
    requestWindows.set(key, { start: now, count: 1 });
    if (requestWindows.size > 10_000) {
      for (const [entry, window] of requestWindows) {
        if (now - window.start >= RATE_WINDOW_MS) requestWindows.delete(entry);
      }
    }
    return true;
  }
  if (current.count >= RATE_LIMIT) return false;
  current.count += 1;
  return true;
}

function sanitizeResults(input: unknown): ServiceResult[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const result = item as Partial<ServiceResult>;
    if (typeof result.videoId !== "string" || !/^[\w-]{11}$/.test(result.videoId)) return [];
    if (typeof result.title !== "string" || !result.title.trim()) return [];
    const thumbnail = typeof result.thumbnail === "string" ? result.thumbnail : "";
    let safeThumbnail = `https://i.ytimg.com/vi/${result.videoId}/hqdefault.jpg`;
    try {
      const url = new URL(thumbnail);
      if (url.protocol === "https:" && ["i.ytimg.com", "img.youtube.com", "yt3.ggpht.com", "lh3.googleusercontent.com"].includes(url.hostname)) {
        safeThumbnail = url.toString();
      }
    } catch {
      // Use the canonical YouTube thumbnail for malformed upstream metadata.
    }
    return [{
      videoId: result.videoId,
      title: result.title.trim().slice(0, 180),
      artist: typeof result.artist === "string" ? result.artist.trim().slice(0, 140) : "YouTube",
      album: typeof result.album === "string" ? result.album.trim().slice(0, 160) : "",
      durationSeconds: typeof result.durationSeconds === "number" && result.durationSeconds > 0 ? result.durationSeconds : 0,
      thumbnail: safeThumbnail,
      year: typeof result.year === "number" ? result.year : undefined,
      views: typeof result.views === "string" ? result.views.slice(0, 32) : undefined,
    }];
  }).slice(0, 12);
}

export async function GET(request: Request) {
  if (!allowSearch(request)) {
    return NextResponse.json({ results: [], error: "rate_limited" }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
  }
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 120) {
    return NextResponse.json({ results: [], error: "invalid_query" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const cacheKey = query.toLocaleLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({ results: cached.results, unavailable: cached.unavailable, cached: true });
  }

  let upstreamAvailable = false;
  let serviceReached = false;
  try {
    const response = await fetch(`${SERVICE_URL}/search?q=${encodeURIComponent(query)}&limit=12`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    serviceReached = true;
    if (response.ok) {
      const payload = await response.json() as { results?: unknown };
      upstreamAvailable = true;
      const results = sanitizeResults(payload.results);
      if (results.length) {
        cache.set(cacheKey, { at: Date.now(), results, unavailable: false });
        return NextResponse.json({ results, provider: "youtube", cached: false });
      }
    }
  } catch {
    // Try the local Python fallback before using the bundled catalog.
  }

  if (!serviceReached && !upstreamAvailable) try {
    const pythonExe = path.join(process.cwd(), ".venv-ytm", "Scripts", "python.exe");
    const script = `
import json, sys
from ytmusicapi import YTMusic
try:
    yt = YTMusic()
    raw = yt.search(sys.argv[1], filter='songs', limit=12)
    results = []
    for s in raw:
        vid = s.get('videoId')
        if not vid: continue
        thumbs = s.get('thumbnails') or []
        thumb = thumbs[-1].get('url') if thumbs else f'https://i.ytimg.com/vi/{vid}/hqdefault.jpg'
        artists = [a.get('name') for a in s.get('artists') or [] if a.get('name')]
        results.append({'videoId': vid, 'title': s.get('title') or 'Song', 'artist': ', '.join(artists) if artists else 'YouTube', 'album': (s.get('album') or {}).get('name') or '', 'durationSeconds': s.get('duration_seconds') or 0, 'thumbnail': thumb, 'views': s.get('views') or ''})
    print(json.dumps({'ok': True, 'results': results}))
except Exception:
    print(json.dumps({'ok': False, 'results': []}))
`;
    const { stdout } = await execFileAsync(pythonExe, ["-c", script, query], { timeout: 8000 });
    const payload = JSON.parse(stdout.trim() || "{}") as { ok?: boolean; results?: unknown };
    upstreamAvailable = Boolean(payload.ok);
    const results = sanitizeResults(payload.results);
    if (results.length) {
      cache.set(cacheKey, { at: Date.now(), results, unavailable: false });
      return NextResponse.json({ results, provider: "youtube" });
    }
  } catch {
    // A local catalog match may still provide a useful result while search is unavailable.
  }

  const normalizedQuery = query.toLocaleLowerCase();
  const catalogResults = tracks
    .filter((track) => track.youtubeId && (track.title.toLocaleLowerCase().includes(normalizedQuery) || normalizedQuery.includes(track.title.toLocaleLowerCase())))
    .slice(0, 12)
    .map((track) => ({
      videoId: track.youtubeId!,
      title: track.title,
      artist: getArtist(track.artistId)?.name ?? "YouTube",
      album: "",
      durationSeconds: track.duration,
      thumbnail: track.artwork,
    }));
  const unavailable = !upstreamAvailable && catalogResults.length === 0;
  cache.set(cacheKey, { at: Date.now(), results: catalogResults, unavailable });
  return NextResponse.json({ results: catalogResults, unavailable, provider: catalogResults.length ? "catalog" : undefined });
}
