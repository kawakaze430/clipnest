# External execution handoff · CP-02

**Current H05 engineering route:** read [CODEX_NEXT_PROMPT.md](../CODEX_NEXT_PROMPT.md), [current verification](../delivery/LOCAL_VERIFICATION.json) and [ENGINEERING_H05.md](../delivery/ENGINEERING_H05.md). Codex owns fixes/testing and direct-main commits/pushes, with no branch/worktree/PR. Local Docker/native/provider/browser/image-security capabilities now pass; historical unavailable-capability statements below are superseded locally. Actual AWS/source/device/resource acceptance remains pending. The H02 limited route below applies only if explicitly selected.

**H02 minimal route:** Start with docs/NEXT_PATH.md, docs/EXTERNAL_EXECUTION.md and CLOUD_TEST_ONLY_PROMPT.md. E01 is execution-only and uses prepared native/browser/provider checks plus Docker smoke if available. The broad sequence below describes later stages, not a request to spend one Codex Cloud task implementing/deploying everything.

The assistant owns implementation, fixes, documentation and artifact updates. Use Codex/a capable runner only for the capabilities absent here; do not ask it to rewrite the project. This is ClipNest, not StreamAtlas. The status register keeps the original 112 IDs and marks the requested 51 separately.

## First: blocked prerequisites

| Blocker | Exact requirement | Owner |
| --- | --- | --- |
| Docker | Docker CLI/daemon; clean build, Compose and resource/fault tests | Codex/local or CI runner |
| Native PostgreSQL | Mapped non-root user or explicit disposable TEST_DATABASE_URL; native TLS target | Runner |
| Terraform validation | Provider must be permitted to create its local Unix socket; current authoring runtime forbids it | Normal CI/terminal runner |
| AWS | Scoped account/role/Region authorization, owner-approved traffic and spend | Owner supplies authorization; runner executes |
| Live source | Permitted video and supported source behavior from the actual staging image/network; prior app request was source-restricted | Owner/source dependency + runner |
| Production communications | Verified SES sender, SES production access and actual inbox/alert delivery | Owner + runner |
| Public release | Operator legal identity/contact, supported markets, required source/rights authorization and approved policies | Owner |
| Post-launch | A deployed capped beta and actual observation time/traffic/costs | Operator after release |

These are execution/input boundaries, not missing code automatically assigned to the owner. The current Site remains private; no AWS resources have been created. Do not send keys/passwords/session links in chat.

## Minimal runner sequence

1. Check out the delivered CP-02 source, retain its commit/digest and run `npm ci --ignore-scripts`, `npm run check`, `npm test`. Preserve output. Fix only actual failures; send safe error codes/logs back with the original task IDs.
2. Run `npm run test:database` against a disposable native database; run `npm run test:tls` on Docker. The native suite must report its actual backend and execute the formerly skipped parallel claims/idempotency case. Then run `TEST_DATABASE_URL=... node --test tests/crash.native.mjs` for actual SIGKILL/native lease expiry and replacement completion. Supply credentials privately via the runner environment, not command transcripts.
3. Run Docker build/Compose CI and inspect non-root identity, readable public CA, writable work volume, worker health, orderly migration startup and graceful stop. Use `scripts/ops/container-faults.sh` for an active permitted-media SIGKILL/replacement test on the explicit disposable local Compose stack. Repeat with bounded CPU/memory/disk and active synthetic/owned-media work. A crash drill is not passed by restarting an idle worker. Record SIGKILL/OOM recovery, maximum scratch/RSS, attempts, reservation settlement and orphan cleanup.
4. Install the pinned Playwright Chromium runtime on that runner and run `npm run test:browser`. It covers desktop/mobile signup/login, keyboard radio selection, a real local generated fixture transfer, history, sign-out, overflow and axe. Record mobile touch/download behavior on actual target devices too. The synthetic fixture is not live-source proof. Expand expiry/cancel/network/reload device cases from the register and fix observed issues.
5. Run the Terraform CI job: locked-provider init, fmt, validate and mock tests. Fix provider/API/schema issues before any account plan. Follow `infra/terraform/README.md` for owner inputs, private state and a reviewed staging plan; never apply a guessed budget or account.
6. Verify image vulnerabilities, SBOM/provenance and exact digest. Provision authorized staging with zero initial tasks, populate secrets, then run the OIDC rollout. Confirm private RDS, S3, SQS, role restrictions, CloudFront VPC-origin routing and no direct public origin access.
7. Use `ops/aws-preflight.mjs` and `ops/security-acceptance.mjs`, then bootstrap the intended owner operator and verify SES delivery. Use invitation-only beta registration. Retain explicit sender, alert and source evidence.
8. Run `ops/source-acceptance.mjs` with ACCEPTANCE_ORIGIN, disposable ACCEPTANCE_COOKIE, ACCEPTANCE_VIDEO_URL and MEDIA_AUTHORIZATION_REFERENCE set privately. It checks real analysis, selected quality, queue/worker preparation and transferred SHA/bytes. Never substitute a fixture or CLI metadata result for this check. Never bypass a source restriction to force a pass.
9. Submit authorized media, start at least two workers, review/execute `ops/kill-worker.mjs` in staging and verify the affected job/attempts, exactly one ready asset, no stale completion and one settlement. Also test API restart, duplicate work deliveries, SQS/DB outage, cancellation during upload, failed multipart and delayed cleanup. Contract tests passed locally; real services still need evidence.
10. Review/start an isolated `ops/restore.mjs` clone, wait for availability and run `ops/verify-restored.mjs` with explicit clone credentials/CA. Complete login/ownership/deletion/expired-media checks, measure RTO/RPO, rehearse a compatible image/frontend rollback and retain its evidence. Explicitly clean up billable drill resources after review.
11. Execute the probe from Asia, Europe and North America using `infra/probes/buildspec.yml` or independent approved runners. Run real permitted transfers from the target devices; an AWS build Region or CloudFront POP header alone does not prove user geography or speed.
12. Fill an exact-commit evidence record, account-specific cost/capacity results and owner inputs. `release-gates.mjs` must pass before production dispatch. Open a small capped beta, record observation at launch/1h/24h/7d, and expand only after the operator reviews traffic, support, source failures and costs.

## Evidence to return

Task IDs, source/image/schema identifiers, check command/version, actual environment/backend, pass/fail/skip counts, timestamps, public report/artifact references, safe request IDs and measured metrics. Omit secret values, cookies, mail/reset/invitation links, signed URLs and database connection strings. Keep the one-backend SQL, injected SDK, browser fixture and real-service evidence distinct.
