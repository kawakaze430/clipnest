# Paste into Codex Cloud — limited execution only

Historical E01 profile: use this prompt only when explicitly requesting execution without source changes. For the current implementation/CI ownership assignment, use `CODEX_NEXT_PROMPT.md`; work directly on main, without another branch or PR.

You are the **execution-only verifier** for my existing ClipNest project. The engineering owner remains the original ChatGPT project chat. My latest instruction narrows the general AGENTS.md workflow: **do not implement features, fix application/test/Terraform source, redesign, refactor, upgrade dependencies, audit the whole project or deploy anything**. Return findings to the owner.

Read AGENTS.md, then docs/EXTERNAL_EXECUTION.md. Do not consume this task rereading the full 112-task plan. Use the current repository revision. The product goal is an authorized YouTube link → actual qualities → selected prepared download, but this task uses synthetic media and no YouTube/AWS credentials.

Execute only the checks the owning environment cannot run:
1. Native PostgreSQL/concurrency/upgrade plus active SIGKILL and local verified/negative TLS.
2. Existing Playwright desktop/mobile Chromium + axe.
3. Locked Terraform provider validate and mock tests.
4. Docker TLS/image/Compose/non-root/readiness/restart smoke **only if a working daemon already exists**.

If the published environment is prepared, run once:
~~~sh
python3 scripts/external/verify.py run --groups native browser terraform containers --budget-minutes 20
~~~

The runner probes capabilities, timeboxes execution and records sanitized evidence. Exit 2 means at least one group failed, was incomplete or blocked; preserve results. Do not rerun everything. If a dependency is missing, allow one supported setup attempt for that group with scripts/external/setup.sh GROUP, then run only that group. Stop immediately on prohibited sockets, unmapped users, unavailable Docker daemon or an unsupported privilege. Do not install a nested Docker daemon or bypass restrictions. Same-source verified CI results can replace an unnecessary repeat, but workflow definitions are not execution evidence.

Do not run npm test/audit/load again, make AWS API calls, use cloud credentials, test real YouTube, create cloud resources, change owner policies, enable public access, add billing or spawn other agents. Do not edit product or test source to make failures disappear. Keep original task statuses unchanged for owner review.

Return: exact commit and app/test-tree fingerprint; group pass/fail/skip/blocker counts; sanitized error details; summary.json/md; **ClipNest-External-Evidence.zip and checksum**; and the **complete current source ZIP and checksum**, created with:
~~~sh
python3 scripts/package.py
python3 scripts/package.py --verify dist/clipnest-source.zip
~~~

Evidence is separate because source packaging deliberately excludes runtime logs. Describe the source as unchanged if you made no source changes. All outputs must exist; if the UI cannot expose an artifact, state the exact path and limitation without fabricating a link. Do not spend the task inventing an upload service. The prepared manual workflow can return the same artifacts.

Conclude with what is still blocked and which runner capability it requires. **Production remains NO_GO.** A test failure belongs to the original owner for implementation/fixing.
