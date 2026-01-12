CREATE TABLE IF NOT EXISTS t_p61788166_html_to_frontend.savings (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES t_p61788166_html_to_frontend.services(id),
    description TEXT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('once', 'monthly', 'quarterly', 'yearly')),
    currency VARCHAR(10) NOT NULL DEFAULT 'RUB',
    employee_id INTEGER NOT NULL REFERENCES t_p61788166_html_to_frontend.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);