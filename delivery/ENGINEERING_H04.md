# ClipNest engineering delivery — H04

ClipNest remains CP-02, version 1.2.0. Production is **NO_GO**. This handoff closes the observed local image vulnerability failure and strengthens its verification. It does not assert AWS deployment or production acceptance.

## Patched image and strict security gate

The runtime now uses the official Node 24 / Alpine 3.24 base and builds upstream libxml2 2.15.4 and FFmpeg 9.0.2 together under `/opt/media`. Their exact upstream commits, archive SHA-256 values and versions are locked in `build/media-sources.json`. Downloads retain HTTPS verification; altered archives, wrong source versions and unsafe tar paths are rejected. The new ABI is kept separate from distro libraries. GPL licensing notices are retained in the image; upstream source references are included in the lock and SBOM.

Changing vendor feeds alone was insufficient: the first Alpine candidate scanned clean for vulnerabilities but still had older media libraries. It was rejected. The final gate requires both the strict scan and the checked patched-media manifest. An unused non-YouTube yt-dlp extractor containing a bundled upstream AWS key was removed from the runtime; no scanner exception was added. YouTube/default imports pass.

The common local/CI/deploy helper `scripts/ci/image-security.py` resolves immutable image identity, runs checksum-verified Trivy 0.70.0 against HIGH/CRITICAL OS and library vulnerabilities plus secrets, retains an exact-subject CycloneDX SBOM, verifies database provenance and checks the media source lock. It ignores inherited settings that could weaken policy. A successful inventory cannot hide a failed scan. Failure reports redact secret matches before artifact upload. Deployment requires a remote digest; actual ECR execution remains unverified.

The tested final Compose image is `sha256:1e03721bfd9086e928e721a2813747fb572bcd56d545bf7c4b095040a5bdcd94`. Its strict scan passed with **0 HIGH, 0 CRITICAL, 0 secret findings**. Source-built media components and archive hashes are explicitly added to the SBOM because distro package inventory does not discover them. This is current evidence for this image and database, not a permanent vulnerability guarantee.

## Verification and retained failures

The implementation was pushed directly to main as `36f744d352af47ffc399395abdf6d9e46fb4bc99`. `delivery/LOCAL_VERIFICATION.json` records fresh H04 commands, source fingerprint, counts and evidence paths. Checks cover application contracts, helper failure handling, source integrity, workflow syntax, native PostgreSQL, browser accessibility, Terraform mocks, and container/media/account behavior. MP4, MKV, WebM, MP3 and M4A were actually encoded/probed with expected codecs, nonzero bytes and hashes. These use generated media and make no external source request.

The first full browser run passed 7/8: its cancellation test raced a fast synthetic analysis. The corrected case supplies deterministic pending status, sends real cancellation to the API, checks storage cleanup, then resumes actual API/media responses. Both profiles passed afterward (8/8); backend cancellation is independently covered. The original browser failure is retained.

The first source build failed because the custom XML include prefix was incomplete; the supported compiler include flag fixed it. A Compose attempt then failed when PostgreSQL exhausted local disk. Both failures are retained. Moving the scanner cache to separate temporary storage freed space; the fresh Compose rerun passed. An old-image negative gate also fails as expected. Do not count these failures as passing tests or erase them.

The cold source build took about 14.4 minutes on this machine with two build jobs. CI/container budgets now allow the cold prerequisite, and subsequent builds reuse verified layers. Fresh runners still require working Docker, sufficient disk, package/source network access and their own execution evidence.

## Remaining acceptance

H-04 is now locally implemented: hosted run 40069202760 passed all seven jobs, including the pinned browser and patched container/strict image gate. B-13 is resolved by actual hosted execution. B-14 is resolved locally. H-07 remains partial because actual release ECR digest/provenance and production acceptance remain separate. Canonical counts are now **66 L / 27 P / 9 R / 10 B / 0 N**, across the same 112 original IDs; eight optional domain/payment extras are excluded.

The new hosted run executed successfully after the earlier billing restriction; no billing settings were changed by Codex. Downloading hosted artifacts from this cloud runtime returned HTTP 403 at `productionresultssa17.blob.core.windows.net`. The exact host requirement is saved in the environment draft for review/application; API job/artifact metadata and complete local evidence are retained. This delivery does not claim those hosted artifact bytes were downloaded. AWS staging additionally requires an authenticated scoped account/deploy role, Region, approved cost/traffic bounds, authorized media reference, sender/alert recipients and public operator/support/policy inputs. Actual RDS/AWS transports, source-to-device transfer, physical devices/geographies, active container OOM/hard-kill/resource drills, restore/rollback, real email/alarms, measured capacity and elapsed beta observation remain unproved. All 16 release acceptance gates remain pending for the real production release.

Continue using `CODEX_NEXT_PROMPT.md` and `docs/NEXT_PATH.md`. `delivery/BROWSER_OWNER_PROMPT.md` gives the owner/browser companion the precise account/settings tasks and safe return format. Work directly on main; create no branch, worktree or PR; never force-push. Return complete source and separate sanitized evidence ZIPs/checksums. Do not fill pending production gates from local results.
