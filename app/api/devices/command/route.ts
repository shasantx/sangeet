import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/google-auth";
import { getManagedUser } from "@/lib/admin-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dbConfig() {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Device storage is not configured");
  return { base, key };
}

async function db(path: string, init: RequestInit) {
  const { base, key } = dbConfig();
  return fetch(`${base}/rest/v1/${path}`, { ...init, cache: "no-store", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...init.headers } });
}

function cleanTrack(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const track = value as Record<string, unknown>;
  const title = typeof track.title === "string" ? track.title.trim().slice(0, 180) : "";
  const artist = typeof track.artist === "string" ? track.artist.trim().slice(0, 140) : "";
  if (!title || !artist) return null;
  const artwork = typeof track.artwork === "string" && (track.artwork.startsWith("/art/") || /^https:\/\/(i\.ytimg\.com|img\.youtube\.com|yt3\.ggpht\.com|(?:[A-Za-z0-9-]+\.)*audius\.co)\//.test(track.artwork)) ? track.artwork.slice(0, 600) : "";
  const common = { title, artist, album: typeof track.album === "string" ? track.album.slice(0, 180) : "", artwork, duration: Number.isFinite(track.duration) ? Math.min(86400, Math.max(0, Number(track.duration))) : 0 };
  if (track.source === "youtube" && typeof track.videoId === "string" && /^[\w-]{11}$/.test(track.videoId)) return { ...common, source: "youtube", videoId: track.videoId };
  if (track.source === "audius" && typeof track.trackId === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(track.trackId)) return { ...common, source: "audius", trackId: track.trackId };
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).origin !== new URL(request.url).origin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const identity = verifySession(request.cookies.get("aura_session")?.value);
    if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const profile = await getManagedUser(`google:${identity.sub}`);
    if (profile?.status !== "active") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(deviceId) || !["play", "pause", "next", "previous"].includes(String(body.action))) return NextResponse.json({ error: "invalid_command" }, { status: 400 });
    const targetParams = new URLSearchParams({ user_id: `eq.google:${identity.sub}`, device_id: `eq.${deviceId}`, last_seen: `gt.${new Date(Date.now() - 45_000).toISOString()}`, select: "device_id", limit: "1" });
    const target = await db(`sangeet_device_presence?${targetParams}`, { method: "GET" });
    if (!target.ok) throw new Error("Target lookup failed");
    if (!(await target.json() as unknown[]).length) return NextResponse.json({ error: "device_offline" }, { status: 404 });
    const action = String(body.action);
    const track = action === "play" ? cleanTrack(body.track) : null;
    if (action === "play" && !track) return NextResponse.json({ error: "track_unavailable_on_device" }, { status: 400 });
    const commandId = crypto.randomUUID();
    const command = { action, track, currentTime: Number.isFinite(body.currentTime) ? Math.max(0, Math.min(86400, Number(body.currentTime))) : 0, sentAt: new Date().toISOString() };
    const patchParams = new URLSearchParams({ user_id: `eq.google:${identity.sub}`, device_id: `eq.${deviceId}` });
    const response = await db(`sangeet_device_presence?${patchParams}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ command_id: commandId, command }) });
    if (!response.ok) throw new Error("Command delivery failed");
    return NextResponse.json({ ok: true, commandId }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "device_storage_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
