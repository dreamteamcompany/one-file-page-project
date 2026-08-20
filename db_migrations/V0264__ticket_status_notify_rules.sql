CREATE TABLE IF NOT EXISTS ticket_status_notify_rules (
    id SERIAL PRIMARY KEY,
    status_id INTEGER NOT NULL,
    template_id INTEGER,
    interval_hours INTEGER,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_status_notify_rule_users (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (rule_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tsnr_status ON ticket_status_notify_rules (status_id);
CREATE INDEX IF NOT EXISTS idx_tsnru_rule ON ticket_status_notify_rule_users (rule_id);

ALTER TABLE ticket_response_log ADD COLUMN IF NOT EXISTS rule_id INTEGER;

INSERT INTO ticket_status_notify_rules (status_id, template_id, interval_hours, sort_order, is_active)
SELECT s.id, s.notify_template_id, s.notify_interval_hours, 0, TRUE
FROM ticket_statuses s
WHERE COALESCE(s.notify_enabled, false) = true
  AND s.notify_template_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM ticket_status_notify_rules r WHERE r.status_id = s.id
  );

INSERT INTO ticket_status_notify_rule_users (rule_id, user_id)
SELECT r.id, n.user_id
FROM ticket_status_notify_rules r
JOIN ticket_status_notify_users n ON n.status_id = r.status_id
ON CONFLICT (rule_id, user_id) DO NOTHING;