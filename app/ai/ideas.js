// Turns research briefs into video ideas, without end. Fully offline.
//
// Each brief yields ideas from several angles. Hooks and talking points always come from the
// research (real sentences with sources), so the AI never has to invent facts. When the on-device
// AI is loaded it proposes catchier titles, which are filtered and scored; otherwise built-in
// title patterns are used.
import { deepResearch, seedTopics, terms, wikiUrl } from "./research.js";
import { complete, llmReady } from "./llm.js";

const pick = (a) => a[Math.floor(Math.random() * a.length)];
// Wikipedia titles capitalise their first letter ("Index fund"). Mid-sentence, common nouns read
// better in lower case; names and acronyms ("Warren Buffett", "Roth IRA", "S&P 500") keep theirs.
const short = (t) => {
  t = t.replace(/\s*\(.*\)$/, "");
  const words = t.split(" ");
  const common = /^[A-Z][a-z]+$/.test(words[0]) && words.slice(1).every((w) => !/[A-Z]/.test(w));
  return common && words.length > 0 && !/^(Bitcoin|Ethereum|Wall|Medicare|Medicaid|Social|Federal)$/.test(words[0]) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const hasNumber = (s) => /\d/.test(s) && /(%|percent|million|billion|trillion|\$|\b1[5-9]\d\d\b|\b20\d\d\b)/i.test(s);
const isPerson = (brief) => /\b(?:is|was) an? [\w\s,-]*?\b(investor|businessman|businesswoman|entrepreneur|economist|banker|financier|philanthropist|executive|billionaire|trader|founder|author)\b/i.test(brief.main.sentences[0] || "");
const isEvent = (brief) => /\b(crash|crisis|bubble|panic|mania|collapse|depression|scandal|squeeze|recession|bailout)\b/i.test(brief.main.title);

// Angles: when they apply, a title pattern, and how to build the hook and points.
const ANGLES = [
  { id: "explainer", label: "Explainer", ok: () => true,
    titles: (t) => [`${cap(t)}, explained in 30 seconds`, `What is ${t}? The quick version`, `${cap(t)} in plain English`],
    hook: (b, t) => pick([`What is ${t}? Here's the quick version.`, `${cap(t)}, explained in thirty seconds.`]) },
  { id: "fact", label: "Surprising fact", ok: (b) => b.facts.some((f) => hasNumber(f.text)),
    titles: (t) => [`The ${t} fact nobody talks about`, `This ${t} fact will surprise you`, `1 surprising fact about ${t}`],
    hook: (b) => "Here's something most people don't know. " + b.facts.find((f) => hasNumber(f.text)).text },
  { id: "story", label: "The story", ok: (b) => isEvent(b) || b.facts.some((f) => /\b(1[5-9]\d\d|20\d\d)\b/.test(f.text)),
    titles: (t) => [`The wild story of ${t}`, `How ${t} really happened`, `${cap(t)}: the story in 30 seconds`],
    hook: (b, t) => `This is the story of ${t}, and why it still matters for your money.` },
  { id: "myth", label: "Myth vs reality", ok: (b) => !isPerson(b),
    titles: (t) => [`The biggest myth about ${t}`, `${cap(t)}: what most people get wrong`, `Stop believing this about ${t}`],
    hook: (b, t) => `Most people get ${t} wrong. Here's what it actually is.` },
  { id: "mistakes", label: "Mistakes to avoid", ok: (b) => b.main.niches.some((n) => ["personal finance", "investing", "real estate", "side hustles"].includes(n)) && !isPerson(b) && !isEvent(b),
    titles: (t) => [`${cap(t)} mistakes that cost you money`, `Don't make this ${t} mistake`, `Avoid these ${t} traps`],
    hook: (b, t) => `Before you deal with ${t}, know this. It could save you money.` },
  { id: "versus", label: "This vs that", ok: (b) => b.related.length > 0 && !isPerson(b),
    titles: (t, b) => { const r = short(b.related[0].title); return [`${cap(t)} vs ${r}: what's the difference?`, `${cap(t)} or ${r}? Here's the answer`]; },
    hook: (b, t) => `${cap(t)} and ${short(b.related[0].title)} sound similar, but they're not the same thing.`,
    extra: (b) => b.related[0].sentences.slice(0, 1) },
  { id: "person", label: "Who is…", ok: (b) => isPerson(b),
    titles: (t) => [`Who is ${t}?`, `${cap(t)}'s money lesson in 30 seconds`, `What ${t} can teach you about money`],
    hook: (b, t) => `Who is ${t}, and what can they teach you about money?` },
  { id: "facts3", label: "Quick facts", ok: (b) => b.facts.length >= 4,
    titles: (t) => [`3 things to know about ${t}`, `${cap(t)}: 3 facts in 30 seconds`, `3 quick facts about ${t}`],
    hook: (b, t) => `Three things you should know about ${t}.` },
];

function pointsFor(brief, angle) {
  const main = brief.facts.filter((f) => f.source === brief.main.title);
  const other = brief.facts.filter((f) => f.source !== brief.main.title);
  let pts = [...main.slice(0, 3), ...other.slice(0, 2)];
  if (angle.id === "fact") pts = [...brief.facts.filter((f) => hasNumber(f.text)).slice(0, 2), ...main.slice(0, 2)];
  if (angle.id === "versus") pts = [...main.slice(0, 2), ...(angle.extra(brief).map((text) => ({ text, source: brief.related[0].title }))), ...other.slice(0, 1)];
  const seen = new Set();
  return pts.filter((p) => p && !seen.has(p.text) && seen.add(p.text)).slice(0, 4);
}

// ---------- AI titles ----------
const SYSTEM = "You rewrite titles for 30-second finance videos so they are catchier. Keep them short and true to the facts.";
const EXAMPLE = "Title: 3 quick facts about compound interest\nFact: At a ten percent return, money doubles about every seven years.\n" +
  "Catchier: How your money doubles every 7 years\n\nTitle: The biggest myth about credit scores\nFact: Checking your own credit score does not lower it.\n" +
  "Catchier: No, checking your credit score won't hurt it\n\n";

function cleanTitle(line) {
  let s = line.replace(/^[\s\d.)\-–•*]+/, "").trim();
  const quoted = s.match(/^["“]([^"”]{6,80})["”]/);
  if (quoted) s = quoted[1];
  else s = s.split(/\s[-–—|]\s|\s\(/)[0];
  return s.replace(/["“”]/g, "").replace(/\s+/g, " ").replace(/[.!,;]+$/, "").trim();
}

// Guardrails: a rewrite is only used if it keeps the topic, adds no numbers or years that aren't in
// the research, isn't the example copied back, and is a sensible length. Otherwise the original stays.
export function acceptTitle(title, topic, facts, original = "") {
  const words = title.split(/\s+/).length;
  if (words < 3 || words > 10 || title.length > 64) return false;
  if (/\b(title|video|hook|youtube|tiktok|shorts|subscribe|catchier|http)\b/i.test(title)) return false;
  if (/[<>{}|#@\[\]()]/.test(title)) return false;
  if (/\b(I|I'm|I’m|my|me|we|our)\b/i.test(title)) return false;
  if (/doubles every 7 years|checking your credit score/i.test(title)) return false;        // the examples
  const tt = terms(topic);
  if (tt.length && !terms(title).some((t) => tt.includes(t))) return false;                 // must keep the topic
  const known = facts.join(" ") + " " + topic + " " + original;
  for (const n of title.match(/\d[\d,.]*/g) || []) if (!known.includes(n.replace(/[.,]$/, ""))) return false;   // no invented numbers
  // Grounding: every meaningful word must come from the research, the topic or the original title,
  // or be a punchy word that adds no claim. So the AI can rephrase, but can't introduce new facts.
  const allowed = new Set([...terms(known), ...STYLE_WORDS]);
  return terms(title).every((t) => allowed.has(t));
}
const STYLE_WORDS = new Set(("secret truth why how really actually mistake mistakes never stop need know beginner simple easy hidden cost costs " +
  "money rich wealth save saving guide explained smart best worst real quick fast nobody everyone people wrong right should must " +
  "thing things fact facts question answer work works way ways lesson lessons rule rules trap traps warning matter matters change " +
  "start today future life habit habits myth myths story surprising shocking simple important big biggest little here behind inside " +
  "every anyone someone love loves hate hates win wins lose loses beat beats").split(" ").map((w) => terms(w)[0]).filter(Boolean));

async function aiTitle(topic, angle, fact, current, facts) {
  const user = EXAMPLE + `Title: ${current}\nFact: ${fact}\n`;
  const text = await complete(SYSTEM, user, "Catchier:", { maxTokens: 24, temperature: 0.7 });
  const cand = cleanTitle(text.replace(/^Catchier:\s*/, "").split("\n")[0]);
  return cand && acceptTitle(cand, topic, facts, current) && cand.toLowerCase() !== current.toLowerCase() ? cand : null;
}

// ---------- ideas ----------
let counter = 0;
export function ideasFromBrief(brief, { max = 3, usedAngles = new Set() } = {}) {
  const t = short(brief.main.title);
  const angles = ANGLES.filter((a) => a.ok(brief)).sort(() => Math.random() - 0.5)
    .sort((a, b) => Number(usedAngles.has(a.id)) - Number(usedAngles.has(b.id))).slice(0, max);
  return angles.map((angle) => {
    const points = pointsFor(brief, angle);
    return {
      id: `idea-${Date.now().toString(36)}-${(counter++).toString(36)}`,
      topic: t, angle: angle.id, angleLabel: angle.label, title: pick(angle.titles(t, brief)), ai: false,
      hook: angle.hook(brief, t), points: points.map((p) => p.text),
      sources: [...new Set([brief.main.title, ...points.map((p) => p.source)])],
      niches: brief.main.niches, keyFact: (brief.facts.find((f) => hasNumber(f.text)) || brief.facts[0])?.text || "",
    };
  });
}

// Improve an idea's title with the on-device AI (only if it's loaded).
export async function improveTitle(idea) {
  if (!llmReady()) return idea;
  const angle = ANGLES.find((a) => a.id === idea.angle);
  try {
    const title = await aiTitle(idea.topic, angle, idea.keyFact || idea.points[0] || idea.topic, idea.title, [...idea.points, idea.keyFact || ""]);
    if (title) { idea.title = title; idea.ai = true; }
  } catch (e) { console.warn("AI title failed", e); }
  return idea;
}

// Endless idea stream: researches topic after topic for a niche (or around a starting query).
export function ideaStream({ niche, query, onStep }) {
  const used = new Set(), usedAngles = new Set(), queue = [];
  let seeds = [], primed = false;
  return {
    async next() {
      while (!queue.length) {
        if (!primed && query) { primed = true; seeds.unshift(query); }
        if (!seeds.length) seeds = await seedTopics(niche, used, 25);
        if (!seeds.length) return null;
        const topic = seeds.shift();
        if (used.has(topic)) continue;
        used.add(topic);
        const brief = await deepResearch(topic, { niche, onStep });
        if (!brief) continue;
        used.add(brief.main.title);
        // Spread out: the related articles become future topics.
        for (const r of brief.related.slice(0, 3)) if (!used.has(r.title) && !seeds.includes(r.title)) seeds.splice(1 + Math.floor(Math.random() * 6), 0, r.title);
        const ideas = ideasFromBrief(brief, { max: query && topic === query ? 4 : 2, usedAngles });
        ideas.forEach((i) => { usedAngles.add(i.angle); i.brief = brief; });
        if (usedAngles.size > 5) usedAngles.clear();
        queue.push(...ideas);
      }
      return queue.shift();
    },
  };
}

// ---------- idea -> reel script (same shape as app/script.js scripts) ----------
export function scriptFromIdea(idea, opts) {
  const line = (text, visual = "", kind = "media") => ({ text, visual, kind, chart: null });
  const g = opts.generic;
  const visual = (text, i) => opts.visualFor(text, g) || (i % 2 ? idea.topic : g[i % g.length]);
  const pts = idea.points.map((p) => p.replace(/\s+/g, " ").trim());
  const lines = [line(idea.hook, opts.visualFor(idea.topic + " " + idea.hook, g) || idea.topic), ...pts.map((p, i) => line(p, visual(p, i + 1))), line(opts.cta, "", "outro")];
  const extras = (idea.brief?.facts || []).map((f) => f.text).filter((t) => !pts.includes(t)).slice(0, 3).map((t, i) => line(t, visual(t, i + 5)));
  return {
    kind: "idea", topicId: "idea-" + idea.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40), title: idea.title,
    niche: opts.niche, lines, extras, tags: [idea.topic, opts.niche, idea.angleLabel.toLowerCase()],
    sources: idea.sources.map(wikiUrl),
  };
}
