import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeArtwork(value: unknown): string {
  const candidate = typeof value === "string" ? value : value && typeof value === "object"
    ? Object.values(value as Record<string, unknown>).find((image) => typeof image === "string") as string | undefined
    : undefined;
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && (url.hostname === "audius.co" || url.hostname.endsWith(".audius.co")) ? url.toString() : "";
  } catch { return ""; }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const limit = Math.max(1, Math.min(15, Number(params.get("limit")) || 10));
  if (query.length < 2 || query.length > 100) return NextResponse.json({ results: [], error: "invalid_query" }, { status: 400, headers: { "cache-control": "no-store" } });

  try {
    const upstream = new URL("https://api.audius.co/v1/tracks/search");
    upstream.searchParams.set("query", query);
    upstream.searchParams.set("limit", String(limit));
    const response = await fetch(upstream, { next: { revalidate: 300 }, signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error("Catalog unavailable");
    const payload = await response.json() as { data?: unknown };
    const results = Array.isArray(payload.data) ? payload.data.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const track = value as Record<string, unknown>;
      const id = typeof track.id === "string" || typeof track.id === "number" ? String(track.id) : "";
      const user = track.user && typeof track.user === "object" ? track.user as Record<string, unknown> : {};
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || typeof track.title !== "string" || !track.title.trim()) return [];
      return [{
        id,
        title: track.title.slice(0, 180),
        artist: typeof user.name === "string" ? user.name.slice(0, 140) : "Independent artist",
        album: typeof track.album_name === "string" ? track.album_name.slice(0, 160) : "",
        durationSeconds: Number.isFinite(track.duration) ? Math.max(0, Math.min(86400, Number(track.duration))) : 0,
        artwork: safeArtwork(track.artwork),
        genre: typeof track.genre === "string" ? track.genre.slice(0, 80) : "",
        permalink: typeof track.permalink === "string" && track.permalink.startsWith("/") ? `https://audius.co${track.permalink.slice(0, 260)}` : "",
        audioUrl: `https://api.audius.co/v1/tracks/${encodeURIComponent(id)}/stream`,
      }];
    }).slice(0, limit) : [];
    return NextResponse.json({ results, source: "open-audio" }, { headers: { "cache-control": "private, max-age=300" } });
  } catch {
    return NextResponse.json({ results: [], unavailable: true }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
