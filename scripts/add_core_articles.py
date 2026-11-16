"""Adds core articles the dataset pass missed (or only found in Simple English) to the research library.

Runs at build time, on a computer, after scripts/build_corpus.py and before scripts/embed_library.py.
It reads the current English Wikipedia text of each article through Wikipedia's public API (one
polite request per article, no key), splits it into the opening section and body sections the same
way build_corpus.py does, and writes them into app/ai/data/library.json and the depth shards.
On the phone nothing changes: research still uses only the files shipped with the app.

  python scripts/add_core_articles.py [extra titles...]
"""
from __future__ import annotations

import importlib.util
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("bc", ROOT / "scripts" / "build_corpus.py")
bc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bc)

API = "https://en.wikipedia.org/w/api.php?"
UA = "ReelBot-build/1.0 (https://github.com/LinKPlayt/FREELM)"
# Always refreshed from full English Wikipedia: the core of every niche.
CORE = bc.MUST_HAVE + [
    "Inflation", "Recession", "Gross domestic product", "Federal Reserve", "Unemployment", "Interest", "Money", "Bank",
    "Stock", "Tax", "Credit (finance)", "Economics", "Supply and demand", "Hyperinflation", "Stagflation", "Minimum wage",
    "Certificate of deposit", "Hedge fund", "Lehman Brothers", "Bank run", "Affiliate marketing", "Business plan",
    "Charlie Munger", "Franchising", "Sole proprietorship", "Term life insurance", "Annual percentage rate",
    "Foreign exchange market", "European Central Bank",
]


def fetch(title: str) -> tuple[str, str] | None:
    q = urllib.parse.urlencode({"action": "query", "format": "json", "prop": "extracts", "explaintext": "1",
                                "exsectionformat": "wiki", "redirects": "1", "titles": title})
    req = urllib.request.Request(API + q, headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                page = next(iter(json.load(r)["query"]["pages"].values()))
            text = page.get("extract") or ""
            return (page["title"], text) if text else None
        except Exception as e:                        # rate limits / network blips: back off and retry
            print(f"  retry {title}: {e}", file=sys.stderr)
            time.sleep(5 * (attempt + 1))
    return None


def as_dataset_text(text: str) -> str:
    """API headings ("== History ==") become plain short lines, like the dataset's."""
    return re.sub(r"^=+\s*(.*?)\s*=+\s*$", r"\1", text, flags=re.M)


def main() -> int:
    lib_path = ROOT / "app" / "ai" / "data" / "library.json"
    data = json.loads(lib_path.read_text())
    arts = data["articles"]
    index = {a["t"]: i for i, a in enumerate(arts)}
    shard_n = data["depth"]["shard"]
    depth_dir = ROOT / "app" / "ai" / "data" / data["depth"]["dir"]
    shards: dict[int, list] = {}

    def body_slot(i: int) -> tuple[list, int]:
        k = i // shard_n
        if k not in shards:
            f = depth_dir / f"{k:03d}.json"
            shards[k] = json.loads(f.read_text()) if f.exists() else []
        rows = shards[k]
        while len(rows) <= i % shard_n:
            rows.append([])
        return rows, i % shard_n

    # "--only T1 T2 …" fetches just those titles; otherwise the whole core list plus any extra titles.
    args = sys.argv[1:]
    titles = list(dict.fromkeys(args[1:] if args[:1] == ["--only"] else CORE + args))
    added = replaced = 0
    for t in titles:
        got = fetch(t)
        time.sleep(3.0)
        if not got:
            print(f"  not found: {t}", file=sys.stderr)
            continue
        title, raw = got
        text = as_dataset_text(raw)
        intro = bc.intro_of(text)
        sents = bc.sentences_of(intro)
        if not sents:
            print(f"  no usable sentences: {title}", file=sys.stderr)
            continue
        body = bc.body_of(text, set(sents))
        _, niches = bc.score(title, intro)
        entry = {"t": title, "n": niches or ["economy"], "s": sents}
        if title in index:
            i = index[title]
            entry["n"] = sorted(set(entry["n"]) | set(arts[i]["n"]))
            arts[i] = entry
            replaced += 1
        else:
            i = len(arts)
            arts.append(entry)
            index[title] = i
            added += 1
        rows, j = body_slot(i)
        rows[j] = body
        print(f"  {title}: {len(sents)} opening + {sum(len(s) for _, s in body)} body sentences", file=sys.stderr)

    for k, rows in shards.items():
        (depth_dir / f"{k:03d}.json").write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))
    data["depth"]["sentences"] = sum(len(s) for f in depth_dir.glob("*.json") for b in json.loads(f.read_text()) for _, s in b)
    data["source"] += "; core articles refreshed from en.wikipedia.org at build time"
    data.pop("vectors", None)                         # positions changed: re-run embed_library.py
    lib_path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    print(f"Added {added}, refreshed {replaced}; {len(arts)} articles, {data['depth']['sentences']} body sentences. "
          f"Now run scripts/embed_library.py.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
