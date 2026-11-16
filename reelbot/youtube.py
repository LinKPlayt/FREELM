"""YouTube upload via the official YouTube Data API v3 (free; uses your own Google OAuth client).

This is the only external account the app needs. One-time setup is described in README.md.
"""
from __future__ import annotations

import logging
import time
from pathlib import Path

log = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def get_credentials(cfg: dict, interactive: bool = True):
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow

    yt = cfg["youtube"]
    token_path = Path(yt["token"])
    creds = None
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
    if creds and creds.valid:
        return creds
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    else:
        if not interactive:
            raise RuntimeError("No valid YouTube token. Run `python -m reelbot auth` once on a machine with a browser.")
        secrets = Path(yt["client_secrets"])
        if not secrets.exists():
            raise FileNotFoundError(
                f"Missing {secrets}. Create a free OAuth client (Desktop app) in Google Cloud Console, "
                "download the JSON and save it there. See README.md -> YouTube setup."
            )
        flow = InstalledAppFlow.from_client_secrets_file(str(secrets), SCOPES)
        try:
            creds = flow.run_local_server(port=0, prompt="consent", open_browser=True)
        except Exception:  # noqa: BLE001 - headless machine
            creds = flow.run_local_server(port=8765, prompt="consent", open_browser=False)
    token_path.parent.mkdir(parents=True, exist_ok=True)
    token_path.write_text(creds.to_json())
    return creds


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
            status, response = request.next_chunk()
            if status:
                log.info("  upload %d%%", int(status.progress() * 100))
        except HttpError as err:
            if err.resp.status in (500, 502, 503, 504) and retries < 5:
                retries += 1
                time.sleep(2 ** retries)
                continue
            raise
    video_id = response["id"]
    log.info("Uploaded: https://youtube.com/shorts/%s", video_id)
    return video_id
