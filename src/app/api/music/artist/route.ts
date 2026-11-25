import { NextRequest, NextResponse } from "next/server";
import { getArtistDetail } from "@/lib/ytmusic";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const BROWSE_ID_PATTERN = /^[A-Za-z0-9_-]{2,80}$/;

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, {
    key: "music:artist",
    limit: 60,
    windowMs: 60_000
  });
  if (!rl.allowed) return rateLimitResponse(rl);

  const id = (request.nextUrl.searchParams.get("id") ?? "").trim();
  const rawName = request.nextUrl.searchParams.get("name");
  const name = rawName
    ? rawName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200) ||
      undefined
    : undefined;

  if (!BROWSE_ID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "Invalid artist id" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const detail = await getArtistDetail(id, name);
    return NextResponse.json(detail);
  } catch {
    return NextResponse.json(
      { error: "Failed to load artist." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
