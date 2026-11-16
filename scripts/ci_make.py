"""Runs inside GitHub Actions: turn a reel request into a rendered (and optionally uploaded) reel.

A request arrives one of three ways:
  * schedule          - the daily automatic reel (uses config.yaml defaults)
  * workflow_dispatch - the "Run workflow" form on GitHub
  * issues            - the phone app opens a pre-filled issue titled e.g.
                        "reel | niche=investing | mode=news | upload=yes | privacy=public"

Everything from the request is validated against whitelists here, in Python. Nothing from an
issue title is ever passed to a shell.
"""
from __future__ import annotations

import logging
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from reelbot import topics  # noqa: E402
from reelbot.config import load_config  # noqa: E402
from reelbot.pipeline import make_reel  # noqa: E402

MODES = {"auto", "evergreen", "news", "market"}
PRIVACY = {"public", "unlisted", "private"}
TOPIC_IDS = {t["id"] for t in topics.TOPICS}
YES = {"yes", "true", "1", "on"}


def parse_title(title: str) -> dict:
    """'reel | niche=investing | mode=news' -> {'niche': 'investing', 'mode': 'news'}"""
    out = {}
    for part in title.split("|")[1:]:
        key, _, value = part.partition("=")
        out[key.strip().lower()] = value.strip()
    return out


def clean(raw: dict) -> dict:
    """Keep only known keys with whitelisted values; silently drop anything else."""
    req: dict = {}
    niche = raw.get("niche", "").lower()
    if niche in topics.NICHES:
        req["niche"] = niche
    mode = raw.get("mode", "").lower()
    if mode in MODES:
        req["mode"] = mode
    topic = raw.get("topic", "").lower()
    if topic in TOPIC_IDS:
        req["topic"] = topic
    privacy = raw.get("privacy", "").lower()
    if privacy in PRIVACY:
        req["privacy"] = privacy
    brand = re.sub(r"[^A-Za-z0-9 &'!.\-]", "", raw.get("brand", ""))[:30].strip()
    if brand:
        req["brand"] = brand
    if "upload" in raw:
        req["upload"] = raw["upload"].lower() in YES
    if "music" in raw:
        req["music"] = raw["music"].lower() in YES
    return req


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s", datefmt="%H:%M:%S")
    for noisy in ("urllib3", "googleapiclient", "PIL"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    event = os.environ.get("EVENT_NAME", "workflow_dispatch")
    if event == "issues":
        raw = parse_title(os.environ.get("ISSUE_TITLE", ""))
    else:
        raw = {k: os.environ.get("IN_" + k.upper(), "") for k in
               ("niche", "mode", "topic", "privacy", "brand", "upload", "music")}
        raw = {k: v for k, v in raw.items() if v}
    req = clean(raw)

    cfg = load_config()
    if "niche" in req:
        cfg["niche"] = req["niche"]
    if "privacy" in req:
        cfg["youtube"]["privacy"] = req["privacy"]
    if "brand" in req:
        cfg["video"]["brand_name"] = req["brand"]
    if "music" in req:
        cfg["music"]["enabled"] = req["music"]

    has_token = bool(os.environ.get("YT_TOKEN_JSON", "").strip())
    # The daily scheduled reel posts automatically once YouTube is connected.
    wants_upload = req.get("upload", event == "schedule")
    upload = wants_upload and has_token
    print(f"Request: {req}  (event={event}, upload={upload})")

    meta = make_reel(cfg, mode=req.get("mode"), topic_id=req.get("topic"), upload=upload)

    lines = [f"**{meta['title']}** ({round(meta['duration'])}s)"]
    if meta.get("youtube_url"):
        lines.append(f"Posted to YouTube: {meta['youtube_url']}")
    elif wants_upload and not has_token:
        lines.append("Not posted: YouTube isn't connected yet (add the `YT_TOKEN_JSON` secret; see the app's Settings tab).")
    Path("reel_result.md").write_text("\n\n".join(lines) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
