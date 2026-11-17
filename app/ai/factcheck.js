// Fact check: every factual line in a script is checked against the research library on the phone
// (opening sections and, at higher depths, the full text of the articles), and optionally against
// live Wikipedia. A line is "verified" when a source sentence says the same thing and every number
// in the line appears in that source. Lines that are advice ("Pay every bill on time") aren't facts
// and are marked as tips. Nothing here invents or rewrites facts; it only finds and shows evidence.
import { library, deepResearch, search, terms, articleBody, offTopic } from "./research.js";
import { wordsToDigits } from "../script.js";
import { fetchT, dropParentheticals } from "../research.js";
import { sameIdea, isDefinition, fits, simplify } from "../story.js";
import { loadSemantic, semanticReady, embedTexts, cosine } from "./semantic.js";

const SKIP = new Set(["outro", "section", "recap"]);
const ADVICE = /^(?:(?:at minimum|at the very least|first|then|next|instead|so|and|but|finally|today|now),?\s+)?(start|keep|set|pay|use|try|automate|avoid|don't|do not|never|always|check|compare|aim|pick|look|save|invest|build|before|think|watch|budget|read|decide|ask|follow|make|stop|get|open|track|spread|write|learn|remember|be|contribute|choose|consider|beware|protect|claim|move|leave|skip|cut|max|put|turn|call|treat|ignore|plan|review|negotiate|freeze|report|verify|double-check|diversify|rebalance|borrow|shop|split|divide|automate|pay off|round up)\b/i;
const WARNING = /\b(is lying|is a scam|is a red flag|red flags?|be careful|watch out|warning sign)\b/i;
const YOU = /\byou(r)? (should|can|could|need|might|may|'ll|will|want)\b/i;
const MULT = { thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 };
// Takeaways and opinions ("time in the market matters more than almost anything") aren't checkable facts.
const RULE_OF_THUMB = /^(a common rule|a good rule|a simple rule|rule of thumb|as a rule of thumb|the rule of thumb|a rough guide|many experts suggest|most experts suggest)\b/i;
const OPINION = /^(that|this|which|so|here's why|the lesson|the takeaway|bottom line)\b.*\b(means|matters|is why|shows)\b|\b(matters more|the most important|the best way|the key is|is everything|is worth it)\b/i;

// Money maths in a line, checked by calculation: "at 10 percent a year, money doubles every 7 years",
// "starting at 25 instead of 35 can leave you with twice as much". Returns null when there's nothing to calculate.
export function mathCheck(text) {
  // One sentence at a time, at most 300 characters: the patterns below scan back and forth, which on
  // long text without full stops took seconds (found by fuzzing) and would freeze the phone.
  const sentences = String(text).split(/(?<=[.!?])\s+/).filter((x) => x.length <= 300);
  for (const s of sentences) { const r = mathCheckSentence(s); if (r) return r; }
  return null;
}
function mathCheckSentence(text) {
  const t = wordsToDigits(text).toLowerCase().replace(/(\d)\s*%/g, "$1 percent");
  let m = t.match(/(\d+(?:\.\d+)?) percent[^.]*?doubl\w*[^.]*?(?:every|in)\s+(?:about\s+|roughly\s+|around\s+)?(\d+(?:\.\d+)?) years/);
  let rateFirst = true;
  if (!m) { m = t.match(/doubl\w*[^.]*?(?:every|in)\s+(?:about\s+|roughly\s+|around\s+)?(\d+(?:\.\d+)?) years[^.]*?(\d+(?:\.\d+)?) percent/); rateFirst = false; }
  if (m) {
    const [rate, years] = rateFirst ? [Number(m[1]), Number(m[2])] : [Number(m[2]), Number(m[1])];
    const exact = Math.log(2) / Math.log(1 + rate / 100), ok = Math.abs(exact - years) / exact <= 0.12;
    return { status: ok ? "verified" : "conflict", calc: `At ${rate}% a year, money doubles in ${exact.toFixed(1)} years (ln 2 ÷ ln ${(1 + rate / 100).toFixed(2)}).` };
  }
  m = t.match(/(?:at|from)\s+(\d{2})\s+instead of\s+(\d{2})[^.]*?\b(twice|double|2 times|3 times|three times|triple)\b/);
  if (m) {
    const years = Math.abs(Number(m[2]) - Number(m[1])), want = /twice|double|2 times/.test(m[3]) ? 2 : 3;
    const lo = 1.05 ** years, hi = 1.1 ** years, ok = want >= lo * 0.9 && want <= hi * 1.1;
    return { status: ok ? "verified" : "conflict", calc: `${years} extra years of growth at 5–10% a year multiplies money by ${lo.toFixed(1)}–${hi.toFixed(1)}×.` };
  }
  m = t.match(/(\d+(?:\.\d+)?) percent[^.]*?(\d+) years[^.]*?\$?(\d[\d,]*)\b[^.]*?(?:becomes|grows to|turns into|is worth)\s+(?:about\s+|roughly\s+|over\s+|nearly\s+)?\$?(\d[\d,]*)/);
  if (m) {
    const [rate, years, from, to] = [Number(m[1]), Number(m[2]), Number(m[3].replace(/,/g, "")), Number(m[4].replace(/,/g, ""))];
    const exact = from * (1 + rate / 100) ** years, ok = Math.abs(exact - to) / exact <= 0.1;
    return { status: ok ? "verified" : "conflict", calc: `$${from.toLocaleString("en-US")} at ${rate}% for ${years} years grows to $${Math.round(exact).toLocaleString("en-US")}.` };
  }
  return null;
}

// The numbers in a text, normalized: "fifty percent" -> 50, "$1,000" -> 1000, "1.5 billion" -> 1.5e9.
export function numbersIn(text) {
  const t = wordsToDigits(text).replace(/(\d),(?=\d{3}\b)/g, "$1");
  const out = [];
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*(thousand|million|billion|trillion)?/gi)) {
    const v = Number(m[1]) * (MULT[(m[2] || "").toLowerCase()] || 1);
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}
const sameNumber = (a, b) => a === b || Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 0.005);

// Is this line a claim of fact that should be checked?
export function claimKind(line, i) {
  if (SKIP.has(line.kind) || !line.text?.trim()) return "skip";
  if (line.kind === "chart") return "data";                       // live market numbers: from the data feed
  const nums = numbersIn(line.text).length;
  // The opening line is a hook, not a claim, unless it states a figure (a %, a $ amount, a year).
  if (i === 0 && !/[%$]|\bpercent\b|\b(1[5-9]|20)\d\d\b/.test(wordsToDigits(line.text))) return "hook";
  if (line.tip || ((ADVICE.test(line.text) || YOU.test(line.text)) && !nums)) return "tip";
  if (WARNING.test(line.text) && !nums) return "tip";
  if ((OPINION.test(line.text) && !nums) || RULE_OF_THUMB.test(line.text)) return "takeaway";
  return "fact";
}

// "401(k)" and "401k" are the same thing.
const content = (t) => new Set(terms(t.replace(/\b(401|403|457|529)\s*\(\s*([a-z])\s*\)/gi, "$1$2")));
// How much of the line a source sentence covers (0..1), on content words.
function coverage(lineTerms, sentence) {
  if (!lineTerms.size) return 0;
  const st = content(sentence);
  let n = 0;
  for (const w of lineTerms) if (st.has(w)) n++;
  return n / lineTerms.size;
}
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Checks one line against a pool of evidence: [{ text, source, section }].
export function checkAgainst(line, evidence) {
  // "one of the…" isn't a figure to verify; 2 and up (and anything with %, $ or a unit) is.
  const lineTerms = content(line.text), nums = numbersIn(line.text).filter((n) => n > 1);
  const nl = norm(line.text);
  const hits = [];
  let conflict = null;
  for (const ev of evidence) {
    const quoted = norm(ev.text).includes(nl) || (nl.length > 40 && nl.includes(norm(ev.text)));
    const cov = quoted ? 1 : coverage(lineTerms, ev.text);
    if (cov < 0.45) continue;
    const evNums = numbersIn(ev.text);
    const numsOk = nums.every((n) => evNums.some((m) => sameNumber(n, m)));
    if (numsOk) hits.push({ ...ev, cov, quoted });
    // Same subject, numbers that disagree: worth a look ("20%" in the line, "25%" in the source).
    else if (cov >= 0.7 && evNums.length && !conflict) conflict = { ...ev, cov };
  }
  hits.sort((a, b) => b.cov - a.cov);
  const best = hits[0];
  const strong = hits.filter((h) => h.cov >= 0.6);
  const sources = [...new Set(strong.map((h) => h.source))];
  if (best && (best.quoted || best.cov >= 0.6)) return { status: "verified", sources, evidence: strong.slice(0, 3), quoted: best.quoted };
  if (conflict) return { status: "conflict", sources: [conflict.source], evidence: [conflict] };
  if (best) return { status: "partial", sources: [best.source], evidence: hits.slice(0, 2) };
  return { status: "unverified", sources: [], evidence: [] };
}

// Live Wikipedia check for lines the library couldn't confirm (only when online and allowed).
async function liveEvidence(text) {
  const q = [...content(text)].slice(0, 8).join(" ");
  if (!q) return [];
  const api = "https://en.wikipedia.org/w/api.php?format=json&origin=*&";
  try {
    const res = await fetchT(api + new URLSearchParams({ action: "query", list: "search", srsearch: q, srlimit: "2", srnamespace: "0" }), 8000);
    if (!res.ok) return [];
    const titles = ((await res.json()).query?.search || []).map((h) => h.title);
    const out = [];
    for (const title of titles) {
      const r = await fetchT(api + new URLSearchParams({ action: "query", prop: "extracts", explaintext: "1", exchars: "12000", redirects: "1", titles: title }), 8000);
      if (!r.ok) continue;
      const page = Object.values((await r.json()).query?.pages || {})[0];
      const body = dropParentheticals(page?.extract || "").replace(/\s+/g, " ");
      for (const s of body.split(/(?<=[.!?])\s+(?=[A-Z])/)) if (s.split(/\s+/).length >= 6) out.push({ text: s.trim(), source: page.title, section: null, live: true });
    }
    return out;
  } catch { return []; }
}

// Checks a whole script. Returns { lines: [check per line], summary }. Each check is stored on its line (line.check).
// ctx: { topic, niche, depth (1-4), online (bool), onStep }. The evidence gathered is kept on the result
// so single edited lines can be re-checked instantly with recheckLine().
export async function factCheck(lines, { topic, niche = null, depth = 2, online = false, onStep, extras = [], sourceText = [] } = {}) {
  const lib = await library();
  onStep?.("Fact-checking every line against the research library…");
  const evidence = [];
  const seenEv = new Set();
  const add = (text, source, section = null) => { const k = source + "|" + text; if (!seenEv.has(k)) { seenEv.add(k); evidence.push({ text, source, section }); } };
  const docsSeen = new Set();
  const addDoc = async (doc, withBody) => {
    if (docsSeen.has(doc.id) || offTopic(doc.title)) return;
    docsSeen.add(doc.id);
    for (const s of doc.sentences) add(s, doc.title);
    if (withBody) for (const sec of await articleBody(lib, doc)) for (const s of sec.sentences) add(s, doc.title, sec.heading);
  };
  // 0. The text the script was written from (e.g. the topic's live Wikipedia article).
  for (const e of sourceText) add(e.text, e.source, e.section || null);
  // 1. Everything the topic research read.
  const brief = topic ? await deepResearch(topic, { niche, depth }).catch(() => null) : null;
  if (brief) {
    for (const f of brief.pool) if (!offTopic(f.source)) add(f.text, f.source, f.section);
    for (const d of [brief.main, ...brief.related]) await addDoc(d, depth >= 2 && (d === brief.main || brief.bodyDocs.includes(d)));
  }
  // 2. For each factual line, the articles that best match the line itself (with their full text at depth 3+).
  const kinds = lines.map((l, i) => claimKind(l, i));
  for (const [i, l] of lines.entries()) {
    if (kinds[i] !== "fact") continue;
    for (const r of search(lib, l.text, depth >= 3 ? 4 : 2, niche)) await addDoc(r.doc, depth >= 3);
  }
  // The meaning model (23 MB, on the phone; downloaded once) catches paraphrases. Optional: if it can't
  // load in time, word matching and calculations still run.
  // Only at Deep/Maximum: the model stays in the page's memory for the rest of the session (~200 MB),
  // which is a lot on a phone; Standard checks words, numbers and maths without it.
  if (depth >= 3) await Promise.race([loadSemantic(lib), new Promise((r) => setTimeout(r, 25000))]).catch(() => {});
  // Ranked facts about the topic, straight from the sources: replacements for lines strict accuracy removes.
  // Only facts about this topic: from its own article, or naming it at the start. (When the library has
  // no article on the topic, its closest match is a different subject: "Elon Musk" found "Keith Rabois".)
  const base = (t) => t.toLowerCase().replace(/\s+\(.*\)$/, "").replace(/[^a-z0-9]/g, "").replace(/(es|s)$/, "");
  const sameTopic = brief && base(brief.main.title) === base(topic);
  const named = (t) => { const k = t.toLowerCase().indexOf(topic.toLowerCase().replace(/\s+\(.*\)$/, "")); return k >= 0 && k <= 4; };
  const facts = (brief?.facts || []).filter((f) => (sameTopic && f.source === brief.main.title) || named(f.text)).filter((f) => {
    const n = f.text.split(/\s+/).length;
    return n >= 7 && n <= 30 && !/^(It|This|These|They|He|She|Its|And|Or|But|Also|Such)\b/.test(f.text) && /[.!?]$/.test(f.text);
  }).map((f) => ({ text: f.text, source: f.source, section: f.section }));
  const ctx = { evidence, online, semantic: semanticReady(), facts };
  const results = [];
  for (const [i, l] of lines.entries()) results.push(await checkLine(l, i, ctx, kinds[i]));
  for (const l of extras) await checkLine(l, 99, ctx);
  // 3. Live Wikipedia for what's still unconfirmed (current figures can differ from the library's snapshot).
  if (online) {
    const open = results.map((r, i) => (r.status === "unverified" || r.status === "partial" || r.status === "conflict" ? i : -1)).filter((i) => i >= 0);
    if (open.length) onStep?.(`Checking ${open.length} line${open.length > 1 ? "s" : ""} against live Wikipedia…`);
    for (const i of open.slice(0, 8)) {
      const live = await liveEvidence(lines[i].text);
      if (!live.length) continue;
      const r = checkAgainst(lines[i], live);
      if (r.status === "verified" || (r.status === "partial" && results[i].status === "unverified")) {
        results[i] = { ...r, live: true, kind: "fact" };
        lines[i].check = results[i];
      }
    }
  }
  const summary = summarize(lines);
  onStep?.(`Fact check: ${summary.verified} of ${summary.facts} facts verified across ${summary.sources} sources.`);
  return { results, summary, ctx };
}

// Meaning check for paraphrases ("Many employers match part of what you put into your 401k" vs the
// source's wording): compares the line with the closest source sentences using the on-phone model.
// Numbers must still match exactly; meaning alone only verifies lines without figures or with matching ones.
async function semanticCheck(line, ctx) {
  const lineTerms = content(line.text), nums = numbersIn(line.text).filter((n) => n > 1);
  const cands = ctx.evidence.map((e) => ({ e, cov: coverage(lineTerms, e.text) })).filter((x) => x.cov >= 0.25)
    .sort((a, b) => b.cov - a.cov).slice(0, 16).map((x) => x.e);
  if (!cands.length) return null;
  ctx.emb ??= new Map();
  const missing = [line.text, ...cands.map((c) => c.text)].filter((t) => !ctx.emb.has(t));
  const vecs = missing.length ? await embedTexts(missing).catch(() => null) : [];
  if (!vecs) return null;
  missing.forEach((t, k) => ctx.emb.set(t, vecs[k]));
  const lv = ctx.emb.get(line.text);
  const scored = cands.map((c) => ({ ...c, sim: cosine(lv, ctx.emb.get(c.text)) }))
    .filter((c) => nums.every((n) => numbersIn(c.text).some((m) => sameNumber(n, m)))).sort((a, b) => b.sim - a.sim);
  const strong = scored.filter((c) => c.sim >= 0.78);
  if (strong.length) return { status: "verified", sources: [...new Set(strong.map((c) => c.source))], evidence: strong.slice(0, 3), semantic: true };
  if (scored[0]?.sim >= 0.68) return { status: "partial", sources: [scored[0].source], evidence: scored.slice(0, 2), semantic: true };
  return null;
}

// Checks (or re-checks after an edit) one line with the evidence already gathered.
export async function checkLine(shown, i, ctx, kind = claimKind(shown, i)) {
  // A line with a spoken lead-in ("Why it matters: …") is checked on the fact itself.
  const line = shown.claim ? { ...shown, text: shown.claim } : shown;
  let r;
  if (kind !== "fact") r = { status: kind, sources: [], evidence: [] };
  else {
    // A line taken word for word from a source is verified by that source.
    const own = line.source && line.source.startsWith("Wikipedia · ") ? line.source.slice(12).split(" — ")[0] : null;
    r = checkAgainst(line, ctx.evidence);
    if (r.status !== "verified" && ctx.semantic) r = (await semanticCheck(line, ctx)) || r;
    // Maths is checked by calculating it, which beats (and can overrule) a word match.
    const calc = mathCheck(line.text);
    if (calc && (calc.status === "conflict" || r.status !== "verified")) r = { status: calc.status, sources: calc.status === "verified" ? ["Calculation"] : [], evidence: [{ text: calc.calc, source: "Checked by calculation" }], calc: true };
    if (own && r.status !== "verified" && ctx.evidence.some((e) => e.source === own && norm(e.text) === norm(line.text))) {
      r = { status: "verified", sources: [own], evidence: [{ text: line.text, source: own }], quoted: true };
    }
  }
  r.kind = kind;
  shown.check = r;
  return r;
}

export function summarize(lines) {
  const checks = lines.map((l) => l.check).filter((c) => c && c.kind === "fact");
  const count = (s) => checks.filter((c) => c.status === s).length;
  return {
    facts: checks.length, verified: count("verified"), partial: count("partial"), unverified: count("unverified"), conflict: count("conflict"),
    sources: new Set(checks.flatMap((c) => c.sources || [])).size,
    multi: checks.filter((c) => c.status === "verified" && (c.sources || []).length >= 2).length,
  };
}

// Strict accuracy: removes facts that couldn't be verified (or that disagree with a source), and fills
// their place with verified facts from the spares when there are any. Returns how many were replaced/removed.
export function enforceAccuracy(script, ctx) {
  let removed = 0, replaced = 0;
  const topic = (script.topicTitle || script.title || "").replace(/\s*#Shorts$/, "");
  const said = () => script.lines.filter((l) => l.kind === "media").map((l) => l.claim || l.text);
  // Spares first (they were written for this script), then facts taken word for word from the research.
  // (A hand-written explainer is a finished story: random research facts aren't swapped into it.)
  const spares = [...(script.extras || []).filter((l) => l.kind === "media"),
    ...(script.kind === "evergreen" ? [] : ctx.facts || []).filter((f) => fits(f.text, topic)).map((f) => ({ text: simplify(f.text), visual: "", kind: "media", chart: null,
      source: "Wikipedia · " + f.source + (f.section ? " — " + f.section : ""), fromResearch: true }))];
  const out = [];
  const hasDefinition = () => out.concat(script.lines).some((l, i) => l.kind === "media" && i > 0 && (isDefinition(l.claim || l.text, topic) || /\b(means|is when)\b/i.test(l.text)));
  for (const [i, l] of script.lines.entries()) {
    const c = l.check;
    if (!c || c.kind !== "fact" || c.status === "verified" || c.status === "partial" || i === 0) { out.push(l); continue; }
    // A replacement must be verified, say something new, and fit where the old line was (never a second definition).
    let swap = null;
    for (let k = 0; k < spares.length && !swap; k++) {
      const cand = spares[k];
      if (said().concat(out.map((o) => o.claim || o.text)).some((x) => sameIdea(x, cand.text, 0.55))) continue;
      if (topic && isDefinition(cand.text, topic) && hasDefinition()) continue;
      if (/^(It|This|These|They|He|She|Its|Such|However|Instead|Also)\b/.test(cand.text)) continue;
      const r = checkAgainst(cand, ctx.evidence);
      if (r.status === "verified") { cand.check = { ...r, kind: "fact" }; swap = cand; spares.splice(k, 1); }
    }
    if (swap) { out.push(swap); replaced++; script.extras = script.extras.filter((x) => x !== swap); continue; }
    // No good replacement. A line with a figure nobody can confirm goes; a plain-words explanation
    // stays (marked "Not verified" on the review screen), because removing it would break the story.
    // Hand-written lines are the story's backbone: they stay (flagged on the review screen) unless a
    // source contradicts them. Researched lines with a figure nobody can confirm go.
    const figures = numbersIn(l.claim || l.text).filter((n) => n > 1).length;
    if (c.status === "conflict" || (figures && l.source)) removed++; else out.push(l);
  }
  // Spare lines (used to fill a short video) must be verified too, or be tips/takeaways.
  script.extras = (script.extras || []).filter((l) => l.kind !== "media" || !l.check || l.check.kind !== "fact" || l.check.status === "verified");
  // Never strip a script down to almost nothing: keep the original if too little would be left.
  if (out.filter((l) => l.kind === "media").length >= 3) script.lines = out;
  else { removed = 0; replaced = 0; }
  return { removed, replaced };
}
