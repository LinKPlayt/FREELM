# Video quality log

The record of video-quality improvements: what was found weakest, what changed, and how it was
measured. Read this before starting the next improvement so nothing is repeated, and add an entry when
one ships. Three areas only: **visuals**, **narration** and **scriptwriting**.

How each improvement is chosen: measure the current output first (real renders, real headlines, the
app's own planner on a spread of niches and types), fix the weakest thing a viewer would notice, compare
before and after on the same inputs, and add tests so it can't come back.

---

## v51 · Narration · Natural timing: pauses that follow the story

**Weakest area found.** Measured with the app's own voice (Kokoro, af_heart) on real scripts the app wrote, the
narration's rhythm was upside down. Every line was followed by the same 0.28 s (about 0.35 s heard, with the
voice's own lead-in and tail), while the voice paused 0.4–0.5 s at commas, colons and breaths *inside* a line.
So the biggest turns in the story (a new point, a new scene, the bottom line) got the shortest pauses, shorter
than a comma. Ideas ran together at every cut, and sentences dragged in the middle.

**Technique.** Research on read speech:
- Pause length rises with the strength of the boundary: comma < sentence < paragraph (Kentner et al. 2023).
- Sentence pauses are about 0.6 of paragraph pauses (ICPhS 1991).
- English readers pause after 94% of full stops but only 45% of commas, and briefly (BYU, 80 speakers).
- Listeners mainly notice pauses far from what the context leads them to expect (Google Research, Speech Prosody 2024).
- Pauses placed by fixed rules score poorly next to structure-based ones (ICPhS 1991).

The fix applies this hierarchy, scaled for brisk short-form narration:
- Between lines, the pause follows the relation to the next line.
- Inside a line, the voice's own long pauses are cut back to a narrator's, by removing silence only.

**What changed** (`app/make.js`):
- `gapAfter(line, next)`, the silence after a line:
  - 0.37 s when the thought carries on ("But", "So", "That"…)
  - 0.45 s for a new point
  - 0.53 s for the next item ("First", "Next", "Then", "Question 2"…) or after a question
  - 0.65 s, a beat, before the payoff, the bottom line, the comment question, a chapter card and the sign-off
  - Lines with a hold (the hook, the pre-payoff hold, chapter cards, quiz countdowns) keep their exact timing.
- `tighten(clip, text)`: each pause in a clip is matched to the punctuation it follows (the matching the captions
  already used, now shared as `punctuationPauses`) and cut to the narrator's length:
  - comma 0.24 s
  - colon, semicolon or dash 0.30 s
  - full stop, question or exclamation inside the line 0.42 s
  - a breath with no punctuation 0.34 s
  Silence is cut from the middle of the pause, with 5 ms fades. Captions are timed on the result.
- Scene cuts sit in the real pause: halfway, and at most 0.26 s before the voice, so the picture leads the word.
  Held moments cut exactly as before.

**Measured** (heard pauses, ms), same synthesized audio assembled old and new; Stablecoin "Your topic" script
and an explainer:

| Pause | Before | After |
|---|---|---|
| Comma inside a line | 340–520 | 240 |
| Colon ("Bottom line:", "Here's the catch:") | 390–460 | 300 |
| Breath with no punctuation | 430 | 340 |
| Full stop inside a line | 350–500 | 350–420 |
| Next line carries on ("So here's what to do") | 340–360 | 430–450 |
| New point | 330–370 | 500–540 |
| Next item ("Next, add active income…") | 340 | 590 |
| Before the bottom line, comment question, sign-off | 340–410 | 710–780 |
| Hook and other held moments | 640–690 | unchanged |
| Length | 38.03 s, 27.34 s | 37.92 s, 28.35 s |

Loudness unchanged (explainer −15.2 LUFS before and after). Real renders of an explainer and a quiz confirmed
the quiz countdown timing is unchanged.

**Tests.** `tests/web/logic.mjs` → "Logic: narration rhythm (v51)": the pause hierarchy and held lines; `tighten`
on synthetic speech (a 0.6 s comma pause becomes 0.24 s, a breath 0.34 s, nothing else changes).

---

## v50 · Scriptwriting · The newsroom: news lines a newsreader would say

**Weakest area found.** News reels (also used by Auto, Plan my week and the market recap's "In the news"
line) read feed headlines aloud almost verbatim. On the 72 real headlines in the day's data snapshot:

- **Teasers with no payoff.** "Josh Brown says the breakout potential in *this stock* is staring
  investors in the face" (the stock is never named), "Anthropic's IPO poses *this big risk*…", "Thursday's
  big stock stories: *What's likely to move the market*…", numbered lists that never give their items.
- **Fragments.** The 18-word cut removed verbs: "Big bets against AI debt, from CoreWeave to Oracle and the
  Mag 7." (the source: "…could soon hit the ETF market").
- **Broken sentences in summary lines.** Splitting at every full stop turned "…to seek U.S. approval to buy
  advanced AI chips" into "The rules require data centers in Southeast Asia to seek U.S."
- **Site furniture read aloud.** "Fed Poised to Raise Rates Further to Stem Inflation | Economy | U.S. News".
- **Pages that aren't news.** "Today's top high-yield savings rates: Up to 4.70% on Nov. 19, 2026",
  "Homes for Sale in New York and New Jersey", first-person essays ("I live in Alaska and built…", which
  sound like the narrator's own story), columns, wire corrections.

**Technique.** How broadcast writers turn print headlines into copy: a story must be complete when heard
once. A teaser clause ("— here's why") is cut; a teaser that hides the news itself ("this stock") is
resolved with the item's own summary sentence, or the story isn't told. Nothing is invented: only the
source's words are used. Sentences are split the way a reader would (not after "U.S.", "Inc." or an
initial), and a headline is never cut mid-clause.

**What changed.** `app/newswriter.js` (new): `sentencesOf`, `stripSource`, `seoPage`, `teaserIn`,
`spokenStory`. Used by `buildNews` and `buildMarket` (`app/script.js`) and for Wikipedia sentences in
`app/research.js`.

**Measured** on the same 72 real headlines (snapshot of Nov 19), old pipeline → newswriter:

| Defect in a spoken line | Before | After |
|---|---|---|
| Teaser left unresolved | 11 | 0 |
| Cut into a fragment | 8 | 0 |
| Site name or section read aloud | 1 | 0 |
| Rate table or listing read as news | 6 | 0 |
| Stories completed from their own summary | 0 | 4 |
| Stories skipped as untellable (were read) | 0 | 14 |

Examples, before → after:
- "Thursday's big stock stories: What's likely to move the market in the next trading session." →
  "The S&P 500 fell for a fifth consecutive session on Wednesday, notching its longest losing streak since June."
- "Anthropic's IPO poses this big risk to an already shaky stock market." → "…poses a big risk to an already
  shaky stock market. Investors are worried that a flood of equity issuance could overwhelm demand."
- "A sluggish housing market has held back Home Depot. Here's Cramer's advice on the stock now." → "…held back
  Home Depot. Cramer said Home Depot's latest earnings report strengthened his confidence in the retailer."

Found on the live feed right after release and added: a trailing fragment that promises the story
("The stock market could be headed for more turbulence. *How one investor is preparing.*"). A real question
("What happens if it's 3.5%?") is kept.

**Tests.** `tests/web/logic.mjs` → "Logic: the newsroom (v50)" (real headline cases and a whole news script);
`tests/web/fuzz.mjs` runs the newsroom functions on random and hostile text.

---

## Earlier (v47–v49), already done: don't repeat

- **Visuals.** The market recap opens on the day's board; each chart shows the month the narrator describes, with
  Today/This month boxes that pop in as each figure is spoken. Red for losses, green for gains everywhere (captions,
  big words, number pops, covers). An arrow graphic for "fell/rose N percent". Quizzes have TRUE/FALSE buttons,
  progress dots and a lit answer. Big-word scenes are centred with a quote or speech-bubble graphic. Slow push-in on
  charts and numbers; a graphic the next line keeps using carries on. A tapped CTA end card. Everything sits clear
  of TikTok/Reels/Shorts UI. Market covers show the real chart. The hook title never collides with a chart's
  words. Blueprint illustrations show line art instead of blank shapes. The chosen illustration style reaches the video.
- **Scriptwriting.** The market recap leads with what moved. Amounts in titles of works aren't charted or popped.
  Quizzes fit the chosen length. "Years ago" on timelines. The reel coach fits quizzes and market recaps.
- **Narration and audio.** Kokoro-82M natural voice; resampling, rumble filter, low-mid cut, presence lift,
  compressor, limiter; the mix is levelled to about −14 LUFS (measured −13.9 to −15.2 LUFS on five v49 reels).
  The narrator slows slightly for the payoff, the bottom line and quiz answers.

---

## Queue: weaknesses found, not fixed yet (highest impact first)

1. **"Your topic" scripts are encyclopedic.** Wikipedia sentences are read close to verbatim: two definitions in a
   row (Roth IRA: "…is an individual retirement account…", then "A Roth IRA can be an individual retirement account
   containing investments in securities…"), jargon ("taxed upon distribution"), and facts out of time order
   (Buffett: Wharton in 1947, then a book at age seven).
2. **Headlinese.** Even complete headlines are written for the eye (Title Case, no articles: "Japan exports in
   October surge 20.5%"). A spoken rewrite needs care to stay faithful.
3. **Pronunciation of new names.** Tickers and company names from the day's news (CoreWeave, AGNC, HELOC) aren't
   in the pronunciation list; check how the voice says them.
4. **Photo relevance.** Photos are matched by words in their titles; judge them by meaning (the on-device
   semantic model is already used by the fact check).
5. **Emphasis.** The voice gives every word the same weight; key numbers and contrast words ("but", "only",
   "never") could be stressed (Kokoro takes stress marks in its phonemes).
