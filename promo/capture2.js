// Second pass: screenshot pairs one known scroll distance apart (review and Library), plus where the
// fixed bottom bars start, so the promo can scroll the content while the app's bars stay put.
const { chromium } = require('playwright'); const fs = require('fs');
const OUT = 'ui', boxes = JSON.parse(fs.readFileSync(`${OUT}/boxes.json`));
(async () => {
  const ctx = await chromium.launchPersistentContext('profile', { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, serviceWorkers: 'block' });
  const p = ctx.pages()[0] || await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://127.0.0.1:8098/index.html'); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 }); await p.waitForTimeout(800);
  const top = (sel) => p.evaluate((sel) => document.querySelector(sel)?.getBoundingClientRect().top ?? null, sel);
  // Library
  await p.click('nav [data-tab="library"]'); await p.waitForTimeout(1800); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/p_library.png` }); boxes.libBand = await top('nav.nav');
  await p.evaluate(() => window.scrollTo(0, 520)); await p.waitForTimeout(600); boxes.libScroll = await p.evaluate(() => window.scrollY);
  await p.screenshot({ path: `${OUT}/p_library_b.png` });
  // Review (Crypto + Quiz are still selected from the main capture)
  await p.click('nav [data-tab="create"]'); await p.waitForTimeout(400);
  await p.click(`#niches .chip >> text="Crypto"`); await p.click(`#modes .chip >> text="Quiz"`);
  await p.click('#go'); await p.waitForSelector('#review:not(.hidden)', { timeout: 300000 });
  for (let guard = 0; guard < 40; guard++) {
    const next = await p.evaluate(() => { for (const sc of document.querySelectorAll('#scenes .scene')) { const tag = sc.querySelector('.scene-tag')?.textContent || '', on = sc.querySelector('[data-vmode].on')?.dataset.vmode || '';
      const any = sc.querySelector('[data-vmode]'); if (!any || /Big words/.test(tag)) continue; const i = any.dataset.vmode.split(':')[0], want = sc.querySelector(`[data-vmode="${i}:chart"]`) ? `${i}:chart` : `${i}:illus`; if (on !== want) return want; } return null; });
    if (!next) break; await p.click(`[data-vmode="${next}"]`); await p.waitForTimeout(250);
  }
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/p_review.png` }); boxes.reviewBand = await top('#review .sticky-actions');
  await p.evaluate(() => window.scrollTo(0, 470)); await p.waitForTimeout(900); boxes.reviewScroll = await p.evaluate(() => window.scrollY);
  boxes.reviewBandB = await top('#review .sticky-actions');
  await p.screenshot({ path: `${OUT}/p_review_b.png` });
  await p.click('#cancel-review').catch(() => {});
  fs.writeFileSync(`${OUT}/boxes.json`, JSON.stringify(boxes, null, 1));
  fs.writeFileSync(`${OUT}/boxes.js`, `window.BOXES = ${JSON.stringify(boxes)};\n`);
  console.log(JSON.stringify(boxes), errs.join(' | ') || 'no page errors'); await ctx.close();
})();
