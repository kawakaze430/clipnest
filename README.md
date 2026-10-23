# ClipNest · CP-02

**H02 / next step:** [Minimal external verification and ownership](docs/NEXT_PATH.md), [Codex Cloud test-only prompt](CLOUD_TEST_ONLY_PROMPT.md), and [execution contract](docs/EXTERNAL_EXECUTION.md). The original project chat owns implementation/fixes; external runners execute only assigned unavailable checks. No heavy Windows setup is required now.

**New model or complete project handoff:** read [START_HERE.md](START_HERE.md), [the complete handoff](docs/COMPLETE_HANDOFF.md) and [the continuation prompt](NEXT_MODEL_PROMPT.md). H01 adds handoff/packaging instructions; application status remains CP-02. The complete ZIP includes the original 112-task register, remaining work and real production-test checklist.

ClipNest takes a YouTube video link, returns its available video/audio qualities, queues the selected download, and lets the signed-in owner save the prepared file. Only use material with the required source and rights-holder authorization. Parallel fragments are used when supported; speed depends on the source, processing, server and user connection.

**The private hosted Site is a static frontend/source checkpoint. The AWS backend is not live.** CP-02 implements the account lifecycle, durable asynchronous analysis, S3/CloudFront and SQS/DLQ adapters, retention, metrics, infrastructure and release tooling. Local tests do not establish AWS, native PostgreSQL, container, real YouTube or worldwide acceptance. The current decision remains NO GO for public production.

## Local development

With Node 24, Docker Compose v2 and network access:

```sh
npm ci --ignore-scripts
npm run setup:local
docker compose up --build -d --wait
```

Open **http://localhost:8787** exactly. Compose runs PostgreSQL, checksum migrations, API and a separate worker with a shared development media volume. Development registration is open and email verification is off by default. Local mail is written only to the private `.cache/mail` directory; production refuses the file-mail adapter. Never publish this development HTTP/DB configuration.

Without Docker, `npm run dev` provides a disposable PGlite SQL preview for development. It is a single-backend database, not a substitute for native PostgreSQL/RDS or a production server. Real source availability remains dependent on the installed yt-dlp/FFmpeg and source network.

A direct native setup uses your explicitly configured `DATABASE_URL`, stable `SESSION_SECRET`, exact `PUBLIC_ORIGIN` and the modes in `.env.example`. Run `npm run db:migrate`, then `npm start` and `npm run worker` in separate processes. Production uses verified database TLS, secure cookies, S3/SQS/SES and separately scoped roles.

## Checks and artifacts

```sh
npm run check
npm test
npm run test:database
npm run test:tls
npm run test:browser
node scripts/ops/load.mjs
npm run package
python3 scripts/package.py --verify dist/clipnest-source.zip
```

- `npm test`: unit tests, actual local HTTP, real FFmpeg fixture, PostgreSQL SQL through PGlite by default, AWS SDK contract injection, actual RSA signing, emulated-DOM frontend and real-process SIGTERM. Native concurrency is explicitly skipped without a native target.
- `test:database`: disposable native PostgreSQL or explicit `TEST_DATABASE_URL`; expands accounting/leases/upgrade tests to native connections. Needs a mapped non-root runtime if starting embedded PostgreSQL.
- `test:tls`: Docker-only disposable TLS server, trusted certificate and negative hostname/CA checks.
- `test:browser`: external-runner Chromium desktop/mobile + axe and a synthetic-media fixture server. It never claims a real YouTube transfer.
- `ops/load.mjs`: 20 concurrent local HTTP submissions, bounded queue and quota admission; not an AWS throughput or worldwide speed benchmark.
- `package`: complete source ZIP without dependencies, state, credentials or Terraform cache. Includes the handoff, per-file SHA-256 manifest and an external whole-ZIP checksum. Downloadable from the website setup dialog. Use `python3 scripts/package.py --output /absolute/path/snapshot.zip` for another filename; use `--verify PATH` for read-only integrity checking. Update the packer's include list when introducing new source directories.

See [API](docs/API.md), [operations](docs/OPERATIONS.md), [AWS setup](infra/terraform/README.md), [runner handoff](docs/HANDOFF.md), [capacity/release gates](docs/RELEASE.md) and [status](docs/STATUS.md). `docs/END_TO_END_STATUS.json` preserves the full 112-task register. The 51 targeted tasks keep their original IDs and evidence.

The GitHub verification and AWS deployment workflows are authored but have not run remotely in this authoring environment. No payment integration or live payment testing is part of the current free-beta scope.
