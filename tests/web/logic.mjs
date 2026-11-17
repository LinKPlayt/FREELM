// Logic tests: each pure function against answers worked out by hand.
export default async function ({ t, newPage }) {
  const page = await newPage();
  t.section("Logic: pronunciation, numbers, charts");
  const r = await page.evaluate(async () => {
    const S = await import("./app/script.js"), V = await import("./app/visuals.js"), F = await import("./app/ai/factcheck.js");
    const R = await import("./app/research.js"), RA = await import("./app/ai/research.js"), X = await import("./app/extras.js");
    const K = await import("./app/kokoro-text.js"), M = await import("./app/music.js"), MK = await import("./app/make.js");
    const out = {};
    out.money = S.speakable("$1,000 at 7%");
    out.k401 = S.speakable("Max your 401(k) match");
    out.handle = S.speakable("Follow @money.minute today");
    S.setPronunciations("Roth = rawth\nETF = E T F"); out.sayAs = S.speakable("A Roth IRA and an ETF"); S.setPronunciations("");
    out.sayAsCleared = S.speakable("A Roth IRA");
    out.w2d = [S.wordsToDigits("twenty five"), S.wordsToDigits("one thousand"), S.wordsToDigits("three hundred and five")];
    const st = (x) => V.analyzeLine(x).stat;
    out.pct = st("Fifty percent goes to needs");
    out.split = st("Use the 50/30/20 rule");
    out.growth = st("At ten percent your money doubles every seven years");
    out.range = st("Save three to six months of expenses");
    out.moneyStat = st("Keep $1,000 in an emergency fund");
    out.none = st("Pay yourself first");
    out.describe = out.pct ? V.describeStat(out.pct) : null;
    // fact check
    out.nums = [F.numbersIn("fifty percent"), F.numbersIn("$1.5 billion"), F.numbersIn("$1,000 and 2,500 people")];
    out.math = [F.mathCheck("At a ten percent yearly return, money roughly doubles every seven years."),
      F.mathCheck("At a ten percent yearly return, money doubles every three years."),
      F.mathCheck("Starting at twenty five instead of thirty five can leave you with roughly twice as much."),
      F.mathCheck("Index funds are cheap.")];
    out.kinds = [F.claimKind({ text: "Most people get this wrong.", kind: "media" }, 0), F.claimKind({ text: "Pay every bill on time.", kind: "media" }, 2),
      F.claimKind({ text: "That means time matters more than anything.", kind: "media" }, 2), F.claimKind({ text: "Inflation rose 3% in 2024.", kind: "media" }, 2),
      F.claimKind({ text: "Follow for more.", kind: "outro" }, 5)];
    const ev = [{ text: "A dividend is a share of company profits paid out to shareholders.", source: "Dividend" }, { text: "Inflation was 25% in 1990.", source: "X" }];
    out.check = [F.checkAgainst({ text: "A dividend is a share of profits paid to shareholders." }, ev).status,
      F.checkAgainst({ text: "Inflation was 20% in 1990." }, ev).status,
      F.checkAgainst({ text: "Bitcoin was invented by aliens." }, ev).status];
    // research text helpers
    out.trim = R.trimDefinition("A mortgage loan or simply mortgage, in civil law jurisdictions known also as a hypothec loan, is a loan used either by purchasers of real property to raise funds to buy real estate, or by existing property owners to raise funds for any purpose while putting a lien on the property being mortgaged.");
    out.paren = R.dropParentheticals("A 401(k) plan (named after a law) and 501(c)(3) groups (charities).");
    out.speakable = [RA.speakable("An example of the debt snowball method in action is shown below."), RA.speakable("Units for smaller amounts of bitcoin are the millibitcoin, equal to bitcoin, and the satoshi."), RA.speakable("Bitcoin was invented in 2008 by an unknown person called Satoshi Nakamoto.")];
    out.offTopic = [RA.offTopic("Inflation (cosmology)"), RA.offTopic("Bond (finance)"), RA.offTopic("Dividend")];
    // natural-voice text normalisation (eSpeak replaced by a stub that echoes the words)
    const echo = async (texts) => texts.map((x) => `[${x}]`);
    out.kok = [await K.kokoroPhonemes("It costs $5.50 a day.", "a", echo), await K.kokoroPhonemes("In 1987, stocks fell.", "a", echo), await K.kokoroPhonemes("Save 3-6 months.", "a", echo)];
    // captions file
    const words = "This is one sentence. And then, another one follows here quickly".split(" ").map((w, i) => ({ text: w, start: i * 0.4, end: i * 0.4 + 0.35 }));
    out.srt = X.makeSrt(words);
    // coach
    const lines = [{ text: "Stop wasting money on fees?", kind: "media" }, { text: "Fees of 1% cost you a fortune over 30 years.", kind: "media" }, { text: "Use low cost index funds.", kind: "media" }, { text: "Follow for more money tips every day.", kind: "outro" }];
    out.coach = X.coach(lines, { estimate: 35, range: [30, 45], visuals: [{ type: "photo" }, { type: "stat" }] });
    out.hooks = X.hookOptions({ title: "Index Funds", topicTitle: "Index fund", lines, deep: false });
    // audio helpers
    out.resample = M.resample(new Float32Array(24000), 24000, 48000).length;
    const loud = new Float32Array(48000).map((_, i) => Math.sin(i / 10) * 3);
    const lv = MK._test.limitAndLevel(loud); let peak = 0, nan = false; for (const x of lv) { peak = Math.max(peak, Math.abs(x)); if (Number.isNaN(x)) nan = true; }
    out.limiter = { peak, nan };
    const silent = MK._test.limitAndLevel(new Float32Array(48000)); out.silentOk = silent.every((x) => x === 0);
    // pauses: 1 s tone, 0.3 s silence, 1 s tone
    const rate = 24000, clip = new Float32Array(rate * 2.3);
    for (let i = 0; i < clip.length; i++) { const s = i / rate; clip[i] = s < 1 || s > 1.3 ? Math.sin(i / 7) * 0.5 : 0; }
    out.pauses = MK._test.pausesIn(clip, rate);
    // caption timings: a line with two commas and two real pauses (regression: words once ran backwards)
    const c2 = new Float32Array(rate * 3.2);
    for (let i = 0; i < c2.length; i++) { const s = i / rate; c2[i] = (s > 0.9 && s < 1.2) || (s > 2.0 && s < 2.3) ? 0 : Math.sin(i / 7) * 0.5; }
    const tm = MK._test.timings({ lines: [{ text: "First part here, second part there, and the third part.", kind: "media" }] }, [c2]);
    out.tm = tm.words.map((w) => [w.text, +w.start.toFixed(2), +w.end.toFixed(2)]);
    // topic hashtags and the results summary
    out.tags = [S.topicHashtags({ topic: "Index fund" }), S.topicHashtags({ title: "Never Skip the 401(k) Match #Shorts" }), S.topicHashtags({ topic: "S&P 500" }), S.topicHashtags({})];
    const Rz = await import("./app/results.js");
    localStorage.removeItem("results");
    Rz.saveResult({ id: "a", title: "A", niche: "investing", kind: "evergreen", duration: 30, settings: { voice: "af_heart", cta: "comment", music: "lofi", captions: "bold" } }, { views: 12000, likes: 900, comments: 120 });
    Rz.saveResult({ id: "b", title: "B", niche: "crypto", kind: "custom", duration: 70, settings: { voice: "classic", cta: "follow", music: "none", captions: "bold" } }, { views: 3000, likes: 100 });
    Rz.saveResult({ id: "c", title: "C", niche: "investing", kind: "evergreen", duration: 34, settings: { voice: "af_heart", cta: "comment", music: "lofi", captions: "boxed" } }, { views: "abc", likes: -5 });
    out.ins = Rz.insights({ voice: { af_heart: "Heart", classic: "Classic" }, cta: { comment: "Ask a question", follow: "Follow" } });
    out.resC = Rz.getResult("c");
    localStorage.removeItem("results");
    // platform captions
    out.caps = S.platformCaptions({ title: "Test #Shorts", description: "Desc", script: "Line one.\nLine two.\nFollow.", niche: "investing", handle: "@me" });
    out.capsOld = S.platformCaptions({ script: "Only line.\nFollow." });
    return out;
  });
  t.ok(r.money === "1,000 dollars at 7 percent", "money and percent are spoken in words", r.money);
  t.ok(/four oh one k/.test(r.k401), "401(k) is pronounced", r.k401);
  t.ok(r.handle === "Follow at money minute today", "@handles are spoken", r.handle);
  t.ok(/rawth/.test(r.sayAs) && /E T F/.test(r.sayAs), "your pronunciations are applied", r.sayAs);
  t.ok(!/rawth/.test(r.sayAsCleared), "clearing pronunciations removes them", r.sayAsCleared);
  t.ok(r.w2d[0] === "25" && r.w2d[1] === "1000", "number words become digits", JSON.stringify(r.w2d));
  t.ok(r.pct?.type === "percent" && r.pct.value === 50, "“fifty percent” becomes a 50% chart", JSON.stringify(r.pct));
  t.ok(r.split?.type === "split" && r.split.parts.join() === "50,30,20", "50/30/20 becomes a split chart", JSON.stringify(r.split));
  t.ok(r.growth?.type === "growth" && r.growth.every === 7, "doubling becomes a growth chart", JSON.stringify(r.growth));
  t.ok(r.range?.type === "range" && r.range.lo === 3 && r.range.hi === 6, "3–6 months becomes a timeline", JSON.stringify(r.range));
  t.ok(r.moneyStat?.type === "money" && r.moneyStat.value === 1000, "$1,000 becomes a counter", JSON.stringify(r.moneyStat));
  t.ok(!r.none, "a line without numbers has no chart");
  t.section("Logic: fact check");
  t.ok(JSON.stringify(r.nums) === JSON.stringify([[50], [1.5e9], [1000, 2500]]), "numbers are read correctly (words, $, billions, commas)", JSON.stringify(r.nums));
  t.ok(r.math[0]?.status === "verified" && r.math[1]?.status === "conflict" && r.math[2]?.status === "verified" && r.math[3] === null, "money maths is checked by calculation", JSON.stringify(r.math.map((m) => m?.status ?? null)));
  t.ok(r.kinds.join() === "hook,tip,takeaway,fact,skip", "lines are classed as hook / tip / takeaway / fact", r.kinds.join());
  t.ok(r.check.join() === "verified,conflict,unverified", "a paraphrase is verified, a wrong number is caught, an invention is unverified", r.check.join());
  t.section("Logic: research text");
  t.ok(r.trim === "A mortgage loan is a loan used by purchasers of real property to raise funds to buy real estate.", "long definitions are trimmed to their core", r.trim);
  t.ok(r.paren === "A 401(k) plan and 501(c)(3) groups.", "asides are dropped but 401(k)/501(c)(3) kept", r.paren);
  t.ok(r.speakable.join() === "false,false,true", "pointer and lost-number sentences are rejected, good ones kept", r.speakable.join());
  t.ok(r.offTopic.join() === "true,false,false", "other meanings of a word are recognised", r.offTopic.join());
  t.section("Logic: natural voice text, captions, coach, audio");
  t.ok(/5 dolla.s and 50 cents/.test(r.kok[0]) && /19 87/.test(r.kok[1]) && /3 to 6/.test(r.kok[2]), "money, years and ranges are normalised for the voice", r.kok.join(" | "));
  t.ok(/^1\n00:00:00,000 --> /.test(r.srt) && !/NaN/.test(r.srt) && r.srt.split("-->").length - 1 >= 2, "captions file is valid", r.srt.slice(0, 80));
  const cues = [...r.srt.matchAll(/(\d\d):(\d\d):(\d\d),(\d\d\d) --> (\d\d):(\d\d):(\d\d),(\d\d\d)/g)].map((m) => [m.slice(1, 5), m.slice(5, 9)].map(([h, mi, s, ms]) => +h * 3600 + +mi * 60 + +s + ms / 1000));
  t.ok(cues.every(([a, b], i) => b > a && (i === 0 || a >= cues[i - 1][1])), "caption cues never overlap", JSON.stringify(cues));
  t.ok(r.coach.score >= 0 && r.coach.score <= 100 && Array.isArray(r.coach.tips), "reel score is 0–100 with tips", JSON.stringify(r.coach));
  t.ok(r.hooks.length >= 4 && r.hooks.every((h) => h && !/undefined/.test(h)), "hook options are complete", r.hooks.join(" | "));
  t.ok(r.resample === 48000, "resampling 24 kHz → 48 kHz keeps the length", r.resample);
  t.ok(r.limiter.peak <= 0.891 && !r.limiter.nan, "the limiter keeps peaks under -1 dB with no NaN", JSON.stringify(r.limiter));
  t.ok(r.silentOk, "silence stays silent (no divide-by-zero noise)");
  t.ok(r.pauses.length === 1 && Math.abs(r.pauses[0][0] - 1) < 0.05 && Math.abs(r.pauses[0][1] - 1.3) < 0.05, "a pause in the voice is found where it is", JSON.stringify(r.pauses));
  const w = r.tm, ordered = w.every((x, i) => x[2] >= x[1] && (i === 0 || x[1] >= w[i - 1][1]));
  const second = w.find((x) => x[0] === "second"), third = w.find((x) => x[0] === "and");
  t.ok(ordered && second && Math.abs(second[1] - 1.2) < 0.06 && third && Math.abs(third[1] - 2.3) < 0.06, "captions start each phrase right after the voice's pause, in order", JSON.stringify(w));
  t.ok(r.tags[0].join() === "#IndexFund,#indexfund" && r.tags[1].join() === "#401kMatch,#401kmatch" && r.tags[2][0] === "#SAndP500" && r.tags[3].length === 0, "topic hashtags are made from the topic", JSON.stringify(r.tags));
  const insText = JSON.stringify(r.ins.rows);
  t.ok(r.ins.count === 2 && /Ask a question: 12\.0k/.test(insText) && /Heart/.test(insText) && /Niche/.test(insText), "results summary picks what gets the most views", JSON.stringify(r.ins).slice(0, 300));
  t.ok(r.resC && !r.resC.stats.views && !("likes" in r.resC.stats), "bad numbers in results are ignored (text, negatives)", JSON.stringify(r.resC));
  t.ok(r.caps.youtube && r.caps.tiktok && r.caps.instagram && !/undefined/.test(JSON.stringify(r.caps)), "platform captions are complete", "");
  t.ok(!/undefined/.test(JSON.stringify(r.capsOld)) && r.capsOld.youtube.length > 5, "captions work for old reels with missing fields", JSON.stringify(r.capsOld).slice(0, 120));
  await page.context().close();
}
