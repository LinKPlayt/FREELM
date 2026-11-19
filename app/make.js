// The whole pipeline, on the phone: research -> script -> voice -> photos -> music -> render.
import * as research from "./research.js";
import { buildEvergreen, buildNews, buildMarket, buildCustom, buildMetadata, speakable, statFor, visualMatch } from "./script.js";
import { MediaFinder } from "./media.js";
import { loadVoice, phonemize, synthesize, voiceRate, setVoice, releaseVoice, voiceDownloadMB, voiceNotice, voiceEngine, naturalFailed } from "./tts.js";
import { generateMusic, mix, resample, SR } from "./music.js";
import { loadFonts, renderReel, drawMarketCover } from "./render.js";
import { analyzeLine, iconFor } from "./visuals.js";
import { dramatize, directionsOf } from "./hook.js";
import { buildQuiz, QUIZ_COUNT, quizTitle } from "./quiz.js";
import { proofread } from "./wording.js";
import { artFor, motifsFor, pickMotifs, artOptions, drawAhead, styleFor } from "./illustrator.js";
const accentOf = (hex = "#FFD60A") => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
import { deepen, addSoundEffects, makeSrt, makeCover } from "./extras.js";
import { polish, insertIndex } from "./story.js";
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
  const hist = [...history(), ...(opts.exclude || []).map((id) => ({ id, kind: "evergreen" }))], done = new Set(hist.map((h) => h.id));
  const generic = data.generic_visuals[opts.niche] || data.generic_visuals["personal finance"];
  const o = { niche: opts.niche, cta: opts.cta, generic };
  if (opts.mode === "quiz") {
    say("Picking quiz questions…");
    let recent = []; try { recent = JSON.parse(localStorage.getItem("quizUsed") || "[]"); } catch { /* none */ }
    const quiz = buildQuiz(o, { recent, count: QUIZ_COUNT[opts.length] || 2 });
    try { localStorage.setItem("quizUsed", JSON.stringify([...recent, ...quiz.questions].slice(-24))); } catch { /* private mode */ }
    return quiz;
  }
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
const seconds = (clips, lines = []) => clips.reduce((n, c) => n + c.length, 0) / voiceRate()
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
      out.push(await synthesize(lines[i].phonemes, speed * (lines[i].pace || 1)));
      await sleep(0);   // let the screen update between sentences
    }
    return out;
  };
  let clips = await speak(script.lines);
  while (seconds(clips, script.lines) < MIN_S && script.extras.length) {          // too short: add researched extras
    const extra = script.extras.shift();
    const at = insertIndex(script, extra);                             // where it makes sense in the story
    script.lines.splice(at, 0, extra);
    clips.splice(at, 0, await synthesize(extra.phonemes, speed * (extra.pace || 1)));
  }
  const opt = script.lines.findIndex((l) => l.question) > 0 ? script.lines.findIndex((l) => l.question) : script.lines.findIndex((l) => l.optional);
  if (opt > 0 && seconds(clips, script.lines) > MAX_S) { script.lines.splice(opt, 1); clips.splice(opt, 1); }   // too long: the comment question goes first
  if (seconds(clips, script.lines) > MAX_S) {                                     // too long: speak a little faster
    speed = Math.min(base * 1.18, base * (Math.ceil((seconds(clips, script.lines) / MAX_S) * 50) / 50 + 0.02));
    clips = await speak(script.lines);
  }
  // A quiz that's still too long loses its last question (and answer), renumbered, and the lines that count
  // the questions are said again with the new number.
  while (seconds(clips, script.lines) > MAX_S && script.kind === "quiz") {
    const qs = script.lines.map((l, i) => (l.kind === "quiz" ? i : -1)).filter((i) => i >= 0);
    if (qs.length <= 2) break;
    const last = qs.at(-1), n = script.lines[last + 1]?.kind === "answer" ? 2 : 1;
    script.lines.splice(last, n); clips.splice(last, n);
    const of = qs.length - 1;
    script.lines.forEach((l) => { if (l.quiz) l.quiz.of = of; });
    script.title = script.title.replace(/: Can You Get (?:All \d+|Both Right)\?$/, (m) => quizTitle("", of).replace(/^ Quiz/, ""));
    for (let i = 0; i < script.lines.length; i++) {
      const l = script.lines[i], fixed = l.text.replace(/\b\d+ questions\b/, `${of} questions`).replace(/\bout of \d+\b/, `out of ${of}`);
      if (fixed === l.text) continue;
      l.text = fixed; [l.phonemes] = await phonemize([speakable(fixed)]); clips[i] = await synthesize(l.phonemes, speed * (l.pace || 1));
    }
  }
  while (seconds(clips, script.lines) > MAX_S && script.lines.length > 4) {       // still too long: drop a middle line
    // The story's skeleton stays: never the hook, the line right after it (what the topic is), or the
    // closing thought. Among the rest, the longest goes.
    // The comment question goes first: it's nice to have, not part of the story.
    const q = script.lines.findIndex((l) => l.question), optional = q > 0 ? q : script.lines.findIndex((l) => l.optional);
    if (optional > 0) { script.lines.splice(optional, 1); clips.splice(optional, 1); continue; }
    const content = script.lines.map((l, i) => (l.kind === "media" && !l.question ? i : -1)).filter((i) => i >= 0);
    const lastContent = content.at(-1);
    let pool = content.filter((i) => i > 1 && i !== lastContent && !script.lines[i].tip);
    if (!pool.length) pool = content.filter((i) => i > 0 && i !== lastContent);
    if (!pool.length) break;
    const drop = pool.reduce((a, b) => (clips[b].length > clips[a].length ? b : a));
    script.lines.splice(drop, 1); clips.splice(drop, 1);
  }
  if (seconds(clips, script.lines) < MIN_S && speed > base * 0.92) { speed = base * 0.92; clips = await speak(script.lines); }
  clips.speed = speed;                 // the speed it was really spoken at (for learning the narrator's pace)
  return clips;
}

// Silent gaps inside a clip (where the narrator pauses), as [start, end] in seconds.
function pausesIn(clip, rate) {
  const hop = Math.round(rate * 0.01), frames = [];
  let peak = 0;
  for (let i = 0; i + hop <= clip.length; i += hop) {
    let e = 0; for (let j = i; j < i + hop; j++) e += clip[j] * clip[j];
    const rms = Math.sqrt(e / hop); frames.push(rms); peak = Math.max(peak, rms);
  }
  const quiet = peak * 0.06, out = [];
  let start = -1;
  frames.forEach((v, k) => {
    if (v < quiet) { if (start < 0) start = k; }
    else if (start >= 0) { if (k - start >= 9 && start > 5) out.push([start / 100, k / 100]); start = -1; }   // ≥ 90 ms, not the lead-in
  });
  return out;
}

// Word timings for the captions. Each line is split into phrases at its punctuation, and each phrase
// is lined up with a real pause in the recorded voice (the narrator pauses at commas and full stops),
// so the highlighted word stays with the voice. Within a phrase, words share the time by length.
function timings(script, clips) {
  const words = [], spans = []; let t = 0;
  const rate = voiceRate();
  script.lines.forEach((line, i) => {
    const dur = clips[i].length / rate;
    spans.push([t, t + dur]);
    const tokens = line.text.split(/\s+/).filter(Boolean);
    const weights = tokens.map((tok) => speakable(tok).length + 2.5 + (/[.,!?;:]$/.test(tok) ? 3 : 0));
    // Phrase boundaries: after tokens that end in punctuation (not the last one).
    const cuts = tokens.map((tok, j) => (j < tokens.length - 1 && /[.,!?;:—]["”']?$/.test(tok) ? j : -1)).filter((j) => j >= 0);
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    const start = 0.04, end = Math.max(start + 0.1, dur - 0.04);
    // Where each cut is expected (by word lengths), then snap it to the nearest unused real pause.
    const pauses = pausesIn(clips[i], rate);
    // Each matched pause must come after the previous one (in time), and before the end of the line.
    const bounds = [];
    let lastEnd = start;
    for (const j of cuts) {
      const before = weights.slice(0, j + 1).reduce((a, b) => a + b, 0);
      const expected = start + (end - start) * before / total;
      let best = -1, bestDist = 0.6;                                     // only pauses within 0.6 s of the estimate
      pauses.forEach(([a, b], k) => {
        const mid = (a + b) / 2, d = Math.abs(mid - expected);
        if (d < bestDist && a > lastEnd + 0.1 && b < end - 0.05) { best = k; bestDist = d; }
      });
      if (best >= 0) { bounds.push([j, pauses[best][0], pauses[best][1]]); lastEnd = pauses[best][1]; }
    }
    // Build phrases: [firstToken, lastToken, from, to]
    const phrases = []; let from = 0, at = start;
    for (const b of bounds) { phrases.push([from, b[0], at, b[1]]); from = b[0] + 1; at = b[2]; }
    phrases.push([from, tokens.length - 1, at, Math.max(at, end)]);
    for (const [a, b, s0, s1] of phrases) {
      const w = weights.slice(a, b + 1), sum = w.reduce((x, y) => x + y, 0) || 1;
      let cursor = t + s0;
      for (let j = a; j <= b; j++) { const d = (s1 - s0) * weights[j] / sum; words.push({ text: tokens[j], start: cursor, end: cursor + d }); cursor += d; }
    }
    t += dur + gapAfter(line);
  });
  return { words, spans };
}

// The voice track, finished like a broadcast voiceover. The browser's audio engine does the work
// (offline, faster than real time): high-quality resampling to 48 kHz, a high-pass to remove rumble,
// a small cut in the "boxy" low mids, a presence lift for clarity on phone speakers, gentle
// compression so quiet and loud words sit together, then a limiter. Falls back to plain mixing.
async function masterVoice(clips, lines, total) {
  const rate = voiceRate(), length = Math.ceil(total * SR);
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (OAC) {
    try {
      const ctx = new OAC(1, length, SR);
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 85; hp.Q.value = 0.7;
      const mud = ctx.createBiquadFilter(); mud.type = "peaking"; mud.frequency.value = 280; mud.Q.value = 1.1; mud.gain.value = -2.5;
      const presence = ctx.createBiquadFilter(); presence.type = "peaking"; presence.frequency.value = 3200; presence.Q.value = 0.9; presence.gain.value = 2.5;
      const air = ctx.createBiquadFilter(); air.type = "highshelf"; air.frequency.value = 9000; air.gain.value = 1.5;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -22; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.16;
      const makeup = ctx.createGain(); makeup.gain.value = 1.6;
      hp.connect(mud).connect(presence).connect(air).connect(comp).connect(makeup).connect(ctx.destination);
      let t = 0;
      clips.forEach((c, i) => {
        if (c.length) {
          const buf = ctx.createBuffer(1, c.length, rate); buf.copyToChannel(c, 0);
          const src = ctx.createBufferSource(); src.buffer = buf; src.connect(hp); src.start(t);
        }
        t += c.length / rate + gapAfter(lines[i]);
      });
      const rendered = await ctx.startRendering();
      return limitAndLevel(rendered.getChannelData(0).slice(0));
    } catch (e) { console.warn("voice finishing unavailable", e); }
  }
  const voice = new Float32Array(length);
  let off = 0;
  clips.forEach((c, i) => { const r = resample(c, rate); voice.set(r.subarray(0, Math.max(0, voice.length - off)), off); off += r.length + Math.round(gapAfter(lines[i]) * SR); });
  return limitAndLevel(voice);
}

// Levels speech to a steady loudness (about -16 dB RMS while talking, a typical voiceover level),
// then a smooth peak limiter at -1 dB so nothing clips. No hard saturation: that made the old voice sound harsh.
function limitAndLevel(v) {
  const block = Math.floor(0.05 * SR);
  let sum = 0, count = 0;
  for (let i = 0; i < v.length; i += block) {                       // loudness of the blocks that contain speech
    let e = 0; const end = Math.min(v.length, i + block);
    for (let j = i; j < end; j++) e += v[j] * v[j];
    e /= end - i;
    if (e > 1e-5) { sum += e; count++; }
  }
  const rms = count ? Math.sqrt(sum / count) : 0.1;
  const gain = Math.min(8, 0.158 / Math.max(rms, 1e-4));            // 0.158 ≈ -16 dBFS
  const ceiling = 0.89;                                               // -1 dBFS
  let env = 1;
  const attack = Math.exp(-1 / (0.001 * SR)), release = Math.exp(-1 / (0.08 * SR));
  for (let i = 0; i < v.length; i++) {
    const x = v[i] * gain, a = Math.abs(x);
    const want = a > ceiling ? ceiling / a : 1;
    env = want < env ? attack * env + (1 - attack) * want : release * env + (1 - release) * want;
    v[i] = Math.max(-ceiling, Math.min(ceiling, x * Math.min(env, want <= env ? env : 1)));
  }
  return v;
}

// Your own music (uploaded once, kept on the phone in the app's storage): decoded, looped to the
// video's length, faded in and out, and levelled so it sits under the voice like the built-in music.
export async function userMusic(total) {
  const res = await (await caches.open(USER_CACHE)).match(USER_MUSIC);
  if (!res) return null;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const buf = await new OAC(1, 1, SR).decodeAudioData(await res.arrayBuffer());
  const n = Math.ceil(total * SR), out = new Float32Array(n), chans = [...Array(buf.numberOfChannels).keys()].map((c) => buf.getChannelData(c));
  const len = chans[0].length;
  if (!len) return null;
  for (let i = 0; i < n; i++) { let s = 0; for (const ch of chans) s += ch[i % len]; out[i] = s / chans.length; }
  let peak = 0; for (const s of out) peak = Math.max(peak, Math.abs(s));
  const fadeIn = SR * 0.6, fadeOut = SR * 1.5;
  for (let i = 0; i < n; i++) out[i] = (out[i] / (peak || 1)) * Math.min(1, i / fadeIn, (n - i) / fadeOut);
  return out;
}
export const USER_CACHE = "reelbot-user-v1", USER_MUSIC = "/user/music", USER_PHOTOS = "/user/photos/";

// Photos you choose ("My photo") are kept on the phone, so drafts, autosaved scripts and planned weeks
// bring them back instead of searching again. Stored as a JPEG up to 1600 px on the long side.
export async function saveUserPhoto(file) {
  const src = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(src.width, src.height)), w = Math.round(src.width * k), h = Math.round(src.height * k);
  const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(src, 0, 0, w, h); src.close?.();
  const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.88));
  const bitmap = await createImageBitmap(c); c.width = c.height = 0;
  let path = null;
  try {
    path = `${USER_PHOTOS}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}.jpg`;
    await (await caches.open(USER_CACHE)).put(new URL(path, location.href).href, new Response(blob, { headers: { "content-type": "image/jpeg" } }));
  } catch { path = null; /* no storage: the photo is still used for this video */ }
  return { bitmap, credit: "", title: "Your photo", photoPath: path };
}
export async function loadUserPhoto(path) {
  const res = await (await caches.open(USER_CACHE)).match(new URL(path, location.href).href);
  if (!res) return null;
  return { bitmap: await createImageBitmap(await res.blob()), credit: "", title: "Your photo", photoPath: path, relevant: true };
}
// Removes your saved photos that no draft or autosaved script uses any more.
export async function pruneUserPhotos(keep) {
  try {
    const cache = await caches.open(USER_CACHE), wanted = new Set([...keep].map((p) => new URL(p, location.href).pathname));
    for (const req of await cache.keys()) { const p = new URL(req.url).pathname; if (p.includes(USER_PHOTOS) && !wanted.has(p)) await cache.delete(req); }
  } catch { /* storage unavailable */ }
}

async function assembleAudio(clips, mood, lines, musicVolume = 1, spans = []) {
  const total = Math.max(seconds(clips, lines), MIN_S);
  const voice = await masterVoice(clips, lines, total);
  let music = null, level = mood === "cinematic" ? 0.17 : 0.14;
  if (mood === "mine") { music = await userMusic(total).catch((e) => { console.warn("your music couldn't be read", e); return null; }); level = 0.13; }
  // The beat drops when the first point after the hook begins.
  if (!music && mood && mood !== "none") music = generateMusic(total, mood === "mine" ? "lofi" : mood, { dropAt: spans[1]?.[0] || 0 });
  if (music) shapeMusic(music, lines, spans, total);
  return { audio: mix(voice, music, level * musicVolume), total };
}

// The music follows the story: it drops away for the second before the payoff (silence makes the
// moment land), swells back as it hits, and fades out at the end instead of stopping dead.
function shapeMusic(music, lines, spans, total) {
  const env = (t) => {
    let g = 1;
    lines.forEach((l, i) => {
      if (!l.payoff || !spans[i]) return;
      const at = spans[i][0], d = t - at;
      if (d > -1.0 && d < 0) g = Math.min(g, 1 - 0.8 * Math.min(1, (d + 1.0) / 0.35));      // dip before
      else if (d >= 0 && d < 0.6) g = Math.min(g, 0.2 + 0.8 * (d / 0.6) + 0.15 * Math.sin(Math.PI * d / 0.6));   // swell back
    });
    const left = total - t;
    if (left < 1.5) g *= Math.max(0, left / 1.5);
    return g;
  };
  const step = Math.floor(SR / 100);
  for (let i = 0; i < music.length; i += step) {
    const g = env(i / SR);
    for (let j = i; j < Math.min(music.length, i + step); j++) music[j] *= g;
  }
}

// Auto music: a mood that suits the video. Quizzes get suspense, a big red market day gets cinematic
// strings, a green one gets upbeat, news gets bright, stories about people get cinematic, and
// explainers follow their niche.
export function autoMood(script) {
  if (script.kind === "quiz") return "suspense";
  if (script.kind === "market") {
    const m = /\b(Up|Down) (\d+(?:\.\d+)?)%/.exec(script.title || "");
    return !m ? "calm" : m[1] === "Down" && +m[2] >= 1 ? "cinematic" : m[1] === "Up" && +m[2] >= 1 ? "upbeat" : "lofi";
  }
  if (script.kind === "news") return "bright";
  if (script.person) return "cinematic";
  return { crypto: "upbeat", "side hustles": "upbeat", economy: "calm", "real estate": "calm", investing: "lofi", "personal finance": "lofi" }[script.niche] || "lofi";
}

// Rough spoken length of a script, for the review screen.
export function lengthRange(name) { return LENGTHS[name] || LENGTHS.standard; }
// How fast each narrator really speaks (words a second at normal speed), learned from the videos you make.
const RATE_KEY = (engine) => `speechRate-${engine === "fast" ? "fast" : "natural"}`;
export function learnedRate(engine) { const v = Number(localStorage.getItem(RATE_KEY(engine))); return v > 1.2 && v < 5 ? v : 2.75; }
function learnRate(engine, words, secondsSpoken, speed) {
  if (!(words > 20) || !(secondsSpoken > 5)) return;
  const now = words / secondsSpoken / (speed || 1), old = Number(localStorage.getItem(RATE_KEY(engine)));
  try { localStorage.setItem(RATE_KEY(engine), String(old > 1.2 && old < 5 ? old * 0.6 + now * 0.4 : now)); } catch { /* private mode */ }
}
export function estimateSeconds(lines, speed = 1.0, engine = "natural") {
  const words = lines.reduce((n, l) => n + speakable(l.text).split(/\s+/).filter(Boolean).length, 0);
  return words / (learnedRate(engine) * speed) + lines.slice(0, -1).reduce((n, l) => n + gapAfter(l), 0) + TAIL;
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
  // Quiz questions are written and checked by hand (and some are deliberately false until the answer).
  const fact = script.kind === "quiz" ? null : await checkFacts(script, opts, say);
  polish(script);                    // the storyteller's last pass: no repeats, one definition, in order
  dramatize(script, opts);           // the emotion layer: a hook with a promise, its payoff, pacing, a question
  script.wording = proofread(script);   // the proofreader: grammar, spacing and wording the narrator will say
  return { ...(await attachPhotos(script, generic, opts, say)), fact };
}

// Finds a photo for every scene (skipped in offline mode: scenes then use animated backgrounds).
async function attachPhotos(script, generic, opts, say) {
  const finder = new MediaFinder(opts.offline ? [] : generic), usedQueries = new Set();
  if (opts.offline || opts.noPhotos) finder.find = finder.findImage = async () => null;   // drafts find photos when opened
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
// A series: the topics for parts 2 and 3, from the research on this one (related articles about the
// same subject, never a different meaning of the word, never the same article again).
export async function seriesTopics(script, n = 2) {
  const { deepResearch, offTopic } = await import("./ai/research.js");
  const topic = (script.topicTitle || script.title).replace(/\s*#Shorts$/, "").replace(/\s+\(.*\)$/, "");
  const brief = await deepResearch(topic, { niche: script.niche, depth: 2 });
  if (!brief) return [];
  const seen = new Set([brief.main.title.toLowerCase(), topic.toLowerCase()]);
  const mainText = [...brief.main.sentences, ...(brief.sections || []).flatMap((x) => x.sentences)].join(" ").toLowerCase();
  const out = [];
  for (const d of brief.related) {
    const t = d.title.replace(/\s+\(.*\)$/, "");
    // People (the senator a plan is named after) make a different kind of video: topics only.
    const person = /^[A-Z][a-z]+(?: [A-Z]\.)?(?: [A-Z][a-z'-]+){1,2}$/.test(t) && /\b(?:is|was) an? (?:[A-Z][a-z]+ )*(?:[a-z-]+ )*(?:politician|senator|businessman|businesswoman|economist|investor|banker|lawyer|author|executive|entrepreneur|philanthropist|official|journalist|founder|activist)\b|\(born\b|\b\d{4}\s*[–-]\s*\d{4}\b/.test(d.sentences[0] || "");
    // Companies and organisations aren't topics either ("Index Fund Advisors is an investment firm…").
    const org = /^[^.]{0,120}\b(?:is|was) (?:an?|the|one of the) (?:[\w-]+ ){0,5}(?:company|companies|firm|corporation|banks?|organi[sz]ation|agency|institution|platform|website|startup|business|fund manager|advis[eo]r|non-profit|nonprofit|foundation|group|association|exchange|founder|co-founder|ceo)\b/i.test(d.sentences[0] || "");
    // Related means: shares a word with the topic ("Roth 401(k)"), or the topic's own article names it ("Tether").
    const words = (x) => new Set(x.toLowerCase().match(/[a-z0-9]{3,}/g) || []);
    const shares = [...words(t)].some((w) => words(topic).has(w));
    const named = mainText.includes(t.toLowerCase());
    if (person || org || !(shares || named) || offTopic(d.title) || seen.has(t.toLowerCase()) || /^(List|Lists|History) of\b|\d{4}/.test(t) || t.length > 40) continue;
    seen.add(t.toLowerCase()); out.push(t);
    if (out.length >= n) break;
  }
  return out;
}

export async function planFromIdea(idea, opts, ui) {
  const { scriptFromIdea } = await import("./ai/ideas.js");
  const data = await appData();
  const generic = data.generic_visuals[opts.niche] || data.generic_visuals["personal finance"];
  const script = scriptFromIdea(idea, { niche: opts.niche, cta: opts.cta, generic, visualFor: visualMatch });
  const say = (text, f = 0) => ui.say(text, Math.min(1, Math.max(0, f)));
  if (isDeep(opts.length)) { say("Researching more detail for the deep dive…", 0.1); await deepen(script, { ...opts, depth: opts.depth || 2 }); }
  // Quiz questions are written and checked by hand (and some are deliberately false until the answer).
  const fact = script.kind === "quiz" ? null : await checkFacts(script, opts, say);
  polish(script);                    // the storyteller's last pass: no repeats, one definition, in order
  dramatize(script, opts);           // the emotion layer: a hook with a promise, its payoff, pacing, a question
  script.wording = proofread(script);   // the proofreader: grammar, spacing and wording the narrator will say
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
      online: !opts.offline && depth >= 3, onStep: (t) => say(t, 0.18), extras: script.extras.filter((l) => l.kind === "media"), sourceText: script.sourceText || [] });
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
      // The topic's own article in reading order (opening, then its sections), so each sentence can follow
      // the one before it; then facts from related articles, each credited to its real source, as backup.
      const mainSrc = "Wikipedia · " + brief.main.title;
      const items = [{ text: definition, source: mainSrc }, ...brief.main.sentences.slice(1).map((text) => ({ text, source: mainSrc })),
        ...(brief.sections || []).flatMap((sec) => sec.sentences.map((text) => ({ text, source: `${mainSrc} — ${sec.heading}` }))),
        ...brief.facts.filter((f) => f.source !== brief.main.title).map((f) => ({ text: f.text, source: "Wikipedia · " + f.source + (f.section ? " — " + f.section : ""), other: true }))]
        .filter((x, i, a) => x.text && a.findIndex((y) => y.text === x.text) === i);
      const sentences = [...new Set([definition, ...brief.summary, ...own, ...brief.facts.map((f) => f.text)].filter(Boolean))];
      if (sentences.length >= 3) found = { title: brief.main.title, sentences, items, url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(brief.main.title.replaceAll(" ", "_")) };
    }
  } catch (e) { console.warn("local research failed", e); }
  if (!found && opts.offline) throw new Error(`"${topic}" isn't in the on-phone library. Try a broader topic, or turn off Offline mode.`);
  if (!found) { say(`Researching "${topic}" on Wikipedia…`, 0.1); found = await research.wikipediaTopic(topic); }
  if (!found) throw new Error(`Couldn't find "${topic}" on Wikipedia. Try different words.`);
  return buildCustom(found, { niche: opts.niche, cta: opts.cta, generic });
}

const lastVoiceErrorText = () => { try { const e = localStorage.getItem("voiceError"); return e ? ` (${e})` : ""; } catch { return ""; } };

// Step 2: voice, music and video, all on the device.
// opts: { brand, accent, music, voiceSpeed, forceEncoder }   ui: { say, canvas, audioCtx }
export async function produceReel(plan, opts, ui) {
  const { script } = plan;
  setLength(opts.length);
  if (plan.edited) script.extras = [];      // you approved these exact lines: don't add any
  const stage = (lo, hi) => (text, f = 0) => ui.say(text, lo + (hi - lo) * Math.min(1, Math.max(0, f)));

  const say = stage(0, 0.25);
  // Pacing: a beat after the hook and before the ending, like a human narrator.
  if (script.lines[0] && !script.lines[0].hold) script.lines[0].hold = 0.22;
  const outroAt = script.lines.findIndex((l) => l.kind === "outro");
  if (outroAt > 1 && !script.lines[outroAt - 1].hold) script.lines[outroAt - 1].hold = 0.15;
  proofread(script);                 // last check of every line (including your edits) before it's spoken
  setVoice({ engine: opts.voiceEngine || "natural", voice: opts.voice });
  const msg = () => `Getting the voice ready (one-time download, about ${voiceDownloadMB()} MB; then it's on your phone)…`;
  say(msg());
  const used = (await Promise.all([loadVoice((f) => say(msg(), f)), loadFonts()]))[0];
  const notice = voiceNotice();
  if (notice) ui.toast?.(notice);
  else if (used !== (opts.voiceEngine || "natural")) ui.toast?.(`The natural voice couldn't start on this phone${lastVoiceErrorText()}, so the classic voice is used.`);

  let clips;
  try { clips = await voiceScript(script, stage(0.25, 0.55), opts.voiceSpeed || 1.0); }
  catch (e) {
    if (voiceEngine() !== "natural") throw e;
    // The natural voice failed part-way (error or no response): redo it with the classic voice.
    console.warn("natural voice failed, redoing with the classic voice", e);
    naturalFailed(e);
    ui.toast?.(`The natural voice didn't work on this phone (${e.message || e}), so the classic voice is used.`);
    say("Switching to the classic voice…", 0);
    await loadVoice((f) => say("Getting the classic voice ready…", f));
    clips = await voiceScript(script, stage(0.25, 0.55), opts.voiceSpeed || 1.0);
  }
  await releaseVoice();      // free the voice model's memory before the video is encoded
  learnRate(voiceEngine(), script.lines.reduce((n, l) => n + speakable(l.text).split(/\s+/).filter(Boolean).length, 0),
    clips.reduce((n, c) => n + c.length, 0) / voiceRate(), clips.speed);
  const { words, spans } = timings(script, clips);
  const mood = opts.music === "auto" ? autoMood(script) : opts.music;
  const { audio, total } = await assembleAudio(clips, mood, script.lines, opts.musicVolume ?? 1, spans);

  ui.say("Preparing scenes…", 0.56);
  const scenes = [], credits = [], shown = [];      // shown: main subjects of recent illustrations
  for (let i = 0; i < script.lines.length; i++) {
    const line = script.lines[i];
    const sc = { start: i === 0 ? 0 : spans[i][0] - GAP / 2, end: i === script.lines.length - 1 ? total : spans[i + 1][0] - GAP / 2, kind: "fallback",
      label: (i === 0 ? script.title : line.query || script.title).replace(/\s*#Shorts$/, ""), seed: i };
    if (opts.showSources !== false && line.source) sc.source = line.source;
    if (line.payoff) sc.payoff = true;
    // What the moment is, for its sound and its on-screen label.
    const said = line.text || "";
    sc.chip = line.question ? "YOUR TURN" : line.stance ? "BOTTOM LINE" : /^(But )?here's the catch/i.test(said) ? "THE CATCH"
      : /^Here's that number|^By the numbers/i.test(said) ? "KEY NUMBER" : line.tip || /^So here's what to do/i.test(said) ? "WHAT TO DO" : /^Here's why it matters/i.test(said) ? "WHY IT MATTERS" : "";
    sc.tone = line.question ? "question" : line.stance ? "stance" : sc.chip === "THE CATCH" || line.role === "risk" ? "down" : sc.chip === "WHAT TO DO" ? "tip" : "";
    if (line.kind === "outro") sc.kind = "outro";
    else if (line.board?.length >= 2 && !line.vmode) { sc.kind = "board"; sc.markets = line.board; }   // a market recap opens on the day's board (unless you picked a picture)
    else if (line.kind === "chart" && line.chart) { sc.kind = "chart"; sc.chart = line.chart; }
    else if (line.kind === "section") { sc.kind = "section"; sc.num = line.num; sc.label = line.label; }
    else if (line.kind === "recap") { sc.kind = "recap"; sc.items = line.items; }
    else if (line.kind === "quiz") { sc.kind = "quiz"; sc.num = line.quiz?.n || 1; sc.of = line.quiz?.of || 1; sc.countStart = spans[i][1]; sc.countEnd = sc.end; }
    else if (line.kind === "answer") { const q = scenes.findLast((x) => x.kind === "quiz"); sc.kind = "answer"; sc.answer = line.answer !== false; sc.payoff = true; sc.num = q?.num || 0; sc.of = q?.of || 0; }
    // The big moments (the bottom line, the question for the comments) as big words on screen.
    else if (line.kind === "media" && (line.stance || line.question) && !line.vmode && opts.kinetic !== false) { sc.kind = "kinetic"; sc.chip = ""; }
    else {
      line.asset = await line.asset;
      const v = decideVisual(line, i, script.title);
      if (v.type === "photo") {
        sc.kind = "image"; sc.bitmap = line.asset.bitmap; sc.relevant = line.asset.relevant !== false;
        if (line.asset.credit && !credits.includes(line.asset.credit)) credits.push(line.asset.credit);
      } else if (v.type === "stat") { sc.kind = "stat"; sc.spec = v.spec; }
      else if (opts.artStyle !== "icons") {
        // Drawn for this line (or reused if this idea was drawn before), in the reel's art style.
        try {
          const motifs = pickMotifs(line, script.topicTitle || script.title, shown.slice(-2));
          shown.push(motifs[0]);
          const art = await artFor({ motifs, style: styleFor(opts.artStyle, script.niche), accent: accentOf(opts.accent) }, script.topicTitle || script.title);
          sc.kind = "image"; sc.bitmap = art.bitmap; sc.art = true; sc.relevant = true; sc.hero = motifs[0];
        } catch (e) { console.warn("illustration", e); sc.kind = "illus"; sc.icon = v.icon; sc.label = v.label; }
      }
      else { sc.kind = "illus"; sc.icon = v.icon; sc.label = v.label; }
      if (opts.pops !== false && i > 0) {   // big callout for the key number, red or green when it's a loss or a gain
        sc.stat = statFor(line.text);
        if (sc.stat) sc.statTone = toneOf(line.text, sc.stat);
      }
    }
    scenes.push(sc);
  }

  // The same graphic on two lines in a row (a growth curve the next line keeps talking about) carries on
  // instead of drawing itself again from nothing.
  scenes.forEach((sc, k) => { const prev = scenes[k - 1]; if (sc.kind === "stat" && prev?.kind === "stat" && JSON.stringify(prev.spec) === JSON.stringify(sc.spec)) { sc.continued = true; sc.seed = prev.seed; } });

  // Cuts: a long line doesn't sit on one picture. Halfway through (at a word), it cuts to a second
  // visual of the same idea, the way an editor would. Payoffs and labels stay on the first shot.
  if (opts.cuts !== false && opts.artStyle !== "icons") {
    ui.say("Adding cuts…", 0.58);
    const topic = script.topicTitle || script.title, style = styleFor(opts.artStyle, script.niche), accent = accentOf(opts.accent);
    const out = [];
    for (let k = 0; k < scenes.length; k++) {
      const sc = scenes[k], line = script.lines[k];
      out.push(sc);
      if (sc.kind !== "image" || !line || line.kind !== "media" || sc.end - sc.start < 5.2) continue;
      const mid = (sc.start + sc.end) / 2;
      const at = words.filter((w) => w.start > sc.start + 1.8 && w.start < sc.end - 1.8).sort((a, b) => Math.abs(a.start - mid) - Math.abs(b.start - mid))[0];
      if (!at) continue;
      try {
        // The second shot shows the idea a different way from the first, and from what was just on screen.
        const recent = [...(sc.art ? [sc.hero] : []), ...out.slice(-3).map((x) => x.hero)].filter(Boolean);
        const motifs = pickMotifs({ text: line.text }, topic, recent);
        const art = await artFor({ motifs, style, accent }, topic);
        const cut = { ...sc, hero: motifs[0], start: at.start - 0.04, bitmap: art.bitmap, art: true, payoff: false, chip: "", tone: "", stat: null, seed: (sc.seed || 0) + 100, trans: "whip" };
        sc.end = cut.start; out.push(cut);
      } catch (e) { console.warn("cut", e); }
    }
    scenes.splice(0, scenes.length, ...out);
  }
  if (opts.sfx !== false) addSoundEffects(audio, scenes);
  let logo = null;
  if (opts.logo) { try { logo = await createImageBitmap(await (await fetch(opts.logo)).blob()); } catch { logo = null; } }
  const job = { title: script.title, brand: opts.brand, accent: opts.accent || "#FFD60A", scenes, words, audio,
    captionStyle: opts.captionStyle || "bold", captionPos: opts.captionPos || "low", handle: opts.handle || "", logo, hookTitle: opts.hookTitle !== false, cta: opts.ctaKind || "follow",
    // High quality, except for 2–3 minute stories: their file is built in memory, and iPhones have little to spare.
    quality: opts.quality === "standard" || opts.length === "full" ? "standard" : "high" };
  const result = await renderReel(job, ui.canvas, ui.audioCtx, (f) => ui.say("Rendering your reel on this device…", 0.6 + 0.4 * f), opts.forceEncoder);
  ui.say("Making the cover and captions…", 0.99);
  const accentRgb = (() => { const n = parseInt((opts.accent || "#FFD60A").slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; })();
  // The cover's key number: the title's own figure when it has one (so the two agree), else the first one spoken.
  const titleNum = statFor(script.title, { isTitle: true }), keyLine = titleNum ? null : script.lines.find((l) => l.kind === "media" && statFor(l.text));
  const keyNumber = titleNum || (keyLine ? statFor(keyLine.text) : ""), keyTone = keyNumber ? toneOf(titleNum ? script.title : keyLine.text, keyNumber) : 0;
  const question = script.lines.find((l) => l.kind === "media" && /\?\s*$/.test(l.text) && l.text.split(/\s+/).length <= 12)?.text || "";
  const cover = await makeCover({ title: script.title, brand: opts.brand, accent: accentRgb, handle: opts.handle || "", scenes, style: opts.coverStyle || "bold", keyNumber, keyTone, question },
    (ctx, list, style) => coverBackground(ctx, list, accentRgb, style, script.kind === "market")).catch((e) => { console.warn("cover", e); return null; });
  for (const sc of scenes) if (sc.art) sc.bitmap?.close?.();      // drawn illustrations are saved; free the memory
  releasePlan(plan);

  remember(script);
  const meta = buildMetadata(script, credits);
  return {
    id: `${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}-${script.topicId}`,
    ...meta, kind: script.kind, duration: total, created: Date.now(), blob: result.blob, ext: result.ext, how: result.how, sound: result.sound, written: result.written, niche: script.niche,
    credits, sources: script.sources, handle: opts.handle || "", srt: makeSrt(words), cover,
    topic: (script.topicTitle || "").replace(/\s+\(.*\)$/, ""),
    settings: { voice: opts.voiceEngine === "fast" ? "classic" : opts.voice || "af_heart", cta: opts.ctaKind || "follow", music: mood || "lofi", captions: opts.captionStyle || "bold", length: opts.length || "standard", hook: script.hookKind || "written", art: opts.artStyle || "auto" },
    script: script.lines.map((l) => l.text).join("\n"),
  };
}

// Whether a line's key figure is a loss (-1), a gain (1) or neither (0): in "the Dow fell 1.1%." it's a loss.
export function toneOf(text, stat) {
  const num = (w) => w.replace(/[^\d.]/g, "").replace(/^\.+|\.+$/g, ""), digits = num(stat || "");
  const toks = text.split(/\s+/), at = digits ? toks.findIndex((w) => num(w) === digits) : -1;
  return at >= 0 ? directionsOf(toks)[at] : 0;
}

// The cover's picture: a market recap's chart, else the reel's first photo, else its first chart or illustration.
// Returns { overlay: false } when the picture leaves the title room and needs no darkening.
function coverBackground(ctx, scenes, accent, style = "bold", marketRecap = false) {
  // A market recap: the lead index's month, big, under the title (the same chart and colours as in the reel).
  const market = marketRecap && scenes.find((s) => s.kind === "chart" && s.chart?.values?.length > 2);
  if (market) { drawMarketCover(ctx, market.chart, style === "number" ? 1330 : 1110); return { overlay: false }; }
  // Only a photo that fits the topic makes the cover; otherwise the reel's chart or illustration does.
  // Best first: a tall photo or a drawn illustration (both fill the cover cleanly), then a wide photo.
  const images = scenes.filter((s) => s.kind === "image" && s.bitmap && s.relevant && s.bitmap.width > 0);
  const tall = images.find((s) => s.bitmap.height >= s.bitmap.width * 0.9) || images.find((s) => s.art);
  const photo = tall || images[0];
  if (photo) {
    const b = photo.bitmap;
    const cover = (dw, dh, dx = 0, dy = 0, cy = 0.4) => { const k = Math.max(dw / b.width, dh / b.height), w = dw / k, h = dh / k; ctx.drawImage(b, (b.width - w) / 2, (b.height - h) * cy, w, h, dx, dy, dw, dh); };
    if (b === tall?.bitmap && photo.art) {
      // A drawn illustration: moved down so its main subject sits below the title, not behind it.
      ctx.drawImage(b, 0, 0, b.width, 8, 0, 0, 1080, 300); ctx.drawImage(b, 0, 280, 1080, 1920);
      return;
    }
    if (b === tall?.bitmap) { cover(1080, 1920); return; }
    // A wide photo: a soft, darkened copy fills the cover, and the whole photo sits in the lower half
    // (cropping it to 9:16 cuts off whatever made it a good picture, like text or faces).
    const small = document.createElement("canvas"); small.width = 135; small.height = 240;
    const sx = small.getContext("2d"); const k = Math.max(135 / b.width, 240 / b.height); sx.drawImage(b, (135 - b.width * k) / 2, (240 - b.height * k) / 2, b.width * k, b.height * k);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(small, 0, 0, 1080, 1920);
    ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, 1080, 1920);
    let w = 1000, h = b.height * w / b.width; if (h > 760) { h = 760; w = b.width * h / b.height; }
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 40; ctx.drawImage(b, (1080 - w) / 2, 1300 - h / 2, w, h); ctx.restore();
    small.width = small.height = 0;
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
  plan.undo?.line?.asset?.bitmap?.close?.();
  for (const l of [...plan.script.lines, ...plan.script.extras]) {
    Promise.resolve(l.asset).then((a) => a?.bitmap?.close?.()).catch(() => {});
  }
}

/* ---------- drafts: save a reviewed script and finish it later ---------- */
// Photos are found again when a draft is opened (your own photos aren't kept, to save space).
export function draftFromPlan(plan, label) {
  const strip = (l) => ({ text: l.text, visual: l.visual, query: l.query, kind: l.kind, chart: l.chart || null, vmode: l.vmode, concrete: l.concrete,
    source: l.source, hold: l.hold, items: l.items, board: l.board, num: l.num, label: l.label, section: l.section, tip: l.tip, claim: l.claim, pace: l.pace, payoff: l.payoff, artPick: l.artPick, question: l.question, optional: l.optional, stance: l.stance, quiz: l.quiz, answer: l.answer, role: l.role,
    check: l.check ? { status: l.check.status, kind: l.check.kind, sources: l.check.sources, live: l.check.live,
      evidence: (l.check.evidence || []).slice(0, 2).map((e) => ({ text: e.text, source: e.source, section: e.section })) } : undefined,
    mine: l.asset && !l.asset.credit ? true : undefined, photo: l.asset?.photoPath || undefined });
  const { script } = plan;
  return {
    id: "draft-" + Date.now(), saved: Date.now(), label: label || script.title, edited: plan.edited, generic: plan.generic,
    script: { ...script, lines: script.lines.map(strip), extras: script.extras.map(strip), sourceText: undefined, research: undefined },   // drafts stay small
  };
}
export async function planFromDraft(draft, ui) {
  const finder = new MediaFinder(draft.generic);
  const script = { ...draft.script, lines: draft.script.lines.map((l) => ({ ...l })), extras: draft.script.extras.map((l) => ({ ...l })) };
  const shown = script.lines.filter((l) => l.kind === "media");
  let got = 0;
  // Your own photos come back from the phone; the rest are found again.
  await Promise.all(shown.map(async (l) => {
    l.asset = (l.photo && await loadUserPhoto(l.photo).catch(() => null)) || await finder.find(l.query || draft.generic[0]).catch(() => null);
    ui?.say?.("Finding photos again…", ++got / shown.length);
  }));
  for (const l of script.extras) if (l.kind === "media") l.asset = finder.find(l.query || draft.generic[0]).catch(() => null);
  return { script, finder, generic: draft.generic, edited: draft.edited };
}

// For the automated tests (tests/web): internal helpers, no app behaviour depends on this.
export const _test = { timings, pausesIn, limitAndLevel, gapAfter };

// After a video is made: draw the other ways each of its scenes could be illustrated, and save them,
// so a better picture is ready (and instant) if you remix it or the same idea comes up again.
export async function drawAlternatives(script, opts, limit = 12) {
  const topic = script.topicTitle || script.title, style = styleFor(opts.artStyle, script.niche), accent = accentOf(opts.accent);
  const specs = [];
  for (const l of script.lines) if (l.kind === "media") for (const motifs of artOptions(l.text, topic).slice(0, 3)) specs.push({ motifs, style, accent });
  return drawAhead(specs.slice(0, limit), topic);
}
