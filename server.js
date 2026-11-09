import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.AI_MODEL || "claude-opus-5-5";
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const EFFORTS = new Set(["low", "medium", "high"]);

const client = new Anthropic();
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
  res.json({ passwordRequired: Boolean(APP_PASSWORD), model: MODEL });
});
app.post("/api/unlock", requireAuth, (_req, res) => res.json({ ok: true }));

// ---- Prompt -------------------------------------------------------------
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
  // A text block must not be empty.
  return blocks.filter((b) => b.type !== "text" || b.text);
}

function sanitizeMessages(raw) {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("No messages supplied");
  if (raw.length > 400) throw new Error("Conversation is too long");
  const out = raw.map((m) => {
    if (m?.role === "user") {
      const text = String(m.content ?? "").slice(0, 100_000);
      return { role: "user", content: text };
    }
    if (m?.role === "assistant") {
      return { role: "assistant", content: sanitizeAssistantContent(m.content) };
    }
    throw new Error("Invalid message role");
  });
  if (out[out.length - 1].role !== "user") throw new Error("Last message must be from the user");
  return out.filter((m) => (Array.isArray(m.content) ? m.content.length > 0 : m.content));
}

// ---- Chat endpoint (Server-Sent Events) ---------------------------------
app.post("/api/chat", requireAuth, async (req, res) => {
  let messages;
  try {
    messages = sanitizeMessages(req.body?.messages);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const effort = EFFORTS.has(req.body?.effort) ? req.body.effort : "low";
  const system = buildSystemPrompt(req.body?.name, req.body?.personality);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const stream = client.beta.messages.stream({
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
    send("error", { message: describeError(err) });
  } finally {
    if (!res.writableEnded) res.end();
  }
});

function describeError(err) {
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

app.listen(PORT, () => {
  console.log(`FREELM is running at http://localhost:${PORT}`);
  if (APP_PASSWORD) console.log("Password protection is ON.");
});
