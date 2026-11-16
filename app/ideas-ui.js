// Idea Lab screen. Research and ideas run entirely on the phone (see app/ai/).
import { library, deepResearch, startSemantic, saveLibraryOffline, DEPTHS } from "./ai/research.js";
const depthPref = () => { try { return Number(localStorage.getItem("depth")) || 2; } catch { return 2; } };
import { ideaStream, ideasFromBrief, improveTitle } from "./ai/ideas.js";
import { loadLLM, llmReady, unloadLLM, MODEL_MB } from "./ai/llm.js";

let H;                         // hooks from main.js
let stream = null, busy = false, observer = null;
const shown = new Map();       // id -> idea
const titleQueue = [];         // ideas waiting for an AI title
let titling = false;
const $ = (id) => document.getElementById(id);

export const unloadAI = () => unloadLLM();

export async function init(hooks) {
  H = hooks;
  const lib = await library();
  const info = (sem) => `Library: ${lib.docs.length.toLocaleString()} articles on your phone (from Wikipedia, CC BY-SA), built ${lib.built}. ` +
    (sem ? "Semantic search ✓ (understands meaning)." : "Keyword search.");
  $("lib-info").textContent = info(false);
  startSemantic().then((ok) => { $("lib-info").textContent = info(ok); });
  if (lib.depthInfo) {
    $("lib-sub").textContent = `Deep research reads whole articles: ${lib.depthInfo.sentences.toLocaleString()} sentences from the full text of ${lib.docs.length.toLocaleString()} articles. They load as needed; save them all to research in full offline.`;
    if (H.store.get("libSaved") === lib.built) { $("lib-save").textContent = "Saved ✓"; $("lib-save").disabled = true; }
    $("lib-save").addEventListener("click", async () => {
      const btn = $("lib-save"), bar = $("lib-progress");
      btn.disabled = true; btn.textContent = "Saving…"; bar.classList.remove("hidden");
      try {
        await saveLibraryOffline((done, total) => { bar.firstElementChild.style.width = `${Math.round(100 * done / total)}%`; });
        H.store.set("libSaved", lib.built); btn.textContent = "Saved ✓";
      } catch (e) { btn.disabled = false; btn.textContent = "Save offline"; H.toast("Couldn't save: " + e.message); }
      bar.classList.add("hidden");
    });
  } else $("lib-card").classList.add("hidden");
  $("idea-research").addEventListener("click", () => startResearch($("idea-q").value.trim()));
  $("idea-q").addEventListener("keydown", (e) => { if (e.key === "Enter") startResearch($("idea-q").value.trim()); });
  $("idea-surprise").addEventListener("click", () => startStream(null));
  $("ai-load").addEventListener("click", () => { if (!llmReady()) loadAI(true); });
  $("brief").addEventListener("click", (e) => { const c = e.target.closest("[data-topic]"); if (c) { $("idea-q").value = c.dataset.topic; startResearch(c.dataset.topic); } });
  $("idea-feed").addEventListener("click", onIdeaClick);
  $("saved-ideas").addEventListener("click", onIdeaClick);
  observer = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) more(3); }, { rootMargin: "400px" });
  observer.observe($("idea-more"));
  renderSaved();
  if (H.store.get("aiOn") === "1") {                       // downloaded before: load it from the phone
    if (H.store.get("aiLoading") === "1") {                // ...unless loading it last time closed the app
      H.store.set("aiLoading", "0"); H.store.set("aiOn", "0");
      $("ai-sub").textContent = "Last time the AI was loading, your phone closed the app (it ran low on memory), so it wasn't loaded automatically. Close other apps and tap Download to try again. Ideas work without it.";
    } else loadAI(false);
  }
}

/* ---------- on-device AI ---------- */
async function loadAI(userAsked) {
  if (llmReady()) return;
  const btn = $("ai-load"), bar = $("ai-progress");
  btn.disabled = true; btn.textContent = "Loading…"; bar.classList.remove("hidden");
  $("ai-sub").textContent = userAsked && H.store.get("aiOn") !== "1"
    ? `Downloading ${MODEL_MB} MB from this app (once). Keep this screen open; Wi-Fi recommended.` : "Loading the AI from your phone…";
  H.store.set("aiLoading", "1");                           // cleared below; still set after a crash
  try {
    await loadLLM((f) => { bar.firstElementChild.style.width = Math.round(f * 100) + "%"; });
    H.store.set("aiLoading", "0");
    H.store.set("aiOn", "1");
    $("ai-sub").textContent = "Ready. Running on your phone. Titles it improves are marked AI. Tap Remove to free 137 MB.";
    btn.textContent = "Remove"; btn.disabled = false; btn.onclick = removeAI; bar.classList.add("hidden");
    for (const idea of shown.values()) if (!idea.ai) titleQueue.push(idea);
    pumpTitles();
  } catch (e) {
    console.warn(e);
    H.store.set("aiLoading", "0");
    $("ai-sub").textContent = "The AI couldn't start on this phone (" + (e.message || e) + "). Ideas still work without it.";
    btn.disabled = false; btn.textContent = "Try again"; bar.classList.add("hidden");
  }
}

// Deletes the AI model from the phone (the app keeps working; ideas use the built-in titles).
async function removeAI() {
  const btn = $("ai-load");
  btn.disabled = true;
  await unloadLLM();
  try {
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      for (const req of await cache.keys()) if (req.url.includes("/SmolLM2-")) await cache.delete(req);
    }
  } catch { /* storage not available */ }
  H.store.set("aiOn", "0");
  $("ai-sub").textContent = "Removed from this phone. Ideas still work with built-in titles.";
  btn.textContent = "Download"; btn.disabled = false; btn.onclick = null;
}

async function pumpTitles() {
  if (titling || !llmReady()) return;
  titling = true;
  while (titleQueue.length && llmReady()) {
    const idea = titleQueue.shift();
    const el = document.querySelector(`[data-idea="${idea.id}"] h3`);
    if (!el) continue;
    el.classList.add("writing");
    await improveTitle(idea);
    el.classList.remove("writing");
    el.textContent = idea.title;
    if (idea.ai) el.parentElement.querySelector(".tags").insertAdjacentHTML("beforeend", `<span class="tag ai">AI</span>`);
  }
  titling = false;
}

/* ---------- research + feed ---------- */
async function startResearch(query) {
  if (!query) { H.toast("Type a topic to research"); $("idea-q").focus(); return; }
  if (busy) return;
  busy = true;
  const brief = $("brief");
  brief.classList.remove("hidden");
  brief.innerHTML = `<h2>Researching "${H.esc(query)}"…</h2><p id="brief-step"></p>`;
  const step = (t) => { const el = $("brief-step"); if (el) el.textContent = t; };
  const t0 = performance.now();
  const b = await deepResearch(query, { niche: H.niche(), onStep: step, depth: depthPref() });
  busy = false;
  if (!b) { brief.innerHTML = `<h2>Nothing found for "${H.esc(query)}"</h2><p>Try a broader money topic, like "credit", "stocks" or "housing".</p>`; return; }
  renderBrief(b, performance.now() - t0);
  startStream(b.main.title, b);
}

function renderBrief(b, ms) {
  $("brief").innerHTML = `
    <span class="tag">Research brief</span><span class="src">${Math.max(1, Math.round(ms))} ms on this phone</span>
    <h3 style="margin:8px 0 4px">${H.esc(b.main.title)}</h3>
    <p style="color:var(--text)">${H.esc(b.summary.join(" "))}</p>
    <div class="meta" style="margin-top:8px"><b>Key facts</b> · ${DEPTHS[b.depth]?.name || ""} research: ${b.read} articles${b.bodyDocs?.length ? `, ${b.bodyDocs.length} read in full` : ""}</div>
    <ul style="padding-left:18px;color:var(--muted);font-size:14px;margin:6px 0">${b.facts.slice(0, b.depth >= 3 ? 14 : 8).map((f) => `<li>${H.esc(f.text)} <span class="src">(${H.esc(f.source)}${f.section ? " — " + H.esc(f.section) : ""})</span></li>`).join("")}</ul>
    ${b.sections?.length ? `<details style="margin:6px 0"><summary class="meta"><b>Read the full article by section</b> (${b.sections.length} sections)</summary>
      ${b.sections.map((sec) => `<div class="meta" style="margin-top:8px"><b>${H.esc(sec.heading)}</b></div><ul style="padding-left:18px;color:var(--muted);font-size:14px;margin:4px 0">${sec.sentences.map((x) => `<li>${H.esc(x)}</li>`).join("")}</ul>`).join("")}</details>` : ""}
    <div class="meta" style="margin-top:8px"><b>Related</b>: tap to research</div>
    <div>${b.related.slice(0, 8).map((d) => `<span class="chiplink" data-topic="${H.esc(d.title)}">${H.esc(d.title)}</span>`).join("")}</div>
    <p class="src" style="margin-top:10px">Leads followed: ${H.esc(b.leads.join(", ") || "none")} · Sources: ${b.sources.length} Wikipedia articles</p>`;
}

function startStream(query, brief) {
  $("idea-feed").innerHTML = ""; shown.clear(); titleQueue.length = 0;
  if (!query) { $("brief").classList.add("hidden"); }
  stream = ideaStream({ niche: H.niche(), query, onStep: (t) => { $("idea-more").textContent = t; } });
  if (brief) {   // ideas for the topic we just researched come first
    const first = ideasFromBrief(brief, { max: 4 }); first.forEach((i) => { i.brief = brief; });
    stream.preload = first;
  }
  $("idea-more").classList.remove("hidden");
  more(4);
}

let loadingMore = false;
async function more(n) {
  if (!stream || loadingMore) return;
  loadingMore = true;
  try {
    for (let i = 0; i < n; i++) {
      const idea = stream.preload?.length ? stream.preload.shift() : await stream.next();
      if (!idea) { $("idea-more").textContent = "That's every topic in this niche. Try another niche."; break; }
      addIdea(idea);
      await new Promise((r) => setTimeout(r, 0));
    }
    $("idea-more").textContent = "Scroll for more ideas…";
  } finally { loadingMore = false; }
}

function ideaCard(idea, saved = false) {
  return `<div class="card idea" data-idea="${idea.id}">
    <div class="tags"><span class="tag">${H.esc(idea.angleLabel)}</span>${idea.ai ? `<span class="tag ai">AI</span>` : ""}</div>
    <h3>${H.esc(idea.title)}</h3>
    <p class="hook">${H.esc(idea.hook)}</p>
    <ul>${idea.points.slice(0, 3).map((p) => `<li>${H.esc(p)}</li>`).join("")}</ul>
    <div class="src">Sources: ${idea.sources.slice(0, 3).map(H.esc).join(" · ")}</div>
    <div class="btns">
      <button class="btn main" data-act-idea="make">Make this reel</button>
      ${saved ? `<button class="btn danger" data-act-idea="unsave">Remove</button>` : `<button class="btn" data-act-idea="save">Save</button>`}
      <button class="btn wide" data-act-idea="deeper">Research deeper</button>
    </div></div>`;
}

function addIdea(idea) {
  shown.set(idea.id, idea);
  $("idea-feed").insertAdjacentHTML("beforeend", ideaCard(idea));
  if (llmReady()) { titleQueue.push(idea); pumpTitles(); }
}

/* ---------- saved ideas ---------- */
const savedList = () => { try { return JSON.parse(H.store.get("savedIdeas") || "[]"); } catch { return []; } };
function renderSaved() {
  const list = savedList();
  $("saved-ideas").innerHTML = list.length ? `<h2 style="font-size:17px;margin:18px 2px 10px">Saved ideas (${list.length})</h2>` + list.map((i) => ideaCard(i, true)).join("") : "";
}

async function onIdeaClick(e) {
  const b = e.target.closest("[data-act-idea]"); if (!b) return;
  const id = b.closest("[data-idea]").dataset.idea;
  const idea = shown.get(id) || savedList().find((i) => i.id === id);
  if (!idea) return;
  const act = b.dataset.actIdea;
  if (act === "save") {
    const { brief, ...plain } = idea;
    H.store.set("savedIdeas", JSON.stringify([plain, ...savedList().filter((i) => i.id !== id)].slice(0, 50)));
    b.textContent = "Saved ✓"; b.disabled = true; renderSaved();
  }
  if (act === "unsave") { H.store.set("savedIdeas", JSON.stringify(savedList().filter((i) => i.id !== id))); renderSaved(); }
  if (act === "deeper") { $("idea-q").value = idea.topic; window.scrollTo(0, 0); startResearch(idea.topic); }
  if (act === "make") H.makeFromIdea(idea);
}
