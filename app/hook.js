// The emotion layer: the last pass over a script before it's shown, so the video grabs attention,
// keeps a promise, and lands. It never adds a fact: it only chooses the opening, links a tease to its
// payoff, sets the narrator's pacing and ends on a question that invites comments.
//
//   hook      →  why should I keep watching? (stakes, a catch, or a number, from this script)
//   tease     →  the hook promises something ("the catch", "one number")
//   payoff    →  the line that keeps the promise opens with "Here's the catch:" / "Here's that number:"
//   beat      →  a short pause after the hook and before the payoff, like a human narrator
//   question  →  one line before the ending that asks the viewer something (comments help reach)

import { statFor } from "./script.js";

// True, general stakes for common subjects: why a viewer should care, in their terms.
export const STAKES = [
  [/credit (score|report|rating)|fico/i, "Your credit score quietly decides what you pay to borrow."],
  [/emergency fund|rainy day/i, "One surprise bill can knock your whole budget over."],
  [/inflation|cost of living/i, "Inflation is why the same paycheck buys less every year."],
  [/index fund|etf|exchange-traded/i, "Index funds are how a lot of ordinary people build real wealth."],
  [/stablecoin/i, "Stablecoins are built to feel as safe as a dollar."],
  [/bitcoin/i, "Bitcoin can swing more in a day than most stocks do in a month."],
  [/ethereum/i, "A lot of what happens in crypto runs on Ethereum."],
  [/mortgage|home loan|refinanc/i, "A mortgage is probably the biggest loan you'll ever take."],
  [/federal reserve|interest rates?|fed funds|federal funds|central bank/i, "Interest rates touch your loans, your savings and your job."],
  [/recession/i, "A recession can hit your job and your savings at the same time."],
  [/\broth\b/i, "A Roth IRA lets your money grow without tax on the way out."],
  [/401\s?\(?k|retire|pension/i, "What you do now decides how comfortable retirement feels."],
  [/student loan/i, "Student loans can follow you for decades."],
  [/credit card|\bapr\b/i, "Credit card interest can turn a small balance into a big one."],
  [/compound interest/i, "Compound interest can work for you, or against you."],
  [/dividend/i, "Dividends can pay you just for owning a stock."],
  [/budget/i, "Most people who feel broke don't know where their money goes."],
  [/\btax/i, "Taxes are one of the biggest bills you'll ever pay."],
  [/insur/i, "The right insurance is boring until the day it saves you."],
  [/stock market|stock exchange|s&p|nasdaq|dow jones/i, "The stock market moves your retirement money every single day."],
  [/\brent|landlord|tenant/i, "Rent is the biggest bill for millions of people."],
  [/debt|loan/i, "Debt costs more than most people realise."],
];

// A question for the comments, by subject or niche. Questions, never claims.
const QUESTIONS = [
  [/credit (score|report)|fico/i, "What helped your credit score the most? Tell me in the comments."],
  [/emergency fund/i, "Do you have an emergency fund yet? Tell me in the comments."],
  [/inflation/i, "Where do you feel prices rising the most? Tell me in the comments."],
  [/index fund|etf/i, "Do you already own an index fund? Tell me in the comments."],
  [/mortgage|rent|housing|home/i, "Renting or buying right now? Tell me in the comments."],
  [/budget/i, "Do you use a budget? Tell me in the comments."],
  [/\btax/i, "Do you set money aside for taxes? Tell me in the comments."],
  [/federal reserve|interest rates?|fed funds|central bank/i, "Are interest rates hitting your budget right now? Tell me in the comments."],
  [/dividend/i, "Do you own any dividend stocks? Tell me in the comments."],
  [/retire|401|ira\b|roth|pension/i, "How old do you want to be when you retire? Tell me in the comments."],
  [/student loan/i, "Are you paying off student loans right now? Tell me in the comments."],
  [/credit card|debt/i, "What's your plan for paying off debt? Tell me in the comments."],
  [/freelanc|side hustle|gig/i, "Do you have a side hustle yet? Tell me what it is in the comments."],
];
const NICHE_QUESTIONS = {
  crypto: "Would you put your own money into this? Tell me in the comments.",
  investing: "Do you invest in this already, or are you just starting? Tell me in the comments.",
  "personal finance": "Did you already know this? Tell me in the comments.",
  economy: "Are you feeling this in your own wallet? Tell me in the comments.",
  "side hustles": "Do you have a side hustle yet? Tell me what it is in the comments.",
  "real estate": "Renting or buying right now? Tell me in the comments.",
};

// A clear, defensible position for common subjects: what a careful adviser would say. Shown as
// "Bottom line:" before the takeaway, so the video says what it thinks, not just what's true.
export const STANCES = [
  [/stablecoin/i, "Stablecoins can be handy for moving money, but they're only as safe as whatever backs them."],
  [/bitcoin/i, "Bitcoin can rise fast and fall fast, so treat it as a risky bet, not a savings account."],
  [/ethereum/i, "Ethereum is a bet on a platform, not a sure thing, so treat it like any high-risk investment."],
  [/credit (score|report|rating)|fico/i, "A good score isn't about being rich; it's about paying on time and borrowing lightly."],
  [/emergency fund|rainy day/i, "Before you invest a dollar, build the safety net that keeps a bad month from turning into debt."],
  [/index fund|etf|exchange-traded/i, "For most people, a low-cost index fund held for years beats trying to pick winners."],
  [/^(inflation|inflation rate|consumer price index|cost of living)$/i, "A little inflation is normal; the danger is when your pay and your savings don't keep up."],
  [/mortgage|home loan/i, "The right mortgage is one you could still pay if life got harder, not the biggest one you qualify for."],
  [/student loan/i, "Student loans can pay off, but only borrow what your future paycheck can realistically handle."],
  [/credit card/i, "Credit cards are a great tool if you pay in full, and an expensive one if you don't."],
  [/federal reserve|interest rates?|fed funds|federal funds/i, "Rates change slowly, but they quietly decide what your debt costs and what your savings earn."],
  [/recession/i, "Recessions end; the people who come through best go in with cash saved and little debt."],
  [/\broth\b/i, "If you expect to earn more later, paying the tax now with a Roth is often worth it."],
  [/401\s?\(?k|retire|pension/i, "When it comes to retirement, starting early matters more than starting big."],
  [/budget/i, "A budget isn't a cage; it's a plan to spend on what you actually care about."],
  [/dividend/i, "Dividends are nice, but the total return matters more than the yield on its own."],
  [/compound interest/i, "Time does most of the work, so the earlier you start, the less you need to save."],
  [/stock market|s&p|nasdaq|dow jones/i, "Day to day the market is noise; over decades it has rewarded patience."],
  [/debt|loan/i, "Not all debt is bad, but high-interest debt is almost always worth paying off first."],
  [/insur/i, "Insure against what would ruin you, not every small cost."],
];

// Plain spoken English: contractions and everyday words. The meaning never changes (the original
// sentence stays in the line's `claim` for the fact check).
const SWAPS = [
  [/\bin order to\b/gi, "to"], [/\bprior to\b/gi, "before"], [/\bin the event that\b/gi, "if"], [/\bwith regard to\b/gi, "about"],
  [/\bthe majority of\b/gi, "most"], [/\ba number of\b/gi, "several"], [/\btypically\b/gi, "usually"], [/\bprimarily\b/gi, "mainly"],
  [/\bapproximately\b/gi, "about"], [/\bnumerous\b/gi, "many"], [/\bsufficient\b/gi, "enough"], [/\bcommonly\b/gi, "often"],
  [/\bfrequently\b/gi, "often"], [/\bsubsequently\b/gi, "later"], [/\butili[sz]e\b/gi, "use"], [/\butili[sz]es\b/gi, "uses"],
  [/\butili[sz]ed\b/gi, "used"], [/\bto purchase\b/gi, "to buy"], [/\bpurchased\b/gi, "bought"], [/\bindividuals\b/gi, "people"],
  [/^Additionally, /, "Also, "], [/^Furthermore, /, "Plus, "], [/\band therefore\b/g, "and so"],
  [/\bis a type of\b/g, "is a kind of"], [/\bare a type of\b/g, "are a kind of"],
  [/\b(is|are|was|were|does|do|did|has|have|had|could|should|would) not\b/gi, (m, v) => v + "n't"],
  [/\bcannot\b/gi, "can't"], [/\bwill not\b/gi, "won't"],
  [/\b(it|that|there|what|here) is\b/gi, (m, w) => w + "'s"], [/\b(they|you|we) are\b/gi, (m, w) => w + "'re"],
  [/\b(he|she) is\b/gi, (m, w) => w + "'s"], [/\byou will\b/gi, "you'll"],
];
export function naturalize(text) {
  let t = String(text || "");
  // Leave quotes alone (they're someone's exact words), and "it is" at the very end ("…as it is.").
  if (/["“”]/.test(t)) return t;
  for (const [re, to] of SWAPS) t = t.replace(re, to);
  // A contraction can't end a sentence or clause ("…who they are." not "…who they're.").
  return t.replace(/\b(it|that|there|what|here|he|she)'s(?=\s*(?:[.,;:!?]|$))/gi, "$1 is")
    .replace(/\b(they|you|we)'re(?=\s*(?:[.,;:!?]|$))/gi, "$1 are").replace(/\byou'll(?=\s*(?:[.,;:!?]|$))/gi, "you will");
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const clean = (t) => String(t || "").replace(/\s*#Shorts$/, "").replace(/\s+\(.*\)$/, "").replace(/\s*·\s*Part \d+$/i, "").trim();
const isContent = (l) => l.kind === "media" && !l.tip;
const LEAD = /^(Why it matters|The catch|By the numbers|The takeaway|Here's the catch|Here's that number|Here's why it matters|So here's what to do):\s*/i;
const body = (t) => t.replace(LEAD, "");
const relead = (text, lead) => { const b = body(text); return `${lead} ${/^(The|A|An|It|Its|They|Their|This|These|Many|Most|Some|In|On|When|If|As|For|There|Each|One|People|Lenders|Banks|Investors)\b/.test(b) ? b[0].toLowerCase() + b.slice(1) : b}`; };

// Opening lines built from this script. Each comes with the line that pays it off (if any).
export function smartHooks(script) {
  const topic = clean(script.topicTitle || script.title);
  if (!topic) return [];
  const lines = script.lines;
  const content = lines.map((l, i) => [l, i]).filter(([l, i]) => i > 0 && isContent(l));
  const out = [];
  if (script.person) {
    const rich = content.some(([l]) => /\b(billion|richest|wealthiest|net worth|fortune)\b/i.test(l.text));
    out.push({ kind: "person", text: rich ? `How did ${topic} build one of the biggest fortunes on earth? Here's the short version.` : `Who is ${topic}, and why does everyone know the name?` });
    return out;
  }
  const stake = STAKES.find(([re]) => re.test(topic))?.[1];
  const risk = content.find(([l]) => l.role === "risk" || /^The catch:/i.test(l.text));
  const num = content.find(([l]) => (l.role === "number" || /^By the numbers:/i.test(l.text)) && statFor(body(l.text)));
  // Short enough to land in the first two seconds (14 words or fewer).
  if (stake) out.push({ kind: "stakes", text: stake.split(/\s+/).length <= 10 ? `${stake} Here's how it works.` : stake });
  if (risk) out.push({ kind: "catch", text: `${cap(topic)}: everyone talks about it. Almost nobody mentions the catch.`, payoff: risk[1], lead: "Here's the catch:" });
  if (num) out.push({ kind: "number", text: `${cap(topic)}: there's one number most people never hear. Stay for it.`, payoff: num[1], lead: "Here's that number:" });
  out.push({ kind: "plain", text: `${cap(topic)}: most people never learn how it actually works. Here's the short version.` });
  return out;
}

const GENERIC_HOOK = /explained in|here's what it actually means|really means, in plain English|here's the quick version|Here's what it actually (means|does)/i;

// Applies the emotion layer to a finished script (once). Hand-written hooks (evergreen topics, ideas
// you typed) are kept; only the generic "X, explained" openings are replaced.
export function dramatize(script, opts = {}) {
  const { length = "standard", ctaKind = "follow" } = opts;
  if (!script?.lines?.length || script.dramatized) return script;
  script.dramatized = true;
  script.hookKind = { quiz: "quiz", news: "news", market: "market" }[script.kind] || "written";
  const lines = script.lines, hook = lines[0];
  const deep = length === "deep" || length === "full" || script.deep;

  // 1. The hook. A promise ("the catch", "one number") is only made if a later line keeps it.
  if (["custom", "idea"].includes(script.kind) && GENERIC_HOOK.test(hook.text)) {
    const options = smartHooks(script);
    // Prefer a tease with a payoff (it keeps people to the end), then the stakes, then the rest.
    const best = options.find((o) => o.payoff != null && !deep) || options[0];
    if (best) {
      hook.text = best.text; hook.analysis = null; script.hookKind = best.kind;
      if (best.payoff != null) {
        const p = lines[best.payoff];
        p.text = relead(p.text, best.lead); p.payoff = true; p.analysis = null;
      }
    }
  }
  // 2. Spoken, human lead-ins instead of labels.
  for (const l of lines) {
    if (l.kind !== "media" || l.payoff) continue;
    if (/^Why it matters:/i.test(l.text)) l.text = relead(l.text, "Here's why it matters:");
    else if (/^The catch:/i.test(l.text)) l.text = relead(l.text, "But here's the catch:");
    else if (/^The takeaway:/i.test(l.text)) { const b = body(l.text); l.text = "So here's what to do: " + (/^[A-Z][a-z]/.test(b) && !/^I\b/.test(b) ? b[0].toLowerCase() + b.slice(1) : b); l.payoff = l.payoff || !lines.some((x) => x.payoff); }
  }
  // 2b. Plain spoken English for every line of the story (lines you edit yourself aren't touched).
  const topicName = clean(script.topicTitle || script.title);
  for (const l of [...lines, ...(script.extras || [])]) {
    if (l.kind !== "media" || l === hook) continue;
    const t = naturalize(l.text);
    if (t !== l.text) { l.claim = l.claim || l.text; l.text = t; l.analysis = null; }
  }
  // The definition is said the way a person would explain it.
  const def = lines.find((l, i) => i > 0 && i <= 2 && l.kind === "media" && (l.role === "definition" || new RegExp("^(?:an?|the)?\\s*" + topicName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "s?\\s+(?:is|are)\\s+(?:an?|the)\\b", "i").test(l.text)));
  if (def && def.text.split(/\s+/).length <= 24 && !/^Simply put/.test(def.text) && !/^[A-Z]{2}|^[A-Z][a-z]+ [A-Z]/.test(def.text) && !script.person) {
    def.claim = def.claim || def.text; def.text = "Simply put, " + def.text[0].toLowerCase() + def.text.slice(1);
  }
  // The optional lines (bottom line, comment question) only go in if the video still fits its length:
  // about 2.5 spoken words a second, less a little for the pauses between lines.
  const MAX_S = { short: 30, standard: 45, long: 60 }[length] || 45;
  const wordsIn = () => lines.reduce((n, l) => n + String(l.text || "").split(/\s+/).filter(Boolean).length, 0);
  // Words a second: what this phone's narrator really manages (learned), a little under it to be safe.
  const wps = Math.min(3.4, Math.max(2, (opts.speechRate || 2.75) * 0.92));
  const fits = (text) => deep || wordsIn() + text.split(/\s+/).length <= MAX_S * wps - lines.length * 0.6;
  // 2c. A clear position before the takeaway ("Bottom line: …"), for subjects with a well-supported one.
  const stance = !script.person && !deep && script.kind !== "quiz" && length !== "short" && STANCES.find(([re]) => re.test(topicName))?.[1];
  if (stance && fits("Bottom line: " + stance) && !lines.some((l) => /^(bottom line|remember)\b/i.test(l.text))) {
    const tipAt = lines.findIndex((l, i) => i > 0 && l.kind === "media" && (l.tip || /^So here's what to do/.test(l.text)));
    const at = tipAt > 0 ? tipAt : lines.findIndex((l) => l.kind === "outro");
    if (at > 1) lines.splice(at, 0, { text: "Bottom line: " + stance, visual: "", kind: "media", chart: null, stance: true, optional: true });
  }
  // 3. Pacing: the hook is delivered with a little more energy, then a beat; a beat before the payoff.
  hook.pace = hook.pace || 1.05;
  hook.hold = Math.max(hook.hold || 0, 0.3);
  // A narrator slows down for what matters: the payoff, the bottom line and quiz answers land a touch slower.
  for (const l of lines) {
    if (l.pace) continue;
    if (l.stance) l.pace = 0.94;
    else if (l.payoff || l.kind === "answer") l.pace = 0.96;
    else if (l.kind === "quiz") l.pace = 1.0;
  }
  const payAt = lines.findIndex((l) => l.payoff);
  if (payAt > 1) lines[payAt - 1].hold = Math.max(lines[payAt - 1].hold || 0, 0.25);

  // 4. A question for the comments, right before the ending (not on short reels or deep dives, which
  //    end on a recap, and not when the ending already asks one). It's the first line cut if the reel runs long.
  const outro = lines.findIndex((l) => l.kind === "outro");
  if (outro > 0 && length !== "short" && !deep && ctaKind !== "comment" && !lines.some((l) => l.question)
      && ["custom", "idea", "evergreen", "news", "market"].includes(script.kind)) {
    const topic = clean(script.topicTitle || script.title);
    const q = script.person ? `What's the biggest lesson you'd take from ${topic}? Tell me in the comments.`
      : script.kind === "news" ? "Which of these matters most to you? Tell me in the comments."
      : script.kind === "market" ? "Buying, holding or waiting right now? Tell me in the comments."
      : QUESTIONS.find(([re]) => re.test(topic) || re.test(script.title || ""))?.[1] || NICHE_QUESTIONS[script.niche] || NICHE_QUESTIONS["personal finance"];
    if (fits(q)) lines.splice(outro, 0, { text: q, visual: "", kind: "media", chart: null, question: true, optional: true });
  }
  return script;
}

// Words worth a colour in the captions: figures, money and words that carry feeling.
export const EMPHASIS_UP = /^(\$?\d[\d,.]*%?[kmbt]?|free|grow|grows|growth|wealth|rich|richest|save|saves|savings|earn|earns|profit|win|double|doubles|millions?|billions?|trillions?|best|safe|secret|tax-free|compound|compounds)$/i;
export const EMPHASIS_DOWN = /^(never|lose|loses|lost|loss|crash|crashed|crashes|debt|risk|risky|catch|zero|broke|scam|fraud|fail|failed|mistake|wrong|fees?|interest|penalty|danger|warning|collapse|collapsed|stop|nobody|worst|recession|inflation)$/i;
// Money moves read by direction: "down 5.0%", "fell by 2%", "rose $300", "lost 40%". The direction word
// and the amount after it are red (a loss) or green (a gain), whatever the brand colour, and they keep that
// colour while spoken. A direction word with no amount after it ("down payment", "up to you") stays plain.
const DIR_DOWN = /^(down|fell|fall|falls|falling|dropped|drop|drops|slid|slides|slipped|sank|sinks|plunged|plunges|tumbled|tumbles|declined|declines|lower|lost|lose|loses|losing|shed|sheds|minus)$/i;
const DIR_UP = /^(up|rose|rise|rises|rising|gained|gain|gains|climbed|climbs|jumped|jumps|surged|surges|rallied|rallies|higher|added|adds|plus|grew|grows)$/i;
const AMOUNT = /^[-−+]?\$?\d[\d,.]*(%|[kmbt])?$|^(percent|points?)$/i;
const FILLER = /^(by|about|nearly|almost|over|roughly|around|another|a|an|more|than|some|just)$/i;
export function directionsOf(texts) {
  const bare = texts.map((t) => String(t).replace(/^[^\w$−+-]+|[^\w%]+$/g, ""));
  const out = bare.map((w) => (/^[-−]\$?\d/.test(w) ? -1 : 0));
  bare.forEach((w, i) => {
    const sign = DIR_DOWN.test(w) ? -1 : DIR_UP.test(w) ? 1 : 0;
    if (!sign) return;
    let j = i + 1; while (j < bare.length && j <= i + 3 && FILLER.test(bare[j])) j++;
    if (j >= bare.length || !AMOUNT.test(bare[j]) || /^(percent|points?)$/i.test(bare[j])) return;
    out[i] = sign; out[j] = sign;
    if (/^(percent|points?)$/i.test(bare[j + 1] || "")) out[j + 1] = sign;   // "down 5 percent"
  });
  return out;
}

export function emphasisOf(word) {
  const w = word.replace(/^[^\w$]+|[^\w%]+$/g, "");
  if (!w) return 0;
  if (EMPHASIS_DOWN.test(w)) return -1;
  if (EMPHASIS_UP.test(w)) return 1;
  return 0;
}
