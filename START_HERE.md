# ClipNest — start here

ClipNest CP-02, application version 1.2.0, engineering handoff **H04**, 24 October 2026. Production is **NO_GO**; the AWS backend is not deployed. The existing owner-only Site is a static frontend checkpoint. Codex owns implementation and testing, with verified commits pushed directly to main and no branch, worktree or PR.

The goal is an authenticated authorized YouTube/Shorts URL → actual available qualities → selected durable preparation/progress/cancel → final file, with private account history and usage. The existing source includes the frontend, Node API, email/password/session lifecycle, PostgreSQL migrations, independent workers, queue/storage adapters, deployment, monitoring and recovery tooling. Continue this project from its files.

Read in this order:

1. [AGENTS.md](AGENTS.md) — continuation and delivery rules.
2. [Current engineering delivery](delivery/ENGINEERING_H04.md) and [verification](delivery/LOCAL_VERIFICATION.json) — changes, checks, failures and limits.
3. [Handoff state](delivery/HANDOFF_STATE.json) — exact current source/image and blockers.
4. [Complete status](docs/END_TO_END_STATUS.md) and [remaining acceptance](docs/REMAINING_WORK.md) — the original 112 core task IDs.
5. [Continuation prompt](CODEX_NEXT_PROMPT.md) and [testing path](docs/NEXT_PATH.md) — complete instructions for the next Codex session.
6. [Production acceptance](docs/PRODUCTION_ACCEPTANCE.md), [operations](docs/OPERATIONS.md), [release](docs/RELEASE.md) and [Terraform instructions](infra/terraform/README.md).

Counts are **66 L / 27 P / 9 R / 10 B / 0 N**. Eight conditional domain/payment extras are outside the 112 core tasks. Counts describe bounded implementation and evidence, not production readiness or effort percentages.

The patched local runtime now passes the strict image gate with zero HIGH/CRITICAL/secret findings. It uses coherently built libxml2 2.15.4 and FFmpeg 9.0.2 with pinned source hashes. Actual release digest/provenance and all applicable real production gates remain separate. Read the current verification record for hosted CI results; historical H01/H02/H03 capability failures are not current evidence.

To reproduce local application checks with Node 24, Python and FFmpeg/OpenSSL:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm test
```

Use the complete testing matrix for native DB, browsers, Terraform, Docker/media and image security. A cold patched-image build needs package/source network access, sufficient disk and approximately 15–25 minutes. No fixture test proves a real source-to-device transfer. AWS resources require the owner's scoped account/role, Region, approved spend/traffic and source/sender/operator inputs.

Create and verify complete source after material work:

```sh
npm run package
python3 scripts/package.py --verify dist/clipnest-source.zip
```

The ZIP contains a generated per-file SHA-256 manifest. Its external checksum identifies the whole archive. It excludes dependencies, Docker images, Git history, caches, credentials, database state and private media; lockfiles, build scripts/source lock, migrations, workflows, Terraform/provider lock, public RDS CA and handoff files are included. Deliver execution evidence in a separate sanitized ZIP with its own checksum.
