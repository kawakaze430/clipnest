# ClipNest — next path with minimal external AI use

Handoff H02 · 23 October 2026 · application CP-02 / 1.2.0.

**Engineering ownership stays in the original ChatGPT project chat.** External Codex Cloud, CI, AWS and other runtimes are execution tools for precisely assigned gaps. They are not asked to rebuild the project or take over feature work. The Windows laptop is a browser/download/upload client; heavy local setup is the final fallback.

Core status remains **60 locally implemented / 25 partial / 17 prepared, unrun / 10 externally blocked / 0 not started = 112**. Eight optional domain/payment tasks remain separate. Worldwide AWS production is **NO_GO**; the private hosted Site is static frontend/source only.

## What was completed here for this next step

- A short, execution-only Codex Cloud prompt with explicit no-feature/no-refactor/no-deploy instructions.
- A capability probe and bounded external-check runner, sanitized per-command logs, result summaries, source fingerprints, same-tree resume and return-evidence ZIP.
- Native harness support for one disposable run combining database/concurrency/upgrade, active SIGKILL and local TLS; no Docker dependency when the runtime supports users/sockets. This combined run is prepared, not executed here.
- A Docker smoke helper that cleans only its uniquely named disposable Compose project.
- Remote dependency preparation and a targeted manual GitHub Actions workflow requiring no AI model.
- An AWS CodeBuild fallback definition for only an unverified group.
- The ownership, resource allocation, dependency-failure and release route below.

These are prepared automation/source changes. The native/browser/provider/container groups have not passed in this authoring environment.

## Who does what

| Work | Responsible party | What is returned |
| --- | --- | --- |
| Product/architecture, frontend/backend/database source, test/infra/harness fixes, review of reports, docs/status/ZIP | Original project chat | Implemented changes, local checks and complete updated ZIP/checksum |
| Only currently unavailable native/browser/provider/container execution | Codex Cloud, or a deterministic hosted runner | Exact commands, actual pass/fail/skip/blocker evidence; no product edits |
| Real source/image/network and actual AWS services/restore/edge/mail/alerts/capacity | Authorized AWS execution context, using prepared commands | Target-account evidence, measurements and safe report references |
| Account/role/Region/spending authorization, public operator/support/policy/source/market decisions, sender/alert destination | User/account owner | Concrete inputs and approvals that the assistant cannot invent |
| Manual real-device file-save/accessibility and beta observations | Approved testers/operator; assistant supplies checklist | Actual device/geography and operating evidence |
| DNS/payments | Only if selected later | Separate implementation/merchant/domain acceptance |

I can own engineering decisions and fixes here. Account access, source/market permission, a physical-device result and elapsed live operation still need the corresponding human/service context. No model automatically has another environment's files, credentials or capabilities.

## Resource use in your situation

The limits/balances below are user-reported and not account-verified. Credit eligibility/expiry/remaining balance and service coverage must be checked in the provider account before use. Storage capacity does not substitute for compute or a database.

| Resource | Assigned use | When to use it |
| --- | --- | --- |
| This project chat | Primary implementation, fixes, test design/review, documentation and packaging | Default owner throughout |
| Limited Codex Cloud access | Run E01 fixed commands once; no broad coding assignment | Only for groups not already proved by same-source CI |
| GitHub Actions, if available | Deterministic native/browser/provider/Docker execution without an AI session | Prefer for a targeted remaining group after checking allowance/billing |
| AWS USD 200 reported credit | Short-lived verification runner if needed; later reviewed capped AWS staging/production work | Only with explicit account/role/Region and approved spend, not a blind full-stack apply |
| Azure USD 100 reported credit | Backup disposable Linux runner if Codex/Actions/AWS verification cannot run a necessary group | Avoid running duplicate stacks in two clouds |
| Colab reported 200 units | Reserve for permitted bounded interactive CPU/FFmpeg/checksum experiments if a new need appears | Existing fixture/unit work already runs here; no GPU or notebook is needed now |
| Google Drive 5 TB | Owner-held versioned ZIP/evidence backups | Small source/report archives; no live DB, queue, download origin or app server |
| Antigravity/Gemini access | Optional alternate agent for a narrowly unresolved tool/review task | Not needed for routine fixes I can do here; if its commands run locally, it is still local compute |
| Codex local / Windows laptop | Final fallback only after suitable remote options for a particular check fail | No WSL/Docker/database/browser installation now |

Colab compute units are treated as compute balance, not Codex/LLM tokens. Google documents variable runtime availability and restrictions on unrelated file/media/web hosting and abuse-policy circumvention. Do not use Colab as this website's production host, a media relay, a tunnel or a source-access workaround.

## Step 1 — make source available, without installing locally

1. Download the complete H02 ZIP from the owning chat. Extract it; no npm, Docker or WSL on the laptop.
2. Use a **private** GitHub repository for Codex Cloud. Put the contents of the extracted clipnest folder at its root, so package.json, AGENTS.md, scripts, tests, infra and .github are directly beneath the repository root. Preserve .openai/hosting.json for the existing private Site. No dependencies/keys/state are in the delivered ZIP.
3. Check repository Actions/billing settings. The existing Verify ClipNest workflow can run on a push. If it already proves a needed group for this exact source, download its results instead of commissioning the same Codex task.
4. If you want controlled manual execution, keep Actions disabled during initial upload, then enable it when ready and run only the selected manual group. Do not launch both full CI and full Codex for the same source.

The private Site source repository is not automatically a selectable GitHub repository in a different coding product. This upload/import is a source-access step, not a local compute setup.

## Step 2 — prepare one reusable Codex Cloud environment

Current official guidance uses **Work in → Cloud → Select/Create environment**, connected GitHub repositories, setup review and Publish. Select your private ClipNest repository and keep environment access **Only me**. If your account presents the legacy setup UI, use its equivalent repository/setup controls rather than assuming the screens match.

Request Node 24, Python, FFmpeg/OpenSSL and the project's pinned dependencies. Ask setup to use:
~~~sh
bash scripts/external/setup.sh all
~~~

Use its Install script for dependency preparation. Start skill: “Execution-only ClipNest E01; do not start a production stack or repeat already recorded local tests; use docs/EXTERNAL_EXECUTION.md.” Review actual setup results, then publish the prepared environment. If a capability cannot be supplied, retain the blocker and make the other prepared groups available.

Allow the package-manager/OS package hosts and required HashiCorp/Playwright download destinations. Examples outside a preset can include registry.terraform.io, releases.hashicorp.com and cdn.playwright.dev; allow any genuine download-redirect host reported by the installer. Inspect the exact failing hostname. Do not open unrelated destinations or disable certificate verification. No YouTube access, AWS credentials or API key is needed for E01.

Use the model already available within your plan. I cannot guarantee the remaining quota or that a 20-minute command run consumes a fixed number of messages/tokens. The runner limits command time; reuse prepared state and avoid a large open-ended reasoning task.

Official setup references:
- https://learn.chatgpt.com/docs/cloud
- https://learn.chatgpt.com/docs/environments/cloud-environments

## Step 3 — send only the test-only prompt

Paste **CLOUD_TEST_ONLY_PROMPT.md**, not the broad NEXT_MODEL_PROMPT.md, into the cloud task. It assigns three required groups and a Docker group only when a daemon already works.

The one run is:
~~~sh
python3 scripts/external/verify.py run --groups native browser terraform containers --budget-minutes 20
~~~

Do not ask “finish the entire project.” Do not ask it to redesign, add features, rerun our regular unit/audit/load checks, deploy AWS, diagnose every historical task or write another production plan. It should return evidence for source fixes here.

A red result is useful. Failed/skipped/blocked checks must come back intact; no source edits or changed test expectations to force green results. Native/PostgreSQL test source and app state remain unchanged by the worker; disposable runtime files are allowed.

## Step 4 — return two ZIPs to this chat

Bring back:
1. The complete source ZIP and its checksum, even if unchanged.
2. ClipNest-External-Evidence.zip and checksum, with summary.json/md and sanitized logs.

Also include exact source commit, app/test-tree hash and relevant CI/run reference. Do not send cookies/passwords, database URLs, source auth links, AWS keys, private PEMs, signed media URLs or state.

I will review the reports, implement actual fixes here, update the same status IDs, run feasible checks and deliver the next complete ZIP. A rerun request will name only the affected group/check. Original master statuses are not automatically promoted by the external runner.

If the cloud UI cannot expose a downloadable artifact, it must state the real path/limitation. Use the prepared manual GitHub workflow for retrievable artifacts; do not waste AI time building a new upload system.

## Step 5 — route dependencies once

| Exact problem | First response | Next runner if still blocked |
| --- | --- | --- |
| npm/package download | Use the lockfile; one setup attempt; inspect approved host/CA/auth. Do not upgrade/rewrite | Prepared Actions/CodeBuild runner |
| Missing browser or shared libraries | One pinned browser/system-dependency setup; return exact failure if launch is restricted | Actions or approved Linux verification runner |
| Native initdb refuses root / UID mapping / socket denial | Stop that group; do not spend the task inventing privileges | Non-root Actions runner, suitable CodeBuild runtime or acknowledged disposable native DB |
| Terraform provider cannot bind Unix socket | Stop provider execution; fmt is not validation | Normal hosted Actions/CodeBuild/approved Linux runner |
| Docker daemon absent/denied | Stop Docker group immediately; no Docker-in-Docker setup in Codex Cloud | Manual Actions containers group, then CodeBuild if necessary |
| Native 18 tests pass but target is RDS 17 | Keep version boundary explicit; use existing PostgreSQL 17 CI and later real target acceptance | PostgreSQL 17 service / actual private staging RDS |
| Browser/app/schema/mock test actually fails | Return sanitized failing test/error/source details | Original chat fixes source; rerun affected group only |
| Actual source returns restriction | Preserve failure; evaluate supported authorization/runtime behavior | Owner/source decision and actual approved target; never use another cloud to evade restrictions |
| AWS account/credit/role unavailable | Stop account actions; preserve prepared plan | Account owner establishes scoped context |
| AI allowance exhausted | Keep the source/evidence; use deterministic scripts/CI | No second AI subscription is required for a fixed shell command |

One supported environment fix is allowed. Repeated unrelated reinstalls, proxy/VPN changes, permission bypasses, fake fixtures replacing native/cloud proof, or moving to the hot laptop by default are not the plan.

## Step 6 — deterministic fallback without consuming Codex reasoning

If Actions is usable, choose **ClipNest external checks (execution only)** under Actions, Run workflow, and only the still-unverified group. Download its artifact and return it here. It requires no AI agent. Check the account's included minutes/storage and spending controls; private-repository usage beyond allowances can be billed.

If Docker or another necessary group cannot run there, use AWS CodeBuild after the owner establishes a concrete account/Region/role and reviews the proposed cost. Prepared source: infra/verification/buildspec.yml.

Suggested **verification-only** project, not yet created:
- Name clipnest-verification; one concurrent build, automatic retries zero.
- Managed Linux x86_64 Ubuntu 24.04 standard:8.0, Node 24; select an approved compute size (a medium Linux worker is a practical starting proposal for the multi-container smoke).
- 35-minute overall project timeout; 20-minute runner command budget.
- Docker support/privileged mode for the containers group only. No nested daemon installation when a managed Docker image already provides it.
- No VPC/NAT/RDS/ECS/ALB/CloudFront resources for this test runner.
- Source from the owner's private repository or private S3 object. For GitHub-root source, buildspec path is infra/verification/buildspec.yml. For the delivered single-root ZIP uploaded to S3, it is clipnest/infra/verification/buildspec.yml.
- Select CLIPNEST_CHECK_GROUP=containers or the exact blocked group; not all by default.
- A verification service role restricted to the specific source/artifact locations and logs; no application deployment permissions, no production secrets.
- Private encrypted artifact output, short retention and deliberate cleanup of source/artifacts/logs/project when no longer needed.
- Review actual regional cost and credit eligibility first. A timeout/budget alert is not a hard dollar cap; reported credit is not authorization to spend the whole balance.

CodeBuild definitions are authored but unrun. AWS documentation confirms Node 24 availability in the listed standard images and Docker privilege requirements:
- https://docs.aws.amazon.com/codebuild/latest/userguide/available-runtimes.html
- https://docs.aws.amazon.com/codebuild/latest/userguide/create-project.html

Do not create resources just by pasting a “finish everything” prompt. The assistant owns preparing/reviewing the execution plan; the owner supplies the account-specific spend/permission decision.

## Step 7 — AWS feasibility, staging and release

| Stage | Work after E01 evidence is reviewed | Gate / owner |
| --- | --- | --- |
| E02 | Early authorized real-source feasibility from the actual intended image/network, using a disposable app test context before an expensive always-on stack | Owner provides permitted media/authorization reference; assistant supplies exact bounded command; restriction is not bypassed |
| E03 | Account-specific, cost-reviewed staging plan; image/digest/scan/SBOM; private state/secrets/roles; staged API/worker/DB/queue/object/edge rollout | Owner account/Region/traffic/budget input, assistant implementation/review, authorized AWS execution |
| E04 | Actual S3/SQS/CloudFront/SES/alerts/security/load/failure/retention, target RDS TLS/restore and compatible rollback; device/geography tests | All 16 real production evidence gates, matching source/image/schema |
| E05 | Capped invitation beta, real support, launch/1h/24h/7d observations and expansion review | Actual elapsed traffic/cost/source/support evidence; owner release decision |

A disposable runner source test is not the worldwide public AWS journey. It reduces the risk of provisioning the full stack before source feasibility is understood. The existing infrastructure's two NAT gateways and Multi-AZ RDS can use a small credit balance quickly; review/right-size staging before apply. Do not weaken production recovery/security just to label it cheap.

Required owner inputs before real deployment: scoped account/deploy role, Region/availability target, initial traffic/quotas and monthly/test spending limits, source/market authorization, public operator identity/contact/support commitments, verified sender and alert recipient, and approved policies/retention. Domain and payments are conditional extras.

No heavy local work is required now. If a particular mandatory check fails on all suitable remote runners and truly needs your machine, the next guide will name that one check, its minimum Windows setup, expected resource use and cleanup; it will not default to installing the whole platform.

## Official resource references

- Current Codex environment/setup/network: https://learn.chatgpt.com/docs/environments/cloud-environments
- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- Colab runtime/restrictions: https://research.google.com/colaboratory/faq.html

User-facing status/ZIP delivery remains required at every final project checkpoint. H02 does not claim any external execution or AWS deployment.
