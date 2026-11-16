"""Publishes a small JSON snapshot of market numbers and headlines for the phone app.

Web pages aren't allowed to call market-data sites directly, so a scheduled job runs this and
pushes the result to the `data` branch. It contains public numbers and headlines only; no
video is ever made or stored online.

  python scripts/snapshot_data.py [previous_snapshot.json] > snapshot.json
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from reelbot import research, topics  # noqa: E402


def main() -> int:
    prev = {}
    if len(sys.argv) > 1 and Path(sys.argv[1]).exists():
        try:
            prev = json.loads(Path(sys.argv[1]).read_text())
        except json.JSONDecodeError:
            prev = {}

    markets = dict(prev.get("markets", {}))          # keep the last good value if a fetch fails
    for symbol in research.MARKETS:
        s = research.market_series(symbol)
        if not s:
            continue
        markets[symbol] = {
            "symbol": symbol, "name": s["name"], "is_yield": s["is_yield"],
            "values": [round(v, 4) for v in s["values"]],
            "last": round(s["last"], 4), "day_pct": round(s["day_pct"], 3), "week_pct": round(s["week_pct"], 3),
            "month_pct": round(s["month_pct"], 3), "period_pct": round(s["period_pct"], 3),
        }

    headlines = {}
    for niche in topics.NICHES:
        items = research.fetch_headlines(niche)[:12]
        headlines[niche] = [{
            "title": h["title"], "summary": h["summary"][:300], "source": h["source"], "link": h["link"],
            "published": h["published"].isoformat() if h["published"] else None,
        } for h in items] or prev.get("headlines", {}).get(niche, [])

    json.dump({"generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
               "markets": markets, "headlines": headlines}, sys.stdout, ensure_ascii=False)
    print(f"markets: {len(markets)}, headlines: {sum(len(v) for v in headlines.values())}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
