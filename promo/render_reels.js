// Makes real reels with the current ReelBot (local copy of the deployed app), using only app-made visuals.
const { chromium } = require('playwright'); const fs = require('fs');
const only = process.argv[2] ? process.argv[2].split(',') : null;
const REELS = [
  { name: 'quiz',     niche: 'Crypto',           mode: 'Quiz',         voice: 'Heart',   caps: 'Bold',                    art: 'Neon',      color: '#FFD60A' },
  { name: 'market',   niche: 'Investing',        mode: 'Market recap', voice: 'Michael', caps: 'Punch (1–2 big words)',   art: 'Blueprint', color: '#2ED573' },
  { name: 'explainer',niche: 'Personal Finance', mode: 'Explainer',    voice: 'Bella',   caps: 'Punch (1–2 big words)',   art: 'Pop art',   color: '#FF6B81', topic: /compound/i },
  { name: 'topic',    niche: 'Investing',        mode: 'Your topic',   voice: 'George',  caps: 'Boxed',                   art: 'Paper cut', color: '#00D2FF', custom: 'Warren Buffett' },
].filter((r) => !only || only.includes(r.name));
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://127.0.0.1:8098/index.html'); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  for (const r of REELS) {
    const t0 = Date.now();
    try {
      await p.click('nav [data-tab="create"]'); await p.waitForTimeout(300);
      await p.click(`#niches .chip >> text="${r.niche}"`); await p.click(`#modes .chip >> text="${r.mode}"`);
      if (r.topic) { const v = await p.evaluate((src) => { const re = new RegExp(src, 'i'); const o = [...document.querySelectorAll('#topic option')].find((x) => re.test(x.textContent)); return o?.value; }, r.topic.source); if (v) await p.selectOption('#topic', v); }
      if (r.custom) await p.fill('#custom', r.custom);
      await p.click(`#voices .chip >> text="${r.voice}"`); await p.click(`#cap-styles .chip >> text="${r.caps}"`); await p.click(`#art-styles .chip >> text="${r.art}"`);
      await p.click(`#swatches [data-color="${r.color}"]`); await p.click('#lengths .chip >> text="Standard 30–45s"').catch(() => {});
      await p.click('#go'); await p.waitForSelector('#review:not(.hidden)', { timeout: 300000 });
      // Charts where the app offers one, the app's own illustrations elsewhere; "big words" scenes stay kinetic.
      for (let guard = 0; guard < 40; guard++) {
        const next = await p.evaluate(() => {
          for (const sc of document.querySelectorAll('#scenes .scene')) {
            const tag = sc.querySelector('.scene-tag')?.textContent || '', on = sc.querySelector('[data-vmode].on')?.dataset.vmode || '';
            const any = sc.querySelector('[data-vmode]'); if (!any || /Big words/.test(tag)) continue;
            const i = any.dataset.vmode.split(':')[0], chart = sc.querySelector(`[data-vmode="${i}:chart"]`);
            const want = chart ? `${i}:chart` : `${i}:illus`;
            if (on !== want) return want;
          }
          return null; });
        if (!next) break; await p.click(`[data-vmode="${next}"]`); await p.waitForTimeout(250);
      }
      const tags = await p.$$eval('#scenes .scene-tag', (els) => els.map((e) => e.textContent.trim()));
      const title = await p.textContent('#review-title');
      const prev = await p.evaluate(() => window.__lastReel?.id || null);
      await p.click('#produce');
      await p.waitForFunction((prev) => (window.__lastReel && window.__lastReel.id !== prev) || /couldn't/i.test(document.getElementById('result').textContent), prev, { timeout: 900000, polling: 1000 });
      const out = await p.evaluate(async () => { const r = window.__lastReel; if (!r?.blob) return null;
        const enc = async (blob) => { const u = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
        return { video: await enc(r.blob), ext: r.ext || 'mov', cover: r.cover ? await enc(r.cover) : null, title: r.title, duration: r.duration, how: r.how }; });
      if (!out) throw new Error('no reel: ' + (await p.textContent('#result')).slice(0, 200));
      fs.writeFileSync(`reels/${r.name}.${out.ext}`, Buffer.from(out.video, 'base64')); if (out.cover) fs.writeFileSync(`reels/${r.name}_cover.jpg`, Buffer.from(out.cover, 'base64'));
      console.log(`✓ ${r.name}: "${out.title}" ${Math.round(out.duration)}s via ${out.how} in ${Math.round((Date.now() - t0) / 1000)}s\n   review: ${title}\n   ${tags.join('\n   ')}`);
    } catch (e) { console.log(`✗ ${r.name}: ${String(e.message || e).split('\n')[0]}`); await p.screenshot({ path: `reels/${r.name}_fail.png` }).catch(() => {}); }
  }
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
