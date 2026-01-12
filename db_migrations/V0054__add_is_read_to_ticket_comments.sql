-- Добавляем поле is_read в таблицу комментариев
ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;