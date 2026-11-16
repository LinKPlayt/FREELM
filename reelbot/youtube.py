"""YouTube upload via the official YouTube Data API v3 (free; uses your own Google OAuth client).

This is the only external account the app needs. Credentials can come from:
  * files:  credentials/client_secret.json + credentials/token.json   (CLI: `python -m reelbot auth`)
  * env:    GOOGLE_CLIENT_SECRET_JSON + YT_TOKEN_JSON                (hosted web app / CI secrets)
  * the web app's "Connect YouTube" button (browser OAuth redirect)
"""
from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path

log = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


# --------------------------------------------------------------------------- credential storage

def client_config(cfg: dict) -> dict | None:
    env = os.environ.get("GOOGLE_CLIENT_SECRET_JSON", "").strip()
    if env:
        return json.loads(env)
    p = Path(cfg["youtube"]["client_secrets"])
    return json.loads(p.read_text()) if p.exists() else None


def save_client_config(cfg: dict, data: dict) -> None:
    if not ({"web", "installed"} & set(data)):
        raise ValueError("That doesn't look like a Google OAuth client JSON (missing 'web' or 'installed').")
    p = Path(cfg["youtube"]["client_secrets"])
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data))


def _load_token(cfg: dict):
    from google.oauth2.credentials import Credentials

    p = Path(cfg["youtube"]["token"])
    if p.exists():
        return Credentials.from_authorized_user_file(str(p), SCOPES)
    env = os.environ.get("YT_TOKEN_JSON", "").strip()
    if env:
        return Credentials.from_authorized_user_info(json.loads(env), SCOPES)
    return None


def save_token(cfg: dict, creds) -> None:
    p = Path(cfg["youtube"]["token"])
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(creds.to_json())


def token_json(cfg: dict) -> str | None:
    creds = _load_token(cfg)
    return creds.to_json() if creds else None


def status(cfg: dict) -> dict:
    try:
        creds = _load_token(cfg)
    except Exception:  # noqa: BLE001
        creds = None
    return {
        "client_configured": client_config(cfg) is not None,
        "connected": bool(creds and (creds.valid or creds.refresh_token)),
        "from_env": bool(os.environ.get("YT_TOKEN_JSON")) and not Path(cfg["youtube"]["token"]).exists(),
    }


def disconnect(cfg: dict) -> None:
    Path(cfg["youtube"]["token"]).unlink(missing_ok=True)


def get_credentials(cfg: dict, interactive: bool = True):
    from google.auth.transport.requests import Request
    from google_auth_oauthlib.flow import InstalledAppFlow

    creds = _load_token(cfg)
    # A token without an expiry time (e.g. one created by the phone app) may be stale: refresh it.
    if creds and creds.valid and creds.expiry is not None:
        return creds
    if creds and creds.refresh_token:
        creds.refresh(Request())
    else:
        if not interactive:
            raise RuntimeError("YouTube isn't connected. Use the web app's Settings tab, "
                               "or run `python -m reelbot auth` once.")
        conf = client_config(cfg)
        if not conf:
            raise FileNotFoundError(
                f"Missing {cfg['youtube']['client_secrets']}. Create a free OAuth client in Google Cloud "
                "Console, download the JSON and save it there. See README.md -> YouTube setup."
            )
        flow = InstalledAppFlow.from_client_config(conf, SCOPES)
        try:
            creds = flow.run_local_server(port=0, prompt="consent", open_browser=True)
        except Exception:  # noqa: BLE001 - headless machine
            creds = flow.run_local_server(port=8765, prompt="consent", open_browser=False)
    save_token(cfg, creds)
    return creds


# --------------------------------------------------------------------------- browser OAuth (web app)

_pending: dict[str, str | None] = {}  # state -> PKCE code_verifier


def web_auth_url(cfg: dict, redirect_uri: str) -> str:
    from google_auth_oauthlib.flow import Flow

    conf = client_config(cfg)
    if not conf:
        raise FileNotFoundError("Add your Google OAuth client JSON first.")
    flow = Flow.from_client_config(conf, SCOPES, redirect_uri=redirect_uri)
    url, state = flow.authorization_url(access_type="offline", prompt="consent", include_granted_scopes="true")
    _pending[state] = flow.code_verifier
    return url


def web_auth_finish(cfg: dict, redirect_uri: str, state: str, authorization_response: str):
    from google_auth_oauthlib.flow import Flow

    if state not in _pending:
        raise ValueError("Sign-in session expired. Please try connecting again.")
    flow = Flow.from_client_config(client_config(cfg), SCOPES, redirect_uri=redirect_uri, state=state,
                                   code_verifier=_pending.pop(state), autogenerate_code_verifier=False)
    flow.fetch_token(authorization_response=authorization_response)
    save_token(cfg, flow.credentials)
    return flow.credentials


# --------------------------------------------------------------------------- upload

def upload(video_path: Path, title: str, description: str, tags: list[str], cfg: dict) -> str:
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    from googleapiclient.http import MediaFileUpload

    yt_cfg = cfg["youtube"]
    creds = get_credentials(cfg, interactive=False)
    youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)
    body = {
        "snippet": {
            "title": title[:100],
            "description": description[:4900],
            "tags": [t[:30] for t in tags][:30],
            "categoryId": str(yt_cfg.get("category_id", "27")),
        },
        "status": {
            "privacyStatus": yt_cfg.get("privacy", "public"),
            "selfDeclaredMadeForKids": False,
        },
    }
    media = MediaFileUpload(str(video_path), mimetype="video/mp4", chunksize=8 * 1024 * 1024, resumable=True)
    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)
    response, retries = None, 0
    while response is None:
        try:
            status_, response = request.next_chunk()
            if status_:
                log.info("  upload %d%%", int(status_.progress() * 100))
        except HttpError as err:
            if err.resp.status in (500, 502, 503, 504) and retries < 5:
                retries += 1
                time.sleep(2 ** retries)
                continue
            raise
    video_id = response["id"]
    log.info("Uploaded: https://youtube.com/shorts/%s", video_id)
    return video_id
