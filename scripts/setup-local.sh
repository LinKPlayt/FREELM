#!/usr/bin/env bash
# FREELM local setup for macOS and Linux.
# Installs/starts Ollama, downloads a model sized for this computer, then starts FREELM.
# Usage: npm run setup:local            (auto-pick a model)
#        npm run setup:local -- gpt-oss:20b   (choose one yourself)
set -euo pipefail
cd "$(dirname "$0")/.."

MODEL="${1:-}"
say() { printf "\n\033[1;35m==>\033[0m %s\n" "$*"; }

# 1. Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22+ is required: https://nodejs.org" >&2
  exit 1
fi
if [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  echo "Node.js 22+ is required (you have $(node -v)): https://nodejs.org" >&2
  exit 1
fi

# 2. Ollama
if ! command -v ollama >/dev/null 2>&1; then
  case "$(uname -s)" in
    Linux)
      say "Installing Ollama (you may be asked for your password)…"
      curl -fsSL https://ollama.com/install.sh | sh
      ;;
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        say "Installing Ollama with Homebrew…"
        brew install ollama
      else
        echo "Install Ollama for Mac from https://ollama.com/download, open it once, then run this again." >&2
        exit 1
      fi
      ;;
    *)
      echo "On Windows, install Ollama from https://ollama.com/download, then run: npm install && npm start" >&2
      exit 1
      ;;
  esac
fi

if ! curl -fsS http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
  say "Starting Ollama…"
  (ollama serve >/dev/null 2>&1 &)
  for _ in $(seq 1 30); do
    curl -fsS http://127.0.0.1:11434/api/version >/dev/null 2>&1 && break
    sleep 1
  done
fi
curl -fsS http://127.0.0.1:11434/api/version >/dev/null 2>&1 || { echo "Ollama didn't start. Try running 'ollama serve' yourself." >&2; exit 1; }

# 3. Pick a model that fits this machine's memory
if [ -z "$MODEL" ]; then
  if [ "$(uname -s)" = "Darwin" ]; then
    RAM_GB=$(( $(sysctl -n hw.memsize) / 1073741824 ))
  else
    RAM_GB=$(( $(awk '/MemTotal/ {print $2}' /proc/meminfo) / 1048576 ))
  fi
  if   [ "$RAM_GB" -ge 48 ]; then MODEL="qwen3.5:27b"
  elif [ "$RAM_GB" -ge 14 ]; then MODEL="qwen3.5:9b"
  elif [ "$RAM_GB" -ge 7 ];  then MODEL="qwen3.5:4b"
  else                            MODEL="llama3.2:3b"
  fi
  say "This computer has ~${RAM_GB} GB of memory, so FREELM will use $MODEL."
fi

say "Downloading $MODEL (only the first time)…"
ollama pull "$MODEL"

# 4. FREELM
say "Installing FREELM…"
npm install --no-fund --no-audit
[ -f .env ] || cp .env.example .env

say "All set! Opening FREELM at http://localhost:${PORT:-3000}"
exec npm start
