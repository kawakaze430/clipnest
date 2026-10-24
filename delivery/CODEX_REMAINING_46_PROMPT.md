# ClipNest — detailed remaining-46 execution assignment (post-H04)

## Absolute boundaries and current identity

Continue **the existing repository** `kawakaze430/clipnest`, checkpoint CP-02 v1.2.0, from the **current latest** `main`. Read `AGENTS.md`, `START_HERE.md`, `CODEX_NEXT_PROMPT.md`, `delivery/ENGINEERING_H04.md`, `delivery/LOCAL_VERIFICATION.json`, `docs/END_TO_END_STATUS.json`, `docs/PRODUCTION_ACCEPTANCE.md`, and affected runbooks/scripts. Do not regenerate the project, rewrite working systems, or treat local passes as production.

**NO branch, NO worktree, NO PR.** Work directly on `main`; preserve other changes and integrate concurrent updates without force pushing. Stage only reviewed changes and `git push origin HEAD:refs/heads/main`. Do not allow Actions to push auto-fixes or hide test failures. Never put credentials, cookies, URLs bearing tokens, private keys, private media, logs, Terraform state or environment files in git or deliverables. Do not modify already-applied SQL migrations. **Production stays NO_GO** until owner approval and all applicable 16 real acceptance gates pass.

## What is known, what is new

H04 implementation `36f744d352af47ffc399395abdf6d9e46fb4bc99`, H04 documentation `670ac96328ea24e820e5a593ba27f092b2480394`. Hosted Actions run [40069202760](https://github.com/kawakaze430/clipnest/actions/runs/40069202760) **passed seven jobs** (unit, native PostgreSQL 17/TLS/SIGKILL, browser/axe, provider mock, container/image/strict security/SBOM, dependency security, packaging) on implementation source. The runtime scan reported **zero HIGH, CRITICAL and secret findings** for that tested image/database, not for an eventual AWS ECR release digest. Current canonical 112-task counts are **66 L, 27 P, 9 R, 10 B, 0 N**; eight domain/payment extras are conditional. The 46 rows below are the **only unfinished original core IDs**. Do not promote them because a script or mock exists.

A narrow post-H04 change adds `scripts/ops/release-safety.mjs` and `tests/release-safety.test.mjs` and wires migration and rollback checks into `scripts/ops/deploy.mjs` and `scripts/ops/rollback.mjs`. It rejects missing/unconfirmed ECS migration exits and failed rollback HTTP readiness. Pure unit tests passed locally on Node 22; **full project/package/CI verification after this commit must be checked** on supported Node 24. Real staging restore/rollback remains pending. The interrupted prior assistant session mentioned six uncommitted edits in another environment; DO NOT assume those edits are on GitHub. Inspect actual `main`, diffs and worktree first, then implement anything still missing.

## Priority order — complete everything possible before asking for AWS

1. Verify this new release safety patch on Node 24: `node --test tests/release-safety.test.mjs`, `npm run check`, relevant ops/CI tests, `npm test` when dependencies are prepared; retain explicit skips. Review edge conditions in ECS task descriptions and rollback health failure propagation. Add additional real regression coverage if needed. No AWS calls for this step.
2. Finish **safe offline** implementation/test gaps first: Docker fault/resource drills on an **existing working daemon** with synthetic media; verify active SIGKILL/OOM/deadline, disk pressure, worker lease retry, no stale completion, cleanup and measurable RSS/scratch, without claiming ECS acceptance. Review restore/rollback scripts and exact deployed-image provenance handling; add deterministic negative unit tests and documentation. Make actual code changes only when a demonstrated defect exists.
3. Rerun **affected** groups only on correct source. Use H04 source-equivalent successes for unrelated native/browser/Terraform checks. If broad source/test/image/infra changes invalidate evidence, run the necessary full matrix via `CODEX_NEXT_PROMPT.md`; do not relabel historical runs. Keep the strict image gate, pinned media source verification, SBOM, secret detection, CA validation and current policy unchanged.
4. Prepare an **AWS dry-run preflight with no billable provision** once account-specific nonsecret inputs exist. Confirm expected role, account ID, Region availability for PostgreSQL 17 version/class, quotas and plan/cost. Do not call AWS until authenticated owner-approved scope is established; plan is not apply. Show a reviewed Terraform plan and explicit cleanup/cost estimates before anything billable.
5. Only after owner approval, deploy **private staging** with desired counts initially zero and owner-defined spend/traffic; use immutable ECR digest, remote scan/provenance, verified secrets, least-privilege roles and TLS. Do not enable public registration, custom domain, payments, create resource charges beyond explicit authorization, or perform live YouTube/real media tests without appropriate permission.
6. Perform the actual 16 evidence gates in `docs/PRODUCTION_ACCEPTANCE.md` and `release/evidence.example.json`: native RDS TLS, container lifecycle/resources, exact-image security, browser/device, load, security/abuse, S3/SQS/CloudFront, multi-instance failure, restore/rollback, multi-geography, authorized full source transfer, SES delivery, alarms, terms/privacy approval, support, and budget/capacity. Keep every unexecuted gate pending.
7. After gates pass, request owner approval for a **capped invitation beta**, gather actual elapsed launch / 1h / 24h / 7d evidence, and only then review expansion. No automatic worldwide launch.

## All 46 remaining original tasks (verbatim remaining-acceptance requirements from current register)

| ID | Current | Task | Required next acceptance | Owner |
|---|---|---|---|---|
| A-05 | B | Traffic targets and spending bounds | Owner supplies bounds; assistant completes the estimate and controls. | User + Assistant |
| A-06 | B | Permitted sources and supported markets | Owner confirms allowed workflow/media/markets and appropriate review. | User + Assistant |
| A-07 | P | Product retention and support decisions | Owner confirms public operator/contact, commitments and final policy/market scope. | Assistant + User |
| B-05 | P | Mobile layouts and device acceptance | Execute mobile browser/device/touch/file-save acceptance against the deployed API. | Assistant + Runner |
| B-07 | P | Session expiry and signed-out recovery UI | Execute actual device/browser expiry, reload and recovery acceptance. | Assistant + Runner |
| B-08 | P | Automatic same-origin API connection | Verify real CloudFront/ALB Origin, forwarded-hop, secure-cookie and routing behavior. | Assistant + Runner |
| B-09 | P | Account history and usage display | Complete browser account switching and running-job restart/resume against staging. | Assistant + Runner |
| B-10 | P | Progress, cancellation and network errors | Run browser interrupted-network/cancel cases and actual staged worker cancellation. | Assistant + Runner |
| B-11 | P | Ready, failed and expired download journey | Complete real permitted source-to-device transfer and actual expired-link/re-preparation browser acceptance. | Assistant + Runner |
| B-12 | P | Accessibility acceptance | Complete manual keyboard/screen-reader/device and deployed-page accessibility acceptance; local axe now passes. | Assistant + Runner |
| D-02 | P | Extractor integration and application lookup | Use the real-source acceptance command on the actual permitted target image/network; no protection bypass or new success claim. | Assistant + Runner |
| D-10 | B | Real authorized source-to-device transfer | Run an authorized full transfer from the actual target image/network and verify final bytes. | Assistant + Runner |
| E-04 | P | Native pg pool and TLS integration | Execute target RDS verifiedTLS/roles/failover and recovery acceptance; local native PostgreSQL 17 evidence is passed. | Assistant + Runner |
| E-09 | P | Upgrade and previous-image compatibility | Rehearse exact prior-image/compatible frontend rollback and native restored-database cutover. | Assistant |
| F-11 | P | Distributed duplicate-delivery acceptance | Execute native multi-client and actual SQS duplicate/retry/DLQ failures. | Assistant |
| G-07 | P | CloudFront signed media delivery | Validate real CloudFront expiry/cache/unsigned rejection and actual signed byte transfer. | Assistant |
| G-09 | P | Independent-task media handoff | Prove ready media survives actual task replacement and API/worker separation through S3/CloudFront. | Assistant |
| G-10 | P | Object retention/deletion monitoring | Measure actual S3 physical deletion, overdue alarms and monitoring during failure. | Assistant |
| H-06 | P | Container lifecycle/resource acceptance | Active container SIGKILL/OOM/disk/deadline and measured peak RSS/scratch acceptance remain unrun. | Assistant + Runner |
| H-07 | P | Image scanning, SBOM and provenance | Hosted image scan/SBOM job passed. Scan the actual release ECR digest and retain build provenance/attestations and real production acceptance. | Assistant + Runner |
| I-01 | B | Authorized AWS account/role runtime | Owner establishes a scoped authorized AWS runtime without sharing secrets in chat. | User + Runner |
| I-02 | B | Region and availability target confirmation | Confirm the target against source access, budget and audience. | User + Assistant |
| I-03 | P | Infrastructure-as-code modules | Review cost and execute an authorized account-specific plan/apply and real cloud acceptance. | Assistant |
| I-04 | R | Private networks, security groups and ingress | Provider validation and real account routing/direct-origin/security acceptance. | Assistant |
| I-05 | R | API/worker service and task definitions | Validate resource schema; run tasks, writable mounts, health/drain/replacement and load acceptance. | Assistant |
| I-06 | R | RDS provisioning and recovery configuration | Confirm Region/minor/class, validate/apply and execute native TLS/role/restore/RTO/RPO checks. | Assistant |
| I-07 | R | S3/CloudFront/WAF configuration | Provider/API validation plus actual CDN, WAF, signed media and no-origin-bypass acceptance. | Assistant |
| I-08 | R | Secrets, encryption and IAM policies | Review real policy simulation/access, existing OIDC provider reuse/import and key-rotation rehearsal. | Assistant |
| I-09 | R | AWS build/deploy pipeline | Configure owner repository/environment and run actual authorized staging deployment. | Assistant |
| I-10 | B | Actual AWS staging deployment | Run provider validation/plan, establish owner-authorized runtime/budget and provision staging. | Assistant + Runner |
| J-05 | P | Load, backpressure and capacity acceptance | Measure realistic staged load, duration, pool/resource pressure and geography against approved traffic targets. | Assistant + Runner |
| J-06 | P | Security/abuse acceptance | Run actual WAF/IAM/origin isolation and authenticated cross-user/security/abuse review. | Assistant + Runner |
| J-07 | P | Multi-instance failure and distributed recovery | Run actual multi-instance SQS/S3/DB outage, task loss and upload/cancellation fault acceptance. | Assistant + Runner |
| J-08 | R | Backup restore and rollback automation | Execute isolated backup restore and rollback, verify deleted/expired data, retain results and clean up clones deliberately. | Assistant + Runner |
| J-09 | P | Operational metrics and dashboards | Verify actual metric ingestion/dimensions/dashboard values with real traffic. | Assistant |
| J-10 | R | Failure, backlog and cost alarms | Apply and confirm human alert/recovery delivery; tune with measured traffic/cost. | Assistant + User |
| J-12 | P | Active-job process termination drills | Execute native/container hard-kill/OOM/deadline/cleanup drills and record bounded recovery. | Assistant + Runner |
| K-02 | P | Production terms, privacy and support pages | Owner supplies public legal entity/contact, eligible markets and final policy/rights/complaint approval. | Assistant + User |
| K-03 | P | Limited-beta onboarding and support process | Verify SES/operator enrollment and accountable live support before real invitations/public access. | Assistant + User |
| K-04 | R | Multi-geography availability probes | Run independent real-geography endpoint and permitted media/device transfer tests. | Assistant + Runner |
| K-05 | B | Public AWS HTTPS/edge acceptance | Deploy after code completion; verify HTTPS, cookies, caches and origin protections. | Assistant + Runner |
| K-06 | B | Monitored limited-beta release | Complete mandatory gates, open a capped beta and observe real behavior. | Assistant + Runner |
| K-07 | P | Capacity, spend and release-gate review | Owner traffic/budget/policies plus measured target-account costs/capacity and completed external evidence. | Assistant + User |
| K-08 | P | Release/rollback runbook completion | Rehearse actual rollout/rollback with matching image/frontend and verify service/account/media recovery. | Assistant + Runner |
| K-09 | B | Worldwide public production release | Pass the applicable gates and execute the worldwide release with tested limits. | Assistant + Runner |
| K-10 | B | Post-launch observation and expansion | Operate the capped release, observe elapsed traffic/support/cost/SLO evidence and review expansion. | Assistant + User |

## What YOU CANNOT complete without external prerequisites

- **Owner decision**: A-05, A-06, A-07, I-02, K-02, K-03, K-07 need approved traffic/monthly budget, permitted sources and markets, terms/privacy/retention, public legal/support identity and response commitments. Ask only nonsecret details; don't invent defaults as approvals.
- **Authenticated bounded AWS runner and explicit resource authorization**: I-01, I-03 through I-10, E-04, E-09, F-11, G-07/G-09/G-10, H-07, J-05/J-06/J-07/J-08/J-09/J-10, B-08 and K-05. Real service results are mandatory; a Terraform mock, Docker Compose, injected AWS SDK and local PostgreSQL do not close them.
- **Authorized media and actual devices/runners**: D-02, D-10, B-05/B-07/B-09/B-10/B-11/B-12 and K-04 require sanctioned test references and matching deployed source/network, plus independent device/geography runners. Do not bypass extractor restrictions with cookies/network rotation or disabled TLS.
- **Real time and final owner approval**: K-06, K-09, K-10, and release gates need operating history and explicit go/no-go. No model can produce 1h/24h/7d beta observation before the beta operates.
- **Optional extras**: do not add paid subscriptions or custom domains unless the owner chooses those eight conditional IDs.

## Validation and evidence contract

Use `AGENTS.md` and `CODEX_NEXT_PROMPT.md` for command matrix. In particular, native `CLIPNEST_TEST_DATABASE_MODE=docker node scripts/test-database.mjs --with-crash --with-tls`, browser `npm run test:browser`, Terraform locked `fmt/init/validate/test`, container `bash scripts/external/containers.sh`, strict `python3 scripts/ci/image-security.py clipnest:local --output qa-artifacts/image-security`, and `npm run package` / `python3 scripts/package.py --verify dist/clipnest-source.zip`. Only use an already available Docker daemon; never install a nested daemon, bypass sandbox/socket limits or alter the build policy to make failing evidence green. The smoke controller alone does not prove OOM/resource or exact release provenance.

Output: current pushed `main` commit; app/test/infra fingerprints; changed files/IDs; per-group command, pass/fail/skip/blocker and sanitized errors; actual CI run and artifact URLs; each of 16 production gates with pending/pass and evidence; current 112 counts (L/P/R/B/N); owner blocker table and next authorized action. Create **both** a complete current source ZIP with SHA-256 and a separate sanitized evidence ZIP with SHA-256; disclose unexposed artifacts or inaccessible blob downloads rather than inventing links. No unearned task promotions. **Production remains NO_GO** until complete acceptance and approval.
