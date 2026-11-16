# Optional: self-host the ReelBot server app on your own computer or any Docker host.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

# Run as a normal user, not root.
RUN useradd -m -u 1000 app
WORKDIR /app

COPY requirements.txt requirements-web.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-web.txt

COPY --chown=app:app . .

RUN mkdir -p .cache output credentials && chown -R app:app /app

USER app
ENV PYTHONUNBUFFERED=1 PORT=7860
EXPOSE 7860
CMD ["sh", "-c", "uvicorn reelbot.web.app:app --host 0.0.0.0 --port ${PORT:-7860} --proxy-headers --forwarded-allow-ips='*'"]
