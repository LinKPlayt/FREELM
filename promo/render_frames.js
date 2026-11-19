// Renders frames to disk with fast CDP captures: node render_frames.js <wide|tall> <fps> <dir> [from] [to]
// Frame i is the picture at t = i / fps, saved as <dir>/<i, 6 digits>.jpg, so any range can be re-rendered alone.
const { chromium } = require('playwright'); const fs = require('fs');
const [fmt = 'wide', fpsArg = '60', dir = 'frames_' + fmt, fromArg = '0', toArg = '52'] = process.argv.slice(2);
const fps = Number(fpsArg), W = fmt === 'tall' ? 1080 : 1920, H = fmt === 'tall' ? 1920 : 1080;
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://127.0.0.1:8099/promo.html?fmt=${fmt}`); await p.evaluate(() => window.ready);
  const cdp = await p.context().newCDPSession(p);
  const i0 = Math.round(Number(fromArg) * fps), i1 = Math.round(Number(toArg) * fps), t0 = Date.now();
  for (let i = i0; i < i1; i++) {
    await p.evaluate((t) => window.render(t), i / fps);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 94, optimizeForSpeed: true });
    fs.writeFileSync(`${dir}/${String(i).padStart(6, '0')}.jpg`, Buffer.from(data, 'base64'));
    if ((i - i0) % (fps * 4) === 0) console.log(`${fmt} ${(i / fps).toFixed(1)}s  ${((Date.now() - t0) / (i - i0 + 1)).toFixed(0)} ms/frame`);
  }
  console.log(`${fmt}: ${i1 - i0} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`, errs.slice(0, 5).join(' | ') || 'no page errors'); await b.close();
})();
