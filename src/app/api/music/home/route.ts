import { NextRequest, NextResponse } from "next/server";
import type { HomeShelf } from "@/types/music";
import { getHomeShelves } from "@/lib/ytmusic";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const ALLOWED_MOODS = new Set(["all", "music", "chill", "workout", "desi"]);
const FRESH_TTL_MS = 5 * 60_000;
const STALE_TTL_MS = 20 * 60_000;

const shelfCache = new Map<string, { shelves: HomeShelf[]; updatedAt: number }>();
const inFlight = new Map<string, Promise<HomeShelf[]>>();

function fetchAndCacheShelves(mood: string): Promise<HomeShelf[]> {
  const existing = inFlight.get(mood);
  if (existing) return existing;

  const task = getHomeShelves(mood)
    .then((shelves) => {
      if (shelves.length > 0) {
        shelfCache.set(mood, { shelves, updatedAt: Date.now() });
      }
      return shelves;
    })
    .finally(() => {
      inFlight.delete(mood);
    });

  inFlight.set(mood, task);
  return task;
}

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900"
};

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, {
    key: "music:home",
    limit: 60,
    windowMs: 60_000
  });
  if (!rl.allowed) return rateLimitResponse(rl);

  const rawMood = (request.nextUrl.searchParams.get("mood") ?? "all")
    .trim()
    .toLowerCase();
  const mood = ALLOWED_MOODS.has(rawMood) ? rawMood : "all";

  const cached = shelfCache.get(mood);
  const now = Date.now();

  if (cached && now - cached.updatedAt < FRESH_TTL_MS) {
    return NextResponse.json(
      { mood, shelves: cached.shelves },
      { headers: CACHE_HEADERS }
    );
  }

  if (cached && now - cached.updatedAt < STALE_TTL_MS) {
    // Serve stale immediately and refresh in background
    void fetchAndCacheShelves(mood).catch(() => {});
    return NextResponse.json(
      { mood, shelves: cached.shelves },
      { headers: CACHE_HEADERS }
    );
  }

  try {
    const shelves = await fetchAndCacheShelves(mood);
    return NextResponse.json({ mood, shelves }, { headers: CACHE_HEADERS });
  } catch {
    if (cached) {
      return NextResponse.json(
        { mood, shelves: cached.shelves },
        { headers: CACHE_HEADERS }
      );
    }
    return NextResponse.json(
      { mood, shelves: [], error: "Failed to load home shelves." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
