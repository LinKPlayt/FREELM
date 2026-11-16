# FREELM · ReelBot

**Automatic 30–45 second finance reels for YouTube Shorts, built entirely from free resources.**

ReelBot researches a finance topic, writes a script, voices it with an offline AI voice, finds
openly licensed photos and video clips, generates original background music, renders a vertical
1080×1920 video with animated word-by-word captions, and (optionally) posts it to YouTube.

**What it costs:** nothing. You don't need API keys, paid AI services or stock-footage accounts.
The only account it connects to is **your YouTube channel**, and only if you want it to post for you.

```
research ──► script ──► voiceover ──► media ──► music ──► render ──► upload
 RSS/Wiki     templates    Piper TTS     Openverse   numpy     Pillow +   YouTube
 market data  (+ Ollama)   (offline)     Wikimedia   synth     ffmpeg     Data API
```

---

## What it uses (all free, no keys)

| Step | Source | Notes |
|---|---|---|
| Headlines | Google News RSS, CNBC RSS, MarketWatch RSS, CoinDesk/Cointelegraph RSS | Public feeds, filtered per niche |
| Background facts | Wikipedia's public page-summary endpoint | Adds a researched definition when a script runs short |
| Market data | Yahoo Finance's public chart endpoint | Live S&P 500, Nasdaq, Dow, Bitcoin, Ethereum, gold, oil, 10-year yield |
| Script | Built-in templates + a hand-written library of 36 evergreen topics | Optional: a **local** LLM through [Ollama](https://ollama.com), also free and offline |
| Voice | [Piper](https://github.com/OHF-Voice/piper1-gpl), a neural TTS that runs offline on CPU | The voice model downloads once (about 120 MB); espeak-ng is the fallback |
| Photos | [Openverse](https://openverse.org) and [Wikimedia Commons](https://commons.wikimedia.org) | Only CC0, Public Domain, CC BY and CC BY-SA, so commercial use is allowed |
| Video clips | Wikimedia Commons | Public-domain and CC clips, trimmed automatically |
| Music | Generated from scratch for every video | Can't trigger a copyright claim |
| Fonts | Anton + Montserrat (bundled, OFL) | |

Each video's description lists credits for every photo and clip it uses, as the CC BY licenses require.

---

## Install

You need **Python 3.10+** and **ffmpeg**.

```bash
# ffmpeg:  macOS: brew install ffmpeg   |  Ubuntu: sudo apt install ffmpeg   |  Windows: winget install ffmpeg
git clone https://github.com/LinKPlayt/FREELM.git
cd FREELM
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Make a reel

```bash
python -m reelbot make                              # uses config.yaml (niche + mode)
python -m reelbot make --niche investing --mode market
python -m reelbot make --mode news
python -m reelbot make --topic compound-interest    # a specific evergreen topic
python -m reelbot topics                            # list all built-in topics
```

Each run creates a folder in `output/` containing:

- `reel.mp4`: the finished vertical video
- `script.txt`: the narration
- `metadata.json`: the title, description (with credits and sources) and tags

ReelBot records what it has already made in `output/history.json`, so it doesn't repeat topics.

### Niches and modes

Set these in `config.yaml` or pass them as flags.

- **Niches:** `personal finance`, `investing`, `crypto`, `economy`, `side hustles`, `real estate`
- **Modes:**
  - `evergreen`: a timeless explainer, such as compound interest or the 50/30/20 rule
  - `news`: a roundup of today's top 3 headlines for the niche, plus a "why it matters" line
  - `market`: a recap with animated charts built from live market data
  - `auto`: mixes all three and avoids making the same kind twice in a row

You can also change the brand name, caption colour, voice, speed, music volume and video length in `config.yaml`.

---

## Post to YouTube automatically

The YouTube Data API is free. Setup takes about 10 minutes and you only do it once.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. Open **APIs & Services → Library**, find **YouTube Data API v3** and click **Enable**.
3. Open **APIs & Services → OAuth consent screen**.
   - Choose **External** and fill in the app name and your email.
   - Add yourself as a **Test user**.
4. Open **APIs & Services → Credentials**.
   - Click **Create credentials → OAuth client ID** and choose **Desktop app**.
   - Download the JSON file and save it as `credentials/client_secret.json`.
5. Sign in once:
   ```bash
   python -m reelbot auth
   ```
   A browser window opens. Choose your channel and allow access. ReelBot saves the sign-in to `credentials/token.json`.
6. Post:
   ```bash
   python -m reelbot make --upload
   python -m reelbot upload output/<folder>    # or upload a reel you already made
   ```

> **Important YouTube rules to know**
> - **Private-only uploads at first.** YouTube locks videos uploaded through a new, unverified API project to *private*. To post publicly, submit the free [YouTube API compliance audit](https://support.google.com/youtube/contact/yt_api_form). Until it's approved, set `privacy: private` and publish each video from YouTube Studio with one click.
> - **Sign-ins that expire after 7 days.** While the consent screen is in *Testing* mode, your sign-in expires after 7 days. To keep it working, go to **OAuth consent screen** and click **Publish app** (it's fine to leave it unverified for your own channel).
> - **Daily upload limit.** The default quota of 10,000 units per day allows about 6 uploads per day.

### Running it on a schedule

Pick one of these:

```bash
# A) Keep it running: one reel every 24 hours
python -m reelbot auto --every 24 --upload

# B) cron (Linux/macOS): every day at 9:00
0 9 * * * cd /path/to/FREELM && .venv/bin/python -m reelbot make --upload >> output/cron.log 2>&1
```

- **C) Windows Task Scheduler:** create a daily task that runs `python -m reelbot make --upload`, with the FREELM folder set as the "Start in" folder.
- **D) GitHub Actions** (free, no computer needed): see `.github/workflows/daily-reel.yml`.
  1. Run `python -m reelbot auth` once on your own computer.
  2. Copy the contents of `credentials/token.json` into a repository secret named `YT_TOKEN_JSON`.
  3. The workflow runs daily and also has a manual "Run workflow" button.

---

## Project layout

```
reelbot/
  research.py   headlines (RSS), Wikipedia summaries, market data
  topics.py     36 hand-written evergreen finance topics (add your own!)
  script.py     script templates, TTS-friendly text, optional local LLM rewrite
  tts.py        Piper / espeak-ng offline voice
  media.py      Openverse + Wikimedia Commons search, license filtering, downloads
  music.py      procedural royalty-free background music + voice ducking
  render.py     frame compositor: Ken Burns, charts, captions, transitions → ffmpeg
  pipeline.py   end-to-end orchestration, duration control, metadata, history
  youtube.py    OAuth + resumable upload
config.yaml     all settings
```

## Better scripts with a free local AI (optional)

1. Install [Ollama](https://ollama.com).
2. Download a model: `ollama pull llama3.1:8b`
3. Set `llm.enabled: true` in `config.yaml`.

Evergreen and news scripts are then rewritten by the model running on your own machine. If
Ollama isn't running, ReelBot automatically uses its built-in writer instead.

## Disclaimer

Videos made by ReelBot are educational content, not financial advice. A disclaimer is added to
every outro and description. You're responsible for reviewing what you publish. Headlines and
market numbers come from public feeds and may contain errors.
