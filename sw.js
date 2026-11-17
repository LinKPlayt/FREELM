// Service worker: keeps the app and its big files (voice models, WebAssembly, fonts, research library)
// on the phone so they download once. Live data (news, photos) always uses the network.
const VERSION = "reelbot-v25";
// Big binary files (model weights, WebAssembly, fonts) live in a cache that survives app updates, so
// an update doesn't download the voice again. Only binaries: small settings and code files (config.json,
// .js) can change in place, so they're refreshed with every app update (a stale AI config.json, kept
// across an update, once made the on-device AI look for files that no longer existed).
const MODELS = "reelbot-models-v1";
const STATIC = /\/(app\/vendor|app\/ai\/vendor|app\/ai\/models|assets\/voices|assets\/fonts)\/.*\.(onnx|onnx_data(_\d+)?|part\d+|bin|wasm|ttf)$/;
const SMALL = /\/(app\/vendor|app\/ai\/vendor|app\/ai\/models|assets\/voices|assets\/fonts)\//;   // everything else there
const DATA = /\/app\/ai\/data\//;      // research library: replaced when the app updates

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== MODELS).map((k) => caches.delete(k))))
    .then(dropRetired).then(() => self.clients.claim()));
});

// Model files the app no longer uses (both models are 8-bit now): frees their space on the phone.
// Also the AI split in ONNX's "external data" format, which doesn't load on iPhone (now joined chunks).
const RETIRED = /\/(SmolLM2-135M-Instruct|kokoro-82m)\/onnx\/model\.onnx(_data(_\d+)?)?$|\/SmolLM2-135M-Instruct\/onnx\/model_quantized\.onnx(_data(_\d+)?)?$/;
async function dropRetired() {
  try {
    const c = await caches.open(MODELS);
    for (const r of await c.keys()) {
      const path = new URL(r.url).pathname;
      if (RETIRED.test(path) || !STATIC.test(path)) await c.delete(r);   // retired models, and small files cached here by older versions
    }
  } catch { /* storage unavailable */ }
}

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  // Small files are re-checked with the server (not the browser's 10-minute HTTP cache) so an update
  // arrives at once; big model files are immutable, so any copy will do.
  const res = await fetch(name === MODELS ? req : new Request(req, { cache: "no-cache" }));
  if (res.ok && res.status === 200) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (req.headers.has("range")) return;                       // video seeking: let the browser handle it
  if (STATIC.test(url.pathname)) return e.respondWith(cacheFirst(req, MODELS));
  if (DATA.test(url.pathname) || SMALL.test(url.pathname)) return e.respondWith(cacheFirst(req, VERSION));
  // App shell: network first so updates arrive, cached copy when offline. "no-cache" makes Safari check
  // with the server instead of reusing its own 10-minute copy (which once kept an old voice worker running).
  const fresh = req.mode === "navigate" ? fetch(req.url, { cache: "no-cache", credentials: "same-origin" }) : fetch(new Request(req, { cache: "no-cache" }));
  e.respondWith(fresh.then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  }).catch(async () => caches.match(req, { ignoreSearch: true })));
});
