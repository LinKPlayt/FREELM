"""Builds the Idea Lab's offline research library (app/ai/data/library.json).

Runs once at build time, on a computer, and the result ships with the app: on the phone,
research uses only this file and never connects to anything.

Source: the open Wikipedia dataset on Hugging Face (wikimedia/wikipedia, English, 41 parquet
files, ~12 GB), streamed one file at a time. No API keys and no Wikipedia API rate limits.
Articles about finance, business and economics are picked by how densely their opening
section uses the vocabulary of each niche. Two files come out:
  library.json   every article's title, niches and opening sentences (the search index, loaded at start)
  depth/NNN.json the article bodies, section by section (History, How it works, Criticism, ...),
                 split into small shards the phone loads only when research goes deep.

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
SIMPLE = "https://huggingface.co/datasets/wikimedia/wikipedia/resolve/main/20231101.simple/train-00000-of-00001.parquet"
FILES = 41
DEPTH = ROOT / "app" / "ai" / "data" / "depth"
PER_NICHE, TOTAL, MIN_SCORE = 6000, 20000, 3
SHARD = 100                       # articles per depth shard
MAX_BODY, MAX_PER_SECTION = 40, 6  # body sentences kept per article / per section

LEXICON = {
    "personal finance": ["consumer debt", "credit union", "certificate of deposit", "health savings account", "estate planning", "wealth management", "financial literacy", "household income", "cost of living", "paycheck", "minimum wage", "consumer protection", "bankruptcy", "life insurance", "health insurance", "car loan", "home equity", "personal loan", "money management", "personal finance", "budget", "saving", "savings account", "debt", "credit card", "credit score", "credit report",
                         "loan", "mortgage", "retirement", "pension", "insurance", "income tax", "tax return", "bank account", "interest rate",
                         "financial planning", "consumer credit", "annuity", "payday", "overdraft", "frugal", "emergency fund", "401(k)",
                         "individual retirement account", "social security", "net worth", "checking account", "student loan"],
    "investing": ["stock market index", "asset class", "capital gains", "return on investment", "risk management", "financial market", "commodity", "futures contract", "investment bank", "investment fund", "pension fund", "sovereign wealth fund", "trading strategy", "technical analysis", "fundamental analysis", "price–earnings ratio", "market maker", "bull market", "bear market", "yield", "stock market", "stock exchange", "shares", "shareholder", "investor", "investment", "portfolio", "mutual fund",
                  "index fund", "exchange-traded fund", "bond", "dividend", "hedge fund", "asset management", "equity", "securities",
                  "s&p 500", "nasdaq", "dow jones", "market capitalization", "initial public offering", "venture capital",
                  "private equity", "valuation", "short selling", "options trading", "derivative", "brokerage", "value investing", "stock"],
    "crypto": ["crypto", "decentralized", "cryptographic", "token", "mining pool", "distributed ledger", "web3", "initial coin offering", "satoshi", "dogecoin", "litecoin", "solana", "tether", "binance", "coinbase", "consensus mechanism", "hash rate", "digital asset", "cryptocurrency", "cryptocurrencies", "bitcoin", "blockchain", "ethereum", "crypto exchange", "crypto market", "stablecoin", "decentralized finance", "non-fungible token",
               "digital currency", "cryptocurrency exchange", "smart contract", "proof of work", "proof of stake", "crypto wallet", "altcoin"],
    "economy": ["economy", "economic policy", "labour market", "labor market", "wages", "productivity", "supply and demand", "trade policy", "balance of payments", "sovereign debt", "stimulus", "austerity", "economic history", "keynesian", "monetarism", "money supply", "consumer price index", "purchasing power", "great depression", "financial regulation", "banking crisis", "stagflation", "inflation", "recession", "gross domestic product", "gdp", "central bank", "monetary policy", "fiscal policy",
                "unemployment", "federal reserve", "interest rates", "trade deficit", "tariff", "financial crisis", "economic bubble",
                "depression", "deflation", "economic growth", "exchange rate", "national debt", "economist", "macroeconomic", "currency"],
    "real estate": ["real property", "rental", "apartment", "home buyer", "zoning", "property management", "commercial property", "housing bubble", "mortgage-backed", "real estate agent", "appraisal", "eviction", "affordable housing", "condominium", "real estate", "housing market", "mortgage", "property", "landlord", "rent", "homeownership", "home ownership",
                    "real estate investment trust", "house prices", "housing", "property tax", "tenant", "foreclosure", "down payment"],
    "side hustles": ["self-employment", "small business", "independent contractor", "online business", "content creator", "influencer", "crowdfunding", "franchise", "retail", "marketing", "sales", "e-commerce platform", "remote work", "business plan", "startup company", "microenterprise", "etsy", "patreon", "youtube channel", "online shopping", "entrepreneur", "small business", "freelance", "freelancer", "startup", "start-up", "gig economy", "self-employ",
                     "e-commerce", "online marketplace", "creator economy", "passive income", "side job", "dropshipping",
                     "affiliate marketing", "business model", "sole proprietorship"],
}
TITLE_WORDS = re.compile(r"\b(financ|money|bank|stock|bond|fund|invest|tax|debt|credit|loan|mortgage|budget|saving|pension|retire|"
                         r"insurance|cryptocurrenc|bitcoin|blockchain|inflation|recession|econom|market|trade|currency|dollar|price|"
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
    "Capital gains tax", "Inflation targeting", "Stagflation", "Deflation", "Supply and demand", "Opportunity cost", "Time value of money",
    "Present value", "Annual percentage rate", "Amortization (accounting)", "Fixed-rate mortgage", "Adjustable-rate mortgage",
    "Home insurance", "Life insurance", "Health insurance", "Term life insurance", "Whole life insurance", "Bankruptcy",
    "Chapter 7, Title 11, United States Code", "Debt consolidation", "Debt-to-income ratio", "Credit card interest", "FICO",
    "Equifax", "Experian", "TransUnion", "Social Security (United States)", "Medicare (United States)", "Traditional IRA",
    "Required minimum distribution", "Target date fund", "Bond fund", "Municipal bond", "Corporate bond", "High-yield debt",
    "Treasury Inflation-Protected Securities", "Stock market crash", "Bear market", "Bull market", "Market timing", "Day trading",
    "Options (finance)", "Futures contract", "Commodity market", "Gold as an investment", "Silver as an investment", "Forex",
    "Foreign exchange market", "Cryptocurrency wallet", "Cryptocurrency exchange", "Bitcoin mining", "Blockchain", "Proof of stake",
    "Proof of work", "Decentralized finance", "Non-fungible token", "Tether (cryptocurrency)", "Dogecoin", "Binance", "Coinbase",
    "FTX", "Terra (blockchain)", "Central bank digital currency", "Monetary policy", "Fiscal policy", "Money supply", "Unemployment",
    "Minimum wage", "Wage", "Tariff", "Trade war", "National debt of the United States", "Federal Reserve Board of Governors",
    "European Central Bank", "Bank run", "Silicon Valley Bank", "Lehman Brothers", "Subprime mortgage crisis", "Housing bubble",
    "Real estate bubble", "Landlord", "Renting", "Rent control", "Property management", "House flipping", "Real estate agent",
    "Gig economy", "Creator economy", "Influencer marketing", "Etsy", "Patreon", "Crowdfunding", "Franchising", "Business plan",
    "Sole proprietorship", "Limited liability company", "Self-employment", "Independent contractor", "Side job",
]
SKIP_TITLE = re.compile(r"^(List of|Lists of|Index of|Outline of|Glossary of|Timeline of|Bibliography of)|\(disambiguation\)|\b(season|episode|album|song|film|novel|footballer)\b", re.I)
NOT_FINANCE_PERSON = re.compile(r"\b(politician|footballer|actor|actress|singer|musician|rapper|player|novelist|poet|painter|soldier|"
                                r"bishop|priest|athlete|cricketer|wrestler|boxer|composer|director|journalist|judge|lawyer|physician)\b", re.I)
ANY_TERM = "|".join(re.escape(t) for terms in LEXICON.values() for t in terms)


ABBREV = re.compile(r"\b(U\.S|U\.K|U\.N|E\.U|Inc|Corp|Co|Ltd|Jr|Sr|Mr|Mrs|Ms|Dr|St|vs|No|Gen|Gov|Sen|Rep|approx|e\.g|i\.e)\.$", re.I)


def drop_parentheticals(text: str) -> str:
    """Removes asides in parentheses, but keeps codes like 401(k), 403(b) and 501(c)(3)."""
    for _ in range(3):
        text = re.sub(r"(\d|\u2039[a-z0-9]{1,2}\u203a)\(([a-z0-9]{1,2})\)", "\\1\u2039\\2\u203a", text)
    text = re.sub(r"\s*\([^()]*(?:\([^()]*\)[^()]*)*\)", "", text)
    return text.replace("\u2039", "(").replace("\u203a", ")")


def split_sentences(text: str) -> list[str]:
    """Sentences, without breaking after abbreviations like "U.S." or "Inc."."""
    out: list[str] = []
    for part in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"“])", text):
        if out and ABBREV.search(out[-1]):
            out[-1] += " " + part
        else:
            out.append(part)
    return out


def intro_of(text: str) -> str:
    """The article's opening section: paragraphs before the first heading-like line."""
    out = []
    for para in text.split("\n"):
        p = para.strip()
        if not p:
            continue
        if len(p) < 60 and not p.endswith((".", "!", "?", ":")):
            if not out:      # sidebar captions before the text ("Part of a series on …"): skip
                continue
            break            # a section heading: the opening section has ended
        out.append(p)
        if sum(len(x) for x in out) > 2500:
            break
    return " ".join(out)


def sentences_of(intro: str) -> list[str]:
    text = drop_parentheticals(intro)
    text = re.sub(r"\s*\[[^\]]*\]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    parts = split_sentences(text)
    out = []
    for s in parts:
        s = s.strip()
        if len(s.split()) > 45 and ";" in s:          # long definitions: split at semicolons
            head, *rest = [x.strip() for x in s.split(";") if x.strip()]
            pieces = [head.rstrip(",") + "."] + [r[0].upper() + r[1:].rstrip(".") + "." for r in rest]
        else:
            pieces = [s]
        out += [x for x in pieces if 5 <= len(x.split()) <= 70]
    return out[:10]


SKIP_SECTION = re.compile(r"^(See also|References|Notes|External links|Further reading|Bibliography|Sources|Citations|Footnotes|"
                          r"Works cited|In popular culture|Gallery|Literature|Filmography|Discography|Awards|Explanatory notes|"
                          r"Notes and references|Primary sources|Secondary sources)\b", re.I)
# Signs a sentence lost words when the dataset stripped templates (numbers, units, foreign words):
# "from , a late Latin word", "rose to  percent", "()" -- these could misstate facts, so they're dropped.
BROKEN = re.compile(r"\s[,.;:%]|\(\s*\)|\s{2,}|\b(to|of|from|was|were|is|by|at|about|nearly|over|under|than|and|or) (percent|per cent|million|billion|trillion)\b|"
                    r"\$\s|^\W|\b(and|or|of|the|a|an|to|in)\.$|\bwhich\b\.$")
LOST_NUMBER = re.compile(r"\b(?:(?:equal to|equivalent to|approximately|nearly|roughly|totaling|totalling|an estimated) (?:US\$ ?|\$ ?)?(?:million|billion|trillion|thousand|hundred|percent|per cent|dollars|euros|pounds|yen|people|users|bitcoins?|ether|units|tons|tonnes|years|months|days|employees|members|times|shares|households|workers)|(?:valued at|reached|around|about|some|over|under|than|by|of|the|out of the|to|from) (?:US\$ ?|\$ ?)?(?:million|billion|trillion|percent|per cent)(?! of\b))\b")
POINTER = re.compile(r"\b(shown below|see below|as follows|the following|listed below|in the table|this table|the figure|shown above|see above)\b", re.I)
LISTY = re.compile(r"^(This|These|That|Those|Such|It|Its|They|Their|He|She|His|Her)\b")
DEMONSTRATIVE = re.compile(r"\b(this|these|those|such|the latter|the former|the same)\s+[a-z]+", re.I)
WORTH = re.compile(r"\b(1[5-9]\d\d|20\d\d)\b|\d|%|percent|million|billion|because|means|allows|requires|risk|cost|fee|tax|interest|return", re.I)


def clean_sentence(s: str) -> str | None:
    s = s.strip()
    n = len(s.split())
    if n < 6 or n > 40 or BROKEN.search(s) or LOST_NUMBER.search(s) or POINTER.search(s) or not s.endswith((".", "!", "?")) or "\n" in s:
        return None
    if re.search(r"[=|{}<>\[\]]|https?:|\bISBN\b|\bp\.\s?\d", s):
        return None
    return s


def body_of(text: str, intro: set[str]) -> list:
    """The article body after the opening section: [[heading, [sentences]], ...]."""
    sections, heading, paras = [], None, []
    started = False
    for para in text.split("\n"):
        p = para.strip()
        if not p:
            continue
        if len(p) < 100 and not p.endswith((".", "!", "?", ":", '"', "”")) and "." not in p:
            if started or paras:
                sections.append((heading, paras))
            heading, paras, started = p, [], True
            continue
        if started:
            paras.append(p)
    if started:
        sections.append((heading, paras))
    out, total = [], 0
    for h, ps in sections:
        if not h or SKIP_SECTION.search(h) or not ps:
            continue
        text_ = drop_parentheticals(" ".join(ps))
        text_ = re.sub(r"\s*\[[^\]]*\]", "", text_)
        parts = split_sentences(re.sub(r"[ \t]+", " ", text_).strip())
        cands = [(i, c) for i, c in ((i, clean_sentence(x)) for i, x in enumerate(parts)) if c and c not in intro]
        # Prefer informative sentences (numbers, dates, causes), but keep their original order.
        if len(cands) > MAX_PER_SECTION:
            ranked = sorted(range(len(cands)), key=lambda k: (-bool(WORTH.search(cands[k][1])), k))[:MAX_PER_SECTION]
            cands = [cands[k] for k in sorted(ranked)]
        # A sentence that leans on the one before it ("It…", "this standard") stays only if that one stayed.
        kept, prev = [], -2
        for i, c in cands:
            if (LISTY.search(c) or DEMONSTRATIVE.search(c)) and prev != i - 1:
                continue
            kept.append(c)
            prev = i
        if kept:
            out.append([h[:60], kept])
            total += len(kept)
        if total >= MAX_BODY:
            break
    return out


TERM_NICHES: dict[str, list[str]] = {}
for _n, _terms in LEXICON.items():
    for _t in _terms:
        TERM_NICHES.setdefault(_t, []).append(_n)
# One combined whole-word pattern (much faster than one regex per term).
ALL_TERMS_RE = re.compile(r"(?<![a-z])(" + "|".join(re.escape(t) for t in sorted(TERM_NICHES, key=len, reverse=True)) + r")(?:s|es)?(?![a-z])")
COMPANY = re.compile(r"^[^.]{0,160}\b(?:is|was) an? [^.]{0,80}?\b(company|firm|corporation|conglomerate|bank|group|plc|holding|subsidiary|brand)\b", re.I)
BIG_ECONOMIES = ("United States", "China", "Japan", "India", "Germany", "United Kingdom", "France", "Canada", "Brazil", "Russia", "Australia")


def score(title: str, intro: str) -> tuple[float, list[str]]:
    low = intro[:1800].lower()
    niche_hits = {n: 0 for n in LEXICON}
    for term in set(ALL_TERMS_RE.findall(low)):                                  # distinct whole-word terms
        for n in TERM_NICHES[term]:
            niche_hits[n] += 1
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
        part = WORK / f"body-{i:02d}.json"
        if part.exists():                                   # resume
            candidates.update(json.loads(part.read_text()))
            continue
        path = WORK / "current.parquet"
        t0 = time.time()
        if i == 0 and (ROOT / ".cache" / "wikipedia2" / "p00.parquet").exists():
            (ROOT / ".cache" / "wikipedia2" / "p00.parquet").rename(path)
        else:
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
            if (s < MIN_SCORE or not niches) and not is_must:
                continue
            sents = sentences_of(intro)
            if len(sents) < (1 if is_must else 2):
                continue
            found[title] = {"t": title, "n": niches, "s": sents, "b": body_of(text, set(sents)), "score": s + (100 if is_must else 0)}
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
    # Fallback for core topics the English dataset didn't yield: Simple English Wikipedia (one file).
    missing = [t for t in MUST_HAVE if t not in chosen]
    if missing:
        simple = WORK / "simple.parquet"
        if not simple.exists():
            subprocess.run(["curl", "-sfL", "--retry", "5", "-o", str(simple), SIMPLE], check=True)
        table = pq.read_table(simple, columns=["title", "text"])
        rows = table.filter(pc.is_in(table["title"], value_set=__import__("pyarrow").array(missing))).to_pylist()
        for row in rows:
            intro = intro_of(row["text"])
            sents = sentences_of(intro)
            if not sents:
                continue
            _, niches = score(row["title"], intro)
            chosen[row["title"]] = {"t": row["title"], "n": niches or ["economy"], "s": sents, "b": body_of(row["text"], set(sents)), "score": 100}
        print(f"Simple English fallback added: {[r['title'] for r in rows]}", file=sys.stderr)
    ordered = sorted(chosen.values(), key=lambda a: a["t"])
    articles = [{"t": a["t"], "n": a["n"], "s": a["s"]} for a in ordered]
    # Depth shards: shard k holds articles k*SHARD .. k*SHARD+SHARD-1 (same order as library.json).
    if DEPTH.exists():
        for f in DEPTH.glob("*.json"):
            f.unlink()
    DEPTH.mkdir(parents=True, exist_ok=True)
    body_count = 0
    for k in range(0, len(ordered), SHARD):
        chunk = [a.get("b") or [] for a in ordered[k:k + SHARD]]
        body_count += sum(len(sents) for b in chunk for _, sents in b)
        (DEPTH / f"{k // SHARD:03d}.json").write_text(json.dumps(chunk, ensure_ascii=False, separators=(",", ":")))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "built": time.strftime("%Y-%m-%d"),
        "source": "Wikipedia (https://en.wikipedia.org), opening sections, via the wikimedia/wikipedia dataset (20231101.en)",
        "license": "Text is from Wikipedia and is licensed CC BY-SA (https://creativecommons.org/licenses/by-sa/4.0/). "
                   "Each article's title identifies its source page at https://en.wikipedia.org/wiki/<title>.",
        "depth": {"dir": "depth", "shard": SHARD, "sentences": body_count},
        "articles": articles,
    }, ensure_ascii=False, separators=(",", ":")))
    missing = [t for t in MUST_HAVE if t not in chosen]
    print(f"Depth: {body_count} body sentences in {len(list(DEPTH.glob('*.json')))} shards", file=sys.stderr)
    print(f"Wrote {OUT}: {len(articles)} articles ({OUT.stat().st_size / 1e6:.1f} MB); per niche {per}; "
          f"must-haves missing: {missing}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
