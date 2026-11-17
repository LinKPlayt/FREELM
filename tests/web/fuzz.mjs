// Fuzz tests: thousands of random and hostile inputs (emoji, other scripts, control characters, HTML,
// huge numbers, very long text, empty strings) into every text-handling function and into the app's
// text boxes. Nothing may throw, hang, produce NaN/undefined, or run injected HTML.
export default async function ({ t, newPage }) {
  const page = await newPage();
  t.section("Fuzz: text functions (random and hostile inputs)");
  const N = Number(process.env.FUZZ_N) || 400, SEED = Number(process.env.FUZZ_SEED) || 12345;
  const r = await page.evaluate(async ({ N, SEED }) => {
    const S = await import("./app/script.js"), V = await import("./app/visuals.js"), F = await import("./app/ai/factcheck.js");
    const R = await import("./app/research.js"), RA = await import("./app/ai/research.js"), X = await import("./app/extras.js");
    const K = await import("./app/kokoro-text.js"), MK = await import("./app/make.js");
    let seed = SEED;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const pools = [
      "abcdefghijklmnopqrstuvwxyz", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789", " .,;:!?-—…'\"()[]{}%$€£¥@#&*/\\|<>=+_~^`",
      "😀💰📈🚀🤑💸🏦🇺🇸", "éèêëàâîïôöüçñßøå", "ЖДФЯШЩЦЧ", "汉字中文测试金融", "مرحبا بالعالم", "​‍ \u0000\t\n\r ",
    ];
    const words = ["$1,000", "7%", "401(k)", "S&P 500", "1987", "3-6", "twenty five", "fifty percent", "doubles every seven years", "$1.5 billion",
      "<img src=x onerror=window.__xss=1>", "<script>window.__xss=1</script>", "NaN", "undefined", "Infinity", "-0", "1e308", "99999999999999999999",
      "%%%%", "$$$", "...", "—", "U.S.", "Mr.", "e.g.", "0.000001%", "−5%", "(", ")", "\"", "'"];
    const randText = () => {
      const n = Math.floor(rnd() * 12);
      let s = "";
      for (let i = 0; i < n; i++) {
        if (rnd() < 0.45) s += pick(words) + " ";
        else { const p = pick(pools); const len = 1 + Math.floor(rnd() * 12); for (let j = 0; j < len; j++) s += p[Math.floor(rnd() * p.length)]; s += rnd() < 0.7 ? " " : ""; }
      }
      if (rnd() < 0.03) s = s.repeat(200);        // very long
      if (rnd() < 0.05) s = "";
      return s;
    };
    // NaN / undefined / Infinity in the output is a bug only when the input didn't contain that word.
    const bad = (v, input) => { const j = JSON.stringify(v ?? null), i = JSON.stringify(input ?? null); return ["NaN", "undefined", "Infinity"].some((w) => j.includes(w) && !i.includes(w)); };
    const failures = []; let calls = 0; const slow = [];
    const run = async (name, fn, input) => {
      const t0 = performance.now(); calls++;
      try { const v = await fn(input); if (bad(v, input)) failures.push(`${name}: bad output for ${JSON.stringify(input).slice(0, 80)} -> ${JSON.stringify(v).slice(0, 120)}`); }
      catch (e) { failures.push(`${name}: threw ${e.message} for ${JSON.stringify(input).slice(0, 80)}`); }
      const ms = performance.now() - t0; if (ms > 250) slow.push(`${name} ${Math.round(ms)} ms for ${JSON.stringify(input).slice(0, 60)}`);
    };
    const echo = async (texts) => texts.map((x) => x.toLowerCase());
    const evidence = Array.from({ length: 30 }, () => ({ text: randText() + " A dividend is a share of profits paid out.", source: "Src" }));
    for (let i = 0; i < N; i++) {
      const x = randText();
      await run("speakable", S.speakable, x);
      await run("wordsToDigits", S.wordsToDigits, x);
      await run("analyzeLine", (s) => { const a = V.analyzeLine(s); return a.stat ? { a, d: V.describeStat(a.stat) } : a; }, x);
      await run("statFor", S.statFor, x);
      await run("numbersIn", F.numbersIn, x);
      await run("mathCheck", F.mathCheck, x);
      await run("claimKind", (s) => F.claimKind({ text: s, kind: "media" }, i % 3), x);
      await run("checkAgainst", (s) => F.checkAgainst({ text: s }, evidence).status, x);
      await run("trimDefinition", R.trimDefinition, x);
      await run("dropParentheticals", R.dropParentheticals, x);
      await run("speakable(research)", RA.speakable, x);
      await run("offTopic", RA.offTopic, x);
      await run("kokoroPhonemes", (s) => K.kokoroPhonemes(s, i % 2 ? "a" : "b", echo), x);
      await run("shortenHeadline", S.shortenHeadline, x || "x");
      await run("visualMatch", S.visualMatch, x);
    }
    // structured inputs
    for (let i = 0; i < Math.ceil(N * 0.375); i++) {
      const n = Math.floor(rnd() * 30);
      const words = Array.from({ length: n }, (_, k) => ({ text: randText().slice(0, 30) || "x", start: k * rnd(), end: k * rnd() + rnd() }));
      words.sort((a, b) => a.start - b.start);
      await run("makeSrt", X.makeSrt, words);
      const lines = Array.from({ length: 1 + Math.floor(rnd() * 8) }, () => ({ text: randText(), kind: pick(["media", "media", "outro", "section", "recap", "chart"]), source: rnd() < 0.3 ? "Wikipedia · X" : undefined }));
      await run("coach", (l) => X.coach(l, { estimate: rnd() * 200, range: [30, 45], visuals: l.map(() => ({ type: pick(["photo", "stat", "illus"]) })) }), lines);
      const hookIn = { title: randText() || "T", topicTitle: rnd() < 0.5 ? randText() : "", lines };
      await run("hookOptions", (x) => X.hookOptions(x), hookIn);
      await run("platformCaptions", S.platformCaptions, { title: rnd() < 0.2 ? undefined : randText(), description: rnd() < 0.3 ? undefined : randText(), script: lines.map((l) => l.text).join("\n"), niche: pick(["investing", "crypto", "nope", undefined]), handle: rnd() < 0.5 ? "@" + randText().slice(0, 10) : "", credits: rnd() < 0.5 ? [randText()] : undefined, sources: [] });
      // caption timings from random audio clips (silence, noise, NaN-free)
      const rate = 24000, clips = lines.map(() => { const len = Math.floor(rnd() * rate * 3); const c = new Float32Array(len); const kind = rnd(); for (let k = 0; k < len; k++) c[k] = kind < 0.2 ? 0 : (Math.sin(k / 9) * (Math.floor(k / 4000) % 2 ? 0.5 : 0.001)); return c; });
      await run("timings", (x) => {
        const tm = MK._test.timings({ lines: x.lines }, clips), w = tm.words;
        for (let k = 0; k < w.length; k++) {
          if (!Number.isFinite(w[k].start) || !Number.isFinite(w[k].end) || w[k].end < w[k].start - 1e-9) throw new Error(`bad time ${JSON.stringify(w[k])}`);
          if (k && w[k].start + 1e-6 < w[k - 1].start) throw new Error("words out of order");
        }
        return { n: w.length, spans: tm.spans };
      }, { lines });
    }
    const audio = [new Float32Array(0), new Float32Array(10), new Float32Array(48000).fill(1e6), Float32Array.from({ length: 48000 }, () => Math.random() * 2 - 1)];
    for (const a of audio) await run("limitAndLevel", (x) => { const v = MK._test.limitAndLevel(x); for (const s of v) if (!Number.isFinite(s) || Math.abs(s) > 0.9) throw new Error("bad sample " + s); return v.length; }, a);
    return { calls, failures: failures.slice(0, 12), nFail: failures.length, slow: slow.slice(0, 8), nSlow: slow.length, xss: window.__xss };
  }, { N, SEED });
  t.ok(r.nFail === 0, `${r.calls.toLocaleString()} random calls to 20 functions: no errors, no NaN/undefined output`, `${r.nFail} failures: ${r.failures.join(" || ")}`);
  t.ok(r.nSlow === 0, "no call took over 250 ms (no runaway regexes on long or odd text)", `${r.nSlow} slow: ${r.slow.join(" | ")}`);
  t.ok(!r.xss, "no injected HTML ran");

  t.section("Fuzz: real pronunciation (eSpeak) on hostile text");
  const ph = await page.evaluate(async () => {
    const T = await import("./app/tts.js");
    const texts = ["", " ", "😀💰🚀", "汉字中文测试", "مرحبا", "\u0000​\t", "<img src=x onerror=1>", "$".repeat(300), "a".repeat(3000), "1e308 NaN Infinity", "Ünïcödé façade naïve", "...!!!???", "U.S. Mr. e.g. i.e.", "−5% (−$1,000) — “quotes” ‘single’"];
    const out = []; let failed = [];
    for (const engine of ["natural", "fast"]) {
      T.setVoice({ engine, voice: "af_heart" });
      if (engine === "fast") await T.loadVoice();
      for (const x of texts) {
        const t0 = performance.now();
        try { const [p] = await T.phonemize([x]); out.push([engine, Math.round(performance.now() - t0), typeof p === "string" ? p.length : p.length]); }
        catch (e) { failed.push(`${engine}: ${JSON.stringify(x).slice(0, 30)} threw ${e.message}`); }
      }
    }
    // the classic voice must also speak them without crashing
    const spoken = [];
    for (const x of ["😀💰🚀 money", "$".repeat(300), "Ünïcödé façade"]) { try { const [p] = await T.phonemize([x]); const a = await T.synthesize(p, 1); spoken.push(a.length); } catch (e) { failed.push(`speak ${JSON.stringify(x).slice(0, 20)}: ${e.message}`); } }
    return { failed, slowest: Math.max(...out.map((o) => o[1])), n: out.length, spoken };
  });
  t.ok(ph.failed.length === 0, `eSpeak handles ${ph.n} hostile texts for both voices`, ph.failed.join(" | "));
  t.ok(ph.slowest < 3000, `slowest pronunciation ${ph.slowest} ms`, String(ph.slowest));
  t.ok(ph.spoken.every((n) => Number.isFinite(n)), "the voice speaks hostile text without crashing", JSON.stringify(ph.spoken));

  t.section("Fuzz: the app's text boxes");
  const ui = await page.evaluate(async () => {
    const hostile = ["<img src=x onerror=window.__xss=1>", "\"><script>window.__xss=1</script>", "😀".repeat(50), "a".repeat(500), "  ", "@@@", "ETF = <b>x</b>\n= =\n==\nRoth=", "\u0000​"];
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
    for (const v of hostile) { set("brand", v); set("handle", v); set("say-as", v); set("custom", v); await new Promise((r) => setTimeout(r, 30)); }
    return { xss: window.__xss };
  });
  t.ok(!ui.xss, "hostile text in brand, handle, pronunciations and topic boxes doesn't run");
  // a custom topic made of nonsense must give a clear message, not a crash
  await page.click('#modes .chip >> text="Your topic"');
  await page.fill("#custom", "zzqx 😀 <b>qq</b> 汉字");
  await page.click("#go");
  await page.waitForSelector("#review:not(.hidden), #result:not(.hidden)", { timeout: 120000 });
  const res = (await page.isVisible("#result")) ? await page.innerText("#result") : "review";
  t.ok(res === "review" || /Couldn't find|isn't in|Try different/i.test(res), "a nonsense topic gives a clear message or a script", res.slice(0, 120));
  if (res === "review") await page.click("#cancel-review");
  // Idea Lab research with hostile queries
  await page.click('nav [data-tab="ideas"]');
  await page.waitForFunction(() => /articles on your phone/.test(document.getElementById("lib-info").textContent), null, { timeout: 60000 });
  for (const q of ["<img src=x onerror=window.__xss=1>", "😀💰", "a".repeat(80), "汉字", "%%%", "the of and"]) {
    await page.fill("#idea-q", q); await page.click("#idea-research");
    await page.waitForFunction(() => /Research brief|Nothing found/.test(document.getElementById("brief").textContent), null, { timeout: 60000 });
  }
  t.ok(!(await page.evaluate(() => window.__xss)), "hostile Idea Lab searches are shown safely");
  // review editor: hostile lines
  await page.click('nav [data-tab="create"]').catch(() => {});
  await page.click('#modes .chip >> text="Explainer"'); await page.click("#go");
  await page.waitForSelector("#review:not(.hidden)", { timeout: 120000 });
  for (const v of ["<img src=x onerror=window.__xss=1>", "", "😀".repeat(40), "$999999999999 is 1000000% of 0"]) {
    await page.fill('[data-line="1"]', v); await page.dispatchEvent('[data-line="1"]', "change");
  }
  await page.click("[data-hook]"); await page.click("[data-hook]");
  t.ok(!(await page.evaluate(() => window.__xss)), "hostile lines in the review editor are shown safely");
  t.ok(/\/100/.test(await page.innerText("#coach")), "the reel score still works after hostile edits");
  await page.click("#cancel-review");
  await page.context().close();
}
