import { smartHooks } from "./hook.js";
// Features for more detailed videos and better results:
//   deep dives (chapters + recap), sound effects, captions files, cover images, hook options and the reel coach.
import { analyzeLine } from "./visuals.js";
import { SR } from "./music.js";
import { adviceFor, fits, simplify } from "./story.js";

/* ---------------------------------------------------------------- deep dive */

const SECTION_NAMES = [["First: what it is.", "WHAT IT IS"], ["Next: why it matters.", "WHY IT MATTERS"], ["Finally: what you can do.", "WHAT TO DO"]];
const short = (t) => t.replace(/\s+\(.*\)$/, "");
// A real sentence (has a verb and enough words), not a list fragment like "Payment of taxes and insurance."
const CORE_VERB = /\b(is|are|was|were|be|been|has|have|had|can|could|may|might|will|would|should|must|does|do|did)\b/i;
// "…popularized by the media that U.S." is a sentence cut at an abbreviation, not a sentence.
const CUT = /\b(U\.S|U\.K|U\.N|E\.U|Inc|Corp|Co|Ltd|Jr|Sr|Mr|Mrs|Ms|Dr|St|vs|No|Gen|Gov|Sen|Rep|approx|e\.g|i\.e)\.$/i;
const LOST_NUMBER = /\b(?:(?:equal to|equivalent to|approximately|nearly|roughly|totaling|totalling|an estimated) (?:US\$ ?|\$ ?)?(?:million|billion|trillion|thousand|hundred|percent|per cent|dollars|euros|pounds|yen|people|users|bitcoins?|ether|units|tons|tonnes|years|months|days|employees|members|times|shares|households|workers)|(?:valued at|reached|around|about|some|over|under|than|by|of|the|out of the|to|from) (?:US\$ ?|\$ ?)?(?:million|billion|trillion|percent|per cent)(?! of\b))\b/;
const POINTER = /\b(shown below|see below|as follows|the following|listed below|in the table|this table|the figure|shown above|see above)\b/i;
const sentence = (t) => t.split(/\s+/).length >= 5 && /[.!?]$/.test(t.trim()) && !CUT.test(t.trim()) && !LOST_NUMBER.test(t) && !POINTER.test(t)
  && !/^(Difference between|Comparison|Comparison with|History of|Overview|Types of|Background|Definition|Etymology|Criticism)\b[^.]*? [a-z]+ [A-Z][a-z]/.test(t)
  && !((/^[A-Z][a-z]+ (of|for|and|with|from|to)\b/.test(t) || /^[A-Z][a-z]+ing\b/.test(t)) && !CORE_VERB.test(t));

// A short recap item for a line: its number if it has one ("50% NEEDS"), else its opening clause.
function recapItem(text) {
  const st = analyzeLine(text).stat;
  if (st?.type === "percent") return `${st.value}% ${st.label || ""}`.trim();
  if (st?.type === "range") return `${st.lo}–${st.hi} ${st.unit.toLowerCase()}${st.label ? " of " + st.label.toLowerCase() : ""}`;
  if (st?.type === "growth" && st.every) return `Doubles every ${st.every} years`;
  if (st?.type === "money") return `$${Math.round(st.value).toLocaleString("en-US")} ${(st.label || "").toLowerCase()}`.trim();
  // Skip a short lead-in ("In practice, …", "However, …") and take the clause that says something.
  const parts = text.split(/[,;:]|\s(?:and|but|so|which|because)\s/).map((x) => x.trim()).filter(Boolean);
  const pick = parts.find((x) => x.split(/\s+/).length >= 4) || parts[0] || text;
  const clause = pick.replace(/\.$/, "").replace(/^./, (c) => c.toUpperCase());
  const words = clause.split(/\s+/);
  return words.length <= 11 ? clause : words.slice(0, 10).join(" ") + "…";
}

// Kinds of article sections, from their headings.
const SEC_HISTORY = /histor|origin|background|development|etymology|early|founding|timeline|evolution/i;
const SEC_HOW = /how|mechan|operation|process|types?\b|structure|method|calculat|overview|function|features|uses?\b|design|principle|definition|concept|characteristics|components/i;
const SEC_RISK = /critic|risk|controvers|problem|disadvantage|regulat|legal|debate|limitation|effect|impact|fraud|collapse|scandal|issue|concern|failure|crisis/i;
const RISKY = /\b(risk|risks|criticis\w*|fraud|loss|losses|lose|collapse\w*|crash\w*|scandal|lawsuit|danger\w*|downside|volatil\w*|default\w*|bankrupt\w*|warn\w*|scam\w*|penalt\w*|fees?)\b/i;
const firstYear = (t) => { const m = t.match(/\b(1[5-9]\d\d|20\d\d)\b/); return m ? Number(m[1]) : null; };

// Chapter layouts: a deep dive has three chapters, the full story five.
const CHAPTERS = {
  deep: ["what", "why", "todo"],
  full: ["what", "history", "why", "risks", "todo"],
};
const CHAPTER_TEXT = { what: ["what it is", "WHAT IT IS"], history: ["where it came from", "THE HISTORY"], why: ["why it matters", "WHY IT MATTERS"],
  risks: ["the risks and the catch", "THE RISKS"], todo: ["what you can do", "WHAT TO DO"] };
const ORDINAL = ["First", "Next", "Then", "Now", "Finally"];

// Turns a script into a deep dive (60–90 s, three chapters) or the full story (2–3 min, five chapters):
// more researched facts from the on-phone library (including the full text of the main articles),
// chapter cards and a recap card. Every researched fact keeps its source and section.
export async function deepen(script, { offline, length = "deep", depth = 2 } = {}) {
  if (!["evergreen", "custom", "idea"].includes(script.kind)) return script;
  const layout = CHAPTERS[length] || CHAPTERS.deep, full = layout.length > 3;
  const perChapter = full ? 4 : 3, want = full ? 18 : 9;
  // Chapters do the signposting here, so spoken lead-ins ("Why it matters: …") come off first.
  for (const l of [...script.lines, ...script.extras]) {
    if (l.tip) l.text = l.text.replace(/^The takeaway:\s+/, "");
    else if (l.claim && l.text !== l.claim) l.text = l.claim;
  }
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
  let brief = null;
  // Pull more on-topic facts from the research library (runs on the phone; no network).
  try {
    const { deepResearch } = await import("./ai/research.js");
    const topic = short(script.topicTitle || script.title);
    brief = await deepResearch(topic, { niche: script.niche, depth: Math.max(depth, full ? 3 : 2) });
    if (brief) {
      const re = new RegExp("\\b" + short(brief.main.title).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").split(/\s+/).join("\\s+") + "(?:s|es)?\\b", "i");
      // The main article's own sections first (in reading order), then the ranked facts.
      const fromSections = (brief.sections || []).flatMap((sec) => sec.sentences.map((text) => ({ text, source: brief.main.title, section: sec.heading })));
      const candidates = [...brief.facts.filter((f) => !f.section), ...fromSections, ...brief.facts.filter((f) => f.section && f.source !== brief.main.title)];
      for (const f of candidates) {
        if (seen.has(f.text.toLowerCase()) || !(f.source === brief.main.title || re.test(f.text))) continue;
        // The storyteller's rules: fit for a general audience, and able to stand on its own.
        if (!fits(f.text, topic) || /\b(these|those|such)\s+[a-z]+|\bthe (above|following|same)\b/i.test(f.text)) continue;
        f = { ...f, text: simplify(f.text) };
        if (f.text.split(/\s+/).length > 30) continue;                                     // too long to follow when spoken
        if (/^(It|This|These|They|He|She|Its|And|Or|But|Also|Examples?)\b/.test(f.text) || similar(f.text) || !sentence(f.text)) continue;
        // Facts from other articles must be about the topic: named early, not in passing at the end.
        if (f.source !== brief.main.title) { const m = re.exec(f.text); if (!m || m.index > f.text.length * 0.5) continue; }
        seen.add(f.text.toLowerCase()); kept.push(words(f.text));
        pool.push({ text: f.text, visual: "", kind: "media", chart: null, section: f.section || null,
          source: "Wikipedia · " + f.source + (f.section ? " — " + f.section : "") });
        if (pool.length >= want + 6) break;
      }
    }
  } catch (e) { console.warn("deep research unavailable", e); }
  script.research = brief ? { depth: brief.depth, read: brief.read, sources: brief.sources, fullText: brief.bodyDocs?.map((d) => d.title) || [] } : null;
  if (brief) script.sources = [...new Set([...(script.sources || []), ...brief.sources.slice(0, 8).map((t) => "https://en.wikipedia.org/wiki/" + encodeURIComponent(t.replaceAll(" ", "_")))])];

  // Sort into chapters.
  const isAdvice = (t) => /^(start|keep|set|pay|use|try|automate|avoid|don't|never|always|check|compare|aim|pick|look|save|invest|build|before|think|watch|budget|read|decide|ask)\b/i.test(t) || /\byou (should|can|could|need)\b/i.test(t);
  const isDefinition = (t) => /\b(is|are|means|refers to|was)\b/i.test(t.split(/\s+/).slice(0, 8).join(" "));
  const kindOf = (l) => {
    if (l.tip || isAdvice(l.text)) return "todo";
    if (full && (SEC_HISTORY.test(l.section || "") || (firstYear(l.text) && !analyzeLine(l.text).stat))) return "history";
    if (full && (SEC_RISK.test(l.section || "") || RISKY.test(l.text))) return "risks";
    if (analyzeLine(l.text).stat) return "why";
    if (isDefinition(l.text) || SEC_HOW.test(l.section || "")) return "what";
    return "why";
  };
  const buckets = Object.fromEntries(layout.map((k) => [k, []]));
  for (const l of pool) {
    let k = kindOf(l);
    if (!buckets[k]) k = k === "history" || k === "risks" ? "why" : "what";
    if (k === "what" && buckets.what.length >= perChapter) k = "why";
    buckets[k].push(l);
  }
  if (buckets.history) buckets.history.sort((a, b) => (firstYear(a.text) ?? 9999) - (firstYear(b.text) ?? 9999));   // in time order
  const chapters = layout.map((k) => buckets[k].slice(0, perChapter));
  const spare = pool.filter((l) => !chapters.flat().includes(l));
  // "What it is" and "why it matters" borrow from the spares when short; history and risks only run
  // when the research really has them (no filler chapters).
  chapters.forEach((c, i) => { if (layout[i] === "what" || layout[i] === "why") while (c.length < (full ? 2 : 1) && spare.length) c.push(spare.shift()); });
  // Every deep dive gets a real "what you can do" chapter: if the research had no advice, add practical steps.
  const adv = (l) => l.tip || isAdvice(l.text);
  const todoCh = chapters[layout.indexOf("todo")], tipCount = todoCh.filter(adv).length, needTips = full ? 3 : 2;
  if (tipCount < needTips) {
    const fullName = short(script.topicTitle || script.title), name = /^[A-Z]{2}/.test(fullName) ? fullName : fullName.replace(/^./, (c) => c.toLowerCase());
    const tips = adviceFor(fullName, script.niche)
      .filter((x) => !similar(x)).slice(0, needTips - tipCount);
    for (const l of todoCh.filter((x) => !adv(x))) (chapters[layout.indexOf("why")].length < perChapter ? chapters[layout.indexOf("why")] : spare).push(l);
    todoCh.splice(0, todoCh.length, ...todoCh.filter(adv), ...tips.map((text) => ({ text, visual: "", kind: "media", chart: null, tip: true })));
  }
  // A hook promising "thirty seconds" is wrong for a longer video.
  hook.text = hook.text.replace(/\b(in )?(thirty|30) seconds\b/i, (m, inn) => (inn ? "in " : "") + (full ? "under 3 minutes" : "under 90 seconds"));
  const out = [hook], recap = [];
  let n = 0;
  chapters.forEach((c, i) => {
    if (!c.length) return;
    const key = layout[i];
    let [phrase, label] = CHAPTER_TEXT[key];
    if (key === "todo" && !c.some((l) => l.tip || isAdvice(l.text))) [phrase, label] = ["what else to know", "GOOD TO KNOW"];
    const ord = i === layout.length - 1 ? "Finally" : ORDINAL[Math.min(n, ORDINAL.length - 2)];
    out.push({ text: `${ord}: ${phrase}.`, kind: "section", label, num: ++n, hold: 0.35 });
    out.push(...c);
    recap.push(recapItem(c[0].text));
  });
  if (recap.length >= 2) out.push({ text: "Quick recap.", kind: "recap", items: recap.slice(0, 4), hold: 3.2 + (recap.length > 3 ? 0.8 : 0) });
  out.push(outro);
  script.lines = out;
  script.extras = spare;
  script.deep = true;
  script.format = full ? "full" : "deep";
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
// A deep, soft hit (a falling sine with a short noise burst) for the first frame and the payoff.
function impact(out, at, gain) {
  const n = Math.floor(0.6 * SR), s0 = Math.max(0, Math.floor(at * SR));
  let ph = 0;
  for (let i = 0; i < n && s0 + i < out.length; i++) {
    const t = i / SR, f = 38 + 90 * Math.exp(-t * 18);
    ph += 2 * Math.PI * f / SR;
    out[s0 + i] += gain * (Math.sin(ph) * Math.exp(-t * 6) + (Math.random() * 2 - 1) * 0.25 * Math.exp(-t * 60));
  }
}
// A rising swell of filtered noise that leads into the payoff.
function riser(out, end, gain, len = 1.1) {
  const n = Math.floor(len * SR), s0 = Math.floor((end - len) * SR);
  let lp = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const k = s0 + i; if (k < 0 || k >= out.length) continue;
    const x = i / n, cutoff = 0.01 + 0.3 * x * x;
    lp += cutoff * ((Math.random() * 2 - 1) - lp);
    const hp = lp - prev; prev = lp;
    out[k] += hp * gain * x * x * 2.2;
  }
}
// Two bright, quick bells: a coin landing (for money figures).
function coins(out, at, gain) {
  for (const [f, d] of [[2093, 0], [2637, 0.07], [3136, 0.13]]) {
    const n = Math.floor(0.35 * SR), s0 = Math.floor((at + d) * SR);
    for (let i = 0; i < n && s0 + i < out.length; i++) { const t = i / SR; out[s0 + i] += gain * 0.5 * Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 14); }
  }
}
// A soft falling tone for a risk or a catch.
function downer(out, at, gain) {
  const n = Math.floor(0.45 * SR), s0 = Math.floor(at * SR); let ph = 0;
  for (let i = 0; i < n && s0 + i < out.length; i++) {
    const t = i / SR, f = 420 * Math.pow(0.35, t / 0.45);
    ph += 2 * Math.PI * f / SR;
    out[s0 + i] += gain * (Math.sin(ph) + 0.3 * Math.sin(2 * ph)) * Math.sin(Math.PI * Math.min(1, t / 0.45)) * 0.6;
  }
}
// A warm bell (the takeaway).
function bell(out, at, gain) {
  for (const [f, a] of [[784, 1], [1568, 0.4], [2352, 0.15]]) {
    const n = Math.floor(1.0 * SR), s0 = Math.floor(at * SR);
    for (let i = 0; i < n && s0 + i < out.length; i++) { const t = i / SR; out[s0 + i] += gain * a * Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 4) * Math.min(1, t / 0.005); }
  }
}
// A bubbly "bloop" (the question for the comments).
function bloop(out, at, gain) {
  const n = Math.floor(0.18 * SR); let ph = 0;
  for (const [d, f0] of [[0, 500], [0.11, 760]]) {
    const s0 = Math.floor((at + d) * SR); ph = 0;
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const t = i / SR, f = f0 * (1 + 1.2 * t / 0.18); ph += 2 * Math.PI * f / SR;
      out[s0 + i] += gain * Math.sin(ph) * Math.exp(-t * 22);
    }
  }
}
// A rising sparkle (the ending).
function sparkle(out, at, gain) {
  [1568, 1976, 2349, 3136].forEach((f, k) => {
    const n = Math.floor(0.5 * SR), s0 = Math.floor((at + k * 0.06) * SR);
    for (let i = 0; i < n && s0 + i < out.length; i++) { const t = i / SR; out[s0 + i] += gain * 0.35 * Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 9); }
  });
}
export function addSoundEffects(audio, scenes) {
  impact(audio, 0, 0.35);
  scenes.forEach((sc, i) => {
    if (sc.payoff && i > 0) { riser(audio, sc.start, 0.16); impact(audio, sc.start, 0.28); }
    if (sc.tone === "down" && !sc.payoff) downer(audio, sc.start + 0.12, 0.12);
    if (sc.tone === "tip" && !sc.payoff) bell(audio, sc.start + 0.08, 0.08);
    if (sc.tone === "stance") impact(audio, sc.start, 0.16);
    if (sc.tone === "question") bloop(audio, sc.start + 0.1, 0.2);
    if (sc.kind === "outro") sparkle(audio, sc.start + 0.1, 0.14);
    if (i > 0 && !sc.payoff) whoosh(audio, sc.start, sc.kind === "section" ? 0.5 : 0.24 + 0.12 * ((i * 7) % 5) / 4);
    if (sc.kind === "stat" || sc.stat) (/^\$/.test(sc.stat || "") ? coins : pop)(audio, sc.start + 0.15, 0.22);
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
export async function makeCover({ title, brand, accent, handle, scenes, style = "bold", keyNumber = "", question = "" }, drawBackground) {
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
  // "Big number": the reel's key figure, huge, with the title below it.
  if (style === "number" && keyNumber) {
    let size = 420; ctx.font = `${size}px Anton`;
    while (ctx.measureText(keyNumber).width > W - 120 && size > 160) { size -= 20; ctx.font = `${size}px Anton`; }
    ctx.lineJoin = "round"; ctx.lineWidth = 30; ctx.strokeStyle = "rgba(0,0,0,0.9)"; ctx.strokeText(keyNumber, W / 2, 720);
    ctx.fillStyle = rgb; ctx.fillText(keyNumber, W / 2, 720);
    title = title.replace(/\s*#Shorts$/, "");
    let ts = 96; ctx.font = `${ts}px Anton`;
    const wordsN = title.toUpperCase().split(/\s+/), rows = []; let cur = "";
    for (const w of wordsN) { const t = (cur + " " + w).trim(); if (ctx.measureText(t).width <= W - 140) cur = t; else { rows.push(cur); cur = w; } }
    rows.push(cur);
    rows.slice(0, 3).forEach((ln, i) => { ctx.lineWidth = 16; ctx.strokeText(ln, W / 2, 1060 + i * ts * 1.1); ctx.fillStyle = "#fff"; ctx.fillText(ln, W / 2, 1060 + i * ts * 1.1); });
    if (handle) { ctx.font = "800 46px Montserrat"; ctx.fillStyle = "#fff"; ctx.fillText(handle, W / 2, H - 150); }
    return await new Promise((res) => c.toBlob(res, "image/jpeg", 0.9));
  }
  // "Question": the hook question (or the title as one), with the question mark in the accent colour.
  if (style === "question") {
    let q = (question || title.replace(/\s*#Shorts$/, "")).trim();
    if (!/\?$/.test(q)) q = q.replace(/[.!]+$/, "") + "?";
    title = q;
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
  const opts = smartHooks(script).map((o) => o.text);
  // "Instead, Tether only had…" can't open a video: drop the linking word.
  if (numberLine) opts.push(`Did you know? ${cap(numberLine.text.replace(/^(Instead|However|But|Also|In fact|Moreover|Still|Yet|So|And|Meanwhile|Today|Now),?\s+/i, ""))}`);
  opts.push(`Most people get ${t} completely wrong. Here's the truth.`);
  opts.push(`If you ignore ${t}, it could cost you thousands.`);
  opts.push(`Why does nobody explain ${t} like this?`);
  opts.push(`${cap(t)}, explained in ${script.format === "full" ? "under 3 minutes" : script.deep ? "90 seconds" : "under a minute"}.`);
  opts.push(`Stop scrolling. This is the simplest way to understand ${t}.`);
  return [...new Set(opts)];
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
  add(/\?|\byou\b|\byour\b|\d|\b(never|stop|secret|mistake|wrong|truth|catch|most people|nobody)\b/i.test(hook), 12, "Make the hook personal or surprising: ask a question, say 'you', or lead with a number.");
  add(estimate >= range[0] - 2 && estimate <= range[1] + 2, 14, `Aim for ${range[0]}–${range[1]} seconds (now about ${Math.round(estimate)}).`);
  const long = media.filter((l) => l.text.split(/\s+/).length > 26);
  add(!long.length, 10, `Split long lines: ${long.length} line${long.length === 1 ? " is" : "s are"} over 26 words, which is hard to follow on screen.`);
  add(media.some((l) => analyzeLine(l.text).stat), 12, "Add a concrete number (a percentage, amount or timeframe). Numbers make charts and stick in memory.");
  const kinds = new Set(visuals.filter((v) => v && v.type).map((v) => v.type));
  add(kinds.size >= 2, 8, "Mix visuals: switch a scene to a Chart or Picture so it isn't all one style.");
  add(media.length >= 3, 8, "Add another point (+ Add a line) so the video delivers enough value.");
  // Accuracy: every fact should be backed by a source (see the fact check badges).
  const facts = lines.map((l) => l.check).filter((c) => c && c.kind === "fact");
  const shaky = facts.filter((c) => c.status === "unverified" || c.status === "conflict").length;
  if (facts.length) add(!shaky, 10, `${shaky} fact${shaky === 1 ? "" : "s"} couldn't be verified. Tap "Swap or remove unverified", or edit them.`);
  else add(lines.some((l) => l.source) || lines.length > 6, 10, "Back up facts: researched lines show their source on screen.");
  add(lines.some((l) => l.kind === "outro" && l.text.trim().length > 8), 8, "End with a call to action, like asking people to follow or save.");
  const score = checks.reduce((s, c) => s + (c.ok ? c.points : 0), 0);
  return { score, tips: checks.filter((c) => !c.ok).sort((a, b) => b.points - a.points).map((c) => c.tip) };
}
