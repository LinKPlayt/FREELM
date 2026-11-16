// Reels are kept only on this device, in the browser's own storage (IndexedDB). Nothing is uploaded.
const DB = "reelbot", STORE = "reels", KEEP = 8;

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
export async function saveReel(reel) {
  try {
    await tx("readwrite", (s) => s.put(reel));
    const all = await listReels();
    for (const old of all.slice(KEEP)) await tx("readwrite", (s) => s.delete(old.id));
    return true;
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
