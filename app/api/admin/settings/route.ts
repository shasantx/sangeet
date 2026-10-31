import { NextRequest, NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-auth";
import { adminContentOptions, getSiteSettings, saveSiteSettings, validAlbumId, validPlaylistIds } from "@/lib/admin-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store, max-age=0" } });
}

function statusFrom(error: unknown) {
  const match = error instanceof Error ? error.message.match(/\((\d{3})\)/) : null;
  return match?.[1] ? Number(match[1]) : 0;
}

function safeError(error: unknown) {
  const status = statusFrom(error);
  if (error instanceof Error && error.message.includes("not configured")) return "Supabase server variables are missing from this deployment.";
  if (status === 401 || status === 403) return "Supabase rejected the service key. Check that the URL and service key belong to the same project.";
  if (status === 404 || (error instanceof Error && error.message.includes("migration"))) return "Apply the site controls migration in the Supabase project configured for this deployment.";
  return "Could not read site controls. Check Supabase settings and the Vercel function logs.";
}

export async function GET(request: NextRequest) {
  const session = adminSession(request.cookies.get("aura_session")?.value);
  if (!session) return json({ error: "Admin access required." }, 403);
  try {
    const [settings, options] = await Promise.all([getSiteSettings(), Promise.resolve(adminContentOptions())]);
    return json({ settings, options });
  } catch (error) {
    return json({ error: safeError(error) }, 503);
  }
}

export async function PATCH(request: NextRequest) {
  const session = adminSession(request.cookies.get("aura_session")?.value);
  if (!session) return json({ error: "Admin access required." }, 403);
  if (request.headers.get("origin") !== request.nextUrl.origin) return json({ error: "Origin validation failed." }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (
    typeof body.announcement_enabled !== "boolean"
    || typeof body.announcement_text !== "string"
    || body.announcement_text.length > 240
    || typeof body.signup_enabled !== "boolean"
    || typeof body.live_search_enabled !== "boolean"
    || !validAlbumId(body.featured_album_id)
    || !validPlaylistIds(body.featured_playlist_ids)
  ) return json({ error: "Check the announcement, feature switches, album and playlist selections." }, 400);

  try {
    const settings = await saveSiteSettings({
      announcement_enabled: body.announcement_enabled,
      announcement_text: body.announcement_text.trim(),
      signup_enabled: body.signup_enabled,
      live_search_enabled: body.live_search_enabled,
      featured_album_id: body.featured_album_id || null,
      featured_playlist_ids: body.featured_playlist_ids,
    }, session.email);
    return json({ settings });
  } catch (error) {
    return json({ error: safeError(error) }, 503);
  }
}
