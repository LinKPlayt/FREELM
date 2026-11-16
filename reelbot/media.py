"""Finds and downloads free, openly licensed photos and video clips.

Sources (no API keys, no accounts):
* Openverse         - 800M+ Creative Commons / public-domain images (Flickr, museums, etc.)
* Wikimedia Commons - public-domain and CC-BY/CC-BY-SA photos and video clips

Only licenses that allow commercial reuse and modification are accepted
(CC0, Public Domain, CC BY, CC BY-SA). Credits are collected for the video description.
"""
from __future__ import annotations

import logging
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from . import net, topics

log = logging.getLogger(__name__)

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
OPENVERSE_API = "https://api.openverse.org/v1/images/"

BAD_TITLE = re.compile(r"\b(map|logo|flag|coat of arms|seal|signature|icon|diagram|svg|chart|graph|"
                       r"locator|emblem|banner|poster|screenshot|text|document|scan|page)\b", re.I)
OK_LICENSE = re.compile(r"(cc0|public domain|^pd|pdm|cc[ -]by(?![ -]?nc)(?![ -]?nd))", re.I)
# Keep the channel brand-safe: skip images whose titles suggest unsuitable content.
UNSAFE_TITLE = re.compile(r"\b(hoes?|sexy|nude|naked|bikini|lingerie|porn|xxx|drunk|weed|gun|guns|weapon|blood|"
                          r"dead|corpse|nazi|fuck|shit|bitch|ass)\b", re.I)
STOPWORDS = {"the", "and", "for", "with", "photo", "image", "stock"}


@dataclass
class Asset:
    path: Path
    kind: str          # image | video
    credit: str        # human readable attribution line
    query: str


def _keywords(query: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9]+", query.lower()) if len(w) > 2 and w not in STOPWORDS]


def _relevant(title: str, query: str, strict: bool = False) -> bool:
    words = _keywords(query)
    t = title.lower()
    hits = sum(1 for w in words if w in t or w.rstrip("s") in t)
    if not words:
        return True
    return hits >= min(2, len(words)) if strict else hits >= 1


# --------------------------------------------------------------------------- search backends

def search_openverse(query: str, limit: int = 12) -> list[dict]:
    data = net.get_json(OPENVERSE_API, params={
        "q": query, "license": "cc0,pdm,by,by-sa", "page_size": limit, "mature": "false",
    })
    out = []
    for r in (data or {}).get("results", []):
        title = r.get("title") or ""
        if not r.get("url") or BAD_TITLE.search(title) or UNSAFE_TITLE.search(title):
            continue
        lic = f"CC {r.get('license', '').upper()} {r.get('license_version') or ''}".strip()
        if r.get("license") in ("cc0", "pdm"):
            lic = "CC0 / Public Domain"
        # Download through Openverse's own image proxy: it serves the full-size file reliably
        # for any source (some origin CDNs block automated clients).
        proxied = f"https://api.openverse.org/v1/images/{r['id']}/thumb/?full_size=true" if r.get("id") else r["url"]
        out.append({
            "kind": "image", "url": proxied, "width": r.get("width") or 0, "height": r.get("height") or 0,
            "title": r.get("title") or query,
            "credit": f"\"{r.get('title') or 'Untitled'}\" by {r.get('creator') or 'unknown'} ({lic}) {r.get('foreign_landing_url', '')}",
        })
    return out


def _commons_query(search: str, limit: int, thumb_width: int | None) -> list[dict]:
    params = {
        "action": "query", "format": "json", "generator": "search", "gsrsearch": search,
        "gsrnamespace": 6, "gsrlimit": limit, "prop": "imageinfo",
        "iiprop": "url|size|mime|extmetadata", "iiextmetadatafilter": "LicenseShortName|Artist|ObjectName",
    }
    if thumb_width:
        params["iiurlwidth"] = thumb_width
    data = net.get_json(COMMONS_API, params=params)
    pages = sorted(((data or {}).get("query", {}).get("pages", {}) or {}).values(), key=lambda p: p.get("index", 0))
    return pages


def _commons_credit(page: dict, info: dict) -> tuple[str, str] | None:
    meta = info.get("extmetadata", {})
    lic = re.sub(r"<[^>]+>", "", meta.get("LicenseShortName", {}).get("value", ""))
    if not OK_LICENSE.search(lic):
        return None
    artist = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "unknown")).strip()[:80] or "unknown"
    title = page["title"].removeprefix("File:")
    url = info.get("descriptionurl", "https://commons.wikimedia.org/wiki/" + page["title"].replace(" ", "_"))
    return title, f"\"{title}\" by {artist} ({lic}, Wikimedia Commons) {url}"


def search_commons_images(query: str, limit: int = 12) -> list[dict]:
    out = []
    for page in _commons_query(f"{query} filetype:bitmap", limit, 1280):
        info = (page.get("imageinfo") or [{}])[0]
        if info.get("mime") not in ("image/jpeg", "image/png", "image/webp"):
            continue
        cred = _commons_credit(page, info)
        if (not cred or BAD_TITLE.search(cred[0]) or UNSAFE_TITLE.search(cred[0])
                or not _relevant(cred[0], query, strict=True)):
            continue
        out.append({
            "kind": "image", "url": info.get("thumburl") or info["url"], "title": cred[0], "credit": cred[1],
            "width": info.get("thumbwidth") or info.get("width", 0), "height": info.get("thumbheight") or info.get("height", 0),
        })
    return out


def search_commons_videos(query: str, limit: int = 10) -> list[dict]:
    out = []
    for page in _commons_query(f"{query} filetype:video", limit, None):
        info = (page.get("imageinfo") or [{}])[0]
        dur = float(info.get("duration") or 0)
        if not 4 <= dur <= 300 or not str(info.get("mime", "")).startswith("video/"):
            continue
        cred = _commons_credit(page, info)
        if not cred or not _relevant(cred[0], query, strict=True):
            continue
        orig = info["url"].split("?")[0]
        m = re.match(r"(https://upload\.wikimedia\.org/wikipedia/commons)/(\w/\w\w)/(.+)$", orig)
        candidates = []
        if m:
            base, shard, name = m.groups()
            for variant in ("720p.vp9.webm", "480p.vp9.webm", "720p.webm", "480p.webm"):
                candidates.append(f"{base}/transcoded/{shard}/{name}/{name}.{variant}")
        if info.get("size", 0) < 60_000_000:
            candidates.append(orig)
        out.append({"kind": "video", "urls": candidates, "duration": dur, "title": cred[0], "credit": cred[1],
                    "width": info.get("width", 0), "height": info.get("height", 0)})
    return out


# --------------------------------------------------------------------------- finder

class MediaFinder:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.cache = Path(cfg["cache_dir"]) / "media"
        self.cache.mkdir(parents=True, exist_ok=True)
        self.used: set[str] = set()
        self.min_width = int(cfg["media"].get("min_width", 640))
        self.sources = [s.lower() for s in cfg["media"].get("sources", ["openverse", "wikimedia"])]

    # ------------------------------------------------------------------ public
    def find(self, query: str, prefer_video: bool = False) -> Asset | None:
        if prefer_video and self.cfg["media"].get("allow_video") and "wikimedia" in self.sources:
            asset = self._find_video(query)
            if asset:
                return asset
        asset = self._find_image(query)
        if asset:
            return asset
        # Fall back to the niche's generic visuals so every scene gets something real.
        for alt in topics.generic_visuals(self.cfg["niche"]):
            if alt != query:
                asset = self._find_image(alt)
                if asset:
                    return asset
        return None

    # ------------------------------------------------------------------ images
    def _find_image(self, query: str) -> Asset | None:
        candidates: list[dict] = []
        if "openverse" in self.sources:
            candidates += search_openverse(query)
        if "wikimedia" in self.sources:
            candidates += search_commons_images(query)
        # Prefer portrait / large images: they crop better into a 9:16 frame.
        candidates.sort(key=lambda c: (c["height"] >= c["width"], min(c["width"], 2400)), reverse=True)
        attempts = 0
        for c in candidates:
            if c["url"] in self.used or (c["width"] and c["width"] < self.min_width):
                continue
            attempts += 1
            if attempts > 5:
                break
            path = net.download(c["url"], self.cache, suffix=".img")
            if not path or not self._valid_image(path):
                continue
            self.used.add(c["url"])
            log.info("  image for '%s': %s", query, c["title"][:70])
            return Asset(path, "image", c["credit"], query)
        return None

    def _valid_image(self, path: Path) -> bool:
        try:
            with Image.open(path) as im:
                im.verify()
            with Image.open(path) as im:
                w, h = im.size
            return min(w, h) >= 360 and w >= self.min_width * 0.75
        except Exception:  # noqa: BLE001
            path.unlink(missing_ok=True)
            return False

    # ------------------------------------------------------------------ videos
    def _find_video(self, query: str) -> Asset | None:
        for c in search_commons_videos(query)[:4]:
            key = c["urls"][-1] if c["urls"] else c["title"]
            if key in self.used:
                continue
            for url in c["urls"]:
                raw = net.download(url, self.cache / "raw", suffix=".webm", max_bytes=80_000_000)
                if not raw:
                    continue
                clip = self._cut_clip(raw, c["duration"])
                if clip:
                    self.used.add(key)
                    log.info("  video for '%s': %s", query, c["title"][:70])
                    return Asset(clip, "video", c["credit"], query)
                break
        return None

    def _cut_clip(self, src: Path, duration: float, length: float = 10.0) -> Path | None:
        """Cut a short, silent, 30fps segment from the middle third of the source video."""
        dest = src.parent.parent / (src.stem + "_clip.mp4")
        if dest.exists():
            return dest
        start = max(0.0, min(duration * 0.3, duration - length))
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.2f}", "-i", str(src), "-t", f"{length}",
               "-an", "-vf", "scale=-2:'min(1080,ih)',fps=30", "-c:v", "libx264", "-preset", "veryfast",
               "-crf", "20", "-pix_fmt", "yuv420p", str(dest)]
        try:
            subprocess.run(cmd, check=True, timeout=180)
            return dest if dest.exists() and dest.stat().st_size > 10_000 else None
        except Exception:  # noqa: BLE001
            dest.unlink(missing_ok=True)
            return None
