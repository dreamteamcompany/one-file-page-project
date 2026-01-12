-- Добавляем поля для системы согласований в таблицу payments
ALTER TABLE t_p61788166_html_to_frontend.payments 
ADD COLUMN status VARCHAR(50) DEFAULT 'draft',
ADD COLUMN created_by INTEGER REFERENCES t_p61788166_html_to_frontend.users(id),
ADD COLUMN submitted_at TIMESTAMP,
ADD COLUMN tech_director_approved_at TIMESTAMP,
ADD COLUMN tech_director_approved_by INTEGER REFERENCES t_p61788166_html_to_frontend.users(id),
ADD COLUMN ceo_approved_at TIMESTAMP,
ADD COLUMN ceo_approved_by INTEGER REFERENCES t_p61788166_html_to_frontend.users(id);

-- Создаем таблицу для истории согласований
CREATE TABLE t_p61788166_html_to_frontend.approvals (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER NOT NULL REFERENCES t_p61788166_html_to_frontend.payments(id),
    approver_id INTEGER NOT NULL REFERENCES t_p61788166_html_to_frontend.users(id),
    approver_role VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Создаем индексы для быстрого поиска
CREATE INDEX idx_payments_status ON t_p61788166_html_to_frontend.payments(status);
CREATE INDEX idx_payments_created_by ON t_p61788166_html_to_frontend.payments(created_by);
CREATE INDEX idx_approvals_payment_id ON t_p61788166_html_to_frontend.approvals(payment_id);
CREATE INDEX idx_approvals_approver_id ON t_p61788166_html_to_frontend.approvals(approver_id);

-- Комментарии для документации
COMMENT ON COLUMN t_p61788166_html_to_frontend.payments.status IS 'Статусы: draft, pending_tech_director, pending_ceo, approved, rejected';
COMMENT ON TABLE t_p61788166_html_to_frontend.approvals IS 'История всех действий по согласованию платежей';