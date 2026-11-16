// Service worker: keeps the app and its big files (voice models, WebAssembly, fonts, research library)
// on the phone so they download once. Live data (news, photos) always uses the network.
//
// It also adds the two headers that make the page "cross-origin isolated" (GitHub Pages can't send
// them). That lets the on-phone AI use several CPU cores, which makes the natural voice about 3x faster.
// Everything the app loads from other sites is fetched with CORS, which isolation allows.
const VERSION = "reelbot-v15";
// Models, runtimes and fonts never change at the same path (a new model gets a new folder), so they
// live in a cache that survives app updates: an update doesn't download the 160 MB voice again.
const MODELS = "reelbot-models-v1";
const STATIC = /\/(app\/vendor|app\/ai\/vendor|app\/ai\/models|assets\/voices|assets\/fonts)\//;
const DATA = /\/app\/ai\/data\//;      // research library: replaced when the app updates

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== MODELS).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isolate = (res) => {
  if (!res || res.type === "opaque" || res.status === 0) return res;
  const h = new Headers(res.headers);
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  h.set("Cross-Origin-Embedder-Policy", "require-corp");
  h.set("Cross-Origin-Resource-Policy", "same-origin");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
};

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (req.headers.has("range")) return;                       // video seeking: let the browser handle it
  if (STATIC.test(url.pathname)) return e.respondWith(cacheFirst(req, MODELS).then(isolate));
  if (DATA.test(url.pathname)) return e.respondWith(cacheFirst(req, VERSION).then(isolate));
  // App shell: network first so updates arrive, cached copy when offline.
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return isolate(res);
  }).catch(async () => isolate(await caches.match(req, { ignoreSearch: true }))));
});
