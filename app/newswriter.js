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
const HIDDEN = /\b(?:this|these)\s+(?:[\w'-]+\s+){0,3}?(?:stocks?|cryptocurrenc(?:y|ies)|names?|risks?|reasons?|mistakes?|moves?|tricks?|things?|sectors?|compan(?:y|ies)|charts?|signals?|numbers?|funds?|etfs?|coins?|tokens?|strateg(?:y|ies)|rules?|tips?|analysts?|investors?|gurus?|experts?|ways?|picks?|plays?|trades?|states?|cities|habits?|signs?|investments?|assets?|millionaires?|billionaires?)\b/i;
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

// Title Case headlines ("Bitcoin Open Interest Drops 20% as Ethereum and Solana Slide Further") read like
// headlines in the captions. Common words go lower case; names, acronyms and the first word stay.
const COMMON = new Set(("a an the and or but nor for so yet as at by in of on to up via with from into onto over under after before amid " +
  "against about above below between during despite through toward towards without within until since than then this that these those " +
  "is are was were be been being has have had do does did will would can could may might must shall should not no all any some more most " +
  "less least new old big small high low higher lower top best worst first last next its it his her their our your my who what when where why how " +
  "says said say warns warn sees see sets set gets get makes make takes take adds add cuts cut hikes hike raises raise rises rise falls fall " +
  "drops drop jumps jump slides slide surges surge plunges plunge tumbles tumble soars soar sinks sink climbs climb gains gain loses lose " +
  "ends end opens open closes close holds hold hits hit nears near tops top beats beat misses miss rallies rally slips slip edges edge " +
  "extends extend fails fail leaves leave follows follow suffers suffer accelerates accelerate slows slow mounts mount looms loom " +
  "shows show reports report expects expect plans plan wants want needs need could won't can't doesn't isn't aren't rule out " +
  "rate rates price prices market markets stock stocks shares share bond bonds yield yields fund funds investors investor traders trader " +
  "inflation interest economy jobs job wages growth recession earnings profit profits revenue sales demand supply trade tariffs tariff " +
  "home homes housing mortgage mortgages rent rents buyers sellers banks bank loans loan debt credit card cards savings tax taxes " +
  "futures index points day days week weeks month months year years today tomorrow straight losses loss gain record lows highs quarter " +
  "consumer consumers spending policy views calls call options table communication clear larger large risks risk adjustment confidence " +
  "adequate trading debut pricing range profit-taking focus deck strong report weak hot cold further again still just only even now " +
  "time times way ways people money cash cryptocurrency cryptocurrencies coin coins token tokens chip chips company companies firm firms " +
  "deal deals plan plans move moves bet bets data guide guides increase increases decline declines government officials minutes stem " +
  "poised likely set around across here there why it's what's provide provides give gives allow allows expand protect help helps adding " +
  "rising falling lowering raising qualify grow strengthen earn earns highlights retirees monthly others payments access fast personal " +
  "experience workers contractors legislation goal goals small businesses business presence technology statistics trends news currencies " +
  "alone friends spring until introduces introduce launches launch unveils unveil boosts boost hurt hurts pressure costs cost buy sell " +
  "should you each same hike hikes major hubs frenzy real estate predictable refinance built upward downward tech afford gig " +
  "contribution contributions income entrepreneurship workforce profit taking newer veteran short track matter founders build teams " +
  "labor protection gaps face faces paycheck paychecks owners owner partner check checks keeps working triple federal contracting " +
  "affordable renters homebuyers plan unveils legislation would don't doesn't didn't isn't wasn't them they we us he she him women men " +
  "owned hibernate").split(" "));
export function sentenceCase(t) {
  const words = String(t).split(/(\s+)/), caps = words.filter((w) => /[A-Za-z]{4,}/.test(w));
  if (caps.length < 3 || caps.filter((w) => /^[A-Z]/.test(w.replace(/^\W+/, ""))).length / caps.length < 0.8) return t;   // not Title Case
  let start = true, left = 0;
  const common = (c) => c.toLowerCase().replace(/’/g, "'").split("-").every((p) => COMMON.has(p));
  const out = words.map((w) => {
    if (/^\s+$/.test(w)) return w;
    const core = w.replace(/^[^A-Za-z]+|[^A-Za-z'’-]+$/g, ""), first = start;
    start = /[.:!?]["”']?$/.test(w);
    if (first || !core || !/^[A-Z][a-z'’]+(?:-[A-Z]?[a-z]+)*$/.test(core)) return w;
    if (!common(core)) { left++; return w; }
    return w.replace(core, core.toLowerCase());
  }).join("");
  // Half converted reads worse than Title Case: more than two unknown capitalised words left, keep it as it was.
  return left > 2 ? t : out;
}

// Not a news story: a press release or a promotion syndicated as a headline ("Asure Software Salutes Small Business
// Saturday with Recruiting and HR Milestones", "Sophie Keane… Named Global Champion at…", "Bilt Rent Day December
// 2026: statement credit bonus, JetBlue status, and more").
export const notNews = (t) => /\b(?:salutes|celebrates|honou?red|recogni[sz]ed (?:as|for|by|among)|named (?:\w+ ){0,3}(?:champion|winner|finalist|honoree)|wins (?:\w+ ){0,3}awards?|award-winning|to host|hosts (?:a )?webinar|webinar)\b/i.test(t)
  || /\b(?:with|and) [\w&' -]{0,40}milestones\b/i.test(t) || /,? and more\.?$/i.test(t.trim());

// What event a story is about, so a reel doesn't tell one event three times ("Futures fall…", "Futures plunge after
// 6 straight days…", "S&P 500 and the Dow hit correction territory"). Wording alone can't tell (the on-phone
// sentence model scores these duplicates 0.40-0.46, and two different Fed stories 0.45), so the event is read:
//   the broad market moving: an index, "stocks", "futures" or "Wall Street" followed by a move;
//   an asset moving (crypto, gold, oil, bonds, the dollar);
//   a company or person at the centre (a name in both, apart from ones in many unrelated stories: the Fed, Trump).
const MOVE = "(?:falls?|fell|falling|plunge[sd]?|plunging|drops?|dropped|dropping|slides?|slid|sliding|tumbles?|tumbled|slumps?|slumped|sinks?|sank|tank(?:s|ed)?|" +
  "rall(?:y|ies|ied)|surges?|surged|soars?|soared|jumps?|jumped|rises?|rose|rising|climbs?|climbed|gains?|gained|rebound(?:s|ed)?|losses|lost|loses|losing|(?:down|up) \\d|correction|sell-?off|selloff|" +
  "rout|record|worst|best|red|green|lows?|highs?|turns? negative|turns? positive)";
const MARKET = new RegExp(String.raw`\b(?:s&p(?: 500)?|dow(?: jones)?|nasdaq(?: 100| composite)?|russell 2000|stocks|futures|wall street|stock market|equities|markets)\b[^.;]{0,60}?\b` + MOVE + String.raw`\b`, "i");
const ASSETS = [["crypto", /\b(?:bitcoin|btc|crypto(?:currenc(?:y|ies))?|ether(?:eum)?|solana)\b/i], ["gold", /\bgold\b/i], ["oil", /\b(?:oil|crude|brent)\b/i], ["bonds", /\b(?:treasur(?:y|ies)|bond yields?|yields)\b/i], ["dollar", /\b(?:the )?dollar\b/i]];
const PUBLIC = new Set("fed federal reserve sec irs ftc doj congress senate house white trump biden harris powell vance musk america american americans china chinese japan japanese europe european britain british india canada mexico ai ipo etf etfs ceo cfo gop wall street social security medicare medicaid treasury nasdaq dow nyse bitcoin ethereum ether solana crypto gold oil friday monday tuesday wednesday thursday saturday sunday january february march april june july august september october november december watch live news exclusive breaking update".split(" "));
export function eventKeys(text) {
  const keys = new Set(), t = String(text || "");
  if (MARKET.test(t)) keys.add("market");
  for (const [k, re] of ASSETS) { const m = re.exec(t); if (m && new RegExp(String.raw`\b` + MOVE + String.raw`\b`, "i").test(t.slice(m.index))) keys.add(k); }
  // Names: capitalised words that aren't ordinary headline words ("Anthropic", "Nvidia", "CoreWeave"). Capitals only
  // mean a name in a sentence-case headline (in Title Case "Retreat" and "Global" are capitalised too), where the
  // first word counts as well ("Anthropic soared in its debut…").
  const ws = t.split(/\s+/), long = ws.filter((w) => /[A-Za-z]{4,}/.test(w));
  const titleCase = long.length >= 4 && long.filter((w) => /^[^A-Za-z]*[A-Z]/.test(w)).length / long.length >= 0.7;
  // A roundup that lists names ("Friday's biggest analyst calls: Anthropic, SpaceX, Tesla, Apple, Netflix…") is about
  // none of them in particular.
  if ((t.match(/,/g) || []).length >= 3) return keys;
  ws.forEach((w) => {
    const core = w.replace(/[’']s$/, "").replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");
    if (/^[A-Z][A-Za-z]{3,}$/.test(core) && !COMMON.has(core.toLowerCase()) && !PUBLIC.has(core.toLowerCase())) keys.add((titleCase ? "title:" : "name:") + core.toLowerCase());
  });
  return keys;
}
export function sameEvent(a, b) {
  const A = eventKeys(a), B = eventKeys(b);
  for (const k of A) {
    if (!k.startsWith("title:") && B.has(k)) return true;
    // A name counts when at least one of the two headlines is in sentence case.
    if (k.startsWith("name:") && B.has("title:" + k.slice(5))) return true;
    if (k.startsWith("title:") && B.has("name:" + k.slice(6))) return true;
  }
  return false;
}

// The story as one or two spoken sentences, or null when it can't be told honestly.
//   item: { title, summary, source }. Returns { text, resolved } (resolved: the summary filled a gap).
export function spokenStory(item, { maxWords = 30 } = {}) {
  const raw = String(item?.title || "");
  if (!raw || seoPage(raw) || notNews(raw)) return null;
  // Columns and first-person essays ("I left a corporate job…") would sound like the narrator's own story.
  if (/^(?:column|opinion|commentary|perspective)\s*[|:–—]/i.test(raw)) return null;
  let head = stripSource(raw, item.source || "")
    // Labels and leftovers that aren't part of the story: "Watch US Economy: …", "Live news: …", "… contractors (1)",
    // and a bare list of tickers at the end ("… Iran Decision— INTU, ROST.").
    .replace(/^(?:watch|video|live news|live|listen|exclusive|breaking|update)\s*(?:[:|–—-]\s*|\s+(?=[A-Z]))/i, "")
    .replace(/\s*\((?:\d{1,2}|video|exclusive|updated?)\)\s*$/i, "")
    .replace(/\s*[—–-]\s*(?:[A-Z]{1,5}(?:,\s*|\s+and\s+|\s*$))+\.?$/, "");
  if (/^(?:I|I'm|I've|I'd|My|We|We're|We've|Our)\b/.test(head)) return null;
  if (/^\W*c\s?o\s?r\s?r\s?e\s?c\s?t\s?i\s?o\s?n\b|^\//i.test(head)) return null;      // wire corrections
  head = sentenceCase(cleanHeadline(head, 99).replace(/\.$/, ""));
  // A column's byline ("Peterson: The Fed's chairman sees…"): one word before a colon that neither the rest
  // of the headline nor the summary mentions is the writer's name, not the story's subject ("Nvidia: Shares
  // jump…" keeps it: the story is about Nvidia).
  const byline = head.match(/^([A-Z][a-z]+):\s+(?=[A-Z])/);
  if (byline && !new RegExp(`\\b${byline[1]}\\b`, "i").test(`${head.slice(byline[0].length)} ${item.summary || ""}`)) head = head.slice(byline[0].length);
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
