// Natural-sounding voice: Kokoro-82M (Apache-2.0, by hexgrad), a StyleTTS 2 model, run on the phone
// with Transformers.js and ONNX Runtime (WebAssembly). Text becomes phonemes with eSpeak NG
// (phonemizer.js), then the model speaks them in the chosen voice at 24 kHz.
// Adapted from kokoro-js (Apache-2.0, hexgrad and Xenova). Every file is served from this app.
import { env, StyleTextToSpeech2Model, AutoTokenizer, Tensor } from "./ai/vendor/transformers.min.js";

const AI = new URL("./ai/", import.meta.url).href;
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = new URL("models/", AI).pathname;
env.useBrowserCache = false;
env.backends.onnx.wasm.wasmPaths = { mjs: AI + "vendor/ort-wasm-simd-threaded.mjs", wasm: AI + "vendor/ort-wasm-simd-threaded.wasm" };
// One CPU core: measured, several cores weren't faster for these models in the browser and cost
// hundreds of MB of extra memory (too much for an iPhone).
env.backends.onnx.wasm.numThreads = 1;

export { KOKORO_RATE, KOKORO_VOICES } from "./voices.js";
export const MODEL_ID = "kokoro-82m";
// 8-bit weights: a 92 MB download that needs about 600 MB of memory while speaking. (Full precision
// measured no faster in the browser and needed over 1 GB, too much for many iPhones.)
export const MODEL_MB = { q8: 92 };

let model = null, tokenizer = null, loading = null, espeak = null;
const styles = new Map();

// Downloads (first time only; then from the phone) and starts the model. onProgress(0..1).
export async function loadKokoro(onProgress, dtype = "q8") {
  if (model) return;
  loading ??= (async () => {
    const files = new Map();
    const progress_callback = (p) => {
      if (p.status === "progress" && p.total) { files.set(p.file, [p.loaded, p.total]); }
      const [got, total] = [...files.values()].reduce(([a, b], [c, d]) => [a + c, b + d], [0, 0]);
      if (total > 1e6) onProgress?.(Math.min(1, got / Math.max(total, (MODEL_MB[dtype] || 92) * 1e6)));
    };
    const [m, t] = await Promise.all([
      StyleTextToSpeech2Model.from_pretrained(MODEL_ID, { dtype, device: "wasm", progress_callback }),
      AutoTokenizer.from_pretrained(MODEL_ID),
    ]);
    espeak ??= (await import("./vendor/phonemizer/phonemizer.js")).phonemize;
    model = m; tokenizer = t;
  })();
  try { await loading; } catch (e) { loading = null; throw e; }
}
export const kokoroReady = () => Boolean(model);

// Frees the model's memory (it's reloaded from the phone, in a few seconds, when needed again).
export async function unloadKokoro() {
  const m = model; model = null; tokenizer = null; loading = null;
  try { await m?.dispose?.(); } catch { /* already gone */ }
}

async function styleFor(voice) {
  if (!styles.has(voice)) {
    const res = await fetch(new URL(`models/${MODEL_ID}/voices/${voice}.bin`, AI));
    if (!res.ok) throw new Error(`Couldn't load the ${voice} voice`);
    styles.set(voice, new Float32Array(await res.arrayBuffer()));
  }
  return styles.get(voice);
}

/* ---------- text -> phonemes (as kokoro-js does it) ---------- */
function splitYear(word) {
  if (word.includes(".")) return word;
  if (word.includes(":")) {
    const [h, m] = word.split(":").map(Number);
    return m === 0 ? `${h} o'clock` : m < 10 ? `${h} oh ${m}` : `${h} ${m}`;
  }
  const year = parseInt(word.slice(0, 4), 10);
  if (year < 1100 || year % 1000 < 10) return word;
  const left = word.slice(0, 2), right = parseInt(word.slice(2, 4), 10), s = word.endsWith("s") ? "s" : "";
  if (year % 1000 >= 100 && year % 1000 <= 999) {
    if (right === 0) return `${left} hundred${s}`;
    if (right < 10) return `${left} oh ${right}${s}`;
  }
  return `${left} ${right}${s}`;
}
function money(m) {
  const unit = m[0] === "$" ? "dollar" : "pound";
  if (isNaN(Number(m.slice(1)))) return `${m.slice(1)} ${unit}s`;
  if (!m.includes(".")) return `${m.slice(1)} ${unit}${m.slice(1) === "1" ? "" : "s"}`;
  const [whole, frac] = m.slice(1).split("."), cents = parseInt(frac.padEnd(2, "0"), 10);
  return `${whole} ${unit}${whole === "1" ? "" : "s"} and ${cents} ${m[0] === "$" ? (cents === 1 ? "cent" : "cents") : cents === 1 ? "penny" : "pence"}`;
}
const decimal = (d) => { const [a, b] = d.split("."); return `${a} point ${b.split("").join(" ")}`; };
function normalize(t) {
  return t.replace(/[‘’]/g, "'").replace(/«/g, "“").replace(/»/g, "”").replace(/[“”]/g, '"').replace(/\(/g, "«").replace(/\)/g, "»")
    .replace(/[^\S \n]/g, " ").replace(/  +/, " ")
    .replace(/\bD[Rr]\.(?= [A-Z])/g, "Doctor").replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, "Mister").replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, "Miss")
    .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, "Mrs").replace(/\betc\.(?! [A-Z])/gi, "etc").replace(/\b(y)eah?\b/gi, "$1e'a")
    .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, splitYear)
    .replace(/(?<=\d),(?=\d)/g, "")
    .replace(/[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi, money)
    .replace(/\d*\.\d+/g, decimal).replace(/(?<=\d)-(?=\d)/g, " to ").replace(/(?<=\d)S/g, " S")
    .replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S").replace(/(?<=X')S\b/g, "s")
    .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (m) => m.replace(/\./g, "-")).replace(/(?<=[A-Z])\.(?=[A-Z])/gi, "-").trim();
}
const PUNCT = /(\s*[;:,.!?¡¿—…"«»“”(){}[\]]+\s*)+/g;
export async function kokoroPhonemes(text, lang = "a") {
  if (!espeak) espeak = (await import("./vendor/phonemizer/phonemizer.js")).phonemize;
  text = normalize(text);
  const parts = []; let last = 0;
  for (const m of text.matchAll(PUNCT)) {
    if (last < m.index) parts.push({ punct: false, text: text.slice(last, m.index) });
    if (m[0].length) parts.push({ punct: true, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ punct: false, text: text.slice(last) });
  const lng = lang === "a" ? "en-us" : "en";
  const out = (await Promise.all(parts.map(async (p) => (p.punct ? p.text : (await espeak(p.text, lng)).join(" "))))).join("");
  let ph = out.replace(/ʲ/g, "j").replace(/r/g, "ɹ").replace(/x/g, "k").replace(/ɬ/g, "l")
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, " ").replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, "z");
  if (lang === "a") ph = ph.replace(/(?<=nˈaɪn)ti(?!ː)/g, "di");
  return ph.trim();
}

// phonemes -> Float32Array of 24 kHz samples, in the chosen voice.
export async function kokoroSpeak(phonemes, { voice = "af_heart", speed = 1 } = {}) {
  if (!model) throw new Error("The voice isn't loaded");
  const { input_ids } = tokenizer(phonemes, { truncation: true });
  const n = Math.min(Math.max(input_ids.dims.at(-1) - 2, 0), 509);
  const style = (await styleFor(voice)).slice(256 * n, 256 * n + 256);
  const { waveform } = await model({ input_ids, style: new Tensor("float32", style, [1, 256]), speed: new Tensor("float32", [speed], [1]) });
  return Float32Array.from(waveform.data);
}
