// Research, done from the phone. Only public, keyless sources that browsers are allowed to call:
//   headlines   - CNBC and MarketWatch RSS feeds (fetched directly)
//   background  - Wikipedia page summaries (fetched directly)
//   market data - a small JSON snapshot this repository's scheduled job publishes (numbers only),
//                 because market-data sites don't allow direct calls from a web page.

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
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctl.signal }); } finally { clearTimeout(timer); }
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
    let sent = (text.split(/(?<=[.!?])\s+(?=[A-Z])/)[0] || "").trim();
    sent = sent.replace(/^([A-Z][\w '-]{2,40}?),? (?:or|also known as|also called) [\w' -]{2,30}?,? (is|are|refers to)\b/, "$1 $2");
    const wc = sent.split(/\s+/).length;
    return wc >= 6 && wc <= maxWords ? sent : "";
  } catch { return ""; }
}
