-- Add default ticket service categories
INSERT INTO ticket_service_categories (name, icon) VALUES
('IT Services', 'Monitor'),
('HR Services', 'Users'),
('Finance', 'DollarSign'),
('Operations', 'Settings');

-- Add sample services (optional)
INSERT INTO services (name, description, intermediate_approver_id, final_approver_id, customer_department_id, category_id)
SELECT 
    'Тестовая услуга',
    'Пример услуги для демонстрации',
    1,
    1,
    (SELECT id FROM departments LIMIT 1),
    (SELECT id FROM ticket_service_categories WHERE name = 'IT Services' LIMIT 1)
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1)
  AND EXISTS (SELECT 1 FROM departments LIMIT 1);