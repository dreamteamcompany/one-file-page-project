CREATE TABLE IF NOT EXISTS csv_export_jobs (
    id SERIAL PRIMARY KEY,
    scope VARCHAR(16) NOT NULL,
    table_name VARCHAR(128),
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    started_by_user_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    duration_sec NUMERIC,
    result JSONB,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_csv_export_jobs_status ON csv_export_jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_csv_export_jobs_user ON csv_export_jobs (started_by_user_id, created_at DESC);