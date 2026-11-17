// The app's version and its update notes, shown once in a "What's new" window after each update.
// When you deploy: bump APP_VERSION, add an entry at the top of UPDATES, and set the same number in
// sw.js (VERSION = "reelbot-v<APP_VERSION>"). A test checks the two match.
export const APP_VERSION = 33;

export const UPDATES = [
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
