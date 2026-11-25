import { NextRequest, NextResponse } from "next/server";
import type { Track } from "@/types/music";
import { formatTime } from "@/lib/utils";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickArtwork(artwork: unknown): string {
  if (typeof artwork === "string" && artwork.startsWith("https://")) {
    return artwork;
  }
  if (artwork && typeof artwork === "object") {
    const obj = artwork as Record<string, unknown>;
    const preferred = obj["480x480"] ?? obj["150x150"] ?? obj["1000x1000"];
    if (typeof preferred === "string" && preferred.startsWith("https://")) {
      return preferred;
    }
    const anyUrl = Object.values(obj).find(
      (v) => typeof v === "string" && v.startsWith("https://")
    );
    if (typeof anyUrl === "string") return anyUrl;
  }
  return "";
}

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, {
    key: "audius:search",
    limit: 60,
    windowMs: 60_000
  });
  if (!rl.allowed) return rateLimitResponse(rl);

  const query = (request.nextUrl.searchParams.get("q") ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  const wantsTrending = request.nextUrl.searchParams.get("trending") === "1";
  const limit = Math.max(
    1,
    Math.min(15, Number(request.nextUrl.searchParams.get("limit")) || 10)
  );

  if (!wantsTrending && (query.length < 2 || query.length > 200)) {
    return NextResponse.json(
      {
        tracks: [],
        error: "invalid_query",
        message: "Enter between 2 and 200 characters."
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const upstream = wantsTrending
      ? new URL("https://api.audius.co/v1/tracks/trending")
      : new URL("https://api.audius.co/v1/tracks/search");

    upstream.searchParams.set("app_name", "Sangeet");
    // Over-fetch slightly so filtering out non-streamable tracks still returns up to `limit`
    upstream.searchParams.set("limit", String(Math.min(25, limit * 2)));
    if (!wantsTrending) {
      upstream.searchParams.set("query", query);
    }

    const res = await fetch(upstream, {
      headers: { Accept: "application/json", "User-Agent": "Sangeet/2.3.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          tracks: [],
          error: "audius_unavailable",
          message: "Open-audio search is temporarily unavailable. Please try again."
        },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const payload = await res.json();
    const rawList = Array.isArray(payload?.data) ? payload.data : [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tracks: Track[] = rawList
      // Only include tracks that Audius explicitly allows streaming/downloading (prevents 404 on stream)
      .filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any) =>
          typeof item?.id === "string" &&
          Boolean(item?.title) &&
          item?.is_streamable !== false &&
          !item?.is_stream_gated
      )
      .slice(0, limit)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => {
        const dur = Number(item.duration) || 0;
        const id = String(item.id);
        return {
          id,
          title: String(item.title),
          artist: String(
            item?.user?.name || item?.user?.handle || "Independent Artist"
          ),
          album: item?.genre ? String(item.genre) : "Audius Open Audio",
          duration: dur,
          durationText: formatTime(dur),
          thumbnail:
            pickArtwork(item.artwork) ||
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Crect width='256' height='256' fill='%23151c18'/%3E%3Ctext x='128' y='142' font-size='44' text-anchor='middle' fill='%231ed760' font-family='sans-serif'%3E%E2%99%AB%3C/text%3E%3C/svg%3E",
          source: "audius",
          streamUrl: `/api/audius/stream?id=${encodeURIComponent(id)}`,
          downloadable: true
        } satisfies Track;
      });

    return NextResponse.json(
      { tracks },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      {
        tracks: [],
        error: "audius_timeout",
        message: "Open-audio search timed out. Please try again."
      },
      { status: 504, headers: { "Cache-Control": "no-store" } }
    );
  }
}
