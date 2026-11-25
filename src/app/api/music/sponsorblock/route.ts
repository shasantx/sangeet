import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export interface SkipSegment {
  start: number;
  end: number;
  category: string;
}

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, {
    key: "music:sponsorblock",
    limit: 90,
    windowMs: 60_000
  });
  if (!rl.allowed) return rateLimitResponse(rl);

  const videoId = (request.nextUrl.searchParams.get("videoId") ?? "").trim();
  if (!VIDEO_ID_PATTERN.test(videoId)) {
    return NextResponse.json(
      { segments: [] },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const categories = encodeURIComponent(
      JSON.stringify(["music_offtopic", "intro", "outro", "sponsor"])
    );
    const res = await fetch(
      `https://sponsor.ajay.app/api/skipSegments?videoID=${encodeURIComponent(videoId)}&categories=${categories}`,
      {
        headers: { "User-Agent": "Sangeet/2.0.0" },
        cache: "no-store",
        signal: AbortSignal.timeout(4000)
      }
    );

    if (!res.ok) {
      return NextResponse.json({ segments: [] });
    }

    const data = await res.json();
    const segments: SkipSegment[] = Array.isArray(data)
      ? data
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((s: any) => Array.isArray(s?.segment) && s.segment.length === 2)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((s: any) => ({
            start: Number(s.segment[0]),
            end: Number(s.segment[1]),
            category: String(s.category || "music_offtopic").slice(0, 64)
          }))
          .filter(
            (s) =>
              Number.isFinite(s.start) &&
              Number.isFinite(s.end) &&
              s.start >= 0 &&
              s.end > s.start
          )
      : [];

    return NextResponse.json({ segments });
  } catch {
    return NextResponse.json({ segments: [] });
  }
}
