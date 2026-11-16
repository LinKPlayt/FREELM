"""Procedurally generated, royalty-free background music.

Every track is synthesized from scratch with numpy (soft pads, a plucked arpeggio and a gentle
beat), so there is zero copyright risk and no downloads. Each video gets a fresh variation.
"""
from __future__ import annotations

import random

import numpy as np

from .tts import SAMPLE_RATE as SR

# Pleasant, "lo-fi finance" progressions as scale degrees in a major key (semitones from root).
PROGRESSIONS = [
    [(0, 4, 7, 11), (9, 12, 16, 19), (5, 9, 12, 16), (7, 11, 14, 17)],   # Imaj7 vi IVmaj7 V
    [(0, 4, 7, 11), (5, 9, 12, 16), (9, 12, 16, 19), (7, 11, 14, 17)],   # I IV vi V
    [(2, 5, 9, 12), (7, 11, 14, 17), (0, 4, 7, 11), (0, 4, 7, 11)],      # ii V I I
    [(9, 12, 16, 19), (5, 9, 12, 16), (0, 4, 7, 11), (7, 11, 14, 17)],   # vi IV I V
]


def _freq(semitone: float, root: float) -> float:
    return root * 2 ** (semitone / 12)


def _env(n: int, attack: float, release: float) -> np.ndarray:
    env = np.ones(n, dtype=np.float32)
    a, r = max(1, int(attack * SR)), max(1, int(release * SR))
    env[:a] = np.linspace(0, 1, a)
    env[-r:] *= np.linspace(1, 0, r)
    return env


def generate(duration: float, seed: int | None = None) -> np.ndarray:
    rng = random.Random(seed)
    bpm = rng.choice([84, 88, 92, 96])
    beat = 60 / bpm
    bar = beat * 4
    root = 220 * 2 ** (rng.randint(-5, 4) / 12)  # random key around A3
    prog = rng.choice(PROGRESSIONS)
    n_total = int((duration + 1) * SR)
    out = np.zeros(n_total, dtype=np.float32)
    t_bar = np.arange(int(bar * SR)) / SR

    bars = int(np.ceil(duration / bar)) + 1
    for b in range(bars):
        chord = prog[b % len(prog)]
        start = int(b * bar * SR)
        seg = np.zeros(len(t_bar), dtype=np.float32)
        # Warm pad: detuned sines + soft triangle per chord tone.
        for st in chord:
            f = _freq(st, root / 2)
            seg += 0.10 * np.sin(2 * np.pi * f * t_bar)
            seg += 0.05 * np.sin(2 * np.pi * f * 1.003 * t_bar)
            seg += 0.03 * (2 / np.pi) * np.arcsin(np.sin(2 * np.pi * f * 2 * t_bar))
        seg *= _env(len(seg), 0.4, 0.4)
        # Bass note on the root of the chord.
        bass_f = _freq(chord[0], root / 4)
        seg += 0.16 * np.sin(2 * np.pi * bass_f * t_bar) * _env(len(seg), 0.02, 0.3)
        # Plucked arpeggio, eighth notes.
        step = beat / 2
        pattern = [0, 1, 2, 3, 2, 1, 2, 3]
        for k, idx in enumerate(pattern):
            n_start = int(k * step * SR)
            n_len = int(step * 1.8 * SR)
            tt = np.arange(n_len) / SR
            f = _freq(chord[idx % len(chord)] + 12, root / 2)
            note = 0.07 * np.sin(2 * np.pi * f * tt) * np.exp(-tt * 6)
            end = min(len(seg), n_start + n_len)
            seg[n_start:end] += note[: end - n_start]
        # Gentle beat: soft kick on 1 & 3, shaker on off-beats.
        for k in range(4):
            ks = int(k * beat * SR)
            if k in (0, 2):
                kl = int(0.25 * SR)
                tt = np.arange(kl) / SR
                kick = 0.35 * np.sin(2 * np.pi * (50 + 80 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 14)
                e = min(len(seg), ks + kl)
                seg[ks:e] += kick[: e - ks]
            hs = int((k + 0.5) * beat * SR)
            hl = int(0.05 * SR)
            if hs + hl < len(seg):
                noise = np.array([rng.uniform(-1, 1) for _ in range(hl)], dtype=np.float32)
                seg[hs:hs + hl] += 0.03 * noise * np.exp(-np.arange(hl) / SR * 80)
        end = min(n_total, start + len(seg))
        if start < n_total:
            out[start:end] += seg[: end - start]

    out = out[: int(duration * SR)]
    # Simple low-pass smoothing for a softer, "lo-fi" tone.
    kernel = np.ones(6, dtype=np.float32) / 6
    out = np.convolve(out, kernel, mode="same")
    out *= _env(len(out), 1.0, 1.5)
    peak = np.max(np.abs(out)) or 1.0
    return (out / peak * 0.9).astype(np.float32)


def mix(voice: np.ndarray, music: np.ndarray, music_volume: float) -> np.ndarray:
    """Mix voice with music, ducking the music under speech."""
    n = max(len(voice), len(music))
    v = np.pad(voice, (0, n - len(voice)))
    m = np.pad(music, (0, n - len(music)))
    # Envelope follower on the voice -> duck music by ~50% while someone is talking.
    win = int(0.25 * SR)
    env = np.convolve(np.abs(v), np.ones(win) / win, mode="same")
    env = np.clip(env / (np.max(env) or 1) * 4, 0, 1)
    duck = 1 - 0.5 * env
    out = v * 0.95 + m * music_volume * duck
    peak = np.max(np.abs(out)) or 1.0
    return (out / max(peak, 1.0) * 0.97).astype(np.float32)
