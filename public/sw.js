const CACHE_PREFIX = "sangeet-v2-";
const CACHE_NAME = `${CACHE_PREFIX}shell-1`;
const SHELL_URLS = [
  "/offline.html",
  "/manifest.json",
  "/icons/sangeet-icon.svg",
  "/icons/sangeet-maskable.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Only remove older Sangeet-owned caches; never touch unrelated caches on this origin
            .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isCacheableResponse(response) {
  if (!response) return false;
  if (!response.ok || response.status !== 200) return false;
  if (response.type === "opaque" || response.type === "error") return false;
  const cc = (response.headers.get("cache-control") || "").toLowerCase();
  if (cc.includes("no-store") || cc.includes("private")) return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never intercept or cache authentication or API endpoints
  if (url.pathname.startsWith("/api/auth/") || url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        if (!url.pathname.startsWith("/auth")) {
          const cached = await caches.match(request);
          if (isCacheableResponse(cached)) return cached;
        }
        return caches.match("/offline.html");
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (isCacheableResponse(cached)) return cached;
      return fetch(request).catch(() => new Response("", { status: 504 }));
    })
  );
});
