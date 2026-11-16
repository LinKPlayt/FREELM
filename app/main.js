// UI glue for the phone app.
import { appData, planReel, produceReel, releasePlan, estimateSeconds, lengthRange, draftFromPlan, planFromDraft, planFromIdea, decideVisual } from "./make.js";
import { StatBg, IllusBg } from "./graphics.js";
import { describeStat } from "./visuals.js";
import { listReels, saveReel, deleteReel, clearReels, listDrafts, saveDraft, deleteDraft } from "./store.js";
import { platformCaptions } from "./script.js";
import { encoderInfo, renderReel, loadFonts, previewFrame } from "./render.js";
import { SR } from "./music.js";

const $ = (id) => document.getElementById(id);
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
const MODES = ["auto", "evergreen", "news", "market", "custom"];
const MODE_LABELS = { auto: "Auto", evergreen: "Explainer", news: "Today's news", market: "Market recap", custom: "Your topic" };
const COLORS = ["#FFD60A", "#2ED573", "#00D2FF", "#FF6B81", "#FF9F1A", "#B388FF", "#FFFFFF"];
const SPEEDS = { slow: 0.92, normal: 1.0, fast: 1.1 };
const CAPTION_STYLES = { bold: "Bold", boxed: "Boxed", clean: "Clean" };
const CAPTION_POS = { low: "Low", middle: "Middle" };
const MOODS = { lofi: "Lo-fi", upbeat: "Upbeat", cinematic: "Cinematic", calm: "Calm", none: "None" };
const LENGTH_LABELS = { short: "Short 20–30s", standard: "Standard 30–45s", long: "Long 40–60s" };
// A small chip group whose choice is remembered on the phone.
function prefChips(id, labels, key, fallback, after) {
  const saved = store.get(key), value = labels[saved] ? saved : fallback;
  state[key] = value;
  chips($(id), Object.keys(labels), value, (v) => { state[key] = v; store.set(key, v); after?.(); }, labels);
}
// Live preview of the current style: a sample scene drawn with the real renderer.
let sampleBitmap = null;
async function drawStylePreview() {
  try {
    await loadFonts();
    if (!sampleBitmap) {
      const c = document.createElement("canvas"); c.width = 540; c.height = 960;
      const g = c.getContext("2d"), grad = g.createLinearGradient(0, 0, 0, 960);
      grad.addColorStop(0, "#86a8c8"); grad.addColorStop(0.55, "#d9cdb6"); grad.addColorStop(1, "#6b5a45");
      g.fillStyle = grad; g.fillRect(0, 0, 540, 960);
      g.fillStyle = "rgba(40,50,70,0.55)";                                   // a simple city skyline
      [[20, 420, 80], [110, 330, 70], [190, 470, 90], [290, 380, 60], [360, 300, 85], [455, 440, 70]].forEach(([x, y, w]) => g.fillRect(x, y, w, 960 - y));
      sampleBitmap = await createImageBitmap(c);
    }
    const handle = cleanHandle($("handle").value);
    const words = ["Fifty", "percent", "goes"].map((t, i) => ({ text: t, start: i * 0.4, end: i * 0.4 + 0.4 }));
    previewFrame({ title: "Your reel title here", brand: $("brand").value.trim() || "Money Minute", accent: state.accent,
      captionStyle: state.capStyle, captionPos: state.capPos, handle, audio: new Float32Array(1),
      scenes: [{ start: 0, end: 3, kind: "image", bitmap: sampleBitmap, stat: $("pops").checked ? "50%" : null }], words }, $("style-preview"), 0.55);
  } catch (e) { console.warn("preview", e); }
}

function cleanHandle(v) {
  const h = (v || "").trim().replace(/^@+/, "").replace(/[^A-Za-z0-9._]/g, "").slice(0, 30);
  return h ? "@" + h : "";
}
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
  if (tab === "ideas") openIdeas();
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
  state.accent = b.dataset.color; store.set("accent", state.accent); renderSwatches(); drawStylePreview();
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
      <a class="btn wide" href="${urlFor(r)}" download="${esc(r.id)}.${esc(r.ext)}">Download</a>
    </div>
    <div class="meta" style="margin-top:12px">Copy the caption for:</div>
    <div class="copy-row">
      <button class="btn" data-act="cap-youtube">YouTube</button><button class="btn" data-act="cap-tiktok">TikTok</button><button class="btn" data-act="cap-instagram">Instagram</button>
    </div>
    <div class="btns" style="margin-top:0">
      ${inline ? "" : `<button class="btn danger wide" data-act="delete">Delete</button>`}
    </div></div>`;
}
function renderDrafts() {
  const drafts = listDrafts();
  $("drafts").innerHTML = drafts.length ? `<div class="card"><h2>Drafts</h2><p>Scripts you saved to finish later.</p>${drafts.map((d) => `
    <div class="draft"><div><b>${esc(d.label)}</b><div class="meta">${new Date(d.saved).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${d.script.lines.length} scenes</div></div>
      <div class="mini" style="margin:0"><button data-draft-open="${esc(d.id)}">Open</button><button class="del" data-draft-del="${esc(d.id)}">Delete</button></div></div>`).join("")}</div>` : "";
}
$("drafts").addEventListener("click", async (e) => {
  const open = e.target.closest("[data-draft-open]"), del = e.target.closest("[data-draft-del]");
  if (del) { deleteDraft(del.dataset.draftDel); renderDrafts(); return; }
  if (!open || state.busy) return;
  const d = listDrafts().find((x) => x.id === open.dataset.draftOpen); if (!d) return;
  state.busy = true; show("create");
  screen("job"); $("job-title").textContent = "Opening your draft…"; $("preview").classList.add("hidden"); say("Finding photos again…", 0);
  try { state.plan = await planFromDraft(d, { say }); state.draftId = d.id; showReview(); }
  catch (err) { screen("form"); showError(err, "The draft couldn't be opened"); }
  state.busy = false;
});
async function renderLibrary() {
  renderDrafts();
  const list = await listReels();
  $("reels").innerHTML = list.length ? list.map((r) => reelCard(r)).join("") : `<div class="empty">No reels yet.<br>Make your first one in Create.</div>`;
}
document.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-act]"); if (!btn) return;
  const card = btn.closest("[data-reel]"), r = state.reels.get(card.dataset.reel); if (!r) return;
  if (btn.dataset.act.startsWith("cap-")) {
    const which = btn.dataset.act.slice(4);
    copy(platformCaptions(r)[which]);
    toast(`${{ youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram" }[which]} caption copied`);
  }
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
    customTopic: $("custom").value, brand: $("brand").value.trim() || "Money Minute", repo: repo(),
    handle: cleanHandle($("handle").value),
    cta: cleanHandle($("handle").value) ? `Follow ${cleanHandle($("handle").value)} for a new money tip every day.` : CTA,
    music: state.mood, accent: state.accent, voiceSpeed: SPEEDS[state.speed] || 1, length: state.length,
    captionStyle: state.capStyle, captionPos: state.capPos, pops: $("pops").checked, offline: $("offline").checked,
    forceEncoder: params.get("encoder") || undefined,
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
  console.warn(e);   // shown to the user below; not an app error
  $("result").innerHTML = `<h2>${esc(what)}</h2><p style="color:var(--bad)">${esc(e.message || e)}</p><p>Check your connection and try again. If it keeps failing, close other apps to free up memory.</p>`;
  $("result").classList.remove("hidden");
  window.__lastError = String(e?.stack || e);
}

async function start() {
  if (state.busy) return;
  if (state.mode === "custom" && $("custom").value.trim().length < 2) { toast("Type a topic first"); $("custom").focus(); return; }
  state.busy = true;
  store.set("brand", $("brand").value);
  $("handle").value = cleanHandle($("handle").value); store.set("handle", $("handle").value);
  if (state.mode === "custom") store.set("custom", $("custom").value.trim());
  unlockAudio();   // must happen during this tap
  screen("job"); $("job-title").textContent = "Writing your script…"; $("preview").classList.add("hidden"); say("Researching…", 0.02);
  try {
    state.draftId = null;
    state.plan = await planReel(options(), { say });
    if ($("review-on").checked) { state.busy = false; return showReview(); }
    await produce();
  } catch (e) { screen("form"); showError(e, "That didn't work"); state.busy = false; closeAudio(); }
}

async function produce() {
  unlockAudio();   // first thing, while we're still inside the tap
  state.busy = true;
  screen("job"); $("job-title").textContent = "Making your reel…"; $("preview").classList.remove("hidden"); say("Starting…", 0);
  let wake = null; try { wake = await navigator.wakeLock?.request("screen"); } catch { /* not supported */ }
  const t0 = performance.now();
  try {
    if (state.ideasUI) { say("Freeing memory…", 0); await state.ideasUI.unloadAI(); }   // rendering needs the memory
    const reel = await produceReel(state.plan, options(), { say, canvas: $("preview"), audioCtx: state.audioCtx });
    state.plan = null;
    if (state.draftId) { deleteDraft(state.draftId); state.draftId = null; }
    const kept = await saveReel(reel);
    screen("form");
    const soundNote = reel.sound === false
      ? `<p style="color:var(--bad)"><b>This video has no sound.</b> Your phone's browser didn't record the audio. Please run <b>Sound test</b> in the About tab and tell us what it says.</p>`
      : reel.sound ? `<p style="color:var(--good)">Sound checked ✓</p>`
      : reel.written && reel.written.peakDb > -40 ? `<p style="color:var(--good)">Sound written into the video ✓</p>` : "";
    $("result").innerHTML = `<h2>Your reel is ready</h2><p>Made in ${Math.round((performance.now() - t0) / 1000)}s on this device (${esc(reel.how)}).${kept ? "" : " It couldn't be kept in the Library, so save it now."}</p>${soundNote}` + reelCard(reel, true);
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

// iOS only lets a page start audio inside a tap, so this runs synchronously at the start of every tap
// that may record. Playing a tiny silent sound fully unlocks it on older iOS versions.
function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!state.audioCtx || state.audioCtx.state === "closed") state.audioCtx = new AC();
  const ctx = state.audioCtx;
  try {
    ctx.resume?.();
    const b = ctx.createBuffer(1, 1, ctx.sampleRate), src = ctx.createBufferSource();
    src.buffer = b; src.connect(ctx.destination); src.start(0);
  } catch { /* best effort */ }
  return ctx;
}

/* ---------- review screen ---------- */
function drawThumb(cv, asset) {
  const c = cv.getContext("2d"), bmp = asset?.bitmap;
  if (!bmp || !bmp.width) return;   // missing, still loading, or already released
  const s = Math.max(cv.width / bmp.width, cv.height / bmp.height), sw = cv.width / s, sh = cv.height / s;
  c.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) * 0.4, sw, sh, 0, 0, cv.width, cv.height);
}
function updateEstimate() {
  const plan = state.plan; if (!plan) return;
  const secs = Math.round(estimateSeconds(plan.script.lines, SPEEDS[state.speed] || 1));
  const el = $("estimate");
  const spare = plan.edited ? 0 : plan.script.extras.length;
  const [lo, hi] = lengthRange(state.length);
  el.textContent = `about ${secs} seconds` + (secs > hi ? ` (long: it will be sped up or trimmed to ${hi}s)`
    : secs < lo ? (spare ? ` (researched lines will be added to reach ${lo}s)` : " (short: tap + Add a line, or the end card stays on longer)") : "");
  el.classList.toggle("warn", secs > hi || secs < lo);
}
// Thumbnail of a generated chart or illustration (drawn with the real renderer at full size, then scaled).
let thumbStage = null;
function drawGenerated(cv, v) {
  thumbStage ??= Object.assign(document.createElement("canvas"), { width: 1080, height: 1920 });
  const n = parseInt(state.accent.slice(1), 16), accent = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const bg = v.type === "stat" ? new StatBg(v.spec, accent, state.capPos) : new IllusBg(v.icon, v.label, accent, state.capPos);
  bg.draw(thumbStage.getContext("2d"), 0.9);
  cv.getContext("2d").drawImage(thumbStage, 0, 0, cv.width, cv.height);
  bg.dispose();
}
const VISUAL_NAMES = { photo: "Photo", stat: "Chart", illus: "Picture" };

function showReview() {
  const { script } = state.plan;
  $("review-title").textContent = script.title;
  const content = script.lines.filter((l) => l.kind !== "outro").length;
  const visuals = script.lines.map((l, i) => decideVisual(l, i, script.title));
  $("scenes").innerHTML = script.lines.map((l, i) => {
    const v = visuals[i];
    let tag = i === 0 ? "Hook" : l.kind === "outro" ? "Ending" : l.kind === "chart" ? "Chart" : `Scene ${i}`;
    if (l.kind === "media") tag += ` · ${VISUAL_NAMES[v.type]}${v.type === "stat" ? ": " + describeStat(v.spec) : v.type === "illus" ? ": " + (v.label || v.icon).toLowerCase() : ""}`;
    const thumb = l.kind === "outro" ? `<div class="thumb">END<br>CARD</div>` : l.kind === "chart" ? `<div class="thumb">LIVE<br>CHART</div>`
      : `<div class="thumb"><canvas width="152" height="270" data-thumb="${i}"></canvas></div>`;
    const mode = l.vmode || "auto", hasStat = Boolean(l.analysis?.stat);
    const chips = l.kind !== "media" ? "" : `<div class="mini vis">${[["auto", "Auto"], ["photo", "Photo"], ["chart", "Chart"], ["illus", "Picture"]]
      .filter(([m]) => m !== "chart" || hasStat)
      .map(([m, txt]) => `<button data-vmode="${i}:${m}" class="${mode === m ? "on" : ""}">${txt}</button>`).join("")}</div>`;
    const tools = l.kind !== "media" ? (l.kind === "chart" && content > 2 ? `<div class="mini"><button class="del" data-del="${i}">Remove</button></div>` : "")
      : `<div class="mini"><button data-swap="${i}">New photo</button><button data-search="${i}">Search…</button><button data-mine="${i}">My photo</button>${content > 2 ? `<button class="del" data-del="${i}">Remove</button>` : ""}</div>`;
    return `<div class="scene"><div>${thumb}</div><div><div class="scene-tag"><span>${esc(tag)}</span></div>
      <textarea data-line="${i}" rows="3">${esc(l.text)}</textarea>${chips}${tools}</div></div>`;
  }).join("");
  script.lines.forEach((l, i) => {
    const cv = document.querySelector(`[data-thumb="${i}"]`), v = visuals[i];
    if (!cv) return;
    if (v.type === "photo" && l.asset?.bitmap) drawThumb(cv, l.asset);
    else if (v.type === "stat" || v.type === "illus") drawGenerated(cv, v);
  });
  updateEstimate();
  screen("review");
}
$("scenes").addEventListener("input", (e) => {
  const i = e.target.dataset.line; if (i == null) return;
  const line = state.plan.script.lines[+i];
  line.text = e.target.value.replace(/\s+/g, " ").trim();
  line.analysis = null;                                  // re-read numbers and concepts from the new text
  state.plan.edited = true; updateEstimate();
});
async function setAsset(i, assetPromise, label) {
  const line = state.plan.script.lines[i];
  const btn = document.querySelector(`[data-swap="${i}"]`); if (btn) btn.textContent = label;
  const asset = await assetPromise.catch(() => null);
  if (asset) { line.asset?.bitmap?.close?.(); line.asset = asset; line.vmode = "photo"; } else toast("No other photo found. Try Search…");
  showReview();
}
$("scenes").addEventListener("change", (e) => { if (e.target.dataset.line != null) showReview(); });   // update visuals after editing
$("scenes").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const plan = state.plan;
  if (b.dataset.vmode != null) {
    const [i, m] = b.dataset.vmode.split(":");
    plan.script.lines[+i].vmode = m === "auto" ? undefined : m;
    return showReview();
  }
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
  // The researched line's photo may still be loading: show the scene now, and the photo once it arrives.
  const line = extra ? { ...extra, query: q, asset: null } : { text: "", visual: q, query: q, kind: "media", asset: null };
  if (extra) Promise.resolve(extra.asset).then((a) => { if (a && !line.asset) { line.asset = a; if (state.plan) showReview(); } }).catch(() => {});
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
$("save-draft").addEventListener("click", () => {
  if (!state.plan) return;
  const d = draftFromPlan(state.plan);
  if (state.draftId) d.id = state.draftId;
  state.draftId = d.id;
  toast(saveDraft(d) ? "Draft saved. Find it in the Library." : "Couldn't save the draft (storage full?)");
});
$("reroll").addEventListener("click", () => { if (state.plan) releasePlan(state.plan); state.plan = null; start(); });
$("cancel-review").addEventListener("click", () => { if (state.plan) releasePlan(state.plan); state.plan = null; closeAudio(); screen("form"); });

/* ---------- sound test (diagnostics) ---------- */
// A beep straight through the speaker. "playback" makes it audible even with the Silent switch on,
// the same way video sound is, so it only fails if the phone's own audio is muted or routed elsewhere.
function playBeep() {
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch { /* older iOS */ }
  const ctx = unlockAudio(); if (!ctx) { toast("This browser can't play sound"); return; }
  const t = ctx.currentTime + 0.05, osc = ctx.createOscillator(), g = ctx.createGain();
  osc.frequency.value = 880; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.4, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  osc.connect(g); g.connect(ctx.destination); osc.start(t); osc.stop(t + 0.65);
}

async function soundTest() {
  const ctx = unlockAudio();   // inside the tap
  const btn = $("sound-test"), out = $("sound-out");
  btn.disabled = true; btn.textContent = "Testing…"; out.innerHTML = "";
  const lines = [];
  try {
    await loadFonts();
    const secs = 3, audio = new Float32Array(secs * SR);
    [523.25, 659.25, 783.99].forEach((f, k) => {           // three gentle notes
      const s0 = Math.floor((0.25 + k * 0.9) * SR), len = Math.floor(0.7 * SR);
      for (let i = 0; i < len; i++) audio[s0 + i] += 0.5 * Math.sin(2 * Math.PI * f * i / SR) * Math.min(1, i / 800) * Math.exp(-i / SR * 2.5);
    });
    const job = { title: "Sound test", brand: "Sound test", accent: state.accent, audio,
      scenes: [{ start: 0, end: secs, kind: "outro" }],
      words: ["You", "should", "hear", "three", "notes."].map((t, i) => ({ text: t, start: 0.2 + i * 0.55, end: 0.7 + i * 0.55 })) };
    const cv = document.createElement("canvas");
    const t0 = performance.now();
    const r = await renderReel(job, cv, ctx, null, params.get("encoder") || undefined);
    const url = URL.createObjectURL(r.blob);
    const written = r.written ? `written by the app: ${r.written.seconds.toFixed(1)} s, loudest ${r.written.peakDb.toFixed(0)} dB` : "";
    lines.push(`Sound in the file: <b style="color:${r.sound === false ? "var(--bad)" : (r.sound || written) ? "var(--good)" : "var(--muted)"}">${
      r.sound === false ? "none ✗" : r.sound ? "yes ✓" + (written ? ` (${written})` : "") : written ? `yes ✓ (${written})` : "couldn't check"}</b>`);
    lines.push(`Method: ${esc(r.how)} · ${esc(r.blob.type || "?")} · ${(r.blob.size / 1024).toFixed(0)} KB · ${Math.round(performance.now() - t0)} ms`);
    out.innerHTML = `<video src="${url}" controls playsinline style="max-height:40vh;margin-top:10px"></video>`;
  } catch (e) {
    lines.push(`<span style="color:var(--bad)">Failed: ${esc(e.message || e)}</span>`);
  }
  const info = await encoderInfo();
  lines.push(`H.264 encoder: ${info.webcodecs ? "yes" : "no"} · AAC encoder: ${info.aac ? "yes" : "no"} · Recorder: ${info.recorder ? "yes" : "no"} · Audio: ${esc(ctx?.state || "unavailable")} at ${ctx?.sampleRate || "?"} Hz`);
  lines.push(`<span style="word-break:break-all">${esc(navigator.userAgent)}</span>`);
  out.insertAdjacentHTML("beforeend", `
    <p style="margin-top:12px"><b>1. Play the clip above.</b> Do you hear three notes?</p>
    <div class="btns"><button class="btn" data-ans="clip:heard">I hear them</button><button class="btn" data-ans="clip:silent">No sound</button></div>
    <p style="margin-top:12px"><b>2. Speaker check.</b> Plays a short beep straight through your speaker.</p>
    <div class="btns"><button class="btn wide" id="beep">Play beep</button>
      <button class="btn" data-ans="beep:heard">I heard it</button><button class="btn" data-ans="beep:silent">No sound</button></div>
    <p class="meta" style="margin-top:12px" id="diag">${lines.join("<br>")}</p>
    <div class="btns"><button class="btn main wide" id="copy-diag">Copy these results</button></div>`);
  const answers = {};
  out.querySelectorAll("[data-ans]").forEach((b) => b.addEventListener("click", () => {
    const [k, v] = b.dataset.ans.split(":"); answers[k] = v;
    out.querySelectorAll(`[data-ans^="${k}:"]`).forEach((x) => x.classList.toggle("main", x === b));
  }));
  $("beep").onclick = () => playBeep();
  $("copy-diag").onclick = () => copy([
    `Clip: ${answers.clip === "heard" ? "heard the notes" : answers.clip === "silent" ? "NO sound" : "not answered"}`,
    `Speaker beep: ${answers.beep === "heard" ? "heard" : answers.beep === "silent" ? "NO sound" : "not answered"}`,
    $("diag").innerText,
  ].join("\n"));
  btn.disabled = false; btn.textContent = "Run sound test";
}

/* ---------- Idea Lab (loaded the first time the tab opens) ---------- */
async function openIdeas() {
  if (state.ideasUI || state.ideasLoading) return;
  state.ideasLoading = true;
  try {
    const ui = await import("./ideas-ui.js");
    await ui.init({ store, toast, esc, niche: () => state.niche, makeFromIdea });
    state.ideasUI = ui;
  } catch (e) { console.warn(e); toast("The Idea Lab couldn't start: " + (e.message || e)); }
  state.ideasLoading = false;
}

async function makeFromIdea(idea) {
  if (state.busy) return;
  unlockAudio();   // inside the tap
  state.busy = true; state.draftId = null;
  show("create");
  screen("job"); $("job-title").textContent = "Writing your script…"; $("preview").classList.add("hidden"); say("Building the script from your idea…", 0.05);
  try {
    state.plan = await planFromIdea(idea, options(), { say });
    if ($("review-on").checked) { state.busy = false; return showReview(); }
    await produce();
  } catch (e) { screen("form"); showError(e, "That didn't work"); state.busy = false; }
}

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
  prefChips("cap-styles", CAPTION_STYLES, "capStyle", "bold", drawStylePreview);
  prefChips("cap-pos", CAPTION_POS, "capPos", "low", drawStylePreview);
  prefChips("moods", MOODS, "mood", store.get("musicOff") === "1" ? "none" : "lofi");
  prefChips("lengths", LENGTH_LABELS, "length", "standard", updateEstimate);
  $("handle").value = store.get("handle") || "";
  $("handle").addEventListener("change", () => { $("handle").value = cleanHandle($("handle").value); store.set("handle", $("handle").value); });
  $("offline").checked = store.get("offline") === "1";
  $("offline").addEventListener("change", () => {
    store.set("offline", $("offline").checked ? "1" : "0");
    if ($("offline").checked) toast("Offline mode: no downloads. News and market recaps switch to explainers.");
  });
  $("pops").checked = store.get("pops") !== "0";
  $("pops").addEventListener("change", () => { store.set("pops", $("pops").checked ? "1" : "0"); drawStylePreview(); });
  $("handle").addEventListener("input", drawStylePreview);
  $("brand").addEventListener("input", drawStylePreview);
  drawStylePreview();
  $("review-on").checked = store.get("review") !== "0";
  $("review-on").addEventListener("change", () => store.set("review", $("review-on").checked ? "1" : "0"));
  $("custom").addEventListener("keydown", (e) => { if (e.key === "Enter") start(); });
  if (store.get("made")) $("first-run").classList.add("hidden");
  renderTopics();
  $("go").addEventListener("click", start);
  $("sound-test").addEventListener("click", soundTest);
  $("wipe").addEventListener("click", async () => { if (confirm("Delete every reel stored on this phone?")) { await clearReels(); renderLibrary(); toast("Deleted"); } });
  const info = await encoderInfo();
  $("encoder").textContent = info.webcodecs ? `Video encoder: on-device H.264, ${info.video.width}×${info.video.height}, with uncompressed sound.`
    : info.recorder ? "Video encoder: real-time recording (a reel takes about as long to make as it runs)."
    : "This browser can't encode video. Update iOS and use Safari.";
  window.__ready = true;
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
init().catch((e) => { console.error(e); toast("Couldn't start the app: " + e.message); });
