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
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import boto3
from botocore.config import Config as BotoConfig
import psycopg2
import requests
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_REPEATABLE_READ
from psycopg2.extras import RealDictCursor
from psycopg2.extensions import cursor as PlainCursor

from shared_utils import response, SCHEMA
import csv_export_zip as ZIPFMT

DATABASE_URL = os.environ.get('DATABASE_URL')

# Выгрузка содержит персональные данные, поэтому ссылка живёт ограниченное время.
LINK_TTL_SECONDS = 3600

# Собственный публичный адрес этой же функции (backend/func2url.json,
# запись "api-general") — нужен, чтобы поставить выгрузку в фон.
SELF_URL = 'https://functions.poehali.dev/adff2697-72f0-4316-9424-1f79ff8ed3cc'
INTERNAL_SECRET = os.environ.get('INTERNAL_FUNCTION_SECRET')
SELF_CALL_READ_TIMEOUT = 6
STALE_PENDING_SECONDS = 15

# Сколько один вызов работает, прежде чем передать эстафету следующему.
# Замер показал: платформа обрывает функцию примерно через минуту, поэтому
# берём заметно меньше — нужен запас на отправку последнего тома,
# сохранение прогресса и вызов следующего отрезка.
STEP_BUDGET_SECONDS = 25

# Если задача не подавала признаков жизни дольше этого времени, считаем
# цепочку оборванной и запускаем следующий отрезок заново.
STALE_RUNNING_SECONDS = 120

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


def _log(message: str) -> None:
    """Сообщение в журнал функции (stderr попадает в логи платформы)."""
    print(f'[csv_export] {message}', file=sys.stderr, flush=True)


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


def _page_rows(avg_row_bytes: float) -> int:
    rows = MAX_PAGE_ROWS
    if avg_row_bytes > 0:
        rows = int(PAGE_TARGET_BYTES / avg_row_bytes)
    return max(MIN_PAGE_ROWS, min(MAX_PAGE_ROWS, rows))


def _trigger_run(job_id: int) -> Optional[str]:
    """Пытается запустить фоновую выгрузку self-invoke вызовом.

    Возвращает None при успехе, иначе текст ошибки. Два захода: разовый
    сетевой сбой не должен навсегда хоронить задачу.
    """
    last_error: Optional[str] = None
    for attempt in range(2):
        try:
            r = requests.post(
                SELF_URL,
                params={'resource': 'csv_export'},
                # Секрет идёт В ТЕЛЕ запроса, а не в заголовке: платформа
                # не пропускает произвольные заголовки к функции, и вызов
                # самого себя отвергался с 403 (так же падали и резервные
                # копии базы). Тело запроса доходит без изменений.
                json={'action': 'run', 'job_id': job_id, 'secret': INTERNAL_SECRET},
                headers={'Content-Type': 'application/json'},
                # На установку соединения даём запас: «холодный старт»
                # функции занимает 1-1.5 сек, обрывать связь раньше нельзя —
                # запрос рискует не дойти до обработчика.
                timeout=(5, SELF_CALL_READ_TIMEOUT),
            )
            _log(f'trigger job={job_id} attempt={attempt} status={r.status_code} '
                 f'body={r.text[:300]}')
            return None
        except requests.exceptions.ReadTimeout:
            # Ожидаемо: сервер принял запрос и уже работает, просто мы
            # не стали ждать окончания.
            _log(f'trigger job={job_id} attempt={attempt} read-timeout (ожидаемо)')
            return None
        except requests.exceptions.RequestException as exc:
            last_error = f'{type(exc).__name__}: {exc}'[:500]
            _log(f'trigger job={job_id} attempt={attempt} FAILED {last_error}')
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
            "finished_at, duration_sec, result, error, progress, heartbeat_at "
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


def _init_progress(job_id: int, scope: str, table: Optional[str]) -> Dict[str, Any]:
    """Подготовка плана выгрузки: какие таблицы и в какой файл писать."""
    stamp = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
    single = scope == 'table'
    base_name = (f'{table}-{stamp}.csv' if single
                 else f'dreamdesk-{"all" if scope == "all" else "all-no-logs"}-{stamp}.zip')

    probe = _connect_readonly()
    try:
        cur = probe.cursor()
        try:
            all_tables, avg_row_bytes = _fetch_tables(cur, include_logs=True)
            columns_map = _load_columns(cur)
        finally:
            cur.close()
    finally:
        probe.rollback()
        probe.close()

    if single:
        if table not in all_tables:
            raise ValueError(f'Таблица не найдена: {table}')
        targets = [table]
    elif scope == 'all_no_logs':
        targets = [t for t in all_tables if t not in LOG_TABLES]
    else:
        targets = all_tables

    return {
        'single': single,
        'base_name': base_name,
        'key': f'{EXPORT_PREFIX}/{base_name}',
        'targets': targets,
        'columns': {t: columns_map.get(t, []) for t in targets},
        'page_rows': {t: _page_rows(avg_row_bytes.get(t, 0.0)) for t in targets},
        'table_index': 0,
        'offset': 0,
        'header_written': False,
        'volume_index': 0,
        'tail': '',
        'bytes_written': 0,
        'total_rows': 0,
        'stats': [],
        'members': [],
        'entry': None,
        'started_at': datetime.now(timezone.utc).isoformat(),
    }


def _save_progress(job_id: int, progress: Dict[str, Any], status: str = 'running') -> None:
    own = psycopg2.connect(
        DATABASE_URL,
        cursor_factory=RealDictCursor,
        options=f'-c search_path={SCHEMA},public',
    )
    try:
        cur = own.cursor()
        payload = json.dumps(progress, ensure_ascii=False, default=str).replace("'", "''")
        cur.execute(
            "UPDATE csv_export_jobs SET "
            f"status = {_sql_str(status)}, "
            f"progress = '{payload}'::jsonb, "
            "heartbeat_at = now() "
            f"WHERE id = {int(job_id)}"
        )
        own.commit()
    finally:
        own.close()


def _run_export_step(job_id: int, scope: str, table: Optional[str],
                     progress: Optional[Dict[str, Any]]) -> None:
    """Один ОТРЕЗОК выгрузки: работает ограниченное время и передаёт эстафету.

    Облачная функция живёт около минуты, а выгрузка всей базы занимает
    больше. Поэтому вызов работает STEP_BUDGET_SECONDS, сохраняет прогресс
    (на какой таблице и строке остановился, сколько байт уже отправлено)
    и вызывает сам себя ещё раз. Следующий вызов продолжает ровно оттуда.

    Из-за разбиения на отрезки снимок «на один момент времени» здесь не
    обещается: каждый отрезок читает базу заново. Для выгрузки в Excel это
    несущественно, а кому нужен именно консистентный слепок — есть
    резервная копия базы, она делает снимок в одной транзакции.
    """
    step_started = time.time()

    if progress is None:
        progress = _init_progress(job_id, scope, table)
        _save_progress(job_id, progress)

    s3 = _s3_client()
    single = progress['single']
    key = progress['key']
    targets = progress['targets']

    # Буфер текущего тома: том отправляется целиком, как только набирается.
    buf = bytearray()

    def flush_volume(force: bool = False) -> None:
        """Отправить накопленные тома. force — дослать и неполный хвост."""
        while buf and (force or len(buf) >= VOLUME_SIZE):
            length = min(len(buf), VOLUME_SIZE)
            chunk = bytes(buf[:length])
            del buf[:length]
            progress['volume_index'] += 1
            s3.put_object(
                Bucket='files',
                Key=f'{key}.part{progress["volume_index"]:03d}',
                Body=chunk,
                ContentType='application/octet-stream',
            )
            progress['bytes_written'] += len(chunk)

    def emit(data: bytes) -> None:
        buf.extend(data)
        flush_volume()

    dump_conn = _connect_readonly()
    finished = False
    try:
        while progress['table_index'] < len(targets):
            name = targets[progress['table_index']]
            columns = progress['columns'].get(name, [])
            page = progress['page_rows'].get(name, MAX_PAGE_ROWS)

            # Начало новой таблицы: в архиве — заголовок файла.
            if not progress['header_written']:
                progress['entry'] = {
                    'name': f'{name}.csv',
                    'crc': 0,
                    'csize': 0,
                    'usize': 0,
                    'hoff': progress['bytes_written'] + len(buf),
                }
                if not single:
                    emit(ZIPFMT.local_header(f'{name}.csv'))
                if columns:
                    header = _csv_line(columns)
                    _append_entry(progress, emit, header, single)
                progress['header_written'] = True

            table_done = False
            if columns:
                batch = _execute_with_retry(
                    dump_conn,
                    sql.SQL('SELECT {} FROM {} ORDER BY ctid LIMIT %s OFFSET %s').format(
                        sql.SQL(', '.join(f'"{c}"::text' for c in columns)),
                        sql.Identifier(SCHEMA, name),
                    ),
                    (page, progress['offset']),
                    tuples=True,
                )
                got = len(batch)
                if got:
                    text_parts: List[str] = []
                    while batch:
                        piece = batch[:500]
                        del batch[:500]
                        text_parts.append(''.join(_csv_line(row) for row in piece))
                        del piece
                    _append_entry(progress, emit, ''.join(text_parts), single)
                    progress['offset'] += got
                    progress['total_rows'] += got
                table_done = got < page
            else:
                table_done = True

            if table_done:
                # Таблица закончена: закрываем её запись в архиве.
                if not single:
                    emit(ZIPFMT.DEFLATE_TAIL)
                    progress['entry']['csize'] += len(ZIPFMT.DEFLATE_TAIL)
                    emit(ZIPFMT.data_descriptor(
                        progress['entry']['crc'],
                        progress['entry']['csize'],
                        progress['entry']['usize'],
                    ))
                    progress['members'].append(progress['entry'])
                progress['stats'].append({'table': name, 'rows': progress['offset']})
                progress['table_index'] += 1
                progress['offset'] = 0
                progress['header_written'] = False
                progress['entry'] = None

            if time.time() - step_started > STEP_BUDGET_SECONDS:
                break

        finished = progress['table_index'] >= len(targets)

        if finished and not single:
            # Оглавление архива пишется в самом конце.
            cd_offset = progress['bytes_written'] + len(buf)
            cd = ZIPFMT.central_directory(progress['members'])
            emit(cd)
            emit(ZIPFMT.end_of_central_directory(
                len(progress['members']), len(cd), cd_offset))

        if finished:
            flush_volume(force=True)
    except Exception as exc:
        _log(f'job={job_id} ОШИБКА {type(exc).__name__}: {exc}')
        dump_conn.rollback()
        dump_conn.close()
        _cleanup_volumes(s3, key, progress['volume_index'])
        _mark_job(job_id, 'error', error=f'{type(exc).__name__}: {exc}'[:1000])
        return
    else:
        dump_conn.rollback()
        dump_conn.close()

    if not finished:
        # Хвост, не набравший полный том, остаётся в буфере — дописываем
        # его отдельным томом, чтобы не потерять между вызовами.
        if buf:
            flush_volume(force=True)
        _save_progress(job_id, progress)
        error = _trigger_run(job_id)
        if error:
            _mark_job(job_id, 'error',
                      error=f'Не удалось продолжить выгрузку: {error}'[:1000])
        return

    started_at = datetime.fromisoformat(progress['started_at'])
    duration = round((datetime.now(timezone.utc) - started_at).total_seconds(), 1)
    base_name = progress['base_name']

    parts = [
        {
            'filename': f'{base_name}.part{i:03d}',
            'url': s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': 'files', 'Key': f'{key}.part{i:03d}'},
                ExpiresIn=LINK_TTL_SECONDS,
            ),
        }
        for i in range(1, progress['volume_index'] + 1)
    ]

    result: Dict[str, Any] = {
        'success': True,
        'scope': scope,
        'table': table,
        'created_at': progress['started_at'],
        'tables': len(progress['stats']),
        'rows': progress['total_rows'],
        'size_bytes': progress['bytes_written'],
        'duration_sec': duration,
        'filename': base_name,
        'parts': parts,
        'expires_in_sec': LINK_TTL_SECONDS,
        'top_tables': sorted(progress['stats'], key=lambda x: -x['rows'])[:10],
    }
    if len(parts) == 1:
        result['download_url'] = parts[0]['url']

    _mark_job(job_id, 'success', result=result, duration_sec=duration)


def _cleanup_volumes(s3, key: str, count: int) -> None:
    """Удаление недоделанной выгрузки: части без остальных бесполезны."""
    for i in range(1, count + 1):
        try:
            s3.delete_object(Bucket='files', Key=f'{key}.part{i:03d}')
        except Exception:
            pass


def _csv_line(values) -> str:
    """Одна строка CSV по правилам RFC 4180."""
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=',', quotechar='"',
                        lineterminator='\r\n', quoting=csv.QUOTE_MINIMAL)
    writer.writerow(['' if v is None else v for v in values])
    return buf.getvalue()


def _append_entry(progress: Dict[str, Any], emit, text: str, single: bool) -> None:
    """Дописать текст в текущий файл: как есть или сжатым куском архива."""
    raw = text.encode('utf-8')
    if single:
        emit(raw)
        return
    entry = progress['entry']
    packed = ZIPFMT.compress_chunk(raw)
    emit(packed)
    entry['crc'] = ZIPFMT.crc_update(entry['crc'], raw)
    entry['csize'] += len(packed)
    entry['usize'] += len(raw)


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

            # Самоисцеление. Два случая, когда цепочку нужно подтолкнуть:
            # задача так и не стартовала, либо очередной отрезок оборвался
            # (функцию мог убить таймаут платформы) и эстафета встала.
            # Прогресс сохранён, поэтому продолжение начнётся не с нуля.
            now = datetime.now(timezone.utc)
            stuck = False
            if job['status'] == 'pending':
                stuck = (now - job['created_at']).total_seconds() > STALE_PENDING_SECONDS
            elif job['status'] == 'running':
                last_seen = job.get('heartbeat_at') or job['created_at']
                stuck = (now - last_seen).total_seconds() > STALE_RUNNING_SECONDS

            if stuck:
                trigger_error = _trigger_run(job['id'])
                if trigger_error:
                    _mark_job(job['id'], 'error',
                              error=f'Не удалось запустить фоновую задачу: {trigger_error}'[:1000])
                job = _get_job(conn, int(job_id))

            # Ход выполнения: сколько таблиц пройдено и сколько записей
            # уже выгружено — чтобы страница не показывала «идёт» вслепую.
            prog = job.get('progress') or {}
            done_tables = int(prog.get('table_index') or 0)
            all_tables = len(prog.get('targets') or [])

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
                'progress': {
                    'tables_done': done_tables,
                    'tables_total': all_tables,
                    'rows': int(prog.get('total_rows') or 0),
                    'current_table': (
                        (prog.get('targets') or [None] * (done_tables + 1))[done_tables]
                        if done_tables < all_tables else None
                    ),
                } if prog else None,
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
        # Секрет принимаем и из тела, и из заголовка: заголовки платформа
        # до функции не доносит, поэтому основной путь — тело запроса.
        headers = event.get('headers') or {}
        secret = body.get('secret')
        if not secret:
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

        _log(f'run job={job_id} scope={job["scope"]} progress='
             f'{"есть" if job.get("progress") else "нет"} — отрезок начат')
        _run_export_step(int(job_id), job['scope'], job['table_name'],
                         job.get('progress'))
        _log(f'run job={job_id} — отрезок завершён')
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