-- Удаление старого CHECK constraint для поля category
ALTER TABLE t_p61788166_html_to_frontend.payments 
DROP CONSTRAINT IF EXISTS payments_category_check;

-- Изменение типа поля category на VARCHAR(255) без ограничений
ALTER TABLE t_p61788166_html_to_frontend.payments 
ALTER COLUMN category TYPE VARCHAR(255);