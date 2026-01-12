-- Таблица для вложений в комментариях
CREATE TABLE IF NOT EXISTS t_p61788166_html_to_frontend.comment_attachments (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL REFERENCES t_p61788166_html_to_frontend.ticket_comments(id),
    filename VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица для реакций на комментарии
CREATE TABLE IF NOT EXISTS t_p61788166_html_to_frontend.comment_reactions (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL REFERENCES t_p61788166_html_to_frontend.ticket_comments(id),
    user_id INTEGER NOT NULL REFERENCES t_p61788166_html_to_frontend.users(id),
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(comment_id, user_id, emoji)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_comment_attachments_comment_id ON t_p61788166_html_to_frontend.comment_attachments(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON t_p61788166_html_to_frontend.comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user_id ON t_p61788166_html_to_frontend.comment_reactions(user_id);