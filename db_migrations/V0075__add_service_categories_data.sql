-- Добавляем категории услуг
INSERT INTO service_categories (name, description, icon) VALUES
    ('IT услуги', 'Техническая поддержка и IT', 'Monitor'),
    ('HR услуги', 'Кадровые вопросы', 'Users'),
    ('Финансы', 'Бухгалтерия и платежи', 'DollarSign')
ON CONFLICT DO NOTHING;