CREATE TABLE IF NOT EXISTS t_p61788166_html_to_frontend.audit_logs (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL,
    user_id INTEGER,
    username VARCHAR(255),
    changed_fields JSONB,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_entity ON t_p61788166_html_to_frontend.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON t_p61788166_html_to_frontend.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON t_p61788166_html_to_frontend.audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON t_p61788166_html_to_frontend.audit_logs(action);