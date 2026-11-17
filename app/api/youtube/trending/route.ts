import { NextResponse } from "next/server";
import { getAlbum, getArtist, tracks } from "@/lib/catalog";
import { enforceRateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVICE_URL = process.env.YTMUSIC_SERVICE_URL ?? (process.env.VERCEL ? "" : "http://127.0.0.1:8765");
const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_POOL_SIZE = 24;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface TrendingTrackResult {
  id: string;
  videoId?: string;
  title: string;
  artist: string;
  album: string;
  durationSeconds: number;
  duration: number;
  thumbnail: string;
  artwork: string;
  audioUrl: string;
  views?: string;
  genre?: string;
  source: "youtube" | "audius" | "catalog";
}

let cachedPool: { at: number; results: TrendingTrackResult[]; source: string } | null = null;

function sanitizeYouTubeThumbnail(candidate: unknown, videoId: string): string {
  const fallback = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  if (typeof candidate !== "string" || !candidate) return fallback;
  try {
    const url = new URL(candidate);
    if (
      url.protocol === "https:" &&
      (url.hostname.endsWith(".googleusercontent.com") ||
        url.hostname.endsWith(".ggpht.com") ||
        url.hostname.endsWith(".ytimg.com") ||
        url.hostname.endsWith(".youtube.com"))
    ) {
      return url.toString();
    }
  } catch {
    // Fallback to canonical YouTube thumbnail.
  }
  return fallback;
}

function sanitizeAudiusArtwork(value: unknown): string {
  const candidate =
    typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? (Object.values(value as Record<string, unknown>).find((img) => typeof img === "string") as string | undefined)
        : undefined;
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && (url.hostname === "audius.co" || url.hostname.endsWith(".audius.co"))
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function parseDurationText(value: unknown): number {
  if (typeof value !== "string") return 0;
  const parts = value
    .trim()
    .split(":")
    .map((p) => Number(p));
  if (!parts.length || parts.some((n) => !Number.isFinite(n) || n < 0)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
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

function mapVideoRenderers(renderers: Record<string, unknown>[]): TrendingTrackResult[] {
  const results: TrendingTrackResult[] = [];
  const seen = new Set<string>();

  for (const renderer of renderers) {
    const videoId = typeof renderer.videoId === "string" ? renderer.videoId : "";
    if (!/^[\w-]{11}$/.test(videoId) || seen.has(videoId)) continue;

    const title = readRunsText(renderer.title).trim();
    if (!title) continue;

    const durationText = readRunsText(renderer.lengthText);
    const durationSeconds = parseDurationText(durationText);
    // Skip active livestreams (no lengthText) or ultra-long compilations (> 20m)
    if (durationSeconds <= 0 || durationSeconds > 1200) continue;

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
    const thumbnail = sanitizeYouTubeThumbnail(lastThumb, videoId);

    seen.add(videoId);
    results.push({
      id: `yt-${videoId}`,
      videoId,
      title: title.slice(0, 180),
      artist: artist.slice(0, 140),
      album: "",
      durationSeconds,
      duration: durationSeconds,
      thumbnail,
      artwork: thumbnail,
      audioUrl: `/api/youtube/audio?videoId=${encodeURIComponent(videoId)}`,
      views: views?.slice(0, 32),
      source: "youtube",
    });

    if (results.length >= 16) break;
  }

  return results;
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

async function fetchServiceTrending(): Promise<TrendingTrackResult[]> {
  if (!SERVICE_URL) return [];
  const serviceToken = process.env.YTMUSIC_SERVICE_TOKEN;
  const response = await fetch(
    `${SERVICE_URL.replace(/\/$/, "")}/api/search?q=${encodeURIComponent("trending music hits 2026")}&limit=12`,
    {
      headers: serviceToken ? { Authorization: `Bearer ${serviceToken}` } : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    },
  );
  if (!response.ok) return [];
  const payload = (await response.json()) as { results?: unknown };
  if (!Array.isArray(payload.results)) return [];

  const results: TrendingTrackResult[] = [];
  for (const item of payload.results) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const videoId = typeof raw.videoId === "string" ? raw.videoId : "";
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!/^[\w-]{11}$/.test(videoId) || !title) continue;
    const durationSeconds =
      typeof raw.durationSeconds === "number" && raw.durationSeconds > 0 ? Math.round(raw.durationSeconds) : 0;
    const thumbnail = sanitizeYouTubeThumbnail(raw.thumbnail, videoId);
    results.push({
      id: `yt-${videoId}`,
      videoId,
      title: title.slice(0, 180),
      artist: typeof raw.artist === "string" && raw.artist.trim() ? raw.artist.trim().slice(0, 140) : "YouTube",
      album: typeof raw.album === "string" ? raw.album.trim().slice(0, 160) : "",
      durationSeconds,
      duration: durationSeconds,
      thumbnail,
      artwork: thumbnail,
      audioUrl: `/api/youtube/audio?videoId=${encodeURIComponent(videoId)}`,
      views: typeof raw.views === "string" ? raw.views.slice(0, 32) : undefined,
      source: "youtube",
    });
  }
  return results.slice(0, 12);
}

async function fetchAudiusTrending(): Promise<TrendingTrackResult[]> {
  const response = await fetch("https://api.audius.co/v1/tracks/trending?limit=10", {
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as { data?: unknown };
  if (!Array.isArray(payload.data)) return [];

  const results: TrendingTrackResult[] = [];
  for (const value of payload.data) {
    if (!value || typeof value !== "object") continue;
    const track = value as Record<string, unknown>;
    const id = typeof track.id === "string" || typeof track.id === "number" ? String(track.id) : "";
    const title = typeof track.title === "string" ? track.title.trim() : "";
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || !title) continue;
    const user = track.user && typeof track.user === "object" ? (track.user as Record<string, unknown>) : {};
    const durationSeconds = Number.isFinite(track.duration)
      ? Math.max(0, Math.min(86400, Math.round(Number(track.duration))))
      : 0;
    const artwork = sanitizeAudiusArtwork(track.artwork);
    results.push({
      id: `aud-${id}`,
      title: title.slice(0, 180),
      artist: typeof user.name === "string" && user.name.trim() ? user.name.trim().slice(0, 140) : "Independent artist",
      album: typeof track.album_name === "string" ? track.album_name.trim().slice(0, 160) : "",
      durationSeconds,
      duration: durationSeconds,
      thumbnail: artwork,
      artwork,
      audioUrl: `/api/audius/stream?id=${encodeURIComponent(id)}`,
      genre: typeof track.genre === "string" ? track.genre.slice(0, 80) : undefined,
      source: "audius",
    });
  }
  return results.slice(0, 10);
}

async function fetchYouTubeLiveTrending(): Promise<TrendingTrackResult[]> {
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
        query: "trending music songs 2026",
        params: "EgIQAQ%3D%3D",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });

    if (innerTubeRes.ok) {
      const json = (await innerTubeRes.json()) as unknown;
      const renderers: Record<string, unknown>[] = [];
      collectVideoRenderers(json, renderers);
      const mapped = mapVideoRenderers(renderers);
      if (mapped.length > 0) return mapped;
    }
  } catch {
    // Fall back to ytInitialData HTML scrape.
  }

  try {
    const htmlRes = await fetch(
      "https://www.youtube.com/results?search_query=trending+music+songs+2026&sp=EgIQAQ%253D%253D",
      {
        headers: {
          "User-Agent": BROWSER_UA,
          "Accept-Language": "en-US,en;q=0.9",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      },
    );
    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const initialData = extractYtInitialData(html);
      if (initialData) {
        const renderers: Record<string, unknown>[] = [];
        collectVideoRenderers(initialData, renderers);
        return mapVideoRenderers(renderers);
      }
    }
  } catch {
    // Handled by Audius + catalog fallback.
  }

  return [];
}

function getCatalogTrendingFallback(): TrendingTrackResult[] {
  return tracks
    .filter((track) => Boolean(track.youtubeId))
    .slice(0, 24)
    .map((track) => {
      const videoId = track.youtubeId!;
      const artwork = track.artwork || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      return {
        id: track.id,
        videoId,
        title: track.title,
        artist: getArtist(track.artistId)?.name ?? "Sangeet",
        album: getAlbum(track.albumId)?.title ?? "",
        durationSeconds: track.duration,
        duration: track.duration,
        thumbnail: artwork,
        artwork,
        audioUrl: `/api/youtube/audio?videoId=${encodeURIComponent(videoId)}`,
        source: "catalog" as const,
      };
    });
}

function mergeTrending(groups: TrendingTrackResult[][]): TrendingTrackResult[] {
  const merged: TrendingTrackResult[] = [];
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();

  for (const group of groups) {
    for (const item of group) {
      const idKey = item.videoId || item.id;
      const titleKey = `${item.title.toLowerCase()}::${item.artist.toLowerCase()}`;
      if (seenIds.has(idKey) || seenKeys.has(titleKey)) continue;
      seenIds.add(idKey);
      seenKeys.add(titleKey);
      merged.push(item);
      if (merged.length >= MAX_POOL_SIZE) return merged;
    }
  }

  return merged;
}

export async function GET(request: Request) {
  const rateLimited = enforceRateLimit(request, "youtube:trending", 30, 60_000);
  if (rateLimited) return rateLimited;

  const rawLimit = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(MAX_POOL_SIZE, Math.round(rawLimit))) : 16;

  if (cachedPool && Date.now() - cachedPool.at < CACHE_TTL_MS) {
    return NextResponse.json(
      { results: cachedPool.results.slice(0, limit), source: cachedPool.source, cached: true },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } },
    );
  }

  const [serviceRes, audiusRes, youtubeLiveRes] = await Promise.allSettled([
    fetchServiceTrending(),
    fetchAudiusTrending(),
    fetchYouTubeLiveTrending(),
  ]);

  const serviceItems = serviceRes.status === "fulfilled" ? serviceRes.value : [];
  const youtubeLiveItems = youtubeLiveRes.status === "fulfilled" ? youtubeLiveRes.value : [];
  const audiusItems = audiusRes.status === "fulfilled" ? audiusRes.value : [];
  const catalogItems = getCatalogTrendingFallback();

  // Interleave YouTube (prefer local ytmusic-service when available, then live Node YouTube) with Audius, then pad with curated catalog.
  const primaryYouTube = serviceItems.length > 0 ? serviceItems : youtubeLiveItems;
  const secondaryYouTube = serviceItems.length > 0 ? youtubeLiveItems : [];

  const blended: TrendingTrackResult[] = [];
  const maxLen = Math.max(primaryYouTube.length, audiusItems.length);
  for (let i = 0; i < maxLen; i += 1) {
    if (i < primaryYouTube.length) blended.push(primaryYouTube[i]);
    if (i < primaryYouTube.length && i % 2 === 1 && Math.floor(i / 2) < audiusItems.length) {
      blended.push(audiusItems[Math.floor(i / 2)]);
    }
  }

  const results = mergeTrending([blended, secondaryYouTube, audiusItems, catalogItems]);

  const source =
    primaryYouTube.length > 0 && audiusItems.length > 0
      ? "youtube+audius"
      : primaryYouTube.length > 0
        ? "youtube"
        : audiusItems.length > 0
          ? "audius"
          : "catalog";

  cachedPool = { at: Date.now(), results, source };

  return NextResponse.json(
    { results: results.slice(0, limit), source },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } },
  );
}
