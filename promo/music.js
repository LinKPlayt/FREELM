// The ReelBot launch soundtrack: an original 120 BPM track and sound design, synthesized offline
// (nothing sampled, nothing licensed). Renders to a WAV via window.renderSoundtrack().
/* global T */
const SR = 48000;
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

window.renderSoundtrack = async function (opts = {}) {
  const DUR = T.END + 0.5;
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * DUR), SR);
  const B = T.BEAT, BAR = T.BAR;

  /* ---------------- buses ---------------- */
  const master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  Object.assign(comp, {}); comp.threshold.value = -9; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.18;
  const eqLo = ctx.createBiquadFilter(); eqLo.type = "lowshelf"; eqLo.frequency.value = 90; eqLo.gain.value = -2.5;
  const eqMid = ctx.createBiquadFilter(); eqMid.type = "peaking"; eqMid.frequency.value = 2600; eqMid.Q.value = 0.8; eqMid.gain.value = 2.5;
  const eqHi = ctx.createBiquadFilter(); eqHi.type = "highshelf"; eqHi.frequency.value = 5500; eqHi.gain.value = 4;
  master.connect(eqLo); eqLo.connect(eqMid); eqMid.connect(eqHi); eqHi.connect(comp); comp.connect(ctx.destination);

  const music = ctx.createGain(); music.gain.value = 0.55;        // chords, bass, arps, lead, pads
  const duck = ctx.createGain(); duck.gain.value = 1;             // sidechain pump from the kick
  const breakLp = ctx.createBiquadFilter(); breakLp.type = "lowpass"; breakLp.frequency.value = 20000; breakLp.Q.value = 0.5;
  music.connect(duck); duck.connect(breakLp); breakLp.connect(master);
  const drums = ctx.createGain(); drums.gain.value = 0.8; drums.connect(master);
  const sfx = ctx.createGain(); sfx.gain.value = 0.8; sfx.connect(master);

  // Reverb: a generated hall (decaying, decorrelated noise, darker as it fades).
  const verb = ctx.createConvolver();
  { const len = Math.floor(SR * 2.8), ir = ctx.createBuffer(2, len, SR);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) { const tt = i / SR, k = 0.08 + 0.85 * Math.min(1, tt / 2.2); lp += k * ((Math.random() * 2 - 1) - lp); d[i] = lp * Math.exp(-tt / 0.62) * (i < SR * 0.012 ? i / (SR * 0.012) : 1); } }
    verb.buffer = ir; }
  const verbIn = ctx.createGain(); verbIn.gain.value = 0.32; verbIn.connect(verb); const verbOut = ctx.createGain(); verbOut.gain.value = 0.9; verb.connect(verbOut); verbOut.connect(master);
  // Tempo delay (dotted eighth) for plucks and the lead.
  const dly = ctx.createDelay(1); dly.delayTime.value = B * 0.75; const fb = ctx.createGain(); fb.gain.value = 0.32;
  const dlyLp = ctx.createBiquadFilter(); dlyLp.type = "lowpass"; dlyLp.frequency.value = 3200;
  const dlyIn = ctx.createGain(); dlyIn.gain.value = 0.28;
  dlyIn.connect(dly); dly.connect(dlyLp); dlyLp.connect(fb); fb.connect(dly); dlyLp.connect(breakLp); dlyLp.connect(verbIn);

  /* ---------------- sources ---------------- */
  const noise = ctx.createBuffer(2, SR * 3, SR);
  for (let ch = 0; ch < 2; ch++) { const d = noise.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const noiseSrc = (t, dur) => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(t, Math.random() * 2.5); s.stop(t + dur + 0.05); return s; };
  const env = (g, t, a, peak, d, sus = 0.0001) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + d); };
  const pan = (node, p) => { const pn = ctx.createStereoPanner(); pn.pan.value = p; node.connect(pn); return pn; };

  /* ---------------- drums ---------------- */
  const kicks = [];
  function kick(t, v = 1) {
    kicks.push(t);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine";
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.07); o.frequency.exponentialRampToValueAtTime(42, t + 0.35);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.85 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g); g.connect(drums); o.start(t); o.stop(t + 0.5);
    const n = noiseSrc(t, 0.02), hp = ctx.createBiquadFilter(), ng = ctx.createGain(); hp.type = "highpass"; hp.frequency.value = 2500;
    env(ng, t, 0.001, 0.25 * v, 0.015); n.connect(hp); hp.connect(ng); ng.connect(drums);
  }
  function clap(t, v = 1) {
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1500; bp.Q.value = 0.9;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    [0, 0.011, 0.022].forEach((o) => { g.gain.setValueAtTime(0.0001, t + o); g.gain.linearRampToValueAtTime(0.75 * v, t + o + 0.002); g.gain.exponentialRampToValueAtTime(0.05, t + o + 0.01); });
    g.gain.setValueAtTime(0.62 * v, t + 0.032); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    const n = noiseSrc(t, 0.25); n.connect(bp); bp.connect(g); g.connect(drums); const s = ctx.createGain(); s.gain.value = 0.35; g.connect(s); s.connect(verbIn);
  }
  function hat(t, v = 1, open = false) {
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = open ? 7000 : 8500;
    const g = ctx.createGain(); env(g, t, 0.001, (open ? 0.26 : 0.21) * v, open ? 0.22 : 0.035);
    const n = noiseSrc(t, open ? 0.3 : 0.06); n.connect(hp); hp.connect(g); pan(g, open ? 0.15 : -0.12).connect(drums);
  }
  function snare(t, v = 1) {
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2200; bp.Q.value = 0.7;
    const g = ctx.createGain(); env(g, t, 0.001, 0.38 * v, 0.13); const n = noiseSrc(t, 0.16); n.connect(bp); bp.connect(g); g.connect(drums);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    env(og, t, 0.001, 0.22 * v, 0.09); o.connect(og); og.connect(drums); o.start(t); o.stop(t + 0.15);
    const s = ctx.createGain(); s.gain.value = 0.25; g.connect(s); s.connect(verbIn);
  }
  function crash(t, v = 1, len = 2.2) {
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 4200;
    const g = ctx.createGain(); env(g, t, 0.002, 0.3 * v, len); const n = noiseSrc(t, len + 0.1); n.connect(hp); hp.connect(g); g.connect(drums);
    const s = ctx.createGain(); s.gain.value = 0.4; g.connect(s); s.connect(verbIn);
  }

  /* ---------------- instruments ---------------- */
  // Supersaw chord: five detuned saws per note, spread in stereo, through a lowpass.
  function chord(t, dur, notes, { cut = 2600, v = 0.5, att = 0.02, rel = 0.25, cutTo = null } = {}) {
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(cut, t); if (cutTo) lp.frequency.exponentialRampToValueAtTime(cutTo, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + att); g.gain.setValueAtTime(v, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
    lp.connect(g); g.connect(music); const s = ctx.createGain(); s.gain.value = 0.25; g.connect(s); s.connect(verbIn);
    const det = [-14, -6, 0, 6, 14];
    for (const m of notes) det.forEach((c, k) => {
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = midi(m); o.detune.value = c + (Math.random() - 0.5) * 3;
      const og = ctx.createGain(); og.gain.value = 0.11 / notes.length * 3 / det.length * 2.2;
      o.connect(og); pan(og, (k - 2) * 0.32).connect(lp); o.start(t); o.stop(t + dur + rel + 0.05);
    });
  }
  function pad(t, dur, notes, { cut = 700, v = 0.35, att = 0.8 } = {}) { chord(t, dur, notes, { cut, v, att, rel: 1.2 }); }
  function bass(t, dur, m, { v = 0.6, cut = 520, sub = true } = {}) {
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = midi(m);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 3; lp.frequency.setValueAtTime(cut * 2.6, t); lp.frequency.exponentialRampToValueAtTime(cut, t + Math.min(0.18, dur));
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.34 * v, t + 0.006); g.gain.setValueAtTime(0.3 * v, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(music); o.start(t); o.stop(t + dur + 0.02);
    if (sub) { const s = ctx.createOscillator(), sg = ctx.createGain(); s.type = "sine"; s.frequency.value = midi(m - 12);
      sg.gain.setValueAtTime(0.0001, t); sg.gain.linearRampToValueAtTime(0.42 * v, t + 0.008); sg.gain.setValueAtTime(0.38 * v, t + dur * 0.8); sg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(sg); sg.connect(music); s.start(t); s.stop(t + dur + 0.02); }
  }
  function pluck(t, m, { v = 0.3, dec = 0.22, cut = 6500 } = {}) {
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = midi(m);
    const o2 = ctx.createOscillator(); o2.type = "square"; o2.frequency.value = midi(m) * 1.003;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 4; lp.frequency.setValueAtTime(cut, t); lp.frequency.exponentialRampToValueAtTime(380, t + dec);
    const g = ctx.createGain(); env(g, t, 0.003, 0.2 * v, dec + 0.12);
    const m2 = ctx.createGain(); m2.gain.value = 0.5; o.connect(lp); o2.connect(m2); m2.connect(lp); lp.connect(g); g.connect(music); g.connect(dlyIn);
    o.start(t); o.stop(t + dec + 0.2); o2.start(t); o2.stop(t + dec + 0.2);
  }
  function lead(t, dur, m, { v = 0.44 } = {}) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16 * v, t + 0.012); g.gain.setValueAtTime(0.13 * v, t + Math.max(0.02, dur - 0.04)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5600; lp.Q.value = 1.0; lp.connect(g); g.connect(music); g.connect(dlyIn);
    const s = ctx.createGain(); s.gain.value = 0.4; g.connect(s); s.connect(verbIn);
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(9, t + Math.min(0.4, dur)); vib.connect(vg);
    for (const [type, cents, lvl] of [["square", -7, 0.5], ["sawtooth", 7, 0.6], ["square", 1200, 0.12]]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = midi(m); o.detune.value = cents; vg.connect(o.detune);
      const og = ctx.createGain(); og.gain.value = lvl; o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.15);
    }
    vib.start(t); vib.stop(t + dur + 0.15);
  }

  /* ---------------- sound design ---------------- */
  function whoosh(t, { dur = 0.55, from = 280, to = 3800, v = 0.5, p0 = -0.7, p1 = 0.7 } = {}) {
    const n = noiseSrc(t, dur); const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(from, t); bp.frequency.exponentialRampToValueAtTime(to, t + dur * 0.6); bp.frequency.exponentialRampToValueAtTime(from * 1.6, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const pn = ctx.createStereoPanner(); pn.pan.setValueAtTime(p0, t); pn.pan.linearRampToValueAtTime(p1, t + dur);
    n.connect(bp); bp.connect(g); g.connect(pn); pn.connect(sfx); const s = ctx.createGain(); s.gain.value = 0.3; g.connect(s); s.connect(verbIn);
  }
  function impact(t, { v = 1, low = 88 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine";
    o.frequency.setValueAtTime(low, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.1);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.95 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    o.connect(g); g.connect(sfx); o.start(t); o.stop(t + 1.9);
    const n = noiseSrc(t, 0.6), lp = ctx.createBiquadFilter(), ng = ctx.createGain(); lp.type = "lowpass"; lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.5);
    env(ng, t, 0.002, 0.55 * v, 0.5); n.connect(lp); lp.connect(ng); ng.connect(sfx); const s = ctx.createGain(); s.gain.value = 0.9; ng.connect(s); s.connect(verbIn);
    crash(t, 0.9 * v, 2.6);
  }
  function riser(t0, t1, { v = 0.32 } = {}) {
    const d = t1 - t0, n = noiseSrc(t0, d), bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(350, t0); bp.frequency.exponentialRampToValueAtTime(9000, t1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t1 - 0.02); g.gain.linearRampToValueAtTime(0.0001, t1);
    n.connect(bp); bp.connect(g); g.connect(sfx);
    const o = ctx.createOscillator(), og = ctx.createGain(), lp = ctx.createBiquadFilter(); o.type = "sawtooth"; lp.type = "lowpass"; lp.frequency.value = 2400;
    o.frequency.setValueAtTime(midi(41), t0); o.frequency.exponentialRampToValueAtTime(midi(77), t1);
    og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(v * 0.28, t1 - 0.02); og.gain.linearRampToValueAtTime(0.0001, t1);
    o.connect(lp); lp.connect(og); og.connect(sfx); o.start(t0); o.stop(t1 + 0.02);
  }
  function reverseSwell(t0, t1, { v = 0.3 } = {}) {
    const n = noiseSrc(t0, t1 - t0), hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.setValueAtTime(1800, t0); hp.frequency.exponentialRampToValueAtTime(6000, t1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t1 - 0.01); g.gain.linearRampToValueAtTime(0.0001, t1);
    n.connect(hp); hp.connect(g); g.connect(sfx);
  }
  function tick(t, k = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = 1250 + k * 115;
    env(g, t, 0.001, 0.28, 0.045); o.connect(g); pan(g, (k % 2 ? 0.25 : -0.25)).connect(sfx); o.start(t); o.stop(t + 0.07);
    const n = noiseSrc(t, 0.01), hp = ctx.createBiquadFilter(), ng = ctx.createGain(); hp.type = "highpass"; hp.frequency.value = 5000; env(ng, t, 0.0005, 0.18, 0.006); n.connect(hp); hp.connect(ng); ng.connect(sfx);
  }
  function tap(t, { v = 1 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.setValueAtTime(820, t); o.frequency.exponentialRampToValueAtTime(430, t + 0.06);
    env(g, t, 0.001, 0.34 * v, 0.07); o.connect(g); g.connect(sfx); o.start(t); o.stop(t + 0.1);
    const n = noiseSrc(t, 0.015), bp = ctx.createBiquadFilter(), ng = ctx.createGain(); bp.type = "bandpass"; bp.frequency.value = 3200; env(ng, t, 0.0005, 0.22 * v, 0.01); n.connect(bp); bp.connect(ng); ng.connect(sfx);
  }
  function check(t, k = 0) {   // a soft two-note "done" blip for each step of the checklist
    [0, 0.06].forEach((o, i) => { const os = ctx.createOscillator(), g = ctx.createGain(); os.type = "triangle"; os.frequency.value = midi(84 + k + i * 7);
      env(g, t + o, 0.002, 0.16, 0.16); os.connect(g); g.connect(sfx); const s = ctx.createGain(); s.gain.value = 0.3; g.connect(s); s.connect(verbIn); os.start(t + o); os.stop(t + o + 0.25); });
  }
  function bell(t, m, v = 0.22) {
    [[1, 1], [2.76, 0.42], [5.4, 0.18], [8.93, 0.08]].forEach(([r, a], i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = midi(m) * r;
      env(g, t, 0.002, v * a, 1.6 - i * 0.3); o.connect(g); g.connect(sfx); const s = ctx.createGain(); s.gain.value = 0.45; g.connect(s); s.connect(verbIn); o.start(t); o.stop(t + 1.8); });
  }
  function chime(t) { [77, 81, 84, 89].forEach((m, i) => bell(t + i * 0.07, m, 0.2)); }   // F major arpeggio: done!
  function sparkle(t, dur = 1.4, n = 16) { for (let i = 0; i < n; i++) { const tt = t + (i / n) * dur * (0.6 + 0.4 * Math.random()); bell(tt, 88 + Math.floor(Math.random() * 14), 0.05 + Math.random() * 0.05); } }
  function pop(t, k = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.setValueAtTime(380 + k * 60, t); o.frequency.exponentialRampToValueAtTime(980 + k * 90, t + 0.05);
    env(g, t, 0.001, 0.3, 0.09); o.connect(g); pan(g, -0.45 + k * 0.3).connect(sfx); o.start(t); o.stop(t + 0.12);
  }
  function glitch(t) {
    for (let i = 0; i < 9; i++) { const tt = t + i * 0.022, o = ctx.createOscillator(), g = ctx.createGain(); o.type = "square"; o.frequency.value = 200 + Math.random() * 2400;
      env(g, tt, 0.001, 0.07, 0.018); o.connect(g); pan(g, Math.random() * 1.6 - 0.8).connect(sfx); o.start(tt); o.stop(tt + 0.03); }
    const n = noiseSrc(t, 0.25), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = "bandpass"; bp.frequency.setValueAtTime(5000, t); bp.frequency.exponentialRampToValueAtTime(200, t + 0.25);
    env(g, t, 0.002, 0.3, 0.24); n.connect(bp); bp.connect(g); g.connect(sfx);
  }
  function subDrop(t, v = 0.7) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.4); env(g, t, 0.01, v, 1.5); o.connect(g); g.connect(sfx); o.start(t); o.stop(t + 1.6); }

  /* ---------------- arrangement ---------------- */
  // F minor: i - VI - III - VII, voiced close.
  const CH = { Fm: [53, 56, 60], Db: [53, 56, 61], Ab: [51, 56, 60], Eb: [51, 55, 58], F: [53, 57, 60] };
  const ROOT = { Fm: 41, Db: 37, Ab: 44, Eb: 39, F: 41 };
  const prog = ["Fm", "Db", "Ab", "Eb"];
  const barT = (b) => b * BAR;

  // Cold open (bars 0-1): a dark pad, a soft pulse, ticks on each word.
  pad(0, 2, CH.Fm.map((m) => m - 12).concat([60]), { cut: 650, v: 0.28, att: 0.05 });
  for (let i = 0; i < 16; i++) hat(i * B / 2, 0.35 + (i % 2) * 0.15);
  T.wordAt.forEach((t, k) => tick(t, k));
  [0, 1].forEach((k) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = midi(29); env(g, k * 1.0, 0.01, 0.45, 0.4); o.connect(g); g.connect(music); o.start(k); o.stop(k + 0.5); });
  glitch(T.collapse);
  pad(2, 2, CH.Db.map((m) => m - 12).concat([61]), { cut: 900, v: 0.3, att: 0.3 });
  subDrop(T.question + 0.75, 0.5); bell(T.question + 0.75, 72, 0.1);

  // Build (bars 2-3): kick fades in, snare roll speeds up, everything opens, then a breath before the drop.
  for (let i = 0; i < 7; i++) kick(T.build + i * B, 0.45 + i * 0.07);
  pad(barT(2), 2, CH.Ab, { cut: 900, v: 0.32, att: 0.1 }); chord(barT(3), 1.5, CH.Eb, { cut: 1200, cutTo: 6000, v: 0.34, att: 0.05, rel: 0.05 });
  for (let i = 0; i < 8; i++) snare(T.build + i * B / 2, 0.25 + i * 0.03);
  for (let i = 0; i < 6; i++) snare(T.build + 2 + i * B / 4, 0.45 + i * 0.04);
  for (let i = 0; i < 8; i++) snare(T.build + 3 + i * B / 8, 0.55 + i * 0.04);
  for (let i = 0; i < 6; i++) bass(T.build + i * B, B * 0.9, ROOT[i < 4 ? "Ab" : "Eb"] + 12, { v: 0.35 + i * 0.06, cut: 300 + i * 120, sub: false });
  riser(T.build, T.reveal - 0.5, { v: 0.3 }); reverseSwell(T.reveal - 1.0, T.reveal, { v: 0.28 });
  whoosh(T.build, { dur: 0.9, from: 180, to: 1600, v: 0.35 });

  // Drop A (bars 4-11), a breakdown for the reel's own voice (12-13), a build (14-15), drop B (16-21).
  function groove(b0, b1, { lead: withLead = false, arp = true, claps = true, stopAt = 1e9 } = {}) {
    for (let b = b0; b < b1; b++) {
      const name = prog[(b - 4 + 400) % 4], t = barT(b);
      chord(t, Math.min(BAR, stopAt - t) - 0.02, CH[name].concat(CH[name][0] + 12, CH[name][2] + 12), { cut: 6000, v: 0.5, rel: t + BAR > stopAt ? 0.05 : 0.25 });
      for (let k = 0; k < 4; k++) {
        if (t + k * B >= stopAt) break;
        kick(t + k * B); if (claps && k % 2) clap(t + k * B);
        hat(t + k * B + B / 2, 0.9, true);
        for (let s = 0; s < 4; s++) if (s !== 2) hat(t + k * B + s * B / 4, s % 2 ? 0.55 : 0.8);
        bass(t + k * B + B / 2, B / 2 - 0.02, ROOT[name] + 12, { v: 0.52 }); bass(t + k * B, B / 2 - 0.04, ROOT[name], { v: 0.34, cut: 260 });
      }
      if (arp) { const ns = CH[name].concat(CH[name][0] + 12, CH[name][1] + 12); const pat = [0, 1, 2, 3, 4, 3, 2, 1];
        for (let s = 0; s < 16; s++) if (t + s * B / 4 < stopAt) pluck(t + s * B / 4, ns[pat[s % 8]] + 12, { v: s % 4 === 0 ? 0.46 : 0.33 }); }
      if (withLead) { const L = {
          Fm: [[0, 72, 0.75], [0.75, 68, 0.25], [1, 72, 0.5], [1.5, 75, 1], [2.5, 72, 0.5], [3, 68, 0.5], [3.5, 70, 0.5]],
          Db: [[0, 68, 0.75], [0.75, 65, 0.25], [1, 68, 0.5], [1.5, 73, 1], [2.5, 72, 0.5], [3, 70, 1]],
          Ab: [[0, 72, 0.75], [0.75, 68, 0.25], [1, 72, 0.5], [1.5, 75, 0.5], [2, 77, 1], [3, 75, 0.5], [3.5, 72, 0.5]],
          Eb: [[0, 70, 1.5], [1.5, 67, 0.5], [2, 70, 0.5], [2.5, 72, 0.5], [3, 75, 1]] }[name];
        for (const [o, m, d] of L) if (t + o * B < stopAt) lead(t + o * B, Math.min(d * B, stopAt - t - o * B), m); }
    }
  }
  impact(T.reveal, { v: 1 }); subDrop(T.reveal, 0.6); sparkle(T.reveal + 0.1, 1.6, 18);
  groove(4, 12);
  crash(T.step1, 0.7); whoosh(T.step1 - 0.2, { dur: 0.45 });
  T.taps.forEach((t, i) => tap(t, { v: i === 2 ? 1.3 : 1 }));
  whoosh(T.step2 - 0.2, { dur: 0.45, p0: 0.7, p1: -0.7 });
  crash(T.step3, 0.6); whoosh(T.step3 - 0.2, { dur: 0.45 });
  T.checks.forEach((t, k) => check(t, k));
  for (let i = 0; i < 4; i++) snare(T.done - 0.5 + i * B / 4, 0.5 + i * 0.12);
  chime(T.done); crash(T.done, 0.5);

  // Breakdown under the reel's narration: drums out, music dark and low.
  breakLp.frequency.setValueAtTime(20000, T.full - 0.05); breakLp.frequency.exponentialRampToValueAtTime(700, T.full + 0.25);
  breakLp.frequency.setValueAtTime(700, T.narr[1] - 0.2); breakLp.frequency.exponentialRampToValueAtTime(20000, T.wall);
  music.gain.setValueAtTime(0.55, T.full - 0.05); music.gain.linearRampToValueAtTime(0.32, T.full + 0.3); music.gain.setValueAtTime(0.32, T.narr[1] - 0.1); music.gain.linearRampToValueAtTime(0.55, T.wall);
  whoosh(T.full - 0.15, { dur: 0.5, from: 400, to: 5000, v: 0.4 });
  for (let b = 12; b < 14; b++) { const name = prog[(b - 4) % 4]; pad(barT(b), BAR, CH[name], { cut: 1400, v: 0.3, att: 0.2 }); bass(barT(b), BAR - 0.05, ROOT[name], { v: 0.35, cut: 200 }); }
  riser(T.wall - 1.5, T.wall, { v: 0.22 });
  if (opts.narr) {
    const buf = await ctx.decodeAudioData(opts.narr), s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf;
    g.gain.setValueAtTime(0.0001, T.narr[0]); g.gain.linearRampToValueAtTime(opts.narrGain || 1.0, T.narr[0] + 0.05);
    g.gain.setValueAtTime(opts.narrGain || 1.0, T.narr[1] - 0.25); g.gain.linearRampToValueAtTime(0.0001, T.narr[1]);
    s.connect(g); g.connect(master); s.start(T.narr[0], opts.narrFrom || 0, T.narr[1] - T.narr[0] + 0.05);
  }
  // The wall of reels (bars 14-15): the beat comes back, a pop for each reel.
  for (let b = 14; b < 16; b++) { const name = prog[(b - 4) % 4], t = barT(b);
    chord(t, BAR - 0.02, CH[name], { cut: b === 14 ? 1500 : 2400, cutTo: b === 14 ? 2400 : 5000, v: 0.38 });
    for (let k = 0; k < 4; k++) { kick(t + k * B, 0.85); if (k % 2) clap(t + k * B, 0.8); hat(t + k * B + B / 2, 0.7, true); bass(t + k * B + B / 2, B / 2 - 0.02, ROOT[name] + 12, { v: 0.5 }); } }
  T.pops.forEach((t, k) => pop(t, k)); crash(T.wall, 0.6);
  for (let i = 0; i < 8; i++) snare(T.feats[0] - 0.5 + i * B / 8, 0.4 + i * 0.06);
  // Drop B (bars 16-21) with the lead; a whoosh for each feature.
  groove(16, 22, { lead: true, stopAt: T.free - 0.5 });
  impact(T.feats[0], { v: 0.6 });
  T.feats.slice(1).forEach((t, i) => whoosh(t - 0.18, { dur: 0.42, from: 300 + i * 40, to: 3600, v: 0.38, p0: i % 2 ? 0.7 : -0.7, p1: i % 2 ? -0.7 : 0.7 }));
  crash(T.feats[4], 0.55);
  // "The best part?" ... silence ... "Free."
  reverseSwell(T.free - 0.9, T.free, { v: 0.32 });
  impact(T.free, { v: 1.15, low: 95 }); subDrop(T.free, 0.75);
  chord(T.free, 1.6, CH.Ab.concat([68, 72]), { cut: 4000, cutTo: 1500, v: 0.5, att: 0.005, rel: 1.4 });
  bass(T.free, 1.7, ROOT.Ab, { v: 0.6, cut: 300 });
  // Outro: Db - Eb, then the final F major.
  [["Db", 0], ["Eb", 1]].forEach(([name, h]) => { const t = T.outro + h * 1.0;
    chord(t, 0.98, CH[name].concat(CH[name][0] + 12), { cut: 2600 + h * 1400, v: 0.42 });
    for (let k = 0; k < 2; k++) { kick(t + k * B); hat(t + k * B + B / 2, 0.8, true); bass(t + k * B + B / 2, B / 2 - 0.02, ROOT[name] + 12, { v: 0.6 }); bass(t + k * B, B / 2 - 0.04, ROOT[name], { v: 0.45, cut: 260 }); }
    if (h) for (let i = 0; i < 4; i++) snare(t + 0.5 + i * B / 4, 0.5 + i * 0.12); });
  impact(T.finalHit, { v: 0.9 }); kick(T.finalHit, 1.1);
  chord(T.finalHit, 2.4, CH.F.concat([65, 69, 72]), { cut: 3600, cutTo: 900, v: 0.5, att: 0.005, rel: 1.6 });
  bass(T.finalHit, 2.6, ROOT.F, { v: 0.55, cut: 240 });
  sparkle(T.finalHit + 0.15, 1.8, 22); bell(T.finalHit, 89, 0.12);

  // Little sounds for things that pop on screen.
  [14.75, 15.15, 15.55].forEach((t, k) => pop(t, k));                                   // review badges
  for (let i = 0; i < 9; i++) { const t = 34.18 + i * 0.05, o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = midi(79 + [0, 2, 3, 5, 7, 8, 10, 12, 14][i]);
    env(g, t, 0.001, 0.09, 0.07); o.connect(g); pan(g, -0.6 + i * 0.15).connect(sfx); o.start(t); o.stop(t + 0.1); }   // nine voices, a rising run
  [42.25, 42.41, 42.57].forEach((t, k) => pop(t, k + 1));                               // no account, no subscription, offline
  whoosh(T.outro - 0.18, { dur: 0.5, from: 250, to: 3000, v: 0.3 }); sparkle(T.outro + 0.1, 0.8, 8);
  // Sidechain: the music breathes with every kick.
  kicks.sort((a, b) => a - b).forEach((k) => { duck.gain.setValueAtTime(1, Math.max(0, k - 0.002)); duck.gain.linearRampToValueAtTime(0.35, k + 0.01); duck.gain.linearRampToValueAtTime(1, k + 0.24); });
  // A gentle fade at the very end.
  master.gain.setValueAtTime(0.9, T.END - 1.5); master.gain.linearRampToValueAtTime(0.0001, T.END - 0.02);

  const out = await ctx.startRendering();
  // 32-bit float WAV
  const n = out.length, chs = [out.getChannelData(0), out.getChannelData(1)], buf = new ArrayBuffer(44 + n * 8), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 8, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 3, true); v.setUint16(22, 2, true);
  v.setUint32(24, SR, true); v.setUint32(28, SR * 8, true); v.setUint16(32, 8, true); v.setUint16(34, 32, true); w(36, "data"); v.setUint32(40, n * 8, true);
  let peak = 0; for (let i = 0; i < n; i++) { const l = chs[0][i], r = chs[1][i]; v.setFloat32(44 + i * 8, l, true); v.setFloat32(48 + i * 8, r, true); peak = Math.max(peak, Math.abs(l), Math.abs(r)); }
  const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return { wav: btoa(s), peak, seconds: n / SR };
};
