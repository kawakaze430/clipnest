# Operations and incident procedures · CP-02

## Runtime contract

One public HTTPS origin serves static frontend and `/api`. The private Site preview is a separate static checkpoint. Production uses Node/PostgreSQL, dedicated workers, SQS with a transactional outbox, private S3/CloudFront media, SES and Secrets Manager. Never horizontally scale the local-filesystem adapter without a real shared-filesystem design; the prepared AWS path uses S3 so API and workers need no shared media disk.

Production configuration refuses a missing database, weak/unstable secret, HTTP public origin, nonsecure cookie, disabled TLS verification, URL SSL overrides or development file mail. `.env.example` lists all settings. `DATABASE_SECRET_ARN` resolves a Secrets Manager JSON `{host,port,dbname,username,password}` at process start and is mutually exclusive with DATABASE_URL. ECS injects the stable session key and API-only media signing key. Secret rotation requires a controlled task restart; no credentials are logged.

Default admission: 250 MiB/file, 15-minute video, two active downloads globally, one concurrent analysis globally, one active download/analysis per account, five started downloads/user/UTC day, 1.25 GiB/user/day, 100 queued jobs, 100 jobs/10 GiB globally/day. Maximum output bytes are reserved atomically before queuing and settled once; cancelled/failed jobs still count as started jobs. These caps do not equal total network egress or an AWS billing cap.

## Health and routine checks

`/healthz` is liveness. `/readyz` and `/api/health` test migrated database/engine/FFmpeg, plus a worker heartbeat within 45 seconds in production. The worker container health command checks a private file updated only after successful database access. This does not prove source success or SES/SQS/S3 reachability. Watch service running/desired count, p95 latency, queue age, DLQ, analysis/download success, memory, temporary disk, expired-object age, cleanup failures and costs.

Structured request logs contain request ID, method, route, status and elapsed time. File-ticket paths are redacted. EMF dimensions are bounded to Environment/Role, with no user/email/video labels. Request latency is batched; expiry metrics are gauges. CloudWatch log retention is 14 days, audit-table default 90 days. Never paste cookies, action links, signed media URLs, passwords or raw message bodies into support logs.

## Job delivery and drain

Job/reservation/usage/outbox/audit commit together. An outbox lease publishes download.requested to SQS before marking dispatched. Ambiguous publication may duplicate delivery; the DB-owned lease/state is authoritative. SQS is at-least-once; visibility renews while working, completion commits only with the current unexpired DB lease. Terminal failure writes a failure event to the DLQ. Invalid envelopes go to the DLQ with a body digest only. Do not replay raw untrusted payloads.

Workers stage per-attempt directories, verify containment, tracks, duration, size and SHA-256, upload an independently named object, check its metadata/length, then atomically mark ready. Losing a lease/cancellation between upload and completion removes the unowned object; orphan cleanup is a backstop. CloudFront URLs expire at the earliest ticket/asset deadline, at most ten minutes. A signed URL already issued cannot be instantly revoked by a DB session logout; expiry or physical deletion bounds that window.

SIGTERM stops claims/long polling, aborts active extractor/upload work, waits for services and abandons leases. The worker CLI allows 25 seconds under ECS's 30-second stop timeout; the API CLI allows 15 seconds. Retry recovery is bounded to three attempts. A process SIGTERM drill passes locally using a persistent single-backend SQL fixture. Docker SIGKILL/OOM/CPU/memory and native multi-client behavior remain external acceptance.

## Retention and privacy

Access expires at the DB deadline even if physical cleanup is late. A leased maintenance sweep runs about every minute, deletes expired objects, records retry attempts, retries deletion after one minute, sweeps old unreferenced S3 objects and local attempt directories, prunes expired actions/tasks and terminal jobs, and emits overdue-object age/failure metrics. A one-day S3 lifecycle and multipart abort are backstops, not minute-accurate deletion. Directory/object sweeping skips live DB-owned work and a default 60-minute orphan grace.

Default history/usage retention is 30 days, audit 90 days, outgoing mail records seven days, expiry actions one extra day, worker-heartbeat records one day. Account closure immediately revokes sessions, anonymizes email/password, cancels jobs, clears link/title metadata and expires assets. Cleanup removes personal history after assets are deleted. Tombstone removal waits for audit retention and all references. Late analysis completion or sign-in cannot repopulate deleted-account data. Seven-day database backups and provider email delivery records require the operator's privacy/recovery policy. Restores must reapply deletion requests before exposing an older snapshot.

## Incident: source unavailable or restricted

1. Compare analysis failures with a single authorized test and installed engine/FFmpeg health. Preserve safe error code/request ID and source/target image versions.
2. Pause new downloads in operator controls when repeated failures waste capacity; explain the outage in the beta support channel. Let valid ready files expire normally.
3. Check official extractor updates in isolated staging and rebuild/scan a candidate image. Do not bypass platform protections, import user cookies, disable certificate validation or cycle networks to evade a restriction.
4. Reopen only after the real application lookup and checksum transfer succeed from the actual target image/network. A CLI-only metadata result or synthetic fixture is insufficient.

## Incident: queue backlog / DLQ

Pause new downloads if oldest message age exceeds five minutes or queue growth exceeds the tested budget. Inspect counts and redacted outbox publication errors; check worker health, DB leases and SQS IAM/network access. A stopped worker's unexpired lease can delay a duplicate; let recovery bound retries rather than forcibly completing the job. Determine whether a DLQ item is a terminal download.failed event, an invalid-envelope digest or a redriven work envelope. Never blindly redrive terminal/invalid items. Reconcile the DB job, reservation, object count and attempts before selectively retrying a permitted work item with a new intentional request. Raise worker count only within measured global limits and budget.

## Incident: disk, memory or upload failure

Pause admission. Check Fargate memory/scratch, output/fragment peaks, orphan age and S3 upload/cleanup permissions. Do not delete a directory with a current lease or ready local asset. The sweeper handles old unowned attempts; a task replacement discards only its temporary scratch. Ready S3 assets survive replacement. Failed multipart uploads abort and stale multipart parts have a lifecycle backstop. Investigate OOM/SIGKILL using the staging fault procedure; increasing memory without a measured peak is not a capacity proof. Reconcile asset SHA/size and reservation before restoring traffic.

## Incident: database or secret failure

Pause admission and keep ready assets private. Check RDS private DNS/security groups, storage, connection count, TLS CA validity, secret access/KMS and role grants. Do not disable TLS or give the runtime an admin credential. Pg pools have bounded connections and statement/connection timeouts; multiply DB_POOL_MAX by the maximum tasks when assessing pressure. Restore connectivity, restart tasks after approved secret rotation, then verify sessions, ownership, one-job accounting and queued-lease recovery.

## Database upgrade, backup restore and rollback

Migration 001 is unchanged. Migration 002 expands accounts, analysis, outbox, object metadata, retention and controls. A populated CP-01 upgrade fixture preserves usage and checks idempotent application; this passes via PGlite. Native pg/TLS and actual restore are separate gates. Record the source/image/schema/restore point before release. Keep writers stopped during an incompatible first upgrade. Never edit an applied migration or run a destructive automatic down migration.

`ops/restore.mjs` reviews and optionally starts a **new private clone**, preserving the source's subnet/security/parameter choices. It does not redirect production or delete anything. Wait for availability, connect through a private drill task with verified TLS, compare schema checksums and representative owned users/jobs/usage, verify login/reset/ownership, reapply deletion requests, and confirm expired files remain unavailable. A database backup does not recreate expired S3 media; never turn historical assets into fresh tickets. Measure actual restore elapsed time and difference between the incident and restored data time. Retain the RTO/RPO report, then explicitly remove the billable clone through a reviewed cleanup.

The deploy tool records prior task definitions/counts. A compatible CP-02 rollback uses `ops/rollback.mjs`, then restores the matching frontend artifact and invalidates CloudFront. It refuses a CP-01 image because that writer does not understand S3 assets. For a first-upgrade failure, keep access paused and forward-fix the image or perform a separately reviewed isolated restore/cutover. If a deployment step fails after migration, do not assume infrastructure rollback undid the schema. Validate `/readyz`, one owned account and a controlled transfer before resuming admission.

## Signing/session key rotation

For CloudFront signing: generate a new key privately, add its public key to the trusted key group while retaining the old key, store the new private key, roll API tasks, verify a new signature, wait longer than the longest old URL lifetime, then remove the old public key. Do not replace a live one-key group/private secret out of order. The bootstrap helper is for initial matching-key setup and checks the output fingerprint. A second-key overlap requires an explicit infrastructure change and staging test.

Session-key changes invalidate CSRF and the encrypted unsent mail outbox. Drain/expire pending mail and plan user sign-in recovery before rotating; replace the secret and roll API/workers together. Password reset revokes sessions for that account. A leak requires revoking affected sessions/actions, pausing access, reviewing audit records and the operator's incident communication process. Never share secret material through chat or support tickets.

## Alert and operational acceptance

Confirm the SNS subscription and SES sender/production access. In staging, set a dedicated test alarm to ALARM and confirm human receipt, then restore its state; never falsify a production alarm to claim a test. Exercise backlog, cleanup failure and source failure with controlled fixtures, verify the alarm dimensions match real EMF logs and check recovery notifications. Budget alerts can lag; application caps and the operator pause are separate controls. `ops/observe.mjs` captures read-only service/queue/alarm/metric snapshots but cannot turn missing traffic or samples into a passed observation window.

## Primary documentation

- [RDS PostgreSQL TLS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html)
- [RDS point-in-time restore](https://docs.aws.amazon.com/cli/latest/reference/rds/restore-db-instance-to-point-in-time.html)
- [SQS visibility](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html)
- [CloudFront signed URLs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html)
- [CloudFront VPC origins](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-vpc-origins.html)
- [SES production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
- [Docker build attestations](https://docs.docker.com/build/ci/github-actions/attestations/)
