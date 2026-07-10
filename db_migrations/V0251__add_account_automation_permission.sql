INSERT INTO permissions (name, resource, action, description)
VALUES ('account_automation.access', 'account_automation', 'access', 'Автоматизация создания УЗ')
ON CONFLICT (resource, action) DO NOTHING;