// Builds a server-less copy of FREELM into dist/ (in-browser AI only),
// suitable for GitHub Pages or any static host served over HTTPS.
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const nm = (p) => path.join(root, "node_modules", p);

await rm(dist, { recursive: true, force: true });
await cp(path.join(root, "public"), dist, { recursive: true });
await mkdir(path.join(dist, "vendor"), { recursive: true });
const vendor = {
  "marked.js": "marked/lib/marked.umd.js",
  "purify.js": "dompurify/dist/purify.min.js",
  "highlight.js": "@highlightjs/cdn-assets/highlight.min.js",
  "hl-light.css": "@highlightjs/cdn-assets/styles/github.min.css",
  "hl-dark.css": "@highlightjs/cdn-assets/styles/github-dark.min.css",
  "web-llm.js": "@mlc-ai/web-llm/lib/index.js",
};
for (const [out, src] of Object.entries(vendor)) await cp(nm(src), path.join(dist, "vendor", out));
await writeFile(path.join(dist, ".nojekyll"), "");
console.log("Static build written to dist/");
