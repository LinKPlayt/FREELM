# FREELM

Your own personal AI web app. Chat with an assistant you name and give a personality, powered by your choice of AI:

| Where the AI runs | Engine | Good for |
| --- | --- | --- |
| **This computer** | [Ollama](https://ollama.com) | The most powerful private option. Runs big open models (Qwen 3.5, gpt-oss, DeepSeek R1, Gemma 4…) on your own hardware, offline, free. |
| **In this browser** | WebGPU ([WebLLM](https://github.com/mlc-ai/web-llm)) | No install at all. The model runs on your device's GPU inside the browser, even on some phones. |
| **Cloud** (optional) | Claude | The most capable answers. Needs an Anthropic API key and is billed per message. |

Switch between them anytime from the model menu at the top of the chat, even in the middle of a conversation.

![FREELM](public/icon.svg)

## Features

- **Your own AI identity:** name, personality (or a preset), and accent color.
- **Local AI manager:** download, use and delete models from inside the app, with live progress bars and a setup guide if Ollama isn't installed yet.
- **Live streaming replies** with a collapsible "Thought process" panel for models that reason.
- **Quick / Balanced / Deep modes:** control how hard the AI thinks. On local reasoning models this turns thinking on or off.
- **Rich formatting:** Markdown, tables, syntax-highlighted code with copy buttons.
- **Chat history** saved in your browser, with search, rename and delete. Stop and regenerate. Keyboard shortcuts.
- **Dark and light themes**, works on phones, and has an optional password lock.

---

## Run it on your computer (local AI)

### Easiest: one command (macOS / Linux)

```bash
npm run setup:local
```

This installs Ollama if needed, downloads a model sized for your computer's memory, installs FREELM and starts it at **http://localhost:3000**. To pick the model yourself: `npm run setup:local -- gpt-oss:20b`.

### Step by step (any OS, including Windows)

1. Install **Node.js 22+** from [nodejs.org](https://nodejs.org).
2. Install **Ollama** from [ollama.com/download](https://ollama.com/download) and open it.
3. In this folder:
   ```bash
   npm install
   npm start
   ```
4. Open http://localhost:3000, click **Local AI models** in the sidebar, and download a model. Then chat.

### Which model should I pick?

| Your computer | Try | Download |
| --- | --- | --- |
| 8 GB RAM laptop | `qwen3.5:4b` | 3.3 GB |
| 16 GB RAM / Apple M-series | `qwen3.5:9b` (recommended) | 6.6 GB |
| 16 GB+ RAM, want deep reasoning | `gpt-oss:20b` or `deepseek-r1:14b` | 13.8 / 9 GB |
| 32 GB+ RAM or a 24 GB GPU | `qwen3.5:27b` | 17.5 GB |

Any model from [ollama.com/library](https://ollama.com/library) works. Type its name into the custom download box. A graphics card (NVIDIA, AMD or Apple Silicon) makes replies much faster.

### No install: run AI in the browser

Open the model menu and pick anything under **In this browser**. The first message downloads the model (0.9–6.4 GB, once), then it runs fully on your device. You need a WebGPU browser: Chrome or Edge 113+, Safari 26+, or Chrome on a recent Android phone. The page must be on `https://` or `localhost`.

---

## Deploy

### Docker (FREELM + Ollama together)

```bash
docker compose up -d
```

Open http://localhost:3000 and download a model from **Local AI models**. Models are kept in a Docker volume. For an NVIDIA GPU, uncomment the `deploy:` block in `docker-compose.yml`. On a Mac, run Ollama natively instead (Docker can't use the Apple GPU) and just run `npm start`.

### GitHub Pages (browser AI, free hosting)

`npm run build:static` makes a server-free copy in `dist/` that runs browser models only. The included workflow (`.github/workflows/pages.yml`) publishes it automatically:

1. Merge to `main`.
2. In the repo, go to **Settings → Pages → Source** and choose **GitHub Actions**.
3. Your app goes live at `https://<your-username>.github.io/<repo>/`.

### On a server

Run it like any Node app (`npm start`, or the Docker image) behind HTTPS. **Set `APP_PASSWORD`** so strangers can't use your models or your API key.

---

## Configuration (`.env`)

All settings are optional.

| Variable | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | (unset) | Turns on Cloud AI (Claude) |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Where Ollama is running |
| `LOCAL_CONTEXT` | Ollama's default | Context window for local models, in tokens (bigger uses more memory) |
| `APP_PASSWORD` | (unset) | Require a password to use the app |
| `PORT` | `3000` | Port to listen on |
| `AI_MODEL` | `claude-opus-5-5` | Cloud model |

## How it works

```
server.js            Express server
  /api/chat            → Claude (streams over SSE)
  /api/local/*         → Ollama on this machine: list, chat, download, delete models
public/
  app.js             Chat UI, model picker, Local AI manager
  browser-ai.js      In-browser engine (WebLLM): model list, download, streaming, <think> parsing
  llm-worker.js      Runs the browser model in a Web Worker so the UI stays smooth
  styles.css         Design system (tokens, light/dark, components)
scripts/
  setup-local.sh     One-command local install
  build-static.mjs   Server-free build for static hosting
```

- Chats are stored in your browser's `localStorage`. Nothing is saved on the server.
- Local and browser models never send your messages anywhere. Cloud messages go to Anthropic's API.
- Your API key stays on the server and is never sent to the browser.
