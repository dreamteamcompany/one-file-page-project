ALTER TABLE notifications ADD COLUMN IF NOT EXISTS rule_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_notifications_rule_dedup
    ON notifications (ticket_id, rule_id, user_id, created_at DESC);