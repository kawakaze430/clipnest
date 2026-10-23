# Copy-paste continuation prompt for the next model

**H02 routing:** This is the broad owner-continuation prompt. For the user's limited Codex Cloud allowance, use CLOUD_TEST_ONLY_PROMPT.md instead: execute assigned unavailable checks only and return evidence; leave implementation/fixes with the original project chat. See docs/NEXT_PATH.md.

Attach the complete ClipNest ZIP to the new chat, or extract it and open its clipnest folder in the coding tool. Paste the prompt below. A model needs the files and the required tools/account access; the prompt does not transfer a prior chat's filesystem, credentials or execution capability.

---

You are taking ownership of my existing **ClipNest** project. Continue the delivered implementation; do not start a new project. The attached ZIP is the complete source checkpoint. I want you to do all feasible implementation, verification, fixes, documentation and packaging, and use my limited external coding time only for capabilities that are actually unavailable here.

**Main goal:** A signed-in user pastes an authorized YouTube/Shorts link, sees the genuinely available video/audio qualities, chooses one, watches durable analysis/download progress or cancels it, then downloads the final file. Maintain private account history/usage. Deliver the complete frontend, backend, PostgreSQL database, independent workers, queue, media delivery, monitoring, security, backup/recovery and tested AWS rollout for users in approved worldwide markets. Start with a free, capped, invitation beta. Measure speed; do not invent qualities or guarantee unlimited/fast downloads.

**First, inspect the actual delivered files in this order:**
1. START_HERE.md and AGENTS.md.
2. delivery/HANDOFF_STATE.json.
3. docs/PROJECT_HANDOFF.md.
4. docs/END_TO_END_STATUS.json and .md: original 112 core IDs, evidence and what remains.
5. docs/REMAINING_WORK.md and docs/PRODUCTION_ACCEPTANCE.md.
6. README.md, docs/API.md, docs/OPERATIONS.md, docs/RELEASE.md, docs/HANDOFF.md and infra/terraform/README.md.
7. The implementation, lockfiles, migrations, tests and deployment scripts relevant to the next work.

Use source inspection and newer verified evidence to resolve stale prose; preserve the original task IDs and document corrections. Historical CP-00 planning proposals do not override the current implementation. This is ClipNest, not StreamAtlas.

**Known baseline, to verify rather than blindly repeat:**
- Application CP-02, package version 1.2.0; H01 is the handoff/packaging revision.
- CP-02 application source baseline: 92a00a4bb1a2c0ae3de12105f37e129ab5e8df10. A later handoff Git commit can include documentation and packaging changes; check the delivery receipt/current Git instead of guessing it.
- Core counts: 60 locally implemented, 25 partially implemented, 17 prepared but not executed, 10 externally blocked, zero not started, total 112. Eight optional domain/payment tasks are separate. Zero not started does not mean finished.
- Local suite: 54 total, 53 passed, zero failed, one explicitly skipped native PostgreSQL concurrency case. Follow the record's timestamp/scope and report your own runs separately.
- Actual local HTTP, FFmpeg fixture bytes/range, SQL through single-backend PGlite, real RSA signatures, injected AWS SDK contracts, emulated-DOM frontend and active-process SIGTERM were verified. These do not prove native PostgreSQL/TLS, Docker, a real browser journey, AWS services or a real YouTube transfer.
- A prior yt-dlp CLI lookup reported 44 formats with normal system CA trust. The actual application lookup later returned a source-restriction 502. No complete real selected-quality source-to-device transfer is proved.
- Existing hosted Site is owner-private and static frontend/source only. The Node API, RDS, workers and AWS backend are not deployed. Public/worldwide production remains **NO_GO**.
- Current stack: static vanilla frontend, Node 24 API, implemented email/password/session/verification/reset identity, native pg/RDS target, yt-dlp/FFmpeg, SQS transactional outbox + independent ECS workers, private S3/CloudFront media, SES/encrypted outbox, Terraform and GitHub OIDC deployment. Do not replace current identity with the old proposed Cognito design automatically.
- Authoring-environment blockers: absent Docker/AWS deployment context; native initdb refused root-only UID mapping; Terraform provider local Unix socket was prohibited. Check if your environment can now run them. Another model's name is not an execution capability.

**Work autonomously within the authorized scope:**
- Audit source and capability availability first, then execute the highest-value unblocked work and fix observed failures.
- Do not re-scaffold the project, ask me to repeat information already in the files, or mark independent coding blocked merely because AWS is unavailable.
- First useful external execution is the authored native PostgreSQL/concurrency/TLS, container build/lifecycle/resource/fault, Terraform provider validate/mock, and desktop/mobile Playwright/axe suites. Run these on a suitable authorized runner; retain exact failures and fix them. Synthetic browser media still needs separate real-source acceptance.
- After those pass and I provide the target AWS account/role, Region, budget/traffic limits, sender/alert recipient and owner/public-policy/source/market inputs, prepare a concrete account-specific plan and staged deployment. Use the account's established authorization; don't invent a budget or apply billable resources to a guessed account.
- Then prove actual S3/SQS/CloudFront handoff/expiry, SES and alert delivery, private origins/IAM, active-worker loss/duplicate/outage/cancel recovery, RDS restore and compatible rollback, target load/cost, real authorized source transfer, and independent multi-geography/device behavior.
- The exact-commit evidence gate has 16 named checks in release/evidence.example.json and scripts/ops/release-gates.mjs. A referenced report must exist and be reviewed before marking passed. No fixture, mock, skipped test, successful build or static page can replace these real checks.
- Never edit applied migrations, disable TLS verification, bypass source restrictions, import login cookies, rotate networks to evade restrictions, publish secrets/state or widen Site audience.
- Payments/custom domain are conditional extras. Do not expand free-beta scope without my decision.
- When a tool/capability/input is unavailable, record the exact blocker and owner, produce a runnable handoff for that action, and keep completing independent work. Do not stop with just a plan if you can implement or fix something.

**Output contract for EVERY final project-work reply/checkpoint:**
1. Current goal/checkpoint and production GO/NO_GO decision.
2. Updated counts for Locally implemented / Partially implemented / Prepared, not executed / Externally blocked / Not started, using the same 112 IDs.
3. What changed by task ID, what already exists, what remains, evidence and owner. List actual new work; do not relabel all prepared scripts as complete.
4. Checks actually run, with pass/fail/skip counts, environment/backend, source/image/schema reference and relevant limitations. Separate historical results from your fresh run.
5. Material blockers with exact missing capability/input, unblock action and owner; list the next unblocked tasks.
6. A downloadable COMPLETE updated project ZIP, its SHA-256 checksum, and updated full status/handoff/next-model prompt. A patch alone is not acceptable. Include frontend/backend/migrations/tests/lockfiles/containers/Terraform/workflows/public CA/runbooks and handoff files, with no credentials, private media, installed dependencies, Terraform state/cache or old nested ZIPs.
7. Update the handoff so another model can resume without this conversation.

Run npm run package and python3 scripts/package.py --verify dist/clipnest-source.zip after your final changes. If a new source directory/file is required, update the packer's include list and verify the complete distributable file set. Use an external delivery receipt for a final Git commit/whole-ZIP hash so the archive does not claim a self-referential identity.

If nothing changed, link the verified latest ZIP and state that it is unchanged. If your environment cannot create an artifact or execute a check, say so accurately; never make up a successful test, deployment or file link. Short intermediate progress updates do not require a ZIP.

Begin by reading the files, verifying the snapshot and current capabilities, identifying the next unblocked work, and carrying it through implementation/testing/packaging.

---

## If the new chat cannot access an attachment

Use a coding environment with a project filesystem or open the extracted folder in the tool. Give it this prompt and START_HERE.md. Have it inspect actual files before editing. If it can only produce text, it can review and prepare changes, but it cannot truthfully claim to have installed, run, deployed or packaged the project.
