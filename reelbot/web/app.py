"""Mobile-first web app for ReelBot (installable on iPhone via Safari -> Share -> Add to Home Screen).

Run locally:   uvicorn reelbot.web.app:app --host 0.0.0.0 --port 7860
Environment:
  APP_PASSWORD               password required to use the app (strongly recommended when public)
  PUBLIC_URL                 the https address people use to reach this server (needed for YouTube sign-in)
  GOOGLE_CLIENT_SECRET_JSON  optional: Google OAuth client JSON (Web application type)
  YT_TOKEN_JSON              optional: saved YouTube token, so the connection survives restarts
  REELBOT_DATA               optional: directory for persistent data (e.g. /data)
"""
from __future__ import annotations

import copy
import hashlib
import hmac
import json
import logging
import os
import re
import shutil
import threading
import time
import uuid
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import Body, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .. import topics, youtube
from ..config import load_config

log = logging.getLogger("reelbot.web")
logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s", datefmt="%H:%M:%S")
for noisy in ("urllib3", "googleapiclient", "PIL"):
    logging.getLogger(noisy).setLevel(logging.WARNING)

STATIC = Path(__file__).parent / "static"
CFG = load_config()
PASSWORD = os.environ.get("APP_PASSWORD", "")
SECRET = hashlib.sha256(("reelbot:" + (PASSWORD or str(uuid.uuid4()))).encode()).hexdigest()
COOKIE = "reelbot_session"
KEEP_REELS = int(os.environ.get("KEEP_REELS", "40"))

app = FastAPI(title="ReelBot", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=STATIC), name="static")


# --------------------------------------------------------------------------- auth

def _token() -> str:
    return hmac.new(SECRET.encode(), b"ok", hashlib.sha256).hexdigest()


def _authed(request: Request) -> bool:
    return not PASSWORD or hmac.compare_digest(request.cookies.get(COOKIE, ""), _token())


@app.middleware("http")
async def require_login(request: Request, call_next):
    path = request.url.path
    open_paths = ("/static/", "/login", "/manifest.webmanifest", "/sw.js", "/healthz", "/apple-touch-icon")
    if path == "/" or path.startswith(open_paths) or _authed(request):
        return await call_next(request)
    return JSONResponse({"error": "login required"}, status_code=401)


@app.post("/login")
async def login(payload: dict = Body(...)):
    if PASSWORD and not hmac.compare_digest(str(payload.get("password", "")), PASSWORD):
        time.sleep(1)
        raise HTTPException(401, "Wrong password")
    resp = JSONResponse({"ok": True})
    resp.set_cookie(COOKIE, _token(), max_age=60 * 60 * 24 * 180, httponly=True, samesite="lax",
                    secure=_public_url().startswith("https"))
    return resp


@app.post("/api/logout")
async def logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(COOKIE)
    return resp


# --------------------------------------------------------------------------- pages / PWA

@app.get("/", response_class=HTMLResponse)
async def index():
    return HTMLResponse((STATIC / "index.html").read_text(), headers={"Cache-Control": "no-cache"})


@app.get("/manifest.webmanifest")
async def manifest():
    return FileResponse(STATIC / "manifest.webmanifest", media_type="application/manifest+json")


@app.get("/sw.js")
async def service_worker():
    return FileResponse(STATIC / "sw.js", media_type="application/javascript", headers={"Cache-Control": "no-cache"})


@app.get("/apple-touch-icon.png")
@app.get("/apple-touch-icon-precomposed.png")
async def touch_icon():
    return FileResponse(STATIC / "icon-180.png")


@app.get("/healthz")
async def health():
    return {"ok": True}


# --------------------------------------------------------------------------- jobs

class LogCapture(logging.Handler):
    def __init__(self, sink: deque):
        super().__init__(logging.INFO)
        self.sink = sink

    def emit(self, record):
        msg = record.getMessage()
        if "Giving up on" in msg:
            return
        self.sink.append(msg.strip())


JOBS: dict[str, dict] = {}
EXECUTOR = ThreadPoolExecutor(max_workers=1)  # rendering is CPU heavy: one reel at a time
_lock = threading.Lock()


def _progress(lines: deque) -> int:
    text = "\n".join(lines)
    steps = [("Researching", 5), ("Voiceover:", 20), ("Finding media", 30), ("Rendering", 55), ("Done:", 98),
             ("Uploaded:", 100)]
    pct = 2
    for marker, value in steps:
        if marker in text:
            pct = value
    m = re.findall(r"rendering\.\.\. (\d+)%", text)
    if m and "Done:" not in text:
        pct = 55 + int(int(m[-1]) * 0.42)
    return pct


def _run_job(job_id: str, opts: dict):
    from ..pipeline import make_reel

    job = JOBS[job_id]
    job["status"] = "running"
    handler = LogCapture(job["log"])
    root = logging.getLogger("reelbot")
    root.addHandler(handler)
    try:
        cfg = copy.deepcopy(CFG)
        if opts.get("niche"):
            cfg["niche"] = opts["niche"]
        if opts.get("privacy") in ("public", "unlisted", "private"):
            cfg["youtube"]["privacy"] = opts["privacy"]
        if opts.get("brand"):
            cfg["video"]["brand_name"] = opts["brand"][:30]
        cfg["music"]["enabled"] = bool(opts.get("music", True))
        meta = make_reel(cfg, mode=opts.get("mode") or None, topic_id=opts.get("topic") or None,
                         upload=bool(opts.get("upload")))
        job["result"] = _reel_summary(Path(meta["video"]).parent)
        job["status"] = "done"
    except Exception as exc:  # noqa: BLE001
        log.exception("job failed")
        job["status"] = "error"
        job["error"] = str(exc)[:500]
    finally:
        root.removeHandler(handler)
        _cleanup()


@app.post("/api/jobs")
async def create_job(opts: dict = Body(...)):
    with _lock:
        active = [j for j in JOBS.values() if j["status"] in ("queued", "running")]
        if len(active) >= 3:
            raise HTTPException(429, "A few reels are already queued. Please wait for them to finish.")
        job_id = uuid.uuid4().hex[:10]
        JOBS[job_id] = {"id": job_id, "status": "queued", "log": deque(maxlen=200), "created": time.time(),
                        "opts": opts, "result": None, "error": None}
    EXECUTOR.submit(_run_job, job_id, opts)
    return {"id": job_id}


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    queued_ahead = sum(1 for j in JOBS.values() if j["status"] in ("queued", "running") and j["created"] < job["created"])
    return {"id": job_id, "status": job["status"], "progress": 100 if job["status"] == "done" else _progress(job["log"]),
            "log": list(job["log"])[-12:], "result": job["result"], "error": job["error"], "ahead": queued_ahead}


@app.get("/api/jobs")
async def list_jobs():
    return [{"id": j["id"], "status": j["status"]} for j in JOBS.values() if j["status"] in ("queued", "running")]


# --------------------------------------------------------------------------- library

def _reel_dirs() -> list[Path]:
    out = Path(CFG["output_dir"])
    dirs = [d for d in out.iterdir() if d.is_dir() and (d / "metadata.json").exists() and (d / "reel.mp4").exists()]
    return sorted(dirs, key=lambda d: d.name, reverse=True)


def _reel_summary(d: Path) -> dict:
    meta = json.loads((d / "metadata.json").read_text())
    script = (d / "script.txt").read_text() if (d / "script.txt").exists() else ""
    return {
        "id": d.name, "title": meta.get("title", d.name), "description": meta.get("description", ""),
        "kind": meta.get("kind"), "duration": meta.get("duration"), "created": meta.get("created"),
        "youtube_url": meta.get("youtube_url"), "script": script,
        "video": f"/media/{d.name}/reel.mp4", "size_mb": round((d / "reel.mp4").stat().st_size / 1e6, 1),
    }


def _cleanup():
    for d in _reel_dirs()[KEEP_REELS:]:
        shutil.rmtree(d, ignore_errors=True)


def _safe_dir(reel_id: str) -> Path:
    if not re.fullmatch(r"[\w.-]+", reel_id):
        raise HTTPException(400, "Bad id")
    d = Path(CFG["output_dir"]) / reel_id
    if not (d / "metadata.json").exists():
        raise HTTPException(404, "Reel not found")
    return d


@app.get("/api/reels")
async def reels():
    return [_reel_summary(d) for d in _reel_dirs()]


@app.get("/media/{reel_id}/reel.mp4")
async def media(reel_id: str, download: int = 0):
    d = _safe_dir(reel_id)
    headers = {"Content-Disposition": f'attachment; filename="{reel_id}.mp4"'} if download else {}
    return FileResponse(d / "reel.mp4", media_type="video/mp4", headers=headers)


@app.delete("/api/reels/{reel_id}")
async def delete_reel(reel_id: str):
    shutil.rmtree(_safe_dir(reel_id), ignore_errors=True)
    return {"ok": True}


@app.post("/api/reels/{reel_id}/upload")
async def upload_reel(reel_id: str, opts: dict = Body(default={})):
    d = _safe_dir(reel_id)
    meta = json.loads((d / "metadata.json").read_text())
    cfg = copy.deepcopy(CFG)
    if opts.get("privacy") in ("public", "unlisted", "private"):
        cfg["youtube"]["privacy"] = opts["privacy"]

    def work():
        vid = youtube.upload(d / "reel.mp4", meta["title"], meta["description"], meta["tags"], cfg)
        meta["youtube_id"], meta["youtube_url"] = vid, f"https://youtube.com/shorts/{vid}"
        (d / "metadata.json").write_text(json.dumps(meta, indent=2))
        return meta["youtube_url"]

    try:
        url = await _in_thread(work)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Upload failed: {exc}") from exc
    return {"youtube_url": url}


async def _in_thread(fn):
    import asyncio
    return await asyncio.get_running_loop().run_in_executor(None, fn)


# --------------------------------------------------------------------------- options + settings

@app.get("/api/options")
async def options():
    return {
        "niches": topics.NICHES,
        "modes": ["auto", "evergreen", "news", "market"],
        "topics": [{"id": t["id"], "title": t["title"], "niches": t["niches"]} for t in topics.TOPICS],
        "defaults": {"niche": CFG["niche"], "mode": CFG["mode"], "brand": CFG["video"]["brand_name"],
                     "privacy": CFG["youtube"]["privacy"]},
        "password_protected": bool(PASSWORD),
    }


def _public_url() -> str:
    if os.environ.get("PUBLIC_URL"):
        return os.environ["PUBLIC_URL"].rstrip("/")
    return "http://localhost:7860"


def _redirect_uri() -> str:
    return _public_url() + "/auth/callback"


@app.get("/api/youtube")
async def youtube_status():
    st = youtube.status(CFG)
    st["redirect_uri"] = _redirect_uri()
    st["persisted"] = bool(os.environ.get("YT_TOKEN_JSON")) or bool(os.environ.get("REELBOT_DATA"))
    return st


@app.post("/api/youtube/client")
async def youtube_client(payload: dict = Body(...)):
    try:
        data = payload.get("json")
        data = json.loads(data) if isinstance(data, str) else data
        youtube.save_client_config(CFG, data)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True}


@app.get("/api/youtube/token")
async def youtube_token():
    tok = youtube.token_json(CFG)
    if not tok:
        raise HTTPException(404, "Not connected")
    return {"token": tok, "client": json.dumps(youtube.client_config(CFG) or {})}


@app.post("/api/youtube/disconnect")
async def youtube_disconnect():
    youtube.disconnect(CFG)
    return {"ok": True}


@app.get("/auth/start")
async def auth_start(request: Request):
    if not _authed(request):
        return RedirectResponse("/")
    try:
        return RedirectResponse(youtube.web_auth_url(CFG, _redirect_uri()))
    except Exception as exc:  # noqa: BLE001
        return RedirectResponse(f"/#settings?error={str(exc)[:200]}")


@app.get("/auth/callback")
async def auth_callback(request: Request, state: str = "", error: str = ""):
    if error:
        return RedirectResponse(f"/#settings?error={error}")
    if _public_url().startswith("http://"):
        os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"  # local development only
    response_url = _redirect_uri() + "?" + request.url.query
    try:
        await _in_thread(lambda: youtube.web_auth_finish(CFG, _redirect_uri(), state, response_url))
    except Exception as exc:  # noqa: BLE001
        return RedirectResponse(f"/#settings?error={str(exc)[:200]}")
    return RedirectResponse("/#settings?connected=1")


@app.exception_handler(HTTPException)
async def http_error(_request: Request, exc: HTTPException):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)


@app.get("/favicon.ico")
async def favicon():
    return Response(status_code=204)
