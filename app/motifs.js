// More things the illustrator can draw. Each is drawn in a 400x400 box centred on (0,0); "a" is the
// accent colour [r,g,b]. Simple, bold shapes that read at a glance on a phone.

const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (c, k) => c.map((v) => Math.round(v * k));
const lighten = (c, k) => c.map((v) => Math.round(v + (255 - v) * k));
const INK = "rgb(12,16,34)", WHITE = "#f4f6fb", GOLD = "rgb(255,205,90)", RED = "rgb(255,92,92)", GREEN = "rgb(74,222,128)",
  BLUE = "rgb(90,160,255)", GREY = "rgb(180,190,210)", BROWN = "rgb(170,110,70)", SKIN = "rgb(255,200,160)";
function rr(c, x, y, w, h, r, fill) { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); }
function circle(c, x, y, r, fill) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); }
function ring(c, x, y, r, w, color) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.lineWidth = w; c.strokeStyle = color; c.stroke(); }
function poly(c, pts, fill) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = fill; c.fill(); }
function line(c, pts, w, color) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.lineWidth = w; c.lineCap = c.lineJoin = "round"; c.strokeStyle = color; c.stroke(); }
function text(c, s, x, y, size, color, font = "Anton") { c.fillStyle = color; c.font = `${size}px ${font}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(s, x, y); }
function star(c, x, y, r, fill, n = 5) { const pts = []; for (let k = 0; k < n * 2; k++) { const ang = -Math.PI / 2 + k * Math.PI / n, rad = k % 2 ? r * 0.45 : r; pts.push([x + Math.cos(ang) * rad, y + Math.sin(ang) * rad]); } poly(c, pts, fill); }
function bill(c, x, y, w, h, rot, a) { c.save(); c.translate(x, y); c.rotate(rot); rr(c, -w / 2, -h / 2, w, h, 12, GREEN); rr(c, -w / 2 + 14, -h / 2 + 14, w - 28, h - 28, 8, "rgb(52,180,100)"); circle(c, 0, 0, h * 0.28, "rgb(200,255,215)"); text(c, "$", 0, 2, h * 0.38, "rgb(30,120,60)"); c.restore(); }

export const MORE_MOTIFS = {
  /* ---- money and banking ---- */
  cash(c, a) { bill(c, -30, 60, 320, 150, -0.12, a); bill(c, 20, 0, 320, 150, 0.05, a); bill(c, 0, -60, 320, 150, -0.04, a); },
  check(c, a) { rr(c, -230, -120, 460, 240, 18, WHITE); rr(c, -230, -120, 460, 50, 18, rgba(a)); rr(c, -230, -90, 460, 20, 0, rgba(a));
    for (let i = 0; i < 2; i++) rr(c, -190, -20 + i * 50, 220, 16, 8, "rgba(12,16,34,0.25)"); rr(c, 80, -30, 120, 50, 10, "rgba(12,16,34,0.12)"); text(c, "$", 110, -5, 40, INK);
    line(c, [[60, 80], [100, 50], [130, 85], [180, 55]], 8, BLUE); },
  safe(c, a) { rr(c, -200, -200, 400, 380, 30, GREY); rr(c, -170, -170, 340, 320, 20, "rgb(140,150,170)"); ring(c, 0, -10, 90, 22, rgba(a)); circle(c, 0, -10, 30, INK);
    for (let k = 0; k < 8; k++) { const ang = k * Math.PI / 4; line(c, [[Math.cos(ang) * 40, -10 + Math.sin(ang) * 40], [Math.cos(ang) * 70, -10 + Math.sin(ang) * 70]], 8, INK); }
    rr(c, -170, 185, 60, 30, 8, INK); rr(c, 110, 185, 60, 30, 8, INK); },
  atm(c, a) { rr(c, -170, -220, 340, 440, 24, GREY); rr(c, -130, -180, 260, 160, 14, rgba(a)); text(c, "$", 0, -100, 110, INK);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) rr(c, -110 + k * 80, 20 + r * 50, 60, 36, 8, WHITE);
    rr(c, -110, 180, 220, 20, 10, INK); bill(c, 0, 225, 180, 70, 0, a); },
  calculator(c, a) { rr(c, -160, -220, 320, 440, 34, INK); rr(c, -125, -185, 250, 100, 14, "rgb(190,230,200)"); text(c, "1,250", 20, -135, 70, INK);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) rr(c, -125 + k * 65, -60 + r * 65, 55, 50, 12, k === 3 ? rgba(a) : "rgb(60,66,90)"); },
  percent(c, a) { circle(c, 0, 0, 210, rgba(a)); ring(c, -80, -80, 46, 26, INK); ring(c, 80, 80, 46, 26, INK); line(c, [[110, -130], [-110, 130]], 30, INK); },
  pie(c, a) { circle(c, 0, 0, 200, rgba(mix(a, 0.6)));
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 200, -Math.PI / 2, Math.PI * 0.4); c.closePath(); c.fillStyle = rgba(a); c.fill();
    c.save(); c.translate(26, -18); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 200, Math.PI * 1.15, Math.PI * 1.5); c.closePath(); c.fillStyle = WHITE; c.fill(); c.restore(); },
  bars(c, a) { [[-170, 140, 0.5], [-70, 220, 0.7], [30, 300, 0.85], [130, 380, 1]].forEach(([x, h, k]) => rr(c, x, 190 - h, 80, h, 12, rgba(a, k))); rr(c, -210, 190, 420, 14, 7, WHITE); },
  coinStack(c, a) { for (let i = 0; i < 7; i++) { const y = 160 - i * 50; c.beginPath(); c.ellipse(0, y + 14, 150, 44, 0, 0, Math.PI * 2); c.fillStyle = rgba(mix(a, 0.6)); c.fill(); c.beginPath(); c.ellipse(0, y, 150, 44, 0, 0, Math.PI * 2); c.fillStyle = rgba(a); c.fill(); }
    text(c, "$", 0, -140, 60, INK); },
  handCoin(c, a) { c.beginPath(); c.moveTo(-220, 120); c.quadraticCurveTo(-120, 40, -20, 80); c.lineTo(120, 80); c.quadraticCurveTo(160, 100, 120, 130); c.lineTo(10, 130); c.lineTo(120, 150); c.quadraticCurveTo(220, 110, 230, 60); c.lineTo(230, 200); c.lineTo(-220, 200); c.closePath(); c.fillStyle = SKIN; c.fill();
    circle(c, 40, -60, 90, rgba(mix(a, 0.75))); circle(c, 40, -60, 74, rgba(a)); text(c, "$", 40, -56, 90, INK); },
  nestEgg(c, a) { c.beginPath(); c.ellipse(0, 130, 220, 70, 0, 0, Math.PI * 2); c.fillStyle = BROWN; c.fill();
    for (let k = 0; k < 9; k++) line(c, [[-200 + k * 50, 100], [-170 + k * 50, 170]], 8, "rgb(130,80,50)");
    c.beginPath(); c.ellipse(0, -20, 120, 160, 0, 0, Math.PI * 2); c.fillStyle = GOLD; c.fill(); c.beginPath(); c.ellipse(-40, -70, 26, 50, 0.3, 0, Math.PI * 2); c.fillStyle = "rgba(255,255,255,0.5)"; c.fill(); },
  basket(c, a) { poly(c, [[-200, -20], [200, -20], [160, 200], [-160, 200]], BROWN); for (let k = 0; k < 4; k++) rr(c, -190 + k * 6, 20 + k * 45, 380 - k * 12, 12, 6, "rgb(130,80,50)");
    c.beginPath(); c.arc(0, -20, 170, Math.PI, 0); c.lineWidth = 24; c.strokeStyle = "rgb(130,80,50)"; c.stroke();
    for (const [x, col] of [[-100, WHITE], [0, rgba(a)], [100, WHITE]]) { c.beginPath(); c.ellipse(x, -50, 55, 72, 0, 0, Math.PI * 2); c.fillStyle = col; c.fill(); } },
  priceTag(c, a) { c.save(); c.rotate(-0.4); poly(c, [[-220, -100], [120, -100], [220, 0], [120, 100], [-220, 100]], rgba(a)); circle(c, 130, 0, 26, INK); text(c, "$99", -60, 6, 110, INK); c.restore(); },
  bag(c, a) { rr(c, -170, -90, 340, 300, 24, rgba(a)); c.beginPath(); c.arc(0, -90, 90, Math.PI, 0); c.lineWidth = 26; c.strokeStyle = INK; c.stroke(); rr(c, -170, -90, 340, 40, 0, rgba(mix(a, 0.8))); star(c, 0, 70, 70, WHITE); },
  gift(c, a) { rr(c, -190, -40, 380, 240, 16, rgba(a)); rr(c, -210, -110, 420, 80, 16, rgba(mix(a, 0.85))); rr(c, -26, -110, 52, 310, 0, RED);
    c.beginPath(); c.ellipse(-60, -150, 70, 40, 0.4, 0, Math.PI * 2); c.ellipse(60, -150, 70, 40, -0.4, 0, Math.PI * 2); c.lineWidth = 24; c.strokeStyle = RED; c.stroke(); },
  ticket(c, a) { c.save(); c.rotate(-0.2); rr(c, -220, -110, 440, 220, 24, rgba(a)); circle(c, -220, 0, 40, "rgba(0,0,0,0)"); c.globalCompositeOperation = "destination-out"; circle(c, -220, 0, 40, "#000"); circle(c, 220, 0, 40, "#000"); c.globalCompositeOperation = "source-over";
    for (let y = -90; y < 100; y += 30) rr(c, 90, y, 10, 18, 5, INK); text(c, "WIN", -40, 6, 110, INK); c.restore(); },
  dice(c, a) { c.save(); c.rotate(-0.25); rr(c, -230, -100, 200, 200, 34, WHITE); for (const [x, y] of [[-180, -50], [-130, 0], [-80, 50]]) circle(c, x, y, 18, INK); c.restore();
    c.save(); c.rotate(0.2); rr(c, 30, -60, 200, 200, 34, rgba(a)); for (const [x, y] of [[80, -10], [180, -10], [80, 90], [180, 90]]) circle(c, x, y, 18, INK); c.restore(); },
  trophy(c, a) { c.beginPath(); c.moveTo(-140, -200); c.lineTo(140, -200); c.quadraticCurveTo(140, 40, 0, 60); c.quadraticCurveTo(-140, 40, -140, -200); c.fillStyle = GOLD; c.fill();
    for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 150, -120, 60, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? Math.PI / 2 : Math.PI * 1.5); c.lineWidth = 24; c.strokeStyle = GOLD; c.stroke(); }
    rr(c, -30, 50, 60, 90, 6, "rgb(230,170,50)"); rr(c, -120, 140, 240, 60, 14, rgba(a)); star(c, 0, -100, 60, WHITE); },
  medal(c, a) { poly(c, [[-120, -220], [-40, -220], [20, -60], [-60, -60]], RED); poly(c, [[120, -220], [40, -220], [-20, -60], [60, -60]], BLUE);
    circle(c, 0, 60, 150, GOLD); circle(c, 0, 60, 115, "rgb(240,180,60)"); text(c, "1", 0, 66, 150, INK); },
  /* ---- growth, time, goals ---- */
  ladder(c, a) { line(c, [[-120, 220], [-60, -220]], 26, WHITE); line(c, [[120, 220], [180, -220]], 26, WHITE);
    for (let k = 0; k < 6; k++) { const y = 180 - k * 75, t = (220 - y) / 440; line(c, [[-120 + 60 * t, y], [120 + 60 * t, y]], 20, k === 5 ? rgba(a) : WHITE); }
    star(c, 150, -240, 50, GOLD); },
  stairs(c, a) { for (let k = 0; k < 5; k++) rr(c, -220 + k * 90, 140 - k * 80, 440 - k * 90, 80, 6, rgba(a, 0.45 + k * 0.13));
    c.save(); c.translate(130, -220); circle(c, 0, -40, 34, WHITE); rr(c, -24, -10, 48, 90, 20, WHITE); c.restore(); poly(c, [[190, -330 + 40], [230, -300 + 40], [190, -270 + 40]], RED); line(c, [[190, -290], [190, -200]], 8, WHITE); },
  mountain(c, a) { poly(c, [[-230, 200], [-60, -140], [30, 20], [110, -220], [240, 200]], rgba(mix(a, 0.75))); poly(c, [[110, -220], [150, -140], [120, -150], [95, -120], [70, -150]], WHITE);
    line(c, [[110, -220], [110, -320]], 10, WHITE); poly(c, [[110, -320], [190, -295], [110, -270]], RED); },
  snowball(c) { circle(c, 40, 60, 160, WHITE); circle(c, -150, 170, 50, WHITE); circle(c, -220, 200, 26, WHITE); for (const [x, y] of [[0, 20], [80, 100], [60, -10]]) circle(c, x, y, 16, "rgba(150,180,220,0.6)"); },
  seedling(c, a) { c.beginPath(); c.ellipse(0, 170, 220, 50, 0, 0, Math.PI * 2); c.fillStyle = BROWN; c.fill(); line(c, [[0, 160], [0, -40]], 20, GREEN);
    for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 80, -60, 90, 40, s * -0.6, 0, Math.PI * 2); c.fillStyle = GREEN; c.fill(); } for (const [x, y] of [[-140, 140], [130, 150]]) { circle(c, x, y, 30, rgba(a)); text(c, "$", x, y + 2, 34, INK); } },
  tree(c, a) { rr(c, -30, 40, 60, 180, 10, BROWN); circle(c, 0, -60, 150, GREEN); circle(c, -110, 10, 90, GREEN); circle(c, 110, 10, 90, GREEN);
    for (const [x, y] of [[-60, -80], [60, -40], [0, 30], [-110, 20], [100, -120]]) { circle(c, x, y, 24, rgba(a)); text(c, "$", x, y + 2, 28, INK); } },
  alarm(c, a) { circle(c, 0, 20, 180, rgba(a)); circle(c, 0, 20, 145, WHITE); line(c, [[0, 20], [0, -80]], 16, INK); line(c, [[0, 20], [70, 60]], 16, INK);
    for (const s of [-1, 1]) { circle(c, s * 130, -150, 50, rgba(mix(a, 0.8))); line(c, [[s * 120, 170], [s * 160, 220]], 20, INK); } },
  flag(c, a) { line(c, [[-140, 220], [-140, -220]], 18, WHITE); c.beginPath(); c.moveTo(-140, -210); c.quadraticCurveTo(0, -260, 80, -190); c.quadraticCurveTo(160, -130, 220, -170); c.lineTo(220, -20); c.quadraticCurveTo(160, 20, 80, -40); c.quadraticCurveTo(0, -110, -140, -60); c.closePath(); c.fillStyle = rgba(a); c.fill(); },
  compass(c, a) { circle(c, 0, 0, 210, WHITE); circle(c, 0, 0, 180, "rgb(30,40,70)"); poly(c, [[0, -150], [36, 0], [-36, 0]], RED); poly(c, [[0, 150], [36, 0], [-36, 0]], WHITE); circle(c, 0, 0, 20, rgba(a));
    for (const [s, x, y] of [["N", 0, -175], ["S", 0, 178], ["E", 175, 2], ["W", -175, 2]]) text(c, s, x, y, 36, WHITE); },
  map(c, a) { poly(c, [[-220, -160], [-80, -200], [80, -160], [220, -200], [220, 170], [80, 210], [-80, 170], [-220, 210]], WHITE);
    poly(c, [[-80, -200], [80, -160], [80, 210], [-80, 170]], "rgb(220,226,238)"); line(c, [[-180, 120], [-60, 20], [40, 60], [150, -80]], 10, rgba(a));
    c.save(); c.translate(150, -110); c.beginPath(); c.arc(0, -40, 50, Math.PI * 0.85, Math.PI * 0.15); c.lineTo(0, 40); c.closePath(); c.fillStyle = RED; c.fill(); circle(c, 0, -40, 20, WHITE); c.restore(); },
  key(c, a) { ring(c, -120, 0, 90, 44, GOLD); rr(c, -40, -22, 260, 44, 14, GOLD); rr(c, 140, 20, 30, 70, 6, GOLD); rr(c, 190, 20, 30, 50, 6, GOLD); circle(c, -120, 0, 30, rgba(a, 0.3)); },
  puzzle(c, a) { const piece = (x, y, col) => { rr(c, x - 90, y - 90, 180, 180, 16, col); circle(c, x + 90, y, 36, col); circle(c, x, y - 90, 36, col); };
    piece(-90, 70, rgba(a)); piece(100, -60, WHITE); },
  /* ---- risk and protection ---- */
  fire(c, a) { c.beginPath(); c.moveTo(0, -230); c.bezierCurveTo(120, -100, 200, -20, 160, 100); c.bezierCurveTo(130, 190, 60, 220, 0, 220); c.bezierCurveTo(-60, 220, -150, 190, -170, 90); c.bezierCurveTo(-190, -10, -110, -60, -90, -140); c.bezierCurveTo(-40, -80, -20, -120, 0, -230); c.fillStyle = "rgb(255,120,60)"; c.fill();
    c.beginPath(); c.moveTo(0, -60); c.bezierCurveTo(70, 20, 100, 80, 80, 140); c.bezierCurveTo(60, 200, -60, 200, -80, 140); c.bezierCurveTo(-100, 80, -40, 40, 0, -60); c.fillStyle = GOLD; c.fill(); },
  bomb(c) { circle(c, -20, 40, 170, INK); circle(c, -80, -20, 30, "rgba(255,255,255,0.25)"); rr(c, 60, -150, 80, 60, 12, "rgb(60,66,90)"); line(c, [[110, -150], [160, -210], [200, -190]], 12, BROWN); star(c, 210, -200, 40, GOLD, 8); },
  parachute(c, a) { c.beginPath(); c.arc(0, -60, 210, Math.PI, 0); c.closePath(); c.fillStyle = rgba(a); c.fill(); for (const x of [-140, -70, 0, 70, 140]) { c.beginPath(); c.arc(x, -60, 35, 0, Math.PI); c.fillStyle = "rgba(0,0,0,0.12)"; c.fill(); }
    for (const x of [-200, -80, 80, 200]) line(c, [[x, -60], [0, 150]], 5, WHITE); rr(c, -50, 140, 100, 80, 14, BROWN); text(c, "$", 0, 182, 60, GOLD); },
  anchor(c, a) { ring(c, 0, -170, 40, 24, WHITE); rr(c, -18, -130, 36, 300, 12, WHITE); rr(c, -110, -90, 220, 30, 12, WHITE);
    c.beginPath(); c.arc(0, 60, 170, 0.15 * Math.PI, 0.85 * Math.PI); c.lineWidth = 34; c.strokeStyle = WHITE; c.stroke(); for (const s of [-1, 1]) poly(c, [[s * 190, 110], [s * 150, 20], [s * 120, 120]], WHITE); },
  bandage(c, a) { c.save(); c.rotate(-0.6); rr(c, -230, -70, 460, 140, 70, SKIN); rr(c, -70, -70, 140, 140, 10, "rgb(240,170,130)"); for (const [x, y] of [[-30, -30], [30, -30], [-30, 30], [30, 30]]) circle(c, x, y, 10, "rgb(210,140,110)"); c.restore();
    c.save(); c.rotate(0.6); rr(c, -230, -70, 460, 140, 70, rgba(lighten(a, 0.4), 0.85)); c.restore(); },
  thumbsUp(c) { rr(c, -200, -20, 90, 220, 18, BLUE); c.beginPath(); c.moveTo(-90, -10); c.lineTo(0, -190); c.quadraticCurveTo(60, -210, 50, -120); c.lineTo(30, -50); c.lineTo(170, -50); c.quadraticCurveTo(220, -40, 200, 10); c.lineTo(160, 170); c.quadraticCurveTo(150, 200, 110, 200); c.lineTo(-90, 200); c.closePath(); c.fillStyle = SKIN; c.fill(); },
  thumbsDown(c) { c.save(); c.rotate(Math.PI); MORE_MOTIFS.thumbsUp(c); c.restore(); },
  scissors(c, a) { for (const s of [-1, 1]) { c.save(); c.rotate(s * 0.35); poly(c, [[-14, -230], [14, -230], [20, 40], [-20, 40]], GREY); c.restore(); ring(c, s * 80, 140, 60, 26, rgba(a)); }
    circle(c, 0, 20, 18, INK); line(c, [[-240, -60], [240, -60]], 6, "rgba(255,255,255,0.5)"); },
  magnet(c, a) { c.beginPath(); c.arc(0, 0, 150, Math.PI, 0); c.lineWidth = 90; c.strokeStyle = RED; c.stroke(); rr(c, -195, 0, 90, 120, 0, RED); rr(c, 105, 0, 90, 120, 0, RED); rr(c, -195, 120, 90, 70, 0, WHITE); rr(c, 105, 120, 90, 70, 0, WHITE);
    for (const [x, y] of [[-60, 140], [60, 170], [0, 230]]) { circle(c, x, y, 30, rgba(a)); text(c, "$", x, y + 2, 34, INK); } },
  vault(c, a) { rr(c, -220, -200, 440, 400, 30, "rgb(120,130,150)"); circle(c, 0, 0, 160, GREY); circle(c, 0, 0, 120, "rgb(140,150,170)"); for (let k = 0; k < 3; k++) { c.save(); c.rotate(k * Math.PI / 3); rr(c, -140, -14, 280, 28, 14, rgba(a)); c.restore(); } circle(c, 0, 0, 34, INK); },
  /* ---- work, tech and industry ---- */
  robot(c, a) { rr(c, -150, -150, 300, 240, 40, GREY); rr(c, -120, -110, 240, 120, 24, INK); circle(c, -55, -50, 26, rgba(a)); circle(c, 55, -50, 26, rgba(a)); rr(c, -50, 40, 100, 20, 10, INK);
    line(c, [[0, -150], [0, -210]], 12, GREY); circle(c, 0, -220, 22, RED); rr(c, -110, 110, 220, 110, 20, rgba(a)); },
  chip(c, a) { rr(c, -150, -150, 300, 300, 24, INK); rr(c, -100, -100, 200, 200, 14, rgba(a)); text(c, "AI", 0, 6, 110, INK);
    for (let k = 0; k < 5; k++) for (const s of [-1, 1]) { rr(c, -100 + k * 45, s * 170 - 15, 20, 30, 4, GREY); rr(c, s * 170 - 15, -100 + k * 45, 30, 20, 4, GREY); } },
  server(c, a) { for (let k = 0; k < 4; k++) { rr(c, -180, -200 + k * 105, 360, 90, 14, k % 2 ? "rgb(40,48,76)" : "rgb(52,60,92)"); circle(c, -130, -155 + k * 105, 12, GREEN); circle(c, -95, -155 + k * 105, 12, rgba(a)); for (let i = 0; i < 5; i++) rr(c, 0 + i * 30, -170 + k * 105, 16, 30, 4, "rgba(255,255,255,0.3)"); } },
  gear(c, a) { c.beginPath(); for (let k = 0; k < 24; k++) { const ang = k * Math.PI / 12, rad = k % 2 ? 160 : 200; c.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad); } c.closePath(); c.fillStyle = rgba(a); c.fill(); circle(c, 0, 0, 70, INK); },
  hammer(c, a) { c.save(); c.rotate(-0.6); rr(c, -24, -60, 48, 300, 16, BROWN); rr(c, -130, -160, 260, 110, 20, GREY); rr(c, -130, -160, 50, 110, 12, "rgb(140,150,170)"); c.restore(); rr(c, -180, 170, 360, 40, 12, rgba(a)); },
  truck(c, a) { rr(c, -230, -110, 300, 220, 14, rgba(a)); poly(c, [[80, -60], [170, -60], [230, 20], [230, 110], [80, 110]], WHITE); poly(c, [[100, -40], [160, -40], [200, 20], [100, 20]], "rgb(150,200,255)");
    for (const x of [-150, 150]) { circle(c, x, 120, 50, INK); circle(c, x, 120, 20, GREY); } },
  ship(c, a) { poly(c, [[-230, 60], [230, 60], [170, 180], [-170, 180]], "rgb(40,60,110)"); const cols = [rgba(a), RED, BLUE, GREEN, WHITE];
    for (let r = 0; r < 2; r++) for (let k = 0; k < 5; k++) rr(c, -190 + k * 76, -50 - r * 64, 70, 58, 6, cols[(k + r * 2) % 5]); rr(c, 130, -220, 60, 100, 8, WHITE); },
  plane(c, a) { c.save(); c.rotate(-0.5); rr(c, -230, -36, 460, 72, 36, WHITE); poly(c, [[-40, -30], [60, -30], [-60, -220], [-110, -220]], rgba(a)); poly(c, [[-40, 30], [60, 30], [-60, 220], [-110, 220]], rgba(a));
    poly(c, [[-200, -20], [-160, -20], [-220, -110], [-240, -110]], rgba(a)); for (let k = 0; k < 5; k++) circle(c, 60 + k * 30, -8, 9, "rgb(90,160,255)"); c.restore(); },
  gasPump(c, a) { rr(c, -170, -200, 240, 400, 24, RED); rr(c, -140, -170, 180, 110, 12, WHITE); text(c, "$4.19", -50, -115, 56, INK); rr(c, -190, 190, 280, 30, 10, GREY);
    line(c, [[70, -100], [150, -100], [150, 100], [190, 120]], 18, INK); rr(c, 170, 90, 50, 70, 10, INK); },
  solar(c, a) { circle(c, -140, -150, 70, GOLD); for (let k = 0; k < 8; k++) { const ang = k * Math.PI / 4; line(c, [[-140 + Math.cos(ang) * 90, -150 + Math.sin(ang) * 90], [-140 + Math.cos(ang) * 120, -150 + Math.sin(ang) * 120]], 12, GOLD); }
    c.save(); c.translate(40, 60); c.transform(1, 0, -0.3, 1, 0, 0); for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) rr(c, -170 + k * 92, -60 + r * 62, 86, 56, 4, "rgb(40,90,180)"); c.restore(); line(c, [[40, 160], [40, 220]], 16, GREY); },
  windmill(c, a) { poly(c, [[-24, -60], [24, -60], [50, 220], [-50, 220]], WHITE); for (let k = 0; k < 3; k++) { c.save(); c.translate(0, -70); c.rotate(k * 2 * Math.PI / 3 + 0.3); rr(c, -14, -230, 28, 220, 14, WHITE); c.restore(); } circle(c, 0, -70, 26, rgba(a)); },
  battery(c, a) { rr(c, -200, -110, 380, 220, 30, WHITE); rr(c, 180, -50, 40, 100, 12, WHITE); rr(c, -175, -85, 330, 170, 18, INK); for (let k = 0; k < 3; k++) rr(c, -160 + k * 105, -70, 90, 140, 10, k < 2 ? GREEN : rgba(a, 0.3)); poly(c, [[20, -100], [-40, 10], [10, 10], [-20, 110], [60, -20], [10, -20]], GOLD); },
  megaphone(c, a) { poly(c, [[-150, -50], [150, -190], [150, 190], [-150, 50]], rgba(a)); rr(c, -220, -60, 80, 120, 16, WHITE); rr(c, -190, 50, 50, 110, 14, WHITE);
    for (const r of [60, 110]) { c.beginPath(); c.arc(170, 0, r, -0.6, 0.6); c.lineWidth = 14; c.strokeStyle = WHITE; c.stroke(); } },
  newspaper(c, a) { rr(c, -210, -180, 420, 360, 14, WHITE); text(c, "NEWS", 0, -125, 80, INK); rr(c, -180, -80, 360, 10, 5, INK);
    rr(c, -180, -50, 170, 130, 8, rgba(a)); for (let k = 0; k < 6; k++) rr(c, 10, -50 + k * 25, 170, 12, 6, "rgba(12,16,34,0.3)"); for (let k = 0; k < 3; k++) rr(c, -180, 100 + k * 25, 360, 12, 6, "rgba(12,16,34,0.3)"); },
  mic(c, a) { rr(c, -80, -220, 160, 260, 80, GREY); for (let k = 0; k < 4; k++) rr(c, -80, -170 + k * 45, 160, 10, 5, "rgba(12,16,34,0.25)");
    c.beginPath(); c.arc(0, -30, 130, 0, Math.PI); c.lineWidth = 22; c.strokeStyle = rgba(a); c.stroke(); rr(c, -14, 100, 28, 80, 8, rgba(a)); rr(c, -100, 175, 200, 30, 14, rgba(a)); },
  camera(c, a) { rr(c, -220, -120, 440, 280, 34, INK); rr(c, -90, -170, 180, 70, 16, INK); circle(c, 0, 20, 110, GREY); circle(c, 0, 20, 80, rgba(a)); circle(c, -20, 0, 22, "rgba(255,255,255,0.6)"); circle(c, 160, -70, 18, RED); },
  heart(c, a) { c.beginPath(); c.moveTo(0, 200); c.bezierCurveTo(-260, 40, -220, -200, 0, -90); c.bezierCurveTo(220, -200, 260, 40, 0, 200); c.fillStyle = RED; c.fill(); circle(c, -100, -60, 30, "rgba(255,255,255,0.4)"); },
  brain(c, a) { for (const [x, y, r] of [[-80, -60, 110], [80, -60, 110], [-110, 50, 90], [110, 50, 90], [0, 60, 100]]) circle(c, x, y, r, "rgb(255,160,190)");
    line(c, [[0, -170], [0, 150]], 10, "rgb(220,110,150)"); for (const s of [-1, 1]) line(c, [[s * 40, -100], [s * 110, -50], [s * 60, 10], [s * 130, 60]], 10, "rgb(220,110,150)"); },
  eye(c, a) { c.beginPath(); c.moveTo(-230, 0); c.quadraticCurveTo(0, -200, 230, 0); c.quadraticCurveTo(0, 200, -230, 0); c.fillStyle = WHITE; c.fill(); circle(c, 0, 0, 100, rgba(a)); circle(c, 0, 0, 50, INK); circle(c, -30, -30, 18, WHITE); },
  balloon(c, a) { c.beginPath(); c.ellipse(0, -60, 150, 180, 0, 0, Math.PI * 2); c.fillStyle = rgba(a); c.fill(); poly(c, [[-20, 115], [20, 115], [0, 140]], rgba(a));
    c.beginPath(); c.moveTo(0, 140); c.bezierCurveTo(-40, 180, 40, 200, 0, 240); c.lineWidth = 6; c.strokeStyle = WHITE; c.stroke(); circle(c, -60, -120, 30, "rgba(255,255,255,0.45)"); },
  bubble(c, a) { circle(c, 0, 0, 190, rgba(lighten(a, 0.5), 0.35)); ring(c, 0, 0, 190, 10, WHITE); c.beginPath(); c.arc(0, 0, 150, Math.PI * 1.1, Math.PI * 1.4); c.lineWidth = 18; c.strokeStyle = "rgba(255,255,255,0.8)"; c.stroke();
    star(c, 200, -170, 40, WHITE, 4); },
  family(c, a) { for (const [x, s, col] of [[-130, 1, rgba(a)], [130, 1, BLUE], [0, 0.65, GREEN]]) { c.save(); c.translate(x, s === 1 ? 0 : 70); c.scale(s, s); circle(c, 0, -120, 60, SKIN); c.beginPath(); c.roundRect(-90, -50, 180, 220, [90, 90, 16, 16]); c.fillStyle = col; c.fill(); c.restore(); }
    c.save(); c.translate(0, -200); c.scale(0.3, 0.3); MORE_MOTIFS.heart(c, a); c.restore(); },
  handshake(c, a) { c.save(); c.rotate(-0.15); rr(c, -230, -40, 140, 110, 20, rgba(a)); rr(c, 90, -40, 140, 110, 20, BLUE);
    c.beginPath(); c.roundRect(-110, -60, 230, 120, 50); c.fillStyle = SKIN; c.fill(); for (let k = 0; k < 4; k++) rr(c, -40 + k * 40, -70, 34, 60, 17, "rgb(240,180,140)"); c.restore(); },
  graduate(c, a) { circle(c, 0, -40, 110, SKIN); poly(c, [[-170, -150], [0, -220], [170, -150], [0, -80]], INK); rr(c, -80, -140, 160, 50, 10, INK); line(c, [[120, -150], [140, -60]], 8, GOLD);
    c.beginPath(); c.roundRect(-150, 80, 300, 160, [120, 120, 10, 10]); c.fillStyle = INK; c.fill(); rr(c, 60, 110, 90, 30, 6, WHITE); },
  student(c, a) { rr(c, -170, -100, 160, 230, 12, rgba(a)); rr(c, -20, -130, 160, 260, 12, BLUE); rr(c, 120, -90, 100, 220, 12, GREEN); rr(c, -200, 130, 440, 30, 8, BROWN); },
  bed(c, a) { rr(c, -230, 0, 460, 120, 20, rgba(a)); rr(c, -230, -120, 50, 300, 14, BROWN); rr(c, 180, -40, 50, 220, 14, BROWN); rr(c, -170, -50, 130, 60, 30, WHITE);
    for (const [x, y, s] of [[60, -140, 60], [140, -200, 44], [200, -250, 32]]) text(c, "Z", x, y, s * 1.6, WHITE); },
  beach(c, a) { c.beginPath(); c.ellipse(0, 190, 260, 60, 0, 0, Math.PI * 2); c.fillStyle = GOLD; c.fill(); line(c, [[-60, 180], [-20, -150]], 20, BROWN);
    for (let k = 0; k < 5; k++) { c.save(); c.translate(-20, -150); c.rotate(-Math.PI / 2 + (k - 2) * 0.55); c.beginPath(); c.ellipse(90, 0, 100, 26, 0, 0, Math.PI * 2); c.fillStyle = GREEN; c.fill(); c.restore(); }
    circle(c, 150, -150, 60, rgba(a)); },
};
