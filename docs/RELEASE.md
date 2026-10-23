# Capacity, product decisions and release gates · CP-02

## Concrete proposed beta defaults

| Decision | Implemented/prepared default | Owner input still needed |
| --- | --- | --- |
| Enrollment | Operator-created, email-bound one-use seven-day invitation; production verification required | Initial recipients; SES sender/inbox verification; support operator |
| Identity | Local email/password, one-use verification/reset, session revocation; no OIDC claim | Accept this identity choice for public scope, or separately request an identity-provider migration |
| Files | 30-minute access window; deletion sweep about each minute; retry/overdue metrics; one-day S3 backstop | Approve retention and incident handling |
| Records | 30-day history/usage, 90-day audit, seven-day mail/backup default; deletion/anonymization and tombstone cleanup | Public privacy commitments, legal operator/contact and restore/deletion procedure |
| User limits | 250 MiB/file, 15 minutes/video, 5 jobs/1.25 GiB per UTC day, one active request | Expected users, representative media and desired quality/duration |
| Global limits | 2 active downloads, 1 analysis, 100 queued, 100 jobs/10 GiB per UTC day, operator pause | Measured traffic model and expansion budget |
| Support | Private beta inviter; visible recovery/privacy/help pages and operator controls | Public support/rights/abuse address, accountable operator and response commitment |
| Rollout | Staging → invited capped beta → measured expansion; public registration stays closed until approved | Launch countries, source-use rights, final policies and monitoring coverage |
| Billing/domain/TLS | Free beta; generated CloudFront HTTPS hostname uses AWS default TLSv1 policy; optional owned hostname/ACM enables TLSv1.2_2021 | Owner reviews the viewer TLS policy; domain/DNS/certificate inputs only if stronger custom-host policy is selected |

These are concrete implementation defaults, not owner-approved legal or spending commitments. The public pages clearly remain private-beta drafts. Do not invent a legal entity, support address or guaranteed response time. Source permissions and market review must be resolved before public launch; copyright ownership alone does not settle the source service's download/automation terms.

## Capacity and cost worksheet

No target-account price or worldwide speed estimate is asserted. Fill this with actual Region/account prices and representative staging measurements. Two NAT gateways, Multi-AZ RDS, ALB and running tasks incur baseline charges; the example $50 budget input is not an estimate of those charges. AWS credits and billing alerts do not eliminate overage risk.

| Input/result | Formula or measurement | Current evidence |
| --- | --- | --- |
| Expected daily requests and average output GiB | Owner input; include failures/retries, source input and frontend/media egress separately | Missing owner traffic model |
| Peak concurrent work | Measure arrival burst and preparation time; bound globally in SQL | Local two-slot implementation; AWS load pending |
| Output volume per day | Successful jobs × average output GiB; upper default output cap 10 GiB/day | Atomic caps locally tested; not total billable traffic |
| API DB pressure | Maximum API/worker tasks × DB_POOL_MAX plus migration/drill headroom | Pool default 10; real RDS max/concurrent pressure pending |
| Worker scratch/RSS/CPU | Measure peak during fragmented download, merge, MP3 conversion, upload, cancellation and retry | Definitions 1 vCPU/2 GiB and 30 GiB scratch; resource acceptance pending |
| Egress/storage/requests | CloudFront/S3/NAT data, object/request operations, temporary retention and failed uploads | Fill with target-account billing/price data |
| Fixed monthly resources | RDS Multi-AZ/storage/backups + two NAT hours + ALB + minimum ECS + logs/WAF/keys/alarms | Not priced or authorized here |
| Operating threshold | Owner monthly budget, warning/stop points, account alert recipients | Missing owner budget; alarms and pause source prepared |
| User-facing latency/speed | Measure analysis, queue, prepare and device transfer separately in ≥3 geographies | Local HTTP admission p95 is not a download-speed benchmark |

## Beta acceptance and go/no-go

The current decision is **NO GO** for worldwide public production. CI/local implementation alone cannot pass external gates. `release/evidence.example.json` enumerates native TLS, container lifecycle, image scan, browser desktop/mobile, load/backpressure, security, real object/queue/CDN, multi-instance faults, restore/rollback, geography, authorized source transfer, SES/alarms, policies/contact and budget/capacity. Each requires a passed result and evidence reference for the exact code commit, recorded within seven days. Production uses external environment evidence JSON so a commit never needs to contain its own hash.

Before a capped beta: require a healthy actual environment, permitted end-to-end media transfer, real sender/alert delivery, recovered backup, tested pause/limits and a reachable support operator. Set a documented small invitation count, watch job failures/queue age/cost and keep public registration closed. Expand after the first observation window only when source reliability, support load and account spending justify it.

## Post-launch observation

At launch, one hour, 24 hours and seven days, capture `ops/observe.mjs`, actual billed/forecast spend, real success/failure/latency/bytes, queue/DLQ, cleanup overdue age, task replacements and support reports. Missing metric samples or no users are not evidence of an SLO. Investigate source access changes before increasing retries or capacity. If limits or costs are exceeded, pause admission, restrict invitations and execute the relevant runbook. Only the elapsed monitored release can close K-10; authoring this checklist does not.
