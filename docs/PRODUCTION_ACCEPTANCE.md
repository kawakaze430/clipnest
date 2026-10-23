# Real execution and production acceptance — CP-02 / H01

**Release decision: NO_GO.** This checklist describes work that still needs real execution; it is not a record of passed production tests. Read docs/OPERATIONS.md and infra/terraform/README.md before running cloud/fault/restore scripts. Use disposable targets for destructive/fault tests.

Production evidence must match the exact source commit and image/schema tested, with timestamp, environment/backend, command/tool version, result including skips, safe log/report reference, measured values and accountable reviewer. Keep credentials, cookies, signed URLs, action links and connection strings out of reports.

## Stage 1 — reproduce and reduce source risk without AWS

| Check | Execution | Pass criteria / evidence | Register |
| --- | --- | --- | --- |
| Snapshot/dependencies | Verify ZIP; npm ci --ignore-scripts; npm run check; npm test | Complete file manifest, lock matches, relevant suite passes; identify every skip/backend | A-04, H-01, J-01 to J-03 |
| Native PostgreSQL | npm run test:database with disposable TEST_DATABASE_URL or mapped non-root embedded runtime | Native pg pool, transactions, populated upgrade/idempotence, concurrent claims/quotas/ownership; former native skip executes | E-04, E-08, E-09, F-11 |
| Verified DB TLS | npm run test:tls on Docker; tests/tls.native.mjs through its documented harness | Trusted CA and hostname succeed; wrong CA/host fail; encryption remains on | E-04, I-06 |
| Active native crash | node --test tests/crash.native.mjs with disposable native TEST_DATABASE_URL | SIGKILL while work active; lease expiry/replacement; exactly one asset/accounting settlement, no stale completion | F-11, J-07, J-12 |
| Container image/stack | npm run setup:local; docker compose config --quiet; docker compose up --build -d --wait | Actual non-root image; CA readable; work/tmp writable; real DB/migrations/API/worker ready on localhost:8787 | H-02, H-03 |
| Resource/lifecycle/fault | scripts/ops/container-faults.sh on explicit disposable stack plus CPU/memory/disk/deadline drills | Active SIGTERM/SIGKILL/OOM recovery, bounded RSS/scratch, cleanup, retry/settlement and readiness; retain measured limits | H-06, J-12 |
| Real browser/axe | Install pinned Playwright Chromium on authorized runner; npm run test:browser | Desktop/mobile signup/login/logout, keyboard quality selection, fixture file hash, history, cancel/offline/reload/expiry and axe pass | B-05 to B-12, J-04 |
| Additional device journeys | Real target desktop/mobile browsers and assistive tech | Touch/file-save, account switch isolation, revoked session, reset/verification, expired ticket/reprepare, restored network, screen reader/keyboard/focus/contrast | B-05 to B-12 |
| Provider validation | terraform -chdir=infra/terraform init -backend=false -input=false -lockfile=readonly; fmt -check -recursive; validate; test -no-color | Locked real provider starts; schema and mock assertions pass; fix failures before plan/apply | I-03 to I-08 |
| Image security/provenance | Authored CI image scan/SBOM/provenance against exact digest | Review vulnerability results, pinned build/dependencies, immutable digest, SBOM and attestations; production npm audit is separate | H-04, H-07 |

The native suite uses a database it can mutate/reset. Never point it at production. A skipped native test, Terraform fmt parse, emulated DOM or mocked SDK is not a pass for the corresponding real check. H01 packaging changes do not close these gates.

## Stage 2 — owner inputs and reviewed staging

Before creating billable resources, establish the actual account ID/deploy role, Region/availability choice, permitted actions, approved monthly spending bounds, traffic/worker/egress targets and cleanup responsibility. Confirm authorized source/markets, legal/public operator/contact/support commitments, SES sender/production access and alarm recipient. Keep custom-domain/payment decisions conditional.

Follow infra/terraform/README.md and the authored scripts for:
- Account/preflight checks and private encrypted state/bootstrap.
- Locked-provider, account-specific plan review; verify network/RDS instance minor/class/Region availability and actual pricing.
- ECR image build/scan/SBOM and immutable digest.
- Private network/RDS/S3/SQS/DLQ/IAM/KMS/Secrets Manager/SES/CloudFront/WAF resources with desired counts zero initially.
- Bootstrap stable session/media/mail secrets and intended database runtime roles without printing secrets.
- Scoped GitHub OIDC environment/repository setup, migrations and staged rollout.
- Same-origin HTTPS API through the edge, separate API/worker processes, independent media objects.
- Verify no direct public API/database/bucket origin path and no public ACL.

Preserve the private Site audience. Applying staging infrastructure or deploying a frontend does not authorize public signup/worldwide launch. Budget alarms do not stop spending automatically. Keep a concrete cleanup/rollback plan for staging and restore clones.

## Stage 3 — exact production evidence gates

These names exactly match scripts/ops/release-gates.mjs and release/evidence.example.json. All 16 remain unpassed for real AWS production as of this handoff. Some have bounded local evidence described in the master status.

| Required gate | Real test and pass criteria | Primary rows |
| --- | --- | --- |
| nativePostgresTls | Native multi-client pooling/transactions/races/upgrade plus target RDS encrypted TLS, correct CA/hostname, runtime-role restrictions; negative trust tests reject | E-04, E-08, E-09, I-06 |
| containerLifecycle | Exact image non-root readiness, writable declared mounts, startup/migration order, graceful drain, active hard-kill/OOM/resource/deadline/cleanup and healthy replacement | H-02, H-03, H-06, J-12 |
| imageScan | Actual release digest scanned; reviewed policy outcome, SBOM/provenance and supply-chain identifiers retained; no unreviewed release-blocking finding | H-07, I-09 |
| browserDesktopMobile | Real browser/device auth, verification/recovery, link/quality choice, progress/cancel/errors, real file save/history, expiry/reload/offline/account switching, keyboard/axe/manual accessibility | B-05 to B-12, J-04 |
| loadBackpressure | Approved realistic arrival mix/duration/file sizes; native DB/worker/queue pressure; quota/backpressure rejects; measure p95/p99, queue wait, throughput, success, RSS/scratch/egress and recovery | J-05, K-07 |
| securityReview | Actual IAM least privilege, bucket/origin isolation, WAF, cookies/CSRF/origin/cache isolation, cross-user access, SSRF/input/abuse limits, secrets/log redaction and rotation; review findings | C-series, I-04, I-08, J-06 |
| s3SqsCloudFront | Real outbox→SQS→independent worker→private S3→signed CloudFront bytes; duplicate/visibility/DLQ, multipart abort, range/resume, unsigned/expired rejection, bounded tickets and physical retention | F-11, G-07, G-09, G-10, I-07 |
| multiInstanceFailure | At least two real workers; active task stop, stale completion, duplicate messages, DB/queue/S3 outage, upload cancellation, replacement and orphan cleanup; one logical completion/settlement | F-11, J-07, J-12 |
| restoreRollback | Isolated real RDS backup restore, schema/accounts/ownership/history/accounting verified, deletion requests reapplied, expired media denied; measured RTO/RPO and compatible image/frontend rollback | E-09, J-08, K-08 |
| multiGeography | Independent approved Asia/Europe/North America runners/users; availability/latency, actual permitted transfer and target-device save; record real source location and failures | K-04, K-05 |
| sourceAuthorizedDownload | Actual application lookup (not CLI only), real available format selection, durable worker processing and complete final bytes/hash/container/playability/quality in target image/network for authorized media | D-02, D-10, B-11 |
| sesDelivery | Actual verified sender and usable target inbox, verification and reset one-use/expiry, outbox retries/duplicates, sign-in gating/recovery and supported bounce/complaint handling evidence | C-series, K-03 |
| alarmDelivery | Actual failure/backlog/source/cleanup/API/DB/worker and budget events ingest metrics; confirmed recipient receives alarm and recovery; timestamps/runbook/on-call acknowledgement | J-09, J-10 |
| termsPrivacyOwnerApproval | Owner approves source workflow/markets, public legal identity, terms/privacy/retention/export/deletion/backups/complaints and support commitments; public pages contain approved real values | A-06, A-07, K-02 |
| supportContact | Actual public operator/support route works, owner responds, escalation/complaint process and support commitment are clear; no placeholder is treated as a channel | K-02, K-03 |
| budgetCapacity | Approved account-specific cost/traffic model, measured job/CDN/NAT/DB/failed-job costs, bounded controls/alarms/pause, reviewed beta and expansion limits; owner budget/on-call/markets recorded | A-05, I-02, K-07 |

Record actual source, image digest, database/schema and test environments in referenced reports. A source change after evidence may invalidate acceptance; re-evaluate affected gates. The evidence record must match the final release commit, be dated within seven days and include passed/reference for every gate plus owner legalEntity, onCall, positive monthlyBudgetUsd and non-empty launchMarkets.

The current validator checks record structure/recency/identity, not whether a human actually executed or reviewed the reports. Never fabricate or fill pending gates automatically.

## Prepared real-service commands

Read each script's inputs in the runbooks/source first. Set secrets privately in the runner environment. These examples name tools, not an authorization to target an arbitrary account.

~~~sh
node scripts/ops/aws-preflight.mjs
node scripts/ops/security-acceptance.mjs
node scripts/ops/source-acceptance.mjs
node scripts/ops/kill-worker.mjs
node scripts/ops/restore.mjs
node scripts/ops/verify-restored.mjs
node scripts/ops/probe.mjs
node scripts/ops/observe.mjs
~~~

The source-acceptance command expects ACCEPTANCE_ORIGIN, a disposable ACCEPTANCE_COOKIE, ACCEPTANCE_VIDEO_URL and MEDIA_AUTHORIZATION_REFERENCE. It must use the deployed API and actual selected-quality transfer. It cannot be passed by tests/acceptance-server.mjs: that server deliberately uses synthetic fixture media.

Fault/restore commands require explicit disposable/isolated targets and their documented acknowledgement. An active-job drill must prove it killed active work, not an idle service. Restore creates a billable clone and needs deliberate reviewed cleanup.

Run multi-geography probes through infra/probes/buildspec.yml or independent authorized runners, then actual permitted device transfers. Region names and CDN headers alone do not prove user experience or speed.

For final evidence review, copy the intentionally pending example into a protected external evidence location, fill only executed/reviewed results, and run:

~~~sh
node scripts/ops/release-gates.mjs /absolute/private/evidence.json EXACT_RELEASE_COMMIT
~~~

Do not put a commit-dependent final evidence document into the same commit it names. Use protected pipeline evidence input/report references and a post-build delivery receipt.

## Stage 4 — capped beta, observation and expansion

Only after applicable release gates and owner authorization pass: open the capped invitation beta, confirm intended operator/support availability, keep pause/registration controls usable, and observe actual traffic at launch, one hour, 24 hours and seven days.

Collect source failures, success rates, latency/queue time, file throughput, resource/backlog/deletion behavior, support/complaints, actual cost/egress and recovery events. Compare to owner-approved targets. Expand approved markets/capacity only after review; reduce/pause on real failures. K-06/K-09/K-10 cannot close just because a deployment command succeeds.

Payments/custom hostname are separate conditional acceptance tracks if chosen. No live payment test or DNS purchase/configuration is recorded.
