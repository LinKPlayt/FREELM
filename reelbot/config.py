"""Configuration loading with sane defaults."""
from __future__ import annotations

import copy
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent

DEFAULTS: dict = {
    "niche": "personal finance",
    "mode": "auto",
    "video": {
        "width": 1080,
        "height": 1920,
        "fps": 30,
        "min_seconds": 30,
        "max_seconds": 45,
        "brand_name": "Money Minute",
        "call_to_action": "Follow for a new money tip every day.",
        "accent_color": "#FFD60A",
    },
    "voice": {"engine": "piper", "model": "en_US-ryan-high", "speed": 1.0},
    "music": {"enabled": True, "volume": 0.14},
    "media": {"sources": ["openverse", "wikimedia"], "allow_video": True, "min_width": 640},
    "llm": {"enabled": False, "url": "http://localhost:11434", "model": "llama3.1:8b"},
    "youtube": {
        "upload": False,
        "privacy": "public",
        "category_id": "27",
        "client_secrets": "credentials/client_secret.json",
        "token": "credentials/token.json",
        "extra_tags": ["finance", "money", "shorts"],
    },
    "output_dir": "output",
    "cache_dir": ".cache",
}


def _merge(base: dict, override: dict) -> dict:
    out = copy.deepcopy(base)
    for key, value in (override or {}).items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _merge(out[key], value)
        else:
            out[key] = value
    return out


def load_config(path: str | Path | None = None) -> dict:
    path = Path(path) if path else ROOT / "config.yaml"
    user = {}
    if path.exists():
        user = yaml.safe_load(path.read_text()) or {}
    cfg = _merge(DEFAULTS, user)
    # Resolve relative paths against the project root.
    for key in ("output_dir", "cache_dir"):
        cfg[key] = str((ROOT / cfg[key]).resolve()) if not Path(cfg[key]).is_absolute() else cfg[key]
    for key in ("client_secrets", "token"):
        p = Path(cfg["youtube"][key])
        cfg["youtube"][key] = str(p if p.is_absolute() else (ROOT / p).resolve())
    Path(cfg["output_dir"]).mkdir(parents=True, exist_ok=True)
    Path(cfg["cache_dir"]).mkdir(parents=True, exist_ok=True)
    return cfg
