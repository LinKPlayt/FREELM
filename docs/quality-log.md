# Video quality log

The record of video-quality improvements: what was found weakest, what changed, and how it was
measured. Read this before starting the next improvement so nothing is repeated, and add an entry when
one ships. Three areas only: **visuals**, **narration** and **scriptwriting**.

How each improvement is chosen: measure the current output first (real renders, real headlines, the
app's own planner on a spread of niches and types), fix the weakest thing a viewer would notice, compare
before and after on the same inputs, and add tests so it can't come back.

---

## v63 · Scripts · Openings that say something

**How it was found.** The opening line of every "Your topic" script for 34 common finance subjects, as viewers hear
it: after `dramatize()` replaces the generic opener with one of `smartHooks()`'s.

**Weakest area found.** 17 of 33 openings were fill-in-the-blank templates:
- "X: most people never learn how it actually works. Here's the short version." (8);
- "X: there's one number most people never hear. Stay for it." (5);
- "X: everyone talks about it. Almost nobody mentions the catch." (4).

A channel posting daily would open most videos with the same three sentences. They also held back the one concrete
thing they had: the number tease knew the number. And 9 of the 14 hand-written "stakes" openings ended with the
same "Here's how it works."

**Technique.** Short-form openings hold viewers with something specific in the first second: a concrete stake, a
real tension, a striking figure. A vague promise does less. Nothing may be invented, so everything comes from the
script's own lines, or from the hand-written, true and general stakes lines.

**What changed** (`app/hook.js`):
- Stakes lines for 27 more subjects people search for: bonds, stock splits, hedge funds, annuities, day trading,
  HSAs, HELOCs, CDs, dollar-cost averaging, venture capital, REITs, short selling, Social Security, payday loans,
  mutual funds, Treasury bills, gold, net worth, savings accounts, credit unions, minimum wage, GDP,
  hyperinflation, bank runs, bubbles, crypto, ETFs. All true and general, with no figures. "Inflation" no longer
  catches "hyperinflation".
- The number opening says the number first: "$9.9T. That's a 401(k) figure most people never hear." Only when the
  figure is striking (billions, trillions) or the subject has no stakes line: "2%" or "$50M" from a side detail
  made a weaker opening than the stakes. It says "figure", because "a Social Security number" is something else.
- The catch tease is set up with the subject's stakes: "Stablecoins are built to feel as safe as a dollar. But
  there's a catch."
- Subjects with nothing specific get one of several openings, picked by a hash of the subject (FNV-1a), each
  promising what the next line gives. So do catch teases without stakes, and the stakes lines' tails.

**Measured.**

| | Before | After |
|---|---|---|
| 34 common subjects (tuning set): specific openings | 16 of 33 | 33 of 33 |
| … template openings | 17 | 0 |
| 22 fresh subjects never looked at: specific openings | 0 of 17 | 2 of 18 |
| … template openings | 17 (one sentence used 13 times) | 16 (no sentence more than 5 times) |

The honest reading: specific openings come from a hand-written table, so they reach the common subjects people are
likely to type but not the long tail of the 20,038-article library. There, the change is variety, not
specificity. A general opening writer that adds nothing untrue would need language generation beyond the on-phone
model. "$9.9T." is spoken "nine point nine trillion dollars".

**Tests.** `tests/web/logic.mjs`, "hooks that open on something specific (v63)":
- the number first;
- a small figure doesn't beat the stakes;
- the catch set up with stakes;
- never "a Social Security number";
- the openings vary.

The v28-era catch test now accepts "a catch".

---

## v62 · Narration · The music ducks under the voice like a broadcast mix

**How it was measured (new).** The mix was split into its parts on real narration. 42 synthesized lines were laid
out as six reels with a reel's gaps and levelled as the app does. Each got the app's own music in five moods
(lofi, upbeat, cinematic, calm, suspense) and went through the app's `mix()`. The voice's share is known exactly,
so the music's share is the rest. Measured in 20 ms frames:
- the voice-to-music ratio while speaking, the worst tenth of it, and the first 160 ms of each phrase;
- how far the music dips under speech, and its swings of 3 dB or more per minute (pumping);
- intelligibility, by extended STOI against the clean voice, and Whisper;
- loudness, by EBU R128 on a full render.

**Weakest area found.**
- The music barely made room: on average only 2.7 dB quieter under speech than in the pauses.
- The quietest tenth of the speech sat just 2–6 dB above it (cinematic 2.1 dB).
- The start of a phrase was worst (cinematic, worst tenth: 0.6 dB).

The ducking followed a trailing quarter-second average of the voice, so the music dipped only after a word had
begun, and it rose and fell around every short pause (35.6 swings a minute).

**Technique.** Broadcast voice-over mixing: sidechain ducking with look-ahead (the bed dips just before the voice),
fast attack and slower release, holding through short gaps so it doesn't pump. Plus a dynamic EQ "carve" of the
music's consonant band while the voice is on.

**What changed** (`app/music.js`, `mix()`):
- Voice detection on 10 ms frames (within 34 dB of the loudest); gaps up to 0.5 s are bridged.
- The music's gain looks 80 ms ahead and goes down to −8 dB under speech (40 ms attack, about 350 ms release).
  Between lines, before the first and after the last, it's as loud as before, and it rises in the longer pauses
  (the beat before a payoff, the hold after the hook).
- While ducked, the music's 2.5 kHz band (RBJ band-pass, Q 0.8) is taken down a further ~7 dB in proportion to the
  duck.

**Measured**, the same voice and the same music, v61 → v62:

| | lofi | upbeat | cinematic | calm | suspense |
|---|---|---|---|---|---|
| Voice over music while speaking, median (dB) | 17.6 → 20.2 | 18.5 → 21.0 | 14.1 → 16.6 | 16.8 → 19.8 | 15.6 → 18.2 |
| … worst tenth (dB) | 5.5 → 9.2 | 6.5 → 9.6 | 2.1 → 5.5 | 4.8 → 8.5 | 3.5 → 7.0 |
| … first 160 ms of phrases, worst tenth (dB) | 4.3 → 8.4 | 5.0 → 8.7 | 0.6 → 4.7 | 3.5 → 7.8 | 2.2 → 6.1 |
| Extended STOI (intelligibility, 1 = clean) | 0.974 → 0.987 | 0.989 → 0.994 | 0.961 → 0.979 | 0.965 → 0.981 | 0.968 → 0.983 |

- Music swings of 3 dB or more: 35.6 → 26.2 a minute (what's left is mostly the music's own beat). A first
  version with a fast release had 27.3; the bridged gaps took it lower.
- Whisper: 0.54% word errors before and after. It isn't troubled by music at these levels, so it can't show the
  difference; extended STOI models human listeners.
- Loudness, the same Emergency Fund reel rendered with v61 and v62: −13.9 LUFS, LRA 4.5 LU and peak −0.9 dBFS
  both times. The voice carries the loudness; only the music moved.

**Tests.** `tests/web/logic.mjs`, "the music ducks under the voice like a broadcast mix (v62)":
- about 8 dB down under speech;
- the dip starts before the voice;
- it stays down through a short gap and recovers in a long pause;
- without music the voice is untouched, and the mix never clips.

---

## v61 · Scripts · The news editor: three different stories

**How it was found.** The news reel rendered in v60 told one story three times. Here, news scripts for all six
niches were written from two snapshots (morning and evening), and every story was judged by hand.

**Weakest area found.** 9 of 36 stories (25%) shouldn't have been there:
- **The same event again**, 4. The morning investing reel told the Anthropic IPO three times, and contradicted
  itself ("futures fall…", later "futures soar…", from different hours of the day). The evening ones: "Futures
  plunge…" and "S&P 500 and the Dow hit correction territory"; "Bitcoin drops…" and "Bitcoin sell-off…". The
  duplicate check compared words, and these share few.
- **Not news**, 3:
  - "Asure Software Salutes Small Business Saturday with Recruiting and HR Milestones";
  - "Bilt Rent Day December 2026: statement credit bonus, JetBlue status, and more";
  - "Sophie Keane… Named Global Champion at…".
- **Leftovers read aloud**, 2: "…to be contractors (1)."; "Watch US Economy: …".

**Technique, and a dead end.** Judging sameness by meaning was tried first. The on-phone sentence model (v52)
scored the duplicates 0.40–0.46 and pairs of different stories up to 0.46 (two Fed stories, two Social Security
stories), so no threshold separates them. What makes two headlines one story is the event. So it's read directly
(`eventKeys()` / `sameEvent()` in `app/newswriter.js`):
- the broad market moving: an index, "stocks", "futures" or "Wall Street", followed by a move;
- an asset moving: crypto, gold, oil, bonds, the dollar;
- a company or person at the centre: a name in both stories. A capitalised word counts only if it isn't an
  ordinary headline word, and only from a sentence-case headline (in Title Case, "Retreat" and "Global" are
  capitalised too). Names that appear in many unrelated stories (the Fed, Trump, the SEC) don't count, nor do the
  names in a roundup that lists everyone.

Also in `app/newswriter.js`:
- `notNews()`: press-release wording ("salutes", "celebrates", "named… champion", "wins… award", "webinar") and
  promotions that end "…, and more".
- `spokenStory()` drops a leading "Watch" / "Live news:" / "Video:" label, a trailing "(1)", and a trailing bare
  ticker list ("— INTU, ROST.", queue item 7).
- `buildNews()` (`app/script.js`) skips a story that is the same event as one already chosen; the higher-ranked
  one stays.

**Measured.**

| | Before | After |
|---|---|---|
| Bad stories in 12 news reels (36 stories, used for tuning) | 9 | 1 (a "US Economy:" show label) |
| … the same event again | 4 | 0 |
| … press releases and promotions | 3 | 0 |
| … leftovers read aloud | 2 | 1 |
| Held out: 4 reels from live feeds fetched later, with the snapshot blocked | no bad stories | unchanged (nothing good removed) |
| Held out: all 406 pairs of 29 live investing headlines, pairs called the same event | | 46: 45 right (11 takes on the Anthropic IPO; two takes on the Nasdaq's drop), 1 borderline ("prediction markets' outlook for stocks dims amid AI sell-off") |

Found on the way: the first version of the roundup check let "Here are Friday's biggest analyst calls: Anthropic,
SpaceX, Tesla, Apple, Netflix, MSG Rangers, UnitedHealth" collide with the real Rangers and UnitedHealth stories
(fixed). And my edit script wrote `\b` as a backspace character into 16 regular expressions, so nothing
matched until the file was scanned and fixed.

**Tests.** `tests/web/logic.mjs`, "the news editor (v61)": the nine judged pairs, press releases, leftovers, and a
news reel telling the Anthropic IPO once.

---

## v60 · Visuals · Graphics that say what the line says (and market recaps render again)

**How it was found.** Real renders of a news reel (investing) and an explainer (Emergency fund), frame by frame.

**Weakest area found.** The pictures contradicted or garbled the narration.
- **Rising charts for falling markets.** "Futures Fall as Trump Weighs…" opened on a rising chart; so did "Stocks
  fell for a fifth day" and "The Dow fell 1.1% while the Nasdaq rose". An illustration's main subject is the
  first concept in the line, and the market's own picture is a rising chart: "stocks / Dow / S&P" come before
  "fell", which is also on the weak-word list. Over 39 news and market lines that say something rose or fell,
  16 (41%) had a main picture going the other way.
- **Timelines that say something else.** "…Nasdaq suffers worst week since 2020" became a 1990 → 2020 history
  timeline ("6 YEARS AGO"). "Since 2020" is a comparison, not an event. Future and current years got timelines
  too ("in 2027", "December 2026"), which show nothing but TODAY.
- **Labels under the numbers.** 22 of 47 stat graphics (47%) in the app's own lines had a wrong label:
  - verbs and adverbs: "FEE SOUNDS TINY", "YEAR DOUBLES", "OFTEN MEANS PAYING", "ASSETS PROPORTIONATELY";
  - the next clause: "RATE FEARS WEIGH" under a bitcoin price, "ANTHROPIC'S DEBUT FAILED" under the Nasdaq's fall;
  - time frames: "DAY" for "The Dow Jones is at 49,097, down 2.2% on the day…". In a market recap that line is
    shown as a real chart, so this one only reached the screen in other reels' lines like it;
  - missed subjects: "ESTIMATED", "MID-", "HE", or none for "the average monthly Social Security benefit… was $1,551";
  - all three timelines gone wrong: "THIRD DOW S&P".

**What changed.**
- `app/illustrator.js`:
  - `moveOf()` reads which way the line says things moved; the first move word wins.
  - `artOptions()` swaps or drops pictures that contradict it: rising chart ↔ falling chart, arrows likewise; no
    rocket, trophy or thumbs-up on a fall; no bomb or thumbs-down on a rise.
- `app/visuals.js`, how a number's label is found. A label names what the number counts, so it's a noun phrase:
  - after the number, filler is skipped and the phrase stops at any verb, adverb or "per". If a new clause starts
    there ("as…", "while…", "so…"), or a verb other than an allocation verb ("goes to NEEDS", "invested in CDS"),
    nothing after the number names it.
  - before the number, the verb and filler next to it are skipped, and a date ("for November 2022"), then the
    noun phrase is taken.
  - a time frame or a pronoun is never a label; the sentence's subject is used instead, past a lead-in ("On the
    Chain:", "By mid-2003,"), or there's no label at all.
  - names containing a number stay whole ("401(K) PLANS", "S&P 500").
- Year timelines only for past years the line places something in. Not "since/than/until YEAR", and not this
  year or later.

**Measured.**

| | Before | After |
|---|---|---|
| Lines whose main picture goes against the move they describe (39 news and market lines, two snapshots) | 16 | 0 |
| Same, counting all 3 pictures | 22 | 0 |
| Wrong labels or misleading timelines on the app's own stat lines (47, used for tuning; 3 of them are market-recap index lines, drawn as charts) | 22 | 1 ("VALUE" for the VOC's dividends) |
| Same on held-out headlines (a snapshot taken 8 hours later; 16 stat graphics) | 11 | 1 ("CENTER CONSTRUCTION COSTS": the 3-word limit cut "data") |
| Held-out "Your topic" scripts (22 new topics; 8 stat lines) | unchanged except one label added | |
| Stat graphics with no label (no label rather than a wrong one) | 1 | 4 |

**Seen in a render.** The same three headlines, rendered with v59 and v60. Story 1 ("Futures Fall…") went from a
rising chart to a falling one. Story 3 ("…worst week since 2020") went from a 1990 → 2020 timeline labelled "THIRD
DOW S&P" to a newspaper with a falling arrow.

Examples, before → after:
- "DAY" → "DOW JONES", "NASDAQ", "S&P 500"
- "ESTIMATED" → "401(K) PLANS"
- "RATE FEARS WEIGH" → "BITCOIN"
- "OFTEN MEANS PAYING" → "DOWN PAYMENT"
- "SOCIAL SECURITY'S" → "COLA INCREASE"
- "MID-" → "VENTURE CAPITAL INDUSTRY"

The market recap's index lines show real charts rather than drawings or stat cards, so both fixes matter most for
news stories and explainers.

**Found on the way: market recaps didn't render at all (since v53).** Rendering a market recap to check the
labels, it died in its opening scene: `ReferenceError: pctTxt is not defined`. v53 removed the helper that writes
"▲ 1.2%" / "FLAT" while the market board and the live charts' Today / This month pills still used it. So from
v53 to v59, every market recap failed to render, after the encoder fell back through its other methods. So did
any news reel whose "Meanwhile, the S&P is down…" extra brought in a live chart. The end-to-end tests only
checked that market scripts get written; nothing drew their frames.
- Fix: the helper is back (`app/render.js`).
- Proof: drawing a board frame throws on v59 and works now. A full market recap renders again: the board, three
  live charts with their pills, the closing line and the end card, 39 s.
- Guard: a new test draws a frame of all 19 kinds of scene (board, live charts, every data graphic, kinetic
  words, quiz, answer, chapter, recap, illustration, end card, fallback) and fails on any error.

**Tests.** `tests/web/logic.mjs`, "graphics that say what the line says (v60)" and "every kind of scene draws (v60)".

---

## v59 · Scripts · "Your topic" scripts that use their research

**How it was found.** A real render first: a Federal Reserve reel, frame by frame, plus motion measured per
second. The visuals held up: the photo is sharp and framed, and the only still stretches are the text cards,
where the words appearing are the motion. The script was the weak part. So 34 "Your topic" scripts for common
finance subjects were written by the app's own pipeline (no rendering) and every line was read.

**Weakest area found.**
- **Research thrown away.** 401(k) and Home equity line of credit got no facts at all; ETF, REIT and Student
  loan got one. Their reels were a hook, maybe a definition, a tip and the end card. Causes:
  - The topic pattern ended in `\b`, which can't match after "401(k)"'s bracket, so no sentence was ever "about
    the 401(k)".
  - The ETF, REIT and HELOC articles call their subject "ETFs", "REITs", "HELOCs", so those sentences counted as
    off-topic.
  - HELOC's definition read "A home equity line of credit, is…" (a stray comma where "or HELOC" was removed),
    and at 34 words it was over the limit.
  - 401(k)'s definition was rejected as legalese for its tail ("…, as defined in subsection 401 of the U.S.
    Internal Revenue Code").
- **Wrong labels**, said aloud and shown as chips: 5 of the 19 labelled facts.
  - "Why it matters: in contrast, a few governments have used bitcoin…": the "In contrast," filter ended in
    `\b`, which never matches after a comma.
  - "The catch: …a risk-adjusted return" and "The catch: …thought to be low risk".
  - "By the numbers: Health savings account was true of virtually all…": "It was true of…" was rewritten with the
    topic's name.
  - A Swedish ISK rule as "Why it matters" for Capital gains tax.
- **Takeaways that don't fit**: 8 of 34. "Check the fees on anything you invest in" closed Social Security, Short
  selling, Day trading, Venture capital, Home equity line of credit, Certificate of deposit and Stock split;
  Ethereum got the investing tip.

**What changed** (`app/story.js`):
- `topicRe()`:
  - edges by lookaround, so "401(k)" matches;
  - it includes the topic's abbreviation from `topicAliases()`. An abbreviation counts only when the article
    itself uses it in capitals at least twice, never as a lower-case word, plain letters, 3–8 long.
- `tidy()` removes the stray comma before "is" and a trailing "as defined in…" clause. It only removes words,
  so the fact check still matches the source.
- `simplify()` may cut at ", where …"; the sentence that defines the topic may keep up to 28 words.
- The opener filter uses `(?!\w)`, so "In contrast," and "By contrast," are caught.
- `standAlone()` leaves "It is/was true, the case, likely, estimated…" alone.
- "Risk" in "risk-adjusted", "risk-free", "low risk", "risk management" isn't a catch.
- New vetted tips: Social Security, short selling, day trading, startups and venture capital, home equity loans,
  CDs, stock splits, compound interest, annuities. Ethereum and other coins join the crypto tips.

**Measured**, the same 34 topics, the app's own script writer, v58 → v59:

| | Before | After |
|---|---|---|
| Facts in the scripts | 92 (2.71 a script) | 102 (3.00) |
| Scripts with no facts | 2 | 0 |
| Scripts with at most one fact | 5 | 1 (Student loan: its article is mostly country sections, rightly skipped) |
| Wrongly labelled facts | 5 of 19 | 1 (the Swedish ISK line) |
| Takeaways that don't fit the subject | 8 | 0 |

Examples:
- 401(k): nothing → "A 401(k) plan is an employer-sponsored defined-contribution personal pension account." /
  contributions come out of paychecks and may be matched / why the pre-tax option attracts employees / $9.9
  trillion in 401(k) plans.
- Bitcoin: "Why it matters: in contrast, a few governments have used bitcoin in some capacity." → "The
  environmental effects of bitcoin are substantial."
- HSA: the garbled line → "Unlike a flexible spending account, HSA funds roll over and accumulate year to year if
  they are not spent."

One line got worse: Dollar cost averaging's broken Graham quote was replaced by a worked example out of context
("Changing the DCA period to every 4 weeks…").

**Also, seen in the new 401(k) render (visuals).** The key-number card counted up to "$9,900,000,000,000",
thirteen digits shrunk to fit, while the narrator said "$9.9 trillion". `StatBg.counter` (`app/graphics.js`) now
counts amounts of a million or more in the narrator's words: "$9.9 TRILLION", "21 MILLION", "$2.25 BILLION".
Smaller amounts stay in digits ("$1,550"). Compared on the same cards, old and new drawn side by side.

**Tests.** `tests/web/logic.mjs`, "\"Your topic\" scripts that use their research (v59)", including the counter's text. The fuzz test caught the
first abbreviation code turning a hostile topic's brackets into a broken regular expression; fixed before release.

---

## v58 · Narration · Captions in step with the voice, and a voice that lasts the sitting

**How it was measured (new).** Every word's true start was found by forced alignment (torchaudio's MMS aligner,
on the test machine only), on the same 200 real lines as v57, spoken and pause-tightened exactly as in a
reel. The app's own `timings()` was then run on those recordings and each caption word's start compared with
the truth. Word timings drive the word-by-word captions, the big-word scenes, the chart's Today / This month
pills and the number pops.

**Weakest area found.** Captions ran early and drifted.

| On 2,668 words | Before |
|---|---|
| Mean error | 127 ms |
| Words more than 100 ms off | 44% |
| Words more than 200 ms off | 19% |
| Worst | 1.2 s |
| Bias | captions 67 ms early |

Two causes:
- **Lengths by letters.** Within a phrase, words shared the time by letter count. "7,176" is five characters
  and two seconds of speech; "A.I." is four characters and two letter names. Letter counts track real word
  lengths with correlation 0.76.
- **Breaths ignored.** Only pauses at punctuation were used. When the narrator took a breath with no
  punctuation, every caption after it ran early by the length of the breath ("There's one number [breath]
  that tells you…": 0.3 s early for the rest of the line).

**Found on the way: the voice died after about five reels.** eSpeak's WebAssembly module sets eSpeak up again
on every run and never frees that memory. Measured, it aborted after about 70 line phonemizations (11 runs of
2,000 characters); v56 too. After that both voices fail for the rest of the sitting, because the classic voice
uses the same module. A reel phonemizes about 15 lines, so the fifth or so reel in one sitting, or a
"Make all" queue, lost its voice.

**What changed.**
- `app/tts.js`:
  - Each eSpeak run costs about 140 + the text's length out of roughly 23,000 (fitted on the measurements).
    The module is replaced when 8,000 is spent, and a run that fails anyway is retried once on a fresh module.
    Old modules are freed: 2,000 lines in a row ran without a problem, which would need gigabytes otherwise.
  - Cost: about 4 ms a line (60 lines in 944 ms against 686 ms).
  - `wordSounds()` sounds out all the words of a line in one eSpeak run (its input is a list).
- `app/make.js`:
  - `soundWeights()`: a word's share of the time comes from its sounds. About 57 ms a sound, plus 28 ms for a
    long vowel, 42 ms for a stressed syllable, 16 ms before a comma without a pause. Fitted by least squares on
    1,615 forced-aligned words. Correlation with real lengths 0.93, against 0.76 for letters; 0.92 on held-out
    lines. Falls back to letters if the sounds are missing or belong to an older version of the line.
  - `pauseBounds()`: every pause the voice makes, punctuation or breath, is matched to the word gap where it
    falls, by a small alignment (dynamic programming): pauses keep their order, a punctuated gap is preferred,
    and a pause that fits nowhere is left inside a word.
  - The audio itself is unchanged: pause tightening still uses the old matching.

**Measured**, same recordings, before → after:

| | Before | After |
|---|---|---|
| Mean error | 127 ms | 82 ms |
| Median | 84 ms | 48 ms |
| 90th percentile | 301 ms | 190 ms |
| Words more than 100 ms off | 43.7% | 25.4% |
| Words more than 200 ms off | 19.3% | 8.8% |
| Bias | 67 ms early | 11 ms early |
| Michael (a voice not used for fitting), 47 hardest lines (numbers, acronyms, headlines): mean | 229 ms | 157 ms |
| Same, words more than 200 ms off | 42% | 30% |

Of the two changes, the sounds do most of the work (letters → sounds alone: 43.7% → 27.9% of words more than
100 ms off); matching every pause takes it to 25.4%.

**Tried and dropped** (measured worse or no different):
- Snapping word boundaries to dips in loudness: 25.4% → 27.3%.
- Treating dash tokens ("--") as punctuation: no change.
- Retuning the alignment's two constants: within ±1%, so the first values were kept.

**Tests.**
- `tests/web/logic.mjs`, "captions in step with the voice (v58)":
  - a breath without punctuation;
  - two pauses, each at its own gap;
  - sound weights;
  - stale sounds aren't used;
  - batched word sounds.
- `tests/web/fuzz.mjs`:
  - 60 texts of 2,000 characters in a row (the old module died at 11);
  - word sounds for hostile text.

---

## v57 · Narration · Acronyms said right, British voices fixed

**How it was measured (new).** The weakest area was found by listening with a machine instead of guessing.
200 real lines the app writes (every news story and market line in the day's snapshot, every stakes and
stance line, every 4th explainer line and every 3rd quiz line) were spoken through the app's own path
(`speakable` → `kokoroPhonemes` → Kokoro, af_heart), transcribed by Whisper (small.en, faster-whisper) and
compared word by word with the script. Naturalness was scored with DNSMOS (P.808 and P.835). Both run on the
test machine only; the app gets no new dependency.

**Weakest areas found.**
- **"AI" was said "uh eye".** The acronym table spelled acronyms with spaces ("A I", "A P R", "A T M"), and eSpeak
  read a lone "A" as the article ("ə I"). Whisper heard "a ice", "our", "are a": "AI" came through in only 6 of 9
  lines, in the word finance news uses most. Spaced letters also gave every letter a full stress (choppy).
- **The British voices didn't work at all.** Emma, George and Fable asked eSpeak for "en-gb", a voice file this
  eSpeak build doesn't have (British English is "en"). It threw a bare number, the reel fell back to the classic
  voice, and the phone stayed on the classic voice for every reel after. The fuzz test only tried American voices.
- **Acronyms in compounds and possessives** ("FDIC-insured", "ECB's") skipped the table and were read as words
  ("ef-dick", "ekbz").

**Technique.** Kokoro v1.0 was trained on misaki's phoneme notation. In its own pipeline, acronyms are spelled
from letter names with light stress on every letter but the last (GDP is ʤˌidˌipˈi), and eSpeak's output is
converted by misaki's EspeakFallback table.

**What changed.**
- `app/script.js`: acronyms are written with dots ("E.T.F."), which the classic voice also reads as letters;
  compounds and possessives use the table too.
- `app/kokoro-text.js`:
  - `spellLetters()` spells dotted acronyms from letter names, with the stress mark before the vowel as in
    Kokoro's dictionaries; British letter names for British voices; plural and possessive endings.
  - A dotted acronym keeps its full stop only before a typical sentence opener, not before a name ("J.P. Morgan").
  - "a", "an" and "the" before an acronym get their unstressed forms ("ðɪ" before a vowel).
  - `toMisaki()` converts eSpeak IPA to misaki notation. **Measured neutral**: no change in Whisper errors, DNSMOS or
    F3 (below). It's kept so the spelled letters and the words around them use one notation, and because it
    stops symbols the model doesn't know (eSpeak's syllabic mark, « ») from being silently dropped.
  - British voices ask eSpeak for "en".
- `app/tts.js`: a phone the British-voice crash switched to the classic voice gets the natural voice back, once.

**Measured** on the same 200 lines, same voice, before → after:

| | Before | After |
|---|---|---|
| Word errors (Whisper) | 67 (2.42%) | 46 (1.67%), −31% |
| News lines | 6.1% | 3.9% |
| Acronyms heard right | 27/34 | 33/34 |
| "AI" heard right | 6/9 | 9/9 |
| Lines better / worse | — | 19 / 7 |
| Mean word confidence | 0.954 | 0.958 |
| DNSMOS P.808 / overall | 4.155 / 3.375 | 4.151 / 3.374 (no change; ±0.007) |
| British voice (Emma), 41 lines | crashed, classic voice | spoken; 4.3% errors, as the American voice on the same lines |

Found and fixed along the way:
- The first letter table put the stress before the consonant ("ˌpi"). "IPO" was heard as "IAPO" (2 of 6 right);
  with the stress before the vowel it's 6 of 6.
- "J.P. Morgan" got a full stop after "J.P." and was heard as "and yuppie".

**A claim that didn't hold.** I expected the American voices to lack an "r" in words like "experts" (eSpeak writes
the British "ɜː"). Measured on 12 words × 2 voices (lowest F3, Praat), the old audio was already r-coloured
(F3 about 1,800–2,000 Hz for Heart). The notation change moved F3 by −29 Hz and −13 Hz, which is noise. No
pronunciation improvement is claimed for it.

**Tests.** `tests/web/logic.mjs`, "the voice hears the notation it was trained on (v57)":
- the notation table;
- the British voices phonemize, with British vowels and letter names;
- acronym stress, articles, initials, possessives and compounds;
- every symbol sent to the voice is in its vocabulary.

`tests/web/fuzz.mjs` runs real eSpeak on hostile text for a British voice too.

---

## v56 · Scripts · Title Case headlines become sentences

**Weakest area found.** 32 of the day's 72 headlines (44%) are in Title Case (Yahoo Finance, Forbes, U.S. News).
News lines and their captions read "Fed Poised to Raise Rates Further to Stem Inflation": headline style, not speech.

**What changed** (`app/newswriter.js`): `sentenceCase()`, applied in `spokenStory()`.
- In a Title Case headline, a word is lowercased only when it's on a built-in list of common English and headline
  words; hyphenated pairs need both halves on it.
- Names (Bitcoin, Goolsbee), acronyms (FOMC), mixed-case brands (CoreWeave) and each sentence's first word keep
  their capitals.
- If more than two unknown capitalised words would remain, the headline is left as it was: half-converted reads
  worse than Title Case.
- "Cryptocurrency" joins the teaser nouns ("This Could Be the Best Cryptocurrency…").

**Measured** on the day's snapshot: 30 of 32 Title Case headlines are now sentences, e.g. "Bitcoin open interest
drops 20% as Ethereum and Solana slide further", "Fed's Goolsbee won't rule out larger rate increases as inflation
risks mount". 2 stay as they were. The 72-headline newsroom results are unchanged. The word list was tuned on this
day's headlines; the safety rule is what protects unseen ones.

**Tests.** "Title Case headlines are said in sentence case…" in `tests/web/logic.mjs`.

---

## v55 · Scripts · Plain words for formal ones

**Weakest area found.** Researched sentences keep Wikipedia's register: "generally not taxed upon distribution",
"individuals", "prior to", "utilized", "in order to". 5,071 of the on-phone library's 123,532 sentences (4.1%)
contain at least one such phrase; `simplify()` only trimmed structure.

**Technique.** The US federal plain-language guidelines' word list, limited to swaps that keep the meaning exactly.

**What changed** (`app/story.js`): `plainWords()`, run inside `simplify()`. It swaps:
- in order to → to; due to the fact that → because; in the event that → if; in excess of → more than
- prior to → before; subsequent to → after; subsequently → later
- approximately → about; numerous → many; utilize → use; commence → start; is/are able to → can
- obtain → get; assistance → help; sufficient → enough; individuals → people
- upon → on; whereby → in which; in addition to → besides

Capitals at the start of a sentence are kept. Ambiguous words ("purchase", noun or verb) are left alone.

**Measured** on 25 random library sentences: 21 read correctly at once. The 4 errors were fixed and are now
tests:
- "to be use" (an off-by-one);
- "people' implementation";
- "is got" (passive "obtained" is now left alone);
- "an about" ("an approximately" is now left alone).

**Tests.** "formal words become plain ones only where the meaning stays the same" in `tests/web/logic.mjs`.

---

## v54 · Scripts · Biographies about the person, not their relatives

**Weakest area found.** On Charlie Munger's real article, one of the four lines was "His grandfather, Thomas
Charles Munger, was a state representative and later a U.S. district court judge…". The biography filter only
dropped "his father/mother/parents".

**What changed** (`app/story.js`): a sentence whose subject is a relative ("His/Her/Their" + grandparent,
parent, spouse, sibling, child, uncle, aunt, cousin, family) is left out of a person's events. "The son of
Howard Buffett, he developed…" is about the person and stays.

**Measured** on the saved Munger article: the grandfather line → "Munger enrolled in the University of
Michigan, where he studied mathematics." Buffett's script is unchanged.

**Tests.** "a biography doesn't spend a line on a relative" in `tests/web/logic.mjs`.

---

## v53 · All three · Framed photos, truer biographies, spelled-out tickers

### Visuals: photos framed around their subject

**Weakest area found.** A photo wider than 0.72 (width/height) was shown whole, about 96% of the screen's width,
on a blurred copy of itself. That covers almost every photo the finder returns, because 3:4 portrait shots fall
in that range too. The camera then drifted in a random direction. On 12 real photos (Fed buildings, Warren
Buffett, a credit card, bitcoin, gold, the stock exchange, an EV charger…), the photo filled 54% of the screen
on average, and only 1 filled it.

**Technique.** Automatic cropping as in smartcrop.js: score a small copy of the photo for detail (edges), colour
and skin tones; crop where the interest is; size the photo by how much it can be enlarged while staying sharp.
Plus two rules from photography:
- **Headroom:** a subject at the top of the frame gets room under the title.
- **Motivated camera moves:** the camera moves toward the subject, not just anywhere.

**What changed** (`app/render.js`):
- `interestOf()` scores a photo's interest; `bestWindow()` finds the crop that keeps the most of it.
- `ImageBg` sizes each wide photo:
  - as big as it stays sharp (≤ 1.6x),
  - while keeping ≥ 85% of the interest in view,
  - filling the screen when it nearly does.
- Tall photos are cropped where the subject is.
- Top-heavy subjects get set lower; the close-up never crops the top of the subject.

**Measured** on the same 12 photos:

| | Before | After |
|---|---|---|
| Average share of the screen the photo fills | 54% | 73% |
| Photos filling the whole screen | 1 | 3 |
| Photos filling ≥ 88% of it | 1 | 5 |
| Largest enlargement | — | 1.6x |
| Interest kept in view | — | 81–100% |
| Camera | random direction | toward the subject, headroom kept |

The two tiny photos (≤ 632 px) stay as they were.

### Scripts: one definition, lives in time order, pronouns that agree

**Weakest area found.**
- **A second definition.** Roth IRA read "…is an individual retirement account…" and then "A Roth IRA can be an
  individual retirement account containing…". The one-definition rule only knew "is/are/was/were".
- **Time order.** Buffett's library book "at age seven" came after Wharton "in 1947": ages had no year.
- **A factual error.** Charlie Munger's script said "Munger was a Pasadena native who had been Munger's sister's
  roommate". `standAlone()` turned any leading "She" into the subject's surname, and here "She" meant his wife.

**What changed** (`app/story.js`, `app/research.js`, `app/script.js`):
- **Definitions:** "can be", "may be", "is also" and "can also be" count as definitions.
- **Time order:**
  - the birth year is read from the article's opening "(born August 30, 1930)" or a life span "(1924 – 2023)";
  - well-known people come from the on-phone library, whose text has no brackets, so `birthYear()` reads it
    from Wikipedia's short description ("American investor and philanthropist (born 1930)") with one small
    request. The first real render exposed this: the unit test had passed while the reel was still out of order;
  - `eventYear()` dates "at age seven", "at the age of 11", "aged 19" and "when he was 11" from it.
- **Pronouns:**
  - `composeStory` works out the article's pronoun for its subject;
  - `standAlone()` only renames a pronoun that matches it;
  - a mismatched one stays tied to its own sentence, so it's dropped when that sentence is.

**Measured:**
- Roth IRA: the duplicate definition is gone; the slot went to a researched fact.
- Buffett: age seven (1937) now comes before 1947, confirmed in a real render (the childhood line even gets a
  baby photo of Buffett, framed on his face).
- The Munger sentence about his wife is no longer produced, while every legitimate line matches v52 (a
  regression found and fixed along the way: the filter that picks a life's events must pass the pronoun too).

### Narration: tickers and acronyms the voice read as words

**Weakest area found.** The phonemizer spells vowel-less all-caps tokens well (CNBC, MSFT, XRP) but reads
unsayable ones that contain a vowel as words. In today's headlines and common tickers:
- AGNC → "agnk"
- USDS → "usds"
- TSLA → "teesla"
- AMZN → "amzen"
- AAPL → "ahpul"
- IEMG → "eemg"

**What changed** (`app/script.js`): `unsayable()` flags an all-caps token as unsayable when it has:
- no vowel;
- three or more consonants in a row (except English onsets like STR);
- an ending English words don't have.

`speakable()` spells such tokens with dots ("A.G.N.C."), and only when they contain a vowel. That form is read
as one acronym with every letter's name: with spaces, "A" became the article "a"; with hyphens, a final A was
reduced to "uh". Real words (NOT, STOP, NASA, FICO, REIT, HELOC) are unchanged.

**Measured** on 32 real tokens, phonemes before → after:
- 6 now correct: AGNC, USDS, TSLA, AMZN, IEMG, GOOGL (now spelled).
- 2 unchanged in letters, stress only: OKX, NVDA.
- 1 edge case left: AAPL's doubled A.
- 23 unchanged.

**Also.** A column writer's byline before a headline ("Peterson: The Fed's chairman sees…", seen in the live feed)
is dropped when neither the rest of the headline nor the summary mentions it ("Nvidia: Shares jump…" keeps it).
The 72-headline set is unchanged by it.

**Tests.** `tests/web/logic.mjs` → "Logic: framing, biographies and pronunciation (v53)":
- framing toward the detailed side;
- time order from ages;
- the pronoun rule;
- "can also be" definitions;
- ticker spelling;
- the byline rule.

---

## v52 · Visuals · Photos chosen by meaning

**Weakest area found.** With photos on (the default), the app planned eight real "Your topic" reels: Federal
Reserve, Warren Buffett, Mortgage, Credit card, Bitcoin, Inflation, Roth IRA and Gold. Every scene that showed a
photo was drawn exactly as in the video. 10 of the 23 photos shown were wrong for what was being said:
- Perth's skyline for "The Federal Reserve System is the central banking system of the United States" and for a
  mortgage line; another skyline for inflation.
- Shipping containers for "The Federal Reserve System is composed of several layers".
- A 19th-century Chinese banknote for a Roth IRA.
- A phone showing stock charts for "Gold is a chemical element".

Only 5 of the 23 showed the actual subject.

Two causes:
- **A logic bug.** When a line's own subject had already been searched by another line, the search was swapped
  for one of the niche's general visuals ("city skyline"), but the photo was still treated as the line's own.
- **Matching by words, not meaning.** A photo counted as relevant if its title contained the search words, and
  nothing checked it against what the line actually says. "Perth City Skyline" was a perfect match for "city skyline".

**Technique.** Judge photos the way an editor does, by what they show. The app already ships a small sentence
embedding model (all-MiniLM-L6-v2, 23 MB, used by deep research). Each candidate's title and tags (cleaned of file
names, catalogue numbers and camera codes) are compared by meaning with the line, and with the topic (a photo of
Warren Buffett fits any line of a video about him). An editing rule from film is added too: no two shots of the
same subject back to back.

**What changed:**
- `app/media.js`:
  - `describe()` cleans a photo's title and tags.
  - `rank()` sorts by meaning when it's available.
  - `MediaFinder` takes a judge. A photo is relevant at cosine ≥ 0.36, or ≥ 0.30 when the search was the line's
    own subject.
  - The same photo is never used twice, including duplicate listings and "(cropped)" copies.
- `app/ai/semantic.js`: `loadEmbedder()` / `releaseEmbedder()` load the model alone, on demand (775 ms on a
  laptop), and free it once the photos are chosen (unless semantic search is using it). The voice and the
  video get the memory back.
- `app/make.js` `attachPhotos`:
  - A line keeps its own subject.
  - In "Your topic" reels, a line that names the topic searches for it.
  - Photos are judged by meaning. Without the model, photos are judged by their words as before.
- `decideVisual`:
  - A clear match (≥ 0.52) is shown even where an illustration would otherwise be chosen.
  - Photos in a row only when each shows its own line's different subject; otherwise the second line gets its
    illustration.
  - A scene set to Photo by hand keeps it.

**Calibration** (the same searches, cosine to the line or topic):
- Photos of the subject itself: 0.47–0.86 (Federal Reserve banks 0.47–0.72, Warren Buffett 0.67–0.86, credit
  cards 0.60–0.84).
- Unrelated photos: 0.00–0.34 (city skylines for the Fed 0.00–0.13, stock charts on a phone for a line about a
  library book 0.21).
- Houses for mortgage lines: 0.29–0.32 (hence the lower bar when the search was the line's own subject).

**Measured**, same 8 topics, same day, v51 against v52; each shown photo labelled by whether it shows the
line's subject or the topic:

| | v51 | v52 |
|---|---|---|
| Photos shown | 23 | 15 |
| Show the subject | 5 | 13 |
| Generic but on-theme (a house for a mortgage) | 8 | 2 |
| Wrong or misleading | 10 | 0 |
| Share of shown photos that show the subject | 22% | 87% |
| Longest run of photos in a row | 4 (Gold: ingot, phone, Wall Street, NYSE) | 1 |

Where no photo fits (Inflation, Roth IRA), every scene now gets its on-topic illustration. A full render of the
Federal Reserve reel alternates two real Federal Reserve banks with illustrations.

**Tests.** `tests/web/logic.mjs` → "Logic: photos chosen by meaning (v52)":
- `describe()` cleaning.
- Ranking: the Fed photo beats "Perth City Skyline" even for the search "city skyline".
- The real model: a Fed line scores ≥ 0.5 against a Fed bank and ≤ 0.2 against a skyline; the model loads and
  is released.
- The no-repeat rule.

`tests/web/fuzz.mjs` runs `describe()` on hostile input.

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

1. **Headlinese.** Title Case is handled (v56); headline grammar remains (no articles, present tense: "Japan
   exports in October surge 20.5%"). A spoken rewrite needs care to stay faithful.
2. **Emphasis.** The voice gives every word the same weight; key numbers and contrast words ("but", "only",
   "never") could be stressed (Kokoro takes stress marks in its phonemes).
3. **Names and tickers that read as words.** In the v57 run the remaining real errors in news are proper nouns and
   word-like tickers: IREN → "iron", LITE → "light", VanEck → "van act", Loosdog, Goolsbee → "Goolsby". Ticker
   context (a list of all-caps tokens) could tell a ticker from a word.
4. **Captions on the hardest lines.** Headlines full of numbers, tickers and names still have 21–30% of words
   more than 200 ms off (v58). eSpeak's sounds for a word on its own differ from how Kokoro says it in the line;
   splitting the line's own phonemes by word would be closer.
5. **Openings for the long tail (v63).** Most of the 20,038 library subjects still open on a (varied) template. A
   general opening writer that adds nothing untrue (from the definition's own words, say) is the next step.
6. **Literal pictures.** "Long-term habits build wealth" draws a hammer ("build"); a verb used figuratively still
   picks its literal object.
7. **"Your topic" leftovers (v59).**
   - Hedge fund opens on the wrong subject ("Hedge fund replication is…").
   - Day trading's definition is cut short ("…speculation in securities in.").
   - Worked examples are read out of context (Dollar cost averaging).
   - Local rules without a country name (Sweden's ISK) aren't caught.
   - Encyclopedia register remains ("is composed of several layers").
8. **"Your topic" jargon.** Formal words are now plain (v55), but technical terms remain ("distribution",
   "securitization"); explaining a term needs a source sentence that does.
9. **Photo supply.** Where no photo fits by meaning (Inflation, Roth IRA, a mortgage explainer), every scene is an
   illustration; other searches (the topic's Wikipedia image, related subjects) could find real photos that fit.
10. **A measuring tool in the repo.** The Whisper/DNSMOS (v57) and forced-alignment (v58) checks live outside the
   repository; adding them under `scripts/` would let every narration change be measured the same way.
11. **A review-editor timer.** `app/main.js` rechecks an edited line in a timeout that reads `state.plan.fact`
   after the plan can be cleared (an occasional uncaught error in the fuzz test). UI code, outside these three areas.

(Done: the same story told three times and ticker lists read aloud, v61. AAPL-like tickers, queue item 5 before v57: spelled letters now come from a table, so "A.A.P.L." keeps both
A's.)
