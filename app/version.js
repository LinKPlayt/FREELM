// The app's version and its update notes, shown once in a "What's new" window after each update.
// When you deploy: bump APP_VERSION, add an entry at the top of UPDATES, and set the same number in
// sw.js (VERSION = "reelbot-v<APP_VERSION>"). A test checks the two match.
export const APP_VERSION = 30;

export const UPDATES = [
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
