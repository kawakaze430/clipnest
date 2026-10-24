# ClipNest — start here

**Current direction: H03, 24 October 2026.** Codex owns the current implementation and verification work. Work directly on `main`, commit and push verified changes, and do not create branches or PRs. Read [CODEX_NEXT_PROMPT.md](CODEX_NEXT_PROMPT.md), [docs/NEXT_PATH.md](docs/NEXT_PATH.md), and the refreshed verification/status records first. The H02/H01 sections below preserve historical context. Production remains NO_GO.

**Current next step: H02, 23 October 2026.** Read docs/NEXT_PATH.md. For limited Codex Cloud execution use CLOUD_TEST_ONLY_PROMPT.md and docs/EXTERNAL_EXECUTION.md; the original project chat retains implementation/fix ownership. The H01 overview below remains historical application context. Core counts and NO_GO are unchanged.

This is the complete ClipNest project handoff, application checkpoint CP-02, handoff revision H01, dated 22 October 2026. It continues the existing YouTube quality-selection/download project. It is not StreamAtlas.

**Current release decision: NO_GO for public AWS production.** The existing owner-only hosted Site is a static frontend and source download. It does not run the Node API, PostgreSQL database, queue or workers. No AWS backend is deployed.

## Goal

A user signs in, pastes an authorized YouTube/Shorts URL, sees the qualities actually available, chooses a video/audio option, watches preparation progress, and saves the finished file. History and usage belong to that account. Deliver a bounded, supportable service on AWS for users in the approved worldwide markets, with secure media delivery, recovery, monitoring and measured capacity. Speed must be measured; never promise unlimited downloads or guaranteed speed.

## Read in this order

1. AGENTS.md — continuation and delivery contract.
2. delivery/HANDOFF_STATE.json — machine-readable current state and evidence boundaries.
3. docs/PROJECT_HANDOFF.md — goal, architecture, completed work and known limitations.
4. docs/END_TO_END_STATUS.json and .md — authoritative original 112-task register, including evidence and remaining acceptance for every ID.
5. docs/REMAINING_WORK.md — the 52 core tasks not yet locally implemented to their bounded acceptance.
6. docs/PRODUCTION_ACCEPTANCE.md — ordered real-run acceptance and the 16 production evidence gates.
7. docs/API.md, docs/OPERATIONS.md, docs/RELEASE.md, docs/HANDOFF.md, infra/terraform/README.md — implementation and runner instructions.
8. NEXT_MODEL_PROMPT.md — copy-paste instruction for continuing in another model/tool.

The register counts are 60 locally implemented, 25 partially implemented, 17 prepared but not executed, 10 externally blocked, and zero not started. These counts are not a completion percentage or a claim that the backend is live. Eight conditional domain/payment tasks are outside the 112 core tasks.

## Open and verify this snapshot

Extract the ZIP; open the single clipnest folder as the project root. Python 3.9+ can verify a delivered ZIP without installing app dependencies:

~~~sh
python3 scripts/package.py --verify /absolute/path/ClipNest-Complete-CP02-Handoff.zip
~~~

The archive contains delivery/FILE_MANIFEST.json with SHA-256 for every source file except the manifest itself. A separate .sha256 file identifies the entire ZIP. Hashes identify bytes; they do not prove production acceptance.

The ZIP deliberately omits installed dependencies, Docker images, database contents, private media, Git history, state, credentials and private keys. Install dependencies from the included lockfiles. The public RDS CA bundle and configuration examples are included. The retained .openai/hosting.json identifies the existing private Site; preserve it when updating that Site.

## Quick local checks

Use Node 24, npm, Python, FFmpeg and a working dependency network. The runtime installation procedure depends on the machine, not the model name.

~~~sh
npm ci --ignore-scripts
npm run check
npm test
~~~

For the complete disposable native stack, use Docker Compose v2:

~~~sh
npm run setup:local
docker compose up --build -d --wait
~~~

Open http://localhost:8787 exactly. Without Docker, npm run dev gives a disposable PGlite development preview only. Read README.md before running a configured API/worker or database migration. Real YouTube access is not proved by the fixture preview.

## First useful continuation

Run the authored native PostgreSQL/TLS, container, Terraform provider and desktop/mobile browser checks in an environment that supports them. Fix actual failures and retain evidence before provisioning AWS. Then follow the staged release checklist with the owner's account, Region, budget, traffic and public-policy inputs.

The authoring runtime lacked Docker/AWS access and could not execute a native PostgreSQL cluster or Terraform provider socket. Recheck capabilities in the new environment; do not assume those blockers persist or that a different model removes them.

## Deliver after each work checkpoint

Update the same status IDs and handoff documents, run relevant checks, then produce a complete source ZIP:

~~~sh
npm run package
python3 scripts/package.py --verify dist/clipnest-source.zip
~~~

For a distinct output filename:

~~~sh
python3 scripts/package.py --output /absolute/output/ClipNest-Complete-NEXT.zip
~~~

Every final project-work response must include the current complete ZIP, its checksum, updated status, tests actually run, remaining work, exact blockers/owners and the next useful action. A patch alone is insufficient. If nothing changed, link the verified latest ZIP and say so. Brief progress messages do not need a new ZIP.
