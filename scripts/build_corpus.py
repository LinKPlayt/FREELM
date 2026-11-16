"""Builds the Idea Lab's offline research library (app/ai/data/library.json).

Runs once at build time, on a computer, and the result ships with the app: on the phone,
research uses only this file and never connects to anything.

Source: the open Wikipedia dataset on Hugging Face (wikimedia/wikipedia, English, 41 parquet
files, ~12 GB), streamed one file at a time. No API keys and no Wikipedia API rate limits.
Articles about finance, business and economics are picked by how densely their opening
section uses the vocabulary of each niche; their opening sentences are kept.

Wikipedia text is licensed CC BY-SA; every article keeps its title, which identifies its page.

  python scripts/build_corpus.py            then    python scripts/embed_library.py
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from pathlib import Path

import pyarrow.compute as pc
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "ai" / "data" / "library.json"
WORK = ROOT / ".cache" / "wikipedia"
DATASET = "https://huggingface.co/datasets/wikimedia/wikipedia/resolve/main/20231101.en/train-{i:05d}-of-00041.parquet"
FILES = 41
PER_NICHE, TOTAL = 1500, 7500

LEXICON = {
    "personal finance": ["personal finance", "budget", "saving", "savings account", "debt", "credit card", "credit score", "credit report",
                         "loan", "mortgage", "retirement", "pension", "insurance", "income tax", "tax return", "bank account", "interest rate",
                         "financial planning", "consumer credit", "annuity", "payday", "overdraft", "frugal", "emergency fund", "401(k)",
                         "individual retirement account", "social security", "net worth", "checking account", "student loan"],
    "investing": ["stock market", "stock exchange", "shares", "shareholder", "investor", "investment", "portfolio", "mutual fund",
                  "index fund", "exchange-traded fund", "bond", "dividend", "hedge fund", "asset management", "equity", "securities",
                  "s&p 500", "nasdaq", "dow jones", "market capitalization", "initial public offering", "venture capital",
                  "private equity", "valuation", "short selling", "options trading", "derivative", "brokerage", "value investing", "stock"],
    "crypto": ["cryptocurrency", "bitcoin", "blockchain", "ethereum", "crypto", "stablecoin", "decentralized finance", "non-fungible token",
               "digital currency", "cryptocurrency exchange", "smart contract", "proof of work", "proof of stake", "crypto wallet", "altcoin"],
    "economy": ["inflation", "recession", "gross domestic product", "gdp", "central bank", "monetary policy", "fiscal policy",
                "unemployment", "federal reserve", "interest rates", "trade deficit", "tariff", "financial crisis", "economic bubble",
                "depression", "deflation", "economic growth", "exchange rate", "national debt", "economist", "macroeconomic", "currency"],
    "real estate": ["real estate", "housing market", "mortgage", "property", "landlord", "rent", "homeownership", "home ownership",
                    "real estate investment trust", "house prices", "housing", "property tax", "tenant", "foreclosure", "down payment"],
    "side hustles": ["entrepreneur", "small business", "freelance", "freelancer", "startup", "start-up", "gig economy", "self-employ",
                     "e-commerce", "online marketplace", "creator economy", "passive income", "side job", "dropshipping",
                     "affiliate marketing", "business model", "sole proprietorship"],
}
TITLE_WORDS = re.compile(r"\b(financ|money|bank|stock|bond|fund|invest|tax|debt|credit|loan|mortgage|budget|saving|pension|retire|"
                         r"insurance|crypto|bitcoin|blockchain|inflation|recession|econom|market|trade|currency|dollar|price|"
                         r"wealth|income|wage|rent|housing|real estate|business|entrepreneur|startup|capital|asset|dividend|interest)", re.I)
MUST_HAVE = [
    "Compound interest", "Rule of 72", "Dollar cost averaging", "Index fund", "Emergency fund", "Credit score in the United States",
    "Roth IRA", "401(k)", "Expense ratio", "Diversification (finance)", "Asset allocation", "Net worth", "Lifestyle creep",
    "Warren Buffett", "Charlie Munger", "Benjamin Graham", "John C. Bogle", "Peter Lynch", "Ray Dalio", "Satoshi Nakamoto",
    "Vitalik Buterin", "Stablecoin", "Wall Street crash of 1929", "Dot-com bubble", "2007–2008 financial crisis", "Black Monday (1987)",
    "GameStop short squeeze", "Tulip mania", "South Sea Company", "Great Depression", "Bretton Woods system", "Gold standard",
    "Hyperinflation", "Quantitative easing", "Federal funds rate", "Consumer price index", "Gross domestic product", "Yield curve",
    "Market trend", "Short (finance)", "Margin (finance)", "Price–earnings ratio", "Market capitalization", "Initial public offering",
    "Stock split", "Share repurchase", "Annuity", "Health savings account", "529 plan", "Certificate of deposit", "Money market fund",
    "United States Treasury security", "Series I bond", "Credit union", "Overdraft", "Buy now, pay later", "Payday loan",
    "Student loans in the United States", "Debt snowball method", "Financial independence, retire early", "Dropshipping",
    "Affiliate marketing", "Print on demand", "Sharing economy", "Gig worker", "Down payment", "Home equity", "Flipping",
    "Property tax", "Inflation", "Recession", "Bitcoin", "Ethereum", "Stock market", "Exchange-traded fund", "Mutual fund",
    "Real estate investment trust", "Mortgage loan", "Credit card", "Budget", "Pension", "Individual retirement account",
    "Federal Reserve", "Interest rate", "Dividend", "Bond (finance)", "S&P 500", "Nasdaq", "Dow Jones Industrial Average",
    "Venture capital", "Hedge fund", "Value investing", "Passive income", "Entrepreneurship", "Small business", "Freelancer",
]
SKIP_TITLE = re.compile(r"^(List of|Lists of|Index of|Outline of|Glossary of|Timeline of|Bibliography of)|\(disambiguation\)|\b(season|episode|album|song|film|novel|footballer)\b", re.I)
NOT_FINANCE_PERSON = re.compile(r"\b(politician|footballer|actor|actress|singer|musician|rapper|player|novelist|poet|painter|soldier|"
                                r"bishop|priest|athlete|cricketer|wrestler|boxer|composer|director|journalist|judge|lawyer|physician)\b", re.I)
ANY_TERM = "|".join(re.escape(t) for terms in LEXICON.values() for t in terms)


def intro_of(text: str) -> str:
    """The article's opening section: paragraphs before the first heading-like line."""
    out = []
    for para in text.split("\n"):
        p = para.strip()
        if not p:
            continue
        if len(p) < 60 and not p.endswith((".", "!", "?", ":")):   # a section heading
            break
        out.append(p)
        if sum(len(x) for x in out) > 2500:
            break
    return " ".join(out)


def sentences_of(intro: str) -> list[str]:
    text = re.sub(r"\s*\([^()]*(?:\([^()]*\)[^()]*)*\)", "", intro)   # drop parentheticals
    text = re.sub(r"\s*\[[^\]]*\]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"“])", text)
    return [s.strip() for s in parts if 5 <= len(s.split()) <= 45][:8]


TERM_RES = {n: [re.compile(r"(?<![a-z])" + re.escape(t) + r"(?:s|es)?(?![a-z])") for t in terms] for n, terms in LEXICON.items()}
COMPANY = re.compile(r"^[^.]{0,160}\b(?:is|was) an? [^.]{0,80}?\b(company|firm|corporation|conglomerate|bank|group|plc|holding|subsidiary|brand)\b", re.I)
BIG_ECONOMIES = ("United States", "China", "Japan", "India", "Germany", "United Kingdom", "France", "Canada", "Brazil", "Russia", "Australia")


def score(title: str, intro: str) -> tuple[float, list[str]]:
    low = intro[:1800].lower()
    niche_hits = {n: sum(1 for r in res if r.search(low)) for n, res in TERM_RES.items()}   # whole words only
    distinct = sum(niche_hits.values())
    niches = [n for n, c in niche_hits.items() if c >= 2] or ([max(niche_hits, key=niche_hits.get)] if distinct else [])
    s = distinct + (3 if TITLE_WORDS.search(title) else 0)
    if COMPANY.search(intro):                          # profiles of individual firms: keep, but after concepts
        s *= 0.6
    if title.startswith("Economy of") and not title.endswith(BIG_ECONOMIES):
        s -= 4
    if re.match(r"^\d{4}\b", title):                  # "1997 world oil market chronology" etc.
        s -= 3
    return s, niches


def main() -> int:
    WORK.mkdir(parents=True, exist_ok=True)
    must = {t.lower(): t for t in MUST_HAVE}
    candidates = {}
    for i in range(FILES):
        part = WORK / f"part-{i:02d}.json"
        if part.exists():                                   # resume
            candidates.update(json.loads(part.read_text()))
            continue
        path = WORK / "current.parquet"
        t0 = time.time()
        subprocess.run(["curl", "-sfL", "--retry", "5", "-o", str(path), DATASET.format(i=i)], check=True)
        table = pq.read_table(path, columns=["title", "text"])
        low = pc.utf8_lower(pc.utf8_slice_codeunits(table["text"], 0, 1800))
        mask = pc.or_(pc.match_substring_regex(low, ANY_TERM), pc.is_in(pc.utf8_lower(table["title"]), value_set=__import__("pyarrow").array(list(must))))
        found = {}
        for row in table.filter(mask).to_pylist():
            title, text = row["title"], row["text"]
            is_must = title.lower() in must
            if SKIP_TITLE.search(title) and not is_must:
                continue
            intro = intro_of(text)
            first = intro[:300]
            if "may refer to" in first:
                continue
            if NOT_FINANCE_PERSON.search(first) and not is_must:
                continue
            s, niches = score(title, intro)
            if (s < 4 or not niches) and not is_must:
                continue
            sents = sentences_of(intro)
            if len(sents) < 2:
                continue
            found[title] = {"t": title, "n": niches, "s": sents, "score": s + (100 if is_must else 0)}
        part.write_text(json.dumps(found))
        candidates.update(found)
        path.unlink(missing_ok=True)
        print(f"file {i + 1}/{FILES}: {len(found)} candidates ({len(candidates)} total) in {time.time() - t0:.0f}s", file=sys.stderr)

    ranked = sorted(candidates.values(), key=lambda a: -a["score"])
    chosen, per = {}, {n: 0 for n in LEXICON}
    for a in ranked:
        if a["score"] >= 100:                               # must-haves always go in
            chosen[a["t"]] = a
            continue
        if len(chosen) >= TOTAL:
            break
        open_niches = [n for n in a["n"] if per[n] < PER_NICHE]
        if not open_niches:
            continue
        chosen[a["t"]] = a
        for n in a["n"]:
            per[n] += 1
    articles = [{"t": a["t"], "n": a["n"], "s": a["s"]} for a in sorted(chosen.values(), key=lambda a: a["t"])]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "built": time.strftime("%Y-%m-%d"),
        "source": "Wikipedia (https://en.wikipedia.org), opening sections, via the wikimedia/wikipedia dataset (20231101.en)",
        "license": "Text is from Wikipedia and is licensed CC BY-SA (https://creativecommons.org/licenses/by-sa/4.0/). "
                   "Each article's title identifies its source page at https://en.wikipedia.org/wiki/<title>.",
        "articles": articles,
    }, ensure_ascii=False, separators=(",", ":")))
    missing = [t for t in MUST_HAVE if t not in chosen]
    print(f"Wrote {OUT}: {len(articles)} articles ({OUT.stat().st_size / 1e6:.1f} MB); per niche {per}; "
          f"must-haves missing: {missing}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
