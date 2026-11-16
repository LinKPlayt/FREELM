# Idea Lab: on-device research and AI

Everything in this folder runs on the phone. At run time the Idea Lab reads only these files,
from this app, and the service worker keeps them on the phone after the first download, so it
then works with no internet at all. No API, no account, no other app.

| Part | What it is | Size | License |
|---|---|---|---|
| `data/library.json` | Research library: opening sections of finance, business and economics articles from Wikipedia, collected by `scripts/build_corpus.py` | see file | Text: CC BY-SA 4.0 (Wikipedia). Each article keeps its title, which links to its source page |
| `data/library.vec` | Meaning vectors for every article, computed by `scripts/embed_library.py` | ~2 MB | Derived from the above |
| `models/all-MiniLM-L6-v2` | Semantic search model (understands what a question means) | 23 MB | Apache-2.0 ([sentence-transformers](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)) |
| `models/SmolLM2-135M-Instruct` | Small language model that rewrites idea titles. Optional, downloaded only when you tap Download | 270 MB | Apache-2.0 ([Hugging Face SmolLM2](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct)) |
| `vendor/transformers.min.js` | Transformers.js 4.3.1, runs the models in the browser | 0.6 MB | Apache-2.0 |
| `vendor/ort-wasm-simd-threaded.*` | ONNX Runtime Web (WebAssembly) | 14 MB | MIT |

## How the models were prepared

- **SmolLM2-135M-Instruct:** the original full-precision ONNX export, with every weight stored in
  half precision plus a conversion step that restores full precision when the model loads. That
  halves the download while keeping the browser's fast full-precision math (4-bit weights were
  about 15x slower in the browser's CPU runtime). The weights are split into files under 100 MB
  for GitHub Pages with `scripts/split_onnx.py`.
- **all-MiniLM-L6-v2:** the standard 8-bit quantized ONNX export, unchanged.

## What the AI does, and doesn't do

Facts in ideas and scripts always come from the library, with their sources. The language model
only rephrases titles, and a rewrite is used only if every meaningful word in it comes from the
research, the topic or the original title, it adds no numbers, and it doesn't copy its examples.
Otherwise the original title stays. Small models make things up; these checks keep that out of
your videos.
