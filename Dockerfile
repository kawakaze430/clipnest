# syntax=docker/dockerfile:1
# Patched upstream XML and FFmpeg are built together; inputs are pinned in build/media-sources.json.
FROM node:24-alpine3.24 AS media-builder
COPY build/ /build/
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export SSL_CERT_FILE=/run/secrets/build_ca SSL_CA_CERT_FILE=/run/secrets/build_ca; fi; \
    apk upgrade --no-cache \
    && apk add --no-cache build-base autoconf automake libtool pkgconf nasm python3 ca-certificates \
       x264-dev lame-dev libvpx-dev opus-dev openssl-dev zlib-dev xz-dev \
    && sh /build/build-media.sh
FROM node:24-alpine3.24
WORKDIR /app
COPY --chmod=0644 package.json package-lock.json ./
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
# ClipNest supports YouTube only; the unused Shahid extractor containing an upstream AWS key is removed below.
COPY --chmod=0644 requirements.txt ./
COPY --chown=node:node certs ./certs
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export PIP_CERT=/run/secrets/build_ca SSL_CERT_FILE=/run/secrets/build_ca SSL_CA_CERT_FILE=/run/secrets/build_ca; fi; \
    apk upgrade --no-cache \
    && apk add --no-cache python3 py3-pip ca-certificates x264-libs lame-libs libvpx opus openssl zlib xz-libs \
    && python3 -m venv /opt/ytdlp \
    && /opt/ytdlp/bin/pip install --only-binary=:all: --no-cache-dir -r requirements.txt \
    && /opt/ytdlp/bin/python -c "from pathlib import Path; import yt_dlp; root=Path(yt_dlp.__file__).parent/'extractor'; (root/'shahid.py').unlink(); [p.unlink() for p in (root/'__pycache__').glob('shahid.*.pyc')]" \
    && /opt/ytdlp/bin/python -m pip uninstall -y pip setuptools \
    && apk del --no-cache py3-pip
COPY --from=media-builder /opt/media /opt/media
ARG SOURCE_COMMIT=development
ENV SOURCE_COMMIT=$SOURCE_COMMIT
ENV PATH=/opt/media/bin:$PATH
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 YTDLP_PATH=/opt/ytdlp/bin/yt-dlp DATA_DIR=/app/.cache
COPY --chown=node:node backend ./backend
COPY --chown=node:node dist ./dist
RUN mkdir -p /app/.cache && chown node:node /app/.cache && chmod 1777 /tmp \
    && chmod 0644 /opt/media/share/clipnest/media-sources.json
VOLUME ["/app/.cache", "/tmp"]
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD ["node","-e","fetch('http://127.0.0.1:8787/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "backend/server.mjs"]
