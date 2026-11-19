// The newsroom: turns a feed item (its headline and its own summary) into a line a newsreader would say.
// Headlines are written to be clicked, not heard: they tease ("this stock", "here's why"), carry the site's
// name ("| Economy | U.S. News"), and some are rate tables, not news. Only the source's own words are used:
// a teaser is resolved from the item's summary, or the story isn't told. Nothing is invented.
import { cleanHeadline, junkHeadline } from "./story.js";

// Sentences, without breaking after "U.S.", "Inc." or an initial: "to seek U.S. approval" stays whole.
const ABBR = /(?:^|[\s(])(?:U\.S|U\.K|E\.U|U\.N|D\.C|Inc|Corp|Co|Ltd|Jr|Sr|Mr|Mrs|Ms|Dr|St|vs|etc|e\.g|i\.e|No|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec|approx|[A-Z])\.$/;
export function sentencesOf(text) {
  const parts = String(text || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?…])\s+(?=["“'‘(]?[A-Z0-9$])/);
  const out = [];
  for (const p of parts) {
    if (out.length && ABBR.test(out[out.length - 1])) out[out.length - 1] += " " + p;
    else if (p) out.push(p);
  }
  return out;
}

// A headline without the site furniture: "Column | …", "| Economy | U.S. News", "… - Yahoo Finance".
const OUTLET = /\b(?:news|times|post|journal|report|insider|finance|business|daily|magazine|wire|herald|tribune|telegraph|guardian|observer|gazette|press)$|\.(?:com|org|net|io|co)$/i;
const squash = (s) => String(s || "").toLowerCase().replace(/^www\.|\.(?:com|org|net|io|co\.uk)$/g, "").replace(/[^a-z0-9]/g, "");
export function stripSource(title, source = "") {
  let t = String(title || "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
  t = t.replace(/^(?:column|opinion|analysis|commentary|perspective|editorial|exclusive|watch|live|video|podcast|explainer|update|breaking)\s*[|:–—]\s*/i, "");
  t = t.replace(/\s+\|\s+.*$/, "");                                     // everything after a pipe is the site's
  const m = t.match(/\s+[-–—]\s+([^-–—]{2,60})$/);
  if (m) {
    const tail = m[1].trim(), src = squash(source);
    if (OUTLET.test(tail) || (src.length > 2 && (src.includes(squash(tail)) || squash(tail).includes(src)))) t = t.slice(0, m.index);
  }
  // A quote fragment left without its opening mark ("Kicking the market while it's down': US home sales…").
  const q = t.match(/^([^"]{6,80}?)['"]:\s+/);
  if (q && !/(?:^|\s)['"](?=\w)/.test(q[1])) t = t.slice(q[0].length);
  return t.trim();
}

// A page that isn't news: today's rate tables, prices for a date, listings.
const DATE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2},? \d{4}\b/i;
export const seoPage = (t) => (/\b(?:rates?|prices?|yields?)\b/i.test(t) && DATE.test(t))
  || /^(?:current|today'?s|top|best)\b.{0,50}\b(?:rates?|cds?|accounts?|cards?)\b/i.test(t)
  || /\b(?:homes|houses|apartments) for (?:sale|rent)\b|\bprices today\b/i.test(t);

// Teasers. "Trailing" ones are a clause that can simply go ("… — here's why"); "hidden" ones keep the news
// itself back ("this stock", "this big risk") and must be resolved by the summary.
const TRAILING = [
  /^(?:and |but |so )?here'?s (?:why|what|how|where|when|who)\b/i,
  /^(?:and |but |so )?here'?s [A-Z][\w.]*'s (?:advice|take|pick|picks|view|plan|playbook)\b/i,
  /^(?:this|that) is (?:why|what|how)\b/i,
  /^(?:what'?s|what is|what are) (?:likely|next|behind|driving|scaring|really)\b/i,
  /^what (?:to|you need to|investors need to) (?:know|watch|do|expect)\b/i,
  /^(?:you won'?t believe|it may surprise you)\b/i,
  /^(?:see|find out|learn|discover|read on to see) (?:who|what|how|why|where|which|if)\b/i,
  /^(?:how|why|what|who)\b[^?]*$/i,                 // a fragment that promises the story: "How one investor is preparing."
];
const HIDDEN = /\b(?:this|these)\s+(?:[\w'-]+\s+){0,3}?(?:stocks?|names?|risks?|reasons?|mistakes?|moves?|tricks?|things?|sectors?|compan(?:y|ies)|charts?|signals?|numbers?|funds?|etfs?|coins?|tokens?|strateg(?:y|ies)|rules?|tips?|analysts?|investors?|gurus?|experts?|ways?|picks?|plays?|trades?|states?|cities|habits?|signs?|investments?|assets?|millionaires?|billionaires?)\b/i;
const NOT_HIDDEN = /\b(?:this|these)\s+(?:week|month|year|quarter|fall|spring|summer|winter|morning|afternoon|evening|time|season)(?:'s)?\b/i;
// A numbered list that doesn't give its items ("Debunking 7 Social Security myths", "4 dividend stocks paying…").
const LISTICLE = /^(?:debunking |the |these )?\d+\s+(?:[\w&'-]+\s+){0,5}?(?:myths?|milestones?|things?|ways?|tips?|stocks?|reasons?|mistakes?|signs?|rules?|steps?|habits?|secrets?|facts?|questions?|picks?|funds?|etfs?|moves?)\b/i;
const hidden = (t) => { const h = t.match(HIDDEN); return (h && !NOT_HIDDEN.test(h[0])) || LISTICLE.test(t); };
export function teaserIn(text) {
  const t = String(text || "");
  for (const c of clauses(t)) for (const re of TRAILING) if (re.test(c)) return { kind: "trailing", phrase: c };
  if (hidden(t)) return { kind: "hidden", phrase: (t.match(HIDDEN) || t.match(LISTICLE))[0] };
  return null;
}

// A headline's clauses: its sentences, and the parts either side of a dash or semicolon.
const BREAK = /(?<=[.!?:])\s+|\s+[—–-]\s+|;\s+/g;
function clauses(t) {
  return t.split(BREAK).map((c) => c.trim()).filter(Boolean);
}
// The headline up to its first trailing teaser, the rest exactly as written.
function dropTrailing(t) {
  const starts = [0];
  for (const m of t.matchAll(BREAK)) starts.push(m.index + m[0].length);
  for (const s of starts) if (TRAILING.some((re) => re.test(t.slice(s)))) return t.slice(0, s).replace(/[\s,;:—–-]+$/, "");
  return t;
}
const words = (s) => s.split(/\s+/).filter(Boolean).length;
const content = (s) => new Set((s.toLowerCase().match(/[a-z0-9$%.]{3,}/g) || []).filter((w) => !/^(the|and|for|that|with|from|this|these|are|was|has|have|its|it's|will|but|into|over|after|than|their|they|says|said)$/.test(w)));
const end = (s) => s.replace(/[\s,;:—–-]+$/, "").replace(/([^.!?])$/, "$1.");

// "this big risk" -> "a big risk", "these 3 stocks" -> "3 stocks": once the next sentence says what it is.
function untease(t) {
  return t.replace(HIDDEN, (m) => {
    if (/^these\s/i.test(m)) return m.replace(/^these\s+/i, "");
    const rest = m.replace(/^this\s+/i, ""), art = /^(?:[aeio]|u(?!ni|s[aeu]|r[aeiou]))/i.test(rest) ? "an" : "a";
    return `${/^T/.test(m) ? art.replace(/^a/, "A") : art} ${rest}`;
  });
}

// The story as one or two spoken sentences, or null when it can't be told honestly.
//   item: { title, summary, source }. Returns { text, resolved } (resolved: the summary filled a gap).
export function spokenStory(item, { maxWords = 30 } = {}) {
  const raw = String(item?.title || "");
  if (!raw || seoPage(raw)) return null;
  // Columns and first-person essays ("I left a corporate job…") would sound like the narrator's own story.
  if (/^(?:column|opinion|commentary|perspective)\s*[|:–—]/i.test(raw)) return null;
  let head = stripSource(raw, item.source || "");
  if (/^(?:I|I'm|I've|I'd|My|We|We're|We've|Our)\b/.test(head)) return null;
  if (/^\W*c\s?o\s?r\s?r\s?e\s?c\s?t\s?i\s?o\s?n\b|^\//i.test(head)) return null;      // wire corrections
  head = cleanHeadline(head, 99).replace(/\.$/, "");
  if (junkHeadline(head)) return null;
  // The summary's sentences that say something (not "Here's how to play it.", not a teaser of its own).
  const facts = sentencesOf(stripSource(item.summary || "")).filter((s) => words(s) >= 6 && !teaserIn(s) && !/…$|\.\.\.$/.test(s) && !/^(?:need to know|read more|click|subscribe|watch|sign up)/i.test(s));
  // What the headline's own words already say; a fact must add to it.
  const adds = (s) => { const a = content(s), b = content(head); let n = 0; for (const w of a) if (b.has(w)) n++; return a.size && n / a.size < 0.6; };
  // A trailing teaser goes, and everything after it ("Bonds are causing trouble again — here's where to invest now").
  let text = dropTrailing(head);
  const promised = text !== head;
  const fact = facts.find(adds) || null;
  let resolved = false;
  if (hidden(text)) {
    if (!fact) return null;                       // "this stock" with nothing to say which: not told
    text = `${end(untease(text))} ${end(fact)}`; resolved = true;
    return words(text) <= 44 ? { text, resolved } : null;   // the headline carries the news: never the fact alone
  } else if (words(text) < 5) {
    if (!fact) return null;                       // only "Thursday's big stock stories" was left: the summary tells it
    text = end(fact); resolved = true;
  } else {
    text = end(text);
    // The cut teaser promised more ("Here's why"): the summary's own answer, when it fits in one breath.
    if (promised && fact && words(text) + words(fact) <= maxWords) { text = `${text} ${end(fact)}`; resolved = true; }
  }
  // Too long to say in one breath: its first sentence, or its main clause (never a fragment).
  if (words(text) > maxWords && !resolved) {
    const first = sentencesOf(text)[0], cut = text.match(new RegExp(String.raw`^(.{40,}?)\s(?:as|after|amid|while|even as|despite)\s`, "i"));
    if (first && first !== text && words(first) >= 7) text = end(first);
    else if (cut && words(cut[1]) >= 6) text = end(cut[1]);
  }
  return { text, resolved };
}
