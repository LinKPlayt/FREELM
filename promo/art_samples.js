const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://127.0.0.1:8098/index.html');
  const out = await p.evaluate(async () => { const IL = await import('./app/illustrator.js'); const res = {};
    const specs = { flat: [['piggy', 'coins', 'chartUp'], [250, 204, 21]], neon: [['bitcoin', 'chain', 'rocket'], [0, 210, 255]], paper: [['house', 'key', 'calendar'], [255, 159, 26]],
      blueprint: [['bank', 'chartUp', 'gear'], [46, 213, 115]], pop: [['rocket', 'cash', 'trophy'], [255, 107, 129]] };
    for (const [style, [motifs, accent]] of Object.entries(specs)) { const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
      IL.drawArt(c.getContext('2d'), { motifs, style, accent, seed: 'promo' }); res[style] = c.toDataURL('image/png'); }
    return res; });
  for (const [k, v] of Object.entries(out)) fs.writeFileSync(`assets/art_${k}.png`, Buffer.from(v.split(',')[1], 'base64'));
  console.log(Object.keys(out).join(' '), errs.join('\n') || 'no page errors'); await b.close(); })();
