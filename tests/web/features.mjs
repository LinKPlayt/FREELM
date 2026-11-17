// End-to-end tests of every feature, as a user would use them (phone-sized browser). Makes real
// videos, so it takes a while and needs the internet (photos, headlines, Wikipedia).
const until = (page, fn, arg, timeout = 600000) => page.waitForFunction(fn, arg, { timeout, polling: 500 });

export default async function ({ t, newPage }) {
  const page = await newPage();
  const toastLog = () => page.evaluate(() => { window.__toasts = []; const el = document.getElementById("toast"); new MutationObserver(() => window.__toasts.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true }); });
  await toastLog();

  t.section("Features: settings are remembered");
  try {
    await page.click('#swatches [data-c="#2ED573"], #swatches button:nth-child(2)').catch(() => {});
    await page.click('#speeds .chip >> text="Slow"'); await page.click('#voices .chip >> text="Michael"'); await page.click('#music-vol .chip >> text="High"');
    await page.click('#ctas .chip >> text="Save this"'); await page.click('#lengths .chip >> text="Long 40–60s"'); await page.click('#depths .chip >> text="Deep"');
    await page.fill("#brand", "Test Brand"); await page.fill("#handle", "@tester"); await page.fill("#say-as", "ETF = E T F");
    await page.dispatchEvent("#say-as", "input");
    await page.reload(); await until(page, () => window.__ready, null, 60000); await toastLog();
    const kept = await page.evaluate(() => ({ speed: document.querySelector("#speeds .on")?.textContent, voice: document.querySelector("#voices .on")?.textContent, vol: document.querySelector("#music-vol .on")?.textContent,
      cta: document.querySelector("#ctas .on")?.textContent, len: document.querySelector("#lengths .on")?.textContent, depth: document.querySelector("#depths .on")?.textContent, sayAs: document.getElementById("say-as").value }));
    t.ok(kept.speed === "Slow" && kept.voice === "Michael" && kept.vol === "High" && kept.cta === "Save this" && /Long/.test(kept.len) && kept.depth === "Deep" && /E T F/.test(kept.sayAs), "voice, speed, music volume, ending, length, depth and pronunciations survive a reload", JSON.stringify(kept));
    await page.click('#speeds .chip >> text="Normal"'); await page.click('#lengths .chip >> text="Standard 30–45s"'); await page.click('#depths .chip >> text="Standard"');
  } catch (e) { t.ok(false, "section crashed: Features: settings are remembered", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }

  t.section("Features: every niche and type writes a script");
  try {
    const niches = await page.$$eval("#niches .chip", (els) => els.map((e) => e.textContent));
    const customs = { Crypto: "Stablecoin", Economy: "Inflation", Investing: "Index fund", "Personal Finance": "Credit score", "Real Estate": "Mortgage", "Side Hustles": "Freelancer" };
    for (const n of niches) for (const m of ["Explainer", "Today's news", "Market recap", "Your topic"]) {
      await page.click(`#niches .chip >> text="${n}"`); await page.click(`#modes .chip >> text="${m}"`);
      if (m === "Your topic") await page.fill("#custom", customs[n] || "Budget");
      await page.click("#go");
      await page.waitForSelector("#review:not(.hidden), #result:not(.hidden)", { timeout: 180000 });
      if (await page.isVisible("#result")) { t.ok(false, `${n} / ${m}`, (await page.innerText("#result")).slice(0, 150)); continue; }
      const texts = await page.$$eval(".scene textarea", (els) => els.map((e) => e.value));
      const bad = texts.filter((x) => !x.trim() || /undefined|NaN|null|\[object/.test(x));
      t.ok(texts.length >= 4 && !bad.length, `${n} / ${m}: ${texts.length} scenes`, bad.join(" / "));
      await page.click("#cancel-review");
    }
  } catch (e) { t.ok(false, "section crashed: Features: every niche and type writes a script", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }

  t.section("Features: review screen");
  try {
    await page.click('#niches .chip >> text="Investing"'); await page.click('#modes .chip >> text="Explainer"'); await page.click("#go");
    await page.waitForSelector("#review:not(.hidden)", { timeout: 180000 });
    const n0 = await page.locator(".scene").count();
    await page.click("#add-line"); t.ok(await page.locator(".scene").count() === n0 + 1, "+ Add a line adds a scene");
    await page.locator("[data-del]").first().click(); t.ok(await page.locator(".scene").count() === n0, "Remove deletes a scene");
    const h0 = await page.inputValue('[data-line="0"]'); await page.click("[data-hook]");
    t.ok((await page.inputValue('[data-line="0"]')) !== h0, "Another hook changes the hook");
    const chips = await page.locator('[data-vmode^="1:"]').count();
    for (const m of ["illus", "photo", "auto"]) await page.click(`[data-vmode="1:${m}"]`).catch(() => {});
    t.ok(chips >= 3 && await page.locator('[data-vmode="1:auto"].on').count() === 1, "visual chips switch a scene's picture", String(chips));
    t.ok(/\/100/.test(await page.innerText("#coach")) && /Fact check/.test(await page.innerText("#coach")), "reel score and fact check summary are shown");
    t.ok(await page.locator("details.fact, .fact").count() > 0, "fact check badges are shown on lines");
    await page.fill('[data-line="1"]', "At a ten percent yearly return, money roughly doubles every seven years."); await page.dispatchEvent('[data-line="1"]', "input");
    await until(page, () => /calculation/.test(document.querySelector('[data-fact="1"]')?.textContent || ""), null, 15000).catch(() => {});
    t.ok(/calculation/.test(await page.textContent('[data-fact="1"]')), "an edited line is re-checked (maths verified by calculation)");
    await page.click('[data-search="1"]').catch(() => {}); await page.waitForTimeout(4000);
    await page.click("#save-draft"); await page.waitForTimeout(300);
    t.ok(await page.evaluate(() => JSON.parse(localStorage.getItem("drafts") || "[]").length >= 1), "Save draft stores the script");
  } catch (e) { t.ok(false, "section crashed: Features: review screen", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }

  t.section("Features: make a reel (natural voice) and the Library");
  try {
    await page.evaluate(() => { window.__lastReel = null; window.__lastError = null; });
    await page.click("#produce");
    await until(page, () => window.__lastReel || window.__lastError);
    const reel = await page.evaluate(() => { const x = window.__lastReel; return { err: window.__lastError, sound: x?.sound, dur: x?.duration, srt: (x?.srt || "").split("-->").length - 1, cover: x?.cover?.size, script: x?.script }; });
    t.ok(!reel.err && reel.sound === true && reel.dur > 25, `reel made with sound (${Math.round(reel.dur || 0)} s)`, reel.err);
    t.ok(reel.srt > 3 && reel.cover > 10000, "captions file and cover image are made", JSON.stringify({ srt: reel.srt, cover: reel.cover }));
    t.ok(/Save this/.test(reel.script || ""), "the chosen ending is used", (reel.script || "").split("\n").at(-1));
    const toasts = await page.evaluate(() => window.__toasts.join(" | "));
    t.ok(!/classic voice/i.test(toasts), "the natural voice was used (no fallback)", toasts);
    await page.click('nav [data-tab="library"]');
    await page.waitForSelector("#reels [data-reel]");
    for (const p of ["youtube", "tiktok", "instagram"]) {
      await page.locator(`#reels [data-reel] [data-act="cap-${p}"]`).first().click(); await page.waitForTimeout(300);
      t.ok(/copied/i.test(await page.textContent("#toast")) || await page.locator("#copy-sheet").count(), `copy ${p} caption`);
      if (await page.locator("#copy-sheet").count()) await page.click('[data-sheet="close"]');
    }
    t.ok(await page.locator('#reels [data-act="cover"]').count() > 0 && await page.locator('#reels [data-act="srt"]').count() > 0, "Library has cover and captions buttons");
    t.ok(await page.locator("[data-draft-open]").count() === 0, "a draft is cleared once its video is made");
  } catch (e) { t.ok(false, "section crashed: Features: make a reel (natural voice) and the Library", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }

  t.section("Features: deep dive and full story");
  try {
    for (const [len, need] of [["Deep dive 60–90s", 3], ["Full story 2–3 min", 3]]) {
      await page.click('nav [data-tab="create"]').catch(() => {});
      await page.click(`#lengths .chip >> text="${len}"`); await page.click('#niches .chip >> text="Crypto"'); await page.click('#modes .chip >> text="Your topic"'); await page.fill("#custom", "Stablecoin");
      await page.click("#go"); await page.waitForSelector("#review:not(.hidden)", { timeout: 300000 });
      const tags = await page.$$eval(".scene-tag", (els) => els.map((e) => e.textContent));
      t.ok(tags.filter((x) => /Chapter/.test(x)).length >= need && tags.some((x) => /Recap/.test(x)), `${len}: chapters and recap`, tags.filter((x) => /Chapter|Recap/.test(x)).join(", "));
      await page.click("#cancel-review");
    }
    await page.click('#lengths .chip >> text="Standard 30–45s"');
  } catch (e) { t.ok(false, "section crashed: Features: deep dive and full story", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }

  t.section("Features: plan my week, voice preview, logo");
  try {
    await page.click("#plan-week");
    await until(page, () => /week is planned|Couldn't|stopped/.test(document.getElementById("result").textContent), null, 600000);
    t.ok(/week is planned/.test(await page.innerText("#result")), "Plan my week saves drafts", (await page.innerText("#result")).slice(0, 160));
    await page.click('nav [data-tab="library"]'); await page.locator("[data-draft-open]").first().click();
    await page.waitForSelector("#review:not(.hidden)", { timeout: 180000 });
    t.ok(await page.locator(".scene").count() >= 4, "a saved draft opens in the review screen, with photos found again");
    await page.click("#cancel-review"); await page.click('nav [data-tab="create"]').catch(() => {});
    for (const v of ["Heart", "Classic (fast)"]) {
      await page.click(`#voices .chip >> text="${v}"`); await page.evaluate(() => { window.__toasts = []; });
      await page.click("#voice-preview");
      await until(page, () => document.getElementById("voice-preview").textContent.includes("Hear it"), null, 300000);
      const tl = await page.evaluate(() => window.__toasts.join(" | "));
      t.ok(!/Couldn't|didn't work/.test(tl), `voice preview plays: ${v}`, tl);
    }
    await page.click('#voices .chip >> text="Michael"');
  } catch (e) { t.ok(false, "section crashed: Features: plan my week, voice preview, logo", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }

  t.section("Features: Idea Lab");
  try {
    await page.click('nav [data-tab="ideas"]');
    await until(page, () => /articles on your phone/.test(document.getElementById("lib-info").textContent), null, 60000);
    await page.fill("#idea-q", "index funds"); await page.click("#idea-research");
    await until(page, () => /Research brief/.test(document.getElementById("brief").textContent), null, 60000);
    t.ok(/Key facts/.test(await page.innerText("#brief")), "research brief with key facts");
    await page.waitForSelector("#idea-feed [data-idea]", { timeout: 120000 });
    t.ok(await page.locator("#idea-feed [data-idea]").count() >= 2, "ideas appear");
    await page.locator('#idea-feed [data-act-idea="save"]').first().click();
    t.ok(await page.locator('#saved-ideas [data-idea]').count() >= 1, "Save keeps an idea");
    await page.click("#ai-load");
    await until(page, () => /Ready|couldn't/.test(document.getElementById("ai-sub").textContent), null, 300000);
    t.ok(/Ready/.test(await page.textContent("#ai-sub")), "on-device AI downloads and starts", await page.textContent("#ai-sub"));
    await page.locator('#idea-feed [data-act-idea="make"]').first().click();
    await page.waitForSelector("#review:not(.hidden), #result:not(.hidden)", { timeout: 300000 });
    t.ok(await page.isVisible("#review"), "Make this reel turns an idea into a script"); if (await page.isVisible("#review")) await page.click("#cancel-review");
  } catch (e) { t.ok(false, "section crashed: Features: Idea Lab", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }

  t.section("Features: About tab checks");
  try {
    await page.click('nav [data-tab="about"]'); await page.click("#ai-check");
    await page.waitForSelector("#ai-check-copy", { timeout: 600000 });
    const check = await page.innerText("#ai-check-out");
    t.ok(!/✗/.test(check) && (check.match(/✓/g) || []).length >= 5, "AI & voice check passes every step", check.split("\n").filter((l) => /✗/.test(l)).join(" | "));
    await page.click("#sound-test");
    await page.waitForSelector("#copy-diag", { timeout: 300000 });
    t.ok(/Sound in the file/.test(await page.innerText("#sound-out")), "sound test runs");
  } catch (e) { t.ok(false, "section crashed: Features: About tab checks", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }

  t.section("Features: crash guards");
  try {
    await page.evaluate(() => { localStorage.setItem("aiOn", "1"); localStorage.setItem("aiLoading", "1"); localStorage.setItem("voiceBusy", "1"); });
    await page.reload(); await until(page, () => window.__ready, null, 60000);
    await page.click('nav [data-tab="ideas"]'); await until(page, () => /articles on your phone/.test(document.getElementById("lib-info").textContent), null, 60000);
    t.ok(/closed the app/.test(await page.textContent("#ai-sub")), "after a crash while loading the AI, it isn't auto-loaded again");
    await page.click('nav [data-tab="create"]').catch(() => {});
    await page.click("#voice-preview"); await until(page, () => document.getElementById("voice-preview").textContent.includes("Hear it"), null, 300000);
    t.ok(await page.evaluate(() => localStorage.getItem("voiceLevel")) === "classic", "after a crash while voicing, the classic voice is used");
    await page.click('#voices .chip >> text="Michael"');
    t.ok(await page.evaluate(() => localStorage.getItem("voiceLevel")) === "q8", "tapping a natural voice retries it");
  } catch (e) { t.ok(false, "section crashed: Features: crash guards", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }

  t.section("Features: Library management");
  try {
    await page.click('nav [data-tab="library"]'); await page.waitForSelector("#reels [data-reel]");
    const before = await page.locator("#reels [data-reel]").count();
    await page.locator('#reels [data-act="delete"]').first().click(); await page.waitForTimeout(500);
    t.ok(await page.locator("#reels [data-reel]").count() === before - 1, "Delete removes a reel");
    await page.context().close();
  } catch (e) { t.ok(false, "section crashed: Features: Library management", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }

  t.section("Features: works offline after the first visit (service worker)");
  try {
    const off = await newPage({ sw: true });
    await off.reload(); await until(off, () => window.__ready && navigator.serviceWorker.controller, null, 60000);
    await off.context().setOffline(true);
    await off.reload(); await until(off, () => window.__ready, null, 60000);
    t.ok(await off.evaluate(() => !!document.getElementById("go")), "the app opens with no internet");
    await off.click("#offline + span"); await off.click('#modes .chip >> text="Explainer"'); await off.click("#go");
    await off.waitForSelector("#review:not(.hidden), #result:not(.hidden)", { timeout: 120000 });
    t.ok(await off.isVisible("#review"), "Offline mode writes a script with no internet");
    await off.context().close();
  } catch (e) { t.ok(false, "section crashed: Features: works offline after the first visit (service worker)", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }
}
