"""Управление автоматизацией: задачи, расписание, запуск и история."""
import json
import os
import jwt
import psycopg2
import psycopg2.extras
import requests
from datetime import datetime, timedelta, timezone


JWT_SECRET = os.environ.get('JWT_SECRET')
DATABASE_URL = os.environ.get('DATABASE_URL')

SYNC_POSITIONS_URL = 'https://functions.poehali.dev/554d2115-1c37-4955-b544-bc0a5df0b466'
INACTIVE_USERS_URL = 'https://functions.poehali.dev/7bf1dc65-32dd-447a-a33e-8b1a7bed5b07'
REASSIGN_BY_SCHEDULE_URL = 'https://functions.poehali.dev/42295d4a-eb89-4bd6-b915-d94a2a734b16'

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, Authorization',
    'Access-Control-Max-Age': '86400',
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


def verify_token(event):
    headers = event.get('headers', {})
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
    if not token:
        return None
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def is_admin(payload):
    if not payload:
        return False
    roles = payload.get('roles') or []
    for r in roles:
        if isinstance(r, dict):
            if r.get('system_role') == 'admin' or r.get('name') == 'admin':
                return True
        elif r == 'admin':
            return True
    system_roles = payload.get('system_roles') or []
    if 'admin' in system_roles:
        return True

    user_id = payload.get('user_id') or payload.get('id')
    if not user_id:
        return False
    try:
        conn = get_db()
        try:
            cur = conn.cursor()
            cur.execute(
                f"SELECT 1 FROM user_roles ur "
                f"JOIN roles r ON r.id = ur.role_id "
                f"WHERE ur.user_id = {int(user_id)} "
                f"AND (r.system_role = 'admin' OR r.name = 'admin') LIMIT 1"
            )
            return cur.fetchone() is not None
        finally:
            conn.close()
    except BaseException:
        return False


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


def sql_bool(value):
    return 'TRUE' if value else 'FALSE'


def sql_jsonb(value):
    if value is None:
        return "'{}'::jsonb"
    return "'" + json.dumps(value, ensure_ascii=False).replace("'", "''") + "'::jsonb"


def calc_next_run_at(preset, base_dt=None):
    interval = PRESET_INTERVALS.get(preset)
    if interval is None:
        return None
    base = base_dt or datetime.now(timezone.utc)
    return base + interval


def fetch_jobs():
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT job_key, title, description, enabled, schedule_preset, params, "
            "last_run_at, last_finished_at, last_status, last_message, next_run_at, "
            "updated_by_name, updated_at "
            "FROM automation_jobs ORDER BY job_key ASC"
        )
        rows = cur.fetchall()
        out = []
        for r in rows:
            out.append({
                'job_key': r['job_key'],
                'title': r['title'],
                'description': r['description'] or '',
                'enabled': r['enabled'],
                'schedule_preset': r['schedule_preset'],
                'params': r['params'] or {},
                'last_run_at': r['last_run_at'].isoformat() if r['last_run_at'] else None,
                'last_finished_at': r['last_finished_at'].isoformat() if r['last_finished_at'] else None,
                'last_status': r['last_status'],
                'last_message': r['last_message'] or '',
                'next_run_at': r['next_run_at'].isoformat() if r['next_run_at'] else None,
                'updated_by_name': r['updated_by_name'] or '',
                'updated_at': r['updated_at'].isoformat() if r['updated_at'] else None,
            })
        return out
    finally:
        conn.close()


def fetch_job(job_key):
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            f"SELECT job_key, title, description, enabled, schedule_preset, params, "
            f"last_run_at, last_finished_at, last_status, last_message, next_run_at "
            f"FROM automation_jobs WHERE job_key = {sql_str(job_key)} LIMIT 1"
        )
        r = cur.fetchone()
        if not r:
            return None
        return dict(r)
    finally:
        conn.close()


def update_job(job_key, enabled, schedule_preset, params, updated_by_user_id, updated_by_name):
    next_run_at = calc_next_run_at(schedule_preset) if enabled else None
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE automation_jobs SET "
            f"enabled = {sql_bool(enabled)}, "
            f"schedule_preset = {sql_str(schedule_preset)}, "
            f"params = {sql_jsonb(params)}, "
            f"next_run_at = {sql_str(next_run_at.isoformat()) if next_run_at else 'NULL'}, "
            f"updated_by_user_id = {sql_int(updated_by_user_id)}, "
            f"updated_by_name = {sql_str(updated_by_name)}, "
            f"updated_at = NOW() "
            f"WHERE job_key = {sql_str(job_key)}"
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def fetch_runs(job_key, limit=20):
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        limit = max(1, min(int(limit), 100))
        cur.execute(
            f"SELECT id, job_key, trigger_type, started_by_name, started_at, finished_at, "
            f"duration_ms, status, message, result "
            f"FROM automation_runs WHERE job_key = {sql_str(job_key)} "
            f"ORDER BY started_at DESC LIMIT {limit}"
        )
        rows = cur.fetchall()
        return [
            {
                'id': r['id'],
                'job_key': r['job_key'],
                'trigger_type': r['trigger_type'],
                'started_by_name': r['started_by_name'] or '',
                'started_at': r['started_at'].isoformat() if r['started_at'] else None,
                'finished_at': r['finished_at'].isoformat() if r['finished_at'] else None,
                'duration_ms': r['duration_ms'],
                'status': r['status'],
                'message': r['message'] or '',
                'result': r['result'] or {},
            }
            for r in rows
        ]
    finally:
        conn.close()


def create_run(job_key, trigger_type, started_by_user_id, started_by_name):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO automation_runs (job_key, trigger_type, started_by_user_id, started_by_name, status) "
            f"VALUES ({sql_str(job_key)}, {sql_str(trigger_type)}, {sql_int(started_by_user_id)}, "
            f"{sql_str(started_by_name)}, 'running') RETURNING id"
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


def update_job_after_run(job_key, status, message, started_at, finished_at, schedule_preset, enabled):
    next_run_at = calc_next_run_at(schedule_preset, finished_at) if enabled else None
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


def execute_job(job_key, params, auth_token=None):
    """Выполняет целевую задачу. Возвращает (status, message, result)."""
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
            data = r.json() if r.headers.get('Content-Type', '').startswith('application/json') else {'raw': r.text[:500]}
            if r.ok and data.get('success', True):
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
        mode = params.get('mode') or 'long_inactive'
        days = int(params.get('days') or 30)
        try:
            headers = {'Content-Type': 'application/json'}
            if auth_token:
                headers['X-Auth-Token'] = auth_token
            r = requests.post(
                INACTIVE_USERS_URL,
                json={'mode': mode, 'days': days},
                headers=headers,
                timeout=300,
            )
            data = r.json() if r.headers.get('Content-Type', '').startswith('application/json') else {'raw': r.text[:500]}
            if r.ok:
                msg = (
                    f"Деактивировано: {data.get('deactivated', 0)}, "
                    f"всего: {data.get('total_requested', 0)}, "
                    f"исключений: {data.get('skipped_excluded', 0)}, "
                    f"ошибок: {len(data.get('errors', []))}"
                )
                return 'success', msg, data
            return 'error', data.get('error') or f'HTTP {r.status_code}', data
        except Exception as e:
            return 'error', str(e)[:500], {}

    if job_key == 'reassign_by_schedule':
        try:
            r = requests.post(
                REASSIGN_BY_SCHEDULE_URL,
                json={},
                headers={'Content-Type': 'application/json'},
                timeout=300,
            )
            data = r.json() if r.headers.get('Content-Type', '').startswith('application/json') else {'raw': r.text[:500]}
            if r.ok:
                checked = data.get('checked', 0)
                reassigned = data.get('reassigned', 0)
                return 'success', f'Проверено заявок: {checked}, передано: {reassigned}', data
            return 'error', data.get('error') or f'HTTP {r.status_code}', data
        except Exception as e:
            return 'error', str(e)[:500], {}

    return 'error', f'Неизвестная задача: {job_key}', {}


def handler(event: dict, context) -> dict:
    """API раздела «Автоматизация»: список задач, обновление настроек, ручной запуск и история."""
    if isinstance(event, str):
        event = json.loads(event)

    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return resp(200, {})

    payload = verify_token(event)
    if not payload:
        return resp(401, {'error': 'Требуется авторизация'})

    if not is_admin(payload):
        return resp(403, {'error': 'Доступ только для администратора'})

    qs = event.get('queryStringParameters') or {}
    action = qs.get('action')

    if method == 'GET' and action == 'runs':
        job_key = qs.get('job_key')
        if not job_key:
            return resp(400, {'error': 'job_key обязателен'})
        limit = qs.get('limit', '20')
        return resp(200, {'runs': fetch_runs(job_key, limit)})

    if method == 'GET':
        return resp(200, {'jobs': fetch_jobs()})

    if method == 'PUT':
        body = json.loads(event.get('body', '{}'))
        job_key = body.get('job_key')
        if not job_key:
            return resp(400, {'error': 'job_key обязателен'})
        job = fetch_job(job_key)
        if not job:
            return resp(404, {'error': 'Задача не найдена'})

        enabled = bool(body.get('enabled', False))
        preset = body.get('schedule_preset') or 'off'
        if preset not in PRESET_INTERVALS:
            return resp(400, {'error': 'Некорректный schedule_preset'})
        params = body.get('params') or {}
        if not isinstance(params, dict):
            return resp(400, {'error': 'params должен быть объектом'})

        updated_by_user_id = payload.get('user_id') or payload.get('id')
        updated_by_name = payload.get('full_name') or payload.get('username') or ''
        update_job(job_key, enabled, preset, params, updated_by_user_id, updated_by_name)
        return resp(200, {'job': fetch_job(job_key)})

    if method == 'POST':
        body = json.loads(event.get('body', '{}'))
        post_action = body.get('action')

        if post_action == 'trigger':
            job_key = body.get('job_key')
            if not job_key:
                return resp(400, {'error': 'job_key обязателен'})
            job = fetch_job(job_key)
            if not job:
                return resp(404, {'error': 'Задача не найдена'})

            started_by_user_id = payload.get('user_id') or payload.get('id')
            started_by_name = payload.get('full_name') or payload.get('username') or ''
            run_id = create_run(job_key, 'manual', started_by_user_id, started_by_name)

            started_at = datetime.now(timezone.utc)
            headers = event.get('headers', {})
            auth_token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
            status, message, result = execute_job(job_key, job['params'] or {}, auth_token=auth_token)
            finished_at = datetime.now(timezone.utc)
            duration_ms = int((finished_at - started_at).total_seconds() * 1000)

            finalize_run(run_id, status, message, result, duration_ms)
            update_job_after_run(
                job_key, status, message, started_at, finished_at,
                job['schedule_preset'], job['enabled'],
            )

            return resp(200, {
                'run_id': run_id,
                'status': status,
                'message': message,
                'duration_ms': duration_ms,
                'job': fetch_job(job_key),
            })

        return resp(400, {'error': 'Неизвестное действие'})

    return resp(405, {'error': 'Method not allowed'})