import { NextRequest, NextResponse } from "next/server";
import { getRadioTracks } from "@/lib/ytmusic";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, {
    key: "music:radio",
    limit: 60,
    windowMs: 60_000
  });
  if (!rl.allowed) return rateLimitResponse(rl);

  const videoId = (request.nextUrl.searchParams.get("videoId") ?? "").trim();
  if (!VIDEO_ID_PATTERN.test(videoId)) {
    return NextResponse.json(
      { tracks: [], error: "Invalid videoId" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const tracks = await getRadioTracks(videoId);
    return NextResponse.json({ tracks });
  } catch {
    return NextResponse.json(
      { tracks: [], error: "Failed to load radio tracks." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
