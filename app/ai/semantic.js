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
// Several CPU cores when the page is cross-origin isolated (the service worker adds the headers that
// GitHub Pages can't), otherwise one.
env.backends.onnx.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;

let embedder = null, loading = null, vectors = null, dim = 384;

export async function loadSemantic(lib) {
  if (embedder && vectors) return true;
  if (!lib.vectorsInfo) return false;                      // library built without vectors
  loading ??= (async () => {
    const [ext, buf] = await Promise.all([
      pipeline("feature-extraction", "all-MiniLM-L6-v2", { device: "wasm", dtype: "q8" }),
      fetch(new URL("./data/" + lib.vectorsInfo.file, import.meta.url)).then((r) => { if (!r.ok) throw new Error("vectors missing"); return r.arrayBuffer(); }),
    ]);
    vectors = new Int8Array(buf); dim = lib.vectorsInfo.dim; embedder = ext;
    if (vectors.length !== dim * lib.docs.length) throw new Error("library vectors don't match the library");
  })();
  try { await loading; return true; } catch (e) { console.warn("semantic search unavailable", e); loading = null; return false; }
}

export const semanticReady = () => Boolean(embedder && vectors);

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
