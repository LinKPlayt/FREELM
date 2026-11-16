// Service worker: keeps the app and its big, never-changing files (voice model, WebAssembly,
// fonts) on the phone so they download once. Live data (news, photos) always uses the network.
const VERSION = "reelbot-v9";
const HEAVY = /\/(app\/vendor|app\/ai\/vendor|app\/ai\/models|app\/ai\/data|assets\/voices|assets\/fonts)\//;   // large and immutable: cache first

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (HEAVY.test(url.pathname)) {
    e.respondWith(caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok && res.status === 200) cache.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  // App shell: network first so updates arrive, cached copy when offline.
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
