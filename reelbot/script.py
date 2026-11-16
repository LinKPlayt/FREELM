"""Turns research into a short spoken script (hook -> points -> call to action).

No paid AI is needed: scripts are assembled from the curated topic library, live headlines and
market data using templates. If you run Ollama locally (free), it can rewrite scripts instead.
"""
from __future__ import annotations

import json
import logging
import random
import re
from dataclasses import dataclass, field
from datetime import datetime

from . import net, research, topics

log = logging.getLogger(__name__)


# --------------------------------------------------------------------------- data model

@dataclass
class Line:
    text: str                      # what appears in captions
    visual: str = ""               # media search query for this scene
    kind: str = "media"            # media | chart | outro
    chart: dict | None = None      # market series for chart scenes

    @property
    def spoken(self) -> str:
        return speakable(self.text)


@dataclass
class Script:
    kind: str                      # evergreen | news | market
    topic_id: str
    title: str
    niche: str
    lines: list[Line]
    extras: list[Line] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)

    @property
    def text(self) -> str:
        return " ".join(l.text for l in self.lines)

    def word_count(self) -> int:
        return len(self.text.split())


# --------------------------------------------------------------------------- speech normalisation

_ACRONYMS = {
    "ETF": "E T F", "ETFs": "E T Fs", "IRA": "I R A", "IRAs": "I R As", "IPO": "I P O", "GDP": "G D P",
    "CPI": "C P I", "PCE": "P C E", "SEC": "S E C", "FDIC": "F D I C", "AI": "A I", "US": "U S",
    "U.S.": "U S", "USD": "U S dollars", "CEO": "C E O", "CFO": "C F O", "EV": "E V", "EVs": "E Vs",
    "IRS": "I R S", "ECB": "E C B", "FOMC": "F O M C", "NFT": "N F T", "NFTs": "N F Ts", "DCA": "D C A",
    "BTC": "bitcoin", "ETH": "ether", "Q1": "first quarter", "Q2": "second quarter", "Q3": "third quarter",
    "Q4": "fourth quarter", "YoY": "year over year", "401k": "four oh one k", "401(k)": "four oh one k",
    "S&P": "S and P", "vs.": "versus", "vs": "versus", "approx.": "approximately", "UK": "U K",
    "EU": "E U", "OPEC": "oh peck", "REIT": "reet", "REITs": "reets", "FICO": "fyco", "HYSA": "high yield savings",
}
_SCALE = {"k": "thousand", "m": "million", "mn": "million", "b": "billion", "bn": "billion", "t": "trillion", "tn": "trillion"}


def _money(match: re.Match) -> str:
    num, scale = match.group(1), (match.group(2) or match.group(3) or "").lower()
    word = _SCALE.get(scale, scale)
    unit = "dollar" if num in ("1", "1.0") and not word else "dollars"
    return f"{num} {word} {unit}".replace("  ", " ")


def speakable(text: str) -> str:
    """Rewrite text so an offline TTS engine pronounces finance jargon correctly."""
    t = text
    t = re.sub(r"\$(\d[\d,]*(?:\.\d+)?)(?:\s?(trillion|billion|million|thousand)|(tn|bn|mn|[kmbt]))?\b", _money, t, flags=re.I)
    t = re.sub(r"(\d)\s?%", r"\1 percent", t)
    t = re.sub(r"(\d)\s?bps\b", r"\1 basis points", t)
    t = t.replace("S&P", "S and P").replace("&", " and ")
    t = re.sub(r"\b401\(?k\)?", "four oh one k", t, flags=re.I)
    words = []
    for w in t.split():
        core = w.strip(",.!?;:\"'()")
        rep = _ACRONYMS.get(core)
        words.append(w.replace(core, rep) if rep else w)
    t = " ".join(words)
    t = re.sub(r"\s+", " ", t).strip()
    return t


# --------------------------------------------------------------------------- shared helpers

HEADLINE_VISUALS = [
    (r"\bfed\b|federal reserve|powell|rate cut|rate hike|interest rate", "federal reserve building"),
    (r"inflation|\bcpi\b|consumer prices", "grocery store prices"),
    (r"mortgage|home ?buyer|housing|home prices", "suburban house"),
    (r"\brent\b|renters|landlord", "apartment building"),
    (r"bitcoin|\bbtc\b", "bitcoin"),
    (r"ethereum|\bether\b", "ethereum"),
    (r"crypto|token|blockchain|stablecoin", "cryptocurrency coins"),
    (r"\boil\b|opec|crude", "oil rig"),
    (r"\bgold\b", "gold bars"),
    (r"gas prices|gasoline", "gas station"),
    (r"tesla|electric vehicle|\bev\b", "electric car"),
    (r"nvidia|chip|semiconductor", "computer chip"),
    (r"\bai\b|artificial intelligence|data center", "data center"),
    (r"amazon|retail|walmart|target|holiday shopping", "shopping mall"),
    (r"bank|jpmorgan|wells fargo|citi", "bank building"),
    (r"jobs|employment|payroll|layoff|hiring|unemploy", "office workers"),
    (r"tariff|trade|import|export|china", "shipping containers port"),
    (r"student loan|college|tuition", "university graduation"),
    (r"credit card", "credit card"),
    (r"\btax|\birs\b", "tax forms"),
    (r"retire|social security|401|pension", "retirement couple"),
    (r"\bcar\b|auto|vehicle", "car dealership"),
    (r"earnings|profit|revenue|quarter", "stock chart"),
    (r"stock|s&p|nasdaq|\bdow\b|wall street|shares|market", "new york stock exchange"),
    (r"small business|entrepreneur|startup", "small business shop"),
    (r"freelanc|gig|side hustle|creator", "laptop freelancer"),
]


def visual_for(text: str, niche: str) -> str:
    low = text.lower()
    for pattern, visual in HEADLINE_VISUALS:
        if re.search(pattern, low):
            return visual
    return random.choice(topics.generic_visuals(niche))


def _shorten_headline(title: str, max_words: int = 18) -> str:
    title = re.sub(r"\s*[|:]\s*(CNBC|MarketWatch|Reuters|Bloomberg|Yahoo Finance).*$", "", title, flags=re.I)
    title = re.sub(r"\s*[:(]\s*\(?(?:NYSE|NASDAQ)?:?\s*[A-Z]{2,5}(?:,\s*[A-Z]{2,5})*\)?\s*$", "", title)  # trailing tickers
    title = title.replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"')
    words = title.split()
    if len(words) > max_words:
        title = " ".join(words[:max_words]).rstrip(",;:-") + "..."
    title = title.rstrip(" .")
    return title + ("" if title.endswith(("?", "!", "...")) else ".")


def _pct(v: float) -> str:
    return f"{abs(v):.1f}%"


def _price(s: dict) -> str:
    v = s["last"]
    if s["is_yield"]:
        return f"{v:.2f}%"
    if s["symbol"] in ("BTC-USD", "ETH-USD", "GC=F", "CL=F"):
        return f"${v:,.0f}" if v >= 100 else f"${v:,.2f}"
    return f"{v:,.0f}" if v >= 1000 else f"{v:,.2f}"


def _cta(cfg: dict) -> Line:
    return Line(cfg["video"]["call_to_action"], kind="outro")


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


ORDINALS = ["First", "Second", "Third", "Fourth"]


# --------------------------------------------------------------------------- builders

def build_evergreen(topic: dict, cfg: dict) -> Script:
    niche = cfg["niche"]
    vis = list(topic["visuals"])
    lines = [Line(topic["hook"], vis[0])]
    for i, p in enumerate(topic["points"]):
        lines.append(Line(p, vis[(i + 1) % len(vis)]))
    lines.append(_cta(cfg))

    extras = [Line(e, vis[(i + 2) % len(vis)]) for i, e in enumerate(topic.get("extras", []))]
    sources = []
    if topic.get("wiki"):
        summary = research.wikipedia_summary(topic["wiki"])
        definition = research.first_sentence(summary)
        if definition:
            extras.append(Line(definition, vis[-1]))
            sources.append("https://en.wikipedia.org/wiki/" + topic["wiki"].replace(" ", "_"))
    return Script("evergreen", topic["id"], topic["title"], niche, lines, extras,
                  tags=list(topic.get("tags", [])), sources=sources)


def build_news(headlines: list[dict], markets: list[dict], cfg: dict) -> Script | None:
    niche = cfg["niche"]
    picks = headlines[:3]
    if len(picks) < 2:
        return None
    label = {"crypto": "crypto", "investing": "market", "economy": "economy",
             "real estate": "housing", "side hustles": "money"}.get(niche, "money")
    n = len(picks)
    hook = random.choice([
        f"Here are {n} {label} headlines you need to know today.",
        f"{n} {label} stories you missed today, in under a minute.",
        f"Your {label} news, fast. Here's what happened today.",
    ])
    lines = [Line(hook, visual_for(" ".join(p["title"] for p in picks), niche))]
    for i, item in enumerate(picks):
        lines.append(Line(f"{ORDINALS[i]}: {_shorten_headline(item['title'])}", visual_for(item["title"], niche)))

    joined = " ".join(p["title"] + " " + p["summary"] for p in picks).lower()
    why = _why_it_matters(joined)
    if why:
        lines.append(Line(why, visual_for(why, niche)))
    lines.append(_cta(cfg))

    extras = []
    if markets:
        s = markets[0]
        direction = "up" if s["day_pct"] >= 0 else "down"
        extras.append(Line(f"Meanwhile, the {s['name']} is {direction} {_pct(s['day_pct'])} today.", kind="chart", chart=s))
    if picks[0]["summary"]:
        sent = re.split(r"(?<=[.!?])\s+", picks[0]["summary"])[0]
        if 6 <= len(sent.split()) <= 24:
            extras.append(Line(sent, visual_for(sent, niche)))
    if len(headlines) > 3:
        extras.append(Line(f"And one more: {_shorten_headline(headlines[3]['title'])}", visual_for(headlines[3]["title"], niche)))

    date = datetime.now().strftime("%b %d").replace(" 0", " ")
    title = f"{n} {label.title()} Headlines You Need to Know ({date})"
    return Script("news", f"news-{_slug(niche)}-{datetime.now():%Y%m%d}", title, niche, lines, extras,
                  tags=[label + " news", niche, "finance news"],
                  sources=[p["link"] for p in picks if p.get("link")])


def _why_it_matters(text: str) -> str:
    rules = [
        (r"rate cut|cuts rates|lower rates", "Why it matters: lower rates can make borrowing cheaper, but savings yields often fall too."),
        (r"rate hike|raises rates|higher rates|hawkish", "Why it matters: higher rates make loans and credit cards pricier, but savers can earn more."),
        (r"inflation|prices", "Why it matters: when prices rise faster than your pay, your savings lose buying power."),
        (r"mortgage|housing|home prices", "Why it matters: small changes in mortgage rates can swing a monthly payment by hundreds."),
        (r"layoff|jobs|unemploy|hiring", "Why it matters: a shaky job market is the best reason to keep an emergency fund."),
        (r"tariff|trade war", "Why it matters: tariffs can push up prices on everyday goods."),
        (r"bitcoin|crypto", "Why it matters: crypto can swing hard both ways, so size your positions carefully."),
        (r"earnings|stock|shares|market", "Why it matters: headlines move markets daily, but long term investors win by staying the course."),
    ]
    for pattern, sentence in rules:
        if re.search(pattern, text):
            return sentence
    return "Why it matters: stay informed, but don't make big money moves on one headline."


def build_market(markets: list[dict], headlines: list[dict], cfg: dict) -> Script | None:
    niche = cfg["niche"]
    if len(markets) < 2:
        return None
    day = datetime.now().strftime("%A")
    lines = [Line(random.choice([
        f"Here's your {day} market check in under a minute.",
        f"What did the markets do today? Here's your quick {day} recap.",
    ]), "new york stock exchange")]
    for s in markets[:3]:
        d = "up" if s["day_pct"] >= 0 else "down"
        m = "up" if s["month_pct"] >= 0 else "down"
        if s["is_yield"]:
            text = f"The {s['name']} sits at {_price(s)}, {d} {abs(s['day_pct']):.1f}% on the day."
        else:
            text = f"The {s['name']} is at {_price(s)}, {d} {_pct(s['day_pct'])} today and {m} {_pct(s['month_pct'])} this month."
        lines.append(Line(text, kind="chart", chart=s))
    extras = []
    if headlines:
        lines.append(Line(f"In the news: {_shorten_headline(headlines[0]['title'])}", visual_for(headlines[0]["title"], niche)))
        if len(headlines) > 1:
            extras.append(Line(f"Also: {_shorten_headline(headlines[1]['title'])}", visual_for(headlines[1]["title"], niche)))
    lines.append(Line("Remember: daily moves are noise. Long term habits build wealth.", "coins stack growth"))
    lines.append(_cta(cfg))
    lead = markets[0]
    title = f"Market Check: {lead['name']} {'Up' if lead['day_pct'] >= 0 else 'Down'} {_pct(lead['day_pct'])} Today"
    return Script("market", f"market-{_slug(niche)}-{datetime.now():%Y%m%d}", title, niche, lines, extras,
                  tags=["stock market", "market recap", lead["name"]],
                  sources=[h["link"] for h in headlines[:2] if h.get("link")])


# --------------------------------------------------------------------------- optional local LLM

def rewrite_with_ollama(script: Script, cfg: dict) -> Script:
    """Ask a locally running Ollama model to rewrite the script. Falls back silently."""
    llm = cfg["llm"]
    if not llm.get("enabled") or script.kind == "market":
        return script
    notes = "\n".join(f"- {l.text}" for l in script.lines[:-1] + script.extras)
    prompt = (
        "You write scripts for 35-second vertical finance videos (YouTube Shorts).\n"
        f"Topic: {script.title}\nNiche: {script.niche}\nResearch notes:\n{notes}\n\n"
        "Write 5 to 6 short spoken sentences, 85 to 100 words total. Start with a scroll-stopping hook. "
        "Use plain language, no hashtags, no emojis, only facts from the notes. "
        'Respond ONLY with JSON: {"lines": [{"text": "...", "visual": "2-3 word stock photo search"}]}'
    )
    try:
        resp = net._session.post(f"{llm['url'].rstrip('/')}/api/generate", timeout=180, json={
            "model": llm["model"], "prompt": prompt, "stream": False, "format": "json",
            "options": {"temperature": 0.7},
        })
        resp.raise_for_status()
        data = json.loads(resp.json()["response"])
        new = [Line(str(l["text"]).strip(), str(l.get("visual") or "").strip() or visual_for(l["text"], script.niche))
               for l in data["lines"] if str(l.get("text", "")).strip()]
        words = sum(len(l.text.split()) for l in new)
        if not 50 <= words <= 130 or len(new) < 3:
            raise ValueError(f"unusable length ({words} words)")
        script.lines = new + [script.lines[-1]]
        log.info("Script rewritten by local LLM (%s)", llm["model"])
    except Exception as exc:  # noqa: BLE001
        log.info("Local LLM unavailable (%s); using built-in script.", exc)
    return script
