import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/google-auth";
import { getYouTubeConnectionStatus, deleteYouTubeConnection, getYouTubeTokens, isYouTubeTokenStorageConfigured } from "@/lib/youtube-account";
import { getManagedUser } from "@/lib/admin-users";
import { enforceRateLimit, verifySameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function user(request: NextRequest) {
  const identity = verifySession(request.cookies.get("aura_session")?.value);
  return identity ? `google:${identity.sub}` : null;
}

export async function GET(request: NextRequest) {
  const rateLimited = enforceRateLimit(request, "youtube:connection:get", 60, 60_000);
  if (rateLimited) return rateLimited;

  try {
    const id = await user(request);
    if (!id) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
    const profile = await getManagedUser(id);
    if (profile?.status !== "active") return NextResponse.json({ error: "unauthorized" }, { status: 403, headers: { "cache-control": "no-store" } });
    if (!isYouTubeTokenStorageConfigured()) return NextResponse.json({ error: "storage_unconfigured" }, { status: 503, headers: { "cache-control": "no-store" } });
    return NextResponse.json(await getYouTubeConnectionStatus(id), { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "connection_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

export async function DELETE(request: NextRequest) {
  const rateLimited = enforceRateLimit(request, "youtube:connection:delete", 20, 60_000);
  if (rateLimited) return rateLimited;

  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: { "cache-control": "no-store" } });
  }

  try {
    const id = await user(request);
    if (!id) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
    const profile = await getManagedUser(id);
    if (profile?.status !== "active") return NextResponse.json({ error: "unauthorized" }, { status: 403, headers: { "cache-control": "no-store" } });
    const tokens = await getYouTubeTokens(id);
    if (tokens) {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: tokens.refresh_token }),
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      }).catch(() => undefined);
    }
    await deleteYouTubeConnection(id);
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "disconnect_failed" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
