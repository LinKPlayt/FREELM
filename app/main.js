// UI glue for the phone app.
import { drawAlternatives, seriesTopics, appData, planReel, produceReel, releasePlan, estimateSeconds, lengthRange, draftFromPlan, planFromDraft, planFromIdea, decideVisual } from "./make.js";
import { StatBg, IllusBg } from "./graphics.js";
import { describeStat } from "./visuals.js";
import { hookOptions, coach } from "./extras.js";
import { checkWording, proofread } from "./wording.js";
import { drawArt, motifsFor, pickMotifs, styleFor, ART_STYLES, forgetArt, savedArt, drawAhead, nextBatch, MOTIFS } from "./illustrator.js";
const MOTIFS_COUNT = Object.keys(MOTIFS).length;
import { KOKORO_VOICES, setVoice, loadVoice, phonemize, synthesize, voiceRate, releaseVoice, voiceNotice, resetVoiceLevel, naturalFailed, lastVoiceError } from "./tts.js";
const factModule = () => import("./ai/factcheck.js");
import { listReels, saveReel, deleteReel, clearReels, listDrafts, saveDraft, deleteDraft } from "./store.js";
import { platformCaptions, setPronunciations, visualMatch } from "./script.js";
import { FIELDS, getResult, saveResult, insights } from "./results.js";
import { APP_VERSION, UPDATES } from "./version.js";
import { USER_CACHE, USER_MUSIC } from "./make.js";
import { encoderInfo, renderReel, loadFonts, previewFrame } from "./render.js";
import { SR } from "./music.js";

const $ = (id) => document.getElementById(id);
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
const MODES = ["auto", "evergreen", "news", "market", "custom", "quiz"];
const MODE_LABELS = { auto: "Auto", evergreen: "Explainer", news: "Today's news", market: "Market recap", custom: "Your topic", quiz: "Quiz" };
const COLORS = ["#FFD60A", "#2ED573", "#00D2FF", "#FF6B81", "#FF9F1A", "#B388FF", "#FFFFFF"];
const SPEEDS = { slow: 0.92, normal: 1.0, fast: 1.1 };
const MUSIC_VOLUMES = { low: 0.55, medium: 1, high: 1.5 };
// Narrators: the natural voices (Kokoro) and the classic fast voice (Piper).
const VOICE_LABELS = { ...Object.fromEntries(Object.entries(KOKORO_VOICES).map(([id, v]) => [id, v.name])), classic: "Classic (fast)" };
const voiceOpts = (id) => (id === "classic" ? { engine: "fast" } : { engine: "natural", voice: id });
const CAPTION_STYLES = { bold: "Bold", boxed: "Boxed", clean: "Clean" };
const CAPTION_POS = { low: "Low", middle: "Middle" };
const MOODS = { lofi: "Lo-fi", upbeat: "Upbeat", cinematic: "Cinematic", calm: "Calm", mine: "My music", none: "None" };
const COVER_STYLES = { bold: "Bold title", number: "Big number", question: "Question" };
const LENGTH_LABELS = { short: "Short 20–30s", standard: "Standard 30–45s", long: "Long 40–60s", deep: "Deep dive 60–90s", full: "Full story 2–3 min" };
const DEPTH_LABELS = { 1: "Quick", 2: "Standard", 3: "Deep", 4: "Maximum" };
const DEPTH_NOTES = { 1: "Reads about 6 article summaries. Fastest.", 2: "Reads about 8 articles and the full text of the top 3.",
  3: "Follows leads two steps out, reads 8 full articles, and checks open facts against live Wikipedia.",
  4: "Follows leads three steps out, reads 16 full articles, keeps up to 48 facts, and checks open facts against live Wikipedia." };
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
      captionStyle: state.capStyle, captionPos: state.capPos, artStyle: state.art, handle, audio: new Float32Array(1),
      scenes: [{ start: 0, end: 3, kind: "image", bitmap: sampleBitmap, stat: $("pops").checked ? "50%" : null }], words }, $("style-preview"), 0.55);
  } catch (e) { console.warn("preview", e); }
}

function cleanHandle(v) {
  const h = (v || "").trim().replace(/^@+/, "").replace(/[^A-Za-z0-9._]/g, "").slice(0, 30);
  return h ? "@" + h : "";
}
const CTA = "Follow for a new money tip every day.";
// The ending: what you ask viewers to do. Comments, saves and shares are what the apps reward most.
const CTA_LABELS = { follow: "Follow", comment: "Ask a question", save: "Save this", share: "Share this" };
function ctaText(kind, handle) {
  const follow = handle ? `Follow ${handle} for more.` : "Follow for more.";
  return {
    follow: handle ? `Follow ${handle} for a new money tip every day.` : CTA,
    comment: `Would you try this? Tell me in the comments. ${follow}`,
    save: `Save this so you have it when you need it. ${follow}`,
    share: `Send this to someone who needs to hear it. ${follow}`,
  }[kind] || CTA;
}
const state = { niche: "personal finance", mode: "auto", data: null, urls: new Map(), reels: new Map(), busy: false,
  accent: "#FFD60A", speed: "normal", plan: null };
const params = new URLSearchParams(location.search);

function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3200); }
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Copies text, reliably on iPhone. Returns true when it worked. Order:
// 1. the Clipboard API (needs the tap that started this; Safari sometimes refuses it in home-screen apps),
// 2. a hidden text box selected the way iOS needs (setSelectionRange; select() does nothing on iOS),
// 3. if both fail, the text is shown in a sheet, already selected, to copy by hand. Never claims success it didn't have.
function copyWithTextBox(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("aria-hidden", "true");
  // 16px stops iOS zooming in; fixed + transparent keeps the page from jumping.
  Object.assign(ta.style, { position: "fixed", top: "0", left: "0", width: "1px", height: "1px", opacity: "0", fontSize: "16px", border: "0", padding: "0" });
  document.body.appendChild(ta);
  const active = document.activeElement;
  let ok = false;
  try {
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(0, text.length);
    ok = document.execCommand("copy");
  } catch { ok = false; }
  ta.remove();
  window.getSelection?.().removeAllRanges();
  active?.focus?.({ preventScroll: true });
  return ok;
}
function showCopySheet(text, label) {
  document.getElementById("copy-sheet")?.remove();
  const sheet = document.createElement("div");
  sheet.id = "copy-sheet"; sheet.className = "copy-sheet";
  sheet.innerHTML = `<div class="copy-box"><h3>${esc(label || "Copy this")}</h3>
    <p class="meta">Your phone blocked automatic copying. The text is selected: tap <b>Copy</b> in the menu (or tap and hold, then Copy).</p>
    <textarea readonly rows="10"></textarea>
    <div class="btns"><button class="btn main" data-sheet="retry">Copy again</button><button class="btn" data-sheet="close">Done</button></div></div>`;
  const ta = sheet.querySelector("textarea"); ta.value = text;
  sheet.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-sheet]");
    if (e.target === sheet || b?.dataset.sheet === "close") return sheet.remove();
    if (b?.dataset.sheet === "retry") {
      if (await tryCopy(text)) { toast("Copied"); sheet.remove(); }
      else { ta.focus(); ta.setSelectionRange(0, text.length); }
    }
  });
  document.body.appendChild(sheet);
  ta.focus(); ta.setSelectionRange(0, text.length);
}
async function tryCopy(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  }
  return copyWithTextBox(text);
}
async function copy(text, { label, done = "Copied" } = {}) {
  text = String(text ?? "").trim();
  if (!text) { toast("Nothing to copy"); return false; }
  const ok = await tryCopy(text);
  if (ok) toast(done); else showCopySheet(text, label);
  return ok;
}
function repo() {   // https://owner.github.io/repo/ -> owner/repo
  const m = location.hostname.match(/^([^.]+)\.github\.io$/), seg = location.pathname.split("/").filter(Boolean)[0];
  return m && seg ? `${m[1]}/${seg}` : "LinKPlayt/FREELM";
}

function show(tab) {
  if (tab === "about") renderStorage();
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
// The cover image as the video's poster: the Library shows covers and decodes a video only when played.
function posterFor(reel) { const k = "poster-" + reel.id; if (!state.urls.has(k)) state.urls.set(k, URL.createObjectURL(reel.cover)); return state.urls.get(k); }
function reelCard(r, inline = false) {
  state.reels.set(r.id, r);
  const mb = ((r.blob?.size || 0) / 1e6).toFixed(1);
  return `<div class="${inline ? "" : "card"}" data-reel="${esc(r.id)}">
    <video src="${urlFor(r)}#t=0.5" controls playsinline preload="${r.cover ? "none" : "metadata"}"${r.cover ? ` poster="${posterFor(r)}"` : ""}></video>
    <div class="reel-title">${esc((r.title || "Untitled reel").replace(" #Shorts", ""))}</div>
    <div class="meta">${Math.round(r.duration || 0)}s · ${esc(r.kind || "reel")} · ${mb} MB</div>
    <div class="btns">
      <button class="btn main wide" data-act="share">Save / Share</button>
      <a class="btn wide" href="${urlFor(r)}" download="${esc(r.id)}.${esc(r.ext)}">Download</a>
    </div>
    <div class="meta" style="margin-top:12px">Copy the caption for:</div>
    <div class="copy-row">
      <button class="btn" data-act="cap-youtube">YouTube</button><button class="btn" data-act="cap-tiktok">TikTok</button><button class="btn" data-act="cap-instagram">Instagram</button>
    </div>
    ${r.srt || r.cover ? `<div class="btns">${r.cover ? `<button class="btn" data-act="cover">Cover image</button>` : ""}${r.srt ? `<button class="btn" data-act="srt">Captions (.srt)</button>` : ""}</div>` : ""}
    <div class="btns"><button class="btn wide" data-act="remix">Remix: edit this script and make it again</button></div>
    ${inline ? "" : resultsForm(r)}
    <div class="btns" style="margin-top:0">
      ${inline ? "" : `<button class="btn danger wide" data-act="delete">Delete</button>`}
    </div></div>`;
}
function resultsSummary(res) {
  if (!Number(res.views)) return "Add results (views, likes…)";
  const eng = ((Number(res.likes) || 0) + (Number(res.comments) || 0) + (Number(res.saves) || 0)) / Number(res.views) * 100;
  return `Results: ${Number(res.views).toLocaleString()} views${eng ? ` · ${eng.toFixed(1)}% engagement` : ""}`;
}
// How a reel did, typed in by you (from TikTok, Instagram or YouTube), for the "What works" summary.
function resultsForm(r) {
  const res = getResult(r.id)?.stats || {};
  return `<details class="results"><summary>${resultsSummary(res)}</summary>
    <div class="results-grid">${FIELDS.map(([k, label]) => `<div><label>${label}</label><input type="number" inputmode="numeric" min="0" data-result="${k}" value="${res[k] || ""}"></div>`).join("")}</div></details>`;
}
function renderInsights() {
  const ins = insights({ voice: VOICE_LABELS, cta: CTA_LABELS, music: MOODS, captions: CAPTION_STYLES });
  $("insights").innerHTML = ins.rows.length ? `<div class="card"><h2>What works for you</h2>
      <p class="meta">From ${ins.count} reels with results · ${ins.avg} average views · best: ${esc(ins.top)}</p>
      ${ins.rows.map((x) => `<div class="insight"><b>${esc(x.name)}</b> · ${esc(x.text)}<br><small class="meta">next best ${esc(x.vs)}${x.lift >= 1.2 ? ` · ${x.lift.toFixed(1)}× more` : ""}</small></div>`).join("")}
      <p class="meta" style="margin-top:8px">Make more of what wins. More results make this more reliable.</p></div>`
    : `<div class="card"><h2>What works for you</h2><p class="meta">Add the views (and likes, comments, saves) of ${ins.count ? "one more reel" : "two or more reels"} under “Add results” and this shows which niche, length, narrator, ending and music get you the most views.</p></div>`;
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
$("reels").addEventListener("change", (e) => {
  const input = e.target.closest("[data-result]"); if (!input) return;
  const card = input.closest("[data-reel]"), r = state.reels.get(card?.dataset.reel); if (!r) return;
  const stats = Object.fromEntries([...card.querySelectorAll("[data-result]")].map((i) => [i.dataset.result, i.value]));
  if (saveResult(r, stats)) {
    card.querySelector(".results summary").textContent = resultsSummary(stats);
    renderInsights();
  } else toast("Couldn't save the results (storage full?)");
});
async function renderLibrary() {
  renderDrafts();
  const list = await listReels();
  renderInsights();
  $("reels").innerHTML = list.length ? list.map((r) => { try { return reelCard(r); } catch (e) { console.warn("reel card", e); return ""; } }).join("") : `<div class="empty">No reels yet.<br>Make your first one in Create.</div>`;
}
document.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-act]"); if (!btn) return;
  const card = btn.closest("[data-reel]"), r = card && state.reels.get(card.dataset.reel); if (!r) return;
  if (btn.dataset.act.startsWith("cap-")) {
    const which = btn.dataset.act.slice(4), name = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram" }[which];
    let text = "";
    try { text = platformCaptions(r)[which]; } catch (e) { console.warn("caption", e); }
    await copy(text, { label: `${name} caption`, done: `${name} caption copied` });
    return;
  }
  if (btn.dataset.act === "delete" && confirm("Delete this reel from your phone?")) { await deleteReel(r.id); card.remove(); }
  if (btn.dataset.act === "remix") {
    // The reel's script becomes a draft in the review screen: change the voice, style, lines or hook, then make it again.
    if (state.busy) return;
    const data = await appData(), generic = data.generic_visuals[r.niche] || data.generic_visuals["personal finance"];
    const lines = (r.script || "").split("\n").map((x) => x.trim()).filter(Boolean);
    const draft = { id: "draft-" + Date.now(), saved: Date.now(), label: (r.title || "Remix").replace(/\s*#Shorts$/, ""), edited: true, generic,
      script: { kind: r.kind || "custom", topicId: "remix-" + r.id, title: (r.title || "Remix").replace(/\s*#Shorts$/, ""), topicTitle: r.topic || "", niche: r.niche || "personal finance",
        lines: lines.map((text, i) => ({ text, visual: "", query: visualMatch(text) || generic[i % generic.length], kind: i === lines.length - 1 ? "outro" : "media" })),
        extras: [], sources: r.sources || [], tags: r.tags || [] } };
    state.busy = true; show("create");
    screen("job"); $("job-title").textContent = "Opening your remix…"; $("preview").classList.add("hidden"); say("Finding photos…", 0);
    try { state.plan = await planFromDraft(draft, { say }); state.draftId = null; showReview(); }
    catch (err) { screen("form"); showError(err, "The remix couldn't be opened"); }
    state.busy = false;
    return;
  }
  if (btn.dataset.act === "cover" || btn.dataset.act === "srt") {
    const file = btn.dataset.act === "cover" ? new File([r.cover], `${r.id}-cover.jpg`, { type: "image/jpeg" })
      : new File([r.srt], `${r.id}.srt`, { type: "text/plain" });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else { const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); }
    } catch (e) { if (e.name !== "AbortError") toast("Couldn't share: " + e.message); }
    return;
  }
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
    cta: ctaText(state.cta, cleanHandle($("handle").value)), ctaKind: state.cta, logo: store.get("logo") || "", coverStyle: state.cover,
    music: state.mood, accent: state.accent, voiceSpeed: SPEEDS[state.speed] || 1, length: state.length,
    voiceEngine: voiceOpts(state.voice).engine, voice: voiceOpts(state.voice).voice, musicVolume: MUSIC_VOLUMES[state.musicVol] ?? 1,
    captionStyle: state.capStyle, captionPos: state.capPos, pops: $("pops").checked, offline: $("offline").checked,
    sfx: $("sfx").checked, cuts: $("cuts").checked, showSources: $("sources").checked,
    depth: Number(state.depth) || 2, factCheck: $("factcheck").checked, strict: $("factcheck").checked && $("strict").checked,
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
const say = (text, f) => { $("job-step").textContent = text; if (f != null) { $("bar").style.width = Math.round(f * 100) + "%"; jobProgress(f); } };

// While a video is made: a checklist of the steps, and how long is left (from this phone's past reels).
const JOB_STEPS = [[0, "Get the voice ready"], [0.25, "Record the voiceover"], [0.555, "Music and scenes"], [0.6, "Make the video"], [0.99, "Cover and captions"]];
let job = null;
function jobStart(expectedSeconds) {
  job = { t0: performance.now(), expected: expectedSeconds };
  $("job-steps").innerHTML = JOB_STEPS.map(([, name]) => `<li>${name}</li>`).join(""); $("job-steps").classList.remove("hidden");
  $("job-eta").textContent = expectedSeconds ? `About ${fmtDuration(expectedSeconds)} on this phone.` : "";
}
function jobEnd() { job = null; $("job-steps").classList.add("hidden"); $("job-eta").textContent = ""; }
function jobProgress(f) {
  if (!job) return;
  const now = JOB_STEPS.reduce((k, [at], i) => (f >= at ? i : k), 0);
  [...$("job-steps").children].forEach((li, i) => { li.className = i < now ? "done" : i === now ? "now" : ""; });
  const elapsed = (performance.now() - job.t0) / 1000;
  if (f > 0.08 && elapsed > 4) {
    const byProgress = elapsed / f - elapsed;
    const left = job.expected ? Math.max(0, 0.5 * byProgress + 0.5 * (job.expected - elapsed)) : byProgress;
    $("job-eta").textContent = left > 3 ? `About ${fmtDuration(left)} left.` : "Almost done…";
  }
}
const fmtDuration = (s) => (s < 60 ? `${Math.max(5, Math.round(s / 5) * 5)} seconds` : `${Math.round(s / 30) / 2} min`.replace(".5 min", "½ min"));
// Seconds of making per second of video, averaged over this phone's recent reels.
function makeRate() { try { const r = JSON.parse(localStorage.getItem("makeRates") || "[]"); return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0; } catch { return 0; } }
function learnMakeRate(makeSeconds, videoSeconds) {
  if (!(videoSeconds > 5) || !(makeSeconds > 1)) return;
  try { const r = JSON.parse(localStorage.getItem("makeRates") || "[]"); r.push(makeSeconds / videoSeconds); localStorage.setItem("makeRates", JSON.stringify(r.slice(-6))); } catch { /* private mode */ }
}
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
  screen("job"); $("job-title").textContent = "Making your reel…"; $("preview").classList.remove("hidden");
  jobStart(makeRate() * (state.plan ? estimateSeconds(state.plan.script.lines, SPEEDS[state.speed] || 1) : 0));
  say("Starting…", 0);
  let wake = null; try { wake = await navigator.wakeLock?.request("screen"); } catch { /* not supported */ }
  const t0 = performance.now();
  try {
    if (state.ideasUI) { say("Freeing memory…", 0); await state.ideasUI.unloadAI(); }   // rendering needs the memory
    const made = { script: { ...state.plan.script, lines: state.plan.script.lines.map((l) => ({ text: l.text, kind: l.kind })) }, opts: options() };
    const reel = await produceReel(state.plan, options(), { say, canvas: $("preview"), audioCtx: state.audioCtx, toast });
    state.plan = null;
    // Quietly draw other ways to illustrate this video's scenes, so they're saved and ready next time.
    if (made.opts.artStyle !== "icons") setTimeout(() => drawAlternatives(made.script, made.opts).then(() => { if (document.querySelector("#tab-about.active")) renderStorage(); }).catch(() => {}), 2500);
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
    learnMakeRate((performance.now() - t0) / 1000, reel.duration);
    store.set("voiceReady-" + voiceOpts(state.voice).engine, "1");
    window.__lastReel = reel;
  } catch (e) {
    screen(state.plan ? "review" : "form");
    if (state.plan) showReview();
    showError(e, "The video couldn't be made");
  }
  wake?.release?.().catch(() => {}); closeAudio(); jobEnd();
  state.busy = false;
}
// A 3-part series: this script is part 1; parts 2 and 3 cover related topics from the same research.
// Each part ends by pointing to the next one, and all three go to the Library.
async function produceSeries() {
  if (state.busy || !state.plan) return;
  unlockAudio();
  state.busy = true;
  screen("job"); $("job-title").textContent = "Planning your series…"; $("preview").classList.remove("hidden"); say("Finding related topics…", 0.02);
  let wake = null; try { wake = await navigator.wakeLock?.request("screen"); } catch { /* not supported */ }
  const t0 = performance.now(), made = [];
  try {
    if (state.ideasUI) await state.ideasUI.unloadAI();
    const first = state.plan, base = first.script.title.replace(/\s*#Shorts$/, "").replace(/\s+·\s+Part \d.*$/, "");
    const next = await seriesTopics(first.script, 2);
    if (!next.length) throw new Error("Couldn't find related topics for a series. Try an explainer or your own topic.");
    const parts = [first, ...next.map(() => null)];
    const total = parts.length;
    const opts = options();
    for (let i = 0; i < total; i++) {
      const tag = `Part ${i + 1} of ${total}`;
      $("job-title").textContent = `Making ${tag}…`;
      const partSay = (text, f) => say(`${tag}: ${text}`, f);
      let plan = parts[i];
      if (!plan) plan = await planReel({ ...opts, mode: "custom", customTopic: next[i - 1] }, { say: partSay });
      const s = plan.script;
      s.title = `${i === 0 ? base : s.title.replace(/\s*#Shorts$/, "")} · Part ${i + 1}`;
      const outro = s.lines.find((l) => l.kind === "outro");
      if (outro && i < total - 1) outro.text = `Follow for part ${i + 2}: ${next[i]}.`;
      const reel = await produceReel(plan, opts, { say: partSay, canvas: $("preview"), audioCtx: state.audioCtx, toast });
      await saveReel(reel); made.push(reel);
      if (i === 0) { state.plan = null; if (state.draftId) { deleteDraft(state.draftId); state.draftId = null; } }
    }
    screen("form");
    store.set("voiceReady-" + voiceOpts(state.voice).engine, "1");
    $("result").innerHTML = `<h2>Your ${made.length}-part series is ready</h2><p>Made in ${Math.round((performance.now() - t0) / 1000)}s on this device. All parts are in the Library.</p>` + made.map((r) => reelCard(r, true)).join("<hr>");
    $("result").classList.remove("hidden");
    window.__lastReel = made.at(-1); window.__series = made;
  } catch (e) {
    screen(state.plan ? "review" : "form");
    if (state.plan) showReview();
    showError(e, made.length ? `The series stopped after part ${made.length}` : "The series couldn't be made");
  }
  wake?.release?.().catch(() => {}); closeAudio();
  state.busy = false;
}

// Plan my week: five scripts on different topics in this niche, saved as drafts (no video yet).
// Photos are found when a draft is opened, so this is quick and light.
async function planWeek() {
  if (state.busy) return;
  state.busy = true;
  screen("job"); $("job-title").textContent = "Planning your week…"; $("preview").classList.add("hidden");
  const made = [], used = [];
  try {
    const base = options();
    for (let i = 0; i < 5; i++) {
      const opts = { ...base, mode: base.mode === "custom" ? "auto" : base.mode, noPhotos: true, exclude: used };
      const plan = await planReel(opts, { say: (t, f) => say(`Script ${i + 1} of 5: ${t}`, (i + (f || 0)) / 5) });
      used.push(plan.script.topicId);
      if (made.some((d) => d.label === plan.script.title)) { releasePlan(plan); continue; }
      const d = draftFromPlan(plan, plan.script.title); releasePlan(plan);
      if (!saveDraft(d)) break;
      made.push(d);
    }
    screen("form");
    $("result").innerHTML = `<h2>Your week is planned</h2><p>${made.length} drafts saved in the Library, each fact-checked and ready to review. Open one when you're ready to make it.</p><ol class="steps">${made.map((d) => `<li>${esc(d.label)}</li>`).join("")}</ol>`;
    $("result").classList.remove("hidden");
  } catch (e) { screen("form"); showError(e, made.length ? `Planned ${made.length}, then stopped` : "Couldn't plan the week"); }
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

// Plays a sample line in the chosen narrator's voice (downloads the voice the first time).
// It plays through an <audio> element, not Web Audio: on iPhone, Web Audio is silent when the
// ring/silent switch is on, and an <audio> element unlocked during the tap can play later.
let previewing = false, previewAudio = null;
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
function wavBlob(samples, rate) {
  const buf = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buf);
  const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
  return new Blob([buf], { type: "audio/wav" });
}
async function previewVoice() {
  if (previewing) return;
  const btn = $("voice-preview");
  // Unlock audio playback now, while we're inside the tap.
  previewAudio ??= Object.assign(new Audio(), { playsInline: true });
  previewAudio.src = SILENCE; previewAudio.play().catch(() => {});
  previewing = true; btn.disabled = true;
  if (state.ideasUI) await state.ideasUI.unloadAI();      // the Idea Lab AI's memory, for the voice
  const line = "Here's the thing about compound interest: your money earns money, and then that money earns money too.";
  const speak = async () => {
    btn.textContent = "Loading…";
    const used = await loadVoice((f) => { btn.textContent = `Downloading ${Math.round(f * 100)}%`; });
    btn.textContent = "Speaking…";
    const [ph] = await phonemize([line]);
    return { used, samples: await synthesize(ph, SPEEDS[state.speed] || 1) };
  };
  try {
    setVoice(voiceOpts(state.voice));
    let r;
    try { r = await speak(); }
    catch (e) {
      if (voiceOpts(state.voice).engine !== "natural") throw e;
      naturalFailed(e); await releaseVoice(); r = await speak();       // the natural voice failed: the classic one
    }
    const err = lastVoiceError();
    if (r.used !== voiceOpts(state.voice).engine || err) toast(`The natural voice didn't work on this phone${err ? ` (${err})` : ""}. This is the classic voice.`);
    const url = URL.createObjectURL(wavBlob(r.samples, voiceRate()));
    previewAudio.src = url;
    await previewAudio.play();
    await new Promise((res) => { previewAudio.onended = res; previewAudio.onerror = res; setTimeout(res, 20000); });
    URL.revokeObjectURL(url);
  } catch (e) { toast("Couldn't play the voice: " + (e.message || e)); }
  await releaseVoice();                                   // give the memory back
  const n = voiceNotice(); if (n) toast(n);
  showVoiceNote();
  previewing = false; btn.disabled = false; btn.textContent = "▶ Hear it";
}
let showVoiceNote = () => {};

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
  // Reel coach: a score and the top things to improve.
  const visuals = plan.script.lines.map((l, i) => decideVisual(l, i, plan.script.title));
  const c = coach(plan.script.lines, { estimate: secs, range: [lo, hi], visuals });
  const color = c.score >= 80 ? "var(--good)" : c.score >= 60 ? "var(--accent)" : "var(--bad)";
  const facts = plan.script.lines.map((l) => l.check).filter((x) => x && x.kind === "fact");
  const ok = facts.filter((x) => x.status === "verified").length, bad = facts.filter((x) => x.status === "unverified" || x.status === "conflict").length;
  const srcs = new Set(facts.flatMap((x) => x.sources || [])).size, r = plan.script.research;
  const factLine = facts.length ? `<p class="meta" style="margin:6px 0 0"><b style="color:${bad ? "var(--bad)" : ok === facts.length ? "var(--good)" : "var(--accent)"}">Fact check: ${ok} of ${facts.length} facts verified</b>
      · ${srcs} source${srcs === 1 ? "" : "s"}${r ? ` · ${r.read} articles researched (${DEPTH_LABELS[r.depth] || ""} depth)` : ""}
      ${plan.fact?.fixed?.replaced || plan.fact?.fixed?.removed ? `<br>Strict accuracy swapped ${plan.fact.fixed.replaced} and removed ${plan.fact.fixed.removed} unverified line${plan.fact.fixed.replaced + plan.fact.fixed.removed === 1 ? "" : "s"}.` : ""}</p>
      ${bad ? `<div class="mini"><button data-strict="1">Swap or remove ${bad} unverified</button></div>` : ""}` : "";
  // Proofreader: what it would fix (done automatically when the video is made) and what to look at.
  const checks = plan.script.lines.map((l, i) => (l.kind === "section" || l.kind === "recap" || !l.text ? null : { i, ...checkWording(l.text), was: l.text })).filter(Boolean);
  const fixable = checks.filter((x) => x.text !== x.was), warns = checks.flatMap((x) => x.warnings.map((w) => `${x.i === 0 ? "Hook" : `Scene ${x.i}`}: ${w}`));
  const wordLine = `<p class="meta" style="margin:6px 0 0"><b style="color:${warns.length ? "var(--accent)" : "var(--good)"}">Wording: ${fixable.length ? `${fixable.length} line${fixable.length === 1 ? "" : "s"} to tidy` : "✓ reads correctly"}${warns.length ? ` · ${warns.length} to look at` : ""}</b>
      ${warns.slice(0, 3).map((w) => `<br>${esc(w)}`).join("")}</p>${fixable.length ? `<div class="mini"><button data-wording="1">Fix wording now</button></div>` : ""}`;
  $("coach").innerHTML = `<div class="coach-score"><b style="color:${color}">${c.score}</b><span>/100 reel score</span></div>` + factLine + wordLine +
    (c.tips.length ? `<ul class="steps" style="margin:6px 0 0">${c.tips.slice(0, 3).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p class="meta" style="margin:4px 0 0">Looks great. Ready to make.</p>`);
}
// Thumbnail of a generated chart or illustration (drawn with the real renderer at full size, then scaled).
let thumbStage = null;
function drawGenerated(cv, v, line, recent = []) {
  thumbStage ??= Object.assign(document.createElement("canvas"), { width: 1080, height: 1920 });
  const n = parseInt(state.accent.slice(1), 16), accent = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  if (v.type === "illus" && line && state.art !== "icons") {
    const script = state.plan?.script || {};
    const motifs = pickMotifs(line, script.topicTitle || script.title || "", recent.slice(-2));
    recent.push(motifs[0]);
    drawArt(thumbStage.getContext("2d"), { motifs, style: styleFor(state.art, script.niche), accent });
    cv.getContext("2d").drawImage(thumbStage, 0, 0, cv.width, cv.height);
    return;
  }
  const bg = v.type === "stat" ? new StatBg(v.spec, accent, state.capPos) : new IllusBg(v.icon, v.label, accent, state.capPos);
  bg.draw(thumbStage.getContext("2d"), 0.9);
  cv.getContext("2d").drawImage(thumbStage, 0, 0, cv.width, cv.height);
  bg.dispose();
}
const VISUAL_NAMES = { photo: "Photo", stat: "Chart", illus: "Illustration" };
const ART_CHOICES = { auto: "Auto (matches niche)", ...ART_STYLES, icons: "Animated icons" };

// Fact-check badge for a line, with the evidence (the source sentences) one tap away.
const FACT_LABEL = { verified: "✓ Verified", partial: "≈ Partly verified", unverified: "⚠ Not verified", conflict: "⚠ Source disagrees", tip: "Tip · advice, not a fact claim", takeaway: "Takeaway · opinion, not a fact claim" };
function factBadge(l, i) {
  const c = l.check;
  if (!c || !FACT_LABEL[c.status]) return `<span data-fact="${i}"></span>`;
  if (c.stale) return `<div class="fact" data-fact="${i}"><span class="fact-label">Checking your edit…</span></div>`;
  const n = (c.sources || []).length;
  const label = FACT_LABEL[c.status] + (c.status === "verified" && !c.calc ? (n > 1 ? ` · ${n} sources` : " · 1 source") : "") + (c.live ? " · live Wikipedia" : "") + (c.calc ? " by calculation" : "");
  const ev = (c.evidence || []).slice(0, 3).map((e) => `<li>“${esc(e.text)}”<br><small>${esc(e.source)}${e.section ? " — " + esc(e.section) : ""}</small></li>`).join("");
  const why = c.status === "unverified" ? "<p>No source in the research says this. Edit it, remove it, or turn on Strict accuracy to swap it for a verified fact.</p>"
    : c.status === "partial" ? "<p>The topic is backed up, but not every detail or number in this line was found in a source. Closest matches:</p>"
    : c.status === "conflict" ? "<p>A source on the same subject gives a different number. Check it:</p>" : "";
  if (c.status === "tip" || c.status === "takeaway") return `<div class="fact s-tip" data-fact="${i}"><span class="fact-label">${label}</span></div>`;
  return `<details class="fact s-${c.status}" data-fact="${i}"><summary>${label}</summary>${why}${ev ? `<ul>${ev}</ul>` : ""}</details>`;
}

function showReview() {
  const { script } = state.plan;
  $("review-title").textContent = script.title;
  const content = script.lines.filter((l) => l.kind !== "outro").length;
  const visuals = script.lines.map((l, i) => decideVisual(l, i, script.title));
  $("scenes").innerHTML = script.lines.map((l, i) => {
    const v = visuals[i];
    let tag = i === 0 ? "Hook" : l.kind === "outro" ? "Ending" : l.kind === "quiz" ? `Question ${l.quiz?.n || ""} · countdown` : l.kind === "answer" ? `Answer · ${l.answer ? "True" : "False"}` : l.kind === "chart" ? "Chart" : l.kind === "section" ? `Chapter ${l.num}` : l.kind === "recap" ? "Recap" : `Scene ${i}`;
    if (l.source) tag += ` · ${l.source}`;
    const big = l.kind === "media" && (l.stance || l.question) && !l.vmode;
    if (big) tag += " · Big words on screen";
    else if (l.kind === "media") tag += ` · ${VISUAL_NAMES[v.type]}${v.type === "stat" ? ": " + describeStat(v.spec) : v.type === "illus" ? ": " + (v.label || v.icon).toLowerCase() : ""}`;
    const thumb = l.kind === "outro" ? `<div class="thumb">END<br>CARD</div>` : l.kind === "quiz" ? `<div class="thumb">TRUE OR<br>FALSE?</div>` : big ? `<div class="thumb">BIG<br>WORDS</div>`
      : l.kind === "answer" ? `<div class="thumb" style="color:${l.answer ? "var(--good)" : "var(--bad)"}">${l.answer ? "TRUE ✓" : "FALSE ✗"}</div>` : l.kind === "chart" ? `<div class="thumb">LIVE<br>CHART</div>`
      : l.kind === "section" ? `<div class="thumb">PART ${l.num}<br>${esc(l.label || "")}</div>` : l.kind === "recap" ? `<div class="thumb">QUICK<br>RECAP</div>`
      : `<div class="thumb"><canvas width="152" height="270" data-thumb="${i}"></canvas></div>`;
    const mode = l.vmode || "auto", hasStat = Boolean(l.analysis?.stat);
    const chips = l.kind !== "media" ? "" : `<div class="mini vis">${[["auto", "Auto"], ["photo", "Photo"], ["chart", "Chart"], ["illus", "Illustration"]]
      .filter(([m]) => m !== "chart" || hasStat)
      .map(([m, txt]) => `<button data-vmode="${i}:${m}" class="${mode === m ? "on" : ""}">${txt}</button>`).join("")}</div>`;
    const tools = l.kind !== "media" ? (["chart", "section", "recap"].includes(l.kind) && content > 2 ? `<div class="mini"><button class="del" data-del="${i}">Remove</button></div>` : "")
      : `<div class="mini">${v.type === "illus" && state.art !== "icons" ? `<button data-artpick="${i}">Another illustration</button>` : ""}<button data-swap="${i}">New photo</button><button data-search="${i}">Search…</button><button data-mine="${i}">My photo</button>${content > 2 ? `<button class="del" data-del="${i}">Remove</button>` : ""}</div>`;
    const hookBtn = i === 0 ? `<div class="mini"><button data-hook="1">Another hook</button></div>` : "";
    return `<div class="scene"><div>${thumb}</div><div><div class="scene-tag"><span>${esc(tag)}</span></div>
      <textarea data-line="${i}" rows="${Math.min(7, Math.max(2, Math.ceil(l.text.length / 34)))}">${esc(l.text)}</textarea>${factBadge(l, i)}${hookBtn}${chips}${tools}</div></div>`;
  }).join("");
  const recentArt = [];
  script.lines.forEach((l, i) => {
    const cv = document.querySelector(`[data-thumb="${i}"]`), v = visuals[i];
    if (!cv) return;
    if (v.type === "photo" && l.asset?.bitmap) drawThumb(cv, l.asset);
    else if (v.type === "stat" || v.type === "illus") drawGenerated(cv, v, l, recentArt);
  });
  updateEstimate();
  const rate = makeRate(), secs = estimateSeconds(script.lines, SPEEDS[state.speed] || 1);
  $("produce").textContent = rate ? `Make the video (about ${fmtDuration(rate * secs)})` : "Make the video";
  screen("review");
  warmVoice();
}
// While you review, load the narrator's voice in the background (only if it was downloaded before),
// so making the video starts right away.
function warmVoice() {
  const v = voiceOpts(state.voice);
  if (store.get("voiceReady-" + v.engine) !== "1" || store.get("voiceBusy") === "1") return;
  setVoice(v);
  loadVoice().catch(() => {});
}
$("scenes").addEventListener("input", (e) => {
  const i = e.target.dataset.line; if (i == null) return;
  const line = state.plan.script.lines[+i];
  line.text = e.target.value.replace(/\s+/g, " ").trim();
  line.analysis = null;                                  // re-read numbers and concepts from the new text
  line.claim = null;                                     // your wording is now what gets fact-checked
  state.plan.edited = true; updateEstimate();
  // Re-check an edited fact against the evidence already gathered (instant, on the phone).
  if (line.check) line.check = { ...line.check, stale: true };
  clearTimeout(line.recheck);
  if (state.plan.fact?.ctx) line.recheck = setTimeout(async () => {
    const { checkLine } = await factModule();
    await checkLine(line, +i, state.plan.fact.ctx);
    const badge = document.querySelector(`[data-fact="${i}"]`);
    if (badge) badge.outerHTML = factBadge(line, +i);
    updateEstimate();
  }, 700);
});
async function setAsset(i, assetPromise, label) {
  const line = state.plan.script.lines[i];
  const btn = document.querySelector(`[data-swap="${i}"]`); if (btn) btn.textContent = label;
  const asset = await assetPromise.catch(() => null);
  // A photo you chose counts as fitting.
  if (asset) { line.asset?.bitmap?.close?.(); line.asset = { ...asset, relevant: true }; line.vmode = "photo"; } else toast("No other photo found. Try Search…");
  showReview();
}
$("scenes").addEventListener("change", (e) => { if (e.target.dataset.line != null) showReview(); });   // update visuals after editing
// "Swap or remove unverified" in the score card.
$("coach").addEventListener("click", async (e) => {
  const w = e.target.closest("[data-wording]");
  if (w && state.plan) { const r = proofread(state.plan.script); state.plan.edited = true; toast(`Tidied ${r.fixed} line${r.fixed === 1 ? "" : "s"}`); return showReview(); }
  const b = e.target.closest("[data-strict]"), plan = state.plan; if (!b || !plan) return;
  if (!plan.fact?.ctx) return toast("Fact check isn't available for this script.");
  const { enforceAccuracy } = await factModule();
  const r = enforceAccuracy(plan.script, plan.fact.ctx);
  plan.fact.fixed = r; plan.edited = true;
  toast(r.replaced + r.removed ? `Swapped ${r.replaced}, removed ${r.removed}.` : "Too few verified facts left to remove more; edit those lines instead.");
  showReview();
});
$("scenes").addEventListener("click", async (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const plan = state.plan;
  if (b.dataset.hook != null) {
    const options = hookOptions(plan.script), first = plan.script.lines[0];
    plan.hookChoices ??= [first.text, ...options.filter((o) => o !== first.text)];
    plan.hookIndex = ((plan.hookIndex || 0) + 1) % plan.hookChoices.length;
    first.text = plan.hookChoices[plan.hookIndex]; first.analysis = null; plan.edited = true;
    return showReview();
  }
  if (b.dataset.artpick != null) {
    const l = plan.script.lines[+b.dataset.artpick];
    l.artPick = (l.artPick || 0) + 1;
    return showReview();
  }
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
  if (!extra) plan.finder.findImage(q).then((a) => { if (a && !line.asset) { line.asset = { ...a, relevant: true }; showReview(); } }).catch(() => {});
});
$("produce").addEventListener("click", () => {
  const lines = state.plan.script.lines;
  for (let i = lines.length - 1; i >= 0; i--) if (!lines[i].text) lines.splice(i, 1);   // drop empty lines
  if (lines.filter((l) => l.kind !== "outro").length < 2) { toast("Keep at least two lines"); return showReview(); }
  produce();
});
$("series").addEventListener("click", () => {
  const lines = state.plan.script.lines;
  for (let i = lines.length - 1; i >= 0; i--) if (!lines[i].text) lines.splice(i, 1);
  if (lines.filter((l) => l.kind !== "outro").length < 2) { toast("Keep at least two lines"); return showReview(); }
  produceSeries();
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
  $("copy-diag").onclick = async () => copy([
    `Clip: ${answers.clip === "heard" ? "heard the notes" : answers.clip === "silent" ? "NO sound" : "not answered"}`,
    `Speaker beep: ${answers.beep === "heard" ? "heard" : answers.beep === "silent" ? "NO sound" : "not answered"}`,
    $("diag").innerText,
    `Narrator: ${state.voice} · natural voice ${store.get("voiceLevel") === "classic" ? "switched off after a problem" : "on"}${lastVoiceError() ? ` · last problem: ${lastVoiceError()}` : ""}`,
    `App version: ${(await caches.keys().catch(() => [])).filter((k) => /^reelbot-v/.test(k)).join(", ") || "unknown"}`,
  ].join("\n"));
  btn.disabled = false; btn.textContent = "Run sound test";
}

// Step-by-step check of the natural voice and the Ideas AI, with a report to copy and send.
async function aiCheck() {
  const btn = $("ai-check"), out = $("ai-check-out"), lines = [];
  btn.disabled = true;
  const show = () => { out.innerHTML = `<pre style="white-space:pre-wrap;font-size:13px;color:var(--muted)">${esc(lines.join("\n"))}</pre>`; };
  const step = async (name, fn) => {
    const t0 = performance.now(); lines.push(`… ${name}`); show();
    try { const r = await fn(); lines[lines.length - 1] = `✓ ${name} (${Math.round(performance.now() - t0)} ms)${r ? ": " + r : ""}`; show(); return true; }
    catch (e) { lines[lines.length - 1] = `✗ ${name} (${Math.round(performance.now() - t0)} ms): ${e?.message || e}`; show(); return false; }
  };
  lines.push(`Device: ${navigator.userAgent}`);
  lines.push(`App: ${(await caches.keys().catch(() => [])).filter((k) => /^reelbot-v/.test(k)).join(", ") || "unknown"} · Ideas tab opened: ${state.ideasUI ? "yes" : "no"} · cores: ${navigator.hardwareConcurrency || "?"}`);
  lines.push(`Saved state: voiceLevel=${store.get("voiceLevel") || "-"} voiceBusy=${store.get("voiceBusy") || "-"} aiOn=${store.get("aiOn") || "-"} aiLoading=${store.get("aiLoading") || "-"}`);
  lines.push(`Last voice problem: ${lastVoiceError() || "none"}`);
  show();
  if (state.ideasUI) await step("Free the Ideas AI's memory", () => state.ideasUI.unloadAI());
  btn.textContent = "Checking the natural voice…";
  resetVoiceLevel(); setVoice({ engine: "natural", voice: KOKORO_VOICES[state.voice] ? state.voice : "af_heart" });
  let samples = null;
  const ok = await step("Natural voice: start and load (92 MB, from the phone after the first time)", async () => {
    const used = await loadVoice();
    if (used !== "natural") throw new Error(`switched to the classic voice: ${lastVoiceError() || "no reason given"}`);
  });
  if (ok) {
    let ph;
    await step("Natural voice: pronunciation", async () => { [ph] = await phonemize(["This is a quick voice check."]); return ph; });
    if (ph) await step("Natural voice: speak one line", async () => { samples = await synthesize(ph, 1); return `${(samples.length / voiceRate()).toFixed(1)} s of audio`; });
  }
  await releaseVoice(); resetVoiceLevel();
  btn.textContent = "Checking the Ideas AI…";
  await step("Ideas AI: start and load (137 MB, from the phone after the first time)", async () => {
    const m = await import("./ai/llm.js"); await m.loadLLM();
  });
  await step("Ideas AI: write a few words", async () => {
    const m = await import("./ai/llm.js"); if (!m.llmReady()) throw new Error("not loaded");
    return JSON.stringify(await m.complete("You write short video titles.", "Write a title about saving money.", "", { maxTokens: 10 }));
  });
  await import("./ai/llm.js").then((m) => m.unloadLLM()).catch(() => {});
  out.insertAdjacentHTML("beforeend", `<div class="btns"><button class="btn main wide" id="ai-check-copy">Copy these results</button></div>`);
  $("ai-check-copy").onclick = () => copy(lines.join("\n"), { label: "AI & voice check" });
  btn.disabled = false; btn.textContent = "Run AI & voice check";
}

/* ---------- What's new (once after each update) ---------- */
function showWhatsNew(sinceVersion) {
  const items = UPDATES.filter((u) => u.version > sinceVersion).slice(0, 3);
  if (!items.length) return;
  document.getElementById("news-sheet")?.remove();
  const sheet = document.createElement("div");
  sheet.id = "news-sheet"; sheet.className = "copy-sheet"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-label", "What's new");
  sheet.innerHTML = `<div class="copy-box news"><h2 style="margin:0">What's new</h2><p class="meta" style="margin:2px 0 0">Version ${APP_VERSION}</p>
    ${items.map((u) => `<h3>${esc(u.title)}</h3><ul>${u.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`).join("")}
    <div class="btns"><button class="btn main wide" data-news="close">Got it</button></div></div>`;
  const close = () => { store.set("seenVersion", String(APP_VERSION)); sheet.remove(); };
  sheet.addEventListener("click", (e) => { if (e.target === sheet || e.target.closest('[data-news="close"]')) close(); });
  document.body.appendChild(sheet);
}
function checkWhatsNew() {
  const seen = Number(store.get("seenVersion") || 0);
  // Someone who has used the app before sees what changed; a brand-new user just starts.
  const returning = ["made", "voice", "aiOn", "drafts", "mood"].some((k) => store.get(k) != null);
  if (!seen && !returning) return store.set("seenVersion", String(APP_VERSION));
  if (seen < APP_VERSION) showWhatsNew(seen || APP_VERSION - 3);
}

/* ---------- Storage on this phone ---------- */
const STORAGE_ITEMS = [
  ["Natural voice", /\/kokoro-82m\//, "The voice downloads again (92 MB) the next time you use a natural voice."],
  ["Classic voice", /\/assets\/voices\//, "The classic voice downloads again (63 MB) when it's next needed."],
  ["Ideas AI", /\/SmolLM2-135M-Instruct\//, "Download it again from the Ideas tab when you want it."],
  ["Full-text research library", /\/ai\/data\/depth\//, "Deep research downloads article text again as needed."],
  ["Saved illustrations", /\/user\/art\//, "They're drawn again the next time a video needs them."],
];
// Draws a batch of illustrations for your niche ahead of time, in your style and colour, and saves them.
async function drawMoreArt() {
  if (state.drawingAhead) { state.drawingAhead = "stop"; return; }
  const n = parseInt(state.accent.slice(1), 16), accent = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const style = styleFor(state.art === "icons" ? "auto" : state.art, state.niche);
  const specs = nextBatch(state.niche, style, accent);
  if (!specs.length) { $("art-note").textContent = "Every set is already saved in this style and colour. Try another style or colour."; return; }
  state.drawingAhead = true; $("art-more").textContent = "Stop drawing";
  const made = await drawAhead(specs, state.niche, (k, total) => { $("art-note").textContent = `Drawing ${k} of ${total}…`; }, () => state.drawingAhead === "stop");
  state.drawingAhead = false;
  $("art-note").textContent = made ? `Drew and saved ${made} new illustration${made === 1 ? "" : "s"} (${MOTIFS_COUNT} subjects to draw from). Tap again for more.` : "Stopped.";
  renderStorage();
}

async function renderStorage() {
  const fmt = (b) => (b > 1e9 ? (b / 1e9).toFixed(1) + " GB" : Math.round(b / 1e6) + " MB");
  try {
    const est = await navigator.storage?.estimate?.();
    $("storage-total").textContent = est ? `The app uses ${fmt(est.usage || 0)} on this phone${est.quota ? ` (of ${fmt(est.quota)} allowed)` : ""}. Videos stay in the Library until you delete them.` : "";
    const keys = [];
    for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) keys.push([name, req]);
    $("storage-items").innerHTML = STORAGE_ITEMS.map(([label, re, note], i) => {
      const n = keys.filter(([, r]) => re.test(new URL(r.url).pathname)).length;
      const art = label === "Saved illustrations", reuses = art ? savedArt().reduce((s, e) => s + Math.max(0, (e.uses || 1) - 1), 0) : 0;
      const status = art ? (n ? `${n} drawn on this phone${reuses ? `, reused ${reuses} time${reuses === 1 ? "" : "s"}` : ""}` : "None yet: they're drawn as you make videos") : n ? "Saved on this phone" : "Not downloaded";
      return `<div class="store-row"><div>${label}<small class="meta" style="display:block">${status}</small></div>${n ? `<button class="btn" data-free="${i}" style="flex:none">Delete</button>` : ""}</div>`;
    }).join("");
    // The newest saved illustrations, small.
    const artKeys = keys.filter(([name, r]) => name === "reelbot-user-art" && /\/user\/art\//.test(new URL(r.url).pathname)).slice(-12).reverse();
    const gallery = $("art-gallery");
    if (gallery) {
      for (const u of state.artUrls || []) URL.revokeObjectURL(u);
      state.artUrls = [];
      for (const [name, req] of artKeys) { const res = await (await caches.open(name)).match(req); if (res) state.artUrls.push(URL.createObjectURL(await res.blob())); }
      gallery.innerHTML = state.artUrls.map((u) => `<img src="${u}" alt="" loading="lazy">`).join("");
      gallery.classList.toggle("hidden", !state.artUrls.length);
    }
    const more = $("art-more");
    if (more && !state.drawingAhead) more.textContent = "Draw 36 more";
    $("storage-items").onclick = async (e) => {
      const b = e.target.closest("[data-free]"); if (!b) return;
      const [label, re, note] = STORAGE_ITEMS[+b.dataset.free];
      if (!confirm(`Delete the ${label.toLowerCase()} from this phone? ${note}`)) return;
      for (const [name, req] of keys) if (re.test(new URL(req.url).pathname)) await (await caches.open(name)).delete(req);
      if (label === "Ideas AI") { store.set("aiOn", "0"); await import("./ai/llm.js").then((m) => m.unloadLLM()).catch(() => {}); }
      if (label === "Saved illustrations") forgetArt();
      if (label.endsWith("voice")) store.set(`voiceReady-${label === "Natural voice" ? "natural" : "fast"}`, "0");
      toast(`${label} deleted.`); renderStorage();
    };
  } catch (e) { $("storage-total").textContent = "Couldn't read storage on this browser."; }
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
  const voiceNote = () => {
    const v = KOKORO_VOICES[state.voice], err = lastVoiceError();
    const fixedBug = /larger than expected|Out of memory|no available backend/i.test(err) && store.get("voiceRetried") !== "v24";
    $("voice-note").textContent = v && store.get("voiceLevel") === "classic" && !fixedBug
      ? `The natural voice didn't work on this phone${err ? ` (${err})` : ""}, so the classic voice is used. Tap a natural voice again to retry.`
      : v ? `${v.desc}. Natural voice: sounds like a real narrator. One-time 92 MB download.`
      : "Classic voice: quicker to make and a 63 MB download, but more robotic.";
  };
  showVoiceNote = voiceNote;
  prefChips("voices", VOICE_LABELS, "voice", "af_heart", () => { resetVoiceLevel(); voiceNote(); }); voiceNote();
  prefChips("music-vol", { low: "Low", medium: "Medium", high: "High" }, "musicVol", "medium");
  prefChips("ctas", CTA_LABELS, "cta", "follow");
  prefChips("covers", COVER_STYLES, "cover", "bold");
  prefChips("art-styles", ART_CHOICES, "art", "auto", () => { if (state.plan && !$("review").classList.contains("hidden")) showReview(); });
  // Your own music: kept in the app's storage on the phone (not uploaded anywhere).
  const showMusic = () => {
    const name = store.get("musicName");
    $("music-note").textContent = name ? `My music: ${name}. Pick “My music” above to use it.` : "My music: upload a track you have the rights to use. It loops under the voice and dips when the narrator speaks.";
    $("music-remove").classList.toggle("hidden", !name);
  };
  $("music-file").addEventListener("change", async (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    if (f.size > 40e6) return toast("That file is over 40 MB. Pick a shorter track.");
    try {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      await new OAC(1, 1, SR).decodeAudioData(await f.arrayBuffer());          // can the phone play it?
      await (await caches.open(USER_CACHE)).put(USER_MUSIC, new Response(f, { headers: { "Content-Type": f.type || "audio/mpeg" } }));
      store.set("musicName", f.name.slice(0, 60)); store.set("mood", "mine"); state.mood = "mine";
      [...$("moods").children].forEach((c) => c.classList.toggle("on", c.textContent === "My music"));
      showMusic(); toast("Your music is ready. It's kept on this phone.");
    } catch (err) { toast("Couldn't use that file: " + (err.message || "unsupported audio")); }
  });
  $("music-remove").addEventListener("click", async () => {
    await (await caches.open(USER_CACHE)).delete(USER_MUSIC).catch(() => {});
    localStorage.removeItem("musicName"); if (state.mood === "mine") { state.mood = "lofi"; store.set("mood", "lofi"); prefChips("moods", MOODS, "mood", "lofi"); }
    showMusic();
  });
  showMusic();
  // Logo: resized on the phone to at most 240 px and kept on the phone.
  const showLogo = () => { const l = store.get("logo"); $("logo-preview").innerHTML = l ? `<img src="${l}" alt="" style="max-height:48px;max-width:96px;border-radius:8px">` : ""; $("logo-remove").classList.toggle("hidden", !l); };
  $("logo-file").addEventListener("change", async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const bmp = await createImageBitmap(f), s = Math.min(1, 240 / Math.max(bmp.width, bmp.height));
      const c = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * s), height: Math.round(bmp.height * s) });
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      store.set("logo", c.toDataURL("image/png")); showLogo(); toast("Logo added. It appears in the top-left corner of your reels.");
    } catch (err) { toast("Couldn't read that image: " + (err.message || err)); }
    e.target.value = "";
  });
  $("logo-remove").addEventListener("click", () => { localStorage.removeItem("logo"); showLogo(); });
  showLogo();
  $("plan-week").addEventListener("click", planWeek);
  $("say-as").value = store.get("sayAs") || "";
  setPronunciations($("say-as").value);
  $("say-as").addEventListener("input", () => { store.set("sayAs", $("say-as").value); setPronunciations($("say-as").value); });
  $("voice-preview").addEventListener("click", previewVoice);
  const depthNote = () => { $("depth-note").textContent = DEPTH_NOTES[state.depth] || ""; };
  prefChips("depths", DEPTH_LABELS, "depth", "2", depthNote); depthNote();
  $("handle").value = store.get("handle") || "";
  $("handle").addEventListener("change", () => { $("handle").value = cleanHandle($("handle").value); store.set("handle", $("handle").value); });
  for (const [id, key] of [["sfx", "sfx"], ["cuts", "cuts"], ["sources", "sources"], ["factcheck", "factcheck"], ["strict", "strict"]]) {
    $(id).checked = store.get(key) !== "0";
    $(id).addEventListener("change", () => store.set(key, $(id).checked ? "1" : "0"));
  }
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
  $("version-line").textContent = `Version ${APP_VERSION} · ${UPDATES[0].title}`;
  $("whats-new").addEventListener("click", () => showWhatsNew(APP_VERSION - 3));
  $("art-more").addEventListener("click", drawMoreArt);
  checkWhatsNew();
  $("ai-check").addEventListener("click", aiCheck);
  $("wipe").addEventListener("click", async () => { if (confirm("Delete every reel stored on this phone?")) { await clearReels(); renderLibrary(); toast("Deleted"); } });
  const info = await encoderInfo();
  $("encoder").textContent = info.webcodecs ? `Video encoder: on-device H.264, ${info.video.width}×${info.video.height}, with uncompressed sound.`
    : info.recorder ? "Video encoder: real-time recording (a reel takes about as long to make as it runs)."
    : "This browser can't encode video. Update iOS and use Safari.";
  window.__ready = true;
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});

// An app left open in the background (home-screen apps stay in memory) still gets every update: when
// it comes back to the screen, it checks for a newer version and, if nothing is in progress, reloads.
let lastUpdateCheck = 0;
async function checkForUpdate() {
  if (Date.now() - lastUpdateCheck < 5 * 60 * 1000) return;
  lastUpdateCheck = Date.now();
  try {
    const text = await (await fetch("app/version.js", { cache: "no-store" })).text();
    const latest = Number((text.match(/APP_VERSION\s*=\s*(\d+)/) || [])[1]);
    if (!(latest > APP_VERSION)) return;
    (await navigator.serviceWorker?.getRegistration())?.update().catch(() => {});
    const idle = !state.busy && !state.plan && !state.drawingAhead && $("review").classList.contains("hidden") && $("job").classList.contains("hidden");
    if (idle) location.reload();
    else toast("A new version of ReelBot is ready. It loads when you finish this video.");
  } catch { /* offline: check again next time */ }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkForUpdate(); });
setInterval(() => { if (document.visibilityState === "visible") checkForUpdate(); }, 30 * 60 * 1000);
init().catch((e) => { console.error(e); toast("Couldn't start the app: " + e.message); });
