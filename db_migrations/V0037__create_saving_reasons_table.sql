-- Создание таблицы причин экономии
CREATE TABLE IF NOT EXISTS saving_reasons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    icon VARCHAR(50) DEFAULT 'Target',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска активных причин
CREATE INDEX IF NOT EXISTS idx_saving_reasons_active ON saving_reasons(is_active);

-- Комментарий к таблице
COMMENT ON TABLE saving_reasons IS 'Справочник причин экономии для классификации сэкономленных средств';
