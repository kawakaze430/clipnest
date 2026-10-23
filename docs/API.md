# Database-mode API · protocol 1 · CP-02

Frontend and API use one origin. JSON bodies are limited to 8 KiB. Errors contain `error`, `code`, `requestId`. Passwords, source URLs/selectors and file-ticket values are omitted from structured logs. A request ID helps support identify failures without a credential-bearing URL.

`S` below means an active HttpOnly session cookie. `M` means S plus the exact `Origin`, a session-bound `X-CSRF-Token`, and mutation rate checks. Public auth mutations also require the exact Origin. Verification/reset/invitation tokens arrive in URL fragments; the account page clears the fragment before processing it.

| Method/path | Identity/input | Result |
| --- | --- | --- |
| GET `/api/config` | Public | Protocol, session/async mode, registration/verification/pause flags and public limits/retention |
| GET `/api/auth/session` | Cookie optional | User or null; CSRF for a valid session |
| POST `/api/auth/register` | `{email,password,invitationToken?}` | Open registration or email-bound, one-use invitation; 201 and new session |
| POST `/api/auth/login` | `{email,password}` | New opaque session, CSRF, verified/operator flags |
| POST `/api/auth/forgot` | `{email}` | Generic 202 for known/unknown address; bounded reset emails |
| POST `/api/auth/reset` | `{token,password}` | One-use 30-minute action; changes password, verifies ownership and revokes all sessions |
| POST `/api/auth/verify` | `{token}` | One-use 60-minute email action |
| POST `/api/auth/resend` | M | Bounded verification request |
| POST `/api/auth/logout` | M | Revokes current session and clears cookie |
| GET `/api/account/export` | S | User profile, owned history and usage; no password/session/action tokens |
| DELETE `/api/account` | M; `{password}` | Password reauthentication, revoke/anonymize/cancel, schedule file/history deletion |
| GET `/api/usage` | S | UTC started/reserved/completed counters and user limits |
| POST `/api/analyses` | M; verified when required; `{url}` | 202 durable analysis task ID and queued status |
| GET `/api/analyses/:id` | S; owner | queued/running/ready/failed/cancelled; ready includes owned result/options |
| DELETE `/api/analyses/:id` | M; owner | Cancel queued/running analysis; worker checks lease/owner before committing results |
| POST `/api/analyze` | M; verified when required; `{url}` | Legacy bounded synchronous analysis; new frontend uses async route |
| POST `/api/jobs` | M; verified; Idempotency-Key; `{analysisId,optionId}` | 202 new or 200 replay; Idempotency-Replayed header |
| GET `/api/jobs` | S; limit 1–50 and opaque cursor | Owned history and nextCursor |
| GET `/api/jobs/:id` | S; owner | Real progress/status and output metadata |
| DELETE `/api/jobs/:id` | M; owner | Immediate queued cancellation or cancellation request until worker acknowledges |
| POST `/api/jobs/:id/ticket` | M; owner | Bearer path and expiry at most ten minutes, bounded by file expiry |
| GET/HEAD `/api/files/:ticket` | Bearer ticket | Local: attachment/range/checksum. S3: 307 to private signed CloudFront object, expiry bounded by ticket and asset |
| GET `/api/admin/state` | S; operator | Controls and bounded aggregate operational state |
| POST `/api/admin/controls` | M; operator; downloadsPaused?, registrationMode? | Audited global pause and config/open/invite/closed registration control |
| POST `/api/admin/invitations` | M; operator; `{email}` | Queue one-use seven-day invitation for that address |
| POST `/api/admin/disable` | M; operator; `{userId}` | Revoke account sessions, cancel work; own operator account uses account settings |

Passwords: 12–128 characters, at most 512 UTF-8 bytes; salted scrypt. Email normalization lowercases. Opaque sessions/actions/tickets are hashed in SQL. Sessions default to 24 hours, at most ten per user. Mail bodies are encrypted in the outbox, cleared after sending/expiry; transport ambiguity can deliver an identical one-use link twice. No third-party identity-provider integration is claimed.

Job creation accepts only an option saved in that user's unexpired analysis. Arbitrary yt-dlp selectors, unsupported hosts/protocols, playlist/live/upcoming, DRM and oversized choices are rejected/excluded. A stable idempotency key retries the same request; a new intentional download needs a new key. Queue and global/user daily limits return 429 with a specific code. Pausing new downloads returns 503 DOWNLOADS_PAUSED.

Jobs move queued → downloading/processing → ready/failed/cancelled. A stale lease cannot commit progress/completion. Interrupted work can return to queued for up to three attempts. Ready files later become expired. Account deletion and pause do not retract a file already saved on a device; a previously issued signed object URL can remain usable until its short expiry or object deletion.

Local prototype mode retains the older token/browser-ID API and is development-only. These account/admin routes require database mode. Do not treat a hosted static frontend as a running backend.
