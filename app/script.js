import { composeStory, cleanHeadline, headlineThread, marketMood, isDefinition, junkHeadline, fits } from "./story.js";
// Script writer: turns research into a short spoken script (hook -> points -> call to action).
// A JavaScript port of reelbot/script.py so reels can be written on the phone.

const ACRONYMS = {
  ETF: "E T F", ETFs: "E T Fs", IRA: "I R A", IRAs: "I R As", IPO: "I P O", GDP: "G D P", CPI: "C P I", PCE: "P C E",
  SEC: "S E C", FDIC: "F D I C", AI: "A I", US: "U S", "U.S.": "U S", USD: "U S dollars", CEO: "C E O", CFO: "C F O",
  EV: "E V", EVs: "E Vs", IRS: "I R S", ECB: "E C B", FOMC: "F O M C", NFT: "N F T", NFTs: "N F Ts", DCA: "D C A",
  BTC: "bitcoin", ETH: "ether", Q1: "first quarter", Q2: "second quarter", Q3: "third quarter", Q4: "fourth quarter",
  YoY: "year over year", "vs.": "versus", vs: "versus", "approx.": "approximately", UK: "U K", EU: "E U",
  OPEC: "oh peck", REIT: "reet", REITs: "reets", FICO: "fyco", HYSA: "high yield savings",
  HSA: "H S A", HSAs: "H S As", APR: "A P R", APY: "A P Y", FHA: "F H A", PMI: "P M I", HELOC: "hee lock", HELOCs: "hee locks",
  "P/E": "P E", EPS: "E P S", YTD: "year to date", NYSE: "N Y S E", USDC: "U S D C", USDT: "U S D T", DeFi: "dee fye",
  LLC: "L L C", LLCs: "L L Cs", KYC: "K Y C", QE: "Q E", ESG: "E S G", CD: "C D", CDs: "C Ds", ATM: "A T M", ATMs: "A T Ms",
  "W-2": "W 2", "W-2s": "W 2s", "403(b)": "four oh three b", ROI: "R O I", GDP: "G D P", CPI: "C P I", APRs: "A P Rs",
};
const SCALE = { k: "thousand", m: "million", mn: "million", b: "billion", bn: "billion", t: "trillion", tn: "trillion" };

// Your own pronunciations ("Roth = rawth"), applied before everything else. Whole words, any case.
let SAY_AS = [];
export function setPronunciations(text) {
  SAY_AS = String(text || "").split("\n").map((l) => l.split("=").map((x) => x.trim())).filter(([a, b]) => a && b)
    .map(([a, b]) => [new RegExp(`(?<![\\w$])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w])`, "gi"), b]);
}

// Rewrite text so the voice pronounces finance jargon correctly.
export function speakable(text) {
  for (const [re, said] of SAY_AS) text = text.replace(re, said);
  text = text.replace(/@([\w.]+)/g, (_, h) => "at " + h.replace(/[._]+/g, " "));   // "@money.minute" -> "at money minute"
  let t = text.replace(/\b(?:US|U\.S\.|USD)\s?\$/g, "$").replace(/\$(\d[\d,]*(?:\.\d+)?)(?:\s?(trillion|billion|million|thousand)|(tn|bn|mn|[kmbt]))?\b/gi, (_, num, w1, w2) => {
    const scale = (w1 || w2 || "").toLowerCase();
    const word = SCALE[scale] || scale;
    const unit = (num === "1" || num === "1.0") && !word ? "dollar" : "dollars";
    return `${num} ${word} ${unit}`.replace("  ", " ");
  });
  t = t.replace(/(\d)\s?%/g, "$1 percent").replace(/(\d)\s?bps\b/g, "$1 basis points");
  // Ranges are said "3 to 6", and "1.5x" is "1.5 times".
  t = t.replace(/(\d(?:[.,]\d+)?)((?: percent| dollars)?)\s?[–-]\s?(?=\$?\d)/g, "$1$2 to ").replace(/(\d)x\b/g, "$1 times");
  t = t.replace(/\b1099s?\b(?= form|s\b| income|$|[.,;])/g, (m) => (m.endsWith("s") ? "ten ninety-nines" : "ten ninety-nine")).replace(/\b529 plan/g, "five twenty-nine plan");
  t = t.replaceAll("S&P", "S and P").replaceAll("&", " and ").replace(/\b401\(?k\)?/gi, "four oh one k").replace(/\b403\(?b\)?/gi, "four oh three b").replace(/\b457\(?b\)?/gi, "four fifty-seven b");
  t = t.split(/\s+/).map((w) => {
    const core = w.replace(/^[,.!?;:"'()]+|[,.!?;:"'()]+$/g, "");
    return ACRONYMS[core] ? w.replace(core, ACRONYMS[core]) : w;
  }).join(" ");
  return t.replace(/\s+/g, " ").trim();
}

const HEADLINE_VISUALS = [
  [/\brepair|mechanic/, "car repair garage"],
  [/job loss|lose your job|laid off|layoff/, "office workers"],
  [/\bfed\b|federal reserve|powell|rate cut|rate hike|interest rate/, "federal reserve building"],
  [/inflation|\bcpi\b|consumer prices/, "grocery store prices"],
  [/mortgage|home ?buyer|housing|home prices/, "suburban house"],
  [/\brent\b|renters|landlord/, "apartment building"],
  [/bitcoin|\bbtc\b/, "bitcoin"],
  [/ethereum|\bether\b/, "ethereum"],
  [/crypto|token|blockchain|stablecoin/, "cryptocurrency coins"],
  [/\boil\b|opec|crude/, "oil rig"],
  [/\bgold\b/, "gold bars"],
  [/gas prices|gasoline/, "gas station"],
  [/tesla|electric vehicle|\bev\b/, "electric car"],
  [/nvidia|chip|semiconductor/, "computer chip"],
  [/\bai\b|artificial intelligence|data center/, "data center"],
  [/amazon|retail|walmart|target|holiday shopping/, "shopping mall"],
  [/bank|jpmorgan|wells fargo|citi/, "bank building"],
  [/jobs|employment|payroll|layoff|hiring|unemploy/, "office workers"],
  [/tariff|trade|import|export|china/, "shipping containers port"],
  [/student loan|college|tuition/, "university graduation"],
  [/credit card/, "credit card"],
  [/\btax|\birs\b/, "tax forms"],
  [/retire|social security|401|pension/, "retirement couple"],
  [/\bcar\b|auto|vehicle/, "car dealership"],
  [/earnings|profit|revenue|quarter/, "stock chart"],
  [/stock|s&p|nasdaq|\bdow\b|wall street|shares|market/, "new york stock exchange"],
  [/small business|entrepreneur|startup/, "small business shop"],
  [/freelanc|gig|side hustle|creator/, "laptop freelancer"],
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// A concrete photo subject for this text, or null when nothing specific matches.
export function visualMatch(text) {
  const low = text.toLowerCase();
  for (const [re, visual] of HEADLINE_VISUALS) if (re.test(low)) return visual;
  return null;
}

export function visualFor(text, generic) {
  return visualMatch(text) || pick(generic);
}

// (Kept for callers: a headline as a sayable sentence. See story.js.)
export const shortenHeadline = (title, maxWords = 18) => cleanHeadline(title, maxWords);

const pct = (v) => `${Math.abs(v).toFixed(1)}%`;
const fmt = (v, d) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export function price(s) {
  const v = s.last;
  if (s.is_yield) return `${v.toFixed(2)}%`;
  if (["BTC-USD", "ETH-USD", "GC=F", "CL=F"].includes(s.symbol)) return "$" + (v >= 100 ? fmt(v, 0) : fmt(v, 2));
  return v >= 1000 ? fmt(v, 0) : fmt(v, 2);
}
// "The S&P 500 is…" but "Bitcoin is…"
const subject = (s, cap = true) => (["BTC-USD", "ETH-USD", "GC=F", "CL=F"].includes(s.symbol) ? s.name : `${cap ? "The" : "the"} ${s.name}`);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const today = () => new Date().toISOString().slice(0, 10).replaceAll("-", "");
const ORDINALS = ["First", "Second", "Third", "Fourth"];
const line = (text, visual = "", kind = "media", chart = null) => ({ text, visual, kind, chart });

export function buildEvergreen(topic, opts, definition) {
  const vis = topic.visuals;
  const lines = [line(topic.hook, vis[0])];
  topic.points.forEach((p, i) => lines.push(line(p, vis[(i + 1) % vis.length])));
  lines.push(line(opts.cta, "", "outro"));
  const extras = (topic.extras || []).map((e, i) => line(e, vis[(i + 2) % vis.length]));
  const sources = [];
  // The Wikipedia definition is a spare line, and only when the script doesn't already say what the topic is.
  const name = topic.wiki || topic.title;
  const explained = topic.points.some((p) => isDefinition(p, name) || /\b(means|is when|is a|is an|are|stands for)\b/i.test(p.split(/\s+/).slice(0, 9).join(" ")));
  // ...and only a short, plain one: encyclopedia definitions are often a mouthful.
  // It must also pass the storyteller's checks (no legal jargon, not cut off at "U.S.", nothing missing).
  if (definition && !explained && definition.split(/\s+/).length <= 22 && fits(definition, name)) {
    extras.push({ ...line(definition, vis[vis.length - 1]), source: "Wikipedia · " + topic.wiki });
    sources.push("https://en.wikipedia.org/wiki/" + topic.wiki.replaceAll(" ", "_"));
  }
  return { kind: "evergreen", topicId: topic.id, title: topic.title, topicTitle: topic.wiki || topic.title, niche: opts.niche, lines, extras, tags: [...(topic.tags || [])], sources };
}

export function buildNews(headlines, markets, opts) {
  // Up to three headlines that aren't the same story, told so related ones sit together, then what
  // they have in common and why it matters to the viewer.
  const distinct = [];
  for (const h of headlines) {
    const t = cleanHeadline(h.title);
    if (t.split(/\s+/).length < 4 || junkHeadline(t)) continue;
    const key = (x) => new Set(x.toLowerCase().match(/[a-z]{4,}/g) || []);
    const a = key(t);
    if (distinct.some((d) => { const b = key(d.said); let n = 0; for (const w of a) if (b.has(w)) n++; return n / Math.max(1, Math.min(a.size, b.size)) > 0.6; })) continue;
    distinct.push({ ...h, said: t });
    if (distinct.length >= 4) break;
  }
  if (distinct.length < 2) return null;
  const thread = headlineThread(distinct.slice(0, 3).map((p) => `${p.said} ${p.summary || ""}`), opts.niche === "crypto" ? "crypto" : opts.niche === "real estate" ? "housing" : "");
  const picks = thread.order.map((i) => distinct[i]);
  const g = opts.generic;
  const label = { crypto: "crypto", investing: "market", economy: "economy", "real estate": "housing", "side hustles": "money" }[opts.niche] || "money";
  const n = picks.length;
  const hook = pick([
    `${n} ${label} stories from today that could touch your money.`,
    `${n} ${label} headlines you need to know today, and what links them.`,
    `You missed ${n} big ${label} stories today. Here they are, fast.`,
  ]);
  const lines = [line(hook, visualFor(picks.map((p) => p.title).join(" "), g))];
  picks.forEach((item, i) => lines.push({ ...line(`${ORDINALS[i]}: ${item.said}`, visualFor(item.title, g)), source: item.source || null }));
  const why = thread.text;
  lines.push(line(why, visualFor(why, g)));
  lines.push(line(opts.cta, "", "outro"));

  const extras = [];
  if (markets.length) {
    const s = markets[0];
    extras.push(line(`Meanwhile, ${subject(s, false).replace(/^(Gold|Oil)$/, (m) => m.toLowerCase())} is ${s.day_pct >= 0 ? "up" : "down"} ${pct(s.day_pct)} today.`, "", "chart", s));
  }
  const sent = (picks[0].summary || "").split(/(?<=[.!?])\s+/)[0] || "";
  const wc = sent.split(/\s+/).filter(Boolean).length;
  if (wc >= 6 && wc <= 24) extras.push(line(sent, visualFor(sent, g)));
  if (distinct.length > 3) extras.push(line(`And one more: ${distinct[3].said}`, visualFor(distinct[3].title, g)));

  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const cap = label.replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    kind: "news", topicId: `news-${slug(opts.niche)}-${today()}`, title: `${n} ${cap} Headlines You Need to Know (${date})`,
    niche: opts.niche, lines, extras, tags: [`${label} news`, opts.niche, "finance news"],
    sources: picks.map((p) => p.link).filter(Boolean),
  };
}

export function buildMarket(markets, headlines, opts) {
  if (markets.length < 2) return null;
  const g = opts.generic;
  const day = new Date().toLocaleDateString("en-US", { weekday: "long" });
  // The opening says how the day went overall, and the closing thought answers it.
  const mood = marketMood(markets.slice(0, 3));
  const lines = [line(pick([
    `Here's your ${day} market check. ${mood.opening}`,
    `What did the markets do this ${day}? ${mood.opening}`,
  ]).trim(), "new york stock exchange")];
  for (const s of markets.slice(0, 3)) {
    const m = s.month_pct >= 0 ? "up" : "down";
    // A move that rounds to 0.0% is "flat", not "up 0.0%".
    const day = Math.abs(s.day_pct) < 0.05 ? "flat on the day" : `${s.day_pct >= 0 ? "up" : "down"} ${pct(s.day_pct)} on the day`;
    const text = s.is_yield
      ? `${subject(s)} sits at ${price(s)}, ${day}.`
      : `${subject(s)} is at ${price(s)}, ${day} and ${m} ${pct(s.month_pct)} this month.`;
    lines.push(line(text, "", "chart", s));
  }
  const extras = [];
  headlines = headlines.filter((h) => !junkHeadline(cleanHeadline(h.title)));
  if (headlines.length) {
    lines.push(line(`In the news: ${shortenHeadline(headlines[0].title)}`, visualFor(headlines[0].title, g)));
    if (headlines.length > 1) extras.push(line(`Also: ${shortenHeadline(headlines[1].title)}`, visualFor(headlines[1].title, g)));
  }
  lines.push(line(mood.closing, "coins stack growth"));
  lines.push(line(opts.cta, "", "outro"));
  const lead = markets[0];
  return {
    kind: "market", topicId: `market-${slug(opts.niche)}-${today()}`,
    title: `Market Check: ${lead.name} ${Math.abs(lead.day_pct) < 0.05 ? "Flat" : `${lead.day_pct >= 0 ? "Up" : "Down"} ${pct(lead.day_pct)}`}`,
    niche: opts.niche, lines, extras, tags: ["stock market", "market recap", lead.name],
    sources: headlines.slice(0, 2).map((h) => h.link).filter(Boolean),
  };
}

// A script for any topic, built from the key sentences of its Wikipedia article.
export function buildCustom(found, opts) {
  const title = found.title.replace(/\s+\(.*\)$/, "");
  // A common noun appears in lower case in the article's own first sentence ("A mortgage loan is…").
  const common = title !== title.toLowerCase() && ((found.sentences[0] || "").includes(" " + title.toLowerCase()) || /^[A-Z][a-z]+(?:[ -][a-z]+)+$/.test(title));
  // A person: a role word in the opening sentence, or a name followed by "He/She…" sentences.
  const s0 = found.sentences[0] || "";
  const person = /\b(?:is|was) an? [\w\s,'-]*?\b(?:investor|businessman|businesswoman|businessperson|entrepreneur|economist|politician|philanthropist|executive|banker|financier|author|writer|billionaire|trader|founder|industrialist|magnate|futurist|inventor|engineer|official|official|manager|mogul|tycoon|ceo)\b/i.test(s0)
    || (/^[A-Z][a-z]+(?: [A-Z][a-z.']+){1,3} (?:is|was) an? /.test(s0) && found.sentences.slice(1, 5).some((x) => /^(He|She) /.test(x)));
  // Institutions and events take "the" in a sentence ("What is the Federal Reserve?").
  const the = /^(Federal Reserve|European Central Bank|Bank of |International Monetary Fund|World Bank|Great Depression|Great Recession|Dot-com bubble|Gold standard|Internal Revenue Service|Securities and Exchange Commission|Dow Jones|Nasdaq|S&P 500|New York Stock Exchange|Wall Street crash|Bretton Woods|Consumer price index|Federal funds rate|Rule of 72|FIRE movement|Gig economy|Stock market|Housing bubble|Subprime)/i.test(title) ? "the " : "";
  const hook = pick(person ? [
    `Who is ${title}? Here's the quick version.`,
    `${title}, explained in thirty seconds.`,
    `Everyone has heard of ${title}. Here's why.`,
  ] : common ? [
    // Common nouns ("mortgage loan") read wrong capitalised mid-sentence or without "a", so these avoid both.
    `${title}, explained in thirty seconds.`,
    `${title}: here's what it actually means.`,
    `Here's what ${title.toLowerCase()} really means, in plain English.`,
  ] : [
    `${title}, explained in thirty seconds.`,
    `What is ${the}${title}? Here's the quick version.`,
    `Everyone talks about ${the}${title}. Here's what it actually ${/s$/.test(title) && !the ? "means" : "does"}.`.replace("actually does", the ? "actually does" : "actually means"),
  ]);
  const g = opts.generic;
  const match = (text) => { const low = text.toLowerCase(); for (const [re, v] of HEADLINE_VISUALS) if (re.test(low)) return v; return null; };
  // Abstract finance words make poor photo searches ("inflation" finds art), so map them to concrete
  // subjects. Names of people, companies and places are searched as-is: that finds the right photo.
  const titleVisual = match(title) || title;
  const visual = (text, i) => match(text) || (i % 2 ? titleVisual : g[i % g.length]);
  // The storyteller picks and orders the sentences: what it is, how it works, a number, why it
  // matters, and a practical takeaway.
  const src = "Wikipedia · " + found.title;
  const story = composeStory(title, opts.niche, found.items || found.sentences.map((text) => ({ text, source: src })), { max: person ? 4 : 5, takeaway: !person, person });
  const asLine = (p, i) => ({ ...line(p.text, visual(p.claim || p.text, i + 1)), source: p.source || undefined, claim: p.claim || undefined, tip: p.tip || undefined });
  const lines = [line(hook, titleVisual), ...story.lines.map(asLine)];
  lines.push(line(opts.cta, "", "outro"));
  const extras = story.leftovers.slice(0, 3).map((p, i) => asLine(p, i + 5));
  return {
    kind: "custom", person, topicTitle: title, topicId: "custom-" + slug(title).slice(0, 40), title, niche: opts.niche, lines, extras,
    // The text it was written from, so the fact check can confirm each line against its real source.
    sourceText: (found.items || found.sentences.map((text) => ({ text, source: found.title }))).map((x) => ({ text: x.text, source: (x.source || found.title).replace(/^Wikipedia · /, "").split(" — ")[0], section: (x.source || "").split(" — ")[1] || null })),
    tags: [title, opts.niche, "explained"], sources: [found.url],
  };
}

const hashtag = (s) => "#" + s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, "");

export function buildMetadata(script, credits) {
  let title = script.title;
  if (title.length + 8 <= 100) title += " #Shorts";
  const tags = [...new Set([...script.tags, script.niche, "finance", "money", "shorts"])];
  const hashtags = [...new Set(["#Shorts", "#Finance", "#Money", ...tags.slice(0, 5).map(hashtag)])].join(" ");
  const d = [script.title, "", script.lines.map((l) => l.text).join(" "), ""];
  if (script.sources.length) d.push("Sources:", ...script.sources.map((s) => `- ${s}`), "");
  if (credits.length) d.push("Media credits:", ...credits.map((c) => `- ${c}`), "");
  d.push("Music: original, procedurally generated.", "Not financial advice. This video is for educational purposes only.", "", hashtags);
  return { title, description: d.join("\n"), tags };
}

/* ---------- number pops: the key figure in a line, for a big on-screen callout ---------- */
const SMALL = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const BIG = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 };

// "twenty five" -> "25", "one thousand" -> "1000" (only runs of number words are touched)
export function wordsToDigits(text) {
  const tokens = text.split(/(\s+|-)/);
  const out = []; let run = null, cur = 0, total = 0, pending = [];
  const flush = () => {
    if (run) { out.push(String(total + cur)); if (/^\s+|-$/.test(pending.at(-1) || "")) out.push(pending.at(-1)); }
    else out.push(...pending);
    run = null; cur = 0; total = 0; pending = [];
  };
  for (const tok of tokens) {
    const w = tok.toLowerCase().replace(/[^a-z]/g, "");
    const trail = tok.match(/[^a-z]+$/i)?.[0] || "";
    if (w in SMALL || (w in BIG && run)) {
      run = true;
      if (w in SMALL) cur += SMALL[w];
      else if (w === "hundred") cur = (cur || 1) * 100;
      else { total += (cur || 1) * BIG[w]; cur = 0; }
      pending = [];
      if (trail) { flush(); out.push(trail); }
    } else if (run && /^(\s+|-)$/.test(tok)) {
      pending.push(tok);
    } else { flush(); out.push(tok); }
  }
  flush();
  return out.join("");
}

const fmtN = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 });
export function statFor(text) {
  let m = text.match(/(?:US)?\$\s?(\d[\d,]*(?:\.\d+)?)\s?(trillion|billion|million|thousand|[TBMK])?\b/i);
  if (m) {
    const unit = (m[2] || "").toLowerCase();
    return "$" + m[1] + ({ trillion: "T", billion: "B", million: "M", thousand: "K", t: "T", b: "B", m: "M", k: "K" }[unit] || "");
  }
  m = text.match(/(\d+(?:\.\d+)?)\s?%/);
  if (m) return m[1] + "%";
  const t = wordsToDigits(text);
  m = t.match(/\b(\d[\d,]*(?:\.\d+)?)\s+(?:percent|per cent)\b/i);
  if (m) return fmtN(m[1].replaceAll(",", "")) + "%";
  m = t.match(/\b(\d[\d,]*)\s+dollars?\b/i);
  if (m) return "$" + fmtN(m[1].replaceAll(",", ""));
  m = t.match(/\b(\d+)\s+(?:to|-)\s+(\d+)\s+(years?|months?|weeks?|days?)\b/i);
  if (m) return `${m[1]}–${m[2]} ${m[3].toUpperCase()}`;
  m = t.match(/\b(\d+)\s+(years?|months?|times)\b/i);
  if (m && !(+m[1] >= 1900 && +m[1] <= 2100) && +m[1] > 1) return `${m[1]} ${m[2].toUpperCase()}`;
  return null;
}

/* ---------- captions ready to paste, per platform ---------- */
const NICHE_TAGS = {
  "personal finance": ["#personalfinance", "#moneytips", "#budgeting", "#savingmoney"],
  investing: ["#investing", "#stocks", "#stockmarket", "#investingforbeginners"],
  crypto: ["#crypto", "#bitcoin", "#cryptocurrency", "#ethereum"],
  economy: ["#economy", "#inflation", "#finance", "#news"],
  "side hustles": ["#sidehustle", "#makemoneyonline", "#entrepreneur", "#passiveincome"],
  "real estate": ["#realestate", "#homebuying", "#mortgage", "#housingmarket"],
};

function creditsOf(reel) {
  if (reel.credits) return reel.credits;
  const m = (reel.description || "").match(/Media credits:\n([\s\S]*?)\n\n/);   // older reels
  return m ? m[1].split("\n").map((x) => x.replace(/^- /, "")) : [];
}
const shortCredit = (c) => c.replace(/\s+https?:\/\/\S+$/, "").replace(/^"([^"]{0,40})[^"]*"/, '"$1"');

// Hashtags for the reel's own topic ("Index fund" -> #IndexFunds #indexfund), not just its niche.
const TAG_SKIP = new Set(["the", "a", "an", "of", "and", "or", "to", "in", "on", "for", "your", "you", "how", "what", "why", "is", "are", "explained", "really", "plain", "english", "never", "skip", "part", "quick", "simple", "power", "truth", "about", "when", "with", "without"]);
export function topicHashtags(reel) {
  const src = (reel.topic || reel.title || "").replace(/\s*#Shorts$/, "").replace(/·\s*Part \d+/i, "").replace(/\(([a-z])\)/gi, "$1");
  const words = (src.match(/[A-Za-z0-9&]+/g) || []).filter((w) => !TAG_SKIP.has(w.toLowerCase()) && w.length > 1).slice(0, 3);
  if (!words.length) return [];
  const camel = "#" + words.map((w) => (/^[A-Z0-9&]+$/.test(w) ? w : w[0].toUpperCase() + w.slice(1).toLowerCase())).join("").replace(/&/g, "And");
  const lower = "#" + words.join("").toLowerCase().replace(/&/g, "and");
  return [...new Set([camel, lower])].filter((t) => t.length >= 4 && t.length <= 26);
}

export function platformCaptions(reel) {
  // Older or partly saved reels may lack some fields: fall back rather than fail (or paste "undefined").
  reel = { ...reel, title: reel.title || "Money tip", description: reel.description || "" };
  const title = reel.title.replace(/\s*#Shorts$/, "");
  const lines = (reel.script || "").split("\n").filter(Boolean);
  const body = lines.slice(0, -1);                    // drop the call to action
  const follow = reel.handle ? `Follow ${reel.handle} for a new money tip every day.` : "Follow for a new money tip every day.";
  const niche = reel.niche || (reel.tags || []).find((t) => NICHE_TAGS[t]) || "personal finance";
  const tags = [...topicHashtags(reel), ...(NICHE_TAGS[niche] || NICHE_TAGS["personal finance"])];
  const credits = creditsOf(reel);
  const sources = reel.sources || [];
  const disclaimer = "Not financial advice. For education only.";

  const youtube = reel.description ? `${reel.title}\n\n${reel.description}` : [reel.title, "", ...lines, "", tags.join(" "), "", disclaimer].join("\n");

  const tiktok = [
    body[0] || title, "",
    follow, "",
    [...tags, "#money", "#finance", "#learnontiktok"].join(" "), "",
    disclaimer,
    credits.length ? "Photos: " + credits.map(shortCredit).join("; ") : "",
  ].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n").trim();

  const instagram = [
    body[0] || title, ".",
    ...body.slice(1).map((l) => "→ " + l), "",
    "Save this for later and share it with a friend who needs it.",
    follow, "", disclaimer,
    credits.length ? "\nPhoto credits:\n" + credits.map((c) => "• " + c).join("\n") : "",
    sources.length ? "\nSources:\n" + sources.slice(0, 3).map((s) => "• " + s).join("\n") : "",
    "", [...tags, "#money", "#finance", "#financialfreedom", "#moneymindset", "#reels"].join(" "),
  ].join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return { youtube, tiktok, instagram };
}
