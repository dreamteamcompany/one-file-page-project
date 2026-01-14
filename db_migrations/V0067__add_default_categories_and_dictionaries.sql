-- Add default categories
INSERT INTO categories (name, icon) VALUES
('Офис', 'Building'),
('Зарплаты', 'Users'),
('Маркетинг', 'TrendingUp'),
('IT', 'Monitor'),
('Хозяйственные расходы', 'ShoppingCart')
ON CONFLICT (name) DO NOTHING;

-- Add default customer departments
INSERT INTO customer_departments (name, description) VALUES
('IT отдел', 'Отдел информационных технологий'),
('HR отдел', 'Отдел кадров'),
('Бухгалтерия', 'Финансовый отдел'),
('Маркетинг', 'Отдел маркетинга');

-- Add default saving reasons
INSERT INTO saving_reasons (name, icon, is_active) VALUES
('Оптимизация процессов', 'Zap', true),
('Смена поставщика', 'RefreshCw', true),
('Автоматизация', 'Bot', true),
('Переговоры', 'MessageSquare', true);