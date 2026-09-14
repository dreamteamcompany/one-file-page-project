CREATE TABLE IF NOT EXISTS db_backup_jobs (
    id SERIAL PRIMARY KEY,
    mode VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    started_by_user_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    duration_sec NUMERIC(10,1),
    result JSONB,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_db_backup_jobs_created_at ON db_backup_jobs (created_at DESC);
