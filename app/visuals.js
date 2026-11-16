// Works out what a line of the script can show, so the picture matches what's being said.
//   analyzeLine(text) -> { stat: {...} | null, icon: "piggy" | ... | null, label: "EMERGENCY FUND" | null }
// "stat" describes a data graphic built from the line's own numbers (see graphics.js);
// "icon" is the illustration that fits the line's concept.
import { wordsToDigits } from "./script.js";

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
function labelNear(text, index, length, max = 3, prefer = "after") {
  const clean = (s) => s.toLowerCase().replace(/[^a-z0-9 '&-]/g, " ").split(/\s+/).filter(Boolean);
  const after = phrase(clean(text.slice(index + length).replace(/^[\s,.;:]+/, "").split(/[,.;:!?(]/)[0]), max);
  const before = phrase(clean(text.slice(0, index).split(/[,.;:!?]/).pop()).reverse(), max).reverse();
  // When the clause ends right after the number ("above 50 percent, that's…"), the words before it name it.
  if (/^\s*[,;:]/.test(text.slice(index + length))) prefer = "before";
  const words = prefer === "before" ? (before.length ? before : after) : (after.length ? after : before);
  return words.join(" ").toUpperCase().trim() || null;
}

function statOf(raw) {
  const text = wordsToDigits(raw).replace(/(\d)\s*%/g, "$1 percent");
  let m;

  // Growth first: "doubles every 7 years" is the story even when a rate is mentioned too.
  m = text.match(new RegExp(String.raw`doubl\w*\s+(?:about\s+|roughly\s+)?every\s+` + NUM + String.raw`\s+years?`, "i"));
  if (m) return { type: "growth", every: toNum(m[1]), label: `DOUBLES EVERY ${m[1]} YEARS` };

  // Several percentages in one breath: a split (50/30/20).
  const pcts = [...text.matchAll(new RegExp(NUM + String.raw`\s+percent`, "gi"))];
  m = raw.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{1,2})\b/);
  if (m) return { type: "split", parts: [m[1], m[2], m[3]].map(Number), labels: ["NEEDS", "WANTS", "SAVINGS"], title: `${m[1]}/${m[2]}/${m[3]}` };
  if (pcts.length >= 2) {
    const parts = pcts.slice(0, 4).map((p) => toNum(p[1]));
    if (parts.every((p) => p > 0 && p <= 100) && parts.reduce((a, b) => a + b, 0) <= 100.5)
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

  // Money.
  m = raw.match(/(?:US)?\$\s?(\d[\d,]*(?:\.\d+)?)\s?(trillion|billion|million|thousand|[TBMK])?\b/i);
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
  if (m && !/\b\d+\s*(?:percent|%)/i.test(text)) {
    // Label = the sentence's subject ("The Roth IRA was introduced in 1997" -> "ROTH IRA"),
    // or what follows the year when the sentence starts with it ("In 1637, tulip prices collapsed").
    const subject = phrase(raw.toLowerCase().replace(/[^a-z0-9 '&-]/g, " ").split(/\s+/).filter(Boolean), 3).join(" ").toUpperCase();
    return { type: "year", year: Number(m[1]), label: subject || labelNear(raw, m.index, m[0].length) };
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
