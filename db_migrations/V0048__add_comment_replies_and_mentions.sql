-- Добавляем поля для ответов на комментарии и упоминаний пользователей
ALTER TABLE t_p61788166_html_to_frontend.ticket_comments 
ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER;

ALTER TABLE t_p61788166_html_to_frontend.ticket_comments 
ADD COLUMN IF NOT EXISTS mentioned_user_ids INTEGER[];

-- Создаём индекс для быстрого поиска ответов
CREATE INDEX IF NOT EXISTS idx_ticket_comments_parent ON t_p61788166_html_to_frontend.ticket_comments(parent_comment_id);

-- Добавляем комментарий к таблице
COMMENT ON COLUMN t_p61788166_html_to_frontend.ticket_comments.parent_comment_id IS 'ID родительского комментария для ответов';
COMMENT ON COLUMN t_p61788166_html_to_frontend.ticket_comments.mentioned_user_ids IS 'Массив ID упомянутых пользователей';