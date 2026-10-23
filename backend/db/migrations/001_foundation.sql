CREATE TABLE users (
 id uuid PRIMARY KEY,
 email text NOT NULL UNIQUE CHECK (email=lower(email) AND length(email) BETWEEN 3 AND 254),
 password_hash text NOT NULL,
 disabled_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE user_sessions (
 token_hash char(64) PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_owner_idx ON user_sessions(user_id);
CREATE INDEX sessions_expiry_idx ON user_sessions(expires_at);
CREATE TABLE analyses (
 id text PRIMARY KEY CHECK(id ~ '^[A-Za-z0-9_-]{32}$'),
 user_id uuid NOT NULL REFERENCES users(id),
 video_id text NOT NULL CHECK(video_id ~ '^[A-Za-z0-9_-]{11}$'),
 canonical_url text NOT NULL,
 metadata jsonb NOT NULL,
 options jsonb NOT NULL CHECK(jsonb_typeof(options)='array'),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,user_id)
);
CREATE INDEX analyses_expiry_idx ON analyses(expires_at);
CREATE TABLE download_jobs (
 id text PRIMARY KEY CHECK(id ~ '^[A-Za-z0-9_-]{32}$'),
 user_id uuid NOT NULL REFERENCES users(id),
 analysis_id text NOT NULL,
 idempotency_key text CHECK(length(idempotency_key) BETWEEN 8 AND 100),
 request_hash char(64) NOT NULL,
 payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','downloading','processing','ready','failed','cancelled','expired')),
 version integer NOT NULL DEFAULT 0,
 phase text NOT NULL DEFAULT 'Queued',
 progress numeric CHECK(progress BETWEEN 0 AND 100),
 downloaded_bytes bigint NOT NULL DEFAULT 0 CHECK(downloaded_bytes>=0),
 total_bytes bigint CHECK(total_bytes>=0),
 speed numeric,
 eta integer,
 error_code text,
 error_message text,
 cancel_requested boolean NOT NULL DEFAULT false,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 lease_owner uuid,
 lease_until timestamptz,
 expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(analysis_id,user_id) REFERENCES analyses(id,user_id),
 UNIQUE(user_id,idempotency_key)
);
CREATE INDEX jobs_history_idx ON download_jobs(user_id,created_at DESC,id DESC);
CREATE INDEX jobs_queue_idx ON download_jobs(created_at) WHERE status='queued';
CREATE INDEX jobs_lease_idx ON download_jobs(lease_until) WHERE status IN ('downloading','processing');
CREATE INDEX jobs_expiry_idx ON download_jobs(expires_at) WHERE expires_at IS NOT NULL;
CREATE TABLE assets (
 job_id text PRIMARY KEY REFERENCES download_jobs(id) ON DELETE CASCADE,
 file_path text NOT NULL,
 filename text NOT NULL,
 extension text NOT NULL CHECK(extension IN ('mp4','webm','mkv','mp3','m4a')),
 size_bytes bigint NOT NULL CHECK(size_bytes>0),
 sha256 char(64) NOT NULL,
 expires_at timestamptz NOT NULL,
 deleted_at timestamptz
);
CREATE INDEX assets_cleanup_idx ON assets(expires_at) WHERE deleted_at IS NULL;
CREATE TABLE download_tickets (
 token_hash char(64) PRIMARY KEY,
 job_id text NOT NULL REFERENCES download_jobs(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX tickets_expiry_idx ON download_tickets(expires_at);
CREATE TABLE daily_usage (
 user_id uuid NOT NULL REFERENCES users(id),
 usage_day date NOT NULL,
 jobs_started integer NOT NULL DEFAULT 0 CHECK(jobs_started>=0),
 bytes_reserved bigint NOT NULL DEFAULT 0 CHECK(bytes_reserved>=0),
 bytes_completed bigint NOT NULL DEFAULT 0 CHECK(bytes_completed>=0),
 PRIMARY KEY(user_id,usage_day)
);
CREATE TABLE usage_reservations (
 job_id text PRIMARY KEY REFERENCES download_jobs(id),
 user_id uuid NOT NULL,
 usage_day date NOT NULL,
 reserved_bytes bigint NOT NULL CHECK(reserved_bytes>0),
 state text NOT NULL CHECK(state IN ('active','settled','released')),
 FOREIGN KEY(user_id,usage_day) REFERENCES daily_usage(user_id,usage_day)
);
CREATE TABLE outbox_events (
 id uuid PRIMARY KEY,
 job_id text NOT NULL UNIQUE REFERENCES download_jobs(id),
 event_type text NOT NULL CHECK(event_type='download.requested'),
 payload jsonb NOT NULL,
 dispatched_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_pending_idx ON outbox_events(created_at) WHERE dispatched_at IS NULL;
CREATE TABLE audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid REFERENCES users(id),
 action text NOT NULL,
 target_id text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_owner_idx ON audit_events(user_id,created_at DESC);
CREATE TABLE rate_buckets (
 bucket_key char(64) NOT NULL,
 window_start bigint NOT NULL,
 hits integer NOT NULL,
 PRIMARY KEY(bucket_key,window_start)
);
CREATE OR REPLACE FUNCTION check_job_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status <> OLD.status AND NOT (
  (OLD.status='queued' AND NEW.status IN ('downloading','cancelled','failed','expired')) OR
  (OLD.status IN ('downloading','processing') AND NEW.status IN ('processing','ready','failed','cancelled','queued','expired')) OR
  (OLD.status IN ('ready','failed','cancelled') AND NEW.status='expired')
 ) THEN RAISE EXCEPTION 'Invalid job state transition' USING ERRCODE='23514'; END IF;
 NEW.version := OLD.version+1;
 NEW.updated_at := now();
 RETURN NEW;
END $$;
CREATE TRIGGER job_state_guard BEFORE UPDATE ON download_jobs FOR EACH ROW EXECUTE FUNCTION check_job_transition();
