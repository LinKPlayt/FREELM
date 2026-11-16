"""Frame-by-frame compositor that renders the final vertical MP4 with ffmpeg.

Layers (bottom to top):
  1. Scene background: Ken-Burns photo, video clip, animated market chart, or outro card
  2. Legibility gradients + header (brand pill and video title)
  3. Word-by-word captions with the active word highlighted
  4. Progress bar
"""
from __future__ import annotations

import json
import logging
import math
import random
import re
import subprocess
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageColor, ImageDraw, ImageFilter, ImageFont, ImageOps

from .config import ROOT

log = logging.getLogger(__name__)

FONT_DIR = ROOT / "assets" / "fonts"
SYSTEM_BOLD = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/impact.ttf",
]


@lru_cache(maxsize=64)
def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    candidates = [FONT_DIR / name] + [Path(p) for p in SYSTEM_BOLD]
    for c in candidates:
        if c.exists():
            return ImageFont.truetype(str(c), size)
    return ImageFont.load_default(size)


CAPTION_FONT = "Anton-Regular.ttf"
BOLD_FONT = "Montserrat-ExtraBold.ttf"
BODY_FONT = "Montserrat-Medium.ttf"


@dataclass
class Scene:
    start: float
    end: float
    kind: str                       # image | video | chart | outro | fallback
    path: Path | None = None
    chart: dict | None = None
    seed: int = 0


@dataclass
class Word:
    text: str
    start: float
    end: float


def _ease(x: float) -> float:
    x = min(1.0, max(0.0, x))
    return 0.5 - 0.5 * math.cos(math.pi * x)


def _vertical_gradient(w: int, h: int, top: tuple, bottom: tuple) -> Image.Image:
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    a = np.array(top, dtype=np.float32)[None, None, :]
    b = np.array(bottom, dtype=np.float32)[None, None, :]
    arr = (a * (1 - t) + b * t).repeat(w, axis=1)
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8), "RGBA" if len(top) == 4 else "RGB")


def _wrap(text: str, fnt: ImageFont.FreeTypeFont, max_width: int, draw: ImageDraw.ImageDraw) -> list[str]:
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=fnt) <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


# --------------------------------------------------------------------------- scene backgrounds

class ImageBackground:
    SCALE = 1.18

    def __init__(self, path: Path, size: tuple[int, int], seed: int):
        W, H = size
        self.size = size
        rng = random.Random(seed)
        bw, bh = int(W * self.SCALE), int(H * self.SCALE)
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
        if im.width / im.height > 0.72:
            # Landscape/square: blurred cover background + full image in the middle.
            bg = ImageOps.fit(im, (bw // 4, bh // 4)).filter(ImageFilter.GaussianBlur(12)).resize((bw, bh))
            bg = Image.blend(bg, Image.new("RGB", bg.size, (0, 0, 0)), 0.45)
            fw = int(bw * 0.96)
            fh = int(im.height * fw / im.width)
            if fh > bh * 0.62:
                fh = int(bh * 0.62)
                fw = int(im.width * fh / im.height)
            fg = im.resize((fw, fh), Image.LANCZOS)
            bg.paste(fg, ((bw - fw) // 2, int(bh * 0.47 - fh / 2)))
            self.base = bg
        else:
            self.base = ImageOps.fit(im, (bw, bh), Image.LANCZOS, centering=(0.5, 0.4))
        self.zoom_in = rng.random() < 0.65
        self.pan = (rng.uniform(-1, 1), rng.uniform(-1, 1))

    def frame(self, p: float) -> Image.Image:
        W, H = self.size
        bw, bh = self.base.size
        e = _ease(p)
        z = 1 + (self.SCALE - 1) * (e if self.zoom_in else 1 - e)  # 1..SCALE
        cw, ch = bw / z, bh / z
        max_dx, max_dy = (bw - cw) / 2, (bh - ch) / 2
        cx = bw / 2 + self.pan[0] * max_dx * (e - 0.5)
        cy = bh / 2 + self.pan[1] * max_dy * (e - 0.5)
        box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
        return self.base.resize((W, H), Image.BILINEAR, box=box)


class VideoBackground:
    def __init__(self, path: Path, size: tuple[int, int], duration: float, fps: int):
        W, H = size
        self.size = size
        self.frame_bytes = W * H * 3
        self.last: Image.Image | None = None
        w, h = _probe_size(path)
        if w and h and w / h > 0.72:
            vf = (f"[0:v]split[a][b];[a]scale={W // 4}:{H // 4}:force_original_aspect_ratio=increase,"
                  f"crop={W // 4}:{H // 4},boxblur=8:2,scale={W}:{H},eq=brightness=-0.18[bg];"
                  f"[b]scale={int(W * 0.96)}:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)*0.47,fps={fps},format=rgb24")
        else:
            vf = f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={fps},format=rgb24"
        cmd = ["ffmpeg", "-loglevel", "error", "-stream_loop", "-1", "-i", str(path), "-t", f"{duration + 0.5:.2f}",
               "-filter_complex", vf, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
        self.proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)

    def frame(self, p: float) -> Image.Image:
        buf = self.proc.stdout.read(self.frame_bytes) if self.proc.stdout else b""
        if len(buf) == self.frame_bytes:
            self.last = Image.frombytes("RGB", self.size, buf)
        if self.last is None:
            self.last = Image.new("RGB", self.size, (10, 14, 30))
        return self.last

    def close(self):
        if self.proc.poll() is None:
            self.proc.kill()
        self.proc.wait()


def _probe_size(path: Path) -> tuple[int, int]:
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                              "stream=width,height", "-of", "json", str(path)],
                             capture_output=True, text=True, timeout=30).stdout
        s = json.loads(out)["streams"][0]
        return int(s["width"]), int(s["height"])
    except Exception:  # noqa: BLE001
        return 0, 0


class ChartBackground:
    """Animated line chart for real market data (or a decorative random walk as a fallback)."""

    def __init__(self, size: tuple[int, int], accent: tuple, chart: dict | None, seed: int):
        W, H = size
        self.size = size
        self.chart = chart
        rng = random.Random(seed)
        if chart:
            values = chart["values"]
        else:
            v, values = 100.0, []
            for _ in range(60):
                v *= 1 + rng.gauss(0.004, 0.02)
                values.append(v)
        up = values[-1] >= values[0]
        self.color = (46, 213, 115) if up else (255, 71, 87)
        bg = _vertical_gradient(W, H, (8, 12, 28), (18, 26, 58))
        d = ImageDraw.Draw(bg, "RGBA")
        # Subtle grid.
        self.box = (90, 640, W - 90, 1180)
        x0, y0, x1, y1 = self.box
        for i in range(6):
            y = y0 + (y1 - y0) * i / 5
            d.line([(x0, y), (x1, y)], fill=(255, 255, 255, 22), width=2)
        if chart:
            name = chart["name"].upper()
            d.text((W / 2, 455), name, font=font(BOLD_FONT, 54), fill=(255, 255, 255, 230), anchor="mm")
            last = chart["last"]
            price = f"{last:.2f}%" if chart["is_yield"] else (f"{last:,.0f}" if last >= 1000 else f"{last:,.2f}")
            if chart["symbol"] in ("BTC-USD", "ETH-USD", "GC=F", "CL=F"):
                price = "$" + price
            d.text((W / 2, 545), price, font=font(CAPTION_FONT, 104), fill=(255, 255, 255), anchor="mm")
            pct = chart["period_pct"]
            label = f"{'▲' if pct >= 0 else '▼'} {abs(pct):.1f}%  ·  3 MONTHS"
            d.text((W / 2, 1235), label, font=font(BOLD_FONT, 46), fill=self.color + (255,), anchor="mm")
        lo, hi = min(values), max(values)
        rngv = (hi - lo) or 1
        self.points = [(x0 + (x1 - x0) * i / (len(values) - 1), y1 - (y1 - y0) * (v - lo) / rngv)
                       for i, v in enumerate(values)]
        self.bg = bg

    def frame(self, p: float) -> Image.Image:
        img = self.bg.copy()
        d = ImageDraw.Draw(img, "RGBA")
        prog = _ease(min(1.0, p / 0.75))
        n = max(2, int(len(self.points) * prog))
        pts = self.points[:n]
        y_base = self.box[3]
        d.polygon(pts + [(pts[-1][0], y_base), (pts[0][0], y_base)], fill=self.color + (40,))
        d.line(pts, fill=self.color + (90,), width=18, joint="curve")
        d.line(pts, fill=self.color + (255,), width=8, joint="curve")
        x, y = pts[-1]
        r = 14 + 4 * math.sin(p * 20)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 255))
        return img


class OutroBackground:
    def __init__(self, size: tuple[int, int], accent: tuple, brand: str):
        W, H = size
        self.size = size
        base = _vertical_gradient(W, H, (10, 14, 32), tuple(int(c * 0.35) for c in accent))
        d = ImageDraw.Draw(base, "RGBA")
        d.text((W / 2, 640), brand.upper(), font=font(CAPTION_FONT, 132), fill=accent + (255,), anchor="mm",
               stroke_width=4, stroke_fill=(0, 0, 0, 200))
        d.text((W / 2, 1790), "NOT FINANCIAL ADVICE · FOR EDUCATION ONLY", font=font(BODY_FONT, 30),
               fill=(255, 255, 255, 150), anchor="mm")
        self.base = base
        self.accent = accent

    def frame(self, p: float) -> Image.Image:
        img = self.base.copy()
        d = ImageDraw.Draw(img, "RGBA")
        W, _ = self.size
        # Pulsing ring around a "subscribe" style badge.
        r = 70 + 10 * math.sin(p * 2 * math.pi * 2)
        cx, cy = W / 2, 860
        d.ellipse([cx - r - 18, cy - r - 18, cx + r + 18, cy + r + 18], outline=self.accent + (90,), width=6)
        d.ellipse([cx - 70, cy - 70, cx + 70, cy + 70], fill=self.accent + (255,))
        d.polygon([(cx - 22, cy - 34), (cx - 22, cy + 34), (cx + 36, cy)], fill=(10, 14, 32, 255))
        return img


# --------------------------------------------------------------------------- captions

def chunk_words(words: list[Word], max_words: int = 3, max_chars: int = 16) -> list[list[int]]:
    chunks, cur = [], []
    for i, w in enumerate(words):
        cur_len = sum(len(words[j].text) + 1 for j in cur)
        if cur and (len(cur) >= max_words or cur_len + len(w.text) > max_chars):
            chunks.append(cur)
            cur = []
        cur.append(i)
        if re.search(r"[.!?,:;]$", w.text):
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    return chunks


class CaptionRenderer:
    def __init__(self, words: list[Word], width: int, accent: tuple):
        self.words = words
        self.width = width
        self.accent = accent
        self.chunks = chunk_words(words)
        self.chunk_times = []
        for k, ch in enumerate(self.chunks):
            start = words[ch[0]].start
            end = words[self.chunks[k + 1][0]].start if k + 1 < len(self.chunks) else words[ch[-1]].end + 0.3
            # Don't hold captions through long pauses between sentences.
            end = min(end, words[ch[-1]].end + 0.35)
            self.chunk_times.append((start, end))
        self._cache: dict = {}

    def _render(self, k: int, active: int) -> Image.Image:
        key = (k, active)
        if key in self._cache:
            return self._cache[key]
        idxs = self.chunks[k]
        texts = [re.sub(r"[\"“”]", "", self.words[i].text).upper() for i in idxs]
        size = 118
        while True:
            fnt = font(CAPTION_FONT, size)
            space = size * 0.28
            widths = [fnt.getlength(t) for t in texts]
            total = sum(widths) + space * (len(texts) - 1)
            if total <= self.width - 120 or size <= 60:
                break
            size -= 6
        pad = 30
        h = int(size * 1.45) + pad * 2
        img = Image.new("RGBA", (int(total) + pad * 2, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        x = pad
        for j, (t, w) in enumerate(zip(texts, widths)):
            is_active = idxs[j] == active
            color = self.accent if is_active else (255, 255, 255)
            d.text((x, pad + size * 0.1), t, font=fnt, fill=color, stroke_width=9, stroke_fill=(0, 0, 0))
            x += w + space
        shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
        shadow.putalpha(img.getchannel("A").filter(ImageFilter.GaussianBlur(10)).point(lambda a: a * 0.6))
        out = Image.alpha_composite(shadow, img)
        self._cache[key] = out
        return out

    def overlay(self, frame: Image.Image, t: float, center_y: int) -> None:
        for k, (start, end) in enumerate(self.chunk_times):
            if start <= t < end:
                active = next((i for i in self.chunks[k] if self.words[i].start <= t < self.words[i].end + 0.05),
                              self.chunks[k][-1] if t >= self.words[self.chunks[k][-1]].start else self.chunks[k][0])
                img = self._render(k, active)
                age = t - start
                if age < 0.12:  # pop-in
                    s = 0.82 + 0.18 * _ease(age / 0.12)
                    img = img.resize((max(1, int(img.width * s)), max(1, int(img.height * s))), Image.BILINEAR)
                frame.alpha_composite(img, (int((frame.width - img.width) / 2), int(center_y - img.height / 2)))
                return


# --------------------------------------------------------------------------- main renderer

def _header_overlay(size: tuple[int, int], title: str, brand: str, accent: tuple) -> Image.Image:
    W, H = size
    ov = Image.new("RGBA", size, (0, 0, 0, 0))
    top = _vertical_gradient(W, 560, (0, 0, 0, 175), (0, 0, 0, 0))
    bottom = _vertical_gradient(W, 1000, (0, 0, 0, 0), (0, 0, 0, 185))
    ov.alpha_composite(top, (0, 0))
    ov.alpha_composite(bottom, (0, H - 1000))
    d = ImageDraw.Draw(ov)
    if brand:
        pill_font = font(BOLD_FONT, 34)
        label = brand.upper()
        tw = d.textlength(label, font=pill_font)
        px, py = W / 2, 150
        d.rounded_rectangle([px - tw / 2 - 28, py - 32, px + tw / 2 + 28, py + 32], radius=32, fill=accent + (255,))
        d.text((px, py), label, font=pill_font, fill=(12, 12, 20), anchor="mm")
    tf = font(BOLD_FONT, 60)
    lines = _wrap(title, tf, W - 140, d)[:2]
    for i, line in enumerate(lines):
        d.text((W / 2, 250 + i * 76), line, font=tf, fill=(255, 255, 255), anchor="mm",
               stroke_width=5, stroke_fill=(0, 0, 0))
    return ov


def render_video(scenes: list[Scene], words: list[Word], title: str, audio_path: Path, out_path: Path,
                 cfg: dict) -> Path:
    v = cfg["video"]
    W, H, fps = int(v["width"]), int(v["height"]), int(v["fps"])
    size = (W, H)
    accent = ImageColor.getrgb(v.get("accent_color", "#FFD60A"))[:3]
    brand = v.get("brand_name", "Money Minute")
    total = scenes[-1].end
    n_frames = int(math.ceil(total * fps))

    header = _header_overlay(size, title, brand, accent)
    plain = _header_overlay(size, "", "", accent)  # gradients only, for the outro
    captions = CaptionRenderer(words, W, accent)

    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(fps), "-i", "-", "-i", str(audio_path), "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest",
           "-movflags", "+faststart", str(out_path)]
    writer = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    current_idx, bg, prev_last = -1, None, None
    fade_frames = int(0.25 * fps)
    try:
        for f in range(n_frames):
            t = f / fps
            idx = next((i for i, s in enumerate(scenes) if s.start <= t < s.end), len(scenes) - 1)
            sc = scenes[idx]
            if idx != current_idx:
                if bg is not None and hasattr(bg, "close"):
                    bg.close()
                bg = _make_background(sc, size, accent, brand, fps)
                current_idx, scene_frame = idx, 0
            p = (t - sc.start) / max(0.001, sc.end - sc.start)
            frame = bg.frame(p).convert("RGBA")
            if prev_last is not None and scene_frame < fade_frames and idx > 0:
                alpha = _ease(scene_frame / fade_frames)
                frame = Image.blend(prev_last, frame, alpha)
            frame.alpha_composite(plain if sc.kind == "outro" else header)
            captions.overlay(frame, t, center_y=1440 if sc.kind != "outro" else 1180)
            d = ImageDraw.Draw(frame)
            d.rectangle([0, H - 12, int(W * (t / total)), H], fill=accent + (255,))
            rgb = frame.convert("RGB")
            writer.stdin.write(rgb.tobytes())
            scene_frame += 1
            # Remember the last frame of each scene (without overlays) for crossfades.
            if t + 1 / fps >= sc.end:
                prev_last = bg.frame(1.0).convert("RGBA") if not isinstance(bg, VideoBackground) else bg.last.convert("RGBA")
            if f % (fps * 5) == 0:
                log.info("  rendering... %d%%", int(100 * f / n_frames))
    finally:
        if bg is not None and hasattr(bg, "close"):
            bg.close()
        writer.stdin.close()
        writer.wait()
    if writer.returncode != 0:
        raise RuntimeError("ffmpeg failed to encode the video")
    return out_path


def _make_background(sc: Scene, size, accent, brand, fps):
    try:
        if sc.kind == "image" and sc.path:
            return ImageBackground(sc.path, size, sc.seed)
        if sc.kind == "video" and sc.path:
            return VideoBackground(sc.path, size, sc.end - sc.start, fps)
        if sc.kind == "outro":
            return OutroBackground(size, accent, brand)
        if sc.kind == "chart":
            return ChartBackground(size, accent, sc.chart, sc.seed)
    except Exception as exc:  # noqa: BLE001
        log.warning("Scene background failed (%s); using fallback.", exc)
    return ChartBackground(size, accent, None, sc.seed)
