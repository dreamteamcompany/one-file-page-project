-- Добавление поля service_id в таблицу tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS service_id INTEGER REFERENCES services(id);

-- Создание индекса для быстрого поиска по service_id
CREATE INDEX IF NOT EXISTS idx_tickets_service_id ON tickets(service_id);