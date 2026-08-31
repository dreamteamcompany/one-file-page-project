"""Создание резервной копии БД: консистентный снимок + проверка целостности.

Гарантии:
- Только чтение. Соединение переводится в режим read-only на уровне СУБД,
  поэтому любая попытка записи (INSERT/UPDATE/DELETE/DDL) отклоняется самим
  PostgreSQL, а не только договорённостью в коде.
- Консистентность. Снимок берётся в одной транзакции REPEATABLE READ, то есть
  все таблицы соответствуют одному моменту времени.
- Доступ только для роли admin.
- Файл кладётся в приватное хранилище, ссылка временная (по умолчанию 1 час).
- После выгрузки дамп перечитывается из хранилища и проверяется. Успехом
  считается только пройденная проверка, а не сам факт создания файла.
"""
import gzip
import hashlib
import io
import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import boto3
import jwt
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_REPEATABLE_READ

JWT_SECRET = os.environ.get('JWT_SECRET')
DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA')

if not JWT_SECRET:
    raise RuntimeError('JWT_SECRET environment variable is required')
if not DATABASE_URL:
    raise RuntimeError('DATABASE_URL environment variable is required')
if not SCHEMA:
    raise RuntimeError('MAIN_DB_SCHEMA environment variable is required')

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Id, Authorization',
    'Access-Control-Max-Age': '86400',
}

# Ссылка на скачивание живёт ограниченное время: она даёт доступ к
# персональным данным, бессрочная ссылка была бы утечкой.
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


def _resp(status: int, body: Any) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, ensure_ascii=False, default=str),
        'isBase64Encoded': False,
    }


def _connect_readonly():
    """Соединение только для чтения с консистентным снимком.

    default_transaction_read_only выставляется параметром соединения, поэтому
    ограничение действует с первой же команды и снять его изнутри нельзя.
    """
    conn = psycopg2.connect(
        DATABASE_URL,
        options=f'-c search_path={SCHEMA},public -c default_transaction_read_only=on '
                f'-c statement_timeout=0 -c idle_in_transaction_session_timeout=0',
    )
    conn.set_session(
        isolation_level=ISOLATION_LEVEL_REPEATABLE_READ,
        readonly=True,
        autocommit=False,
    )
    return conn


def _verify_admin(event: Dict[str, Any]) -> Tuple[Optional[int], Optional[Dict[str, Any]]]:
    headers = event.get('headers') or {}
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
    if not token:
        return None, _resp(401, {'error': 'Требуется авторизация'})

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return None, _resp(401, {'error': 'Сессия истекла, войдите заново'})
    except jwt.InvalidTokenError:
        return None, _resp(401, {'error': 'Недействительный токен'})

    user_id = payload.get('user_id') or payload.get('sub')
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return None, _resp(401, {'error': 'Недействительный токен'})

    conn = _connect_readonly()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM user_roles ur "
                "JOIN roles r ON r.id = ur.role_id "
                "WHERE ur.user_id = %s "
                "AND (r.system_role = 'admin' OR r.name = 'admin') LIMIT 1",
                (user_id,),
            )
            if cur.fetchone() is None:
                return None, _resp(403, {'error': 'Доступ только для администратора'})
    finally:
        conn.rollback()
        conn.close()

    return user_id, None


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
    tables = [r[0] for r in cur.fetchall()]
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
    for name, dtype, maxlen, prec, scale, nullable, default in cur.fetchall():
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
            # и первая же новая запись упадёт с ошибкой. Сами счётчики
            # создаются в начале файла, до таблиц.
            piece += f' DEFAULT {re.sub(rf"{re.escape(SCHEMA)}\.", "", str(default))}'
        if nullable == 'NO':
            piece += ' NOT NULL'
        cols.append(piece)

    lines = [f'DROP TABLE IF EXISTS "{table}" CASCADE;',
             f'CREATE TABLE "{table}" (']
    lines.append(',\n'.join(cols))
    lines.append(');')
    return '\n'.join(lines) + '\n'


def _dump_constraints(cur, table: str) -> str:
    """Ключи и индексы добавляются после данных — так загрузка быстрее."""
    out = []
    cur.execute(
        "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint "
        "WHERE conrelid = %s::regclass ORDER BY contype DESC, conname",
        (f'{SCHEMA}.{table}',),
    )
    for name, definition in cur.fetchall():
        out.append(f'ALTER TABLE "{table}" ADD CONSTRAINT "{name}" {definition};')

    cur.execute(
        "SELECT indexdef FROM pg_indexes "
        "WHERE schemaname = %s AND tablename = %s",
        (SCHEMA, table),
    )
    for (definition,) in cur.fetchall():
        if ' UNIQUE INDEX ' in definition and '_pkey' in definition:
            continue
        out.append(definition.replace(f'{SCHEMA}.', '') + ';')
    return '\n'.join(out) + ('\n' if out else '')


def _dump_sequences(cur) -> Tuple[str, str]:
    """Счётчики автонумерации.

    Возвращает две части: создание (идёт до таблиц, потому что таблицы
    ссылаются на счётчики) и установку текущих значений (идёт после данных,
    иначе загрузка строк сдвинет счётчик и новые записи получат занятые id).
    """
    cur.execute(
        "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
        "WHERE n.nspname = %s AND c.relkind = 'S' ORDER BY c.relname",
        (SCHEMA,),
    )
    names = [r[0] for r in cur.fetchall()]
    create: List[str] = []
    setval: List[str] = []
    for seq in names:
        cur.execute(sql.SQL('SELECT last_value, is_called FROM {}').format(
            sql.Identifier(SCHEMA, seq)))
        row = cur.fetchone()
        if row:
            create.append(f'CREATE SEQUENCE IF NOT EXISTS "{seq}";')
            setval.append(
                f"SELECT pg_catalog.setval('\"{seq}\"', {row[0]}, {str(row[1]).lower()});")
    nl = lambda xs: '\n'.join(xs) + ('\n' if xs else '')
    return nl(create), nl(setval)


def handler(event, context):
    """Создаёт резервную копию базы и проверяет её пригодность к восстановлению."""
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    if method not in ('GET', 'POST'):
        return _resp(405, {'error': 'Method not allowed'})

    user_id, deny = _verify_admin(event)
    if deny is not None:
        return deny

    params = event.get('queryStringParameters') or {}
    body = {}
    if method == 'POST':
        try:
            body = json.loads(event.get('body') or '{}')
        except (ValueError, TypeError):
            body = {}

    mode = str(body.get('mode') or params.get('mode') or 'full').lower()
    if mode not in ('full', 'no_logs', 'schema'):
        return _resp(400, {'error': 'mode: full | no_logs | schema'})

    include_logs = mode == 'full'
    with_data = mode != 'schema'

    buf = io.BytesIO()
    gz = gzip.GzipFile(fileobj=buf, mode='wb', compresslevel=6)

    started = datetime.now(timezone.utc)
    stats: List[Dict[str, Any]] = []
    total_rows = 0

    conn = _connect_readonly()
    try:
        with conn.cursor() as cur:
            # Фиксируем снимок: все последующие запросы видят одно состояние базы.
            cur.execute('SELECT pg_export_snapshot(), now()')
            snapshot_id, snapshot_at = cur.fetchone()

            tables = _fetch_tables(cur, include_logs)

            header = (
                '-- DreamDesk database backup\n'
                f'-- created_at: {started.isoformat()}\n'
                f'-- mode: {mode}\n'
                f'-- snapshot: {snapshot_id} @ {snapshot_at}\n'
                f'-- source_schema: {SCHEMA}\n'
                '-- restore: psql -d <db> -f <file>\n\n'
                'BEGIN;\n'
                'SET session_replication_role = replica;\n\n'
            )
            gz.write(header.encode())

            # Счётчики автонумерации создаются ДО таблиц: таблицы ссылаются
            # на них в DEFAULT nextval(...), иначе восстановление упадёт.
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
                            sql.Identifier(SCHEMA, table)).as_string(cur),
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
        # rollback, а не commit: транзакция была только на чтение.
        conn.rollback()
        conn.close()

    gz.close()
    payload = buf.getvalue()
    buf.close()

    sha256 = hashlib.sha256(payload).hexdigest()
    stamp = started.strftime('%Y%m%d-%H%M%S')
    key = f'{DUMP_PREFIX}/dreamdesk-{mode}-{stamp}.sql.gz'

    s3 = _s3_client()
    s3.put_object(
        Bucket='files',
        Key=key,
        Body=payload,
        ContentType='application/gzip',
        Metadata={'sha256': sha256, 'rows': str(total_rows), 'mode': mode},
    )

    checks = _verify_dump(s3, key, payload, sha256, tables, with_data)
    ok = all(c['ok'] for c in checks)

    result = {
        'success': ok,
        'mode': mode,
        'created_at': started.isoformat(),
        'snapshot_at': str(snapshot_at),
        'tables': len(tables),
        'rows': total_rows,
        'size_bytes': len(payload),
        'sha256': sha256,
        'checks': checks,
        'duration_sec': round((datetime.now(timezone.utc) - started).total_seconds(), 1),
        'top_tables': sorted(stats, key=lambda x: -x['rows'])[:10],
    }

    if not ok:
        failed = [c['name'] for c in checks if not c['ok']]
        # Непройденная проверка — это не успех: файл удаляем, чтобы им
        # не воспользовались как резервной копией.
        s3.delete_object(Bucket='files', Key=key)
        result['error'] = 'Дамп не прошёл проверку целостности и был удалён'
        result['failed_checks'] = failed
        return _resp(500, result)

    result['download_url'] = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': 'files', 'Key': key},
        ExpiresIn=LINK_TTL_SECONDS,
    )
    result['expires_in_sec'] = LINK_TTL_SECONDS
    result['filename'] = key.split('/')[-1]
    return _resp(200, result)


def _verify_dump(s3, key: str, payload: bytes, sha256: str,
                 tables: List[str], with_data: bool) -> List[Dict[str, Any]]:
    """Проверка пригодности дампа к восстановлению.

    Файл перечитывается из хранилища — проверяется именно то, что сохранено,
    а не то, что лежит в памяти.
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

    # Структуру считаем ТОЛЬКО вне блоков данных. Иначе текст заявки или
    # комментария со словами «CREATE TABLE» или «COMMIT;» в начале строки
    # исказил бы подсчёт и забраковал исправный дамп.
    created = 0
    copies = 0
    terms = 0
    begins = 0
    commits = 0
    unclosed = False
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

    unclosed = in_copy

    add('Все таблицы выгружены', created == len(tables),
        f'{created} из {len(tables)}')

    if with_data:
        add('Блоки данных закрыты корректно',
            copies == terms and copies > 0 and not unclosed,
            f'{copies} блоков, {terms} завершителей'
            + (' — последний блок оборван' if unclosed else ''))

    balanced = begins == commits == 1
    add('Транзакция сбалансирована', balanced,
        'BEGIN и COMMIT парные' if balanced else 'нарушена структура транзакции')

    return checks