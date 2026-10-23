#!/usr/bin/env bash
# Disposable CI-only native PostgreSQL TLS acceptance, no production target.
set -euo pipefail
command -v docker >/dev/null
command -v openssl >/dev/null
TLS_DIR=$(mktemp -d)
CONTAINER_NAME=clipnest-tls-${RANDOM}
cleanup() { docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true; rm -rf "$TLS_DIR"; }
trap cleanup EXIT
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$TLS_DIR/server.key" -out "$TLS_DIR/server.crt" -days 1 -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost' >/dev/null 2>&1
chmod 600 "$TLS_DIR/server.key"
chmod 755 "$TLS_DIR"
# The official PostgreSQL container reads this mounted key as uid 999.
docker run --rm -v "$TLS_DIR:/tls" --user 0 postgres:17-bookworm chown 999:999 /tls/server.key
export TEST_DATABASE_URL=postgresql://clipnest:disposable-tls-password@localhost:55432/clipnest
export TEST_DB_CA_FILE="$TLS_DIR/server.crt"
docker run -d --name "$CONTAINER_NAME" -p 127.0.0.1:55432:5432 -e POSTGRES_USER=clipnest -e POSTGRES_PASSWORD=disposable-tls-password -e POSTGRES_DB=clipnest -v "$TLS_DIR:/tls:ro" postgres:17-bookworm -c ssl=on -c ssl_cert_file=/tls/server.crt -c ssl_key_file=/tls/server.key >/dev/null
for attempt in $(seq 1 40); do if docker exec "$CONTAINER_NAME" pg_isready -U clipnest -d clipnest >/dev/null; then break; fi; sleep 1; done
node --test tests/tls.native.mjs
