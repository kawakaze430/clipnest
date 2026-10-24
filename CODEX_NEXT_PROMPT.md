# ClipNest engineering continuation — H03

Take engineering ownership of the existing ClipNest repository. Continue implementation, diagnose actual failures, run relevant checks, update the handoff, and return complete source and execution evidence. The earlier E01 execution-only assignment is historical unless the user explicitly selects it again.

## Git instructions — mandatory

Work directly on `main`. **Do not create any extra branch, worktree, or pull request. Push verified commits directly to main.**

Inspect `git status` and preserve existing user work. Fetch main and integrate concurrent changes safely. Never reset away work or force-push. Stage intended source/tests/workflows/docs only; exclude dependencies, runtime data, credentials, generated archives and evidence logs. After validation, commit and run `git push origin HEAD:refs/heads/main`, then verify the remote main SHA. Inspect push-triggered Actions when access is available. A push is not proof of green CI.

## Current external blocker

Main application commit `6b73b565e054b8be472bbb96e28fc2e99548dffd` was pushed successfully. Hosted run40060732120 rejected every job before any step because GitHub reports failed recent payments or a spending limit requiring attention. The account owner must resolve Billing & plans before retrying hosted execution. Do not repeatedly dispatch unchanged jobs or change payment settings automatically. All four local groups passed; their evidence remains valid on the recorded fingerprint.

## Image security work remains

Security refresh commit `91f5c7b14206669a9c7e0d1f344e794836941c09` is also on main. Current Debian13 image functionality passes, but strict Trivy scanning still fails:228 package findings representing47 unique CVEs (227HIGH/1CRITICAL), down from293/84 on Debian12. Node/Python findings are0 after removing build-only installers. Critical CVE-2026-6653 is in libxml2. No Debian fixed package is recorded, but upstream libxml2v2.15.4/FFmpegn9.0.2 exist; investigate a supported patched package set or verified ABI-consistent build. Do not call remediation impossible or suppress findings. Read the exact image/SBOM/triage artifacts and rerun only affected runtime/media/security checks after corrections.

## Goal and current source

ClipNest CP-02, application version 1.2.0, engineering handoff H03. Preserve the existing architecture: static frontend, Node 24 API, email/password/session identity, PostgreSQL 17/RDS, durable analysis/download workers, S3/CloudFront, SQS/DLQ and SES. The goal is authorized URL → actual qualities → selected preparation/progress/cancel → final file, with private account history and usage.

Record the actual fetched commit and runner fingerprint. Read AGENTS.md, delivery/HANDOFF_STATE.json, delivery/LOCAL_VERIFICATION.json, docs/NEXT_PATH.md, the complete docs/END_TO_END_STATUS.json register and affected implementation/runbooks. The private Site is a static checkpoint, not the AWS application. Production remains NO_GO until real acceptance gates pass.

## Changes to retain and review

- HTTP JSON parsing decodes UTF-8 after bounded byte collection, preserving Unicode passwords split across request chunks.
- Actual axe failures were corrected through shared text contrast changes; retain accessibility assertions.
- Native tests support disposable PostgreSQL 17 from an existing Docker daemon, avoiding embedded-package ICU incompatibility.
- TLS certificates have explicit public/private permissions; startup failures retain sanitized diagnostics and stop before misleading tests.
- Container tooling uses writable temporary state and optional public build-CA injection while preserving certificate verification.
- Independent CI jobs retain sanitized failures and complete source, use verified action pins, and never auto-edit/push source. Reusable verification defaults to all checks before deployment.

## Complete testing instructions

Reuse only verified same-source evidence with matching coverage. Run affected checks after a change and the full applicable matrix before a release checkpoint. Preserve exit codes; distinguish skipped, failed, blocked and unrun checks.

1. Prerequisites: Node 24/npm, Python, FFmpeg/OpenSSL and locked dependencies. Install with `npm ci --ignore-scripts --no-audit --no-fund`; do not upgrade packages to conceal failures.
2. Syntax/lock/assets: `npm run check`.
3. Unit/SQL/HTTP/security/FFmpeg/UI/process tests: `npm test`. PGlite's native-concurrency skip is not a native pass.
4. Runner/CI regression: `python3 -m unittest discover -s tests -p '*_test.py'`.
5. Actions validation: `bash scripts/ci/lint-workflows.sh` (official checksum-verified actionlint).
6. Native PostgreSQL 17: `CLIPNEST_TEST_DATABASE_MODE=docker node scripts/test-database.mjs --with-crash --with-tls`. Require concurrency, upgrade, active SIGKILL/replacement, trusted TLS and negative hostname/CA tests without skips. Docker must already work; never install/start a nested daemon. Embedded mode has a different version/host-library boundary.
7. Browser: install pinned Playwright Chromium, then `npm run test:browser`. Require desktop/mobile-emulation account, selected synthetic download, history, cancel, interrupted progress/reload/session recovery, overflow and axe journeys. An already installed browser may be selected explicitly using `CLIPNEST_CHROMIUM_EXECUTABLE_PATH`; record its version separately from pinned CI evidence. Do not disable browser security or axe assertions.
8. Infrastructure: checksum-verified Terraform 1.17.0, unchanged provider lock; run fmt, locked init with backend disabled, validate and mocks. Account plan/apply needs a scoped authorized target and cost inputs.
9. Containers: `bash scripts/external/containers.sh`; require TLS, image build, migrations, API/worker readiness, non-root writable work/tmp and restart. Use supported optional BuildKit public-CA secret injection when required by the platform proxy. Preserve TLS verification and keep the CA out of final layers. Capture startup logs before cleanup.
10. Security: production npm audit, exact-image vulnerability scan and SBOM. An authored CI job is not an executed scan.
11. Bounded evidence after prerequisites: `CLIPNEST_TEST_DATABASE_MODE=docker python3 scripts/external/verify.py run --groups native browser terraform containers --budget-minutes 20`. Carry any explicit browser override into this command. After a correction, rerun only its group; label resumed evidence as reused.
12. Complete source: `npm run package`, then `python3 scripts/package.py --verify dist/clipnest-source.zip`. Return complete source ZIP/checksum plus separate sanitized evidence ZIP/checksum; check distributable tracked source coverage.

`Verify ClipNest` runs on main pushes and has a manual group selector. Inspect logs/artifacts; avoid duplicate full runs. Fix confirmed failures and push directly to main. If GitHub API/network access is denied, record the limitation and finish independent work.

## Remaining real production acceptance

Use all 16 gates in release/evidence.example.json: native target PostgreSQL/TLS, container lifecycle, image scan, browser/device, load/backpressure, security review, S3/SQS/CloudFront, multi-instance failure, restore/rollback, multi-geography, actual authorized source download, SES delivery, alarm delivery, owner-approved terms/privacy, support contact and budget/capacity.

Require matching source/image/schema and actual services. Local PostgreSQL, mocked AWS, mobile emulation and synthetic media are separate evidence. Measure active termination/OOM/disk cleanup, target RDS recovery/RTO/RPO, physical deletion and off-task signed delivery. Operate a capped beta and gather elapsed observations before expansion.

Owner-specific prerequisites include scoped AWS account/deploy role, Region, staging/monthly spend bounds, traffic targets, permitted media/markets, verified sender/alerts and public operator/support/policy commitments. Inspect existing bindings by name/status and test supported read-only access before requesting missing credentials. Values belong in secure settings, never chat or archives. Do not create billable resources or launch publicly from guessed inputs.

## Required delivery

Report changes, commands/exit codes/test counts, source identity, blockers with owner/next action, and production decision. Update the same 112 IDs with evidence, recompute L/P/R/B/N counts, keep Markdown/compact status/handoff consistent, and increment the handoff for material changes. Return complete source and separate sanitized evidence ZIPs with SHA-256 checksums. State the pushed main commit and actual Actions status, including when remote results could not be inspected. Give the next bounded test/implementation prompt. Continue until feasible work is complete or a concrete external prerequisite blocks it.

The official Alpine image alternative remains unbuilt: dl-cdn.alpinelinux.org package access returned HTTP403. The environment draft now contains that required domain; review/save applicable settings before retrying this affected preparation. Do not treat a bare base-image pull as application validation.
