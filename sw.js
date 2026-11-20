// Service worker: keeps the app and its big files (voice models, WebAssembly, fonts, research library)
// on the phone so they download once. Live data (news, photos) always uses the network.
const VERSION = "reelbot-v53";
// Big binary files (model weights, WebAssembly, fonts) live in a cache that survives app updates, so
// an update doesn't download the voice again. Only binaries: small settings and code files (config.json,
// .js) can change in place, so they're refreshed with every app update (a stale AI config.json, kept
// across an update, once made the on-device AI look for files that no longer existed).
const MODELS = "reelbot-models-v1";
const STATIC = /\/(app\/vendor|app\/ai\/vendor|app\/ai\/models|assets\/voices|assets\/fonts)\/.*\.(onnx|onnx_data(_\d+)?|part\d+|bin|wasm|ttf)$/;
const SMALL = /\/(app\/vendor|app\/ai\/vendor|app\/ai\/models|assets\/voices|assets\/fonts)\//;   // everything else there
const DATA = /\/app\/ai\/data\//;      // research library: replaced when the app updates
// ReelBot's address is linkplayt.github.io/ReelBot/ (it was /FREELM/). After the move the old address
// answers 404, so a copy installed from it keeps working from what it saved here (nothing is locked away)
// and the app shows the way to the new one; at the new address, voices and AI models already downloaded
// under the old one are reused instead of downloaded again.
const HOME = "/ReelBot/", OLD_HOMES = ["/FREELM/", "/freelm/"];   // as typed: saved files are keyed by their full address
const lc = (s) => s.toLowerCase();
const scopePath = () => new URL(self.registration.scope).pathname;
const atOldHome = () => OLD_HOMES.some((h) => lc(h) === lc(scopePath()));

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== MODELS && !k.startsWith("reelbot-user")).map((k) => caches.delete(k))))   // reelbot-user-*: your own files (music)
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

// At the new address: a file saved under the old one is moved over (big model files never download twice).
async function fromOldHome(cache, req) {
  const url = new URL(req.url), scope = scopePath();
  if (lc(scope) !== lc(HOME) || !lc(url.pathname).startsWith(lc(scope))) return null;
  for (const old of OLD_HOMES) {
    const oldUrl = url.origin + old + url.pathname.slice(scope.length) + url.search, res = await cache.match(oldUrl);
    if (res) { await cache.put(req, res.clone()); await cache.delete(oldUrl); return res; }
  }
  return null;
}

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = (await cache.match(req)) || (await fromOldHome(cache, req).catch(() => null));
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
  e.respondWith(fresh.then(async (res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    else if (res.status === 404 && atOldHome()) return (await caches.match(req, { ignoreSearch: true })) || res;   // moved: keep working
    return res;
  }).catch(async () => caches.match(req, { ignoreSearch: true })));
});
