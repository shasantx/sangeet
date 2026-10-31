import { albums, playlists, selectedAlbums } from "@/lib/catalog";

export interface SiteSettings {
  announcement_enabled: boolean;
  announcement_text: string;
  signup_enabled: boolean;
  live_search_enabled: boolean;
  featured_album_id: string | null;
  featured_playlist_ids: string[];
  updated_at: string | null;
}

export const defaultSiteSettings: SiteSettings = {
  announcement_enabled: false,
  announcement_text: "",
  signup_enabled: true,
  live_search_enabled: true,
  featured_album_id: selectedAlbums[0]?.id ?? null,
  featured_playlist_ids: playlists.filter((playlist) => playlist.featured).slice(0, 6).map((playlist) => playlist.id),
  updated_at: null,
};

let cachedSettings: { value: SiteSettings; expiresAt: number } | undefined;
const SETTINGS_CACHE_MS = 15_000;

function config() {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Admin database is not configured");
  return { base, key };
}

async function db(path: string, init: RequestInit = {}) {
  const { base, key } = config();
  return fetch(`${base}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

export async function getSiteSettings(): Promise<SiteSettings> {
  if (cachedSettings && cachedSettings.expiresAt > Date.now()) return cachedSettings.value;
  const params = new URLSearchParams({ select: "announcement_enabled,announcement_text,signup_enabled,live_search_enabled,featured_album_id,featured_playlist_ids,updated_at", id: "eq.1", limit: "1" });
  const response = await db(`site_settings?${params}`);
  if (!response.ok) throw new Error(`Site settings lookup failed (${response.status})`);
  const rows = await response.json() as SiteSettings[];
  if (!rows[0]) throw new Error("Site settings row is missing; apply the site controls migration");
  const value = { ...defaultSiteSettings, ...rows[0] };
  cachedSettings = { value, expiresAt: Date.now() + SETTINGS_CACHE_MS };
  return value;
}

export async function saveSiteSettings(
  changes: Omit<SiteSettings, "updated_at">,
  actorEmail: string,
): Promise<SiteSettings> {
  const response = await db("rpc/admin_update_site_settings", {
    method: "POST",
    body: JSON.stringify({
      p_announcement_enabled: changes.announcement_enabled,
      p_announcement_text: changes.announcement_text,
      p_signup_enabled: changes.signup_enabled,
      p_live_search_enabled: changes.live_search_enabled,
      p_featured_album_id: changes.featured_album_id,
      p_featured_playlist_ids: changes.featured_playlist_ids,
      p_actor_email: actorEmail.toLowerCase(),
    }),
  });
  if (!response.ok) throw new Error(`Site settings update failed (${response.status})`);
  const row = await response.json() as SiteSettings | SiteSettings[];
  const updatedSettings = Array.isArray(row) ? row[0] : row;
  if (!updatedSettings) throw new Error("Site settings row is missing; apply the site controls migration");
  cachedSettings = undefined;
  const value: SiteSettings = {
    announcement_enabled: updatedSettings.announcement_enabled,
    announcement_text: updatedSettings.announcement_text,
    signup_enabled: updatedSettings.signup_enabled,
    live_search_enabled: updatedSettings.live_search_enabled,
    featured_album_id: updatedSettings.featured_album_id,
    featured_playlist_ids: updatedSettings.featured_playlist_ids,
    updated_at: updatedSettings.updated_at,
  };
  cachedSettings = { value, expiresAt: Date.now() + SETTINGS_CACHE_MS };
  return value;
}

export function adminContentOptions() {
  return {
    albums: albums.map(({ id, title, artistId }) => ({ id, title, artistId })),
    playlists: playlists.map(({ id, title, curator }) => ({ id, title, curator })),
  };
}

export function validAlbumId(id: unknown): id is string {
  return id === null || (typeof id === "string" && (id === "" || albums.some((album) => album.id === id)));
}

export function validPlaylistIds(ids: unknown): ids is string[] {
  return Array.isArray(ids)
    && ids.length <= 6
    && ids.every((id) => typeof id === "string" && playlists.some((playlist) => playlist.id === id))
    && new Set(ids).size === ids.length;
}
