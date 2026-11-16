"""Command line interface.

  python -m reelbot make [--niche investing] [--mode news] [--topic compound-interest] [--upload]
  python -m reelbot auto --every 24 --upload      # keep running, one reel every 24 hours
  python -m reelbot auth                          # one-time YouTube sign-in
  python -m reelbot upload output/<folder>        # upload a reel you already made
  python -m reelbot topics                        # list built-in evergreen topics
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path

from .config import load_config


def _cfg(args):
    cfg = load_config(args.config)
    if getattr(args, "niche", None):
        cfg["niche"] = args.niche
    if getattr(args, "no_music", False):
        cfg["music"]["enabled"] = False
    return cfg


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="reelbot", description="Automatic finance reel generator")
    parser.add_argument("--config", help="path to config.yaml")
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="cmd")

    mk = sub.add_parser("make", help="research, write, voice, and render one reel")
    mk.add_argument("--niche")
    mk.add_argument("--mode", choices=["auto", "evergreen", "news", "market"])
    mk.add_argument("--topic", help="force a specific evergreen topic id")
    mk.add_argument("--upload", action="store_true", help="upload to YouTube when done")
    mk.add_argument("--no-music", action="store_true")

    au = sub.add_parser("auto", help="run forever, making (and uploading) a reel on a schedule")
    au.add_argument("--every", type=float, default=24, help="hours between reels (default 24)")
    au.add_argument("--niche")
    au.add_argument("--mode", choices=["auto", "evergreen", "news", "market"])
    au.add_argument("--upload", action="store_true")
    au.add_argument("--no-music", action="store_true")

    sub.add_parser("auth", help="sign in to YouTube (one time)")
    up = sub.add_parser("upload", help="upload an already rendered reel folder")
    up.add_argument("folder")
    sub.add_parser("topics", help="list built-in evergreen topics")

    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s  %(message)s", datefmt="%H:%M:%S")
    for noisy in ("urllib3", "googleapiclient", "PIL"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    if args.cmd is None:  # no sub-command -> behave like `make`
        args = parser.parse_args(list(argv if argv is not None else sys.argv[1:]) + ["make"])
    cmd = args.cmd

    if cmd == "topics":
        from .topics import TOPICS
        for t in TOPICS:
            print(f"{t['id']:28} {t['title']:45} [{', '.join(t['niches'])}]")
        return 0

    cfg = _cfg(args)

    if cmd == "auth":
        from . import youtube
        youtube.get_credentials(cfg, interactive=True)
        print("YouTube sign-in saved to", cfg["youtube"]["token"])
        return 0

    if cmd == "upload":
        from . import youtube
        folder = Path(args.folder)
        meta = json.loads((folder / "metadata.json").read_text())
        vid = youtube.upload(folder / "reel.mp4", meta["title"], meta["description"], meta["tags"], cfg)
        meta["youtube_id"], meta["youtube_url"] = vid, f"https://youtube.com/shorts/{vid}"
        (folder / "metadata.json").write_text(json.dumps(meta, indent=2))
        print(meta["youtube_url"])
        return 0

    from .pipeline import make_reel

    if cmd == "make":
        meta = make_reel(cfg, mode=args.mode, topic_id=args.topic, upload=args.upload)
        print(f"\nReel ready: {meta['video']}\nTitle: {meta['title']}")
        if meta.get("youtube_url"):
            print("Posted:", meta["youtube_url"])
        return 0

    if cmd == "auto":
        while True:
            try:
                make_reel(cfg, mode=args.mode, upload=args.upload)
            except Exception:  # noqa: BLE001 - keep the scheduler alive
                logging.exception("Reel failed; will retry next cycle.")
            logging.info("Sleeping %.1f hours...", args.every)
            time.sleep(args.every * 3600)
    return 0


if __name__ == "__main__":
    sys.exit(main())
