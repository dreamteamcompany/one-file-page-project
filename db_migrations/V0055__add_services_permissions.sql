-- Добавляем разрешения для работы с услугами (services)
INSERT INTO permissions (name, resource, action, description) VALUES
('services:read', 'services', 'read', 'Просмотр услуг')
ON CONFLICT (name) DO NOTHING;