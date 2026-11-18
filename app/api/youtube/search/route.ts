import { NextResponse } from "next/server";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { getArtist, tracks } from "@/lib/catalog";
import { defaultSiteSettings, getSiteSettings } from "@/lib/admin-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const SERVICE_URL = process.env.YTMUSIC_SERVICE_URL ?? (process.env.VERCEL ? "" : "http://127.0.0.1:8765");
const SERVICE_TIMEOUT_MS = 2500;
const WEB_SEARCH_TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 30;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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

function setSearchCache(key: string, results: ServiceResult[], unavailable: boolean): void {
  const now = Date.now();
  if (cache.size >= MAX_CACHE_ENTRIES) {
    for (const [entryKey, entry] of cache) {
      if (now - entry.at >= CACHE_TTL_MS) cache.delete(entryKey);
      if (cache.size < MAX_CACHE_ENTRIES) break;
    }
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) cache.delete(oldestKey);
    }
  }
  cache.set(key, { at: now, results, unavailable });
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
      if (
        url.protocol === "https:" &&
        (url.hostname.endsWith(".googleusercontent.com") ||
          url.hostname.endsWith(".ggpht.com") ||
          url.hostname.endsWith(".ytimg.com") ||
          url.hostname.endsWith(".youtube.com"))
      ) {
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

function readRunsText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const record = node as Record<string, unknown>;
  if (typeof record.simpleText === "string") return record.simpleText;
  if (Array.isArray(record.runs)) {
    return record.runs
      .map((run) => (run && typeof run === "object" && typeof (run as { text?: unknown }).text === "string" ? (run as { text: string }).text : ""))
      .join("");
  }
  return "";
}

function parseDurationText(value: string): number {
  const parts = value
    .trim()
    .split(":")
    .map((part) => Number(part));
  if (!parts.length || parts.some((num) => !Number.isFinite(num) || num < 0)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function collectVideoRenderers(node: unknown, out: Record<string, unknown>[], depth = 0): void {
  if (depth > 16 || !node || typeof node !== "object" || out.length >= 24) return;
  if (Array.isArray(node)) {
    for (const item of node) collectVideoRenderers(item, out, depth + 1);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (obj.videoRenderer && typeof obj.videoRenderer === "object") {
    out.push(obj.videoRenderer as Record<string, unknown>);
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      collectVideoRenderers(value, out, depth + 1);
    }
  }
}

function extractVideoRendererResults(root: unknown): ServiceResult[] {
  const renderers: Record<string, unknown>[] = [];
  collectVideoRenderers(root, renderers);
  const rawResults: ServiceResult[] = [];
  const seen = new Set<string>();

  for (const renderer of renderers) {
    const videoId = typeof renderer.videoId === "string" ? renderer.videoId : "";
    if (!/^[\w-]{11}$/.test(videoId) || seen.has(videoId)) continue;
    const title = readRunsText(renderer.title).trim();
    if (!title) continue;

    const lengthText = readRunsText(renderer.lengthText);
    const durationSeconds = parseDurationText(lengthText);
    if (durationSeconds <= 0 || durationSeconds > 1800) continue;

    const artist =
      readRunsText(renderer.ownerText).trim() ||
      readRunsText(renderer.longBylineText).trim() ||
      readRunsText(renderer.shortBylineText).trim() ||
      "YouTube";

    const views =
      readRunsText(renderer.shortViewCountText).trim() ||
      readRunsText(renderer.viewCountText).trim() ||
      undefined;

    const thumbObj = renderer.thumbnail as { thumbnails?: Array<{ url?: unknown }> } | undefined;
    const thumbs = Array.isArray(thumbObj?.thumbnails) ? thumbObj.thumbnails : [];
    const lastThumb = thumbs.length ? thumbs[thumbs.length - 1]?.url : undefined;

    seen.add(videoId);
    rawResults.push({
      videoId,
      title,
      artist,
      album: "",
      durationSeconds,
      thumbnail: typeof lastThumb === "string" ? lastThumb : undefined,
      views,
    });
    if (rawResults.length >= 12) break;
  }

  return sanitizeResults(rawResults);
}

function extractYtInitialData(html: string): unknown {
  const markers = ["var ytInitialData = ", 'window["ytInitialData"] = ', "ytInitialData = "];
  for (const marker of markers) {
    const idx = html.indexOf(marker);
    if (idx === -1) continue;
    const jsonStart = html.indexOf("{", idx + marker.length);
    if (jsonStart === -1) continue;
    const scriptEnd = html.indexOf(";</script>", jsonStart);
    if (scriptEnd !== -1) {
      try {
        return JSON.parse(html.slice(jsonStart, scriptEnd));
      } catch {
        // Try next marker if malformed.
      }
    }
  }
  return null;
}

async function searchYouTubeNodeFallback(query: string): Promise<ServiceResult[]> {
  const searchTerm = /\b(song|songs|music|audio|lofi|remix|cover)\b/i.test(query)
    ? query
    : `${query} song`;

  try {
    const innerTubeRes = await fetch("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": BROWSER_UA,
        "Accept-Language": "en-US,en;q=0.9",
        Origin: "https://www.youtube.com",
        Referer: "https://www.youtube.com/",
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20250101.00.00",
            hl: "en",
            gl: "US",
          },
        },
        query: searchTerm,
        params: "EgIQAQ%3D%3D",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(WEB_SEARCH_TIMEOUT_MS),
    });

    if (innerTubeRes.ok) {
      const json = (await innerTubeRes.json()) as unknown;
      const results = extractVideoRendererResults(json);
      if (results.length > 0) return results;
    }
  } catch {
    // Fall back to HTML ytInitialData scraping below.
  }

  try {
    const htmlRes = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}&sp=EgIQAQ%3D%3D`,
      {
        headers: {
          "User-Agent": BROWSER_UA,
          "Accept-Language": "en-US,en;q=0.9",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(WEB_SEARCH_TIMEOUT_MS),
      },
    );
    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const initialData = extractYtInitialData(html);
      if (initialData) {
        return extractVideoRendererResults(initialData);
      }
    }
  } catch {
    // Allow fallback to local catalog.
  }

  return [];
}

export async function GET(request: Request) {
  const siteSettings = await getSiteSettings().catch(() => defaultSiteSettings);
  if (!siteSettings.live_search_enabled) {
    return NextResponse.json({ results: [], unavailable: true, disabled: true }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
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
    return NextResponse.json(
      { results: cached.results, unavailable: cached.unavailable, cached: true },
      { headers: { "Cache-Control": "private, max-age=120" } },
    );
  }

  let upstreamAvailable = false;
  let serviceReached = false;
  if (SERVICE_URL) {
    try {
      const serviceToken = process.env.YTMUSIC_SERVICE_TOKEN;
      const response = await fetch(`${SERVICE_URL.replace(/\/$/, "")}/api/search?q=${encodeURIComponent(query)}&limit=12`, {
        headers: serviceToken ? { Authorization: `Bearer ${serviceToken}` } : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(SERVICE_TIMEOUT_MS),
      });
      serviceReached = true;
      if (response.ok) {
        const payload = await response.json() as { results?: unknown };
        upstreamAvailable = true;
        const results = sanitizeResults(payload.results);
        if (results.length) {
          setSearchCache(cacheKey, results, false);
          return NextResponse.json(
            { results, provider: "youtube", cached: false },
            { headers: { "Cache-Control": "private, max-age=120" } },
          );
        }
      }
    } catch {
      // Try the local Python fallback or Node YouTube fallback before using the bundled catalog.
    }
  }

  if (!process.env.VERCEL && !serviceReached && !upstreamAvailable) {
    const pythonExe = path.join(process.cwd(), ".venv-ytm", "Scripts", "python.exe");
    if (fs.existsSync(pythonExe)) {
      try {
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
          setSearchCache(cacheKey, results, false);
          return NextResponse.json(
            { results, provider: "youtube" },
            { headers: { "Cache-Control": "private, max-age=120" } },
          );
        }
      } catch {
        // Fall through to pure Node.js YouTube search fallback.
      }
    }
  }

  // Fast Node.js YouTube search fallback (works on Vercel and when Python ytmusic-service is offline).
  const nodeResults = await searchYouTubeNodeFallback(query);
  if (nodeResults.length > 0) {
    setSearchCache(cacheKey, nodeResults, false);
    return NextResponse.json(
      { results: nodeResults, provider: "youtube" },
      { headers: { "Cache-Control": "private, max-age=120" } },
    );
  }

  const normalizedQuery = query.toLocaleLowerCase();
  const catalogResults = tracks
    .filter((track) => {
      if (!track.youtubeId) return false;
      const artistName = getArtist(track.artistId)?.name.toLocaleLowerCase() ?? "";
      const titleLower = track.title.toLocaleLowerCase();
      return (
        titleLower.includes(normalizedQuery) ||
        normalizedQuery.includes(titleLower) ||
        artistName.includes(normalizedQuery)
      );
    })
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
  setSearchCache(cacheKey, catalogResults, unavailable);
  return NextResponse.json({
    results: catalogResults,
    unavailable,
    provider: catalogResults.length ? "catalog" : undefined,
  });
}
