// Generated visuals that show what the voice is saying: animated data graphics built from the line's
// own numbers, and flat illustrations for its concept. Drawn on canvas, nothing downloaded.
export const W = 1080, H = 1920;
const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));
const back = (x) => { x = Math.min(1, Math.max(0, x)); const c = 1.6; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };  // overshoot
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (c, k) => c.map((v) => Math.round(v * k));
const fmt = (n, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

function fitText(ctx, text, font, size, maxW, min = 40) {
  ctx.font = font.replace("{s}", size);
  while (ctx.measureText(text).width > maxW && size > min) { size -= 4; ctx.font = font.replace("{s}", size); }
  return size;
}

// Shared backdrop: deep gradient, a soft glow in the accent colour and a faint dot grid.
function backdrop(accent, seed) {
  const bg = canvas(W, H), c = bg.getContext("2d");
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgb(9,13,30)"); g.addColorStop(1, ["rgb(20,26,58)", "rgb(26,18,48)", "rgb(10,30,44)"][seed % 3]);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const r = c.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, 760);
  r.addColorStop(0, rgba(accent, 0.18)); r.addColorStop(1, rgba(accent, 0));
  c.fillStyle = r; c.fillRect(0, 0, W, H);
  c.fillStyle = "rgba(255,255,255,0.05)";
  for (let y = 60; y < H; y += 60) for (let x = 30; x < W; x += 60) c.fillRect(x, y, 3, 3);
  return bg;
}

function label(ctx, text, x, y, accent, size = 52) {
  if (!text) return;
  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  fitText(ctx, text, "800 {s}px Montserrat", size, W - 160, 30);
  ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.fillText(text, x, y);
  ctx.restore();
}

function bigText(ctx, text, x, y, size, color, maxW = W - 140) {
  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  fitText(ctx, text, "{s}px Anton", size, maxW, 60);
  ctx.lineWidth = 14; ctx.strokeStyle = "rgba(6,8,18,0.9)"; ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
  ctx.restore();
}

/* ---------------------------------------------------------------- data graphics */

export class StatBg {
  // spec from visuals.js; layout "low" or "middle" (where captions sit), so the graphic avoids them
  constructor(spec, accent, layout = "low", seed = 0) {
    this.s = spec; this.a = accent; this.bg = backdrop(accent, seed);
    this.cy = layout === "middle" ? 1360 : 790;
  }
  draw(ctx, p) {
    ctx.drawImage(this.bg, 0, 0);
    const a = ease(p / 0.5), s = this.s;
    const fn = { percent: this.percent, split: this.split, range: this.range, growth: this.growth, compare: this.compare,
      money: this.counter, bignum: this.counter, year: this.year }[s.type];
    fn?.call(this, ctx, a, p);
  }
  percent(ctx, a) {
    const { cy } = this, R = 290, v = Math.min(100, this.s.value);
    ctx.lineCap = "round";
    ctx.lineWidth = 84; ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.beginPath(); ctx.arc(W / 2, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgba(this.a);
    ctx.beginPath(); ctx.arc(W / 2, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (v / 100) * a); ctx.stroke();
    bigText(ctx, `${fmt(v * a, v % 1 ? 1 : 0)}%`, W / 2, cy, 200, "#fff", 440);
    label(ctx, this.s.label, W / 2, cy + R + 120, this.a);
  }
  split(ctx, a) {
    const { cy } = this, R = 270, parts = this.s.parts, total = parts.reduce((x, y) => x + y, 0);
    const colors = [rgba(this.a), "rgba(255,255,255,0.88)", rgba(mix(this.a, 0.55)), "rgba(120,160,255,0.9)"];
    let start = -Math.PI / 2;
    ctx.lineWidth = 96; ctx.lineCap = "butt";
    parts.forEach((v, i) => {
      const sweep = Math.PI * 2 * (v / Math.max(100, total)) * a;
      ctx.strokeStyle = colors[i % colors.length];
      ctx.beginPath(); ctx.arc(W / 2, cy, R, start + 0.03, start + Math.max(0.03, sweep - 0.03)); ctx.stroke();
      start += sweep;
    });
    bigText(ctx, this.s.title, W / 2, cy, 120, "#fff", 400);
    const labels = this.s.labels || [];
    parts.forEach((v, i) => {
      const y = cy + R + 110 + i * 70, x = W / 2 - 170;
      ctx.globalAlpha = ease((a - i * 0.15) * 2);
      ctx.fillStyle = colors[i % colors.length]; ctx.beginPath(); ctx.roundRect(x, y - 22, 44, 44, 10); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.font = "800 46px Montserrat";
      ctx.fillText(`${v}%${labels[i] ? "  " + labels[i] : ""}`, x + 70, y);
      ctx.globalAlpha = 1;
    });
  }
  range(ctx, a) {
    const { cy } = this, { lo, hi, unit } = this.s, max = Math.max(hi + Math.ceil(hi * 0.34), hi + 1);
    const x0 = 120, x1 = W - 120, X = (v) => x0 + (x1 - x0) * v / max;
    bigText(ctx, `${lo}–${hi} ${unit}`, W / 2, cy - 230, 150, rgba(this.a));
    ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.beginPath(); ctx.roundRect(x0, cy - 26, x1 - x0, 52, 26); ctx.fill();
    ctx.fillStyle = rgba(this.a); ctx.beginPath(); ctx.roundRect(X(lo), cy - 26, Math.max(52, (X(hi) - X(lo)) * a), 52, 26); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "800 34px Montserrat"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    const step = max <= 12 ? 1 : Math.ceil(max / 10);
    for (let v = 0; v <= max; v += step) {
      ctx.fillRect(X(v) - 2, cy + 40, 4, v === lo || v === hi ? 34 : 18);
      if (v === 0 || v === lo || v === hi || v === max) ctx.fillText(String(v), X(v), cy + 86);
    }
    label(ctx, this.s.label, W / 2, cy + 230, this.a);
  }
  growth(ctx, a, p) {
    const { cy } = this, x0 = 140, x1 = W - 120, y0 = cy + 330, y1 = cy - 190, every = this.s.every || 0;
    const years = every ? every * 4 : 30, f = (t) => (every ? 2 ** (t * years / every) : Math.exp(t * 2.3)) ;
    const top = f(1), Y = (v) => y0 - (y0 - y1) * (v - 1) / (top - 1);
    ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x0, y1 - 40); ctx.lineTo(x0, y0); ctx.lineTo(x1 + 20, y0); ctx.stroke();
    const n = 80, shown = Math.max(2, Math.round(n * a));
    ctx.beginPath();
    for (let i = 0; i < shown; i++) { const t = i / (n - 1); const x = x0 + (x1 - x0) * t, y = Y(f(t)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.lineJoin = ctx.lineCap = "round";
    ctx.strokeStyle = rgba(this.a, 0.35); ctx.lineWidth = 26; ctx.stroke();
    ctx.strokeStyle = rgba(this.a); ctx.lineWidth = 10; ctx.stroke();
    if (every) for (let k = 1; k <= 4; k++) {
      const t = k / 4; if (t > a + 0.001) break;
      const x = x0 + (x1 - x0) * t, y = Y(f(t));
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
      ctx.font = "800 38px Montserrat"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText(`×${2 ** k}`, x - (k === 4 ? 30 : 0), y - 24);
      ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "800 30px Montserrat"; ctx.textBaseline = "top";
      ctx.fillText(`${every * k}y`, x, y0 + 16);
    }
    label(ctx, this.s.label, W / 2, y1 - 110, this.a, 56);
  }
  compare(ctx, a) {
    const { cy } = this, m = this.s.mult, maxH = 560, base = cy + 300, w = 230;
    const hB = maxH * a, hA = Math.max(28, maxH / m) * a;
    const bars = [[W / 2 - 170, hA, "1×", "rgba(255,255,255,0.75)"], [W / 2 + 170, hB, `${fmt(m)}×`, rgba(this.a)]];
    for (const [x, h, txt, col] of bars) {
      ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x - w / 2, base - h, w, h, 18); ctx.fill();
      bigText(ctx, txt, x, base - h - 70, 110, "#fff", 300);
    }
    ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(120, base, W - 240, 4);
    label(ctx, this.s.label, W / 2, base + 90, this.a);
  }
  counter(ctx, a, p) {
    const { cy } = this, v = this.s.value * ease(p / 0.6);
    const text = this.s.type === "money" ? "$" + fmt(v) : fmt(v) + (this.s.suffix || "");
    // a rising stack of coins behind the number
    const coins = Math.round(8 * a);
    for (let i = 0; i < coins; i++) {
      const y = cy + 300 - i * 34;
      ctx.fillStyle = rgba(mix(this.a, 0.62)); ctx.beginPath(); ctx.ellipse(W / 2, y + 12, 170, 44, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(this.a); ctx.beginPath(); ctx.ellipse(W / 2, y, 170, 44, 0, 0, Math.PI * 2); ctx.fill();
    }
    bigText(ctx, text, W / 2, cy - 90, 190, "#fff");
    label(ctx, this.s.label, W / 2, cy + 440, this.a);
  }
  year(ctx, a) {
    const { cy } = this, now = new Date().getFullYear(), yr = this.s.year;
    const span = Math.max(30, Math.round((now - yr) * 0.25)), from = yr - span, to = now;
    const x0 = 110, x1 = W - 110, X = (v) => x0 + (x1 - x0) * (v - from) / (to - from);
    ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x0 + (x1 - x0) * a, cy); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "800 34px Montserrat"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(String(from), x0, cy + 30); if (a > 0.95) ctx.fillText("TODAY", x1, cy + 30);
    const x = X(yr), pin = ease((a - 0.3) / 0.5);
    if (pin > 0) {
      ctx.fillStyle = rgba(this.a); ctx.beginPath(); ctx.arc(x, cy, 26 * pin, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x - 4, cy - 170 * pin, 8, 170 * pin);
      bigText(ctx, String(yr), x < 300 ? 300 : x > W - 300 ? W - 300 : x, cy - 260, 200 * Math.max(0.3, pin), rgba(this.a), 520);
    }
    label(ctx, this.s.label, W / 2, cy + 190, this.a);
  }
  dispose() { this.bg.width = this.bg.height = 0; }
}

/* ---------------------------------------------------------------- illustrations */

// Each icon is drawn in a 400x400 box centred on (0,0). "a" = accent rgb, "t" = time for small motion.
const WHITE = "#f4f6fb", INK = "rgb(12,16,34)";
function rr(c, x, y, w, h, r, fill) { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); }
function circle(c, x, y, r, fill) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); }
function poly(c, pts, fill) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = fill; c.fill(); }
function coin(c, x, y, r, a) { circle(c, x, y, r, rgba(mix(a, 0.7))); circle(c, x, y, r * 0.84, rgba(a)); c.fillStyle = INK; c.font = `${Math.round(r * 1.1)}px Anton`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("$", x, y + r * 0.05); }

export const ICON_DRAW = {
  piggy(c, a, t) {
    const drop = (t * 1.2) % 1;
    coin(c, 20, -230 + drop * 120, 40, a);
    c.beginPath(); c.ellipse(0, 30, 190, 145, 0, 0, Math.PI * 2); c.fillStyle = "rgb(255,150,180)"; c.fill();
    poly(c, [[-110, -80], [-60, -160], [-30, -90]], "rgb(240,120,160)");
    c.beginPath(); c.ellipse(175, 40, 52, 44, 0, 0, Math.PI * 2); c.fillStyle = "rgb(240,120,160)"; c.fill();
    circle(c, 162, 34, 9, INK); circle(c, 190, 34, 9, INK); circle(c, 90, -20, 13, INK);
    rr(c, -40, -100, 90, 18, 9, INK);
    for (const x of [-120, -40, 50, 120]) rr(c, x - 22, 150, 44, 70, 14, "rgb(240,120,160)");
  },
  house(c, a) {
    poly(c, [[-210, -20], [0, -210], [210, -20]], rgba(a));
    rr(c, -165, -30, 330, 230, 10, WHITE);
    rr(c, -40, 60, 80, 140, 8, INK);
    rr(c, -135, 10, 70, 60, 6, rgba(a, 0.85)); rr(c, 65, 10, 70, 60, 6, rgba(a, 0.85));
    rr(c, 110, -170, 40, 90, 4, WHITE);
  },
  card(c, a, t) {
    c.save(); c.rotate(-0.12 + Math.sin(t * 2) * 0.03);
    rr(c, -220, -140, 440, 280, 34, rgba(a));
    rr(c, -220, -80, 440, 56, 0, INK);
    rr(c, -170, 10, 90, 70, 14, "rgb(255,220,120)");
    for (let i = 0; i < 4; i++) rr(c, -50 + i * 60, 40, 44, 16, 8, "rgba(12,16,34,0.55)");
    c.restore();
  },
  bank(c, a) {
    poly(c, [[-220, -110], [0, -230], [220, -110]], rgba(a));
    rr(c, -200, -110, 400, 30, 4, WHITE);
    for (const x of [-160, -70, 20, 110]) rr(c, x, -70, 50, 220, 6, WHITE);
    rr(c, -220, 160, 440, 44, 6, rgba(a));
    circle(c, 0, -160, 26, INK); c.fillStyle = rgba(a); c.font = "40px Anton"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("$", 0, -158);
  },
  shield(c, a) {
    c.beginPath(); c.moveTo(0, -220); c.lineTo(190, -150); c.quadraticCurveTo(190, 120, 0, 220); c.quadraticCurveTo(-190, 120, -190, -150); c.closePath();
    c.fillStyle = rgba(a); c.fill();
    c.beginPath(); c.moveTo(-80, 0); c.lineTo(-20, 70); c.lineTo(100, -70); c.lineWidth = 40; c.lineCap = c.lineJoin = "round"; c.strokeStyle = INK; c.stroke();
  },
  coins(c, a, t) {
    for (let s = 0; s < 3; s++) {
      const x = -130 + s * 130, h = [3, 5, 4][s];
      for (let i = 0; i < h; i++) { const y = 150 - i * 40; c.beginPath(); c.ellipse(x, y + 12, 95, 30, 0, 0, Math.PI * 2); c.fillStyle = rgba(mix(a, 0.6)); c.fill(); c.beginPath(); c.ellipse(x, y, 95, 30, 0, 0, Math.PI * 2); c.fillStyle = rgba(a); c.fill(); }
    }
    coin(c, 120, -170 + Math.sin(t * 3) * 14, 62, a);
  },
  chartUp(c, a) {
    for (let i = 0; i < 4; i++) rr(c, -180 + i * 95, 160 - (i + 1) * 65, 70, (i + 1) * 65, 10, rgba(a, 0.35 + i * 0.15));
    c.beginPath(); c.moveTo(-200, 120); c.lineTo(-80, 20); c.lineTo(10, 70); c.lineTo(180, -150);
    c.lineWidth = 30; c.lineCap = c.lineJoin = "round"; c.strokeStyle = WHITE; c.stroke();
    poly(c, [[210, -190], [100, -170], [190, -90]], WHITE);
    rr(c, -220, 165, 440, 12, 6, "rgba(255,255,255,0.5)");
  },
  chartDown(c) {
    const red = "rgb(255,82,96)";
    c.beginPath(); c.moveTo(-200, -150); c.lineTo(-80, -40); c.lineTo(10, -90); c.lineTo(180, 120);
    c.lineWidth = 30; c.lineCap = c.lineJoin = "round"; c.strokeStyle = red; c.stroke();
    poly(c, [[210, 160], [190, 50], [110, 140]], red);
    rr(c, -220, 175, 440, 12, 6, "rgba(255,255,255,0.5)");
  },
  cart(c, a) {
    c.beginPath(); c.moveTo(-220, -140); c.lineTo(-160, -140); c.lineTo(-110, 90); c.lineTo(150, 90); c.lineTo(190, -80); c.lineTo(-140, -80);
    c.lineWidth = 26; c.lineJoin = c.lineCap = "round"; c.strokeStyle = WHITE; c.stroke();
    circle(c, -80, 150, 30, WHITE); circle(c, 120, 150, 30, WHITE);
    rr(c, -90, -60, 80, 120, 10, rgba(a)); rr(c, 10, -40, 90, 100, 10, rgba(a, 0.7));
    poly(c, [[150, -230], [210, -150], [170, -150], [170, -100], [130, -100], [130, -150], [90, -150]], "rgb(255,82,96)");
  },
  hourglass(c, a, t) {
    rr(c, -160, -220, 320, 34, 12, rgba(a)); rr(c, -160, 186, 320, 34, 12, rgba(a));
    c.beginPath(); c.moveTo(-120, -186); c.lineTo(120, -186); c.lineTo(20, 0); c.lineTo(120, 186); c.lineTo(-120, 186); c.lineTo(-20, 0); c.closePath();
    c.fillStyle = "rgba(255,255,255,0.18)"; c.fill(); c.lineWidth = 10; c.strokeStyle = WHITE; c.stroke();
    const k = (t * 0.5) % 1;
    poly(c, [[-100 + 80 * k, -170 + 150 * k], [100 - 80 * k, -170 + 150 * k], [10, -10], [-10, -10]], "rgb(255,214,120)");
    poly(c, [[-100, 176], [100, 176], [100 - 80 * (1 - k), 176 - 120 * k], [-100 + 80 * (1 - k), 176 - 120 * k]], "rgb(255,214,120)");
  },
  cap(c, a) {
    poly(c, [[-230, -40], [0, -150], [230, -40], [0, 70]], rgba(a));
    c.beginPath(); c.moveTo(-130, 10); c.lineTo(-130, 120); c.quadraticCurveTo(0, 190, 130, 120); c.lineTo(130, 10); c.lineTo(0, 70); c.closePath(); c.fillStyle = WHITE; c.fill();
    c.beginPath(); c.moveTo(0, -40); c.lineTo(190, 30); c.lineTo(190, 150); c.lineWidth = 10; c.strokeStyle = "rgb(255,214,120)"; c.stroke();
    circle(c, 190, 160, 18, "rgb(255,214,120)");
  },
  briefcase(c, a) {
    c.beginPath(); c.roundRect(-70, -170, 140, 80, 24); c.lineWidth = 26; c.strokeStyle = WHITE; c.stroke();
    rr(c, -220, -110, 440, 300, 30, rgba(a));
    rr(c, -220, -10, 440, 26, 0, "rgba(12,16,34,0.5)");
    rr(c, -40, -30, 80, 60, 12, WHITE);
  },
  scale(c, a, t) {
    const tilt = Math.sin(t * 2) * 0.08;
    rr(c, -14, -150, 28, 330, 10, WHITE); rr(c, -120, 170, 240, 30, 12, WHITE);
    c.save(); c.translate(0, -150); c.rotate(tilt);
    rr(c, -220, -12, 440, 24, 12, WHITE);
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(s * 200, 0); c.lineTo(s * 200 - 80, 130); c.lineTo(s * 200 + 80, 130); c.closePath(); c.lineWidth = 6; c.strokeStyle = "rgba(255,255,255,0.7)"; c.stroke();
      c.beginPath(); c.ellipse(s * 200, 140, 100, 26, 0, 0, Math.PI); c.fillStyle = rgba(a); c.fill();
    }
    c.restore();
  },
  target(c, a, t) {
    [200, 150, 100, 50].forEach((r, i) => circle(c, 0, 0, r, i % 2 ? WHITE : rgba(a)));
    const k = Math.min(1, (t % 2) * 2);
    c.save(); c.translate(260 - 260 * ease(k), -260 + 260 * ease(k)); c.rotate(-Math.PI / 4);
    rr(c, 0, -8, 230, 16, 8, INK); poly(c, [[-30, 0], [10, -22], [10, 22]], INK); poly(c, [[230, 0], [270, -30], [260, 0], [270, 30]], "rgb(255,82,96)");
    c.restore();
  },
  calendar(c, a) {
    rr(c, -200, -170, 400, 360, 30, WHITE);
    rr(c, -200, -170, 400, 90, 30, rgba(a)); rr(c, -200, -110, 400, 30, 0, rgba(a));
    for (const x of [-110, 110]) rr(c, x - 14, -205, 28, 70, 14, INK);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) rr(c, -160 + k * 85, -50 + r * 75, 60, 50, 10, "rgba(12,16,34,0.15)");
    c.beginPath(); c.moveTo(10, 60); c.lineTo(50, 100); c.lineTo(130, 10); c.lineWidth = 24; c.lineCap = c.lineJoin = "round"; c.strokeStyle = rgba(a); c.stroke();
  },
  bitcoin(c, a, t) {
    c.save(); c.scale(Math.cos(t * 2) * 0.15 + 0.85, 1);
    circle(c, 0, 0, 210, "rgb(230,140,30)"); circle(c, 0, 0, 180, "rgb(247,170,50)");
    c.fillStyle = WHITE; c.font = "260px Anton"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("B", 6, 10);
    rr(c, -40, -150, 20, 300, 6, WHITE); rr(c, 10, -150, 20, 300, 6, WHITE);
    c.restore();
  },
  receipt(c, a) {
    c.beginPath(); c.moveTo(-160, -220);
    for (let x = -160; x <= 160; x += 40) c.lineTo(x + 20, -240), c.lineTo(x + 40, -220);
    c.lineTo(160, 220);
    for (let x = 160; x >= -160; x -= 40) c.lineTo(x - 20, 240), c.lineTo(x - 40, 220);
    c.closePath(); c.fillStyle = WHITE; c.fill();
    for (let i = 0; i < 5; i++) rr(c, -110, -150 + i * 60, i === 4 ? 120 : 220, 20, 10, "rgba(12,16,34,0.25)");
    circle(c, 90, 150, 56, rgba(a)); c.fillStyle = INK; c.font = "70px Anton"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("$", 90, 154);
  },
};
export const ICON_NAMES = Object.keys(ICON_DRAW);

export class IllusBg {
  constructor(icon, text, accent, layout = "low", seed = 0) {
    this.icon = ICON_DRAW[icon] ? icon : "coins"; this.text = text; this.a = accent; this.seed = seed;
    this.bg = backdrop(accent, seed + 1);
    this.cy = layout === "middle" ? 1380 : 800;
  }
  draw(ctx, p) {
    ctx.drawImage(this.bg, 0, 0);
    const t = p * 6, s = back(p / 0.22) * 1.25, float = Math.sin(t * 1.1) * 14;
    // floating sparkles
    for (let i = 0; i < 9; i++) {
      const ang = i * 0.7 + this.seed + t * 0.15, r = 380 + (i % 3) * 60;
      const x = W / 2 + Math.cos(ang) * r, y = this.cy + Math.sin(ang) * r * 0.75;
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t + i); circle(ctx, x, y, 8 + (i % 3) * 4, rgba(this.a)); ctx.globalAlpha = 1;
    }
    ctx.save(); ctx.translate(W / 2, this.cy + float); ctx.scale(s, s);
    ICON_DRAW[this.icon](ctx, this.a, t);
    ctx.restore();
    if (this.text) { ctx.globalAlpha = ease((p - 0.1) / 0.2); label(ctx, this.text, W / 2, this.cy + 390, this.a, 58); ctx.globalAlpha = 1; }
  }
  dispose() { this.bg.width = this.bg.height = 0; }
}

/* ---------------------------------------------------------------- chapters and recap (deep dives) */

export class SectionBg {
  constructor(num, text, accent, seed = 0) { this.num = num; this.text = text; this.a = accent; this.bg = backdrop(accent, seed + 2); }
  draw(ctx, p) {
    ctx.drawImage(this.bg, 0, 0);
    const k = back(p / 0.3), slide = (1 - ease(p / 0.3)) * -260;
    ctx.save(); ctx.translate(slide, 0);
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    ctx.font = "520px Anton"; ctx.lineWidth = 10; ctx.strokeStyle = rgba(this.a, 0.55);
    ctx.strokeText(String(this.num).padStart(2, "0"), W / 2, 760);
    ctx.font = "800 44px Montserrat"; ctx.fillStyle = rgba(this.a); ctx.fillText(`PART ${this.num}`, W / 2, 1040);
    ctx.restore();
    ctx.save(); ctx.globalAlpha = Math.min(1, k);
    bigText(ctx, this.text, W / 2, 1150, 130, "#fff");
    ctx.fillStyle = rgba(this.a); ctx.fillRect(W / 2 - 180 * ease(p / 0.4), 1245, 360 * ease(p / 0.4), 10);
    ctx.restore();
  }
  dispose() { this.bg.width = this.bg.height = 0; }
}

export class RecapBg {
  constructor(items, accent, seed = 0) { this.items = items.slice(0, 4); this.a = accent; this.bg = backdrop(accent, seed + 3); }
  draw(ctx, p) {
    ctx.drawImage(this.bg, 0, 0);
    bigText(ctx, "QUICK RECAP", W / 2, 470, 140, rgba(this.a));
    const n = this.items.length;
    this.items.forEach((item, i) => {
      const appear = ease((p - 0.12 - i * 0.16) / 0.12);
      if (appear <= 0) return;
      const y = 680 + i * 190;
      ctx.save(); ctx.globalAlpha = appear; ctx.translate((1 - appear) * 80, 0);
      ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.roundRect(90, y - 70, W - 180, 140, 28); ctx.fill();
      circle(ctx, 170, y, 40, rgba(this.a));
      ctx.beginPath(); ctx.moveTo(152, y); ctx.lineTo(166, y + 15); ctx.lineTo(190, y - 14); ctx.lineWidth = 9; ctx.lineCap = ctx.lineJoin = "round"; ctx.strokeStyle = INK; ctx.stroke();
      ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff";
      // Wrap onto two lines rather than shrinking long items to unreadable sizes.
      const maxW = W - 360; let size = 46, lines;
      for (;; size -= 2) {
        ctx.font = `800 ${size}px Montserrat`; lines = [""];
        for (const w of item.split(/\s+/)) {
          const t = lines[lines.length - 1] ? lines[lines.length - 1] + " " + w : w;
          if (ctx.measureText(t).width <= maxW || !lines[lines.length - 1]) lines[lines.length - 1] = t; else lines.push(w);
        }
        if ((lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= maxW)) || size <= 32) break;
      }
      lines = lines.slice(0, 2);
      lines.forEach((l, k) => ctx.fillText(l, 240, y + (k - (lines.length - 1) / 2) * size * 1.15));
      ctx.restore();
    });
    if (n === 0) label(ctx, "", W / 2, 900, this.a);
  }
  dispose() { this.bg.width = this.bg.height = 0; }
}

// Small "Source: …" tag for scenes whose facts come from research.
export function drawSource(ctx, text, alpha = 1) {
  if (!text || alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.font = "800 26px Montserrat"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
  const t = "SOURCE: " + text.toUpperCase(), w = Math.min(W - 120, ctx.measureText(t).width + 48);
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.beginPath(); ctx.roundRect(60, 1700, w, 52, 26); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  let s = t; while (ctx.measureText(s).width > w - 48 && s.length > 8) s = s.slice(0, -2);
  ctx.fillText(s === t ? t : s + "…", 84, 1727);
  ctx.restore();
}
