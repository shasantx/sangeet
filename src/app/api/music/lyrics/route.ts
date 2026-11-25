import { NextRequest, NextResponse } from "next/server";
import type { LyricsResponse } from "@/types/music";
import { parseLrc } from "@/lib/lyrics-parser";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

function cleanTrackTitle(title: string): string {
  return title
    .replace(
      /\s*\((?:official|lyric|music|audio|video|hd|4k|feat\.|ft\.)[^)]*\)/gi,
      ""
    )
    .replace(/\s*\[[^\]]*\]/g, "")
    .trim();
}

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, {
    key: "music:lyrics",
    limit: 60,
    windowMs: 60_000
  });
  if (!rl.allowed) return rateLimitResponse(rl);

  const rawTitle = (request.nextUrl.searchParams.get("title") ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 200);
  const rawArtist = (request.nextUrl.searchParams.get("artist") ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 200);

  if (!rawTitle) {
    return NextResponse.json<LyricsResponse>({
      synced: [],
      plain: null,
      source: "none"
    });
  }

  const title = cleanTrackTitle(rawTitle);
  const artist = rawArtist.split(",")[0]?.trim() ?? "";

  try {
    const params = new URLSearchParams({
      track_name: title,
      artist_name: artist
    });

    const direct = await fetch(
      `https://lrclib.net/api/get?${params.toString()}`,
      {
        headers: { "User-Agent": "Sangeet/2.0.0" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8_000)
      }
    );

    if (direct.ok) {
      const data = await direct.json();
      if (data?.syncedLyrics || data?.plainLyrics) {
        return NextResponse.json<LyricsResponse>({
          synced: data.syncedLyrics ? parseLrc(data.syncedLyrics) : [],
          plain: data.plainLyrics ?? null,
          source: "lrclib"
        });
      }
    }

    // Fallback to lrclib search
    const searchParams = new URLSearchParams({
      q: `${title} ${artist}`.trim()
    });
    const searchRes = await fetch(
      `https://lrclib.net/api/search?${searchParams.toString()}`,
      {
        headers: { "User-Agent": "Sangeet/2.0.0" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8_000)
      }
    );

    if (searchRes.ok) {
      const list = await searchRes.json();
      if (Array.isArray(list) && list.length > 0) {
        // Prefer an entry with syncedLyrics
        const best =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          list.find((item: any) => Boolean(item?.syncedLyrics)) ?? list[0];
        return NextResponse.json<LyricsResponse>({
          synced: best?.syncedLyrics ? parseLrc(best.syncedLyrics) : [],
          plain: best?.plainLyrics ?? null,
          source: "lrclib"
        });
      }
    }
  } catch {
    // Fall through to clean empty lyrics response
  }

  return NextResponse.json<LyricsResponse>({
    synced: [],
    plain: null,
    source: "none"
  });
}
