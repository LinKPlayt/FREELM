import { readFileSync } from "node:fs";
// End-to-end tests of every feature, as a user would use them (phone-sized browser). Makes real
// videos, so it takes a while and needs the internet (photos, headlines, Wikipedia).
const until = (page, fn, arg, timeout = 600000) => page.waitForFunction(fn, arg, { timeout, polling: 500 });

export default async function ({ t, newPage, BASE }) {
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
    for (const n of niches) for (const m of ["Explainer", "Today's news", "Market recap", "Your topic", "Quiz"]) {
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
    t.ok(await page.locator("#series").isVisible(), "an explainer offers a 3-part series");
    const n0 = await page.locator(".scene").count();
    await page.click("#add-line"); t.ok(await page.locator(".scene").count() === n0 + 1, "+ Add a line adds a scene");
    const removedText = await page.inputValue('[data-line="1"]');
    await page.locator('[data-del="1"]').click(); t.ok(await page.locator(".scene").count() === n0, "Remove deletes a scene");
    await page.click("#undo-remove");
    t.ok(await page.locator(".scene").count() === n0 + 1 && (await page.inputValue('[data-line="1"]')) === removedText && await page.locator("#undo-remove").isHidden(), "Undo remove puts the scene back");
    await page.locator("[data-del]").last().click();
    const t1 = await page.inputValue('[data-line="1"]'); await page.click('[data-move="1:1"]');
    t.ok((await page.inputValue('[data-line="2"]')) === t1, "↓ moves a scene down (the hook stays first)");
    await page.click('[data-move="2:-1"]');
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
    // My photo: a bright magenta picture on scene 1, kept on the phone with the script.
    const png = Buffer.from((await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 800; c.height = 800; const x = c.getContext("2d"); x.fillStyle = "#ff00ff"; x.fillRect(0, 0, 800, 800); return c.toDataURL("image/png"); })).split(",")[1], "base64");
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click('[data-mine="1"]')]);
    await chooser.setFiles({ name: "mine.png", mimeType: "image/png", buffer: png });
    const magenta = () => page.evaluate(() => { const c = document.querySelector('[data-thumb="1"]'); if (!c) return false; const d = c.getContext("2d").getImageData(c.width / 2, c.height / 2, 1, 1).data; return d[0] > 200 && d[1] < 60 && d[2] > 200; });
    await until(page, () => /Photo/.test(document.querySelectorAll(".scene-tag")[1]?.textContent || ""), null, 15000).catch(() => {});
    await page.waitForTimeout(500);
    t.ok(await magenta(), "My photo puts your own picture on the scene");
    // Autosave: an edit, then the app is reloaded (as an iPhone does to apps left in the background).
    await page.fill('[data-line="2"]', "This line was edited before the app reloaded."); await page.dispatchEvent('[data-line="2"]', "input");
    await page.waitForTimeout(1200);
    const title = await page.textContent("#review-title");
    await page.reload(); await until(page, () => window.__ready, null, 60000); await toastLog();
    const offered = await page.locator("#resume").isVisible() && /Pick up where you left off/.test(await page.innerText("#resume"));
    await page.click('[data-resume="open"]'); await page.waitForSelector("#review:not(.hidden)", { timeout: 180000 });
    t.ok(offered && (await page.textContent("#review-title")) === title && (await page.inputValue('[data-line="2"]')) === "This line was edited before the app reloaded.",
      "after the app reloads, the script you were reviewing (with your edits) is offered back", JSON.stringify({ offered, title }));
    await page.waitForTimeout(500);
    t.ok(await magenta(), "…and your own photo comes back with it (kept on the phone)");
    // (The review stays open: the next section makes this video.)
  } catch (e) { t.ok(false, "section crashed: Features: review screen", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }

  t.section("Features: make a reel (natural voice) and the Library");
  try {
    await page.evaluate(() => { window.__lastReel = null; window.__lastError = null; });
    await page.click("#produce");
    await until(page, () => document.querySelectorAll("#job-steps li.done").length >= 1, null, 300000).catch(() => {});
    t.ok(await page.locator("#job-steps li").count() === 5 && await page.locator("#job-steps li.done").count() >= 1, "a step checklist shows while the video is made");
    await until(page, () => window.__lastReel || window.__lastError);
    const reel = await page.evaluate(() => { const x = window.__lastReel; return { err: window.__lastError, sound: x?.sound, dur: x?.duration, srt: (x?.srt || "").split("-->").length - 1, cover: x?.cover?.size, script: x?.script }; });
    t.ok(!reel.err && reel.sound === true && reel.dur > 25, `reel made with sound (${Math.round(reel.dur || 0)} s)`, reel.err);
    t.ok(await page.evaluate(() => !localStorage.getItem("autosave")) && await page.locator("#resume").isHidden(), "making the video clears the autosaved script");
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

  t.section("Features: quiz reel");
  try {
    await page.click('nav [data-tab="create"]').catch(() => {});
    await page.click('#niches .chip >> text="Investing"'); await page.click('#modes .chip >> text="Quiz"');
    await page.click('#art-styles .chip >> text="Blueprint"');   // the style you choose is the one the video uses
    await page.click("#go"); await page.waitForSelector("#review:not(.hidden)", { timeout: 120000 });
    const tags = await page.$$eval(".scene-tag", (els) => els.map((e) => e.textContent));
    t.ok(await page.locator("#series").isHidden(), "a quiz doesn't offer a 3-part series");
    // Standard length: 2 questions (Long has 3, a deep dive more), so the quiz fits the length chosen.
    t.ok(tags.filter((x) => /Question \d · countdown/.test(x)).length === 2 && tags.filter((x) => /Answer · (True|False)/.test(x)).length === 2 && tags.some((x) => /Big words/.test(x)), "a Standard quiz has 2 questions with countdowns, 2 answers and a big-words question at the end", tags.join(" | "));
    await page.evaluate(() => { window.__lastReel = null; window.__lastError = null; });
    await page.click("#produce");
    await until(page, () => window.__lastReel || window.__lastError);
    const q = await page.evaluate(() => ({ err: window.__lastError, sound: window.__lastReel?.sound, dur: window.__lastReel?.duration, script: window.__lastReel?.script || "", art: window.__lastReel?.settings?.art }));
    t.ok(q.art === "blueprint", "the illustration style chosen in the Studio is the one the video is made with", String(q.art));
    await page.click('#art-styles .chip >> text="Auto (matches niche)"').catch(() => {});
    t.ok(!q.err && q.sound === true && q.dur > 25 && /True or false/.test(q.script) && /^(True|False)! /m.test(q.script), `a quiz reel is made with sound (${Math.round(q.dur || 0)} s)`, q.err || q.script.slice(0, 160));
  } catch (e) { t.ok(false, "section crashed: Features: quiz reel", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }

  t.section("Features: plan my week, voice preview, logo");
  try {
    await page.click('nav [data-tab="create"]').catch(() => {}); await page.click('#modes .chip >> text="Auto"');
    await page.click('nav [data-tab="auto"]'); await page.click("#plan-week");
    await until(page, () => /week is planned|Couldn't|stopped/.test(document.getElementById("result").textContent), null, 600000);
    const week = await page.innerText("#result");
    t.ok(/week is planned/.test(week) && /Mon · /.test(week) && /(Tue|Wed|Thu) · [^\n]*Quiz/i.test(week), "Plan my week saves a varied week of drafts (with a mid-week quiz)", week.slice(0, 300));
    const [ics] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.click('#result [data-remind]')]);
    const icsText = readFileSync(await ics.path(), "utf8");
    t.ok((icsText.match(/BEGIN:VEVENT/g) || []).length >= 4 && /SUMMARY:Post: /.test(icsText) && /BEGIN:VALARM/.test(icsText) && /DTSTART:\d{8}T180000/.test(icsText), "the planned week becomes calendar reminders (one per day, with an alert)", icsText.slice(0, 200));
    await page.click('nav [data-tab="auto"]'); await page.locator("[data-draft-open]").first().click();
    await page.waitForSelector("#review:not(.hidden)", { timeout: 180000 });
    t.ok(await page.locator(".scene").count() >= 4, "a saved draft opens in the review screen, with photos found again");
    await page.click("#cancel-review");
    // Automation: "Make all" appears with several drafts in the queue.
    await page.click('nav [data-tab="auto"]');
    t.ok(await page.locator("[data-draft-all]").isVisible(), "the Automation queue offers Make all for several drafts", await page.innerText("#drafts").catch(() => ""));
    // Today's video: keep one draft, labelled for today, and make it with one tap from the Create tab.
    const left = await page.evaluate(() => {
      const day = new Date().toLocaleDateString("en-US", { weekday: "short" }), all = JSON.parse(localStorage.getItem("drafts") || "[]");
      const keep = all.slice(-1).map((d) => ({ ...d, label: `${day} · ${d.label.replace(/^\w{3} · /, "")}` }));
      localStorage.setItem("drafts", JSON.stringify(keep)); return keep.length;
    });
    await page.reload(); await until(page, () => window.__ready, null, 60000); await toastLog();
    const landed = await page.evaluate(() => document.querySelector("nav button.active")?.dataset.tab);
    t.ok(landed === "home" && /Make it now/.test(await page.innerText("#home-next")), "a returning user opens on Home, where today's video is up next", landed);
    await page.click('nav [data-tab="create"]');
    t.ok(left === 1 && await page.locator("#today").isVisible() && /Today's video/.test(await page.innerText("#today")), "a draft planned for today shows as Today's video on the Create tab");
    await page.evaluate(() => { window.__lastReel = null; window.__lastError = null; });
    await page.click('[data-today="make"]');
    await until(page, () => window.__batch || window.__lastError || /couldn't|stopped/i.test(document.getElementById("result").textContent), null, 900000);
    const today = await page.evaluate(() => ({ n: (window.__batch || []).length, sound: window.__batch?.[0]?.sound, drafts: JSON.parse(localStorage.getItem("drafts") || "[]").length, err: window.__lastError }));
    t.ok(today.n === 1 && today.sound === true && today.drafts === 0 && await page.locator("#today").isHidden(), "Make it now makes today's video, saves it, and clears it from Drafts", JSON.stringify(today));
    await page.click('nav [data-tab="create"]').catch(() => {});
    for (const v of ["Heart", "Classic (fast)"]) {
      await page.click(`#voices .chip >> text="${v}"`); await page.evaluate(() => { window.__toasts = []; });
      await page.click("#voice-preview");
      await until(page, () => document.getElementById("voice-preview").textContent.includes("Hear it"), null, 300000);
      const tl = await page.evaluate(() => window.__toasts.join(" | "));
      t.ok(!/Couldn't|didn't work/.test(tl), `voice preview plays: ${v}`, tl);
    }
    await page.click('#voices .chip >> text="Michael"');
    // Music preview: plays 8 seconds of the chosen mood.
    await page.click('#moods .chip >> text="Bright"'); await page.evaluate(() => { window.__toasts = []; });
    await page.click("#music-preview");
    const playing = await page.innerText("#music-preview");
    await until(page, () => document.getElementById("music-preview").textContent.includes("Hear it"), null, 30000);
    t.ok(/Stop/.test(playing) && !/Couldn't/.test(await page.evaluate(() => (window.__toasts || []).join(" "))), "music preview plays the chosen mood", playing);
    await page.click('#moods .chip >> text="Lo-fi"');
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
    // (A real crash gives the page no chance to react; a reload counts as leaving the app, which clears the
    // voice flag. So the voice flags are set after the reload, as a crash would have left them.)
    await page.evaluate(() => { localStorage.setItem("aiOn", "1"); localStorage.setItem("aiLoading", "1"); });
    await page.reload(); await until(page, () => window.__ready, null, 60000);
    await page.evaluate(() => { localStorage.setItem("voiceBusy", "1"); localStorage.setItem("voiceStrikes", "1"); });
    await page.click('nav [data-tab="ideas"]'); await until(page, () => /articles on your phone/.test(document.getElementById("lib-info").textContent), null, 60000);
    t.ok(/closed the app/.test(await page.textContent("#ai-sub")), "after a crash while loading the AI, it isn't auto-loaded again");
    await page.click('nav [data-tab="create"]').catch(() => {});
    await page.click("#voice-preview"); await until(page, () => document.getElementById("voice-preview").textContent.includes("Hear it"), null, 300000);
    t.ok(await page.evaluate(() => localStorage.getItem("voiceLevel")) === "classic", "after two crashes in a row while voicing, the classic voice is used");
    await page.click('#voices .chip >> text="Michael"');
    t.ok(await page.evaluate(() => localStorage.getItem("voiceLevel")) === "q8", "tapping a natural voice retries it");
  } catch (e) { t.ok(false, "section crashed: Features: crash guards", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }

  t.section("Features: your music, cover style, results, remix");
  try {
    // a 4-second stereo tone as "your music"
    const rate = 44100, n = rate * 4, wav = Buffer.alloc(44 + n * 4);
    wav.write("RIFF", 0); wav.writeUInt32LE(36 + n * 4, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
    wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(n * 4, 40);
    for (let i = 0; i < n; i++) { const v = Math.round(Math.sin(2 * Math.PI * 330 * i / rate) * 12000); wav.writeInt16LE(v, 44 + i * 4); wav.writeInt16LE(v, 46 + i * 4); }
    await page.click('nav [data-tab="create"]').catch(() => {});
    await page.setInputFiles("#music-file", { name: "my-track.wav", mimeType: "audio/wav", buffer: wav });
    await until(page, () => /my-track/.test(document.getElementById("music-note").textContent), null, 15000);
    t.ok(await page.evaluate(() => document.querySelector("#moods .on")?.textContent) === "My music", "uploading a track selects My music");
    await page.click('#covers .chip >> text="Big number"'); await page.click('#cap-styles .chip >> text="Punch (1–2 big words)"');
    await page.click('#niches .chip >> text="Personal Finance"'); await page.click('#modes .chip >> text="Explainer"');
    await page.evaluate(() => { window.__lastReel = null; window.__lastError = null; });
    if (await page.isChecked("#review-on")) await page.click("#review-on + span");
    await page.click("#go");
    await until(page, () => window.__lastReel || window.__lastError);
    await page.click("#review-on + span");
    const r2 = await page.evaluate(() => ({ err: window.__lastError, sound: window.__lastReel?.sound, settings: window.__lastReel?.settings, cover: window.__lastReel?.cover?.size, id: window.__lastReel?.id }));
    t.ok(!r2.err && r2.sound === true && r2.settings?.music === "mine" && r2.settings?.captions === "punch", "a reel is made with your music (and Punch captions)", JSON.stringify(r2));
    await page.click('#cap-styles .chip >> text="Bold"');
    t.ok(r2.cover > 10000, "a cover is made in the chosen style");
    await page.click('nav [data-tab="library"]'); await page.waitForSelector("#reels [data-reel]");
    const card = page.locator(`#reels [data-reel="${r2.id}"]`);
    await card.locator(".results summary").click();
    await card.locator('[data-result="views"]').fill("15400"); await card.locator('[data-result="likes"]').fill("1200"); await card.locator('[data-result="views"]').dispatchEvent("change");
    const other = page.locator("#reels [data-reel]").nth(1);
    if (await other.count()) { await other.locator(".results summary").click(); await other.locator('[data-result="views"]').fill("4100"); await other.locator('[data-result="views"]').dispatchEvent("change"); }
    t.ok(/What works for you/.test(await page.innerText("#insights")) && /average views/.test(await page.innerText("#insights")), "results show a What works summary", (await page.innerText("#insights")).slice(0, 200));
    // "Use what works": two example results where Save this / Calm / Boxed clearly win.
    await page.evaluate(() => {
      const all = JSON.parse(localStorage.getItem("results") || "{}"), base = { title: "T", created: Date.now(), kind: "evergreen", niche: "investing", duration: 40 };
      all.zz1 = { ...base, settings: { voice: "af_heart", cta: "save", music: "calm", captions: "boxed" }, stats: { views: 900000 } };
      all.zz2 = { ...base, settings: { voice: "af_heart", cta: "follow", music: "lofi", captions: "bold" }, stats: { views: 10 } };
      localStorage.setItem("results", JSON.stringify(all));
    });
    await page.click('nav [data-tab="create"]'); await page.click('nav [data-tab="library"]');
    await page.click("[data-use-best]");
    const used = await page.evaluate(() => ({ cta: localStorage.getItem("cta"), mood: localStorage.getItem("mood"), cap: localStorage.getItem("capStyle"), toast: document.getElementById("toast").textContent }));
    t.ok(used.cta === "save" && used.mood === "calm" && used.cap === "boxed" && /Now using/.test(used.toast), "Use what works applies the best ending, music and caption style", JSON.stringify(used));
    await page.evaluate(() => { const all = JSON.parse(localStorage.getItem("results") || "{}"); delete all.zz1; delete all.zz2; localStorage.setItem("results", JSON.stringify(all)); });
    await page.click('nav [data-tab="create"]');
    for (const [row, label] of [["ctas", "Follow"], ["moods", "Lo-fi"], ["cap-styles", "Bold"]]) await page.click(`#${row} .chip >> text="${label}"`);
    await page.click('nav [data-tab="library"]');
    await page.click('nav [data-tab="create"]').catch(() => {}); await page.click('nav [data-tab="library"]');
    t.ok(/15,400 views/.test(await page.innerText(`#reels [data-reel="${r2.id}"] .results summary`)), "results are kept");
    const caps = await page.evaluate(async (id) => { const S = await import("./app/script.js"); const { listReels } = await import("./app/store.js"); const r = (await listReels()).find((x) => x.id === id); return S.platformCaptions(r).tiktok; }, r2.id);
    t.ok(/#\w+/.test(caps), "captions include topic hashtags", caps.split("\n").find((l) => l.startsWith("#")));
    await page.locator(`#reels [data-reel="${r2.id}"] [data-act="remix"]`).click();
    await page.waitForSelector("#review:not(.hidden)", { timeout: 180000 });
    const remixLines = await page.$$eval(".scene textarea", (els) => els.map((e) => e.value));
    t.ok(remixLines.length >= 4 && remixLines.every((x) => x.trim()), "Remix opens the reel's script for editing", String(remixLines.length));
    await page.click("#cancel-review");
    await page.click('nav [data-tab="create"]').catch(() => {}); await page.click("#music-remove"); await page.click('#covers .chip >> text="Bold title"');
    t.ok(await page.evaluate(async () => !(await (await caches.open("reelbot-user-v1")).match("/user/music"))), "Remove deletes your music");
  } catch (e) { t.ok(false, "section crashed: Features: your music, cover style, results, remix", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }

  t.section("Features: no false low-memory alarms");
  try {
    await page.click('#voices .chip >> text="Michael"');
    // one interrupted attempt: still the natural voice
    await page.reload(); await until(page, () => window.__ready, null, 60000); await page.click('nav [data-tab="create"]');
    await page.evaluate(() => { localStorage.setItem("voiceBusy", "1"); localStorage.setItem("voiceStrikes", "0"); });
    await page.click("#voice-preview"); await until(page, () => document.getElementById("voice-preview").textContent.includes("Hear it"), null, 300000);
    t.ok(await page.evaluate(() => localStorage.getItem("voiceLevel")) === "q8", "one interrupted attempt keeps the natural voice");
    // the warm-up on the review screen, then closing the app: no alarm
    await page.click('#modes .chip >> text="Explainer"'); await page.click("#go"); await page.waitForSelector("#review:not(.hidden)", { timeout: 180000 });
    await page.waitForTimeout(6000);
    t.ok(await page.evaluate(() => localStorage.getItem("voiceBusy")) !== "1", "a loaded, idle voice (review warm-up) doesn't leave the busy flag up");
    await page.reload(); await until(page, () => window.__ready, null, 60000); await page.click('nav [data-tab="create"]');
    await page.click("#voice-preview"); await until(page, () => document.getElementById("voice-preview").textContent.includes("Hear it"), null, 300000);
    t.ok(await page.evaluate(() => localStorage.getItem("voiceLevel")) === "q8", "closing the app after the warm-up doesn't switch to the classic voice");
    // phones switched by mistake in earlier versions are switched back once
    await page.evaluate(() => { localStorage.setItem("voiceLevel", "classic"); localStorage.setItem("voiceError", ""); localStorage.removeItem("voiceRetried"); });
    await page.click("#voice-preview"); await until(page, () => document.getElementById("voice-preview").textContent.includes("Hear it"), null, 300000);
    t.ok(await page.evaluate(() => localStorage.getItem("voiceLevel")) === "q8", "a mistaken switch to the classic voice is undone after the update");
  } catch (e) { t.ok(false, "section crashed: Features: no false low-memory alarms", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }

  t.section("Features: What's new, storage, make-time, Library covers");
  try {
    // a returning user who last saw the version two updates back: the window shows the two newest updates, not the one they saw
    const notes = await page.evaluate(async () => { const V = await import("./app/version.js"); return { v: V.APP_VERSION, titles: V.UPDATES.slice(0, 3).map((u) => u.title) }; });
    await page.evaluate((v) => localStorage.setItem("seenVersion", String(v - 2)), notes.v);
    await page.reload(); await until(page, () => window.__ready, null, 60000);
    t.ok(await page.locator("#news-sheet").count() === 1 && /What's new/.test(await page.innerText("#news-sheet")), "What's new appears after an update");
    const news = await page.innerText("#news-sheet");
    t.ok(news.includes(notes.titles[0]) && news.includes(notes.titles[1]) && !news.includes(notes.titles[2]), "it lists only the updates since the last one seen", news.slice(0, 200));
    await page.click('[data-news="close"]');
    t.ok(await page.locator("#news-sheet").count() === 0, "Got it closes it");
    await page.reload(); await until(page, () => window.__ready, null, 60000);
    t.ok(await page.locator("#news-sheet").count() === 0, "it stays closed after a restart");
    await page.click('nav [data-tab="about"]'); await until(page, () => /uses/.test(document.getElementById("storage-total").textContent), null, 20000);
    t.ok(await page.locator("#storage-items .store-row").count() === 6 && /Natural voice[\s\S]*Classic voice[\s\S]*Ideas AI[\s\S]*Full-text[\s\S]*Saved illustrations[\s\S]*Your photos/.test(await page.innerText("#storage-items")), "Storage card lists the voices, AI, research library, saved illustrations and your photos", await page.innerText("#storage-items"));
    await page.click("#art-more");
    await until(page, () => /Drew and saved|already saved|Stopped/.test(document.getElementById("art-note").textContent), null, 180000);
    const artNote = await page.innerText("#art-note");
    await until(page, () => !document.getElementById("art-gallery").classList.contains("hidden"), null, 20000).catch(() => {});
    t.ok(/Drew and saved 36 new/.test(artNote) && await page.locator("#art-gallery img").count() >= 6, "Draw more draws and saves a batch of illustrations, shown in Storage", artNote);
    // Backup and restore: a file with the settings, drafts and results; restoring brings them back.
    const brand0 = await page.evaluate(() => localStorage.getItem("brand") || "");
    const [bk] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.click("#backup")]);
    const bkText = readFileSync(await bk.path(), "utf8"), bkJson = JSON.parse(bkText);
    await page.evaluate(() => localStorage.setItem("brand", "Changed Brand"));
    await page.setInputFiles("#restore", { name: "backup.json", mimeType: "application/json", buffer: Buffer.from(bkText) });
    await page.waitForEvent("load", { timeout: 20000 }).catch(() => {}); await until(page, () => window.__ready, null, 60000); await toastLog();
    t.ok(bkJson.app === "ReelBot" && "results" in bkJson.data && !("voiceBusy" in bkJson.data) && await page.evaluate(() => localStorage.getItem("brand") || "") === brand0, "Back up saves settings, drafts and results to a file, and Restore brings them back", JSON.stringify({ keys: Object.keys(bkJson.data || {}).length, brand0 }));
    await page.click('nav [data-tab="about"]').catch(() => {});
    await page.click("#whats-new"); t.ok(await page.locator("#news-sheet").count() === 1, "What's new can be reopened from About"); await page.click('[data-news="close"]');
    await page.click('nav [data-tab="create"]').catch(() => {});
    await page.click('#modes .chip >> text="Explainer"'); await page.click("#go"); await page.waitForSelector("#review:not(.hidden)", { timeout: 180000 });
    t.ok(/about \d/.test(await page.textContent("#produce")), "the Make button says how long it will take", await page.textContent("#produce"));
    await page.click("#cancel-review");
    await page.click('nav [data-tab="library"]'); await page.waitForSelector("#reels [data-reel] video");
    const vids = await page.$$eval("#reels video", (vs) => vs.map((v) => [v.getAttribute("preload"), !!v.getAttribute("poster")]));
    t.ok(vids.length && vids.every(([pre, poster]) => pre === "none" && poster), "Library shows covers and loads videos only when played", JSON.stringify(vids));
  } catch (e) { t.ok(false, "section crashed: Features: What's new, storage, make-time, Library covers", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }

  t.section("Features: Library management");
  try {
    await page.click('nav [data-tab="library"]'); await page.waitForSelector("#reels [data-reel]");
    const total = await page.locator("#reels [data-reel]").count();
    if (total >= 4) {
      // Search and filters
      const title = (await page.locator("#reels [data-reel] .reel-title").first().innerText()).split(/\s+/).slice(0, 2).join(" ");
      await page.fill("#lib-q", title); await page.waitForTimeout(200);
      const found = await page.locator("#reels [data-reel]").count();
      await page.fill("#lib-q", "zzqq no such reel"); await page.waitForTimeout(200);
      const none = await page.locator("#reels [data-reel]").count(), offer = await page.locator("[data-lib-clear]").count();
      await page.click("[data-lib-clear]");
      const quizChip = page.locator('#lib-kinds [data-lib-kind="quiz"]');
      let quizzes = -1; if (await quizChip.count()) { await quizChip.click(); quizzes = await page.locator("#reels [data-reel]").count(); await page.click('#lib-kinds [data-lib-kind="all"]'); }
      t.ok(found >= 1 && found <= total && none === 0 && offer === 1 && quizzes !== 0 && await page.locator("#reels [data-reel]").count() === total, "Library search and type filters work", JSON.stringify({ title, total, found, none, quizzes }));
    }
    // Mark as posted, and Delete posted
    const postedBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("posted") || "[]").length);
    const unpostedCard = page.locator("#reels [data-reel]").filter({ has: page.locator('[data-act="posted"]:not(.on)') }).first();
    if (await unpostedCard.count()) {
      await unpostedCard.locator('[data-act="posted"]').click();
      const after = await page.evaluate(() => JSON.parse(localStorage.getItem("posted") || "[]").length);
      t.ok(after === postedBefore + 1 && new RegExp(`${after} posted`).test(await page.innerText("#lib-space")) && await page.locator("[data-del-posted]").isVisible(), "Mark as posted is remembered and counted, with Delete posted offered", await page.innerText("#lib-space"));
      const totalNow = await page.locator("#reels [data-reel]").count();
      if (totalNow - after >= 1) {
        await page.click("[data-del-posted]");
        await until(page, (n) => document.querySelectorAll("#reels [data-reel]").length === n, totalNow - after, 15000).catch(() => {});
        t.ok(await page.locator("#reels [data-reel]").count() === totalNow - after && await page.locator("[data-del-posted]").count() === 0, "Delete posted removes exactly the posted videos", `${totalNow} - ${after} → ${await page.locator("#reels [data-reel]").count()}`);
      }
    }
    const before = await page.locator("#reels [data-reel]").count();
    await page.locator('#reels [data-act="delete"]').first().click();
    await until(page, (n) => document.querySelectorAll("#reels [data-reel]").length === n, before - 1, 15000).catch(() => {});
    t.ok(await page.locator("#reels [data-reel]").count() === before - 1, "Delete removes a reel", `${before} → ${await page.locator("#reels [data-reel]").count()}`);
    await page.context().close();
  } catch (e) { t.ok(false, "section crashed: Features: Library management", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }

  t.section("Features: old links open the current app");
  try {
    const p2 = await newPage();
    await p2.goto(BASE + "site/");
    await p2.waitForFunction(() => !/\/site\//.test(location.pathname) && window.__ready, null, { timeout: 60000 });
    t.ok(!/\/site\//.test(p2.url()), "the old /site/ address opens the current app", p2.url());
    const swOld = await (await fetch(BASE + "site/sw.js")).text();
    t.ok(/unregister/.test(swOld) && /reelbot-v1/.test(swOld) && !/caches\.keys\(\)\.then\(\(keys\) => Promise\.all\(keys\.filter/.test(swOld), "the old address's offline copy removes itself without touching the app's own storage");
    await p2.close();
  } catch (e) { t.ok(false, "section crashed: Features: old links open the current app", String(e.message || e).split("\n")[0]); }

  t.section("Features: works offline after the first visit (service worker)");
  try {
    const off = await newPage({ sw: true });
    await off.reload(); await until(off, () => window.__ready && navigator.serviceWorker.controller, null, 60000);
    await off.context().setOffline(true);
    await off.reload(); await until(off, () => window.__ready, null, 60000);
    t.ok(await off.evaluate(() => !!document.getElementById("go")), "the app opens with no internet");
    await off.context().setOffline(false);
    await off.click('#voices .chip >> text="Heart"'); await off.click("#voice-preview");
    await until(off, () => document.getElementById("voice-preview").textContent.includes("Hear it"), null, 300000);
    await off.click('nav [data-tab="about"]'); await until(off, () => /uses/.test(document.getElementById("storage-total").textContent), null, 20000);
    const row = () => off.locator("#storage-items .store-row").first().innerText();
    t.ok(/Saved on this phone/.test(await row()), "Storage shows the natural voice is saved", await row());
    await off.locator('#storage-items [data-free="0"]').click();
    await until(off, () => /Not downloaded/.test(document.querySelector("#storage-items .store-row")?.textContent || ""), null, 20000).catch(() => {});
    t.ok(/Not downloaded/.test(await row()), "Delete frees the natural voice download", await row());
    await off.click('nav [data-tab="create"]').catch(() => {});
    await off.context().setOffline(true);
    await off.click("#offline + span"); await off.click('#modes .chip >> text="Explainer"'); await off.click("#go");
    await off.waitForSelector("#review:not(.hidden), #result:not(.hidden)", { timeout: 120000 });
    t.ok(await off.isVisible("#review"), "Offline mode writes a script with no internet");
    await off.context().close();
  } catch (e) { t.ok(false, "section crashed: Features: works offline after the first visit (service worker)", String(e.message || e).split("\n")[0]); await page.goto(page.url()).catch(() => {}); }
}
