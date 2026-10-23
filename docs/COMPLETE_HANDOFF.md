# Current H02 next step — 23 October 2026

Read docs/NEXT_PATH.md and CLOUD_TEST_ONLY_PROMPT.md for the current minimal external execution assignment. The original chat retains implementation and fix ownership. H02 adds execution tooling/guidance, with no application feature changes or external production acceptance. The H01 report below is retained as historical application context; counts remain 60 L / 25 P / 17 R / 10 B / 0 N, total 112. The current whole-ZIP hash and delivery commit are in the external delivery receipt.

---

# ClipNest — complete handoff report

Application CP-02, handoff H01, 22 October 2026. This report combines the main goal and completed work, all 52 non-L core tasks, and the real production acceptance checklist. The complete original 112-task register is included separately as docs/END_TO_END_STATUS.json and .md. Read NEXT_MODEL_PROMPT.md for a copy-paste continuation prompt.

# Complete project handoff — ClipNest CP-02 / H01

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


---

# Remaining work — original 112-task register

As of CP-02 / handoff H01, 22 October 2026. **52 core tasks are not yet L:** 25 partially implemented, 17 prepared but unrun, 10 externally blocked. This is not 52 missing modules: each row states the actual remaining implementation or real acceptance. Production is **NO_GO**.

All 112 IDs, including 60 locally implemented rows and their ongoing duties, remain in docs/END_TO_END_STATUS.json and .md. Do not renumber rows or turn authored scripts into execution evidence. Eight optional domain/payment tasks are excluded from the 112.

First execute native/PostgreSQL/TLS, container, Terraform provider and real browser checks on a capable runner, fix findings, then proceed to owner-authorized AWS staging and the real service/source/operations gates. See docs/PRODUCTION_ACCEPTANCE.md for ordered commands and pass criteria.

## Scope, planning and ownership

| ID | Current status | Existing evidence | What must still be done | Owner / blockers |
| --- | --- | --- | --- | --- |
| A-05 | Externally blocked | No owner-approved traffic model or target-account budget is recorded. | Owner supplies bounds; assistant completes the estimate and controls. | User + Assistant; B-07 |
| A-06 | Externally blocked | Required source-use and market inputs are unresolved in the current register. | Owner confirms allowed workflow/media/markets and appropriate review. | User + Assistant; B-08 |
| A-07 | Partially implemented | Concrete beta retention/support/identity/limits defaults are documented in docs/RELEASE.md and public beta pages; configurable retention is implemented. | Owner confirms public operator/contact, commitments and final policy/market scope. | Assistant + User; B-08, B-11 |

## Consumer frontend

| ID | Current status | Existing evidence | What must still be done | Owner / blockers |
| --- | --- | --- | --- | --- |
| B-05 | Partially implemented | Responsive account/operator/policy layouts added; desktop picker/privacy browser review completed; desktop/mobile Playwright overflow/download suite prepared. | Execute mobile browser/device/touch/file-save acceptance against the deployed API. | Assistant + Runner; B-01, B-02 |
| B-06 | Partially implemented | Actual frontend JS passed registration, login, logout and account-state checks against real HTTP/SQL in an emulated DOM; expiry-registration mode defect fixed. | Run credential-bearing desktop/mobile browser suite; DOM emulation is not real browser acceptance. | Assistant + Runner; B-01 |
| B-07 | Partially implemented | Actual frontend handles revoked sessions, clears private history, reopens sign-in and relogs in; emulated-DOM test passed; one-use reset form also passed. | Execute actual device/browser expiry, reload and recovery acceptance. | Assistant + Runner; B-01 |
| B-08 | Partially implemented | Same-origin config/session/CSRF discovery passed local HTTP+DOM tests; CloudFront private-ALB routing and cache-disabled API source authored. | Verify real CloudFront/ALB Origin, forwarded-hop, secure-cookie and routing behavior. | Assistant + Runner; B-02, B-09 |
| B-09 | Partially implemented | Account history/usage and load-more UI implemented; emulated-DOM test loads 20 then 22 owned items; logout/expiry clears private data. | Complete browser account switching and running-job restart/resume against staging. | Assistant + Runner; B-01, B-02 |
| B-10 | Partially implemented | Durable analysis cancel/poll, job cancel/progress and network recovery UI exist; HTTP/SQL cancellation tests pass; browser cancel/offline/reload cases authored. | Run browser interrupted-network/cancel cases and actual staged worker cancellation. | Assistant + Runner; B-01, B-02 |
| B-11 | Partially implemented | Ready file and history flow pass in real local HTTP with generated FFmpeg media and actual frontend emulated DOM; browser download/hash path prepared. | Complete real permitted source-to-device transfer and actual expired-link/re-preparation browser acceptance. | Assistant + Runner; B-03 |
| B-12 | Partially implemented | Keyboard radio navigation passes actual-JS DOM test; labeled account/privacy forms, focus treatment and contrast changes added; axe desktop/mobile suite authored. | Execute axe, keyboard/screen-reader/contrast checks and fix actual findings. | Assistant + Runner; B-01 |

## API and source integration

| ID | Current status | Existing evidence | What must still be done | Owner / blockers |
| --- | --- | --- | --- | --- |
| D-02 | Partially implemented | Extractor invocation, supported URL/quality filters and asynchronous application integration exist; prior real application request was source-restricted after CLI metadata succeeded. | Use the real-source acceptance command on the actual permitted target image/network; no protection bypass or new success claim. | Assistant + Runner; B-03 |
| D-10 | Externally blocked | No completed real selected-quality download is recorded; application source access failed. | Run an authorized full transfer from the actual target image/network and verify final bytes. | Assistant + Runner; B-03 |

## Database persistence and migrations

| ID | Current status | Existing evidence | What must still be done | Owner / blockers |
| --- | --- | --- | --- | --- |
| E-04 | Partially implemented | Native pg pool uses verified TLS/CA and runtime secret resolution; disposable Docker TLS/negative-CA/hostname test and native race/crash suites authored. | Execute native pooling, contention, TLS and RDS tests; PGlite cannot prove them. | Assistant + Runner; B-01, B-04 |
| E-08 | Prepared, not executed | scripts/test-database.mjs and the conditional parallel idempotency/worker-limit test are authored; execution is blocked by root-only UID mapping. | Run the supplied suite as a mapped non-root user or against a disposable TEST_DATABASE_URL. | Runner; B-04 |
| E-09 | Partially implemented | Populated CP-01 to CP-02 migration fixture passes in SQL, preserves accounting and reruns idempotently; deploy records prior tasks and refuses incompatible CP-01 rollback. | Rehearse exact prior-image/compatible frontend rollback and native restored-database cutover. | Assistant; B-01, B-02, B-04 |

## Jobs, worker execution and quotas

| ID | Current status | Existing evidence | What must still be done | Owner / blockers |
| --- | --- | --- | --- | --- |
| F-11 | Partially implemented | Two injected queue consumers demonstrate one SQL claim, deferred active duplicate, terminal duplicate ack, one completion/asset and one settlement. | Execute native multi-client and actual SQS duplicate/retry/DLQ failures. | Assistant; B-02, B-04 |

## Media storage and download delivery

| ID | Current status | Existing evidence | What must still be done | Owner / blockers |
| --- | --- | --- | --- | --- |
| G-07 | Partially implemented | CloudFront signing produces a verifiable RSA signature and exact ticket/asset-bounded expiry; API redirect, key group and private OAC origins authored. | Validate real CloudFront expiry/cache/unsigned rejection and actual signed byte transfer. | Assistant; B-02 |
| G-09 | Partially implemented | SQL assets can store S3 keys with no worker file path; injected off-worker upload/completion passes; API signs object delivery without a shared disk. | Prove ready media survives actual task replacement and API/worker separation through S3/CloudFront. | Assistant; B-02 |
| G-10 | Partially implemented | Deletion retries, expired-object count/age gauges, cleanup failures and lifecycle backstops implemented; gauge/retention tests pass locally. | Measure actual S3 physical deletion, overdue alarms and monitoring during failure. | Assistant; B-02 |

## Build, containers and delivery pipeline

| ID | Current status | Existing evidence | What must still be done | Owner / blockers |
| --- | --- | --- | --- | --- |
| H-02 | Prepared, not executed | Dockerfile installs production dependencies and FFmpeg/yt-dlp, uses node user and declares readiness healthcheck; no build/run evidence exists. | Build and smoke-test the image on a Docker-capable host. | Runner; B-01 |
| H-03 | Prepared, not executed | Compose definitions, shared volumes, dependency order and loopback binding are authored; YAML/static checks pass only. | Run Compose config/start/readiness/restart with real Docker. | Runner; B-01 |
| H-04 | Prepared, not executed | GitHub verification source now includes native DB/crash/TLS, Docker, browser/axe, Terraform and image scanning; no remote run is recorded. | Run the prepared workflow in an owner-controlled repository/runner and retain results. | Runner; B-01 |
| H-06 | Prepared, not executed | Non-root/read-only/resource-bounded task source, worker DB-heartbeat health, Compose lifecycle CI and active-container fault script are prepared; Docker is unavailable here. | Run build/start/stop/restart/active SIGKILL/OOM/disk and peak-RSS/scratch acceptance. | Assistant + Runner; B-01 |
| H-07 | Prepared, not executed | Exact pushed-image Trivy scan, BuildKit SBOM/provenance, immutable ECR and dependency-update workflow authored; production npm audit reports zero known vulnerabilities. | Run image scan/attestation generation and verify exact digest/provenance on the runner. | Assistant + Runner; B-01, B-02 |

## AWS infrastructure and staging

| ID | Current status | Existing evidence | What must still be done | Owner / blockers |
| --- | --- | --- | --- | --- |
| I-01 | Externally blocked | No authenticated deployment role, AWS CLI or sufficient infrastructure connection is available. | Owner establishes a scoped authorized AWS runtime without sharing secrets in chat. | User + Runner; B-02 |
| I-02 | Externally blocked | The plan proposes one Region plus global delivery; final account/Region/availability inputs are unconfirmed. | Confirm the target against source access, budget and audience. | User + Assistant; B-02, B-07 |
| I-03 | Prepared, not executed | Pinned Terraform root/module, state bootstrap, variables, outputs, mock-security tests and detailed setup authored. fmt parses; provider startup fails on forbidden local Unix socket. | Run locked init/validate/mock tests, then review an account-specific plan before apply. | Assistant; B-09, B-02, B-07 |
| I-04 | Prepared, not executed | Two-AZ NAT/private-app/isolated-DB network, scoped security groups and internal ALB/CloudFront VPC-origin ingress definitions authored. | Provider validation and real account routing/direct-origin/security acceptance. | Assistant; B-09, B-02 |
| I-05 | Prepared, not executed | Separate API/worker/migration roles/tasks, zero-count safe bootstrap, CPU/memory/scratch, health/drain/circuit breaker and optional API scaling definitions authored. | Validate resource schema; run tasks, writable mounts, health/drain/replacement and load acceptance. | Assistant; B-09, B-02 |
| I-06 | Prepared, not executed | Private encrypted Multi-AZ PostgreSQL 17, managed admin secret, runtime role bootstrap, seven-day backups, deletion protection and isolated restore commands authored. | Confirm Region/minor/class, validate/apply and execute native TLS/role/restore/RTO/RPO checks. | Assistant; B-09, B-02, B-04 |
| I-07 | Prepared, not executed | Separate private frontend/media buckets, OAC, signed media key group, CloudFront security/cache rules and WAF common/IP-rate rules authored. | Provider/API validation plus actual CDN, WAF, signed media and no-origin-bypass acceptance. | Assistant; B-09, B-02 |
| I-08 | Prepared, not executed | Scoped execution/API/worker/migration/deploy IAM, Secrets Manager/KMS, stable session/media secret bootstrap and rotation procedures authored; injected secret-loader tests pass. | Review real policy simulation/access, existing OIDC provider reuse/import and key-rotation rehearsal. | Assistant; B-09, B-02 |
| I-09 | Prepared, not executed | GitHub OIDC environment-scoped workflow prepares digest/SBOM/scan, migration, rollout, frontend invalidation, exact-commit production gate and compatible rollback records. | Configure owner repository/environment and run actual authorized staging deployment. | Assistant; B-01, B-02, B-07 |
| I-10 | Externally blocked | No AWS staging resources or full-stack endpoint exist; Terraform/deployment source is prepared but provider validation and account execution remain unpassed. | Run provider validation/plan, establish owner-authorized runtime/budget and provision staging. | Assistant + Runner; B-02 |

## Testing, reliability and operations

| ID | Current status | Existing evidence | What must still be done | Owner / blockers |
| --- | --- | --- | --- | --- |
| J-04 | Prepared, not executed | Playwright desktop/mobile + axe suite authored for signup/login/logout, selected fixture transfer, history, analysis/job cancel, network failure, reload/session recovery and policy pages. | Install/run browsers on the external runner; keep synthetic fixture proof distinct from live source. | Assistant + Runner; B-01 |
| J-05 | Partially implemented | 20 concurrent local HTTP submissions accepted exactly 3 and rejected 17 at configured queue cap; local p95 155 ms in single-backend PGlite. Native concurrency path is prepared. | Measure realistic staged load, duration, pool/resource pressure and geography against approved traffic targets. | Assistant + Runner; B-02, B-04, B-07 |
| J-06 | Partially implemented | Local SSRF/input/ownership/CSRF/config/account negative tests pass; staging private-bucket/unsigned-media/auth/CORS probes and security acceptance checklist authored. | Run actual WAF/IAM/origin isolation and authenticated cross-user/security/abuse review. | Assistant + Runner; B-02 |
| J-07 | Partially implemented | Injected duplicate-delivery/upload/outbox failure and stale-lease SQL tests pass; native SIGKILL replacement test and two-worker ECS stop/replace drill authored. | Run actual multi-instance SQS/S3/DB outage, task loss and upload/cancellation fault acceptance. | Assistant + Runner; B-02, B-04 |
| J-08 | Prepared, not executed | Review-first private RDS restore clone, read-only TLS/schema/accounting verification, compatible task rollback and measured RTO/RPO procedure authored. | Execute isolated backup restore and rollback, verify deleted/expired data, retain results and clean up clones deliberately. | Assistant + Runner; B-02, B-04 |
| J-09 | Partially implemented | Bounded EMF counters/gauges/latency batches implemented/tested; CloudWatch dashboard and read-only observation collector authored. | Verify actual metric ingestion/dimensions/dashboard values with real traffic. | Assistant; B-02 |
| J-10 | Prepared, not executed | Queue/DLQ/source/cleanup/API/RDS/worker and budget alarms, optional SNS route and alarm-delivery test procedure authored. | Apply and confirm human alert/recovery delivery; tune with measured traffic/cost. | Assistant + User; B-02, B-07, B-10 |
| J-12 | Partially implemented | Real-process active SIGTERM drill passes; native active SIGKILL/lease expiry/replacement, active Compose SIGKILL and staging ECS replacement procedures/scripts authored. | Execute native/container hard-kill/OOM/deadline/cleanup drills and record bounded recovery. | Assistant + Runner; B-01, B-02, B-04 |

## Release, worldwide rollout and maintenance

| ID | Current status | Existing evidence | What must still be done | Owner / blockers |
| --- | --- | --- | --- | --- |
| K-02 | Partially implemented | Responsive private-beta terms/privacy/support pages now cover identity, retention, export/deletion, authorization, failures and beta contact; draft status is explicit. | Owner supplies public legal entity/contact, eligible markets and final policy/rights/complaint approval. | Assistant + User; B-08, B-11 |
| K-03 | Partially implemented | Operator invitations, production email verification, pause/registration controls and user-facing beta help/onboarding implemented and locally SQL/HTTP tested. | Verify SES/operator enrollment and accountable live support before real invitations/public access. | Assistant + User; B-02, B-10, B-11 |
| K-04 | Prepared, not executed | Read-only endpoint/latency/security/header probe and independent CodeBuild buildspec authored for Asia/Europe/North America. | Run independent real-geography endpoint and permitted media/device transfer tests. | Assistant + Runner; B-02, B-03 |
| K-05 | Externally blocked | The planned public AWS application entry point does not exist and cloud access is absent. | Deploy after code completion; verify HTTPS, cookies, caches and origin protections. | Assistant + Runner; B-02 |
| K-06 | Externally blocked | Required infrastructure/live-media/operational gates have not passed; no staged beta can be operated yet. | Complete mandatory gates, open a capped beta and observe real behavior. | Assistant + Runner; B-02, B-03 |
| K-07 | Partially implemented | Concrete quota/pause/budget/alarms defaults, capacity/cost worksheet and fail-closed exact-commit production evidence validator implemented; local admission and gate tests pass. | Owner traffic/budget/policies plus measured target-account costs/capacity and completed external evidence. | Assistant + User; B-02, B-07, B-08 |
| K-08 | Partially implemented | Environment-specific state/secrets/image/migration/frontend rollout, compatible rollback and first-upgrade forward-fix/restore instructions and scripts completed. | Rehearse actual rollout/rollback with matching image/frontend and verify service/account/media recovery. | Assistant + Runner; B-01, B-02, B-04 |
| K-09 | Externally blocked | No public AWS backend exists and mandatory gates remain open; a private frontend is the delivered scope. | Pass the applicable gates and execute the worldwide release with tested limits. | Assistant + Runner; B-02, B-03 |
| K-10 | Externally blocked | Launch/1h/24h/7d observation checklist and read-only service/queue/alarm/metric collector prepared; no beta deployment or real observation period exists. | Operate the capped release, observe elapsed traffic/support/cost/SLO evidence and review expansion. | Assistant + User; B-12, B-02, B-03 |

## External blocker register

| ID | Boundary | Evidence | Precise unblock / owner |
| --- | --- | --- | --- |
| B-01 | Docker execution unavailable | docker not on PATH; /var/run/docker.sock absent. | Use a Docker-enabled local machine or authorised CI/CodeBuild runner; retain build/run logs. Owner: Execution environment / developer — required production gate. |
| B-02 | AWS deployment access unavailable | AWS CLI absent; no AWS auth source detected; plugin discovery found analytics functionality, not an infrastructure deployment connection. | Establish a scoped, authorised AWS deployment context and verify account, role, Region and permitted actions. No credentials in chat. Owner: Account owner / deployment environment — required production gate. |
| B-03 | Application-level live source path has not passed | CLI returned 44 formats with system CA trust; actual application request returned 502 source-restriction error. Full real file transfer is unverified. | Investigate supported app/runtime behaviour, then pass controlled source-to-worker-to-device tests with authorised media and the actual AWS image/network. Preserve failure details; do not treat a fixture as proof. Owner: Developer and source/platform dependencies — required production gate. |
| B-04 | Native PostgreSQL execution requires another runtime | Schema/repository implemented and PGlite SQL/HTTP tests passed. Native binaries installed; root-only UID namespace prevents non-root initdb execution (chown EINVAL). No native concurrency/TLS target supplied. | Run the provided native suite in a mapped non-root environment or with a disposable TEST_DATABASE_URL. Preserve the single-backend/native distinction. Owner: Docker/non-root runner or disposable database context — required production gate. |
| B-05 | Payment provider and live-test prerequisites absent | Provider, merchant approval, test/live keys and integration are absent. | Choose a suitable provider, implement and test sandbox/webhooks, then arrange an explicitly authorised live test and reconciliation. Owner: Merchant owner / payment provider / developer — conditional only. |
| B-06 | Custom domain and DNS inputs absent | No chosen owned domain or authorised DNS management context. | Provide chosen domain/DNS context and validate certificates; staging can use an AWS-generated hostname. Owner: Domain owner — conditional only. |
| B-07 | Traffic and spending bounds undefined | No verified target-account estimate, traffic model or budget. | Estimate compute/database/CDN/egress costs and define tested quota/worker/cost controls before provisioning and public access. Owner: Account owner and developer — required production gate. |
| B-08 | Permitted source use and market scope unresolved | Authorisations and supported-market review not established; YouTube terms restrict download and automated use. | Confirm the allowed workflow and relevant source/rights-holder permissions; complete appropriate public terms, privacy, support and complaint handling. Owner: Product owner / appropriate review — required production gate. |
| B-09 | Terraform provider execution unavailable here | Official Terraform 1.17.0 and AWS provider 6.70.0 installed; fmt passes; provider listen unix socket fails operation not permitted. | Run the prepared locked-provider validate/mock jobs on a normal CI runner, then fix any real provider/API errors before plan/apply. Owner: Runner executes; assistant owns any source fixes — required production gate. |
| B-10 | Production sender and notification delivery unverified | SES/outbox and alarm source exist; no verified account sender/production access, inbox or alert delivery is recorded. | Owner confirms sender/alert recipient and SES production access; runner verifies actual email and alarm delivery. Owner: Owner + authorized AWS runner — required production gate. |
| B-11 | Public operator/contact/policy commitments pending | Concrete defaults, private-beta policy/help pages and operator enrollment exist; no public operator identity/contact/response commitment approval. | Owner supplies public identity/contact and approves final policy/support/market commitments before opening registration. Owner: Product owner — required production gate. |
| B-12 | Post-launch observation requires a live capped beta | Observation collector/checklist are prepared; the application is not deployed on AWS and no real beta traffic/cost window has elapsed. | First close release gates and operate the capped beta; then gather actual launch/1h/24h/7d evidence. Owner: Operator after authorized release — required production gate. |

## Conditional work outside the core denominator

| ID | Deliverable | Current state | Activated when / owner |
| --- | --- | --- | --- |
| OPT-D01 | Choose/prove domain ownership and DNS access | Externally blocked | Custom domain selected; User |
| OPT-D02 | Domain DNS/certificate configuration | Not started | Custom domain selected; Assistant + User |
| OPT-D03 | Custom hostname/certificate acceptance | Not started | Custom domain selected; Assistant + Runner |
| OPT-P01 | Merchant/provider choice and approval | Externally blocked | Paid release selected; User |
| OPT-P02 | Billing/entitlements and verified webhook implementation | Not started | Paid release selected; Assistant |
| OPT-P03 | Sandbox payment/idempotency/refund tests | Not started | Paid release selected; Assistant + Runner |
| OPT-P04 | Explicitly authorized live payment reconciliation | Externally blocked | Paid release selected; User + Runner |
| OPT-P05 | Paid-release support/failure/refund acceptance | Not started | Paid release selected; Assistant + User |

No payment integration, provider approval, sandbox/live transaction test or custom-domain ownership/DNS proof is recorded. Do not silently add these tasks to a free beta or claim that all optional work is done.


---

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
