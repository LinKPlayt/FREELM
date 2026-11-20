// Semantic search: understands what a question means, not just which words it uses.
// Model: all-MiniLM-L6-v2 (Apache-2.0, ~23 MB), shipped with the app and run on the phone.
// Library articles were embedded at build time (scripts/embed_library.py); only the query is
// embedded here, which takes a few milliseconds.
import { env, pipeline } from "./vendor/transformers.min.js";

const BASE = new URL("./", import.meta.url).href;
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = new URL("models/", BASE).pathname;
env.useBrowserCache = false;
env.backends.onnx.wasm.wasmPaths = { mjs: BASE + "vendor/ort-wasm-simd-threaded.mjs", wasm: BASE + "vendor/ort-wasm-simd-threaded.wasm" };
// One CPU core: measured, several cores weren't faster for these models in the browser and cost
// hundreds of MB of extra memory (too much for an iPhone).
env.backends.onnx.wasm.numThreads = 1;

let embedder = null, loading = null, loadingModel = null, vectors = null, dim = 384;
const model = () => pipeline("feature-extraction", "all-MiniLM-L6-v2", { device: "wasm", dtype: "q8" });

export async function loadSemantic(lib) {
  if (embedder && vectors) return true;
  if (!lib.vectorsInfo) return false;                      // library built without vectors
  loading ??= (async () => {
    const [ext, buf] = await Promise.all([
      embedder ? Promise.resolve(embedder) : loadingModel || model(),
      fetch(new URL("./data/" + lib.vectorsInfo.file, import.meta.url)).then((r) => { if (!r.ok) throw new Error("vectors missing"); return r.arrayBuffer(); }),
    ]);
    vectors = new Int8Array(buf); dim = lib.vectorsInfo.dim; embedder = ext;
    if (vectors.length !== dim * lib.docs.length) throw new Error("library vectors don't match the library");
  })();
  try { await loading; return true; } catch (e) { console.warn("semantic search unavailable", e); loading = null; return false; }
}

export const semanticReady = () => Boolean(embedder && vectors);

// The model alone, without the library: for judging whether a photo shows what a line is about. Loaded on
// demand (it ships with the app, so no download after the first), and released again afterwards unless
// semantic search is using it: the voice and the video need the memory.
export async function loadEmbedder(timeoutMs = 20000) {
  if (embedder) return true;
  loadingModel ??= model().then((e) => (embedder ??= e));
  try {
    await Promise.race([loadingModel, new Promise((_, no) => setTimeout(() => no(new Error("timed out")), timeoutMs))]);
    return Boolean(embedder);
  } catch (e) { console.warn("meaning model unavailable", e); loadingModel = null; return false; }
}
export async function releaseEmbedder() {
  if (!embedder || vectors || loading) return;             // semantic search is using it
  const e = embedder; embedder = null; loadingModel = null;
  try { await e.dispose?.(); } catch { /* already gone */ }
}

// Cosine similarity of the query with every article. Returns [[docId, similarity]] best first.
export async function semanticSearch(query, k = 30) {
  if (!semanticReady()) return [];
  const out = await embedder(query, { pooling: "mean", normalize: true });
  const q = out.data;                                      // Float32Array(dim)
  const n = vectors.length / dim, scores = new Float32Array(n);
  for (let d = 0; d < n; d++) {
    let s = 0; const o = d * dim;
    for (let j = 0; j < dim; j++) s += q[j] * vectors[o + j];
    scores[d] = s / 127;
  }
  const idx = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a]).slice(0, k);
  return idx.map((i) => [i, scores[i]]);
}

// Embeds sentences (unit vectors), for comparing a script line with source sentences by meaning.
export async function embedTexts(texts) {
  if (!embedder) return null;
  const out = [];
  for (let i = 0; i < texts.length; i += 16) {
    const r = await embedder(texts.slice(i, i + 16), { pooling: "mean", normalize: true });
    const d = r.dims.at(-1);
    for (let k = 0; k < r.dims[0]; k++) out.push(r.data.slice(k * d, (k + 1) * d));
  }
  return out;
}
export const cosine = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
