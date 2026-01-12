-- Создание таблицы для платежей
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL CHECK (category IN ('servers', 'communications', 'websites', 'security')),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Создание индекса для быстрой выборки по категории
CREATE INDEX idx_payments_category ON payments(category);

-- Создание индекса для быстрой выборки по дате
CREATE INDEX idx_payments_date ON payments(payment_date DESC);