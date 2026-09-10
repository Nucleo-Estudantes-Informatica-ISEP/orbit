const CACHE_NAME = "orbit-pwa-v2";
const OFFLINE_URL = "/";
const PRECACHE_URLS = [
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];

function isPublicAsset(request, url) {
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return false;
  }

  // Never cache API responses, file transfers, or requests carrying a bearer token.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/files/") ||
    request.headers.has("authorization")
  ) {
    return false;
  }

  return (
    url.pathname.startsWith("/_next/static/") ||
    ["image", "font", "script", "style"].includes(request.destination)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.add(OFFLINE_URL);
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(url);
          } catch {
            // A failed optional precache must not prevent the worker installing.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === "navigate" && url.pathname === OFFLINE_URL) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return cached ?? Response.error();
      }),
    );
    return;
  }

  if (!isPublicAsset(request, url)) return;

  event.respondWith(
    (async () => {
      let cache;
      try {
        cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
      } catch {
        // Cache is best-effort; network must remain available.
      }

      try {
        const response = await fetch(request);
        if (response.ok && cache) {
          try {
            await cache.put(request, response.clone());
          } catch {
            // Preserve successful network response when caching fails.
          }
        }
        return response;
      } catch {
        return Response.error();
      }
    })(),
  );
});
