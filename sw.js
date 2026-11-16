// Service worker: keeps the app and its big files (voice models, WebAssembly, fonts, research library)
// on the phone so they download once. Live data (news, photos) always uses the network.
const VERSION = "reelbot-v17";
// Models, runtimes and fonts never change at the same path (a new model gets a new folder), so they
// live in a cache that survives app updates: an update doesn't download the voice again.
const MODELS = "reelbot-models-v1";
const STATIC = /\/(app\/vendor|app\/ai\/vendor|app\/ai\/models|assets\/voices|assets\/fonts)\//;
const DATA = /\/app\/ai\/data\//;      // research library: replaced when the app updates

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== MODELS).map((k) => caches.delete(k))))
    .then(dropRetired).then(() => self.clients.claim()));
});

// Model files the app no longer uses (both models are 8-bit now): frees their space on the phone.
const RETIRED = /\/(SmolLM2-135M-Instruct|kokoro-82m)\/onnx\/model\.onnx(_data(_\d+)?)?$/;
async function dropRetired() {
  try { const c = await caches.open(MODELS); for (const r of await c.keys()) if (RETIRED.test(new URL(r.url).pathname)) await c.delete(r); } catch { /* storage unavailable */ }
}

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
  if (STATIC.test(url.pathname)) return e.respondWith(cacheFirst(req, MODELS));
  if (DATA.test(url.pathname)) return e.respondWith(cacheFirst(req, VERSION));
  // App shell: network first so updates arrive, cached copy when offline.
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  }).catch(async () => caches.match(req, { ignoreSearch: true })));
});
