import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/google-auth";
import { getManagedUser } from "@/lib/admin-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TrackState = { source: "youtube"; videoId: string; title: string; artist: string; album: string; artwork: string; duration: number } | { source: "audius"; trackId: string; title: string; artist: string; album: string; artwork: string; duration: number };

function database() {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Device storage is not configured");
  return { base, key };
}

async function db(path: string, init?: RequestInit) {
  const { base, key } = database();
  return fetch(`${base}/rest/v1/${path}`, { ...init, cache: "no-store", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...init?.headers } });
}

async function activeUser(request: NextRequest) {
  const identity = verifySession(request.cookies.get("aura_session")?.value);
  if (!identity) return null;
  const user = await getManagedUser(`google:${identity.sub}`);
  return user?.status === "active" ? `google:${identity.sub}` : null;
}

function safeTrack(value: unknown): TrackState | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.title !== "string" || typeof item.artist !== "string") return null;
  const common = { title: item.title.slice(0, 180), artist: item.artist.slice(0, 140), album: typeof item.album === "string" ? item.album.slice(0, 180) : "", artwork: safeArtwork(item.artwork), duration: Number.isFinite(item.duration) ? Math.max(0, Math.min(86400, Number(item.duration))) : 0 };
  if (item.source === "youtube" && typeof item.videoId === "string" && /^[\w-]{11}$/.test(item.videoId)) return { ...common, source: "youtube", videoId: item.videoId };
  if (item.source === "audius" && typeof item.trackId === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(item.trackId)) return { ...common, source: "audius", trackId: item.trackId };
  return null;
}

function safeArtwork(value: unknown) {
  if (typeof value !== "string") return "";
  if (value.startsWith("/art/") && !value.includes("..")) return value.slice(0, 300);
  try {
    const url = new URL(value);
    const allowed = ["i.ytimg.com", "img.youtube.com", "yt3.ggpht.com"].includes(url.hostname) || url.hostname === "audius.co" || url.hostname.endsWith(".audius.co");
    return url.protocol === "https:" && allowed ? url.toString().slice(0, 600) : "";
  } catch { return ""; }
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).origin === new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await activeUser(request);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
    const deviceId = request.nextUrl.searchParams.get("deviceId") ?? "";
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(deviceId)) return NextResponse.json({ error: "invalid_device" }, { status: 400 });
    const params = new URLSearchParams({ user_id: `eq.${userId}`, device_id: `eq.${deviceId}`, select: "command_id,command", limit: "1" });
    const commandResponse = await db(`sangeet_device_presence?${params}`);
    if (!commandResponse.ok) throw new Error("Device storage unavailable");
    const commandRows = await commandResponse.json() as { command_id: string | null; command: unknown }[];
    const activeAfter = new Date(Date.now() - 45_000).toISOString();
    const deviceParams = new URLSearchParams({ user_id: `eq.${userId}`, last_seen: `gt.${activeAfter}`, select: "device_id,device_name,device_type,is_playing,current_time,current_track,last_seen", order: "last_seen.desc", limit: "12" });
    const response = await db(`sangeet_device_presence?${deviceParams}`);
    if (!response.ok) throw new Error("Device storage unavailable");
    const devices = (await response.json() as Record<string, unknown>[]).map((item) => ({ deviceId: String(item.device_id), name: String(item.device_name), type: String(item.device_type), isPlaying: Boolean(item.is_playing), currentTime: Number(item.current_time) || 0, track: safeTrack(item.current_track), lastSeen: String(item.last_seen) }));
    return NextResponse.json({ devices, command: commandRows[0] ? { id: commandRows[0].command_id, value: commandRows[0].command } : null }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "device_storage_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await activeUser(request);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (Number(request.headers.get("content-length") ?? 0) > 12_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
    const body = await request.json() as Record<string, unknown>;
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(deviceId)) return NextResponse.json({ error: "invalid_device" }, { status: 400 });
    const deviceName = typeof body.name === "string" ? body.name.trim().slice(0, 48) : "Sangeet device";
    const deviceType = ["phone", "tablet", "computer", "browser"].includes(String(body.type)) ? String(body.type) : "browser";
    const currentTrack = safeTrack(body.track);
    const currentTime = Number.isFinite(body.currentTime) ? Math.max(0, Math.min(86400, Number(body.currentTime))) : 0;
    const payload = { user_id: userId, device_id: deviceId, device_name: deviceName || "Sangeet device", device_type: deviceType, is_playing: Boolean(body.isPlaying && currentTrack), current_time: currentTime, current_track: currentTrack, last_seen: new Date().toISOString() };
    const params = new URLSearchParams({ on_conflict: "user_id,device_id" });
    const response = await db(`sangeet_device_presence?${params}`, { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error("Device heartbeat failed");
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "device_storage_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
