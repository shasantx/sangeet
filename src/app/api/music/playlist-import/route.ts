import { NextRequest, NextResponse } from "next/server";
import { importYouTubePlaylist } from "@/lib/ytmusic";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const ALLOWED_YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be"
]);

const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{10,120}$/;

function extractValidatedPlaylistId(rawInput: string): string | null {
  const cleaned = rawInput.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!cleaned || cleaned.length > 500) return null;

  // Accept either a raw YouTube playlist ID or a strictly allowlisted YouTube URL
  if (PLAYLIST_ID_PATTERN.test(cleaned)) {
    return cleaned;
  }

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }

  if (!ALLOWED_YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())) {
    return null;
  }

  const listId = parsed.searchParams.get("list")?.trim() ?? "";
  if (!PLAYLIST_ID_PATTERN.test(listId)) {
    return null;
  }

  return listId;
}

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, {
    key: "music:playlist-import",
    limit: 20,
    windowMs: 60_000
  });
  if (!rl.allowed) return rateLimitResponse(rl);

  const raw = (request.nextUrl.searchParams.get("url") ?? "").trim();
  const playlistId = extractValidatedPlaylistId(raw);
  if (!playlistId) {
    return NextResponse.json(
      {
        error:
          "Provide a valid YouTube or YouTube Music playlist URL (youtube.com, music.youtube.com, youtu.be) or playlist ID."
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const result = await importYouTubePlaylist(playlistId);
    if (!result || result.tracks.length === 0) {
      return NextResponse.json(
        {
          error:
            "Could not find tracks in that playlist. Make sure it is public."
        },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to import playlist." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
