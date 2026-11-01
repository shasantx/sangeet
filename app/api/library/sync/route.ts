import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/google-auth";
import { getManagedUser } from "@/lib/admin-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Library = {
  likedTrackIds: string[];
  savedAlbumIds: string[];
  followedArtistIds: string[];
  recentlyPlayed: string[];
  recentlyPlayedAt: Record<string, number>;
  playlists: { id: string; title: string; description: string; artwork?: string; trackIds: string[]; createdAt: number; updatedAt: number }[];
  tracks: ({ source?: "youtube"; videoId: string; title: string; artist: string; album?: string; durationSeconds?: number; thumbnail?: string; year?: number } | { source: "audius"; trackId: string; title: string; artist: string; album?: string; durationSeconds?: number; thumbnail?: string; genre?: string })[];
};

function database() {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Library storage is not configured");
  return { base, key };
}

async function db(path: string, init?: RequestInit) {
  const { base, key } = database();
  return fetch(`${base}/rest/v1/${path}`, { ...init, cache: "no-store", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...init?.headers } });
}

async function authorized(request: NextRequest) {
  const identity = verifySession(request.cookies.get("aura_session")?.value);
  if (!identity) return null;
  const user = await getManagedUser(`google:${identity.sub}`);
  return user?.status === "active" ? `google:${identity.sub}` : null;
}

function boundedStrings(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 180))].slice(0, limit);
}

function cleanLibrary(value: unknown): Library {
  const x = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const playlists = Array.isArray(x.playlists) ? x.playlists.slice(0, 100).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const p = item as Record<string, unknown>;
    if (typeof p.id !== "string" || !p.id.startsWith("user-") || typeof p.title !== "string") return [];
    const artwork = typeof p.artwork === "string" && (p.artwork.startsWith("/art/") || /^https:\/\/(i\.ytimg\.com|img\.youtube\.com|yt3\.ggpht\.com)\//.test(p.artwork)) ? p.artwork.slice(0, 600) : undefined;
    return [{ id: p.id.slice(0, 100), title: p.title.slice(0, 80), description: typeof p.description === "string" ? p.description.slice(0, 240) : "", artwork, trackIds: boundedStrings(p.trackIds, 500), createdAt: Number.isFinite(p.createdAt) ? Number(p.createdAt) : Date.now(), updatedAt: Number.isFinite(p.updatedAt) ? Number(p.updatedAt) : Date.now() }];
  }) : [];
  const tracks = Array.isArray(x.tracks) ? x.tracks.slice(0, 80).flatMap<Library["tracks"][number]>((item) => {
    if (!item || typeof item !== "object") return [];
    const t = item as Record<string, unknown>;
    if (typeof t.title !== "string") return [];
    if (t.source === "audius") {
      if (typeof t.trackId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(t.trackId)) return [];
      const thumbnail = typeof t.thumbnail === "string" && /^https:\/\/(?:[A-Za-z0-9-]+\.)*audius\.co\//.test(t.thumbnail) ? t.thumbnail.slice(0, 600) : undefined;
      return [{ source: "audius" as const, trackId: t.trackId, title: t.title.slice(0, 180), artist: typeof t.artist === "string" ? t.artist.slice(0, 140) : "Independent artist", album: typeof t.album === "string" ? t.album.slice(0, 160) : "", durationSeconds: Number.isFinite(t.durationSeconds) ? Math.min(86400, Number(t.durationSeconds)) : 0, thumbnail, genre: typeof t.genre === "string" ? t.genre.slice(0, 80) : "" }];
    }
    if (typeof t.videoId !== "string" || !/^[\w-]{11}$/.test(t.videoId)) return [];
    const thumbnail = typeof t.thumbnail === "string" && /^https:\/\/(i\.ytimg\.com|img\.youtube\.com|yt3\.ggpht\.com)\//.test(t.thumbnail) ? t.thumbnail.slice(0, 600) : undefined;
    return [{ source: "youtube" as const, videoId: t.videoId, title: t.title.slice(0, 180), artist: typeof t.artist === "string" ? t.artist.slice(0, 140) : "Music", album: typeof t.album === "string" ? t.album.slice(0, 160) : "", durationSeconds: Number.isFinite(t.durationSeconds) ? Math.min(86400, Number(t.durationSeconds)) : 0, thumbnail, year: Number.isFinite(t.year) ? Number(t.year) : undefined }];
  }) : [];
  const recentIds = boundedStrings(x.recentlyPlayed, 500);
  const recentInput = x.recentlyPlayedAt && typeof x.recentlyPlayedAt === "object" ? x.recentlyPlayedAt as Record<string, unknown> : {};
  const recentlyPlayedAt = Object.fromEntries(Object.entries(recentInput).filter(([id, at]) => recentIds.includes(id) && typeof at === "number" && Number.isFinite(at) && at >= 0 && at <= Date.now() + 300_000).slice(0, 500)) as Record<string, number>;
  return { likedTrackIds: boundedStrings(x.likedTrackIds, 1000), savedAlbumIds: boundedStrings(x.savedAlbumIds, 500), followedArtistIds: boundedStrings(x.followedArtistIds, 500), recentlyPlayed: recentIds, recentlyPlayedAt, playlists, tracks };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await authorized(request);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
    const params = new URLSearchParams({ user_id: `eq.${userId}`, select: "library,updated_at", limit: "1" });
    const response = await db(`user_library_state?${params}`);
    if (!response.ok) throw new Error("Library read failed");
    const rows = await response.json() as { library: unknown; updated_at: string }[];
    return NextResponse.json({ library: rows[0] ? cleanLibrary(rows[0].library) : null, updatedAt: rows[0]?.updated_at ?? null }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "library_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await authorized(request);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).origin !== new URL(request.url).origin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > 256_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
    const body = await request.json();
    const library = cleanLibrary(body?.library);
    if (JSON.stringify(library).length > 256_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
    const response = await db("user_library_state?on_conflict=user_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ user_id: userId, library, updated_at: new Date().toISOString() }) });
    if (!response.ok) throw new Error("Library write failed");
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "library_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
