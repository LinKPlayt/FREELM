# FREELM · ReelBot

**Automatic 30–45 second finance reels, made entirely on your phone.**

ReelBot is a web app you add to your iPhone home screen. Tap one button and it researches a
finance topic, writes a script, records an AI voiceover, finds openly licensed photos, composes
background music, and renders a vertical 1080×1920 video with word-by-word captions.

**Everything happens on the phone.** The video is never rendered, uploaded or stored on any
server. You save it to Photos or post it yourself from the share sheet.

**What it costs:** nothing. No API keys, no accounts, no paid services.

```
on your phone:  research ──► script ──► voice ──► photos ──► music ──► video ──► Save / Share
                RSS, Wiki     templates   Kokoro     Openverse   synth     canvas +
                                          (WASM)     Wikimedia             H.264 encoder
```

---

## Use it

1. Open **https://linkplayt.github.io/FREELM/** in **Safari** on your iPhone.
2. Tap **Share → Add to Home Screen** so it opens like an app.
3. Pick a niche and a type (or type **your own topic**), set your style (see the live preview), then tap **Make my reel**.
4. **Review it:** every scene is listed with its line and photo. Edit any line, remove scenes, add researched lines, or change a photo. Then tap **Make the video**, and keep the screen open while it renders.
5. Tap **Save / Share**. Choose **Save Video** to put it in Photos, or pick YouTube, TikTok or Instagram to post it.
6. Tap **YouTube**, **TikTok** or **Instagram** to copy a caption formatted for that platform, and paste it into your post. It includes the photo credits that the licenses require.

The **first reel** downloads the narrator's voice and the video tools once (about 92 MB for the
natural voices, or 63 MB for the Classic voice, so use Wi-Fi). After
that they stay on the phone.

The app is served by GitHub Pages straight from the `main` branch
(**Settings → Pages → Deploy from a branch → `main` / root**).

### Niches and types

- **Niches:** personal finance, investing, crypto, economy, side hustles, real estate
- **Types:**
  - **Explainer:** a timeless topic, such as compound interest or the 50/30/20 rule (35 built in)
  - **Today's news:** today's top 3 headlines for the niche, plus a "why it matters" line
  - **Market recap:** animated charts of the S&P 500, Nasdaq, Bitcoin and more
  - **Auto:** mixes all three and avoids making the same kind twice in a row
  - **Your topic:** type anything, such as "Roth IRA" or "Warren Buffett". The app finds the Wikipedia article and writes a script from its key sentences.

### The review screen

Turn it off under **Style → Review before making** if you'd rather go straight to the video.

| You can… | How |
|---|---|
| Rewrite any line, including the hook and the ending | Tap the text and type |
| Remove a scene | **Remove** |
| Add a line | **+ Add a line** offers the next researched fact first, then a blank line |
| Get a different free photo | **New photo** |
| Choose the photo subject | **Search…** and type what you want to see |
| Use your own photo | **My photo** opens your photo library; the photo stays on the phone |
| Start again with a fresh script | **New script** |

The length estimate updates as you edit. Reels are kept between 30 and 45 seconds: long scripts
are spoken slightly faster or trimmed, and short ones hold the end card longer.

### Visuals that match what's being said

Each scene's picture is chosen from the line being spoken, not from a fixed list:

- **Charts from the numbers in the script.** "Fifty percent goes to needs" becomes an animated
  50% ring labelled NEEDS; "50/30/20" becomes a split ring; "three to six months" a 3–6 month
  timeline; "doubles every seven years" a doubling curve; "twice as much" or "ten times" a
  comparison; "$1,000" a counter; a year like 1637 a timeline. Numbers written as words count too.
- **Illustrations for concepts.** 17 drawn icons (piggy bank, house, credit card, bank, shield,
  coins, rising and falling charts, shopping cart, hourglass, graduation cap, briefcase, scales,
  target, calendar, bitcoin, receipt), picked from the line's meaning and animated.
- **Photos only when they fit.** The photo search uses the line's own subject and ranks photos by
  how well their title and tags match it. A photo is used (including on the first scene and the
  cover) only when it matches what was searched for. Otherwise the scene gets an illustration instead of
  an unrelated stock photo.
- **Your call on every scene.** The review screen shows each scene's visual and lets you switch it
  between **Auto**, **Photo**, **Chart** (when the line has a number) and **Picture**.

### Scripts that tell a story

Every script, whatever the type, goes through the same storyteller before you see it:

- **A clear order.** What it is → how it works → a key number → why it matters (or the catch) →
  what you can do. Short lead-ins ("Why it matters:", "By the numbers:", "The takeaway:") link the points.
- **One plain definition.** The topic is defined once, near the start, by the sentence where it is
  the subject ("A credit score is…", not "A business credit score is…").
- **Only lines that make sense alone.** Sentences that start with "It", "This" or "these" are used only
  right after the sentence they point to. Jargon, trivia, lists, cut-off fragments, "however" contrasts
  and country-specific details (unless the topic is about that country) are left out, and repeats are cut.
- **People.** Who they are, what they're known for, then key events in date order. Facts about anyone
  else are never swapped in by the fact check.
- **News and markets.** Up to three distinct headlines, ordered so related ones sit together, with one
  line naming the thread that links them. Market recaps open and close to match the day ("flat" for
  tiny moves).
- **Always a takeaway.** If the research has no practical advice, a safe general tip for the topic closes the video.

### Hooks, tension and payoff

After the storyteller, every script gets an emotion layer (`app/hook.js`). It never adds facts:

- **A hook that gives a reason to stay**, built from the script: the stakes for the viewer, a catch,
  or a number to wait for. Hand-written hooks are kept; only generic "X, explained" openings are replaced.
  *Another hook* offers these first.
- **Promise and payoff.** If the hook promises the catch or a number, that line opens with "Here's the
  catch:" or "Here's that number:" and lands with a punch-in, a white flash and a soft hit.
- **Human pacing.** The hook is spoken a little faster, then a beat; another beat before the payoff.
- **Captions with feeling.** Money and growth words in green, risk words in red; the spoken word grows.
- **Plain spoken English.** Contractions and everyday words ("usually", not "typically"), and the
  definition said the way a person would ("Simply put, …"). Quotes are never touched, and the original
  sentence is kept for the fact check.
- **A clear stance.** Common topics get a well-supported "Bottom line:" before the takeaway.
- **Sound design.** A bass hit on the first frame; a riser, hit and camera shake into the payoff, with
  the music dropping away just before it; coins for money figures; a falling tone for risks; a bell for
  the takeaway; a bloop for the question; a sparkle on the ending. Music fades out at the end.
- **Moment labels.** THE CATCH, KEY NUMBER, WHY IT MATTERS, BOTTOM LINE, WHAT TO DO and YOUR TURN pop in under the title.
- **A question for the comments** before the ending (not on short reels, deep dives, or when the ending
  already asks one). It's the first line cut if the reel runs long.

### Illustrations drawn on your phone

When no photo fits a line, `app/illustrator.js` draws one: it reads what the line is about (mortgage → a
house, "crashed" → a falling chart, emergency fund → an umbrella; over 40 subjects), puts the main
subject big in the middle with two related ones beside it, and finishes it in an art style:

| Style | Look |
|---|---|
| Flat | soft gradient, clean shapes |
| Neon | synthwave sun and glowing grid |
| Paper cut | layered paper, cut-out shadows, grain |
| Blueprint | grid paper, outlines, measurement marks |
| Pop art | halftone dots, burst and thick outlines |

*Auto* picks one per niche (crypto → Neon, economy → Blueprint, personal finance and real estate → Paper
cut, investing → Flat, side hustles → Pop art). Choose under **Style → Illustration style**, or *Animated
icons* for the old look.

Every illustration is saved (Cache Storage, kept across updates) and reused the next time the same idea
comes up in the same style and colour, so a series looks consistent. The 150 most recently used are
kept. **About → Storage** shows the newest ones, how often they've been reused, and a Delete button.
Nothing is downloaded or generated by a model: it's all drawn from vector shapes, free and offline.

### Deep dives and better results

- **Deep dive (60–90 s).** Pick *Deep dive* under Length for explainers, your own topics and
  Idea Lab ideas. The app pulls more on-topic facts from the research library on the phone, cuts
  repeats and list fragments, and orders the video in three chapters (*what it is*, *why it
  matters*, *what you can do*). If the research has no practical advice, the last chapter uses
  safe, general tips matched to the topic (for example, paying on time for a credit score). Each chapter opens with a title card ("PART 1"), and the video
  ends on a **Quick recap** card that ticks off one point from each chapter.
- **On-screen sources.** Scenes built from researched facts show a small "Source: Wikipedia ·
  …" tag. You can turn it off under Style.
- **Sound effects.** A soft whoosh between scenes, a pop when a number lands and a chime on the
  recap. They're made by the app, so there's nothing to license. You can turn them off under Style.
- **Hook picker.** *Another hook* on the first scene cycles through different openings for the
  same topic.
- **Reel score.** The review screen scores the script out of 100 (hook, length, numbers, visuals,
  sentence length, call to action) and lists the top things to improve.
- **Posting kit.** Each reel in the Library also has a **Cover image** (a 1080×1920 thumbnail
  with the title, for the cover frame on TikTok, Reels or Shorts) and a **Captions (.srt)** file
  with exact timings, for platforms that accept uploaded subtitles.
- **Full story (2–3 min).** A longer format for Shorts (up to 3 minutes) and TikTok, in up to five
  chapters: *what it is*, *where it came from* (dated facts in time order), *why it matters*,
  *the risks and the catch*, and *what you can do*. A chapter only appears when the research really
  has material for it; there are no filler chapters.

### A narrator that sounds human

- **Natural voices.** The narrator is Kokoro-82M, an open StyleTTS 2 voice model (Apache-2.0)
  whose speech is close to a real voiceover: natural rhythm, intonation and breathing between
  phrases. It runs on the phone with no speech service, on the same compact AI runtime as the
  classic voice. There are nine voices, American and
  British. The first reel downloads the model once (about 92 MB), and the phone keeps it after that.
- **Gentle on memory.** The voice runs in its own background worker, which ends as soon as the
  voiceover is done and gives all of its memory back before the video is made. If the phone ever
  closes the app while the voice is working, the next reel uses a lighter version automatically.
  The voice also starts loading in the background while you review the script.
- **Studio finishing.** The voice is resampled with the browser's high-quality resampler (the old
  voice was stretched with simple interpolation, which sounded gritty). It then passes through a
  rumble filter, a cut in the boxy low mids, a presence lift for clarity on phone speakers, a
  gentle compressor and a peak limiter, and the whole video is levelled to about -14 LUFS, the
  usual loudness for Reels, Shorts and TikTok. The old voice's harsh saturation is gone.
- **Classic (fast)** is the previous voice: a smaller download, quicker, more robotic. If the
  natural voice can't start on a phone, the app falls back to it and tells you.
- **Pronunciations.** If the narrator says a word wrong, add it under Style (`Roth = rawth`).

### Results and what works for you

Under each reel in the Library, **Add results** lets you type in its views, likes, comments and saves
from TikTok, Instagram or YouTube. With two or more reels logged, **What works for you** shows which
niche, length, type of video, narrator, ending, music and caption style get you the most views, so you
can make more of what wins. The numbers stay on the phone, even after old reels are deleted.

### Remix

**Remix** on any reel in the Library turns its script back into an editable draft: change lines, the
hook, the narrator or the style, and make it again. Captions now also carry hashtags for the reel's
own topic (for example #IndexFund), not just its niche.

### Plan my week

**Plan my week (5 drafts)** under the Make button writes five scripts on different topics in your
niche, each researched and fact-checked, and saves them as drafts in the Library. It takes a few
seconds because photos are found when you open a draft. Open one, review it, and make the video.

### Captions that follow the voice

The highlighted caption word is timed from the recorded voice itself: each line is split into
phrases at its punctuation, and each phrase is matched to a real pause in the narration, so the
captions stay with the voice (the same timings go into the .srt file). There's also a short beat
after the hook and before the ending, like a human narrator.

### Series

**Make a 3-part series** on the review screen makes this video and two more on related topics
from the same research (for example Roth IRA → Roth 401(k) → Traditional IRA). Each part ends by
pointing to the next ("Follow for part 2: Roth 401(k)"), and all three go to the Library.

### Research depth and fact checking

- **Research depth** (under Length): *Quick*, *Standard*, *Deep* or *Maximum*. Each step searches
  more articles, follows leads further out (up to three steps) and reads more of them **in full**,
  section by section (history, how it works, criticism, regulation…), not just their summaries.
  *Maximum* reads 16 full articles and keeps up to 48 facts.
- **Fact check** (on by default). Before the review screen, every line of an explainer, your own
  topic or an Idea Lab idea is checked against the sources:
  - **✓ Verified · N sources**: a source sentence says the same thing, and every number in the line
    appears in that source. Paraphrases are matched by meaning (at Deep and Maximum, using the on-phone model), and
    numbers must still match exactly.
  - **✓ Verified by calculation**: money maths ("at 10% a year, money doubles in about 7 years")
    is worked out, and a wrong figure is flagged.
  - **≈ Partly verified**, **⚠ Not verified** and **⚠ Source disagrees** (a source on the same
    subject gives a different number).
  - **Tip** and **Takeaway**: advice and opinions, which aren't claims of fact.

  Tap any badge to see the evidence: the exact source sentences, with the article and section
  they come from. Edit a line and it is checked again as you type. At *Deep* and *Maximum*, lines
  the library can't confirm are also checked against live Wikipedia, which catches figures that
  have changed since the library was built.
- **Strict accuracy** (on by default). Facts that no source confirms are swapped for verified
  facts from the research, or left out. The review screen shows a fact-check summary (for
  example, "10 of 11 facts verified · 13 sources · 47 articles researched"). If anything is still
  unverified, a button swaps or removes it.
- **Honest limits.** A check proves that a line matches Wikipedia, or a calculation, and shows
  you where. It can't prove Wikipedia itself is right or current. For money decisions, check
  the original sources.

### Style

The Style card shows a **live preview** that updates as you change settings.

| Setting | Options |
|---|---|
| Colour | Seven colours for the highlighted caption word, brand pill, number pops, end card and progress bar |
| Captions | **Bold** (big outlined words), **Boxed** (words on a dark card, the spoken word on a coloured chip), **Clean** (sentence case on a soft backing) |
| Caption position | Low or Middle |
| Music | **Lo-fi**, **Upbeat**, **Cinematic**, **Calm** or **None**. Each is composed fresh for every reel |
| Narrator | Nine **natural voices** (Heart, Michael, Bella, Fenrir, Nicole, Puck, Emma, George, Fable; US and UK), or **Classic (fast)**. Tap **▶ Hear it** for a sample |
| Voice speed | Slow, normal or fast |
| Music volume | Low, medium or high (the music always dips under the voice) |
| Pronunciations | Teach the narrator a word, one per line: `Roth = rawth`, `ETF = E T F` |
| Ending | **Follow**, **Ask a question** ("Would you try this? Tell me in the comments"), **Save this** or **Share this**. Comments, saves and shares are what the apps reward most |
| Cover image style | **Bold title**, **Big number** (the reel's key figure, huge) or **Question** (the hook as a question) |
| My music | Upload a track you have the rights to use; it loops under the voice, dips when the narrator speaks, and stays on the phone |
| Your logo | Upload an image once; it appears in the top-left corner of every reel (kept on the phone) |
| Length | **Short** 20–30 s, **Standard** 30–45 s, **Long** 40–60 s, **Deep dive** 60–90 s, **Full story** 2–3 min |
| Number pops | Key figures in a line ("20%", "$1,000", "3–6 months", including ones written as words) pop up big on screen |
| Your @handle | Shown at the bottom of every scene and on the end card, and spoken in the call to action ("Follow @yourchannel…") |

Your choices are remembered on the phone.

### Idea Lab (the Ideas tab): research and AI that run entirely on your phone

The Idea Lab researches thousands of finance, business and economics topics and turns them into
an endless feed of video ideas, **with no internet connection, no API and no account**. Everything
it uses ships with the app and stays on your phone.

- **Research any topic.** Type a question or topic, even in plain words like "how do I stop
  living paycheck to paycheck". On-device semantic search understands the meaning, then the
  research engine follows leads across related articles. You get a research brief: a summary,
  key facts with their sources, and related topics you can tap to research next. It takes
  milliseconds.
- **Endless ideas.** Each topic becomes ideas from different angles: explainer, surprising fact,
  the story behind it, myth vs reality, mistakes to avoid, this vs that, "who is…", and quick
  facts. Scroll and it keeps researching new topics in your niche.
- **Make this reel.** Any idea becomes a script (hook plus researched facts) on the review screen,
  ready to edit and render.
- **Save** ideas for later, or tap **Research deeper**.
- **On-device AI (optional).** Tap **Download** for a small language model (137 MB, once) that
  rewrites titles to be catchier. It's checked against the research: a rewrite is used only if it
  adds no new claims or numbers. Tap **Remove** to free the space.

The library holds 20,038 Wikipedia articles on finance, business and economics (CC BY-SA). Their
opening sections are the search index, which is always on the phone. Their full text (255,023
sentences, section by section) is split into small files that load as deep research needs them. To
research in full offline, tap **Save offline** on the Full-text library card. Details,
models and licenses: [app/ai/README.md](app/ai/README.md). To refresh it, run
`python scripts/build_corpus.py` and then `python scripts/embed_library.py`.

### Offline mode

Turn on **Style → Offline mode** to make reels with zero downloads. Photos are skipped, so each
scene uses your own photos (via **My photo**) or an animated background built from the scene's
subject. The voice, music and video are always made on the phone anyway. News and market
recaps need the internet, so in Offline mode they switch to explainers. Combined with the Idea
Lab, the whole flow (research, ideas, script, voice, video) works with the phone in airplane mode,
once the app's files have been downloaded.

### Drafts

On the review screen, tap **Save draft** to keep the script and finish it later. Drafts appear
at the top of the Library: tap **Open** to continue editing, then make the video. Free photos are
found again when a draft is opened; photos from your own library need to be picked again.

### Captions for each platform

Every reel has **YouTube**, **TikTok** and **Instagram** copy buttons. Each copies a caption
formatted for that platform:

- **YouTube Shorts:** the title with #Shorts and the full description, including sources and credits
- **TikTok:** the hook, your @handle, niche hashtags and compact photo credits
- **Instagram:** the hook, the key points as a list, a save-and-share prompt, credits, sources and hashtags

### The Library

The newest 8 reels are kept **on the phone only**, in the browser's own storage. Delete one, or
all of them, any time. Clearing Safari's website data also removes them, so save the ones you
want to keep to Photos.

---

## What happens where

| Step | Where it runs | Source |
|---|---|---|
| Script | On the phone | Built-in templates and a hand-written topic library |
| Headlines | Phone fetches directly | CNBC and MarketWatch RSS feeds |
| Background facts and custom topics | Phone fetches directly | Wikipedia |
| Photos | Phone fetches directly | [Openverse](https://openverse.org) and [Wikimedia Commons](https://commons.wikimedia.org); only CC0, Public Domain, CC BY and CC BY-SA |
| Voice | On the phone | Natural voices: [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0), a StyleTTS 2 model, run with ONNX Runtime Web. Classic voice: [Piper](https://github.com/OHF-Voice/piper1-gpl), the `joe` voice (**CC0**). Both use eSpeak NG for pronunciation |
| Music | On the phone | Synthesized from scratch for every reel |
| Video | On the phone | Drawn on a canvas and encoded with the phone's H.264 encoder. The soundtrack is written into the file directly as uncompressed audio, in a QuickTime `.mov` (Apple's native format) |
| Market numbers | Small data file | See below |

**The one thing that isn't on the phone:** web pages aren't allowed to call market-data sites
directly. So a small scheduled job in this repository (`.github/workflows/update-data.yml`)
fetches public market numbers and extra headlines once an hour and publishes them as a 40 KB
JSON file on the `data` branch. It contains numbers and headlines only. If it's unavailable,
the app still makes Explainer and news reels.

---

## Good to know

- **iPhone requirements:** a recent iPhone on a current iOS version. The app uses the phone's fast video encoder when Safari offers it; otherwise it records the reel in real time, which takes about as long as the reel runs. The About tab shows which one your phone uses.
- **Keep the app open** while a reel is being made. iOS pauses web apps in the background.
- **Sound:** reels are saved as `.mov` files. The app writes the soundtrack into the file itself rather than relying on the browser's audio encoder, which is what made early versions silent on iPhone. Every reel is also checked for sound after it's made; if a file comes out silent, the app automatically tries another method. If a reel still comes out silent, open **About → Sound test**: it makes a 3-second clip, reports whether sound reached the file, and lists your browser's capabilities so the problem can be pinned down. Tap **Copy these results** to share them.
- **Listening on the phone:** if a saved video seems silent, check the volume and the side Ring/Silent switch, then play it from the Photos app.
- **Memory:** the voice model is large for a phone browser. If a reel fails, close other apps and try again.
- **Review before you post.** Photos are matched by keyword and aren't always a perfect fit, and headlines come from public feeds. Videos carry a "not financial advice" note.

---

## Run it on a computer instead (optional)

The original Python version is still here. It needs **Python 3.10+** and **ffmpeg**.

```bash
git clone https://github.com/LinKPlayt/FREELM.git && cd FREELM
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt

python -m reelbot make                              # uses config.yaml (niche + mode)
python -m reelbot make --niche investing --mode market
python -m reelbot make --topic compound-interest
python -m reelbot topics
```

Each run creates a folder in `output/` with `reel.mp4`, `script.txt` and `metadata.json`. The
Python version can also add short public-domain video clips, rewrite scripts with a local AI
through [Ollama](https://ollama.com) (`llm.enabled: true` in `config.yaml`), and upload to
YouTube (`python -m reelbot auth`, then `make --upload`; see `reelbot/youtube.py`).

To try the phone app locally: `python -m http.server 8000`, then open `http://localhost:8000/`.

---

## Updates

After each update the app shows a **What's new** window once, listing the changes since the last
version you saw; **Got it** closes it for good (About → What's new reopens it). New users skip it.

To publish an update: bump `APP_VERSION` and add a note at the top of `UPDATES` in
[app/version.js](app/version.js), and set the same number in `sw.js` (`reelbot-v<APP_VERSION>`).
A test checks they match.

Also in About: **Storage on this phone** shows how much the app keeps on the phone and lets you delete
the downloaded voices, the Ideas AI or the full-text research library to free space (they download
again when needed). While a video is made, a checklist shows each step with a time estimate that
learns from your phone, and the Make button says how long it will take. The Library shows each reel's
cover and only loads a video when you press play, which saves memory.

## Tests

Automated tests run the phone app in a real browser (phone-sized Chromium), served the way GitHub
Pages serves it:

```
node tests/web/run.mjs            # logic + fuzz: ~20 s, offline
node tests/web/run.mjs features   # every feature end to end (makes real videos; needs the internet)
node tests/web/run.mjs all
FUZZ_N=2000 FUZZ_SEED=7 node tests/web/run.mjs fuzz   # a longer fuzz run with another seed
```

- **Logic:** pronunciation, number and chart detection, fact checking and the maths check,
  research text cleaning, the natural voice's text normalisation, captions files, caption timing
  from the voice's pauses, the reel score, the limiter, and platform captions, all against answers
  worked out by hand.
- **Fuzz:** thousands of random and hostile inputs (emoji, other scripts, control characters, HTML,
  huge numbers, very long text) into every text function and every text box. Nothing may throw, hang,
  output NaN/undefined, or run injected HTML.
- **Features:** settings, all niches × types, the review editor, fact-check badges, making a reel with
  the natural voice, the Library and captions, deep dive and full story, Plan my week, drafts, voice
  previews, the Idea Lab and on-device AI, the About checks, crash guards, and offline use.

## Project layout

```
index.html, manifest.webmanifest, sw.js   the phone app (served by GitHub Pages from main)
app/
  main.js       screens, review editor and buttons
  make.js       the pipeline: plan (research → script → photos), then produce (voice → music → render)
  research.js   headlines, Wikipedia, market snapshot
  script.js     script templates and finance-friendly pronunciation
  media.js      Openverse + Wikimedia Commons photo search with license filtering
  tts.js        the narrator: natural voice or classic voice (Piper), with fallback and watchdog
  voice-worker.js  Kokoro-82M on ONNX Runtime, in a worker: phonemes → speech
  kokoro-text.js   text → phonemes for Kokoro (numbers, money, punctuation)
  voices.js     the list of narrators
  music.js      background-music synthesizer and voice/music mixing
  render.js     canvas scenes, captions, charts, H.264/AAC encoding
  store.js      on-device Library (IndexedDB)
  data/         topic library exported from reelbot/topics.py
  vendor/       bundled open-source libraries (see app/vendor/README.md)
assets/         fonts (OFL) and the classic voice model (CC0); the natural voice is in app/ai/models/kokoro-82m
reelbot/        the Python version (desktop) and shared research code
scripts/
  export_app_data.py   regenerates app/data/topics.json after editing topics
  snapshot_data.py     builds the hourly market-data file
```

To add your own topics, edit `reelbot/topics.py` and run `python scripts/export_app_data.py`.

## Disclaimer

Videos made by ReelBot are educational content, not financial advice. You're responsible for
reviewing what you publish. Headlines and market numbers come from public feeds and may
contain errors.
