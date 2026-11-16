// Features for more detailed videos and better results:
//   deep dives (chapters + recap), sound effects, captions files, cover images, hook options and the reel coach.
import { analyzeLine } from "./visuals.js";
import { SR } from "./music.js";

/* ---------------------------------------------------------------- deep dive */

const SECTION_NAMES = [["First: what it is.", "WHAT IT IS"], ["Next: why it matters.", "WHY IT MATTERS"], ["Finally: what you can do.", "WHAT TO DO"]];
// Practical, safe steps for the "what you can do" chapter when the research has none.
// {t} is the topic. Kept general on purpose: no specific products, numbers or promises.
const ADVICE = {
  "personal finance": ["Set up one automatic transfer to savings, even a small one, so saving happens without thinking.", "Before you decide anything about {t}, compare at least two options side by side."],
  investing: ["Before you buy anything tied to {t}, check the fees; they quietly eat your returns.", "Think in years, not days: decide how long you'd hold before you invest a dollar."],
  crypto: ["Never put in more than you could afford to lose completely.", "Use well-known platforms, turn on two-factor login, and never share your recovery phrase."],
  economy: ["Watch how {t} shows up in your own prices, rates and paycheck, not just the headlines.", "Keep an emergency fund so changes in the economy don't force you into debt."],
  "side hustles": ["Start {t} small this week and track every dollar in and out.", "Set aside part of what you earn for taxes before you spend any of it."],
  "real estate": ["Compare offers from at least three lenders; small rate differences add up over the years.", "Budget for taxes, insurance and repairs too, not just the monthly payment."],
};
// Tips for common subjects, matched against the topic name first (more specific than the niche).
const TOPIC_ADVICE = [
  [/credit (score|report|rating)|fico/i, ["Pay every bill on time; payment history counts the most in most credit scores.", "Keep card balances low compared with your limits, and check your credit reports for mistakes."]],
  [/mortgage|home loan|refinanc/i, ["Compare offers from at least three lenders; small rate differences add up over the years.", "Budget for taxes, insurance and repairs too, not just the monthly payment."]],
  [/credit card|debt|loan|interest rate|apr\b/i, ["Pay more than the minimum when you can; interest builds on whatever you leave unpaid.", "Before you borrow, compare the total cost, not just the monthly payment."]],
  [/401|ira\b|roth|retire|pension/i, ["If your employer offers a match, contribute at least enough to get all of it.", "Check the fund fees in your plan; low-cost index funds keep more of your returns."]],
  [/stock|share|fund|etf|index|bond|dividend|portfolio|invest/i, ["Before you buy, check the fees; they quietly eat your returns over time.", "Spread your money across many holdings so one bad pick can't sink you."]],
  [/tax/i, ["Keep records of income and expenses all year, not just at tax time.", "Check which deductions and credits you qualify for before you file."]],
  [/insur/i, ["Compare quotes every year; loyalty rarely gets you the best price.", "Read what's excluded, not just what's covered, before you buy."]],
  [/budget|saving|emergency fund|frugal|spend/i, ["Set up one automatic transfer to savings, even a small one.", "Track your spending for one month; most people find money they didn't know they were losing."]],
  [/bitcoin|crypto|coin|token|blockchain|nft|defi/i, ["Never put in more than you could afford to lose completely.", "Use well-known platforms, turn on two-factor login, and never share your recovery phrase."]],
];
const ADVICE_ANY = ["Before you decide anything about {t}, compare at least two options side by side.", "Read the fine print and the fees on any {t} offer before you sign."];
const short = (t) => t.replace(/\s*\(.*\)$/, "");
// A real sentence (has a verb and enough words), not a list fragment like "Payment of taxes and insurance."
const CORE_VERB = /\b(is|are|was|were|be|been|has|have|had|can|could|may|might|will|would|should|must|does|do|did)\b/i;
const sentence = (t) => t.split(/\s+/).length >= 5 && /[.!?]$/.test(t.trim()) && !(/^[A-Z][a-z]+ (of|for|and|with|from|to)\b/.test(t) && !CORE_VERB.test(t));

// A short recap item for a line: its number if it has one ("50% NEEDS"), else its opening clause.
function recapItem(text) {
  const st = analyzeLine(text).stat;
  if (st?.type === "percent") return `${st.value}% ${st.label || ""}`.trim();
  if (st?.type === "range") return `${st.lo}–${st.hi} ${st.unit.toLowerCase()}${st.label ? " of " + st.label.toLowerCase() : ""}`;
  if (st?.type === "growth" && st.every) return `Doubles every ${st.every} years`;
  if (st?.type === "money") return `$${Math.round(st.value).toLocaleString("en-US")} ${(st.label || "").toLowerCase()}`.trim();
  const clause = text.split(/[,;:]|\s(?:and|but|so|which|because)\s/)[0].replace(/\.$/, "").trim();
  const words = clause.split(/\s+/);
  return words.length <= 11 ? clause : words.slice(0, 10).join(" ") + "…";
}

// Turns a script into a 60–90 second deep dive: more researched facts (from the on-phone library),
// three chapter cards and a recap card. Facts keep their sources.
export async function deepen(script, { offline } = {}) {
  if (!["evergreen", "custom", "idea"].includes(script.kind)) return script;
  const lines = script.lines.filter((l) => l.kind === "media"), outro = script.lines.find((l) => l.kind === "outro");
  const hook = lines.shift();
  // Researched lines must read as stand-alone sentences; hand-written ones are always kept.
  const usable = (l) => l.kind === "media" && (!l.source || (sentence(l.text) && !/^(It|This|These|They|He|She|Its|And|Or|But|Also)\b/.test(l.text)));
  const pool = [...lines.filter(usable), ...script.extras.filter((l) => usable({ ...l, source: l.source || "x" }))];
  const seen = new Set(pool.map((l) => l.text.toLowerCase()));
  // Two facts that share most of their words say the same thing ("A dividend is the distribution of profits…" twice).
  const words = (t) => new Set(t.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 2) || []);
  const kept = pool.map((l) => words(l.text));
  const similar = (t) => { const a = words(t); return kept.some((b) => { let n = 0; for (const w of a) if (b.has(w)) n++; return n / Math.max(1, Math.min(a.size, b.size)) > 0.6; }); };
  // Pull more on-topic facts from the research library (runs on the phone; no network).
  try {
    const { deepResearch } = await import("./ai/research.js");
    const topic = short(script.topicTitle || script.title);
    const brief = await deepResearch(topic, { niche: script.niche });
    if (brief) {
      const re = new RegExp("\\b" + short(brief.main.title).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").split(/\s+/).join("\\s+") + "(?:s|es)?\\b", "i");
      for (const f of brief.facts) {
        if (seen.has(f.text.toLowerCase()) || !(f.source === brief.main.title || re.test(f.text))) continue;
        if (/^(It|This|These|They|He|She|Its|And|Or|But|Also|Examples?)\b/.test(f.text) || similar(f.text) || !sentence(f.text)) continue;
        // Facts from other articles must be about the topic: named early, not in passing at the end.
        if (f.source !== brief.main.title) { const m = re.exec(f.text); if (!m || m.index > f.text.length * 0.5) continue; }
        seen.add(f.text.toLowerCase()); kept.push(words(f.text));
        pool.push({ text: f.text, visual: "", kind: "media", chart: null, source: "Wikipedia · " + f.source });
        if (pool.length >= 9) break;
      }
    }
  } catch (e) { console.warn("deep research unavailable", e); }

  // Sort into chapters: definitions, numbers/evidence, then advice.
  const isAdvice = (t) => /^(start|keep|set|pay|use|try|automate|avoid|don't|never|always|check|compare|aim|pick|look|save|invest|build|before|think|watch|budget|read|decide|ask)\b/i.test(t) || /\byou (should|can|could|need)\b/i.test(t);
  const isDefinition = (t) => /\b(is|are|means|refers to|was)\b/i.test(t.split(/\s+/).slice(0, 8).join(" "));
  const what = [], why = [], todo = [];
  for (const l of pool) {
    if (isAdvice(l.text)) todo.push(l);
    else if (analyzeLine(l.text).stat) why.push(l);
    else if (isDefinition(l.text) && what.length < 3) what.push(l);
    else (why.length <= todo.length ? why : todo).push(l);
  }
  // Keep each chapter to 1–3 lines and make sure none is empty.
  const chapters = [what, why, todo].map((c) => c.slice(0, 3));
  const spare = pool.filter((l) => !chapters.flat().includes(l));
  for (const c of chapters) while (c.length < 1 && spare.length) c.push(spare.shift());
  // Every deep dive gets a real "what you can do" chapter: if the research had no advice, add practical steps.
  const todoCh = chapters[2], tipCount = todoCh.filter((l) => isAdvice(l.text)).length;
  if (tipCount < 2) {
    const full = short(script.topicTitle || script.title), name = /^[A-Z]{2}/.test(full) ? full : full.replace(/^./, (c) => c.toLowerCase());
    const byTopic = TOPIC_ADVICE.find(([re]) => re.test(full))?.[1] || [];
    const tips = [...byTopic, ...(ADVICE[script.niche] || []), ...ADVICE_ANY].map((x) => x.replaceAll("{t}", name))
      .filter((x) => !similar(x)).slice(0, 2 - tipCount);
    // Facts that aren't advice move up to "why it matters" (if there's room) or back to the spares.
    for (const l of todoCh.filter((x) => !isAdvice(x.text))) (chapters[1].length < 3 ? chapters[1] : spare).push(l);
    todoCh.splice(0, todoCh.length, ...todoCh.filter((x) => isAdvice(x.text)), ...tips.map((text) => ({ text, visual: "", kind: "media", chart: null })));
  }
  // A hook promising "thirty seconds" is wrong for a 60–90 second video.
  hook.text = hook.text.replace(/\b(in )?(thirty|30) seconds\b/i, (m, inn) => (inn ? "in " : "") + "under 90 seconds");
  const out = [hook];
  const recap = [];
  chapters.forEach((c, i) => {
    if (!c.length) return;
    // "What you can do" only when the chapter actually has advice in it.
    const [say, lab] = i === 2 && !c.some((l) => isAdvice(l.text)) ? ["Finally: what else to know.", "GOOD TO KNOW"] : SECTION_NAMES[i];
    out.push({ text: say, kind: "section", label: lab, num: i + 1, hold: 0.35 });
    out.push(...c);
    recap.push(recapItem(c[0].text));
  });
  if (recap.length >= 2) out.push({ text: "Quick recap.", kind: "recap", items: recap, hold: 3.2 });
  out.push(outro);
  script.lines = out;
  script.extras = spare;
  script.deep = true;
  return script;
}

/* ---------------------------------------------------------------- sound effects */

// Synthesized, so there's nothing to license: a soft whoosh on scene changes and a pop when a number lands.
function whoosh(out, at, gain) {
  const n = Math.floor(0.42 * SR), s0 = Math.floor(at * SR) - Math.floor(0.2 * SR);
  let lp = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n, k = s0 + i; if (k < 0 || k >= out.length) continue;
    const cutoff = 0.02 + 0.25 * Math.sin(Math.PI * t);                 // sweeping filter
    const white = Math.random() * 2 - 1;
    lp += cutoff * (white - lp);
    const hp = lp - prev; prev = lp;                                     // remove rumble
    out[k] += hp * gain * Math.sin(Math.PI * t) ** 2;
  }
}
function pop(out, at, gain) {
  const n = Math.floor(0.12 * SR), s0 = Math.floor(at * SR);
  for (let i = 0; i < n && s0 + i < out.length; i++) {
    const t = i / SR, f = 700 + 900 * Math.exp(-t * 40);
    out[s0 + i] += gain * Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 38);
  }
}
function chime(out, at, gain) {
  for (const [f, d] of [[1046.5, 0], [1568, 0.09]]) {
    const n = Math.floor(0.7 * SR), s0 = Math.floor((at + d) * SR);
    for (let i = 0; i < n && s0 + i < out.length; i++) { const t = i / SR; out[s0 + i] += gain * 0.6 * Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 5); }
  }
}
export function addSoundEffects(audio, scenes) {
  scenes.forEach((sc, i) => {
    if (i > 0) whoosh(audio, sc.start, sc.kind === "section" ? 0.5 : 0.32);
    if (sc.kind === "stat" || sc.stat) pop(audio, sc.start + 0.15, 0.22);
    if (sc.kind === "recap") chime(audio, sc.start + 0.1, 0.18);
  });
  let peak = 0; for (let i = 0; i < audio.length; i++) peak = Math.max(peak, Math.abs(audio[i]));
  if (peak > 0.99) for (let i = 0; i < audio.length; i++) audio[i] *= 0.97 / peak;
  return audio;
}

/* ---------------------------------------------------------------- captions file */

const srtTime = (s) => {
  const ms = Math.max(0, Math.round(s * 1000)), h = Math.floor(ms / 3.6e6), m = Math.floor(ms / 6e4) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};
// Subtitle cues of up to ~7 words, split at punctuation. YouTube and TikTok accept .srt uploads.
export function makeSrt(words) {
  const cues = []; let cur = [];
  words.forEach((w, i) => {
    cur.push(w);
    const end = /[.!?]$/.test(w.text) || (/[,;:]$/.test(w.text) && cur.length >= 4) || cur.length >= 7 || i === words.length - 1;
    if (end) { cues.push(cur); cur = []; }
  });
  // Each cue ends a little after its last word, but never after the next cue starts.
  return cues.map((c, i) => {
    const next = cues[i + 1]?.[0].start ?? Infinity, end = Math.max(c[0].start + 0.3, Math.min(c[c.length - 1].end + 0.15, next - 0.01));
    return `${i + 1}\n${srtTime(c[0].start)} --> ${srtTime(end)}\n${c.map((w) => w.text).join(" ")}\n`;
  }).join("\n");
}

/* ---------------------------------------------------------------- cover image */

// A 1080x1920 cover (thumbnail) with the title big and readable, over the reel's best picture.
export async function makeCover({ title, brand, accent, handle, scenes }, drawBackground) {
  const W = 1080, H = 1920, c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  drawBackground(ctx, scenes);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(0,0,0,0.55)"); g.addColorStop(0.45, "rgba(0,0,0,0.15)"); g.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const rgb = `rgb(${accent.join(",")})`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (brand) {
    ctx.font = "800 40px Montserrat";
    const tw = ctx.measureText(brand.toUpperCase()).width;
    ctx.fillStyle = rgb; ctx.beginPath(); ctx.roundRect(W / 2 - tw / 2 - 32, 170, tw + 64, 74, 37); ctx.fill();
    ctx.fillStyle = "rgb(12,12,20)"; ctx.fillText(brand.toUpperCase(), W / 2, 209);
  }
  // Title: up to 4 lines, as big as fits; the last line in the accent colour.
  const words = title.replace(/\s*#Shorts$/, "").toUpperCase().split(/\s+/);
  let size = 170, lines;
  for (;;) {
    ctx.font = `${size}px Anton`; lines = []; let cur = "";
    for (const w of words) { const t = (cur + " " + w).trim(); if (ctx.measureText(t).width <= W - 120) cur = t; else { lines.push(cur); cur = w; } }
    lines.push(cur);
    if (lines.length <= 4 || size <= 90) break;
    size -= 10;
  }
  const lh = size * 1.08, top = Math.max(300 + lh / 2, 600 - (lines.length * lh) / 2 + lh / 2);   // always below the brand tag
  ctx.lineJoin = "round";
  lines.forEach((ln, i) => {
    ctx.lineWidth = 22; ctx.strokeStyle = "rgba(0,0,0,0.9)"; ctx.strokeText(ln, W / 2, top + i * lh);
    ctx.fillStyle = i === lines.length - 1 ? rgb : "#fff"; ctx.fillText(ln, W / 2, top + i * lh);
  });
  if (handle) { ctx.font = "800 46px Montserrat"; ctx.fillStyle = "#fff"; ctx.fillText(handle, W / 2, H - 150); }
  return await new Promise((res) => c.toBlob(res, "image/jpeg", 0.9));
}

/* ---------------------------------------------------------------- hooks */

// Alternative opening lines in proven styles, built from the script itself (no new facts invented).
export function hookOptions(script) {
  const topic = short(script.topicTitle || script.title.replace(/\s*#Shorts$/, "").replace(/^(The|How|Why|What)\s+/i, ""));
  const t = /^[A-Z][a-z]+(\s[a-z]+)*$/.test(topic) ? topic.charAt(0).toLowerCase() + topic.slice(1) : topic;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const numberLine = script.lines.find((l) => l.kind === "media" && analyzeLine(l.text).stat && l.text.split(/\s+/).length <= 22);
  const opts = [];
  if (numberLine) opts.push(`Did you know? ${numberLine.text}`);
  opts.push(`Most people get ${t} completely wrong. Here's the truth.`);
  opts.push(`If you ignore ${t}, it could cost you thousands.`);
  opts.push(`Why does nobody explain ${t} like this?`);
  opts.push(`${cap(t)}, explained in under a minute.`);
  opts.push(`Stop scrolling. This is the simplest way to understand ${t}.`);
  return opts;
}

/* ---------------------------------------------------------------- reel coach */

// A 0–100 score with the top things to improve. Based on common short-video practice:
// a fast hook, readable lines, a concrete number, varied visuals, sources and a clear call to action.
export function coach(lines, { estimate, range, visuals = [] }) {
  const media = lines.filter((l) => l.kind === "media");
  const hook = lines[0]?.text || "";
  const checks = [];
  const add = (ok, points, tip) => checks.push({ ok, points, tip });
  const hookWords = hook.split(/\s+/).filter(Boolean).length;
  add(hookWords > 0 && hookWords <= 14, 18, `Shorten the hook to 14 words or fewer (now ${hookWords}). The first 2 seconds decide if people stay.`);
  add(/\?|\byou\b|\byour\b|\d|\b(never|stop|secret|mistake|wrong|truth)\b/i.test(hook), 12, "Make the hook personal or surprising: ask a question, say 'you', or lead with a number.");
  add(estimate >= range[0] - 2 && estimate <= range[1] + 2, 14, `Aim for ${range[0]}–${range[1]} seconds (now about ${Math.round(estimate)}).`);
  const long = media.filter((l) => l.text.split(/\s+/).length > 26);
  add(!long.length, 12, `Split long lines: ${long.length} line${long.length === 1 ? " is" : "s are"} over 26 words, which is hard to follow on screen.`);
  add(media.some((l) => analyzeLine(l.text).stat), 12, "Add a concrete number (a percentage, amount or timeframe). Numbers make charts and stick in memory.");
  const kinds = new Set(visuals.filter((v) => v && v.type).map((v) => v.type));
  add(kinds.size >= 2, 10, "Mix visuals: switch a scene to a Chart or Picture so it isn't all one style.");
  add(media.length >= 3, 8, "Add another point (+ Add a line) so the video delivers enough value.");
  add(lines.some((l) => l.source) || lines.length > 6, 6, "Back up facts: researched lines show their source on screen.");
  add(lines.some((l) => l.kind === "outro" && l.text.trim().length > 8), 8, "End with a call to action, like asking people to follow or save.");
  const score = checks.reduce((s, c) => s + (c.ok ? c.points : 0), 0);
  return { score, tips: checks.filter((c) => !c.ok).sort((a, b) => b.points - a.points).map((c) => c.tip) };
}
