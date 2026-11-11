import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/google-auth";
import { getManagedUser, isAdminStorageConfigured } from "@/lib/admin-users";
import { sendDeviceCommand, type DeviceState } from "@/lib/device-hub";
import { enforceRateLimit, safeJsonParse, verifySameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanTrack(value: unknown): DeviceState["track"] {
  if (!value || typeof value !== "object") return null;
  const track = value as Record<string, unknown>;
  const title = typeof track.title === "string" ? track.title.trim().slice(0, 180) : "";
  const artist = typeof track.artist === "string" ? track.artist.trim().slice(0, 140) : "";
  if (!title || !artist) return null;
  const artwork =
    typeof track.artwork === "string" &&
    ((track.artwork.startsWith("/art/") && !track.artwork.includes("..")) ||
      /^https:\/\/(i\.ytimg\.com|img\.youtube\.com|yt3\.ggpht\.com|(?:[A-Za-z0-9-]+\.)*googleusercontent\.com|(?:[A-Za-z0-9-]+\.)*audius\.co)\//.test(
        track.artwork,
      ))
      ? track.artwork.slice(0, 600)
      : "";
  const common = {
    title,
    artist,
    album: typeof track.album === "string" ? track.album.slice(0, 180) : "",
    artwork,
    duration: Number.isFinite(track.duration) ? Math.min(86400, Math.max(0, Number(track.duration))) : 0,
  };
  if (track.source === "youtube" && typeof track.videoId === "string" && /^[\w-]{11}$/.test(track.videoId)) {
    return { ...common, source: "youtube", videoId: track.videoId };
  }
  if (track.source === "audius" && typeof track.trackId === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(track.trackId)) {
    return { ...common, source: "audius", trackId: track.trackId };
  }
  return null;
}

async function resolveUserId(request: NextRequest): Promise<string> {
  // 1. Cryptographically verified Google OAuth session cookie ONLY
  try {
    const identity = verifySession(request.cookies.get("aura_session")?.value);
    if (identity?.sub) {
      if (isAdminStorageConfigured()) {
        const user = await getManagedUser(`google:${identity.sub}`);
        if (user?.status === "active") return `google:${identity.sub}`;
      } else {
        return `google:${identity.sub}`;
      }
    }
  } catch {
    // Fall through
  }

  // 2. Guest Sync Room token (must be high-entropy 16..80 chars, isolated in guest: namespace)
  const headerSync = request.headers.get("x-sangeet-sync-id");
  const cookieSync = request.cookies.get("sangeet_guest_sync")?.value;
  const querySync = request.nextUrl.searchParams.get("syncId");
  const candidate = (headerSync || cookieSync || querySync || "").trim();

  if (candidate && /^[A-Za-z0-9_-]{16,80}$/.test(candidate)) {
    return `guest:${candidate}`;
  }
  return "";
}

export async function POST(request: NextRequest) {
  const rateLimited = enforceRateLimit(request, "devices:command", 60, 60_000);
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
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
    }

    const body = parsedBody.data;
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    const action = String(body.action);

    if (
      (!/^[A-Za-z0-9_-]{16,80}$/.test(deviceId) && deviceId !== "all") ||
      !["play", "pause", "next", "previous", "seek", "volume"].includes(action)
    ) {
      return NextResponse.json({ error: "invalid_command" }, { status: 400, headers: { "cache-control": "no-store" } });
    }

    const track = action === "play" ? cleanTrack(body.track) : undefined;
    if (action === "play" && !track) {
      return NextResponse.json(
        { error: "track_unavailable_on_device" },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }

    const commandId = crypto.randomUUID();
    const commandPayload = {
      id: commandId,
      targetDeviceId: deviceId,
      action: action as "play" | "pause" | "next" | "previous" | "seek" | "volume",
      track,
      currentTime: Number.isFinite(body.currentTime)
        ? Math.max(0, Math.min(86400, Number(body.currentTime)))
        : undefined,
      volume: Number.isFinite(body.volume) ? Math.max(0, Math.min(1, Number(body.volume))) : undefined,
      sentAt: new Date().toISOString(),
    };

    const delivered = sendDeviceCommand(userId, commandPayload);
    if (!delivered) {
      return NextResponse.json({ error: "device_offline" }, { status: 404, headers: { "cache-control": "no-store" } });
    }

    return NextResponse.json({ ok: true, commandId }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "command_delivery_failed" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
