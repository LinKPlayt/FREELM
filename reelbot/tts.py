"""Offline text-to-speech.

Primary engine: Piper (neural, natural sounding, runs locally on CPU). The voice model is
downloaded once from the public rhasspy/piper-voices repository and cached.
Fallback: espeak-ng (robotic, but always available on Linux via apt).
"""
from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

log = logging.getLogger(__name__)

SAMPLE_RATE = 44100  # everything downstream works at this rate


def _resample(samples: np.ndarray, src_rate: int, dst_rate: int = SAMPLE_RATE) -> np.ndarray:
    if src_rate == dst_rate or len(samples) == 0:
        return samples.astype(np.float32)
    n = int(round(len(samples) * dst_rate / src_rate))
    x_old = np.linspace(0, 1, len(samples), endpoint=False)
    x_new = np.linspace(0, 1, n, endpoint=False)
    return np.interp(x_new, x_old, samples).astype(np.float32)


class Speaker:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.engine = cfg["voice"].get("engine", "piper")
        self.speed = float(cfg["voice"].get("speed", 1.0))
        self._voice = None
        if self.engine == "piper":
            try:
                self._voice = self._load_piper()
            except Exception as exc:  # noqa: BLE001
                log.warning("Piper unavailable (%s); falling back to espeak-ng.", exc)
                self.engine = "espeak"
        if self.engine == "espeak" and not shutil.which("espeak-ng") and not shutil.which("espeak"):
            raise RuntimeError("No TTS engine available. Run `pip install piper-tts` (recommended) "
                               "or install espeak-ng.")

    def _load_piper(self):
        from piper import PiperVoice
        from piper.download_voices import download_voice

        model = self.cfg["voice"].get("model", "en_US-ryan-high")
        voice_dir = Path(self.cfg["cache_dir"]) / "voices"
        voice_dir.mkdir(parents=True, exist_ok=True)
        onnx = voice_dir / f"{model}.onnx"
        if not onnx.exists():
            log.info("Downloading Piper voice '%s' (one time)...", model)
            download_voice(model, voice_dir)
        return PiperVoice.load(str(onnx))

    def say(self, text: str, speed_mult: float = 1.0) -> np.ndarray:
        """Synthesize text -> float32 mono samples at SAMPLE_RATE, trimmed of edge silence."""
        speed = self.speed * speed_mult
        if self.engine == "piper":
            from piper import SynthesisConfig
            syn = SynthesisConfig(length_scale=1.0 / speed)
            parts, rate = [], 22050
            for chunk in self._voice.synthesize(text, syn_config=syn):
                parts.append(chunk.audio_float_array)
                rate = chunk.sample_rate
            audio = _resample(np.concatenate(parts) if parts else np.zeros(1), rate)
        else:
            audio = self._espeak(text, speed)
        return _trim(audio)

    def _espeak(self, text: str, speed: float) -> np.ndarray:
        exe = shutil.which("espeak-ng") or shutil.which("espeak")
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "s.wav"
            subprocess.run([exe, "-v", "en-us", "-s", str(int(165 * speed)), "-w", str(out), text], check=True)
            with wave.open(str(out)) as w:
                rate = w.getframerate()
                data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        return _resample(data, rate)


def _trim(audio: np.ndarray, threshold: float = 0.01) -> np.ndarray:
    idx = np.where(np.abs(audio) > threshold)[0]
    if len(idx) == 0:
        return audio
    pad = int(0.03 * SAMPLE_RATE)
    return audio[max(0, idx[0] - pad): min(len(audio), idx[-1] + pad)]


def write_wav(path: str | Path, audio: np.ndarray, rate: int = SAMPLE_RATE) -> None:
    pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())
