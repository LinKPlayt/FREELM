"""Splits an ONNX model's weights into chunks of at most ~95 MB so GitHub Pages can serve them
(it rejects files over 100 MB). Uses the standard ONNX external-data format; Transformers.js
loads the chunks as  model.onnx_data, model.onnx_data_1, model.onnx_data_2, ...

  python scripts/split_onnx.py <model.onnx> <out_dir> [max_mb]
Prints the number of chunks, to put in config.json:
  "transformers.js_config": {"use_external_data_format": {"model.onnx": N}}
"""
import sys
from pathlib import Path

import onnx
from onnx.external_data_helper import set_external_data


def main() -> int:
    src, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    max_bytes = int(float(sys.argv[3]) * 1e6) if len(sys.argv) > 3 else 95_000_000
    out_dir.mkdir(parents=True, exist_ok=True)
    model = onnx.load(str(src), load_external_data=True)
    base = src.name
    names = lambda i: f"{base}_data" + ("" if i == 0 else f"_{i}")   # noqa: E731

    chunks, cur, size = [], [], 0
    tensors = [t for t in model.graph.initializer if len(t.raw_data) > 1024]
    for t in tensors:
        n = len(t.raw_data)
        if cur and size + n > max_bytes:
            chunks.append(cur)
            cur, size = [], 0
        cur.append(t)
        size += n
    if cur:
        chunks.append(cur)

    for i, group in enumerate(chunks):
        with open(out_dir / names(i), "wb") as fh:
            offset = 0
            for t in group:
                data = t.raw_data
                fh.write(data)
                set_external_data(t, location=names(i), offset=offset, length=len(data))
                t.ClearField("raw_data")
                t.data_location = onnx.TensorProto.EXTERNAL
                offset += len(data)
    onnx.save(model, str(out_dir / base))
    sizes = [round((out_dir / names(i)).stat().st_size / 1e6, 1) for i in range(len(chunks))]
    print(f"{base}: {len(chunks)} chunks {sizes} MB, graph {round((out_dir / base).stat().st_size / 1e6, 2)} MB")
    print(len(chunks))
    return 0


if __name__ == "__main__":
    sys.exit(main())
