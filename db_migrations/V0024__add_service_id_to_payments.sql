-- Добавляем поле service_id в таблицу payments
ALTER TABLE t_p61788166_html_to_frontend.payments 
ADD COLUMN IF NOT EXISTS service_id INTEGER;

-- Добавляем внешний ключ на таблицу services
ALTER TABLE t_p61788166_html_to_frontend.payments
ADD CONSTRAINT fk_payments_service
FOREIGN KEY (service_id) 
REFERENCES t_p61788166_html_to_frontend.services(id);