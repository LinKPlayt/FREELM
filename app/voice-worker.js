// The natural voice (Kokoro-82M, Apache-2.0, by hexgrad), in its own worker. It turns phonemes (made
// on the page, see kokoro-text.js) into 24 kHz speech. It runs on the same compact ONNX Runtime build
// as the classic voice, which works on iPhone; the larger runtime bundled with Transformers.js asked
// for more memory at startup than iPhone Safari allows ("RangeError: Out of memory").
// When the voiceover is done the app ends this worker, which gives all of its memory back.
import * as ort from "./vendor/ort/ort.wasm.min.mjs";

ort.env.wasm.wasmPaths = new URL("./vendor/ort/", import.meta.url).href;
ort.env.wasm.numThreads = 1;
const BASE = new URL("./ai/models/kokoro-82m/", import.meta.url).href;
const MODEL_BYTES = 92_361_116;

let session = null, vocab = null;
const styles = new Map();

async function download(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`couldn't download the voice (${res.status})`);
  const total = Number(res.headers.get("Content-Length")) || MODEL_BYTES;
  const out = new Uint8Array(total);
  let got = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (got + value.length > out.length) throw new Error("the voice download was larger than expected");
    out.set(value, got); got += value.length;
    onProgress(got / total);
  }
  return got === out.length ? out : out.subarray(0, got);
}

async function load(onProgress) {
  if (session) return;
  vocab = (await (await fetch(BASE + "tokenizer.json")).json()).model.vocab;
  let bytes = await download(BASE + "onnx/model_quantized.onnx", onProgress);
  session = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
  bytes = null;
}

async function styleFor(voice) {
  if (!styles.has(voice)) {
    const res = await fetch(BASE + `voices/${voice}.bin`);
    if (!res.ok) throw new Error(`couldn't load the ${voice} voice`);
    styles.set(voice, new Float32Array(await res.arrayBuffer()));
  }
  return styles.get(voice);
}

// Phonemes -> token ids, as Kokoro's tokenizer does: one id per known symbol, 0 at both ends.
function tokenize(phonemes) {
  const ids = [0];
  for (const ch of phonemes) { const id = vocab[ch]; if (id !== undefined) ids.push(id); }
  if (ids.length > 511) ids.length = 511;
  ids.push(0);
  return ids;
}

async function speak(phonemes, voice, speed) {
  const ids = tokenize(phonemes), n = Math.min(Math.max(ids.length - 2, 0), 509);
  const style = (await styleFor(voice)).slice(256 * n, 256 * n + 256);
  const out = await session.run({
    input_ids: new ort.Tensor("int64", BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
    style: new ort.Tensor("float32", style, [1, 256]),
    speed: new ort.Tensor("float32", Float32Array.from([speed]), [1]),
  });
  return Float32Array.from(out.waveform.data);
}

self.onmessage = async ({ data: { id, cmd, args } }) => {
  try {
    if (cmd === "ping") self.postMessage({ id, result: true });
    else if (cmd === "load") { await load((f) => self.postMessage({ id, progress: f })); self.postMessage({ id, result: true }); }
    else if (cmd === "speak") { const audio = await speak(args.phonemes, args.voice, args.speed); self.postMessage({ id, result: audio }, [audio.buffer]); }
  } catch (e) {
    self.postMessage({ id, error: String(e?.message || e) });
  }
};
