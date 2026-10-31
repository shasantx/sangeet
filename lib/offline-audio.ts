import type { Track } from "./types";

export const OFFLINE_AUDIO_CACHE = "sangeet-offline-audio-v1";

export function canDownloadOffline(track: Track): boolean {
  return !track.youtubeId && track.source !== "youtube" && track.audioUrl.startsWith("/audio/");
}

function cacheKey(track: Track): Request {
  const url = new URL(track.audioUrl, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/audio/")) {
    throw new Error("This track cannot be saved for offline listening.");
  }
  return new Request(url.href, { credentials: "same-origin" });
}

export async function isOfflineAvailable(track: Track): Promise<boolean> {
  if (!canDownloadOffline(track) || !("caches" in window)) return false;
  const cache = await caches.open(OFFLINE_AUDIO_CACHE);
  return Boolean(await cache.match(cacheKey(track)));
}

export async function saveTrackOffline(track: Track, artistName: string): Promise<void> {
  if (!canDownloadOffline(track) || !("caches" in window)) {
    throw new Error("Offline downloads are unavailable for this track or browser.");
  }
  const request = cacheKey(track);
  const response = await fetch(request, { cache: "no-store" });
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.toLowerCase().startsWith("audio/")) {
    throw new Error("Could not download this audio file.");
  }
  const cache = await caches.open(OFFLINE_AUDIO_CACHE);
  const headers = new Headers(response.headers);
  headers.set("x-sangeet-title", encodeURIComponent(track.title));
  headers.set("x-sangeet-artist", encodeURIComponent(artistName));
  headers.set("x-sangeet-artwork", encodeURIComponent(track.artwork));
  await cache.put(request, new Response(response.body, { status: response.status, statusText: response.statusText, headers }));
}

export async function removeOfflineTrack(track: Track): Promise<void> {
  if (!canDownloadOffline(track) || !("caches" in window)) return;
  const cache = await caches.open(OFFLINE_AUDIO_CACHE);
  await cache.delete(cacheKey(track));
}
