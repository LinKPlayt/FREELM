// One timeline for the picture and the sound, so every cut, tap and title lands on the beat.
// 120 BPM: a beat is 0.5 s, a bar is 2 s.
const T = {
  BPM: 120, BEAT: 0.5, BAR: 2, END: 52,
  // Cold open: the jobs one finance video takes, one per eighth note.
  words: ["Research.", "Script.", "Fact-check.", "Voiceover.", "Footage.", "Captions.", "Music.", "Editing."],
  wordAt: [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75],
  collapse: 2.0,          // the list glitches away
  question: 2.25,         // "What if your phone made it for you?"
  build: 4.0,             // the phone rises, the riser starts
  reveal: 8.0,            // drop: the logo
  step1: 10.0, taps: [11.0, 11.5, 12.75],          // pick a topic: Crypto, Quiz, Make my reel
  step2: 14.0,            // researched, written, fact-checked
  step3: 18.0, checks: [18.75, 19.5, 20.25, 21.0], // voiced, edited, captioned
  done: 22.0,             // the finished reel
  full: 24.0, narr: [24.15, 27.75],                // the reel full screen, with its own narration
  wall: 28.0, pops: [28.0, 28.5, 29.0, 29.5], wallTitle: 30.0,
  feats: [32, 34, 36, 38, 40, 42],                 // styles, voices, week, dashboard, captions, on your phone
  bestPart: 43.3, free: 44.0,
  outro: 46.0, finalHit: 48.0,
};
if (typeof module !== "undefined") module.exports = T;
