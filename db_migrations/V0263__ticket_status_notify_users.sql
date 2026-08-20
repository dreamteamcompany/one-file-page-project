CREATE TABLE IF NOT EXISTS ticket_status_notify_users (
    id SERIAL PRIMARY KEY,
    status_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (status_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tsnu_status ON ticket_status_notify_users (status_id);
CREATE INDEX IF NOT EXISTS idx_tsnu_user ON ticket_status_notify_users (user_id);

INSERT INTO ticket_status_notify_users (status_id, user_id)
SELECT s.id, m.user_id
FROM ticket_statuses s
JOIN executor_group_members m ON m.group_id = s.notify_group_id
WHERE s.notify_group_id IS NOT NULL
ON CONFLICT (status_id, user_id) DO NOTHING;