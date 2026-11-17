const OFFLINE_AUDIO_CACHE = "sangeet-offline-audio-v1";
const OFFLINE_SHELL_CACHE = "sangeet-offline-shell-v2";
const PRECACHE_ROUTES = ["/home", "/library", "/now-playing", "/search", "/explore", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_SHELL_CACHE)
      .then((cache) => Promise.allSettled(PRECACHE_ROUTES.map((route) => cache.add(route))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("sangeet-offline-shell-") && k !== OFFLINE_SHELL_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App pages: network-first so online visits stay fresh and offline visits launch the real player UI
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && !url.pathname.startsWith("/api/")) {
            const copy = response.clone();
            void caches.open(OFFLINE_SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(OFFLINE_SHELL_CACHE);
          return (
            (await cache.match(request)) ||
            (await cache.match(url.pathname)) ||
            (await cache.match("/library")) ||
            (await cache.match("/home")) ||
            (await cache.match("/offline.html")) ||
            Response.error()
          );
        }),
    );
    return;
  }

  // Next.js immutable build assets & app icons: cache as fetched so offline player screens render identically
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/art/") ||
    url.pathname.startsWith("/brand/")
  ) {
    event.respondWith(
      caches.open(OFFLINE_SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response && response.ok) {
          void cache.put(request, response.clone());
        }
        return response;
      }),
    );
    return;
  }

  if (!url.pathname.startsWith("/audio/")) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(OFFLINE_AUDIO_CACHE);
      const saved = await cache.match(request);
      if (saved) return saved;
      return fetch(request);
    })(),
  );
});
