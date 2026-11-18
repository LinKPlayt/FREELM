// Minimal service worker: caches the app shell so the home-screen app opens instantly.
// API calls and videos always go to the network.
const CACHE = "reelbot-v1";
// On GitHub Pages (an old link to the server's page) this worker isn't needed and must not touch the
// phone app's storage on the same site: it just removes itself.
const ON_PAGES = /\.github\.io$/.test(self.location.hostname);
if (ON_PAGES) {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(caches.delete(CACHE).then(() => self.registration.unregister())));
} else {
  const SHELL = ["/", "/manifest.webmanifest", "/static/icon-192.png", "/static/icon-180.png"];
  self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
  self.addEventListener("activate", (e) => {
    e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
    self.clients.claim();
  });
  self.addEventListener("fetch", (e) => {
    const url = new URL(e.request.url);
    if (e.request.method !== "GET" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/media/") || url.pathname.startsWith("/auth/")) return;
    // Network first, fall back to cache (keeps the UI fresh after deploys).
    e.respondWith(fetch(e.request).then((res) => {
      if (res.ok && SHELL.includes(url.pathname)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request)));
  });
}
