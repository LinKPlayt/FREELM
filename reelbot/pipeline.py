"""End-to-end pipeline: research -> script -> voice -> media -> music -> render -> (upload)."""
from __future__ import annotations

import json
import logging
import random
import re
from datetime import datetime
from pathlib import Path

import numpy as np

from . import music, research, script as scriptmod, topics, tts
from .media import MediaFinder
from .render import Scene, Word, render_video
from .script import Line, Script

log = logging.getLogger(__name__)

GAP = 0.28        # pause between sentences (seconds)
TAIL = 0.8        # hold after the last word


# --------------------------------------------------------------------------- history

def _history_path(cfg) -> Path:
    return Path(cfg["output_dir"]) / "history.json"


def load_history(cfg) -> list[dict]:
    p = _history_path(cfg)
    if p.exists():
        try:
            return json.loads(p.read_text())
        except json.JSONDecodeError:
            return []
    return []


def save_history(cfg, history: list[dict]) -> None:
    _history_path(cfg).write_text(json.dumps(history, indent=2))


# --------------------------------------------------------------------------- research + script

def pick_evergreen(cfg, history, topic_id: str | None = None) -> dict:
    pool = topics.topics_for(cfg["niche"])
    if topic_id:
        match = [t for t in topics.TOPICS if t["id"] == topic_id]
        if not match:
            raise SystemExit(f"Unknown topic '{topic_id}'. Run `python -m reelbot topics` to list them.")
        return match[0]
    last_used = {h["topic_id"]: i for i, h in enumerate(history)}
    unused = [t for t in pool if t["id"] not in last_used]
    if unused:
        return random.choice(unused)
    return min(pool, key=lambda t: last_used.get(t["id"], -1))


def build_script(cfg, history, mode: str | None = None, topic_id: str | None = None) -> Script:
    mode = (mode or cfg["mode"]).lower()
    niche = cfg["niche"]
    today = datetime.now().strftime("%Y%m%d")
    done_today = {h["topic_id"] for h in history}
    if topic_id:
        mode = "evergreen"

    order = [mode]
    if mode == "auto":
        weights = {"evergreen": 0.5, "news": 0.3, "market": 0.2}
        if niche in ("investing", "crypto", "economy"):
            weights = {"evergreen": 0.4, "news": 0.3, "market": 0.3}
        last_kind = history[-1]["kind"] if history else None
        if last_kind in weights and len(weights) > 1:
            weights[last_kind] *= 0.4
        order = random.choices(list(weights), weights=list(weights.values()), k=1)
        order += [m for m in ("news", "market", "evergreen") if m not in order]
    if "evergreen" not in order:
        order.append("evergreen")  # always have a fallback

    headlines = markets = None
    for m in order:
        log.info("Researching (%s, niche: %s)...", m, niche)
        if m == "news" and f"news-{scriptmod._slug(niche)}-{today}" not in done_today:
            headlines = headlines if headlines is not None else research.fetch_headlines(niche)
            markets = markets if markets is not None else research.market_snapshot(niche)
            s = scriptmod.build_news(headlines, markets, cfg)
            if s:
                return s
        elif m == "market" and f"market-{scriptmod._slug(niche)}-{today}" not in done_today:
            markets = markets if markets is not None else research.market_snapshot(niche)
            headlines = headlines if headlines is not None else research.fetch_headlines(niche)
            s = scriptmod.build_market(markets, headlines, cfg)
            if s:
                return s
        elif m == "evergreen":
            return scriptmod.build_evergreen(pick_evergreen(cfg, history, topic_id), cfg)
    return scriptmod.build_evergreen(pick_evergreen(cfg, history), cfg)


# --------------------------------------------------------------------------- voice + timing

def _total(clips: list[np.ndarray]) -> float:
    return sum(len(c) for c in clips) / tts.SAMPLE_RATE + GAP * (len(clips) - 1) + TAIL


def voice_script(script: Script, speaker: tts.Speaker, cfg) -> tuple[list[np.ndarray], float]:
    lo, hi = float(cfg["video"]["min_seconds"]), float(cfg["video"]["max_seconds"])
    speed = 1.0
    clips = [speaker.say(l.spoken, speed) for l in script.lines]

    # Too short: add extra researched points before the call to action.
    while _total(clips) < lo and script.extras:
        extra = script.extras.pop(0)
        script.lines.insert(len(script.lines) - 1, extra)
        clips.insert(len(clips) - 1, speaker.say(extra.spoken, speed))

    # Too long: speak a little faster, then drop the least important middle line.
    while _total(clips) > hi and speed < 1.18:
        speed = round(speed + 0.06, 2)
        clips = [speaker.say(l.spoken, speed) for l in script.lines]
    while _total(clips) > hi and len(script.lines) > 4:
        middle = range(1, len(script.lines) - 1)
        drop = max(middle, key=lambda i: (script.lines[i].kind != "chart", len(clips[i])))
        del script.lines[drop], clips[drop]

    if _total(clips) < lo and speed > 0.92:
        speed = 0.92
        clips = [speaker.say(l.spoken, speed) for l in script.lines]
    log.info("Voiceover: %d lines, %.1fs (speed x%.2f)", len(clips), _total(clips), speed)
    return clips, speed


def word_timings(script: Script, clips: list[np.ndarray]) -> tuple[list[Word], list[tuple[float, float]]]:
    """Estimate when each caption word is spoken (proportional to its spoken length)."""
    words: list[Word] = []
    spans = []
    t = 0.0
    for line, clip in zip(script.lines, clips):
        dur = len(clip) / tts.SAMPLE_RATE
        spans.append((t, t + dur))
        tokens = line.text.split()
        weights = [len(scriptmod.speakable(tok)) + 2.5 + (4 if re.search(r"[.,!?;:]$", tok) else 0) for tok in tokens]
        total_w = sum(weights) or 1
        cursor = t + 0.04
        usable = dur - 0.08
        for tok, w in zip(tokens, weights):
            d = usable * w / total_w
            words.append(Word(tok, cursor, cursor + d))
            cursor += d
        t += dur + GAP
    return words, spans


def assemble_audio(clips: list[np.ndarray], cfg, seed: int) -> tuple[np.ndarray, float]:
    sr = tts.SAMPLE_RATE
    gap = np.zeros(int(GAP * sr), dtype=np.float32)
    parts = []
    for i, c in enumerate(clips):
        parts.append(c)
        if i < len(clips) - 1:
            parts.append(gap)
    voice = np.concatenate(parts)
    lo = float(cfg["video"]["min_seconds"])
    total = max(len(voice) / sr + TAIL, lo)
    voice = np.pad(voice, (0, int(total * sr) - len(voice)))
    if cfg["music"].get("enabled", True):
        bgm = music.generate(total, seed=seed)
        audio = music.mix(voice, bgm, float(cfg["music"].get("volume", 0.14)))
    else:
        audio = voice
    return audio, total


# --------------------------------------------------------------------------- media + scenes

def gather_scenes(script: Script, spans, total: float, cfg, seed: int) -> tuple[list[Scene], list[str]]:
    finder = MediaFinder(cfg)
    scenes, credits = [], []
    media_count = 0
    used_queries: set[str] = set()
    spare = [v for v in topics.generic_visuals(cfg["niche"])]
    random.shuffle(spare)
    for i, (line, (start, _end)) in enumerate(zip(script.lines, spans)):
        s_start = 0.0 if i == 0 else start - GAP / 2
        s_end = total if i == len(script.lines) - 1 else spans[i + 1][0] - GAP / 2
        sc = Scene(s_start, s_end, "fallback", seed=seed + i)
        if line.kind == "outro":
            sc.kind = "outro"
        elif line.kind == "chart" and line.chart:
            sc.kind, sc.chart = "chart", line.chart
        else:
            query = line.visual or (spare[0] if spare else "money")
            if query in used_queries:  # avoid three shots of the same subject in a row
                query = next((v for v in spare if v not in used_queries), query)
            used_queries.add(query)
            log.info("Finding media for scene %d: '%s'", i + 1, query)
            prefer_video = media_count % 3 == 1
            asset = finder.find(query, prefer_video)
            media_count += 1
            if asset:
                sc.kind, sc.path = asset.kind, asset.path
                if asset.credit not in credits:
                    credits.append(asset.credit)
        scenes.append(sc)
    return scenes, credits


# --------------------------------------------------------------------------- metadata

def _hashtag(s: str) -> str:
    return "#" + re.sub(r"[^A-Za-z0-9]", "", s.title())


def build_metadata(script: Script, credits: list[str], cfg) -> dict:
    title = script.title
    if len(title) + 8 <= 100:
        title += " #Shorts"
    tags = list(dict.fromkeys(script.tags + [script.niche] + list(cfg["youtube"].get("extra_tags", []))))
    hashtags = " ".join(dict.fromkeys(["#Shorts", "#Finance", "#Money"] + [_hashtag(t) for t in tags[:5]]))
    desc = [script.title, "", script.text, ""]
    if script.sources:
        desc += ["Sources:"] + [f"- {s}" for s in script.sources] + [""]
    if credits:
        desc += ["Media credits:"] + [f"- {c}" for c in credits] + [""]
    desc += ["Music: original, procedurally generated.",
             "Not financial advice. This video is for educational purposes only.", "", hashtags]
    return {"title": title, "description": "\n".join(desc), "tags": tags}


# --------------------------------------------------------------------------- main entry

def make_reel(cfg, mode: str | None = None, topic_id: str | None = None, upload: bool = False) -> dict:
    history = load_history(cfg)
    seed = random.randrange(1_000_000)
    random.seed(seed)

    script = build_script(cfg, history, mode, topic_id)
    script = scriptmod.rewrite_with_ollama(script, cfg)
    log.info("Topic: %s [%s]", script.title, script.kind)

    speaker = tts.Speaker(cfg)
    clips, _ = voice_script(script, speaker, cfg)
    words, spans = word_timings(script, clips)
    audio, total = assemble_audio(clips, cfg, seed)

    slug = re.sub(r"[^a-z0-9]+", "-", script.title.lower()).strip("-")[:50]
    out_dir = Path(cfg["output_dir"]) / f"{datetime.now():%Y%m%d-%H%M%S}-{slug}"
    out_dir.mkdir(parents=True, exist_ok=True)
    audio_path = out_dir / "audio.wav"
    tts.write_wav(audio_path, audio)

    scenes, credits = gather_scenes(script, spans, total, cfg, seed)
    meta = build_metadata(script, credits, cfg)
    video_path = out_dir / "reel.mp4"
    log.info("Rendering %.1fs video...", total)
    render_video(scenes, words, script.title, audio_path, video_path, cfg)
    audio_path.unlink(missing_ok=True)

    (out_dir / "script.txt").write_text("\n".join(l.text for l in script.lines) + "\n")
    meta.update({"kind": script.kind, "topic_id": script.topic_id, "duration": round(total, 2),
                 "video": str(video_path), "created": datetime.now().isoformat(timespec="seconds")})
    if upload or cfg["youtube"].get("upload"):
        from . import youtube
        meta["youtube_id"] = youtube.upload(video_path, meta["title"], meta["description"], meta["tags"], cfg)
        meta["youtube_url"] = f"https://youtube.com/shorts/{meta['youtube_id']}"
    (out_dir / "metadata.json").write_text(json.dumps(meta, indent=2))

    history.append({k: meta.get(k) for k in ("topic_id", "kind", "title", "created", "video", "youtube_id")})
    save_history(cfg, history)
    log.info("Done: %s", video_path)
    return meta
