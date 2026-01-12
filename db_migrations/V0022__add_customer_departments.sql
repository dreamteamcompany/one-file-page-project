-- Создание таблицы отделов-заказчиков
CREATE TABLE IF NOT EXISTS customer_departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Добавление поля department_id в таблицу payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES customer_departments(id);

-- Создание индекса для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_payments_department_id ON payments(department_id);

-- Вставка тестовых данных
INSERT INTO customer_departments (name, description) VALUES
('IT отдел', 'Информационные технологии'),
('Бухгалтерия', 'Финансовый отдел'),
('HR отдел', 'Управление персоналом')
ON CONFLICT (name) DO NOTHING;