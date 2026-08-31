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
import zlib
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import boto3
from botocore.config import Config as BotoConfig
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_REPEATABLE_READ
from psycopg2.extras import RealDictCursor

from shared_utils import response, SCHEMA

DATABASE_URL = os.environ.get('DATABASE_URL')

# Ссылка даёт доступ к персональным данным, поэтому живёт ограниченное время.
LINK_TTL_SECONDS = 3600
DUMP_PREFIX = 'db-backups'
# Размер страницы при чтении данных. Небольшой намеренно: у функции
# всего 256 МБ памяти, а в базе есть таблицы по сотням мегабайт.
DATA_PAGE_SIZE = 1000
# Размер части при потоковой отправке в хранилище (минимум S3 — 5 МБ).
UPLOAD_PART_SIZE = 8 * 1024 * 1024

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
    # signature_version='s3v4' обязателен: со схемой подписи по умолчанию
    # хранилище отвечает Unauthorized на временную ссылку скачивания.
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        config=BotoConfig(signature_version='s3v4', s3={'addressing_style': 'path'}),
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


def _load_columns(cur) -> Dict[str, List[Dict[str, Any]]]:
    """Колонки ВСЕХ таблиц схемы за один запрос.

    Запросы к information_schema на этой платформе медленные (секунды).
    При 99 таблицах отдельный запрос на каждую гарантированно упёрся бы
    в таймаут функции, поэтому метаданные читаются разом.
    """
    cur.execute(
        "SELECT table_name, column_name, data_type, character_maximum_length, "
        "numeric_precision, numeric_scale, is_nullable, column_default "
        "FROM information_schema.columns "
        "WHERE table_schema = %s "
        "ORDER BY table_name, ordinal_position",
        (SCHEMA,),
    )
    result: Dict[str, List[Dict[str, Any]]] = {}
    for row in cur.fetchall():
        result.setdefault(row['table_name'], []).append(dict(row))
    return result


def _dump_ddl(columns: List[Dict[str, Any]], table: str) -> str:
    """Определение таблицы: колонки, типы, NOT NULL, значения по умолчанию."""
    cols = []
    for row in columns:
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


# Коды правил внешнего ключа в системном каталоге.
FK_ACTIONS = {
    'a': 'NO ACTION',
    'r': 'RESTRICT',
    'c': 'CASCADE',
    'n': 'SET NULL',
    'd': 'SET DEFAULT',
}


def _load_constraints(cur) -> Dict[str, List[Dict[str, Any]]]:
    """Ключи ВСЕХ таблиц схемы ОДНИМ запросом.

    Читаем системный каталог напрямую. Представления information_schema
    здесь работают на порядки медленнее: запрос по внешним ключам через
    них не укладывался даже в 30 секунд и обрывался по таймауту.
    Готовая функция pg_get_constraintdef на платформе запрещена, поэтому
    определения собираются вручную.

    Колонки разворачиваются через WITH ORDINALITY: порядок в составном
    ключе обязан сохраниться, иначе ключ будет собран неверно.
    """
    cur.execute(
        "SELECT c.conname, c.contype, tc.relname AS tbl, "
        "       rc.relname AS ref_tbl, c.confupdtype, c.confdeltype, "
        "       (SELECT array_agg(ta.attname ORDER BY k.ord) "
        "          FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) "
        "          JOIN pg_attribute ta ON ta.attrelid = c.conrelid "
        "           AND ta.attnum = k.attnum) AS cols, "
        "       (SELECT array_agg(fa.attname ORDER BY k.ord) "
        "          FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord) "
        "          JOIN pg_attribute fa ON fa.attrelid = c.confrelid "
        "           AND fa.attnum = k.attnum) AS ref_cols "
        "FROM pg_constraint c "
        "JOIN pg_namespace n ON n.oid = c.connamespace "
        "JOIN pg_class tc ON tc.oid = c.conrelid "
        "LEFT JOIN pg_class rc ON rc.oid = c.confrelid "
        "WHERE n.nspname = %s AND c.contype IN ('p', 'u', 'f') "
        "ORDER BY tc.relname, c.contype DESC, c.conname",
        (SCHEMA,),
    )

    type_map = {'p': 'PRIMARY KEY', 'u': 'UNIQUE', 'f': 'FOREIGN KEY'}
    result: Dict[str, List[Dict[str, Any]]] = {}
    for row in cur.fetchall():
        if not row['cols']:
            continue
        entry: Dict[str, Any] = {
            'name': row['conname'],
            'type': type_map[row['contype']],
            'cols': list(row['cols']),
        }
        if row['contype'] == 'f' and row['ref_tbl'] and row['ref_cols']:
            entry['ref'] = {'table': row['ref_tbl'], 'cols': list(row['ref_cols'])}
            entry['update_rule'] = FK_ACTIONS.get(row['confupdtype'], 'NO ACTION')
            entry['delete_rule'] = FK_ACTIONS.get(row['confdeltype'], 'NO ACTION')
        result.setdefault(row['tbl'], []).append(entry)
    return result


def _load_indexes(cur) -> Dict[str, List[str]]:
    """Индексы всех таблиц схемы за один запрос."""
    cur.execute(
        "SELECT tablename, indexdef FROM pg_indexes WHERE schemaname = %s",
        (SCHEMA,),
    )
    result: Dict[str, List[str]] = {}
    for row in cur.fetchall():
        result.setdefault(row['tablename'], []).append(row['indexdef'])
    return result


def _dump_constraints(constraints: List[Dict[str, Any]],
                      indexes: List[str], table: str) -> str:
    """Ключи и индексы идут после данных — так загрузка быстрее."""
    out = []

    for c in constraints:
        name = c['name']
        cols = ', '.join(f'"{x}"' for x in c['cols'])
        if c['type'] == 'PRIMARY KEY':
            out.append(f'ALTER TABLE "{table}" ADD CONSTRAINT "{name}" PRIMARY KEY ({cols});')
        elif c['type'] == 'UNIQUE':
            out.append(f'ALTER TABLE "{table}" ADD CONSTRAINT "{name}" UNIQUE ({cols});')
        elif c['type'] == 'FOREIGN KEY' and c.get('ref'):
            ref = c['ref']
            ref_cols = ', '.join(f'"{x}"' for x in ref['cols'])
            clause = (f'ALTER TABLE "{table}" ADD CONSTRAINT "{name}" '
                      f'FOREIGN KEY ({cols}) REFERENCES "{ref["table"]}" ({ref_cols})')
            if c.get('update_rule') and c['update_rule'] != 'NO ACTION':
                clause += f' ON UPDATE {c["update_rule"]}'
            if c.get('delete_rule') and c['delete_rule'] != 'NO ACTION':
                clause += f' ON DELETE {c["delete_rule"]}'
            out.append(clause + ';')

    for definition in indexes:
        # Индексы первичного и уникального ключей создаются вместе с самими
        # ключами выше — повторное создание вызвало бы ошибку.
        if ' UNIQUE INDEX ' in definition:
            continue
        out.append(definition.replace(f'{SCHEMA}.', '') + ';')

    return '\n'.join(out) + ('\n' if out else '')


class _S3StreamWriter:
    """Отправка дампа в хранилище по частям, без накопления в памяти.

    Готовый файл может весить сотни мегабайт, а у функции 256 МБ — собрать
    его целиком в памяти нельзя. Поэтому сжатые данные копятся в буфере и,
    как только он дорастает до размера части, уходят в хранилище и
    выбрасываются из памяти. Заодно на лету считается контрольная сумма.
    """

    def __init__(self, s3, bucket: str, key: str, content_type: str):
        self._s3 = s3
        self._bucket = bucket
        self._key = key
        self._buf = bytearray()
        self._parts: List[Dict[str, Any]] = []
        self._digest = hashlib.sha256()
        self.size = 0
        self._upload_id = s3.create_multipart_upload(
            Bucket=bucket, Key=key, ContentType=content_type
        )['UploadId']

    def write(self, data: bytes) -> None:
        self._digest.update(data)
        self.size += len(data)
        self._buf.extend(data)
        while len(self._buf) >= UPLOAD_PART_SIZE:
            self._flush_part(UPLOAD_PART_SIZE)

    def _flush_part(self, length: int) -> None:
        chunk = bytes(self._buf[:length])
        del self._buf[:length]
        part_number = len(self._parts) + 1
        result = self._s3.upload_part(
            Bucket=self._bucket,
            Key=self._key,
            UploadId=self._upload_id,
            PartNumber=part_number,
            Body=chunk,
        )
        self._parts.append({'PartNumber': part_number, 'ETag': result['ETag']})

    def finish(self) -> str:
        if self._buf or not self._parts:
            self._flush_part(len(self._buf))
        self._s3.complete_multipart_upload(
            Bucket=self._bucket,
            Key=self._key,
            UploadId=self._upload_id,
            MultipartUpload={'Parts': self._parts},
        )
        return self._digest.hexdigest()

    def abort(self) -> None:
        try:
            self._s3.abort_multipart_upload(
                Bucket=self._bucket, Key=self._key, UploadId=self._upload_id
            )
        except Exception:
            pass


def _copy_escape(value: Optional[str]) -> str:
    """Экранирование значения для текстового формата COPY."""
    if value is None:
        return '\\N'
    return (
        value.replace('\\', '\\\\')
        .replace('\n', '\\n')
        .replace('\r', '\\r')
        .replace('\t', '\\t')
    )


def _dump_table_data(conn, table: str, columns: List[Dict[str, Any]],
                     writer) -> int:
    """Выгрузка строк таблицы в текстовом формате COPY.

    Данные читаются обычным SELECT, а не командой COPY: на этой платформе
    COPY запрещён (отклоняется валидатором запросов). Формат файла при этом
    остаётся стандартным, восстановление идёт через COPY ... FROM stdin.

    Каждое поле приводится к тексту силами самой СУБД: так значения дат,
    массивов, JSON и двоичных данных получают ровно то представление,
    которое COPY ожидает на входе. Ручное преобразование в Python здесь
    легко исказило бы данные.
    """
    col_names = [c['column_name'] for c in columns]
    if not col_names:
        return 0

    quoted = ', '.join(f'"{c}"' for c in col_names)
    select_list = ', '.join(f'"{c}"::text' for c in col_names)

    writer(f'COPY "{table}" ({quoted}) FROM stdin;\n'.encode())

    # Читаем страницами через LIMIT/OFFSET.
    # Именованный (серверный) курсор здесь неприменим: платформа
    # пропускает только простые запросы, а DECLARE/FETCH отклоняются
    # с ошибкой «object not found».
    # ORDER BY по физическому адресу строки ctid: он есть у любой таблицы,
    # не требует первичного ключа и не заставляет базу сортировать данные.
    rows = 0
    offset = 0
    while True:
        cur = conn.cursor()
        try:
            cur.execute(
                sql.SQL('SELECT {} FROM {} ORDER BY ctid LIMIT %s OFFSET %s').format(
                    sql.SQL(select_list),
                    sql.Identifier(SCHEMA, table),
                ),
                (DATA_PAGE_SIZE, offset),
            )
            batch = cur.fetchall()
        finally:
            cur.close()

        if not batch:
            break

        chunk = [
            '\t'.join(_copy_escape(row[c]) for c in col_names)
            for row in batch
        ]
        writer(('\n'.join(chunk) + '\n').encode())
        rows += len(batch)

        if len(batch) < DATA_PAGE_SIZE:
            break
        offset += DATA_PAGE_SIZE

    writer(b'\\.\n')
    return rows


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

    # Файл читается и распаковывается ПОТОКОМ: он может весить сотни
    # мегабайт, а памяти у функции 256 МБ — целиком в неё он не поместится.
    digest = hashlib.sha256()
    stored_size = 0
    created = copies = terms = begins = commits = 0
    in_copy = False
    tail = ''
    text_len = 0
    remainder = ''

    def scan(chunk: str) -> None:
        """Разбор очередного куска текста по строкам."""
        nonlocal created, copies, terms, begins, commits, in_copy
        for line in chunk.split('\n'):
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

    try:
        body = s3.get_object(Bucket='files', Key=key)['Body']
        decompressor = zlib.decompressobj(16 + zlib.MAX_WBITS)
        while True:
            raw = body.read(1024 * 1024)
            if not raw:
                break
            digest.update(raw)
            stored_size += len(raw)
            piece = decompressor.decompress(raw).decode('utf-8', 'replace')
            if not piece:
                continue
            text_len += len(piece)
            data = remainder + piece
            # Последняя строка куска может быть оборвана — переносим её
            # в следующий проход, иначе счётчики собьются.
            head, sep, remainder = data.rpartition('\n')
            if sep:
                scan(head)
            tail = (tail + piece)[-64:]
        if remainder:
            scan(remainder)
            tail = (tail + remainder)[-64:]
        body.close()
    except Exception as exc:
        add('Файл читается из хранилища', False, str(exc))
        return checks

    add('Файл читается из хранилища', True, f'{stored_size} байт')

    same = digest.hexdigest() == sha256
    add('Контрольная сумма совпадает', same,
        'файл не повреждён при передаче' if same else 'файл повреждён')
    if not same:
        return checks

    add('Архив распаковывается', text_len > 0, f'{text_len} символов')

    complete = tail.rstrip().endswith('COMMIT;')
    add('Дамп завершён полностью', complete,
        'файл не оборван' if complete else 'файл оборван — данные неполные')

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

    started = datetime.now(timezone.utc)
    stats: List[Dict[str, Any]] = []
    total_rows = 0
    tables: List[str] = []
    snapshot_at = None

    stamp = started.strftime('%Y%m%d-%H%M%S')
    key = f'{DUMP_PREFIX}/dreamdesk-{mode}-{stamp}.sql.gz'

    s3 = _s3_client()
    # Пишем сразу в хранилище: сжатые данные уходят частями и не копятся
    # в памяти функции.
    stream = _S3StreamWriter(s3, 'files', key, 'application/gzip')
    gz = gzip.GzipFile(fileobj=stream, mode='wb', compresslevel=6)

    # ВАЖНО: отдельное соединение только для чтения.
    dump_conn = _connect_readonly()
    try:
        cur = dump_conn.cursor()
        try:
            # Открываем снимок первым же запросом в транзакции. В режиме
            # REPEATABLE READ момент фиксируется на первом обращении к данным,
            # и все запросы ниже видят базу одинаковой.
            # pg_export_signal здесь не используется: он нужен только чтобы
            # ПЕРЕДАТЬ снимок в другое соединение (параллельная выгрузка),
            # а мы читаем всё одним соединением. На консистентность его
            # отсутствие не влияет, к тому же платформа его запрещает.
            cur.execute('SELECT now() AS ts')
            snapshot_at = cur.fetchone()['ts']

            tables = _fetch_tables(cur, include_logs)

            # Метаданные всей схемы читаются заранее, тремя запросами.
            # Иначе на 99 таблиц пришлось бы ~300 медленных запросов.
            columns_map = _load_columns(cur)
            constraints_map = _load_constraints(cur)
            indexes_map = _load_indexes(cur)

            gz.write((
                '-- DreamDesk database backup\n'
                f'-- created_at: {started.isoformat()}\n'
                f'-- mode: {mode}\n'
                f'-- snapshot_at: {snapshot_at}\n'
                f'-- isolation: REPEATABLE READ (read-only)\n'
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
                gz.write(_dump_ddl(columns_map.get(table, []), table).encode())

                rows = 0
                if with_data:
                    rows = _dump_table_data(
                        dump_conn, table, columns_map.get(table, []), gz.write
                    )

                gz.write(_dump_constraints(
                    constraints_map.get(table, []),
                    indexes_map.get(table, []),
                    table,
                ).encode())
                stats.append({'table': table, 'rows': rows})
                total_rows += rows

            gz.write(b'\n-- ---------- sequence values ----------\n')
            gz.write(seq_setval.encode())
            gz.write(b'\nSET session_replication_role = DEFAULT;\nCOMMIT;\n')
        finally:
            cur.close()
    except Exception:
        # Незавершённая отправка иначе осталась бы висеть в хранилище
        # и занимать место.
        stream.abort()
        raise
    finally:
        # rollback, а не commit: транзакция была только на чтение.
        dump_conn.rollback()
        dump_conn.close()

    gz.close()
    sha256 = stream.finish()
    dump_size = stream.size

    checks = _verify_dump(s3, key, sha256, tables, with_data)
    ok = all(c['ok'] for c in checks)

    result = {
        'success': ok,
        'mode': mode,
        'created_at': started.isoformat(),
        'snapshot_at': str(snapshot_at),
        'tables': len(tables),
        'rows': total_rows,
        'size_bytes': dump_size,
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