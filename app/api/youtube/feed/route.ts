import { NextRequest, NextResponse } from "next/server";
import {
  appUrl,
  googleClientId,
  googleClientSecret,
  sealYouTubeCookie,
  secureCookies,
  unsealYouTubeCookie,
  verifySession,
  type YouTubeCookieTokens,
} from "@/lib/google-auth";
import { isYouTubeTokenStorageConfigured, refreshYouTubeAccessToken } from "@/lib/youtube-account";
import { enforceRateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface YouTubeFeedTrack {
  videoId: string;
  title: string;
  artist: string;
  durationSeconds: number;
  thumbnail: string;
}

export interface YouTubeFeedPlaylist {
  id: string;
  title: string;
  thumbnail: string;
  itemCount?: number;
}

function safeImage(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["i.ytimg.com", "img.youtube.com", "yt3.ggpht.com"].includes(url.hostname)
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function parseIsoDuration(iso: unknown): number {
  if (typeof iso !== "string") return 0;
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function cleanChannelArtist(channelTitle: string): string {
  return channelTitle
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/\s*(VEVO|Official)$/i, "")
    .trim();
}

async function refreshCookieToken(cookieTokens: YouTubeCookieTokens): Promise<YouTubeCookieTokens | null> {
  if (cookieTokens.expires_at > Date.now() + 60_000) {
    return cookieTokens;
  }
  if (!cookieTokens.refresh_token) return null;
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: googleClientId(),
        client_secret: googleClientSecret(),
        refresh_token: cookieTokens.refresh_token,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!payload.access_token) return null;
    return {
      access_token: payload.access_token,
      refresh_token: cookieTokens.refresh_token,
      expires_at: Date.now() + (payload.expires_in ?? 3600) * 1000,
    };
  } catch {
    return null;
  }
}

async function ytGet(path: string, params: Record<string, string>, token: string) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  return (await response.json()) as { items?: Record<string, unknown>[] };
}

function mapVideoItem(item: Record<string, unknown>, idOverride?: string): {
  track: YouTubeFeedTrack;
  isMusic: boolean;
} | null {
  const snippet = item.snippet as Record<string, unknown> | undefined;
  const details = item.contentDetails as Record<string, unknown> | undefined;
  const thumbnails = snippet?.thumbnails as Record<string, { url?: string }> | undefined;
  const idObj = item.id && typeof item.id === "object" ? (item.id as Record<string, unknown>) : null;
  const rawId = idOverride ?? (typeof item.id === "string" ? item.id : idObj?.videoId) ?? details?.videoId;
  if (typeof rawId !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(rawId)) return null;

  const title = typeof snippet?.title === "string" ? snippet.title.slice(0, 180) : "";
  if (!title || title === "Deleted video" || title === "Private video") return null;

  const channel = typeof snippet?.channelTitle === "string" ? snippet.channelTitle.slice(0, 140) : "YouTube Music";
  const artist = cleanChannelArtist(channel) || "YouTube Music";
  const thumbnail =
    safeImage(
      thumbnails?.maxres?.url ?? thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url,
    ) || `https://i.ytimg.com/vi/${rawId}/hqdefault.jpg`;

  const categoryId = typeof snippet?.categoryId === "string" ? snippet.categoryId : "";
  const isMusic =
    categoryId === "10" ||
    /-\s*Topic$/i.test(channel) ||
    /(official\s*(music\s*)?video|official\s*audio|lyric|lyrics|vevo|acoustic|remix)/i.test(title);

  return {
    track: {
      videoId: rawId,
      title,
      artist,
      durationSeconds: parseIsoDuration(details?.duration),
      thumbnail,
    },
    isMusic,
  };
}

export async function GET(request: NextRequest) {
  const rateLimited = enforceRateLimit(request, "youtube:feed", 40, 60_000);
  if (rateLimited) return rateLimited;

  const identity = verifySession(request.cookies.get("aura_session")?.value);
  const rawYtCookie = request.cookies.get("sangeet_yt_oauth")?.value;
  if (!identity && !rawYtCookie) {
    return NextResponse.json(
      { connected: false, liked: [], suggested: [], playlists: [], seeds: [] },
      { headers: { "cache-control": "no-store" } },
    );
  }

  let accessToken: string | null = null;
  let updatedCookieTokens: YouTubeCookieTokens | null = null;

  if (identity && isYouTubeTokenStorageConfigured()) {
    try {
      accessToken = await refreshYouTubeAccessToken(`google:${identity.sub}`);
    } catch {
      accessToken = null;
    }
  }

  if (!accessToken && rawYtCookie) {
    const unsealed = unsealYouTubeCookie(rawYtCookie);
    if (unsealed) {
      const refreshed = await refreshCookieToken(unsealed);
      if (refreshed) {
        accessToken = refreshed.access_token;
        if (refreshed.access_token !== unsealed.access_token) {
          updatedCookieTokens = refreshed;
        }
      }
    }
  }

  if (!accessToken) {
    return NextResponse.json(
      { connected: false, liked: [], suggested: [], playlists: [], seeds: [] },
      { headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const [likedPayload, playlistsPayload] = await Promise.all([
      ytGet("videos", { part: "snippet,contentDetails", myRating: "like", maxResults: "25" }, accessToken),
      ytGet("playlists", { part: "snippet,contentDetails", mine: "true", maxResults: "10" }, accessToken),
    ]);

    const mappedLiked = (likedPayload?.items ?? [])
      .map((item) => mapVideoItem(item))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const musicLiked = mappedLiked.filter((e) => e.isMusic).map((e) => e.track);
    const liked: YouTubeFeedTrack[] =
      musicLiked.length >= 4 ? musicLiked : mappedLiked.map((e) => e.track);

    const playlists: YouTubeFeedPlaylist[] = (playlistsPayload?.items ?? [])
      .map((item) => {
        const id = typeof item.id === "string" ? item.id : "";
        const snippet = item.snippet as Record<string, unknown> | undefined;
        const details = item.contentDetails as Record<string, unknown> | undefined;
        const thumbnails = snippet?.thumbnails as Record<string, { url?: string }> | undefined;
        return {
          id,
          title: typeof snippet?.title === "string" ? snippet.title.slice(0, 140) : "Playlist",
          thumbnail: safeImage(
            thumbnails?.maxres?.url ?? thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url,
          ),
          itemCount: typeof details?.itemCount === "number" ? details.itemCount : undefined,
        };
      })
      .filter((p) => p.id && !p.id.startsWith("LL"));

    // If user has few liked music tracks, also pull items from their first playlist.
    let playlistTracks: YouTubeFeedTrack[] = [];
    if (liked.length < 6 && playlists.length > 0) {
      const firstPl = await ytGet(
        "playlistItems",
        { part: "snippet,contentDetails", playlistId: playlists[0].id, maxResults: "12" },
        accessToken,
      );
      playlistTracks = (firstPl?.items ?? [])
        .map((item) => {
          const details = item.contentDetails as Record<string, unknown> | undefined;
          const vid = typeof details?.videoId === "string" ? details.videoId : undefined;
          return mapVideoItem(item, vid)?.track ?? null;
        })
        .filter((t): t is YouTubeFeedTrack => t !== null);
    }

    const seedSource = liked.length > 0 ? liked : playlistTracks;
    const seeds = Array.from(
      new Set(
        seedSource
          .map((t) => t.artist)
          .filter((name) => name && name.toLowerCase() !== "youtube music"),
      ),
    ).slice(0, 2);

    const likedIds = new Set(liked.map((t) => t.videoId));
    const suggestedMap = new Map<string, YouTubeFeedTrack>();

    if (seeds.length > 0) {
      const searchPayloads = await Promise.all(
        seeds.map((seed) =>
          ytGet(
            "search",
            {
              part: "snippet",
              type: "video",
              videoCategoryId: "10",
              maxResults: "10",
              q: `${seed} music`,
            },
            accessToken!,
          ),
        ),
      );
      for (const payload of searchPayloads) {
        for (const item of payload?.items ?? []) {
          const mapped = mapVideoItem(item);
          if (!mapped) continue;
          if (!likedIds.has(mapped.track.videoId) && !suggestedMap.has(mapped.track.videoId)) {
            suggestedMap.set(mapped.track.videoId, mapped.track);
          }
        }
      }
    }

    const suggested = Array.from(suggestedMap.values()).slice(0, 16);
    const response = NextResponse.json(
      {
        connected: true,
        liked: liked.slice(0, 16),
        suggested: suggested.length > 0 ? suggested : playlistTracks.slice(0, 16),
        playlists: playlists.slice(0, 8),
        seeds,
      },
      { headers: { "cache-control": "no-store" } },
    );

    if (updatedCookieTokens) {
      const sealed = sealYouTubeCookie(updatedCookieTokens);
      if (sealed) {
        let secure = true;
        try {
          secure = secureCookies(appUrl(request.url));
        } catch {
          // Keep secure enabled.
        }
        response.cookies.set("sangeet_yt_oauth", sealed, {
          httpOnly: true,
          secure,
          sameSite: "lax",
          path: "/",
          maxAge: 7 * 24 * 60 * 60,
        });
      }
    }

    return response;
  } catch {
    return NextResponse.json(
      { connected: false, liked: [], suggested: [], playlists: [], seeds: [] },
      { headers: { "cache-control": "no-store" } },
    );
  }
}
