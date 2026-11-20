// Text -> phonemes for the natural voice (Kokoro), as kokoro-js does it: normalise numbers, money
// and abbreviations, keep punctuation (it shapes the intonation), and phonemize the words in between
// with eSpeak NG. The eSpeak used is the classic voice's (piper-phonemize), which runs on the page.
// Adapted from kokoro-js (Apache-2.0, hexgrad and Xenova).
function splitYear(word) {
  if (word.includes(".")) return word;
  if (word.includes(":")) {
    const [h, m] = word.split(":").map(Number);
    return m === 0 ? `${h} o'clock` : m < 10 ? `${h} oh ${m}` : `${h} ${m}`;
  }
  const year = parseInt(word.slice(0, 4), 10);
  if (year < 1100 || year % 1000 < 10) return word;
  const left = word.slice(0, 2), right = parseInt(word.slice(2, 4), 10), s = word.endsWith("s") ? "s" : "";
  if (year % 1000 >= 100 && year % 1000 <= 999) {
    if (right === 0) return `${left} hundred${s}`;
    if (right < 10) return `${left} oh ${right}${s}`;
  }
  return `${left} ${right}${s}`;
}
function money(m) {
  const unit = m[0] === "$" ? "dollar" : "pound";
  if (isNaN(Number(m.slice(1)))) return `${m.slice(1)} ${unit}s`;
  if (!m.includes(".")) return `${m.slice(1)} ${unit}${m.slice(1) === "1" ? "" : "s"}`;
  const [whole, frac] = m.slice(1).split("."), cents = parseInt(frac.padEnd(2, "0"), 10);
  return `${whole} ${unit}${whole === "1" ? "" : "s"} and ${cents} ${m[0] === "$" ? (cents === 1 ? "cent" : "cents") : cents === 1 ? "penny" : "pence"}`;
}
const decimal = (d) => { const [a, b] = d.split("."); return `${a} point ${b.split("").join(" ")}`; };
function normalize(t) {
  return t.replace(/[‘’]/g, "'").replace(/«/g, "“").replace(/»/g, "”").replace(/[“”]/g, '"').replace(/\(/g, "«").replace(/\)/g, "»")
    .replace(/[^\S \n]/g, " ").replace(/  +/, " ")
    .replace(/\bD[Rr]\.(?= [A-Z])/g, "Doctor").replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, "Mister").replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, "Miss")
    .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, "Mrs").replace(/\betc\.(?! [A-Z])/gi, "etc").replace(/\b(y)eah?\b/gi, "$1e'a")
    .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, splitYear)
    .replace(/(?<=\d),(?=\d)/g, "")
    .replace(/[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi, money)
    .replace(/\d*\.\d+/g, decimal).replace(/(?<=\d)-(?=\d)/g, " to ").replace(/(?<=\d)S/g, " S")
    .replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S").replace(/(?<=X')S\b/g, "s")
    .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (m) => m.replace(/\./g, "-")).replace(/(?<=[A-Z])\.(?=[A-Z])/gi, "-").trim();
}
const PUNCT = /(\s*[;:,.!?¡¿—…"«»“”(){}[\]]+\s*)+/g;
// Letter names, as Kokoro's own dictionaries write them. A spelled acronym ("E.T.F.", which is how the script
// writes them, see speakable) is built from these instead of going through eSpeak: eSpeak gives every letter
// a full stress (choppy) and can say a lone "A" as the article "uh". English stresses the last letter and
// keeps the rest light, as in "GDP" ʤˌidˌipˈi.
const LETTERS = { A: "A", B: "bi", C: "si", D: "di", E: "i", F: "ɛf", G: "ʤi", H: "Aʧ", I: "I", J: "ʤA", K: "kA", L: "ɛl", M: "ɛm",
  N: "ɛn", O: "O", P: "pi", Q: "kju", R: "ɑɹ", S: "ɛs", T: "ti", U: "ju", V: "vi", W: "dʌbəlju", X: "ɛks", Y: "wI", Z: "zi" };
const LETTERS_GB = { O: "Q", R: "ɑː", Z: "zɛd" };
const ACRONYM = /(?<![\w.])((?:[A-Z]\.){2,})(['’]?s\b)?/g;      // "E.T.F.s" and "E.C.B.'s" both end in s/z
export function spellLetters(letters, plural = false, lang = "a") {
  const ls = letters.replace(/[^A-Z]/g, "").split("");
  const name = (l) => { let n = (lang === "b" && LETTERS_GB[l]) || LETTERS[l]; if (lang === "b") n = n.replace(/i$/, "iː").replace(/u$/, "uː"); return n; };
  // The stress mark goes right before the vowel, as in Kokoro's dictionaries ("pˌi", not "ˌpi").
  const ph = ls.map((l, i) => name(l).replace(/[AIOQaeiouæɑɒɔəɛɜɪʊʌ]/, (v) => (i === ls.length - 1 ? "ˈ" : "ˌ") + v)).join("");
  if (!plural) return ph;
  return ph + ("HSX".includes(ls.at(-1)) ? "ᵻz" : "F" === ls.at(-1) ? "s" : "z");
}
// espeak(texts[], voice) -> phoneme strings, one per text.
export async function kokoroPhonemes(text, lang, espeak) {
  // Spelled acronyms are set aside (as private-use placeholders) and spelled from the letter table.
  const spelled = [];
  text = String(text).replace(/[\uE000-\uEFFF]/g, "").replace(ACRONYM, (m, letters, s, at, all) => {
    // An acronym that ends the sentence keeps its full stop ("…buy an E.T.F. Then…"), but not initials before a
    // name ("J.P. Morgan", "U.S. Steel"): a capital after it ends the sentence only when it starts a typical opener.
    const end = /^(?:\s*["”]?\s*$|\s+["“]?(?:The|This|That|These|Those|It|Its|It's|They|There|Then|But|And|So|Now|Here|What|Why|How|If|In|We|You|He|She|I|A|An)\b)/.test(all.slice(at + m.length));
    spelled.push(spellLetters(letters, Boolean(s), lang) + (end ? "." : ""));
    return ` \uE000${String.fromCharCode(0xE100 + spelled.length - 1)} `;
  });
  text = normalize(text);
  const parts = []; let last = 0;
  for (const m of text.matchAll(PUNCT)) {
    if (last < m.index) parts.push({ punct: false, text: text.slice(last, m.index) });
    if (m[0].length) parts.push({ punct: true, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ punct: false, text: text.slice(last) });
  // Words around a placeholder are phonemized on their own; the placeholder becomes its spelled letters.
  const split = parts.flatMap((p) => (p.punct ? [p] : p.text.split(/\s*\uE000([\uE100-\uEFFF])\s*/).map((x, i) =>
    (i % 2 ? { punct: false, ph: " " + spelled[x.charCodeAt(0) - 0xE100] + " ", letters: true } : { punct: false, text: x }))));
  const words = split.filter((p) => p.ph === undefined && !p.punct && p.text.trim());
  const said = words.length ? await espeak(words.map((p) => p.text), lang === "a" ? "en-us" : "en") : [];
  words.forEach((p, i) => { p.ph = toMisaki(fixEspeak(said[i] ?? "", lang), lang); });
  // Said apart from its acronym, "a" and "an" came out stressed ("ay") and "the" didn't become "thee" before a vowel.
  split.forEach((p, i) => {
    const prev = split[i - 1];
    if (!p.letters || !prev?.ph || prev.letters) return;
    const art = prev.text.match(/\b(an?|the)\s*$/i)?.[1].toLowerCase();
    // Only the article's own sounds at the very end change: eSpeak can join it to the word before ("fɔɹən").
    if (art === "the") prev.ph = prev.ph.replace(/ð[ˈˌ]?[əɪi]ː?$/, /^ [ˌˈ][AIOQiɛɑ]/.test(p.ph) ? "ðɪ" : "ðə");
    else if (art === "an") prev.ph = prev.ph.replace(/[ˈˌ]?[æəɐ]n$/, "ən");
    else if (art === "a") prev.ph = prev.ph.replace(/[ˈˌ]?(?:A|ə|ɐ)$/, "ə");
  });
  // Brackets were turned into « » for eSpeak; the model knows them as brackets (« » aren't in its vocabulary).
  return split.map((p) => (p.punct ? p.text : p.ph ?? (p.text.trim() ? "" : p.text))).join("")
    .replace(/ {2,}/g, " ").replace(/ +(?=[;:,.!?…])/g, "").replace(/«/g, "(").replace(/»/g, ")").trim();
}
// kokoro-js's clean-up of eSpeak's output (Apache-2.0, hexgrad and Xenova).
function fixEspeak(ph, lang) {
  ph = ph.replace(/ʲ/g, "j").replace(/r/g, "ɹ").replace(/x/g, "k").replace(/ɬ/g, "l")
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, " ").replace(/ z(?= |$)/g, "z");
  if (lang === "a") ph = ph.replace(/(?<=nˈaɪn)ti(?!ː)/g, "di");
  return ph;
}

// eSpeak IPA -> the notation Kokoro v1.0 was trained on (misaki). Kokoro's own pipeline looks words up in
// misaki's dictionaries and only falls back to eSpeak for unknown words, converting its output with this
// table (misaki/espeak.py, EspeakFallback, Apache-2.0): diphthongs as one symbol ("I" for "aɪ"), "ʤ"/"ʧ",
// "əɹ" for "ɚ", and for American voices no long-vowel marks. It also stops symbols the model doesn't know
// (eSpeak's syllabic mark, « ») from being silently dropped. Measured on 200 lines (v57), it changes neither how
// well the words are understood nor how natural they sound; it's here so the letter-spelled acronyms above, which
// are written in this notation, and the words around them speak one language.
// eSpeak here gives no tie marks, so a pair is merged wherever it appears; in eSpeak's English output these
// pairs are the diphthongs and affricates. misaki's syllabic-l rule ("ə^l") needs the tie, so it's left out.
const E2M = [
  [/ʔˌ?n\u0329/g, "ʔn"], [/aɪ/g, "I"], [/aʊ/g, "W"], [/dʒ/g, "ʤ"], [/eɪ/g, "A"], [/tʃ/g, "ʧ"], [/ɔɪ/g, "Y"],
  [/ɚɹ?/g, "əɹ"], [/ç/g, "k"], [/ɐ/g, "ə"], [/\u0303/g, ""],
];
export function toMisaki(ph, lang = "a") {
  const british = lang === "b";
  if (british) ph = ph.replace(/eə/g, "ɛː");                // before "e" becomes "A"
  for (const [re, to] of E2M) ph = ph.replace(re, to);
  ph = ph.replace(/e/g, "A");
  ph = ph.replace(/(\S)\u0329/g, "ᵊ$1").replace(/\u0329/g, "");
  if (british) ph = ph.replace(/iə/g, "ɪə").replace(/əʊ/g, "Q");
  else ph = ph.replace(/oʊ/g, "O").replace(/ɜːɹ/g, "ɜɹ").replace(/ɜː/g, "ɜɹ").replace(/ɪə/g, "iə").replace(/ː/g, "");
  return ph.replace(/o/g, "ɔ").replace(/ɾ/g, "T").replace(/ʔ/g, "t");
}
