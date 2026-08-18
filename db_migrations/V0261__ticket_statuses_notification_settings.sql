ALTER TABLE t_p67567221_one_file_page_projec.ticket_statuses
  ADD COLUMN IF NOT EXISTS notify_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notify_template_id INTEGER,
  ADD COLUMN IF NOT EXISTS notify_interval_hours INTEGER,
  ADD COLUMN IF NOT EXISTS notify_group_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_ticket_statuses_notify ON t_p67567221_one_file_page_projec.ticket_statuses(notify_enabled);
