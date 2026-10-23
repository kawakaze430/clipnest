# AWS deployment source · CP-02

This module is prepared for a private, capped staging/beta environment. **No resources were applied.** Terraform 1.17.0 formatting parses locally. The installed AWS 6.70.0 provider cannot start here (`listen unix ... socket: operation not permitted`); validate, mock tests and an account-specific plan must pass on a normal runner before apply. Do not interpret formatting as provider-schema or AWS validation.

## Resources and boundaries

Two Availability Zones, NAT egress in each, private application and isolated database subnets; an internal ALB as a CloudFront VPC origin; API ingress only from that origin and database ingress only from application security groups. Node uses HTTPS at the edge, host-only Secure cookies and `TRUST_PROXY_HOPS=2`; verify the actual CloudFront/ALB forwarding chain in staging. API cache is disabled; frontend objects use S3 OAC; media uses a separate private bucket and CloudFront key group. WAF adds common rules and IP rate limits.

Private encrypted Multi-AZ PostgreSQL 17, managed admin secret, seven-day automated backups and deletion protection. Runtime and migration roles differ. ECS API/worker/migration tasks use a non-root image with bounded CPU/memory/scratch, read-only root, dropped capabilities and graceful stop timeouts. Services start at zero tasks with no valid bootstrap image; actual digest rollout is a separate step. CloudWatch metrics/dashboard, source/cleanup/queue/DLQ/resource alarms, optional SNS email and budget notifications are declared. Budget notifications are not spending caps.

Two NAT gateways, Multi-AZ RDS, ALB, tasks and data transfer have ongoing charges, even at low traffic. The example budget is an input placeholder, not an estimate or authorization. Review actual Region pricing and account credits, set an affordable budget and retain deletion protections. The default CloudFront certificate forces AWS's TLSv1 viewer security policy; the configuration declares that actual policy rather than promising a TLS 1.2 minimum. For a stronger minimum, set optional custom_domain and a validated us-east-1 acm_certificate_arn, then configure DNS and test TLSv1.2_2021. The owner must review this policy before public launch. CloudFront's generated HTTPS hostname supports staging; no domain purchase is necessary for this source path.

## Before apply

The owner must supply a scoped AWS context, intended account/Region, sender identity, alert recipient, budget/traffic bounds, permitted media/markets and repository environment. Never place credentials/private PEM keys in chat, Git or tfvars. Use a local AWS profile or GitHub OIDC. SES identity verification and production access/delivery are separate external checks.

1. Run all CI jobs, including provider validation/mock tests, Docker and native TLS. Confirm target-Region support for the exact PostgreSQL 17 minor and instance class:

```sh
aws sts get-caller-identity
aws rds describe-db-engine-versions --engine postgres --region ap-south-1
npm run deployment:keys
```

The key helper creates a private 0600 key under ignored `.cache/deployment`, refuses overwrites and prints paths only. Insert **only** the generated public PEM into a copy of `terraform.tfvars.example`. The first Region is an example, not an owner decision.

2. Create an appropriately restricted remote state bucket using the review-first bootstrap script, or use an existing approved backend. State must be private, encrypted, versioned and locked. Keep staging and production keys/accounts isolated.

```sh
node scripts/ops/bootstrap-state.mjs ap-south-1 clipnest-state-YOUR-UNIQUE-NAME
# After reviewing and authorizing the exact resource creation:
node scripts/ops/bootstrap-state.mjs ap-south-1 clipnest-state-YOUR-UNIQUE-NAME --execute
terraform -chdir=infra/terraform init -backend-config=../../.cache/deployment/backend.staging.json
terraform -chdir=infra/terraform fmt -check -recursive
terraform -chdir=infra/terraform validate
terraform -chdir=infra/terraform test
terraform -chdir=infra/terraform plan -out=../../.cache/deployment/staging.tfplan
```

Review the plan, IAM boundaries, NAT costs, backup/log retention, service-managed CloudFront VPC-origin security group creation and alerts. A successful plan is still not an apply. Bootstrap uses an internal ALB and creates the VPC origin before discovering its AWS-managed group; test this actual account sequence and quotas. Keep task counts zero and autoscaling off during provisioning. Never use `-target` to skip failed dependency/security checks.

3. Apply only the reviewed plan within the owner's authorized spending scope. Export non-secret outputs and initialize the application secrets:

```sh
terraform -chdir=infra/terraform apply ../../.cache/deployment/staging.tfplan
terraform -chdir=infra/terraform output -json > .cache/deployment/outputs.json
node scripts/bootstrap-secrets.mjs .cache/deployment/outputs.json .cache/deployment/media-private.pem
```

The secret helper refuses a private key that does not match the public-key fingerprint in the outputs. It preserves an existing session secret. It never writes plaintext secret values to Terraform state. Restrict the local ignored output/key directory and back up private keys in the approved secret recovery process.

## Image, database and service bootstrap

Push the source to an owner-controlled GitHub repository. Set environment variables `CLIPNEST_OUTPUTS_JSON` (the Terraform output JSON), `AWS_REGION`, `AWS_DEPLOY_ROLE_ARN` and, for production, exact-commit `CLIPNEST_PRODUCTION_EVIDENCE_JSON`. Apply protected-branch/environment rules and a reviewer before allowing production OIDC access. The role trust binds owner/repository and environment; no long-lived AWS key is needed. An existing GitHub OIDC provider in the account may need importing/reusing rather than duplication.

The deployment workflow runs verification, builds a unique immutable ECR tag, attaches BuildKit SBOM/provenance, scans the **digest**, runs the migration task, rolls workers then API, waits for stability/readiness and uploads the matching frontend. Migration code obtains the managed admin secret, applies checksums, creates/restricts `clipnest_app`, stores its connection secret, and revokes runtime migration-table mutations. Schema migration does not run in normal API startup.

The CLI equivalent supports a review before `--execute`:

```sh
node scripts/ops/deploy.mjs .cache/deployment/outputs.json YOUR_ECR_REPOSITORY@sha256:YOUR_DIGEST YOUR_COMMIT
```

Tasks need populated secrets and a verified image before starting. The workflow's first deployment can have no prior compatible CP-02 revision; it records that fact and never claims an unsafe CP-01 rollback. Terraform ignores service desired-count/task-definition drift because the digest release workflow owns those fields. Keep its base definitions/roles synchronized when changing infrastructure.

After the initial deployment, explicitly bootstrap the intended owner operator:

```sh
node scripts/ops/operator-bootstrap.mjs .cache/deployment/outputs.json OWNER_EMAIL
# Review recipient/privileged grant, then --execute on the authorized runner.
```

The owner receives a one-use password-setup message via SES, sets the password and signs in at `/account.html`. Verify actual inbox delivery and use `/operator.html` for invitations, download pause and registration controls. Do not open public registration merely because the tasks are healthy.

## Execution and removal

Run `aws-preflight`, security probes, a permitted live-source transfer, worker replacement/duplicate-delivery drills, restore verification, three-geography probes and alarms. Retain reports and exact image/commit identifiers. The runbooks describe key rotation, compatible rollback and post-launch observation. Removing resources is a separate deliberate operation: RDS/ALB protections and final snapshots intentionally prevent a casual teardown. Restored drill databases are billable until explicitly cleaned up after their evidence is retained.
