-- Создание таблицы контрагентов
CREATE TABLE IF NOT EXISTS contractors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    inn VARCHAR(12),
    kpp VARCHAR(9),
    ogrn VARCHAR(15),
    legal_address TEXT,
    actual_address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    contact_person VARCHAR(255),
    bank_name VARCHAR(255),
    bank_bik VARCHAR(9),
    bank_account VARCHAR(20),
    correspondent_account VARCHAR(20),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Добавление поля contractor_id в таблицу payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS contractor_id INTEGER REFERENCES contractors(id);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_contractors_name ON contractors(name);
CREATE INDEX IF NOT EXISTS idx_contractors_inn ON contractors(inn);
CREATE INDEX IF NOT EXISTS idx_payments_contractor_id ON payments(contractor_id);