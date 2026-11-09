/* FREELM — client */
const $ = (sel, el = document) => el.querySelector(sel);

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

const defaults = { name: "FREELM", personality: "", accent: ACCENTS[0], theme: "dark", effort: "low" };
let settings = { ...defaults, ...store.get("freelm.settings", {}) };
let chats = store.get("freelm.chats", []);
let activeId = null;
let streaming = null; // { controller, chatId }
let password = store.get("freelm.password", "");

const saveChats = () => store.set("freelm.chats", chats);
const saveSettings = () => store.set("freelm.settings", settings);
const activeChat = () => chats.find((c) => c.id === activeId) || null;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------
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

const ICONS = {
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  retry: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
};

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
    const empty = document.createElement("div");
    empty.className = "chat-empty";
    empty.textContent = q ? "No chats match your search." : "Your conversations will appear here.";
    list.append(empty);
    return;
  }
  let lastGroup = null;
  for (const chat of items) {
    const g = groupLabel(chat.updatedAt);
    if (g !== lastGroup) {
      const h = document.createElement("div");
      h.className = "chat-group";
      h.textContent = g;
      list.append(h);
      lastGroup = g;
    }
    const btn = document.createElement("button");
    btn.className = "chat-item" + (chat.id === activeId ? " active" : "");
    btn.dataset.id = chat.id;
    btn.innerHTML = `<span class="label"></span><span class="actions"><span data-act="rename" title="Rename">${ICONS.edit}</span><span data-act="delete" title="Delete">${ICONS.trash}</span></span>`;
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
  const input = document.createElement("input");
  input.value = chat.title;
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
  const el = document.createElement("div");
  el.className = "msg user";
  el.innerHTML = `<div class="bubble"></div><div class="tools"><button class="tool" data-act="copy" title="Copy">${ICONS.copy}</button></div>`;
  $(".bubble", el).textContent = m.text;
  $('[data-act="copy"]', el).addEventListener("click", (e) => copyText(m.text, e.currentTarget));
  return el;
}

function aiEl(m, isLast) {
  const el = document.createElement("div");
  el.className = "msg ai" + (isLast ? " last" : "");
  el.innerHTML = `
    <div class="orb orb-sm" aria-hidden="true"></div>
    <div class="body">
      <div class="who"></div>
      <details class="thought" hidden><summary>${ICONS.chevron}<span class="label">Thought process</span></summary><div class="thought-text"></div></details>
      <div class="md"></div>
      <div class="extra"></div>
      <div class="tools">
        <button class="tool" data-act="copy" title="Copy">${ICONS.copy}<span>Copy</span></button>
        <button class="tool" data-act="retry" title="Regenerate">${ICONS.retry}<span>Regenerate</span></button>
      </div>
    </div>`;
  $(".who", el).textContent = m.name || settings.name;
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
  if (m.text) {
    md.innerHTML = renderMarkdown(m.text);
    md.classList.toggle("cursor", live);
  } else if (live) {
    md.innerHTML = m.thinking ? "" : '<span class="typing"><i></i><i></i><i></i></span>';
  } else {
    md.innerHTML = "";
  }
  if (live && md.classList.contains("cursor")) {
    // Put the cursor on the last block so it trails the text.
    md.classList.remove("cursor");
    let last = md.lastElementChild;
    if (last && (last.tagName === "UL" || last.tagName === "OL")) last = last.lastElementChild;
    if (last && /^(P|LI|H[1-6]|BLOCKQUOTE)$/.test(last.tagName)) last.classList.add("cursor");
  }
  const extra = $(".extra", el);
  extra.replaceChildren();
  for (const n of m.notices || []) {
    const d = document.createElement("div");
    d.className = "notice";
    d.textContent = n;
    extra.append(d);
  }
  if (m.error) {
    const d = document.createElement("div");
    d.className = "error-card";
    d.textContent = m.error;
    extra.append(d);
  }
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
function buildPayloadMessages(chat) {
  const out = [];
  for (const m of chat.messages) {
    if (m.role === "user") {
      const prev = out[out.length - 1];
      if (prev?.role === "user") prev.content += "\n\n" + m.text;
      else out.push({ role: "user", content: m.text });
    } else if (m.content && !m.excluded) {
      out.push({ role: "assistant", content: m.content });
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

async function runAssistant(chat) {
  const msg = { role: "assistant", name: chat.persona.name, text: "", thinking: "", notices: [] };
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

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(password ? { "x-app-password": password } : {}) },
      body: JSON.stringify({
        messages: buildPayloadMessages(chat),
        name: chat.persona.name,
        personality: chat.persona.personality,
        effort: settings.effort,
      }),
      signal: controller.signal,
    });
    if (res.status === 401) {
      showUnlock();
      throw new Error("Unlock the app to keep chatting.");
    }
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Server error (${res.status})`);
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
        if (event === "text") msg.text += data.text;
        else if (event === "thinking") msg.thinking += data.text;
        else if (event === "notice") msg.notices.push(data.message);
        else if (event === "error") throw new Error(data.message);
        else if (event === "done") {
          finished = true;
          finishTurn(msg, data);
        }
        paint();
      }
    }
    if (!finished) throw new Error("The connection closed before the reply finished.");
  } catch (err) {
    if (err.name === "AbortError") {
      // Keep whatever arrived as a plain-text turn so the conversation stays coherent.
      if (msg.text) msg.content = [{ type: "text", text: msg.text }];
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

function finishTurn(msg, data) {
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

// Mode switch
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

// Suggestions
function renderSuggestions() {
  const box = $("#suggestions");
  box.replaceChildren(
    ...SUGGESTIONS.map(([title, prompt]) => {
      const b = document.createElement("button");
      b.className = "suggestion";
      b.innerHTML = "<strong></strong><span></span>";
      $("strong", b).textContent = title;
      $("span", b).textContent = prompt;
      b.addEventListener("click", () => send(prompt));
      return b;
    }),
  );
}

// Copy helpers
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
// Settings dialog
// ---------------------------------------------------------------------------
const dlg = $("#settings");
const form = $("#settings-form");
let draftAccent = settings.accent;

function renderSwatches() {
  $("#swatches").replaceChildren(
    ...ACCENTS.map((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "swatch";
      b.style.setProperty("--c", c);
      b.setAttribute("role", "radio");
      b.setAttribute("aria-label", c);
      b.setAttribute("aria-checked", String(c === draftAccent));
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
  ...Object.entries(PRESETS).map(([label, text]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = label;
    b.addEventListener("click", () => (form.personality.value = text));
    return b;
  }),
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
  const res = await fetch("/api/unlock", { method: "POST", headers: { "x-app-password": candidate } });
  if (res.ok) {
    password = candidate;
    store.set("freelm.password", password);
    $("#unlock-error").hidden = true;
    $("#unlock").close();
  } else {
    $("#unlock-error").hidden = false;
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
applyAppearance();
renderSuggestions();
openChat(chats.sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null);
setComposerState();

fetch("/api/config")
  .then((r) => r.json())
  .then(async (cfg) => {
    if (!cfg.passwordRequired) return;
    const ok = password && (await fetch("/api/unlock", { method: "POST", headers: { "x-app-password": password } })).ok;
    if (!ok) showUnlock();
  })
  .catch(() => {});
