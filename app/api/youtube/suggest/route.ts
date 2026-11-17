import { NextResponse } from "next/server";
import { albums, artists, getArtist, tracks } from "@/lib/catalog";
import { enforceRateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 400;
const MAX_SUGGESTIONS = 10;
const UPSTREAM_TIMEOUT_MS = 2500;

interface SuggestItem {
  query: string;
  type: "youtube" | "artist" | "album" | "track";
  subtitle?: string;
  artwork?: string;
  href?: string;
}

const POPULAR_CHIPS: SuggestItem[] = [
  { query: "Arijit Singh", type: "youtube", subtitle: "Trending search" },
  { query: "Sajjan Raj Vaidya", type: "youtube", subtitle: "Trending search" },
  { query: "Trending Hindi songs", type: "youtube", subtitle: "Trending search" },
  { query: "Anuv Jain", type: "youtube", subtitle: "Trending search" },
  { query: "Pritam", type: "youtube", subtitle: "Trending search" },
  { query: "Lo-fi chill beats", type: "youtube", subtitle: "Trending search" },
  { query: "AP Dhillon", type: "youtube", subtitle: "Trending search" },
  { query: "A.R. Rahman", type: "youtube", subtitle: "Trending search" },
];

const suggestCache = new Map<string, { at: number; suggestions: SuggestItem[] }>();

function getCached(key: string): SuggestItem[] | null {
  const entry = suggestCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at >= CACHE_TTL_MS) {
    suggestCache.delete(key);
    return null;
  }
  return entry.suggestions;
}

function setCached(key: string, suggestions: SuggestItem[]): void {
  const now = Date.now();
  if (suggestCache.size >= MAX_CACHE_ENTRIES) {
    for (const [k, v] of suggestCache) {
      if (now - v.at >= CACHE_TTL_MS) suggestCache.delete(k);
      if (suggestCache.size < MAX_CACHE_ENTRIES) break;
    }
    if (suggestCache.size >= MAX_CACHE_ENTRIES) {
      const oldest = suggestCache.keys().next().value;
      if (oldest !== undefined) suggestCache.delete(oldest);
    }
  }
  suggestCache.set(key, { at: now, suggestions });
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchScore(candidate: string, query: string): number {
  const norm = normalize(candidate);
  if (!norm || !norm.includes(query)) return 0;
  if (norm === query) return 100;
  if (norm.startsWith(query)) return 70;
  if (norm.split(/\s+/).some((word) => word.startsWith(query))) return 45;
  return 20;
}

function findLocalMatches(rawQuery: string): SuggestItem[] {
  const query = normalize(rawQuery);
  if (!query) return [];

  const scored: Array<{ score: number; item: SuggestItem }> = [];

  for (const artist of artists) {
    const names = [artist.name, ...(artist.aliases ?? [])];
    const best = Math.max(...names.map((name) => matchScore(name, query)));
    if (best > 0) {
      scored.push({
        score: best + 10,
        item: {
          query: artist.name,
          type: "artist",
          subtitle: "Artist",
          artwork: artist.image,
          href: `/artist/${artist.id}`,
        },
      });
    }
  }

  for (const album of albums) {
    const s = matchScore(album.title, query);
    if (s > 0) {
      const artistName = getArtist(album.artistId)?.name;
      scored.push({
        score: s + 4,
        item: {
          query: album.title,
          type: "album",
          subtitle: artistName ? `Album · ${artistName}` : "Album",
          artwork: album.artwork,
          href: `/album/${album.id}`,
        },
      });
    }
  }

  for (const track of tracks) {
    const s = matchScore(track.title, query);
    if (s > 0) {
      const artistName = getArtist(track.artistId)?.name;
      scored.push({
        score: s,
        item: {
          query: track.title,
          type: "track",
          subtitle: artistName ? `Track · ${artistName}` : "Track",
          artwork: track.artwork,
          href: `/album/${track.albumId}`,
        },
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const picked: SuggestItem[] = [];
  const seen = new Set<string>();
  for (const entry of scored) {
    const key = entry.item.query.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(entry.item);
    if (picked.length >= 3) break;
  }
  return picked;
}

function parseJsonpSuggestions(raw: string): string[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end <= start) return [];

  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    if (!Array.isArray(parsed) || !Array.isArray(parsed[1])) return [];
    const results: string[] = [];
    for (const item of parsed[1]) {
      if (typeof item === "string" && item.trim()) {
        results.push(item.trim().slice(0, 120));
      } else if (Array.isArray(item) && typeof item[0] === "string" && item[0].trim()) {
        results.push(item[0].trim().slice(0, 120));
      }
    }
    return results;
  } catch {
    return [];
  }
}

async function fetchYouTubeAutocomplete(query: string): Promise<string[]> {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  try {
    const url = `https://suggestqueries-clients6.youtube.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (response.ok) {
      const text = await response.text();
      const parsed = parseJsonpSuggestions(text);
      if (parsed.length > 0) return parsed;
    }
  } catch {
    // Fall through to Google firefox JSON endpoint.
  }

  try {
    const fallbackUrl = `https://clients1.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`;
    const response = await fetch(fallbackUrl, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (response.ok) {
      const payload = (await response.json()) as unknown;
      if (Array.isArray(payload) && Array.isArray(payload[1])) {
        return payload[1]
          .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
          .map((entry) => entry.trim().slice(0, 120));
      }
    }
  } catch {
    // Return empty so local catalog suggestions still work offline.
  }

  return [];
}

export async function GET(request: Request) {
  const rateLimited = enforceRateLimit(request, "youtube:suggest", 60, 60_000);
  if (rateLimited) return rateLimited;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json(
      { suggestions: POPULAR_CHIPS },
      { headers: { "Cache-Control": "private, max-age=120" } },
    );
  }

  if (q.length > 100) {
    return NextResponse.json(
      { suggestions: [], error: "invalid_query" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const cacheKey = q.toLowerCase();
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(
      { suggestions: cached, cached: true },
      { headers: { "Cache-Control": "private, max-age=120" } },
    );
  }

  const [localMatches, ytSuggestions] = await Promise.all([
    Promise.resolve(findLocalMatches(q)),
    fetchYouTubeAutocomplete(q),
  ]);

  const merged: SuggestItem[] = [];
  const seen = new Set<string>();

  for (const item of localMatches) {
    const key = item.query.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  for (const text of ytSuggestions) {
    const key = text.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push({
      query: text,
      type: "youtube",
    });
    if (merged.length >= MAX_SUGGESTIONS) break;
  }

  const finalSuggestions = merged.slice(0, MAX_SUGGESTIONS);
  setCached(cacheKey, finalSuggestions);

  return NextResponse.json(
    { suggestions: finalSuggestions },
    { headers: { "Cache-Control": "private, max-age=120" } },
  );
}
