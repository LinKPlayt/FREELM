// Offline deep research over the bundled library (app/ai/data/library.json).
import { loadSemantic, semanticReady, semanticSearch } from "./semantic.js";
// Everything here runs on the phone; the only file it reads is the library, from this app.
//
// 1. Search: BM25 ranking over thousands of articles (titles weigh more than body text).
// 2. Follow leads: key terms from the best matches, and other articles they mention, are searched too.
// 3. Collect facts: the most relevant, specific, speakable sentences, each tied to its source.

const STOP = new Set(("a an and are as at be been but by can could did do does for from had has have he her his how i if in into is it its " +
  "may more most no not of on or our she so some such than that the their them then there these they this those to too was we were what " +
  "when where which while who why will with would you your also one two three many other used use using known called often first new " +
  "after before between during over under about against among within without well able across").split(" "));

export function terms(text) {
  return (text.toLowerCase().normalize("NFKD").match(/[a-z0-9]+(?:'[a-z]+)?/g) || [])
    .map((w) => w.replace(/'s$/, ""))
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(stem);
}
function stem(w) {   // light stemming: plurals and common endings
  if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 5 && /(ing|ers)$/.test(w)) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("es") && /(ss|x|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ed")) return w.slice(0, -2);            // managed -> manag (= managers)
  if (w.length > 5 && w.endsWith("er")) return w.slice(0, -2);            // manager -> manag
  return w;
}

let LIB = null;
export async function library() {
  if (LIB) return LIB;
  const res = await fetch(new URL("./data/library.json", import.meta.url));
  if (!res.ok) throw new Error("The research library couldn't be loaded.");
  const data = await res.json();
  const docs = data.articles.map((a, i) => ({ id: i, title: a.t, niches: a.n || [], sentences: a.s }));
  // Inverted index with term frequencies; titles count 3x.
  const index = new Map(), lengths = new Float32Array(docs.length);
  docs.forEach((d) => {
    const tf = new Map();
    for (const t of terms(d.title)) tf.set(t, (tf.get(t) || 0) + 3);
    for (const s of d.sentences) for (const t of terms(s)) tf.set(t, (tf.get(t) || 0) + 1);
    let len = 0;
    for (const [t, n] of tf) { len += n; let post = index.get(t); if (!post) index.set(t, (post = [])); post.push([d.id, n]); }
    lengths[d.id] = len;
  });
  const avg = lengths.reduce((a, b) => a + b, 0) / docs.length;
  // Titles of 1-5 words, to spot when one article mentions another ("follow the link").
  const titleIndex = new Map();
  for (const d of docs) {
    const key = d.title.replace(/\s*\(.*\)$/, "").toLowerCase();
    if (key.split(" ").length <= 5 && key.length > 3) titleIndex.set(key, d.id);
  }
  LIB = { docs, index, lengths, avg, titleIndex, license: data.license, built: data.built, vectorsInfo: data.vectors || null };
  return LIB;
}

// Starts the semantic (meaning-based) search model in the background. Resolves true when ready.
export const startSemantic = async () => loadSemantic(await library());

// Hybrid search: meaning (semantic vectors) + keywords (BM25). Falls back to keywords alone.
export async function hybridSearch(lib, query, k = 10, niche = null, exclude = new Set()) {
  const kw = search(lib, query, 40, niche, exclude);
  if (!semanticReady()) return kw.slice(0, k);
  const sem = (await semanticSearch(query, 40)).filter(([id]) => !exclude.has(id));
  // Questions in plain words ("how do I stop living paycheck to paycheck") are about meaning, so
  // meaning counts for more; short topic names lean more on keywords.
  const words = query.trim().split(/\s+/).length, wSem = words >= 4 ? 0.75 : 0.55, wKw = 1 - wSem;
  const maxKw = kw[0]?.score || 1, combined = new Map();
  for (const r of kw) combined.set(r.doc.id, wKw * (r.score / maxKw));
  for (const [id, sim] of sem) {
    const d = lib.docs[id];
    const semScore = Math.max(0, (sim - 0.2) / 0.6) * (niche && d.niches.includes(niche) ? 1.1 : 1);
    combined.set(id, (combined.get(id) || 0) + wSem * Math.min(1, semScore));
  }
  return [...combined].sort((a, b) => b[1] - a[1]).slice(0, k).map(([id, score]) => ({ doc: lib.docs[id], score }));
}

export function search(lib, query, k = 10, niche = null, exclude = new Set()) {
  const q = [...new Set(terms(query))];
  const N = lib.docs.length, k1 = 1.4, b = 0.75, scores = new Map();
  for (const t of q) {
    const post = lib.index.get(t); if (!post) continue;
    const idf = Math.log(1 + (N - post.length + 0.5) / (post.length + 0.5));
    for (const [id, tf] of post) {
      const s = idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * lib.lengths[id] / lib.avg));
      scores.set(id, (scores.get(id) || 0) + s);
    }
  }
  const ql = query.toLowerCase().trim();
  for (const [id, s] of scores) {
    const d = lib.docs[id], tl = d.title.toLowerCase();
    let bonus = 1;
    if (tl === ql || tl.replace(/\s*\(.*\)$/, "") === ql) bonus *= 3;        // exact article
    else if (tl.includes(ql)) bonus *= 1.6;
    if (niche && d.niches.includes(niche)) bonus *= 1.25;
    scores.set(id, s * bonus);
  }
  return [...scores].filter(([id]) => !exclude.has(id)).sort((a, b) => b[1] - a[1]).slice(0, k)
    .map(([id, score]) => ({ doc: lib.docs[id], score }));
}

// Key terms that characterise a set of articles (TF-IDF), excluding what we already searched for.
function keyTerms(lib, docs, skip, n = 5) {
  const counts = new Map();
  for (const d of docs) for (const s of d.sentences) for (const t of new Set(terms(s))) counts.set(t, (counts.get(t) || 0) + 1);
  const N = lib.docs.length;
  return [...counts].filter(([t, c]) => c >= 2 && !skip.has(t) && !/^\d+$/.test(t))
    .map(([t, c]) => [t, c * Math.log(N / (1 + (lib.index.get(t)?.length || 0)))])
    .sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);
}

// Other library articles mentioned inside these articles.
function mentioned(lib, docs, skipIds) {
  const found = new Map();
  for (const d of docs) {
    const text = " " + d.sentences.join(" ").toLowerCase() + " ";
    for (const [key, id] of lib.titleIndex) {
      if (skipIds.has(id) || found.has(id)) continue;
      if (text.includes(" " + key + " ") || text.includes(" " + key + ",") || text.includes(" " + key + ".")) found.set(id, lib.docs[id]);
      if (found.size >= 12) break;
    }
  }
  return [...found.values()];
}

const speakable = (s) => { const n = s.split(/\s+/).length; return n >= 7 && n <= 34 && !/[;{}<>|=]|\bhttps?:/.test(s); };

// Deep research on a topic. onStep(text) reports progress for the UI.
export async function deepResearch(query, { niche = null, onStep } = {}) {
  const lib = await library();
  onStep?.(`Searching ${lib.docs.length.toLocaleString()} articles${semanticReady() ? " by meaning and keywords" : ""}…`);
  const first = await hybridSearch(lib, query, 8, niche);
  if (!first.length) return null;
  const main = first[0].doc;
  const seenIds = new Set(first.map((r) => r.doc.id));
  const qTerms = new Set(terms(query));

  // Pass 2: follow leads.
  const leads = keyTerms(lib, first.slice(0, 4).map((r) => r.doc), qTerms, 4);
  onStep?.(`Following ${leads.length} leads: ${leads.join(", ")}…`);
  const more = [];
  for (const t of leads) for (const r of await hybridSearch(lib, `${query} ${t}`, 3, niche, seenIds)) { seenIds.add(r.doc.id); more.push(r); }
  const linked = mentioned(lib, [main, ...first.slice(1, 3).map((r) => r.doc)], seenIds).slice(0, 6);
  linked.forEach((d) => seenIds.add(d.id));
  onStep?.(`Reading ${first.length + more.length + linked.length} articles…`);

  // Pass 3: rank sentences.
  const focus = new Set([...qTerms, ...terms(main.title)]);
  const pool = [];
  const consider = (doc, weight) => doc.sentences.forEach((s, i) => {
    if (!speakable(s)) return;
    const ts = terms(s);
    const overlap = ts.filter((t) => focus.has(t)).length;
    let score = weight * (1 + overlap) / Math.sqrt(4 + ts.length);
    if (/\b(1[5-9]\d\d|20\d\d)\b/.test(s)) score *= 1.35;                   // dates make good stories
    if (/\d/.test(s) && /(%|percent|million|billion|trillion|\$)/i.test(s)) score *= 1.45;   // hard numbers
    if (i === 0 && doc === main) score *= 2.2;                               // the definition
    if (/^(It|This|These|They|He|She|Such)\b/.test(s) && i > 0) score *= 0.55;   // needs context
    if (doc !== main && overlap === 0) score *= 0.2;                         // other articles: only facts about the topic
    pool.push({ text: s, source: doc.title, score, index: i, doc });
  });
  consider(main, 3);
  first.slice(1).forEach((r, i) => consider(r.doc, 1.6 / (1 + i * 0.2)));
  more.forEach((r) => consider(r.doc, 1.0));
  linked.forEach((d) => consider(d, 0.9));
  pool.sort((a, b) => b.score - a.score);
  const facts = [], seenText = new Set();
  for (const f of pool) {
    const key = f.text.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 70);
    if (seenText.has(key)) continue;
    seenText.add(key); facts.push(f);
    if (facts.length >= 12) break;
  }
  const related = [...first.slice(1, 6).map((r) => r.doc), ...linked, ...more.map((r) => r.doc)]
    .filter((d, i, a) => a.findIndex((x) => x.id === d.id) === i).slice(0, 10);
  onStep?.(`Found ${facts.length} facts across ${new Set(facts.map((f) => f.source)).size} sources.`);
  return {
    query, main, related, facts, leads,
    summary: main.sentences.filter(speakable).slice(0, 2),
    sources: [...new Set([main.title, ...facts.map((f) => f.source)])],
  };
}

// Random topics for a niche, for the endless idea feed (least-used first).
export async function seedTopics(niche, used = new Set(), n = 30) {
  const lib = await library();
  const pool = lib.docs.filter((d) => (!niche || d.niches.includes(niche)) && !used.has(d.title) && d.sentences.length >= 3);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, n).map((d) => d.title);
}

export const wikiUrl = (title) => "https://en.wikipedia.org/wiki/" + encodeURIComponent(title.replaceAll(" ", "_"));
