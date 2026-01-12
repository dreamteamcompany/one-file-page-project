CREATE TABLE IF NOT EXISTS t_p61788166_html_to_frontend.custom_field_values (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER NOT NULL REFERENCES t_p61788166_html_to_frontend.payments(id),
    custom_field_id INTEGER NOT NULL REFERENCES t_p61788166_html_to_frontend.custom_fields(id),
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(payment_id, custom_field_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_field_values_payment ON t_p61788166_html_to_frontend.custom_field_values(payment_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_field ON t_p61788166_html_to_frontend.custom_field_values(custom_field_id);