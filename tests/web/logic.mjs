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
    out.say2 = ["Save 3-6 months at an APR of 24%.", "A HELOC, a 403(b) and a W-2.", "Rates hit 5.25%–5.5%, up 1.5x YTD."].map(S.speakable);
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
    const echo = async (texts) => texts.map((x) => `[${x.toUpperCase()}]`);   // capitals: the misaki step leaves them alone
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
    Rz.saveResult({ id: "a", title: "A", niche: "investing", kind: "quiz", duration: 30, settings: { voice: "af_heart", cta: "comment", music: "lofi", captions: "bold", hook: "quiz" } }, { views: 12000, likes: 900, comments: 120 });
    Rz.saveResult({ id: "b", title: "B", niche: "crypto", kind: "custom", duration: 70, settings: { voice: "classic", cta: "follow", music: "none", captions: "bold", hook: "catch" } }, { views: 3000, likes: 100 });
    Rz.saveResult({ id: "c", title: "C", niche: "investing", kind: "evergreen", duration: 34, settings: { voice: "af_heart", cta: "comment", music: "lofi", captions: "boxed" } }, { views: "abc", likes: -5 });
    out.ins = Rz.insights({ voice: { af_heart: "Heart", classic: "Classic" }, cta: { comment: "Ask a question", follow: "Follow" } });
    out.resC = Rz.getResult("c");
    localStorage.removeItem("results");
    // the app version and the service worker's cache version must match (or updates won't be noticed)
    const V2 = await import("./app/version.js"), swText = await (await fetch("./sw.js")).text();
    out.versions = [V2.APP_VERSION, Number((swText.match(/reelbot-v(\d+)/) || [])[1]), V2.UPDATES[0].version, V2.UPDATES.every((u) => u.title && u.items.length)];
    // the storyteller
    const ST = await import("./app/story.js");
    const src = [
      "In economics, inflation is an increase in the average price of goods and services in terms of money.",
      "This increase is measured using a price index, typically a consumer price index.",
      "Inflation is a general rise in the price level of an economy over time.",
      "The term inflation comes from the Latin word for blowing up.",
      "Lenders and savers lose purchasing power when inflation rises faster than interest rates.",
      "In 2022, inflation in the United States reached 9.1 percent, the highest in 40 years.",
      "However, it later fell.",
      "Some of these episodes are considered hyperinflation periods.",
    ];
    out.story = ST.composeStory("Inflation", "economy", src.map((text) => ({ text, source: "Wikipedia · Inflation" })));
    const sc = { topicTitle: "Index fund", title: "Index Funds", lines: [{ text: "Hook?", kind: "media" }, { text: "Index funds are cheap.", kind: "media" },
      { text: "An index fund is a fund that tracks a market index.", kind: "media", source: "Wikipedia · Index fund" }, { text: "Index funds are cheap and simple.", kind: "media" },
      { text: "An index fund is a type of mutual fund.", kind: "media", source: "Wikipedia · Index fund" }, { text: "Follow.", kind: "outro" }], extras: [] };
    out.polish = [ST.polish(sc), sc.lines.map((l) => l.text)];
    const longS = "Drop shipping is a form of retail business in which the seller accepts customer orders without keeping stock on hand, which then ships the goods directly to the customer from a supplier somewhere far away.";
    out.simple = [longS, ST.simplify(longS)];
    out.heads = ["Analysis: The Fed's chairman sees an AI revolution coming | CNBC", "US Stock Futures Decline Ahead of Nvidia Earnings as Investors Await Signals: Dow Jones, S&P, Nasdaq", "Here's what happened in crypto today"].map((h) => [ST.cleanHeadline(h), ST.junkHeadline(ST.cleanHeadline(h))]);
    out.thread = ST.headlineThread(["Fed signals rate hike", "Gold slips as inflation worries grow", "Fed official backs small hikes"]);
    out.mood = [ST.marketMood([{ day_pct: -2 }, { day_pct: -1.1 }]).opening, ST.marketMood([{ day_pct: 0.01 }, { day_pct: -0.02 }]).opening, ST.marketMood([{ day_pct: 0.8 }, { day_pct: -0.4 }]).opening];
    const ins = { topicTitle: "Budget", lines: [{ text: "Hook", kind: "media" }, { text: "A budget is a plan.", kind: "media" }, { text: "Track it.", kind: "media", tip: true }, { text: "Follow.", kind: "outro" }] };
    out.insert = [ST.insertIndex(ins, { text: "A budget is a plan for spending money." }), ST.insertIndex(ins, { text: "Most people overspend by 20%." })];
    // the emotion layer
    const HK = await import("./app/hook.js");
    const mk = () => ({ kind: "custom", topicTitle: "Stablecoin", title: "Stablecoin", niche: "crypto", lines: [
      { text: "Stablecoin, explained in thirty seconds.", kind: "media" },
      { text: "A stablecoin is a cryptocurrency pegged to a reference asset.", kind: "media", role: "definition" },
      { text: "The catch: many stablecoins have failed to keep their value.", kind: "media", role: "risk" },
      { text: "The takeaway: Never put in more than you could afford to lose.", kind: "media", tip: true },
      { text: "Follow.", kind: "outro" }], extras: [] });
    const d1 = HK.dramatize(mk(), { length: "standard" });
    out.drama = d1.lines.map((l) => [l.text, !!l.payoff, l.hold || 0, !!l.question]);
    out.dramaShort = HK.dramatize(mk(), { length: "short" }).lines.length;
    out.dramaComment = HK.dramatize(mk(), { length: "standard", ctaKind: "comment" }).lines.length;
    out.dramaTwice = HK.dramatize(d1).lines.length;
    const evS = mk(); evS.kind = "evergreen"; evS.lines[0].text = "One surprise bill can wreck your finances.";
    out.dramaHand = HK.dramatize(evS).lines[0].text;
    out.natural = ["Stablecoins are typically non-interest bearing and therefore do not provide returns.", "Lenders decide who they are.", "He is the CEO, and it is not cheap.", 'He said "it is not" so.'].map(HK.naturalize);
    out.feel = ["$1,000", "crash.", "grow", "the", "never,"].map(HK.emphasisOf);
    // the illustrator
    const IL = await import("./app/illustrator.js");
    out.concepts = [IL.conceptsOf("Mortgage rates rose again, pushing home prices up."), IL.conceptsOf("Nothing here", "Bitcoin"), IL.conceptsOf("zzz")];
    out.styles = [IL.styleFor("auto", "crypto"), IL.styleFor("pop", "crypto"), IL.styleFor("auto", "nope")];
    await caches.delete(IL.ART_CACHE); IL.forgetArt();
    const spec = { motifs: ["house", "chartUp"], style: "paper", accent: [255, 214, 10] };
    const a1 = await IL.artFor(spec, "Mortgage"), a2 = await IL.artFor(spec, "Mortgage");
    out.art = [a1.reused, a2.reused, a1.bitmap.width, a1.bitmap.height, IL.savedArt().length, IL.savedArt()[0].uses];
    out.allStyles = Object.keys(IL.ART_STYLES).map((style) => { try { const c = document.createElement("canvas"); c.width = 1080; c.height = 1920; IL.drawArt(c.getContext("2d"), { motifs: Object.keys(IL.MOTIFS).slice(0, 3), style, accent: [10, 200, 120] }); return "ok"; } catch (e) { return String(e); } });
    out.allMotifs = Object.keys(IL.MOTIFS).filter((m) => { try { const c = document.createElement("canvas"); c.width = c.height = 600; const x = c.getContext("2d"); x.translate(300, 300); IL.MOTIFS[m](x, [255, 214, 10], 0.3); return false; } catch { return true; } });
    const optsA = IL.artOptions("Mortgage rates rose again, pushing home prices up.");
    out.alts = [Object.keys(IL.MOTIFS).length, optsA.length, new Set(optsA.map((o) => o[0])).size, optsA[0][0], IL.motifsFor({ text: "Gold hit a record high.", artPick: 1 })[0],
      IL.conceptsOf("Now, inflation is eating your paycheck.")[0], IL.conceptsOf("Nvidia chips power the AI boom.")[0]];
    const batch = IL.nextBatch("crypto", "neon", [255, 214, 10]);
    out.batch = [batch.length, batch[0].motifs[0], await IL.drawAhead(batch.slice(0, 2), "test"), IL.nextBatch("crypto", "neon", [255, 214, 10]).length, IL.savedArt().length];
    await caches.delete(IL.ART_CACHE); IL.forgetArt();
    // refinements: definitions phrased as "terms for", junk headlines, illustration variety
    out.refine = [ST.isDefinition("Freelance, freelancer, and freelance worker are common terms for a person who is self-employed.", "Freelancer"),
      ST.junkHeadline("Bitcoin Covenants Part 6: FE Covenants"), ST.junkHeadline("Emaar Partners with Huspy to Enhance Mortgage Advisory Services"), ST.junkHeadline("Mortgage demand turns lower as rates rise"),
      IL.pickMotifs({ text: "Dividends grow over time." }, "Dividend", ["tree"])[0] !== "tree", IL.pickMotifs({ text: "Dividends grow over time.", artPick: 0 }, "Dividend", ["tree"])[0],
      (await import("./app/wording.js")).checkWording("Freelance, freelancer, or freelance worker, are terms often used for a person.").text];
    // music: Auto moods, new moods, and the beat dropping after the hook
    const MU = await import("./app/music.js"), MK2 = await import("./app/make.js");
    out.moods = [MK2.autoMood({ kind: "quiz" }), MK2.autoMood({ kind: "market", title: "Market Check: S&P 500 Down 1.9%" }), MK2.autoMood({ kind: "market", title: "Market Check: Bitcoin Up 2.4%" }),
      MK2.autoMood({ kind: "news" }), MK2.autoMood({ kind: "custom", person: true }), MK2.autoMood({ kind: "evergreen", niche: "crypto" })];
    // High-pitched energy (hi-hats, claps, plucks): what the beat adds.
    const busy = (a, from, to) => { let s = 0; const i0 = Math.floor(from * MU.SR), i1 = Math.floor(to * MU.SR); for (let i = i0 + 2; i < i1; i++) { const d = a[i] - 2 * a[i - 1] + a[i - 2]; s += d * d; } return Math.sqrt(s / (i1 - i0)); };
    out.drop = ["bright", "suspense", "upbeat"].map((m) => { const a = MU.generateMusic(10, m, { dropAt: 4 }); return [a.length === 10 * MU.SR, a.every((v) => Number.isFinite(v)), busy(a, 4.1, 6) / Math.max(1e-9, busy(a, 1.2, 3.0))]; });
    // The Library keeps up to 60 videos, and removes posted ones before older unposted ones
    const SD = await import("./app/store.js");
    await SD.clearReels(); localStorage.removeItem("posted");
    const tiny = (i) => ({ id: "t" + i, title: "T" + i, kind: "custom", created: 1000 + i, duration: 30, blob: new Blob([new Uint8Array(10)]), ext: "mp4" });
    SD.setPosted("t10", true);
    let last = null; for (let i = 0; i < 61; i++) last = await SD.saveReel(tiny(i));
    const left = (await SD.listReels()).map((r) => r.id);
    out.keep = [left.length, last.removed.join(), left.includes("t0"), left.includes("t10"), left.includes("t60")];
    await SD.clearReels(); localStorage.removeItem("posted");
    // Length estimates follow the narrator's learned pace
    const MK3 = await import("./app/make.js"), lines3 = [{ text: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty" }];
    localStorage.removeItem("speechRate-natural"); const e1 = MK3.estimateSeconds(lines3, 1, "natural"), r1 = MK3.learnedRate("natural");
    localStorage.setItem("speechRate-natural", "4"); const e2 = MK3.estimateSeconds(lines3, 1, "natural"); localStorage.removeItem("speechRate-natural");
    out.pace = [r1, e1 > e2, Math.round((e1 - e2) * 100) / 100];
    // Punch captions: one or two words at a time
    const RN = await import("./app/render.js");
    const ws = "Most actively managed funds fail to beat their index over time.".split(" ").map((text, i) => ({ text, start: i * 0.3, end: i * 0.3 + 0.28 }));
    out.punch = [RN.chunkWords(ws, 2, 12).every((c) => c.length <= 2), RN.chunkWords(ws).some((c) => c.length === 3), RN.chunkWords(ws, 2, 12).flat().length === ws.length];
    // quiz reels
    const QZ = await import("./app/quiz.js");
    const qz = QZ.buildQuiz({ niche: "crypto", cta: "Follow." });
    out.quiz = [qz.kind, qz.lines.length, qz.lines.filter((l) => l.kind === "quiz").length, qz.lines.filter((l) => l.kind === "answer").length,
      qz.lines.filter((l) => l.kind === "quiz").every((l) => l.hold >= 2 && /^Question \d\. True or false: .+\?$/.test(l.text)),
      qz.lines.filter((l) => l.kind === "answer").every((l) => /^(True|False)! /.test(l.text) && l.payoff),
      Object.values(QZ.QUIZ).every((bank) => bank.length >= 4 && bank.every(([q, a, why]) => q.length > 10 && typeof a === "boolean" && why.length > 10)),
      QZ.buildQuiz({ niche: "crypto", cta: "x" }, { recent: qz.questions }).questions.some((q) => qz.questions.includes(q))];
    // the proofreader
    const WD = await import("./app/wording.js");
    out.words = ["an ETF is a the the fund ,that tracks a index", "Plan A is simple. a 8% return and a 18 year loan", "You could of saved alot more then you think",
      "Stocks, bonds etc. are assets [3]", "So here's what to do: The takeaway: pay on time", "In the U.S. economy, an university and a hour", "iPhone sales rose:", "less people buy/sell now",
      "It's 50/30/20 and 24/7.", "Class A shares and a HSA"].map((x) => WD.checkWording(x).text);
    const ps = { lines: [{ text: "the the fund grows", kind: "media" }, { text: "Follow for more", kind: "outro" }, { text: "PART 1", kind: "section" }], extras: [] };
    out.proof = [WD.proofread(ps).fixed, ps.lines.map((l) => l.text), ps.lines[0].claim, WD.proofread(ps).fixed];
    out.warn = WD.checkWording('He said "this is one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo twentythree twentyfour twentyfive twentysix twentyseven twentyeight twentynine thirty thirtyone').warnings;
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
  t.ok(/5 DOLLA.S AND 50 CENTS/.test(r.kok[0]) && /19 87/.test(r.kok[1]) && /3 TO 6/.test(r.kok[2]), "money, years and ranges are normalised for the voice", r.kok.join(" | "));
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
  const rowOf = (n) => r.ins.rows.find((x) => x.name === n) || {};
  t.ok(/Quizzes/.test(rowOf("Type").text) && /Quiz hook/.test(rowOf("Hook").text) && rowOf("Narrator").setting === "voice" && rowOf("Narrator").best === "af_heart" && rowOf("Ending").best === "comment" && !rowOf("Niche").setting,
    "results compare video types (quizzes too) and hook styles, and know which settings “Use what works” can apply", JSON.stringify(r.ins.rows.map((x) => [x.name, x.setting, x.best])));
  t.ok(r.resC && !r.resC.stats.views && !("likes" in r.resC.stats), "bad numbers in results are ignored (text, negatives)", JSON.stringify(r.resC));
  t.ok(r.versions[0] === r.versions[1] && r.versions[0] === r.versions[2] && r.versions[3], "app version, service worker version and the newest update note agree", JSON.stringify(r.versions));
  t.section("Logic: the storyteller");
  const st = r.story.lines;
  t.ok(st[0]?.role === "definition" && st.at(-1)?.role === "takeaway", "a story opens with what it is and ends with a takeaway", st.map((l) => l.role).join(" → "));
  t.ok(st.filter((l) => l.role === "definition").length === 1, "only one definition", st.map((l) => l.text).join(" | "));
  t.ok(!st.some((l) => /Latin word|However|these episodes/.test(l.text)), "trivia and sentences that lean on missing context are left out", st.map((l) => l.text).join(" | "));
  t.ok(st[1]?.text.startsWith("This increase") && /9\.1 percent/.test(st.map((l) => l.text).join(" ")), "the next sentence follows its definition, and the figure is used", st.map((l) => l.text).join(" | "));
  t.ok(st.some((l) => /^Why it matters: lenders/.test(l.text)), "why-it-matters lines get a spoken lead-in", st.map((l) => l.text).join(" | "));
  const pl = r.polish[1];
  t.ok(pl.length === 4 && pl[1] === "An index fund is a fund that tracks a market index." && !pl.includes("Index funds are cheap and simple.") && !pl.includes("An index fund is a type of mutual fund."), "polish: definition moved up, repeat and second definition removed", JSON.stringify(r.polish));
  const added = r.simple[1].toLowerCase().match(/[a-z]+/g).filter((w) => !r.simple[0].toLowerCase().includes(w));
  t.ok(r.simple[1].split(" ").length < r.simple[0].split(" ").length && !added.length, "shortening only removes words (facts stay checkable)", r.simple[1]);
  t.ok(r.heads[0][0] === "The Fed's chairman sees an AI revolution coming." && !/Dow Jones, S&P/.test(r.heads[1][0]) && r.heads[2][1] === true, "headlines lose labels, outlet names and ticker lists; non-news is spotted", JSON.stringify(r.heads));
  t.ok(r.thread.theme === "interest rates" && r.thread.order.join() === "0,2,1" && /^The thread today/.test(r.thread.text), "related headlines are grouped and their common thread explained", JSON.stringify(r.thread));
  t.ok(/fell across the board/.test(r.mood[0]) && /barely moved/.test(r.mood[1]) && /mixed/.test(r.mood[2]), "market recaps say how the day went", JSON.stringify(r.mood));
  t.ok(/the catch/i.test(r.drama[0][0]) && /^Here's the catch: many/.test(r.drama[2][0]) && r.drama[2][1], "a hook that promises the catch is paid off by the catch line", JSON.stringify(r.drama.map((x) => x[0])));
  t.ok(r.drama[0][2] >= 0.3 && r.drama[1][2] >= 0.25, "a beat after the hook and before the payoff", JSON.stringify(r.drama.map((x) => x[2])));
  t.ok(/^Bottom line: /.test(r.drama[3][0]) && /^So here's what to do: never/.test(r.drama[4][0]), "a clear bottom line, then the takeaway, spoken naturally", JSON.stringify(r.drama.map((x) => x[0])));
  t.ok(r.drama[5][3] && /comments/.test(r.drama[5][0]) && r.drama.length === 7, "a comment question sits right before the ending", JSON.stringify(r.drama.map((x) => x[0])));
  t.ok(r.dramaShort === 5 && r.dramaComment === 6 && r.dramaTwice === 7, "no question or bottom line on short reels, no question with an Ask-a-question ending; applied once", [r.dramaShort, r.dramaComment, r.dramaTwice].join());
  t.ok(r.natural.join("|") === "Stablecoins are usually non-interest bearing and so don't provide returns.|Lenders decide who they are.|He's the CEO, and it isn't cheap.|He said \"it is not\" so.", "plain spoken English keeps the meaning (and quotes)", r.natural.join("|"));
  t.ok(r.dramaHand === "One surprise bill can wreck your finances.", "hand-written hooks are kept", r.dramaHand);
  t.ok(r.feel.join() === "1,-1,1,0,-1", "caption words that carry feeling are coloured", r.feel.join());
  t.ok(r.concepts[0].join() === "house,arrowUp,cart" && r.concepts[1].join() === "bitcoin" && r.concepts[2].join() === "coins", "illustrations draw what the line talks about", JSON.stringify(r.concepts));
  t.ok(r.styles.join() === "neon,pop,flat", "illustration style: auto matches the niche, or your choice", r.styles.join());
  t.ok(r.art.join() === "false,true,1080,1920,1,2", "an illustration is saved and reused the next time the same idea comes up", r.art.join());
  t.ok(r.allStyles.every((x) => x === "ok") && !r.allMotifs.length, "every art style and every drawn subject renders", JSON.stringify([r.allStyles, r.allMotifs]));
  t.ok(r.alts[0] >= 100 && r.alts[1] >= 8 && r.alts[2] === r.alts[1] && r.alts[3] === "house" && r.alts[4] !== "goldbars", "each scene has many alternative illustrations to step through", JSON.stringify(r.alts));
  t.ok(r.alts[5] === "cart" && r.alts[6] === "chip", "everyday words don't take the main spot from the real subject", JSON.stringify(r.alts.slice(5)));
  t.ok(r.batch[0] === 36 && r.batch[1] === "bitcoin" && r.batch[2] === 2 && r.batch[3] === 36 && r.batch[4] === 3, "Draw more: draws a batch for your niche, saves it, and the next batch skips what's saved", JSON.stringify(r.batch));
  t.ok(JSON.stringify(r.words) === JSON.stringify(["An ETF is a fund, that tracks an index.", "Plan A is simple. An 8% return and an 18 year loan.", "You could have saved a lot more than you think.",
    "Stocks, bonds, and so on are assets.", "So here's what to do: pay on time.", "In the U.S. economy, a university and an hour.", "iPhone sales rose.", "Fewer people buy or sell now.",
    "It's 50/30/20 and 24/7.", "Class A shares and an HSA."]), "the proofreader fixes grammar and wording the narrator would say wrong", JSON.stringify(r.words));
  t.ok(r.proof[0] === 2 && r.proof[1].join("|") === "The fund grows.|Follow for more.|PART 1" && r.proof[2] === "the the fund grows" && r.proof[3] === 0, "proofreading fixes a script in place once, keeps the original for the fact check, and leaves chapter cards alone", JSON.stringify(r.proof));
  t.ok(r.warn.length === 2 && /long sentence/.test(r.warn[0]) && /quotation/.test(r.warn[1]), "long sentences and unclosed quotes are flagged for you to look at", JSON.stringify(r.warn));
  t.ok(r.quiz.slice(0, 7).join() === "quiz,9,3,3,true,true,true" && r.quiz[7] === false, "a quiz: hook, 3 true-or-false questions with countdowns, 3 answers, a question and the ending; recent questions aren't repeated", JSON.stringify(r.quiz));
  t.ok(r.refine.slice(0, 5).join() === "true,true,true,false,true" && r.refine[5] === "tree" && r.refine[6] === "Freelance, freelancer, or freelance worker are terms often used for a person.",
    "definitions phrased as “terms for” are found; series and press-release headlines are skipped; illustrations don't repeat the last subject (unless you chose it)", JSON.stringify(r.refine));
  t.ok(r.say2.join("|") === "Save 3 to 6 months at an A.P.R. of 24 percent.|A hee lock, a four oh three b and a W 2.|Rates hit 5.25 percent to 5.5 percent, up 1.5 times year to date.", "ranges, multiples and finance acronyms are said the way people say them", r.say2.join(" | "));
  t.ok(r.moods.join() === "suspense,cinematic,upbeat,bright,cinematic,upbeat", "Auto music picks a mood that suits each video", r.moods.join());
  t.ok(r.drop.every(([len, ok, ratio]) => len && ok && ratio > 1.5), "the new moods play, and the beat drops in after the hook", JSON.stringify(r.drop));
  t.ok(r.keep.join() === "60,T10,true,false,true", "the Library keeps up to 60 videos and removes a posted one before an older unposted one", JSON.stringify(r.keep));
  t.ok(r.pace[0] === 2.75 && r.pace[1] && r.pace[2] > 2, "length estimates use the narrator's learned speaking pace", JSON.stringify(r.pace));
  t.ok(r.punch.every(Boolean), "Punch captions show one or two words at a time (and never drop a word)", JSON.stringify(r.punch));
  t.ok(r.insert.join() === "1,2", "a spare definition goes after the hook; other spares go before the takeaway", JSON.stringify(r.insert));
  t.ok(r.caps.youtube && r.caps.tiktok && r.caps.instagram && !/undefined/.test(JSON.stringify(r.caps)), "platform captions are complete", "");
  t.ok(!/undefined/.test(JSON.stringify(r.capsOld)) && r.capsOld.youtube.length > 5, "captions work for old reels with missing fields", JSON.stringify(r.capsOld).slice(0, 120));
  t.section("Logic: videos that make sense (v49)");
  const v = await page.evaluate(async () => {
    const H = await import("./app/hook.js"), S = await import("./app/script.js"), V = await import("./app/visuals.js"), Q = await import("./app/quiz.js"), X = await import("./app/extras.js");
    const out = {};
    const dirs = (s) => { const w = s.split(" "), d = H.directionsOf(w); return w.map((x, i) => (d[i] > 0 ? "+" : d[i] < 0 ? "-" : "") + x).join(" "); };
    out.dirs = ["The S&P 500 is down 0.2% on the day and down 5.0% this month.", "The Nasdaq rose 0.4% while the Dow fell by 1.1%.",
      "Put 20% down payment on a home.", "It is up to you, up 3 percent today.", "Bitcoin lost about $5,000 in a week."].map(dirs);
    const mk = (name, day, vals) => ({ name, symbol: name, day_pct: day, is_yield: false, last: vals.at(-1), values: vals });
    const vals = Array.from({ length: 65 }, (_, i) => 100 + i);
    out.lead = [S.marketLead([mk("S&P 500", -0.23, vals), mk("Nasdaq", 0.42, vals), mk("Dow Jones", -1.11, vals)]),
      S.marketLead([mk("S&P 500", -0.5, vals), mk("Nasdaq", -1.6, vals)]), S.marketLead([mk("S&P 500", 0.01, vals), mk("Nasdaq", -0.02, vals)])];
    const script = S.buildMarket([mk("S&P 500", -0.23, vals), mk("Nasdaq", 0.42, vals), mk("Dow Jones", -1.11, vals)], [], { generic: ["money"], cta: "Follow for more.", niche: "investing" });
    out.board = [script.lines[0].board?.length, /^The Dow Jones fell 1\.1% while the Nasdaq rose 0\.4%\./.test(script.lines[0].text), script.lines.filter((l) => l.kind === "chart").length];
    out.money = [V.analyzeLine("Buffett was inspired by a book at age seven, One Thousand Ways to Make $1000.").stat, V.analyzeLine("In 2008, Lehman Brothers lost $600 billion in assets.").stat?.value,
      V.analyzeLine("Keep a $1,000 starter emergency fund.").stat?.value, V.analyzeLine("According to Goldman Sachs, $5 billion moved into funds.").stat?.value];
    out.pop = [S.statFor("Buffett was inspired by a book from the Omaha public library at age seven, One Thousand Ways to Make $1000."),
      S.statFor("According to Goldman Sachs, $5 billion moved into funds."), S.statFor("Keep a $1,000 starter emergency fund."), S.statFor("Market Check: Bitcoin Up 3.4% #Shorts", { isTitle: true })];
    out.quiz = [Q.QUIZ_COUNT.standard, Q.QUIZ_COUNT.long, Q.quizTitle("Crypto", 2), Q.quizTitle("Crypto", 3), Q.buildQuiz({ niche: "crypto", cta: "Follow." }, { count: 2 }).lines.filter((l) => l.kind === "quiz").length];
    const quiz = Q.buildQuiz({ niche: "crypto", cta: "Follow for more." }, { count: 2 });
    const tips = X.coach(quiz.lines, { estimate: 40, range: [30, 45], visuals: [] }).tips.join(" | ");
    out.coach = [/concrete number/.test(tips), /Mix visuals/.test(tips), /another point/.test(tips)];
    // A key figure's tone (a sentence-final "1.1%." too), and a cover title's fall drawn red over a green brand.
    const MK = await import("./app/make.js"), RD = await import("./app/render.js"); await RD.loadFonts();
    out.tone = [MK.toneOf("The Dow Jones fell 1.1%.", "1.1%"), MK.toneOf("Bitcoin rose 12 percent this week.", "12%"), MK.toneOf("Keep a $1,000 starter fund.", "$1,000")];
    const chart = mk("S&P 500", -0.23, Array.from({ length: 65 }, (_, i) => 120 - i * 0.3 + Math.sin(i) * 2));
    const blob = await X.makeCover({ title: "Market Check: S&P 500 Down 0.2% #Shorts", brand: "Money Minute", accent: [46, 213, 115], handle: "", scenes: [], style: "bold" },
      (ctx) => { RD.drawMarketCover(ctx, chart); return { overlay: false }; });
    const bmp = await createImageBitmap(blob), cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1920;
    const cx = cv.getContext("2d"); cx.drawImage(bmp, 0, 0);
    const px = cx.getImageData(0, 870, 1080, 140).data; let red = 0, green = 0;
    for (let i = 0; i < px.length; i += 4) { if (px[i] > 200 && px[i + 1] < 130 && px[i + 2] < 130) red++; if (px[i + 1] > 180 && px[i] < 120) green++; }
    out.cover = [blob.size > 20000, red > 2000, green < 200];
    return out;
  });
  t.ok(v.dirs.join(" / ") === "The S&P 500 is -down -0.2% on the day and -down -5.0% this month. / The Nasdaq +rose +0.4% while the Dow -fell by -1.1%. / Put 20% down payment on a home. / It is up to you, +up +3 +percent today. / Bitcoin -lost about -$5,000 in a week.",
    "money moves are coloured by direction (down red, up green), and only when an amount follows", JSON.stringify(v.dirs));
  t.ok(v.lead[0] === "The Dow Jones fell 1.1% while the Nasdaq rose 0.4%." && v.lead[1] === "Stocks fell across the board, led by the Nasdaq, down 1.6%." && v.lead[2] === "A quiet day: the markets barely moved.",
    "a market recap opens with the day's real movers", JSON.stringify(v.lead));
  t.ok(v.board.join() === "3,true,3", "the opening of a market recap carries the day's board for its picture", JSON.stringify(v.board));
  t.ok(v.money[0] === null && v.money[1] === 6e11 && v.money[2] === 1000 && v.money[3] === 5e9, "an amount in a book title isn't turned into a money counter", JSON.stringify(v.money));
  t.ok(v.pop.join() === ",$5B,$1,000,3.4%", "nor into a number pop; a name that ends its clause or the video's own title still counts", JSON.stringify(v.pop));
  t.ok(v.quiz.join() === "2,3,Crypto Quiz: Can You Get Both Right?,Crypto Quiz: Can You Get All 3?,2", "a quiz has as many questions as fit the length you chose", JSON.stringify(v.quiz));
  t.ok(v.coach.join() === "false,false,false", "the reel coach doesn't ask a quiz for numbers, mixed pictures or more points", JSON.stringify(v.coach));
  t.ok(v.tone.join() === "-1,1,0", "a key figure is a loss, a gain or neither, even at the end of a sentence", JSON.stringify(v.tone));
  t.ok(v.cover.join() === "true,true,true", "a market cover's \"Down 0.2%\" is red, even with a green brand colour", JSON.stringify(v.cover));

  // The newsroom: real headlines from the feeds, said the way a newsreader would.
  t.section("Logic: the newsroom (v50)");
  const n = await page.evaluate(async () => {
    const N = await import("./app/newswriter.js"), S = await import("./app/script.js");
    const say = (title, summary = "", source = "") => N.spokenStory({ title, summary, source })?.text ?? null;
    const out = {};
    out.sentences = [N.sentencesOf("The rules require data centers in Southeast Asia to seek U.S. Approval to buy chips. It could slow a build-out.").length,
      N.sentencesOf("Shares of Apple Inc. Rose 3% on Monday. Then they fell.").length, N.sentencesOf("Prices rose. Rates fell!").length];
    out.strip = [N.stripSource("Fed Poised to Raise Rates Further to Stem Inflation | Economy | U.S. News", "U.S. News & World Report"),
      N.stripSource("Stocks slide as yields climb - Yahoo Finance", "Yahoo Finance"), N.stripSource("Stocks Rally - Dow Jumps 500 Points"),
      N.stripSource("Kicking the housing market while it's down': US home sales fall to 16-year low")];
    out.seo = [N.seoPage("Today's top high-yield savings rates: Up to 4.70% on Nov. 19, 2026"), N.seoPage("Current New York Mortgage And Refinance Rates"),
      N.seoPage("Homes for Sale in New York and New Jersey"), N.seoPage("Mortgage rates hit 7% for the first time since 2023")];
    out.told = [
      say("Anthropic's IPO poses this big risk to an already shaky stock market", "Investors are worried that a flood of equity issuance could overwhelm demand."),
      say("Josh Brown says the breakout potential in this stock is staring investors in the face", "This name made Josh Brown's Best Stocks in the Market list earlier this fall."),
      say("Thursday's big stock stories: What's likely to move the market in the next trading session", "The S&P 500 fell for a fifth consecutive session on Wednesday, notching its longest losing streak since June."),
      say("Bonds are causing trouble again — here's where to invest now", "Rising bond yields and Federal Reserve rate hikes are making for a tricky environment for bond investors. Here's how to play it."),
      say("Big bets against AI debt, from CoreWeave to Oracle and the Mag 7, could soon hit the ETF market"),
      say("I live in Alaska and built a second home in Hawaii. The outlying states have way more in common than I expected."),
      say("Debunking 7 Social Security retirement myths"),
      say("Column | Her credit card debt was double what she thought it was. Here's why."),
      say("Anthropic's IPO is set to create a new class of tech billionaires. See who stands to gain the most."),
      say("The stock market could be headed for more turbulence. How one investor is preparing."),
      say("Your retirement plan may assume 2% inflation. What happens if it's 3.5%?"),
    ];
    // A whole news script from teasing, site-stamped feed items: nothing teased, stamped or cut is said.
    const items = [
      { title: "Fed Poised to Raise Rates Further to Stem Inflation | Economy | U.S. News", summary: "", source: "U.S. News & World Report" },
      { title: "This closely watched investing guru just sold all of his stocks", summary: "Strategist Joachim Klement had his retirement portfolio fully invested in stocks for years.", source: "MarketWatch" },
      { title: "Josh Brown says the breakout potential in this stock is staring investors in the face", summary: "This name made the list.", source: "CNBC" },
      { title: "Treasury yields inch higher as investors weigh the state of the U.S. economy", summary: "The rules require lenders to seek U.S. approval for new loans, threatening to slow growth.", source: "CNBC" },
    ];
    const news = S.buildNews(items, [], { niche: "economy", generic: ["money"], cta: "Follow for more." });
    const said = [...news.lines, ...news.extras].map((l) => l.text).join(" ");
    out.news = [/\|/.test(said), /\bthis (?:stock|closely)\b/i.test(said), /seek U\.S\.$|U\.S\.\s*$/.test(said.trim()), /Klement/.test(said), /Josh Brown/.test(said)];
    return out;
  });
  t.ok(n.sentences.join() === "2,2,2", "sentences aren't broken after \"U.S.\" or \"Inc.\"", JSON.stringify(n.sentences));
  t.ok(n.strip[0] === "Fed Poised to Raise Rates Further to Stem Inflation" && n.strip[1] === "Stocks slide as yields climb" && n.strip[2] === "Stocks Rally - Dow Jumps 500 Points" && n.strip[3] === "US home sales fall to 16-year low",
    "site names and section labels aren't read out; a headline's own words are kept", JSON.stringify(n.strip));
  t.ok(n.seo.join() === "true,true,true,false", "rate tables and listings aren't news; a real rates story is", JSON.stringify(n.seo));
  t.ok(n.told[0] === "Anthropic's IPO poses a big risk to an already shaky stock market. Investors are worried that a flood of equity issuance could overwhelm demand."
    && n.told[1] === null && n.told[2] === "The S&P 500 fell for a fifth consecutive session on Wednesday, notching its longest losing streak since June."
    && n.told[3] === "Bonds are causing trouble again. Rising bond yields and Federal Reserve rate hikes are making for a tricky environment for bond investors.",
    "a teaser is told with its own summary's answer, or not told at all", JSON.stringify(n.told.slice(0, 4)));
  t.ok(n.told[4] === "Big bets against AI debt, from CoreWeave to Oracle and the Mag 7, could soon hit the ETF market." && n.told[5] === null && n.told[6] === null && n.told[7] === null
    && n.told[8] === "Anthropic's IPO is set to create a new class of tech billionaires." && n.told[9] === "The stock market could be headed for more turbulence."
    && n.told[10] === "Your retirement plan may assume 2% inflation. What happens if it's 3.5%?",
    "headlines aren't cut into fragments; essays, columns and unanswered lists are skipped; a real question stays", JSON.stringify(n.told.slice(4)));
  t.ok(n.news.join() === "false,false,false,true,false", "a news script says no site names, teasers or broken sentences", JSON.stringify(n.news));

  // Narration rhythm: pauses that follow the story, and the voice's own pauses cut to a narrator's.
  t.section("Logic: narration rhythm (v51)");
  const nr = await page.evaluate(async () => {
    const MK = await import("./app/make.js"), g = MK._test.gapAfter, L = (text, extra = {}) => ({ kind: "media", text, ...extra });
    const out = {};
    out.gaps = [g(L("Stocks fell."), L("But bonds rose.")), g(L("Stocks fell."), L("Bonds rose.")), g(L("Story one."), L("Second: rates are up.")),
      g(L("Rates rose."), L("Bottom line: save first.", { stance: true })), g(L("Rates rose."), { kind: "outro", text: "Follow for more." }), g(L("Is it safe?"), L("Mostly.")),
      g(L("The hook.", { hold: 0.3 }), L("But first.")), g({ kind: "quiz", text: "True or false?", hold: 2.6 }, { kind: "answer", text: "False!" }), g(L("Last line."))].map((x) => x.toFixed(2));
    const rate = 24000, tone = (sec) => Float32Array.from({ length: Math.round(sec * rate) }, (_, i) => 0.5 * Math.sin(i / 3)), sil = (sec) => new Float32Array(Math.round(sec * rate));
    const cat = (...a) => { const o = new Float32Array(a.reduce((k, x) => k + x.length, 0)); let k = 0; for (const x of a) { o.set(x, k); k += x.length; } return o; };
    const clip = cat(sil(0.03), tone(0.9), sil(0.6), tone(0.9), sil(0.03)), plain = cat(sil(0.03), tone(1.5), sil(0.03));
    const comma = MK._test.tighten(clip, "Hello there my friend, nice to see you again.", rate), breath = MK._test.tighten(clip, "Hello there my friend nice to see you again", rate);
    const left = (c) => MK._test.pausesIn(c, rate).map(([a, b]) => b - a);
    out.tight = [(clip.length - comma.length) / rate, left(comma)[0], (clip.length - breath.length) / rate, left(breath)[0],
      MK._test.tighten(plain, "Hello there my friend, nice to see you.", rate) === plain, comma.every(Number.isFinite) && Math.max(...comma.map(Math.abs)) <= 0.5 + 1e-6];
    return out;
  });
  t.ok(nr.gaps.join() === "0.37,0.45,0.53,0.65,0.65,0.53,0.58,2.88,0.28",
    "the pause after a line follows the story: shorter when the thought carries on, longer for the next item, a beat before the bottom line and the sign-off; held moments keep their timing", nr.gaps.join());
  const [cut1, left1, cut2, left2, same, clean] = nr.tight;
  t.ok(Math.abs(cut1 - 0.36) < 0.03 && Math.abs(left1 - 0.24) < 0.04 && Math.abs(cut2 - 0.26) < 0.03 && Math.abs(left2 - 0.34) < 0.04 && same && clean,
    "a comma's long pause is cut to 0.24 s and a breath to 0.34 s, by removing silence only; a clip without long pauses is untouched", JSON.stringify(nr.tight));

  // Photos chosen by meaning: what a photo shows, judged against the line and the topic, not its title's words.
  t.section("Logic: photos chosen by meaning (v52)");
  const ph = await page.evaluate(async () => {
    const M = await import("./app/media.js"), MK = await import("./app/make.js"), S = await import("./app/ai/semantic.js");
    const out = {};
    out.describe = [M.describe({ title: "Old House of Keys - geograph.org.uk - 1817310.jpg" }), M.describe({ title: "Warren Buffett at the 2015 SelectUSA Investment Summit (cropped).jpg" }),
      M.describe({ title: "IMG_2345", tags: "bitcoin, coin" })];
    const cands = () => [{ title: "Perth City Skyline", about: "Perth City Skyline city skyline", width: 1024, height: 576 }, { title: "Federal Reserve Bank, Richmond, Virginia", width: 1280, height: 1707 }];
    out.rank = [M.rank(cands(), "city skyline", [0.05, 0.72])[0].title, M.rank(cands(), "city skyline")[0].title];
    const ok = await S.loadEmbedder();
    if (ok) {
      const [l, a, b] = await S.embedTexts(["The Federal Reserve System is the central banking system of the United States.", "Federal Reserve Bank, Richmond, Virginia", "Perth City Skyline"]);
      out.sims = [S.cosine(l, a), S.cosine(l, b)];
    }
    await S.releaseEmbedder(); out.model = [ok, true];
    const A = (query, extra = {}) => ({ bitmap: {}, query, relevant: true, sem: 0.6, credit: "x", ...extra });
    const lines = [
      { kind: "media", text: "Bitcoin can swing more in a day than most stocks do in a month.", concrete: true, query: "bitcoin", asset: A("bitcoin") },
      { kind: "media", text: "Bitcoin transactions are verified by network nodes.", concrete: true, query: "bitcoin", asset: A("bitcoin") },
      { kind: "media", text: "So here's what to do: never put in more than you could afford to lose.", concrete: false, query: "cryptocurrency coins", asset: A("cryptocurrency coins", { sem: 0.56 }) },
      { kind: "media", text: "The Federal Reserve sets interest rates for the whole country.", concrete: true, query: "federal reserve building", asset: A("federal reserve building") },
      { kind: "media", text: "Rates touch your mortgage and your savings account too.", concrete: true, query: "federal reserve building", asset: A("federal reserve building"), vmode: "photo" },
      { kind: "media", text: "Interest builds on whatever you leave unpaid each month.", concrete: true, query: "credit card", asset: A("credit card", { relevant: false, sem: 0.2 }) },
    ];
    out.visuals = lines.map((l, i) => MK.decideVisual(l, i, "Bitcoin", lines).type);
    return out;
  });
  t.ok(ph.describe.join(" | ") === "Old House of Keys | Warren Buffett at the 2015 SelectUSA Investment Summit | bitcoin, coin", "a photo is described by what it shows, without file names, catalogue numbers or camera codes", ph.describe.join(" | "));
  t.ok(ph.rank.join() === "Federal Reserve Bank, Richmond, Virginia,Perth City Skyline", "judged by meaning, a photo of the Fed beats \"Perth City Skyline\" even for the search \"city skyline\" (by words alone, the old order stays)", ph.rank.join());
  t.ok(ph.model[0] && ph.sims && ph.sims[0] >= 0.5 && ph.sims[1] <= 0.2, "the meaning model ships with the app, loads and is released; a Fed line is close to a Fed bank and far from a city skyline", JSON.stringify(ph.sims));
  t.ok(ph.visuals.join() === "photo,illus,photo,photo,photo,illus",
    "photos of the same subject never run back to back (a different subject may follow; a scene set to Photo keeps it); an unrelated photo isn't shown", ph.visuals.join());

  // v53: photos framed around their subject; biographies in time order and about the right person; tickers spelled.
  t.section("Logic: framing, biographies and pronunciation (v53)");
  const v53 = await page.evaluate(async () => {
    const R = await import("./app/render.js"), ST = await import("./app/story.js"), SC = await import("./app/script.js");
    const out = {};
    // a wide photo with its subject on the right: the window that keeps most of it is on the right
    const c = document.createElement("canvas"); c.width = 1200; c.height = 800; const x = c.getContext("2d");
    x.fillStyle = "#87a0b8"; x.fillRect(0, 0, 1200, 800);
    for (let i = 0; i < 40; i++) { x.fillStyle = i % 2 ? "#c03020" : "#f0e040"; x.fillRect(820 + (i % 8) * 40, 200 + Math.floor(i / 8) * 80, 30, 60); }
    const bmp = await createImageBitmap(c), I = R.interestOf(bmp), win = R.bestWindow(I.cols, 0.4);
    out.frame = [I.cx > 0.6, win.start > 0.45, win.coverage > 0.8, R.bestWindow(new Float32Array(20).fill(1), 0.5).start];
    // a life in time order: "at age seven" (born 1930) comes before 1947
    const items = ["Warren Edward Buffett is an American investor and philanthropist who is the chairman emeritus and former CEO of Berkshire Hathaway.",
      "Buffett entered the Wharton School of the University of Pennsylvania in 1947 before graduating from the University of Nebraska at 19.",
      "Buffett was inspired by a book he borrowed from the Omaha public library at age seven, One Thousand Ways to Make $1000.",
      "He has given away more than half of his fortune to charity."].map((text) => ({ text, source: "Wikipedia" }));
    const lines = ST.composeStory("Warren Buffett", "investing", items, { max: 4, takeaway: false, person: true, born: 1930 }).lines.map((l) => l.text);
    out.order = [lines.findIndex((l) => /age seven/.test(l)), lines.findIndex((l) => /1947/.test(l))];
    out.year = [ST.eventYear("He bought his first stock at the age of 11.", 1930), ST.eventYear("He entered Wharton in 1947.", 1930), ST.eventYear("at age seven", 0)];
    // a pronoun for someone else isn't turned into the person's name
    const m = ["Charles Thomas Munger was an American businessman, investor, and philanthropist.", "He was the vice chairman of Berkshire Hathaway from 1978 until his death in 2023.",
      "In 1956, Munger married Nancy Barry Borthwick.", "She was a Pasadena native who had been his sister's roommate at Scripps College.", "He is known for his wit and his investing principles."].map((text) => ({ text, source: "Wikipedia" }));
    const ml = ST.composeStory("Charlie Munger", "investing", m, { max: 4, takeaway: false, person: true, born: 1924 }).lines.map((l) => l.text).join(" | ");
    out.pronoun = [/Munger was a Pasadena/.test(ml), /(He|Munger) was the vice chairman/.test(ml)];
    const rl = ST.composeStory("Charlie Munger", "investing", ["Charles Thomas Munger was an American businessman, investor, and philanthropist.", "He was the vice chairman of Berkshire Hathaway from 1978 until his death in 2023.",
      "His grandfather, Thomas Charles Munger, was a state representative and later a U.S. district court judge.", "Munger enrolled in the University of Michigan, where he studied mathematics."].map((text) => ({ text, source: "Wikipedia" })), { max: 4, takeaway: false, person: true, born: 1924 }).lines.map((l) => l.text).join(" | ");
    out.relative = [/grandfather/.test(rl), /Michigan/.test(rl)];
    const NW = await import("./app/newswriter.js");
    out.cased = [NW.sentenceCase("Bitcoin Open Interest Drops 20% as Ethereum and Solana Slide Further"), NW.sentenceCase("Fed's Goolsbee Won't Rule Out Larger Rate Increases as Inflation Risks Mount"),
      NW.sentenceCase("Fed minutes: Higher interest rates needed in December"), NW.sentenceCase("Spanberger Zorbles Quixotic Virginia Flumph Plan")];
    out.plain = ["A Roth IRA is generally not taxed upon distribution.", "Individuals who own it can vote, in order to steer it.", "It was utilized prior to 2002.", "It refers to individuals' rights.", "The value is obtained independently.", "It has an approximately 89 percent ratio."].map(ST.plainWords);
    out.def = [ST.isDefinition("A Roth IRA can also be an individual retirement annuity.", "Roth IRA"), ST.isDefinition("A Roth IRA is generally not taxed on the way out.", "Roth IRA")];
    out.say = SC.speakable("Shares of TSLA fell; AGNC and USDS rose, CNBC said. NOT a STOP sign for NASA.");
    out.byline = [NW.spokenStory({ title: "Peterson: The Fed's chairman sees an AI revolution coming. Now he has to figure out what it means", summary: "Kevin Warsh sees AI at a turning point." })?.text,
      NW.spokenStory({ title: "Nvidia: Shares jump after a record quarter", summary: "Nvidia beat estimates again." })?.text];
    return out;
  });
  t.ok(v53.frame.join() === "true,true,true,0.25", "a photo is framed around where its detail and colour are (an even photo stays centred)", JSON.stringify(v53.frame));
  t.ok(v53.order[0] >= 0 && v53.order[1] > v53.order[0] && v53.year.join() === "1941,1947,9999", "a life is told in time order: an age becomes a year from the birth year", JSON.stringify(v53));
  t.ok(v53.pronoun.join() === "false,true", "\"She…\" after \"Munger married Nancy…\" is about her: it never becomes \"Munger was…\"", JSON.stringify(v53.pronoun));
  t.ok(v53.relative.join() === "false,true", "a biography doesn't spend a line on a relative (\"His grandfather… was a state representative\")", JSON.stringify(v53.relative));
  t.ok(v53.cased.join(" | ") === "Bitcoin open interest drops 20% as Ethereum and Solana slide further | Fed's Goolsbee won't rule out larger rate increases as inflation risks mount | Fed minutes: Higher interest rates needed in December | Spanberger Zorbles Quixotic Virginia Flumph Plan",
    "Title Case headlines are said in sentence case, names kept; a headline it can't convert cleanly stays as it was", v53.cased.join(" | "));
  t.ok(v53.plain.join(" | ") === "A Roth IRA is generally not taxed on distribution. | People who own it can vote, to steer it. | It was used before 2002. | It refers to people's rights. | The value is obtained independently. | It has an approximately 89 percent ratio.",
    "formal words become plain ones only where the meaning stays the same", v53.plain.join(" | "));
  t.ok(v53.def.join() === "true,false", "a second definition (\"can also be an…\") is recognised and dropped", JSON.stringify(v53.def));
  t.ok(v53.byline.join(" | ") === "The Fed's chairman sees an AI revolution coming. Now he has to figure out what it means. | Nvidia: Shares jump after a record quarter.",
    "a column's byline (\"Peterson: …\") isn't read out; a company that is the story keeps its name", v53.byline.join(" | "));
  t.ok(v53.say === "Shares of T.S.L.A. fell; A.G.N.C. and U.S.D.S. rose, CNBC said. NOT a STOP sign for NASA.",
    "a ticker the voice would read as a word is spelled out (TSLA, AGNC, USDS); acronyms it says well and real words are left alone", v53.say);

  t.section("Logic: the voice hears the notation it was trained on (v57)");
  const v57 = await page.evaluate(async () => {
    const K = await import("./app/kokoro-text.js"), T = await import("./app/tts.js"), S = await import("./app/script.js");
    const out = {};
    out.map = [["fˈɛdɚɹəl", "a"], ["bˈɜːd", "a"], ["bˈɜːd", "b"], ["ɡˈoʊɪŋ", "a"], ["ɡˈəʊɪŋ", "b"], ["kˈeə", "b"], ["bˈʌʔn\u0329", "a"], ["dʒˈʌdʒ tʃˈɜːtʃ", "a"], ["fˈaɪɚ ˈaʊɚ bˈɔɪ pˈeɪ", "a"]]
      .map(([ph, lang]) => K.toMisaki(ph, lang));
    // Real eSpeak, both accents: every symbol must be one the model knows (unknown ones are silently dropped).
    const vocab = (await (await fetch("./app/ai/models/kokoro-82m/tokenizer.json")).json()).model.vocab;
    const lines = ["The experts say the Federal Reserve might hike rates again in 2026.", "Go home early, judge the church's nature, and buy the boy a toy (or two).",
      "Your first paycheck: about $1,250 after taxes, or 4.5% of the year's income.", "Their adviser's portfolio rose sharply while bonds fell."];
    out.ph = {};
    for (const voice of ["af_heart", "bf_emma", "bm_george"]) {
      T.setVoice({ engine: "natural", voice });
      try { out.ph[voice] = await T.phonemize(lines.map((l) => S.speakable(l))); } catch (e) { out.ph[voice] = "threw " + (e.message || e); }
    }
    T.setVoice({ engine: "natural", voice: "af_heart" });
    out.acr = await T.phonemize(["Big bets against AI debt could hit the ETF market.", "Buy an ETF. Then wait for an IPO.", "Two IRAs, a TSLA share and AAPL (for now).", "An ATM fee and the APR."].map((l) => S.speakable(l)));
    out.acr2 = await T.phonemize(["J.P. Morgan sees the ECB's view.", "It hit the U.S. The rest followed.", "An FDIC-insured bank."].map((l) => S.speakable(l)));
    T.setVoice({ engine: "natural", voice: "bf_emma" });
    out.acrGb = await T.phonemize([S.speakable("The UK and the ECB.")]);
    out.unknown = Object.values(out.ph).flatMap((x) => (Array.isArray(x) ? [...x.join("")] : [])).filter((c) => vocab[c] === undefined);
    return out;
  });
  t.ok(v57.map.join(" | ") === "fˈɛdəɹəl | bˈɜɹd | bˈɜːd | ɡˈOɪŋ | ɡˈQɪŋ | kˈɛː | bˈʌtn | ʤˈʌʤ ʧˈɜɹʧ | fˈIəɹ ˈWəɹ bˈY pˈA",
    "eSpeak's IPA becomes misaki's: diphthongs as one symbol, ʤ ʧ, an American r in \"bird\", British vowels kept", v57.map.join(" | "));
  t.ok(["bf_emma", "bm_george"].every((v) => Array.isArray(v57.ph[v]) && v57.ph[v].every((p) => p.length > 10)), "the British voices get their phonemes (eSpeak's British English is \"en\"; \"en-gb\" threw and the reel fell back to the classic voice)",
    JSON.stringify(v57.ph.bf_emma).slice(0, 200));
  const us = (v57.ph.af_heart || []).join(" "), gb = (v57.ph.bf_emma || []).join(" ");
  t.ok(Array.isArray(v57.ph.af_heart) && /ɜɹ/.test(us) && !/aɪ|eɪ|oʊ|aʊ|ɔɪ|dʒ|tʃ|ː|ɚ|ɐ|ɾ/.test(us), "American phonemes: rhotic \"er\", no long marks, no two-letter diphthongs", us.slice(0, 200));
  t.ok(/Q/.test(gb) && /ː/.test(gb) && !/ɜɹ/.test(gb), "British phonemes keep their own vowels (\"go\" is Q, long marks, no American r)", gb.slice(0, 200));
  t.ok(v57.acr.join(" | ") === "bˈɪɡ bˈɛts əɡˈɛnst ˌAˈI dˈɛt kʊd hˈɪt ðɪ ˌitˌiˈɛf mˈɑɹkɪt. | bˈI ən ˌitˌiˈɛf. ðˈɛn wˈAt fəɹən ˌIpˌiˈO. | tˈu ˌIˌɑɹˈAz, ə tˌiˌɛsˌɛlˈA ʃˈɛɹ ænd ˌAˌApˌiˈɛl (fɔɹ nˈW). | ən ˌAtˌiˈɛm fˈi ænd ðɪ ˌApˌiˈɑɹ.",
    "acronyms are spelled with acronym stress (\"AI\" is ˌAˈI, not \"uh eye\"; AAPL keeps both A's), with \"an\", \"a\" and \"thee\" before them and brackets kept", v57.acr.join(" | "));
  t.ok(v57.acr2.join(" | ") === "ʤˌApˈi mˈɔɹɡən sˈiz ðɪ ˌisˌibˈiz vjˈu. | ɪt hˈɪt ðə jˌuˈɛs. ðə ɹˈɛst fˈɑlOd. | ən ˌɛfdˌiˌIsˈi ɪnʃˈʊɹd bˈæŋk.",
    "initials before a name get no full stop (\"J.P. Morgan\"), a sentence-ending acronym keeps it, possessives and compounds are spelled", v57.acr2.join(" | "));
  t.ok(v57.acrGb[0] === "ðə jˌuːkˈA and ðɪ ˌiːsˌiːbˈiː.", "British voices spell acronyms with British letter names", v57.acrGb[0]);
  t.ok(v57.unknown.length === 0, "every phoneme sent to the voice is in its vocabulary", [...new Set(v57.unknown)].join(" "));

  t.section("Logic: captions in step with the voice (v58)");
  const v58 = await page.evaluate(async () => {
    const MK = await import("./app/make.js"), T = await import("./app/tts.js"), S = await import("./app/script.js");
    const rate = 24000, tone = (sec) => Float32Array.from({ length: Math.round(sec * rate) }, (_, i) => 0.5 * Math.sin(i / 3)), sil = (sec) => new Float32Array(Math.round(sec * rate));
    const cat = (...a) => { const o = new Float32Array(a.reduce((k, x) => k + x.length, 0)); let k = 0; for (const x of a) { o.set(x, k); k += x.length; } return o; };
    const out = {};
    // A breath with no punctuation after the 3rd of 6 equal words: the 4th word starts after the breath, not before it.
    const clip = cat(sil(0.04), tone(1.2), sil(0.34), tone(1.2), sil(0.04)), text = "one two three four five six";
    const w = MK._test.timings({ lines: [{ text, kind: "media" }] }, [clip]).words;
    out.breath = [w[3].start.toFixed(2), w[2].end <= 1.3];
    // Two pauses, only one at punctuation: both are used, in order, each at its own gap.
    const clip2 = cat(sil(0.04), tone(0.8), sil(0.3), tone(0.8), sil(0.3), tone(0.8), sil(0.04));
    out.two = MK._test.pauseBounds(clip2, "aa bb, cc dd ee ff".split(" "), [1, 1, 1, 1, 1, 1], rate, 0.04, clip2.length / rate - 0.04).map((b) => b[0]);
    // Word lengths from their sounds: a number said in full outweighs its digits' letters.
    const toks = ["The", "S&P", "is", "at", "7,176,", "down", "2.0%."];
    const ph = await T.wordSounds(toks.map((x) => S.speakable(x)));
    const line = { text: toks.join(" "), sounds: { text: toks.join(" "), ph } };
    out.weights = MK._test.soundWeights(line, toks);
    out.stale = MK._test.soundWeights({ text: "changed", sounds: line.sounds }, ["changed"]);
    out.batch = (await T.wordSounds(["Hello there. Second sentence", "", "money."])).map((x) => x.length > 0);
    return out;
  });
  t.ok(v58.breath[0] >= "1.55" && v58.breath[0] <= "1.62" && v58.breath[1], "a breath the voice takes where there's no punctuation holds the next caption back until the voice goes on", JSON.stringify(v58.breath));
  t.ok(v58.two.join() === "1,3", "every pause is matched to its own word gap, in order", JSON.stringify(v58.two));
  const [wThe, wSP, wIs, wAt, wNum] = v58.weights || [];
  t.ok(v58.weights && wNum > 4 * wAt && wSP > 2 * wIs && wThe < wSP, "a word's caption time comes from its sounds: \"7,176\" (said in full) gets far more than \"at\"", JSON.stringify(v58.weights));
  t.ok(v58.stale === null, "sounds for an older version of a line aren't used (the letters are, as before)");
  t.ok(v58.batch.join() === "true,false,true", "many words are sounded out in one eSpeak run, one answer per word, empty for empty", JSON.stringify(v58.batch));

  t.section("Logic: \"Your topic\" scripts that use their research (v59)");
  const v59 = await page.evaluate(async () => {
    const ST = await import("./app/story.js");
    const out = {};
    const story = (topic, niche, texts) => ST.composeStory(topic, niche, texts.map((text) => ({ text, source: "Wikipedia · " + topic }))).lines.map((l) => l.text);
    // 401(k): a name ending in a bracket, and a definition with a legal tail.
    out.k = story("401(k)", "investing", ["In the United States, a 401(k) plan is an employer-sponsored defined-contribution personal pension account, as defined in subsection 401 of the U.S. Internal Revenue Code.",
      "Periodic employee contributions come directly out of their paychecks, and may be matched by the employer.", "At the end of the first quarter of 2026, assets held in 401(k) plans were estimated at $9.9 trillion."]);
    // An article that calls its topic by its abbreviation, and a definition left with a stray comma.
    out.heloc = story("Home equity line of credit", "real estate", ["A home equity line of credit, is a revolving type of secured loan in which the lender agrees to lend a maximum amount within an agreed period, where the collateral is the borrower's property.",
      "HELOCs are usually offered at attractive interest rates.", "A reason for the popularity of HELOCs is their flexibility, both in terms of borrowing and repaying."]);
    out.alias = [ST.topicAliases("Exchange-traded fund", ["ETFs own stocks.", "An ETF trades all day."]), ST.topicAliases("Index fund", ["IF this.", "IF that.", "if so"]), ST.topicAliases("( ) S&P x", ["( ) S", "( ) S"])];
    out.contrast = [ST.fits("In contrast, a few governments have used bitcoin in some capacity.", "Bitcoin"), ST.fits("By contrast, bonds pay interest to holders.", "Bond")];
    out.it = [ST.standAlone("It was true of virtually all plans offered by large employers.", "Health savings account"), ST.standAlone("It pays interest every year.", "Bond")];
    out.risk = [ST.roleOf("Hedge funds take large positions to generate a risk-adjusted return.", "Hedge fund"), ST.roleOf("Early credit cards were mailed to customers thought to be low risk.", "Credit card"), ST.roleOf("Stocks carry the risk of losing money.", "Stock")];
    // The key-number card says big amounts the way the narrator does.
    const G = await import("./app/graphics.js");
    const said = (spec) => { const c = document.createElement("canvas"); c.width = 1080; c.height = 1920; const ctx = c.getContext("2d"), seen = [];
      const f = ctx.fillText.bind(ctx); ctx.fillText = (t, ...r) => { seen.push(String(t)); return f(t, ...r); }; new G.StatBg(spec, [255, 214, 10]).draw(ctx, 1); return seen; };
    out.counter = [said({ type: "money", value: 9.9e12, label: "ASSETS" }), said({ type: "bignum", value: 21e6, prefix: "", suffix: "", label: "BITCOIN" }), said({ type: "money", value: 1550, label: "BENEFIT" }), said({ type: "money", value: 2.25e9, label: "X" })]
      .map((seen) => seen.find((t) => /\d/.test(t)));
    out.tips = ["Social Security", "Short", "Short-term capital gains", "Home equity line of credit", "Certificate of deposit", "Stock split", "Ethereum", "Venture capital"].map((t) => ST.adviceFor(t, "investing")[0]);
    return out;
  });
  t.ok(v59.k.length >= 4 && /^A 401\(k\) plan is an employer-sponsored defined-contribution personal pension account\.$/.test(v59.k[0]) && v59.k.some((l) => /9\.9 trillion/.test(l)),
    "a 401(k) script has its definition (legal tail dropped) and its facts: a topic ending in a bracket is recognised", JSON.stringify(v59.k));
  t.ok(/^A home equity line of credit is a revolving type of secured loan/.test(v59.heloc[0]) && v59.heloc.some((l) => /^HELOCs are usually/.test(l)) && /Your home secures the loan/.test(v59.heloc.at(-1)),
    "an article that says \"HELOCs\" is about the home equity line of credit; its definition loses the stray comma and its tip fits", JSON.stringify(v59.heloc));
  t.ok(JSON.stringify(v59.alias) === '[["ETF"],[],[]]', "an abbreviation counts only when the article uses it in capitals, never as a lower-case word, and is plain letters", JSON.stringify(v59.alias));
  t.ok(v59.counter.join(" | ") === "$9.9 TRILLION | 21 MILLION | $1,550 | $2.25 BILLION", "the key-number card counts to \"$9.9 TRILLION\", not \"$9,900,000,000,000\"; smaller amounts stay in digits", v59.counter.join(" | "));
  t.ok(v59.contrast.join() === "false,false", "a sentence opening \"In contrast,\" or \"By contrast,\" leans on one we don't have, and is left out");
  t.ok(v59.it[0] === null && v59.it[1] === "Bond pays interest every year.", "\"It was true of…\" is about a statement, not the topic: it isn't rewritten as \"Health savings account was true of…\"", JSON.stringify(v59.it));
  t.ok(v59.risk.join() === "how,how,risk", "\"risk-adjusted\" and \"low risk\" aren't a catch; \"the risk of losing money\" is", v59.risk.join());
  t.ok(/statement/.test(v59.tips[0]) && /no limit/.test(v59.tips[1]) && !/no limit/.test(v59.tips[2]) && /Your home/.test(v59.tips[3]) && /penalty/.test(v59.tips[4]) && /split doesn't change/.test(v59.tips[5]) && /afford to lose/.test(v59.tips[6]) && /Startup/.test(v59.tips[7]),
    "each subject gets a takeaway that fits it, not \"check the fees\" (and short-term gains aren't short selling)", v59.tips.join(" | "));

  t.section("Logic: graphics that say what the line says (v60)");
  const v60 = await page.evaluate(async () => {
    const V = await import("./app/visuals.js"), IL = await import("./app/illustrator.js");
    const lab = (t) => { const s = V.analyzeLine(t).stat; return s ? `${s.type}:${s.label}` : "none"; };
    return {
      labels: ["A one percent fee sounds tiny. Over a lifetime, it can cost you a fortune.", "The Dow Jones is at 49,097, down 2.2% on the day and down 7.1% this month.",
        "On the Chain: Bitcoin falls below US$62,000 as rate fears weigh on crypto.", "The Nasdaq Composite lost more than 2% as Anthropic's debut failed to revive the AI trade.",
        "At the end of the first quarter of 2026, assets held in 401(k) plans were estimated at $9.9 trillion.", "The average monthly Social Security benefit for November 2022 was $1,551.",
        "The S&P 500 is at 7,176, down 2.0% on the day and down 7.5% this month.", "With a conventional loan, a down payment under 20 percent often means paying for mortgage insurance.",
        "Fifty percent goes to needs, like rent, groceries, insurance and minimum debt payments.", "They often run around two to five percent, so budget for them on top of your down payment."].map(lab),
      years: ["Dow, S&P 500 enter correction as Nasdaq suffers worst week since 2020.", "China home prices seen falling again in 2099, Reuters poll shows.", "The Roth IRA was introduced in 1997."].map(lab),
      art: ["Dow Jones, S&P 500, Nasdaq 100 Futures Fall as Trump Weighs Iran Decision.", "The Dow Jones fell 1.1% while the Nasdaq rose 0.4%.", "Stocks rose to a record.", "Index funds track the market."].map((t) => IL.artOptions(t, "")[0][0]),
    };
  });
  t.ok(v60.labels.join(" | ") === "percent:FEE | move:DOW JONES | money:BITCOIN | percent:NASDAQ COMPOSITE | money:401(K) PLANS | money:SOCIAL SECURITY BENEFIT | move:S&P 500 | percent:DOWN PAYMENT | percent:NEEDS | percent:null",
    "a number's label names what it counts: no verbs, not the next clause, not \"DAY\"; none rather than a wrong one", v60.labels.join(" | "));
  t.ok(v60.years.join(" | ") === "none | none | year:ROTH IRA", "no history timeline for a year the line only compares with (\"since 2020\") or one still to come", v60.years.join(" | "));
  t.ok(v60.art.join() === "chartDown,chartDown,chartUp,chartUp", "a line about a fall never gets a rising chart (the market's own picture turns down), and the reverse", v60.art.join());

  // Every kind of scene must draw. v53 removed a helper the market board and the chart pills still used, and every
  // market recap failed to render from then until v60; only scripts were tested for that type, never frames.
  t.section("Logic: every kind of scene draws (v60)");
  const frames = await page.evaluate(async () => {
    const R = await import("./app/render.js"); await R.loadFonts();
    const vals = Array.from({ length: 22 }, (_, i) => 7600 - i * 30 + (i % 3) * 20);
    const sp = { name: "S&P 500", symbol: "^GSPC", last: 6910.4, day_pct: -3.7, month_pct: -9.8, values: vals, is_yield: false };
    const tsy = { name: "10-Year Treasury", symbol: "^TNX", last: 4.31, day_pct: 0.02, month_pct: 1.2, values: vals.map((v) => v / 1700), is_yield: true };
    const words = "The S&P 500 is at 6,910, down 3.7% on the day and down 9.8% this month, so here's the bottom line for you.".split(" ").map((text, i) => ({ text, start: i * 0.25, end: i * 0.25 + 0.22 }));
    const kinds = [["board", { markets: [sp, { ...sp, name: "Nasdaq", day_pct: 1.4 }, tsy] }], ["chart", { chart: sp }], ["chart", { chart: tsy }],
      ["stat", { spec: { type: "money", value: 9.9e12, label: "401(K) PLANS" } }], ["stat", { spec: { type: "percent", value: 50, label: "NEEDS" } }], ["stat", { spec: { type: "move", value: 2.3, dir: -1, label: "NASDAQ" } }],
      ["stat", { spec: { type: "split", parts: [50, 30, 20], labels: ["NEEDS", "WANTS", "SAVINGS"], title: "50/30/20" } }], ["stat", { spec: { type: "range", lo: 3, hi: 6, unit: "MONTHS", label: "EXPENSES" } }],
      ["stat", { spec: { type: "growth", every: 9, label: "DOUBLES EVERY 9 YEARS" } }], ["stat", { spec: { type: "year", year: 1997, label: "ROTH IRA" } }], ["stat", { spec: { type: "compare", mult: 2, label: "TWICE AS MUCH" } }],
      ["kinetic", {}], ["quiz", { num: 1, of: 2, countStart: 2, countEnd: 4 }], ["answer", { answer: false, num: 1, of: 2 }], ["section", { num: 2, label: "THE CATCH" }],
      ["recap", { items: ["Save first", "Invest the rest"] }], ["illus", { icon: "piggy", label: "SAVINGS" }], ["outro", {}], ["fallback", {}]];
    const fails = [], c = document.createElement("canvas"); c.width = 1080; c.height = 1920;
    for (const [kind, extra] of kinds) {
      const job = { title: "Market Check", brand: "Money Minute", accent: "#FFD60A", words, audio: new Float32Array(48000 * 6), captionStyle: "bold", captionPos: "low", handle: "", logo: null, hookTitle: false, cta: "follow",
        scenes: [{ start: 0, end: 6, kind, label: "MONEY", seed: 1, ...extra }] };
      for (const t of [0.3, 2.5, 5.8]) { try { R.previewFrame(job, c, t); } catch (e) { fails.push(`${kind}${extra.spec ? "/" + extra.spec.type : ""} at ${t}s: ${e.message}`); break; } }
    }
    return { n: kinds.length, fails };
  });
  t.ok(frames.fails.length === 0, `all ${frames.n} kinds of scene draw (market board, live charts, every data graphic, quiz, chapter, recap, end card…)`, frames.fails.join(" | "));

  t.section("Logic: the news editor (v61)");
  const v61 = await page.evaluate(async () => {
    const NW = await import("./app/newswriter.js"), S = await import("./app/script.js");
    const pairs = [["US Stock Futures Fall as Anthropic Shares Retreat and AI Concerns Weigh on Global Markets.", "Anthropic soared in its debut as stocks tanked. Only one other IPO has done that since 1990."],
      ["Futures Plunge After 6 Straight Days of Losses for S&P 500.", "Red Friday: S&P 500 and the Dow hit correction territory, Nasdaq turns negative for the year."],
      ["Bitcoin drops for third straight day as Asian tech shares slide.", "Bitcoin sell-off versus the tech sell-off, and the SEC finds eight fake crypto trading platforms."],
      ["Bitcoin drops for third straight day as Asian tech shares slide.", "Bitcoin ETF outflows show waning crypto appetite ahead of Anthropic's Nasdaq debut."],
      ["The Fed's chairman sees an AI revolution coming. Now he has to figure out what it means.", "A 'Shock' rate hike by the Fed? In this economy?"],
      ["Ron Johnson's Social Security plan would add $190 trillion to the national debt, CRFB says.", "Social Security's 3.6% 2027 COLA increase could give some retirees a monthly raise."],
      ["Nvidia's stock heads for a stretch of weekly losses not seen since 2008.", "Red Friday: S&P 500 and the Dow hit correction territory, Nasdaq turns negative for the year."],
      ["Rising rents draw Wall Street money to industrial outdoor storage lot investments.", "With home sales at a record low, buyers are calling the shots."],
      ["MSG Rangers stock is a 'trophy asset at a deep discount,' JPMorgan says.", "Here are Friday's biggest analyst calls: Anthropic, SpaceX, Tesla, Apple, Netflix, MSG Rangers, UnitedHealth."]];
    const told = (title, summary = "") => NW.spokenStory({ title, summary, source: "CNBC" })?.text ?? null;
    const news = S.buildNews([
      { title: "US Stock Futures Fall as Anthropic Shares Retreat and AI Concerns Weigh on Global Markets", summary: "" },
      { title: "Anthropic soared in its debut as stocks tanked. Only one other IPO has done that since 1990", summary: "" },
      { title: "Major Index Futures Soar as Anthropic Shares Set to Start Trading on Nasdaq After Blockbuster IPO", summary: "" },
      { title: "Citi warns a key stock-market signal is close to flashing red", summary: "" },
      { title: "Nvidia's stock heads for a stretch of weekly losses not seen since 2008", summary: "" }], [], { niche: "investing", generic: ["x"], cta: "Follow." });
    return { same: pairs.map(([a, b]) => NW.sameEvent(a, b)),
      told: [told("Asure Software Salutes Small Business Saturday with Recruiting and HR Milestones"), told("Bilt Rent Day December 2026: statement credit bonus, JetBlue status, and more"),
        told("Sophie Keane from Ireland Named Global Champion at NFTE's 2026 World Youth Entrepreneurship Challenge"), told("New Trump DOL rule allows more gig workers to be contractors (1)"),
        told("Watch US Economy: Fed's Cook Sees Growing Urgency to Tackle Inflation"), told("Dow Jones, S&P 500, Nasdaq 100 futures fall as Trump weighs Iran decision — INTU, ROST")],
      news: news.lines.slice(1, 4).map((l) => l.text) };
  });
  t.ok(v61.same.join() === "true,true,true,false,false,false,false,false,false",
    "one event told once: the same company, the market's move or bitcoin's move twice is the same story; two Fed or Social Security stories, or a roundup that names everyone, aren't", v61.same.join());
  t.ok(v61.told.slice(0, 3).every((x) => x === null), "press releases and promotions aren't read as news", JSON.stringify(v61.told.slice(0, 3)));
  t.ok(v61.told[3] === "New Trump DOL rule allows more gig workers to be contractors." && /^US Economy: Fed's Cook/.test(v61.told[4]) && /Iran decision\.$/.test(v61.told[5]),
    "labels and leftovers aren't read out: \"Watch\", \"(1)\", a bare ticker list", JSON.stringify(v61.told.slice(3)));
  t.ok(v61.news.filter((l) => /Anthropic/.test(l)).length === 1 && v61.news.some((l) => /Citi/.test(l)) && v61.news.some((l) => /Nvidia/.test(l)),
    "a news reel tells the Anthropic IPO once, then two other stories", JSON.stringify(v61.news));
  await page.context().close();
}
