-- Создание таблицы запланированных платежей
CREATE TABLE t_p61788166_html_to_frontend.planned_payments (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES t_p61788166_html_to_frontend.categories(id),
    amount NUMERIC(15, 2) NOT NULL,
    description TEXT,
    planned_date TIMESTAMP NOT NULL,
    legal_entity_id INTEGER REFERENCES t_p61788166_html_to_frontend.legal_entities(id),
    contractor_id INTEGER REFERENCES t_p61788166_html_to_frontend.contractors(id),
    department_id INTEGER REFERENCES t_p61788166_html_to_frontend.customer_departments(id),
    service_id INTEGER REFERENCES t_p61788166_html_to_frontend.services(id),
    invoice_number VARCHAR(255),
    invoice_date DATE,
    recurrence_type VARCHAR(50), -- 'once', 'daily', 'weekly', 'monthly', 'yearly'
    recurrence_end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES t_p61788166_html_to_frontend.users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    converted_to_payment_id INTEGER REFERENCES t_p61788166_html_to_frontend.payments(id),
    converted_at TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX idx_planned_payments_planned_date ON t_p61788166_html_to_frontend.planned_payments(planned_date);
CREATE INDEX idx_planned_payments_category_id ON t_p61788166_html_to_frontend.planned_payments(category_id);
CREATE INDEX idx_planned_payments_is_active ON t_p61788166_html_to_frontend.planned_payments(is_active);
CREATE INDEX idx_planned_payments_created_by ON t_p61788166_html_to_frontend.planned_payments(created_by);

-- Таблица для связи запланированных платежей с кастомными полями
CREATE TABLE t_p61788166_html_to_frontend.planned_payment_custom_field_values (
    id SERIAL PRIMARY KEY,
    planned_payment_id INTEGER REFERENCES t_p61788166_html_to_frontend.planned_payments(id),
    custom_field_id INTEGER REFERENCES t_p61788166_html_to_frontend.custom_fields(id),
    value TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(planned_payment_id, custom_field_id)
);

CREATE INDEX idx_planned_payment_custom_field_values_planned_payment_id 
ON t_p61788166_html_to_frontend.planned_payment_custom_field_values(planned_payment_id);