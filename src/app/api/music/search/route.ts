import { NextRequest, NextResponse } from "next/server";
import { searchYouTubeMusic } from "@/lib/ytmusic";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

type SearchData = Awaited<ReturnType<typeof searchYouTubeMusic>>;

const MAX_QUERY_LENGTH = 200;
const SEARCH_CACHE_TTL_MS = 2 * 60_000;
const MAX_CACHE_ENTRIES = 150;

const searchCache = new Map<string, { data: SearchData; updatedAt: number }>();
const inFlightSearch = new Map<string, Promise<SearchData>>();

function setSearchCache(key: string, data: SearchData) {
  if (searchCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey !== undefined) searchCache.delete(oldestKey);
  }
  searchCache.set(key, { data, updatedAt: Date.now() });
}

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300"
};

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, {
    key: "music:search",
    limit: 60,
    windowMs: 60_000
  });
  if (!rl.allowed) return rateLimitResponse(rl);

  const rawQuery = request.nextUrl.searchParams.get("q") ?? "";
  const q = rawQuery.replace(/[\u0000-\u001f\u007f]/g, "").trim();

  if (!q) {
    return NextResponse.json({
      query: "",
      topResult: null,
      tracks: [],
      artists: [],
      albums: []
    });
  }

  if (q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      {
        error: "Query exceeds maximum length of 200 characters.",
        query: "",
        topResult: null,
        tracks: [],
        artists: [],
        albums: []
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.updatedAt < SEARCH_CACHE_TTL_MS) {
    return NextResponse.json(cached.data, { headers: CACHE_HEADERS });
  }

  try {
    let pending = inFlightSearch.get(cacheKey);
    if (!pending) {
      pending = searchYouTubeMusic(q).finally(() => {
        inFlightSearch.delete(cacheKey);
      });
      inFlightSearch.set(cacheKey, pending);
    }
    const data = await pending;
    setSearchCache(cacheKey, data);
    return NextResponse.json(data, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      {
        error: "Search failed",
        query: q,
        topResult: null,
        tracks: [],
        artists: [],
        albums: []
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
