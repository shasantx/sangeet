import { NextResponse } from "next/server";
import { defaultSiteSettings, getSiteSettings } from "@/lib/admin-settings";
import { isAdminStorageConfigured } from "@/lib/admin-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let settings = defaultSiteSettings;
  if (isAdminStorageConfigured()) {
    try {
      settings = await getSiteSettings();
    } catch {
      // Public pages remain available if site settings have not been migrated.
    }
  }
  return NextResponse.json({
    announcement_enabled: settings.announcement_enabled,
    announcement_text: settings.announcement_text,
    signup_enabled: settings.signup_enabled,
    live_search_enabled: settings.live_search_enabled,
    featured_album_id: settings.featured_album_id,
    featured_playlist_ids: settings.featured_playlist_ids,
  }, { headers: { "cache-control": "no-store, max-age=0" } });
}
