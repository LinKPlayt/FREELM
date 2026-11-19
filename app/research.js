// Research, done from the phone. Only public, keyless sources that browsers are allowed to call:
//   headlines   - CNBC and MarketWatch RSS feeds (fetched directly)
//   background  - Wikipedia page summaries (fetched directly)
//   market data - a small JSON snapshot this repository's scheduled job publishes (numbers only),
//                 because market-data sites don't allow direct calls from a web page.
import { sentencesOf } from "./newswriter.js";

const FEEDS = {
  "personal finance": ["https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=21324812"],
  investing: ["https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069",
              "https://feeds.content.dowjones.io/public/rss/mw_topstories"],
  crypto: ["https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
           "https://feeds.content.dowjones.io/public/rss/mw_topstories"],
  economy: ["https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258"],
  "side hustles": ["https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=44877279"],
  "real estate": ["https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000115"],
};
const KEYWORDS = {
  "personal finance": ["savings", "credit", "debt", "mortgage", "rent", "budget", "retire", "tax", "loan", "consumer", "prices", "wage", "paycheck", "social security", "insurance", "bank"],
  investing: ["stock", "shares", "s&p", "nasdaq", "dow", "earnings", "investor", "market", "etf", "rally", "fund", "dividend", "ipo", "bond", "yield"],
  crypto: ["bitcoin", "crypto", "ethereum", "blockchain", "token", "stablecoin", "coin", "solana"],
  economy: ["fed", "inflation", "economy", "jobs", "gdp", "rates", "tariff", "recession", "unemployment", "consumer", "treasury", "prices"],
  "side hustles": ["side hustle", "gig", "freelance", "small business", "entrepreneur", "income", "creator", "startup", "work"],
  "real estate": ["housing", "home", "mortgage", "rent", "real estate", "property", "buyers", "landlord", "reit", "construction"],
};
const NICHE_MARKETS = {
  "personal finance": ["^GSPC", "GC=F", "^TNX"], investing: ["^GSPC", "^IXIC", "^DJI"], crypto: ["BTC-USD", "ETH-USD", "^GSPC"],
  economy: ["^GSPC", "^TNX", "CL=F"], "side hustles": ["^GSPC", "BTC-USD", "GC=F"], "real estate": ["^TNX", "^GSPC", "GC=F"],
};

export async function fetchT(url, ms = 12000, opts = {}) {
  for (let attempt = 0; ; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    try {
      const res = await fetch(url, { ...opts, signal: ctl.signal });
      // Busy (rate limited): wait a moment and try once more.
      if (res.status === 429 && attempt === 0) { await new Promise((r) => setTimeout(r, 1500)); continue; }
      return res;
    } finally { clearTimeout(timer); }
  }
}

const clean = (s) => { const d = document.createElement("div"); d.innerHTML = s || ""; return (d.textContent || "").replace(/\s+/g, " ").trim(); };

function parseFeed(xml, source) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  return [...doc.querySelectorAll("item")].map((item) => {
    const get = (tag) => item.querySelector(tag)?.textContent || "";
    const title = clean(get("title"));
    let summary = clean(get("description"));
    if (summary.toLowerCase().startsWith(title.toLowerCase().slice(0, 40))) summary = "";
    const date = new Date(get("pubDate"));
    return { title, summary, source, link: get("link").trim(), published: isNaN(date) ? null : date.getTime() };
  }).filter((x) => x.title);
}

let snapshotCache = null;
export async function snapshot(repo) {
  if (snapshotCache) return snapshotCache;
  try {
    const res = await fetchT(`https://raw.githubusercontent.com/${repo}/data/snapshot.json?t=${Math.floor(Date.now() / 600000)}`, 8000);
    snapshotCache = res.ok ? await res.json() : {};
  } catch { snapshotCache = {}; }
  return snapshotCache;
}

export async function fetchHeadlines(niche, repo) {
  const feeds = FEEDS[niche] || FEEDS["personal finance"];
  const results = await Promise.allSettled(feeds.map(async (url) => {
    const res = await fetchT(url);
    if (!res.ok) throw new Error(String(res.status));
    return parseFeed(await res.text(), new URL(url).hostname.includes("cnbc") ? "CNBC" : "MarketWatch");
  }));
  let raw = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const snap = await snapshot(repo);
  raw = raw.concat((snap.headlines?.[niche] || []).map((h) => ({ ...h, published: h.published ? Date.parse(h.published) : null })));

  const now = Date.now(), seen = new Set(), ranked = [];
  const kws = KEYWORDS[niche] || KEYWORDS["personal finance"];
  for (const it of raw) {
    const key = it.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (seen.has(key) || it.title.split(/\s+/).length < 5) continue;
    seen.add(key);
    const ageH = it.published ? (now - it.published) / 3.6e6 : 24;
    if (ageH > 48) continue;
    const text = `${it.title} ${it.summary || ""}`.toLowerCase();
    if (/\b(opinion|podcast|video|live updates|quiz|sponsored|deal of the day)\b/.test(text)) continue;
    const hits = kws.filter((k) => text.includes(k)).length;
    if (niche === "crypto" && hits === 0) continue;   // the crypto feeds are general finance feeds
    ranked.push({ ...it, score: hits * 2 - ageH / 12 + (it.summary ? 1 : 0) });
  }
  ranked.sort((a, b) => b.score - a.score);
  const toks = (t) => new Set(t.toLowerCase().match(/[a-z]{4,}/g) || []);
  const diverse = [];
  for (const it of ranked) {           // drop near-duplicate stories
    const a = toks(it.title);
    const dup = diverse.some((d) => { const b = toks(d.title); let n = 0; for (const w of a) if (b.has(w)) n++; return n / Math.max(1, Math.min(a.size, b.size)) >= 0.4; });
    if (!dup) diverse.push(it);
  }
  return diverse;
}

export async function marketSnapshot(niche, repo) {
  const snap = await snapshot(repo);
  const all = snap.markets || {};
  const fresh = snap.generated && Date.now() - Date.parse(snap.generated) < 4 * 24 * 3.6e6;   // ignore stale data
  if (!fresh) return [];
  return (NICHE_MARKETS[niche] || NICHE_MARKETS.investing).map((s) => all[s]).filter(Boolean);
}

export async function wikipediaDefinition(title, maxWords = 30) {
  try {
    const res = await fetchT(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(" ", "_"))}`, 8000);
    if (!res.ok) return "";
    const data = await res.json();
    if (data.type === "disambiguation") return "";
    let text = (data.extract || "").replace(/\s*\([^)]*\)/g, "").replace(/\s*\[[^\]]*\]/g, "").trim();
    let sent = (sentencesOf(text)[0] || "").trim();      // "The U.S. Securities and Exchange Commission…" stays whole
    sent = sent.replace(/^([A-Z][\w '-]{2,40}?),? (?:or|also known as|also called) [\w' -]{2,30}?,? (is|are|refers to)\b/, "$1 $2");
    const wc = sent.split(/\s+/).length;
    return wc >= 6 && wc <= maxWords ? sent : "";
  } catch { return ""; }
}

export function trimDefinition(s) {
  let t = s.replace(/^([A-Z][\w '-]{2,40}?),? (?:or|also known as|also called) [\w' -]{2,30}?,/, "$1,");
  // Drop comma asides before the main verb: "X, in some places known as Y, is …" -> "X is …"
  t = t.replace(/^([^,]{3,60}),[^,]{3,90}, (is|are|refers to)\b/, "$1 $2");
  // Cut after the first clause that follows the verb.
  const m = t.match(/^(.{5,}?\b(?:is|are|refers to)\b.{10,}?)(?:,| or by | which | that is | while )/);
  if (t.split(/\s+/).length > 34 && m) t = m[1].trim() + ".";
  if (!/\bor\b/.test(t)) t = t.replace(/\beither (?=by|to|for|in|as)\b/, "");   // "either" with its "or" cut off
  const n = t.split(/\s+/).length;
  return n >= 6 && n <= 34 && /\b(is|are|refers to)\b/.test(t) ? t : "";
}

// Removes asides in parentheses, but keeps codes like 401(k), 403(b) and 501(c)(3).
export function dropParentheticals(text) {
  for (let i = 0; i < 3; i++) text = text.replace(/(\d|\u2039[a-z0-9]{1,2}\u203a)\(([a-z0-9]{1,2})\)/g, "$1\u2039$2\u203a");
  return text.replace(/\s*\([^()]*(?:\([^()]*\)[^()]*)*\)/g, "").replace(/\u2039/g, "(").replace(/\u203a/g, ")");
}

// Research any topic the user types: find the best Wikipedia article and return its key sentences.
export async function wikipediaTopic(query) {
  const api = "https://en.wikipedia.org/w/api.php?format=json&origin=*&";
  const search = await fetchT(api + new URLSearchParams({ action: "query", list: "search", srsearch: query, srlimit: "5", srnamespace: "0" }), 10000);
  if (search.status === 429 || search.status >= 500) throw new Error("Wikipedia is busy right now. Try again in a minute.");
  if (!search.ok) return null;
  const hits = (await search.json()).query?.search || [];
  // The article named exactly what you typed comes first ("Mortgage" -> its redirect "Mortgage loan"),
  // then the search results, so a broad topic doesn't turn into a narrow one.
  const typed = query.trim().replace(/^./, (c) => c.toUpperCase());
  const titles = [typed, ...hits.slice(0, 3).map((h) => h.title).filter((t) => t.toLowerCase() !== typed.toLowerCase())];
  for (const hit of titles.map((title) => ({ title }))) {
    const res = await fetchT(api + new URLSearchParams({ action: "query", prop: "extracts", exsentences: "14", explaintext: "1", exsectionformat: "plain", redirects: "1", titles: hit.title }), 10000);
    if (!res.ok) continue;
    const page = Object.values((await res.json()).query?.pages || {})[0];
    const text = (page?.extract || "").replace(/\n+[A-Z][^.\n]{0,60}\n/g, "\n").replace(/\s+/g, " ");
    const text2 = dropParentheticals(text).replace(/\s*\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
    if (!text2 || /may refer to/i.test(text)) continue;
    const all = sentencesOf(text2).map((x) => x.trim());
    const sentences = [];
    let prevKept = false;
    all.forEach((x, i) => {
      const n = x.split(/\s+/).length;
      const max = i === 0 ? 48 : 34;   // always try to keep the defining first sentence
      const dangling = /^(This|These|That|Those|Such|It|They)\b/.test(x) && !prevKept;   // refers to a dropped sentence
      prevKept = n >= 6 && n <= max && !dangling && !/[;{}=]|\b(?:see also|citation)\b/i.test(x);
      if (prevKept) sentences.push(x);
    });
    // A defining first sentence that's too long ("A mortgage loan or simply mortgage, in civil law jurisdictions
    // known also as …, is a loan used …") is trimmed to its core instead of being dropped.
    if (all[0] && sentences[0] !== all[0]) { const d = trimDefinition(all[0]); if (d) sentences.unshift(d); }
    if (sentences.length >= 2) {
      // "Compound interest or anatocism is …" -> "Compound interest is …"
      sentences[0] = sentences[0].replace(/^([A-Z][\w '-]{2,40}?),? (?:or|also known as|also called) [\w' -]{2,30}?,? (is|are|refers to)\b/, "$1 $2");
      return { title: page.title, sentences, url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(page.title.replaceAll(" ", "_")) };
    }
  }
  return null;
}
