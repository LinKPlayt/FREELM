import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const MODEL = process.env.AI_MODEL || "claude-opus-5-5";
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const OLLAMA_HOST = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/+$/, "").replace(/^(?!https?:\/\/)/, "http://");
const LOCAL_CONTEXT = Number(process.env.LOCAL_CONTEXT) || 0; // 0 = Ollama's default
const CLOUD_ENABLED =
  process.env.CLOUD_ENABLED === "0"
    ? false
    : Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.CLOUD_ENABLED === "1");
const EFFORTS = new Set(["low", "medium", "high"]);

let anthropic = null;
const cloudClient = () => (anthropic ??= new Anthropic());

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "4mb" }));

// ---- Static assets -------------------------------------------------------
app.use(express.static(path.join(here, "public")));
const vendor = (route, file) =>
  app.get(route, (_req, res) => res.sendFile(path.join(here, "node_modules", file)));
vendor("/vendor/marked.js", "marked/lib/marked.umd.js");
vendor("/vendor/purify.js", "dompurify/dist/purify.min.js");
vendor("/vendor/highlight.js", "@highlightjs/cdn-assets/highlight.min.js");
vendor("/vendor/hl-light.css", "@highlightjs/cdn-assets/styles/github.min.css");
vendor("/vendor/hl-dark.css", "@highlightjs/cdn-assets/styles/github-dark.min.css");
vendor("/vendor/web-llm.js", "@mlc-ai/web-llm/lib/index.js");

// ---- Optional password gate ---------------------------------------------
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function requireAuth(req, res, next) {
  if (!APP_PASSWORD) return next();
  const supplied = req.get("x-app-password") || "";
  if (safeEqual(supplied, APP_PASSWORD)) return next();
  res.status(401).json({ error: "Password required" });
}

app.get("/api/config", (_req, res) => {
  res.json({
    passwordRequired: Boolean(APP_PASSWORD),
    cloud: { enabled: CLOUD_ENABLED, model: MODEL },
    ollama: { enabled: true },
  });
});
app.post("/api/unlock", requireAuth, (_req, res) => res.json({ ok: true }));

// ---- Shared helpers -----------------------------------------------------
// Kept free of timestamps or per-request values so the prefix stays cacheable.
function buildSystemPrompt(name, personality) {
  const safeName = String(name || "FREELM").slice(0, 60);
  const persona = String(personality || "").slice(0, 4000).trim();
  return [
    `You are ${safeName}, a personal AI assistant living inside the user's own private web app.`,
    "Talk like a sharp, warm, genuinely helpful companion. Match the length of your answer to the question: short for quick questions, thorough when depth helps.",
    "Format with Markdown when it improves readability (headings for long answers, lists for steps, fenced code blocks with a language tag for code). Avoid filler and needless disclaimers.",
    persona ? `\nPersonality and instructions from the user:\n${persona}` : "",
  ].join("\n");
}

function openSse(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  return (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ---- Cloud (Claude) -----------------------------------------------------
// Assistant turns are stored client-side with their full content blocks so
// thinking blocks can be replayed unchanged. If a turn contains a mid-output
// fallback, blocks before the final fallback marker that the next model
// cannot continue from are dropped, per the fallback echo rules.
const ALLOWED_BLOCKS = new Set(["text", "thinking", "redacted_thinking", "fallback"]);
function sanitizeAssistantContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  let blocks = content.filter((b) => b && ALLOWED_BLOCKS.has(b.type));
  const lastFallback = blocks.map((b) => b.type).lastIndexOf("fallback");
  if (lastFallback > 0) {
    blocks = blocks.filter(
      (b, i) => i >= lastFallback || (b.type !== "thinking" && b.type !== "redacted_thinking"),
    );
  }
  return blocks.filter((b) => b.type !== "text" || b.text);
}

function sanitizeMessages(raw, { textOnly = false } = {}) {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("No messages supplied");
  if (raw.length > 400) throw new Error("Conversation is too long");
  const out = raw.map((m) => {
    if (m?.role === "user") return { role: "user", content: String(m.content ?? "").slice(0, 100_000) };
    if (m?.role === "assistant") {
      if (textOnly) return { role: "assistant", content: String(m.content ?? "").slice(0, 100_000) };
      return { role: "assistant", content: sanitizeAssistantContent(m.content) };
    }
    throw new Error("Invalid message role");
  });
  if (out[out.length - 1].role !== "user") throw new Error("Last message must be from the user");
  return out.filter((m) => (Array.isArray(m.content) ? m.content.length > 0 : m.content));
}

app.post("/api/chat", requireAuth, async (req, res) => {
  if (!CLOUD_ENABLED) {
    return res.status(503).json({ error: "Cloud AI isn't set up. Add ANTHROPIC_API_KEY to .env, or switch to a local model." });
  }
  let messages;
  try {
    messages = sanitizeMessages(req.body?.messages);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const effort = EFFORTS.has(req.body?.effort) ? req.body.effort : "low";
  const system = buildSystemPrompt(req.body?.name, req.body?.personality);
  const send = openSse(res);

  const stream = cloudClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    system,
    messages,
    thinking: { type: "adaptive", display: "summarized" },
    output_config: { effort },
    cache_control: { type: "ephemeral" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  // Stop generating (and billing) when the browser disconnects or hits Stop.
  res.on("close", () => {
    if (!res.writableEnded) stream.abort();
  });

  try {
    for await (const event of stream) {
      if (event.type === "content_block_start" && event.content_block.type === "fallback") {
        send("notice", { message: "Switched to a fallback model to finish this reply." });
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") send("text", { text: event.delta.text });
        else if (event.delta.type === "thinking_delta") send("thinking", { text: event.delta.thinking });
      }
    }
    const final = await stream.finalMessage();
    send("done", {
      content: final.content,
      stop_reason: final.stop_reason,
      stop_details: final.stop_details ?? null,
      model: final.model,
      usage: final.usage,
    });
  } catch (err) {
    if (stream.aborted || res.destroyed) return;
    send("error", { message: describeCloudError(err) });
  } finally {
    if (!res.writableEnded) res.end();
  }
});

function describeCloudError(err) {
  if (err instanceof Anthropic.AuthenticationError)
    return "The server's Anthropic API key is missing or invalid. Set ANTHROPIC_API_KEY in your .env file.";
  if (err instanceof Anthropic.PermissionDeniedError)
    return "This API key doesn't have access to the configured model.";
  if (err instanceof Anthropic.RateLimitError)
    return "Rate limit reached. Give it a moment and try again.";
  if (err instanceof Anthropic.BadRequestError) return `Request rejected: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError)
    return "Couldn't reach the AI service. Check the server's internet connection.";
  if (err instanceof Anthropic.APIError) return `AI service error (${err.status ?? "unknown"}). Please try again.`;
  console.error(err);
  return "Something went wrong on the server.";
}

// ---- Local (Ollama on this machine) -------------------------------------
const MODEL_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._\-/:]{0,199}$/;
const OLLAMA_DOWN =
  "The local AI engine (Ollama) isn't running on this computer. Install it from ollama.com and make sure it's started.";

async function ollama(pathname, { method = "POST", body, signal } = {}) {
  let res;
  try {
    res = await fetch(OLLAMA_HOST + pathname, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    const e = new Error(OLLAMA_DOWN);
    e.code = "OLLAMA_DOWN";
    throw e;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text;
    try {
      message = JSON.parse(text).error || text;
    } catch {}
    const e = new Error(message || `Ollama error (${res.status})`);
    e.status = res.status;
    throw e;
  }
  return res;
}

// Read an NDJSON stream line by line.
async function* ndjson(res) {
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) yield JSON.parse(line);
    }
  }
  if (buf.trim()) yield JSON.parse(buf);
}

const showCache = new Map();
async function modelInfo(model) {
  if (showCache.has(model)) return showCache.get(model);
  const info = await (await ollama("/api/show", { body: { model } })).json();
  const slim = { capabilities: info.capabilities || [], thinking: info.thinking || null };
  showCache.set(model, slim);
  return slim;
}

// Map the app's Quick / Balanced / Deep modes onto whatever thinking control the model offers.
function pickThink(info, effort) {
  const values = info.thinking?.values;
  if (Array.isArray(values)) {
    const strings = values.filter((v) => typeof v === "string");
    if (strings.length) {
      if (strings.includes(effort)) return effort;
      const order = ["low", "medium", "high"];
      const idx = Math.min(order.indexOf(effort), strings.length - 1);
      return strings[Math.max(0, idx)];
    }
    if (values.includes(true) && values.includes(false)) return effort !== "low";
    if (values.includes(true)) return true;
    return undefined; // [false] means no thinking support
  }
  if (info.capabilities.includes("thinking")) return effort !== "low";
  return undefined;
}

function localError(err) {
  if (err.code === "OLLAMA_DOWN") return err.message;
  if (err.status === 404) return `That model isn't installed. Download it from the model menu first. (${err.message})`;
  return `Local AI error: ${err.message}`;
}

app.get("/api/local/models", requireAuth, async (_req, res) => {
  try {
    const data = await (await ollama("/api/tags", { method: "GET" })).json();
    const models = (data.models || []).map((m) => ({
      name: m.name || m.model,
      size: m.size || 0,
      parameterSize: m.details?.parameter_size || "",
      family: m.details?.family || "",
      quantization: m.details?.quantization_level || "",
    }));
    models.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ available: true, models });
  } catch (err) {
    res.json({ available: false, models: [], error: localError(err) });
  }
});

app.delete("/api/local/models/:name", requireAuth, async (req, res) => {
  const model = req.params.name;
  if (!MODEL_NAME_RE.test(model)) return res.status(400).json({ error: "Invalid model name" });
  try {
    await ollama("/api/delete", { method: "DELETE", body: { model } });
    showCache.delete(model);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: localError(err) });
  }
});

app.post("/api/local/pull", requireAuth, async (req, res) => {
  const model = String(req.body?.model || "").trim();
  if (!MODEL_NAME_RE.test(model)) return res.status(400).json({ error: "Invalid model name" });
  const send = openSse(res);
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  try {
    const upstream = await ollama("/api/pull", { body: { model, stream: true }, signal: controller.signal });
    for await (const evt of ndjson(upstream)) {
      if (evt.error) throw new Error(evt.error);
      send("progress", { status: evt.status, completed: evt.completed || 0, total: evt.total || 0 });
    }
    showCache.delete(model);
    send("done", { model });
  } catch (err) {
    if (controller.signal.aborted) return;
    send("error", { message: localError(err) });
  } finally {
    if (!res.writableEnded) res.end();
  }
});

app.post("/api/local/chat", requireAuth, async (req, res) => {
  const model = String(req.body?.model || "");
  if (!MODEL_NAME_RE.test(model)) return res.status(400).json({ error: "Pick a local model first." });
  let messages;
  try {
    messages = sanitizeMessages(req.body?.messages, { textOnly: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const effort = EFFORTS.has(req.body?.effort) ? req.body.effort : "low";
  const system = buildSystemPrompt(req.body?.name, req.body?.personality);

  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  let upstream;
  try {
    const info = await modelInfo(model);
    const body = {
      model,
      messages: [{ role: "system", content: system }, ...messages],
      stream: true,
      keep_alive: "30m",
      ...(LOCAL_CONTEXT ? { options: { num_ctx: LOCAL_CONTEXT } } : {}),
    };
    const think = pickThink(info, effort);
    if (think !== undefined) body.think = think;
    try {
      upstream = await ollama("/api/chat", { body, signal: controller.signal });
    } catch (err) {
      // Older Ollama versions reject `think` for models without the capability.
      if (err.status === 400 && "think" in body && /think/i.test(err.message)) {
        delete body.think;
        upstream = await ollama("/api/chat", { body, signal: controller.signal });
      } else throw err;
    }
  } catch (err) {
    if (controller.signal.aborted) return;
    return res.status(err.code === "OLLAMA_DOWN" ? 503 : 502).json({ error: localError(err) });
  }

  const send = openSse(res);
  let text = "";
  let thinking = "";
  try {
    for await (const evt of ndjson(upstream)) {
      if (evt.error) throw new Error(evt.error);
      const t = evt.message?.thinking;
      const c = evt.message?.content;
      if (t) {
        thinking += t;
        send("thinking", { text: t });
      }
      if (c) {
        text += c;
        send("text", { text: c });
      }
      if (evt.done) {
        const seconds = (evt.eval_duration || 0) / 1e9;
        send("done", {
          content: text,
          thinking,
          stop_reason: evt.done_reason === "length" ? "max_tokens" : "end_turn",
          model,
          usage: { input_tokens: evt.prompt_eval_count || 0, output_tokens: evt.eval_count || 0 },
          tokensPerSecond: seconds ? Math.round((evt.eval_count || 0) / seconds) : null,
        });
      }
    }
  } catch (err) {
    if (controller.signal.aborted) return;
    send("error", { message: localError(err) });
  } finally {
    if (!res.writableEnded) res.end();
  }
});

app.listen(PORT, HOST, () => {
  console.log(`FREELM is running at http://localhost:${PORT}`);
  console.log(`  Cloud AI (Claude): ${CLOUD_ENABLED ? `on (${MODEL})` : "off — set ANTHROPIC_API_KEY to enable"}`);
  console.log(`  Local AI (Ollama): ${OLLAMA_HOST}`);
  if (APP_PASSWORD) console.log("  Password protection is ON.");
});
