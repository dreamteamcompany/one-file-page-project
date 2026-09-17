"""Экспорт данных БД в CSV: одна таблица или вся база архивом.

Устройство повторяет резервную копию (db_backup_handler), потому что
ограничения те же:
- выгрузка идёт ФОНОВОЙ задачей, а страница опрашивает статус. Прокси
  перед функциями обрывает соединение раньше, чем успевает отработать
  выгрузка большой таблицы, поэтому «дождаться ответа» здесь не работает;
- чтение только через ОТДЕЛЬНОЕ соединение в режиме read-only на уровне
  СУБД: любая попытка записи отклоняется самим PostgreSQL;
- данные читаются в одной транзакции REPEATABLE READ, поэтому все таблицы
  в архиве соответствуют одному моменту времени;
- файл пишется в хранилище томами: у функции немного памяти, а в базе
  есть таблицы в сотни мегабайт, целиком в память они не поместятся;
- доступ только у роли admin, ссылка на скачивание временная.

Формат CSV: RFC 4180 — разделитель запятая, кодировка UTF-8 без BOM,
перевод строки CRLF. NULL выгружается пустым полем и в файле неотличим
от пустой строки: это ограничение самого формата CSV, а не недосмотр.
Кому нужна точная копия данных, подойдёт резервная копия базы.
"""
import csv
import io
import json
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from zipfile import ZipFile, ZIP_DEFLATED

import boto3
from botocore.config import Config as BotoConfig
import psycopg2
import requests
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_REPEATABLE_READ
from psycopg2.extras import RealDictCursor
from psycopg2.extensions import cursor as PlainCursor

from shared_utils import response, SCHEMA

DATABASE_URL = os.environ.get('DATABASE_URL')

# Выгрузка содержит персональные данные, поэтому ссылка живёт ограниченное время.
LINK_TTL_SECONDS = 3600

# Собственный публичный адрес этой же функции (backend/func2url.json,
# запись "api-general") — нужен, чтобы поставить выгрузку в фон.
SELF_URL = 'https://functions.poehali.dev/adff2697-72f0-4316-9424-1f79ff8ed3cc'
INTERNAL_SECRET = os.environ.get('INTERNAL_FUNCTION_SECRET')
SELF_CALL_READ_TIMEOUT = 6
STALE_PENDING_SECONDS = 15

EXPORT_PREFIX = 'csv-exports'

# Размер страницы чтения подбирается под «толщину» строки: у таблиц она
# очень разная, а память функции ограничена.
MAX_PAGE_ROWS = 20000
PAGE_TARGET_BYTES = 2 * 1024 * 1024
MIN_PAGE_ROWS = 100

# Размер тома в хранилище: крупнее — меньше файлов на скачивание,
# мельче — меньше памяти под текущий том.
VOLUME_SIZE = 8 * 1024 * 1024

# База ограничивает частоту запросов, при превышении отвечает
# «rate limit exceeded» — повторяем с нарастающей паузой.
DB_RETRY_DELAYS = (0.5, 1.5, 3.0, 6.0)

# Журнальные таблицы: для анализа данных обычно не нужны, но занимают
# заметную часть объёма. Режим all_no_logs позволяет их пропустить.
LOG_TABLES = {
    'ai_classification_logs',
    'ai_pending_reviews',
    'automation_runs',
    'notifications',
    'ticket_views',
    'ticket_comment_reads',
}

SCOPES = ('table', 'all', 'all_no_logs')


def _connect_readonly():
    """Отдельное соединение только для чтения с консистентным снимком."""
    conn = psycopg2.connect(
        DATABASE_URL,
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
    # signature_version='s3v4' обязателен: со схемой по умолчанию хранилище
    # отвечает Unauthorized на временную ссылку скачивания.
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        config=BotoConfig(signature_version='s3v4', s3={'addressing_style': 'path'}),
    )


def _sql_str(value: Optional[str]) -> str:
    if value is None:
        return 'NULL'
    return "'" + str(value).replace("'", "''") + "'"


def _fetch_tables(cur, include_logs: bool = True) -> Tuple[List[str], Dict[str, float]]:
    """Список таблиц схемы и оценка среднего размера строки.

    Оценка берётся из статистики самой базы, без чтения данных.
    """
    cur.execute(
        "SELECT c.relname, c.reltuples, pg_table_size(c.oid) AS bytes "
        "FROM pg_class c "
        "JOIN pg_namespace n ON n.oid = c.relnamespace "
        "WHERE n.nspname = %s AND c.relkind = 'r' "
        "ORDER BY c.relname",
        (SCHEMA,),
    )
    tables: List[str] = []
    avg_bytes: Dict[str, float] = {}
    for row in cur.fetchall():
        name = row['relname']
        tables.append(name)
        tuples = float(row['reltuples'] or 0)
        size = float(row['bytes'] or 0)
        avg_bytes[name] = (size / tuples) if tuples > 0 else 0.0
    if not include_logs:
        tables = [t for t in tables if t not in LOG_TABLES]
    return tables, avg_bytes


def _load_columns(cur) -> Dict[str, List[str]]:
    """Колонки ВСЕХ таблиц схемы за один запрос.

    Запросы к information_schema на этой платформе медленные, а таблиц
    около сотни — отдельный запрос на каждую упёрся бы в таймаут.
    """
    cur.execute(
        "SELECT table_name, column_name FROM information_schema.columns "
        "WHERE table_schema = %s ORDER BY table_name, ordinal_position",
        (SCHEMA,),
    )
    result: Dict[str, List[str]] = {}
    for row in cur.fetchall():
        result.setdefault(row['table_name'], []).append(row['column_name'])
    return result


def _execute_with_retry(conn, query, params=None, tuples: bool = False):
    """Запрос с повтором при ограничении частоты обращений.

    Откат транзакции здесь недопустим: снимок данных живёт ровно столько,
    сколько живёт транзакция, и откат незаметно нарушил бы требование
    «все таблицы на один момент времени».
    """
    last_error = None
    for attempt in range(len(DB_RETRY_DELAYS) + 1):
        cur = (conn.cursor(cursor_factory=PlainCursor) if tuples
               else conn.cursor())
        try:
            cur.execute(query, params)
            rows = cur.fetchall()
            cur.close()
            return rows
        except psycopg2.Error as exc:
            try:
                cur.close()
            except psycopg2.Error:
                pass
            message = str(exc).lower()
            if 'rate limit' not in message or attempt == len(DB_RETRY_DELAYS):
                raise
            last_error = exc
            time.sleep(DB_RETRY_DELAYS[attempt])
    raise last_error


class _VolumeWriter:
    """Файл пишется в хранилище томами по несколько мегабайт.

    Прямые пути закрыты: собрать файл в памяти нельзя (данных больше, чем
    памяти у функции), многочастная отправка хранилищем запрещена, а /tmp
    у облачной функции — та же оперативная память. Поэтому поток режется
    на тома, каждый уходит отдельной отправкой и освобождает память.
    Режется именно поток байтов, поэтому склейка томов по порядку даёт
    в точности исходный файл.

    Методы flush/tell нужны модулю zipfile: он проверяет, умеет ли
    приёмник перематываться (tell есть, seek нет — пишет в потоковом
    режиме) и вызывает flush при закрытии архива.
    """

    def __init__(self, s3, bucket: str, key_prefix: str):
        self._s3 = s3
        self._bucket = bucket
        self._prefix = key_prefix
        self._buf = bytearray()
        self.size = 0
        self.keys: List[str] = []

    def write(self, data: bytes) -> int:
        data = bytes(data)
        self.size += len(data)
        self._buf.extend(data)
        while len(self._buf) >= VOLUME_SIZE:
            self._flush(VOLUME_SIZE)
        return len(data)

    def flush(self) -> None:
        # Промежуточный сброс тут не нужен: том отправляется по мере
        # накопления, а хвост уходит в finish().
        pass

    def tell(self) -> int:
        return self.size

    def _flush(self, length: int) -> None:
        chunk = bytes(self._buf[:length])
        del self._buf[:length]
        key = f'{self._prefix}.part{len(self.keys) + 1:03d}'
        self._s3.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=chunk,
            ContentType='application/octet-stream',
        )
        self.keys.append(key)

    def finish(self) -> None:
        if self._buf or not self.keys:
            self._flush(len(self._buf))

    def abort(self) -> None:
        # Отправленные тома без остальных бесполезны — убираем, чтобы они
        # не занимали место и не выглядели готовой выгрузкой.
        for key in self.keys:
            try:
                self._s3.delete_object(Bucket=self._bucket, Key=key)
            except Exception:
                pass
        self.keys = []


def _page_rows(avg_row_bytes: float) -> int:
    rows = MAX_PAGE_ROWS
    if avg_row_bytes > 0:
        rows = int(PAGE_TARGET_BYTES / avg_row_bytes)
    return max(MIN_PAGE_ROWS, min(MAX_PAGE_ROWS, rows))


def _write_csv(conn, table: str, columns: List[str], sink,
               avg_row_bytes: float) -> int:
    """Выгрузка одной таблицы в CSV. sink — функция записи байтов.

    Каждое поле приводится к тексту силами самой СУБД: так даты, массивы,
    JSON и двоичные данные получают то же представление, что и в самой
    базе. Ручное преобразование в Python легко исказило бы значения.
    """
    if not columns:
        return 0

    select_list = ', '.join(f'"{c}"::text' for c in columns)

    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=',', quotechar='"',
                        lineterminator='\r\n', quoting=csv.QUOTE_MINIMAL)

    def emit() -> None:
        data = buf.getvalue()
        if data:
            sink(data.encode('utf-8'))
        buf.seek(0)
        buf.truncate(0)

    writer.writerow(columns)
    emit()

    # Читаем страницами через LIMIT/OFFSET: серверный курсор на этой
    # платформе недоступен (DECLARE/FETCH отклоняются).
    # ORDER BY по физическому адресу строки ctid: он есть у любой таблицы,
    # не требует первичного ключа и не заставляет базу сортировать данные.
    page = _page_rows(avg_row_bytes)
    rows = 0
    offset = 0
    while True:
        batch = _execute_with_retry(
            conn,
            sql.SQL('SELECT {} FROM {} ORDER BY ctid LIMIT %s OFFSET %s').format(
                sql.SQL(select_list),
                sql.Identifier(SCHEMA, table),
            ),
            (page, offset),
            tuples=True,
        )
        if not batch:
            break

        got = len(batch)
        rows += got

        # Отдаём порциями, освобождая память по ходу: собирать весь блок
        # целиком нельзя, памяти у функции немного.
        while batch:
            piece = batch[:500]
            del batch[:500]
            for row in piece:
                writer.writerow(['' if v is None else v for v in row])
            emit()
            del piece

        if got < page:
            break
        offset += page

    return rows


def _trigger_run(job_id: int) -> Optional[str]:
    """Пытается запустить фоновую выгрузку self-invoke вызовом.

    Возвращает None при успехе, иначе текст ошибки. Два захода: разовый
    сетевой сбой не должен навсегда хоронить задачу.
    """
    last_error: Optional[str] = None
    for _ in range(2):
        try:
            requests.post(
                SELF_URL,
                params={'resource': 'csv_export'},
                json={'action': 'run', 'job_id': job_id},
                headers={
                    'Content-Type': 'application/json',
                    'X-Internal-Secret': INTERNAL_SECRET,
                },
                # На установку соединения даём запас: «холодный старт»
                # функции занимает 1-1.5 сек, обрывать связь раньше нельзя —
                # запрос рискует не дойти до обработчика.
                timeout=(5, SELF_CALL_READ_TIMEOUT),
            )
            return None
        except requests.exceptions.ReadTimeout:
            # Ожидаемо: сервер принял запрос и уже работает, просто мы
            # не стали ждать окончания.
            return None
        except requests.exceptions.RequestException as exc:
            last_error = str(exc)[:500]
    return last_error


def _create_job(conn, user_id: int, scope: str, table: Optional[str]) -> int:
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO csv_export_jobs (scope, table_name, status, started_by_user_id) "
            f"VALUES ({_sql_str(scope)}, {_sql_str(table)}, 'pending', {int(user_id)}) "
            "RETURNING id"
        )
        job_id = cur.fetchone()['id']
        conn.commit()
        return job_id
    finally:
        cur.close()


def _get_job(conn, job_id: int) -> Optional[Dict[str, Any]]:
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT id, scope, table_name, status, started_by_user_id, created_at, "
            "finished_at, duration_sec, result, error "
            f"FROM csv_export_jobs WHERE id = {int(job_id)}"
        )
        return cur.fetchone()
    finally:
        cur.close()


def _mark_job(job_id: int, status: str,
              result: Optional[Dict[str, Any]] = None,
              error: Optional[str] = None,
              duration_sec: Optional[float] = None) -> None:
    """Отдельное короткоживущее соединение: вызывается из фонового прогона,
    у которого нет доступа к соединению исходного запроса."""
    own_conn = psycopg2.connect(
        DATABASE_URL,
        cursor_factory=RealDictCursor,
        options=f'-c search_path={SCHEMA},public',
    )
    try:
        cur = own_conn.cursor()
        result_sql = (
            "'" + json.dumps(result, ensure_ascii=False, default=str).replace("'", "''") + "'::jsonb"
            if result is not None else 'NULL'
        )
        is_final = status in ('success', 'error')
        # Без параметризации: текст ошибки СУБД нередко содержит "%", а
        # execute с параметрами прогоняет весь запрос через %-форматирование
        # и на таком тексте ломается. Экранирование — через _sql_str.
        cur.execute(
            "UPDATE csv_export_jobs SET "
            f"status = {_sql_str(status)}, "
            f"result = {result_sql}, "
            f"error = {_sql_str(error)}, "
            f"duration_sec = {duration_sec if duration_sec is not None else 'NULL'}, "
            f"finished_at = {'now()' if is_final else 'finished_at'} "
            f"WHERE id = {int(job_id)}"
        )
        own_conn.commit()
    finally:
        own_conn.close()


def _run_export_job(job_id: int, scope: str, table: Optional[str]) -> None:
    """Сама выгрузка. Выполняется отдельным вызовом с action=run, поэтому
    ничей таймаут ответа ей не мешает: отвечать по HTTP уже некому."""
    started = datetime.now(timezone.utc)
    stamp = started.strftime('%Y%m%d-%H%M%S')

    single = scope == 'table'
    if single:
        base_name = f'{table}-{stamp}.csv'
    else:
        suffix = 'all' if scope == 'all' else 'all-no-logs'
        base_name = f'dreamdesk-{suffix}-{stamp}.zip'
    key = f'{EXPORT_PREFIX}/{base_name}'

    _mark_job(job_id, 'running')

    s3 = _s3_client()
    stream = _VolumeWriter(s3, 'files', key)
    archive = None if single else ZipFile(stream, 'w', ZIP_DEFLATED, allowZip64=True)

    stats: List[Dict[str, Any]] = []
    total_rows = 0
    snapshot_at = None

    dump_conn = _connect_readonly()
    try:
        cur = dump_conn.cursor()
        try:
            # Первый запрос в транзакции открывает снимок: в режиме
            # REPEATABLE READ момент фиксируется здесь, и все запросы ниже
            # видят базу одинаковой.
            cur.execute('SELECT now() AS ts')
            snapshot_at = cur.fetchone()['ts']

            all_tables, avg_row_bytes = _fetch_tables(cur, include_logs=True)
            columns_map = _load_columns(cur)

            if single:
                if table not in all_tables:
                    raise ValueError(f'Таблица не найдена: {table}')
                targets = [table]
            elif scope == 'all_no_logs':
                targets = [t for t in all_tables if t not in LOG_TABLES]
            else:
                targets = all_tables

            for name in targets:
                columns = columns_map.get(name, [])
                if single:
                    rows = _write_csv(dump_conn, name, columns, stream.write,
                                      avg_row_bytes.get(name, 0.0))
                else:
                    # Поток отдельного файла внутри архива: zipfile сжимает
                    # его на лету и отдаёт байты тому же писателю томов.
                    with archive.open(f'{name}.csv', 'w') as entry:
                        rows = _write_csv(dump_conn, name, columns, entry.write,
                                          avg_row_bytes.get(name, 0.0))
                stats.append({'table': name, 'rows': rows})
                total_rows += rows
        finally:
            cur.close()
    except Exception as exc:
        # Незавершённая выгрузка иначе осталась бы висеть в хранилище.
        stream.abort()
        dump_conn.rollback()
        dump_conn.close()
        duration = round((datetime.now(timezone.utc) - started).total_seconds(), 1)
        _mark_job(job_id, 'error', error=str(exc)[:1000], duration_sec=duration)
        return
    else:
        # rollback, а не commit: транзакция была только на чтение.
        dump_conn.rollback()
        dump_conn.close()

    if archive is not None:
        archive.close()
    stream.finish()

    duration = round((datetime.now(timezone.utc) - started).total_seconds(), 1)

    parts = [
        {
            'filename': f'{base_name}.part{i + 1:03d}',
            'url': s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': 'files', 'Key': vkey},
                ExpiresIn=LINK_TTL_SECONDS,
            ),
        }
        for i, vkey in enumerate(stream.keys)
    ]

    result: Dict[str, Any] = {
        'success': True,
        'scope': scope,
        'table': table,
        'created_at': started.isoformat(),
        'snapshot_at': str(snapshot_at),
        'tables': len(stats),
        'rows': total_rows,
        'size_bytes': stream.size,
        'duration_sec': duration,
        'filename': base_name,
        'parts': parts,
        'expires_in_sec': LINK_TTL_SECONDS,
        'top_tables': sorted(stats, key=lambda x: -x['rows'])[:10],
    }
    # Один том — обычный файл, ссылка ведёт прямо на него.
    if len(parts) == 1:
        result['download_url'] = parts[0]['url']

    _mark_job(job_id, 'success', result=result, duration_sec=duration)


def handle_csv_export(method, event, conn, payload):
    """Экспорт данных в CSV: список таблиц, запуск выгрузки и опрос статуса.

    GET  ?action=tables            — список таблиц с числом строк
    GET  ?action=status&job_id=N   — статус задачи и ссылки на файлы
    POST {action:'create', scope, table} — поставить выгрузку в очередь
    POST {action:'run', job_id}    — внутренний вызов, только по секрету

    Выгрузка идёт фоном по той же причине, что и резервная копия: прокси
    перед функциями обрывает долгий ответ, поэтому задача создаётся мгновенно,
    а страница периодически спрашивает её статус.
    """
    if method == 'GET':
        params = event.get('queryStringParameters') or {}
        action = params.get('action') or 'status'

        user_id = payload.get('user_id')
        if not user_id:
            return response(401, {'error': 'User ID not found in token'})
        if not _is_admin(conn, int(user_id)):
            return response(403, {'error': 'Доступ только для администратора'})

        if action == 'tables':
            cur = conn.cursor()
            try:
                cur.execute(
                    "SELECT c.relname AS name, c.reltuples::bigint AS rows, "
                    "pg_table_size(c.oid) AS size_bytes "
                    "FROM pg_class c "
                    "JOIN pg_namespace n ON n.oid = c.relnamespace "
                    "WHERE n.nspname = %s AND c.relkind = 'r' "
                    "ORDER BY c.relname",
                    (SCHEMA,),
                )
                tables = [
                    {
                        'name': r['name'],
                        # reltuples — оценка планировщика, а не точный счёт:
                        # точный COUNT(*) по сотне таблиц не уложился бы
                        # в таймаут функции.
                        'rows': max(0, int(r['rows'] or 0)),
                        'size_bytes': int(r['size_bytes'] or 0),
                        'is_log': r['name'] in LOG_TABLES,
                    }
                    for r in cur.fetchall()
                ]
                return response(200, {'tables': tables})
            finally:
                cur.close()

        if action == 'status':
            job_id = params.get('job_id')
            if not job_id:
                return response(400, {'error': 'job_id is required'})
            job = _get_job(conn, int(job_id))
            if not job:
                return response(404, {'error': 'Задача не найдена'})

            # Самоисцеление: если самовызов при создании задачи не дошёл,
            # задача осталась бы в pending навсегда. При проверке статуса
            # даём ей ещё один шанс стартовать.
            if job['status'] == 'pending':
                age = (datetime.now(timezone.utc) - job['created_at']).total_seconds()
                if age > STALE_PENDING_SECONDS:
                    trigger_error = _trigger_run(job['id'])
                    if trigger_error:
                        _mark_job(job['id'], 'error',
                                  error=f'Не удалось запустить фоновую задачу: {trigger_error}'[:1000])
                    job = _get_job(conn, int(job_id))

            return response(200, {
                'job_id': job['id'],
                'scope': job['scope'],
                'table': job['table_name'],
                'status': job['status'],
                'created_at': job['created_at'],
                'finished_at': job['finished_at'],
                'duration_sec': job['duration_sec'],
                'result': job['result'],
                'error': job['error'],
            })

        return response(400, {'error': 'action: tables | status'})

    if method != 'POST':
        return response(405, {'error': 'Method not allowed'})

    try:
        body = json.loads(event.get('body') or '{}')
    except (ValueError, TypeError):
        body = {}

    action = body.get('action') or 'create'

    if action == 'run':
        # Внутренний вызов функции самой собой: токена пользователя здесь
        # нет и быть не должно, вместо него общий секрет.
        headers = event.get('headers') or {}
        secret = None
        for hk, hv in headers.items():
            if hk.lower() == 'x-internal-secret':
                secret = hv
                break
        if not INTERNAL_SECRET or secret != INTERNAL_SECRET:
            return response(403, {'error': 'Forbidden'})

        job_id = body.get('job_id')
        if not job_id:
            return response(400, {'error': 'job_id is required'})

        # Что именно выгружать, берём из самой задачи, а не из тела запроса:
        # так параметры нельзя подменить снаружи.
        job = _get_job(conn, int(job_id))
        if not job:
            return response(404, {'error': 'Задача не найдена'})
        if job['status'] not in ('pending', 'running'):
            return response(200, {'ok': True, 'skipped': job['status']})

        _run_export_job(int(job_id), job['scope'], job['table_name'])
        return response(200, {'ok': True})

    if action != 'create':
        return response(400, {'error': 'action: create'})

    user_id = payload.get('user_id')
    if not user_id:
        return response(401, {'error': 'User ID not found in token'})
    if not _is_admin(conn, int(user_id)):
        return response(403, {'error': 'Доступ только для администратора'})

    if not DATABASE_URL:
        return response(500, {'error': 'DATABASE_URL is not configured'})
    if not os.environ.get('AWS_ACCESS_KEY_ID'):
        return response(500, {'error': 'Хранилище файлов не настроено'})
    if not INTERNAL_SECRET:
        return response(500, {'error': 'INTERNAL_FUNCTION_SECRET is not configured'})

    scope = str(body.get('scope') or 'all').lower()
    if scope not in SCOPES:
        return response(400, {'error': 'scope: table | all | all_no_logs'})

    table = body.get('table')
    if scope == 'table':
        if not table:
            return response(400, {'error': 'Для выгрузки таблицы нужен параметр table'})
        # Имя таблицы сверяем со списком реальных таблиц схемы: в запрос
        # оно попадает как идентификатор, и доверять внешней строке нельзя.
        cur = conn.cursor()
        try:
            cur.execute(
                "SELECT 1 FROM pg_class c "
                "JOIN pg_namespace n ON n.oid = c.relnamespace "
                "WHERE n.nspname = %s AND c.relkind = 'r' AND c.relname = %s",
                (SCHEMA, table),
            )
            if not cur.fetchone():
                return response(400, {'error': f'Таблица не найдена: {table}'})
        finally:
            cur.close()
    else:
        table = None

    job_id = _create_job(conn, int(user_id), scope, table)

    trigger_error = _trigger_run(job_id)
    if trigger_error:
        _mark_job(job_id, 'error',
                  error=f'Не удалось запустить фоновую задачу: {trigger_error}'[:1000])
        return response(500, {'error': 'Не удалось запустить фоновую задачу'})

    return response(200, {'job_id': job_id, 'status': 'pending'})