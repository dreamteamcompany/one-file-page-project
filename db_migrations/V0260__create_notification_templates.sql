CREATE TABLE IF NOT EXISTS t_p67567221_one_file_page_projec.notification_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER REFERENCES t_p67567221_one_file_page_projec.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON t_p67567221_one_file_page_projec.notification_templates(is_active);

INSERT INTO t_p67567221_one_file_page_projec.notification_templates (name, content, description, is_active)
VALUES
  ('Новый комментарий', 'Новый комментарий по заявке #номер_заявки «#тема_заявки»: #последний_комментарий', 'Отправляется участникам заявки при добавлении комментария', TRUE),
  ('Смена статуса', 'Заявка #номер_заявки «#тема_заявки» переведена в статус «#статус». Ссылка: #ссылка_на_заявку', 'Отправляется при изменении статуса заявки', TRUE),
  ('Просрочка', 'Заявка #номер_заявки «#тема_заявки» просрочена. Приоритет: #приоритет, ответственный: #ответственный', 'Отправляется при наступлении просрочки по сроку решения', TRUE);
