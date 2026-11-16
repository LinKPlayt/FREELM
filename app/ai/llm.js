// The in-app AI: SmolLM2-135M-Instruct (Apache-2.0) running inside the browser, on the phone's CPU.
//
// Zero outside connections: the model, tokenizer and runtime are files of this app (app/ai/…),
// remote model loading is switched off, and the service worker keeps them on the phone after the
// first download, so it then works fully offline.
//
// The weights are stored in half precision (smaller download) and computed in full precision,
// which is the fast path for the browser's CPU runtime (about 15x faster than 4-bit weights).
import { env, pipeline } from "./vendor/transformers.min.js";

const BASE = new URL("./", import.meta.url).href;
export const MODEL = "SmolLM2-135M-Instruct";
export const MODEL_MB = 270;

env.allowRemoteModels = false;                       // never contact a model hub
env.allowLocalModels = true;
// A site-relative path (not a full URL): Transformers.js 4.3 skips its local-file check for full URLs
// and would then think the tokenizer is missing.
env.localModelPath = new URL("models/", BASE).pathname;
env.useBrowserCache = false;                         // our service worker already caches these files
env.backends.onnx.wasm.wasmPaths = { mjs: BASE + "vendor/ort-wasm-simd-threaded.mjs", wasm: BASE + "vendor/ort-wasm-simd-threaded.wasm" };
// Several CPU cores when the page is cross-origin isolated (the service worker adds the headers that
// GitHub Pages can't), otherwise one.
env.backends.onnx.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
env.backends.onnx.wasm.proxy = false;

let generator = null, loading = null;

export const llmReady = () => Boolean(generator);

// onProgress(fraction 0..1)
export function loadLLM(onProgress) {
  if (generator) return Promise.resolve(generator);
  if (loading) return loading;
  loading = (async () => {
    const files = new Map();
    const progress_callback = (p) => {
      if (p.status === "progress" && p.total) {
        files.set(p.file, p.loaded);
        let got = 0; for (const l of files.values()) got += l;
        onProgress?.(Math.min(1, got / (MODEL_MB * 1e6)));
      }
    };
    const g = await pipeline("text-generation", MODEL, { device: "wasm", dtype: "fp32", progress_callback });
    await g("Hi", { max_new_tokens: 1, do_sample: false });   // warm-up: proves it runs here
    generator = g;
    return g;
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

const chatPrompt = (system, user, prefill = "") =>
  `<|im_start|>system\n${system}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n${prefill}`;

// Continue a chat whose answer we have already started (prefill), e.g. "1." for a numbered list.
export async function complete(system, user, prefill, { maxTokens = 48, temperature = 0.75 } = {}) {
  const g = await loadLLM();
  const out = await g(chatPrompt(system, user, prefill), {
    max_new_tokens: maxTokens, do_sample: temperature > 0, temperature: Math.max(0.05, temperature),
    top_p: 0.92, repetition_penalty: 1.15, return_full_text: false,
  });
  return prefill + String(out[0].generated_text).split("<|im_end|>")[0];
}

// Frees the model's memory (done before rendering a video, which needs memory of its own).
export async function unloadLLM() {
  const g = generator; generator = null; loading = null;
  try { await g?.dispose?.(); } catch { /* already gone */ }
}
