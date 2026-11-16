// UI glue for the phone app.
import { appData, planReel, produceReel, releasePlan, estimateSeconds } from "./make.js";
import { listReels, saveReel, deleteReel, clearReels } from "./store.js";
import { encoderInfo } from "./render.js";

const $ = (id) => document.getElementById(id);
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
const MODES = ["auto", "evergreen", "news", "market", "custom"];
const MODE_LABELS = { auto: "Auto", evergreen: "Explainer", news: "Today's news", market: "Market recap", custom: "Your topic" };
const COLORS = ["#FFD60A", "#2ED573", "#00D2FF", "#FF6B81", "#FF9F1A", "#B388FF", "#FFFFFF"];
const SPEEDS = { slow: 0.92, normal: 1.0, fast: 1.1 };
const CTA = "Follow for a new money tip every day.";
const state = { niche: "personal finance", mode: "auto", data: null, urls: new Map(), reels: new Map(), busy: false,
  accent: "#FFD60A", speed: "normal", plan: null };
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
  $("custom-wrap").classList.toggle("hidden", state.mode !== "custom");
}
function renderSwatches() {
  $("swatches").innerHTML = COLORS.map((c) => `<button class="swatch${c === state.accent ? " on" : ""}" style="background:${c}" data-color="${c}" aria-label="Colour ${c}"></button>`).join("");
}
$("swatches").addEventListener("click", (e) => {
  const b = e.target.closest("[data-color]"); if (!b) return;
  state.accent = b.dataset.color; store.set("accent", state.accent); renderSwatches();
});

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

/* ---------- making a reel: plan -> review -> produce ---------- */
function options() {
  return {
    niche: state.niche, mode: state.mode, topicId: state.mode === "evergreen" ? $("topic").value : "",
    customTopic: $("custom").value, brand: $("brand").value.trim() || "Money Minute", cta: CTA, repo: repo(),
    music: $("music").checked, accent: state.accent, voiceSpeed: SPEEDS[state.speed] || 1, forceEncoder: params.get("encoder") || undefined,
  };
}
function screen(name) {   // form | job | review
  $("form").classList.toggle("hidden", name !== "form");
  $("job").classList.toggle("hidden", name !== "job");
  $("review").classList.toggle("hidden", name !== "review");
  if (name !== "form") $("result").classList.add("hidden");
  window.scrollTo(0, 0);
}
const say = (text, f) => { $("job-step").textContent = text; if (f != null) $("bar").style.width = Math.round(f * 100) + "%"; };
function showError(e, what) {
  console.error(e);
  $("result").innerHTML = `<h2>${esc(what)}</h2><p style="color:var(--bad)">${esc(e.message || e)}</p><p>Check your connection and try again. If it keeps failing, close other apps to free up memory.</p>`;
  $("result").classList.remove("hidden");
  window.__lastError = String(e?.stack || e);
}

async function start() {
  if (state.busy) return;
  if (state.mode === "custom" && $("custom").value.trim().length < 2) { toast("Type a topic first"); $("custom").focus(); return; }
  state.busy = true;
  store.set("brand", $("brand").value);
  if (state.mode === "custom") store.set("custom", $("custom").value.trim());
  // Audio has to be unlocked by this tap; it's only used if the phone falls back to real-time recording.
  const AC = window.AudioContext || window.webkitAudioContext;
  state.audioCtx = AC ? new AC() : null; state.audioCtx?.resume?.().catch(() => {});
  screen("job"); $("job-title").textContent = "Writing your script…"; $("preview").classList.add("hidden"); say("Researching…", 0.02);
  try {
    state.plan = await planReel(options(), { say });
    if ($("review-on").checked) { state.busy = false; return showReview(); }
    await produce();
  } catch (e) { screen("form"); showError(e, "That didn't work"); state.busy = false; closeAudio(); }
}

async function produce() {
  state.busy = true;
  screen("job"); $("job-title").textContent = "Making your reel…"; $("preview").classList.remove("hidden"); say("Starting…", 0);
  let wake = null; try { wake = await navigator.wakeLock?.request("screen"); } catch { /* not supported */ }
  if (!state.audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; state.audioCtx = AC ? new AC() : null; }
  state.audioCtx?.resume?.().catch(() => {});
  const t0 = performance.now();
  try {
    const reel = await produceReel(state.plan, options(), { say, canvas: $("preview"), audioCtx: state.audioCtx });
    state.plan = null;
    const kept = await saveReel(reel);
    screen("form");
    $("result").innerHTML = `<h2>Your reel is ready</h2><p>Made in ${Math.round((performance.now() - t0) / 1000)}s on this device (${esc(reel.how)}).${kept ? "" : " It couldn't be kept in the Library, so save it now."}</p>` + reelCard(reel, true);
    $("result").classList.remove("hidden");
    store.set("made", "1"); $("first-run").classList.add("hidden");
    window.__lastReel = reel;
  } catch (e) {
    screen(state.plan ? "review" : "form");
    if (state.plan) showReview();
    showError(e, "The video couldn't be made");
  }
  wake?.release?.().catch(() => {}); closeAudio();
  state.busy = false;
}
function closeAudio() { state.audioCtx?.close?.().catch(() => {}); state.audioCtx = null; }

/* ---------- review screen ---------- */
function drawThumb(cv, asset) {
  const c = cv.getContext("2d"), bmp = asset.bitmap;
  const s = Math.max(cv.width / bmp.width, cv.height / bmp.height), sw = cv.width / s, sh = cv.height / s;
  c.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) * 0.4, sw, sh, 0, 0, cv.width, cv.height);
}
function updateEstimate() {
  const plan = state.plan; if (!plan) return;
  const secs = Math.round(estimateSeconds(plan.script.lines, SPEEDS[state.speed] || 1));
  const el = $("estimate");
  const spare = plan.edited ? 0 : plan.script.extras.length;
  el.textContent = `about ${secs} seconds` + (secs > 45 ? " (long: it will be sped up or trimmed to 45s)"
    : secs < 30 ? (spare ? " (researched lines will be added to reach 30s)" : " (short: tap + Add a line, or the end card stays on longer)") : "");
  el.classList.toggle("warn", secs > 45 || secs < 30);
}
function showReview() {
  const { script } = state.plan;
  $("review-title").textContent = script.title;
  const content = script.lines.filter((l) => l.kind !== "outro").length;
  $("scenes").innerHTML = script.lines.map((l, i) => {
    const tag = i === 0 ? "Hook" : l.kind === "outro" ? "Ending" : l.kind === "chart" ? "Chart" : `Scene ${i}`;
    const thumb = l.kind === "outro" ? `<div class="thumb">END<br>CARD</div>` : l.kind === "chart" ? `<div class="thumb">LIVE<br>CHART</div>`
      : `<div class="thumb">${l.asset ? `<canvas width="152" height="270" data-thumb="${i}"></canvas>` : "NO<br>PHOTO"}</div>`;
    const tools = l.kind !== "media" ? (l.kind === "chart" && content > 2 ? `<div class="mini"><button class="del" data-del="${i}">Remove</button></div>` : "")
      : `<div class="mini"><button data-swap="${i}">New photo</button><button data-search="${i}">Search…</button><button data-mine="${i}">My photo</button>${content > 2 ? `<button class="del" data-del="${i}">Remove</button>` : ""}</div>`;
    return `<div class="scene"><div>${thumb}</div><div><div class="scene-tag"><span>${tag}</span></div>
      <textarea data-line="${i}" rows="3">${esc(l.text)}</textarea>${tools}</div></div>`;
  }).join("");
  script.lines.forEach((l, i) => { const cv = document.querySelector(`[data-thumb="${i}"]`); if (cv && l.asset) drawThumb(cv, l.asset); });
  updateEstimate();
  screen("review");
}
$("scenes").addEventListener("input", (e) => {
  const i = e.target.dataset.line; if (i == null) return;
  state.plan.script.lines[+i].text = e.target.value.replace(/\s+/g, " ").trim();
  state.plan.edited = true; updateEstimate();
});
async function setAsset(i, assetPromise, label) {
  const line = state.plan.script.lines[i];
  const btn = document.querySelector(`[data-swap="${i}"]`); if (btn) btn.textContent = label;
  const asset = await assetPromise.catch(() => null);
  if (asset) { line.asset?.bitmap?.close?.(); line.asset = asset; } else toast("No other photo found. Try Search…");
  showReview();
}
$("scenes").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const plan = state.plan;
  if (b.dataset.swap != null) { const i = +b.dataset.swap; setAsset(i, plan.finder.findImage(plan.script.lines[i].query || plan.generic[0]), "Finding…"); }
  if (b.dataset.search != null) {
    const i = +b.dataset.search, q = prompt("Search free photos for:", plan.script.lines[i].query || "");
    if (q && q.trim()) { plan.script.lines[i].query = q.trim(); setAsset(i, plan.finder.findImage(q.trim()), "Searching…"); }
  }
  if (b.dataset.mine != null) { state.pickFor = +b.dataset.mine; $("photo-pick").value = ""; $("photo-pick").click(); }
  if (b.dataset.del != null) {
    const [gone] = plan.script.lines.splice(+b.dataset.del, 1);
    gone.asset?.bitmap?.close?.(); plan.edited = true; showReview();
  }
});
$("photo-pick").addEventListener("change", async () => {
  const file = $("photo-pick").files[0], i = state.pickFor; if (!file || i == null) return;
  try {
    const bitmap = await createImageBitmap(file);
    setAsset(i, Promise.resolve({ bitmap, credit: "", title: "Your photo" }), "Loading…");
  } catch { toast("That photo couldn't be opened. Try a JPEG or PNG."); }
});
$("add-line").addEventListener("click", () => {
  const plan = state.plan, lines = plan.script.lines;
  // Offer the next researched line first; after that, a blank one to write yourself.
  const extra = plan.script.extras.shift();
  const q = extra?.query || plan.generic[lines.length % plan.generic.length];
  const line = extra ? { ...extra, query: q } : { text: "", visual: q, query: q, kind: "media", asset: null };
  if (extra) Promise.resolve(extra.asset).then((a) => { line.asset = a; if (a) showReview(); }).catch(() => {});
  lines.splice(lines.length - 1, 0, line);
  plan.edited = true; showReview();
  const ta = document.querySelector(`[data-line="${lines.length - 2}"]`); ta?.focus(); ta?.scrollIntoView({ block: "center" });
  if (!extra) plan.finder.findImage(q).then((a) => { if (a && !line.asset) { line.asset = a; showReview(); } }).catch(() => {});
});
$("produce").addEventListener("click", () => {
  const lines = state.plan.script.lines;
  for (let i = lines.length - 1; i >= 0; i--) if (!lines[i].text) lines.splice(i, 1);   // drop empty lines
  if (lines.filter((l) => l.kind !== "outro").length < 2) { toast("Keep at least two lines"); return showReview(); }
  produce();
});
$("reroll").addEventListener("click", () => { if (state.plan) releasePlan(state.plan); state.plan = null; start(); });
$("cancel-review").addEventListener("click", () => { if (state.plan) releasePlan(state.plan); state.plan = null; closeAudio(); screen("form"); });

async function init() {
  state.data = await appData();
  state.niche = store.get("niche") || "personal finance"; state.mode = store.get("mode") || "auto";
  if (!state.data.niches.includes(state.niche)) state.niche = "personal finance";
  if (!MODES.includes(state.mode)) state.mode = "auto";
  chips($("niches"), state.data.niches, state.niche, (v) => { state.niche = v; store.set("niche", v); renderTopics(); });
  chips($("modes"), MODES, state.mode, (v) => { state.mode = v; store.set("mode", v); renderTopics(); }, MODE_LABELS);
  $("brand").value = store.get("brand") || "Money Minute";
  $("custom").value = store.get("custom") || "";
  state.accent = COLORS.includes(store.get("accent")) ? store.get("accent") : "#FFD60A";
  state.speed = SPEEDS[store.get("speed")] ? store.get("speed") : "normal";
  renderSwatches();
  chips($("speeds"), Object.keys(SPEEDS), state.speed, (v) => { state.speed = v; store.set("speed", v); updateEstimate(); });
  $("review-on").checked = store.get("review") !== "0";
  $("review-on").addEventListener("change", () => store.set("review", $("review-on").checked ? "1" : "0"));
  $("custom").addEventListener("keydown", (e) => { if (e.key === "Enter") start(); });
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
