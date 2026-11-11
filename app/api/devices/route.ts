import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { appUrl, secureCookies, verifySession } from "@/lib/google-auth";
import { getManagedUser, isAdminStorageConfigured } from "@/lib/admin-users";
import {
  ackDeviceCommand,
  getActiveDevices,
  popDeviceCommand,
  registerDevice,
  type DeviceState,
} from "@/lib/device-hub";
import { enforceRateLimit, safeJsonParse, verifySameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function database() {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  return { base, key };
}

async function db(path: string, init?: RequestInit) {
  const dbInfo = database();
  if (!dbInfo) return null;
  try {
    return await fetch(`${dbInfo.base}/rest/v1/${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
      headers: {
        apikey: dbInfo.key,
        authorization: `Bearer ${dbInfo.key}`,
        "content-type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    return null;
  }
}

async function resolveUserId(request: NextRequest): Promise<{ userId: string; setGuestCookie?: string }> {
  // 1. Cryptographically verified Google OAuth session cookie ONLY
  try {
    const identity = verifySession(request.cookies.get("aura_session")?.value);
    if (identity?.sub) {
      if (isAdminStorageConfigured()) {
        const user = await getManagedUser(`google:${identity.sub}`);
        if (user?.status === "active") {
          return { userId: `google:${identity.sub}` };
        }
      } else {
        return { userId: `google:${identity.sub}` };
      }
    }
  } catch {
    // Fall through to guest sync room
  }

  // 2. Guest Sync Room token (must be high-entropy 16..80 chars, isolated in guest: namespace)
  const headerSync = request.headers.get("x-sangeet-sync-id");
  const cookieSync = request.cookies.get("sangeet_guest_sync")?.value;
  const querySync = request.nextUrl.searchParams.get("syncId");
  const candidate = (headerSync || cookieSync || querySync || "").trim();

  if (candidate && /^[A-Za-z0-9_-]{16,80}$/.test(candidate)) {
    return { userId: `guest:${candidate}` };
  }

  // Auto-generate a 192-bit cryptographic guest sync room token
  const newGuestSync = randomBytes(24).toString("base64url");
  return { userId: `guest:${newGuestSync}`, setGuestCookie: newGuestSync };
}

function safeTrack(value: unknown): DeviceState["track"] {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.title !== "string" || typeof item.artist !== "string") return null;
  const common = {
    title: item.title.slice(0, 180),
    artist: item.artist.slice(0, 140),
    album: typeof item.album === "string" ? item.album.slice(0, 180) : "",
    artwork: safeArtwork(item.artwork),
    duration: Number.isFinite(item.duration) ? Math.max(0, Math.min(86400, Number(item.duration))) : 0,
  };
  if (item.source === "youtube" && typeof item.videoId === "string" && /^[\w-]{11}$/.test(item.videoId)) {
    return { ...common, source: "youtube", videoId: item.videoId };
  }
  if (item.source === "audius" && typeof item.trackId === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(item.trackId)) {
    return { ...common, source: "audius", trackId: item.trackId };
  }
  return null;
}

function safeArtwork(value: unknown): string {
  if (typeof value !== "string") return "";
  if (value.startsWith("/art/") && !value.includes("..")) return value.slice(0, 300);
  try {
    const url = new URL(value);
    const allowed =
      ["i.ytimg.com", "img.youtube.com", "yt3.ggpht.com"].includes(url.hostname) ||
      url.hostname.endsWith(".googleusercontent.com") ||
      url.hostname === "audius.co" ||
      url.hostname.endsWith(".audius.co");
    return url.protocol === "https:" && allowed ? url.toString().slice(0, 600) : "";
  } catch {
    return "";
  }
}

function isSecureRequest(request: NextRequest): boolean {
  try {
    return secureCookies(appUrl(request.url));
  } catch {
    return request.nextUrl.protocol === "https:";
  }
}

export async function GET(request: NextRequest) {
  const rateLimited = enforceRateLimit(request, "devices:get", 120, 60_000);
  if (rateLimited) return rateLimited;

  try {
    const { userId, setGuestCookie } = await resolveUserId(request);
    const rawDeviceId = request.nextUrl.searchParams.get("deviceId") ?? "";
    const deviceId = /^[A-Za-z0-9_-]{8,80}$/.test(rawDeviceId) ? rawDeviceId : "";
    const rawAckId = request.nextUrl.searchParams.get("ack") ?? "";
    const ackId = /^[A-Za-z0-9_-]{8,160}$/.test(rawAckId) ? rawAckId : "";

    if (ackId && deviceId) {
      ackDeviceCommand(userId, deviceId, ackId);
    }

    // 1. Get in-memory devices
    const devices = getActiveDevices(userId);

    // 2. Pop pending command for this device
    const pending = deviceId ? popDeviceCommand(userId, deviceId) : null;
    const commandPayload = pending
      ? {
          id: pending.id,
          value: {
            action: pending.action,
            track: pending.track,
            currentTime: pending.currentTime,
            volume: pending.volume,
            sentAt: pending.sentAt,
          },
        }
      : null;

    const response = NextResponse.json(
      {
        devices,
        command: commandPayload,
      },
      { headers: { "cache-control": "no-store" } },
    );

    if (setGuestCookie) {
      response.cookies.set("sangeet_guest_sync", setGuestCookie, {
        path: "/",
        sameSite: "lax",
        secure: isSecureRequest(request),
        maxAge: 365 * 86400,
        httpOnly: true,
      });
    }

    return response;
  } catch {
    return NextResponse.json(
      { error: "device_service_unavailable" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}

export async function PUT(request: NextRequest) {
  const rateLimited = enforceRateLimit(request, "devices:put", 120, 60_000);
  if (rateLimited) return rateLimited;

  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: { "cache-control": "no-store" } });
  }

  const parsedBody = await safeJsonParse<Record<string, unknown>>(request, 16_384);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: "invalid_request", message: parsedBody.error },
      { status: parsedBody.status, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const { userId, setGuestCookie } = await resolveUserId(request);
    const body = parsedBody.data;

    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(deviceId)) {
      return NextResponse.json({ error: "invalid_device" }, { status: 400, headers: { "cache-control": "no-store" } });
    }

    const deviceName = typeof body.name === "string" ? body.name.trim().slice(0, 48) : "Sangeet device";
    const deviceType = ["phone", "tablet", "computer", "browser"].includes(String(body.type))
      ? (String(body.type) as DeviceState["type"])
      : "browser";
    const currentTrack = safeTrack(body.track);
    const currentTime = Number.isFinite(body.currentTime)
      ? Math.max(0, Math.min(86400, Number(body.currentTime)))
      : 0;
    const volume = Number.isFinite(body.volume) ? Math.max(0, Math.min(1, Number(body.volume))) : undefined;

    // 1. Update in-memory registry immediately
    registerDevice(userId, {
      deviceId,
      name: deviceName || "Sangeet device",
      type: deviceType,
      isPlaying: Boolean(body.isPlaying && currentTrack),
      currentTime,
      volume,
      track: currentTrack,
    });

    // 2. Best-effort async persistence to Supabase if table exists and user is a registered profile
    if (userId.startsWith("google:")) {
      void (async () => {
        try {
          const payload = {
            user_id: userId,
            device_id: deviceId,
            device_name: deviceName || "Sangeet device",
            device_type: deviceType,
            is_playing: Boolean(body.isPlaying && currentTrack),
            current_time: currentTime,
            current_track: currentTrack,
            last_seen: new Date().toISOString(),
          };
          const params = new URLSearchParams({ on_conflict: "user_id,device_id" });
          await db(`sangeet_device_presence?${params}`, {
            method: "POST",
            headers: { prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify(payload),
          });
        } catch {
          // Safe to ignore in memory-backed mode
        }
      })();
    }

    const response = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });

    if (setGuestCookie) {
      response.cookies.set("sangeet_guest_sync", setGuestCookie, {
        path: "/",
        sameSite: "lax",
        secure: isSecureRequest(request),
        maxAge: 365 * 86400,
        httpOnly: true,
      });
    }

    return response;
  } catch {
    return NextResponse.json(
      { error: "device_heartbeat_failed" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
