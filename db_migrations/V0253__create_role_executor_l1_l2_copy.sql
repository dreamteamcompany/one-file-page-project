-- Копия роли «Исполнитель» (id=8) с названием «Исполнитель L1-L2»:
-- те же system_role, description, restrict_to_groups, все права и видимые группы.

INSERT INTO t_p67567221_one_file_page_projec.roles (name, description, system_role, restrict_to_groups)
SELECT 'Исполнитель L1-L2', description, system_role, restrict_to_groups
FROM t_p67567221_one_file_page_projec.roles
WHERE id = 8
  AND NOT EXISTS (
    SELECT 1 FROM t_p67567221_one_file_page_projec.roles WHERE name = 'Исполнитель L1-L2'
  );

-- Копируем права
INSERT INTO t_p67567221_one_file_page_projec.role_permissions (role_id, permission_id)
SELECT nr.id, rp.permission_id
FROM t_p67567221_one_file_page_projec.role_permissions rp
CROSS JOIN (SELECT id FROM t_p67567221_one_file_page_projec.roles WHERE name = 'Исполнитель L1-L2') nr
WHERE rp.role_id = 8
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Копируем видимые группы (если есть)
INSERT INTO t_p67567221_one_file_page_projec.role_visible_groups (role_id, group_id)
SELECT nr.id, rvg.group_id
FROM t_p67567221_one_file_page_projec.role_visible_groups rvg
CROSS JOIN (SELECT id FROM t_p67567221_one_file_page_projec.roles WHERE name = 'Исполнитель L1-L2') nr
WHERE rvg.role_id = 8
ON CONFLICT (role_id, group_id) DO NOTHING;