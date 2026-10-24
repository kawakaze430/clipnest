# ClipNest: remaining work to publish through AWS — H05

Production remains **NO_GO**. The application and hosted verification are implemented; 46 of the original 112 rows still require material owner input or real-service acceptance. Counts remain 66 L / 27 P / 9 R / 10 B / 0 N. The current evidence is in `delivery/LOCAL_VERIFICATION.json`; the complete original IDs remain in `docs/END_TO_END_STATUS.json`.

Work in this order:

| Stage | Work and acceptance | Current state / responsible party |
| --- | --- | --- |
| 1. Establish the target | Connect an owner-authorized AWS profile/role securely; select the expected account and Region, staging/monthly spend bounds, traffic limits, permitted media/markets and sender/operator contacts. | Owner inputs and secure identity are absent. AWS CLI v2 is installed, but the read-only identity command exits 255 because the configured profile is unavailable. Never paste credentials into chat. |
| 2. Review availability and cost | Verify authenticated account, RDS 17 version/class availability, quotas, source suitability and actual Region pricing. Review the two NAT gateways, Multi-AZ RDS, ALB, task/storage/CDN/egress, backup and logging costs against the approved limits. | Codex can perform account discovery after stage 1. No account-specific estimate or plan has run. Credits and budget alerts are not spending caps. |
| 3. Review the infrastructure plan | Prepare private encrypted/versioned/locked state; generate public signing-key input; use the expected account ID in both guarded Terraform providers. Keep bootstrap task counts zero. Review the full plan, IAM, network/origin isolation, backup/deletion protections, viewer TLS policy and deliberate cleanup. | Locked provider schema and two mock tests pass. Real account plan/apply remains pending. Do not substitute mocks for account proof. |
| 4. Deploy private staging | Apply the reviewed authorized plan; populate private secrets and verified SES; build/push/scan the exact ECR digest with SBOM/provenance; run exact-release migration, then workers/API and matching frontend. Configure main-only GitHub deployment environments and OIDC variables. | Release scripts now reject wrong accounts, incomplete migrations and unhealthy/mismatched readiness. GitHub environment setup returned HTTP 403 for this integration; owner/admin must configure it or grant the required scoped access. No AWS resources were created. |
| 5. Execute all real release gates | Test actual RDS TLS/roles/recovery, ECS lifecycle/resources, image provenance, source-to-worker-to-device bytes, S3/SQS/CDN, security/abuse, load/cost, multi-instance failures, restore/rollback, devices/geographies, SES/alarms, public policies and support. | All 16 production gates remain pending for the real release. Five local fault scenarios and offline deployment regressions now pass; they do not establish AWS acceptance. |
| 6. Operate a capped beta | With the gates and owner launch decisions satisfied, admit invitations, keep pause/quotas/support active and observe real launch/1h/24h/7d behavior, cost and failures. | Requires the live service and actual elapsed observation. |
| 7. Expand approved markets | Review measured capacity, source reliability, device/geography, support and costs, then expand tested limits through CloudFront. | Worldwide public launch remains blocked until the preceding stages pass. No unlimited speed/download promise or automatic global launch. |

## Prepare the input record

Copy `release/launch-inputs.example.json` to ignored `.cache/deployment/launch-inputs.json` and fill the actual nonsecret owner decisions. Authentication belongs in a secure profile/role/environment binding, not that JSON. The optional existing deployment-role ARN must match the selected account; a new GitHub role can be obtained from reviewed Terraform outputs later.

```sh
bash scripts/external/install-aws-cli.sh
export PATH="$PWD/.cache/external/bin:$PATH"
node scripts/ops/launch-readiness.mjs .cache/deployment/launch-inputs.json --probe-account --output .cache/deployment/launch-readiness.json
```

The first command installs the pinned official AWS CLI v2 source with verified source/archive/dependency-lock hashes into the local cache. The second checks inputs, optionally reads STS identity and reports exact blockers. It never provisions or claims production ready. Missing inputs prevent even the STS probe. This environment's placeholder input run correctly exits 2; the separate actual identity attempt failed at profile lookup before an AWS request.

Once discovery succeeds, follow `infra/terraform/README.md` for reviewed state/plan/apply and `docs/PRODUCTION_ACCEPTANCE.md` for the 16 named gates. Staging and production must remain isolated. The initial migration cannot authorize an unsafe CP-01 rollback; old rollback records lacking verified prior source/image provenance are refused. Readiness must use HTTPS outside local loopback and identify the matching healthy release.

## Engineering completed in H05

- Five disposable generated-media worker/container drills execute active SIGTERM, SIGKILL, actual kernel OOM, tmpfs ENOSPC and deadline expiry. They verify lease recovery/replacement, exactly one asset/accounting settlement, failed-job reservation release, cleanup, file hashes and measured RSS/cgroup/scratch. The image's default non-root user is tested separately by Compose; the fault harness maps the non-root runner UID for portable private bind mounts.
- Deployment and rollback share the concurrent release-safety helpers, with added exact image/task/source identity, bounded HTTPS readiness and expected-account checks before service operations. The actual prior release is retained separately from the incoming commit.
- Both Terraform providers require the explicit account ID. Frontend publication excludes generated ZIP/checksum files. Azure signed artifact URLs are redacted from failure evidence.
- Previously blocked H04 hosted artifacts now download successfully; their original scan/SBOM hashes verify, with zero HIGH/CRITICAL/secret findings. H05 checks retain any earlier failures and negative cases. H05 jobs all passed, but their raw artifact download uses a different Azure shard that returned HTTP 403; its exact domain requirement is saved for review/application.

The next productive handoff is the secure AWS target plus owner decisions in stage 1. Codex retains implementation, plan review, staging execution, testing and evidence ownership. Use `delivery/BROWSER_OWNER_PROMPT.md` for browser/account setup and `CODEX_NEXT_PROMPT.md` for engineering continuation. Work directly on main, with no branch/worktree/PR or force-push.
