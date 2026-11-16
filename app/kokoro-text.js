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
// espeak(texts[], voice) -> phoneme strings, one per text.
export async function kokoroPhonemes(text, lang, espeak) {
  text = normalize(text);
  const parts = []; let last = 0;
  for (const m of text.matchAll(PUNCT)) {
    if (last < m.index) parts.push({ punct: false, text: text.slice(last, m.index) });
    if (m[0].length) parts.push({ punct: true, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ punct: false, text: text.slice(last) });
  const words = parts.filter((p) => !p.punct && p.text.trim());
  const said = words.length ? await espeak(words.map((p) => p.text), lang === "a" ? "en-us" : "en-gb") : [];
  words.forEach((p, i) => { p.ph = said[i]; });
  const out = parts.map((p) => (p.punct ? p.text : p.ph ?? "")).join("");
  let ph = out.replace(/ʲ/g, "j").replace(/r/g, "ɹ").replace(/x/g, "k").replace(/ɬ/g, "l")
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, " ").replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, "z");
  if (lang === "a") ph = ph.replace(/(?<=nˈaɪn)ti(?!ː)/g, "di");
  return ph.trim();
}
