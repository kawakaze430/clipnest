# Remaining ClipNest core acceptance — H03

47 of the original 112 core tasks are not classified locally implemented. Counts are not effort/production percentages. Production remains NO_GO.

| ID | Task | Status | Remaining acceptance | Owner |
| --- | --- | --- | --- | --- |
| A-05 | Traffic targets and spending bounds | Externally blocked | Owner supplies bounds; assistant completes the estimate and controls. | User + Assistant |
| A-06 | Permitted sources and supported markets | Externally blocked | Owner confirms allowed workflow/media/markets and appropriate review. | User + Assistant |
| A-07 | Product retention and support decisions | Partially implemented | Owner confirms public operator/contact, commitments and final policy/market scope. | Assistant + User |
| B-05 | Mobile layouts and device acceptance | Partially implemented | Execute mobile browser/device/touch/file-save acceptance against the deployed API. | Assistant + Runner |
| B-07 | Session expiry and signed-out recovery UI | Partially implemented | Execute actual device/browser expiry, reload and recovery acceptance. | Assistant + Runner |
| B-08 | Automatic same-origin API connection | Partially implemented | Verify real CloudFront/ALB Origin, forwarded-hop, secure-cookie and routing behavior. | Assistant + Runner |
| B-09 | Account history and usage display | Partially implemented | Complete browser account switching and running-job restart/resume against staging. | Assistant + Runner |
| B-10 | Progress, cancellation and network errors | Partially implemented | Run browser interrupted-network/cancel cases and actual staged worker cancellation. | Assistant + Runner |
| B-11 | Ready, failed and expired download journey | Partially implemented | Complete real permitted source-to-device transfer and actual expired-link/re-preparation browser acceptance. | Assistant + Runner |
| B-12 | Accessibility acceptance | Partially implemented | Complete manual keyboard/screen-reader/device and deployed-page accessibility acceptance; local axe now passes. | Assistant + Runner |
| D-02 | Extractor integration and application lookup | Partially implemented | Use the real-source acceptance command on the actual permitted target image/network; no protection bypass or new success claim. | Assistant + Runner |
| D-10 | Real authorized source-to-device transfer | Externally blocked | Run an authorized full transfer from the actual target image/network and verify final bytes. | Assistant + Runner |
| E-04 | Native pg pool and TLS integration | Partially implemented | Execute target RDS verifiedTLS/roles/failover and recovery acceptance; local native PostgreSQL 17 evidence is passed. | Assistant + Runner |
| E-09 | Upgrade and previous-image compatibility | Partially implemented | Rehearse exact prior-image/compatible frontend rollback and native restored-database cutover. | Assistant |
| F-11 | Distributed duplicate-delivery acceptance | Partially implemented | Execute native multi-client and actual SQS duplicate/retry/DLQ failures. | Assistant |
| G-07 | CloudFront signed media delivery | Partially implemented | Validate real CloudFront expiry/cache/unsigned rejection and actual signed byte transfer. | Assistant |
| G-09 | Independent-task media handoff | Partially implemented | Prove ready media survives actual task replacement and API/worker separation through S3/CloudFront. | Assistant |
| G-10 | Object retention/deletion monitoring | Partially implemented | Measure actual S3 physical deletion, overdue alarms and monitoring during failure. | Assistant |
| H-04 | Hosted CI workflow | Partially implemented | Account owner resolves GitHub billing restriction, then rerun and inspect pinned-browser/image-scan/SBOM/full hosted results. | Runner |
| H-06 | Container lifecycle/resource acceptance | Partially implemented | Active container SIGKILL/OOM/disk/deadline and measured peak RSS/scratch acceptance remain unrun. | Assistant + Runner |
| H-07 | Image scanning, SBOM and provenance | Partially implemented | Remediate the remaining runtime package findings using a supported patched package/base set or verified ABI-consistent builds; rerun strict scan/media/container checks and generate release provenance. | Assistant + Runner |
| I-01 | Authorized AWS account/role runtime | Externally blocked | Owner establishes a scoped authorized AWS runtime without sharing secrets in chat. | User + Runner |
| I-02 | Region and availability target confirmation | Externally blocked | Confirm the target against source access, budget and audience. | User + Assistant |
| I-03 | Infrastructure-as-code modules | Partially implemented | Review cost and execute an authorized account-specific plan/apply and real cloud acceptance. | Assistant |
| I-04 | Private networks, security groups and ingress | Prepared, not executed | Provider validation and real account routing/direct-origin/security acceptance. | Assistant |
| I-05 | API/worker service and task definitions | Prepared, not executed | Validate resource schema; run tasks, writable mounts, health/drain/replacement and load acceptance. | Assistant |
| I-06 | RDS provisioning and recovery configuration | Prepared, not executed | Confirm Region/minor/class, validate/apply and execute native TLS/role/restore/RTO/RPO checks. | Assistant |
| I-07 | S3/CloudFront/WAF configuration | Prepared, not executed | Provider/API validation plus actual CDN, WAF, signed media and no-origin-bypass acceptance. | Assistant |
| I-08 | Secrets, encryption and IAM policies | Prepared, not executed | Review real policy simulation/access, existing OIDC provider reuse/import and key-rotation rehearsal. | Assistant |
| I-09 | AWS build/deploy pipeline | Prepared, not executed | Configure owner repository/environment and run actual authorized staging deployment. | Assistant |
| I-10 | Actual AWS staging deployment | Externally blocked | Run provider validation/plan, establish owner-authorized runtime/budget and provision staging. | Assistant + Runner |
| J-05 | Load, backpressure and capacity acceptance | Partially implemented | Measure realistic staged load, duration, pool/resource pressure and geography against approved traffic targets. | Assistant + Runner |
| J-06 | Security/abuse acceptance | Partially implemented | Run actual WAF/IAM/origin isolation and authenticated cross-user/security/abuse review. | Assistant + Runner |
| J-07 | Multi-instance failure and distributed recovery | Partially implemented | Run actual multi-instance SQS/S3/DB outage, task loss and upload/cancellation fault acceptance. | Assistant + Runner |
| J-08 | Backup restore and rollback automation | Prepared, not executed | Execute isolated backup restore and rollback, verify deleted/expired data, retain results and clean up clones deliberately. | Assistant + Runner |
| J-09 | Operational metrics and dashboards | Partially implemented | Verify actual metric ingestion/dimensions/dashboard values with real traffic. | Assistant |
| J-10 | Failure, backlog and cost alarms | Prepared, not executed | Apply and confirm human alert/recovery delivery; tune with measured traffic/cost. | Assistant + User |
| J-12 | Active-job process termination drills | Partially implemented | Execute native/container hard-kill/OOM/deadline/cleanup drills and record bounded recovery. | Assistant + Runner |
| K-02 | Production terms, privacy and support pages | Partially implemented | Owner supplies public legal entity/contact, eligible markets and final policy/rights/complaint approval. | Assistant + User |
| K-03 | Limited-beta onboarding and support process | Partially implemented | Verify SES/operator enrollment and accountable live support before real invitations/public access. | Assistant + User |
| K-04 | Multi-geography availability probes | Prepared, not executed | Run independent real-geography endpoint and permitted media/device transfer tests. | Assistant + Runner |
| K-05 | Public AWS HTTPS/edge acceptance | Externally blocked | Deploy after code completion; verify HTTPS, cookies, caches and origin protections. | Assistant + Runner |
| K-06 | Monitored limited-beta release | Externally blocked | Complete mandatory gates, open a capped beta and observe real behavior. | Assistant + Runner |
| K-07 | Capacity, spend and release-gate review | Partially implemented | Owner traffic/budget/policies plus measured target-account costs/capacity and completed external evidence. | Assistant + User |
| K-08 | Release/rollback runbook completion | Partially implemented | Rehearse actual rollout/rollback with matching image/frontend and verify service/account/media recovery. | Assistant + Runner |
| K-09 | Worldwide public production release | Externally blocked | Pass the applicable gates and execute the worldwide release with tested limits. | Assistant + Runner |
| K-10 | Post-launch observation and expansion | Externally blocked | Operate the capped release, observe elapsed traffic/support/cost/SLO evidence and review expansion. | Assistant + User |

The canonical JSON contains evidence/dependencies for all 112 IDs. Eight conditional domain/payment extras remain outside this denominator.
