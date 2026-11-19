// Automated tests for the phone app, in a real browser (Chromium, phone-sized).
//
//   node tests/web/run.mjs                 logic + fuzz (fast, offline)
//   node tests/web/run.mjs features        end-to-end flows (makes real videos; needs the internet for photos)
//   node tests/web/run.mjs all
//
// Serves the repository on a local port the way GitHub Pages does (gzip, so downloads behave the same).
import http from "node:http";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TYPES = { ".html": "text/html", ".css": "text/css", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".wasm": "application/wasm",
  ".png": "image/png", ".ttf": "font/ttf", ".webmanifest": "application/manifest+json", ".onnx": "application/octet-stream", ".bin": "application/octet-stream" };
const zcache = new Map();

function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
    let file = path.join(ROOT, rel);
    // Like GitHub Pages: a folder serves its index.html.
    if (file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    const key = file + fs.statSync(file).mtimeMs;
    if (!zcache.has(key)) zcache.set(key, zlib.gzipSync(fs.readFileSync(file), { level: 1 }));
    const body = zcache.get(key);
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Content-Encoding": "gzip", "Content-Length": body.length });
    res.end(body);
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r(server)));
}

// A tiny test API shared by the suites.
export function makeT() {
  const results = [];
  const t = {
    results,
    ok(cond, name, detail = "") { results.push({ ok: Boolean(cond), name, detail }); console.log(`  ${cond ? "✓" : "✗"} ${name}${detail && !cond ? " — " + detail : ""}`); },
    section(name) { console.log(`\n${name}`); },
  };
  return t;
}

const which = process.argv[2] || "fast";
const server = await serve();
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const t = makeT();
const pageErrors = [];
async function newPage(opts = {}) {
  const ctx = await browser.newContext({ ...devices["iPhone 14 Pro"], serviceWorkers: opts.sw ? "allow" : "block" });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE.replace(/\/$/, "") }).catch(() => {});
  const page = await ctx.newPage();
  // One handler for every dialog: prompts get a photo subject, confirms are accepted.
  page.on("dialog", (d) => d.accept(d.type() === "prompt" ? "piggy bank" : undefined).catch(() => {}));
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|429|MODEL_TYPE_MAPPING|((openverse|wikimedia)\.org|search\.cnbc\.com|feeds\.content\.dowjones\.io).*blocked by CORS policy/.test(m.text())) pageErrors.push(m.text().slice(0, 300)); });
  // Wikipedia is reached through the test machine (its own rate limits apply to browsers).
  await page.route(/https:\/\/en\.wikipedia\.org\/.*/, async (route) => {
    try {
      const r = await fetch(route.request().url(), { headers: { "User-Agent": "ReelBot-tests/1.0" } });
      await route.fulfill({ status: r.status, headers: { "access-control-allow-origin": "*", "content-type": r.headers.get("content-type") || "application/json" }, body: Buffer.from(await r.arrayBuffer()) });
    } catch { await route.abort(); }
  });
  await page.goto(BASE + "index.html");
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  return page;
}

const suites = which === "all" ? ["logic", "fuzz", "features"] : which === "fast" ? ["logic", "fuzz"] : [which];
const t0 = Date.now();
for (const s of suites) {
  const mod = await import(`./${s}.mjs`);
  await mod.default({ t, newPage, BASE });
}
t.section("Page errors");
t.ok(pageErrors.length === 0, `no uncaught errors in any page (${pageErrors.length})`, pageErrors.slice(0, 5).join(" | "));
await browser.close(); server.close();
const failed = t.results.filter((r) => !r.ok);
console.log(`\n${t.results.length - failed.length}/${t.results.length} passed in ${Math.round((Date.now() - t0) / 1000)} s${failed.length ? "\nFAILED:\n- " + failed.map((f) => f.name + (f.detail ? " — " + f.detail : "")).join("\n- ") : ""}`);
process.exit(failed.length ? 1 : 0);
