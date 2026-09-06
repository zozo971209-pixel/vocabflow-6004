const CACHE_NAME = "vocabflow-offline-v14";
const BASE = "/vocabflow-6004";
const CORE = [`${BASE}/`, `${BASE}/vocab.json`, `${BASE}/enrichment.json`, `${BASE}/enrichment-ai.json`, `${BASE}/bilingual-examples.json`, `${BASE}/favicon.svg`, `${BASE}/icon-v-192.png`, `${BASE}/icon-v-512.png`, `${BASE}/manifest.webmanifest`, `${BASE}/RIGHTS.md`];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE);
    const page = await fetch(`${BASE}/`);
    const html = await page.text();
    const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => new URL(match[1], self.location.origin).pathname)
      .filter((path) => path.startsWith(`${BASE}/_next/`));
    await cache.addAll([...new Set(assets)]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("vocabflow-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(async (response) => {
      const cache = await caches.open(CACHE_NAME);
      cache.put(`${BASE}/`, response.clone());
      return response;
    }).catch(() => caches.match(`${BASE}/`)));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then(async (response) => {
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  })));
});
