-- Учётная запись администратора admin1.
-- Пароль хранится только в виде bcrypt-хеша: восстановить его из базы нельзя.
INSERT INTO t_p67567221_one_file_page_projec.users
    (username, email, password_hash, full_name, is_active, can_login, auto_registered)
VALUES
    ('admin1',
     'no-email-admin1@placeholder.local',
     '$2b$12$BjP7SEWre2GU1jqdb.ndoeHlkO6J5ceoAe2iN1wjKkJQ7OLK.hs7u',
     'Администратор',
     true,
     true,
     false)
ON CONFLICT (username) DO NOTHING;

-- Роль администратора (id = 1, system_role = 'admin').
INSERT INTO t_p67567221_one_file_page_projec.user_roles (user_id, role_id)
SELECT u.id, 1
FROM t_p67567221_one_file_page_projec.users u
WHERE u.username = 'admin1'
ON CONFLICT DO NOTHING;
