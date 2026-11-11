import { NextRequest, NextResponse } from "next/server";
import { defaultSiteSettings, getSiteSettings } from "@/lib/admin-settings";
import { isAdminStorageConfigured } from "@/lib/admin-users";
import { enforceRateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rateLimited = enforceRateLimit(request, "site-config:get", 90, 60_000);
  if (rateLimited) return rateLimited;

  let settings = defaultSiteSettings;
  if (isAdminStorageConfigured()) {
    try {
      settings = await getSiteSettings();
    } catch {
      // Public pages remain available if site settings have not been migrated.
    }
  }
  return NextResponse.json(
    {
      announcement_enabled: Boolean(settings.announcement_enabled),
      announcement_text: typeof settings.announcement_text === "string" ? settings.announcement_text.slice(0, 240) : "",
      signup_enabled: Boolean(settings.signup_enabled),
      live_search_enabled: Boolean(settings.live_search_enabled),
      featured_album_id: settings.featured_album_id,
      featured_playlist_ids: settings.featured_playlist_ids,
    },
    { headers: { "cache-control": "no-store, max-age=0" } },
  );
}
