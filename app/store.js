// Reels are kept only on this device, in the browser's own storage (IndexedDB). Nothing is uploaded.
// Up to 60 videos are kept. Older ones are only removed when that limit is passed or the phone's space
// for the app is nearly full, and then videos you've marked as posted go first.
const DB = "reelbot", STORE = "reels", KEEP = 60;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode), out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out.result); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error);
  }));
}

export async function listReels() {
  try { return ((await tx("readonly", (s) => s.getAll())) || []).sort((a, b) => b.created - a.created); }
  catch { return []; }
}
// Videos you've posted (marked in the Library, or by adding their results). Kept apart from the videos,
// so marking one doesn't rewrite it.
const POSTED = "posted";
export function postedIds() { try { return new Set(JSON.parse(localStorage.getItem(POSTED) || "[]")); } catch { return new Set(); } }
export function setPosted(id, on = true) {
  const s = postedIds(); if (on) s.add(id); else s.delete(id);
  try { localStorage.setItem(POSTED, JSON.stringify([...s].slice(-500))); } catch { /* storage full */ }
}

// Saves a video. Returns { removed: [titles] } (the older videos removed to make room) or false.
export async function saveReel(reel) {
  try {
    await tx("readwrite", (s) => s.put(reel));
    const all = await listReels(), posted = postedIds(), removed = [];
    // Candidates, best to remove first: posted before not posted, then oldest. Never the one just saved.
    const order = all.filter((r) => r.id !== reel.id).sort((a, b) => (Number(posted.has(b.id)) - Number(posted.has(a.id))) || (a.created - b.created));
    let est = null; try { est = await navigator.storage?.estimate?.(); } catch { /* unknown */ }
    let over = all.length - KEEP;
    for (const old of order) {
      const tight = est?.quota > 0 && est.usage > est.quota * 0.85;
      if (over <= 0 && !tight) break;
      await tx("readwrite", (s) => s.delete(old.id)); removed.push((old.title || "a video").replace(/\s*#Shorts$/, "")); over--;
      if (est) est = { ...est, usage: est.usage - (old.blob?.size || 0) - (old.cover?.size || 0) };
    }
    return { removed };
  } catch (e) { console.warn("Couldn't store the reel on this device", e); return false; }
}
export const deleteReel = (id) => tx("readwrite", (s) => s.delete(id)).catch(() => {});
export const clearReels = () => tx("readwrite", (s) => s.clear()).catch(() => {});

// Drafts are small (text only), so they live in localStorage.
const DRAFTS = "drafts", MAX_DRAFTS = 12;
export function listDrafts() { try { return JSON.parse(localStorage.getItem(DRAFTS) || "[]"); } catch { return []; } }
export function saveDraft(d) {
  const all = [d, ...listDrafts().filter((x) => x.id !== d.id)].slice(0, MAX_DRAFTS);
  try { localStorage.setItem(DRAFTS, JSON.stringify(all)); return true; } catch { return false; }
}
export function deleteDraft(id) { try { localStorage.setItem(DRAFTS, JSON.stringify(listDrafts().filter((x) => x.id !== id))); } catch { /* ignore */ } }
