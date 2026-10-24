# ClipNest implementation and testing path — H04

The user's 24 October 2026 instruction transfers the current engineering work to Codex: implement observed fixes, improve Actions, test feasible behavior and push verified commits **directly to main, without another branch or PR**. The old H02 execution-only assignment is historical unless explicitly selected. Use [the complete next-task prompt](../CODEX_NEXT_PROMPT.md).

The project remains CP-02/version 1.2.0. Source changes/results are recorded in delivery/LOCAL_VERIFICATION.json and the canonical 112-task register. Production is NO_GO; local checks do not establish a deployed worldwide service.

## Automated testing matrix

| Group | Command / route | Required evidence |
| --- | --- | --- |
| Syntax/lock/assets | npm run check | All JS parses; lock/frontend entries agree |
| Application | npm test | SQL/HTTP/security/UI/FFmpeg/active SIGTERM; native skip listed separately |
| Runner/CI helpers | python3 -m unittest discover -s tests -p '*_test.py' | Failure propagation, redaction, timeouts, no-skip interpretation, native preflight, media-source integrity and strict image policy |
| Actions syntax | bash scripts/ci/lint-workflows.sh | Official checksum-verified actionlint validates workflows |
| Native database | CLIPNEST_TEST_DATABASE_MODE=docker node scripts/test-database.mjs --with-crash --with-tls | PostgreSQL17, concurrency/upgrade/SIGKILL/trusted-and-negative TLS |
| Browser | npm run test:browser | Desktop/mobile emulation and axe; synthetic media, actual browser version |
| Terraform | Pinned fmt, locked init, validate, mocks | Provider schema and executed mocks; no account plan/apply |
| Container | bash scripts/external/containers.sh | TLS/image/Compose/migration/API/worker/non-root/work/tmp/readiness/restart/account and five media formats |
| Security | Production npm audit; CI exact-image scan/SBOM | Current results, image identity and software bill of materials |
| Packaging | npm run package; read-only scripts/package.py --verify | Complete source manifest and whole-ZIP checksum |

GitHub Actions runs independent jobs on main pushes and supports selected manual groups. Packaging runs even if another check fails; sanitized artifacts retain failures and actual exit codes. Workflow permissions are read-only for source; no auto-repair/push. Manual environment-scoped deployment requires reusable verification's full default suite.

Existing Chromium can be explicitly selected with CLIPNEST_CHROMIUM_EXECUTABLE_PATH; record it separately from the pinned browser. Native auto/embedded/docker modes never install a daemon. Optional public-CA BuildKit secrets preserve proxy trust without copying CA files into final image layers. Diagnose readiness/build failures before retrying; reuse valid layers and verified same-source results.

## Remaining stages

1. Inspect hosted run 40069202760 for H04 commit 36f744d352af47ffc399395abdf6d9e46fb4bc99 and its retained artifacts. It started successfully after the earlier billing restriction. Current final outcome is in delivery/LOCAL_VERIFICATION.json. Fix actual source failures, push directly to main and rerun affected groups. Do not mistake Dependabot checks for the application matrix.
2. Obtain a permitted source-test reference and verify the actual app/image/network transfer before an expensive always-on stack. Preserve source restrictions; no cookies, alternate networks or TLS bypasses to conceal them.
3. Establish scoped AWS access, Region/availability, approved staging/monthly spend and traffic, sender/alerts, public operator/support and policy/market inputs. Domain/payments remain optional. Inspect existing bindings before requesting secure values.
4. Review account-specific staging cost/plan and execute only within actual authorization. Deploy matching image/schema/frontend with native DB, separate workers, queue and private signed media delivery.
5. Execute all16 named gates in release/evidence.example.json, including actual AWS transports, target RDS TLS/restore, active recovery, physical deletion, compatible rollback, security/load/cost and device/geography/source transfer.
6. Review gates, operate capped invitation beta and collect actual launch/1h/24h/7d observations before expansion. Elapsed operating evidence cannot be generated in advance.

Preserve112 IDs and all five L/P/R/B/N counts. Update evidence and remaining acceptance instead of promoting a broad task from one local check. Deliver complete source/evidence ZIPs and checksums, updated status/handoff and the next precise prompt. Exclude credentials, private media, database contents, state and account-bearing traces from distributable artifacts.

The Alpine package host now returned verified HTTPS 200 and the complete application image was built. Pinned upstream libxml2 2.15.4 and FFmpeg 9.0.2 are compiled together; the strict local image gate and five-format media checks passed. Use `python3 scripts/ci/image-security.py clipnest:local --output qa-artifacts/image-security`; remote releases require the exact digest and `--source remote`. Cold builds took about 14.4 minutes locally; allow a 30-minute container group or 35-minute combined batch and sufficient free disk. Preserve original failures and current source coverage.
