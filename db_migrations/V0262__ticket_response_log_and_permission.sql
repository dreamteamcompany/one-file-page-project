CREATE TABLE IF NOT EXISTS ticket_response_log (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL,
    status_id INTEGER,
    group_id INTEGER,
    trigger_kind VARCHAR(32) NOT NULL,
    assigned_to INTEGER,
    interval_hours INTEGER,
    reference_at TIMESTAMP,
    recipients_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trl_created_at ON ticket_response_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trl_ticket ON ticket_response_log (ticket_id);
CREATE INDEX IF NOT EXISTS idx_trl_assigned ON ticket_response_log (assigned_to);
CREATE INDEX IF NOT EXISTS idx_trl_kind ON ticket_response_log (trigger_kind);

INSERT INTO permissions (name, description, resource, action)
SELECT 'response_control.read', 'Просмотр раздела «Контроль реакции»', 'response_control', 'read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE resource='response_control' AND action='read');