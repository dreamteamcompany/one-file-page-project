-- DOWN для V0259__access_blocking_checklist.sql
-- Откат чек-листа блокировки доступов.
-- Выполнять вручную через интерфейс управления БД (инструмент миграций запрещает DROP TABLE).

BEGIN;

-- 1. Снимаем права у ролей
DELETE FROM t_p67567221_one_file_page_projec.role_permissions
WHERE permission_id IN (
    SELECT id FROM t_p67567221_one_file_page_projec.permissions
    WHERE resource = 'access_checklist'
);

-- 2. Удаляем сами права
DELETE FROM t_p67567221_one_file_page_projec.permissions
WHERE resource = 'access_checklist';

-- 3. Удаляем таблицы (сначала зависимую)
DROP TABLE IF EXISTS t_p67567221_one_file_page_projec.ticket_access_checklist_items;
DROP TABLE IF EXISTS t_p67567221_one_file_page_projec.access_checklist_services;

-- 4. Убираем признак у услуг
ALTER TABLE t_p67567221_one_file_page_projec.ticket_services
    DROP COLUMN IF EXISTS requires_access_checklist;

COMMIT;
