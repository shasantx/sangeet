import { NextRequest, NextResponse } from "next/server";
import { getAlbumDetail } from "@/lib/ytmusic";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const BROWSE_ID_PATTERN = /^[A-Za-z0-9_-]{2,80}$/;

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, {
    key: "music:album",
    limit: 60,
    windowMs: 60_000
  });
  if (!rl.allowed) return rateLimitResponse(rl);

  const id = (request.nextUrl.searchParams.get("id") ?? "").trim();
  const rawTitle = request.nextUrl.searchParams.get("title");
  const title = rawTitle
    ? rawTitle.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200) ||
      undefined
    : undefined;

  if (!BROWSE_ID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "Invalid album id" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const detail = await getAlbumDetail(id, title);
    return NextResponse.json(detail);
  } catch {
    return NextResponse.json(
      { error: "Failed to load album." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
