#!/usr/bin/env bash
# Active permitted-media drill for the LOCAL Compose staging stack only.
# Inherit ACCEPTANCE_* and MEDIA_AUTHORIZATION_REFERENCE privately. No shell tracing.
set -euo pipefail
if [ "${FAULT_CONTAINER_SCOPE:-}" != local-staging ]; then echo 'Set FAULT_CONTAINER_SCOPE=local-staging after selecting the disposable Compose stack.' >&2; exit 1; fi
case "${ACCEPTANCE_ORIGIN:-}" in http://localhost:8787|http://127.0.0.1:8787) ;; *) echo 'This drill requires the explicit local Compose origin.' >&2; exit 1;; esac
mkdir -p .cache/release
rm -f .cache/release/live-active.json
node scripts/ops/source-acceptance.mjs > .cache/release/container-transfer.log 2>&1 &
LIVE_DRILL_PID=$!
cleanup() { if kill -0 "$LIVE_DRILL_PID" 2>/dev/null; then kill "$LIVE_DRILL_PID"; fi; }
trap cleanup EXIT
ACTIVE=false
for attempt in $(seq 1 90); do
  if node --input-type=module <<'JS'
import {readFile} from 'node:fs/promises';
try{const state=JSON.parse(await readFile('.cache/release/live-active.json','utf8'));const r=await fetch(process.env.ACCEPTANCE_ORIGIN+'/api/jobs/'+state.jobId,{headers:{Cookie:process.env.ACCEPTANCE_COOKIE},signal:AbortSignal.timeout(3000)}),j=await r.json();process.exit(['downloading','processing'].includes(j.status)?0:1);}catch{process.exit(1);}
JS
  then ACTIVE=true; break; fi
  if ! kill -0 "$LIVE_DRILL_PID" 2>/dev/null; then echo 'Transfer finished or failed before an active job was observed; drill not passed.' >&2; exit 1; fi
  sleep 1
done
if [ "$ACTIVE" != true ]; then echo 'No active job observed; drill not passed.' >&2; exit 1; fi
docker compose kill -s SIGKILL worker
docker compose up -d --wait worker
wait "$LIVE_DRILL_PID"
trap - EXIT
echo 'Active container was killed and replacement transfer completed; inspect the live-source report and SQL attempt/reservation/object invariants before closing the drill.'
