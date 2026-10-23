ALTER TABLE users ADD COLUMN verified_at timestamptz;
ALTER TABLE users ADD COLUMN deletion_requested_at timestamptz;
CREATE TABLE user_roles (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role='operator'),
 PRIMARY KEY(user_id,role)
);
CREATE TABLE service_controls (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 downloads_paused boolean NOT NULL DEFAULT false,
 registration_mode text NOT NULL DEFAULT 'config' CHECK(registration_mode IN ('config','open','invite','closed')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO service_controls(singleton) VALUES(true);
CREATE TABLE email_actions (
 token_hash char(64) PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('verify','reset')),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX email_actions_active_idx ON email_actions(user_id,kind) WHERE consumed_at IS NULL;
CREATE TABLE beta_invitations (
 token_hash char(64) PRIMARY KEY,
 email text NOT NULL,
 invited_by uuid REFERENCES users(id),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX beta_invites_expiry_idx ON beta_invitations(expires_at);
CREATE TABLE mail_outbox (
 id uuid PRIMARY KEY,
 user_id uuid REFERENCES users(id),
 sealed_payload text,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
 attempts integer NOT NULL DEFAULT 0,
 lease_owner uuid,
 lease_until timestamptz,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz
);
CREATE INDEX mail_pending_idx ON mail_outbox(created_at) WHERE status IN ('pending','sending');
ALTER TABLE assets ALTER COLUMN file_path DROP NOT NULL;
ALTER TABLE assets ADD COLUMN storage_backend text NOT NULL DEFAULT 'local' CHECK(storage_backend IN ('local','s3'));
ALTER TABLE assets ADD COLUMN object_key text;
ALTER TABLE assets ADD COLUMN deletion_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE assets ADD COLUMN delete_retry_at timestamptz;
ALTER TABLE assets ADD CONSTRAINT asset_location_check CHECK (
 (storage_backend='local' AND file_path IS NOT NULL AND object_key IS NULL) OR
 (storage_backend='s3' AND file_path IS NULL AND object_key IS NOT NULL)
);
CREATE UNIQUE INDEX assets_object_key_idx ON assets(object_key) WHERE object_key IS NOT NULL;
ALTER TABLE outbox_events DROP CONSTRAINT outbox_events_job_id_key;
ALTER TABLE outbox_events DROP CONSTRAINT outbox_events_event_type_check;
ALTER TABLE outbox_events ADD CONSTRAINT outbox_kind_check CHECK(event_type IN ('download.requested','download.failed'));
ALTER TABLE outbox_events ADD CONSTRAINT outbox_job_kind_unique UNIQUE(job_id,event_type);
ALTER TABLE outbox_events ADD COLUMN lease_owner uuid;
ALTER TABLE outbox_events ADD COLUMN lease_until timestamptz;
ALTER TABLE outbox_events ADD COLUMN publish_attempts integer NOT NULL DEFAULT 0;
CREATE TABLE analysis_tasks (
 id text PRIMARY KEY CHECK(id ~ '^[A-Za-z0-9_-]{32}$'),
 user_id uuid NOT NULL REFERENCES users(id),
 canonical_url text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','ready','failed','cancelled')),
 result_id text REFERENCES analyses(id),
 error_code text,
 error_message text,
 attempts integer NOT NULL DEFAULT 0,
 lease_owner uuid,
 lease_until timestamptz,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analysis_tasks_queue_idx ON analysis_tasks(created_at) WHERE status='queued';
CREATE INDEX analysis_tasks_owner_idx ON analysis_tasks(user_id,created_at DESC);
CREATE TABLE global_usage (
 usage_day date PRIMARY KEY,
 jobs_started integer NOT NULL DEFAULT 0 CHECK(jobs_started>=0),
 bytes_reserved bigint NOT NULL DEFAULT 0 CHECK(bytes_reserved>=0),
 bytes_completed bigint NOT NULL DEFAULT 0 CHECK(bytes_completed>=0)
);
-- Include pre-upgrade usage so an upgrade cannot silently reset global limits.
INSERT INTO global_usage(usage_day,jobs_started,bytes_reserved,bytes_completed)
 SELECT usage_day,sum(jobs_started),sum(bytes_reserved),sum(bytes_completed) FROM daily_usage GROUP BY usage_day;
CREATE TABLE maintenance_leases (
 name text PRIMARY KEY,
 owner uuid NOT NULL,
 expires_at timestamptz NOT NULL
);
CREATE TABLE worker_heartbeats (
 worker_id uuid PRIMARY KEY,
 seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX worker_health_time_idx ON worker_heartbeats(seen_at);
