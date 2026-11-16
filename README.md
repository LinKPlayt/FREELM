# FREELM · ReelBot

**Automatic 30–45 second finance reels for YouTube Shorts, built entirely from free resources.**

ReelBot researches a finance topic, writes a script, voices it with an offline AI voice, finds
openly licensed photos and video clips, generates original background music, renders a vertical
1080×1920 video with animated word-by-word captions, and (optionally) posts it to YouTube.

**What it costs:** nothing. Everything runs on **GitHub**, which you already have: the phone app
is hosted on GitHub Pages and the videos are rendered by GitHub Actions. There are no API keys,
no paid AI services, no stock-footage accounts and no other hosting. The only outside account
is **your YouTube channel**, and only if you want ReelBot to post for you.

```
iPhone app ──► request ──► research ──► script ──► voice ──► media ──► music ──► render ──► app + YouTube
(GitHub Pages)  (GitHub     RSS/Wiki     templates  Piper     Openverse  numpy     Pillow +
                 issue)     market data             (bundled) Wikimedia  synth     ffmpeg
```

---

## Set it up (about 3 minutes, all from your phone)

1. **Merge this code into the `main` branch.** GitHub only runs schedules and app requests from the default branch.
2. **Turn on GitHub Pages.** In the repository, go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, pick **`gh-pages`** and **/(root)**, and save.
   (The `gh-pages` branch is created by the first run of the *Make reel* workflow. If it isn't listed yet, run the workflow once from the **Actions** tab.)
3. **Open the app** at `https://<your-github-username>.github.io/FREELM/` in **Safari** on your iPhone. Tap **Share → Add to Home Screen**.

That's it. There is nothing to deploy and nothing that falls asleep.

## Using the app

| Tab | What it does |
|---|---|
| **Create** | Pick a niche, a type and an optional topic, then tap **Make my reel**. GitHub opens with your request already filled in; tap **Create** there and come back. The reel appears in the app in about 4 minutes. |
| **Library** | Watch your latest 20 reels. **Save / Share** opens the iPhone share sheet (*Save Video* puts it in Photos; or send it straight to YouTube, TikTok or Instagram). **Copy title and caption** gives you the description with credits. |
| **Settings** | One-time YouTube connection, the daily schedule, and install steps. |

How a request works: the app never holds a password or token. Tapping **Make my reel** opens a
pre-filled GitHub issue such as `reel | niche=investing | mode=news`. Because you submit it
while signed in to GitHub, only you can start a reel: requests from anyone else are ignored.
ReelBot replies on the issue when the reel is ready and closes it, so you also get a GitHub
notification.

### Niches and types

- **Niches:** `personal finance`, `investing`, `crypto`, `economy`, `side hustles`, `real estate`
- **Types:**
  - **Explainer** (`evergreen`): a timeless topic, such as compound interest or the 50/30/20 rule
  - **Today's news** (`news`): today's top 3 headlines for the niche, plus a "why it matters" line
  - **Market recap** (`market`): animated charts built from live market data
  - **Auto**: mixes all three and avoids making the same kind twice in a row

### The daily automatic reel

The same workflow also runs **once a day by itself** and adds a reel to the app. Once YouTube
is connected, the daily reel is posted to your channel automatically. Change the time (or
remove the schedule) in `.github/workflows/make-reel.yml`.

---

## Posting to YouTube

**The no-setup way:** in the Library, tap **Save / Share** and choose the YouTube app. Then tap
**Copy title and caption** and paste it in.

**The automatic way** uses the free YouTube Data API. Setup takes about 10 minutes, once, and
can be done in Safari on your phone:

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project.
2. Open **APIs & Services → Library**, find **YouTube Data API v3** and click **Enable**.
3. Open **OAuth consent screen**. Choose **External**, fill in the app name and your email, add yourself as a **Test user**, then click **Publish app**.
4. Open **Credentials → Create credentials → OAuth client ID** and choose **Web application**. Add the redirect URI shown in the app's **Settings** tab (it's your app's address).
5. In the app's **Settings** tab, paste the client JSON and tap **Connect YouTube**. Sign in and allow access.
6. The app shows a token. Tap **Copy token**, then **Open GitHub secrets**, and save it as a secret named **`YT_TOKEN_JSON`**.

The sign-in happens between your phone and Google only. The token is stored as an encrypted
GitHub secret; the app itself keeps nothing.

> **YouTube rules to know**
> - **Private-only uploads at first.** YouTube locks videos uploaded through a new, unverified API project to *private*. To post publicly, submit the free [YouTube API compliance audit](https://support.google.com/youtube/contact/yt_api_form). Until it's approved, publish each video from YouTube Studio with one tap, or use the no-setup way above.
> - **Sign-ins that expire after 7 days.** This happens while the consent screen is in *Testing* mode. Step 3's **Publish app** prevents it.
> - **Daily upload limit.** The default quota allows about 6 uploads per day.

---

## What it uses (all free, no keys)

| Step | Source | Notes |
|---|---|---|
| App hosting | GitHub Pages | Static files only |
| Rendering | GitHub Actions | Free for public repositories |
| Headlines | Google News RSS, CNBC RSS, MarketWatch RSS, CoinDesk/Cointelegraph RSS | Public feeds, filtered per niche |
| Background facts | Wikipedia's public page-summary endpoint | Adds a researched definition when a script runs short |
| Market data | Yahoo Finance's public chart endpoint | Live S&P 500, Nasdaq, Dow, Bitcoin, Ethereum, gold, oil, 10-year yield |
| Script | Built-in templates + a hand-written library of 36 evergreen topics | Optional on your own computer: a **local** LLM through [Ollama](https://ollama.com) |
| Voice | [Piper](https://github.com/OHF-Voice/piper1-gpl) neural TTS, running offline | The voice (`joe`, **CC0** license) is bundled in `assets/voices`; nothing is downloaded |
| Photos | [Openverse](https://openverse.org) and [Wikimedia Commons](https://commons.wikimedia.org) | Only CC0, Public Domain, CC BY and CC BY-SA, so commercial use is allowed |
| Video clips | Wikimedia Commons | Public-domain and CC clips, trimmed automatically |
| Music | Generated from scratch for every video | Can't trigger a copyright claim |
| Fonts | Anton + Montserrat (bundled, OFL) | |

Each video's description lists credits for every photo and clip it uses, as the CC BY licenses require.

---

## Running it on your own computer (optional)

You need **Python 3.10+** and **ffmpeg**.

```bash
git clone https://github.com/LinKPlayt/FREELM.git && cd FREELM
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt

python -m reelbot make                              # uses config.yaml (niche + mode)
python -m reelbot make --niche investing --mode market
python -m reelbot make --topic compound-interest    # a specific evergreen topic
python -m reelbot topics                            # list all built-in topics
python -m reelbot auth                              # YouTube sign-in (needs credentials/client_secret.json)
python -m reelbot make --upload
```

Each run creates a folder in `output/` with `reel.mp4`, `script.txt` and `metadata.json`.
Brand name, caption colour, voice speed, music volume and video length are set in `config.yaml`.

There is also a small server version of the app for a home computer or any Docker host:
`pip install -r requirements-web.txt && uvicorn reelbot.web.app:app --port 7860` (set
`APP_PASSWORD`), or build the included `Dockerfile`.

**Better scripts with a free local AI:** install [Ollama](https://ollama.com), run
`ollama pull llama3.1:8b`, and set `llm.enabled: true` in `config.yaml`. This only works when
ReelBot runs on your own computer.

---

## Project layout

```
site/                     the phone app (static PWA, published to GitHub Pages)
.github/workflows/
  make-reel.yml           renders reels on request, on schedule, or by hand; publishes the app
scripts/
  ci_make.py              validates a request and runs the pipeline inside GitHub Actions
  publish_site.py         assembles the app + latest reels for GitHub Pages
reelbot/
  research.py             headlines (RSS), Wikipedia summaries, market data
  topics.py               36 hand-written evergreen finance topics (add your own!)
  script.py               script templates, TTS-friendly text, optional local LLM rewrite
  tts.py                  Piper / espeak-ng offline voice
  media.py                Openverse + Wikimedia Commons search, license filtering, downloads
  music.py                procedural royalty-free background music + voice ducking
  render.py               frame compositor: Ken Burns, charts, captions, transitions → ffmpeg
  pipeline.py             end-to-end orchestration, duration control, metadata, history
  youtube.py              OAuth + resumable upload
  web/                    optional self-hosted server version of the app
assets/                   bundled fonts (OFL) and voice (CC0)
config.yaml               all settings
```

## Good to know

- The app's address and the reels on it are **public** (anyone with the link can watch them), like any GitHub Pages site. Nobody else can start a reel or reach your YouTube.
- The app keeps the **latest 20 reels**. Save the ones you want to keep.
- GitHub pauses scheduled workflows in repositories with no activity for 60 days; making a reel from the app counts as activity.

## Disclaimer

Videos made by ReelBot are educational content, not financial advice. A disclaimer is added to
every outro and description. You're responsible for reviewing what you publish. Headlines and
market numbers come from public feeds and may contain errors.
