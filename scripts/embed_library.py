"""Pre-computes semantic vectors for the Idea Lab library (build time, on a computer).

Uses the same model the phone runs (app/ai/models/all-MiniLM-L6-v2, quantized ONNX), so the
phone only has to embed the user's query. Writes app/ai/data/library.vec: one row of 384 signed
bytes per article (value / 127 = unit-length vector component).

  python scripts/embed_library.py      (run after scripts/build_corpus.py)
"""
import json
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / "app" / "ai" / "models" / "all-MiniLM-L6-v2"
LIB = ROOT / "app" / "ai" / "data" / "library.json"
OUT = ROOT / "app" / "ai" / "data" / "library.vec"


def main() -> int:
    data = json.loads(LIB.read_text())
    tok = Tokenizer.from_file(str(MODEL / "tokenizer.json"))
    tok.enable_truncation(max_length=128)
    tok.enable_padding(pad_id=0, pad_token="[PAD]")
    sess = ort.InferenceSession(str(MODEL / "onnx" / "model_quantized.onnx"), providers=["CPUExecutionProvider"])
    names = {i.name for i in sess.get_inputs()}
    texts = [f"{a['t']}. " + " ".join(a["s"][:2]) for a in data["articles"]]
    rows = []
    for i in range(0, len(texts), 64):
        enc = tok.encode_batch(texts[i:i + 64])
        ids = np.array([e.ids for e in enc], dtype=np.int64)
        mask = np.array([e.attention_mask for e in enc], dtype=np.int64)
        feeds = {"input_ids": ids, "attention_mask": mask}
        if "token_type_ids" in names:
            feeds["token_type_ids"] = np.zeros_like(ids)
        hidden = sess.run(None, feeds)[0]                       # (batch, tokens, 384)
        m = mask[..., None].astype(np.float32)
        vec = (hidden * m).sum(1) / np.maximum(m.sum(1), 1e-9)   # mean pooling
        vec /= np.linalg.norm(vec, axis=1, keepdims=True)        # unit length
        rows.append(np.clip(np.round(vec * 127), -127, 127).astype(np.int8))
        print(f"  {min(i + 64, len(texts))}/{len(texts)}", file=sys.stderr, end="\r")
    vecs = np.concatenate(rows)
    OUT.write_bytes(vecs.tobytes())
    data["vectors"] = {"file": OUT.name, "dim": int(vecs.shape[1]), "count": int(vecs.shape[0]), "model": "all-MiniLM-L6-v2"}
    LIB.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    print(f"\nWrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB, {vecs.shape[0]} x {vecs.shape[1]})", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
