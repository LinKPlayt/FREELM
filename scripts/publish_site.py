"""Builds the static phone app (GitHub Pages) from site/ plus the rendered reels.

  python scripts/publish_site.py --prev <old gh-pages checkout> --out <new site dir>

The site is plain static files: the app shell, reels/<id>/reel.mp4, and small JSON indexes the
app reads. No server and no API are involved.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from reelbot import topics  # noqa: E402
from reelbot.config import load_config  # noqa: E402

KEEP = int(os.environ.get("KEEP_REELS", "20"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--prev", default="", help="previous site checkout (may not exist)")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    cfg = load_config()
    out, prev = Path(args.out), Path(args.prev) if args.prev else None
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(ROOT / "site", out)
    reels_dir = out / "reels"
    reels_dir.mkdir(exist_ok=True)

    # 1. carry over reels that are already published
    if prev and (prev / "reels").is_dir():
        for d in (prev / "reels").iterdir():
            if d.is_dir() and (d / "reel.mp4").exists() and (d / "meta.json").exists():
                shutil.copytree(d, reels_dir / d.name)

    # 2. add freshly rendered reels
    for d in sorted(Path(cfg["output_dir"]).glob("*/")):
        if not (d / "reel.mp4").exists() or not (d / "metadata.json").exists() or (reels_dir / d.name).exists():
            continue
        meta = json.loads((d / "metadata.json").read_text())
        dest = reels_dir / d.name
        dest.mkdir()
        shutil.copy2(d / "reel.mp4", dest / "reel.mp4")
        script = (d / "script.txt").read_text() if (d / "script.txt").exists() else ""
        (dest / "meta.json").write_text(json.dumps({
            "id": d.name, "title": meta.get("title", d.name), "description": meta.get("description", ""),
            "kind": meta.get("kind"), "duration": meta.get("duration"), "created": meta.get("created"),
            "youtube_url": meta.get("youtube_url"), "script": script,
            "video": f"reels/{d.name}/reel.mp4",
            "size_mb": round((d / "reel.mp4").stat().st_size / 1e6, 1),
        }))

    # 3. keep only the newest reels so the site stays small
    ordered = sorted((d for d in reels_dir.iterdir() if d.is_dir()), key=lambda d: d.name, reverse=True)
    for old in ordered[KEEP:]:
        shutil.rmtree(old)
    index = [json.loads((d / "meta.json").read_text()) for d in ordered[:KEEP]]
    (reels_dir / "index.json").write_text(json.dumps(index))

    # 4. history (so topics don't repeat) travels with the site
    data = out / "data"
    data.mkdir(exist_ok=True)
    hist = Path(cfg["output_dir"]) / "history.json"
    if hist.exists():
        shutil.copy2(hist, data / "history.json")
    elif prev and (prev / "data" / "history.json").exists():
        shutil.copy2(prev / "data" / "history.json", data / "history.json")

    # 5. options the app needs to build its form
    (out / "options.json").write_text(json.dumps({
        "repo": os.environ.get("GITHUB_REPOSITORY", ""),
        "niches": topics.NICHES,
        "modes": ["auto", "evergreen", "news", "market"],
        "topics": [{"id": t["id"], "title": t["title"], "niches": t["niches"]} for t in topics.TOPICS],
        "defaults": {"niche": cfg["niche"], "mode": cfg["mode"], "brand": cfg["video"]["brand_name"],
                     "privacy": cfg["youtube"]["privacy"]},
    }))
    (out / ".nojekyll").write_text("")
    print(f"Site built: {len(index)} reel(s) in {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
