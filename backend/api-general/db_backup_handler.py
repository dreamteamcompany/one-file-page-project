"""Резервная копия БД: консистентный снимок + проверка целостности.

Гарантии:
- Только чтение. Открывается ОТДЕЛЬНОЕ соединение в режиме read-only на
  уровне СУБД, поэтому любая попытка записи (INSERT/UPDATE/DELETE/DDL)
  отклоняется самим PostgreSQL, а не только договорённостью в коде.
  Основное соединение api-general для выгрузки не используется.
- Консистентность. Снимок берётся в одной транзакции REPEATABLE READ:
  все таблицы соответствуют одному моменту времени.
- Доступ только для роли admin.
- Файл кладётся в приватное хранилище, ссылка временная.
- После выгрузки дамп перечитывается из хранилища и проверяется.
  Успех — только пройденная проверка, а не сам факт создания файла.
"""
import gzip
import hashlib
import io
import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

import boto3
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_REPEATABLE_READ
from psycopg2.extras import RealDictCursor

from shared_utils import response, SCHEMA

DATABASE_URL = os.environ.get('DATABASE_URL')

# Ссылка даёт доступ к персональным данным, поэтому живёт ограниченное время.
LINK_TTL_SECONDS = 3600
DUMP_PREFIX = 'db-backups'
COPY_CHUNK = 1 << 16

# Журнальные таблицы: не нужны для восстановления работы сервиса,
# но составляют заметную часть объёма.
LOG_TABLES = {
    'ai_classification_logs',
    'ai_pending_reviews',
    'automation_runs',
    'notifications',
    'ticket_views',
    'ticket_comment_reads',
}


def _connect_readonly():
    """Отдельное соединение только для чтения с консистентным снимком.

    default_transaction_read_only задаётся параметром соединения, поэтому
    ограничение действует с первой команды и снять его изнутри нельзя.
    """
    conn = psycopg2.connect(
        DATABASE_URL,
        # Тот же тип курсора, что и в основном соединении проекта:
        # код ниже читает поля по имени, а не по номеру.
        cursor_factory=RealDictCursor,
        options=(
            f'-c search_path={SCHEMA},public '
            f'-c default_transaction_read_only=on '
            f'-c statement_timeout=0 '
            f'-c idle_in_transaction_session_timeout=0'
        ),
    )
    conn.set_session(
        isolation_level=ISOLATION_LEVEL_REPEATABLE_READ,
        readonly=True,
        autocommit=False,
    )
    return conn


def _is_admin(conn, user_id: int) -> bool:
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT 1 FROM user_roles ur "
            "JOIN roles r ON r.id = ur.role_id "
            "WHERE ur.user_id = %s "
            "AND (r.system_role = 'admin' OR r.name = 'admin') LIMIT 1",
            (user_id,),
        )
        return cur.fetchone() is not None
    finally:
        cur.close()


def _s3_client():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )


def _fetch_tables(cur, include_logs: bool) -> List[str]:
    cur.execute(
        "SELECT c.relname FROM pg_class c "
        "JOIN pg_namespace n ON n.oid = c.relnamespace "
        "WHERE n.nspname = %s AND c.relkind = 'r' "
        "ORDER BY c.relname",
        (SCHEMA,),
    )
    tables = [r['relname'] for r in cur.fetchall()]
    if not include_logs:
        tables = [t for t in tables if t not in LOG_TABLES]
    return tables


def _dump_ddl(cur, table: str) -> str:
    """Определение таблицы: колонки, типы, NOT NULL, значения по умолчанию."""
    cur.execute(
        "SELECT column_name, data_type, character_maximum_length, "
        "numeric_precision, numeric_scale, is_nullable, column_default "
        "FROM information_schema.columns "
        "WHERE table_schema = %s AND table_name = %s "
        "ORDER BY ordinal_position",
        (SCHEMA, table),
    )
    cols = []
    for row in cur.fetchall():
        name = row['column_name']
        dtype = row['data_type']
        maxlen = row['character_maximum_length']
        prec = row['numeric_precision']
        scale = row['numeric_scale']
        nullable = row['is_nullable']
        default = row['column_default']

        t = dtype
        if dtype == 'character varying' and maxlen:
            t = f'varchar({maxlen})'
        elif dtype == 'character' and maxlen:
            t = f'char({maxlen})'
        elif dtype == 'numeric' and prec:
            t = f'numeric({prec},{scale or 0})'
        elif dtype == 'ARRAY':
            t = 'text[]'

        piece = f'    "{name}" {t}'
        if default is not None:
            # Значение по умолчанию сохраняется целиком, включая nextval:
            # без него у восстановленной таблицы пропадёт автонумерация
            # и первая же новая запись упадёт с ошибкой.
            clean = re.sub(rf'{re.escape(SCHEMA)}\.', '', str(default))
            piece += f' DEFAULT {clean}'
        if nullable == 'NO':
            piece += ' NOT NULL'
        cols.append(piece)

    return (
        f'DROP TABLE IF EXISTS "{table}" CASCADE;\n'
        f'CREATE TABLE "{table}" (\n'
        + ',\n'.join(cols)
        + '\n);\n'
    )


def _dump_constraints(cur, table: str) -> str:
    """Ключи и индексы идут после данных — так загрузка быстрее."""
    out = []
    cur.execute(
        "SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint "
        "WHERE conrelid = %s::regclass ORDER BY contype DESC, conname",
        (f'{SCHEMA}.{table}',),
    )
    for row in cur.fetchall():
        out.append(
            f'ALTER TABLE "{table}" ADD CONSTRAINT "{row["conname"]}" {row["def"]};'
        )

    cur.execute(
        "SELECT indexdef FROM pg_indexes WHERE schemaname = %s AND tablename = %s",
        (SCHEMA, table),
    )
    for row in cur.fetchall():
        definition = row['indexdef']
        # Индекс первичного ключа уже создан вместе с ограничением выше.
        if ' UNIQUE INDEX ' in definition and '_pkey' in definition:
            continue
        out.append(definition.replace(f'{SCHEMA}.', '') + ';')

    return '\n'.join(out) + ('\n' if out else '')


def _dump_sequences(cur) -> Tuple[str, str]:
    """Счётчики автонумерации.

    Две части: создание (идёт ДО таблиц, потому что таблицы ссылаются на
    счётчики в DEFAULT nextval) и установка значений (ПОСЛЕ данных, иначе
    загрузка строк сдвинет счётчик и новые записи получат занятые id).
    """
    cur.execute(
        "SELECT c.relname FROM pg_class c "
        "JOIN pg_namespace n ON n.oid = c.relnamespace "
        "WHERE n.nspname = %s AND c.relkind = 'S' ORDER BY c.relname",
        (SCHEMA,),
    )
    names = [r['relname'] for r in cur.fetchall()]

    create: List[str] = []
    setval: List[str] = []
    for seq in names:
        cur.execute(
            sql.SQL('SELECT last_value, is_called FROM {}').format(
                sql.Identifier(SCHEMA, seq)
            )
        )
        row = cur.fetchone()
        if row:
            create.append(f'CREATE SEQUENCE IF NOT EXISTS "{seq}";')
            setval.append(
                f'SELECT pg_catalog.setval(\'"{seq}"\', '
                f'{row["last_value"]}, {str(row["is_called"]).lower()});'
            )

    def joined(items: List[str]) -> str:
        return '\n'.join(items) + ('\n' if items else '')

    return joined(create), joined(setval)


def _verify_dump(s3, key: str, sha256: str, tables: List[str],
                 with_data: bool) -> List[Dict[str, Any]]:
    """Проверка пригодности дампа к восстановлению.

    Файл перечитывается из хранилища: проверяется именно то, что сохранено,
    а не то, что осталось в памяти.
    """
    checks: List[Dict[str, Any]] = []

    def add(name: str, ok: bool, detail: str) -> None:
        checks.append({'name': name, 'ok': bool(ok), 'detail': detail})

    try:
        stored = s3.get_object(Bucket='files', Key=key)['Body'].read()
    except Exception as exc:
        add('Файл читается из хранилища', False, str(exc))
        return checks

    add('Файл читается из хранилища', True, f'{len(stored)} байт')

    same = hashlib.sha256(stored).hexdigest() == sha256
    add('Контрольная сумма совпадает', same,
        'файл не повреждён при передаче' if same else 'файл повреждён')
    if not same:
        return checks

    try:
        text = gzip.decompress(stored).decode('utf-8', 'replace')
    except Exception as exc:
        add('Архив распаковывается', False, str(exc))
        return checks

    add('Архив распаковывается', True, f'{len(text)} символов')

    complete = text.rstrip().endswith('COMMIT;')
    add('Дамп завершён полностью', complete,
        'файл не оборван' if complete else 'файл оборван — данные неполные')

    # Структура считается ТОЛЬКО вне блоков данных: текст заявки или
    # комментария, начинающийся со слов «CREATE TABLE» или «COMMIT;»,
    # иначе исказил бы подсчёт и забраковал исправный дамп.
    created = copies = terms = begins = commits = 0
    in_copy = False
    for line in text.split('\n'):
        if in_copy:
            if line == '\\.':
                terms += 1
                in_copy = False
            continue
        if line.startswith('COPY '):
            copies += 1
            in_copy = True
        elif line.startswith('CREATE TABLE '):
            created += 1
        elif line == 'BEGIN;':
            begins += 1
        elif line == 'COMMIT;':
            commits += 1

    add('Все таблицы выгружены', created == len(tables),
        f'{created} из {len(tables)}')

    if with_data:
        add('Блоки данных закрыты корректно',
            copies == terms and copies > 0 and not in_copy,
            f'{copies} блоков, {terms} завершителей'
            + (' — последний блок оборван' if in_copy else ''))

    balanced = begins == commits == 1
    add('Транзакция сбалансирована', balanced,
        'BEGIN и COMMIT парные' if balanced else 'нарушена структура транзакции')

    return checks


def handle_db_backup(method, event, conn, payload):
    """Создаёт резервную копию базы и проверяет её пригодность к восстановлению."""
    if method != 'POST':
        return response(405, {'error': 'Method not allowed'})

    user_id = payload.get('user_id')
    if not user_id:
        return response(401, {'error': 'User ID not found in token'})

    # Права проверяем на основном соединении — оно уже открыто.
    if not _is_admin(conn, int(user_id)):
        return response(403, {'error': 'Доступ только для администратора'})

    if not DATABASE_URL:
        return response(500, {'error': 'DATABASE_URL is not configured'})
    if not os.environ.get('AWS_ACCESS_KEY_ID'):
        return response(500, {'error': 'Хранилище файлов не настроено'})

    try:
        body = json.loads(event.get('body') or '{}')
    except (ValueError, TypeError):
        body = {}

    mode = str(body.get('mode') or 'full').lower()
    if mode not in ('full', 'no_logs', 'schema'):
        return response(400, {'error': 'mode: full | no_logs | schema'})

    include_logs = mode == 'full'
    with_data = mode != 'schema'

    buf = io.BytesIO()
    gz = gzip.GzipFile(fileobj=buf, mode='wb', compresslevel=6)

    started = datetime.now(timezone.utc)
    stats: List[Dict[str, Any]] = []
    total_rows = 0
    tables: List[str] = []
    snapshot_at = None

    # ВАЖНО: отдельное соединение только для чтения.
    dump_conn = _connect_readonly()
    try:
        cur = dump_conn.cursor()
        try:
            # Фиксируем снимок: все запросы ниже видят одно состояние базы.
            cur.execute('SELECT pg_export_snapshot() AS snap, now() AS ts')
            snap_row = cur.fetchone()
            snapshot_id = snap_row['snap']
            snapshot_at = snap_row['ts']

            tables = _fetch_tables(cur, include_logs)

            gz.write((
                '-- DreamDesk database backup\n'
                f'-- created_at: {started.isoformat()}\n'
                f'-- mode: {mode}\n'
                f'-- snapshot: {snapshot_id} @ {snapshot_at}\n'
                f'-- source_schema: {SCHEMA}\n'
                '-- restore: psql -d <db> -f <file>\n\n'
                'BEGIN;\n'
                'SET session_replication_role = replica;\n\n'
            ).encode())

            # Счётчики создаются ДО таблиц: таблицы ссылаются на них.
            seq_create, seq_setval = _dump_sequences(cur)
            gz.write(b'-- ---------- sequences ----------\n')
            gz.write(seq_create.encode())

            for table in tables:
                gz.write(f'\n-- ---------- {table} ----------\n'.encode())
                gz.write(_dump_ddl(cur, table).encode())

                rows = 0
                if with_data:
                    gz.write(f'COPY "{table}" FROM stdin;\n'.encode())
                    copy_buf = io.BytesIO()
                    cur.copy_expert(
                        sql.SQL('COPY {} TO STDOUT').format(
                            sql.Identifier(SCHEMA, table)
                        ).as_string(cur),
                        copy_buf,
                        size=COPY_CHUNK,
                    )
                    data = copy_buf.getvalue()
                    gz.write(data)
                    gz.write(b'\\.\n')
                    rows = data.count(b'\n')
                    copy_buf.close()

                gz.write(_dump_constraints(cur, table).encode())
                stats.append({'table': table, 'rows': rows})
                total_rows += rows

            gz.write(b'\n-- ---------- sequence values ----------\n')
            gz.write(seq_setval.encode())
            gz.write(b'\nSET session_replication_role = DEFAULT;\nCOMMIT;\n')
        finally:
            cur.close()
    finally:
        # rollback, а не commit: транзакция была только на чтение.
        dump_conn.rollback()
        dump_conn.close()

    gz.close()
    dump_bytes = buf.getvalue()
    buf.close()

    sha256 = hashlib.sha256(dump_bytes).hexdigest()
    stamp = started.strftime('%Y%m%d-%H%M%S')
    key = f'{DUMP_PREFIX}/dreamdesk-{mode}-{stamp}.sql.gz'

    s3 = _s3_client()
    s3.put_object(
        Bucket='files',
        Key=key,
        Body=dump_bytes,
        ContentType='application/gzip',
        Metadata={'sha256': sha256, 'rows': str(total_rows), 'mode': mode},
    )

    checks = _verify_dump(s3, key, sha256, tables, with_data)
    ok = all(c['ok'] for c in checks)

    result = {
        'success': ok,
        'mode': mode,
        'created_at': started.isoformat(),
        'snapshot_at': str(snapshot_at),
        'tables': len(tables),
        'rows': total_rows,
        'size_bytes': len(dump_bytes),
        'sha256': sha256,
        'checks': checks,
        'duration_sec': round((datetime.now(timezone.utc) - started).total_seconds(), 1),
        'top_tables': sorted(stats, key=lambda x: -x['rows'])[:10],
    }

    if not ok:
        # Непройденная проверка — не успех. Файл удаляем, чтобы им
        # не воспользовались как резервной копией.
        s3.delete_object(Bucket='files', Key=key)
        result['error'] = 'Дамп не прошёл проверку целостности и был удалён'
        result['failed_checks'] = [c['name'] for c in checks if not c['ok']]
        return response(500, result)

    result['download_url'] = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': 'files', 'Key': key},
        ExpiresIn=LINK_TTL_SECONDS,
    )
    result['expires_in_sec'] = LINK_TTL_SECONDS
    result['filename'] = key.split('/')[-1]
    return response(200, result)