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
# Buildx state belongs to this disposable run, including read-only HOME runtimes.
export BUILDX_CONFIG="${BUILDX_CONFIG:-$work/buildx}"
project=clipnest-e01-$(date +%s)-$RANDOM
env_file="$work/compose.env"
compose=(docker compose -p "$project" --env-file "$env_file" -f compose.yaml)
unset DATABASE_URL POSTGRES_PASSWORD SESSION_SECRET
cleanup() {
  result=$?
  trap - EXIT
  if [ "$result" -ne 0 ]; then
    echo 'Container smoke failed; retaining sanitized service diagnostics before cleanup.' >&2
    "${compose[@]}" ps --all >&2 || true
    "${compose[@]}" logs --no-color --tail 100 2>&1 | node -e '
      const fs = require("node:fs");
      const secrets = fs.existsSync(process.argv[1]) ? fs.readFileSync(process.argv[1], "utf8").split("\n").filter(Boolean).map(line => line.slice(line.indexOf("=") + 1)).filter(Boolean) : [];
      let text = "";
      process.stdin.on("data", chunk => { text += chunk; });
      process.stdin.on("end", () => {
        text = text.replace(/postgres(?:ql)?:\/\/[^\s"\x27<>]+/gi, "[database URL redacted]");
        for (const secret of secrets) text = text.split(secret).join("[redacted]");
        process.stderr.write(text);
      });
    ' "$env_file" || true
  fi
  if ! "${compose[@]}" down --volumes --remove-orphans --timeout 10 >/dev/null 2>&1; then
    echo 'Failed to clean up the disposable Compose project.' >&2
    if [ "$result" -eq 0 ]; then result=1; fi
  fi
  rm -rf "$work"
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
CLIPNEST_EXTERNAL_ENV_FILE="$env_file" node --input-type=module <<'JS'
import {writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
writeFileSync(process.env.CLIPNEST_EXTERNAL_ENV_FILE,'POSTGRES_PASSWORD='+randomBytes(24).toString('hex')+'\nSESSION_SECRET='+randomBytes(48).toString('hex')+'\n',{mode:0o600});
JS
# The public proxy CA is mounted only during dependency installation, never
# copied into the application image or committed to source. Normal Compose
# builds without a configured additional CA are unchanged.
build_ca_file=${CLIPNEST_BUILD_CA_FILE:-${NODE_EXTRA_CA_CERTS:-${SSL_CERT_FILE:-}}}
if [ -n "$build_ca_file" ]; then
  if [ ! -r "$build_ca_file" ]; then
    echo 'Configured build CA file is not readable.' >&2
    exit 1
  fi
  CLIPNEST_EXTERNAL_CA_FILE="$build_ca_file" CLIPNEST_EXTERNAL_OVERRIDE="$work/build-ca.json" node --input-type=module <<'JS'
import {writeFileSync} from 'node:fs';
const override={services:Object.fromEntries(['api','worker','migrate'].map(name=>[name,{build:{secrets:['build_ca']}}])),secrets:{build_ca:{file:process.env.CLIPNEST_EXTERNAL_CA_FILE}}};
writeFileSync(process.env.CLIPNEST_EXTERNAL_OVERRIDE,JSON.stringify(override),{mode:0o600});
JS
  compose+=(-f "$work/build-ca.json")
fi
bash scripts/ops/native-tls.sh
"${compose[@]}" config --quiet
# All three application services use the same image. Build it once to avoid
# competing tag updates and unnecessary API recreation during the worker drill.
"${compose[@]}" build api
"${compose[@]}" up --no-build -d --wait --wait-timeout 180
curl --fail --silent --show-error --max-time 10 http://localhost:8787/readyz
"${compose[@]}" exec -T worker sh -c 'test "$(id -u)" != 0 && test -w /app/.cache && test -w /tmp'
"${compose[@]}" exec -T worker sh -s < scripts/ops/media-smoke.sh
docker image inspect clipnest:local --format '{{.Id}}'
"${compose[@]}" restart worker
"${compose[@]}" up --no-build -d --wait --wait-timeout 120
curl --fail --silent --show-error --max-time 10 http://localhost:8787/readyz
# Validate a real account request path in the running image, with synthetic
# credentials held only in memory and the disposable database removed below.
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const origin='http://localhost:8787';
const request=(endpoint,options={})=>fetch(origin+endpoint,{signal:AbortSignal.timeout(10000),...options});
assert.equal((await request('/api/usage')).status,401,'Usage must reject an anonymous request');
const registered=await request('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({email:`container-${randomBytes(8).toString('hex')}@example.test`,password:randomBytes(24).toString('hex')})});
assert.equal(registered.status,201,'Disposable account registration must succeed');
const cookie=registered.headers.get('set-cookie')?.split(';')[0];
const session=await registered.json();
assert.ok(cookie&&session.csrfToken,'Registration must return a session and CSRF token');
const usage=await request('/api/usage',{headers:{Cookie:cookie}});
assert.equal(usage.status,200,'The registered account must read its own usage');
assert.equal((await usage.json()).jobsStarted,0,'A fresh account must have no jobs');
const logout=await request('/api/auth/logout',{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-CSRF-Token':session.csrfToken}});
assert.equal(logout.status,200,'CSRF-authenticated logout must succeed');
assert.equal((await request('/api/usage',{headers:{Cookie:cookie}})).status,401,'The revoked session must be rejected');
console.log('CLIPNEST_CONTAINER_ACCOUNT_SMOKE_PASSED');
JS
echo 'CLIPNEST_CONTAINER_SMOKE_PASSED'
echo 'Scope: local TLS/image/Compose/non-root/readiness/restart and disposable account HTTP only. Active OOM/SIGKILL/source/scan/SBOM/AWS gates remain separate.'
