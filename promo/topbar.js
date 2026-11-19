const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const ctx = await chromium.launchPersistentContext('profile', { viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, serviceWorkers: 'block' }); const p = ctx.pages()[0] || await ctx.newPage();
  await p.goto('http://127.0.0.1:8098/index.html'); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await p.click('nav [data-tab="library"]'); await p.waitForTimeout(800); await p.evaluate(() => window.scrollTo(0, 520)); await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const t = document.querySelector('.topbar'); const cs = getComputedStyle(t); return { bottom: t.getBoundingClientRect().bottom, pos: cs.position, bg: cs.backgroundImage.slice(0, 80) }; });
  const bx = JSON.parse(fs.readFileSync('ui/boxes.json')); bx.topBand = Math.ceil(r.bottom); fs.writeFileSync('ui/boxes.json', JSON.stringify(bx, null, 1)); fs.writeFileSync('ui/boxes.js', `window.BOXES = ${JSON.stringify(bx)};\n`);
  console.log(JSON.stringify(r)); await ctx.close(); })();
