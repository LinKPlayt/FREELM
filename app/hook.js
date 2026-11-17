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
];
const NICHE_QUESTIONS = {
  crypto: "Would you put your own money into this? Tell me in the comments.",
  investing: "Do you invest in this already, or are you just starting? Tell me in the comments.",
  "personal finance": "Did you already know this? Tell me in the comments.",
  economy: "Are you feeling this in your own wallet? Tell me in the comments.",
  "side hustles": "Would you try this? Tell me in the comments.",
  "real estate": "Renting or buying right now? Tell me in the comments.",
};

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
    out.push({ text: rich ? `How did ${topic} build one of the biggest fortunes on earth? Here's the short version.` : `Who is ${topic}, and why does everyone know the name?` });
    return out;
  }
  const stake = STAKES.find(([re]) => re.test(topic))?.[1];
  const risk = content.find(([l]) => l.role === "risk" || /^The catch:/i.test(l.text));
  const num = content.find(([l]) => (l.role === "number" || /^By the numbers:/i.test(l.text)) && statFor(body(l.text)));
  if (stake) out.push({ text: `${stake} Here's how it really works.` });
  if (risk) out.push({ text: `${cap(topic)}: everyone talks about it. Almost nobody mentions the catch.`, payoff: risk[1], lead: "Here's the catch:" });
  if (num) out.push({ text: `${cap(topic)}: there's one number most people never hear. Stay for it.`, payoff: num[1], lead: "Here's that number:" });
  out.push({ text: `${cap(topic)}: most people never learn how it actually works. Here's the short version.` });
  return out;
}

const GENERIC_HOOK = /explained in|here's what it actually means|really means, in plain English|here's the quick version|Here's what it actually (means|does)/i;

// Applies the emotion layer to a finished script (once). Hand-written hooks (evergreen topics, ideas
// you typed) are kept; only the generic "X, explained" openings are replaced.
export function dramatize(script, { length = "standard", ctaKind = "follow" } = {}) {
  if (!script?.lines?.length || script.dramatized) return script;
  script.dramatized = true;
  const lines = script.lines, hook = lines[0];
  const deep = length === "deep" || length === "full" || script.deep;

  // 1. The hook. A promise ("the catch", "one number") is only made if a later line keeps it.
  if (["custom", "idea"].includes(script.kind) && GENERIC_HOOK.test(hook.text)) {
    const options = smartHooks(script);
    // Prefer a tease with a payoff (it keeps people to the end), then the stakes, then the rest.
    const best = options.find((o) => o.payoff != null && !deep) || options[0];
    if (best) {
      hook.text = best.text; hook.analysis = null;
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
  // 3. Pacing: the hook is delivered with a little more energy, then a beat; a beat before the payoff.
  hook.pace = hook.pace || 1.05;
  hook.hold = Math.max(hook.hold || 0, 0.3);
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
      : QUESTIONS.find(([re]) => re.test(topic))?.[1] || NICHE_QUESTIONS[script.niche] || NICHE_QUESTIONS["personal finance"];
    lines.splice(outro, 0, { text: q, visual: "", kind: "media", chart: null, question: true, optional: true });
  }
  return script;
}

// Words worth a colour in the captions: figures, money and words that carry feeling.
export const EMPHASIS_UP = /^(\$?\d[\d,.]*%?[kmbt]?|free|grow|grows|growth|wealth|rich|richest|save|saves|savings|earn|earns|profit|win|double|doubles|millions?|billions?|trillions?|best|safe|secret|tax-free|compound|compounds)$/i;
export const EMPHASIS_DOWN = /^(never|lose|loses|lost|loss|crash|crashed|crashes|debt|risk|risky|catch|zero|broke|scam|fraud|fail|failed|mistake|wrong|fees?|interest|penalty|danger|warning|collapse|collapsed|stop|nobody|worst|recession|inflation)$/i;
export function emphasisOf(word) {
  const w = word.replace(/^[^\w$]+|[^\w%]+$/g, "");
  if (!w) return 0;
  if (EMPHASIS_DOWN.test(w)) return -1;
  if (EMPHASIS_UP.test(w)) return 1;
  return 0;
}
