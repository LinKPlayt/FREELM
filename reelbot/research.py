"""Research: free, keyless public sources only.

* Headlines   - Google News RSS search + publisher RSS feeds (CNBC, MarketWatch, CoinDesk...)
* Background  - Wikipedia's public page-summary endpoint
* Market data - Yahoo Finance's public chart endpoint (no key, no account)
"""
from __future__ import annotations

import html
import logging
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote

from . import net

log = logging.getLogger(__name__)

# --------------------------------------------------------------------------- headlines

GOOGLE_NEWS = "https://news.google.com/rss/search?q={q}+when:2d&hl=en-US&gl=US&ceid=US:en"

NICHE_NEWS = {
    "personal finance": {
        "queries": ["personal finance", "mortgage rates", "credit card debt", "savings rates", "social security"],
        "feeds": ["https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=21324812"],
        "keywords": ["savings", "credit", "debt", "mortgage", "rent", "budget", "retire", "tax", "loan",
                     "consumer", "prices", "wage", "paycheck", "social security", "insurance", "bank"],
    },
    "investing": {
        "queries": ["stock market today", "S&P 500", "Nasdaq", "earnings report"],
        "feeds": [
            "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069",
            "https://feeds.content.dowjones.io/public/rss/mw_topstories",
        ],
        "keywords": ["stock", "shares", "s&p", "nasdaq", "dow", "earnings", "investor", "market", "etf",
                     "rally", "fund", "dividend", "ipo", "bond", "yield"],
    },
    "crypto": {
        "queries": ["bitcoin", "crypto market", "ethereum"],
        "feeds": ["https://www.coindesk.com/arc/outboundfeeds/rss/", "https://cointelegraph.com/rss"],
        "keywords": ["bitcoin", "crypto", "ethereum", "blockchain", "token", "stablecoin", "etf", "coin",
                     "solana", "sec", "exchange"],
    },
    "economy": {
        "queries": ["federal reserve", "inflation report", "jobs report", "US economy"],
        "feeds": ["https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258"],
        "keywords": ["fed", "inflation", "economy", "jobs", "gdp", "rates", "tariff", "recession",
                     "unemployment", "consumer", "treasury", "prices"],
    },
    "side hustles": {
        "queries": ["side hustle", "gig economy", "small business", "freelance income"],
        "feeds": ["https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=44877279"],
        "keywords": ["side hustle", "gig", "freelance", "small business", "entrepreneur", "income",
                     "creator", "startup", "work"],
    },
    "real estate": {
        "queries": ["housing market", "mortgage rates", "home prices", "rent prices"],
        "feeds": ["https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000115"],
        "keywords": ["housing", "home", "mortgage", "rent", "real estate", "property", "buyers",
                     "landlord", "reit", "construction"],
    },
}

REPUTABLE = ("reuters", "associated press", "ap news", "cnbc", "bloomberg", "wall street journal", "wsj",
             "marketwatch", "yahoo finance", "cnn", "new york times", "financial times", "barron", "forbes",
             "fox business", "axios", "bbc", "the guardian", "investopedia", "coindesk", "cointelegraph",
             "business insider", "fortune", "npr", "washington post", "the economist", "kiplinger",
             "nerdwallet", "bankrate", "search.cnbc.com", "feeds.content.dowjones.io", "www.coindesk.com")

_TAG_RE = re.compile(r"<[^>]+>")


def _clean(text: str) -> str:
    text = html.unescape(_TAG_RE.sub(" ", text or ""))
    return re.sub(r"\s+", " ", text).strip()


def _parse_feed(xml_text: str, source_hint: str) -> list[dict]:
    items = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return items
    for item in root.iter("item"):
        title = _clean(item.findtext("title", ""))
        if not title:
            continue
        source = _clean(item.findtext("source", "")) or source_hint
        # Google News appends " - Publisher" to every title.
        if " - " in title and source_hint == "Google News":
            title, _, pub = title.rpartition(" - ")
            source = source or pub
        published = None
        if item.findtext("pubDate"):
            try:
                published = parsedate_to_datetime(item.findtext("pubDate"))
                if published.tzinfo is None:
                    published = published.replace(tzinfo=timezone.utc)
            except (TypeError, ValueError):
                pass
        summary = _clean(item.findtext("description", ""))
        if summary.lower().startswith(title.lower()[:40]):
            summary = ""  # Google News descriptions just repeat the title
        items.append({
            "title": title.strip(),
            "summary": summary,
            "source": source,
            "link": (item.findtext("link") or "").strip(),
            "published": published,
        })
    return items


def fetch_headlines(niche: str, max_age_hours: int = 48) -> list[dict]:
    """Collect recent, niche-relevant headlines, ranked by relevance and recency."""
    spec = NICHE_NEWS.get(niche.lower(), NICHE_NEWS["personal finance"])
    raw: list[dict] = []
    for q in spec["queries"]:
        resp = net.get(GOOGLE_NEWS.format(q=quote(q)))
        if resp is not None:
            raw += _parse_feed(resp.text, "Google News")
    for url in spec["feeds"]:
        resp = net.get(url)
        if resp is not None:
            raw += _parse_feed(resp.text, url.split("/")[2])

    now = datetime.now(timezone.utc)
    seen: set[str] = set()
    ranked = []
    for it in raw:
        key = re.sub(r"[^a-z0-9]", "", it["title"].lower())[:60]
        if key in seen or len(it["title"].split()) < 5:
            continue
        seen.add(key)
        age_h = (now - it["published"]).total_seconds() / 3600 if it["published"] else 24
        if age_h > max_age_hours:
            continue
        text = (it["title"] + " " + it["summary"]).lower()
        hits = sum(1 for k in spec["keywords"] if k in text)
        # Skip obvious clickbait / non-news formats that don't read well aloud.
        if re.search(r"\b(opinion|podcast|video|live updates|quiz|sponsored|deal of the day)\b", text):
            continue
        reputable = any(r in it["source"].lower() for r in REPUTABLE)
        # "Some Person: claim..." titles are usually social-media posts, not reporting.
        if not reputable and re.match(r"^[A-Z][a-z]+ [A-Z][a-z]+:", it["title"]):
            continue
        it["score"] = hits * 2 - age_h / 12 + (1 if it["summary"] else 0) + (4 if reputable else 0)
        ranked.append(it)
    ranked.sort(key=lambda x: x["score"], reverse=True)
    # Drop near-duplicates (same story from several outlets).
    def toks(t):
        return {w for w in re.findall(r"[a-z]{4,}", t.lower())}
    diverse: list[dict] = []
    for it in ranked:
        tk = toks(it["title"])
        if all(len(tk & toks(d["title"])) / max(1, min(len(tk), len(toks(d["title"])))) < 0.4 for d in diverse):
            diverse.append(it)
    ranked = diverse
    log.info("Found %d relevant headlines for '%s'", len(ranked), niche)
    return ranked


# --------------------------------------------------------------------------- Wikipedia

def wikipedia_summary(title: str) -> str:
    data = net.get_json(f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(title.replace(' ', '_'))}")
    if not data or data.get("type") == "disambiguation":
        return ""
    return _clean(data.get("extract", ""))


def first_sentence(text: str, max_words: int = 30) -> str:
    """Return the first sentence of a Wikipedia extract if it is short enough to speak."""
    text = re.sub(r"\s*\([^)]*\)", "", text)  # drop parentheticals (pronunciations, abbreviations)
    text = re.sub(r"\s*\[[^\]]*\]", "", text)
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z])", text.strip())
    if not parts:
        return ""
    sent = parts[0].strip()
    # "Compound interest or anatocism is ..." -> "Compound interest is ..."
    sent = re.sub(r"^([A-Z][\w '-]{2,40}?),? (?:or|also known as|also called) [\w' -]{2,30}?,? (is|are|refers to)\b",
                  r"\1 \2", sent)
    if 6 <= len(sent.split()) <= max_words:
        return sent
    return ""


# --------------------------------------------------------------------------- market data

MARKETS = {
    "^GSPC": "S&P 500",
    "^IXIC": "Nasdaq",
    "^DJI": "Dow Jones",
    "BTC-USD": "Bitcoin",
    "ETH-USD": "Ethereum",
    "GC=F": "Gold",
    "CL=F": "Oil",
    "^TNX": "10-year Treasury yield",
}

NICHE_MARKETS = {
    "personal finance": ["^GSPC", "GC=F", "^TNX"],
    "investing": ["^GSPC", "^IXIC", "^DJI"],
    "crypto": ["BTC-USD", "ETH-USD", "^GSPC"],
    "economy": ["^GSPC", "^TNX", "CL=F"],
    "side hustles": ["^GSPC", "BTC-USD", "GC=F"],
    "real estate": ["^TNX", "^GSPC", "GC=F"],
}


def market_series(symbol: str, range_: str = "3mo") -> dict | None:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{quote(symbol)}"
    data = net.get_json(url, params={"range": range_, "interval": "1d"})
    try:
        res = data["chart"]["result"][0]
        closes = res["indicators"]["quote"][0]["close"]
        stamps = res["timestamp"]
    except (TypeError, KeyError, IndexError):
        return None
    pts = [(t, c) for t, c in zip(stamps, closes) if c is not None]
    if len(pts) < 10:
        return None
    values = [c for _, c in pts]
    last, prev = values[-1], values[-2]
    week = values[-6] if len(values) > 6 else values[0]
    month = values[-22] if len(values) > 22 else values[0]
    return {
        "symbol": symbol,
        "name": MARKETS.get(symbol, res["meta"].get("shortName", symbol)),
        "values": values,
        "dates": [datetime.fromtimestamp(t, timezone.utc) for t, _ in pts],
        "last": last,
        "day_pct": (last / prev - 1) * 100,
        "week_pct": (last / week - 1) * 100,
        "month_pct": (last / month - 1) * 100,
        "period_pct": (last / values[0] - 1) * 100,
        "is_yield": symbol == "^TNX",
        "fetched": time.time(),
    }


def market_snapshot(niche: str) -> list[dict]:
    out = []
    for sym in NICHE_MARKETS.get(niche.lower(), NICHE_MARKETS["investing"]):
        s = market_series(sym)
        if s:
            out.append(s)
    return out
