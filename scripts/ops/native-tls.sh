#!/usr/bin/env bash
# Disposable PostgreSQL 17 verified/negative TLS acceptance; no production target.
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v docker >/dev/null
command -v openssl >/dev/null
# Ignore unrelated target bindings: this command always owns a fresh local target.
unset TEST_DATABASE_URL TEST_DB_CA_FILE
exec node scripts/test-database.mjs --docker --with-tls --tls-only
