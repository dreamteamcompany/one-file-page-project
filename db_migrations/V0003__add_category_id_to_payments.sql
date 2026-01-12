-- Добавляем поле category_id в таблицу payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS category_id INTEGER;

-- Создаем внешний ключ к таблице categories
ALTER TABLE payments 
ADD CONSTRAINT fk_payments_category 
FOREIGN KEY (category_id) REFERENCES categories(id);

-- Заполняем category_id на основе старого поля category
UPDATE payments p
SET category_id = c.id
FROM categories c
WHERE p.category = 'servers' AND c.name = 'Серверы';

UPDATE payments p
SET category_id = c.id
FROM categories c
WHERE p.category = 'communications' AND c.name = 'Коммуникации';

UPDATE payments p
SET category_id = c.id
FROM categories c
WHERE p.category = 'websites' AND c.name = 'Веб-сайты';

UPDATE payments p
SET category_id = c.id
FROM categories c
WHERE p.category = 'security' AND c.name = 'Безопасность';
