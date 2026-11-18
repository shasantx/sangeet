import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/security";
import { extractYouTubeAudioStream } from "@/lib/youtube-stream-extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rateLimited = enforceRateLimit(request, "youtube:stream", 30, 60_000);
  if (rateLimited) return rateLimited;

  const params = new URL(request.url).searchParams;
  const videoId = (params.get("videoId") || params.get("id") || "").trim();
  if (!videoId || videoId.startsWith("-") || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_videoId" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const extracted = await extractYouTubeAudioStream(videoId);
    if (!extracted) {
      return NextResponse.json(
        { ok: false, error: "stream_unavailable" },
        { status: 404, headers: { "cache-control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        streamUrl: `/api/youtube/audio?videoId=${encodeURIComponent(videoId)}`,
        directUrl: extracted.streamUrl,
        mimeType: extracted.mimeType,
        duration: extracted.duration,
        title: extracted.title,
      },
      { headers: { "cache-control": "private, max-age=300" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "stream_extraction_failed" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
