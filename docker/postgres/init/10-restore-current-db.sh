#!/usr/bin/env bash
set -Eeuo pipefail

dump_path=/seed/current.dump
schema_name=${MAIN_DB_SCHEMA:-t_p67567221_one_file_page_projec}

if [[ ! -s "$dump_path" ]]; then
    echo "ОШИБКА: снимок БД $dump_path отсутствует или пуст" >&2
    exit 1
fi

echo "Восстановление текущего состояния DreamDesk из $dump_path"
pg_restore \
    --exit-on-error \
    --no-owner \
    --no-privileges \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    "$dump_path"

psql \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --set=ON_ERROR_STOP=1 \
    --set=schema_name="$schema_name" \
    --set=db_user="$POSTGRES_USER" <<'SQL'
ALTER SCHEMA :"schema_name" OWNER TO :"db_user";
ALTER ROLE :"db_user" IN DATABASE :"DBNAME" SET search_path TO :"schema_name", public;

DO $$
DECLARE
    target_schema constant text := 't_p67567221_one_file_page_projec';
    table_count integer;
    foreign_key_count integer;
    invalid_index_count integer;
    admin_permission_count integer;
    admin_role_count integer;
    sequence_count integer := 0;
    sequence_row record;
    max_id bigint;
    last_id bigint;
BEGIN
    SELECT count(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = target_schema AND table_type = 'BASE TABLE';
    IF table_count <> 102 THEN
        RAISE EXCEPTION 'Ожидалось 102 таблицы, найдено %', table_count;
    END IF;

    SELECT count(*) INTO foreign_key_count
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = target_schema AND c.contype = 'f' AND c.convalidated;
    IF foreign_key_count <> 120 THEN
        RAISE EXCEPTION 'Ожидалось 120 внешних ключей, найдено %', foreign_key_count;
    END IF;

    SELECT count(*) INTO invalid_index_count
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = target_schema AND NOT i.indisvalid;
    IF invalid_index_count <> 0 THEN
        RAISE EXCEPTION 'Найдено недействительных индексов: %', invalid_index_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = target_schema
          AND table_name = 'ticket_custom_field_values'
          AND column_name = 'field_id'
    ) THEN
        RAISE EXCEPTION 'Отсутствует ticket_custom_field_values.field_id';
    END IF;

    IF (
        SELECT count(*)
        FROM information_schema.columns
        WHERE table_schema = target_schema
          AND table_name = 'sla'
          AND column_name IN (
              'response_time_minutes',
              'response_notification_minutes',
              'no_response_minutes',
              'resolution_time_minutes',
              'resolution_notification_minutes'
          )
    ) <> 5 THEN
        RAISE EXCEPTION 'Структура SLA не соответствует backend-контракту в минутах';
    END IF;

    EXECUTE format(
        'SELECT count(*) FROM %I.role_permissions WHERE role_id = 1',
        target_schema
    ) INTO admin_permission_count;
    IF admin_permission_count <> 98 THEN
        RAISE EXCEPTION 'Ожидалось 98 прав администратора, найдено %', admin_permission_count;
    END IF;

    EXECUTE format(
        'SELECT count(*) FROM %I.user_roles ur '
        'JOIN %I.users u ON u.id = ur.user_id '
        'WHERE u.username = ''admin''',
        target_schema,
        target_schema
    ) INTO admin_role_count;
    IF admin_role_count <> 1 THEN
        RAISE EXCEPTION 'У admin должна быть ровно одна роль, найдено %', admin_role_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM t_p67567221_one_file_page_projec.user_roles ur
        JOIN t_p67567221_one_file_page_projec.users u ON u.id = ur.user_id
        WHERE u.username = 'admin' AND ur.role_id = 1
    ) THEN
        RAISE EXCEPTION 'У admin не назначена системная роль Администратор (ID 1)';
    END IF;

    FOR sequence_row IN
        SELECT c.relname AS table_name,
               a.attname AS column_name,
               pg_get_serial_sequence(
                   format('%I.%I', n.nspname, c.relname), a.attname
               ) AS sequence_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a
          ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
        WHERE n.nspname = target_schema
          AND c.relkind = 'r'
          AND pg_get_expr(d.adbin, d.adrelid) LIKE 'nextval(%'
    LOOP
        sequence_count := sequence_count + 1;
        EXECUTE format(
            'SELECT COALESCE(max(%I), 0)::bigint FROM %I.%I',
            sequence_row.column_name,
            target_schema,
            sequence_row.table_name
        ) INTO max_id;
        EXECUTE format(
            'SELECT last_value::bigint FROM %s', sequence_row.sequence_name
        ) INTO last_id;
        IF max_id > last_id THEN
            RAISE EXCEPTION 'Последовательность % отстаёт: max=%, last=%',
                sequence_row.sequence_name, max_id, last_id;
        END IF;
    END LOOP;
    IF sequence_count <> 87 THEN
        RAISE EXCEPTION 'Ожидалось 87 последовательностей, найдено %', sequence_count;
    END IF;
END
$$;
SQL

echo "Снимок DreamDesk восстановлен и проверен"
