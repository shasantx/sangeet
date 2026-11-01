import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/google-auth";
import { refreshYouTubeAccessToken } from "@/lib/youtube-account";
import { getManagedUser } from "@/lib/admin-users";

export const runtime = "nodejs";

function safeImage(value: unknown) {
  if (typeof value !== "string") return "";
  try { const url = new URL(value); return url.protocol === "https:" && ["i.ytimg.com", "yt3.ggpht.com"].includes(url.hostname) ? url.toString() : ""; } catch { return ""; }
}

export async function GET(request: NextRequest) {
  const identity = verifySession(request.cookies.get("aura_session")?.value);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const profile = await getManagedUser(`google:${identity.sub}`).catch(() => null);
  if (profile?.status !== "active") return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  const pageToken = params.get("pageToken") ?? "";
  if (!(["playlists", "liked", "playlist-items"].includes(type ?? "") && pageToken.length <= 2048)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const playlistId = params.get("playlistId") ?? "";
  if (type === "playlist-items" && !/^[\w-]{10,80}$/.test(playlistId)) return NextResponse.json({ error: "invalid_playlist" }, { status: 400 });
  try {
    const token = await refreshYouTubeAccessToken(`google:${identity.sub}`);
    const api = new URL(type === "playlist-items" ? "https://www.googleapis.com/youtube/v3/playlistItems" : type === "liked" ? "https://www.googleapis.com/youtube/v3/videos" : "https://www.googleapis.com/youtube/v3/playlists");
    if (type === "liked") { api.searchParams.set("part", "snippet,contentDetails"); api.searchParams.set("myRating", "like"); }
    else if (type === "playlist-items") { api.searchParams.set("part", "snippet,contentDetails"); api.searchParams.set("playlistId", playlistId); }
    else { api.searchParams.set("part", "snippet,contentDetails"); api.searchParams.set("mine", "true"); }
    api.searchParams.set("maxResults", "50");
    if (pageToken) api.searchParams.set("pageToken", pageToken);
    const response = await fetch(api, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(9000) });
    if (!response.ok) return NextResponse.json({ error: response.status === 403 ? "youtube_access_denied" : "youtube_unavailable" }, { status: response.status === 403 ? 403 : 502 });
    const payload = await response.json() as { items?: Record<string, unknown>[]; nextPageToken?: string };
    const items = (payload.items ?? []).map((item) => {
      const snippet = item.snippet as Record<string, unknown> | undefined;
      const details = item.contentDetails as Record<string, unknown> | undefined;
      const thumbnails = snippet?.thumbnails as Record<string, { url?: string }> | undefined;
      const id = type === "playlists" ? item.id : (details?.videoId ?? item.id);
      return { id: typeof id === "string" ? id : "", title: typeof snippet?.title === "string" ? snippet.title.slice(0, 180) : "Untitled", channelTitle: typeof snippet?.channelTitle === "string" ? snippet.channelTitle.slice(0, 140) : "", description: typeof snippet?.description === "string" ? snippet.description.slice(0, 300) : "", thumbnail: safeImage(thumbnails?.maxres?.url ?? thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url), itemCount: typeof (item.contentDetails as Record<string, unknown> | undefined)?.itemCount === "number" ? (item.contentDetails as Record<string, number>).itemCount : undefined, publishedAt: typeof snippet?.publishedAt === "string" ? snippet.publishedAt : undefined };
    }).filter((item) => item.id);
    return NextResponse.json({ items, nextPageToken: payload.nextPageToken ?? null }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("not connected") ? "not_connected" : error instanceof Error && error.message.includes("Reconnect") ? "reconnect_required" : "youtube_unavailable";
    return NextResponse.json({ error: message }, { status: message === "not_connected" ? 409 : 502 });
  }
}
