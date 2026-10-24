# E01 — minimal external verification contract

**H03 continuation:** the user's current assignment includes implementation/fixes and direct commits/pushes to `main`, with no extra branch or PR. Use `CODEX_NEXT_PROMPT.md` for that work. This document still defines the bounded execution-only profile when explicitly requested. Native tests now support `CLIPNEST_TEST_DATABASE_MODE=docker` for disposable PostgreSQL 17 and an existing daemon; browser evidence records an explicit `CLIPNEST_CHROMIUM_EXECUTABLE_PATH` override separately from Playwright's pinned browser. The runner never edits source or automatically promotes task statuses.

Handoff H02, 23 October 2026. This is a bounded execution assignment, not a transfer of engineering ownership. The original chat owns implementation, analysis of failures, fixes, status and complete-source packaging. External Codex/CI/cloud runners execute only assigned commands and return evidence.

## What to run and what it proves

| Group | Existing/new harness command | Evidence scope | Still not proved |
| --- | --- | --- | --- |
| native | node scripts/test-database.mjs --with-crash --with-tls | Real native SQL/pool/concurrency, populated upgrade, active process SIGKILL/replacement, trusted TLS and negative hostname/CA | Target RDS 17, AWS network/roles/failover/restore |
| browser | Pinned Playwright CLI, desktop/mobile Chromium + axe | Real browser JS and synthetic-media download/account/cancel/reload/accessibility journeys | Actual mobile hardware, all browsers, real YouTube, AWS edge delivery |
| terraform | 1.17.0 locked init with backend disabled, validate, test with mock providers | Actual provider schema and authored mock assertions | Account plan/apply/API/Region/network/IAM correctness |
| containers | scripts/external/containers.sh | Real Docker TLS, image/Compose startup, non-root/work/tmp, readiness and restart | Active container OOM/SIGKILL/disk/source failures, image scan/SBOM, ECS/AWS |

The embedded native package is PostgreSQL 18.4 beta at the recorded lock. Record the actual SHOW server_version result. It is useful native-driver proof, not a substitute for the PostgreSQL 17 target or a reason to deploy the beta package. The existing hosted CI also has a PostgreSQL 17 service and native crash job.

The native harness now keeps its own disposable cluster alive across regular/native-crash/TLS tests, then stops it and removes temporary data/certificates. It does not require Docker when mapped non-root users and Unix sockets are available. Generated private keys stay in temporary runtime storage and never enter the source ZIP.

## Preparation once, execution once

Use a disposable Linux cloud workspace, Node 24, Python 3.9+, FFmpeg and OpenSSL. Prepare during environment setup, not by having a model explore package-manager alternatives:

~~~sh
bash scripts/external/setup.sh all
~~~

Or prepare only one missing group: replace all with native, browser, terraform or containers. Setup installs locked npm dependencies; downloads checksum-verified Terraform into ignored .cache; and installs pinned Chromium only for browser/all. It does not install Docker, edit package manifests, call AWS APIs, create cloud infrastructure or run tests.

A failed optional provider/browser prewarm prints a blocker and leaves other groups available. Other setup errors can stop preparation; preserve the exact error and still probe capabilities. Do not keep reinstalling the same failed dependencies. Avoid changing the environment's lockfiles or package versions to hide an install failure.

Probe without starting a browser or test server:

~~~sh
python3 scripts/external/verify.py probe
~~~

Run the requested groups with a 20-minute command budget after the short probe:

~~~sh
python3 scripts/external/verify.py run --groups native browser terraform containers --budget-minutes 20
~~~

The runner never installs dependencies or fixes source. It checks working Docker, mapped non-root users, loopback/Unix sockets, executable/dependency availability and the pinned Terraform version. Unsupported groups become blocked and independent groups continue.

A browser binary existence check does not establish that its shared libraries or sandbox will work. An actual launch failure remains a failure/blocker with logs; do not pass it by disabling sandbox/security arbitrarily.

## Results and delivery

Each run writes a new ignored qa-artifacts/external-TIMESTAMP-ID directory containing:
- capabilities.json — runtime/tool capability facts and source identity.
- summary.json and summary.md — per-group result, commands, counts, limits and original task IDs for review.
- Sanitized command logs.
- ClipNest-External-Evidence.zip and its .sha256.

Return the evidence ZIP **and** the complete source ZIP generated with scripts/package.py. The source ZIP deliberately omits qa-artifacts, .env, media, dependencies, provider cache, keys and state; therefore the source ZIP alone cannot carry the test results.

Result semantics:
- passed: the selected bounded group actually executed and its required result checks passed without skipped coverage.
- incomplete: exit zero without the required actual test/count/project proof.
- failed: a command/test failed or timed out. Its logs decide whether the cause is source or environment.
- blocked: a prerequisite/capability is unavailable, or the total budget is exhausted.

Exit code 0 means every requested group passed its bounded E01 acceptance. Exit code 2 means at least one was failed/incomplete/blocked; it does not mean the evidence files should be discarded. A runner exception/invalid invocation is separate and must be reported accurately. No group promotes the 112-task master automatically or declares a production gate passed.

For a failed dependency, allow one supported preparation/retry of only that group. Permission/UID/socket/Docker restrictions stop that group immediately. Do not start privileged nested daemons, alter TLS trust, invent source/network workarounds, modify test expectations, apply Terraform or use AWS credentials.

## Repeat only necessary work

After the owner reviews and fixes actual findings, run only affected groups:

~~~sh
python3 scripts/external/verify.py run --groups browser --budget-minutes 10
~~~

For same-tree runs, --resume /absolute/path/old/summary.json can carry forward passed groups. Reuse requires an identical app/test/infra/runner fingerprint. Changed application/tests/configuration invalidate that automatic reuse. Documentation/runtime outputs do not invalidate it. Reused results are explicitly labeled; they are not fresh execution. Human review still validates the origin and contents of the reports.

A known same-source CI report can make Codex execution unnecessary. Do not infer success just because a CI YAML file exists.

## No-AI execution options

The manual .github/workflows/external-execution.yml workflow runs the same commands and returns artifacts. In GitHub Actions choose **ClipNest external checks (execution only)**, Run workflow, and the one unverified group. It defaults to native. Selecting all is one bounded sequential run. It has read-only repository permission, no deployment role, a 35-minute job limit and seven-day artifact retention.

The original Verify ClipNest push workflow may already run after upload/commit. Inspect its actual logs and artifacts before launching a duplicate Codex/CI run. To prevent automatic runs during initial upload, configure the new repository's Actions settings accordingly, then deliberately enable/run the manual workflow when ready. Private Actions allowances/billing must be checked in that account.

For AWS CodeBuild use infra/verification/buildspec.yml and docs/NEXT_PATH.md. It is also execution-only; its service role must not deploy the app. The definition is prepared but unrun. No AWS resources have been created by this handoff.

## What the original chat does on return

Verify commit/fingerprint and report provenance; review failures/skips; distinguish a dependency/runner problem from a product defect; implement and locally verify fixes; update the same task IDs with evidence; produce a complete new ZIP/checksum; request only the necessary external rerun.

Local controller unit tests are tests of timeouts/redaction/result interpretation, not proof that the external native/browser/provider/container groups ran.
