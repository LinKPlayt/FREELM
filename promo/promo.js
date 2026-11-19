/* global T */
// ReelBot launch video: a deterministic motion-graphics composition. window.render(t) draws the frame
// at time t (seconds) and resolves once every image on it is decoded. Nothing depends on the clock.
const Q = new URLSearchParams(location.search);
const TALL = Q.get("fmt") === "tall";
const W = TALL ? 1080 : 1920, H = TALL ? 1920 : 1080;
const L = (w, t) => (TALL ? t : w);
const stage = document.getElementById("stage");
Object.assign(stage.style, { width: W + "px", height: H + "px" });
Object.assign(document.body.style, { width: W + "px", height: H + "px" });

/* ---------------------------------------------------------------- math */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const E = {
  lin: (x) => x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inCubic: (x) => x * x * x,
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  outBack: (x) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
};
const pr = (t, a, b, e = E.lin) => e(clamp((t - a) / (b - a)));
function spring(t, a, f = 2.2, d = 6.5) { if (t <= a) return 0; const x = t - a; return 1 - Math.exp(-d * x) * Math.cos(2 * Math.PI * f * x); }
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let r = Math.imul(seed ^ (seed >>> 15), 1 | seed); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const noise1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; };

/* ---------------------------------------------------------------- DOM helpers */
function mk(parent, cls = "", style = {}, html = "") { const e = document.createElement("div"); if (cls) e.className = cls; Object.assign(e.style, style); if (html) e.innerHTML = html; parent.appendChild(e); return e; }
const S = (e, o) => { for (const k in o) e.style[k] = o[k]; };
const pending = [], cache = {};
function preload(src) { if (!cache[src]) { const im = new Image(); im.src = src; cache[src] = im.decode().catch(() => {}).then(() => im); } return cache[src]; }
function img(parent, src, style = {}) { const im = document.createElement("img"); if (src) { im.src = src; im._src = src; preload(src); } Object.assign(im.style, style); parent.appendChild(im); return im; }
function setSrc(im, src) { if (im._src !== src) { im._src = src; im.src = src; pending.push(im.decode().catch(() => {})); } }
const FR = { quiz_full: 116, quiz_tiny: 116, quiz_tile: 130, market: 129, explainer: 129, topic: 129 };
const frame = (name, sec) => `frames/${name}/${String(clamp(Math.floor(sec * 30), 0, FR[name] - 1) + 1).padStart(4, "0")}.jpg`;

// Words that slide up out of a mask. "*word" is yellow, "+word" green, "|" breaks the line.
function words(parent, text, cls, style = {}) {
  const root = mk(parent, cls, style), ws = [], toks = text.split(" ");
  toks.forEach((tok, i) => {
    if (tok === "|") { root.appendChild(document.createElement("br")); return; }
    let c = "wi"; if (tok[0] === "*") { tok = tok.slice(1); c += " y"; } else if (tok[0] === "+") { tok = tok.slice(1); c += " g"; }
    const o = document.createElement("span"); o.className = "w"; const n = document.createElement("span"); n.className = c; n.textContent = tok; o.appendChild(n); root.appendChild(o);
    if (i < toks.length - 1 && toks[i + 1] !== "|") root.appendChild(document.createTextNode(" "));
    ws.push(n);
  });
  return { root, ws };
}
function wordsAnim(ws, t, tin, tout = 1e9, { st = 0.055, din = 0.6, dout = 0.32, blur = true } = {}) {
  ws.forEach((w, k) => {
    const pi = pr(t, tin + k * st, tin + k * st + din, E.outExpo), po = pr(t, tout + k * st * 0.35, tout + k * st * 0.35 + dout, E.inCubic);
    w.style.transform = `translateY(${(1 - pi) * 112 - po * 112}%)`;
    w.style.opacity = pi <= 0 || po >= 1 ? 0 : 1;
    w.style.filter = blur && (pi < 1 || po > 0) ? `blur(${((1 - pi) + po) * 9}px)` : "none";
  });
}

/* ---------------------------------------------------------------- icons and logo */
const IC = {
  mic: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7.5 4v16M16.5 4v16M3 9h4.5M3 15h4.5M16.5 9H21M16.5 15H21"/>',
  cc: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 10.2a2.2 2.2 0 1 0 0 3.6M17 10.2a2.2 2.2 0 1 0 0 3.6"/>',
  check: '<path d="M20 6.5L9.5 17 4 11.5"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/><path d="M3 3l18 18"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><path d="M3 3l18 18"/>',
  plane: '<path d="M10.5 21l1.5-6-7-2.5V10l7 1V5.5c0-1 .8-2 1.5-2s1.5 1 1.5 2V11l7-1v2.5L15 15l1.5 6-3-1.5z"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  speaker: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
};
const svg = (paths, extra = "") => `<svg viewBox="0 0 24 24" ${extra}>${paths}</svg>`;
// One shared gradient for every logo (kept rendered, so no instance depends on another being visible).
stage.insertAdjacentHTML("beforeend", '<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="lmbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22306a"/><stop offset="1" stop-color="#0b1022"/></linearGradient><linearGradient id="lmshine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgba(255,255,255,.22)"/><stop offset=".5" stop-color="rgba(255,255,255,0)"/></linearGradient></defs></svg>');
const LOGO = `<svg viewBox="0 0 32 32" style="width:100%;height:100%;overflow:visible;display:block">
  <rect width="32" height="32" rx="9" fill="url(#lmbg)"/><rect width="32" height="32" rx="9" fill="url(#lmshine)"/><rect x=".5" y=".5" width="31" height="31" rx="8.5" fill="none" stroke="rgba(255,255,255,.18)"/>
  <g class="lm-play" style="transform-box:fill-box;transform-origin:center"><circle cx="11.5" cy="12" r="4.6" fill="#FACC15"/><path d="M10.2 9.7v4.6l3.6-2.3z" fill="#0b1022"/></g>
  <path class="lm-line" d="M6.5 24.5l5.6-4.8 3.6 2.8 8.4-8.6" fill="none" stroke="#FACC15" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="25"/>
  <path class="lm-head" d="M19.6 13.9h4.6v4.6" fill="none" stroke="#FACC15" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="9.4"/></svg>`;
function logo(parent, size, style = {}) {
  const root = mk(parent, "abs", Object.assign({ width: size + "px", height: size + "px", filter: "drop-shadow(0 18px 40px rgba(0,0,0,.6)) drop-shadow(0 0 60px rgba(250,204,21,.25))" }, style), LOGO);
  return { root, play: root.querySelector(".lm-play"), line: root.querySelector(".lm-line"), head: root.querySelector(".lm-head") };
}
function logoAnim(lg, t, t0) {
  const s = spring(t, t0, 1.5, 5.5);
  lg.root.style.opacity = t >= t0 ? 1 : 0;
  lg.root.style.transform = `scale(${0.3 + 0.7 * s}) rotate(${(1 - clamp(s)) * -16}deg)`;
  lg.play.style.transform = `scale(${spring(t, t0 + 0.12, 2.2, 7)})`;
  lg.line.style.strokeDashoffset = 25 * (1 - pr(t, t0 + 0.16, t0 + 0.58, E.outCubic));
  lg.head.style.strokeDashoffset = 9.4 * (1 - pr(t, t0 + 0.5, t0 + 0.72, E.outCubic));
}
function wordmark(parent, fs, style = {}) {
  const root = mk(parent, "h1", Object.assign({ fontSize: fs + "px", whiteSpace: "nowrap", letterSpacing: "-0.05em" }, style)), ls = [];
  [..."ReelBot"].forEach((ch, i) => { const o = document.createElement("span"); o.className = "w"; const n = document.createElement("span"); n.className = "wi" + (i >= 4 ? " y" : ""); n.textContent = ch; o.appendChild(n); root.appendChild(o); ls.push(n); });
  return { root, ls };
}

/* ---------------------------------------------------------------- components */
// A phone sized to the app's 393x852 screen, with bezel, island, glare, glow and a soft floor shadow.
function phone(parent, h) {
  const w = h / 2.0932;
  const root = mk(parent, "phone", { width: w + "px", height: h + "px" });
  const glow = mk(root, "phone-glow"), shadow = mk(root, "phone-shadow"), body = mk(root, "phone-body");
  const screen = mk(body, "phone-screen", { left: "3.2%", right: "3.2%", top: "1.529%", bottom: "1.529%", borderRadius: "10.47% / 4.83%" });
  S(body, { borderRadius: "13% / 6.21%" });
  mk(body, "phone-island", { top: "2.3%", height: "3.2%" });
  const glare = mk(body, "phone-glare", { borderRadius: "13% / 6.21%" });
  return { root, glow, shadow, body, screen, glare, w, h, sw: w * 0.936, sh: h * (1 - 0.03058) };
}
// A full-screen layer inside a phone, holding one or more stacked screenshots.
function screenLayer(ph, srcs) {
  const layer = mk(ph.screen, "abs", { left: 0, top: 0, width: "100%", height: "100%", overflow: "hidden" });
  const ims = srcs.map((s) => img(layer, s, { position: "absolute", left: 0, top: 0, width: "100%", display: "block" }));
  const dim = mk(layer, "abs", { inset: 0, background: "#000", opacity: 0 });
  return { layer, ims, dim };
}
// Two screenshots one scroll distance apart: the content scrolls, the app's fixed bottom bars stay still.
function scrollPair(ph, srcA, srcB, band, topBand = 0) {
  const layer = mk(ph.screen, "abs", { left: 0, top: 0, width: "100%", height: "100%", overflow: "hidden" });
  const bandPx = Math.min(band, 852) / 852 * ph.sh;
  const clip = mk(layer, "abs", { left: 0, top: 0, width: "100%", height: bandPx + "px", overflow: "hidden" });
  const a = img(clip, srcA, { position: "absolute", left: 0, top: 0, width: "100%" }), b = img(clip, srcB, { position: "absolute", left: 0, top: 0, width: "100%", opacity: 0 });
  const bottom = mk(layer, "abs", { left: 0, top: bandPx + "px", width: "100%", height: ph.sh - bandPx + "px", overflow: "hidden" });
  img(bottom, srcA, { position: "absolute", left: 0, top: -bandPx + "px", width: "100%" });
  if (topBand) { const tb = mk(layer, "abs", { left: 0, top: 0, width: "100%", height: topBand / 852 * ph.sh + "px", overflow: "hidden" }); img(tb, srcA, { position: "absolute", left: 0, top: 0, width: "100%" }); }
  const dim = mk(layer, "abs", { inset: 0, background: "#000", opacity: 0 });
  if (topBand) b.style.clipPath = `inset(${topBand / 852 * ph.sh}px 0 0 0)`;   // the second shot's own sticky header never slides through
  return { layer, dim, set(s, dyCss) { const d = dyCss / 852 * ph.sh; a.style.transform = `translateY(${-s * d}px)`; b.style.transform = `translateY(${(1 - s) * d}px)`; b.style.opacity = s > 0 && dyCss ? 1 : 0; } };
}
function tapDot(ph) { // a touch point and its ripple, placed in screen coordinates
  const dot = mk(ph.screen, "tap", { width: "44px", height: "44px", marginLeft: "-22px", marginTop: "-22px", background: "rgba(255,255,255,.55)", boxShadow: "0 0 0 2px rgba(255,255,255,.7)", opacity: 0 });
  const ring = mk(ph.screen, "tap", { width: "44px", height: "44px", marginLeft: "-22px", marginTop: "-22px", border: "3px solid rgba(250,204,21,.95)", opacity: 0 });
  return { dot, ring };
}
function tapAnim(tp, ph, t, at, b) {
  if (!b) return;
  const x = (b.x + b.w / 2) / 393 * ph.sw, y = (b.y + b.h / 2) / 852 * ph.sh;
  const a = pr(t, at - 0.16, at - 0.02, E.outCubic), out = pr(t, at + 0.05, at + 0.25);
  S(tp.dot, { left: x + "px", top: y + "px", opacity: a * (1 - out), transform: `scale(${0.6 + 0.4 * a - 0.15 * pr(t, at - 0.03, at + 0.05)})` });
  const r = pr(t, at, at + 0.5, E.outCubic);
  S(tp.ring, { left: x + "px", top: y + "px", opacity: t >= at ? (1 - r) * 0.95 : 0, transform: `scale(${1 + r * 2.6})` });
}
function browser(parent, w, src) {
  const barH = Math.round(w * 0.032), ch = w * 900 / 1440;
  const root = mk(parent, "browser", { width: w + "px", height: barH + ch + "px", borderRadius: Math.round(w * 0.011) + "px" });
  const bar = mk(root, "browser-bar", { height: barH + "px", paddingLeft: barH * 0.62 + "px", gap: barH * 0.3 + "px" });
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c) => mk(bar, "", { width: barH * 0.3 + "px", height: barH * 0.3 + "px", borderRadius: "50%", background: c, opacity: 0.9 }));
  mk(bar, "browser-url", { fontSize: barH * 0.34 + "px", height: barH * 0.6 + "px", padding: `0 ${barH * 0.5}px` },
    svg(IC.lock, `style="width:${barH * 0.32}px;height:${barH * 0.32}px;fill:none;stroke:#8b93a8;stroke-width:2.4"`) + "linkplayt.github.io/FREELM");
  img(root, src, { width: "100%", display: "block" });
  return { root, w, h: barH + ch };
}
function badge(parent, icon, color, text, fs) {
  const b = mk(parent, "badge", { fontSize: fs + "px" });
  b.innerHTML = `<span class="ic" style="background:${color}22;color:${color}">${svg(IC[icon])}</span><span>${text}</span>`;
  return b;
}
function pill(parent, text, fs, { dot = false, icon = null, color = "#facc15" } = {}) {
  const p = mk(parent, "pill", { fontSize: fs + "px" });
  p.innerHTML = (dot ? '<span class="dot"></span>' : "") + (icon ? `<span style="display:inline-grid;width:1.15em;height:1.15em;color:${color}">${svg(IC[icon], 'style="width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round"')}</span>` : "") + `<span>${text}</span>`;
  return p;
}
function popIn(e, t, at, { from = 0.6, base = "" } = {}) {   // spring pop, used for badges, pills and tiles
  const s = spring(t, at, 2.4, 7.5);
  e.style.opacity = t >= at ? clamp((t - at) / 0.08) : 0;
  e.style.transform = `${base} scale(${from + (1 - from) * s})`;
  return s;
}

/* ---------------------------------------------------------------- background */
const bg = mk(stage, "layer");
mk(bg, "layer", { background: "radial-gradient(ellipse 130% 95% at 50% 115%, #141828 0%, #080a12 52%, #040509 100%)" });
const BLOBS = [[250, 204, 21, 0.2], [99, 102, 241, 0.22], [6, 182, 212, 0.13], [250, 204, 21, 0.12]].map(([r, g, b, a]) =>
  ({ el: mk(bg, "blob", { width: L(1500, 1500) + "px", height: L(1500, 1500) + "px", background: `radial-gradient(closest-side, rgba(${r},${g},${b},${a}), rgba(${r},${g},${b},0))` }), a }));
const gridWrap = mk(bg, "layer", { perspective: "900px", perspectiveOrigin: "50% 30%" });
const grid = mk(gridWrap, "grid-floor", { backgroundSize: "90px 90px" });
const rays = mk(bg, "rays", { width: L(2200, 2200) + "px", height: L(2200, 2200) + "px", left: W / 2 - 1100 + "px", top: H / 2 - 1100 + "px", opacity: 0 });
const PR = rng(7), PARTS = Array.from({ length: 70 }, () => ({ x: PR() * W, y: PR() * H, z: 0.3 + PR() * 0.7, s: 2 + PR() * 4, ph: PR() * 10, el: null }));
PARTS.forEach((p) => { p.el = mk(bg, "particle", { width: p.s + "px", height: p.s + "px", background: PR() < 0.35 ? "#facc15" : "#ffffff" }); });
const BR = rng(99), BURST = Array.from({ length: 46 }, () => ({ a: BR() * Math.PI * 2, v: 300 + BR() * 900, s: 3 + BR() * 6, el: null }));
BURST.forEach((p) => { p.el = mk(bg, "particle", { width: p.s + "px", height: p.s + "px", background: "#fde047", boxShadow: "0 0 12px rgba(250,204,21,.9)" }); });

function renderBg(t) {
  // Aurora: slow drift, brighter for the big moments, quiet under the full-screen reel.
  const lift = Math.max(pr(t, 7.6, 8.2) * (1 - pr(t, 9.6, 10.4)) * 0.8, pr(t, 43.9, 44.2) * (1 - pr(t, 45.6, 46.2)) * 0.9, pr(t, 45.9, 46.6) * 0.6);
  const quiet = pr(t, 24.0, 24.3) * (1 - pr(t, 27.5, 28.0));
  BLOBS.forEach((b, i) => {
    const x = W * (0.5 + 0.42 * Math.sin(t * 0.11 + i * 1.7)) - 750, y = H * (0.5 + 0.38 * Math.cos(t * 0.09 + i * 2.3)) - 750;
    S(b.el, { transform: `translate(${x}px, ${y}px) scale(${1 + 0.15 * Math.sin(t * 0.3 + i)})`, opacity: clamp((0.85 + lift * 0.9) * (1 - quiet * 0.8), 0, 1.6) });
  });
  const gridOn = Math.max(pr(t, 7.9, 8.1) * (1 - pr(t, 9.7, 10.0)) * 0.55, pr(t, 43.95, 44.1) * (1 - pr(t, 45.8, 46.0)) * 0.7, pr(t, 46.0, 46.8) * 0.38 * (1 - pr(t, 51.4, 52)));
  S(grid, { opacity: gridOn, transform: `rotateX(74deg)`, backgroundPosition: `0px ${(t * 70) % 90}px` });
  const rayOn = Math.max((t >= 8 ? Math.exp(-(t - 8) * 2.2) * 0.9 + 0.32 : 0) * (1 - pr(t, 9.6, 10.0)), (t >= 44 ? Math.exp(-(t - 44) * 2) * 0.9 + 0.4 : 0) * (1 - pr(t, 45.7, 46.0)), pr(t, 46.1, 47) * 0.24 * (1 - pr(t, 51.4, 52)));
  const rayY = t > 45.9 ? L(-70, -170) : t < 20 ? L(-40, -160) : 0;
  S(rays, { opacity: rayOn, transform: `translateY(${rayY}px) rotate(${t * 9}deg)` });
  const boost = 0.45 + lift * 0.6;
  PARTS.forEach((p) => {
    const x = (p.x + Math.sin(t * 0.4 * p.z + p.ph) * 40 + t * 12 * p.z) % (W + 40) - 20, y = (p.y - t * 26 * p.z + H * 10) % (H + 40) - 20;
    S(p.el, { transform: `translate(${x}px, ${y}px)`, opacity: (0.18 + 0.5 * p.z) * boost * (0.6 + 0.4 * Math.sin(t * 2 + p.ph)) * (1 - quiet) });
  });
  const cx = W / 2, cy = H / 2 + L(-40, -160);
  for (const [t0, scale] of [[8.0, 1], [44.0, 1.15]]) {
    const k = t - t0;
    if (k >= 0 && k < 1.6) { BURST.forEach((p) => { const d = p.v * scale * (1 - Math.exp(-k * 2.6)) * 0.9; S(p.el, { display: "", transform: `translate(${cx + Math.cos(p.a) * d}px, ${cy + Math.sin(p.a) * d * 0.8}px) scale(${1 - k / 1.8})`, opacity: (1 - k / 1.6) }); }); return; }
  }
  BURST.forEach((p) => { p.el.style.display = "none"; });
}

/* ---------------------------------------------------------------- scenes */
const world = mk(stage, "layer");
const SCENES = [];
function scene(a, b, build) { const root = mk(world, "scene"); const persp = mk(root, "persp"); const r = build(root, persp); SCENES.push({ a, b, root, render: r }); }
const boxes = window.BOXES || {};

// 1. Cold open: every job one finance video takes, one per eighth note.
scene(0, 2.34, (root) => {
  const label = words(root, "Every finance video needs", "mono abs", { left: 0, right: 0, textAlign: "center", top: L(190, 520) + "px", fontSize: L(22, 28) + "px", color: "#facc15" });
  const fs = L(150, 156);
  const items = T.words.map((w) => mk(root, "h1 abs", { left: 0, right: 0, textAlign: "center", top: H / 2 - fs * 0.5 + L(30, 40) + "px", fontSize: fs + "px", whiteSpace: "nowrap" }, w));
  const count = mk(root, "mono abs", { left: 0, right: 0, textAlign: "center", top: H / 2 + fs * 0.75 + L(40, 60) + "px", fontSize: L(20, 26) + "px", color: "#6f778d" });
  return (t) => {
    wordsAnim(label.ws, t, 0.0, 1.98, { st: 0.035, din: 0.45, dout: 0.2 });
    let n = 0;
    items.forEach((e, k) => {
      const s0 = T.wordAt[k]; if (t < s0) { e.style.opacity = 0; return; } n = k + 1;
      const pin = pr(t, s0, s0 + 0.2, E.outExpo);
      let age = 0; for (let j = k + 1; j < items.length; j++) age += pr(t, T.wordAt[j], T.wordAt[j] + 0.2, E.outExpo);
      let op = (age < 1 ? 1 - age * 0.7 : age < 2 ? 0.3 - (age - 1) * 0.22 : Math.max(0, 0.08 - (age - 2) * 0.08)) * pin;
      const y = -age * fs * 0.66 + (1 - pin) * 60, sc = (1 - clamp(age) * 0.5 - Math.max(0, age - 1) * 0.1) * (1 + (1 - pin) * 0.22);
      let gx = 0, skew = 0, blur = age * 1.5 + (1 - pin) * 12;
      if (t > T.collapse) { const g = pr(t, T.collapse, T.collapse + 0.3); gx = noise1(t * 70 + k * 13) * 110; skew = noise1(t * 55 + k * 3) * 24; op *= 1 - pr(t, T.collapse + 0.1, T.collapse + 0.32); blur += g * 8; }
      S(e, { opacity: op, filter: `blur(${blur}px)`, transform: `translate(${gx}px, ${y}px) scale(${sc}) skewX(${skew}deg)`, color: age < 0.5 ? "#ffffff" : "#c3c8d6",
        textShadow: t > T.collapse ? "-10px 0 rgba(255,50,90,.75), 10px 0 rgba(40,220,255,.75)" : "none" });
    });
    count.textContent = `${String(n).padStart(2, "0")} / 08`;
    count.style.opacity = (t < 2.0 ? 1 : 1 - pr(t, 2.0, 2.2)) * pr(t, 0, 0.1);
  };
});

// 2. The question.
scene(2.2, 4.14, (root) => {
  const fs = L(112, 116), lines = TALL ? 3 : 2;
  const q = words(root, TALL ? "What if your | phone *made | *it *for *you?" : "What if your phone | *made *it *for *you?", "h1 abs",
    { left: 0, right: 0, textAlign: "center", top: H / 2 - (lines * fs * 1.0) / 2 + "px", fontSize: fs + "px" });
  return (t) => {
    wordsAnim(q.ws, t, T.question, 1e9, { st: 0.075, din: 0.65 });
    const z = pr(t, 3.84, 4.14, E.inCubic);
    S(q.root, { transform: `scale(${1 + z * 0.6})`, filter: z > 0 ? `blur(${z * 16}px)` : "none", opacity: 1 - z });
  };
});

// 3. The phone rises; "Introducing".
scene(3.96, 8.06, (root, persp) => {
  const ph = phone(persp, L(860, 1240)), scr = screenLayer(ph, ["ui/p_studio_a.png"]); const sweep = mk(ph.screen, "sweep");
  const cy = L(H / 2 + 80, H / 2 + 130);
  S(ph.root, { left: W / 2 - ph.w / 2 + "px", top: cy - ph.h / 2 + "px" });
  const intro = words(root, "Introducing", "mono abs", { left: 0, right: 0, textAlign: "center", top: L(46, 250) + "px", fontSize: L(24, 30) + "px", color: "#cfd4e0" });
  return (t) => {
    const rise = pr(t, 4.0, 5.8, E.outCubic), push = pr(t, 5.2, 7.5, E.inOutCubic), zoom = pr(t, 7.5, 8.04, E.inExpo);
    S(ph.root, { opacity: pr(t, 4.0, 4.3), filter: zoom > 0.05 ? `blur(${zoom * 18}px)` : "none",
      transform: `translateY(${(1 - rise) * H * 0.65 - zoom * L(40, 120)}px) rotateX(${(1 - rise) * 62 + 5 * (1 - zoom)}deg) rotateY(${Math.sin(t * 0.8) * 5 * (1 - zoom)}deg) scale(${0.9 + push * 0.12 + zoom * 3.2})` });
    S(ph.glow, { opacity: 0.5 + push * 0.8 });
    S(sweep, { transform: `translateX(${lerp(-120, 120, pr(t, 6.0, 6.8, E.inOutCubic))}%)`, opacity: t > 6 && t < 6.9 ? 1 : 0 });
    S(scr.dim, { opacity: 0 });
    wordsAnim(intro.ws, t, 4.55, 7.35, { st: 0, din: 0.8, dout: 0.25 });
    intro.root.style.letterSpacing = `${lerp(0.7, 0.32, pr(t, 4.55, 6.5, E.outCubic))}em`;
  };
});

// 4. The logo.
function lockup(root, { mark, fs, tagFs, gap, top, tagTop }) {
  const lock = mk(root, "abs", { left: W / 2 + "px", top: top + "px", display: "flex", flexDirection: TALL ? "column" : "row", alignItems: "center", gap: gap + "px" });
  const markBox = mk(lock, "", { position: "relative", width: mark + "px", height: mark + "px", flex: "none" });
  const lg = logo(markBox, mark, { left: 0, top: 0 });
  const wm = wordmark(lock, fs);
  const tag = words(root, "Finance reels, made on your phone.", "sub abs", { left: 0, right: 0, top: tagTop + "px", textAlign: "center", fontSize: tagFs + "px", color: "#c9cedb" });
  return { lock, lg, wm, tag };
}
scene(7.98, 10.06, (root) => {
  const lk = lockup(root, { mark: L(190, 250), fs: L(190, 196), tagFs: L(40, 46), gap: L(44, 36), top: L(H / 2 - 30, H / 2 - 120), tagTop: L(H / 2 + 120, H / 2 + 190) });
  return (t) => {
    const out = pr(t, 9.8, 10.06, E.inCubic), sh = 1 - Math.exp(-(t - 8) * 3);
    S(lk.lock, { transform: `translate(-50%, -50%) translateX(${-out * W * 0.5}px) scale(${1.06 - 0.06 * sh})`, filter: out > 0 ? `blur(${out * 24}px)` : "none", opacity: 1 - out });
    logoAnim(lk.lg, t, 8.0);
    lk.wm.ls.forEach((l, i) => { const p = pr(t, 8.12 + i * 0.035, 8.6 + i * 0.035, E.outExpo); S(l, { transform: `translateY(${(1 - p) * 112}%)`, opacity: p > 0 ? 1 : 0 }); });
    wordsAnim(lk.tag.ws, t, 8.45, 9.78, { st: 0.05 });
    S(lk.tag.root, { transform: `translateX(${-out * W * 0.5}px)`, filter: out > 0 ? `blur(${out * 24}px)` : "none" });
  };
});

// 5-8. How it works: one phone carries the three steps and the finished reel.
scene(9.86, 24.08, (root, persp) => {
  const ph = phone(persp, L(900, 1150));
  const PX = L(1350, W / 2), PY = L(H / 2 + 8, 1265);
  S(ph.root, { left: PX - ph.w / 2 + "px", top: PY - ph.h / 2 + "px" });
  const studio = screenLayer(ph, ["ui/p_studio_a.png", "ui/p_studio_b.png", "ui/p_studio_c.png"]);
  const review = scrollPair(ph, "ui/p_review.png", "ui/p_review_b.png", boxes.reviewBand ? boxes.reviewBand + 16 : 852, boxes.topBand || 0);   // + the sticky bar's clear top padding
  const job = screenLayer(ph, [0, 1, 2, 3, 4, 5].map((k) => `ui/p_job_${k}.png`));
  const result = screenLayer(ph, ["ui/p_result.png"]);
  const taps = [tapDot(ph), tapDot(ph), tapDot(ph)];
  const goGlow = mk(ph.screen, "abs", { borderRadius: "14px", boxShadow: "0 0 0 3px rgba(250,204,21,.9), 0 0 40px 10px rgba(250,204,21,.55)", opacity: 0 });
  // Text blocks, one per step.
  const tb = (top) => mk(root, "abs", TALL ? { left: "70px", right: "70px", top: top + "px", textAlign: "center" } : { left: "130px", width: "760px", top: top + "px" });
  const block = (label, head, sub, top) => {
    const box = tb(top);
    const lab = words(box, label, "mono", { fontSize: L(20, 24) + "px", color: "#facc15", marginBottom: L(22, 22) + "px" });
    const h = words(box, head, "h1", { fontSize: L(96, 100) + "px" });
    const s = words(box, sub, "sub", { fontSize: L(31, 36) + "px", marginTop: L(28, 26) + "px", maxWidth: L(660, 940) + "px", marginLeft: TALL ? "auto" : 0, marginRight: TALL ? "auto" : 0 });
    return { box, lab, h, s };
  };
  const TOP = L(300, 150);
  const b1 = block("01 — Create", "Pick a | *topic.", "Six niches. Six formats. Ten voices. Your style.", TOP);
  const chips = mk(b1.box, "", { display: "flex", gap: "14px", marginTop: L(34, 30) + "px", justifyContent: TALL ? "center" : "flex-start" });
  const c1 = pill(chips, "Crypto", L(26, 30), { icon: "check" }), c2 = pill(chips, "Quiz", L(26, 30), { icon: "check" });
  [c1, c2].forEach((c) => S(c, { position: "relative" }));
  const b2 = block("02 — Research", "Researched. | Written. | *Fact-checked.", "Real sources. Every fact checked. Every line proofread.", L(250, 120));
  const b3 = block("03 — Produce", "Voiced. | Edited. | *Captioned.", "Natural voice, music, motion graphics and captions, made right on your phone.", L(250, 120));
  const doneBox = tb(L(330, 190));
  const doneMark = mk(doneBox, "", { width: L(120, 130) + "px", height: L(120, 130) + "px", marginBottom: "26px", marginLeft: TALL ? "auto" : 0, marginRight: TALL ? "auto" : 0 },
    '<svg viewBox="0 0 100 100" style="width:100%;height:100%"><circle cx="50" cy="50" r="44" fill="rgba(52,211,153,.14)" stroke="#34d399" stroke-width="6" stroke-dasharray="277" class="dc"/><path d="M30 52l13 13 27-29" fill="none" stroke="#34d399" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="70" class="dk"/></svg>');
  const doneH = words(doneBox, "Done.", "h1", { fontSize: L(170, 180) + "px" });
  const doneS = words(doneBox, "Your reel is ready to post.", "sub", { fontSize: L(34, 40) + "px", marginTop: "18px" });
  // Badges around the phone.
  const bfs = L(24, 28), side = (k) => (TALL ? (k % 2 ? 1 : -1) : -1);
  const mkB = (icon, color, text) => badge(persp, icon, color, text, bfs);
  const rb = [mkB("star", "#facc15", "Reel score + coaching tips"), mkB("check", "#34d399", "Wording reads correctly"), mkB("edit", "#38bdf8", "Edit any line before it's made")];
  const pb = [mkB("mic", "#facc15", "Natural voiceover"), mkB("music", "#a78bfa", "Music that fits"), mkB("film", "#38bdf8", "Motion graphics"), mkB("cc", "#34d399", "Captions")];
  // Badges float over the lower half of the phone (the app's own UI stays readable above them).
  const place = (b, dx, fy) => S(b, { left: PX + dx + "px", top: PY + ph.h * fy + "px" });
  rb.forEach((b, k) => place(b, [-70, 40, -30][k], [0.07, 0.18, 0.29][k]));
  pb.forEach((b, k) => place(b, L([-90, 60, -50, 40], [-70, 60, -40, 50])[k], [0.03, 0.13, 0.23, 0.33][k]));

  return (t) => {
    // the phone: in from the right (wide) or from below (tall), then a slow drift
    const enter = pr(t, 9.86, 10.6, E.outExpo), toFull = pr(t, 23.55, 24.08, E.inExpo);
    const ry = L(lerp(-16, -7, pr(t, 10, 23.5)), lerp(-4, 3, pr(t, 10, 23.5))) * (1 - toFull), rx = L(3, 7) * (1 - toFull);
    const float = Math.sin(t * 1.3) * 7 * (1 - toFull);
    const ex = TALL ? 0 : (1 - enter) * W * 0.55, ey = TALL ? (1 - enter) * H * 0.5 : 0;
    const zx = (W / 2 - PX) * toFull, zy = (H / 2 - PY) * toFull;
    const press = 1 - 0.018 * Math.exp(-Math.max(0, t - T.taps[2]) * 9) * (t >= T.taps[2] ? 1 : 0);
    S(ph.root, { transform: `translate(${ex + zx}px, ${ey + float + zy}px) rotateY(${ry}deg) rotateX(${rx}deg) scale(${press * (1 + toFull * 1.9)})`, opacity: pr(t, 9.86, 10.1) * (1 - pr(t, 23.9, 24.08)),
      filter: enter < 0.9 ? `blur(${(1 - enter) * 14}px)` : toFull > 0.1 ? `blur(${toFull * 10}px)` : "none" });
    // screens: studio taps; push to the review (with a scroll); push to the live render; the result
    studio.ims[1].style.opacity = pr(t, T.taps[0], T.taps[0] + 0.1); studio.ims[2].style.opacity = pr(t, T.taps[1], T.taps[1] + 0.1);
    const push1 = pr(t, 14.0, 14.42, E.inOutCubic), push2 = pr(t, 18.0, 18.42, E.inOutCubic), fade3 = pr(t, 22.0, 22.3, E.outCubic);
    S(studio.layer, { transform: `translateX(${-push1 * 30}%)`, display: push1 >= 1 ? "none" : "" }); studio.dim.style.opacity = push1 * 0.5;
    S(review.layer, { transform: `translateX(${(1 - push1) * 100 - push2 * 30}%)`, display: push1 <= 0 || push2 >= 1 ? "none" : "" }); review.dim.style.opacity = push2 * 0.5;
    review.set(pr(t, 15.7, 17.0, E.inOutCubic), boxes.reviewScroll || 0);
    S(job.layer, { transform: `translateX(${(1 - push2) * 100}%)`, display: push2 <= 0 || fade3 >= 1 ? "none" : "" });
    const jt = [18.0, ...T.checks, 21.6]; job.ims.forEach((im, k) => { im.style.opacity = k === 0 ? 1 : pr(t, jt[k], jt[k] + 0.14); });
    S(result.layer, { opacity: fade3, transform: `scale(${1.05 - 0.05 * fade3})`, display: fade3 <= 0 ? "none" : "" });
    // taps on Crypto, Quiz and Make my reel
    tapAnim(taps[0], ph, t, T.taps[0], boxes.crypto); tapAnim(taps[1], ph, t, T.taps[1], boxes.quiz); tapAnim(taps[2], ph, t, T.taps[2], boxes.go);
    if (boxes.go) { const g = boxes.go, k = pr(t, T.taps[2] - 0.05, T.taps[2] + 0.05) * (1 - pr(t, T.taps[2] + 0.25, T.taps[2] + 0.8));
      S(goGlow, { left: g.x / 393 * ph.sw + "px", top: g.y / 852 * ph.sh + "px", width: g.w / 393 * ph.sw + "px", height: g.h / 852 * ph.sh + "px", opacity: k }); }
    // text
    const blk = (b, tin, tout) => { wordsAnim(b.lab.ws, t, tin, tout, { st: 0.02, din: 0.5 }); wordsAnim(b.h.ws, t, tin + 0.06, tout, { st: 0.07 }); wordsAnim(b.s.ws, t, tin + 0.3, tout, { st: 0.018, din: 0.5 });
      b.box.style.display = t > tin - 0.05 && t < tout + 0.6 ? "" : "none"; };
    blk(b1, 10.08, 13.7); blk(b2, 14.06, 17.7); blk(b3, 18.06, 21.7);
    S(chips, { opacity: 1 - pr(t, 13.7, 13.95) });
    popIn(c1, t, T.taps[0] + 0.04, { from: 0.4 }); popIn(c2, t, T.taps[1] + 0.04, { from: 0.4 });
    doneBox.style.display = t > 21.95 ? "" : "none";
    const dc = doneMark.querySelector(".dc"), dk = doneMark.querySelector(".dk");
    dc.style.strokeDashoffset = 277 * (1 - pr(t, 22.0, 22.4, E.outCubic)); dk.style.strokeDashoffset = 70 * (1 - pr(t, 22.25, 22.5, E.outCubic));
    S(doneMark, { opacity: (t >= 22 ? 1 : 0) * (1 - pr(t, 23.55, 23.8)), transform: `scale(${0.6 + 0.4 * spring(t, 22.0, 2, 7)})` });
    wordsAnim(doneH.ws, t, 22.05, 23.55, { st: 0.05, din: 0.5 }); wordsAnim(doneS.ws, t, 22.35, 23.55, { st: 0.03 });
    // badges
    const bAnim = (b, at, until) => { const s = popIn(b, t, at, { from: 0.5 }); b.style.opacity = (t >= at ? clamp((t - at) / 0.08) : 0) * (1 - pr(t, until, until + 0.2)); b.style.display = t > at - 0.1 && t < until + 0.25 ? "" : "none";
      b.style.transform = `translateX(-50%) translateZ(${80 * s}px) scale(${0.5 + 0.5 * s})`; };
    bAnim(rb[0], 14.75, 17.6); bAnim(rb[1], 15.15, 17.6); bAnim(rb[2], 15.55, 17.6);
    pb.forEach((b, k) => bAnim(b, T.checks[k] + 0.02, 21.6));
  };
});

// 9. The finished reel, full screen, with its own narration.
scene(23.86, 28.1, (root) => {
  const fullH = L(960, H), fullW = fullH * 9 / 16;
  const bgFrame = img(root, frame("quiz_tiny", 0), { position: "absolute", left: "-5%", top: "-5%", width: "110%", height: "110%", objectFit: "cover", filter: "brightness(.42) saturate(1.2)", display: TALL ? "none" : "block" });
  const tile = mk(root, "tile", { width: fullW + "px", height: fullH + "px", left: W / 2 - fullW / 2 + "px", top: H / 2 - fullH / 2 + "px", borderRadius: L(26, 0) + "px" });
  const im = img(tile, frame("quiz_full", 0));
  const side = TALL ? null : words(root, "No editing. | No stock footage. | No voice actor.", "h2 abs", { left: "110px", width: "520px", top: H / 2 - 150 + "px", fontSize: "62px" });
  const sideR = TALL ? null : words(root, "Made | *entirely | by *ReelBot.", "h2 abs", { right: "110px", width: "470px", top: H / 2 - 110 + "px", fontSize: "62px", textAlign: "right" });
  const tag = pill(root, "Made with ReelBot · no editing", L(24, 30), { icon: "speaker" });
  S(tag, TALL ? { left: "50%", bottom: "120px" } : { left: "50%", bottom: "26px", display: "none" });
  return (t) => {
    const rt = Math.max(0, t - T.narr[0]);
    setSrc(im, frame("quiz_full", rt)); if (!TALL) setSrc(bgFrame, frame("quiz_tiny", rt));
    const inn = pr(t, 23.86, 24.16, E.outCubic), out = pr(t, 27.62, 28.08, E.inOutCubic);
    // out: shrink toward the first slot of the wall
    const slot = WALL_SLOTS[0];
    const sx = lerp(1, slot.w / fullW, out), cx = lerp(W / 2, slot.x + slot.w / 2, out), cy = lerp(H / 2, slot.y + slot.h / 2, out);
    S(tile, { transform: `translate(${cx - W / 2}px, ${cy - H / 2}px) scale(${lerp(0.62, 1, inn) * sx})`, opacity: inn, borderRadius: (TALL ? lerp(0, 22 / sx, out) : 26) + "px" });
    S(bgFrame, { opacity: inn * (1 - out) });
    if (side) { wordsAnim(side.ws, t, 24.45, 27.45, { st: 0.3, din: 0.6 }); wordsAnim(sideR.ws, t, 25.4, 27.45, { st: 0.12 }); }
    S(tag, { opacity: pr(t, 24.6, 24.9) * (1 - pr(t, 27.3, 27.6)), transform: `translateX(-50%) translateY(${(1 - pr(t, 24.6, 25.0, E.outCubic)) * 30}px)` });
  };
});

// 10. A wall of real reels.
const WALL = [["quiz_tile", "Quizzes", -0.15], ["market", "Market recaps", 0], ["explainer", "Explainers", 0], ["topic", "Any topic", 0]];
const WALL_SLOTS = (() => {
  if (!TALL) { const h = 560, w = h * 9 / 16, gap = 50, x0 = (W - (4 * w + 3 * gap)) / 2; return [0, 1, 2, 3].map((i) => ({ x: x0 + i * (w + gap), y: 290, w, h })); }
  const h = 650, w = h * 9 / 16, gap = 44, x0 = (W - (2 * w + gap)) / 2; return [0, 1, 2, 3].map((i) => ({ x: x0 + (i % 2) * (w + gap), y: 360 + Math.floor(i / 2) * (h + 96), w, h }));
})();
scene(27.6, 32.1, (root, persp) => {
  const title = words(root, TALL ? "Every format. | *Every *style." : "Every format. *Every *style.", "h1 abs", { left: 0, right: 0, textAlign: "center", top: L(110, 150) + "px", fontSize: L(84, 92) + "px" });
  const tiles = WALL.map(([name, label], i) => {
    const s = WALL_SLOTS[i]; const tl = mk(persp, "tile", { left: s.x + "px", top: s.y + "px", width: s.w + "px", height: s.h + "px" });
    const im = img(tl, frame(name, 0));
    const lab = mk(root, "label abs", { left: s.x - 40 + "px", width: s.w + 80 + "px", top: s.y + s.h + L(26, 22) + "px", fontSize: L(20, 24) + "px" }, label);
    return { tl, im, lab, name };
  });
  return (t) => {
    const fly = pr(t, 31.78, 32.1, E.inCubic);
    tiles.forEach((o, i) => {
      const s = WALL_SLOTS[i], at = i === 0 ? 28.0 : T.pops[i];
      const ry = L([16, 6, -6, -16][i], [8, -8, 8, -8][i]);
      const sp = i === 0 ? 1 : spring(t, at, 2.2, 6.5);
      const vis = i === 0 ? t >= 27.98 : t >= at;
      const local = i === 0 ? t - 27.75 + 3.6 - 3.75 : t - at;
      setSrc(o.im, frame(o.name, Math.max(0, local)));
      const drift = Math.sin(t * 1.1 + i) * 6;
      S(o.tl, { opacity: vis ? (i === 0 ? 1 : clamp((t - at) / 0.1)) * (1 - fly) : 0, filter: fly > 0 ? `blur(${fly * 16}px)` : "none",
        transform: `translateY(${drift + (1 - clamp(sp)) * 40}px) translateZ(${fly * 900}px) rotateY(${ry * clamp(sp)}deg) scale(${0.55 + 0.45 * sp})` });
      S(o.lab, { opacity: (vis ? pr(t, at + 0.1, at + 0.35) : 0) * (1 - pr(t, 31.7, 31.95)) });
    });
    wordsAnim(title.ws, t, T.wallTitle, 31.7, { st: 0.08 });
  };
});

// 11-16. Features, one per bar.
function featHead(root, text, sub, pos) {
  const box = mk(root, "abs", pos);
  const h = words(box, text, "h1", { fontSize: (pos.fs || L(86, 94)) + "px" });
  const s = sub ? words(box, sub, "sub", { fontSize: L(30, 34) + "px", marginTop: "22px" }) : null;
  return { box, h, s };
}
function featAnim(f, t, t0, t1) { wordsAnim(f.h.ws, t, t0 + 0.04, t1 - 0.3, { st: 0.06 }); if (f.s) wordsAnim(f.s.ws, t, t0 + 0.3, t1 - 0.3, { st: 0.02, din: 0.5 }); }
const centerTop = (top) => ({ left: "80px", right: "80px", top: top + "px", textAlign: "center" });

// F1: illustration styles
scene(31.95, 34.05, (root, persp) => {
  const f = featHead(root, "5 illustration *styles.", "Drawn on your phone, in your colours.", centerTop(L(80, 230)));
  const names = [["flat", "Flat"], ["neon", "Neon"], ["paper", "Paper cut"], ["blueprint", "Blueprint"], ["pop", "Pop art"]];
  const ch = L(560, 620), cw = ch * 9 / 16, cy = L(H / 2 + 120, H / 2 + 230);
  const cards = names.map(([k, n], i) => { const c = mk(persp, "tile", { width: cw + "px", height: ch + "px", left: W / 2 - cw / 2 + "px", top: cy - ch / 2 + "px", borderRadius: "20px" }); img(c, `assets/art_${k}.png`);
    const lp = pill(c, n, L(20, 24)); S(lp, { left: "50%", bottom: "16px", transform: "translateX(-50%)" }); return c; });
  return (t) => {
    featAnim(f, t, 32.0, 34.0);
    const out = pr(t, 33.75, 34.05, E.inCubic);
    cards.forEach((c, i) => {
      const k = i - 2, s = spring(t, 32.08 + Math.abs(k) * 0.07, 2, 6.5);
      const spread = L(cw * 0.78, cw * 0.5) * (0.9 + 0.1 * Math.sin(t * 1.4));
      S(c, { opacity: clamp((t - 32.08 - Math.abs(k) * 0.07) / 0.08) * (1 - out), zIndex: 10 - Math.abs(k),
        transform: `translate(${k * spread * clamp(s)}px, ${Math.abs(k) * 26 + (1 - clamp(s)) * 260 + out * 120}px) rotate(${k * 7 * clamp(s)}deg) scale(${0.85 + 0.15 * s})` });
    });
  };
});
// F2: voices
scene(33.95, 36.05, (root) => {
  const f = featHead(root, "9 natural *voices.", "And music that fits every video.", centerTop(L(130, 300)));
  const wrap = mk(root, "abs", { left: L(260, 60) + "px", right: L(260, 60) + "px", top: L(470, 820) + "px", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: L(18, 20) + "px" });
  const vs = ["Heart", "Michael", "Bella", "Fenrir", "Nicole", "Puck", "Emma", "George", "Fable"].map((n, i) => { const p = pill(wrap, n, L(30, 36), { icon: "mic" }); S(p, { position: "relative" }); if (i === 0) S(p, { borderColor: "rgba(250,204,21,.8)", boxShadow: "0 0 0 3px rgba(250,204,21,.2)" }); return p; });
  const wv = mk(root, "abs", { left: W / 2 - L(460, 420) + "px", width: L(920, 840) + "px", top: L(760, 1300) + "px", height: L(130, 150) + "px" });
  const bars = Array.from({ length: 46 }, (_, i) => mk(wv, "bar", { left: i * (L(920, 840) / 46) + "px", width: L(920, 840) / 46 * 0.55 + "px" }));
  return (t) => {
    featAnim(f, t, 34.0, 36.0);
    const out = pr(t, 35.75, 36.05);
    vs.forEach((p, i) => { popIn(p, t, 34.18 + i * 0.05, { from: 0.4 }); p.style.opacity = (t >= 34.18 + i * 0.05 ? 1 : 0) * (1 - out); });
    bars.forEach((b, i) => { const env = Math.sin(Math.PI * i / 45); const v = env * (0.25 + 0.75 * Math.abs(noise1(t * 7 + i * 0.6) * 0.6 + noise1(t * 13 + i * 1.3) * 0.4)) * pr(t, 34.3, 34.7) * (1 - out);
      S(b, { height: Math.max(6, v * L(130, 150)) + "px", bottom: (L(130, 150) - Math.max(6, v * L(130, 150))) / 2 + "px", opacity: 0.35 + 0.65 * env }); });
  };
});
// F3, F4: the week and the dashboard, in a browser window
function browserFeat(t0, t1, src, head, sub, mirror) {
  scene(t0 - 0.05, t1 + 0.05, (root, persp) => {
    const f = featHead(root, head, sub, TALL ? centerTop(300) : { left: mirror ? "1210px" : "110px", width: "630px", top: "370px" });
    const bw = L(1080, 980), br = browser(persp, bw, src);
    const bx = TALL ? W / 2 - bw / 2 : mirror ? 70 : W - bw - 70, by = TALL ? 730 : H / 2 - br.h / 2 + 10;
    S(br.root, { left: bx + "px", top: by + "px" });
    return (t) => {
      featAnim(f, t, t0, t1);
      const inn = pr(t, t0, t0 + 0.55, E.outExpo), out = pr(t, t1 - 0.26, t1 + 0.04, E.inCubic);
      const ry = TALL ? 0 : (mirror ? 1 : -1) * lerp(20, 9, pr(t, t0, t1)), rx = TALL ? lerp(16, 8, pr(t, t0, t1)) : 4;
      S(br.root, { opacity: pr(t, t0, t0 + 0.12) * (1 - out), filter: inn < 0.9 ? `blur(${(1 - inn) * 12}px)` : "none",
        transform: `translateX(${(TALL ? 0 : (mirror ? -1 : 1) * (1 - inn) * 400)}px) translateY(${(TALL ? (1 - inn) * 300 : 0) - out * 60}px) rotateY(${ry}deg) rotateX(${rx}deg) scale(${0.94 + 0.06 * inn})` });
    };
  });
}
browserFeat(36.0, 38.0, "ui/d_auto.png", "Plan your week | in *one *tap.", "Five fact-checked drafts, with calendar reminders.", false);
browserFeat(38.0, 40.0, "ui/d_home.png", "Your channel | at a *glance.", "Videos, queue, what's next, and what works.", true);
// F5: captions for every platform
scene(39.95, 42.05, (root, persp) => {
  const f = featHead(root, TALL ? "Captions for | TikTok, Instagram | & *YouTube." : "Captions for | TikTok, Instagram | & *YouTube.", "Copy, share, done.", TALL ? centerTop(170) : { left: "130px", width: "820px", top: "330px" });
  const ph = phone(persp, L(900, 1080)), PX = L(1350, W / 2), PY = L(H / 2 + 10, 1300); S(ph.root, { left: PX - ph.w / 2 + "px", top: PY - ph.h / 2 + "px" });
  const scr = scrollPair(ph, "ui/p_library.png", "ui/p_library_b.png", boxes.libBand || 852, boxes.topBand || 0);
  return (t) => {
    featAnim(f, t, 40.0, 42.0);
    const inn = pr(t, 40.0, 40.55, E.outExpo), out = pr(t, 41.75, 42.05, E.inCubic);
    S(ph.root, { opacity: pr(t, 40.0, 40.12) * (1 - out), transform: `translateY(${(1 - inn) * 400 + out * 80}px) rotateY(${L(-12, -4)}deg) rotateX(5deg) rotateZ(${(1 - inn) * 6}deg)` });
    scr.set(pr(t, 40.35, 41.7, E.inOutCubic), boxes.libScroll || 0);
  };
});
// F6: private by design
scene(41.95, 43.38, (root, persp) => {
  const f = featHead(root, "Runs on your *phone.", null, centerTop(L(110, 260)));
  const ph = phone(persp, L(660, 880)), PY = L(H / 2 + 150, H / 2 + 110); S(ph.root, { left: W / 2 - ph.w / 2 + "px", top: PY - ph.h / 2 + "px" });
  screenLayer(ph, ["ui/p_home.png"]);
  const ps = [["No account", "user"], ["No subscription", "card"], ["Works offline", "plane"]].map(([n, ic]) => pill(root, n, L(30, 36), { icon: ic }));
  const pos = TALL ? [[W / 2 - 250, 1660], [W / 2 + 230, 1660], [W / 2, 1770]] : [[W / 2 - 470, H / 2 + 60], [W / 2 + 470, H / 2 + 60], [W / 2, H / 2 + 450]];
  return (t) => {
    featAnim(f, t, 42.0, 43.38);
    const inn = pr(t, 42.0, 42.5, E.outExpo), out = pr(t, 43.12, 43.38, E.inCubic);
    S(ph.root, { opacity: pr(t, 42.0, 42.1) * (1 - out), transform: `translateY(${(1 - inn) * 200}px) scale(${0.9 + 0.1 * inn})` });
    S(ph.glow, { opacity: 1.2 });
    ps.forEach((p, i) => { const at = 42.25 + i * 0.16; popIn(p, t, at, { from: 0.4, base: `translate(-50%, -50%) translate(${pos[i][0]}px, ${pos[i][1]}px)` }); p.style.left = "0px"; p.style.top = "0px"; p.style.opacity = (t >= at ? 1 : 0) * (1 - out); });
  };
});

// 17. "The best part?" ... "Free."
scene(43.28, 44.02, (root) => {
  const q = words(root, "The best part?", "h2 abs", { left: 0, right: 0, textAlign: "center", top: H / 2 - L(40, 46) + "px", fontSize: L(76, 86) + "px", color: "#c9cedb" });
  return (t) => wordsAnim(q.ws, t, 43.32, 43.86, { st: 0.07, din: 0.4, dout: 0.14 });
});
scene(43.98, 46.08, (root) => {
  const fr = mk(root, "h1 abs y", { left: 0, right: 0, textAlign: "center", top: H / 2 - L(240, 270) + "px", fontSize: L(340, 360) + "px", textShadow: "0 0 80px rgba(250,204,21,.45)" }, "Free.");
  const sub = words(root, TALL ? "No subscriptions. | No paid APIs. | No catch." : "No subscriptions. No paid APIs. No catch.", "sub abs", { left: 0, right: 0, textAlign: "center", top: H / 2 + L(150, 170) + "px", fontSize: L(42, 50) + "px", color: "#e5e7ef", fontWeight: 600 });
  return (t) => {
    const p = pr(t, 44.0, 44.26, E.outExpo), out = pr(t, 45.78, 46.08, E.inCubic);
    S(fr, { opacity: pr(t, 44.0, 44.05) * (1 - out), filter: p < 1 ? `blur(${(1 - p) * 22}px)` : out > 0 ? `blur(${out * 14}px)` : "none", transform: `scale(${1.55 - 0.55 * p - 0.1 * out + 0.03 * Math.exp(-(t - 44) * 4) * Math.sin((t - 44) * 40)})` });
    wordsAnim(sub.ws, t, 44.45, 45.75, { st: 0.06 });
  };
});

// 18. Outro: the logo, the link, out now.
scene(45.95, 52.1, (root) => {
  const lk = lockup(root, { mark: L(170, 230), fs: L(170, 180), tagFs: L(40, 46), gap: L(40, 34), top: L(H / 2 - 100, H / 2 - 260), tagTop: L(H / 2 + 30, H / 2 + 170) });
  const url = pill(root, "linkplayt.github.io/FREELM", L(34, 40), { icon: "link" }); S(url, { left: "50%", top: L(H / 2 + 130, H / 2 + 300) + "px", fontFamily: "JetBrains Mono", fontWeight: 600, letterSpacing: "0.02em" });
  const now = mk(root, "mono abs", { left: 0, right: 0, textAlign: "center", top: L(H / 2 + 250, H / 2 + 440) + "px", fontSize: L(20, 24) + "px", color: "#8b93a8" }, "Out now · Version 47 · iPhone, Android & desktop");
  const shine = mk(root, "abs", { left: 0, top: L(H / 2 - 260, H / 2 - 520) + "px", width: W + "px", height: L(320, 520) + "px", background: "linear-gradient(100deg, rgba(255,255,255,0) 44%, rgba(255,255,255,.13) 50%, rgba(255,255,255,0) 56%)", mixBlendMode: "screen", webkitMaskImage: "radial-gradient(ellipse 34% 50% at 50% 50%, #000 30%, transparent 75%)" });
  return (t) => {
    const push = pr(t, 46.0, 52, E.lin), pulse = t >= T.finalHit ? 0.025 * Math.exp(-(t - T.finalHit) * 5) : 0;
    S(lk.lock, { transform: `translate(-50%, -50%) scale(${1 + push * 0.04 + pulse})` });
    logoAnim(lk.lg, t, 46.05);
    lk.wm.ls.forEach((l, i) => { const p = pr(t, 46.2 + i * 0.035, 46.7 + i * 0.035, E.outExpo); S(l, { transform: `translateY(${(1 - p) * 112}%)`, opacity: p > 0 ? 1 : 0 }); });
    wordsAnim(lk.tag.ws, t, 46.55, 1e9, { st: 0.05 });
    S(lk.tag.root, { transform: `scale(${1 + push * 0.03})` });
    S(url, { opacity: pr(t, 47.0, 47.25), transform: `translateX(-50%) translateY(${(1 - pr(t, 47.0, 47.4, E.outCubic)) * 30}px)` });
    S(now, { opacity: pr(t, 47.35, 47.7) * 0.95 });
    S(shine, { transform: `translateX(${lerp(-110, 110, pr(t, T.finalHit, T.finalHit + 0.9, E.inOutCubic))}%)`, opacity: t > T.finalHit && t < T.finalHit + 0.95 ? 1 : 0 });
  };
});

/* ---------------------------------------------------------------- overlays: grain, vignette, flash, fade */
const grain = mk(stage, "", { position: "absolute", inset: "-64px", pointerEvents: "none", opacity: 0.06 }); grain.id = "grain";
{ const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"), d = x.createImageData(256, 256), r = rng(3);
  for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0);
  grain.style.backgroundImage = `url(${c.toDataURL()})`; }
mk(stage, "", { id: "vig" }).id = "vig";
const flash = mk(stage, ""); flash.id = "flash";
const fade = mk(stage, ""); fade.id = "fade";
const IMPACTS = [[8.0, 0.85, 1], [44.0, 0.95, 1.3], [48.0, 0.32, 0.5], [22.0, 0.18, 0.25], [32.0, 0.22, 0.4], [28.0, 0.1, 0.25], [10.0, 0, 0.18], [14.0, 0, 0.12], [18.0, 0, 0.18]];

window.render = async function (t) {
  pending.length = 0;
  renderBg(t);
  for (const sc of SCENES) { const on = t >= sc.a && t < sc.b; sc.root.style.display = on ? "block" : "none"; if (on) sc.render(t); }
  let fl = 0, sx = 0, sy = 0;
  for (const [t0, f, s] of IMPACTS) { const k = t - t0; if (k >= 0 && k < 1.2) { fl = Math.max(fl, f * Math.exp(-k * 11)); const a = s * 16 * Math.exp(-k * 9); sx += noise1(t * 45 + t0) * a; sy += noise1(t * 39 + t0 * 3 + 7) * a; } }
  flash.style.opacity = fl;
  world.style.transform = `translate(${sx}px, ${sy}px)`;
  fade.style.opacity = pr(t, 51.55, 52.0) + (1 - pr(t, 0, 0.06));
  const fi = Math.floor(t * 30); grain.style.transform = `translate(${(hash(fi) * 64) | 0}px, ${(hash(fi + 0.5) * 64) | 0}px)`;
  await Promise.all(pending);
};
window.ready = (async () => {
  await document.fonts.ready;
  await Promise.all(Object.values(cache));
  return true;
})();
