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
    await caches.delete(IL.ART_CACHE); IL.forgetArt();
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
  t.ok(r.insert.join() === "1,2", "a spare definition goes after the hook; other spares go before the takeaway", JSON.stringify(r.insert));
  t.ok(r.caps.youtube && r.caps.tiktok && r.caps.instagram && !/undefined/.test(JSON.stringify(r.caps)), "platform captions are complete", "");
  t.ok(!/undefined/.test(JSON.stringify(r.capsOld)) && r.capsOld.youtube.length > 5, "captions work for old reels with missing fields", JSON.stringify(r.capsOld).slice(0, 120));
  await page.context().close();
}
