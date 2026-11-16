"""Deploy the ReelBot web app to a free Hugging Face Space (Docker).

Usage:
  pip install huggingface_hub
  HF_TOKEN=hf_xxx python scripts/deploy_hf.py --space reelbot --password "choose-a-password"

Creates (or updates) https://huggingface.co/spaces/<you>/<space>; the app is served at
https://<you>-<space>.hf.space. Re-run any time to push new code.
"""
from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
from pathlib import Path

from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parent.parent
INCLUDE = ["reelbot", "assets", "config.yaml", "requirements.txt", "requirements-web.txt", "Dockerfile",
           ".dockerignore", "credentials/README.md"]

SPACE_README = """---
title: ReelBot
emoji: 💸
colorFrom: yellow
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
short_description: Automatic 30-45s finance reels for YouTube Shorts
---

# ReelBot

Automatic finance reels: research → script → offline voice → free media → music → video → YouTube.
Source: https://github.com/LinKPlayt/FREELM
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--space", default="reelbot", help="Space name (default: reelbot)")
    ap.add_argument("--password", help="APP_PASSWORD secret for the app (recommended)")
    ap.add_argument("--private", action="store_true", help="make the Space private (only you can open it)")
    args = ap.parse_args()

    api = HfApi(token=os.environ.get("HF_TOKEN"))
    user = api.whoami()["name"]
    repo_id = f"{user}/{args.space}"
    api.create_repo(repo_id, repo_type="space", space_sdk="docker", private=args.private, exist_ok=True)
    if args.password:
        api.add_space_secret(repo_id, "APP_PASSWORD", args.password)

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        for item in INCLUDE:
            src = ROOT / item
            dst = tmp / item
            dst.parent.mkdir(parents=True, exist_ok=True)
            if src.is_dir():
                shutil.copytree(src, dst, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
            elif src.exists():
                shutil.copy2(src, dst)
        (tmp / "README.md").write_text(SPACE_README)
        api.upload_folder(repo_id=repo_id, repo_type="space", folder_path=str(tmp),
                          commit_message="Deploy ReelBot web app", delete_patterns=["reelbot/**"])

    host = f"https://{user}-{args.space}.hf.space".lower().replace("_", "-")
    print(f"Space:  https://huggingface.co/spaces/{repo_id}")
    print(f"App:    {host}   (first build takes ~5 minutes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
