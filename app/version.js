// The app's version and its update notes, shown once in a "What's new" window after each update.
// When you deploy: bump APP_VERSION, add an entry at the top of UPDATES, and set the same number in
// sw.js (VERSION = "reelbot-v<APP_VERSION>"). A test checks the two match.
export const APP_VERSION = 45;

export const UPDATES = [
  { version: 45, title: "Your photos kept, smarter estimates, undo", items: [
    "Photos you choose with “My photo” are now kept on your phone, so drafts and autosaved scripts bring them back instead of searching for new ones (About → Storage shows them).",
    "Length estimates learn how fast your narrator really speaks, so “about N seconds” and the length checks get more accurate with every video.",
    "Removed a scene by mistake? “↶ Undo remove” puts it back.",
  ] },
  { version: 44, title: "Sharper videos, punchier captions, nothing lost", items: [
    "Video quality: videos are now made at a higher bit rate (High), so fast moments like whips, zooms and big words stay crisp after TikTok, Reels or Shorts re-compress them. Choose Standard for smaller files (Style → Video quality).",
    "New caption style: Punch shows one or two big words at a time, popping in with a slight tilt.",
    "Autosave: if your phone reloads the app while you're reviewing a script, it's offered back with your edits (“Pick up where you left off”).",
  ] },
  { version: 43, title: "Music that moves with the video", items: [
    "The beat now drops after the hook: the opening line plays over soft chords, a swell builds, and the drums land as the first point begins.",
    "Two new moods: Bright (light and plucky) and Suspense (ticking, minor key).",
    "Auto music (the new default) picks a mood for each video: suspense for quizzes, bright for news, cinematic for big market drops and stories about people, upbeat for green days.",
    "“▶ Hear it” plays 8 seconds of the music you've chosen before you make a video.",
  ] },
  { version: 42, title: "Smoother cuts, smarter Library, clearer voice", items: [
    "Transitions: scenes now arrive with a quick whip (with motion blur), a zoom-through or a fade, chosen to suit the moment, instead of the same crossfade every time.",
    "Library: search your reels, filter by type (explainers, news, quizzes…), and sort by most views.",
    "The narrator says ranges and multiples the way people do (“3 to 6 months”, “1.5 times”) and reads more finance terms correctly: HSA, APR, APY, HELOC, P/E, 403(b), W-2 and more.",
  ] },
  { version: 41, title: "Your week, made in one go", items: [
    "Make all: the Library can now turn every draft into a video in one go, one after another, while you keep the app open.",
    "Today's video: when Plan my week has a draft for today, it shows at the top of Create with a one-tap “Make it now”.",
    "What works for you now compares hook styles (stakes, the catch, a number, quiz…) and includes quizzes.",
    "“Use what works” applies your best narrator, ending, music and caption style in one tap.",
  ] },
  { version: 40, title: "Better covers, a varied week, more quiz questions", items: [
    "Covers: a wide photo is shown whole over a soft blurred copy instead of being cropped, and drawn illustrations sit below the title instead of behind it.",
    "Photos: foreign banknotes and coins (like pound notes) are only used when nothing else turns up.",
    "Plan my week on Auto now plans a varied week: explainers, the day's news, a mid-week quiz and a market recap, each labelled with its day.",
    "Quiz: 56 hand-checked questions (up from 36), so weekly quizzes repeat less.",
    "“Make a 3-part series” only appears for videos that can have one (not news, market recaps or quizzes).",
  ] },
  { version: 39, title: "A stronger opening, faster drawing", items: [
    "Hook title: the first line now appears big on screen, word by word, over the dimmed opening picture, so viewers read it in the first second (Style → Hook title).",
    "Illustrations draw up to twice as fast, so videos with many drawn scenes are made sooner.",
    "Labels like WHY IT MATTERS no longer overlap a two-line title.",
  ] },
  { version: 38, title: "Sharper videos, tighter scripts", items: [
    "Quick cuts: a long line now cuts to a second picture of the same idea halfway through, like an edited video (Style → Quick cuts).",
    "Illustrations no longer repeat the subject that was just on screen.",
    "Scripts stay within your chosen length: the bottom line and comment question are only added when they fit.",
    "Hooks are kept to 14 words or fewer so they land in the first two seconds.",
    "Better research picks: definitions like “Freelancer” are found, sentences that lean on missing context are skipped, and technical or press-release headlines are left out of news reels.",
    "Comment questions that fit the topic (taxes, interest rates, retirement, debt and more).",
    "Tidier screens: script boxes grow to fit each line, and settings text no longer gets squeezed.",
  ] },
  { version: 37, title: "Quiz reels and big-word moments", items: [
    "New type: Quiz. Three “True or false?” questions for your niche, each with a 3-2-1 countdown and ticking clock, then a TRUE ✓ or FALSE ✗ stamp with a chime or buzzer and the explanation. Viewers play along and comment their score.",
    "Quiz questions are written and checked by hand (40 of them across the six niches), and the app avoids repeating the ones you used recently.",
    "The bottom line and the question for the comments now appear as big words on screen, word by word as they're spoken.",
    "The narrator slows down a touch for the moments that matter: the payoff, the bottom line and quiz answers.",
  ] },
  { version: 36, title: "A proofreader for the narrator", items: [
    "Every line is proofread before it's spoken: “a” vs “an” (an ETF, an 8% return, a university), doubled words, spacing and punctuation, capitals, and slips like “could of”, “alot” or “more then”.",
    "Written-only shorthand is said properly: “e.g.” becomes “for example”, “etc.” becomes “and so on”, and citation marks like [3] are removed.",
    "Your own edits are proofread too, right before the voice is recorded.",
    "The review screen shows a Wording check, flags long sentences or unclosed quotes, and has a “Fix wording now” button.",
    "Every old ReelBot link (including the old /site/ address) now opens the latest app, and an app left open in the background updates itself when you come back to it.",
  ] },
  { version: 35, title: "Many more illustrations", items: [
    "The illustrator can now draw 108 subjects (up from 41): cash, a safe, an ATM, a calculator, a pie chart, a nest egg, a trophy, a ladder, a mountain, fire, a robot, a chip, ships, planes, solar panels, a newspaper and many more.",
    "Each scene has 8 or more alternative illustrations. Tap “Another illustration” on the review screen to step through them.",
    "After each video, the app quietly draws and saves the other ways its scenes could be shown, so a better picture is ready next time.",
    "About → Storage → “Draw 36 more” draws a batch for your niche ahead of time (tap again for the next batch, then other niches). Up to 300 are kept.",
    "Everyday words like “now” or “best” no longer decide the picture; the real subject of the line does.",
  ] },
  { version: 34, title: "Illustrations drawn for your video", items: [
    "When no photo fits, the app now draws a full-screen illustration of what's being said: a house for mortgages, a falling chart for a crash, an umbrella for an emergency fund, and 40 more subjects.",
    "Five art styles: Flat, Neon, Paper cut, Blueprint and Pop art. Auto picks one per niche so your channel keeps one look (Style → Illustration style).",
    "Every illustration is saved on your phone and reused the next time the same idea comes up, so a series looks consistent.",
    "See your newest illustrations and how often they've been reused under About → Storage.",
    "The review screen previews each illustration, and any scene can be switched to one with the Illustration button.",
  ] },
  { version: 33, title: "Sounds like a person, takes a stand", items: [
    "Scripts are spoken in plain, natural English (“isn't”, “usually”, “Simply put, a stablecoin is…”) without changing what the facts say.",
    "A clear “Bottom line” for common topics, like “Credit cards are a great tool if you pay in full, and an expensive one if you don't.”",
    "New sounds: a riser into the big moment, coins for money figures, a falling tone for risks, a bell for what to do, a bloop for the question and a sparkle at the end.",
    "The music drops away just before the payoff, swells back as it hits, and fades out at the end.",
    "On-screen labels pop in for the key moments: THE CATCH, KEY NUMBER, WHY IT MATTERS, BOTTOM LINE, WHAT TO DO, YOUR TURN.",
    "A short camera shake when the payoff lands.",
  ] },
  { version: 32, title: "Videos that hook and land", items: [
    "Smarter hooks built from your video: the stakes (“Your credit score quietly decides what you pay to borrow”), a catch, or a number to wait for.",
    "When the hook promises something, the video keeps the promise: “Here's the catch:” or “Here's that number:” lands with a punch-in, a flash and a soft hit.",
    "The narrator opens with more energy, then pauses for a beat after the hook and before the big moment.",
    "Captions colour the words that matter: money and growth in green, risks in red, and the spoken word grows as it's said.",
    "Every scene starts with a quick punch-in, like an edited video.",
    "Videos end with a question for the comments (“Would you put your own money into this?”); it's the first thing cut if the reel runs long.",
    "Spoken lead-ins: “Here's why it matters”, “But here's the catch”, “So here's what to do”.",
  ] },
  { version: 31, title: "Scripts that tell a story", items: [
    "Every script now follows a clear path: what it is, how it works, a key number, why it matters, then what you can do.",
    "One clear definition per video, in plain English, with no jargon, trivia or half-finished sentences.",
    "Videos about people cover who they are and what they're known for, in date order, and never mix in facts about someone else.",
    "Lines no longer start with “It” or “This” when the sentence they pointed to isn't there.",
    "Country-specific details (for example, Australia's student loans) are left out unless your topic is about that country.",
    "News reels link the headlines with one thread (“The thread today: interest rates”), and market recaps open and close to match the day's mood.",
    "Short lead-ins like “Why it matters:” and “The takeaway:” make each point easy to follow.",
  ] },
  { version: 30, title: "Smoother making, lighter Library", items: [
    "A step-by-step checklist while your video is made, with a time estimate that learns from your phone.",
    "The Make button now tells you how long the video will take.",
    "The Library shows each reel's cover and only loads the video when you press play, so it uses far less memory.",
    "Results show each reel's engagement rate.",
    "New Storage card in About: see what the app keeps on your phone and free up space.",
    "This “What's new” window after every update (reopen it any time from About).",
  ] },
  { version: 29, title: "Fixed a false “not enough memory” message", items: [
    "The natural voice no longer switches to the classic voice by mistake after you close the app.",
  ] },
  { version: 28, title: "Your music, results and more", items: [
    "Upload your own music track; it dips under the voice automatically.",
    "Log each reel's views, likes, comments and saves; “What works for you” shows what gets the most views.",
    "Cover styles: Bold title, Big number or Question.",
    "Remix any finished reel, and topic hashtags in captions.",
  ] },
  { version: 27, title: "Tested and tightened", items: [
    "Captions can no longer jump back for a moment, and the fact checker can't freeze on long text.",
    "The app starts faster and uses less memory.",
  ] },
  { version: 26, title: "Better endings and captions", items: [
    "Pick your ending: Follow, Ask a question, Save this or Share this.",
    "Captions follow the voice's real pauses. Add your logo. Plan my week (5 drafts).",
  ] },
];
