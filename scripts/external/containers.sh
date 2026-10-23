#!/usr/bin/env bash
# Disposable remote Docker smoke only. No source media, credentials, AWS or deployments.
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v docker >/dev/null
docker info --format '{{.ServerVersion}}' >/dev/null
docker compose version --short
command -v openssl >/dev/null
python3 - <<'PY'
import socket
with socket.socket() as s:
    s.bind(('127.0.0.1',8787))
PY
work=$(mktemp -d)
project=clipnest-e01-$(date +%s)-$RANDOM
env_file="$work/compose.env"
unset DATABASE_URL POSTGRES_PASSWORD SESSION_SECRET
cleanup() {
  docker compose -p "$project" --env-file "$env_file" -f compose.yaml down --volumes --remove-orphans --timeout 10 >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
CLIPNEST_EXTERNAL_ENV_FILE="$env_file" node --input-type=module <<'JS'
import {writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
writeFileSync(process.env.CLIPNEST_EXTERNAL_ENV_FILE,'POSTGRES_PASSWORD='+randomBytes(24).toString('hex')+'\nSESSION_SECRET='+randomBytes(48).toString('hex')+'\n',{mode:0o600});
JS
bash scripts/ops/native-tls.sh
docker compose -p "$project" --env-file "$env_file" -f compose.yaml config --quiet
docker compose -p "$project" --env-file "$env_file" -f compose.yaml up --build -d --wait --wait-timeout 180
curl --fail --silent --show-error --max-time 10 http://localhost:8787/readyz
docker compose -p "$project" --env-file "$env_file" -f compose.yaml exec -T worker sh -c 'test "$(id -u)" != 0 && test -w /app/.cache && test -w /tmp'
docker image inspect clipnest:local --format '{{.Id}}'
docker compose -p "$project" --env-file "$env_file" -f compose.yaml restart worker
docker compose -p "$project" --env-file "$env_file" -f compose.yaml up -d --wait --wait-timeout 120
curl --fail --silent --show-error --max-time 10 http://localhost:8787/readyz
echo 'CLIPNEST_CONTAINER_SMOKE_PASSED'
echo 'Scope: local TLS/image/Compose/non-root/readiness/restart only. Active OOM/SIGKILL/source/scan/SBOM/AWS gates remain separate.'
