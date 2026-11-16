"""Stores an ONNX model's large float32 weights in half precision, with a Cast back to float32.

The download halves, and the phone still computes in full precision: ONNX Runtime folds the casts
into float32 constants when the model loads, so it runs as fast as the original float32 model
(8-bit quantized models are smaller still, but run much slower in the browser's WebAssembly runtime).

  python scripts/fp16_weights.py <model.onnx> <out.onnx>
then split it for GitHub Pages:
  python scripts/split_onnx.py <out.onnx> <out_dir>
"""
import sys

import numpy as np
import onnx
from onnx import helper, numpy_helper


def main() -> int:
    src, dst = sys.argv[1], sys.argv[2]
    model = onnx.load(src)
    g = model.graph
    casts, kept, converted = [], [], 0
    for init in g.initializer:
        if init.data_type == onnx.TensorProto.FLOAT and int(np.prod(init.dims or [1])) >= 1024:
            arr = numpy_helper.to_array(init)
            if np.isfinite(arr).all() and np.abs(arr).max() < 65000:            # fits in float16
                half = numpy_helper.from_array(arr.astype(np.float16), init.name + "_fp16")
                kept.append(half)
                casts.append(helper.make_node("Cast", [half.name], [init.name], to=onnx.TensorProto.FLOAT, name=init.name + "_to_fp32"))
                converted += 1
                continue
        kept.append(init)
    del g.initializer[:]
    g.initializer.extend(kept)
    nodes = list(g.node)
    del g.node[:]
    g.node.extend(casts + nodes)
    onnx.save(model, dst)
    print(f"{converted} weights stored in float16", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
