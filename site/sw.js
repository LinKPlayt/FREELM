// ReelBot's old address. This replaces the old service worker: it removes the old offline copy,
// unregisters itself and sends any open window to the current app (one folder up).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k === "reelbot-v1" || k === "reelbot-v2") await caches.delete(k);   // the old app's caches only
  await self.registration.unregister();
  const app = new URL("../", self.registration.scope).href;
  for (const c of await self.clients.matchAll({ type: "window" })) c.navigate(app).catch(() => {});
})()));
self.addEventListener("fetch", (e) => {
  // Until it's gone: pages go to the current app.
  if (e.request.mode === "navigate") e.respondWith(Response.redirect(new URL("../", self.registration.scope).href, 302));
});
