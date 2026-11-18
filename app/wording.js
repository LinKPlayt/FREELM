// The proofreader: makes sure every line reads and sounds right before the narrator says it.
//
//   checkWording(text) -> { text, fixes: ["…"], warnings: ["…"] }   one line, fixed where it's safe
//   proofread(script)  -> { fixed, warnings: [{ line, note }] }       every line of a script, in place
//
// Fixes are mechanical and never change a fact: spacing and punctuation, doubled words, "a" vs "an",
// capitals, common slips ("could of", "more then"), leftover citation marks, and written-only shorthand
// the voice would read badly ("e.g.", "and/or"). Anything that needs judgement is a warning instead.

const ABBR = /(?:^|\s)(?:e\.g|i\.e|etc|vs|approx|inc|corp|ltd|co|jr|sr|mr|mrs|ms|dr|st|no|u\.s|u\.k|a\.m|p\.m|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.$/i;
// Doubled words that are correct English ("had had", "that that").
const OK_TWICE = new Set(["had", "that", "is", "do", "very", "bye", "so", "really", "far", "long", "more", "many", "ha", "no"]);
// Words that start with a vowel letter but a consonant sound ("a unit"), and the reverse ("an hour").
const A_BEFORE = /^(uni|use|usu|usa|uti|ure|eu|ewe|one|once|ubiq|u\.s|ufo|uk\b|u-)/i;
const AN_BEFORE = /^(hour|honest|honou?r|heir|herb\b)/i;
// Letters said with a vowel sound first: "an ETF", "an S and P", "an FHA loan".
const VOWEL_LETTER = /^[AEFHILMNORSX]/;
const COUNT_NOUNS = "people|investors|companies|banks|options|jobs|years|months|days|workers|customers|homes|houses|loans|accounts|stocks|funds|coins|dollars|steps|mistakes|choices|bills|cards";

function article(word) {
  // The article that fits how `word` is said, or null when unsure.
  const w = word.replace(/^["“'(]+/, "");
  if (!w) return null;
  if (/^\d/.test(w)) {
    // 8, 11, 18, 80–89, 800… and 8,000 start with a vowel sound.
    const n = w.replace(/,/g, "").match(/^\d+/)[0];
    return /^8/.test(n) || (/^1[18]/.test(n) && (n.length - 2) % 3 === 0) ? "an" : "a";
  }
  if (/^[A-Z]{2,5}s?\b/.test(w) && !/^[A-Z][a-z]/.test(w)) {
    // An acronym said letter by letter, unless it's said as a word (NASA, FICO…): keep what's there.
    if (/^(NASA|FICO|NATO|OPEC|REIT|SPAC|ROTH|NAFTA|UNESCO|AIDS|IKEA|ESPN?)\b/.test(w)) return /^[AEIOU]/.test(w) ? "an" : "a";
    return VOWEL_LETTER.test(w) ? "an" : "a";
  }
  if (AN_BEFORE.test(w)) return "an";
  if (A_BEFORE.test(w)) return "a";
  if (/^[aeiou]/i.test(w)) return "an";
  if (/^[a-z]/i.test(w)) return "a";
  return null;
}

export function checkWording(input) {
  let t = String(input || "");
  const fixes = [], warnings = [];
  const fix = (re, to, note) => { const before = t; t = t.replace(re, to); if (t !== before && !fixes.includes(note)) fixes.push(note); };

  // Written-only bits the voice can't say well.
  fix(/\s*\[(?:\d+|[a-z]|citation needed|note \d+|nb \d+|clarification needed|when\?|who\?)\]/gi, "", "removed a citation mark");
  fix(/\s*\((?:pronounced|listen|IPA|\/)[^)]*\)/gi, "", "removed a pronunciation note");
  fix(/\s*\(\s*\)/g, "", "removed empty brackets");
  fix(/\be\.g\.,?\s*/gi, "for example, ", "spelled out “e.g.”");
  fix(/\bi\.e\.,?\s*/gi, "that is, ", "spelled out “i.e.”");
  fix(/,?\s*\betc\.?(?=[\s.,;:!?]|$)/gi, ", and so on", "spelled out “etc.”");
  fix(/\bapprox\.?\s+(?=\$?\d)/gi, "about ", "spelled out “approx.”");
  fix(/(^|\s)~\s?(?=\$?\d)/g, "$1about ", "said “~” as “about”");
  fix(/\bw\/\s?(?=[a-z])/gi, "with ", "spelled out “w/”");
  fix(/\band\/or\b/gi, "or", "said “and/or” as “or”");
  fix(/\b(he|his|him|buy|yes|up)\/(she|her|sell|no|down)\b/gi, "$1 or $2", "said “x/y” as “x or y”");

  // Common slips.
  fix(/\b(could|should|would|must|might) of\b/gi, "$1 have", "fixed “could of” → “could have”");
  fix(/\balot\b/gi, "a lot", "fixed “alot”");
  fix(/\birregardless\b/gi, "regardless", "fixed “irregardless”");
  fix(/\bit's own\b/gi, "its own", "fixed “it's own” → “its own”");
  fix(/\b(more|less|fewer|better|worse|rather|other|bigger|smaller|higher|lower|greater|faster|slower|cheaper) then\b/gi, "$1 than", "fixed “then” → “than”");
  fix(/\bloose (money|your|value|it|everything|out)\b/gi, "lose $1", "fixed “loose” → “lose”");
  fix(/\bthere (own|money|savings|account|accounts|income|debt|credit|home|homes|kids|family)\b/gi, "their $1", "fixed “there” → “their”");
  fix(/\byour (welcome|going to|not|probably|already)\b/gi, "you're $1", "fixed “your” → “you're”");
  fix(new RegExp(`\\bless (${COUNT_NOUNS})\\b`, "gi"), "fewer $1", "fixed “less” → “fewer” for things you can count");

  // A comma between a list of names and its verb ("…or freelance worker, are terms for…").
  fix(/([a-z]), (are|is) ((?:common |general )?(?:terms?|names?|words?) (?:for|used|often))/g, "$1 $2 $3", "removed a comma before the verb");
  // Two articles in a row ("a the fund").
  for (let k = 0; k < 3; k++) fix(/\b(a|an|the)\s+(?:the|a|an)\s+/gi, (m, first) => first + " ", "removed a doubled article");
  // Doubled words ("the the").
  fix(/\b([A-Za-z']+)(\s+)\1\b/gi, (m, w, sp) => (OK_TWICE.has(w.toLowerCase()) ? m : w), "removed a doubled word");

  // A label that's been added twice ("So here's what to do: The takeaway: …").
  fix(/^((?:So )?Here's (?:the catch|that number|why it matters|what to do)|But here's the catch|Bottom line|The takeaway|Why it matters|The catch|By the numbers):\s+(?:(?:The takeaway|Why it matters|The catch|By the numbers|Bottom line):\s+)+/i, "$1: ", "removed a doubled lead-in");
  fix(/^((?:So )?Here's [^:]{3,30}|But here's the catch|Bottom line):\s+(?:however|but|also|and),?\s+/i, "$1: ", "removed a clashing linking word");

  // "a" or "an" to match the next word's sound.
  fix(/\b([Aa]n?)(\s+)([^\s]+)/g, (m, art, sp, next, at, all) => {
    // A capital "A" mid-sentence is a name or a grade ("Plan A", "Class A shares"), not an article.
    if (art === "A" && at > 0 && !/[.!?:]\s*$/.test(all.slice(0, at))) return m;
    const want = article(next);
    if (!want || want === art.toLowerCase()) return m;
    return (art[0] === "A" ? want[0].toUpperCase() + want.slice(1) : want) + sp + next;
  }, "fixed “a” / “an”");

  // Spacing and punctuation.
  fix(/\s+([,.;:!?%])(?!\d)/g, "$1", "fixed spacing before punctuation");
  fix(/([,;!?])(?=[A-Za-z])/g, "$1 ", "added a space after punctuation");
  fix(/([a-z]):(?=[A-Za-z])/g, "$1: ", "added a space after a colon");
  fix(/,\s*,+/g, ",", "removed a doubled comma");
  fix(/(?<!\.)\.\.(?!\.)/g, ".", "removed a doubled full stop");
  fix(/[,;:]\s*([.!?])/g, "$1", "removed stray punctuation before the end");
  fix(/([!?])\.+/g, "$1", "removed stray punctuation before the end");
  fix(/\s{2,}/g, " ", "removed extra spaces");
  t = t.trim();

  // Capitals: the first letter, and after a full stop (not after an abbreviation like "e.g." or "U.S.").
  if (/^[a-z](?![A-Z])/.test(t)) { t = t[0].toUpperCase() + t.slice(1); fixes.push("capitalised the first word"); }
  t = t.replace(/([.!?])(\s+)([a-z])/g, (m, p, sp, ch, at, all) => {
    if (p === "." && ABBR.test(all.slice(Math.max(0, at - 8), at + 1))) return m;
    if (!fixes.includes("capitalised a new sentence")) fixes.push("capitalised a new sentence");
    return p + sp + ch.toUpperCase();
  });
  t = t.replace(/(^|\s)i(?=\s|'|$)/g, (m, s) => { if (!fixes.includes("capitalised “I”")) fixes.push("capitalised “I”"); return s + "I"; });

  // Every line ends like a sentence, so the narrator's voice falls at the end.
  if (t && /[,;:\-–—]$/.test(t)) { t = t.replace(/\s*[,;:\-–—]+$/, "."); fixes.push("ended the sentence properly"); }
  else if (t && !/[.!?…"”')\]]$/.test(t)) { t += "."; fixes.push("added a full stop"); }

  // Things to look at (not changed automatically).
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words > 34) warnings.push(`long sentence (${words} words): hard to say in one breath`);
  const quotes = (t.match(/["“”]/g) || []).length;
  if (quotes % 2) warnings.push("a quotation mark isn't closed");
  if ((t.match(/\(/g) || []).length !== (t.match(/\)/g) || []).length) warnings.push("a bracket isn't closed");
  if (/\b(\w{4,})\b[^.]{0,40}\b\1\b/i.test(t.replace(/\b(that|this|with|from|have|your|they|their|more|than|when|what|which|money|about|there|these|those|will|into|also)\b/gi, ""))) warnings.push("the same word is used twice close together");
  if (/^(and|but|or|so|because)\b/i.test(t) && words < 5) warnings.push("reads like half a sentence");
  if (/[a-z]\/[a-z]/i.test(t) && !/https?:|www\.|\.com/.test(t)) warnings.push("a slash the narrator may read oddly");
  return { text: t, fixes, warnings };
}

// Proofreads every spoken line of a script in place. Hand-edited lines are proofread too (that's when
// slips happen); the original wording stays in `claim` for the fact check.
export function proofread(script) {
  const out = { fixed: 0, notes: [], warnings: [] };
  (script.lines || []).forEach((l, i) => {
    if (!l || typeof l.text !== "string" || !l.text.trim() || ["section", "recap"].includes(l.kind)) return;
    const r = checkWording(l.text);
    if (r.text !== l.text) {
      if (l.kind === "media" && !l.claim) l.claim = l.text;
      l.text = r.text; l.analysis = null; out.fixed++;
      out.notes.push(...r.fixes.map((f) => ({ line: i, note: f })));
    }
    out.warnings.push(...r.warnings.map((w) => ({ line: i, note: w })));
  });
  for (const l of script.extras || []) { if (l?.text) { const r = checkWording(l.text); l.text = r.text; } }
  return out;
}
