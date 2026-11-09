# FREELM

Your own personal AI web app: a chat interface with an assistant you can name, give a personality, and restyle.

![FREELM](public/icon.svg)

## Features

- **Your own AI identity.** Pick a name, write a personality (or use a preset), and choose an accent color. Each chat keeps the persona it started with.
- **Live streaming replies** with a collapsible "Thought process" panel showing a summary of the AI's reasoning.
- **Three response modes:** Quick, Balanced and Deep. They trade speed for how much the AI reasons.
- **Rich formatting:** Markdown, tables, and syntax-highlighted code blocks with a copy button.
- **Chat history** saved in your browser, grouped by date, with search, rename and delete.
- **Stop and regenerate** buttons, plus keyboard shortcuts (`Enter` to send, `Shift+Enter` for a new line, `Ctrl/⌘+K` for a new chat).
- **Dark and light themes**, and a layout that works on phones.
- **Optional password lock** if you host it online.

## Quick start

You need [Node.js 22+](https://nodejs.org/) and an Anthropic API key from [console.anthropic.com](https://console.anthropic.com/).

```bash
npm install
cp .env.example .env      # then paste your API key into .env
npm start
```

Open http://localhost:3000.

For development, `npm run dev` restarts the server automatically when you edit files.

## Configuration (`.env`)

| Variable            | Default            | What it does                                              |
| ------------------- | ------------------ | --------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | (required)         | Your Anthropic API key                                    |
| `PORT`              | `3000`             | Port the server listens on                                |
| `APP_PASSWORD`      | (unset)            | If set, visitors must enter this password before chatting |
| `AI_MODEL`          | `claude-opus-5-5`  | Model that powers the assistant                           |

> If you deploy FREELM somewhere public, set `APP_PASSWORD`. Otherwise anyone with the URL can use your API key.

## How it works

```
public/        Frontend (vanilla HTML/CSS/JS, no build step)
  index.html   Layout, settings and unlock dialogs
  styles.css   Design system: tokens, light/dark themes, components
  app.js       Chat state, streaming, Markdown rendering, settings
server.js      Express server: serves the UI and streams replies from the Anthropic API over SSE
```

- The browser sends the conversation to `POST /api/chat`. The server calls the Anthropic Messages API with streaming on and passes the text back to the page as Server-Sent Events.
- The API key stays on the server and is never sent to the browser.
- Conversations are stored in your browser's `localStorage`. Nothing is saved on the server.
- The server uses prompt caching to keep costs down on long chats. If the model declines a request, a fallback model can finish the reply.
