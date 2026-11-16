// Original background music, synthesized on the phone for every reel (no samples, no copyright risk).
export const SR = 48000;

const PROGRESSIONS = [
  [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]],
  [[0, 4, 7, 11], [5, 9, 12, 16], [9, 12, 16, 19], [7, 11, 14, 17]],
  [[2, 5, 9, 12], [7, 11, 14, 17], [0, 4, 7, 11], [0, 4, 7, 11]],
  [[9, 12, 16, 19], [5, 9, 12, 16], [0, 4, 7, 11], [7, 11, 14, 17]],
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const freq = (semi, root) => root * 2 ** (semi / 12);
const TAU = Math.PI * 2;

export function generateMusic(duration) {
  const bpm = pick([84, 88, 92, 96]), beat = 60 / bpm, bar = beat * 4;
  const root = 220 * 2 ** ((Math.floor(Math.random() * 10) - 5) / 12);
  const prog = pick(PROGRESSIONS);
  const total = Math.floor(duration * SR);
  const out = new Float32Array(total);
  const barN = Math.floor(bar * SR);
  const bars = Math.ceil(duration / bar) + 1;
  const add = (i, v) => { if (i >= 0 && i < total) out[i] += v; };

  for (let b = 0; b < bars; b++) {
    const chord = prog[b % prog.length], start = b * barN;
    const attack = 0.4 * SR, release = 0.4 * SR;
    for (let n = 0; n < barN && start + n < total; n++) {       // warm pad + bass
      const t = n / SR;
      const env = Math.min(1, n / attack) * Math.min(1, (barN - n) / release);
      let v = 0;
      for (const st of chord) {
        const f = freq(st, root / 2);
        v += 0.10 * Math.sin(TAU * f * t) + 0.05 * Math.sin(TAU * f * 1.003 * t) + 0.03 * (2 / Math.PI) * Math.asin(Math.sin(TAU * f * 2 * t));
      }
      const bassEnv = Math.min(1, n / (0.02 * SR)) * Math.min(1, (barN - n) / (0.3 * SR));
      out[start + n] += v * env + 0.16 * Math.sin(TAU * freq(chord[0], root / 4) * t) * bassEnv;
    }
    const step = beat / 2, pattern = [0, 1, 2, 3, 2, 1, 2, 3];   // plucked arpeggio
    pattern.forEach((idx, k) => {
      const s0 = start + Math.floor(k * step * SR), len = Math.floor(step * 1.8 * SR);
      const f = freq(chord[idx % chord.length] + 12, root / 2);
      for (let n = 0; n < len; n++) { const t = n / SR; add(s0 + n, 0.07 * Math.sin(TAU * f * t) * Math.exp(-t * 6)); }
    });
    for (let k = 0; k < 4; k++) {                                 // soft kick + shaker
      if (k === 0 || k === 2) {
        const s0 = start + Math.floor(k * beat * SR), len = Math.floor(0.25 * SR);
        for (let n = 0; n < len; n++) { const t = n / SR; add(s0 + n, 0.35 * Math.sin(TAU * (50 + 80 * Math.exp(-t * 30)) * t) * Math.exp(-t * 14)); }
      }
      const h0 = start + Math.floor((k + 0.5) * beat * SR), hl = Math.floor(0.05 * SR);
      for (let n = 0; n < hl; n++) add(h0 + n, 0.03 * (Math.random() * 2 - 1) * Math.exp(-(n / SR) * 80));
    }
  }
  // gentle low-pass, fades, normalise
  let acc = 0; const k = 6, sm = new Float32Array(total);
  for (let i = 0; i < total; i++) { acc += out[i]; if (i >= k) acc -= out[i - k]; sm[i] = acc / k; }
  const fin = SR, fout = Math.floor(1.5 * SR);
  let peak = 0;
  for (let i = 0; i < total; i++) { sm[i] *= Math.min(1, i / fin) * Math.min(1, (total - i) / fout); peak = Math.max(peak, Math.abs(sm[i])); }
  if (peak > 0) for (let i = 0; i < total; i++) sm[i] *= 0.9 / peak;
  return sm;
}

export function resample(samples, from, to = SR) {
  if (from === to) return samples;
  const n = Math.round(samples.length * to / from), out = new Float32Array(n), r = from / to;
  for (let i = 0; i < n; i++) {
    const x = i * r, i0 = Math.floor(x), f = x - i0;
    out[i] = samples[i0] * (1 - f) + (samples[Math.min(i0 + 1, samples.length - 1)] || 0) * f;
  }
  return out;
}

// Mix voice and music, lowering the music while someone is speaking.
export function mix(voice, music, volume) {
  const n = voice.length, out = new Float32Array(n);
  const win = Math.floor(0.25 * SR);
  let acc = 0, envPeak = 0; const env = new Float32Array(n);
  for (let i = 0; i < n; i++) { acc += Math.abs(voice[i]); if (i >= win) acc -= Math.abs(voice[i - win]); env[i] = acc / win; envPeak = Math.max(envPeak, env[i]); }
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const duck = 1 - 0.5 * Math.min(1, (env[i] / (envPeak || 1)) * 4);
    out[i] = voice[i] * 0.95 + (music ? (music[i] || 0) * volume * duck : 0);
    peak = Math.max(peak, Math.abs(out[i]));
  }
  if (peak > 1) for (let i = 0; i < n; i++) out[i] *= 0.97 / peak;
  return out;
}
