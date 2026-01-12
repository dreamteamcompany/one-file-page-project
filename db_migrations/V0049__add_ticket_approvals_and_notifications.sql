-- Добавляем новые статусы для заявок
INSERT INTO t_p61788166_html_to_frontend.ticket_statuses (name, color, is_closed) VALUES
('На согласовании', '#9333ea', false),
('Одобрена', '#10b981', false),
('Отклонена', '#ef4444', false)
ON CONFLICT DO NOTHING;

-- Создаем таблицу для согласований заявок
CREATE TABLE IF NOT EXISTS t_p61788166_html_to_frontend.ticket_approvals (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL,
    approver_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('pending', 'approved', 'rejected', 'submitted')),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создаем таблицу для уведомлений
CREATE TABLE IF NOT EXISTS t_p61788166_html_to_frontend.notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    ticket_id INTEGER,
    type VARCHAR(50) NOT NULL CHECK (type IN ('approval_request', 'approval_approved', 'approval_rejected', 'comment_added', 'status_changed')),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_ticket_approvals_ticket_id ON t_p61788166_html_to_frontend.ticket_approvals(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_approvals_approver_id ON t_p61788166_html_to_frontend.ticket_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON t_p61788166_html_to_frontend.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON t_p61788166_html_to_frontend.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_ticket_id ON t_p61788166_html_to_frontend.notifications(ticket_id);