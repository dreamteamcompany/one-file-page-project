-- Добавление полей для счёта в таблицу payments
ALTER TABLE t_p61788166_html_to_frontend.payments 
ADD COLUMN invoice_number VARCHAR(100),
ADD COLUMN invoice_date DATE;