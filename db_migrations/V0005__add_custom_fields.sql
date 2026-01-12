-- Создание таблицы дополнительных полей
CREATE TABLE IF NOT EXISTS custom_fields (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('text', 'select', 'file', 'toggle')),
    options TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы для значений дополнительных полей в платежах
CREATE TABLE IF NOT EXISTS payment_custom_values (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER NOT NULL REFERENCES payments(id),
    custom_field_id INTEGER NOT NULL REFERENCES custom_fields(id),
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);