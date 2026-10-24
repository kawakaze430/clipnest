# Update after H04 — remaining 46 tasks and rollout guardrails

See [delivery/CODEX_REMAINING_46_PROMPT.md](delivery/CODEX_REMAINING_46_PROMPT.md) for the complete prioritized 46-task continuation and external prerequisites. The deployment migration now requires a confirmed stopped ECS task with present zero container exits; rollback requires healthy HTTPS readiness before reporting success. Unit regressions are in `tests/release-safety.test.mjs`. This narrow change does NOT close staging restore/rollback, alter the canonical 112 statuses or turn production GO. Run affected source and CI checks on the new commit before trusting its release tooling.

---

# ClipNest continuation — H04

Continue the existing ClipNest CP-02 application, version 1.2.0. Take engineering ownership: implement remaining feasible work, diagnose actual failures, run affected checks, improve CI, and deliver complete source plus separate sanitized evidence. Read AGENTS.md, START_HERE.md, delivery/ENGINEERING_H04.md, delivery/HANDOFF_STATE.json, delivery/LOCAL_VERIFICATION.json, docs/END_TO_END_STATUS.json, docs/NEXT_PATH.md and docs/PRODUCTION_ACCEPTANCE.md first. Preserve the architecture and original 112 core IDs; eight optional domain/payment extras remain separate. Production stays NO_GO until real acceptance passes.

## Mandatory Git workflow

**Work directly on main. Do not create a branch, worktree or PR. Commit verified changes and push directly with `git push origin HEAD:refs/heads/main`. Never force-push.** Inspect the working tree, fetch and safely integrate concurrent main updates, preserve existing work, and stage only intended source/tests/workflows/docs. Do not commit credentials, runtime state, caches, dependencies, logs or generated ZIPs. Actions must not edit source or auto-push fixes.

The H04 implementation commit is `36f744d352af47ffc399395abdf6d9e46fb4bc99`; the later documentation commit is identified by Git and the external delivery receipt. Local image evidence identifies `sha256:1e03721bfd9086e928e721a2813747fb572bcd56d545bf7c4b095040a5bdcd94`. It is a disposable Compose image with SOURCE_COMMIT=development, not a deployed release. Keep source commit, runner fingerprint, image digest, schema, tools and timestamps distinct. Never invent self-referential commit/ZIP hashes.

## Image remediation completed locally

Official Node 24 / Alpine 3.24 now builds pinned upstream libxml2 2.15.4 and FFmpeg 9.0.2 together under `/opt/media`. `build/media-sources.json` locks upstream commits/archive SHA-256; source bytes and version files are verified before compilation. The final exact-image strict Trivy 0.70.0 HIGH/CRITICAL OS/library plus secret gate passed with zero findings; CycloneDX includes the otherwise undiscovered source-built components. Five generated media formats and runtime imports passed. The unused non-YouTube extractor carrying an upstream bundled AWS key was removed without scanner suppression.

Keep the strict policy. Do not switch vendor feeds and claim that fixes known upstream flaws: an older Alpine candidate had zero vendor vulnerability findings but was rejected by the required patched-media check. Use the common fail-closed helper for local and digest-qualified remote release scans. A successful SBOM cannot hide scanner failure. Actual ECR digest/provenance acceptance remains pending. Current scan results are time/image/database specific.

## Current results and retained failures

Fresh H04 evidence: syntax/lock/assets passed (68 JS files); application 55 passed, one explicit PGlite-native skip; Python helper/source/security regressions 32 passed; native Docker PostgreSQL 17.11 suite 29/29 with no skips; Chromium 154 desktop/mobile-emulation + axe rerun 8/8; Terraform 1.17.0 / locked AWS 6.70.0 provider init/validate/mock 1/1; patched Compose/TLS/migration/API/worker/non-root/write/restart/account and five-format media checks passed; production npm audit zero vulnerabilities; exact-image strict security gate passed.

Retain the initial browser 7/8 result: the synthetic analysis could complete before the test observed its pending state. The corrected browser case supplies deterministic pending GET status, still sends a real cancellation DELETE, checks storage cleanup, then restores actual API/media responses. Backend cancellation is covered independently. Both profiles passed afterward. Also retain the initial source include-prefix build failure, PostgreSQL disk-exhaustion failure and intentionally rejected old-image gate. Do not erase failures or label retries as original successes.

## Complete testing matrix

Reuse evidence only when source coverage remains valid, retaining original timestamps/fingerprints. Rerun affected checks after corrections. Before accepting a release, execute the full applicable matrix on its exact source/image and preserve nonzero/timeout/skip results.

1. Node 24/npm, Python, FFmpeg/OpenSSL: `npm ci --ignore-scripts --no-audit --no-fund`; do not upgrade dependencies to conceal failures.
2. Syntax/lock/assets: `npm run check`.
3. SQL/HTTP/security/fixture media/UI/process: `npm test`. Its PGlite-native skip is not a native pass.
4. CI/controller/source/security regressions: `python3 -m unittest discover -s tests -p '*_test.py'`.
5. Workflow syntax: `bash scripts/ci/lint-workflows.sh` (checksum-verified actionlint).
6. Native DB/concurrency/upgrade/active SIGKILL/trusted and negative TLS: `CLIPNEST_TEST_DATABASE_MODE=docker node scripts/test-database.mjs --with-crash --with-tls`. Use an existing working daemon, no nested daemon. Never use production DB.
7. Browser: install Playwright's pinned Chromium, then `npm run test:browser`. An existing `/usr/bin/chromium` may be selected explicitly with `CLIPNEST_CHROMIUM_EXECUTABLE_PATH`; record its actual version separately. Preserve axe/security assertions and credential-bearing traces outside distributable artifacts.
8. Terraform: checksum-verified 1.17.0; `fmt -check -recursive`, `init -backend=false -input=false -lockfile=readonly`, `validate`, `test`. Never infer actual AWS acceptance from mocks.
9. Containers: `bash scripts/external/containers.sh`. Cold pinned-source media compilation took about 14.4 minutes here; allow 25 minutes for the command and 30 minutes for its group. Ensure sufficient disk. Optional public proxy CA is mounted with BuildKit secrets; never disable TLS/signature/checksum verification or copy secrets into layers. Tests clean their disposable services.
10. Security: `npm audit --omit=dev --audit-level=high --json`; `python3 scripts/ci/image-security.py clipnest:local --output qa-artifacts/image-security`. A release must use the exact remote digest with `--source remote`, retain scanner DB provenance, source manifest and SBOM, and fail on any HIGH/CRITICAL/secret or missing/mismatched evidence.
11. Bounded runner after prerequisites: `CLIPNEST_TEST_DATABASE_MODE=docker python3 scripts/external/verify.py run --groups native browser terraform containers --budget-minutes 35 --output qa-artifacts/current`; add an explicit installed-browser override only when needed. This bounded controller does not change application source, master statuses or deploy AWS.
12. Packaging: `npm run package` and `python3 scripts/package.py --verify dist/clipnest-source.zip`. Confirm all distributable tracked files, including `build/`, workflows, tests, lockfiles, SQL, Terraform/provider lock, public CA and handoff docs are included. Return a separate sanitized evidence ZIP and both checksums.

H04 hosted run 40069202760 passed all seven jobs on the implementation commit, including pinned-browser, native, container/media/security and source packaging. Earlier billing failures are historical and resolved for this execution. Artifact download from this cloud runtime returned HTTP 403 at GitHub’s Azure storage host; the exact host requirement is saved in the environment draft. Apply reviewed settings and retry only that affected download, preserving the successful API job/artifact metadata and local evidence meanwhile. Do not repeatedly dispatch unchanged jobs or change billing automatically. A successful Dependabot run is not application verification.

## Remaining ownership and real acceptance

Counts are 66 L / 27 P / 9 R / 10 B / 0 N, not production readiness percentages. B-14 is resolved locally; H-07 remains partial until actual release digest/provenance acceptance passes. H-04 is locally implemented after all seven hosted jobs passed. Do not promote broad tasks from one local check.

Inspect secure bindings before requesting inputs. No authenticated AWS deployment context has been established. Account/deploy role, Region, approved spend/traffic, authorized media reference, SES sender/alert recipients, and public operator/support/policy/markets inputs remain required. Do not invent values or provision billable resources from guesses. Custom domains/payments are conditional.

Once authorized prerequisites exist, review account-specific staging plan/cost, deploy matching source/image/schema/frontend, then execute all 16 gates in docs/PRODUCTION_ACCEPTANCE.md and release/evidence.example.json. Actual AWS/RDS/S3/SQS/CloudFront/SES, real source-to-device transfer, physical devices/geographies, active container OOM/hard-kill/resource limits, restore/rollback, alarms/support and measured cost/capacity remain unproved. Preserve source restrictions; no imported cookies, network rotation or TLS bypass to turn a failure green. Observe the capped beta at actual elapsed launch/1h/24h/7d times after acceptance.

Update the canonical JSON + rendered status, compact master counts, handoff and next prompt together. Retain historical 24-area compact counts and original 112 IDs. Deliver pushed main SHA, actual checks/failures/skips, exact remaining blockers/owners, complete source/evidence ZIPs/checksums and a precise next action. Keep production NO_GO until applicable acceptance gates pass.
