# Bundled voice

`en_US-joe-medium` is a [Piper](https://github.com/OHF-Voice/piper1-gpl) voice trained on the
OHF-Voice "joe" dataset (https://github.com/OHF-Voice/voice-datasets), released under **CC0**
(public domain dedication). It is safe for commercial / monetized videos.

It ships inside the repository so ReelBot never downloads anything at run time.

To use a different voice, drop its `.onnx` and `.onnx.json` files in this folder and set
`voice.model` in `config.yaml` to the file name without the extension. Check the voice's
license first: some Piper voices (for example `ryan` and `hfc_*`) are non-commercial only.
