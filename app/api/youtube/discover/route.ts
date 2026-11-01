import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const serviceUrl = process.env.YTMUSIC_SERVICE_URL ?? (process.env.VERCEL ? "" : "http://127.0.0.1:8765");
const cache = new Map<string, { at: number; rows: unknown[] }>();

function safeThumbnail(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["yt3.ggpht.com", "i.ytimg.com", "img.youtube.com", "lh3.googleusercontent.com"].includes(url.hostname) ? url.toString() : "";
  } catch { return ""; }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const kind = params.get("kind") ?? "";
  if (query.length < 2 || query.length > 120 || !["artists", "albums", "playlists"].includes(kind)) {
    return NextResponse.json({ results: [], error: "invalid_query" }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const key = `${kind}:${query.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < 300_000) return NextResponse.json({ results: cached.rows, cached: true });
  try {
    if (!serviceUrl) throw new Error("Discovery service unavailable");
    const response = await fetch(`${serviceUrl.replace(/\/$/, "")}/api/catalog?q=${encodeURIComponent(query)}&kind=${kind}&limit=8`, {
      headers: process.env.YTMUSIC_SERVICE_TOKEN ? { authorization: `Bearer ${process.env.YTMUSIC_SERVICE_TOKEN}` } : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error("Discovery service unavailable");
    const data = await response.json() as { results?: unknown };
    const rows = Array.isArray(data.results) ? data.results.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const item = value as Record<string, unknown>;
      if (typeof item.browseId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(item.browseId) || typeof item.title !== "string" || !item.title.trim()) return [];
      return [{ browseId: item.browseId, title: item.title.slice(0, 180), artist: typeof item.artist === "string" ? item.artist.slice(0, 140) : "", year: Number.isFinite(item.year) ? Number(item.year) : null, type: typeof item.type === "string" ? item.type.slice(0, 40) : "", subscribers: typeof item.subscribers === "string" ? item.subscribers.slice(0, 60) : "", thumbnail: safeThumbnail(item.thumbnail) }];
    }).slice(0, 8) : [];
    cache.set(key, { at: Date.now(), rows });
    if (cache.size > 250) cache.delete(cache.keys().next().value!);
    return NextResponse.json({ results: rows, provider: "ytmusicapi" }, { headers: { "cache-control": "private, max-age=60" } });
  } catch {
    return NextResponse.json({ results: [], unavailable: true }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
