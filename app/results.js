// Results tracker: you type in how each reel did (views, likes, comments, saves) and the app shows what
// works best for you: which niche, length, narrator, ending, music and type of video get the most views.
// Kept on the phone (localStorage), separately from the videos, so it survives deleting old reels.
const KEY = "results", MAX = 300;
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
const write = (all) => { try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch { return false; } };

export const FIELDS = [["views", "Views"], ["likes", "Likes"], ["comments", "Comments"], ["saves", "Saves"]];

export function getResult(id) { return read()[id] || null; }

// Saves the numbers for a reel, with the settings it was made with (for the comparisons).
export function saveResult(reel, stats) {
  const all = read();
  const clean = {};
  for (const [k] of FIELDS) { const n = Math.max(0, Math.round(Number(stats[k]) || 0)); if (n) clean[k] = n; }
  all[reel.id] = { title: (reel.title || "").replace(/\s*#Shorts$/, ""), created: reel.created || Date.now(), settings: reel.settings || {}, kind: reel.kind, niche: reel.niche, duration: reel.duration, stats: clean };
  const ids = Object.keys(all).sort((a, b) => (all[b].created || 0) - (all[a].created || 0));
  for (const old of ids.slice(MAX)) delete all[old];
  return write(all);
}

const LENGTH_NAME = (s) => (s < 32 ? "Short (under 32 s)" : s < 48 ? "Standard (32–48 s)" : s < 75 ? "Long (48–75 s)" : "Deep dive (75 s+)");
const KIND_NAME = { evergreen: "Explainers", news: "Today's news", market: "Market recaps", custom: "Your topics", idea: "Idea Lab ideas", quiz: "Quizzes" };
const HOOK_NAME = { stakes: "Why it matters to you", catch: "“Nobody mentions the catch”", number: "“One number most people never hear”", plain: "“Most people never learn how it works”",
  person: "Who they are", written: "Hand-written hook", quiz: "Quiz hook", news: "News hook", market: "Market hook" };

// What works: for each setting, the value with the most average views (needs 2+ values with data).
export function insights(labels = {}) {
  const rows = Object.values(read()).filter((r) => r.stats?.views > 0);
  if (rows.length < 2) return { count: rows.length, rows: [] };
  const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : String(Math.round(n)));
  const engagement = (r) => ((r.stats.likes || 0) + (r.stats.comments || 0) * 2 + (r.stats.saves || 0) * 2) / r.stats.views;
  // [name, setting it can apply to (or null), the raw value, how to show it]
  const dims = [
    ["Niche", null, (r) => r.niche, (v) => v],
    ["Length", null, (r) => (r.duration ? LENGTH_NAME(r.duration) : null), (v) => v],
    ["Type", null, (r) => KIND_NAME[r.kind] || null, (v) => v],
    ["Hook", null, (r) => r.settings.hook || null, (v) => HOOK_NAME[v] || v],
    ["Narrator", "voice", (r) => r.settings.voice, (v) => labels.voice?.[v] || v],
    ["Ending", "cta", (r) => r.settings.cta, (v) => labels.cta?.[v] || v],
    ["Music", "music", (r) => r.settings.music, (v) => labels.music?.[v] || v],
    ["Captions", "captions", (r) => r.settings.captions, (v) => labels.captions?.[v] || v],
  ];
  const out = [];
  for (const [name, setting, key, show] of dims) {
    const groups = new Map();
    for (const r of rows) { const k = key(r); if (!k) continue; const g = groups.get(k) || []; g.push(r); groups.set(k, g); }
    if (groups.size < 2) continue;
    const scored = [...groups].map(([k, g]) => ({ k, n: g.length, views: g.reduce((a, r) => a + r.stats.views, 0) / g.length, eng: g.reduce((a, r) => a + engagement(r), 0) / g.length }))
      .sort((a, b) => b.views - a.views);
    const best = scored[0], next = scored[1];
    out.push({ name, setting, best: best.k, text: `${show(best.k)}: ${fmt(best.views)} average views (${best.n} reel${best.n > 1 ? "s" : ""})`, lift: next.views ? best.views / next.views : 0, vs: `${show(next.k)}: ${fmt(next.views)}` });
  }
  const total = rows.reduce((a, r) => a + r.stats.views, 0);
  const top = rows.slice().sort((a, b) => b.stats.views - a.stats.views)[0];
  return { count: rows.length, avg: fmt(total / rows.length), top: `${top.title} (${fmt(top.stats.views)} views)`, rows: out };
}
