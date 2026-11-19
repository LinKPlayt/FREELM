// UI glue for the phone app.
import { learnedRate, drawAlternatives, seriesTopics, appData, planReel, produceReel, releasePlan, estimateSeconds, lengthRange, draftFromPlan, planFromDraft, planFromIdea, decideVisual } from "./make.js";
import { StatBg, IllusBg } from "./graphics.js";
import { describeStat } from "./visuals.js";
import { hookOptions, coach } from "./extras.js";
import { smartHooks } from "./hook.js";
import { checkWording, proofread } from "./wording.js";
import { drawArt, motifsFor, pickMotifs, styleFor, ART_STYLES, forgetArt, savedArt, drawAhead, nextBatch, MOTIFS } from "./illustrator.js";
const MOTIFS_COUNT = Object.keys(MOTIFS).length;
import { KOKORO_VOICES, setVoice, loadVoice, phonemize, synthesize, voiceRate, releaseVoice, voiceNotice, resetVoiceLevel, naturalFailed, lastVoiceError } from "./tts.js";
const factModule = () => import("./ai/factcheck.js");
import { postedIds, setPosted, listReels, saveReel, deleteReel, clearReels, listDrafts, saveDraft, deleteDraft } from "./store.js";
import { platformCaptions, setPronunciations, visualMatch } from "./script.js";
import { FIELDS, getResult, saveResult, insights, allResults } from "./results.js";
import { APP_VERSION, UPDATES } from "./version.js";
import { USER_CACHE, USER_MUSIC, userMusic, saveUserPhoto, pruneUserPhotos } from "./make.js";
import { encoderInfo, renderReel, loadFonts, previewFrame } from "./render.js";
import { SR, generateMusic } from "./music.js";

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
const CAPTION_STYLES = { bold: "Bold", punch: "Punch (1–2 big words)", boxed: "Boxed", clean: "Clean" };
const CAPTION_POS = { low: "Low", middle: "Middle" };
const MOODS = { auto: "Auto (fits the video)", lofi: "Lo-fi", upbeat: "Upbeat", bright: "Bright", cinematic: "Cinematic", calm: "Calm", suspense: "Suspense", mine: "My music", none: "None" };
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
// The Studio's summary beside the preview: what this video will be, at a glance.
function renderStudioSummary() {
  const el = $("studio-summary"); if (!el || !state.data) return;
  const topic = state.mode === "custom" ? ($("custom").value.trim() || "Type a topic") : state.mode === "evergreen" ? ($("topic").selectedOptions[0]?.textContent || "Surprise me") : null;
  const rows = [["Niche", state.niche.replace(/\b\w/g, (c) => c.toUpperCase())], ["Type", MODE_LABELS[state.mode] || state.mode], ...(topic ? [["Topic", topic]] : []),
    ["Narrator", VOICE_LABELS[state.voice] || "—"], ["Music", MOODS[state.mood] || "—"], ["Captions", CAPTION_STYLES[state.capStyle] || "—"],
    ["Length", (LENGTH_LABELS[state.length] || "").replace(/^\S+\s/, "") || "—"], ["Quality", state.quality === "standard" ? "Standard" : "High"]];
  el.innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd title="${esc(v)}">${esc(String(v).replace(/\s*\(.*\)$/, ""))}</dd>`).join("");
  $("studio-length").textContent = (LENGTH_LABELS[state.length] || "").replace(/^\S+\s/, "");
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
      captionStyle: state.capStyle, captionPos: state.capPos, artStyle: state.art, quality: state.quality,
    speechRate: learnedRate(voiceOpts(state.voice).engine) * (SPEEDS[state.speed] || 1), handle, audio: new Float32Array(1), hookTitle: false,
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

// Notifications: green for done, red for problems, blue for information (worked out from the message,
// or given as the second argument).
function toast(msg, tone) {
  const t = $("toast"); t.textContent = msg;
  tone ??= /^(couldn't|can't|that (photo|isn't)|no other|this browser|the natural voice didn't)|\bfailed\b|went wrong|storage full/i.test(msg) ? "err"
    : /\b(saved|copied|ready|restored|deleted|put back|now using|tidied|backed up|added|done)\b/i.test(msg) ? "ok" : "";
  t.className = "toast show" + (tone ? " " + tone : "");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3400);
}
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
  return m && seg ? `${m[1]}/${seg}` : "LinKPlayt/ReelBot";
}

// Pages: title and one-line description shown in the top bar.
const PAGES = {
  home: ["Home", "Your channel at a glance"],
  create: ["Studio", "Make a video in five steps"],
  ideas: ["Idea Lab", "Research and video ideas, on your phone"],
  library: ["Library", "Your videos, ready to post"],
  auto: ["Automation", "Plan the week, queue videos, get reminders"],
  about: ["Settings", "Backup, storage and diagnostics"],
};
function show(tab) {
  if (!PAGES[tab]) tab = "create";
  if (tab === "about") renderStorage();
  document.querySelectorAll("section.tab").forEach((s) => s.classList.toggle("active", s.id === "tab-" + tab));
  document.querySelectorAll("nav button").forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle("active", on); if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  $("page-title").textContent = PAGES[tab][0]; $("page-sub").textContent = PAGES[tab][1];
  document.title = tab === "create" ? "ReelBot" : `${PAGES[tab][0]} · ReelBot`;
  $("top-new").classList.toggle("hidden", tab === "create");
  state.tab = tab;
  if (tab === "library") renderLibrary();
  if (tab === "ideas") openIdeas();
  if (tab === "home") renderHome();
  if (tab === "auto") renderAuto();
  window.scrollTo(0, 0);
}
// Any button with data-go="<page>" opens that page (New video, See all, Open queue…).
document.addEventListener("click", (e) => { const g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); show(g.dataset.go); } });
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
// Small icons for buttons (stroke icons, sized by CSS).
const BI = {
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
  image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>',
  cc: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 10.2a2.2 2.2 0 1 0 0 3.6M17 10.2a2.2 2.2 0 1 0 0 3.6"/></svg>',
  remix: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6h17M9 6V4h6v2M6 6l1 14h10l1-14"/></svg>',
};
function reelCard(r, inline = false) {
  state.reels.set(r.id, r);
  const mb = ((r.blob?.size || 0) / 1e6).toFixed(1), posted = postedIds().has(r.id);
  return `<div class="${inline ? "" : "card"}" data-reel="${esc(r.id)}">
    <video src="${urlFor(r)}#t=0.5" controls playsinline preload="${r.cover ? "none" : "metadata"}"${r.cover ? ` poster="${posterFor(r)}"` : ""}></video>
    <div class="reel-title">${esc((r.title || "Untitled reel").replace(" #Shorts", ""))}</div>
    <div class="reel-meta"><span class="badge">${Math.round(r.duration || 0)}s</span><span class="badge">${esc(KIND_ONE[r.kind] || r.kind || "Reel")}</span><span class="badge">${mb} MB</span><span class="badge good${posted ? "" : " hidden"}" data-posted-badge>Posted</span></div>
    <div class="btns">
      <button class="btn main" data-act="share">${BI.share}Save / Share</button>
      <a class="btn" href="${urlFor(r)}" download="${esc(r.id)}.${esc(r.ext)}">${BI.download}Download</a>
    </div>
    <div class="copy-label">Copy the caption for:</div>
    <div class="copy-row">
      <button class="btn" data-act="cap-youtube">YouTube</button><button class="btn" data-act="cap-tiktok">TikTok</button><button class="btn" data-act="cap-instagram">Instagram</button>
    </div>
    <div class="btns btns-3">${r.cover ? `<button class="btn" data-act="cover" data-tip="Save the cover image">${BI.image}Cover image</button>` : ""}${r.srt ? `<button class="btn" data-act="srt" data-tip="Captions file for YouTube and TikTok">${BI.cc}Captions (.srt)</button>` : ""}<button class="btn" data-act="remix" data-tip="Edit this script and make it again">${BI.remix}Remix</button></div>
    ${inline ? "" : resultsForm(r)}
    ${inline ? "" : `<div class="btns card-foot"><button class="btn${posted ? " on" : ""}" data-act="posted">${posted ? "✓ Posted" : "Mark as posted"}</button><button class="btn danger" data-act="delete">${BI.trash}Delete</button></div>`}
  </div>`;
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
// Applies the best narrator, ending, music and caption style from your results to your settings.
const BEST_TO_PREF = { voice: ["voices", VOICE_LABELS, "voice"], cta: ["ctas", CTA_LABELS, "cta"], music: ["moods", MOODS, "mood"], captions: ["cap-styles", CAPTION_STYLES, "capStyle"] };
function useBest() {
  const ins = insights({ voice: VOICE_LABELS, cta: CTA_LABELS, music: MOODS, captions: CAPTION_STYLES }), done = [];
  for (const row of ins.rows) {
    const pref = BEST_TO_PREF[row.setting]; if (!pref || !pref[1][row.best]) continue;
    store.set(pref[2], row.best); prefChips(pref[0], pref[1], pref[2], row.best);
    done.push(`${row.name.toLowerCase()}: ${pref[1][row.best]}`);
  }
  if (done.some((x) => x.startsWith("narrator"))) { resetVoiceLevel(); showVoiceNote?.(); }
  drawStylePreview();
  toast(done.length ? `Now using ${done.join(", ")}` : "Nothing to change yet");
}
function renderInsights() {
  const ins = insights({ voice: VOICE_LABELS, cta: CTA_LABELS, music: MOODS, captions: CAPTION_STYLES });
  $("insights").innerHTML = ins.rows.length ? `<div class="card"><h2>What works for you</h2>
      <p class="meta">From ${ins.count} reels with results · ${ins.avg} average views · best: ${esc(ins.top)}</p>
      ${ins.rows.map((x) => `<div class="insight"><b>${esc(x.name)}</b> · ${esc(x.text)}<br><small class="meta">next best ${esc(x.vs)}${x.lift >= 1.2 ? ` · ${x.lift.toFixed(1)}× more` : ""}</small></div>`).join("")}
      ${ins.rows.some((x) => x.setting) ? `<button class="btn" data-use-best="1" style="width:100%;margin-top:6px">Use what works (${ins.rows.filter((x) => x.setting).map((x) => x.name.toLowerCase()).join(", ")})</button>` : ""}
      <p class="meta" style="margin-top:8px">Make more of what wins. More results make this more reliable.</p></div>`
    : `<div class="card"><h2>What works for you</h2><p class="meta">Add the views (and likes, comments, saves) of ${ins.count ? "one more reel" : "two or more reels"} under “Add results” and this shows which niche, length, narrator, ending and music get you the most views.</p></div>`;
}

/* ---------- Home (dashboard) and Automation: built only from what's on this phone ---------- */
const ICON = {
  video: '<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="m15.5 10.4 6-3.4v10l-6-3.4"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  queue: '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M21 3 10 14"/><path d="M21 3 14.5 21l-4.5-7-7-4.5z"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/></svg>',
};
const fmtN = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e4 ? Math.round(n / 1e3) + "k" : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k" : String(Math.round(n)));
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24); if (d === 1) return "yesterday"; if (d < 7) return `${d} days ago`;
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}
const stat = (icon, label, value, sub) => `<div class="stat"><div class="stat-label">${ICON[icon]}${esc(label)}</div><div class="stat-value">${value}</div><div class="stat-sub">${sub}</div></div>`;

async function renderHome() {
  const [reels, drafts, posted, results] = [await listReels(), listDrafts(), postedIds(), allResults()];
  if (state.tab !== "home") return;
  state.lib = reels;
  const withViews = results.filter((r) => r.stats?.views > 0), views = withViews.reduce((n, r) => n + r.stats.views, 0);
  const done = reels.filter((r) => posted.has(r.id)).length, today = todayDraft(), resume = state.busy || state.plan ? null : pendingAutosave();
  $("home-stats").innerHTML =
    stat("video", "Videos", reels.length, reels.length ? `${done} posted · ${reels.length - done} to post` : "Make your first one in the Studio")
    + stat("eye", "Total views", withViews.length ? fmtN(views) : "—", withViews.length ? `from ${withViews.length} video${withViews.length === 1 ? "" : "s"} with results` : "Add views to your videos in the Library")
    + stat("chart", "Average views", withViews.length ? fmtN(views / withViews.length) : "—", withViews.length ? "per video with results" : "Shows once you add results")
    + stat("queue", "Queue", drafts.length, today ? `Today: ${esc(today.label.replace(/^\w{3} · /, ""))}` : drafts.length ? "Drafts ready to make" : "Plan a week in Automation");
  // Up next: what's waiting for you, most urgent first.
  const items = [];
  // A script open in the Studio goes straight back to it; one left from an earlier visit reopens; one being made shows in the status card.
  if (state.plan && !state.busy) items.push(`<div class="next-item"><span class="next-icon accent">${ICON.edit}</span><div><b>Continue: ${esc(state.plan.script?.title || "your script")}</b><small>Open in the Studio, ready to edit or make</small></div><button class="btn" data-go="create">Continue</button></div>`);
  else if (resume) items.push(`<div class="next-item"><span class="next-icon accent">${ICON.edit}</span><div><b>Continue: ${esc(resume.label)}</b><small>Script you were reviewing · ${ago(resume.saved)}</small></div><button class="btn" data-resume-act="open">Continue</button></div>`);
  if (today) items.push(`<div class="next-item"><span class="next-icon accent">${ICON.cal}</span><div><b>${esc(today.label.replace(/^\w{3} · /, ""))}</b><small>Today's planned video</small></div><button class="btn main" data-today-act="make">Make it now</button></div>`);
  const queued = drafts.filter((d) => d.id !== today?.id);
  if (queued.length) items.push(`<div class="next-item"><span class="next-icon">${ICON.queue}</span><div><b>${queued.length} draft${queued.length === 1 ? "" : "s"} in the queue</b><small>Make them one by one, or all in one go</small></div><button class="btn" data-go="auto">Open queue</button></div>`);
  const toPost = reels.length - done;
  if (toPost) items.push(`<div class="next-item"><span class="next-icon">${ICON.send}</span><div><b>${toPost} video${toPost === 1 ? "" : "s"} not posted yet</b><small>Share, copy the caption, mark as posted</small></div><button class="btn" data-lib-filter="unposted">Show</button></div>`);
  $("home-next").innerHTML = `<div class="section-head"><h2>Up next</h2></div>` + (items.length ? `<div class="next-list">${items.join("")}</div>`
    : state.busy ? `<div class="empty"><b>Working on it</b>When it's done, your video shows up here and in the Library.</div>`
    : `<div class="empty"><b>You're all caught up</b>Make a video, or plan a whole week of drafts.<div class="btns"><button class="btn main" data-go="create">New video</button><button class="btn" data-go="auto">Plan my week</button></div></div>`);
  // Performance: views of recent videos with results, and what works best so far.
  const ins = insights({ voice: VOICE_LABELS, cta: CTA_LABELS, music: MOODS, captions: CAPTION_STYLES });
  const recentViews = withViews.slice(0, 6), top = Math.max(1, ...recentViews.map((r) => r.stats.views));
  $("home-perf").innerHTML = `<div class="section-head"><h2>Performance</h2>${withViews.length ? `<button class="link-btn" data-go="library">All results →</button>` : ""}</div>`
    + (recentViews.length ? recentViews.map((r) => `<div class="perf-row"><span>${fmtN(r.stats.views)}</span><span>${esc(r.title || "Video")}<div class="bar-track"><i style="width:${Math.max(4, Math.round((r.stats.views / top) * 100))}%"></i></div></span></div>`).join("")
      + (ins.rows.length ? `<p class="hint">Best so far: ${ins.rows.slice(0, 2).map((x) => `<b>${esc(x.text.split(":")[0])}</b> (${esc(x.name.toLowerCase())})`).join(" · ")}</p>` : "")
      : `<div class="empty"><b>No results yet</b>After you post, add each video's views in the Library. This shows which videos, hooks and styles get the most views.</div>`);
  // Recent videos
  $("home-recent").innerHTML = `<div class="section-head"><h2>Recent videos</h2>${reels.length ? `<button class="link-btn" data-go="library">See all →</button>` : ""}</div>`
    + (reels.length ? `<div class="recent-grid">${reels.slice(0, 4).map((r) => `<button class="recent" data-open-reel="${esc(r.id)}">${r.cover ? `<img src="${posterFor(r)}" alt="" loading="lazy">` : `<span class="ph">${ICON.play}</span>`}
        <div><b>${esc((r.title || "Untitled").replace(/\s*#Shorts$/, ""))}</b><small>${Math.round(r.duration || 0)}s · ${ago(r.created)}${posted.has(r.id) ? " · posted" : ""}</small></div></button>`).join("")}</div>`
      : `<div class="empty"><b>No videos yet</b>Your videos appear here as soon as they're made.<div class="btns"><button class="btn main wide" data-go="create">Make your first video</button></div></div>`);
  // Activity: what happened, newest first.
  const events = [...reels.map((r) => ({ t: r.created, cls: "made", html: `Made <b>${esc((r.title || "a video").replace(/\s*#Shorts$/, ""))}</b>` })),
    ...drafts.map((d) => ({ t: d.saved, cls: "plan", html: `${/^\w{3} · /.test(d.label) ? "Planned" : "Saved draft"} <b>${esc(d.label.replace(/^\w{3} · /, ""))}</b>` }))]
    .filter((e) => e.t).sort((a, b) => b.t - a.t).slice(0, 8);
  $("home-activity").innerHTML = `<div class="section-head"><h2>Activity</h2></div>` + (events.length
    ? `<ul class="activity">${events.map((e) => `<li class="${e.cls}"><span>${e.html}</span><time>${ago(e.t)}</time></li>`).join("")}</ul>`
    : `<p class="meta">Videos you make and drafts you plan will show here.</p>`);
  mirrorJob();
}

function renderAuto() {
  renderDrafts();
  const d = todayDraft();
  $("auto-today").innerHTML = d
    ? `<span class="eyebrow">Today</span><h2>${esc(d.label.replace(/^\w{3} · /, ""))}</h2><p>Planned for today. Make it now, or review the script first.</p>
       <div class="btns"><button class="btn main" data-today-act="make">Make it now</button><button class="btn" data-today-act="open">Review first</button></div>`
    : `<span class="eyebrow">Today</span><h2>Nothing planned for today</h2><p>Plan a week and each weekday's draft shows up here, ready to make in one tap. Add the week to your calendar for a reminder on each day.</p>`;
  const reels = state.lib || [], posted = postedIds(), done = reels.filter((r) => posted.has(r.id)).length;
  $("auto-publish").innerHTML = `<span class="eyebrow">Posting</span><h2>${reels.length ? `${done} of ${reels.length} videos posted` : "No videos yet"}</h2>
    ${reels.length ? `<div class="bar-track" style="margin:10px 0 12px"><i style="width:${Math.round((done / reels.length) * 100)}%;background:var(--good)"></i></div>
      <p>${reels.length - done ? `${reels.length - done} still to post. Mark each as posted after you share it; if space runs low, posted videos are removed first.` : "Everything in your Library is posted."}</p>
      <div class="btns">${reels.length - done ? `<button class="btn" data-lib-filter="unposted">Show not posted</button>` : ""}<button class="btn${reels.length - done ? "" : " wide"}" data-go="library">Open Library</button></div>`
      : `<p>Videos you make are kept in the Library, ready to share to TikTok, Instagram or YouTube.</p>`}`;
  if (!state.lib) listReels().then((l) => { state.lib = l; if (state.tab === "auto") renderAuto(); });
}

// The progress pill and Home's status card act as buttons: Enter or Space opens the Studio, as a tap does.
document.addEventListener("keydown", (e) => {
  const el = e.target.closest?.('[data-go][role="button"]');
  if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); el.click(); }
});

// Actions shared by Home, Automation and the Studio cards.
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-today-act]"), r = e.target.closest("[data-resume-act]"), f = e.target.closest("[data-lib-filter]"), o = e.target.closest("[data-open-reel]");
  if (t) {
    const d = todayDraft(); if (!d || state.busy) return;
    unlockAudio();   // inside the tap, for iPhone audio
    if (t.dataset.todayAct === "make") return makeDrafts([d]);
    show("auto"); document.querySelector(`[data-draft-open="${CSS.escape(d.id)}"]`)?.click();
  }
  if (r) resumeAction(r.dataset.resumeAct);
  if (f) { state.libFilter = { q: "", kind: f.dataset.libFilter, sort: "new" }; const q = $("lib-q"); if (q) q.value = ""; show("library"); }
  if (o) { state.focusReel = o.dataset.openReel; show("library"); }
});

// Autosave: an iPhone often reloads an app left in the background, which used to lose the script you
// were reviewing. The script (not the photos) is saved as you go, and offered back when the app opens.
const AUTOSAVE = "autosave";
let autosaveTimer = null;
function autosave(now = false) {
  clearTimeout(autosaveTimer);
  const run = () => {
    if (!state.plan) return;
    try { const d = draftFromPlan(state.plan); d.id = AUTOSAVE; d.draftId = state.draftId || null; localStorage.setItem(AUTOSAVE, JSON.stringify(d)); } catch { /* storage full or private */ }
  };
  if (now) run(); else autosaveTimer = setTimeout(run, 700);
}
// Continue (or discard) the autosaved script, from the Studio card or Home.
async function resumeAction(kind) {
  const d = pendingAutosave(); if (!d || state.busy) return;
  if (kind === "drop") return clearAutosave();
  show("create");
  screen("job"); $("job-title").textContent = "Opening your script…"; $("preview").classList.add("hidden"); say("Finding photos again…", 0);
  try { state.plan = await planFromDraft(d, { say }); state.draftId = d.draftId || null; showReview(); }
  catch (err) { screen("form"); showError(err, "The script couldn't be opened"); }
}
function clearAutosave() { clearTimeout(autosaveTimer); try { localStorage.removeItem(AUTOSAVE); } catch { /* ignore */ } renderResume(); }
function pendingAutosave() { try { const d = JSON.parse(localStorage.getItem(AUTOSAVE) || "null"); return d?.script?.lines?.length && Date.now() - d.saved < 3 * 86400e3 ? d : null; } catch { return null; } }
function renderResume() {
  const d = pendingAutosave(), el = $("resume"); if (!el) return;
  const show = Boolean(d) && !state.plan && !state.busy;
  el.classList.toggle("hidden", !show);
  if (show) el.innerHTML = `<h2>Pick up where you left off</h2><p>${esc(d.label)} <span class="meta">· ${new Date(d.saved).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</span></p>
    <div class="btns" style="margin:0"><button class="primary" data-resume="open">Continue</button><button class="btn" data-resume="drop">Discard</button></div>`;
}

// "Remind me to post" (for planned weeks): a time and a button that makes the calendar file.
const REMINDER_ROW = `<div class="row reminders" style="padding:4px 0 10px"><div><small class="meta">Get a reminder on each day's video</small></div>
  <select data-remind-hour style="flex:none;width:auto"><option value="12">12 PM</option><option value="18" selected>6 PM</option><option value="20">8 PM</option></select>
  <button class="btn" data-remind="1" style="flex:none">Add to Calendar</button></div>`;
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-remind]"); if (!b) return;
  const hour = Number(b.closest(".reminders")?.querySelector("[data-remind-hour]")?.value) || 18;
  addReminders(hour);
});

// Today's planned video (from Plan my week): one tap to make it, or open it to review first.
const todayDraft = () => { const day = new Date().toLocaleDateString("en-US", { weekday: "short" }); return listDrafts().find((d) => d.label.startsWith(day + " · ")); };
function renderToday() {
  const d = todayDraft(), el = $("today"); if (!el) return;
  el.classList.toggle("hidden", !d);
  if (d) el.innerHTML = `<h2>Today's video</h2><p>${esc(d.label.replace(/^\w{3} · /, ""))}</p>
    <div class="btns" style="margin:0"><button class="primary" data-today="make">Make it now</button><button class="btn" data-today="open">Review first</button></div>`;
}

// Makes several drafts one after another (Make all, or today's video): each is turned into a video,
// saved to the Library and removed from the queue. Stops at the first one that fails, keeping the rest.
async function makeDrafts(list) {
  if (state.busy || !list.length) return;
  state.busy = true;
  show("create");      // the progress screen is on the Create tab
  screen("job"); $("preview").classList.remove("hidden"); $("job-title").textContent = "Getting ready…"; say("Starting…", 0);
  let wake = null; try { wake = await navigator.wakeLock?.request("screen"); } catch { /* not supported */ }
  const t0 = performance.now(), made = [];
  try {
    if (state.ideasUI) await state.ideasUI.unloadAI();
    const opts = options();
    for (const [i, d] of list.entries()) {
      const tag = list.length > 1 ? `Video ${i + 1} of ${list.length}` : "Today's video";
      $("job-title").textContent = `${tag}: ${d.label.replace(/^\w{3} · /, "")}`;
      const partSay = (text, f) => say(`${tag}: ${text}`, f);
      const plan = await planFromDraft(d, { say: (t, f) => partSay(t, (f || 0) * 0.05) });
      const t1 = performance.now();
      const reel = await produceReel(plan, opts, { say: partSay, canvas: $("preview"), audioCtx: state.audioCtx, toast });
      learnMakeRate((performance.now() - t1) / 1000, reel.duration);
      await saveReel(reel); deleteDraft(d.id); made.push(reel);
    }
    screen("form");
    store.set("made", "1"); store.set("voiceReady-" + voiceOpts(state.voice).engine, "1");
    $("result").innerHTML = `<h2>${made.length === 1 ? "Your video is ready" : `All ${made.length} videos are ready`}</h2><p>Made in ${fmtDuration((performance.now() - t0) / 1000)} on this device. ${made.length > 1 ? "They're all in the Library." : ""}</p>` + made.map((r) => reelCard(r, true)).join("<hr>");
    $("result").classList.remove("hidden");
    window.__lastReel = made.at(-1); window.__batch = made;
  } catch (e) {
    screen("form");
    showError(e, made.length ? `Made ${made.length} of ${list.length}, then stopped. The rest are still in the queue` : "The video couldn't be made");
  }
  wake?.release?.().catch(() => {}); closeAudio();
  state.busy = false; renderDrafts(); renderToday();
}

function renderDrafts() {
  const drafts = listDrafts();
  $("drafts").innerHTML = drafts.length ? `<div class="card"><div class="section-head"><h2>Queue</h2><span class="badge">${drafts.length} draft${drafts.length === 1 ? "" : "s"}</span></div><p>Scripts planned or saved to finish later.${drafts.length > 1 ? " Make them all in one go: keep the app open and the phone plugged in." : ""}</p>
    ${drafts.length > 1 ? `<button class="primary" data-draft-all="1" style="margin:4px 0 10px">Make all ${drafts.length} videos</button>` : ""}${drafts.some((d) => /^\w{3} · /.test(d.label)) ? REMINDER_ROW : ""}${drafts.map((d) => `
    <div class="draft"><div><b>${esc(d.label)}</b><div class="meta">${new Date(d.saved).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${d.script.lines.length} scenes</div></div>
      <div class="mini" style="margin:0"><button data-draft-open="${esc(d.id)}">Open</button><button class="del" data-draft-del="${esc(d.id)}">Delete</button></div></div>`).join("")}</div>`
    : `<div class="card"><div class="section-head"><h2>Queue</h2></div><div class="empty"><b>The queue is empty</b>Plan a week above, or tap Save draft on a script you're reviewing.</div></div>`;
}
$("drafts").addEventListener("click", async (e) => {
  if (e.target.closest("[data-draft-all]")) { unlockAudio(); return makeDrafts(listDrafts().sort((a, b) => a.saved - b.saved)); }
  const open = e.target.closest("[data-draft-open]"), del = e.target.closest("[data-draft-del]");
  if (del) { deleteDraft(del.dataset.draftDel); renderDrafts(); renderToday(); if (state.tab === "auto") renderAuto(); toast("Draft deleted"); return; }
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
    if (Number(stats.views) > 0 && !postedIds().has(r.id)) { setPosted(r.id, true); const pb = card.querySelector('[data-act="posted"]'); if (pb) { pb.textContent = "✓ Posted"; pb.classList.add("on"); } card.querySelector("[data-posted-badge]")?.classList.remove("hidden"); renderLibSpace(); }
    card.querySelector(".results summary").textContent = resultsSummary(stats);
    renderInsights();
  } else toast("Couldn't save the results (storage full?)");
});
async function renderLibrary() {
  renderDrafts();
  if (!state.lib) $("reels").innerHTML = `<div class="skeleton"></div>`;
  state.lib = await listReels();
  renderInsights();
  if (!state.lib.length && !allResults().length) $("insights").innerHTML = "";   // nothing to compare yet
  renderReelList();
  renderLibSpace();
}
// How much the Library holds, how full the phone's space for the app is, and a way to clear posted videos.
async function renderLibSpace() {
  const el = $("lib-space"); if (!el) return;
  const all = state.lib || [], posted = postedIds(), done = all.filter((r) => posted.has(r.id));
  if (!all.length) { el.classList.add("hidden"); return; }
  const mb = Math.round(all.reduce((n, r) => n + (r.blob?.size || 0) + (r.cover?.size || 0), 0) / 1e6);
  let pct = null; try { const est = await navigator.storage?.estimate?.(); if (est?.quota) pct = Math.round((est.usage / est.quota) * 100); } catch { /* unknown */ }
  el.classList.remove("hidden");
  el.innerHTML = `<div class="row" style="padding:0"><div><b>${all.length} video${all.length === 1 ? "" : "s"}</b> · ${mb} MB${done.length ? ` · ${done.length} posted` : ""}
    <small class="meta" style="display:block">${pct != null ? `${pct}% of the space your phone allows ReelBot is used. ` : ""}${pct != null && pct >= 70 ? "Getting full: delete videos you've already posted." : "Mark videos as posted; if space runs low, those go first."}</small></div>
    ${done.length ? `<button class="btn" data-del-posted="1" style="flex:none">Delete posted (${done.length})</button>` : ""}</div>`;
}
// The Library list: search by title or topic, filter by type, newest or most-viewed first.
const LIB_KINDS = { evergreen: "Explainers", news: "News", market: "Markets", custom: "Your topics", idea: "Ideas", quiz: "Quizzes" };
const KIND_ONE = { evergreen: "Explainer", news: "News", market: "Market recap", custom: "Your topic", idea: "Idea", quiz: "Quiz" };
function renderReelList() {
  const all = state.lib || [], f = (state.libFilter ??= { q: "", kind: "all", sort: "new" });
  const kinds = [...new Set(all.map((r) => r.kind).filter((k) => LIB_KINDS[k]))];
  $("lib-tools").classList.toggle("hidden", all.length < 4);
  if (all.length >= 4) {
    const unposted = all.filter((r) => !postedIds().has(r.id)).length;
    $("lib-kinds").innerHTML = [["all", `All (${all.length})`], ...(unposted && unposted < all.length ? [["unposted", `Not posted yet (${unposted})`]] : []), ...kinds.map((k) => [k, `${LIB_KINDS[k]} (${all.filter((r) => r.kind === k).length})`])]
      .map(([k, label]) => `<button class="chip${f.kind === k ? " on" : ""}" data-lib-kind="${k}">${esc(label)}</button>`).join("")
      + `<button class="chip" data-lib-sort="1">${f.sort === "views" ? "Most views first" : "Newest first"}</button>`;
  }
  const q = f.q.trim().toLowerCase();
  const posted = postedIds();
  let list = all.filter((r) => (f.kind === "all" || (f.kind === "unposted" ? !posted.has(r.id) : r.kind === f.kind)) && (!q || `${r.title} ${r.topic || ""} ${r.niche || ""}`.toLowerCase().includes(q)));
  if (f.sort === "views") list = list.slice().sort((a, b) => (getResult(b.id)?.stats?.views || 0) - (getResult(a.id)?.stats?.views || 0));
  $("reels").innerHTML = !all.length ? `<div class="empty"><b>No videos yet</b>Make your first one in the Studio. It's saved here, ready to share.<div class="btns"><button class="btn main wide" data-go="create">Make a video</button></div></div>`
    : !list.length ? `<div class="empty">No reels match. <button class="btn" data-lib-clear="1" style="margin-top:8px">Show all</button></div>`
    : list.map((r) => { try { return reelCard(r); } catch (e) { console.warn("reel card", e); return ""; } }).join("");
  // Opened from Home: scroll to that video and highlight it briefly.
  if (state.focusReel) {
    const card = document.querySelector(`#reels [data-reel="${CSS.escape(state.focusReel)}"]`); state.focusReel = null;
    if (card) { card.scrollIntoView({ block: "center" }); card.classList.add("flash"); setTimeout(() => card.classList.remove("flash"), 1600); }
  }
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
  if (btn.dataset.act === "delete" && confirm("Delete this reel from your phone?")) { await deleteReel(r.id); card.remove(); state.lib = (state.lib || []).filter((x) => x.id !== r.id); renderLibSpace(); }
  if (btn.dataset.act === "posted") {
    const on = !postedIds().has(r.id); setPosted(r.id, on);
    btn.textContent = on ? "✓ Posted" : "Mark as posted"; btn.classList.toggle("on", on); renderLibSpace();
    card.querySelector("[data-posted-badge]")?.classList.toggle("hidden", !on);
    toast(on ? "Marked as posted" : "Marked as not posted", on ? "ok" : "");
  }
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

// Hands a file to the share sheet (Save to Files, AirDrop, Calendar…), or downloads it where that isn't offered.
async function saveFile(file) {
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
    else { const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); }
    return true;
  } catch (e) { if (e.name !== "AbortError") toast("Couldn't share: " + e.message); return false; }
}

/* ---------- backup and restore: settings, drafts, results (not the videos) ---------- */
// Everything the app keeps in this phone's browser storage except short-lived voice/AI status flags.
const NO_BACKUP = /^(voiceBusy|aiLoading|voiceStrikes|voiceRetried|voiceError|voiceLevel|voiceReady-.*|seenVersion|libSaved|movedLater)$/;
async function backup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && !NO_BACKUP.test(k)) data[k] = localStorage.getItem(k); }
  const day = new Date().toISOString().slice(0, 10);
  const file = new File([JSON.stringify({ app: "ReelBot", version: APP_VERSION, made: Date.now(), data }, null, 1)], `reelbot-backup-${day}.json`, { type: "application/json" });
  if (await saveFile(file)) toast(`Backed up ${Object.keys(data).length} items (settings, drafts, results)`);
}
async function restore(file) {
  let b = null;
  try { b = JSON.parse(await file.text()); } catch { /* not JSON */ }
  if (!b || b.app !== "ReelBot" || typeof b.data !== "object") return toast("That isn't a ReelBot backup file.");
  const when = new Date(b.made || 0).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  if (!confirm(`Restore the backup from ${when}? Your settings, drafts and results are replaced with the ones in the backup. Videos on this phone stay.`)) return;
  let n = 0;
  for (const [k, v] of Object.entries(b.data)) { if (NO_BACKUP.test(k) || typeof v !== "string") continue; try { localStorage.setItem(k, v); n++; } catch { /* full */ } }
  toast(`Restored ${n} items. Reloading…`);
  setTimeout(() => location.reload(), 900);
}

/* ---------- posting reminders: the planned week in your calendar ---------- */
// An .ics file with one event per planned draft ("Mon · …"), on its next day at the chosen hour, with an alert.
function weekCalendar(drafts, hour = 18) {
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], pad = (n) => String(n).padStart(2, "0");
  const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const esc = (s) => String(s).replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
  const now = new Date(), events = [];
  for (const d of drafts) {
    const day = DAYS.indexOf((d.label.match(/^(\w{3}) · /) || [])[1]); if (day < 0) continue;
    const at = new Date(now); at.setHours(hour, 0, 0, 0);
    let ahead = (day - now.getDay() + 7) % 7; if (ahead === 0 && at <= now) ahead = 7;
    at.setDate(at.getDate() + ahead);
    const title = d.label.replace(/^\w{3} · /, "");
    events.push(["BEGIN:VEVENT", `UID:${d.id}-${stamp(at)}@reelbot`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(at)}`, "DURATION:PT15M",
      `SUMMARY:${esc("Post: " + title)}`, `DESCRIPTION:${esc("Open ReelBot: today's video is ready to make and post. " + location.href.split("#")[0])}`, `URL:${location.href.split("#")[0]}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc("Time to post: " + title)}`, "TRIGGER:-PT0M", "END:VALARM", "END:VEVENT"].join("\r\n"));
  }
  if (!events.length) return null;
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ReelBot//Posting plan//EN", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n") + "\r\n";
}
async function addReminders(hour) {
  const planned = listDrafts().filter((d) => /^\w{3} · /.test(d.label));
  const ics = weekCalendar(planned, hour);
  if (!ics) return toast("Plan your week first: the reminders come from its drafts.");
  if (await saveFile(new File([ics], "reelbot-posting-plan.ics", { type: "text/calendar" }))) toast(`${planned.length} posting reminders ready: add them to your calendar`);
}

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
    sfx: $("sfx").checked, cuts: $("cuts").checked, hookTitle: $("hooktitle").checked, showSources: $("sources").checked,
    depth: Number(state.depth) || 2, factCheck: $("factcheck").checked, strict: $("factcheck").checked && $("strict").checked,
    forceEncoder: params.get("encoder") || undefined,
  };
}
function screen(name) {   // form | job | review
  $("form").classList.toggle("hidden", name !== "form");
  $("job").classList.toggle("hidden", name !== "job");
  $("review").classList.toggle("hidden", name !== "review");
  if (name !== "form") $("result").classList.add("hidden");
  if (state.tab === "create") window.scrollTo(0, 0);
  mirrorJob();
}
// Sets text only when it changed: progress ticks many times a second, and a live region re-reads every change.
const setText = (el, s) => { if (el && el.textContent !== s) el.textContent = s; };
const say = (text, f) => {
  setText($("job-step"), text);
  if (f != null) { const pct = Math.round(f * 100); $("bar").style.width = pct + "%"; $("bar").parentElement.setAttribute("aria-valuenow", pct); jobProgress(f); }
  mirrorJob(f);
};
// While something is being made, the sidebar and Home show it too, so you can look around meanwhile.
let lastJobF = 0, jobWasBusy = false;
function mirrorJob(f) {
  const busy = state.busy && !$("job").classList.contains("hidden");
  if (busy && !jobWasBusy && f == null) lastJobF = 0;   // a new job starts from zero
  if (f != null) lastJobF = f;
  if (jobWasBusy && !busy) setTimeout(jobEnded, 0);   // after the result card is filled in
  jobWasBusy = busy;
  const hs = $("home-status");
  $("nav-job").classList.toggle("hidden", !busy); hs.classList.toggle("hidden", !busy);
  if (!busy) return;
  // Built once, then only what changed is updated, so the spinner keeps turning and the page stays light while it renders.
  if (!hs.firstChild) hs.innerHTML = `<span class="spinner" aria-hidden="true"></span><div><b data-hs="title"></b><span class="meta" data-hs="step" aria-live="polite"></span>
      <div class="progress"><div data-hs="bar"></div></div></div><span class="badge accent" data-hs="pct"></span>`;
  const pct = Math.round(lastJobF * 100) + "%", title = $("job-title").textContent;
  setText($("nav-job-text"), `${title.replace(/…$/, "")} · ${pct}`);
  setText(hs.querySelector('[data-hs="title"]'), title);
  setText(hs.querySelector('[data-hs="step"]'), $("job-step").textContent);
  setText(hs.querySelector('[data-hs="pct"]'), pct);
  hs.querySelector('[data-hs="bar"]').style.width = pct;
}

// When a job ends while you're on another page, that page catches up and a toast says how it went.
function jobEnded() {
  if (state.busy || state.tab === "create") return;
  if (state.tab === "home") renderHome(); else if (state.tab === "library") renderLibrary(); else if (state.tab === "auto") renderAuto(); else if (state.tab === "about") renderStorage();
  // A failed video goes back to its review with the error above it, so the error is checked first.
  const title = (!$("result").classList.contains("hidden") && $("result").querySelector("h2")?.textContent) || "";
  if (/couldn't|stopped|didn't|wrong/i.test(title)) toast(`${title}. Details are in the Studio`, "err");
  else if (!$("review").classList.contains("hidden")) toast("Your script is ready to review in the Studio", "ok");
  else if (title) toast(`${title}. See it in the Studio`, "ok");
}

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
  jobStart(makeRate() * (state.plan ? estimateSeconds(state.plan.script.lines, SPEEDS[state.speed] || 1, voiceOpts(state.voice).engine) : 0));
  say("Starting…", 0);
  let wake = null; try { wake = await navigator.wakeLock?.request("screen"); } catch { /* not supported */ }
  const t0 = performance.now();
  try {
    if (state.ideasUI) { say("Freeing memory…", 0); await state.ideasUI.unloadAI(); }   // rendering needs the memory
    const made = { script: { ...state.plan.script, lines: state.plan.script.lines.map((l) => ({ text: l.text, kind: l.kind })) }, opts: options() };
    const reel = await produceReel(state.plan, options(), { say, canvas: $("preview"), audioCtx: state.audioCtx, toast });
    state.plan = null; clearAutosave();
    // Quietly draw other ways to illustrate this video's scenes, so they're saved and ready next time.
    if (made.opts.artStyle !== "icons") setTimeout(() => drawAlternatives(made.script, made.opts).then(() => { if (document.querySelector("#tab-about.active")) renderStorage(); }).catch(() => {}), 2500);
    if (state.draftId) { deleteDraft(state.draftId); state.draftId = null; }
    const kept = await saveReel(reel);
    screen("form");
    const soundNote = reel.sound === false
      ? `<p style="color:var(--bad)"><b>This video has no sound.</b> Your phone's browser didn't record the audio. Please run <b>Sound test</b> in Settings and tell us what it says.</p>`
      : reel.sound ? `<p style="color:var(--good)">Sound checked ✓</p>`
      : reel.written && reel.written.peakDb > -40 ? `<p style="color:var(--good)">Sound written into the video ✓</p>` : "";
    const roomNote = kept?.removed?.length ? `<p class="meta">To make room on your phone, ${kept.removed.length === 1 ? "this older video was" : "these older videos were"} removed from the Library: ${kept.removed.map(esc).join(", ")}.</p>` : "";
    $("result").innerHTML = `<h2>Your reel is ready</h2><p>Made in ${Math.round((performance.now() - t0) / 1000)}s on this device (${esc(reel.how)}).${kept ? "" : " It couldn't be kept in the Library, so save it now."}</p>${soundNote}${roomNote}` + reelCard(reel, true);
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
      if (i === 0) { state.plan = null; clearAutosave(); if (state.draftId) { deleteDraft(state.draftId); state.draftId = null; } }
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
  show("create");      // progress and the result show in the Studio, wherever this was started
  screen("job"); $("job-title").textContent = "Planning your week…"; $("preview").classList.add("hidden");
  const made = [], used = [];
  try {
    const base = options();
    // On Auto, a varied week: explainers, the day's news, a mid-week quiz and a Friday market recap.
    const MIX = ["evergreen", "news", "quiz", "evergreen", "market"], DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    for (let i = 0; i < 5; i++) {
      const mode = base.mode === "auto" || base.mode === "custom" ? (base.offline && /news|market/.test(MIX[i]) ? "evergreen" : MIX[i]) : base.mode;
      const opts = { ...base, mode, noPhotos: true, exclude: used };
      const plan = await planReel(opts, { say: (t, f) => say(`Script ${i + 1} of 5: ${t}`, (i + (f || 0)) / 5) });
      used.push(plan.script.topicId);
      if (plan.script.kind !== "quiz" && made.some((d) => d.label.endsWith(plan.script.title))) { releasePlan(plan); continue; }   // quizzes share a title but not questions
      const d = draftFromPlan(plan, `${DAYS[made.length] || ""} · ${plan.script.title}`.replace(/^ · /, "")); releasePlan(plan);
      if (!saveDraft(d)) break;
      made.push(d);
    }
    screen("form");
    renderToday();
    $("result").innerHTML = `<h2>Your week is planned</h2><p>${made.length} drafts saved to the queue in Automation, each fact-checked and ready to review. Open one when you're ready to make it.</p><ol class="steps">${made.map((d) => `<li>${esc(d.label)}</li>`).join("")}</ol>
      ${REMINDER_ROW}<div class="btns"><button class="btn wide" data-go="auto">Open the queue</button></div>`;
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
  const secs = Math.round(estimateSeconds(plan.script.lines, SPEEDS[state.speed] || 1, voiceOpts(state.voice).engine));
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
      : `<div class="mini">${i > 1 ? `<button data-move="${i}:-1" aria-label="Move up">↑</button>` : ""}${i > 0 && script.lines[i + 1] && script.lines[i + 1].kind !== "outro" ? `<button data-move="${i}:1" aria-label="Move down">↓</button>` : ""}${v.type === "illus" && state.art !== "icons" ? `<button data-artpick="${i}">Another illustration</button>` : ""}<button data-swap="${i}">New photo</button><button data-search="${i}">Search…</button><button data-mine="${i}">My photo</button>${content > 2 ? `<button class="del" data-del="${i}">Remove</button>` : ""}</div>`;
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
  const rate = makeRate(), secs = estimateSeconds(script.lines, SPEEDS[state.speed] || 1, voiceOpts(state.voice).engine);
  $("produce").textContent = rate ? `Make the video (about ${fmtDuration(rate * secs)})` : "Make the video";
  // A series follows a topic into related ones; news, market recaps and quizzes don't have one.
  $("series").classList.toggle("hidden", ["news", "market", "quiz"].includes(script.kind));
  screen("review");
  // Script boxes grow to fit their text (measured once the screen is showing; they keep growing as you type).
  document.querySelectorAll(".scene textarea").forEach(fitTextarea);
  autosave(true); $("resume")?.classList.add("hidden");
  $("undo-remove").classList.toggle("hidden", !state.plan.undo);
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
function fitTextarea(ta) { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; }
$("scenes").addEventListener("input", (e) => {
  if (e.target.matches?.(".scene textarea")) fitTextarea(e.target);
  const i = e.target.dataset.line; if (i == null) return;
  const line = state.plan.script.lines[+i];
  line.text = e.target.value.replace(/\s+/g, " ").trim();
  line.analysis = null;                                  // re-read numbers and concepts from the new text
  line.claim = null;                                     // your wording is now what gets fact-checked
  if (+i === 0) state.plan.script.hookKind = "written";
  autosave();
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
    plan.script.hookKind = smartHooks(plan.script).find((o) => o.text === first.text)?.kind || "written";   // for "What works for you"
    return showReview();
  }
  if (b.dataset.move != null) {
    // Move a scene up or down. The hook stays first and the ending stays last.
    const [i, d] = b.dataset.move.split(":").map(Number), j = i + d, lines = plan.script.lines;
    if (j < 1 || i < 1 || !lines[j] || lines[j].kind === "outro" || lines[i].kind === "outro") return;
    [lines[i], lines[j]] = [lines[j], lines[i]];
    plan.undo?.line.asset?.bitmap?.close?.();        // an undo after moving scenes would put it in the wrong place
    plan.edited = true; plan.undo = null; showReview();
    document.querySelector(`[data-line="${j}"]`)?.closest(".scene")?.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
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
    // The removed scene (and its photo) is kept until the next removal, so it can be put back.
    plan.undo?.line.asset?.bitmap?.close?.();
    const at = +b.dataset.del, [gone] = plan.script.lines.splice(at, 1);
    plan.undo = { line: gone, at }; plan.edited = true; showReview();
  }
});
$("photo-pick").addEventListener("change", async () => {
  const file = $("photo-pick").files[0], i = state.pickFor; if (!file || i == null) return;
  const btn = document.querySelector(`[data-mine="${i}"]`); if (btn) btn.textContent = "Saving…";
  const asset = await saveUserPhoto(file).catch(() => null);
  if (!asset) { if (btn) btn.textContent = "My photo"; return toast("That photo couldn't be opened. Try a JPEG or PNG."); }
  setAsset(i, Promise.resolve(asset), "Loading…");
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
  const ok = saveDraft(d);
  if (ok) { clearTimeout(autosaveTimer); try { localStorage.removeItem(AUTOSAVE); } catch { /* ignore */ } }   // it's safe in Drafts now
  toast(ok ? "Draft saved. Find it in Automation → Queue." : "Couldn't save the draft (storage full?)");
});
$("undo-remove").addEventListener("click", () => {
  const plan = state.plan; if (!plan?.undo) return;
  plan.script.lines.splice(Math.min(plan.undo.at, plan.script.lines.length), 0, plan.undo.line);
  plan.undo = null; showReview(); toast("Scene put back");
});
$("reroll").addEventListener("click", () => { if (state.plan) releasePlan(state.plan); state.plan = null; clearAutosave(); start(); });
$("cancel-review").addEventListener("click", () => { if (state.plan) releasePlan(state.plan); state.plan = null; closeAudio(); clearAutosave(); screen("form"); });

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
/* ---------- the new address (v48): linkplayt.github.io/ReelBot ---------- */
// A copy opened from the old address (/FREELM/) keeps working from what's saved on this phone. Once the new
// address is live it says so, with the steps to bring drafts and settings along (Home Screen web apps keep
// their own storage, so they move with a backup). "Later" hides it for three days.
const NEW_HOME = "/ReelBot/", OLD_HOME = /^\/freelm\//i;
async function checkMoved() {
  if (!OLD_HOME.test(location.pathname)) return;
  if (Date.now() - Number(store.get("movedLater") || 0) < 3 * 86400e3) return;
  try { const r = await fetch(NEW_HOME + "manifest.webmanifest", { cache: "no-store" }); if (!r.ok) return; } catch { return; }
  const url = location.origin + NEW_HOME;
  document.getElementById("moved-sheet")?.remove();
  const sheet = document.createElement("div");
  sheet.id = "moved-sheet"; sheet.className = "copy-sheet"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-label", "ReelBot has a new address");
  sheet.innerHTML = `<div class="copy-box news"><h2 style="margin:0">ReelBot has a new address</h2>
    <p class="meta" style="margin:4px 0 0"><b>${esc(url.replace(/^https?:\/\//, ""))}</b>, a link that matches its name.</p>
    <p>This copy keeps working, but updates now arrive at the new address. To bring everything along:</p>
    <ol class="steps"><li><b>Back up</b> here (settings, drafts and results go into one file).</li><li>Save any videos you want to keep (Library → Save / Share).</li>
    <li>Open the new address in Safari, add it to your Home Screen, then <b>Settings → Restore</b>.</li></ol>
    <div class="btns"><a class="btn main" href="${esc(url)}" target="_blank" rel="noopener" style="text-decoration:none">Open the new address</a><button class="btn" data-moved="backup">Back up now</button><button class="btn ghost" data-moved="later">Later</button></div></div>`;
  sheet.addEventListener("click", (e) => {
    const b = e.target.closest("[data-moved]");
    if (b?.dataset.moved === "backup") backup();
    if (b?.dataset.moved === "later" || e.target === sheet) { store.set("movedLater", String(Date.now())); sheet.remove(); }
  });
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
  ["Your photos", /\/user\/photos\//, "Drafts that used them will find new photos instead."],
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
      const status = art ? (n ? `${n} drawn on this phone${reuses ? `, reused ${reuses} time${reuses === 1 ? "" : "s"}` : ""}` : "None yet: they're drawn as you make videos") : label === "Your photos" ? (n ? `${n} photo${n === 1 ? "" : "s"} kept for your drafts` : "None yet: photos you choose with My photo are kept here") : n ? "Saved on this phone" : "Not downloaded";
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
  prefChips("moods", MOODS, "mood", store.get("musicOff") === "1" ? "none" : "auto");
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
  prefChips("quality", { high: "High (sharper)", standard: "Standard (smaller files)" }, "quality", "high");
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
  for (const [id, key] of [["sfx", "sfx"], ["cuts", "cuts"], ["hooktitle", "hookTitle"], ["sources", "sources"], ["factcheck", "factcheck"], ["strict", "strict"]]) {
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
  // Studio: the summary follows every choice; the step bar scrolls smoothly to each step.
  renderStudioSummary();
  $("form").addEventListener("click", () => setTimeout(renderStudioSummary, 0));
  $("form").addEventListener("input", () => setTimeout(renderStudioSummary, 0));
  $("form").addEventListener("change", () => setTimeout(renderStudioSummary, 0));
  document.querySelector(".stepnav").addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='#']"); if (!a) return;
    e.preventDefault(); document.querySelector(a.getAttribute("href"))?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });
  $("backup").addEventListener("click", backup);
  $("restore").addEventListener("change", () => { const f = $("restore").files[0]; if (f) restore(f); $("restore").value = ""; });
  $("lib-space").addEventListener("click", async (e) => {
    if (!e.target.closest("[data-del-posted]")) return;
    const posted = postedIds(), list = (state.lib || []).filter((r) => posted.has(r.id));
    if (!list.length || !confirm(`Delete ${list.length} posted video${list.length === 1 ? "" : "s"} from your phone? Their results stay in “What works for you”.`)) return;
    for (const r of list) { await deleteReel(r.id); setPosted(r.id, false); }
    toast(`Deleted ${list.length} posted video${list.length === 1 ? "" : "s"}`); renderLibrary();
  });
  // Ask the phone to keep ReelBot's storage (videos, voices, drafts) even when space runs low.
  navigator.storage?.persisted?.().then((p) => { if (!p) navigator.storage.persist?.().catch(() => {}); }).catch(() => {});
  // Tidy up: your saved photos that no draft or autosaved script uses any more.
  setTimeout(() => {
    const keep = [...listDrafts(), pendingAutosave()].filter(Boolean).flatMap((d) => d.script.lines.map((l) => l.photo).filter(Boolean));
    if (state.plan) keep.push(...state.plan.script.lines.map((l) => l.asset?.photoPath).filter(Boolean));
    pruneUserPhotos(keep);
  }, 8000);
  renderResume();
  $("resume").addEventListener("click", (e) => { const b = e.target.closest("[data-resume]"); if (b) resumeAction(b.dataset.resume); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && state.plan) autosave(true); });
  // Hear the chosen music: 8 seconds, made the same way as in a video (Auto plays a sample of each mood it picks from).
  let musicSrc = null;
  $("music-preview").addEventListener("click", async () => {
    if (musicSrc) { try { musicSrc.stop(); } catch { /* already stopped */ } return; }
    const ctx = unlockAudio(); if (!ctx) return toast("This browser can't play audio");
    const mood = state.mood;
    if (mood === "none") return toast("No music: only the voice and sound effects.");
    $("music-preview").textContent = "■ Stop";
    try {
      let samples;
      if (mood === "mine") samples = await userMusic(8);
      else if (mood === "auto") { const a = generateMusic(4, "suspense", { dropAt: 1 }), b = generateMusic(4, "bright", { dropAt: 0.5 }); samples = new Float32Array(a.length + b.length); samples.set(a); samples.set(b, a.length); }
      else samples = generateMusic(8, mood, { dropAt: 2 });
      if (!samples) throw new Error("no track");
      const buf = ctx.createBuffer(1, samples.length, SR); buf.copyToChannel(samples.map((v) => v * 0.6), 0);
      musicSrc = ctx.createBufferSource(); musicSrc.buffer = buf; musicSrc.connect(ctx.destination);
      musicSrc.onended = () => { musicSrc = null; $("music-preview").textContent = "▶ Hear it"; };
      musicSrc.start();
    } catch (e) { musicSrc = null; $("music-preview").textContent = "▶ Hear it"; toast(mood === "mine" ? "Choose a track first" : "Couldn't play the music"); }
  });
  $("lib-q").addEventListener("input", () => { (state.libFilter ??= { q: "", kind: "all", sort: "new" }).q = $("lib-q").value; renderReelList(); });
  $("lib-tools").addEventListener("click", (e) => {
    const f = (state.libFilter ??= { q: "", kind: "all", sort: "new" }), k = e.target.closest("[data-lib-kind]"), s = e.target.closest("[data-lib-sort]");
    if (k) f.kind = k.dataset.libKind; else if (s) f.sort = f.sort === "views" ? "new" : "views"; else return;
    renderReelList();
  });
  $("reels").addEventListener("click", (e) => { if (e.target.closest("[data-lib-clear]")) { state.libFilter = { q: "", kind: "all", sort: "new" }; $("lib-q").value = ""; renderReelList(); } });
  $("insights").addEventListener("click", (e) => { if (e.target.closest("[data-use-best]")) useBest(); });
  renderToday();
  $("today").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-today]"), d = todayDraft(); if (!b || !d || state.busy) return;
    unlockAudio();   // inside the tap, for iPhone audio
    if (b.dataset.today === "make") return makeDrafts([d]);
    show("auto"); document.querySelector(`[data-draft-open="${CSS.escape(d.id)}"]`)?.click();
  });
  checkWhatsNew(); checkMoved();
  $("ai-check").addEventListener("click", aiCheck);
  $("wipe").addEventListener("click", async () => { if (confirm("Delete every reel stored on this phone?")) { await clearReels(); renderLibrary(); toast("Deleted"); } });
  const info = await encoderInfo();
  $("encoder").textContent = info.webcodecs ? `Video encoder: on-device H.264, ${info.video.width}×${info.video.height}, with uncompressed sound.`
    : info.recorder ? "Video encoder: real-time recording (a reel takes about as long to make as it runs)."
    : "This browser can't encode video. Update iOS and use Safari.";
  $("nav-version").textContent = `Version ${APP_VERSION}`;
  // Returning users open on Home; the first visit opens the Studio.
  show(store.get("made") === "1" ? "home" : "create");
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
