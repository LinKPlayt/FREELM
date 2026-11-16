// Draws every frame on a canvas and encodes the MP4 on the device.
//   Preferred: WebCodecs (H.264 + AAC) muxed with mp4-muxer: exact frames, usually faster than real time.
//   Fallback:  MediaRecorder, which records the canvas in real time.
import { Muxer, ArrayBufferTarget } from "./vendor/mp4-muxer.mjs";
import { SR } from "./music.js";
import { writeMov, pcm16Stereo } from "./mov.js";

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

class OutroBg {
  constructor(brand, accent) {
    this.accent = accent;
    const bg = canvas(W, H), c = bg.getContext("2d");
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgb(10,14,32)"); g.addColorStop(1, rgba(accent.map((v) => Math.round(v * 0.35))));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.textAlign = "center"; c.textBaseline = "middle";
    let size = 132; c.font = `${size}px Anton`;
    while (c.measureText(brand.toUpperCase()).width > W - 120 && size > 60) { size -= 6; c.font = `${size}px Anton`; }
    c.lineJoin = "round"; c.lineWidth = 8; c.strokeStyle = "rgba(0,0,0,0.8)"; c.strokeText(brand.toUpperCase(), W / 2, 640);
    c.fillStyle = rgba(accent); c.fillText(brand.toUpperCase(), W / 2, 640);
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

function overlay(title, brand, accent) {
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

class Captions {
  constructor(words, accent) {
    this.words = words; this.accent = accent; this.chunks = chunkWords(words);
    this.times = this.chunks.map((ch, k) => {
      const start = words[ch[0]].start, lastEnd = words[ch[ch.length - 1]].end;
      const end = k + 1 < this.chunks.length ? words[this.chunks[k + 1][0]].start : lastEnd + 0.3;
      return [start, Math.min(end, lastEnd + 0.35)];
    });
    this.layout = new Map();
  }
  draw(ctx, t, centerY) {
    const k = this.times.findIndex(([s, e]) => t >= s && t < e);
    if (k < 0) return;
    const idxs = this.chunks[k];
    let lay = this.layout.get(k);
    if (!lay) {
      const texts = idxs.map((i) => this.words[i].text.replace(/["“”]/g, "").toUpperCase());
      let size = 118, widths, total;
      for (;;) {
        ctx.font = `${size}px Anton`;
        widths = texts.map((x) => ctx.measureText(x).width);
        total = widths.reduce((a, b) => a + b, 0) + size * 0.28 * (texts.length - 1);
        if (total <= W - 120 || size <= 60) break;
        size -= 6;
      }
      lay = { texts, size, widths, total }; this.layout.set(k, lay);
    }
    let active = idxs.find((i) => t >= this.words[i].start && t < this.words[i].end + 0.05);
    if (active === undefined) active = t >= this.words[idxs[idxs.length - 1]].start ? idxs[idxs.length - 1] : idxs[0];
    const age = t - this.times[k][0], s = age < 0.12 ? 0.82 + 0.18 * ease(age / 0.12) : 1;
    ctx.save();
    ctx.translate(W / 2, centerY); ctx.scale(s, s);
    ctx.font = `${lay.size}px Anton`; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    let x = -lay.total / 2;
    lay.texts.forEach((txt, j) => {
      ctx.lineWidth = 18; ctx.strokeStyle = "#000"; ctx.strokeText(txt, x, 0);
      ctx.fillStyle = idxs[j] === active ? rgba(this.accent) : "#fff"; ctx.fillText(txt, x, 0);
      x += lay.widths[j] + lay.size * 0.28;
    });
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ frame painter */

class Painter {
  constructor(job, target) {
    this.job = job;
    this.accent = hexToRgb(job.accent || "#FFD60A");
    this.total = job.scenes[job.scenes.length - 1].end;
    this.header = overlay(job.title, job.brand, this.accent);
    this.plain = overlay("", "", this.accent);
    this.captions = new Captions(job.words, this.accent);
    this.snap = canvas(W, H);
    this.hasSnap = false; this.idx = -1; this.bg = null;
    this.ctx = target.getContext("2d", { alpha: false });
    this.k = target.width / W;
  }
  makeBg(sc) {
    try {
      if (sc.kind === "image" && sc.bitmap) return new ImageBg(sc.bitmap);
      if (sc.kind === "outro") return new OutroBg(this.job.brand, this.accent);
      if (sc.kind === "chart") return new ChartBg(sc.chart);
    } catch (e) { console.warn("scene fallback", e); }
    return new ChartBg(null);
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
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    this.bg.draw(ctx, (t - sc.start) / Math.max(0.001, sc.end - sc.start));
    const into = t - sc.start;
    if (this.hasSnap && idx > 0 && into < 0.25) { ctx.globalAlpha = 1 - ease(into / 0.25); ctx.drawImage(this.snap, 0, 0); ctx.globalAlpha = 1; }
    ctx.drawImage(sc.kind === "outro" ? this.plain : this.header, 0, 0);
    this.captions.draw(ctx, t, sc.kind === "outro" ? 1180 : 1440);
    ctx.fillStyle = rgba(this.accent); ctx.fillRect(0, H - 12, W * (t / this.total), 12);
  }
  dispose() { this.bg?.dispose(); for (const c of [this.header, this.plain, this.snap]) c.width = c.height = 0; }
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
  return { blob: new Blob(parts, { type: "video/quicktime" }), ext: "mov", how: `encoded on-device, ${vcfg.width}×${vcfg.height}, uncompressed sound` };
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
