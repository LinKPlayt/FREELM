// Works out what a line of the script can show, so the picture matches what's being said.
//   analyzeLine(text) -> { stat: {...} | null, icon: "piggy" | ... | null, label: "EMERGENCY FUND" | null }
// "stat" describes a data graphic built from the line's own numbers (see graphics.js);
// "icon" is the illustration that fits the line's concept.
import { wordsToDigits, inTitle } from "./script.js";

const NUM = String.raw`(\d[\d,]*(?:\.\d+)?)`;
const STOP = new Set(("a an the of to for on in and or your you is are be was were been has had have just only about like with from that this " +
  "at by as can could will may most more less than goes go above below over under into it's that's there's here's what's don't isn't " +
  "it its they their them we our if when").split(" "));
const toNum = (s) => Number(String(s).replace(/,/g, ""));
const fmt = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

// A short label from the words right after a number (or right before it), e.g.
// "50 percent goes to needs, like rent" -> "NEEDS"; "a 10 percent yearly return" -> "YEARLY RETURN";
// "ten times the annual income of a craftsman" -> "ANNUAL INCOME". Stops at the next number or filler word.
function phrase(words, max) {
  const out = [];
  for (const w of words) {
    if (/\d/.test(w)) break;
    if (STOP.has(w)) { if (out.length) break; continue; }
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}
// A label names what the number counts, so it's a noun phrase: no verbs ("FEE SOUNDS TINY"), no adverbs
// ("ASSETS PROPORTIONATELY"), not the next clause ("$62,000 as RATE FEARS weigh…"), not a time frame ("on the DAY").
const VERB = new Set(("is are was were be been being has have had do does did can could will would may might must should shall " +
  "sounds sound means mean goes go went doubles double grows grow grew adds add runs fell dropped rose lost lose " +
  "loses gained jumped jumps jump paid keep keeps kept lets let make makes made takes take took get gets got " +
  "seen see sees showed says said say enter enters entered fail fails failed tanked soared weigh weighs suffers " +
  "suffered suffer leave leaves left charged eat eats moved reach reaches reached become becomes became remain " +
  "remains stayed stays stay needed suggest suggests require requires allow allows give gives gave expect " +
  "expects expected plunged slid sink sinks sank climbed surged rallied tumble tumbles tumbled declined " +
  "falls rises drops surges plunges slides climbs hits shows run move soar soars sinks slips slipped nears").split(" "));
const CLAUSE = new Set("as while so but because since when whenever after before if and which who whose that than then or until unless though although whereas".split(" "));
const ADV = /^(?:often|even|also|just|still|again|around|nearly|almost|usually|typically|generally|currently|only|already|ever|never|now|very|quite|instead)$|..ly$/;
const PRON = new Set("he she it they we you i his her its their our this these those".split(" "));
const MONTH = /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*$/;
const TIME = /^(?:day|days|week|weeks|month|months|year|years|today|quarter|session)$/;
const isNum = (w) => /^[\d$]/.test(w) && !/^\d+\([a-z]\)$/.test(w);       // "401(k)" and "s&p 500" are names, not numbers
const verbish = (w) => VERB.has(w) || ADV.test(w) || (/[a-z]{3}ed$/.test(w) && !/(?:need|feed|seed|speed|deed|bleed|breed)$/.test(w));
function phraseAfter(words, max) {
  const out = [];
  for (const w of words) {
    if (isNum(w)) { if (!out.length && /^(?:1[5-9]|20)\d\d$/.test(w)) continue; break; }      // "3.6% 2027 COLA increase": past the year
    if (!out.length && CLAUSE.has(w)) return [];                                            // a new clause: nothing here names the number
    if (!out.length && /^(?:goes|go|went|invested|put|spent|set|allocated)$/.test(w)) continue;   // "goes to NEEDS", "invested in CDS"
    if (!out.length && (verbish(w) || /[a-z]{3}ing$/.test(w))) return [];                   // "…often means paying for…": another verb's object
    if (w === "per" && !out.length) { out.push(w); continue; }                              // "PER DEPOSITOR"
    if (STOP.has(w) || CLAUSE.has(w) || w === "per" || PRON.has(w)) { if (out.length && out.join() !== "per") break; continue; }
    if (verbish(w)) break;
    out.push(w);
    if (out.length >= max) break;
  }
  return out.filter((w) => w !== "per").length ? out : [];
}
// Words before the number, nearest first: past the verb and filler right before it ("…plans were estimated at"),
// and a date ("…benefit for November 2022 was"), then the noun phrase.
function phraseBefore(words, max) {
  const out = []; let skipped = 0;
  for (const w of words) {
    const filler = isNum(w) || MONTH.test(w) || STOP.has(w) || CLAUSE.has(w) || verbish(w) || w === "per" || w === "up" || (!out.length && (/[a-z]{3}ing$/.test(w) || w === "down"));
    if (!out.length) { if (PRON.has(w)) return []; if (filler) { if (++skipped > 7) return []; continue; } }
    else if (filler || PRON.has(w)) break;
    out.push(w);
    if (out.length >= max) break;
  }
  return out.reverse();
}
// Words, lower case; names that contain a number stay one word ("401(k)", "S&P 500", "Nasdaq 100").
const clean = (s) => s.toLowerCase().replace(/\b(\d+)\(([a-z])\)/g, "$1\u2045$2\u2046").replace(/\b(s&p|nasdaq|russell|dow|ftse|nikkei)\s+(\d+)\b/g, "$1\u2047$2")
  .replace(/[^a-z0-9 '&\u2045\u2046\u2047-]/g, " ").split(/\s+/).filter(Boolean).map((w) => w.replace("\u2045", "(").replace("\u2046", ")").replace("\u2047", " "));
const timeOnly = (ws) => ws.length && ws.every((w) => TIME.test(w) || w === "single" || w === "per");
// The subject of the sentence the number is in: past a lead-in ("On the Chain:", "By mid-2003,").
function subjectOf(text) {
  const t = text.replace(/^[^.:]{0,40}:\s+/, "").replace(/^(?:by|in|on|at|as of|since|after|before|during|for|over|with)\b[^,]{0,60},\s*/i, "");
  const out = [];
  for (const w of clean(t)) {
    if (!out.length && /^(?:the|a|an)$/.test(w)) continue;
    if (!out.length && PRON.has(w)) return null;
    if (isNum(w) || STOP.has(w) || CLAUSE.has(w) || verbish(w) || PRON.has(w)) break;
    out.push(w);
    if (out.length >= 3) break;
  }
  return out.join(" ").toUpperCase() || null;
}
function labelNear(text, index, length, max = 3, prefer = "after") {
  const after = phraseAfter(clean(text.slice(index + length).replace(/^[\s,.;:]+/, "").split(/[,.;:!?(]/)[0]), max);
  const before = phraseBefore(clean(text.slice(0, index).split(/[,.;:!?]/).pop()).reverse(), max);
  // When the clause ends right after the number ("above 50 percent, that's…"), the words before it name it.
  if (/^\s*[,;:]/.test(text.slice(index + length))) prefer = "before";
  const pick = (a, b) => (a.length && !timeOnly(a) ? a : b.length && !timeOnly(b) ? b : []);
  const words = prefer === "before" ? pick(before, after) : pick(after, before);
  return words.join(" ").toUpperCase().trim() || subjectOf(text);
}

function statOf(raw) {
  const text = wordsToDigits(raw).replace(/(\d)\s*%/g, "$1 percent");
  let m;

  // Growth first: "doubles every 7 years" is the story even when a rate is mentioned too.
  m = text.match(new RegExp(String.raw`doubl\w*\s+(?:about\s+|roughly\s+)?every\s+` + NUM + String.raw`\s+years?`, "i"));
  if (m) return { type: "growth", every: toNum(m[1]), label: `DOUBLES EVERY ${m[1]} YEARS` };

  // A move: "fell 1.1%", "rose 12 percent". A ring would say "1.1% of something"; it gets an arrow instead,
  // red or green, with what moved.
  const mv = text.match(new RegExp(String.raw`\b(down|fell|fall|falls|dropped|drops|slid|sank|plunged|tumbled|declined|lost|lose|loses|up|rose|rises|gained|gains|climbed|jumped|surged|rallied|grew)\s+(?:by\s+|about\s+|nearly\s+|almost\s+|over\s+|roughly\s+)?` + NUM + String.raw`\s+percent`, "i"));
  if (mv) {
    const up = /^(up|rose|rises|gained|gains|climbed|jumped|surged|rallied|grew)$/i.test(mv[1]);
    const near = phraseBefore(clean(text.slice(0, mv.index).split(/[.;:!?]/).pop()).reverse(), 3);
    const subject = near.length && !timeOnly(near) ? near.join(" ").toUpperCase() : subjectOf(text.slice(0, mv.index));
    return { type: "move", value: toNum(mv[2]), dir: up ? 1 : -1, label: subject || labelNear(text, mv.index, mv[0].length) };
  }

  // Several percentages in one breath: a split (50/30/20) of a whole, so they add up to most of 100.
  const pcts = [...text.matchAll(new RegExp(NUM + String.raw`\s+percent`, "gi"))];
  m = raw.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{1,2})\b/);
  if (m) return { type: "split", parts: [m[1], m[2], m[3]].map(Number), labels: ["NEEDS", "WANTS", "SAVINGS"], title: `${m[1]}/${m[2]}/${m[3]}` };
  if (pcts.length >= 2) {
    const parts = pcts.slice(0, 4).map((p) => toNum(p[1]));
    const sum = parts.reduce((a, b) => a + b, 0);
    if (parts.every((p) => p > 0 && p <= 100) && sum <= 100.5 && sum >= 80)
      return { type: "split", parts, labels: pcts.slice(0, 4).map((p) => labelNear(text, p.index, p[0].length, 2) || ""), title: parts.join("/") };
  }
  if (pcts.length === 1) {
    const p = pcts[0], v = toNum(p[1]);
    if (v > 0 && v <= 100) return { type: "percent", value: v, label: labelNear(text, p.index, p[0].length) };
    if (v > 100) return { type: "bignum", value: v, prefix: "", suffix: "%", label: labelNear(text, p.index, p[0].length) };
  }

  // A range of time: "3 to 6 months".
  m = text.match(new RegExp(NUM + String.raw`\s*(?:to|-|–)\s*` + NUM + String.raw`\s+(years?|months?|weeks?|days?)`, "i"));
  if (m) return { type: "range", lo: toNum(m[1]), hi: toNum(m[2]), unit: m[3].toUpperCase().replace(/S?$/, "S"), label: labelNear(text, m.index, m[0].length) };

  // Growth: "doubles every 7 years", "grows", "compound".
  m = text.match(new RegExp(String.raw`(?:more than\s+)?` + NUM + String.raw`\s+times\b`, "i"));
  if (m && toNum(m[1]) >= 2 && toNum(m[1]) <= 1000) return { type: "compare", mult: toNum(m[1]), label: labelNear(text, m.index, m[0].length) || `${m[1]}× MORE` };
  if (/\btwice as (?:much|many)\b/i.test(text)) return { type: "compare", mult: 2, label: "TWICE AS MUCH" };
  if (/\b(compound|grows?|growth|snowball)\b/i.test(text) && !/\bdebt\b/i.test(text)) return { type: "growth", every: 0, label: /compound/i.test(text) ? "COMPOUND GROWTH" : "GROWTH" };

  // Money (not an amount inside the title of a book or film: "One Thousand Ways to Make $1000").
  m = [...raw.matchAll(/(?:US)?\$\s?(\d[\d,]*(?:\.\d+)?)\s?(trillion|billion|million|thousand|[TBMK])?\b/gi)].find((x) => !inTitle(raw, x.index)) || null;
  if (m) {
    const mult = { trillion: 1e12, billion: 1e9, million: 1e6, thousand: 1e3, t: 1e12, b: 1e9, m: 1e6, k: 1e3 }[(m[2] || "").toLowerCase()] || 1;
    return { type: "money", value: toNum(m[1]) * mult, label: labelNear(raw, m.index, m[0].length) };
  }
  m = text.match(new RegExp(NUM + String.raw`\s+dollars?`, "i"));
  if (m) return { type: "money", value: toNum(m[1]), label: labelNear(text, m.index, m[0].length) };

  // A big number: "21 million bitcoin".
  m = text.match(new RegExp(NUM + String.raw`\s+(million|billion|trillion)\b`, "i"));
  if (m) {
    const mult = { million: 1e6, billion: 1e9, trillion: 1e12 }[m[2].toLowerCase()];
    return { type: "bignum", value: toNum(m[1]) * mult, prefix: "", suffix: "", label: labelNear(text, m.index, m[0].length) };
  }

  m = text.match(/\b(\d{7,})\b(?:\s+([a-z]+))?/i);           // 21000000 bitcoin
  if (m) return { type: "bignum", value: toNum(m[1]), prefix: "", suffix: "", label: (m[2] || "").toUpperCase() || null };

  // A year in history: "In 1637, …", "introduced in 1997".
  m = raw.match(/\b(1[5-9]\d\d|20[0-2]\d)\b/);
  // Not a year the line only measures against ("worst week since 2020", "the most since 1990"), nor this year or
  // one still to come: a history timeline would say something the line doesn't.
  const reference = m && (/\b(?:since|than|until|till)\s+(?:mid-|early\s+|late\s+)?$/i.test(raw.slice(0, m.index)) || Number(m[1]) >= new Date().getFullYear());   // this year's "timeline" would only say TODAY
  if (m && !reference && !/\b\d+\s*(?:percent|%)/i.test(text)) {
    // Label = the sentence's subject ("The Roth IRA was introduced in 1997" -> "ROTH IRA"),
    // or what follows the year when the sentence starts with it ("In 1637, tulip prices collapsed").
    return { type: "year", year: Number(m[1]), label: subjectOf(raw) || labelNear(raw, m.index, m[0].length) };
  }
  return null;
}

// Concept -> illustration. First match wins, so specific concepts come first.
// Terms match as whole words or phrases (plus plural); a trailing * matches as a prefix ("freelanc*").
const ICON_TERMS = [
  [["bitcoin", "crypto*", "blockchain", "ethereum", "stablecoin", "token"], "bitcoin", "CRYPTO"],
  [["credit card", "credit score", "credit report", "credit"], "card", "CREDIT"],
  [["insurance", "insured", "scam*", "fraud", "protect*", "security"], "shield", "PROTECTION"],
  [["tax", "taxes", "irs", "fee", "bill", "expense ratio"], "receipt", "COSTS"],
  [["emergency fund", "piggy", "saving", "savings", "save"], "piggy", "SAVINGS"],
  [["mortgage", "house", "home", "housing", "rent", "landlord", "property", "real estate"], "house", "HOUSING"],
  [["bank", "deposit", "fdic", "federal reserve", "central bank"], "bank", "BANKING"],
  [["crash", "recession", "loss", "decline", "bear market"], "chartDown", "DOWNTURN"],
  [["inflation", "price", "grocer*", "spending", "spend", "shopping"], "cart", "PRICES"],
  [["retire*", "patience", "long term", "time in the market", "decades"], "hourglass", "TIME"],
  [["student", "college", "tuition", "education", "learn*"], "cap", "EDUCATION"],
  [["job", "business", "freelanc*", "employer", "career", "company", "skill", "side hustle"], "briefcase", "WORK"],
  [["vs", "versus", "compare", "difference", "diversif*", "choice"], "scale", "COMPARE"],
  [["budget", "goal", "plan", "target", "bucket"], "target", "THE PLAN"],
  [["stock", "market", "invest*", "index fund", "fund", "etf", "return", "portfolio", "shares", "growth", "grow"], "chartUp", "INVESTING"],
  [["dividend", "interest", "money", "cash", "income", "pay", "payment", "paycheck", "salary", "wealth", "rich", "debt", "loan"], "coins", "MONEY"],
  [["month", "monthly", "annual", "schedule", "automat*", "due date", "every week"], "calendar", "EVERY MONTH"],
];
const ICONS = ICON_TERMS.map(([terms, icon, label]) => {
  const alt = terms.map((w) => w.endsWith("*") ? w.slice(0, -1) + "\\w*" : w.replace(/\s+/g, "\\s+") + "(?:s|es)?");
  return [new RegExp("\\b(?:" + alt.join("|") + ")\\b"), icon, label];
});

export function iconFor(text) {
  const low = text.toLowerCase().replace(/take[- ]home pay/g, "paycheck");   // not a house
  for (const [re, icon, label] of ICONS) if (re.test(low)) return { icon, label };
  return null;
}

export function analyzeLine(text) {
  const stat = statOf(text);
  const ic = iconFor(text);
  return { stat, icon: ic?.icon || null, label: ic?.label || null };
}

export function describeStat(s) {
  if (!s) return "";
  switch (s.type) {
    case "percent": return `${fmt(s.value)}% chart`;
    case "move": return `${s.dir > 0 ? "▲" : "▼"} ${fmt(s.value)}% move`;
    case "split": return `${s.title} split`;
    case "range": return `${s.lo}–${s.hi} ${s.unit.toLowerCase()} timeline`;
    case "growth": return s.every ? `doubling every ${s.every} years` : "growth curve";
    case "compare": return `${s.mult}× comparison`;
    case "money": return "$" + fmt(s.value) + " counter";
    case "bignum": return `${fmt(s.value)} counter`;
    case "year": return `${s.year} timeline`;
    default: return s.type;
  }
}
