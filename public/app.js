/* FREELM — client */
import * as browserAI from "./browser-ai.js";

const $ = (sel, el = document) => el.querySelector(sel);
const h = (tag, props = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
};

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      toast("Storage is full — delete some old chats.");
    }
  },
};

const ACCENTS = ["#7c5cff", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#ec4899", "#a3a3a3"];
const PRESETS = {
  "Friendly helper": "Warm, upbeat and encouraging. Explain clearly and check in on what I need.",
  "Straight shooter": "Direct and concise. Lead with the answer, skip pleasantries, push back when I'm wrong.",
  "Creative muse": "Imaginative and playful. Offer unexpected angles, vivid language and bold ideas.",
  "Coding partner": "A senior engineer. Prefer working code, explain trade-offs briefly, point out bugs and edge cases.",
  "Patient tutor": "Teach step by step. Use analogies, ask a quick question to check understanding, never condescend.",
};
const SUGGESTIONS = [
  ["Plan my week", "Help me organize my priorities"],
  ["Explain something", "How does the internet actually work?"],
  ["Write with me", "Draft a short story opening line"],
  ["Brainstorm", "Give me 10 side-project ideas"],
];
// Verified tags on the Ollama library. Sizes are download sizes.
const OLLAMA_SUGGESTED = [
  { name: "qwen3.5:9b", note: "Recommended · great all-rounder · 16 GB RAM", gb: 6.6, rec: true },
  { name: "gpt-oss:20b", note: "OpenAI's open model · deep reasoning · 16 GB+ RAM", gb: 13.8 },
  { name: "qwen3.5:27b", note: "Most powerful · 32 GB RAM or a 24 GB GPU", gb: 17.5 },
  { name: "deepseek-r1:14b", note: "Step-by-step thinker · 16 GB+ RAM", gb: 9.0 },
  { name: "gemma4:e4b", note: "Google's fast, capable model · 8–16 GB RAM", gb: 6.6 },
  { name: "qwen3.5:4b", note: "Light · runs on 8 GB laptops", gb: 3.3 },
  { name: "llama3.2:3b", note: "Tiny & quick · any computer", gb: 2.0 },
];
const PROV = {
  cloud: { title: "Cloud", sub: "Claude · most capable", icon: '<svg viewBox="0 0 24 24"><path d="M7 18a5 5 0 0 1-.5-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9H7z"/></svg>' },
  ollama: { title: "This computer", sub: "Private · runs on your hardware via Ollama", icon: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>' },
  browser: { title: "In this browser", sub: "On-device · no install · WebGPU", icon: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>' },
};

const defaults = { name: "FREELM", personality: "", accent: ACCENTS[0], theme: "dark", effort: "low", model: null };
let settings = { ...defaults, ...store.get("freelm.settings", {}) };
let chats = store.get("freelm.chats", []);
let activeId = null;
let streaming = null; // { controller, chatId }
let password = store.get("freelm.password", "");

// What's available right now.
const env = {
  server: true,
  cloud: false,
  cloudModel: "",
  ollama: { checked: false, available: false, models: [], error: "" },
  webgpu: { checked: false, ok: false, reason: "" },
  cached: new Set(),
};
const pulls = new Map(); // ollama model -> { status, pct, controller }
const browserLoads = new Map(); // browser model id -> { pct, text }

const saveChats = () => store.set("freelm.chats", chats);
const saveSettings = () => store.set("freelm.settings", settings);
const activeChat = () => chats.find((c) => c.id === activeId) || null;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const authHeaders = () => (password ? { "x-app-password": password } : {});
const fmtGB = (bytes) => (bytes / 1e9).toFixed(1) + " GB";

// Same persona prompt the server builds, for models that run in the browser.
function buildSystemPrompt(name, personality) {
  const persona = String(personality || "").trim();
  return [
    `You are ${name || "FREELM"}, a personal AI assistant living inside the user's own private web app.`,
    "Talk like a sharp, warm, genuinely helpful companion. Match the length of your answer to the question: short for quick questions, thorough when depth helps.",
    "Format with Markdown when it improves readability (headings for long answers, lists for steps, fenced code blocks with a language tag for code). Avoid filler and needless disclaimers.",
    persona ? `\nPersonality and instructions from the user:\n${persona}` : "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------
const ICONS = {
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  retry: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
};
const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    code({ text, lang }) {
      const language = (lang || "").trim().split(/\s+/)[0];
      let html;
      try {
        html =
          language && hljs.getLanguage(language)
            ? hljs.highlight(text, { language, ignoreIllegals: true }).value
            : escapeHtml(text);
      } catch {
        html = escapeHtml(text);
      }
      return `<div class="codeblock"><div class="codeblock-head"><span>${escapeHtml(language || "text")}</span><button class="tool copy-code" type="button">${ICONS.copy}<span>Copy</span></button></div><pre><code class="hljs">${html}</code></pre></div>`;
    },
  },
});
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});
const renderMarkdown = (text) => DOMPurify.sanitize(marked.parse(text || ""));

// ---------------------------------------------------------------------------
// Theme & identity
// ---------------------------------------------------------------------------
function applyAppearance() {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.style.setProperty("--accent", settings.accent);
  $("#hl-light").disabled = settings.theme !== "light";
  $("#hl-dark").disabled = settings.theme !== "dark";
  document.querySelector('meta[name="theme-color"]').content = settings.theme === "dark" ? "#0b0d12" : "#f7f7fb";
  document.querySelectorAll("[data-ai-name]").forEach((el) => (el.textContent = settings.name));
  $("#input").placeholder = `Message ${settings.name}…`;
  document.title = settings.name;
  document.querySelectorAll("#mode button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.effort === settings.effort)));
}

// ---------------------------------------------------------------------------
// Model selection
// ---------------------------------------------------------------------------
function modelLabel(sel) {
  if (!sel) return "Choose a model";
  if (sel.provider === "cloud") return "Claude";
  if (sel.provider === "browser") return browserAI.BROWSER_MODELS.find((m) => m.id === sel.id)?.label || sel.id;
  return sel.id;
}

function selectionProblem(sel) {
  if (!sel) return "Pick an AI model from the menu at the top first.";
  if (sel.provider === "cloud" && !env.cloud)
    return env.server ? "Cloud AI isn't set up on the server (no ANTHROPIC_API_KEY). Pick a local model instead." : "Cloud AI needs the FREELM server. Pick a browser model instead.";
  if (sel.provider === "ollama") {
    if (!env.server) return "Models on this computer need the FREELM server running. Pick a browser model instead.";
    if (env.ollama.checked && !env.ollama.available) return env.ollama.error || "Ollama isn't running.";
    if (env.ollama.checked && !env.ollama.models.some((m) => m.name === sel.id)) return `"${sel.id}" isn't downloaded yet. Open Local AI models to get it.`;
  }
  if (sel.provider === "browser" && env.webgpu.checked && !env.webgpu.ok) return env.webgpu.reason;
  return null;
}

function setModel(sel) {
  settings.model = sel;
  saveSettings();
  renderModelButton();
}

// Pick a sensible default if nothing valid is selected yet.
function ensureModel() {
  if (settings.model && !selectionProblem(settings.model)) return;
  if (settings.model?.provider === "ollama" && !env.ollama.checked) return;
  let next = null;
  if (env.cloud) next = { provider: "cloud", id: "claude" };
  else if (env.ollama.available && env.ollama.models.length)
    next = { provider: "ollama", id: [...env.ollama.models].sort((x, y) => y.size - x.size)[0].name }; // most capable installed
  else if (env.webgpu.ok) {
    const cached = browserAI.BROWSER_MODELS.find((m) => env.cached.has(m.id));
    next = { provider: "browser", id: (cached || browserAI.BROWSER_MODELS.find((m) => m.recommended)).id };
  }
  if (next) setModel(next);
  else renderModelButton();
}

function renderModelButton() {
  const sel = settings.model;
  const icon = $("#model-icon");
  icon.dataset.prov = sel?.provider || "";
  icon.innerHTML = sel ? PROV[sel.provider].icon : PROV.cloud.icon;
  $("#model-label").textContent = modelLabel(sel);
  $("#model-btn").title = sel ? `${PROV[sel.provider].title} · ${modelLabel(sel)}` : "Choose which AI answers";
}

function menuItem(sel, label, small, disabled = false) {
  const current = settings.model && settings.model.provider === sel.provider && settings.model.id === sel.id;
  return h(
    "button",
    {
      class: "menu-item",
      role: "menuitemradio",
      "aria-checked": String(Boolean(current)),
      disabled,
      onclick: () => {
        setModel(sel);
        closeMenu();
        toast(`Now chatting with ${modelLabel(sel)}`);
      },
    },
    h("span", { class: "grow" }, label),
    small ? h("small", {}, small) : null,
    h("span", { class: "check", html: ICONS.check }),
  );
}

function menuHead(prov, extra) {
  return h(
    "div",
    { class: "menu-head" },
    h("span", { class: "prov-icon", "data-prov": prov, html: PROV[prov].icon }),
    h("div", { class: "grow" }, h("strong", {}, PROV[prov].title), h("span", {}, PROV[prov].sub)),
    extra,
  );
}

function renderModelMenu() {
  const menu = $("#model-menu");
  const sections = [];

  // Cloud
  sections.push(
    h(
      "div",
      { class: "menu-section" },
      menuHead("cloud"),
      env.cloud
        ? menuItem({ provider: "cloud", id: "claude" }, "Claude", env.cloudModel)
        : h("div", { class: "menu-note" }, env.server ? "Not set up — add ANTHROPIC_API_KEY on the server." : "Needs the FREELM server."),
    ),
  );

  // Ollama
  const o = env.ollama;
  const ollamaBody = [];
  if (!env.server) ollamaBody.push(h("div", { class: "menu-note" }, "Needs the FREELM server running on your computer."));
  else if (!o.checked) ollamaBody.push(h("div", { class: "menu-note" }, "Checking…"));
  else if (!o.available)
    ollamaBody.push(h("div", { class: "menu-note" }, "Ollama isn't running. ", h("button", { class: "menu-link", onclick: () => openLocal("ollama") }, "Set it up")));
  else if (!o.models.length)
    ollamaBody.push(h("div", { class: "menu-note" }, "No models yet. ", h("button", { class: "menu-link", onclick: () => openLocal("ollama") }, "Download one")));
  else for (const m of o.models) ollamaBody.push(menuItem({ provider: "ollama", id: m.name }, m.name, m.parameterSize || fmtGB(m.size)));
  sections.push(h("div", { class: "menu-section" }, menuHead("ollama"), ollamaBody));

  // Browser
  const browserBody = [];
  if (env.webgpu.checked && !env.webgpu.ok) browserBody.push(h("div", { class: "menu-note" }, env.webgpu.reason));
  else
    for (const m of browserAI.BROWSER_MODELS)
      browserBody.push(menuItem({ provider: "browser", id: m.id }, m.label, env.cached.has(m.id) ? "Ready" : `${m.gb} GB`));
  sections.push(h("div", { class: "menu-section" }, menuHead("browser"), browserBody));

  sections.push(
    h("div", { class: "menu-section" }, h("button", { class: "menu-item", style: "padding-left:10px", onclick: () => openLocal() }, h("span", { class: "grow" }, "Manage local models…"))),
  );
  menu.replaceChildren(...sections);
}

function openMenu() {
  renderModelMenu();
  $("#model-menu").hidden = false;
  $("#model-btn").setAttribute("aria-expanded", "true");
  refreshOllama().then(() => !$("#model-menu").hidden && renderModelMenu());
}
function closeMenu() {
  $("#model-menu").hidden = true;
  $("#model-btn").setAttribute("aria-expanded", "false");
}
$("#model-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  $("#model-menu").hidden ? openMenu() : closeMenu();
});
document.addEventListener("click", (e) => {
  if (!$("#model-menu").hidden && !e.target.closest("#picker")) closeMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#model-menu").hidden) closeMenu();
});

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------
async function refreshOllama() {
  if (!env.server) return;
  try {
    const res = await fetch("api/local/models", { headers: authHeaders() });
    if (res.status === 401) return showUnlock();
    const data = await res.json();
    env.ollama = { checked: true, available: data.available, models: data.models || [], error: data.error || "" };
  } catch {
    env.ollama = { checked: true, available: false, models: [], error: "Couldn't reach the FREELM server." };
  }
  renderModelButton();
}

async function refreshBrowserCache() {
  const results = await Promise.all(browserAI.BROWSER_MODELS.map(async (m) => [m.id, await browserAI.isCached(m.id)]));
  env.cached = new Set(results.filter(([, ok]) => ok).map(([id]) => id));
}

async function detect() {
  try {
    const cfg = await (await fetch("api/config")).json();
    env.server = true;
    env.cloud = Boolean(cfg.cloud?.enabled);
    env.cloudModel = cfg.cloud?.model || "";
    if (cfg.passwordRequired) {
      const ok = password && (await fetch("api/unlock", { method: "POST", headers: authHeaders() })).ok;
      if (!ok) showUnlock();
    }
  } catch {
    // Static hosting (e.g. GitHub Pages): only the in-browser engine is available.
    env.server = false;
    env.ollama = { checked: true, available: false, models: [], error: "" };
  }
  env.webgpu = { checked: true, ...(await browserAI.webgpuStatus()) };
  await Promise.all([refreshOllama(), env.webgpu.ok ? refreshBrowserCache() : null]);
  ensureModel();
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
function groupLabel(ts) {
  const day = 86400000;
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  if (ts >= startOfToday) return "Today";
  if (ts >= startOfToday - day) return "Yesterday";
  if (ts >= startOfToday - 7 * day) return "Previous 7 days";
  if (ts >= startOfToday - 30 * day) return "Previous 30 days";
  return "Older";
}

function renderChatList() {
  const list = $("#chat-list");
  const q = $("#search").value.trim().toLowerCase();
  const items = chats
    .filter((c) => !q || c.title.toLowerCase().includes(q) || c.messages.some((m) => (m.text || "").toLowerCase().includes(q)))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  list.replaceChildren();
  if (!items.length) {
    list.append(h("div", { class: "chat-empty" }, q ? "No chats match your search." : "Your conversations will appear here."));
    return;
  }
  let lastGroup = null;
  for (const chat of items) {
    const g = groupLabel(chat.updatedAt);
    if (g !== lastGroup) {
      list.append(h("div", { class: "chat-group" }, g));
      lastGroup = g;
    }
    const btn = h("button", {
      class: "chat-item" + (chat.id === activeId ? " active" : ""),
      "data-id": chat.id,
      html: `<span class="label"></span><span class="actions"><span data-act="rename" title="Rename">${ICONS.edit}</span><span data-act="delete" title="Delete">${ICONS.trash}</span></span>`,
    });
    $(".label", btn).textContent = chat.title;
    list.append(btn);
  }
}

$("#chat-list").addEventListener("click", (e) => {
  const item = e.target.closest(".chat-item");
  if (!item) return;
  const act = e.target.closest("[data-act]")?.dataset.act;
  const chat = chats.find((c) => c.id === item.dataset.id);
  if (!chat) return;
  if (act === "delete") {
    if (!confirm(`Delete "${chat.title}"?`)) return;
    if (streaming?.chatId === chat.id) streaming.controller.abort();
    chats = chats.filter((c) => c.id !== chat.id);
    saveChats();
    if (activeId === chat.id) openChat(null);
    else renderChatList();
  } else if (act === "rename") {
    startRename(item, chat);
  } else {
    openChat(chat.id);
    closeSidebar();
  }
});

function startRename(item, chat) {
  const label = $(".label", item);
  const input = h("input", { value: chat.title });
  label.replaceWith(input);
  input.focus();
  input.select();
  const finish = (save) => {
    if (save && input.value.trim()) {
      chat.title = input.value.trim().slice(0, 80);
      saveChats();
    }
    renderChatList();
    if (chat.id === activeId) $("#chat-title").textContent = chat.title;
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
    e.stopPropagation();
  });
  input.addEventListener("blur", () => finish(true), { once: true });
  input.addEventListener("click", (e) => e.stopPropagation());
}

$("#search").addEventListener("input", renderChatList);
const openSidebar = () => $("#app").classList.add("sidebar-open");
const closeSidebar = () => $("#app").classList.remove("sidebar-open");
$("#open-sidebar").addEventListener("click", openSidebar);
$("#close-sidebar").addEventListener("click", closeSidebar);
$("#scrim").addEventListener("click", closeSidebar);

// ---------------------------------------------------------------------------
// Thread rendering
// ---------------------------------------------------------------------------
function openChat(id) {
  activeId = id;
  const chat = activeChat();
  $("#chat-title").textContent = chat ? chat.title : "New chat";
  renderThread();
  renderChatList();
  $("#input").focus();
}

function renderThread() {
  const chat = activeChat();
  const box = $("#messages");
  box.replaceChildren();
  $("#empty").hidden = Boolean(chat?.messages.length);
  if (!chat) return;
  chat.messages.forEach((m, i) => box.append(m.role === "user" ? userEl(m) : aiEl(m, i === chat.messages.length - 1)));
  scrollToBottom(true);
}

function userEl(m) {
  const el = h("div", {
    class: "msg user",
    html: `<div class="bubble"></div><div class="tools"><button class="tool" data-act="copy" title="Copy">${ICONS.copy}</button></div>`,
  });
  $(".bubble", el).textContent = m.text;
  $('[data-act="copy"]', el).addEventListener("click", (e) => copyText(m.text, e.currentTarget));
  return el;
}

function aiEl(m, isLast) {
  const el = h("div", {
    class: "msg ai" + (isLast ? " last" : ""),
    html: `
    <div class="orb orb-sm" aria-hidden="true"></div>
    <div class="body">
      <div class="who"><span class="who-name"></span></div>
      <details class="thought" hidden><summary>${ICONS.chevron}<span class="label">Thought process</span></summary><div class="thought-text"></div></details>
      <div class="md"></div>
      <div class="extra"></div>
      <div class="tools">
        <button class="tool" data-act="copy" title="Copy">${ICONS.copy}<span>Copy</span></button>
        <button class="tool" data-act="retry" title="Regenerate with the selected model">${ICONS.retry}<span>Regenerate</span></button>
      </div>
    </div>`,
  });
  $(".who-name", el).textContent = m.name || settings.name;
  if (m.provider) {
    const label = m.provider === "cloud" ? "Cloud" : m.provider === "ollama" ? `Local · ${m.modelLabel}` : `On-device · ${m.modelLabel}`;
    $(".who", el).append(h("span", { class: "badge" + (m.provider === "cloud" ? " accent" : " ok"), title: m.modelLabel }, label));
  }
  updateAiEl(el, m);
  $('[data-act="copy"]', el).addEventListener("click", (e) => copyText(m.text || "", e.currentTarget));
  $('[data-act="retry"]', el).addEventListener("click", () => regenerate());
  if (!isLast) $('[data-act="retry"]', el).remove();
  return el;
}

function updateAiEl(el, m, live = false) {
  const thought = $(".thought", el);
  if (m.thinking) {
    thought.hidden = false;
    $(".thought-text", thought).textContent = m.thinking;
    thought.classList.toggle("live", live && !m.text);
    $(".label", thought).textContent = live && !m.text ? "Thinking…" : "Thought process";
  }
  const md = $(".md", el);
  if (m.text) md.innerHTML = renderMarkdown(m.text);
  else if (live && !m.progress) md.innerHTML = m.thinking ? "" : '<span class="typing"><i></i><i></i><i></i></span>';
  else md.innerHTML = "";
  if (live && m.text) {
    let last = md.lastElementChild;
    if (last && (last.tagName === "UL" || last.tagName === "OL")) last = last.lastElementChild;
    if (last && /^(P|LI|H[1-6]|BLOCKQUOTE)$/.test(last.tagName)) last.classList.add("cursor");
  }
  const extra = $(".extra", el);
  extra.replaceChildren();
  if (m.progress) {
    extra.append(
      h(
        "div",
        { class: "load-card" },
        h("div", {}, m.progress.label),
        h("div", { class: "progress" }, h("i", { style: `width:${Math.round(m.progress.pct * 100)}%` })),
        h("div", { class: "progress-text" }, m.progress.text || ""),
      ),
    );
  }
  for (const n of m.notices || []) extra.append(h("div", { class: "notice" }, n));
  if (m.error) extra.append(h("div", { class: "error-card" }, m.error));
  $(".who .tps", el)?.remove();
  if (!live && m.tokensPerSecond) $(".who", el).append(h("span", { class: "badge tps", title: "Generation speed" }, `${m.tokensPerSecond} tok/s`));
  $(".orb", el).classList.toggle("thinking", live);
  $(".tools", el).hidden = live;
}

function isNearBottom() {
  const t = $("#thread");
  return t.scrollHeight - t.scrollTop - t.clientHeight < 140;
}
function scrollToBottom(force = false) {
  const t = $("#thread");
  if (force || isNearBottom()) t.scrollTop = t.scrollHeight;
}

// ---------------------------------------------------------------------------
// Sending & streaming
// ---------------------------------------------------------------------------
// Claude gets each assistant turn's exact content blocks back (thinking included).
function cloudHistory(chat) {
  const out = [];
  for (const m of chat.messages) {
    if (m.role === "user") {
      const prev = out[out.length - 1];
      if (prev?.role === "user") prev.content += "\n\n" + m.text;
      else out.push({ role: "user", content: m.text });
    } else if (!m.excluded && (m.content || m.text)) {
      out.push({ role: "assistant", content: m.content ?? m.text });
    }
  }
  return out;
}
// Local models get plain text.
function textHistory(chat) {
  const out = [];
  for (const m of chat.messages) {
    if (m.role === "user") {
      const prev = out[out.length - 1];
      if (prev?.role === "user") prev.content += "\n\n" + m.text;
      else out.push({ role: "user", content: m.text });
    } else if (!m.excluded && m.text) {
      out.push({ role: "assistant", content: m.text });
    }
  }
  return out;
}

async function send(text) {
  text = text.trim();
  if (!text || streaming) return;
  let chat = activeChat();
  if (!chat) {
    chat = {
      id: uid(),
      title: text.replace(/\s+/g, " ").slice(0, 48) + (text.length > 48 ? "…" : ""),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      // Persona is fixed per chat so the conversation's system prompt never changes mid-thread.
      persona: { name: settings.name, personality: settings.personality },
      messages: [],
    };
    chats.push(chat);
    activeId = chat.id;
    $("#chat-title").textContent = chat.title;
  }
  chat.messages.push({ role: "user", text });
  chat.updatedAt = Date.now();
  saveChats();
  renderThread();
  renderChatList();
  await runAssistant(chat);
}

function regenerate() {
  const chat = activeChat();
  if (!chat || streaming) return;
  if (chat.messages[chat.messages.length - 1]?.role === "assistant") chat.messages.pop();
  saveChats();
  renderThread();
  runAssistant(chat);
}

// POST and read Server-Sent Events, dispatching each event to handlers[event].
async function streamSse(url, body, signal, handlers) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
    signal,
  });
  if (res.status === 401) {
    showUnlock();
    throw new Error("Unlock the app to keep going.");
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Server error (${res.status})`);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let finished = false;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const event = /^event: (.*)$/m.exec(raw)?.[1];
      const dataLine = /^data: (.*)$/m.exec(raw)?.[1];
      if (!event || !dataLine) continue;
      const data = JSON.parse(dataLine);
      if (event === "error") throw new Error(data.message);
      if (event === "done") finished = true;
      handlers[event]?.(data);
    }
  }
  if (!finished) throw new Error("The connection closed before the reply finished.");
}

async function runAssistant(chat) {
  const sel = settings.model;
  const msg = {
    role: "assistant",
    name: chat.persona.name,
    provider: sel?.provider,
    modelId: sel?.id,
    modelLabel: modelLabel(sel),
    text: "",
    thinking: "",
    notices: [],
  };
  chat.messages.push(msg);
  document.querySelectorAll(".msg.last").forEach((n) => {
    n.classList.remove("last");
    $('[data-act="retry"]', n)?.remove();
  });
  const el = aiEl(msg, true);
  $("#messages").append(el);
  $("#empty").hidden = true;
  updateAiEl(el, msg, true);
  scrollToBottom(true);

  const controller = new AbortController();
  streaming = { controller, chatId: chat.id };
  setComposerState();

  let frame = 0;
  const paint = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      updateAiEl(el, msg, true);
      scrollToBottom();
    });
  };
  const handlers = {
    text: (d) => (msg.text += d.text),
    thinking: (d) => (msg.thinking += d.text),
    notice: (d) => msg.notices.push(d.message),
  };
  const wrap = (fn) => (d) => (fn(d), paint());
  for (const k of Object.keys(handlers)) handlers[k] = wrap(handlers[k]);

  try {
    const problem = selectionProblem(sel);
    if (problem) throw new Error(problem);
    const common = { name: chat.persona.name, personality: chat.persona.personality, effort: settings.effort };

    if (sel.provider === "cloud") {
      await streamSse("api/chat", { ...common, messages: cloudHistory(chat) }, controller.signal, {
        ...handlers,
        done: (data) => finishCloudTurn(msg, data),
      });
    } else if (sel.provider === "ollama") {
      await streamSse("api/local/chat", { ...common, model: sel.id, messages: textHistory(chat) }, controller.signal, {
        ...handlers,
        done: (data) => {
          msg.text = data.content || msg.text;
          msg.content = msg.text;
          if (data.thinking) msg.thinking = data.thinking;
          msg.tokensPerSecond = data.tokensPerSecond;
          if (data.stop_reason === "max_tokens") msg.notices.push("Reply hit the length limit — ask me to continue.");
        },
      });
    } else {
      const info = browserAI.BROWSER_MODELS.find((m) => m.id === sel.id);
      if (browserAI.loadedModel() !== sel.id) {
        const first = !env.cached.has(sel.id);
        msg.progress = { label: first ? `Downloading ${info.label} (${info.gb} GB, one time only)…` : `Loading ${info.label} onto your GPU…`, pct: 0 };
        paint();
        await browserAI.load(sel.id, ({ progress, text }) => {
          msg.progress.pct = progress;
          msg.progress.text = text;
          paint();
        });
        env.cached.add(sel.id);
        msg.progress = null;
        if (controller.signal.aborted) throw Object.assign(new Error("Stopped"), { name: "AbortError" });
      }
      const result = await browserAI.chat({
        id: sel.id,
        system: buildSystemPrompt(chat.persona.name, chat.persona.personality),
        messages: textHistory(chat),
        effort: settings.effort,
        signal: controller.signal,
        onThinking: (t) => handlers.thinking({ text: t }),
        onText: (t) => handlers.text({ text: t }),
      });
      msg.text = result.text;
      msg.content = result.text;
      msg.thinking = result.thinking;
      msg.tokensPerSecond = result.tokensPerSecond;
      if (result.stopReason === "max_tokens") msg.notices.push("Reply hit the length limit — ask me to continue.");
    }
  } catch (err) {
    msg.progress = null;
    if (err.name === "AbortError") {
      // Keep whatever arrived so the conversation stays coherent.
      if (msg.text) msg.content = msg.provider === "cloud" ? [{ type: "text", text: msg.text }] : msg.text;
      else msg.excluded = true;
      msg.notices.push("Stopped.");
    } else {
      msg.excluded = true;
      msg.error = err.message || "Something went wrong.";
    }
  } finally {
    cancelAnimationFrame(frame);
    frame = 0;
    streaming = null;
    chat.updatedAt = Date.now();
    saveChats();
    if (activeId === chat.id) updateAiEl(el, msg, false);
    renderChatList();
    setComposerState();
  }
}

function finishCloudTurn(msg, data) {
  if (data.stop_reason === "refusal") {
    msg.excluded = true;
    msg.text = "";
    msg.error = "I can't help with that one. Try rephrasing or asking something else.";
    return;
  }
  // Store the exact content blocks so thinking blocks are replayed unchanged next turn.
  msg.content = data.content;
  const finalText = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  if (finalText) msg.text = finalText;
  if (data.stop_reason === "max_tokens") msg.notices.push("Reply hit the length limit — ask me to continue.");
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------
const input = $("#input");
function autosize() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 220) + "px";
}
function setComposerState() {
  const btn = $("#send");
  btn.classList.toggle("stop", Boolean(streaming));
  btn.disabled = !streaming && !input.value.trim();
  btn.setAttribute("aria-label", streaming ? "Stop generating" : "Send");
}
input.addEventListener("input", () => {
  autosize();
  setComposerState();
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    $("#composer").requestSubmit();
  }
});
$("#composer").addEventListener("submit", (e) => {
  e.preventDefault();
  if (streaming) {
    streaming.controller.abort();
    return;
  }
  const text = input.value;
  input.value = "";
  autosize();
  send(text);
});

$("#new-chat").addEventListener("click", () => {
  openChat(null);
  closeSidebar();
});
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openChat(null);
  }
});

$("#mode").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-effort]");
  if (!b) return;
  settings.effort = b.dataset.effort;
  saveSettings();
  applyAppearance();
  toast(`${b.textContent} mode`);
});

$("#theme-toggle").addEventListener("click", () => {
  settings.theme = settings.theme === "dark" ? "light" : "dark";
  saveSettings();
  applyAppearance();
});

function renderSuggestions() {
  $("#suggestions").replaceChildren(
    ...SUGGESTIONS.map(([title, prompt]) =>
      h("button", { class: "suggestion", onclick: () => send(prompt) }, h("strong", {}, title), h("span", {}, prompt)),
    ),
  );
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const prev = btn.innerHTML;
      btn.innerHTML = btn.innerHTML.replace(/<svg[\s\S]*?<\/svg>/, ICONS.check).replace(/>Copy</, ">Copied<");
      setTimeout(() => (btn.innerHTML = prev), 1400);
    }
  } catch {
    toast("Couldn't copy to clipboard");
  }
}
$("#messages").addEventListener("click", (e) => {
  const b = e.target.closest(".copy-code");
  if (b) copyText($("code", b.closest(".codeblock")).textContent, b);
});

let toastTimer;
function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

// ---------------------------------------------------------------------------
// Local AI dialog
// ---------------------------------------------------------------------------
const localDlg = $("#local");
let localTab = "ollama";

function openLocal(tab) {
  closeMenu();
  closeSidebar();
  if (tab) localTab = tab;
  else if (!env.server) localTab = "browser";
  switchTab(localTab);
  if (!localDlg.open) localDlg.showModal();
  refreshOllama().then(renderOllamaPanel);
}
function switchTab(tab) {
  localTab = tab;
  localDlg.querySelectorAll("[role=tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
  localDlg.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== tab));
  tab === "ollama" ? renderOllamaPanel() : renderBrowserPanel();
}
localDlg.querySelector(".tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[role=tab]");
  if (b) switchTab(b.dataset.tab);
});
$("#open-local").addEventListener("click", () => openLocal());
$("#close-local").addEventListener("click", () => localDlg.close());
localDlg.addEventListener("click", (e) => {
  if (e.target === localDlg) localDlg.close();
});

const cmdRow = (cmd) =>
  h("div", { class: "cmd" }, h("code", {}, cmd), h("button", { class: "tool", type: "button", title: "Copy", html: ICONS.copy, onclick: (e) => copyText(cmd, e.currentTarget) }));

function progressBlock(p) {
  return [
    h("div", { class: "progress" }, h("i", { style: `width:${Math.round((p.pct || 0) * 100)}%` })),
    h("div", { class: "progress-text" }, p.status || p.text || ""),
  ];
}

function useButton(sel) {
  const current = settings.model?.provider === sel.provider && settings.model?.id === sel.id;
  return h(
    "button",
    {
      class: "sm-btn" + (current ? "" : " primary"),
      disabled: current,
      onclick: () => {
        setModel(sel);
        toast(`Now chatting with ${modelLabel(sel)}`);
        localTab === "ollama" ? renderOllamaPanel() : renderBrowserPanel();
      },
    },
    current ? "In use" : "Use",
  );
}

function renderOllamaPanel() {
  const panel = $("#panel-ollama");
  if (localTab !== "ollama" || !localDlg.open) return;
  const o = env.ollama;
  const kids = [];

  if (!env.server) {
    kids.push(
      h("div", { class: "status bad" }, h("span", { class: "dot" }), h("span", { class: "grow" }, "This page is running without the FREELM server, so it can't reach Ollama.")),
      h("p", { class: "fine" }, "Run FREELM on your computer (", h("code", {}, "npm start"), ") to use models installed there. Browser models still work here."),
    );
    return panel.replaceChildren(...kids);
  }

  if (o.available) {
    kids.push(
      h(
        "div",
        { class: "status ok" },
        h("span", { class: "dot" }),
        h("span", { class: "grow" }, `Ollama is running · ${o.models.length} model${o.models.length === 1 ? "" : "s"} installed`),
        h("button", { class: "sm-btn", onclick: () => refreshOllama().then(renderOllamaPanel) }, "Refresh"),
      ),
    );
  } else {
    kids.push(
      h(
        "div",
        { class: "status bad" },
        h("span", { class: "dot" }),
        h("span", { class: "grow" }, o.checked ? "Ollama isn't running on this computer yet." : "Checking for Ollama…"),
        h("button", { class: "sm-btn", onclick: () => refreshOllama().then(renderOllamaPanel) }, "Check again"),
      ),
      h("div", { class: "section-title" }, "Set up in 2 minutes"),
      h(
        "ol",
        { class: "steps" },
        h(
          "li",
          {},
          h("strong", {}, "Install Ollama"),
          " — the free engine that runs AI models on your computer. ",
          h("a", { class: "menu-link", href: "https://ollama.com/download", target: "_blank", rel: "noopener" }, "Download for Mac or Windows"),
          ", or on Linux run:",
          cmdRow("curl -fsSL https://ollama.com/install.sh | sh"),
        ),
        h("li", {}, h("strong", {}, "Open it"), " — it runs quietly in the background. On Linux it starts automatically, or run ", h("code", {}, "ollama serve"), "."),
        h("li", {}, h("strong", {}, "Come back here"), " and press ", h("em", {}, "Check again"), ", then download a model below."),
      ),
    );
  }

  if (o.models.length) {
    kids.push(h("div", { class: "section-title" }, "Installed"));
    kids.push(
      h(
        "div",
        { class: "model-grid" },
        o.models.map((m) =>
          h(
            "div",
            { class: "model-card" },
            h("div", { class: "row" }, h("span", { class: "name grow" }, m.name), h("span", { class: "badge ok" }, "Ready")),
            h("div", { class: "meta" }, [m.parameterSize, m.quantization, fmtGB(m.size)].filter(Boolean).join(" · ")),
            h(
              "div",
              { class: "actions" },
              useButton({ provider: "ollama", id: m.name }),
              h(
                "button",
                {
                  class: "sm-btn danger",
                  onclick: async () => {
                    if (!confirm(`Delete ${m.name} from this computer?`)) return;
                    const res = await fetch(`api/local/models/${encodeURIComponent(m.name)}`, { method: "DELETE", headers: authHeaders() });
                    if (!res.ok) toast((await res.json().catch(() => ({}))).error || "Couldn't delete");
                    await refreshOllama();
                    ensureModel();
                    renderOllamaPanel();
                  },
                },
                "Delete",
              ),
            ),
          ),
        ),
      ),
    );
  }

  const installed = new Set(o.models.map((m) => m.name));
  kids.push(h("div", { class: "section-title" }, "Download a model"));
  kids.push(
    h(
      "div",
      { class: "model-grid" },
      OLLAMA_SUGGESTED.filter((m) => !installed.has(m.name)).map((m) => {
        const p = pulls.get(m.name);
        return h(
          "div",
          { class: "model-card" + (m.rec ? " rec" : "") },
          h("div", { class: "row" }, h("span", { class: "name grow" }, m.name), h("span", { class: "badge" }, `${m.gb} GB`)),
          h("div", { class: "meta" }, m.note),
          p
            ? progressBlock(p)
            : h("div", { class: "actions" }, h("button", { class: "sm-btn primary", disabled: !o.available, onclick: () => pullModel(m.name) }, "Download")),
        );
      }),
    ),
  );
  const custom = h("input", { placeholder: "Any model from ollama.com/library, e.g. mistral-small3.2:24b", "aria-label": "Model name" });
  const customPulls = [...pulls.entries()].filter(([name]) => !OLLAMA_SUGGESTED.some((m) => m.name === name));
  kids.push(
    h(
      "form",
      {
        class: "custom-pull",
        onsubmit: (e) => {
          e.preventDefault();
          if (custom.value.trim()) pullModel(custom.value.trim());
        },
      },
      custom,
      h("button", { class: "sm-btn primary", disabled: !o.available }, "Download"),
    ),
    ...customPulls.map(([name, p]) => h("div", { class: "model-card" }, h("div", { class: "name" }, name), progressBlock(p))),
    h("p", { class: "fine" }, "Tip: pick a model whose download is under about half your computer's memory. A graphics card (NVIDIA, AMD or Apple Silicon) makes replies much faster."),
  );
  panel.replaceChildren(...kids);
}

async function pullModel(name) {
  if (pulls.has(name)) return;
  const controller = new AbortController();
  const state = { status: "Starting download…", pct: 0, controller };
  pulls.set(name, state);
  renderOllamaPanel();
  let last = 0;
  try {
    await streamSse("api/local/pull", { model: name }, controller.signal, {
      progress: (d) => {
        state.status = d.total ? `${d.status} · ${fmtGB(d.completed)} of ${fmtGB(d.total)}` : d.status;
        state.pct = d.total ? d.completed / d.total : state.pct;
        if (Date.now() - last > 250) {
          last = Date.now();
          renderOllamaPanel();
        }
      },
    });
    toast(`${name} is ready`);
    pulls.delete(name);
    await refreshOllama();
    if (!settings.model || settings.model.provider !== "ollama" || selectionProblem(settings.model)) setModel({ provider: "ollama", id: name });
  } catch (err) {
    pulls.delete(name);
    toast(err.message);
  }
  renderOllamaPanel();
}

function renderBrowserPanel() {
  const panel = $("#panel-browser");
  if (localTab !== "browser" || !localDlg.open) return;
  const kids = [];
  if (!env.webgpu.ok) {
    kids.push(
      h("div", { class: "status bad" }, h("span", { class: "dot" }), h("span", { class: "grow" }, env.webgpu.checked ? env.webgpu.reason : "Checking your GPU…")),
      h(
        "p",
        { class: "fine" },
        "Browser models need WebGPU: Chrome or Edge 113+ on Windows, Mac or ChromeOS, Safari 26+, or Chrome on recent Android phones. The page must be opened over https:// or on localhost.",
      ),
    );
  } else {
    kids.push(
      h(
        "div",
        { class: "status ok" },
        h("span", { class: "dot" }),
        h("span", { class: "grow" }, "Your GPU is ready. Models download once, are saved in this browser, and then run fully offline."),
      ),
    );
  }
  kids.push(
    h(
      "div",
      { class: "model-grid" },
      browserAI.BROWSER_MODELS.map((m) => {
        const p = browserLoads.get(m.id);
        const cached = env.cached.has(m.id);
        return h(
          "div",
          { class: "model-card" + (m.recommended ? " rec" : "") },
          h(
            "div",
            { class: "row" },
            h("span", { class: "name grow" }, m.label),
            h("span", { class: "badge" + (cached ? " ok" : "") }, cached ? "Downloaded" : `${m.gb} GB`),
          ),
          h("div", { class: "meta" }, m.note + (m.thinks ? " · can think" : "")),
          p
            ? progressBlock(p)
            : h(
                "div",
                { class: "actions" },
                useButton({ provider: "browser", id: m.id }),
                cached
                  ? h(
                      "button",
                      {
                        class: "sm-btn danger",
                        onclick: async () => {
                          await browserAI.removeFromCache(m.id);
                          env.cached.delete(m.id);
                          renderBrowserPanel();
                          toast(`Removed ${m.label}`);
                        },
                      },
                      "Delete",
                    )
                  : h("button", { class: "sm-btn", disabled: !env.webgpu.ok, onclick: () => downloadBrowserModel(m) }, "Download"),
              ),
        );
      }),
    ),
    h("p", { class: "fine" }, "Bigger models are smarter but need more graphics memory. If a model fails to load, try a smaller one."),
  );
  panel.replaceChildren(...kids);
}

async function downloadBrowserModel(m) {
  if (streaming) return toast("Wait for the current reply to finish.");
  browserLoads.set(m.id, { pct: 0, text: "Starting…" });
  renderBrowserPanel();
  let last = 0;
  try {
    await browserAI.load(m.id, ({ progress, text }) => {
      browserLoads.set(m.id, { pct: progress, text });
      if (Date.now() - last > 250) {
        last = Date.now();
        renderBrowserPanel();
      }
    });
    env.cached.add(m.id);
    toast(`${m.label} is ready`);
  } catch (err) {
    toast(`Couldn't load ${m.label}: ${err.message}`);
  }
  browserLoads.delete(m.id);
  renderBrowserPanel();
}

// ---------------------------------------------------------------------------
// Settings dialog
// ---------------------------------------------------------------------------
const dlg = $("#settings");
const form = $("#settings-form");
let draftAccent = settings.accent;

function renderSwatches() {
  $("#swatches").replaceChildren(
    ...ACCENTS.map((c) => {
      const b = h("button", { type: "button", class: "swatch", role: "radio", "aria-label": c, "aria-checked": String(c === draftAccent) });
      b.style.setProperty("--c", c);
      b.addEventListener("click", () => {
        draftAccent = c;
        document.documentElement.style.setProperty("--accent", c);
        renderSwatches();
      });
      return b;
    }),
  );
}
$("#presets").replaceChildren(
  ...Object.entries(PRESETS).map(([label, text]) =>
    h("button", { type: "button", class: "chip", onclick: () => (form.personality.value = text) }, label),
  ),
);

$("#open-settings").addEventListener("click", () => {
  form.name.value = settings.name;
  form.personality.value = settings.personality;
  draftAccent = settings.accent;
  renderSwatches();
  closeSidebar();
  dlg.showModal();
});
dlg.addEventListener("close", () => {
  if (dlg.returnValue === "save") {
    settings.name = form.name.value.trim() || defaults.name;
    settings.personality = form.personality.value.trim();
    settings.accent = draftAccent;
    saveSettings();
    toast("Saved — new chats will use these settings");
  }
  applyAppearance();
  if (!activeChat()) renderThread();
});
$("#clear-all").addEventListener("click", () => {
  if (!confirm("Delete every chat? This can't be undone.")) return;
  streaming?.controller.abort();
  chats = [];
  saveChats();
  dlg.close("cancel");
  openChat(null);
});

// ---------------------------------------------------------------------------
// Password gate
// ---------------------------------------------------------------------------
function showUnlock() {
  const d = $("#unlock");
  if (!d.open) d.showModal();
}
$("#unlock").addEventListener("cancel", (e) => e.preventDefault());
$("#unlock-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const candidate = e.target.password.value;
  const res = await fetch("api/unlock", { method: "POST", headers: { "x-app-password": candidate } });
  if (res.ok) {
    password = candidate;
    store.set("freelm.password", password);
    $("#unlock-error").hidden = true;
    $("#unlock").close();
    refreshOllama().then(ensureModel);
  } else {
    $("#unlock-error").hidden = false;
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
applyAppearance();
renderSuggestions();
renderModelButton();
openChat(chats.sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null);
setComposerState();
detect();
