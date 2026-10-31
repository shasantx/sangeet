const OFFLINE_AUDIO_CACHE = "sangeet-offline-audio-v1";
const OFFLINE_SHELL_CACHE = "sangeet-offline-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(OFFLINE_SHELL_CACHE).then((cache) => cache.add("/offline.html")).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(OFFLINE_SHELL_CACHE);
      return (await cache.match("/offline.html")) || Response.error();
    }));
    return;
  }
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith("/audio/")) return;

  event.respondWith((async () => {
    const cache = await caches.open(OFFLINE_AUDIO_CACHE);
    const saved = await cache.match(request);
    if (saved) return saved;
    return fetch(request);
  })());
});
