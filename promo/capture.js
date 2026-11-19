// Captures the real ReelBot UI for the promo: the Studio taps, the review, the live progress of a real
// render, the result, the Library, Home and Automation, at phone (3x) and desktop (2x) resolution.
// Everything shown is real: reels made here, and a week planned here. Usage: node capture.js [phone|desktop|all]
const { chromium } = require('playwright'); const fs = require('fs');
const OUT = 'ui', PROFILE = 'profile', APP = 'http://127.0.0.1:8098/index.html';
const what = process.argv[2] || 'all';
fs.mkdirSync(OUT, { recursive: true });
const boxes = fs.existsSync(`${OUT}/boxes.json`) ? JSON.parse(fs.readFileSync(`${OUT}/boxes.json`)) : {};
const saveBoxes = () => fs.writeFileSync(`${OUT}/boxes.json`, JSON.stringify(boxes, null, 1));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function open(viewport, dpr) {
  const ctx = await chromium.launchPersistentContext(PROFILE, { viewport, deviceScaleFactor: dpr, serviceWorkers: 'block' });
  const p = ctx.pages()[0] || await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(String(e)));
  await p.goto(APP); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 }); await p.waitForTimeout(600);
  return { ctx, p };
}
const box = (p, sel) => p.evaluate((sel) => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r && { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
const chipBox = async (p, wrap, label) => { const h = await p.$(`${wrap} .chip >> text="${label}"`); const b = await h.boundingBox(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };

async function setup(p, r) {
  await p.click('nav [data-tab="create"]'); await p.waitForTimeout(300);
  if (r.niche) await p.click(`#niches .chip >> text="${r.niche}"`);
  if (r.mode) await p.click(`#modes .chip >> text="${r.mode}"`);
  if (r.custom) await p.fill('#custom', r.custom);
  await p.click(`#voices .chip >> text="${r.voice}"`); await p.click(`#cap-styles .chip >> text="${r.caps}"`); await p.click(`#art-styles .chip >> text="${r.art}"`);
  await p.click(`#swatches [data-color="${r.color}"]`);
}
async function pickVisuals(p) {   // charts where offered, the app's illustrations elsewhere; "big words" stay kinetic
  for (let guard = 0; guard < 40; guard++) {
    const next = await p.evaluate(() => {
      for (const sc of document.querySelectorAll('#scenes .scene')) {
        const tag = sc.querySelector('.scene-tag')?.textContent || '', on = sc.querySelector('[data-vmode].on')?.dataset.vmode || '';
        const any = sc.querySelector('[data-vmode]'); if (!any || /Big words/.test(tag)) continue;
        const i = any.dataset.vmode.split(':')[0], want = sc.querySelector(`[data-vmode="${i}:chart"]`) ? `${i}:chart` : `${i}:illus`;
        if (on !== want) return want;
      } return null; });
    if (!next) break; await p.click(`[data-vmode="${next}"]`); await p.waitForTimeout(250);
  }
}
async function produceAndWait(p, onTick) {
  const prev = await p.evaluate(() => window.__lastReel?.id || null);
  await p.click('#produce');
  for (;;) {
    const s = await p.evaluate((prev) => ({ done: Boolean(window.__lastReel && window.__lastReel.id !== prev), failed: /couldn't/i.test(document.getElementById('result').textContent),
      f: parseFloat(document.getElementById('bar').style.width) / 100 || 0 }), prev);
    if (s.done || s.failed) return s;
    if (onTick) await onTick(s.f);
    await p.waitForTimeout(250);
  }
}

const REELS = {
  market:    { niche: 'Investing',        mode: 'Market recap', voice: 'Michael', caps: 'Punch (1–2 big words)', art: 'Blueprint', color: '#2ED573' },
  explainer: { niche: 'Personal Finance', mode: 'Explainer',    voice: 'Bella',   caps: 'Punch (1–2 big words)', art: 'Pop art',   color: '#FF6B81', topic: 'compound' },
  topic:     { niche: 'Investing',        mode: 'Your topic',   voice: 'George',  caps: 'Boxed',                 art: 'Paper cut', color: '#00D2FF', custom: 'Warren Buffett' },
};

async function phone() {
  const { ctx, p } = await open({ width: 393, height: 852 }, 3);
  // Three more real reels first, so the Library and Home have something real to show. The quiz is made last, on camera.
  const make = process.argv[3] ? process.argv[3].split(',').filter(Boolean) : Object.keys(REELS);
  for (const [name, r] of Object.entries(REELS).filter(([n]) => make.includes(n))) {
    await setup(p, r);
    if (r.topic) { const v = await p.evaluate((w) => [...document.querySelectorAll('#topic option')].find((o) => o.textContent.toLowerCase().includes(w))?.value, r.topic); if (v) await p.selectOption('#topic', v); }
    await p.click('#go'); await p.waitForSelector('#review:not(.hidden)', { timeout: 300000 }); await pickVisuals(p);
    const s = await produceAndWait(p); log(name, s.done ? 'made' : 'FAILED');
  }
  // The Studio, before and after the two taps; Personal Finance + Auto are the defaults a new user sees.
  const quiz = { voice: 'Heart', caps: 'Bold', art: 'Neon', color: '#FFD60A' };
  await setup(p, quiz);
  await p.reload(); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 }); await p.waitForTimeout(800);
  await p.click('nav [data-tab="create"]'); await p.waitForTimeout(300);
  await p.click(`#niches .chip >> text="Personal Finance"`); await p.click(`#modes .chip >> text="Auto"`);
  await p.click('nav [data-tab="create"]'); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/p_studio_a.png` });
  boxes.crypto = await chipBox(p, '#niches', 'Crypto'); boxes.quiz = await chipBox(p, '#modes', 'Quiz'); boxes.go = await box(p, '#go');
  await p.click(`#niches .chip >> text="Crypto"`); await p.waitForTimeout(350); await p.screenshot({ path: `${OUT}/p_studio_b.png` });
  await p.click(`#modes .chip >> text="Quiz"`); await p.waitForTimeout(350); await p.screenshot({ path: `${OUT}/p_studio_c.png` });
  saveBoxes();
  // The review screen, then the real render, captured as it goes.
  await p.click('#go'); await p.waitForSelector('#review:not(.hidden)', { timeout: 300000 }); await pickVisuals(p);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/p_review.png` }); await p.screenshot({ path: `${OUT}/p_review_full.png`, fullPage: true });
  const marks = [0.02, 0.3, 0.45, 0.62, 0.8, 0.97]; let k = 0;
  const s = await produceAndWait(p, async (f) => { while (k < marks.length && f >= marks[k]) { await p.screenshot({ path: `${OUT}/p_job_${k}.png` }); log('job', k, f.toFixed(2)); k++; } });
  log('quiz', s.done ? 'made' : 'FAILED');
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/p_result.png` }); await p.screenshot({ path: `${OUT}/p_result_full.png`, fullPage: true });
  await p.click('nav [data-tab="library"]'); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/p_library.png` }); await p.screenshot({ path: `${OUT}/p_library_full.png`, fullPage: true });
  await p.click('nav [data-tab="home"]'); await p.waitForTimeout(1200); await p.screenshot({ path: `${OUT}/p_home.png` }); await p.screenshot({ path: `${OUT}/p_home_full.png`, fullPage: true });
  await p.click('nav [data-tab="create"]'); await p.evaluate(() => document.getElementById('step-voice').scrollIntoView()); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/p_voices.png` });
  await p.evaluate(() => document.getElementById('step-look').scrollIntoView()); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/p_look.png` });
  log('phone errors:', p.errs.join(' | ') || 'none'); await ctx.close();
}

async function desktop() {
  const { ctx, p } = await open({ width: 1440, height: 900 }, 2);
  // A real week of drafts.
  await p.click('nav [data-tab="create"]'); await p.click(`#niches .chip >> text="Investing"`); await p.click(`#modes .chip >> text="Auto"`);
  await p.click('nav [data-tab="auto"]'); await p.click('#plan-week');
  await p.waitForFunction(() => /week is planned|Couldn't|stopped/.test(document.getElementById('result').textContent), null, { timeout: 900000, polling: 1000 });
  log('week:', (await p.textContent('#result h2')));
  await p.click('nav [data-tab="auto"]'); await p.waitForTimeout(1200); await p.screenshot({ path: `${OUT}/d_auto.png` });
  await p.click('nav [data-tab="home"]'); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/d_home.png` });
  await p.click('nav [data-tab="library"]'); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/d_library.png` });
  await p.click('nav [data-tab="create"]'); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/d_studio.png` });
  log('desktop errors:', p.errs.join(' | ') || 'none'); await ctx.close();
}

(async () => { if (what === 'phone' || what === 'all') await phone(); if (what === 'desktop' || what === 'all') await desktop(); log('done'); })();
