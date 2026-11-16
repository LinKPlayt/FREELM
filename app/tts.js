// The narrator. Two voices, both running on the phone, served from this app (no speech service):
//   "natural" (default): Kokoro-82M, a StyleTTS 2 model that sounds close to a real narrator (kokoro.js)
//   "fast": Piper (VITS), smaller and quicker but more robotic; also the fallback if the natural voice can't load
import * as ort from "./vendor/ort/ort.wasm.min.mjs";
import { KOKORO_RATE, KOKORO_VOICES } from "./voices.js";
export { KOKORO_VOICES };
const kokoro = () => import("./kokoro.js");      // loaded only when a natural voice is used

let engine = "natural", voiceId = "af_heart";
export function setVoice({ engine: e, voice } = {}) {
  if (e && e !== engine) { engine = e; }
  if (voice && KOKORO_VOICES[voice]) voiceId = voice;
}
export const voiceEngine = () => engine;
export const voiceRate = () => (engine === "natural" ? KOKORO_RATE : PIPER_RATE);
export const voiceDownloadMB = () => (engine === "natural" ? 163 : 63);

// Loads the chosen voice. If the natural voice can't load (old phone, low memory), falls back to the fast one.
export async function loadVoice(onProgress) {
  if (engine === "natural") {
    try { await (await kokoro()).loadKokoro(onProgress); return "natural"; }
    catch (e) { console.warn("natural voice unavailable, using the fast voice", e); engine = "fast"; }
  }
  await loadPiper(onProgress);
  return "fast";
}
export async function releaseVoice() { if (engine === "natural") await (await kokoro()).unloadKokoro(); }

export async function phonemize(texts) {
  if (engine === "natural") {
    const lang = KOKORO_VOICES[voiceId]?.lang || "a";
    const out = [];
    const { kokoroPhonemes } = await kokoro();
    for (const t of texts) out.push(await kokoroPhonemes(t, lang));
    return out;
  }
  return piperPhonemize(texts);
}
export async function synthesize(phonemes, speed = 1.0) {
  if (engine === "natural") return trimAndNormalize(await (await kokoro()).kokoroSpeak(phonemes, { voice: voiceId, speed }), KOKORO_RATE);
  return piperSynthesize(phonemes, speed);
}

const VENDOR = new URL("./vendor/", import.meta.url).href;
const VOICE = new URL("../assets/voices/en_US-joe-medium.onnx", import.meta.url).href;
ort.env.wasm.wasmPaths = VENDOR + "ort/";
ort.env.wasm.numThreads = 1;   // this smaller runtime build is single-threaded

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

// text[] -> phoneme[][] (one list per input text), using espeak-ng compiled to WebAssembly
async function piperPhonemize(texts) {
  await loadPhonemizer();
  const results = [];
  const mod = await window.createPiperPhonemize({
    print: (line) => { try { results.push(JSON.parse(line)); } catch { /* not JSON: ignore */ } },
    printErr: () => {},
    locateFile: (f) => VENDOR + "piper/" + f,
  });
  for (const text of texts) {
    const before = results.length;
    mod.callMain(["-l", config.espeak.voice, "--input", JSON.stringify([{ text }]), "--espeak_data", "/espeak-ng-data"]);
    const mine = results.slice(before);
    results.length = before;
    results.push(mine.flatMap((r) => r.phonemes || []));
  }
  return results;
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
