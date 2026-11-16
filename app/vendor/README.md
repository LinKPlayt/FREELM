# Third-party code bundled with the app

Served from this site so the phone never contacts a third-party code host.

| Folder / file | What | License |
|---|---|---|
| `ort/` | [onnxruntime-web](https://github.com/microsoft/onnxruntime) 1.20.1 (WebAssembly build) | MIT |
| `piper/` | [piper-wasm](https://github.com/diffusion-studio/piper-wasm) 1.0.0: piper-phonemize compiled to WebAssembly. It embeds [espeak-ng](https://github.com/espeak-ng/espeak-ng) and its language data | MIT (wrapper), GPL-3.0-or-later (espeak-ng) |
| `mp4-muxer.mjs` | [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) 5.2.1 | MIT |

espeak-ng is free software under the GNU GPL v3 or later; its source is available at the link above.
