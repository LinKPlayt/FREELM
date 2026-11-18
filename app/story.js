// The storyteller: turns a pile of researched sentences into a video that makes sense from start
// to finish. Every script type passes through here.
//
//   A good short explainer answers, in this order:
//     1. what is it?            one plain definition (never two)
//     2. how does it work?      the sentence that follows from the definition
//     3. a number or example    if the research has one
//     4. why should I care?     how it touches the viewer ("Why it matters: …")
//     5. what do I do?          one practical takeaway ("The takeaway: …")
//
// Nothing here invents facts. Sentences are chosen, ordered, shortened (never reworded) and given
// spoken lead-ins; a line's `claim` keeps the original fact for the fact check.

/* ---------------------------------------------------------------- practical takeaways */
// Safe, general steps. {t} is the topic. No specific products, numbers or promises.
export const ADVICE = {
  "personal finance": ["Set up one automatic transfer to savings, even a small one, so saving happens without thinking.", "Before you decide anything about {t}, compare at least two options side by side."],
  investing: ["Check the fees on anything you invest in; they quietly eat your returns.", "Think in years, not days: decide how long you'd hold before you invest a dollar."],
  crypto: ["Never put in more than you could afford to lose completely.", "Use well-known platforms, turn on two-factor login, and never share your recovery phrase."],
  economy: ["Watch how {t} shows up in your own prices, rates and paycheck, not just the headlines.", "Keep an emergency fund so changes in the economy don't force you into debt."],
  "side hustles": ["Start {t} small this week and track every dollar in and out.", "Set aside part of what you earn for taxes before you spend any of it."],
  "real estate": ["Compare offers from at least three lenders; small rate differences add up over the years.", "Budget for taxes, insurance and repairs too, not just the monthly payment."],
};
// Tips for common subjects, matched against the topic name first (more specific than the niche).
export const TOPIC_ADVICE = [
  [/emergency fund|rainy day/i, ["Start with one month of expenses in a separate savings account, then build toward three to six.", "Keep it somewhere easy to reach, not in investments that can drop when you need the cash."]],
  [/dividend/i, ["Don't chase the highest yield; check that the company can keep paying it.", "Reinvesting dividends automatically lets them compound over time."]],
  [/federal reserve|central bank|monetary policy|interest rates?\b|fed funds|federal funds/i, ["When rates change, check what your savings account pays and what your loans cost.", "If you have variable-rate debt, ask what a rate rise would add to your payment."]],
  [/\brent|landlord|tenant|lease/i, ["Before you sign a lease, read how and when the rent can go up.", "Know your local tenant rules; they vary a lot from place to place."]],
  [/index fund|etf|exchange-traded|mutual fund/i, ["Compare expense ratios before you buy; a small difference in fees compounds over decades.", "Pick a broad fund you can hold for years, and add to it on a schedule."]],
  [/recession|unemploy|layoff/i, ["Build an emergency fund of a few months' expenses before you need it.", "Keep your skills and your network fresh; they're your best insurance in a downturn."]],
  [/credit (score|report|rating)|fico/i, ["Pay every bill on time; payment history counts the most in most credit scores.", "Keep card balances low compared with your limits, and check your credit reports for mistakes."]],
  [/mortgage|home loan|refinanc/i, ["Compare offers from at least three lenders; small rate differences add up over the years.", "Budget for taxes, insurance and repairs too, not just the monthly payment."]],
  [/credit card|debt|loan|interest rate|apr\b/i, ["Pay more than the minimum when you can; interest builds on whatever you leave unpaid.", "Before you borrow, compare the total cost, not just the monthly payment."]],
  [/\broth\b/i, ["Check the income limits and the yearly contribution limit before you put money in.", "Leave the money to grow; the big benefit is tax-free withdrawals in retirement."]],
  [/401|ira\b|roth|retire|pension/i, ["If your employer offers a match, contribute at least enough to get all of it.", "Check the fund fees in your plan; low-cost index funds keep more of your returns."]],
  [/stock|share|fund|etf|index|bond|dividend|portfolio|invest/i, ["Before you buy, check the fees; they quietly eat your returns over time.", "Spread your money across many holdings so one bad pick can't sink you."]],
  [/inflation|deflation|cost of living|prices/i, ["Check whether your savings rate beats inflation; if it doesn't, your money is quietly shrinking.", "When prices rise, ask for a raise or shop your bills around; small wins add up."]],
  [/drop ?shipping|e-?commerce|online (store|business)|freelanc|side (hustle|job)|gig/i, ["Start small and test one product or service before you spend real money.", "Track every dollar in and out, and set money aside for taxes."]],
  [/tax/i, ["Keep records of income and expenses all year, not just at tax time.", "Check which deductions and credits you qualify for before you file."]],
  [/insur/i, ["Compare quotes every year; loyalty rarely gets you the best price.", "Read what's excluded, not just what's covered, before you buy."]],
  [/budget|saving|emergency fund|frugal|spend/i, ["Set up one automatic transfer to savings, even a small one.", "Track your spending for one month; most people find money they didn't know they were losing."]],
  [/bitcoin|crypto|coin|token|blockchain|nft|defi/i, ["Never put in more than you could afford to lose completely.", "Use well-known platforms, turn on two-factor login, and never share your recovery phrase."]],
];
export const ADVICE_ANY = ["Before you decide anything about {t}, compare at least two options side by side.", "Read the fine print and the fees on any {t} offer before you sign."];

// Practical tips for a topic: its own subject's tips first, then the niche's, then general ones.
export function adviceFor(topic, niche) {
  const name = /^[A-Z]{2}/.test(topic) || /^[A-Z][a-z]+ [A-Z]/.test(topic) ? topic : topic.replace(/^./, (c) => c.toLowerCase());
  const byTopic = TOPIC_ADVICE.find(([re]) => re.test(topic))?.[1] || [];
  return [...new Set([...byTopic, ...(ADVICE[niche] || []), ...ADVICE_ANY].map((x) => x.replaceAll("{t}", name)))];
}

/* ---------------------------------------------------------------- reading a sentence */
const words = (t) => t.trim().split(/\s+/).filter(Boolean);
const key = (t) => new Set((t.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2));
// Two lines that share most of their words say the same thing.
export function sameIdea(a, b, threshold = 0.6) {
  const A = key(a), B = key(b);
  if (!A.size || !B.size) return false;
  let n = 0; for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size) > threshold;
}
const topicRe = (topic) => {
  const base = topic.replace(/\s+\(.*\)$/, "");
  let alt = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").split(/\s+/).join("[\\s-]+") + "(?:s|es|ing)?";
  // A one-word topic for a person or role also matches its word family ("Freelancer" -> "freelance work").
  if (/^[a-z]{6,}(?:er|or|ist)$/i.test(base)) alt += "|" + base.replace(/(?:er|or|ist)$/i, "") + "\\w*";
  return new RegExp("\\b(?:" + alt + ")\\b", "i");
};

const PRONOUN_START = /^(It|This|These|They|Their|Its|That|Those|Such|He|She|Instead|However|Also|Moreover|Furthermore|Thus|Therefore|Hence|As a result|In addition|For example|For instance)\b,?\s*/;
const ADVICE_START = /^(?:(?:at minimum|first|then|next|instead|so|and|but|finally),?\s+)?(start|keep|set|pay|use|try|automate|avoid|don't|do not|never|always|check|compare|aim|pick|look|save|invest|build|before you|think|watch|budget|read|decide|ask|track|spread|make|stop|get|open|treat|contribute|choose|consider|split)\b(?!-)(?!\s+(?:is|are|was|were|has|have|had|of|and|or)\b)/i;
const WHY = /\b(lenders?|banks?|investors?|consumers?|borrowers?|savers?|buyers?|employers?|workers?|households?|people|customers?|individuals?|businesses|companies|governments?|you|your)\b[^.]{0,60}\b(use[sd]?|affects?|determines?|decides?|depends?|matters?|helps?|allows?|lets?|rely|relies|qualif\w+|pays?|saves?|earns?|loses?|gains?|benefits?)\b(?! be\b)|\b(important|so that|in order to|the purpose|advantage|key role|widely used|is used to|are used to)\b/i;
const RISK_STRONG = /\b(criticis\w*|fraud\w*|collapse\w*|crash\w*|scams?|danger\w*|downside|bankrupt\w*|warn\w*|disadvantage\w*|drawback\w*|limited control|failed|failure)\b/i;
const RISK = /\b(risks?|risky|volatil\w*)\b/i;
// A figure worth showing: a percentage, an amount of money or a big number (a bare year isn't one).
const HAS_NUMBER = /\d\s?%|\bpercent\b|[$€£]\s?\d|\b\d[\d,.]*\s?(million|billion|trillion|thousand)\b|\b(half|double[sd]?|twice|triple[sd]?)\b/i;
const HAS_YEAR = /\b(1[5-9]\d\d|20\d\d)\b/;
// "…as of October 2018" is old news by now: figures with a date more than a few years back are skipped.
function stale(text) {
  const m = text.match(/\b(?:as of|as at|since|in early|in late|by the end of)\s+(?:\d{1,2}\s+)?(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+)?(?:\d{1,2},\s+)?(20\d\d)\b/i);
  return Boolean(m) && /\b(is|are|has|have|remains?|stands?|own|owns|holds?)\b/.test(text) && Number(m[1]) < new Date().getFullYear() - 3;
}
// The topic, or the word people actually say for it ("Buffett", "mortgage").
function mentions(text, topic) {
  if (topicRe(topic).test(text)) return true;
  const w = topic.replace(/\s+\(.*\)$/, "").split(/\s+/);
  const last = w.at(-1), first = w[0];
  return [last, first].some((x) => x && x.length >= 5 && new RegExp("\\b" + x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:s|es|'s)?\\b", "i").test(text));
}
// Facts that only apply somewhere specific (or to one company) don't belong in a general explainer.
const LOCAL = /\b(CIBIL|India|Indian|rupees?|Aadhaar|Pakistan|Nigeria|Kenya|Philippines|Bangladesh|Sri Lanka|Malaysia|Brazil|Russia|Turkey|Iran|Indonesia|Vietnam|Thailand|Poland|Sweden|Norway|Denmark|Finland|Austria|Belgium|Netherlands|Dutch|Swiss|Switzerland|Israel|Egypt|South Africa|Hong Kong|Singapore|New Zealand|Ireland|Scotland|Wales|Quebec|Ontario|New Jersey|Texas|Florida|Ohio|Utah|Australia|Australian|HECS|Canada|Canadian|Germany|German|France|French|Japan|Japanese|Italy|Italian|Spain|Spanish|Mexico|Mexican|Korea|Korean|Saudi|Argentina|Chile|Colombia|Peru|England|English law|Northern Ireland)\b/;
// A Wikipedia section named after a place ("Student loan — Australia") is local detail too.
const localSection = (source, topic) => { const m = /\s—\s(.+)$/.exec(source || ""); return Boolean(m && (LOCAL.test(m[1]) || /^(United Kingdom|UK|China|Europe|European Union|Asia|Africa|By country|Other countries|International)$/i.test(m[1])) && !LOCAL.test(topic)); };
const JARGON = /\b(depository institutions?|uncollateralized|numerical expression|herein|thereof|hereinafter|pursuant|consideration in the form|can also be described as|is defined (in|by|under) (section|subsection|article)|subsection|\bibid\b|et al|jurisdictions?|aforementioned|vis-à-vis|inter alia|de facto|de jure)\b/i;
const META = /\b(this article|see also|the term (is|was) (also )?(used|coined)|etymolog|is derived from|comes from the (latin|greek|french)|disambiguation|may refer to)\b/i;

// "A credit score is a number that…" defines the topic; "A credit score is primarily based on…" doesn't.
export function isDefinition(text, topic) {
  const head = words(text).slice(0, 14).join(" ");
  const m = topicRe(topic).exec(head);
  if (!m || ADVICE_START.test(text)) return false;
  return /^[^.;:]{0,45}?\s+(?:(?:is|are|was|were) (?:(?:a|an|the)\s+)?(?:(?:common|general|broad|informal|technical|popular|legal)\s+)?(?:a|an|the|any|one|when|what|how|money|digital|terms?|names?|words?)\b|means\b|refers to\b|describes\b)/.test(head.slice(m.index + m[0].length));
}
export const isAdvice = (t) => ADVICE_START.test(t) || /\byou (should|can|could|need)\b/i.test(t);

// What a sentence does in the story.
export function roleOf(text, topic) {
  if (isAdvice(text)) return "takeaway";
  if (isDefinition(text, topic)) return "definition";
  if (RISK_STRONG.test(text)) return "risk";
  if (WHY.test(text)) return "why";
  if (RISK.test(text)) return "risk";
  if (HAS_NUMBER.test(text)) return "number";
  if (HAS_YEAR.test(text)) return "history";
  return "how";
}

// Is this sentence fit for a general-audience video about `topic`?
export function fits(text, topic) {
  const n = words(text).length;
  if (n < 5 || n > 44) return false;
  if (JARGON.test(text) || META.test(text) || stale(text)) return false;
  if (/\b(however|nevertheless|nonetheless|on the other hand|the latter|the former|respectively)\b/i.test(text)) return false;   // leans on a sentence we may not have
  if (/^(While|Although|Though|Despite|Whereas|Besides|Regarding|Conversely|Similarly|Likewise|Additionally|Meanwhile|Subsequently|Consequently|In contrast,|By contrast,|In response|As such|In this|In that|In these|Under this|Under these)\b/.test(text)) return false;
  if ((text.match(/,/g) || []).length > 4 || /:\s+\S/.test(text.replace(/^[^:]{0,25}:\s/, ""))) return false;      // lists and "X: a, b, c"
  if (/\b(U\.S|U\.K|U\.N|E\.U|Inc|Corp|Co|Ltd|vs|e\.g|i\.e|No|St|Mr|Mrs|Dr|approx)\.$/.test(text.trim())) return false;   // cut off at an abbreviation
  if (LOCAL.test(text) && !LOCAL.test(topic)) return false;
  if (/["“”]/.test(text) && (text.match(/["“”]/g) || []).length >= 2 && /described|defined|termed|so-called/i.test(text)) return false;   // quoted legal definitions
  if (!/[.!?]$/.test(text.trim())) return false;
  if (/""|“”|\(\s*\)|\s,|\s\./.test(text)) return false;                     // words went missing when the source was cleaned
  if (/^(An exception|Another|Other|The same|The second|The third|The first of|In English|Examples?|Here)\b/.test(text)) return false;   // needs the sentence before it
  // A real sentence has a verb ("Large Company Indexes to 0.70% for Emerging Market Indexes." doesn't).
  if (!/\b(is|are|was|were|be|been|has|have|had|can|could|may|might|will|would|should|must|does|do|did)\b/i.test(text) && !/\b[a-z]{3,}(ed|es|s)\b/.test(text.replace(/^\S+\s/, ""))) return false;
  return true;
}

/* ---------------------------------------------------------------- saying it simply */
// Shortens a sentence for speech without rewording it: drops asides and trailing sub-clauses so one
// idea is said per line. Words are only removed, never added, so the fact check still matches the source.
export function simplify(text, max = 22) {
  let t = text.replace(/\s+/g, " ").trim();
  t = t.replace(/^In (economics|finance|accounting|business|banking|law|investing|macroeconomics|microeconomics|personal finance|real estate|the United States|the U\.S\.),\s+/i, "")
    .replace(/^([A-Z][^,]{2,60}),\s+(?:also|sometimes|often|commonly|formerly|better)?\s*(?:known|called|referred to|abbreviated|spelled) (?:as )?[^,]{2,60},\s+(is|are|was|were|refers|means)\b/, "$1 $2")
    .replace(/[,;]\s+(?:i\.e\.,?|that is,?|in other words,?)\s+[^,;.]{3,80}(?=[,;.])/g, "")
    .replace(/\s*\((?![a-z]\))[^()]{0,80}\)/g, "");
  t = t.replace(/^./, (c) => c.toUpperCase());
  if (words(t).length <= max) return t;
  t = t.replace(/\s+so that (?:it|they|he|she|the|a|an)\b[^.;]*(?=[.;])/, "");          // "...rules so that it can replicate..." -> "...rules."
  if (words(t).length <= max) return t;
  // Too long: cut at the last clause boundary that still leaves a full thought of 8+ words.
  const cuts = [...t.matchAll(/,\s+(?:which|while|whereas|although|though|including|such as|especially|particularly|typically|usually|often|provided|assuming|unless|and (?:is|are|was|were|has|have|it|they|this)|but|so that|as well as|resulting in|making|allowing|depending|either|to represent|in order to)\b|;\s+|\s+—\s+|:\s+(?=[a-z])/g)].map((m) => m.index);
  for (const at of cuts.reverse()) {
    const head = t.slice(0, at).trim();
    const n = words(head).length;
    if (n >= 8 && n <= max + 4 && !/\b(and|or|the|a|an|of|to|in|for|with|by|as|is|are)$/i.test(head)) return head.replace(/[,;:]$/, "") + ".";
  }
  return t;
}

// A sentence that leans on the one before it ("It avoids…", "This increase…") stands on its own again
// when its opening pronoun is replaced by the topic; otherwise it's only usable right after its neighbour.
export function standAlone(text, topic, { plural = false, person = false } = {}) {
  // A person: "He is…" -> "Buffett is…" (their surname).
  if (person && /^(He|She) (?=[a-z])/.test(text)) return text.replace(/^(He|She) /, topic.replace(/\s+\(.*\)$/, "").split(/\s+/).at(-1) + " ");
  const m = text.match(/^(It|They) (?=[a-z])/);
  if (m) {
    const name = /^[A-Z]{2}/.test(topic) ? topic : topic.replace(/^./, (c) => c.toUpperCase());
    return text.replace(/^(It|They) /, name + " ").replace(new RegExp("^" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " (are|have|were) "), (x, v) => `${name} ${plural ? v : { are: "is", have: "has", were: "was" }[v]} `);
  }
  return PRONOUN_START.test(text) ? null : text;
}

/* ---------------------------------------------------------------- composing */
const LEADS = { why: "Why it matters:", risk: "The catch:", number: "By the numbers:", takeaway: "The takeaway:" };
// After a lead-in, an ordinary opening word goes lower case ("The catch: the seller…"); names stay.
const SOFT = /^(The|A|An|It|Its|They|Their|This|These|Many|Most|Some|In|On|At|When|If|As|For|With|There|Each|Every|One|People|Lenders|Banks|Investors|Borrowers|Sellers|Buyers|Companies|Businesses)\b/;
const withLead = (role, text) => (LEADS[role] ? `${LEADS[role]} ${role !== "takeaway" && SOFT.test(text) ? text[0].toLowerCase() + text.slice(1) : text}` : text);

// Builds the body of an explainer about `topic` from candidate sentences (in source order).
// Returns [{ text, claim, role, source, tip }] : definition, how, number, why/risk, takeaway.
export function composeStory(topic, niche, candidates, { max = 5, takeaway = true, person = false } = {}) {
  const pool = [];
  candidates.forEach((c, i) => {
    const raw = typeof c === "string" ? c : c.text;
    if (!raw || !fits(raw, topic)) return;
    if (typeof c !== "string" && localSection(c.source, topic)) return;
    const text = simplify(raw);
    if (words(text).length > 30) return;
    const prev = i > 0 ? (typeof candidates[i - 1] === "string" ? candidates[i - 1] : candidates[i - 1].text) : null;
    // On topic = names the topic in its first half (a mention in passing at the end doesn't count).
    const at = text.search(topicRe(topic));
    const onTopic = at >= 0 ? at <= text.length * 0.66 : mentions(text.slice(0, Math.ceil(text.length * 0.66)), topic);
    // A fact from another article must name the topic right at its start.
    pool.push({ raw, text, i, role: roleOf(text, topic), source: c.source || null, prev: c.other ? null : prev, other: Boolean(c.other),
      // A side section's sentence must open on the topic too ("For privates, the credit scoring…" is about something else).
      onTopic: c.other ? at >= 0 && at <= 4 : /\s—\s/.test(c.source || "") ? at >= 0 && at <= text.length * 0.25 : onTopic });       // "A stablecoin…", not "The Jazz Musicians' Emergency Fund…"
  });
  const used = [], out = [];
  // Two "why" lines that both open "Lenders use credit scores…" say the same thing twice.
  const lead = (t) => (t.toLowerCase().match(/^(?:an?\s+|the\s+)?([a-z']+)/) || [])[1];
  const echo = (u, p) => u.role === p.role && ["why", "risk", "how"].includes(p.role) && lead(u.text) === lead(p.text);
  const fresh = (p) => !used.includes(p) && !used.some((u) => sameIdea(u.text, p.text) || (out.some((o) => o.raw === u.raw) && echo(u, p)));
  const take = (p, role = p.role, lead = true) => {
    let text = p.text;
    // A sentence opening with a pronoun is fine right after the sentence it came after; otherwise it must stand alone.
    const follows = out.length && p.prev && out.at(-1).raw === p.prev;
    if (!follows) {
      // "some of these episodes…", "such loans…" point at a sentence that isn't here.
      if (/\b(these|those|such)\s+[a-z]+|\bthe (above|following|same)\b|^the (first|second|third|last|former|latter|two|three|four|remaining|other|aforementioned)\b/i.test(text)) { used.push(p); return false; }
      text = standAlone(text, topic, { person }); if (!text) { used.push(p); return false; }
    }
    used.push(p);
    out.push({ raw: p.raw, text: lead && out.length > 1 ? withLead(role, text) : text, claim: text, role, source: p.source });
    return true;
  };
  // A sentence belongs if it names the topic, or directly continues the sentence we just used.
  const DEPENDS = /^(It|This|These|They|Their|Its|That|Those|Such|Instead)\b/;
  const usable = (p) => fresh(p) && (p.onTopic || (out.length && p.prev === out.at(-1).raw && DEPENDS.test(p.text)));
  const first = (role) => pool.find((p) => p.role === role && usable(p));

  // 1. What it is: the source's own opening definition (the next one only if that's a mouthful).
  // Prefer one where the topic itself is the subject ("A credit score is…", not "A business credit score is…"),
  // and the main article's over a section's.
  // ...or is one item in a list of names before the verb ("Freelance, freelancer, and freelance worker are…").
  const subject = (p) => {
    if (new RegExp("^(?:an?|the)?\\s*(?:" + topicRe(topic).source + ")", "i").test(p.text)) return 0;
    const head = (p.text.match(/^(.{3,80}?)\s+(?:is|are|was|were)\s/) || [])[1] || "";
    return head && head.split(/,\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+/).some((x) => new RegExp("^(?:an?|the)?\\s*(?:" + topicRe(topic).source + ")$", "i").test(x.trim())) ? 0 : 1;
  };
  const inSection = (p) => (/\s—\s/.test(p.source || "") || p.other ? 1 : 0);
  const defs = pool.filter((p) => p.role === "definition" && (person || !subject(p))).sort((x, y) => subject(x) - subject(y) || inSection(x) - inSection(y) || x.i - y.i).slice(0, 3);
  let def = defs.find((d) => words(d.text).length <= 26) || defs[0];
  // A person's article opens with their full name ("Warren Edward Buffett is an American…").
  if (person && (!def || def.i > 1)) def = pool.find((p) => p.i <= 1 && /\b(is|was) an?\b/.test(words(p.text).slice(0, 12).join(" "))) || def;
  if (def) take(def);

  if (person) {
    // A person: who they are, then what they did, in time order. No "why it matters" labels.
    const rest = pool.filter((p) => fresh(p) && (p.onTopic || /^(He|She) /.test(p.text)) && p.role !== "definition" && !/\b(was born|grew up|his (father|mother|parents)|her (father|mother|parents)|married|divorced|paper route|pinball|high school)\b/i.test(p.text) && standAlone(p.text, topic, { person }))
      .sort((a, b) => (Number((a.text.match(HAS_YEAR) || [9999])[0]) - Number((b.text.match(HAS_YEAR) || [9999])[0])) || a.i - b.i);
    // What they're known for first, then figures, then dated events.
    const KNOWN = /\b(known (for|as)|chairman|chief executive|CEO|founded|co-founded|founder|richest|wealthiest|net worth|largest|pledged|philanthrop\w*|billion|nicknamed|regarded|considered|famous|won|awarded)\b/i;
    // What they're known for comes straight after who they are; then dated events in time order.
    const ok = rest.filter((p) => !/\bas of\b|mark-to-market|put options|forward contracts/i.test(p.text));
    const known = ok.filter((p) => KNOWN.test(p.text)).slice(0, 2);
    const year = (p) => Number((p.text.match(HAS_YEAR) || [9999])[0]);
    const events = ok.filter((p) => !known.includes(p) && (HAS_NUMBER.test(p.text) || HAS_YEAR.test(p.text))).sort((a, b) => year(a) - year(b) || a.i - b.i);
    const others = ok.filter((p) => !known.includes(p) && !events.includes(p));
    for (const p of [...known, ...events, ...others]) { if (out.length >= max) break; if (fresh(p)) take(p, "how", false); }
    // Keep the dated part in time order.
    const datedAt = out.map((l, k) => (k > known.length && HAS_YEAR.test(l.text) ? k : -1)).filter((k) => k >= 0);
    const dated = datedAt.map((k) => out[k]).sort((a, b) => Number((a.text.match(HAS_YEAR) || [9999])[0]) - Number((b.text.match(HAS_YEAR) || [9999])[0]));
    datedAt.forEach((k, j) => { out[k] = dated[j]; });
  } else {
    // 2. How it works: what the source says right after the definition, else the first "how" sentence.
    const next = def && pool.find((p) => p.i === def.i + 1 && !p.other && fresh(p) && !["definition", "takeaway", "history"].includes(p.role));
    const how = next || first("how");
    if (how) take(how, "how");
    // ...and one more step if it directly continues that thought.
    const cont = how && pool.find((p) => p.prev === how.raw && fresh(p) && p.role === "how" && PRONOUN_START.test(p.text));
    if (cont && out.length < max - 2) take(cont, "how");
    // 3. A number about the topic, if the research has one.
    const num = first("number");
    if (num && out.length < max - 1) take(num);
    // 4. Why it matters to the viewer, and/or the catch.
    const why = first("why");
    if (why && out.length < max - (takeaway ? 1 : 0)) take(why);
    const risk = first("risk");
    if (risk && out.length < max - (takeaway ? 1 : 0)) take(risk);
    // Still thin? More of how it works, placed before the why/catch lines.
    for (const more of pool) {
      if (out.length >= Math.min(max - (takeaway ? 1 : 0), 3)) break;
      if (!usable(more) || ["takeaway", "definition", "history"].includes(more.role)) continue;
      const at = out.findIndex((l) => l.role === "why" || l.role === "risk" || l.role === "number");
      const before = out.length;
      if (take(more, "how") && at >= 0 && out.length > before) out.splice(at, 0, out.pop());
    }
    // 5. What to do about it.
    if (takeaway) {
      const tip = adviceFor(topic.replace(/\s+\(.*\)$/, ""), niche)[0];
      if (tip) out.push({ text: withLead("takeaway", tip), claim: null, role: "takeaway", source: null, tip: true });
    }
  }
  // Spares from a side section must be about the topic itself, not mention it in passing ("For privates, the credit scoring…").
  const leftovers = pool.filter((p) => fresh(p) && p.onTopic && (!inSection(p) || !subject(p)) && !["definition", "history"].includes(p.role) && standAlone(p.text, topic))
    .map((p) => ({ text: standAlone(p.text, topic), claim: standAlone(p.text, topic), role: p.role, source: p.source }));
  return { lines: out, leftovers };
}

/* ---------------------------------------------------------------- polishing any script */
// The last pass over every script before it's shown: removes lines that repeat an earlier one, drops a
// second definition, moves a late definition up to where it belongs, and shortens rambling sentences.
// Returns what it changed (for the tests).
export function polish(script) {
  const topic = (script.topicTitle || script.title || "").replace(/\s*#Shorts$/, "");
  const changed = { removed: 0, moved: 0, shortened: 0 };
  const isContent = (l) => l.kind === "media";
  // Shorten researched sentences (hand-written lines are already short).
  for (const l of script.lines) {
    if (!isContent(l) || !l.source || l.claim) continue;
    const s = simplify(l.text);
    if (s !== l.text) { l.claim = s; l.text = s; l.analysis = null; changed.shortened++; }
  }
  // Repeats: keep the first of any two lines that say the same thing (never the hook or the ending).
  const kept = [];
  script.lines = script.lines.filter((l, i) => {
    if (!isContent(l) || i === 0) return true;
    if (kept.some((k) => sameIdea(k, l.claim || l.text, 0.7))) { changed.removed++; return false; }
    kept.push(l.claim || l.text);
    return true;
  });
  if (!script.deep && topic) {
    // One definition, straight after the hook.
    const idx = script.lines.map((l, i) => (i > 0 && isContent(l) && isDefinition(l.claim || l.text, topic) ? i : -1)).filter((i) => i >= 0);
    for (const i of idx.slice(1).reverse()) { script.lines.splice(i, 1); changed.removed++; }
    if (idx[0] > 1 && script.lines[idx[0]].source) {
      // A researched definition that arrives after the idea was already explained adds nothing: drop it
      // if an earlier line already says what the topic is in plain words; otherwise move it up.
      const explained = script.lines.slice(1, idx[0]).some((l) => isContent(l) && !l.source && (isDefinition(l.text, topic) || /\b(means|stands for|is when|refers to)\b/.test(words(l.text).slice(0, 9).join(" "))));
      const [d] = script.lines.splice(idx[0], 1);
      if (explained) changed.removed++; else { script.lines.splice(1, 0, d); changed.moved++; }
    }
  }
  script.extras = (script.extras || []).filter((e) => !isContent(e) || (!script.lines.some((l) => isContent(l) && sameIdea(l.claim || l.text, e.text, 0.7))
    && !(topic && !script.deep && isDefinition(e.text, topic) && script.lines.some((l, i) => i > 0 && isContent(l) && (isDefinition(l.claim || l.text, topic) || /\b(means|stands for|is when)\b/.test(l.text))))));
  return changed;
}

// Where a spare line belongs when a short video needs one more: a definition goes right after the
// hook; anything else goes before the closing thought (the last content line), not after it.
export function insertIndex(script, extra) {
  const topic = (script.topicTitle || script.title || "").replace(/\s*#Shorts$/, "");
  if (topic && isDefinition(extra.text, topic)) return 1;
  let at = script.lines.length - 1;
  while (at > 1 && (["recap", "outro"].includes(script.lines[at - 1].kind) || script.lines[at - 1].question)) at--;
  const last = script.lines[at - 1];
  // Keep a takeaway, tip or closing reminder last.
  if (at > 2 && last && last.kind === "media" && (last.tip || isAdvice((last.claim || last.text).replace(/^[^:]{3,22}:\s+/, "")) || /^(remember|the takeaway|bottom line|so\b|that's why|why it matters|here's why it matters)/i.test(last.text))) at--;
  // ...and the "Bottom line" that leads into it.
  if (at > 2 && script.lines[at - 1]?.stance) at--;
  return at;
}

/* ---------------------------------------------------------------- headlines */
// A headline as a sentence someone can say: no "Analysis:" labels, no ticker lists, cut at a clause.
export function cleanHeadline(title, maxWords = 18) {
  let t = title.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
  t = t.replace(/\s*[|–-]\s*(CNBC|MarketWatch|Reuters|Bloomberg(\.com)?|Yahoo Finance( UK)?|Forbes|WSJ|The Wall Street Journal|Barron's|Fortune|AP News|BBC( News)?|CNN( Business)?|Fox Business|Investopedia|Business Insider|Financial Times)\s*$/i, "");
  t = t.replace(/^(Analysis|Opinion|Exclusive|Watch|Live|Breaking|Explainer|Column|Factbox|Commentary|Update|Updated|Video|Podcast|Newsletter|Morning Bid|Stock Market Today|Markets Wrap|Insight|Focus|Review|Interview)\s*[:|–-]\s+/i, "");
  t = t.replace(/\s*[:(]\s*\(?(?:NYSE|NASDAQ)?:?\s*[A-Z]{2,5}(?:,\s*[A-Z]{2,5})*\)?\s*$/, "");
  t = t.replace(/:\s+(?:[A-Z][\w&'.]*(?: [A-Z][\w&'.]*){0,2})(?:,\s+(?:[A-Z][\w&'.]*(?: [A-Z][\w&'.]*){0,2})){1,5}\s*$/, "");   // ": Dow Jones, S&P, Nasdaq"
  const w = t.split(" ");
  if (w.length > maxWords) {
    const head = w.slice(0, maxWords).join(" ");
    const cut = Math.max(head.lastIndexOf(", "), head.lastIndexOf(" - "), head.lastIndexOf(": "), head.lastIndexOf(" as "), head.lastIndexOf(" after "), head.lastIndexOf(" amid "));
    t = (cut > head.length * 0.45 ? head.slice(0, cut) : head).replace(/[,;:\s-]+$/, "").replace(/\s+(and|or|the|a|an|of|to|in|for|with|by|as|on|at)$/i, "");
  }
  t = t.replace(/[ .]+$/, "");
  return t.replace(/^./, (c) => c.toUpperCase()) + (/[?!]$/.test(t) ? "" : ".");
}

// What a set of headlines has in common, and what it means for the viewer.
const THEMES = [
  ["interest rates", /\b(fed|federal reserve|powell|rate cut|rate hike|interest rates?|central bank|tightening|hawkish|dovish|treasury yields?)\b/i,
    (t) => (/cut|lower|dovish|easing/i.test(t) && !/hike|tighten|hawkish|raise/i.test(t) ? "Lower rates can make borrowing cheaper, but savings accounts usually pay less too."
      : /hike|tighten|hawkish|raise|higher/i.test(t) ? "Higher rates make loans and credit cards pricier, but savers can earn more."
      : "Rate decisions ripple into your mortgage, your credit card and your savings account.")],
  ["inflation", /\b(inflation|cpi|consumer prices|cost of living|price (rises|increases|pressures))\b/i, () => "When prices rise faster than your pay, your savings lose buying power."],
  ["housing", /\b(mortgage|housing|home (prices|sales|buyers)|rents?|landlords?|real estate)\b/i, () => "Small changes in mortgage rates can swing a monthly payment by hundreds."],
  ["jobs", /\b(layoffs?|jobs|jobless|unemploy\w*|hiring|payrolls|wages)\b/i, () => "A shaky job market is the best reason to keep an emergency fund."],
  ["trade", /\b(tariffs?|trade war|trade deal|exports?|imports?)\b/i, () => "Tariffs can push up prices on everyday goods."],
  ["crypto", /\b(bitcoin|crypto\w*|ethereum|stablecoins?|blockchain|token)\b/i, () => "Crypto can swing hard both ways, so only risk what you can afford to lose."],
  ["gold and oil", /\b(gold|oil|crude|commodit\w+)\b/i, () => "Commodity prices feed into what you pay for fuel and everyday goods."],
  ["the stock market", /\b(earnings|stocks?|shares|nasdaq|s&p|dow|wall street|rally|sell-?off|futures|ipo)\b/i, () => "Headlines move markets daily, but long term investors win by staying the course."],
  ["AI and tech", /\b(ai|artificial intelligence|nvidia|chips?|tech)\b/i, () => "Big tech now drives a large share of the market, so it moves most index funds too."],
];
// Headlines that aren't news: newsletter titles, live blogs, round-ups.
export const junkHeadline = (t) => /^(here'?s|here is) what (happened|to know|to watch|you need)|\b(live updates?|live blog|morning brief(ing)?|daily (wrap|brief|digest|recap)|week in review|stocks to watch|things to know|what to watch|newsletter|podcast|price prediction|sponsored)\b/i.test(t)
  // Series and technical posts ("Covenants Part 6: …"), and company press releases ("X Partners with Y to Enhance…").
  || /\bpart \d+\b|\bepisode \d+|\b(deep dive|explainer|tutorial|whitepaper|changelog|release notes)\b/i.test(t)
  || /\b(partners|teams up|collaborates) with\b.{0,60}\bto (enhance|expand|launch|offer|provide|deliver|bring|power|accelerate)\b|\b(announces|unveils|launches) (new|its|the)\b.{0,40}\b(platform|solution|partnership|program)\b/i.test(t);

export function headlineThread(titles, nicheTheme = "") {
  const hits = THEMES.map(([name, re, say]) => ({ name, say, at: titles.map((t, i) => (re.test(t) ? i : -1)).filter((i) => i >= 0) })).filter((h) => h.at.length);
  if (!hits.length) return { order: titles.map((_, i) => i), text: "Why it matters: stay informed, but don't make big money moves on one headline." };
  hits.sort((a, b) => b.at.length - a.at.length);
  const top = hits[0], joined = top.at.map((i) => titles[i]).join(" ");
  // Related headlines are told together, first.
  const order = [...top.at, ...titles.map((_, i) => i).filter((i) => !top.at.includes(i))];
  const text = top.at.length >= 2 && top.name !== nicheTheme ? `The thread today: ${top.name}. ${top.say(joined)}` : `Why it matters: ${top.say(joined).replace(/^./, (c) => c.toLowerCase())}`;
  return { order, text, theme: top.name, shared: top.at.length };
}

// One line on how the markets moved overall, for the opening and the closing thought.
export function marketMood(markets) {
  const moves = markets.filter((m) => !m.is_yield).map((m) => m.day_pct);
  if (!moves.length) return { opening: "", closing: "Remember: daily moves are noise. Long-term habits build wealth." };
  const up = moves.filter((v) => v > 0.05).length, down = moves.filter((v) => v < -0.05).length, big = Math.max(...moves.map(Math.abs));
  const what = markets[0].asset === "crypto" || /bitcoin|ether/i.test(markets[0].name || "") ? "Crypto" : "Stocks";
  if (down === moves.length) return { opening: `${what} fell across the board${big >= 1.5 ? ", and it was a rough one" : ""}.`, closing: big >= 1.5 ? "Remember: red days like this feel scary, but they're normal. Long-term habits build wealth." : "Remember: daily moves are noise. Long-term habits build wealth." };
  if (up === moves.length) return { opening: `${what} rose across the board${big >= 1.5 ? ", and it was a strong one" : ""}.`, closing: big >= 1.5 ? "Remember: green days feel great, but don't chase them. Long-term habits build wealth." : "Remember: daily moves are noise. Long-term habits build wealth." };
  if (!up && !down) return { opening: "A quiet day: the markets barely moved.", closing: "Remember: boring days are part of investing. Long-term habits build wealth." };
  return { opening: "It was a mixed day for the markets.", closing: "Remember: daily moves are noise. Long-term habits build wealth." };
}
