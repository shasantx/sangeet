import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/google-auth";
import { getYouTubeConnectionStatus, deleteYouTubeConnection, getYouTubeTokens, isYouTubeTokenStorageConfigured } from "@/lib/youtube-account";
import { getManagedUser } from "@/lib/admin-users";

export const runtime = "nodejs";

async function user(request: NextRequest) {
  const identity = verifySession(request.cookies.get("aura_session")?.value);
  return identity ? `google:${identity.sub}` : null;
}

export async function GET(request: NextRequest) {
  try {
    const id = await user(request);
    if (!id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const profile = await getManagedUser(id);
    if (profile?.status !== "active") return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    if (!isYouTubeTokenStorageConfigured()) return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
    return NextResponse.json(await getYouTubeConnectionStatus(id), { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "connection_unavailable" }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = await user(request);
    if (!id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const profile = await getManagedUser(id);
    if (profile?.status !== "active") return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).origin !== new URL(request.url).origin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const tokens = await getYouTubeTokens(id);
    if (tokens) await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: tokens.refresh_token }), cache: "no-store" }).catch(() => undefined);
    await deleteYouTubeConnection(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "disconnect_failed" }, { status: 503 });
  }
}
