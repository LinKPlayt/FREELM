# Third-party code bundled with the app

Served from this site so the phone never contacts a third-party code host.

| Folder / file | What | License |
|---|---|---|
| `ort/` | [onnxruntime-web](https://github.com/microsoft/onnxruntime) 1.20.1 (WebAssembly build) | MIT |
| `piper/` | [piper-wasm](https://github.com/diffusion-studio/piper-wasm) 1.0.0: piper-phonemize compiled to WebAssembly. It embeds [espeak-ng](https://github.com/espeak-ng/espeak-ng) and its language data | MIT (wrapper), GPL-3.0-or-later (espeak-ng) |
| `mp4-muxer.mjs` | [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) 5.2.1 | MIT |

espeak-ng is free software under the GNU GPL v3 or later; its source is available at the link above.

The natural voice model (`app/ai/models/kokoro-82m`) is [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)
by hexgrad, Apache-2.0, from the [ONNX export](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX).
It uses the 8-bit weights and runs on the bundled `ort/` runtime (the same one as the classic voice).
`app/kokoro-text.js` is adapted from
[kokoro-js](https://github.com/hexgrad/kokoro/tree/main/kokoro.js) (Apache-2.0).
