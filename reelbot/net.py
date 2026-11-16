"""Tiny HTTP helper: polite User-Agent, retries, and an on-disk cache for downloads."""
from __future__ import annotations

import hashlib
import logging
import time
from pathlib import Path

import requests

log = logging.getLogger(__name__)

USER_AGENT = "ReelBot/1.0 (open-source finance reel generator; +https://github.com/LinKPlayt/FREELM)"

_session = requests.Session()
_session.headers.update({"User-Agent": USER_AGENT})


# Be polite to volunteer-run services: minimum seconds between requests per host.
_MIN_INTERVAL = {"wikimedia.org": 1.0, "wikipedia.org": 0.5, "openverse.org": 0.5}
_last_hit: dict[str, float] = {}


def _throttle(url: str) -> None:
    for host, gap in _MIN_INTERVAL.items():
        if host in url.split("/")[2]:
            wait = _last_hit.get(host, 0) + gap - time.time()
            if wait > 0:
                time.sleep(wait)
            _last_hit[host] = time.time()


def get(url: str, *, params: dict | None = None, timeout: int = 20, retries: int = 3, **kw) -> requests.Response | None:
    """GET with retry/backoff. Returns None instead of raising on failure."""
    delay = 2.0
    for attempt in range(retries):
        try:
            _throttle(url)
            resp = _session.get(url, params=params, timeout=timeout, **kw)
            if resp.status_code == 429 or resp.status_code >= 500:
                raise requests.HTTPError(f"HTTP {resp.status_code}")
            resp.raise_for_status()
            return resp
        except Exception as exc:  # noqa: BLE001 - network is best effort
            log.debug("GET %s failed (%s), attempt %d", url, exc, attempt + 1)
            if attempt < retries - 1:
                time.sleep(delay)
                delay *= 2
    log.info("Giving up on %s", url)
    return None


def get_json(url: str, **kw):
    resp = get(url, **kw)
    if resp is None:
        return None
    try:
        return resp.json()
    except ValueError:
        return None


def download(url: str, cache_dir: str | Path, *, suffix: str = "", max_bytes: int = 80_000_000) -> Path | None:
    """Download a file into the cache (deduplicated by URL hash)."""
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    name = hashlib.sha1(url.encode()).hexdigest()[:20] + suffix
    dest = cache_dir / name
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    resp = get(url, timeout=30, stream=True, retries=2)
    if resp is None:
        return None
    tmp = dest.with_suffix(dest.suffix + ".part")
    size = 0
    started = time.time()
    try:
        with open(tmp, "wb") as fh:
            for chunk in resp.iter_content(1 << 16):
                size += len(chunk)
                if size > max_bytes:
                    raise ValueError("file too large")
                if time.time() - started > 120:
                    raise TimeoutError("download too slow")
                fh.write(chunk)
        tmp.replace(dest)
        return dest
    except Exception as exc:  # noqa: BLE001
        log.debug("download %s failed: %s", url, exc)
        tmp.unlink(missing_ok=True)
        return None
