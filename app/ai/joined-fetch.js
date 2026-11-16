// GitHub Pages refuses files over 100 MB, so big model files are stored as plain byte chunks
// (model.onnx.part0, .part1, … plus model.onnx.parts.json) and joined here, on the phone, as they
// download. The AI runtime then sees one ordinary file. (ONNX's own "external data" split doesn't
// load on iPhone: "Module.MountedFiles is not available".)
//
// Use: env.fetch = joinedFetch(fetch, ["SmolLM2-135M-Instruct/onnx/model_quantized.onnx"])
export function joinedFetch(baseFetch, joinedPaths) {
  const manifests = new Map();
  const manifest = (url) => {
    if (!manifests.has(url)) manifests.set(url, baseFetch(url + ".parts.json").then((r) => {
      if (!r.ok) throw new Error(`Missing ${url}.parts.json (${r.status})`);
      return r.json();
    }).catch((e) => { manifests.delete(url); throw e; }));
    return manifests.get(url);
  };
  return async (input, init = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(url, self.location.href).pathname;
    if (!joinedPaths.some((p) => path.endsWith("/" + p))) return baseFetch(input, init);
    const abs = new URL(url, self.location.href).href;
    const { parts, size } = await manifest(abs);
    const dir = abs.slice(0, abs.lastIndexOf("/") + 1);
    const range = new Headers(init.headers || {}).get("Range");
    if (range && /^bytes=0-0$/.test(range)) {        // "does it exist, how big?" probe
      return new Response(new Uint8Array(1), { status: 206, headers: { "Content-Range": `bytes 0-0/${size}`, "Content-Length": "1", "Content-Type": "application/octet-stream" } });
    }
    let i = 0, reader = null;
    const body = new ReadableStream({
      async pull(controller) {
        for (;;) {
          if (!reader) {
            if (i >= parts.length) return controller.close();
            const res = await baseFetch(dir + parts[i++]);
            if (!res.ok || !res.body) return controller.error(new Error(`Couldn't download ${parts[i - 1]} (${res.status})`));
            reader = res.body.getReader();
          }
          const { done, value } = await reader.read();
          if (done) { reader = null; continue; }
          controller.enqueue(value);
          return;
        }
      },
      cancel() { reader?.cancel(); },
    });
    return new Response(body, { status: 200, headers: { "Content-Length": String(size), "Content-Type": "application/octet-stream" } });
  };
}
