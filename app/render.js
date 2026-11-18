// Draws every frame on a canvas and encodes the MP4 on the device.
//   Preferred: WebCodecs (H.264 + AAC) muxed with mp4-muxer: exact frames, usually faster than real time.
//   Fallback:  MediaRecorder, which records the canvas in real time.
import { emphasisOf } from "./hook.js";
import { SR } from "./music.js";
import { writeMov, pcm16Stereo } from "./mov.js";
import { StatBg, IllusBg, SectionBg, RecapBg, drawSource } from "./graphics.js";

export const W = 1080, H = 1920, FPS = 30;
const FONT_DIR = new URL("../assets/fonts/", import.meta.url).href;
const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function loadFonts() {
  const faces = [["Anton", "Anton-Regular.ttf", "400"], ["Montserrat", "Montserrat-ExtraBold.ttf", "800"], ["Montserrat", "Montserrat-Medium.ttf", "500"]];
  await Promise.all(faces.map(async ([family, file, weight]) => {
    const face = new FontFace(family, `url(${FONT_DIR}${file})`, { weight });
    document.fonts.add(await face.load());
  }));
}

function canvas(w, h) { const c = document.createElement("canvas"); c.width = Math.round(w); c.height = Math.round(h); return c; }
function hexToRgb(hex) { const n = parseInt(hex.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/* ------------------------------------------------------------------ scene backgrounds */

class ImageBg {
  constructor(bitmap) {
    const S = 1.18, bw = Math.round(W * S), bh = Math.round(H * S);
    this.S = S;
    const base = canvas(bw, bh), c = base.getContext("2d");
    c.imageSmoothingQuality = "high";
    const iw = bitmap.width, ih = bitmap.height;
    const cover = (ctx, dw, dh, cy = 0.5) => {
      const s = Math.max(dw / iw, dh / ih), sw = dw / s, sh = dh / s;
      ctx.drawImage(bitmap, (iw - sw) / 2, (ih - sh) * cy, sw, sh, 0, 0, dw, dh);
    };
    if (iw / ih > 0.72) {
      // Landscape or square: soft blurred backdrop (scaled up from a tiny copy) + the whole photo in the middle.
      // (An averaged blur at low resolution, then scaled up: smooth on every browser, no canvas filters.)
      const small = canvas(bw / 8, bh / 8);
      cover(small.getContext("2d"), small.width, small.height);
      const blur = canvas(small.width, small.height), bc = blur.getContext("2d");
      let n = 0;
      for (let dy = -8; dy <= 8; dy += 4) for (let dx = -8; dx <= 8; dx += 4) {
        bc.globalAlpha = 1 / ++n;            // running average of 25 shifted copies
        bc.drawImage(small, dx, dy);
      }
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
      c.drawImage(blur, 0, 0, bw, bh);
      c.fillStyle = "rgba(0,0,0,0.45)"; c.fillRect(0, 0, bw, bh);
      let fw = bw * 0.96, fh = ih * fw / iw;
      if (fh > bh * 0.62) { fh = bh * 0.62; fw = iw * fh / ih; }
      c.drawImage(bitmap, (bw - fw) / 2, bh * 0.47 - fh / 2, fw, fh);
    } else {
      cover(c, bw, bh, 0.4);
    }
    this.base = base;
    this.zoomIn = Math.random() < 0.65;
    this.pan = [Math.random() * 2 - 1, Math.random() * 2 - 1];
  }
  draw(ctx, p) {
    const bw = this.base.width, bh = this.base.height, e = ease(p);
    const z = 1 + (this.S - 1) * (this.zoomIn ? e : 1 - e);
    const cw = bw / z, ch = bh / z;
    const cx = bw / 2 + this.pan[0] * ((bw - cw) / 2) * (e - 0.5), cy = bh / 2 + this.pan[1] * ((bh - ch) / 2) * (e - 0.5);
    ctx.drawImage(this.base, cx - cw / 2, cy - ch / 2, cw, ch, 0, 0, W, H);
  }
  dispose() { this.base.width = this.base.height = 0; }
}

class ChartBg {
  constructor(chart) {
    let values = chart?.values;
    if (!values) { values = []; let v = 100; for (let i = 0; i < 60; i++) { v *= 1 + 0.004 + (Math.random() - 0.5) * 0.05; values.push(v); } }
    const up = values[values.length - 1] >= values[0];
    this.color = up ? [46, 213, 115] : [255, 71, 87];
    const bg = canvas(W, H), c = bg.getContext("2d");
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgb(8,12,28)"); g.addColorStop(1, "rgb(18,26,58)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const [x0, y0, x1, y1] = (this.box = [90, 640, W - 90, 1180]);
    c.strokeStyle = "rgba(255,255,255,0.09)"; c.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const y = y0 + (y1 - y0) * i / 5; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); }
    if (chart) {
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillStyle = "rgba(255,255,255,0.9)"; c.font = "800 54px Montserrat"; c.fillText(chart.name.toUpperCase(), W / 2, 455);
      const last = chart.last;
      let price = chart.is_yield ? `${last.toFixed(2)}%` : last.toLocaleString("en-US", { maximumFractionDigits: last >= 1000 ? 0 : 2, minimumFractionDigits: last >= 1000 ? 0 : 2 });
      if (["BTC-USD", "ETH-USD", "GC=F", "CL=F"].includes(chart.symbol)) price = "$" + price;
      c.fillStyle = "#fff"; c.font = "104px Anton"; c.fillText(price, W / 2, 548);
      const pc = chart.period_pct;
      c.fillStyle = rgba(this.color); c.font = "800 46px Montserrat";
      c.fillText(`${pc >= 0 ? "▲" : "▼"} ${Math.abs(pc).toFixed(1)}%  ·  3 MONTHS`, W / 2, 1235);
    }
    const lo = Math.min(...values), span = (Math.max(...values) - lo) || 1;
    this.points = values.map((v, i) => [x0 + (x1 - x0) * i / (values.length - 1), y1 - (y1 - y0) * (v - lo) / span]);
    this.bg = bg;
  }
  draw(ctx, p) {
    ctx.drawImage(this.bg, 0, 0);
    const n = Math.max(2, Math.floor(this.points.length * ease(Math.min(1, p / 0.75))));
    const pts = this.points.slice(0, n), yb = this.box[3];
    const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };
    path(); ctx.lineTo(pts[n - 1][0], yb); ctx.lineTo(pts[0][0], yb); ctx.closePath(); ctx.fillStyle = rgba(this.color, 0.16); ctx.fill();
    ctx.lineJoin = ctx.lineCap = "round";
    path(); ctx.strokeStyle = rgba(this.color, 0.35); ctx.lineWidth = 18; ctx.stroke();
    path(); ctx.strokeStyle = rgba(this.color); ctx.lineWidth = 8; ctx.stroke();
    const [x, y] = pts[n - 1], r = 14 + 4 * Math.sin(p * 20);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
  }
  dispose() { this.bg.width = this.bg.height = 0; }
}

// Offline background when a scene has no photo: drifting oversized type on a soft gradient.
class TypeBg {
  constructor(label, accent, seed = 0) {
    this.accent = accent; this.seed = seed;
    const hues = [[16, 22, 48], [30, 16, 46], [10, 32, 44], [36, 24, 20]][seed % 4];
    const bg = canvas(W, H), c = bg.getContext("2d");
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, `rgb(${hues.join(",")})`); g.addColorStop(1, "rgb(6,8,18)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    this.bg = bg;
    this.words = (label || "money").toUpperCase().split(/\s+/).filter(Boolean).slice(0, 4);
  }
  draw(ctx, p) {
    ctx.drawImage(this.bg, 0, 0);
    const t = p, a = this.accent;
    // Soft glowing blobs.
    for (let i = 0; i < 3; i++) {
      const x = W * (0.2 + 0.6 * ((i * 0.37 + this.seed * 0.13 + t * 0.15) % 1)), y = H * (0.25 + 0.5 * ((i * 0.53 + t * 0.1) % 1));
      const r = 380 + 120 * Math.sin(t * 3 + i);
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rgba(a, 0.22 - i * 0.05)); gr.addColorStop(1, rgba(a, 0));
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }
    // Giant outlined words, drifting sideways.
    ctx.save();
    ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    this.words.forEach((w, i) => {
      const size = 260 - i * 30;
      ctx.font = `${size}px Anton`;
      const width = ctx.measureText(w).width, dir = i % 2 ? -1 : 1;
      const x = W / 2 - width / 2 + dir * (t - 0.5) * 260;
      const y = 520 + i * (size * 0.95);
      ctx.lineWidth = 4; ctx.strokeStyle = rgba(a, 0.35 - i * 0.05); ctx.strokeText(w, x, y);
      ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fillText(w, x, y);
    });
    ctx.restore();
  }
  dispose() { this.bg.width = this.bg.height = 0; }
}

// Big words that appear as they're spoken: for the moments that matter (the bottom line, the question
// for the comments, a quiz question). The captions are hidden on these scenes: the words ARE the scene.
class KineticBg {
  constructor(words, accent, seed = 0, { top = 900, size = 108, label = "" } = {}) {
    this.words = words; this.accent = accent; this.t = 0; this.label = label;
    const bg = canvas(W, H), c = bg.getContext("2d");
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, "rgb(12,14,32)"); g.addColorStop(1, rgba(accent.map((v) => Math.round(v * 0.28))));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) { c.beginPath(); c.arc((seed * 197 + i * 331) % W, 300 + ((seed * 89 + i * 263) % 1300), 140 + (i * 53) % 200, 0, Math.PI * 2); c.fillStyle = rgba(accent, 0.05 + (i % 3) * 0.02); c.fill(); }
    this.bg = bg;
    // Lay the words out once: as big as fits in at most 6 lines.
    const m = canvas(10, 10).getContext("2d"), texts = words.map((w) => w.text.replace(/["“”]/g, "").toUpperCase());
    for (this.size = size; ; this.size -= 6) {
      m.font = `${this.size}px Anton`; const gap = this.size * 0.3, rows = [[]]; let x = 0;
      texts.forEach((tx, i) => { const w = m.measureText(tx).width; if (x + w > W - 150 && rows.at(-1).length) { rows.push([]); x = 0; } rows.at(-1).push([i, tx, w]); x += w + gap; });
      if (rows.length <= 5 || this.size <= 56) { this.rows = rows; this.gap = gap; break; }
    }
    this.top = top - (this.rows.length - 1) * this.size * 0.6;
    this.feel = words.map((w) => emphasisOf(w.text));
  }
  setTime(t) { this.t = t; }
  draw(ctx, p) {
    ctx.drawImage(this.bg, 0, 0);
    if (this.label) { ctx.save(); ctx.font = "800 46px Montserrat"; ctx.textAlign = "center"; ctx.fillStyle = rgba(this.accent); ctx.fillText(this.label, W / 2, this.top - this.size * 1.1); ctx.restore(); }
    ctx.save(); ctx.font = `${this.size}px Anton`; ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.lineJoin = "round";
    this.rows.forEach((row, r) => {
      const total = row.reduce((n, [, , w]) => n + w, 0) + this.gap * (row.length - 1);
      let x = (W - total) / 2; const y = this.top + r * this.size * 1.2;
      for (const [i, tx, w] of row) {
        const wd = this.words[i], age = this.t - wd.start;
        if (age < -0.02) { x += w + this.gap; continue; }                     // not said yet
        const k = Math.min(1, Math.max(0, age / 0.14)), s = 0.6 + 0.4 * ease(k) + (k < 1 ? 0.12 * Math.sin(Math.PI * k) : 0);
        const on = this.t >= wd.start && this.t < wd.end + 0.05;
        ctx.save(); ctx.globalAlpha = Math.min(1, 0.2 + k); ctx.translate(x + w / 2, y); ctx.scale(s, s);
        ctx.lineWidth = 14; ctx.strokeStyle = "rgba(0,0,0,0.85)"; ctx.strokeText(tx, -w / 2, 0);
        ctx.fillStyle = on ? rgba(this.accent) : this.feel[i] > 0 ? "rgb(74,222,128)" : this.feel[i] < 0 ? "rgb(255,92,92)" : "#fff";
        ctx.fillText(tx, -w / 2, 0); ctx.restore();
        x += w + this.gap;
      }
    });
    ctx.restore();
  }
  dispose() { this.bg.width = this.bg.height = 0; }
}

// A quiz question: "QUESTION 1 OF 3", "TRUE OR FALSE?", the statement word by word, then a 3-2-1 countdown.
class QuizBg extends KineticBg {
  constructor(words, accent, seed, { num, of, countStart, countEnd }) {
    super(words, accent, seed, { top: 960, size: 92 });
    this.num = num; this.of = of; this.countStart = countStart; this.countEnd = countEnd;
  }
  draw(ctx, p) {
    super.draw(ctx, p);
    ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "800 44px Montserrat"; ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.fillText(`QUESTION ${this.num} OF ${this.of}`, W / 2, 470);
    const pulse = 1 + 0.03 * Math.sin(this.t * 6);
    ctx.translate(W / 2, 580); ctx.scale(pulse, pulse); ctx.font = "120px Anton"; ctx.lineJoin = "round"; ctx.lineWidth = 16; ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.strokeText("TRUE OR FALSE?", 0, 0); ctx.fillStyle = rgba(this.accent); ctx.fillText("TRUE OR FALSE?", 0, 0);
    ctx.restore();
    // The countdown, in the pause after the question.
    const left = this.countEnd - this.t, span = this.countEnd - this.countStart;
    if (this.t >= this.countStart && left > 0) {
      const n = Math.min(3, Math.max(1, Math.ceil((left / span) * 3))), frac = ((left / span) * 3) % 1 || 1;
      const cx = W / 2, cy = 1450;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, 120, 0, Math.PI * 2); ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, 120, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / span)); ctx.lineWidth = 16; ctx.strokeStyle = rgba(this.accent); ctx.lineCap = "round"; ctx.stroke();
      const s = 0.8 + 0.4 * frac;
      ctx.translate(cx, cy); ctx.scale(s, s); ctx.font = "150px Anton"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff"; ctx.fillText(String(n), 0, 8);
      ctx.restore();
    }
  }
}

// The answer: TRUE or FALSE stamped on screen in green or red; the explanation runs in the captions.
class AnswerBg {
  constructor(answer, accent) {
    this.answer = answer; this.accent = accent;
    const col = answer ? [34, 160, 90] : [200, 50, 60];
    const bg = canvas(W, H), c = bg.getContext("2d");
    const g = c.createRadialGradient(W / 2, 760, 50, W / 2, 760, 1300); g.addColorStop(0, rgba(col)); g.addColorStop(1, "rgb(10,12,26)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    this.bg = bg; this.col = col;
  }
  draw(ctx, p) {
    ctx.drawImage(this.bg, 0, 0);
    const k = Math.min(1, p / 0.12), s = 1.7 - 0.7 * ease(k);
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.5); ctx.translate(W / 2, 720); ctx.rotate(-0.08); ctx.scale(s, s);
    // ✓ or ✗ in a circle, then the word
    ctx.beginPath(); ctx.arc(0, -170, 110, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.lineWidth = 26; ctx.lineCap = ctx.lineJoin = "round"; ctx.strokeStyle = rgba(this.col); ctx.beginPath();
    if (this.answer) { ctx.moveTo(-50, -170); ctx.lineTo(-12, -128); ctx.lineTo(56, -214); } else { ctx.moveTo(-44, -214); ctx.lineTo(44, -126); ctx.moveTo(44, -214); ctx.lineTo(-44, -126); }
    ctx.stroke();
    ctx.font = "230px Anton"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineWidth = 22; ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.strokeText(this.answer ? "TRUE" : "FALSE", 0, 60); ctx.fillStyle = "#fff"; ctx.fillText(this.answer ? "TRUE" : "FALSE", 0, 60);
    ctx.restore();
  }
  dispose() { this.bg.width = this.bg.height = 0; }
}

class OutroBg {
  constructor(brand, accent, handle = "") {
    this.accent = accent;
    const bg = canvas(W, H), c = bg.getContext("2d");
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgb(10,14,32)"); g.addColorStop(1, rgba(accent.map((v) => Math.round(v * 0.35))));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.textAlign = "center"; c.textBaseline = "middle";
    let size = 132; c.font = `${size}px Anton`;
    while (c.measureText(brand.toUpperCase()).width > W - 120 && size > 60) { size -= 6; c.font = `${size}px Anton`; }
    c.lineJoin = "round"; c.lineWidth = 8; c.strokeStyle = "rgba(0,0,0,0.8)"; c.strokeText(brand.toUpperCase(), W / 2, 640);
    c.fillStyle = rgba(accent); c.fillText(brand.toUpperCase(), W / 2, 640);
    if (handle) { c.fillStyle = "#fff"; c.font = "800 52px Montserrat"; c.fillText(handle, W / 2, 1010); }
    c.fillStyle = "rgba(255,255,255,0.6)"; c.font = "500 30px Montserrat"; c.fillText("NOT FINANCIAL ADVICE · FOR EDUCATION ONLY", W / 2, 1790);
    this.bg = bg;
  }
  draw(ctx, p) {
    ctx.drawImage(this.bg, 0, 0);
    const cx = W / 2, cy = 860, r = 70 + 10 * Math.sin(p * Math.PI * 4);
    ctx.beginPath(); ctx.arc(cx, cy, r + 18, 0, Math.PI * 2); ctx.strokeStyle = rgba(this.accent, 0.35); ctx.lineWidth = 6; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 70, 0, Math.PI * 2); ctx.fillStyle = rgba(this.accent); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 22, cy - 34); ctx.lineTo(cx - 22, cy + 34); ctx.lineTo(cx + 36, cy); ctx.closePath(); ctx.fillStyle = "rgb(10,14,32)"; ctx.fill();
  }
  dispose() { this.bg.width = this.bg.height = 0; }
}

/* ------------------------------------------------------------------ overlays + captions */

function wrap(c, text, maxWidth) {
  const lines = []; let cur = "";
  for (const w of text.split(/\s+/)) {
    const trial = (cur + " " + w).trim();
    if (c.measureText(trial).width <= maxWidth) cur = trial; else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

function overlay(title, brand, accent, handle = "", logo = null) {
  const ov = canvas(W, H), c = ov.getContext("2d");
  let g = c.createLinearGradient(0, 0, 0, 560); g.addColorStop(0, "rgba(0,0,0,0.69)"); g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g; c.fillRect(0, 0, W, 560);
  g = c.createLinearGradient(0, H - 1000, 0, H); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.73)");
  c.fillStyle = g; c.fillRect(0, H - 1000, W, 1000);
  c.textAlign = "center"; c.textBaseline = "middle";
  if (brand) {
    c.font = "800 34px Montserrat";
    const tw = c.measureText(brand.toUpperCase()).width, px = W / 2, py = 150;
    c.fillStyle = rgba(accent); c.beginPath(); c.roundRect(px - tw / 2 - 28, py - 32, tw + 56, 64, 32); c.fill();
    c.fillStyle = "rgb(12,12,20)"; c.fillText(brand.toUpperCase(), px, py + 2);
  }
  if (logo) {                                       // your logo, top-left, fitted in a 120 px square
    const s = Math.min(120 / logo.width, 120 / logo.height), w = logo.width * s, h = logo.height * s;
    c.save(); c.globalAlpha = 0.92; c.shadowColor = "rgba(0,0,0,0.6)"; c.shadowBlur = 14;
    c.drawImage(logo, 56 + (120 - w) / 2, 90 + (120 - h) / 2, w, h); c.restore();
  }
  if (handle) {
    c.font = "800 34px Montserrat"; c.textAlign = "center";
    c.shadowColor = "rgba(0,0,0,0.8)"; c.shadowBlur = 12;
    c.fillStyle = "rgba(255,255,255,0.9)"; c.fillText(handle, W / 2, H - 70);
    c.shadowColor = "transparent"; c.shadowBlur = 0;
  }
  if (title) {
    c.font = "800 60px Montserrat"; c.lineJoin = "round"; c.lineWidth = 10; c.strokeStyle = "#000"; c.fillStyle = "#fff";
    wrap(c, title, W - 140).slice(0, 2).forEach((ln, i) => { c.strokeText(ln, W / 2, 250 + i * 76); c.fillText(ln, W / 2, 250 + i * 76); });
  }
  return ov;
}

export function chunkWords(words, maxWords = 3, maxChars = 16) {
  const chunks = []; let cur = [];
  words.forEach((w, i) => {
    const len = cur.reduce((n, j) => n + words[j].text.length + 1, 0);
    if (cur.length && (cur.length >= maxWords || len + w.text.length > maxChars)) { chunks.push(cur); cur = []; }
    cur.push(i);
    if (/[.!?,:;]$/.test(w.text)) { chunks.push(cur); cur = []; }
  });
  if (cur.length) chunks.push(cur);
  return chunks;
}

// Caption styles: "bold" (big outlined words), "boxed" (words on a dark card, the spoken word on
// a coloured chip) and "clean" (sentence case with a soft shadow).
class Captions {
  constructor(words, accent, style = "bold") {
    this.words = words; this.accent = accent; this.style = style; this.chunks = chunkWords(words);
    // Words that carry the meaning get a colour of their own: money and growth in green, risk in red.
    this.feel = words.map((w) => emphasisOf(w.text));
    this.times = this.chunks.map((ch, k) => {
      const start = words[ch[0]].start, lastEnd = words[ch[ch.length - 1]].end;
      const end = k + 1 < this.chunks.length ? words[this.chunks[k + 1][0]].start : lastEnd + 0.3;
      return [start, Math.min(end, lastEnd + 0.35)];
    });
    this.layout = new Map();
  }
  font(size) { return this.style === "clean" ? `800 ${size}px Montserrat` : `${size}px Anton`; }
  draw(ctx, t, centerY) {
    const k = this.times.findIndex(([s, e]) => t >= s && t < e);
    if (k < 0) return;
    const idxs = this.chunks[k];
    let lay = this.layout.get(k);
    if (!lay) {
      const texts = idxs.map((i) => { const x = this.words[i].text.replace(/["“”]/g, ""); return this.style === "clean" ? x : x.toUpperCase(); });
      let size = { bold: 118, boxed: 100, clean: 92 }[this.style] || 118, widths, total;
      const maxW = this.style === "bold" ? W - 120 : W - 200;
      for (;;) {
        ctx.font = this.font(size);
        widths = texts.map((x) => ctx.measureText(x).width);
        total = widths.reduce((a, b) => a + b, 0) + size * 0.32 * (texts.length - 1);
        if (total <= maxW || size <= 54) break;
        size -= 6;
      }
      lay = { texts, size, widths, total }; this.layout.set(k, lay);
    }
    let active = idxs.find((i) => t >= this.words[i].start && t < this.words[i].end + 0.05);
    if (active === undefined) active = t >= this.words[idxs[idxs.length - 1]].start ? idxs[idxs.length - 1] : idxs[0];
    const age = t - this.times[k][0], s = age < 0.12 ? 0.82 + 0.18 * ease(age / 0.12) : 1;
    const gap = lay.size * 0.32;
    ctx.save();
    ctx.translate(W / 2, centerY); ctx.scale(s, s);
    ctx.font = this.font(lay.size); ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    if (this.style === "boxed") {
      const padX = 34, h = lay.size * 1.35;
      ctx.fillStyle = "rgba(10,12,22,0.78)";
      ctx.beginPath(); ctx.roundRect(-lay.total / 2 - padX, -h / 2, lay.total + padX * 2, h, 22); ctx.fill();
    }
    if (this.style === "clean") {
      // A soft translucent backing keeps light text readable on bright photos.
      const padX = 44, h = lay.size * 1.6;
      ctx.fillStyle = "rgba(0,0,0,0.42)";
      ctx.beginPath(); ctx.roundRect(-lay.total / 2 - padX, -h / 2, lay.total + padX * 2, h, h / 2); ctx.fill();
      ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 3;
    }
    let x = -lay.total / 2;
    lay.texts.forEach((txt, j) => {
      const on = idxs[j] === active, feel = this.feel[idxs[j]];
      const tone = feel > 0 ? "rgb(74,222,128)" : feel < 0 ? "rgb(255,92,92)" : "#fff";
      // The spoken word grows a little as it's said.
      const grow = on ? 1 + 0.05 * Math.min(1, (t - this.words[idxs[j]].start) / 0.08) : 1;
      ctx.save();
      if (grow !== 1) { const cx = x + lay.widths[j] / 2; ctx.translate(cx, 0); ctx.scale(grow, grow); ctx.translate(-cx, 0); }
      if (this.style === "bold") {
        ctx.lineWidth = 18; ctx.strokeStyle = "#000"; ctx.strokeText(txt, x, 0);
        ctx.fillStyle = on ? rgba(this.accent) : tone;
      } else if (this.style === "boxed") {
        if (on) {
          const ph = lay.size * 1.16;
          ctx.fillStyle = rgba(this.accent); ctx.beginPath(); ctx.roundRect(x - 12, -ph / 2 + lay.size * 0.03, lay.widths[j] + 24, ph, 14); ctx.fill();
        }
        ctx.fillStyle = on ? "rgb(14,14,22)" : tone;
      } else {
        ctx.fillStyle = on ? rgba(this.accent) : tone;
      }
      ctx.fillText(txt, x, lay.size * (this.style === "clean" ? 0.04 : 0.02));
      ctx.restore();
      x += lay.widths[j] + gap;
    });
    ctx.restore();
  }
}

// A label for the moment ("THE CATCH", "WHAT TO DO"): it pops in under the title, tilted like a sticker.
function drawChip(ctx, text, into, left, accent, tone) {
  const a = Math.min(1, into / 0.12) * Math.min(1, Math.max(0, left / 0.2));
  if (a <= 0) return;
  const s = into < 0.25 ? 0.6 + 0.4 * ease(into / 0.25) + 0.08 * Math.sin(Math.PI * Math.min(1, into / 0.25)) : 1;
  ctx.save();
  ctx.globalAlpha = a; ctx.translate(W / 2, 360); ctx.rotate(-0.04); ctx.scale(s, s);
  ctx.font = "800 54px Montserrat"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + 70, h = 92;
  ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.fillStyle = tone === "down" ? "rgb(255,92,92)" : tone === "tip" ? "rgb(74,222,128)" : rgba(accent);
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 20); ctx.fill();
  ctx.shadowColor = "transparent"; ctx.fillStyle = "rgb(12,12,20)"; ctx.fillText(text, 0, 4);
  ctx.restore();
}

// A big animated callout for the key number in a scene ("20%", "$1,000", "3–6 MONTHS").
function drawStatPop(ctx, text, into, left, y, accent) {
  const appear = 0.15;
  if (into < appear) return;
  const a = into - appear;
  const scale = a < 0.18 ? 0.4 + 0.75 * ease(a / 0.18) : a < 0.32 ? 1.15 - 0.15 * ease((a - 0.18) / 0.14) : 1;
  const alpha = Math.min(1, a / 0.12) * Math.min(1, Math.max(0, left / 0.25));
  if (alpha <= 0) return;
  let size = 230;
  ctx.font = `${size}px Anton`;
  while (ctx.measureText(text).width > W - 160 && size > 90) { size -= 10; ctx.font = `${size}px Anton`; }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(W / 2, y); ctx.rotate(-0.045); ctx.scale(scale, scale);
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  ctx.lineWidth = 22; ctx.strokeStyle = "rgb(10,12,22)"; ctx.strokeText(text, 0, 0);
  ctx.shadowColor = "transparent";
  ctx.fillStyle = rgba(accent); ctx.fillText(text, 0, 0);
  ctx.restore();
}

/* ------------------------------------------------------------------ frame painter */

class Painter {
  constructor(job, target) {
    this.job = job;
    this.accent = hexToRgb(job.accent || "#FFD60A");
    this.total = job.scenes[job.scenes.length - 1].end;
    this.header = overlay(job.title, job.brand, this.accent, job.handle, job.logo);
    this.plain = overlay("", "", this.accent, "", job.logo);
    this.captions = new Captions(job.words, this.accent, job.captionStyle);
    this.captionY = job.captionPos === "middle" ? 1000 : 1440;
    this.popY = job.captionPos === "middle" ? 1430 : 1150;
    this.snap = canvas(W, H);
    this.hasSnap = false; this.idx = -1; this.bg = null;
    this.ctx = target.getContext("2d", { alpha: false });
    this.k = target.width / W;
  }
  makeBg(sc) {
    try {
      if (sc.kind === "image" && sc.bitmap) return new ImageBg(sc.bitmap);
      if (sc.kind === "outro") return new OutroBg(this.job.brand, this.accent, this.job.handle);
      const said = () => this.job.words.filter((w) => w.start >= sc.start - 0.05 && w.start < sc.end);
      if (sc.kind === "kinetic") return new KineticBg(said(), this.accent, sc.seed || 0, { label: sc.tone === "question" ? "YOUR TURN" : "" });
      if (sc.kind === "quiz") { const w = said(), k = w.findIndex((x) => /^false:?$/i.test(x.text.replace(/[^a-z:]/gi, ""))); return new QuizBg(k >= 0 ? w.slice(k + 1) : w, this.accent, sc.seed || 0, sc); }
      if (sc.kind === "answer") return new AnswerBg(sc.answer, this.accent);
      if (sc.kind === "chart") return new ChartBg(sc.chart);
      if (sc.kind === "stat" && sc.spec) return new StatBg(sc.spec, this.accent, this.job.captionPos, sc.seed || 0);
      if (sc.kind === "illus") return new IllusBg(sc.icon, sc.label, this.accent, this.job.captionPos, sc.seed || 0);
      if (sc.kind === "section") return new SectionBg(sc.num, sc.label, this.accent, sc.seed || 0);
      if (sc.kind === "recap") return new RecapBg(sc.items || [], this.accent, sc.seed || 0);
    } catch (e) { console.warn("scene fallback", e); }
    return sc.label ? new TypeBg(sc.label, this.accent, sc.seed || 0) : new ChartBg(null);
  }
  paint(t) {
    const { scenes } = this.job, ctx = this.ctx;
    let idx = scenes.findIndex((s) => t >= s.start && t < s.end);
    if (idx < 0) idx = scenes.length - 1;
    const sc = scenes[idx];
    if (idx !== this.idx) {
      if (this.bg) {   // keep the old scene's final look for the crossfade
        const sctx = this.snap.getContext("2d"); this.bg.draw(sctx, 1); this.hasSnap = true; this.bg.dispose();
      }
      this.bg = this.makeBg(sc); this.idx = idx;
    }
    const into = t - sc.start;
    // A quick punch-in as each scene starts (harder on the hook and on the payoff), like an edited video.
    const punch = ["outro", "recap", "section", "kinetic", "quiz"].includes(sc.kind) ? 0 : idx === 0 || sc.payoff || sc.kind === "answer" ? 0.1 : 0.04;
    const z = punch && into < 0.35 ? 1 + punch * (1 - ease(into / 0.35)) : 1;
    // ...and a short shake when the payoff hits.
    const shake = sc.payoff && into < 0.22 ? 14 * (1 - into / 0.22) : 0;
    const sx = shake * Math.sin(into * 97), sy = shake * Math.cos(into * 83);
    ctx.setTransform(this.k * z, 0, 0, this.k * z, this.k * (W * (1 - z) / 2 + sx), this.k * (H * (1 - z) / 2 + sy));
    this.bg.setTime?.(t);
    this.bg.draw(ctx, (t - sc.start) / Math.max(0.001, sc.end - sc.start));
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    // A white flash on the payoff, so the moment the video promised feels like one.
    if (sc.payoff && into < 0.18) { ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - into / 0.18)})`; ctx.fillRect(0, 0, W, H); }
    if (this.hasSnap && idx > 0 && into < 0.25) { ctx.globalAlpha = 1 - ease(into / 0.25); ctx.drawImage(this.snap, 0, 0); ctx.globalAlpha = 1; }
    ctx.drawImage(sc.kind === "outro" ? this.plain : this.header, 0, 0);
    if (sc.stat && !["outro", "chart", "stat"].includes(sc.kind)) drawStatPop(ctx, sc.stat, into, sc.end - t, this.popY, this.accent);
    if (sc.chip) drawChip(ctx, sc.chip, into, sc.end - t, this.accent, sc.tone);
    if (sc.source) drawSource(ctx, sc.source, Math.min(1, into / 0.3) * Math.min(1, (sc.end - t) / 0.2));
    if (!["recap", "kinetic", "quiz"].includes(sc.kind)) this.captions.draw(ctx, t, sc.kind === "outro" ? 1180 : sc.kind === "section" ? 1520 : this.captionY);
    ctx.fillStyle = rgba(this.accent); ctx.fillRect(0, H - 12, W * (t / this.total), 12);
  }
  dispose() { this.bg?.dispose(); for (const c of [this.header, this.plain, this.snap]) c.width = c.height = 0; }
}

// Draws a single frame of a job onto a canvas (used for the style preview).
export function previewFrame(job, target, t) {
  const painter = new Painter(job, target);
  painter.paint(t);
  painter.dispose();
}

/* ------------------------------------------------------------------ encoders */

async function pickVideoConfig(testCodec) {
  if (typeof VideoEncoder === "undefined") return null;
  // H.264 is what phones and every social app expect. ("vp9" exists only to test this code path
  // in browsers that ship without an H.264 encoder.)
  const options = testCodec === "vp9" ? [[1080, 1920, "vp09.00.40.08", 5e6]]
    : [[1080, 1920, "avc1.640028", 5e6], [1080, 1920, "avc1.4d0028", 5e6], [1080, 1920, "avc1.42002a", 5e6],
       [720, 1280, "avc1.4d001f", 3e6], [720, 1280, "avc1.42001f", 3e6]];
  for (const [width, height, codec, bitrate] of options) {
    const cfg = { codec, width, height, bitrate, framerate: FPS, ...(codec.startsWith("avc") ? { avc: { format: "avc" } } : {}) };
    try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch { /* try next */ }
  }
  return null;
}
async function pickAudioConfig(testCodec) {
  if (typeof AudioEncoder === "undefined") return null;
  const cfg = { codec: testCodec === "vp9" ? "opus" : "mp4a.40.2", sampleRate: SR, numberOfChannels: 2, bitrate: 128000 };
  try { if ((await AudioEncoder.isConfigSupported(cfg)).supported) return cfg; } catch { /* unsupported */ }
  return null;
}

export async function encoderInfo() {
  const [v, a] = await Promise.all([pickVideoConfig(), pickAudioConfig()]);
  return { webcodecs: Boolean(v), video: v, aac: Boolean(a), recorder: typeof MediaRecorder !== "undefined" };
}

// Strip an ADTS header if the encoder added one (an MP4 file needs raw AAC frames).
function rawAac(bytes) {
  if (bytes.length > 7 && bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) {
    const protectionAbsent = bytes[1] & 0x01;
    return bytes.subarray(protectionAbsent ? 7 : 9);
  }
  return bytes;
}

function audioDataFor(audio, off, n) {
  const ts = Math.round(off / SR * 1e6), mono = audio.subarray(off, off + n);
  try {
    const planar = new Float32Array(n * 2); planar.set(mono, 0); planar.set(mono, n);
    return new AudioData({ format: "f32-planar", sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: ts, data: planar });
  } catch {
    const inter = new Float32Array(n * 2);                       // some browsers only take interleaved samples
    for (let i = 0; i < n; i++) { inter[2 * i] = mono[i]; inter[2 * i + 1] = mono[i]; }
    return new AudioData({ format: "f32", sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: ts, data: inter });
  }
}

async function encodeWebCodecs(job, target, vcfg, acfg, onProgress) {
  target.width = vcfg.width; target.height = vcfg.height;
  const painter = new Painter(job, target);
  const isAac = acfg.codec !== "opus";
  // The MP4 muxer is only needed on this fallback path, so it loads here rather than at startup.
  const { Muxer, ArrayBufferTarget } = await import("./vendor/mp4-muxer.mjs");
  const muxer = new Muxer({ target: new ArrayBufferTarget(), fastStart: "in-memory",
    // Encoders may start audio at a non-zero time (priming); shift each track so it starts at zero.
    firstTimestampBehavior: "offset",
    video: { codec: vcfg.codec.startsWith("avc") ? "avc" : "vp9", width: vcfg.width, height: vcfg.height, frameRate: FPS },
    audio: { codec: isAac ? "aac" : "opus", numberOfChannels: 2, sampleRate: SR } });
  let failure = null, audioChunks = 0, audioBytes = 0;
  const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failure = e; } });
  venc.configure(vcfg);
  const aenc = new AudioEncoder({
    output: (chunk, meta) => {
      try {
        const buf = new Uint8Array(chunk.byteLength); chunk.copyTo(buf);
        const data = isAac ? rawAac(buf) : buf;
        if (!data.length) return;
        const m = meta?.decoderConfig?.description ? meta : undefined;   // otherwise the muxer writes a standard AAC-LC config
        muxer.addAudioChunkRaw(data, "key", Math.max(0, chunk.timestamp), chunk.duration ?? 0, m);
        audioChunks++; audioBytes += data.length;
      } catch (e) { failure = e; }
    },
    error: (e) => { failure = e; },
  });
  aenc.configure(isAac ? { ...acfg, aac: { format: "aac" } } : acfg);

  const audio = job.audio, step = 4800;
  for (let off = 0; off < audio.length; off += step) {
    const data = audioDataFor(audio, off, Math.min(step, audio.length - off));
    aenc.encode(data); data.close();
  }
  const frames = Math.ceil(painter.total * FPS);
  for (let i = 0; i < frames; i++) {
    if (failure) throw failure;
    painter.paint(i / FPS);
    const frame = new VideoFrame(target, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
    venc.encode(frame, { keyFrame: i % (FPS * 2) === 0 }); frame.close();
    while (venc.encodeQueueSize > 4) await sleep(4);       // don't outrun the encoder (keeps memory flat)
    if (i % 5 === 0) { onProgress?.(i / frames); await sleep(0); }
  }
  await venc.flush(); await aenc.flush();
  if (failure) throw failure;
  // ~128 kbps for the whole reel; far less means the encoder produced (almost) nothing.
  if (audioChunks < 10 || audioBytes < painter.total * 2000) throw new Error(`audio encoder produced no usable audio (${audioChunks} chunks)`);
  muxer.finalize(); venc.close(); aenc.close(); painter.dispose();
  return { blob: new Blob([muxer.target.buffer], { type: "video/mp4" }), ext: "mp4", how: `encoded on-device, ${vcfg.width}×${vcfg.height}` };
}

// Make sure audio is actually running (iOS keeps it suspended until a tap unlocks it).
async function ensureRunning(audioCtx) {
  for (let i = 0; i < 30 && audioCtx.state !== "running"; i++) {
    try { await audioCtx.resume(); } catch { /* retry */ }
    if (audioCtx.state !== "running") await sleep(100);
  }
  if (audioCtx.state !== "running") throw new Error("Sound is blocked by the browser. Tap “Make the video” again, and make sure no call or other app is using audio.");
}

async function encodeRecorder(job, target, audioCtx, onProgress) {
  if (!audioCtx) throw new Error("This browser can't record sound.");
  await ensureRunning(audioCtx);
  target.width = W; target.height = H;
  const painter = new Painter(job, target);
  painter.paint(0);
  const stream = target.captureStream(FPS);
  const buf = audioCtx.createBuffer(1, job.audio.length, SR); buf.copyToChannel(job.audio, 0);
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const dest = audioCtx.createMediaStreamDestination(); src.connect(dest);
  // WebKit only processes an audio graph that reaches the speaker output; route it there inaudibly.
  const keepAlive = audioCtx.createGain(); keepAlive.gain.value = 0.0001;
  src.connect(keepAlive); keepAlive.connect(audioCtx.destination);
  const track = dest.stream.getAudioTracks()[0];
  if (!track) throw new Error("This browser can't record sound.");
  stream.addTrack(track);
  const mime = ['video/mp4;codecs="avc1.640028,mp4a.40.2"', 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', "video/mp4;codecs=avc1", "video/mp4",
                "video/webm;codecs=vp9,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5e6, audioBitsPerSecond: 128000 });
  const parts = []; rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  const done = new Promise((res, rej) => { rec.onstop = res; rec.onerror = (e) => rej(e.error || new Error("recording failed")); });
  rec.start(1000); src.start();
  const t0 = audioCtx.currentTime;
  let lastT = -1, stalledSince = performance.now();
  try {
    await new Promise((res, rej) => {
      const tick = () => {
        const t = audioCtx.currentTime - t0;
        if (t >= painter.total) return res();
        if (t > lastT) { lastT = t; stalledSince = performance.now(); }
        else if (performance.now() - stalledSince > 4000) return rej(new Error("Sound stopped while recording (the app may have gone to the background). Keep the screen open and try again."));
        painter.paint(Math.max(0, t)); onProgress?.(t / painter.total);
        requestAnimationFrame(tick);
      };
      tick();
    });
  } finally {
    if (rec.state !== "inactive") rec.stop();
    await done.catch(() => {});
    try { src.stop(); } catch { /* already stopped */ }
    src.disconnect(); keepAlive.disconnect(); stream.getTracks().forEach((tr) => tr.stop()); painter.dispose();
  }
  const type = (mime || "video/mp4").split(";")[0];
  return { blob: new Blob(parts, { type }), ext: type.includes("mp4") ? "mp4" : "webm", how: "recorded in real time" };
}

// Preferred: the browser encodes only the picture (H.264); the soundtrack is written into a
// QuickTime file as uncompressed PCM, so it never depends on the browser's audio encoder or recorder.
async function encodeH264Pcm(job, target, vcfg, onProgress) {
  target.width = vcfg.width; target.height = vcfg.height;
  const painter = new Painter(job, target);
  const chunks = []; let description = null, failure = null;
  const venc = new VideoEncoder({
    output: (chunk, meta) => {
      if (meta?.decoderConfig?.description && !description) description = new Uint8Array(meta.decoderConfig.description.slice(0));
      const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
      chunks.push({ data, timestamp: chunk.timestamp, key: chunk.type === "key" });
    },
    error: (e) => { failure = e; },
  });
  venc.configure(vcfg);
  const frames = Math.ceil(painter.total * FPS);
  for (let i = 0; i < frames; i++) {
    if (failure) throw failure;
    painter.paint(i / FPS);
    const frame = new VideoFrame(target, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
    venc.encode(frame, { keyFrame: i % (FPS * 2) === 0 }); frame.close();
    while (venc.encodeQueueSize > 4) await sleep(4);       // don't outrun the encoder (keeps memory flat)
    if (i % 5 === 0) { onProgress?.(i / frames); await sleep(0); }
  }
  await venc.flush(); venc.close(); painter.dispose();
  if (failure) throw failure;
  if (!description) throw new Error("the video encoder gave no H.264 configuration");
  if (chunks.length < frames * 0.9) throw new Error(`the video encoder dropped frames (${chunks.length}/${frames})`);
  const { parts } = writeMov({
    video: { width: vcfg.width, height: vcfg.height, fps: FPS, description, chunks },
    audio: { sampleRate: SR, channels: 2, pcm: pcm16Stereo(job.audio) },
  });
  let peak = 0; for (let i = 0; i < job.audio.length; i += 16) peak = Math.max(peak, Math.abs(job.audio[i]));
  return { blob: new Blob(parts, { type: "video/quicktime" }), ext: "mov", how: `encoded on-device, ${vcfg.width}×${vcfg.height}, uncompressed sound`,
    written: { seconds: job.audio.length / SR, peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity } };
}

// Decode the finished file and check it really contains sound: true, false, or null (can't tell).
export async function hasSound(blob) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) return null;
  try {
    const bytes = await blob.arrayBuffer();
    const ctx = new OAC(1, 1, 44100);
    const audio = await new Promise((res, rej) => { const p = ctx.decodeAudioData(bytes, res, rej); if (p?.then) p.then(res, rej); });
    if (!audio || audio.duration < 1) return false;
    let peak = 0;
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const d = audio.getChannelData(c);
      for (let i = 0; i < d.length; i += 64) peak = Math.max(peak, Math.abs(d[i]));
    }
    return peak > 0.02;
  } catch (e) {
    console.warn("couldn't decode the result to check its sound", e);
    return null;
  }
}

// job: { title, brand, accent, scenes:[{start,end,kind,bitmap?,chart?}], words:[{text,start,end}], audio: Float32Array @ SR }
// Returns { blob, ext, how, sound: true | false | null }.
export async function renderReel(job, target, audioCtx, onProgress, force) {
  const test = force === "vp9" ? "vp9" : undefined;
  const [vcfg, acfg] = await Promise.all([pickVideoConfig(test), pickAudioConfig(test)]);
  let silent = null;
  if (vcfg && vcfg.codec.startsWith("avc") && !["recorder", "aac"].includes(force)) {
    try {
      const r = await encodeH264Pcm(job, target, vcfg, onProgress);
      // We wrote the sound ourselves, so "can't check" is fine here; only a confirmed silence is not.
      r.sound = await hasSound(r.blob);
      if (r.sound !== false) return r;
      silent = r;
      console.warn("The QuickTime file decoded as silent; trying the other methods");
    } catch (e) { console.warn("H.264 + PCM failed; trying the other methods", e); }
  }
  if (vcfg && acfg && force !== "recorder") {
    try {
      const r = await encodeWebCodecs(job, target, vcfg, acfg, onProgress);
      r.sound = await hasSound(r.blob);
      if (r.sound !== false) return r;
      silent ??= r;
      console.warn("The encoded video has no sound; trying real-time recording instead");
    } catch (e) { console.warn("WebCodecs failed; falling back to real-time recording", e); }
  }
  if (typeof MediaRecorder === "undefined" || !audioCtx) {
    if (silent) return silent;
    throw new Error("This browser can't encode video. Update iOS, or try Safari.");
  }
  onProgress?.(0);
  const r = await encodeRecorder(job, target, audioCtx, onProgress);
  r.sound = await hasSound(r.blob);
  return r;
}
