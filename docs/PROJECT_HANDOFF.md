# Complete project handoff — ClipNest CP-02 / H01

**H05 update, 24 October 2026:** current ownership, direct-main Git rules, code fixes, test evidence and remaining acceptance are in `CODEX_NEXT_PROMPT.md`, `docs/NEXT_PATH.md`, `delivery/LOCAL_VERIFICATION.json` and the refreshed task register. The H01 narrative below is historical; do not treat its old capability blockers/test counts as the latest run.

Prepared 22 October 2026 from the actual repository and canonical 112-task register. Application baseline is commit 92a00a4bb1a2c0ae3de12105f37e129ab5e8df10, package 1.2.0. H01 adds portable handoff instructions, refreshed status snapshots and repeatable verified full-source packaging; it is not a new application release.

## Main goal and intended user flow

Build and operate ClipNest on AWS for users in approved worldwide markets. A signed-in user enters an authorized YouTube/Shorts link; the service reports actual available formats; the user chooses a video/audio quality; durable workers prepare that exact selection; the UI reports progress/failure/cancellation; a time-limited link delivers the prepared bytes. Persistent history/usage belongs to the account.

Deliver the complete frontend, API, PostgreSQL schema/migrations, independent analysis/download workers, durable queue, temporary media storage, secure CDN delivery, account lifecycle, operator controls, observability, deployment and recovery. Start with a free capped invite beta. Source access and actual bandwidth/processing determine speed; no guaranteed speed, fabricated resolutions, unlimited quota or unrestricted worldwide eligibility is promised.

## Current state and decision

| Core status | Count | Meaning |
| --- | ---: | --- |
| L — Locally implemented | 60 | Bounded source/local evidence exists; not a cloud deployment claim |
| P — Partially implemented | 25 | Material implementation or acceptance still incomplete |
| R — Prepared, not executed | 17 | Runnable source/workflow exists; relevant execution unrecorded |
| B — Externally blocked | 10 | Concrete required execution/input unavailable |
| N — Not started | 0 | No untouched core row remains |
| Total | 112 | Original IDs preserved, not weighted effort |

Eight conditional domain/payment tasks are separate. The previously requested 51 tasks now map to 12 L, 25 P, 13 R and 1 B. That batch is not 51 completed tasks. The original 35 not-started and 16 partial counts were an earlier baseline.

**Public AWS release is NO_GO.** The owner-private hosted Site renders the frontend and distributes source. It does not host the Node API, native PostgreSQL, queue, independent worker or AWS resources. The backend has not been deployed. An owner-only static Site deployment must never be described as a working worldwide downloader.

The exact current delivery commit/ZIP digest belongs in the external delivery receipt. Canonical CP-02 status files retain the CP-02 application evidence and version-3 private Site receipt as history; they do not claim a later documentation delivery is a new application release.

## Architecture already represented in source

| Layer | Current implementation / target |
| --- | --- |
| Frontend | Vanilla HTML/CSS/JavaScript in dist; account/operator/policy pages, responsive layouts, same-origin API |
| API and engine | Node 24, Python yt-dlp 2026.10.21, FFmpeg; asynchronous durable analysis and download work |
| Identity | Email/password with scrypt, hashed sessions, secure production cookies, CSRF/exact origin, verified-email/recovery lifecycle |
| Database | pg driver, SQL migrations, durable jobs/accounting/outbox/leases; native PostgreSQL 17/RDS target |
| Local test database | PGlite single-backend PostgreSQL SQL only; development/test preview, not production |
| Queue and workers | Database transactional outbox, SQS + DLQ adapters, independent ECS analysis/download consumers |
| Media | Per-attempt work directory, ffprobe/hash/size/duration validation, private S3 objects, CloudFront signed delivery |
| Communications | AES-GCM protected mail outbox, SES adapter, private file-mail development adapter |
| Cloud | Terraform two-AZ VPC, private ECS tasks/RDS, internal ALB + CloudFront VPC origin, WAF, S3, SQS, IAM/KMS/Secrets Manager |
| Delivery | GitHub CI and environment-scoped OIDC/ECR/deploy workflows, immutable image digest, reviewed migration/rollout/rollback |
| Operations | Bounded CloudWatch EMF, dashboard/alarms, budget configuration, probes, restore/fault/release runbooks |

One primary application AWS Region is proposed, with a global edge. ap-south-1 is a template suggestion, not an owner-confirmed Region. Multi-AZ is not multi-Region application failover. GitHub OIDC deployment identity is separate from user login. Historical Cognito planning is superseded by the implemented email/password lifecycle.

## What already exists, with the limits of its evidence

| Area | Implemented source and recorded local proof | Remaining production acceptance |
| --- | --- | --- |
| Link/qualities | Supported URL validation, real format filtering, video/audio choices and metadata sanitization | Actual app source lookup and full authorized selected-quality transfer in the staging image/network |
| Consumer UI | Link entry, picker, progress/cancel/errors, ready/expired states, account history/usage, account recovery, policy pages | Desktop/mobile/real-device journeys, browser expiry/reload/offline/account switching, accessibility findings |
| Account/security | scrypt credentials, session hashing/revocation, CSRF/exact origin, ownership and persistent admission controls; positive/wrong/disabled login tests | Secure-cookie/forwarded-origin behavior through real edge and authenticated cross-user/security review |
| Verification/reset | One-use bounded verification/reset actions; generic forgot response; encrypted mail outbox and SES/file-dev adapters | Verified sender/production access, actual mail, delayed/duplicate/bounce/retry/recovery behavior |
| Privacy/deletion | Owner export without secrets, password-reauth account closure, cancel/expire/anonymize, tombstone/retention cleanup; late completion/sign-in race fixed | Real S3 physical deletion, policy/backup deletion obligations and restored-data reapplication |
| Operator | Audited operator role, one-use email-bound invitations, registration/pause controls, account disable, bootstrap script | Intended operator enrollment, real invitations/support contact and operator acceptance |
| Analysis | Durable create/poll/cancel, lease/retry/deadline, independent workers; legacy sync API retained | Actual multi-client contention, task loss, source service/network behavior |
| Jobs/usage | Atomic job + outbox + quota reservation; per-user/global daily/active/queue bounds; settlement and stale-lease protection | Native races and actual distributed duplicate/retry/dead-letter/outage behavior |
| Media | Per-attempt scratch, FFmpeg fixture, exact local bytes/range, checksum/probe validation, upload/head/abort/delete adapters and ready-after-CAS | Actual multipart failures/cancel, off-task delivery, range/expiry/cache and task replacement on S3/CloudFront |
| Retention | Expiry sweeps, orphan/failed deletion retry, gauges and lifecycle backstop source | Actual object deletion time and overdue alarm behavior under faults |
| Infrastructure | Terraform modules/provider lock/mock-security tests, safe zero-task bootstrap, scoped roles and cloud configuration | Provider validate/mock, account plan/apply, API/resource/network/IAM proof |
| Operations/recovery | Metrics, alarms, probes, source/security acceptance, active kill, restore/verify, deployment and compatible rollback scripts | Real ingestion/alert delivery, active hard-kill/OOM/outages, restore RTO/RPO and exact image/frontend rollback |
| Packaging/handoff | Complete source distribution, per-file SHA manifest, whole ZIP checksum, portable continuation prompt and original task register | Repeat packaging after every final source/docs change and retain external evidence |

## Verification actually recorded

The local test suite is 54 total: **53 passed, zero failed, one skipped**. The skip is native PostgreSQL parallel idempotency/global worker-claim acceptance without a native target.

Scope is actual local HTTP, actual PostgreSQL SQL through single-backend PGlite, real generated FFmpeg fixture media and byte/range transfer, real RSA CloudFront signature verification, injected AWS SDK transport contracts, actual frontend JavaScript in happy-dom, and real child-process active SIGTERM. These boundaries matter: none is real RDS, native pg pooling/TLS, Docker, actual AWS services, a full browser suite, or an actual YouTube source-to-device transfer.

Other CP-02 evidence: 67 JavaScript syntax checks; lock/entry checks; YAML and shell syntax; Terraform fmt; production dependency npm audit with zero known vulnerabilities at that checkpoint. A local burst of 20 HTTP requests admitted three and returned 17 QUEUE_FULL at the configured cap, with p95 155 ms on localhost/PGlite. It is not a worldwide speed/capacity result.

A real desktop browser review covered the illustrative picker and privacy page only. The complete Playwright desktop/mobile/axe suite is authored but unrun. No credential-bearing real browser journey is recorded.

A historical yt-dlp CLI lookup reported 44 formats using normal system CA trust. A subsequent request through the actual application returned a 502 source restriction. Metadata at CLI level does not prove app lookup, worker transfer or device delivery. Preserve and investigate supported behavior; do not bypass source restrictions, import login cookies or disable TLS.

H01 reruns are identified separately in the delivery receipt. Do not relabel historical CLI/load/audit/browser evidence with a new timestamp unless actually rerun.

## What still needs implementation and completion

There is no honest basis to call every remaining row missing code: much of the source is authored and awaits execution. Conversely, authored scripts are not a finished production system.

1. **Execute prepared checks, then fix findings.** Native pg/concurrency/TLS, Docker/lifecycle/resources, Terraform provider schema/mock tests and real desktop/mobile browser/axe acceptance are the first source-risk reducers. Complete browser/device expiry/reload/network/account-switching/cancel/expired-file acceptance and repair actual defects.
2. **Resolve the app source path.** The app-level source restriction is still open. Prove lookup and selected-quality final bytes on authorized media using the actual deploy image/network. If supported access is not viable, make a product/source decision rather than concealing the failure.
3. **Complete real distributed acceptance and any required fixes.** SQS duplicate/outbox/visibility/DLQ, native leases/quotas, multipart upload/cancellation, stale completion, isolated task handoff, retention/deletion, queue/DB/service outage and active task loss require real services and multiple clients.
4. **Validate and deploy the actual infrastructure.** Review target-account inputs and costs, provider validation/plan, IAM/network/secrets, image and CI, zero-task bootstrap, migrations, staged API/worker/frontend rollout. No AWS resources exist yet.
5. **Finish owner-specific product/policy setup.** Account/role/Region, traffic and spending bounds, source/market permissions, operator identity/contact/support commitments, sender/alert recipients, eligible markets and final retention/terms/privacy inputs remain unresolved. Wire approved values and verify delivery; do not invent them.
6. **Rehearse operations and recovery.** Measure capacity/speed/cost, authenticate security/abuse acceptance, dashboards/alarms, mail, backup restore/deletion handling, compatible rollback and geography/device journeys. Record exact evidence, then repair gaps.
7. **Operate and observe.** Pass release gates before a capped real beta. Collect actual launch/1h/24h/7d traffic, cost, source reliability, support and recovery evidence before expansion. This elapsed operating evidence cannot be generated in advance.

docs/REMAINING_WORK.md enumerates all 52 non-L core rows, with exact remaining acceptance and owners. docs/END_TO_END_STATUS.json retains every locally implemented row too. Even L rows retain production duties described in their evidence/remaining fields.

## Defaults already configured or proposed

| Control | CP-02 default |
| --- | --- |
| Final file / media duration | 250 MiB / 900 seconds |
| Active global download / analysis | 2 / 1 |
| Active per-user download / analysis | 1 / 1 |
| User daily jobs / bytes | 5 / 1.25 GiB per UTC day |
| Global daily jobs / bytes | 100 / 10 GiB |
| Queue cap | 100 |
| File / ticket access | File 30 minutes; ticket at most 10 minutes, bounded by asset expiry |
| Analysis deadline | 10 minutes |
| History/usage / audit-tombstone | 30 days / 90 days |
| Mail records / verify / reset / invitation | 7 days / 60 minutes / 30 minutes / 7 days |
| RDS backup / CloudWatch logs | 7 days / 14 days |

These are bounded beta defaults, not approved public service commitments. Operators can pause jobs/analyses and registration. A budget alarm is not a hard spending cap. The two NAT gateways and Multi-AZ database incur ongoing charges; the template's USD 50 example is not a quote, spending authorization or cost ceiling.

## Known deployment and recovery cautions

- Docker CLI/daemon is absent in the authoring environment. Native PostgreSQL binaries could not initdb because only root UID was mapped and chown failed. Terraform 1.17.0/provider 6.70.0 fmt passed, but provider startup failed because Unix socket creation was prohibited. These are concrete environment constraints, not successful executions.
- Actual AWS CLI/auth/account/Region/deploy access is absent. Do not copy old blocker conclusions into a capable new environment without checking.
- Terraform uses a generated CloudFront hostname by default. Its source declares the actual TLSv1 viewer policy limitation. An owned custom hostname with an already validated us-east-1 ACM certificate enables TLSv1.2_2021. Do not claim the default hostname enforces TLS 1.2 minimum. Domain/DNS remains conditional scope; a stronger-minimum product requirement would make it a release input.
- Non-root ECS volume metadata is prepared in Dockerfile via declared /app/.cache and /tmp volumes. A real build/task must still verify writable mounts and resource behavior.
- Bootstrap desired counts are zero, scaling is off, and a valid digest is required before running tasks/scaling. Deployment owns task_definition and desired_count via the documented lifecycle rule.
- An existing GitHub OIDC provider may require reuse/import; do not create conflicting account resources.
- CP-01 writers do not understand CP-02 S3 assets. The rollback tool refuses that incompatible image. The first upgrade uses forward fix or reviewed restore; later rollback requires a compatible CP-02 image and matching frontend. Never edit applied migrations or execute an automatic destructive down migration.
- Restore uses a separate private, billable clone. Reapply deletion requests/expired-access rules before exposing older backup contents; measure RTO/RPO and deliberately clean up drill resources.
- Do not commit filled evidence containing private data or self-referential exact-commit hashes. Use the pipeline's protected evidence input/report reference for the exact release commit.

## Repository guide

| Path | Purpose |
| --- | --- |
| dist/ | Frontend, account/operator/policy pages and downloadable source ZIP |
| backend/server.mjs, database-app.mjs | HTTP/API entry and persistent application routes |
| backend/worker.mjs, analysis.mjs, queue.mjs | Durable independent work and queue transports |
| backend/db/ and migrations/ | Durable data, accounting, outbox, SQL migrations |
| backend/storage.mjs, maintenance.mjs, mail.mjs | Media, cleanup and account communications |
| tests/ | SQL/HTTP/security/engine/UI/adapter contracts, native crash/TLS and authored browser suite |
| infra/terraform/ | Cloud modules, provider lock, examples, mock-security tests and deployment prerequisites |
| .github/workflows/ | Hosted verification and AWS OIDC delivery source |
| scripts/ops/ | Preflight, deploy/rollback, fault, source/security/probe/load/observe/restore/release tools |
| release/evidence.example.json | Exact 16-check production evidence template; intentionally pending |
| docs/ | API, operations, release, status, remaining-work and real-test handoff |
| delivery/HANDOFF_STATE.json | Portable machine-readable state |
| START_HERE.md, AGENTS.md, NEXT_MODEL_PROMPT.md | Entry point, working contract and copy-paste prompt |

## Ownership and how to switch models

The assistant/next coding model owns feasible implementation, relevant verification, fixes and documentation/packaging. A capable runner supplies missing Docker/native/browser/provider/cloud execution. The owner supplies account authorization, spend/traffic/Region and public operator/source/market/communications decisions. These are roles, not a requirement to use a particular model.

Open the full extracted project or attach the ZIP, paste NEXT_MODEL_PROMPT.md, and let the new model inspect files before acting. A browser model without filesystem/terminal/account tools can review or draft but cannot truthfully claim execution. No previous chat files, secrets or account sessions transfer automatically.

At every final work checkpoint, update status and handoff, give exact test scope/failures/skips/blockers/owners, and deliver the full latest ZIP plus checksum. A diff-only response or another plan is insufficient when feasible implementation remains.
