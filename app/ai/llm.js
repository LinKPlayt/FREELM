// The in-app AI: SmolLM2-135M-Instruct (Apache-2.0) running inside the browser, on the phone's CPU.
//
// Zero outside connections: the model, tokenizer and runtime are files of this app (app/ai/…),
// remote model loading is switched off, and the service worker keeps them on the phone after the
// first download, so it then works fully offline.
//
// It runs in a worker (llm-worker.js) with 8-bit weights: a 137 MB download that needs about a
// quarter of the memory of the full-precision model (which used ~1.4 GB and could crash an iPhone).
export const MODEL = "SmolLM2-135M-Instruct";
export const MODEL_MB = 137;

const WORKER_VERSION = 25;          // bump when llm-worker.js or joined-fetch.js changes
let worker = null, ready = false, loading = null, nextId = 0;
const pending = new Map();
function call(cmd, args = {}, onProgress) {
  if (!worker) {
    worker = new Worker(new URL(`./llm-worker.js?v=${WORKER_VERSION}`, import.meta.url), { type: "module" });   // versioned: never an old copy
    worker.onmessage = ({ data }) => {
      const p = pending.get(data.id); if (!p) return;
      if (data.progress != null) return p.onProgress?.(data.progress);
      pending.delete(data.id);
      data.error ? p.reject(new Error(data.error)) : p.resolve(data.result);
    };
    worker.onerror = (e) => { for (const p of pending.values()) p.reject(new Error(e.message || "The AI stopped")); pending.clear(); worker = null; ready = false; loading = null; };
  }
  return new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject, onProgress }); worker.postMessage({ id, cmd, args }); });
}

export const llmReady = () => ready;

// onProgress(fraction 0..1)
export function loadLLM(onProgress) {
  if (ready) return Promise.resolve(true);
  loading ??= call("load", { model: MODEL, mb: MODEL_MB }, onProgress).then(() => { ready = true; return true; });
  loading.catch(() => { loading = null; unloadLLM(); });
  return loading;
}

const chatPrompt = (system, user, prefill = "") =>
  `<|im_start|>system\n${system}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n${prefill}`;

// Continue a chat whose answer we have already started (prefill), e.g. "1." for a numbered list.
export async function complete(system, user, prefill, { maxTokens = 48, temperature = 0.75 } = {}) {
  await loadLLM();
  const text = await call("generate", { prompt: chatPrompt(system, user, prefill), options: {
    max_new_tokens: maxTokens, do_sample: temperature > 0, temperature: Math.max(0.05, temperature),
    top_p: 0.92, repetition_penalty: 1.15, return_full_text: false,
  } });
  return prefill + text.split("<|im_end|>")[0];
}

// Frees the model's memory: ends the worker (done before rendering a video, and by Remove).
export async function unloadLLM() {
  worker?.terminate(); worker = null; ready = false; loading = null;
  for (const p of pending.values()) p.reject(new Error("The AI was unloaded")); pending.clear();
}
