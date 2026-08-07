-- UP: Чек-лист блокировки доступов
-- Обратная миграция (down) лежит рядом: db_migrations/down/access_blocking_checklist_down.sql

-- Признак услуги: требуется ли чек-лист блокировки доступов
ALTER TABLE t_p67567221_one_file_page_projec.ticket_services
    ADD COLUMN IF NOT EXISTS requires_access_checklist BOOLEAN NOT NULL DEFAULT false;

-- Справочник сервисов, из которых удаляют/блокируют учётку
CREATE TABLE IF NOT EXISTS t_p67567221_one_file_page_projec.access_checklist_services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Пункты чек-листа конкретной заявки
CREATE TABLE IF NOT EXISTS t_p67567221_one_file_page_projec.ticket_access_checklist_items (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL,
    service_id INTEGER NULL,
    service_name VARCHAR(255) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    comment TEXT NULL,
    completed_by_user_id INTEGER NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ticket_access_checklist_items_status_chk
        CHECK (status IN ('pending', 'done', 'not_applicable')),
    CONSTRAINT ticket_access_checklist_items_na_comment_chk
        CHECK (status <> 'not_applicable' OR (comment IS NOT NULL AND btrim(comment) <> ''))
);

CREATE INDEX IF NOT EXISTS idx_tacl_items_ticket
    ON t_p67567221_one_file_page_projec.ticket_access_checklist_items (ticket_id);

CREATE INDEX IF NOT EXISTS idx_tacl_items_ticket_status
    ON t_p67567221_one_file_page_projec.ticket_access_checklist_items (ticket_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tacl_items_ticket_service
    ON t_p67567221_one_file_page_projec.ticket_access_checklist_items (ticket_id, service_id)
    WHERE service_id IS NOT NULL;

-- Стартовый состав справочника (порядок сохранён)
INSERT INTO t_p67567221_one_file_page_projec.access_checklist_services (name, sort_order, is_active)
SELECT v.name, v.sort_order, true
FROM (VALUES
    ('Битрикс РФ', 10),
    ('Битрикс КЗ', 20),
    ('Корпоративная почта', 30),
    ('AD', 40),
    ('1С', 50),
    ('LexisVoice', 60),
    ('help-km.ru', 70)
) AS v(name, sort_order)
WHERE NOT EXISTS (
    SELECT 1 FROM t_p67567221_one_file_page_projec.access_checklist_services s
    WHERE s.name = v.name
);

-- Включаем чек-лист для услуги «Заблокировать доступ»
UPDATE t_p67567221_one_file_page_projec.ticket_services
SET requires_access_checklist = true
WHERE id = 6;

-- Права на управление справочником чек-листа
INSERT INTO t_p67567221_one_file_page_projec.permissions (name, resource, action, description)
SELECT v.name, v.resource, v.action, v.description
FROM (VALUES
    ('access_checklist.read', 'access_checklist', 'read', 'Просмотр справочника чек-листа блокировки доступов'),
    ('access_checklist.create', 'access_checklist', 'create', 'Создание пунктов справочника чек-листа блокировки доступов'),
    ('access_checklist.update', 'access_checklist', 'update', 'Изменение пунктов справочника чек-листа блокировки доступов'),
    ('access_checklist.remove', 'access_checklist', 'remove', 'Удаление пунктов справочника чек-листа блокировки доступов')
) AS v(name, resource, action, description)
WHERE NOT EXISTS (
    SELECT 1 FROM t_p67567221_one_file_page_projec.permissions p
    WHERE p.resource = v.resource AND p.action = v.action
);

-- Выдаём новые права администраторам
INSERT INTO t_p67567221_one_file_page_projec.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM t_p67567221_one_file_page_projec.roles r
CROSS JOIN t_p67567221_one_file_page_projec.permissions p
WHERE lower(coalesce(r.system_role, '')) = 'admin'
  AND p.resource = 'access_checklist'
  AND NOT EXISTS (
      SELECT 1 FROM t_p67567221_one_file_page_projec.role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
