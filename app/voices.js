// The narrators that ship with the app (no model code here, so the app can list them without loading AI).
export const KOKORO_RATE = 24000;

// Voices shipped with the app (American and British English), best first. Grades from the model card.
export const KOKORO_VOICES = {
  af_heart: { name: "Heart", desc: "Warm, natural (US)", lang: "a" },
  am_michael: { name: "Michael", desc: "Calm, clear (US)", lang: "a" },
  af_bella: { name: "Bella", desc: "Bright, energetic (US)", lang: "a" },
  am_fenrir: { name: "Fenrir", desc: "Deep, confident (US)", lang: "a" },
  af_nicole: { name: "Nicole", desc: "Soft, close (US)", lang: "a" },
  am_puck: { name: "Puck", desc: "Upbeat, friendly (US)", lang: "a" },
  bf_emma: { name: "Emma", desc: "Polished (UK)", lang: "b" },
  bm_george: { name: "George", desc: "Steady, formal (UK)", lang: "b" },
  bm_fable: { name: "Fable", desc: "Storyteller (UK)", lang: "b" },
};
