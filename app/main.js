// UI glue for the phone app.
import { appData, makeReel } from "./make.js";
import { listReels, saveReel, deleteReel, clearReels } from "./store.js";
import { encoderInfo } from "./render.js";

const $ = (id) => document.getElementById(id);
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
const MODES = ["auto", "evergreen", "news", "market"];
const MODE_LABELS = { auto: "Auto", evergreen: "Explainer", news: "Today's news", market: "Market recap" };
const CTA = "Follow for a new money tip every day.";
const state = { niche: "personal finance", mode: "auto", data: null, urls: new Map(), reels: new Map(), busy: false };
const params = new URLSearchParams(location.search);

function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3200); }
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
  toast("Copied");
}
function repo() {   // https://owner.github.io/repo/ -> owner/repo
  const m = location.hostname.match(/^([^.]+)\.github\.io$/), seg = location.pathname.split("/").filter(Boolean)[0];
  return m && seg ? `${m[1]}/${seg}` : "LinKPlayt/FREELM";
}

function show(tab) {
  document.querySelectorAll("section.tab").forEach((s) => s.classList.toggle("active", s.id === "tab-" + tab));
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  if (tab === "library") renderLibrary();
  window.scrollTo(0, 0);
}
document.querySelectorAll("nav button").forEach((b) => b.addEventListener("click", () => show(b.dataset.tab)));

function chips(el, items, current, onPick, labels = {}) {
  el.innerHTML = "";
  for (const v of items) {
    const b = document.createElement("button");
    b.className = "chip" + (v === current ? " on" : ""); b.textContent = labels[v] || v.replace(/\b\w/g, (c) => c.toUpperCase());
    b.onclick = () => { onPick(v); [...el.children].forEach((c) => c.classList.toggle("on", c === b)); };
    el.appendChild(b);
  }
}
function renderTopics() {
  const list = state.data.topics.filter((t) => t.niches.includes(state.niche));
  $("topic").innerHTML = `<option value="">Surprise me</option>` + list.map((t) => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join("");
  $("topic-wrap").classList.toggle("hidden", state.mode !== "evergreen");
}

/* ---------- reels ---------- */
function urlFor(reel) { if (!state.urls.has(reel.id)) state.urls.set(reel.id, URL.createObjectURL(reel.blob)); return state.urls.get(reel.id); }
function reelCard(r, inline = false) {
  state.reels.set(r.id, r);
  const mb = (r.blob.size / 1e6).toFixed(1);
  return `<div class="${inline ? "" : "card"}" data-reel="${esc(r.id)}">
    <video src="${urlFor(r)}#t=0.5" controls playsinline preload="metadata"></video>
    <div class="reel-title">${esc(r.title.replace(" #Shorts", ""))}</div>
    <div class="meta">${Math.round(r.duration)}s · ${esc(r.kind)} · ${mb} MB</div>
    <div class="btns">
      <button class="btn main wide" data-act="share">Save / Share</button>
      <button class="btn" data-act="caption">Copy title and caption</button>
      <a class="btn" href="${urlFor(r)}" download="${esc(r.id)}.${esc(r.ext)}">Download</a>
      ${inline ? "" : `<button class="btn danger wide" data-act="delete">Delete</button>`}
    </div></div>`;
}
async function renderLibrary() {
  const list = await listReels();
  $("reels").innerHTML = list.length ? list.map((r) => reelCard(r)).join("") : `<div class="empty">No reels yet.<br>Make your first one in Create.</div>`;
}
document.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-act]"); if (!btn) return;
  const card = btn.closest("[data-reel]"), r = state.reels.get(card.dataset.reel); if (!r) return;
  if (btn.dataset.act === "caption") copy(r.title + "\n\n" + r.description);
  if (btn.dataset.act === "delete" && confirm("Delete this reel from your phone?")) { await deleteReel(r.id); card.remove(); }
  if (btn.dataset.act === "share") {
    const file = new File([r.blob], `${r.id}.${r.ext}`, { type: r.blob.type });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else { const a = document.createElement("a"); a.href = urlFor(r); a.download = file.name; a.click(); }
    } catch (e) { if (e.name !== "AbortError") toast("Couldn't open the share sheet: " + e.message); }
  }
});

/* ---------- making a reel ---------- */
async function start() {
  if (state.busy) return;
  state.busy = true;
  // Audio must be unlocked by this tap; it's only needed if the phone falls back to real-time recording.
  const AC = window.AudioContext || window.webkitAudioContext;
  const audioCtx = AC ? new AC() : null; audioCtx?.resume?.().catch(() => {});
  let wake = null; try { wake = await navigator.wakeLock?.request("screen"); } catch { /* not supported */ }

  store.set("brand", $("brand").value);
  $("form").classList.add("hidden"); $("result").classList.add("hidden"); $("job").classList.remove("hidden");
  $("job-title").textContent = "Making your reel…"; window.scrollTo(0, 0);
  const say = (text, f) => { $("job-step").textContent = text; if (f != null) $("bar").style.width = Math.round(f * 100) + "%"; };
  const t0 = performance.now();
  try {
    const reel = await makeReel({
      niche: state.niche, mode: state.mode, topicId: state.mode === "evergreen" ? $("topic").value : "",
      brand: $("brand").value.trim() || "Money Minute", cta: CTA, music: $("music").checked, repo: repo(),
      forceEncoder: params.get("encoder") || undefined,
    }, { say, canvas: $("preview"), audioCtx });
    const kept = await saveReel(reel);
    $("result").innerHTML = `<h2>Your reel is ready</h2><p>Made in ${Math.round((performance.now() - t0) / 1000)}s on this device (${esc(reel.how)}).${kept ? "" : " It couldn't be kept in the Library, so save it now."}</p>` + reelCard(reel, true);
    $("result").classList.remove("hidden");
    store.set("made", "1"); $("first-run").classList.add("hidden");
    window.__lastReel = reel;
  } catch (e) {
    console.error(e);
    $("result").innerHTML = `<h2>That didn't work</h2><p style="color:var(--bad)">${esc(e.message || e)}</p><p>Check your connection and try again. If it keeps failing, close other apps to free up memory.</p>`;
    $("result").classList.remove("hidden");
    window.__lastError = String(e?.stack || e);
  }
  $("job").classList.add("hidden"); $("form").classList.remove("hidden");
  audioCtx?.close?.().catch(() => {}); wake?.release?.().catch(() => {});
  state.busy = false;
}

async function init() {
  state.data = await appData();
  state.niche = store.get("niche") || "personal finance"; state.mode = store.get("mode") || "auto";
  if (!state.data.niches.includes(state.niche)) state.niche = "personal finance";
  if (!MODES.includes(state.mode)) state.mode = "auto";
  chips($("niches"), state.data.niches, state.niche, (v) => { state.niche = v; store.set("niche", v); renderTopics(); });
  chips($("modes"), MODES, state.mode, (v) => { state.mode = v; store.set("mode", v); renderTopics(); }, MODE_LABELS);
  $("brand").value = store.get("brand") || "Money Minute";
  if (store.get("made")) $("first-run").classList.add("hidden");
  renderTopics();
  $("go").addEventListener("click", start);
  $("wipe").addEventListener("click", async () => { if (confirm("Delete every reel stored on this phone?")) { await clearReels(); renderLibrary(); toast("Deleted"); } });
  const info = await encoderInfo();
  $("encoder").textContent = info.webcodecs ? `Video encoder: on-device H.264, ${info.video.width}×${info.video.height}.`
    : info.recorder ? "Video encoder: real-time recording (a reel takes about as long to make as it runs)."
    : "This browser can't encode video. Update iOS and use Safari.";
  window.__ready = true;
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
init().catch((e) => { console.error(e); toast("Couldn't start the app: " + e.message); });
