// Runs the Idea Lab's language model in its own worker. Removing or unloading it ends the worker,
// which gives all of its memory back to the phone.
import { env, pipeline } from "./vendor/transformers.min.js";

const BASE = new URL("./", import.meta.url).href;
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = new URL("models/", BASE).pathname;
env.useBrowserCache = false;
env.backends.onnx.wasm.wasmPaths = { mjs: BASE + "vendor/ort-wasm-simd-threaded.mjs", wasm: BASE + "vendor/ort-wasm-simd-threaded.wasm" };
env.backends.onnx.wasm.numThreads = 1;

let generator = null;
self.onmessage = async ({ data: { id, cmd, args } }) => {
  try {
    if (cmd === "load") {
      if (!generator) {
        const files = new Map();
        const g = await pipeline("text-generation", args.model, {
          device: "wasm", dtype: "q8",
          progress_callback: (p) => {
            if (p.status === "progress" && p.total) {
              files.set(p.file, p.loaded);
              let got = 0; for (const l of files.values()) got += l;
              self.postMessage({ id, progress: Math.min(1, got / (args.mb * 1e6)) });
            }
          },
        });
        await g("Hi", { max_new_tokens: 1, do_sample: false });   // warm-up: proves it runs here
        generator = g;
      }
      self.postMessage({ id, result: true });
    } else if (cmd === "generate") {
      const out = await generator(args.prompt, args.options);
      self.postMessage({ id, result: String(out[0].generated_text) });
    }
  } catch (e) {
    self.postMessage({ id, error: String(e?.message || e) });
  }
};
