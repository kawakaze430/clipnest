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
