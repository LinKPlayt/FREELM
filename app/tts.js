// The narrator. Two voices, both running on the phone, served from this app (no speech service):
//   "natural" (default): Kokoro-82M, a StyleTTS 2 model that sounds close to a real narrator (voice-worker.js)
//   "fast": Piper (VITS), smaller and quicker but more robotic; also the fallback if the natural voice can't load
import { KOKORO_RATE, KOKORO_VOICES } from "./voices.js";
import { kokoroPhonemes } from "./kokoro-text.js";
export { KOKORO_VOICES };
// The natural voice runs in a worker (voice-worker.js); ending it frees its memory.
// Bump WORKER_VERSION whenever voice-worker.js changes.
const WORKER_VERSION = 25;
let worker = null, nextId = 0;
const pending = new Map();
// Every call has a watchdog: if the worker goes quiet (no progress, no answer) for `quiet` ms, the call
// fails instead of hanging, and the app switches to the classic voice.
function call(cmd, args = {}, onProgress, quiet = 90000) {
  if (!worker) {
    // Versioned address: a phone can never keep running an older copy of the worker after an update.
    worker = new Worker(new URL(`./voice-worker.js?v=${WORKER_VERSION}`, import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      const p = pending.get(data.id); if (!p) return;
      if (data.progress != null) return p.onProgress?.(data.progress);
      pending.delete(data.id);
      data.error ? p.reject(new Error(data.error)) : p.resolve(data.result);
    };
    worker.onerror = (e) => { e.preventDefault?.(); for (const p of pending.values()) p.reject(new Error(e.message || "the voice worker couldn't start")); pending.clear(); worker = null; };
    worker.onmessageerror = () => { for (const p of pending.values()) p.reject(new Error("the voice worker sent unreadable data")); pending.clear(); };
  }
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    let timer = null;
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => { pending.delete(id); reject(new Error(`the voice stopped responding (${cmd})`)); }, quiet); };
    pending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); },
      onProgress: (f) => { arm(); onProgress?.(f); },
    });
    arm();
    if (cmd === "load" || cmd === "speak") busyStart();
    const done = () => { if (cmd === "load" || cmd === "speak") busyEnd(); };
    const p = pending.get(id), res = p.resolve, rej = p.reject;
    p.resolve = (v) => { done(); res(v); }; p.reject = (e) => { done(); rej(e); };
    worker.postMessage({ id, cmd, args });
  });
}
function endWorker() {
  worker?.terminate(); worker = null;
  for (const p of pending.values()) p.reject(new Error("The voice was stopped")); pending.clear();
}

// Crash guard. The "busy" flag is up only while the natural voice is loading or speaking. If the app
// closes with it up twice in a row (the phone ran out of memory), the next reel uses the classic voice,
// which needs far less. Leaving the app (switching away, closing it) clears the flag: that isn't a crash.
let inFlight = 0;
function busyStart() { inFlight++; store.set("voiceBusy", "1"); }
function busyEnd() { inFlight = Math.max(0, inFlight - 1); if (!inFlight) store.set("voiceBusy", "0"); }
if (typeof document !== "undefined") {
  const left = () => { if (document.visibilityState === "hidden") store.set("voiceBusy", "0"); };
  document.addEventListener("visibilitychange", left);
  addEventListener("pagehide", () => store.set("voiceBusy", "0"));
}
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
const LEVELS = ["q8", "classic"];
let downgraded = null;
function naturalLevel() {
  // Failures caused by app bugs that are now fixed don't count against this phone: try again.
  if (/larger than expected|Out of memory|no available backend/i.test(store.get("voiceError") || "") && store.get("voiceRetried") !== "v24") {
    store.set("voiceRetried", "v24"); store.set("voiceLevel", "q8"); store.set("voiceError", "");
  }
  // v29: earlier versions could switch to the classic voice by mistake (a background warm-up left the
  // "busy" flag up when you closed the app). Undo that once.
  if (store.get("voiceLevel") === "classic" && !store.get("voiceError") && store.get("voiceRetried") !== "v29") {
    store.set("voiceRetried", "v29"); store.set("voiceLevel", "q8"); store.set("voiceStrikes", "0");
  }
  let level = LEVELS.includes(store.get("voiceLevel")) ? store.get("voiceLevel") : "q8";
  if (store.get("voiceBusy") === "1") {                 // the voice was loading or speaking when the app closed
    store.set("voiceBusy", "0");
    const strikes = Number(store.get("voiceStrikes") || 0) + 1;
    store.set("voiceStrikes", String(strikes));
    if (strikes >= 2) {                                  // twice in a row: most likely the phone ran out of memory
      level = "classic"; store.set("voiceLevel", level); store.set("voiceStrikes", "0");
      downgraded = level;
    }
  }
  return level;
}
// After a crash, a message for the user (once).
export function voiceNotice() {
  const d = downgraded; downgraded = null;
  if (!d) return "";
  return "The app closed twice while the natural voice was working (your phone may have run low on memory), so the classic voice is used for now. Close other apps and tap a natural voice in Style to try again.";
}
// Picking a narrator again resets the fallback.
export function resetVoiceLevel() { store.set("voiceLevel", "q8"); store.set("voiceBusy", "0"); store.set("voiceError", ""); store.set("voiceStrikes", "0"); }
// The natural voice didn't work (error or timeout): use the classic voice from now on, and remember why.
export function naturalFailed(e) {
  endWorker();
  store.set("voiceBusy", "0"); store.set("voiceLevel", "classic"); store.set("voiceError", String(e?.message || e).slice(0, 300));
  engine = "fast";
}
export const lastVoiceError = () => store.get("voiceError") || "";

let engine = "natural", voiceId = "af_heart";
export function setVoice({ engine: e, voice } = {}) {
  if (e && e !== engine) { engine = e; }
  if (voice && KOKORO_VOICES[voice]) voiceId = voice;
}
export const voiceEngine = () => engine;
export const voiceRate = () => (engine === "natural" ? KOKORO_RATE : PIPER_RATE);
export const voiceDownloadMB = () => (engine === "natural" ? 92 : 63);

// Loads the chosen voice. If the natural voice can't load (old phone, low memory), falls back to the fast one.
export async function loadVoice(onProgress) {
  if (engine === "natural") {
    const level = naturalLevel();
    if (level === "classic") engine = "fast";
    else {
      try {
        await call("ping", {}, null, 20000);              // the worker itself starts
        await call("load", { dtype: level }, onProgress, 120000);
        return "natural";
      } catch (e) { console.warn("natural voice unavailable, using the classic voice", e); naturalFailed(e); }
    }
  }
  await loadPiper(onProgress);
  return "fast";
}
export async function releaseVoice() { endWorker(); inFlight = 0; store.set("voiceBusy", "0"); }

export async function phonemize(texts) {
  if (engine === "natural") {
    const lang = KOKORO_VOICES[voiceId]?.lang || "a";
    const out = [];
    for (const t of texts) out.push(await kokoroPhonemes(t, lang, espeakIPA));
    return out;
  }
  return piperPhonemize(texts);
}
export async function synthesize(phonemes, speed = 1.0) {
  if (engine === "natural") {
    const audio = await call("speak", { phonemes, voice: voiceId, speed }, null, 120000);
    store.set("voiceStrikes", "0");                      // it worked: start counting again from zero
    return trimAndNormalize(audio, KOKORO_RATE);
  }
  return piperSynthesize(phonemes, speed);
}

const VENDOR = new URL("./vendor/", import.meta.url).href;
const VOICE = new URL("../assets/voices/en_US-joe-medium.onnx", import.meta.url).href;
// The classic voice's runtime loads the first time the classic voice is used (not at startup).
let ort = null;
async function ortRuntime() {
  if (!ort) {
    ort = await import("./vendor/ort/ort.wasm.min.mjs");
    ort.env.wasm.wasmPaths = VENDOR + "ort/";
    ort.env.wasm.numThreads = 1;
  }
  return ort;
}

let session = null, config = null;
const PIPER_RATE = 22050;

async function fetchWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't download the voice (${res.status})`);
  const total = Number(res.headers.get("Content-Length")) || 63_300_000;
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks = []; let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    onProgress?.(Math.min(1, got / total));
  }
  const out = new Uint8Array(got); let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

let piperLoading = null;
function loadPiper(onProgress) {
  piperLoading ??= loadPiperOnce(onProgress).catch((e) => { piperLoading = null; throw e; });
  return piperLoading;
}
async function loadPiperOnce(onProgress) {
  if (session) return;
  config = await (await fetch(VOICE + ".json")).json();
  const model = await fetchWithProgress(VOICE, onProgress);
  await ortRuntime();
  session = await ort.InferenceSession.create(model, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
}

function loadPhonemizer() {
  if (window.createPiperPhonemize) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = VENDOR + "piper/piper_phonemize.js"; s.onload = resolve; s.onerror = () => reject(new Error("Couldn't load the phonemizer"));
    document.head.appendChild(s);
  });
}

// eSpeak NG (piper-phonemize, WebAssembly), loaded once. Returns, per text, a list per sentence.
let espeakModule = null;
const espeakOut = [];
async function espeak(texts, voice) {
  await loadPhonemizer();
  espeakModule ??= window.createPiperPhonemize({
    print: (line) => { try { espeakOut.push(JSON.parse(line)); } catch { /* not JSON: ignore */ } },
    printErr: () => {},
    locateFile: (f) => VENDOR + "piper/" + f,
  });
  const mod = await espeakModule;
  return texts.map((text) => {
    espeakOut.length = 0;
    mod.callMain(["-l", voice, "--input", JSON.stringify([{ text }]), "--espeak_data", "/espeak-ng-data"]);
    return espeakOut.map((r) => r.phonemes || []);
  });
}
// For the natural voice: IPA strings, sentences joined with a space.
const espeakIPA = async (texts, voice) => (await espeak(texts, voice)).map((sentences) => sentences.map((p) => p.join("")).join(" "));

// text[] -> phoneme[][] (one list per input text), for the classic voice
async function piperPhonemize(texts) {
  return (await espeak(texts, config.espeak.voice)).map((sentences) => sentences.flat());
}

function toIds(phonemes) {
  const map = config.phoneme_id_map;
  const ids = [...map["^"], ...map["_"]];
  for (const p of phonemes) { if (map[p]) ids.push(...map[p], ...map["_"]); }
  ids.push(...map["$"]);
  return ids;
}

// phonemes -> Float32Array of 22.05 kHz mono samples
async function piperSynthesize(phonemes, speed = 1.0) {
  const ids = toIds(phonemes);
  const inf = config.inference || {};
  const feeds = {
    input: new ort.Tensor("int64", BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
    input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor("float32", Float32Array.from([inf.noise_scale ?? 0.667, (inf.length_scale ?? 1) / speed, inf.noise_w ?? 0.8]), [3]),
  };
  const out = await session.run(feeds);
  const audio = out[Object.keys(out)[0]].data;
  return trimAndNormalize(Float32Array.from(audio), PIPER_RATE);
}

function trimAndNormalize(a, rate) {
  let s = 0, e = a.length - 1, peak = 0;
  while (s < e && Math.abs(a[s]) < 0.01) s++;
  while (e > s && Math.abs(a[e]) < 0.01) e--;
  const pad = Math.floor(0.03 * rate);
  const out = a.slice(Math.max(0, s - pad), Math.min(a.length, e + pad));
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] *= 0.89 / peak;
  return out;
}
