// The whole pipeline, on the phone: research -> script -> voice -> photos -> music -> render.
import * as research from "./research.js";
import { buildEvergreen, buildNews, buildMarket, buildMetadata, speakable } from "./script.js";
import { MediaFinder } from "./media.js";
import { loadVoice, phonemize, synthesize, VOICE_RATE } from "./tts.js";
import { generateMusic, mix, resample, SR } from "./music.js";
import { loadFonts, renderReel } from "./render.js";

const GAP = 0.28, TAIL = 0.8, MIN_S = 30, MAX_S = 45;
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
  let order = [opts.topicId ? "evergreen" : opts.mode];
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
  return buildEvergreen(topic, o, topic.wiki ? await research.wikipediaDefinition(topic.wiki) : "");
}

const seconds = (clips) => clips.reduce((n, c) => n + c.length, 0) / VOICE_RATE + GAP * (clips.length - 1) + TAIL;

async function voiceScript(script, say) {
  const all = [...script.lines, ...script.extras];
  const phon = await phonemize(all.map((l) => speakable(l.text)));
  all.forEach((l, i) => { l.phonemes = phon[i]; });
  let speed = 1.0;
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
  while (seconds(clips) < MIN_S && script.extras.length) {          // too short: add researched extras
    const extra = script.extras.shift();
    script.lines.splice(script.lines.length - 1, 0, extra);
    clips.splice(clips.length - 1, 0, await synthesize(extra.phonemes, speed));
  }
  if (seconds(clips) > MAX_S) {                                     // too long: speak a little faster
    speed = Math.min(1.18, Math.ceil((seconds(clips) / MAX_S) * 50) / 50 + 0.02);
    clips = await speak(script.lines);
  }
  while (seconds(clips) > MAX_S && script.lines.length > 4) {       // still too long: drop the longest middle line
    let drop = 1;
    for (let i = 1; i < script.lines.length - 1; i++) if (script.lines[i].kind !== "chart" && clips[i].length > clips[drop].length) drop = i;
    script.lines.splice(drop, 1); clips.splice(drop, 1);
  }
  if (seconds(clips) < MIN_S) { speed = 0.92; clips = await speak(script.lines); }
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
    t += dur + GAP;
  });
  return { words, spans };
}

function assembleAudio(clips, withMusic) {
  const total = Math.max(seconds(clips), MIN_S), voice = new Float32Array(Math.ceil(total * SR));
  let off = 0;
  for (const c of clips) { const r = resample(c, VOICE_RATE); voice.set(r.subarray(0, Math.max(0, voice.length - off)), off); off += r.length + Math.round(GAP * SR); }
  // Gentle compression so the voice is loud and even on phone speakers.
  const drive = 2.0, norm = Math.tanh(drive);
  for (let i = 0; i < voice.length; i++) voice[i] = Math.tanh(voice[i] * drive) / norm;
  return { audio: mix(voice, withMusic ? generateMusic(total) : null, 0.14), total };
}

// opts: { niche, mode, topicId, brand, cta, music, repo }   ui: { say(text, fraction), canvas, audioCtx }
export async function makeReel(opts, ui) {
  const data = await appData();
  const stage = (lo, hi) => (text, f = 0) => ui.say(text, lo + (hi - lo) * Math.min(1, Math.max(0, f)));

  const script = await writeScript(opts, data, stage(0.02, 0.06));

  // Start finding photos now; they download while the voice is being made.
  const generic = data.generic_visuals[opts.niche] || data.generic_visuals["personal finance"];
  const finder = new MediaFinder(generic), usedQueries = new Set();
  for (const line of [...script.lines, ...script.extras]) {
    if (line.kind !== "media") continue;
    let q = line.visual || generic[0];
    if (usedQueries.has(q)) q = generic.find((g) => !usedQueries.has(g)) || q;   // avoid repeating the same subject
    usedQueries.add(q);
    line.asset = finder.find(q).catch(() => null);
  }

  const say = stage(0.06, 0.3);
  say("Getting the voice ready (one-time download, about 90 MB)…");
  await Promise.all([loadVoice((f) => say("Getting the voice ready (one-time download, about 90 MB)…", f)), loadFonts()]);

  const clips = await voiceScript(script, stage(0.3, 0.55));
  const { words, spans } = timings(script, clips);
  const { audio, total } = assembleAudio(clips, opts.music);

  ui.say("Finding free photos…", 0.56);
  const scenes = [], credits = [];
  for (let i = 0; i < script.lines.length; i++) {
    const line = script.lines[i];
    const sc = { start: i === 0 ? 0 : spans[i][0] - GAP / 2, end: i === script.lines.length - 1 ? total : spans[i + 1][0] - GAP / 2, kind: "fallback" };
    if (line.kind === "outro") sc.kind = "outro";
    else if (line.kind === "chart" && line.chart) { sc.kind = "chart"; sc.chart = line.chart; }
    else {
      const asset = await line.asset;
      if (asset) { sc.kind = "image"; sc.bitmap = asset.bitmap; if (!credits.includes(asset.credit)) credits.push(asset.credit); }
    }
    scenes.push(sc);
  }

  const job = { title: script.title, brand: opts.brand, accent: "#FFD60A", scenes, words, audio };
  const result = await renderReel(job, ui.canvas, ui.audioCtx, (f) => ui.say("Rendering your reel on this device…", 0.6 + 0.4 * f), opts.forceEncoder);
  for (const sc of scenes) sc.bitmap?.close?.();

  remember(script);
  const meta = buildMetadata(script, credits);
  return {
    id: `${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}-${script.topicId}`,
    ...meta, kind: script.kind, duration: total, created: Date.now(), blob: result.blob, ext: result.ext, how: result.how,
    script: script.lines.map((l) => l.text).join("\n"),
  };
}
