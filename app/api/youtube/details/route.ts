import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const serviceUrl = process.env.YTMUSIC_SERVICE_URL ?? (process.env.VERCEL ? "" : "http://127.0.0.1:8765");

function safeThumbnail(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["yt3.ggpht.com", "i.ytimg.com", "img.youtube.com", "lh3.googleusercontent.com"].includes(url.hostname) ? url.toString() : "";
  } catch { return ""; }
}

function cleanTracks(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    if (typeof item.videoId !== "string" || !/^[\w-]{11}$/.test(item.videoId) || typeof item.title !== "string") return [];
    return [{ videoId: item.videoId, title: item.title.slice(0, 180), artist: typeof item.artist === "string" ? item.artist.slice(0, 140) : "YouTube", album: typeof item.album === "string" ? item.album.slice(0, 160) : "", durationSeconds: Number.isFinite(item.durationSeconds) ? Number(item.durationSeconds) : 0, thumbnail: safeThumbnail(item.thumbnail) || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`, year: Number.isFinite(item.year) ? Number(item.year) : undefined }];
  }).slice(0, 30);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") ?? "";
  const browseId = params.get("browseId") ?? "";
  if (!["artist", "album"].includes(kind) || !/^[A-Za-z0-9_-]{1,100}$/.test(browseId)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    if (!serviceUrl) throw new Error("Discovery service unavailable");
    const response = await fetch(`${serviceUrl.replace(/\/$/, "")}/api/details?kind=${kind}&browseId=${encodeURIComponent(browseId)}`, {
      headers: process.env.YTMUSIC_SERVICE_TOKEN ? { authorization: `Bearer ${process.env.YTMUSIC_SERVICE_TOKEN}` } : undefined,
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Discovery service unavailable");
    const data = await response.json() as { details?: Record<string, unknown> };
    const source = data.details ?? {};
    const details = { browseId, title: typeof source.title === "string" ? source.title.slice(0, 180) : "", artist: typeof source.artist === "string" ? source.artist.slice(0, 140) : "", description: typeof source.description === "string" ? source.description.slice(0, 1200) : "", subscribers: typeof source.subscribers === "string" ? source.subscribers.slice(0, 60) : "", year: Number.isFinite(source.year) ? Number(source.year) : null, thumbnail: safeThumbnail(source.thumbnail), tracks: cleanTracks(source.tracks) };
    return NextResponse.json({ details }, { headers: { "cache-control": "private, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "discovery_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
