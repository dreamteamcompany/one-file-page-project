-- Исправляем заявки с некорректными датами (устанавливаем NULL)
UPDATE tickets SET due_date = NULL WHERE due_date > '2100-01-01';