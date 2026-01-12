-- Добавляем права для customer_departments
INSERT INTO t_p61788166_html_to_frontend.permissions (name, resource, action, description) 
SELECT * FROM (VALUES
  ('customer_departments.read', 'customer_departments', 'read', 'Чтение отделов-заказчиков'),
  ('customer_departments.create', 'customer_departments', 'create', 'Создание отделов-заказчиков'),
  ('customer_departments.update', 'customer_departments', 'update', 'Редактирование отделов-заказчиков'),
  ('customer_departments.remove', 'customer_departments', 'remove', 'Удаление отделов-заказчиков')
) AS v(name, resource, action, description);

-- Назначаем все права администратору (role_id = 1)
INSERT INTO t_p61788166_html_to_frontend.role_permissions (role_id, permission_id)
SELECT 1, p.id 
FROM t_p61788166_html_to_frontend.permissions p 
WHERE p.resource = 'customer_departments';