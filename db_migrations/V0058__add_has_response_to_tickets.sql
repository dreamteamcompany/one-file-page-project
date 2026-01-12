-- Добавляем поле has_response для отслеживания наличия ответа от исполнителя
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS has_response BOOLEAN DEFAULT FALSE;

-- Обновляем существующие заявки: проставляем has_response = true, если есть комментарий от исполнителя
UPDATE tickets t
SET has_response = TRUE
WHERE EXISTS (
    SELECT 1 FROM ticket_comments tc
    WHERE tc.ticket_id = t.id 
    AND tc.user_id = t.assigned_to
    AND tc.user_id != t.created_by
);