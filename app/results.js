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
const KIND_NAME = { evergreen: "Explainers", news: "Today's news", market: "Market recaps", custom: "Your topics", idea: "Idea Lab ideas" };

// What works: for each setting, the value with the most average views (needs 2+ values with data).
export function insights(labels = {}) {
  const rows = Object.values(read()).filter((r) => r.stats?.views > 0);
  if (rows.length < 2) return { count: rows.length, rows: [] };
  const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : String(Math.round(n)));
  const engagement = (r) => ((r.stats.likes || 0) + (r.stats.comments || 0) * 2 + (r.stats.saves || 0) * 2) / r.stats.views;
  const dims = [
    ["Niche", (r) => r.niche],
    ["Length", (r) => (r.duration ? LENGTH_NAME(r.duration) : null)],
    ["Type", (r) => KIND_NAME[r.kind] || null],
    ["Narrator", (r) => labels.voice?.[r.settings.voice] || r.settings.voice],
    ["Ending", (r) => labels.cta?.[r.settings.cta] || r.settings.cta],
    ["Music", (r) => labels.music?.[r.settings.music] || r.settings.music],
    ["Captions", (r) => labels.captions?.[r.settings.captions] || r.settings.captions],
  ];
  const out = [];
  for (const [name, key] of dims) {
    const groups = new Map();
    for (const r of rows) { const k = key(r); if (!k) continue; const g = groups.get(k) || []; g.push(r); groups.set(k, g); }
    if (groups.size < 2) continue;
    const scored = [...groups].map(([k, g]) => ({ k, n: g.length, views: g.reduce((a, r) => a + r.stats.views, 0) / g.length, eng: g.reduce((a, r) => a + engagement(r), 0) / g.length }))
      .sort((a, b) => b.views - a.views);
    const best = scored[0], next = scored[1];
    out.push({ name, best: best.k, text: `${best.k}: ${fmt(best.views)} average views (${best.n} reel${best.n > 1 ? "s" : ""})`, lift: next.views ? best.views / next.views : 0, vs: `${next.k}: ${fmt(next.views)}` });
  }
  const total = rows.reduce((a, r) => a + r.stats.views, 0);
  const top = rows.slice().sort((a, b) => b.stats.views - a.stats.views)[0];
  return { count: rows.length, avg: fmt(total / rows.length), top: `${top.title} (${fmt(top.stats.views)} views)`, rows: out };
}
