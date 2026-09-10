const CACHE_PREFIX = "orbit-pwa-";
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const OFFLINE_URL = "/";
const PRECACHE_URLS = [
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];

function isPublicAsset(request, url) {
  return (
    request.method === "GET" &&
    url.origin === self.location.origin &&
    !request.headers.has("authorization") &&
    url.pathname.startsWith("/_next/static/")
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
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
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
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            try {
              const cache = await caches.open(CACHE_NAME);
              await cache.put(OFFLINE_URL, response.clone());
            } catch {
              // Preserve successful navigation when caching fails.
            }
          }
          return response;
        } catch {
          try {
            const cache = await caches.open(CACHE_NAME);
            return (await cache.match(OFFLINE_URL)) ?? Response.error();
          } catch {
            return Response.error();
          }
        }
      })(),
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
