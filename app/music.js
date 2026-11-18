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

// Each mood is a recipe: tempo, chords, and which instruments play.
const MINOR = [[0, 3, 7, 10], [8, 12, 15, 19], [3, 7, 10, 14], [10, 14, 17, 21]];          // i  VI  III  VII
const MOODS = {
  lofi:      { bpm: [84, 88, 92, 96], progs: PROGRESSIONS, pad: 1.0, bass: 1.0, arp: "eighths", arpLevel: 0.07, kick: [0, 2], hat: "offbeats", smooth: 6 },
  upbeat:    { bpm: [112, 116, 120], progs: [PROGRESSIONS[1], PROGRESSIONS[3]], pad: 0.6, bass: 1.2, arp: "sixteenths", arpLevel: 0.06, kick: [0, 1, 2, 3], hat: "eighths", clap: [1, 3], smooth: 2 },
  cinematic: { bpm: [64, 70], progs: [MINOR], pad: 1.4, bass: 1.5, arp: "none", kick: [], hat: "none", boom: true, swell: true, smooth: 8 },
  calm:      { bpm: [66, 72], progs: PROGRESSIONS, pad: 1.1, bass: 0.6, arp: "quarters", arpLevel: 0.05, kick: [], hat: "none", smooth: 8 },
  bright:    { bpm: [100, 104, 108], progs: [PROGRESSIONS[0], PROGRESSIONS[1]], pad: 0.7, bass: 1.0, arp: "eighths", arpLevel: 0.08, kick: [0, 2], hat: "eighths", clap: [1, 3], smooth: 3 },
  suspense:  { bpm: [92, 96], progs: [MINOR], pad: 1.0, bass: 1.3, arp: "sixteenths", arpLevel: 0.035, kick: [0], hat: "sixteenths", smooth: 5 },
};
export const MUSIC_MOODS = Object.keys(MOODS);

// dropAt (seconds): the beat comes in here. Before it only the chords and bass play (under the hook),
// with a short swell into the drop; the bars are lined up so a bar starts exactly at the drop.
export function generateMusic(duration, moodName = "lofi", { dropAt = 0 } = {}) {
  const mood = MOODS[moodName] || MOODS.lofi;
  const bpm = pick(mood.bpm), beat = 60 / bpm, bar = beat * 4;
  const phase = dropAt > 0 ? dropAt % bar : 0;                 // first (partial) bar ends at a bar line on the drop
  const root = 220 * 2 ** ((Math.floor(Math.random() * 10) - 5) / 12);
  const prog = pick(mood.progs);
  const total = Math.floor(duration * SR);
  const out = new Float32Array(total);
  const barN = Math.floor(bar * SR);
  const bars = Math.ceil(duration / bar) + 2;
  const add = (i, v) => { if (i >= 0 && i < total) out[i] += v; };

  for (let b = 0; b < bars; b++) {
    const chord = prog[b % prog.length], start = Math.floor((phase - (phase > 0 ? bar : 0) + b * bar) * SR);
    const beatIn = start / SR >= dropAt - 0.02;                    // drums and arpeggio only after the drop
    const attack = (mood.swell ? 1.2 : 0.4) * SR, release = 0.4 * SR;
    for (let n = Math.max(0, -start); n < barN && start + n < total; n++) {       // pad + bass
      const t = n / SR;
      const env = Math.min(1, n / attack) * Math.min(1, (barN - n) / release);
      let v = 0;
      for (const st of chord) {
        const f = freq(st, root / 2);
        v += 0.10 * Math.sin(TAU * f * t) + 0.05 * Math.sin(TAU * f * 1.003 * t) + 0.03 * (2 / Math.PI) * Math.asin(Math.sin(TAU * f * 2 * t));
      }
      const bassEnv = Math.min(1, n / (0.02 * SR)) * Math.min(1, (barN - n) / (0.3 * SR));
      const bassF = freq(chord[0], root / 4);
      const bass = 0.16 * Math.sin(TAU * bassF * t) + (mood.boom ? 0.08 * Math.sin(TAU * bassF / 2 * t) : 0);
      out[start + n] += v * env * mood.pad + bass * bassEnv * mood.bass;
    }
    if (mood.arp !== "none" && beatIn) {                         // plucked arpeggio
      const per = { quarters: 1, eighths: 2, sixteenths: 4 }[mood.arp], step = beat / per;
      const pattern = [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 1, 3, 2, 3, 1, 2];
      for (let k = 0; k < 4 * per; k++) {
        const s0 = start + Math.floor(k * step * SR), len = Math.floor(Math.min(step * 1.8, 0.6) * SR);
        const f = freq(chord[pattern[k % 16] % chord.length] + 12, root / 2);
        for (let n = 0; n < len; n++) { const t = n / SR; add(s0 + n, mood.arpLevel * Math.sin(TAU * f * t) * Math.exp(-t * (per === 4 ? 10 : 6))); }
      }
    }
    for (let k = 0; k < 4 && beatIn; k++) {                       // drums
      if (mood.kick.includes(k)) {
        const s0 = start + Math.floor(k * beat * SR), len = Math.floor(0.25 * SR);
        for (let n = 0; n < len; n++) { const t = n / SR; add(s0 + n, 0.35 * Math.sin(TAU * (50 + 80 * Math.exp(-t * 30)) * t) * Math.exp(-t * 14)); }
      }
      if (mood.clap?.includes(k)) {
        const s0 = start + Math.floor(k * beat * SR), len = Math.floor(0.12 * SR);
        for (let n = 0; n < len; n++) add(s0 + n, 0.12 * (Math.random() * 2 - 1) * Math.exp(-(n / SR) * 35));
      }
      const hats = mood.hat === "sixteenths" ? [0, 0.25, 0.5, 0.75] : mood.hat === "eighths" ? [0, 0.5] : mood.hat === "offbeats" ? [0.5] : [];
      for (const h of hats) {
        const h0 = start + Math.floor((k + h) * beat * SR), hl = Math.floor(0.05 * SR);
        for (let n = 0; n < hl; n++) add(h0 + n, 0.03 * (Math.random() * 2 - 1) * Math.exp(-(n / SR) * 80));
      }
    }
    if (mood.boom && b % 2 === 0) {                               // slow, deep hit every other bar
      const len = Math.floor(1.2 * SR);
      for (let n = 0; n < len; n++) { const t = n / SR; add(start + n, 0.3 * Math.sin(TAU * (38 + 30 * Math.exp(-t * 8)) * t) * Math.exp(-t * 3)); }
    }
  }
  // A soft rising swell (filtered noise) into the drop.
  if (dropAt > 0.8) {
    const len = Math.floor(0.9 * SR), s0 = Math.floor(dropAt * SR) - len; let lp = 0;
    for (let n = 0; n < len; n++) { const x = n / len; lp += (0.02 + 0.25 * x * x) * ((Math.random() * 2 - 1) - lp); add(s0 + n, 0.22 * lp * x * x); }
  }
  // gentle low-pass, fades, normalise
  let acc = 0; const k = mood.smooth, sm = new Float32Array(total);
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
