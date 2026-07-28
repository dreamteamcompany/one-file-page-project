"""Диспетчер автоматизации: запускается по расписанию (cron каждую минуту),
проверяет, какие задачи пора запустить, и вызывает их."""
import json
import os
import psycopg2
import psycopg2.extras
import requests
from datetime import datetime, timedelta, timezone


DATABASE_URL = os.environ.get('DATABASE_URL')

SYNC_POSITIONS_URL = 'https://functions.poehali.dev/554d2115-1c37-4955-b544-bc0a5df0b466'
INACTIVE_USERS_URL = 'https://functions.poehali.dev/7bf1dc65-32dd-447a-a33e-8b1a7bed5b07'
REASSIGN_BY_SCHEDULE_URL = 'https://functions.poehali.dev/42295d4a-eb89-4bd6-b915-d94a2a734b16'

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

PRESET_INTERVALS = {
    'off': None,
    'every_5min': timedelta(minutes=5),
    'hourly': timedelta(hours=1),
    'every_6h': timedelta(hours=6),
    'every_12h': timedelta(hours=12),
    'daily': timedelta(days=1),
    'weekly': timedelta(days=7),
}


def resp(status_code, body):
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, ensure_ascii=False, default=str),
        'isBase64Encoded': False,
    }


def get_db():
    return psycopg2.connect(DATABASE_URL)


def sql_str(value):
    if value is None:
        return 'NULL'
    return "'" + str(value).replace("'", "''") + "'"


def sql_int(value):
    if value is None:
        return 'NULL'
    try:
        return str(int(value))
    except (ValueError, TypeError):
        return 'NULL'


def sql_jsonb(value):
    if value is None:
        return "'{}'::jsonb"
    return "'" + json.dumps(value, ensure_ascii=False).replace("'", "''") + "'::jsonb"


def calc_next_run_at(preset, base_dt):
    interval = PRESET_INTERVALS.get(preset)
    if interval is None:
        return None
    return base_dt + interval


def fetch_due_jobs():
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT job_key, schedule_preset, params, enabled "
            "FROM automation_jobs "
            "WHERE enabled = TRUE AND schedule_preset <> 'off' "
            "AND (next_run_at IS NULL OR next_run_at <= NOW())"
        )
        return cur.fetchall()
    finally:
        conn.close()


def create_run(job_key):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO automation_runs (job_key, trigger_type, status) "
            f"VALUES ({sql_str(job_key)}, 'auto', 'running') RETURNING id"
        )
        run_id = cur.fetchone()[0]
        conn.commit()
        return run_id
    finally:
        conn.close()


def finalize_run(run_id, status, message, result, duration_ms):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE automation_runs SET "
            f"status = {sql_str(status)}, "
            f"message = {sql_str(message)}, "
            f"result = {sql_jsonb(result)}, "
            f"duration_ms = {sql_int(duration_ms)}, "
            f"finished_at = NOW() "
            f"WHERE id = {sql_int(run_id)}"
        )
        conn.commit()
    finally:
        conn.close()


def update_job_after_run(job_key, status, message, started_at, finished_at, schedule_preset):
    next_run_at = calc_next_run_at(schedule_preset, finished_at)
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE automation_jobs SET "
            f"last_run_at = {sql_str(started_at.isoformat())}, "
            f"last_finished_at = {sql_str(finished_at.isoformat())}, "
            f"last_status = {sql_str(status)}, "
            f"last_message = {sql_str(message)}, "
            f"next_run_at = {sql_str(next_run_at.isoformat()) if next_run_at else 'NULL'} "
            f"WHERE job_key = {sql_str(job_key)}"
        )
        conn.commit()
    finally:
        conn.close()


def execute_job(job_key, params):
    if job_key == 'bitrix_sync_positions':
        company_id = params.get('company_id')
        if not company_id:
            return 'error', 'Не указан company_id в настройках задачи', {}
        try:
            r = requests.post(
                SYNC_POSITIONS_URL,
                json={'company_id': int(company_id)},
                headers={'Content-Type': 'application/json'},
                timeout=300,
            )
            try:
                data = r.json()
            except Exception:
                data = {'raw': r.text[:500]}
            if r.ok:
                stats = data.get('stats') or data
                msg_parts = []
                for k, v in (stats.items() if isinstance(stats, dict) else []):
                    if isinstance(v, (int, float)):
                        msg_parts.append(f"{k}={v}")
                return 'success', ', '.join(msg_parts) or 'Готово', data
            return 'error', data.get('error') or f'HTTP {r.status_code}', data
        except Exception as e:
            return 'error', str(e)[:500], {}

    if job_key == 'bitrix_inactive_users':
        return 'error', 'Авто-запуск проверки неактивных требует токена администратора. Запустите вручную.', {}

    if job_key == 'reassign_by_schedule':
        try:
            r = requests.post(
                REASSIGN_BY_SCHEDULE_URL,
                json={},
                headers={'Content-Type': 'application/json'},
                timeout=300,
            )
            try:
                data = r.json()
            except Exception:
                data = {'raw': r.text[:500]}
            if r.ok:
                reassigned = data.get('reassigned', 0)
                checked = data.get('checked', 0)
                return 'success', f'Проверено {checked}, передано {reassigned}', data
            return 'error', data.get('error') or f'HTTP {r.status_code}', data
        except Exception as e:
            return 'error', str(e)[:500], {}

    return 'error', f'Неизвестная задача: {job_key}', {}


def handler(event: dict, context) -> dict:
    """Диспетчер cron: проходит по включённым задачам с истёкшим next_run_at и запускает их.
    Вызывается планировщиком функций (раз в минуту)."""
    if isinstance(event, str):
        event = json.loads(event)

    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return resp(200, {})

    jobs = fetch_due_jobs()
    summary = []

    for job in jobs:
        job_key = job['job_key']
        params = job['params'] or {}
        schedule_preset = job['schedule_preset']

        run_id = create_run(job_key)
        started_at = datetime.now(timezone.utc)
        try:
            status, message, result = execute_job(job_key, params)
        except Exception as e:
            status, message, result = 'error', str(e)[:500], {}
        finished_at = datetime.now(timezone.utc)
        duration_ms = int((finished_at - started_at).total_seconds() * 1000)

        finalize_run(run_id, status, message, result, duration_ms)
        update_job_after_run(job_key, status, message, started_at, finished_at, schedule_preset)

        summary.append({
            'job_key': job_key,
            'run_id': run_id,
            'status': status,
            'message': message,
            'duration_ms': duration_ms,
        })

    return resp(200, {'ran': len(summary), 'results': summary})