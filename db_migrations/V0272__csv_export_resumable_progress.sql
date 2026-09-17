ALTER TABLE csv_export_jobs ADD COLUMN IF NOT EXISTS progress JSONB;
ALTER TABLE csv_export_jobs ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;

UPDATE csv_export_jobs
SET status = 'error',
    error = 'Прервано обновлением сервиса, запустите выгрузку заново',
    finished_at = now()
WHERE status IN ('pending', 'running');