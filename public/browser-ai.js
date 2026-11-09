/* In-browser AI: runs open models on this device's GPU via WebGPU (WebLLM).
   Nothing leaves the device; model files are downloaded once and cached. */

// thinks: "toggle" = reasoning can be switched on/off, "always" = always reasons, undefined = none.
export const BROWSER_MODELS = [
  { id: "Qwen3.5-9B-q4f16_1-MLC", label: "Qwen 3.5 9B", note: "Most capable · needs a strong GPU", gb: 6.4, thinks: "toggle" },
  { id: "Qwen3-8B-q4f16_1-MLC", label: "Qwen 3 8B", note: "Great reasoning", gb: 5.7, thinks: "toggle" },
  { id: "Llama-3.1-8B-Instruct-q4f16_1-MLC", label: "Llama 3.1 8B", note: "Well-rounded", gb: 5.0 },
  { id: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC", label: "DeepSeek R1 7B", note: "Step-by-step thinker", gb: 5.1, thinks: "always" },
  { id: "Qwen3.5-4B-q4f16_1-MLC", label: "Qwen 3.5 4B", note: "Recommended · best balance", gb: 3.9, thinks: "toggle", recommended: true },
  { id: "Phi-4-mini-instruct-q4f16_1-MLC", label: "Phi-4 mini", note: "Strong at logic & code", gb: 3.4 },
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", label: "Llama 3.2 3B", note: "Fast on most laptops", gb: 2.3 },
  { id: "Qwen3-1.7B-q4f16_1-MLC", label: "Qwen 3 1.7B", note: "Good for phones & tablets", gb: 2.0, thinks: "toggle" },
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", label: "Llama 3.2 1B", note: "Tiny & very fast", gb: 0.9 },
];

const CONTEXT_CHARS = 9000; // these builds have a 4K-token window; keep history comfortably inside it

let webllm = null;
let engine = null;
let loadedId = null;
let loading = null;
let hasF16 = true;

export async function webgpuStatus() {
  if (!("gpu" in navigator)) return { ok: false, reason: "This browser doesn't support WebGPU. Try a recent Chrome, Edge or Safari." };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { ok: false, reason: "No compatible GPU was found on this device." };
    hasF16 = adapter.features.has("shader-f16");
    return { ok: true, f16: hasF16 };
  } catch {
    return { ok: false, reason: "WebGPU is turned off or unavailable on this device." };
  }
}

// GPUs without 16-bit float shaders get the 32-bit build of the same model.
const resolve = (id) => (hasF16 ? id : id.replace("-q4f16_1-", "-q4f32_1-"));

async function lib() {
  return (webllm ??= await import(new URL("./vendor/web-llm.js", import.meta.url).href));
}

export async function isCached(id) {
  try {
    return await (await lib()).hasModelInCache(resolve(id));
  } catch {
    return false;
  }
}

export async function removeFromCache(id) {
  const l = await lib();
  if (loadedId === id && engine) {
    await engine.unload().catch(() => {});
    loadedId = null;
  }
  await l.deleteModelAllInfoInCache(resolve(id));
}

export const loadedModel = () => loadedId;

/** Load (downloading on first use) a model. onProgress({ progress: 0..1, text }). */
export async function load(id, onProgress = () => {}) {
  if (loadedId === id && engine) return engine;
  if (loading) await loading.catch(() => {});
  if (loadedId === id && engine) return engine;
  const l = await lib();
  loading = (async () => {
    const report = (r) => onProgress({ progress: r.progress ?? 0, text: r.text || "" });
    if (!engine) {
      const worker = new Worker(new URL("./llm-worker.js", import.meta.url), { type: "module" });
      engine = await l.CreateWebWorkerMLCEngine(worker, resolve(id), { initProgressCallback: report });
    } else {
      engine.setInitProgressCallback(report);
      await engine.reload(resolve(id));
    }
    loadedId = id;
    return engine;
  })();
  try {
    return await loading;
  } catch (err) {
    loadedId = null;
    throw err;
  } finally {
    loading = null;
  }
}

function fitHistory(messages) {
  // Always keep the newest message; add older ones while they fit.
  const kept = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const len = messages[i].content.length;
    if (kept.length && used + len > CONTEXT_CHARS) break;
    kept.unshift(messages[i]);
    used += len;
  }
  while (kept.length && kept[0].role !== "user") kept.shift();
  return kept;
}

/**
 * Stream a reply. Calls onThinking / onText with deltas.
 * Returns { text, thinking, usage, stopReason }.
 */
export async function chat({ id, system, messages, effort, signal, onThinking, onText }) {
  const model = BROWSER_MODELS.find((m) => m.id === id);
  const eng = await load(id);
  const request = {
    messages: [{ role: "system", content: system }, ...fitHistory(messages)],
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: 2048,
  };
  if (model?.thinks === "toggle") request.extra_body = { enable_thinking: effort !== "low" };

  const onAbort = () => eng.interruptGenerate();
  signal?.addEventListener("abort", onAbort);

  // Split <think>…</think> sections out of the stream as they arrive.
  let raw = "";
  let text = "";
  let thinking = "";
  let usage = null;
  let stopReason = "end_turn";
  const emit = () => {
    const open = raw.indexOf("<think>");
    let t = "";
    let a = raw;
    if (open !== -1) {
      const close = raw.indexOf("</think>", open);
      t = close === -1 ? raw.slice(open + 7) : raw.slice(open + 7, close);
      a = raw.slice(0, open) + (close === -1 ? "" : raw.slice(close + 8));
    }
    t = t.trim();
    a = a.replace(/^\s+/, "");
    if (t.length > thinking.length) onThinking?.(t.slice(thinking.length));
    if (a.length > text.length) onText?.(a.slice(text.length));
    thinking = t.length > thinking.length ? t : thinking;
    text = a.length > text.length ? a : text;
  };

  try {
    const stream = await eng.chat.completions.create(request);
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        raw += delta;
        emit();
      }
      const finish = chunk.choices?.[0]?.finish_reason;
      if (finish === "length") stopReason = "max_tokens";
      if (finish === "abort") stopReason = "aborted";
      if (chunk.usage) usage = chunk.usage;
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
  if (signal?.aborted) {
    const e = new Error("Stopped");
    e.name = "AbortError";
    e.partial = text;
    throw e;
  }
  return {
    text,
    thinking,
    stopReason,
    usage,
    tokensPerSecond: usage?.extra?.decode_tokens_per_s ? Math.round(usage.extra.decode_tokens_per_s) : null,
  };
}
