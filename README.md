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
                RSS, Wiki     templates   Piper      Openverse   synth     canvas +
                                          (WASM)     Wikimedia             H.264 encoder
```

---

## Use it

1. Open **https://linkplayt.github.io/FREELM/** in **Safari** on your iPhone.
2. Tap **Share → Add to Home Screen** so it opens like an app.
3. Pick a niche and a type (or type **your own topic**), choose a colour and voice speed, then tap **Make my reel**.
4. **Review it:** every scene is listed with its line and photo. Edit any line, remove scenes, add researched lines, or change a photo. Then tap **Make the video**, and keep the screen open while it renders.
5. Tap **Save / Share**. Choose **Save Video** to put it in Photos, or pick YouTube, TikTok or Instagram to post it.
6. Tap **Copy title and caption** and paste it into your post. It includes the photo credits that the licenses require.

The **first reel** downloads the voice and video tools once (about 90 MB, so use Wi-Fi). After
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

### Style

- **Caption and brand colour:** seven colours for the highlighted caption word, the brand pill, the end card and the progress bar
- **Voice speed:** slow, normal or fast
- **Background music:** on or off

Your choices are remembered on the phone.

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
| Voice | On the phone | [Piper](https://github.com/OHF-Voice/piper1-gpl) neural voice running in WebAssembly; the `joe` voice is **CC0** |
| Music | On the phone | Synthesized from scratch for every reel |
| Video | On the phone | Drawn on a canvas, encoded with the phone's H.264 encoder |
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

## Project layout

```
index.html, manifest.webmanifest, sw.js   the phone app (served by GitHub Pages from main)
app/
  main.js       screens, review editor and buttons
  make.js       the pipeline: plan (research → script → photos), then produce (voice → music → render)
  research.js   headlines, Wikipedia, market snapshot
  script.js     script templates and finance-friendly pronunciation
  media.js      Openverse + Wikimedia Commons photo search with license filtering
  tts.js        Piper voice on onnxruntime-web
  music.js      background-music synthesizer and voice/music mixing
  render.js     canvas scenes, captions, charts, H.264/AAC encoding
  store.js      on-device Library (IndexedDB)
  data/         topic library exported from reelbot/topics.py
  vendor/       bundled open-source libraries (see app/vendor/README.md)
assets/         fonts (OFL) and the voice model (CC0)
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
