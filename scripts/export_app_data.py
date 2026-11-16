"""Exports the topic library to JSON for the phone app (run after editing reelbot/topics.py).

  python scripts/export_app_data.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from reelbot import topics  # noqa: E402

out = ROOT / "app" / "data" / "topics.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({
    "niches": topics.NICHES,
    "topics": topics.TOPICS,
    "generic_visuals": topics.GENERIC_VISUALS,
}, ensure_ascii=False, indent=1))
print(f"Wrote {out} ({len(topics.TOPICS)} topics)")
