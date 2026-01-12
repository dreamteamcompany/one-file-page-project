-- Назначаем разрешение services:read роли Администратор
INSERT INTO role_permissions (role_id, permission_id) 
VALUES (1, (SELECT id FROM permissions WHERE name = 'services:read'))
ON CONFLICT DO NOTHING;