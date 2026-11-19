# ReelBot launch video

The source of the ReelBot promo/release video: a 52-second trailer in two formats, 16:9 for YouTube
and 9:16 for Reels, TikTok and Shorts, plus a YouTube thumbnail. Everything in it is real: the reels
were made by ReelBot, the screens are the app with real data, and the music and sound effects were
synthesized for this video (original, so no licensing or Content ID issues).

## How it's made

| Step | Script | Output |
|---|---|---|
| 1. Make showcase reels with the app (charts and the app's own illustrations, no stock photos) | `node render_reels.js` | `reels/*.mov`, covers |
| 2. Capture the real UI (Studio taps, review, a live render, result, Library, Home, a planned week) | `node capture.js all`, then `node capture2.js` and `node topbar.js` | `ui/*.png`, `ui/boxes.js` |
| 3. Draw one illustration per style with the app's illustrator | `node art_samples.js` | `assets/art_*.png` |
| 4. Cut the reel clips the edit uses | `./extract_frames.sh` | `frames/<clip>/*.jpg`, `assets/narr_quiz.wav` |
| 5. Synthesize and master the soundtrack (120 BPM, F minor; every hit lands on the edit) | `node render_audio.js && ./master_audio.sh` | `soundtrack.wav` (-14 LUFS, -1 dBTP) |
| 6. Render the frames (deterministic, any range can be re-rendered) | `node render_frames.js wide 60 frames_wide` / `tall` | `frames_wide/`, `frames_tall/` |
| 7. Encode | `./encode.sh frames_wide 60 out/ReelBot_Launch_16x9_YouTube.mp4` | H.264 High + AAC 320k |
| Thumbnail | `node shot_thumb.js` | `ReelBot_YouTube_thumbnail.png` |

Two local servers are expected: the app at `http://127.0.0.1:8098/` (`python3 -m http.server 8098` in the repo
root) and this folder at `http://127.0.0.1:8099/` (`python3 -m http.server 8099` here). Copy
`assets/fonts/Anton-Regular.ttf` into `assets/` first. Inter, Inter Display and JetBrains Mono must be installed.

- `timeline.js`: one timeline for picture and sound (cuts, taps, titles, impacts), so they never drift apart.
- `promo.html` + `promo.js`: the composition. `render(t)` draws the frame at time `t`; nothing depends on the
  clock. The same code lays itself out for 16:9 (`?fmt=wide`) and 9:16 (`?fmt=tall`).
- `music.html` + `music.js`: the soundtrack, rendered offline with the Web Audio API (drums, bass, supersaw
  chords, plucks, a lead, risers, impacts, whooshes, UI taps), with the quiz reel's own narration in the breakdown.
- `render_video.js stills <fmt> <t1,t2,...>` renders single frames for review; `sheet.sh` tiles them.

## The edit (52 s)

0:00 the jobs one finance video takes, one per beat · 0:02 "What if your phone made it for you?" ·
0:04 the phone rises · 0:08 logo drop · 0:10 pick a topic (real taps) · 0:14 researched, written, fact-checked ·
0:18 voiced, edited, captioned (a real render in progress) · 0:22 done · 0:24 the finished reel, full screen, with
its narration · 0:28 a wall of real reels · 0:32 5 illustration styles, 9 voices, plan a week, the dashboard,
captions for every platform, runs on your phone · 0:44 "Free." · 0:46 end card with the link.
