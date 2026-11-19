// Renders the soundtrack (with the reel's narration in the breakdown) to soundtrack.wav.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://127.0.0.1:8099/music.html');
  const t0 = Date.now();
  const r = await p.evaluate(async () => { const narr = await (await fetch('assets/narr_quiz.wav')).arrayBuffer(); return window.renderSoundtrack({ narr, narrGain: 1.15 }); });
  fs.writeFileSync('soundtrack_raw.wav', Buffer.from(r.wav, 'base64'));
  console.log('rendered', r.seconds.toFixed(2), 's, peak', r.peak.toFixed(3), 'in', ((Date.now() - t0) / 1000).toFixed(1), 's'); console.log(errs.join('\n') || 'no page errors'); await b.close(); })();
