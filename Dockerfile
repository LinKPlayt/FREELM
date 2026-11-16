# ReelBot web app. Works on Hugging Face Spaces (Docker SDK), Render, Railway, Fly.io or any Docker host.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces runs containers as uid 1000.
RUN useradd -m -u 1000 app
WORKDIR /app

COPY requirements.txt requirements-web.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-web.txt

COPY --chown=app:app . .

# Bake the offline voice into the image so the first reel doesn't wait for a download.
RUN mkdir -p .cache/voices output credentials \
 && python -m piper.download_voices --download-dir .cache/voices en_US-ryan-high \
 && chown -R app:app /app

USER app
ENV PYTHONUNBUFFERED=1 PORT=7860
EXPOSE 7860
CMD ["sh", "-c", "uvicorn reelbot.web.app:app --host 0.0.0.0 --port ${PORT:-7860} --proxy-headers --forwarded-allow-ips='*'"]
