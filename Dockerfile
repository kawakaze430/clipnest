# syntax=docker/dockerfile:1
FROM node:25-trixie-slim
WORKDIR /app
COPY --chmod=0644 package.json package-lock.json ./
# Package managers are build tools; the runtime executes node and yt-dlp directly.
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --chmod=0644 requirements.txt ./
COPY --chown=node:node certs ./certs
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export PIP_CERT=/run/secrets/build_ca; fi; \
    apt-get update && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg ca-certificates \
    && python3 -m venv /opt/ytdlp \
    && /opt/ytdlp/bin/pip install --no-cache-dir -r requirements.txt \
    && /opt/ytdlp/bin/python -m pip uninstall -y pip setuptools \
    && apt-get purge -y --auto-remove python3-venv \
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
