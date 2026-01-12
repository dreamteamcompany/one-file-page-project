INSERT INTO roles (name, description) VALUES
('Администратор', 'Полный доступ ко всем функциям системы'),
('Бухгалтер', 'Управление платежами и просмотр отчетов'),
('Просмотр', 'Только просмотр данных без возможности редактирования');

INSERT INTO permissions (name, description, resource, action) VALUES
('payments.create', 'Создание платежей', 'payments', 'create'),
('payments.read', 'Просмотр платежей', 'payments', 'read'),
('payments.update', 'Редактирование платежей', 'payments', 'update'),
('payments.remove', 'Удаление платежей', 'payments', 'remove'),

('categories.create', 'Создание категорий', 'categories', 'create'),
('categories.read', 'Просмотр категорий', 'categories', 'read'),
('categories.update', 'Редактирование категорий', 'categories', 'update'),
('categories.remove', 'Удаление категорий', 'categories', 'remove'),

('legal_entities.create', 'Создание юр.лиц', 'legal_entities', 'create'),
('legal_entities.read', 'Просмотр юр.лиц', 'legal_entities', 'read'),
('legal_entities.update', 'Редактирование юр.лиц', 'legal_entities', 'update'),
('legal_entities.remove', 'Удаление юр.лиц', 'legal_entities', 'remove'),

('users.create', 'Создание пользователей', 'users', 'create'),
('users.read', 'Просмотр пользователей', 'users', 'read'),
('users.update', 'Редактирование пользователей', 'users', 'update'),
('users.remove', 'Удаление пользователей', 'users', 'remove'),

('roles.create', 'Создание ролей', 'roles', 'create'),
('roles.read', 'Просмотр ролей', 'roles', 'read'),
('roles.update', 'Редактирование ролей', 'roles', 'update'),
('roles.remove', 'Удаление ролей', 'roles', 'remove');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'Администратор';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'Бухгалтер' 
AND p.resource IN ('payments', 'categories', 'legal_entities');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'Просмотр' 
AND p.action = 'read';