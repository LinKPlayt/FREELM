// Natural-sounding voice: Kokoro-82M (Apache-2.0, by hexgrad), a StyleTTS 2 model, run on the phone
// with Transformers.js and ONNX Runtime (WebAssembly), in a worker (voice-worker.js). It receives
// phonemes (made on the page, see kokoro-text.js) and speaks them in the chosen voice at 24 kHz.
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

let model = null, tokenizer = null, loading = null;
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

// phonemes -> Float32Array of 24 kHz samples, in the chosen voice.
export async function kokoroSpeak(phonemes, { voice = "af_heart", speed = 1 } = {}) {
  if (!model) throw new Error("The voice isn't loaded");
  const { input_ids } = tokenizer(phonemes, { truncation: true });
  const n = Math.min(Math.max(input_ids.dims.at(-1) - 2, 0), 509);
  const style = (await styleFor(voice)).slice(256 * n, 256 * n + 256);
  const { waveform } = await model({ input_ids, style: new Tensor("float32", style, [1, 256]), speed: new Tensor("float32", [speed], [1]) });
  return Float32Array.from(waveform.data);
}
