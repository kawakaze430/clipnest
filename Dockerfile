FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY requirements.txt ./
COPY --chown=node:node certs ./certs
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg ca-certificates \
    && python3 -m venv /opt/ytdlp \
    && /opt/ytdlp/bin/pip install --no-cache-dir -r requirements.txt \
    && rm -rf /var/lib/apt/lists/*
ARG SOURCE_COMMIT=development
ENV SOURCE_COMMIT=$SOURCE_COMMIT
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 YTDLP_PATH=/opt/ytdlp/bin/yt-dlp DATA_DIR=/app/.cache
COPY --chown=node:node backend ./backend
COPY --chown=node:node dist ./dist
RUN mkdir -p /app/.cache && chown node:node /app/.cache && chmod 1777 /tmp
VOLUME ["/app/.cache", "/tmp"]
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD ["node","-e","fetch('http://127.0.0.1:8787/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "backend/server.mjs"]
