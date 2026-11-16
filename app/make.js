// The whole pipeline, on the phone: research -> script -> voice -> photos -> music -> render.
import * as research from "./research.js";
import { buildEvergreen, buildNews, buildMarket, buildCustom, buildMetadata, speakable, statFor, visualMatch } from "./script.js";
import { MediaFinder } from "./media.js";
import { loadVoice, phonemize, synthesize, VOICE_RATE } from "./tts.js";
import { generateMusic, mix, resample, SR } from "./music.js";
import { loadFonts, renderReel } from "./render.js";
import { analyzeLine, iconFor } from "./visuals.js";
import { deepen, addSoundEffects, makeSrt, makeCover } from "./extras.js";
import { StatBg, IllusBg } from "./graphics.js";

const GAP = 0.28, TAIL = 0.8;
// Reel length presets: [shortest, longest] in seconds.
export const LENGTHS = { short: [20, 30], standard: [30, 45], long: [40, 60], deep: [60, 90], full: [120, 180] };
const isDeep = (length) => length === "deep" || length === "full";
let MIN_S = 30, MAX_S = 45;
function setLength(name) { [MIN_S, MAX_S] = LENGTHS[name] || LENGTHS.standard; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

let dataCache = null;
export async function appData() {
  if (!dataCache) dataCache = await (await fetch(new URL("./data/topics.json", import.meta.url))).json();
  return dataCache;
}

function history() { try { return JSON.parse(localStorage.getItem("history") || "[]"); } catch { return []; } }
function remember(script) { try { localStorage.setItem("history", JSON.stringify([...history(), { id: script.topicId, kind: script.kind }].slice(-200))); } catch { /* private mode */ } }

function pickTopic(data, niche, topicId, hist) {
  if (topicId) { const t = data.topics.find((x) => x.id === topicId); if (t) return t; }
  const pool = data.topics.filter((t) => t.niches.includes(niche));
  const used = hist.map((h) => h.id);
  const unused = pool.filter((t) => !used.includes(t.id));
  if (unused.length) return pick(unused);
  return pool.slice().sort((a, b) => used.lastIndexOf(a.id) - used.lastIndexOf(b.id))[0];   // least recently used
}

async function writeScript(opts, data, say) {
  const hist = history(), done = new Set(hist.map((h) => h.id));
  const generic = data.generic_visuals[opts.niche] || data.generic_visuals["personal finance"];
  const o = { niche: opts.niche, cta: opts.cta, generic };
  let order = [opts.topicId || opts.offline ? "evergreen" : opts.mode];   // news and markets need the internet
  if (order[0] === "auto") {
    const w = ["investing", "crypto", "economy"].includes(opts.niche) ? { evergreen: 0.4, news: 0.3, market: 0.3 } : { evergreen: 0.5, news: 0.3, market: 0.2 };
    const last = hist[hist.length - 1]?.kind; if (w[last]) w[last] *= 0.4;
    let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0), first = "evergreen";
    for (const [k, v] of Object.entries(w)) { if ((r -= v) <= 0) { first = k; break; } }
    order = [first, ...["news", "market"].filter((m) => m !== first)];
  }
  let headlines = null, markets = null;
  for (const mode of order) {
    if (mode === "evergreen") break;
    say(mode === "news" ? "Reading today's headlines…" : "Checking the markets…");
    headlines ??= await research.fetchHeadlines(opts.niche, opts.repo).catch(() => []);
    markets ??= await research.marketSnapshot(opts.niche, opts.repo).catch(() => []);
    const s = mode === "news" ? buildNews(headlines, markets, o) : buildMarket(markets, headlines, o);
    if (s && (!done.has(s.topicId) || opts.mode !== "auto")) return s;
  }
  const topic = pickTopic(data, opts.niche, opts.topicId, hist);
  say("Researching: " + topic.title);
  return buildEvergreen(topic, o, topic.wiki && !opts.offline ? await research.wikipediaDefinition(topic.wiki) : "");
}

// Pause after a line: the normal gap, plus extra hold time for chapter and recap cards so they can be read.
const gapAfter = (line) => GAP + (line?.hold || 0);
const seconds = (clips, lines = []) => clips.reduce((n, c) => n + c.length, 0) / VOICE_RATE
  + clips.slice(0, -1).reduce((n, _, i) => n + gapAfter(lines[i]), 0) + TAIL;

async function voiceScript(script, say, base = 1.0) {
  const all = [...script.lines, ...script.extras];
  const phon = await phonemize(all.map((l) => speakable(l.text)));
  all.forEach((l, i) => { l.phonemes = phon[i]; });
  let speed = base;
  const speak = async (lines) => {
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      say(`Recording the voiceover (${i + 1} of ${lines.length})…`, i / lines.length);
      out.push(await synthesize(lines[i].phonemes, speed));
      await sleep(0);   // let the screen update between sentences
    }
    return out;
  };
  let clips = await speak(script.lines);
  while (seconds(clips, script.lines) < MIN_S && script.extras.length) {          // too short: add researched extras
    const extra = script.extras.shift();
    let at = script.lines.length - 1;                                  // before the recap / ending
    while (at > 1 && ["recap", "outro"].includes(script.lines[at - 1].kind)) at--;
    script.lines.splice(at, 0, extra);
    clips.splice(at, 0, await synthesize(extra.phonemes, speed));
  }
  if (seconds(clips, script.lines) > MAX_S) {                                     // too long: speak a little faster
    speed = Math.min(base * 1.18, base * (Math.ceil((seconds(clips, script.lines) / MAX_S) * 50) / 50 + 0.02));
    clips = await speak(script.lines);
  }
  while (seconds(clips, script.lines) > MAX_S && script.lines.length > 4) {       // still too long: drop the longest middle line
    let drop = 1;
    for (let i = 1; i < script.lines.length - 1; i++) if (script.lines[i].kind === "media" && (script.lines[drop].kind !== "media" || clips[i].length > clips[drop].length)) drop = i;
    script.lines.splice(drop, 1); clips.splice(drop, 1);
  }
  if (seconds(clips, script.lines) < MIN_S && speed > base * 0.92) { speed = base * 0.92; clips = await speak(script.lines); }
  return clips;
}

function timings(script, clips) {
  const words = [], spans = []; let t = 0;
  script.lines.forEach((line, i) => {
    const dur = clips[i].length / VOICE_RATE;
    spans.push([t, t + dur]);
    const tokens = line.text.split(/\s+/).filter(Boolean);
    const weights = tokens.map((tok) => speakable(tok).length + 2.5 + (/[.,!?;:]$/.test(tok) ? 4 : 0));
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    let cursor = t + 0.04;
    tokens.forEach((tok, j) => { const d = (dur - 0.08) * weights[j] / sum; words.push({ text: tok, start: cursor, end: cursor + d }); cursor += d; });
    t += dur + gapAfter(line);
  });
  return { words, spans };
}

function assembleAudio(clips, mood, lines) {
  const total = Math.max(seconds(clips, lines), MIN_S), voice = new Float32Array(Math.ceil(total * SR));
  let off = 0;
  clips.forEach((c, i) => { const r = resample(c, VOICE_RATE); voice.set(r.subarray(0, Math.max(0, voice.length - off)), off); off += r.length + Math.round(gapAfter(lines[i]) * SR); });
  // Gentle compression so the voice is loud and even on phone speakers.
  const drive = 2.0, norm = Math.tanh(drive);
  for (let i = 0; i < voice.length; i++) voice[i] = Math.tanh(voice[i] * drive) / norm;
  return { audio: mix(voice, mood && mood !== "none" ? generateMusic(total, mood) : null, mood === "cinematic" ? 0.17 : 0.14), total };
}

// Rough spoken length of a script, for the review screen.
export function lengthRange(name) { return LENGTHS[name] || LENGTHS.standard; }
export function estimateSeconds(lines, speed = 1.0) {
  const words = lines.reduce((n, l) => n + speakable(l.text).split(/\s+/).filter(Boolean).length, 0);
  return words / (2.75 * speed) + lines.slice(0, -1).reduce((n, l) => n + gapAfter(l), 0) + TAIL;
}

// Step 1: research, write the script and find a photo for every scene.
// opts: { niche, mode, topicId, customTopic, cta, repo }   ui: { say(text, fraction) }
export async function planReel(opts, ui) {
  const data = await appData();
  const generic = data.generic_visuals[opts.niche] || data.generic_visuals["personal finance"];
  const say = (text, f = 0) => ui.say(text, Math.min(1, Math.max(0, f)));
  const script = opts.mode === "custom"
    ? await customScript(opts, generic, say)
    : await writeScript(opts, data, (t) => say(t, 0.1));
  if (isDeep(opts.length)) { say("Researching more detail for the deep dive…", 0.15); await deepen(script, { ...opts, depth: opts.depth || 2 }); }
  const fact = await checkFacts(script, opts, say);
  return { ...(await attachPhotos(script, generic, opts, say)), fact };
}

// Finds a photo for every scene (skipped in offline mode: scenes then use animated backgrounds).
async function attachPhotos(script, generic, opts, say) {
  const finder = new MediaFinder(opts.offline ? [] : generic), usedQueries = new Set();
  if (opts.offline) finder.find = finder.findImage = async () => null;
  const media = [...script.lines, ...script.extras].filter((l) => l.kind === "media");
  for (const line of media) {
    // Search for what THIS line talks about; fall back to the topic's own visuals.
    const own = visualMatch(line.text);
    line.concrete = Boolean(own);
    let q = own || line.visual || generic[0];
    if (usedQueries.has(q)) q = generic.find((g) => !usedQueries.has(g)) || q;   // avoid repeating the same subject
    usedQueries.add(q);
    line.query = q;
    line.asset = finder.find(q).catch(() => null);
  }
  // Wait for the photos you'll see on the review screen; extras keep loading in the background.
  let got = 0;
  const shown = script.lines.filter((l) => l.kind === "media");
  await Promise.all(shown.map(async (l) => { l.asset = await l.asset; say("Finding free photos…", 0.2 + 0.8 * (++got / shown.length)); }));
  return { script, finder, generic, edited: false };
}

// An idea from the Idea Lab -> a plan for the review screen.
export async function planFromIdea(idea, opts, ui) {
  const { scriptFromIdea } = await import("./ai/ideas.js");
  const data = await appData();
  const generic = data.generic_visuals[opts.niche] || data.generic_visuals["personal finance"];
  const script = scriptFromIdea(idea, { niche: opts.niche, cta: opts.cta, generic, visualFor: visualMatch });
  const say = (text, f = 0) => ui.say(text, Math.min(1, Math.max(0, f)));
  if (isDeep(opts.length)) { say("Researching more detail for the deep dive…", 0.1); await deepen(script, { ...opts, depth: opts.depth || 2 }); }
  const fact = await checkFacts(script, opts, say);
  return { ...(await attachPhotos(script, generic, opts, say)), fact };
}

// Fact check (explainers, your topics and ideas): every factual line is checked against the research
// library, and at depth 3+ (when online) against live Wikipedia too. With strict accuracy on, facts
// that can't be verified are swapped for verified ones or removed.
async function checkFacts(script, opts, say) {
  if (opts.factCheck === false || !["evergreen", "custom", "idea"].includes(script.kind)) return null;
  try {
    const { factCheck, enforceAccuracy, summarize } = await import("./ai/factcheck.js");
    const depth = opts.depth || 2;
    const r = await factCheck(script.lines, { topic: (script.topicTitle || script.title).replace(/\s*#Shorts$/, ""), niche: script.niche, depth,
      online: !opts.offline && depth >= 3, onStep: (t) => say(t, 0.18), extras: script.extras.filter((l) => l.kind === "media") });
    let fixed = null;
    if (opts.strict) fixed = enforceAccuracy(script, r.ctx);
    return { ctx: r.ctx, summary: summarize(script.lines), fixed };
  } catch (e) { console.warn("fact check failed", e); return null; }
}

async function customScript(opts, generic, say) {
  const topic = (opts.customTopic || "").trim();
  if (topic.length < 2) throw new Error("Type a topic first, for example \"Roth IRA\" or \"inflation\".");
  say(`Researching "${topic}" in the on-phone library…`, 0.05);
  let found = null;
  try {
    const { deepResearch } = await import("./ai/research.js");
    const brief = await deepResearch(topic, { niche: opts.niche, depth: opts.depth || 2 });
    const tl = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    // Use the local library when it has an article on exactly this topic ("Mortgage" shouldn't become
    // "Mortgage servicer"); otherwise ask Wikipedia online. Offline, a close match is better than nothing.
    const base = (t) => tl(t.replace(/\s+\(.*\)$/, "")).replace(/(es|s)$/, "");
    const exact = brief && base(brief.main.title) === base(topic);
    const close = brief && (tl(brief.main.title).includes(tl(topic)) || tl(topic).includes(tl(brief.main.title.replace(/\s+\(.*\)$/, ""))));
    if (exact || (close && opts.offline)) {
      const own = brief.facts.filter((f) => f.source === brief.main.title).map((f) => f.text);
      // The defining first sentence always leads, trimmed to its core when it's too long to say.
      const first = brief.main.sentences[0] || "", n = first.split(/\s+/).length;
      const definition = n <= 34 ? first : research.trimDefinition(first);
      const sentences = [...new Set([definition, ...brief.summary, ...own, ...brief.facts.map((f) => f.text)].filter(Boolean))];
      if (sentences.length >= 3) found = { title: brief.main.title, sentences, url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(brief.main.title.replaceAll(" ", "_")) };
    }
  } catch (e) { console.warn("local research failed", e); }
  if (!found && opts.offline) throw new Error(`"${topic}" isn't in the on-phone library. Try a broader topic, or turn off Offline mode.`);
  if (!found) { say(`Researching "${topic}" on Wikipedia…`, 0.1); found = await research.wikipediaTopic(topic); }
  if (!found) throw new Error(`Couldn't find "${topic}" on Wikipedia. Try different words.`);
  return buildCustom(found, { niche: opts.niche, cta: opts.cta, generic });
}

// Step 2: voice, music and video, all on the device.
// opts: { brand, accent, music, voiceSpeed, forceEncoder }   ui: { say, canvas, audioCtx }
export async function produceReel(plan, opts, ui) {
  const { script } = plan;
  setLength(opts.length);
  if (plan.edited) script.extras = [];      // you approved these exact lines: don't add any
  const stage = (lo, hi) => (text, f = 0) => ui.say(text, lo + (hi - lo) * Math.min(1, Math.max(0, f)));

  const say = stage(0, 0.25);
  say("Getting the voice ready (one-time download, about 90 MB)…");
  await Promise.all([loadVoice((f) => say("Getting the voice ready (one-time download, about 90 MB)…", f)), loadFonts()]);

  const clips = await voiceScript(script, stage(0.25, 0.55), opts.voiceSpeed || 1.0);
  const { words, spans } = timings(script, clips);
  const { audio, total } = assembleAudio(clips, opts.music, script.lines);

  ui.say("Preparing scenes…", 0.56);
  const scenes = [], credits = [];
  for (let i = 0; i < script.lines.length; i++) {
    const line = script.lines[i];
    const sc = { start: i === 0 ? 0 : spans[i][0] - GAP / 2, end: i === script.lines.length - 1 ? total : spans[i + 1][0] - GAP / 2, kind: "fallback",
      label: (i === 0 ? script.title : line.query || script.title).replace(/\s*#Shorts$/, ""), seed: i };
    if (opts.showSources !== false && line.source) sc.source = line.source;
    if (line.kind === "outro") sc.kind = "outro";
    else if (line.kind === "chart" && line.chart) { sc.kind = "chart"; sc.chart = line.chart; }
    else if (line.kind === "section") { sc.kind = "section"; sc.num = line.num; sc.label = line.label; }
    else if (line.kind === "recap") { sc.kind = "recap"; sc.items = line.items; }
    else {
      line.asset = await line.asset;
      const v = decideVisual(line, i, script.title);
      if (v.type === "photo") {
        sc.kind = "image"; sc.bitmap = line.asset.bitmap; sc.relevant = line.asset.relevant !== false;
        if (line.asset.credit && !credits.includes(line.asset.credit)) credits.push(line.asset.credit);
      } else if (v.type === "stat") { sc.kind = "stat"; sc.spec = v.spec; }
      else { sc.kind = "illus"; sc.icon = v.icon; sc.label = v.label; }
      if (opts.pops !== false && i > 0) sc.stat = statFor(line.text);   // big callout for the key number
    }
    scenes.push(sc);
  }

  if (opts.sfx !== false) addSoundEffects(audio, scenes);
  const job = { title: script.title, brand: opts.brand, accent: opts.accent || "#FFD60A", scenes, words, audio,
    captionStyle: opts.captionStyle || "bold", captionPos: opts.captionPos || "low", handle: opts.handle || "" };
  const result = await renderReel(job, ui.canvas, ui.audioCtx, (f) => ui.say("Rendering your reel on this device…", 0.6 + 0.4 * f), opts.forceEncoder);
  ui.say("Making the cover and captions…", 0.99);
  const accentRgb = (() => { const n = parseInt((opts.accent || "#FFD60A").slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; })();
  const cover = await makeCover({ title: script.title, brand: opts.brand, accent: accentRgb, handle: opts.handle || "", scenes },
    (ctx, list) => coverBackground(ctx, list, accentRgb)).catch((e) => { console.warn("cover", e); return null; });
  releasePlan(plan);

  remember(script);
  const meta = buildMetadata(script, credits);
  return {
    id: `${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}-${script.topicId}`,
    ...meta, kind: script.kind, duration: total, created: Date.now(), blob: result.blob, ext: result.ext, how: result.how, sound: result.sound, written: result.written, niche: script.niche,
    credits, sources: script.sources, handle: opts.handle || "", srt: makeSrt(words), cover,
    script: script.lines.map((l) => l.text).join("\n"),
  };
}

// The cover's picture: the reel's first photo, else its first chart or illustration.
function coverBackground(ctx, scenes, accent) {
  // Only a photo that fits the topic makes the cover; otherwise the reel's chart or illustration does.
  const photo = scenes.find((s) => s.kind === "image" && s.bitmap && s.relevant);
  if (photo) {
    const b = photo.bitmap, sc = Math.max(1080 / b.width, 1920 / b.height), w = 1080 / sc, h = 1920 / sc;
    ctx.drawImage(b, (b.width - w) / 2, (b.height - h) * 0.4, w, h, 0, 0, 1080, 1920);
    return;
  }
  const gen = scenes.find((s) => s.kind === "stat" || s.kind === "illus");
  const bg = gen?.kind === "stat" ? new StatBg(gen.spec, accent, "middle") : new IllusBg(gen?.icon || "coins", null, accent, "middle");
  bg.draw(ctx, 0.95); bg.dispose();
}

// Which visual a scene uses. mode: "auto" (default), "photo", "chart" or "illus".
//   auto: a spoken number -> its chart; a photo of what the line itself names -> the photo;
//         otherwise an illustration of the line's concept (rather than a loosely related stock photo).
export function decideVisual(line, i, topicTitle = "") {
  if (line.kind !== "media") return { type: line.kind };
  const an = line.analysis ??= analyzeLine(line.text);
  const icon = an.icon || iconFor(topicTitle)?.icon || "coins";
  const label = an.icon ? an.label : iconFor(topicTitle)?.label || null;
  const photo = line.asset?.bitmap ? "photo" : null;
  // A photo "matches" when its own title shares a word with what we searched for (or you chose it).
  const qWords = (line.query || "").toLowerCase().match(/[a-z]{4,}/g) || [];
  const tWords = (line.asset?.title || "").toLowerCase();
  const matches = Boolean(photo) && (!line.asset.credit || (line.asset.relevant ?? qWords.some((w) => tWords.includes(w.replace(/s$/, "")))));
  const mode = line.vmode || "auto";
  if (mode === "chart" && an.stat) return { type: "stat", spec: an.stat };
  if (mode === "illus") return { type: "illus", icon, label };
  if (mode === "photo") return photo ? { type: "photo" } : { type: "illus", icon, label };
  if (an.stat && i > 0) return { type: "stat", spec: an.stat };
  if (photo && matches && (line.concrete || i === 0)) return { type: "photo" };
  if (an.icon) return { type: "illus", icon, label };
  if (photo && matches) return { type: "photo" };
  if (an.stat) return { type: "stat", spec: an.stat };
  return { type: "illus", icon, label };
}

// Free the decoded photos (they hold a lot of memory on a phone).
export function releasePlan(plan) {
  for (const l of [...plan.script.lines, ...plan.script.extras]) {
    Promise.resolve(l.asset).then((a) => a?.bitmap?.close?.()).catch(() => {});
  }
}

/* ---------- drafts: save a reviewed script and finish it later ---------- */
// Photos are found again when a draft is opened (your own photos aren't kept, to save space).
export function draftFromPlan(plan, label) {
  const strip = (l) => ({ text: l.text, visual: l.visual, query: l.query, kind: l.kind, chart: l.chart || null, vmode: l.vmode, concrete: l.concrete,
    source: l.source, hold: l.hold, items: l.items, num: l.num, label: l.label, section: l.section, tip: l.tip,
    check: l.check ? { status: l.check.status, kind: l.check.kind, sources: l.check.sources, live: l.check.live,
      evidence: (l.check.evidence || []).slice(0, 2).map((e) => ({ text: e.text, source: e.source, section: e.section })) } : undefined,
    mine: l.asset && !l.asset.credit ? true : undefined });
  const { script } = plan;
  return {
    id: "draft-" + Date.now(), saved: Date.now(), label: label || script.title, edited: plan.edited, generic: plan.generic,
    script: { ...script, lines: script.lines.map(strip), extras: script.extras.map(strip) },
  };
}
export async function planFromDraft(draft, ui) {
  const finder = new MediaFinder(draft.generic);
  const script = { ...draft.script, lines: draft.script.lines.map((l) => ({ ...l })), extras: draft.script.extras.map((l) => ({ ...l })) };
  const shown = script.lines.filter((l) => l.kind === "media");
  let got = 0;
  await Promise.all(shown.map(async (l) => { l.asset = await finder.find(l.query || draft.generic[0]).catch(() => null); ui?.say?.("Finding photos again…", ++got / shown.length); }));
  for (const l of script.extras) if (l.kind === "media") l.asset = finder.find(l.query || draft.generic[0]).catch(() => null);
  return { script, finder, generic: draft.generic, edited: draft.edited };
}
