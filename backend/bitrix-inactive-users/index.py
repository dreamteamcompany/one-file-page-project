"""Получение списка, деактивация пользователей Bitrix24 и управление исключениями"""
import json
import os
import jwt
import requests
import psycopg2
import urllib3
from datetime import datetime, timedelta, timezone

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

JWT_SECRET = os.environ.get('JWT_SECRET')
BITRIX_WEBHOOK_URL = os.environ.get('BITRIX24_WEBHOOK_URL', '').rstrip('/')
DATABASE_URL = os.environ.get('DATABASE_URL')
ISPMGR_URL = os.environ.get('ISPMGR_URL', '').rstrip('/')
ISPMGR_LOGIN = os.environ.get('ISPMGR_LOGIN', '')
ISPMGR_PASSWORD = os.environ.get('ISPMGR_PASSWORD', '')

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, Authorization, X-Endpoint',
    'Access-Control-Max-Age': '86400',
}


def resp(status_code, body):
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, ensure_ascii=False, default=str),
        'isBase64Encoded': False,
    }


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


def get_db():
    return psycopg2.connect(DATABASE_URL)


def fetch_exceptions():
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, bitrix_user_id, full_name, email, position, reason, "
            "added_by_user_id, added_by_name, added_at "
            "FROM bitrix_block_exceptions ORDER BY added_at DESC"
        )
        rows = cur.fetchall()
        return [
            {
                'id': r[0],
                'bitrix_user_id': r[1],
                'full_name': r[2],
                'email': r[3] or '',
                'position': r[4] or '',
                'reason': r[5] or '',
                'added_by_user_id': r[6],
                'added_by_name': r[7] or '',
                'added_at': r[8].isoformat() if r[8] else None,
            }
            for r in rows
        ]
    finally:
        conn.close()


def fetch_exception_ids():
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT bitrix_user_id FROM bitrix_block_exceptions")
        return {r[0] for r in cur.fetchall()}
    finally:
        conn.close()


def add_exception(bitrix_user_id, full_name, email, position, reason, added_by_user_id, added_by_name):
    conn = get_db()
    try:
        cur = conn.cursor()
        safe_id = str(bitrix_user_id).replace("'", "''")
        safe_name = (full_name or '').replace("'", "''")
        safe_email = (email or '').replace("'", "''")
        safe_position = (position or '').replace("'", "''")
        safe_reason = (reason or '').replace("'", "''")
        safe_added_by_name = (added_by_name or '').replace("'", "''")
        added_by_sql = "NULL" if added_by_user_id is None else str(int(added_by_user_id))
        cur.execute(
            f"INSERT INTO bitrix_block_exceptions "
            f"(bitrix_user_id, full_name, email, position, reason, added_by_user_id, added_by_name) "
            f"VALUES ('{safe_id}', '{safe_name}', '{safe_email}', '{safe_position}', "
            f"'{safe_reason}', {added_by_sql}, '{safe_added_by_name}') "
            f"ON CONFLICT (bitrix_user_id) DO UPDATE SET "
            f"full_name = EXCLUDED.full_name, email = EXCLUDED.email, "
            f"position = EXCLUDED.position, reason = EXCLUDED.reason"
        )
        conn.commit()
    finally:
        conn.close()


def remove_exception(bitrix_user_id):
    conn = get_db()
    try:
        cur = conn.cursor()
        safe_id = str(bitrix_user_id).replace("'", "''")
        cur.execute(f"DELETE FROM bitrix_block_exceptions WHERE bitrix_user_id = '{safe_id}'")
        conn.commit()
    finally:
        conn.close()


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


def sql_ts(value):
    if not value:
        return 'NULL'
    safe = str(value).replace("'", "''")
    return f"'{safe}'"


def create_report(started_by_user_id, started_by_name, mode, days_threshold):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO bitrix_block_reports "
            f"(started_by_user_id, started_by_name, mode, days_threshold, "
            f"total_requested, deactivated_count, errors_count, skipped_count) "
            f"VALUES ({sql_int(started_by_user_id)}, {sql_str(started_by_name)}, "
            f"{sql_str(mode)}, {sql_int(days_threshold)}, 0, 0, 0, 0) RETURNING id"
        )
        report_id = cur.fetchone()[0]
        conn.commit()
        return report_id
    finally:
        conn.close()


def save_report_item(report_id, item):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO bitrix_block_report_items "
            f"(report_id, bitrix_user_id, full_name, email, position, "
            f"last_login, days_inactive, status, error_text, "
            f"email_status, email_message) "
            f"VALUES ({sql_int(report_id)}, {sql_str(item.get('id'))}, "
            f"{sql_str(item.get('name'))}, {sql_str(item.get('email'))}, "
            f"{sql_str(item.get('position'))}, {sql_ts(item.get('last_login'))}, "
            f"{sql_int(item.get('days_inactive'))}, {sql_str(item.get('status'))}, "
            f"{sql_str(item.get('error_text'))}, "
            f"{sql_str(item.get('email_status'))}, {sql_str(item.get('email_message'))})"
        )
        conn.commit()
    finally:
        conn.close()


def update_report_counters(report_id, total_requested, deactivated, errors, skipped):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE bitrix_block_reports SET "
            f"total_requested = {sql_int(total_requested)}, "
            f"deactivated_count = {sql_int(deactivated)}, "
            f"errors_count = {sql_int(errors)}, "
            f"skipped_count = {sql_int(skipped)} "
            f"WHERE id = {sql_int(report_id)}"
        )
        conn.commit()
    finally:
        conn.close()


def fetch_reports():
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, started_by_user_id, started_by_name, started_at, mode, "
            "days_threshold, total_requested, deactivated_count, errors_count, skipped_count "
            "FROM bitrix_block_reports ORDER BY started_at DESC LIMIT 200"
        )
        rows = cur.fetchall()
        return [
            {
                'id': r[0],
                'started_by_user_id': r[1],
                'started_by_name': r[2] or '',
                'started_at': r[3].isoformat() if r[3] else None,
                'mode': r[4],
                'days_threshold': r[5],
                'total_requested': r[6],
                'deactivated_count': r[7],
                'errors_count': r[8],
                'skipped_count': r[9],
            }
            for r in rows
        ]
    finally:
        conn.close()


def fetch_report_with_items(report_id):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, started_by_user_id, started_by_name, started_at, mode, "
            f"days_threshold, total_requested, deactivated_count, errors_count, skipped_count "
            f"FROM bitrix_block_reports WHERE id = {sql_int(report_id)}"
        )
        r = cur.fetchone()
        if not r:
            return None
        report = {
            'id': r[0],
            'started_by_user_id': r[1],
            'started_by_name': r[2] or '',
            'started_at': r[3].isoformat() if r[3] else None,
            'mode': r[4],
            'days_threshold': r[5],
            'total_requested': r[6],
            'deactivated_count': r[7],
            'errors_count': r[8],
            'skipped_count': r[9],
        }
        cur.execute(
            f"SELECT bitrix_user_id, full_name, email, position, last_login, "
            f"days_inactive, status, error_text, email_status, email_message "
            f"FROM bitrix_block_report_items WHERE report_id = {sql_int(report_id)} "
            f"ORDER BY id ASC"
        )
        items = []
        for row in cur.fetchall():
            items.append({
                'bitrix_user_id': row[0],
                'full_name': row[1] or '',
                'email': row[2] or '',
                'position': row[3] or '',
                'last_login': row[4].isoformat() if row[4] else None,
                'days_inactive': row[5],
                'status': row[6],
                'error_text': row[7] or '',
                'email_status': row[8] or '',
                'email_message': row[9] or '',
            })
        report['items'] = items
        return report
    finally:
        conn.close()


def fetch_all_users():
    if not BITRIX_WEBHOOK_URL:
        raise ValueError('BITRIX24_WEBHOOK_URL не настроен')

    all_users = []
    start = 0

    while True:
        r = requests.post(
            f"{BITRIX_WEBHOOK_URL}/user.get",
            json={'ACTIVE': True, 'start': start},
            headers={'Content-Type': 'application/json'},
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()

        users = data.get('result', [])
        if not users:
            break

        all_users.extend(users)

        next_offset = data.get('next')
        if not next_offset:
            break
        start = next_offset

    return all_users


def search_bitrix_users(query):
    if not BITRIX_WEBHOOK_URL:
        raise ValueError('BITRIX24_WEBHOOK_URL не настроен')
    q = (query or '').strip()
    if not q:
        return []

    parts = [p for p in q.split() if p]
    found = {}

    def add_users(users):
        for u in users:
            uid = u.get('ID')
            if uid and uid not in found:
                found[uid] = u

    def fetch(filter_payload):
        try:
            r = requests.post(
                f"{BITRIX_WEBHOOK_URL}/user.get",
                json={'FILTER': filter_payload, 'ACTIVE': True},
                headers={'Content-Type': 'application/json'},
                timeout=15,
            )
            if r.ok:
                return r.json().get('result', []) or []
        except BaseException:
            pass
        return []

    if len(parts) >= 2:
        add_users(fetch({'%LAST_NAME': parts[0], '%NAME': parts[1]}))
        add_users(fetch({'%LAST_NAME': parts[1], '%NAME': parts[0]}))

    add_users(fetch({'%LAST_NAME': q}))
    add_users(fetch({'%NAME': q}))
    add_users(fetch({'%SECOND_NAME': q}))
    add_users(fetch({'%EMAIL': q}))
    add_users(fetch({'%WORK_POSITION': q}))

    if not found:
        try:
            r = requests.post(
                f"{BITRIX_WEBHOOK_URL}/user.search",
                json={'FIND': q},
                headers={'Content-Type': 'application/json'},
                timeout=15,
            )
            if r.ok:
                add_users(r.json().get('result', []) or [])
        except BaseException:
            pass

    out = []
    for u in list(found.values())[:50]:
        name = f"{u.get('NAME', '')} {u.get('LAST_NAME', '')}".strip()
        out.append({
            'id': u.get('ID'),
            'name': name,
            'email': u.get('EMAIL', ''),
            'position': u.get('WORK_POSITION', ''),
        })
    return out


AUTO_FIRED_FIELD = 'UF_USR_1778669634988'


def _isp_log(stage, **kwargs):
    try:
        safe = {k: (str(v)[:500] if isinstance(v, (str, bytes)) else v) for k, v in kwargs.items()}
        print(f"[ISPMGR][{stage}] {json.dumps(safe, ensure_ascii=False, default=str)[:1500]}")
    except BaseException:
        print(f"[ISPMGR][{stage}] (log fail) {kwargs}")


def _isp_base():
    return f"{ISPMGR_URL}/manager/ispmgr" if '/manager/ispmgr' not in ISPMGR_URL else ISPMGR_URL


def _isp_call(params):
    """Универсальный вызов ISPmanager 5/Lite. Возвращает (status, parsed_or_text)."""
    full = dict(params)
    full['authinfo'] = f'{ISPMGR_LOGIN}:{ISPMGR_PASSWORD}'
    full.setdefault('out', 'json')
    url = _isp_base()
    r = requests.get(url, params=full, timeout=20, verify=False)
    _isp_log('call', func=params.get('func'), url=url, status=r.status_code, body=r.text[:800])
    if not r.ok:
        return r.status_code, r.text[:500]
    try:
        return 200, r.json()
    except BaseException:
        return 200, r.text[:800]


def _isp_get_mailbox(email):
    """Получает карточку ящика — для проверки текущего состояния enable."""
    status, data = _isp_call({'func': 'mail.edit', 'elid': email})
    if status != 200 or not isinstance(data, dict):
        return None, f'cannot fetch: {status} {str(data)[:200]}'
    if 'error' in data:
        return None, f"error: {str(data['error'])[:300]}"

    enable_val = None
    # ISPmanager Lite: данные обычно в data['doc'] либо корневые поля
    candidates = [data, data.get('doc') or {}]
    for c in candidates:
        if not isinstance(c, dict):
            continue
        for key in ('enable', 'enabled', 'disabled'):
            v = c.get(key)
            if isinstance(v, dict):
                v = v.get('$') or v.get('value') or v.get('_value')
            if v is not None:
                enable_val = (key, v)
                break
        if enable_val:
            break

    return enable_val, str(data)[:500]


def _is_disabled_value(key, val):
    s = str(val).strip().lower()
    if key in ('enable', 'enabled'):
        return s in ('off', '0', 'false', 'no')
    if key == 'disabled':
        return s in ('on', '1', 'true', 'yes')
    return False


def disable_email(email):
    """Блокирует корпоративный почтовый ящик через ISPmanager Lite/5.
    Делает: 1) проверка текущего состояния 2) попытка отключить 3) ре-проверка.
    Возвращает (success, message)."""
    if not email or '@' not in email:
        return False, 'Email пустой или некорректный'
    if not ISPMGR_URL or not ISPMGR_LOGIN or not ISPMGR_PASSWORD:
        return False, 'ISPmanager не настроен'

    # 1. Проверим, что ящик существует и узнаем состояние
    before, raw_before = _isp_get_mailbox(email)
    _isp_log('before', email=email, state=before, raw=raw_before)
    if before is None:
        return False, f'Ящик не найден или нет доступа: {raw_before[:200]}'

    key_before, val_before = before
    if _is_disabled_value(key_before, val_before):
        return True, f'Уже отключён ({key_before}={val_before})'

    # 2. Пробуем разные варианты отключения, которые поддерживают разные сборки ISPmanager
    attempts = [
        {'func': 'mail.edit', 'elid': email, 'enable': 'off', 'sok': 'ok'},
        {'func': 'mail.edit', 'elid': email, 'enable': 'off', 'sok': 'yes'},
        {'func': 'mail.suspend', 'elid': email, 'sok': 'ok'},
        {'func': 'mail.suspend', 'elid': email},
        {'func': 'mail.disable', 'elid': email, 'sok': 'ok'},
    ]
    last_err = ''
    for params in attempts:
        try:
            status, data = _isp_call(params)
            if isinstance(data, dict) and 'error' in data:
                err = data['error']
                msg = err.get('msg', {}).get('$') if isinstance(err.get('msg'), dict) else err
                last_err = f"{params['func']}: {str(msg)[:200]}"
                continue
            # 3. Проверка-верификация
            after, raw_after = _isp_get_mailbox(email)
            _isp_log('after', email=email, state=after, raw=raw_after, attempt=params)
            if after and _is_disabled_value(*after):
                return True, f"Отключено (func={params['func']}, проверено: {after[0]}={after[1]})"
            last_err = f"{params['func']}: ответ ok, но ящик всё ещё активен ({after})"
        except BaseException as e:
            last_err = f"{params['func']}: exception {e}"
            continue

    return False, f'Не удалось отключить. Последняя ошибка: {last_err}'


def deactivate_user(user_id, email=None):
    r = requests.post(
        f"{BITRIX_WEBHOOK_URL}/user.update",
        json={
            'ID': user_id,
            'ACTIVE': False,
            AUTO_FIRED_FIELD: 1,
        },
        headers={'Content-Type': 'application/json'},
        timeout=15,
    )
    r.raise_for_status()
    result = r.json()

    email_status = None
    if email:
        ok, msg = disable_email(email)
        email_status = {'success': ok, 'message': msg}

    return {'bitrix': result, 'email': email_status}


def classify_users(users, days, exception_ids):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    inactive = []

    for u in users:
        last_login = u.get('LAST_LOGIN') or u.get('LAST_ACTIVITY_DATE')
        name = f"{u.get('NAME', '')} {u.get('LAST_NAME', '')}".strip()
        uid = str(u.get('ID'))
        user_info = {
            'id': uid,
            'name': name,
            'email': u.get('EMAIL', ''),
            'department': u.get('UF_DEPARTMENT', []),
            'position': u.get('WORK_POSITION', ''),
            'last_login': last_login,
            'days_inactive': None,
            'is_excluded': uid in exception_ids,
        }

        if not last_login:
            inactive.append(user_info)
            continue

        try:
            clean = last_login.replace('T', ' ').split('+')[0].split('.')[0]
            login_dt = datetime.strptime(clean, '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
        except (ValueError, AttributeError):
            inactive.append(user_info)
            continue

        if login_dt < cutoff:
            user_info['days_inactive'] = (datetime.now(timezone.utc) - login_dt).days
            inactive.append(user_info)

    inactive.sort(key=lambda x: (x['days_inactive'] is None, -(x['days_inactive'] or 0)))
    return inactive


def handler(event, context):
    """Список, исключения и массовая деактивация пользователей Битрикс24"""
    if event.get('httpMethod') == 'OPTIONS':
        return resp(200, {})

    payload = verify_token(event)
    if not payload:
        return resp(401, {'error': 'Требуется авторизация'})

    method = event.get('httpMethod', 'GET')
    qs = event.get('queryStringParameters') or {}
    action = qs.get('action')

    if method == 'GET' and action == 'exceptions':
        return resp(200, {'exceptions': fetch_exceptions()})

    if method == 'GET' and action == 'search_bitrix':
        if not is_admin(payload):
            return resp(403, {'error': 'Доступ только для администратора'})
        query = qs.get('q', '')
        try:
            users = search_bitrix_users(query)
            existing = fetch_exception_ids()
            for u in users:
                u['already_excluded'] = str(u['id']) in existing
            return resp(200, {'users': users})
        except BaseException as e:
            return resp(500, {'error': str(e)})

    if method == 'GET' and action == 'reports':
        return resp(200, {'reports': fetch_reports()})

    if method == 'GET' and action == 'report':
        report_id = qs.get('id')
        if not report_id:
            return resp(400, {'error': 'id обязателен'})
        try:
            rid = int(report_id)
        except (ValueError, TypeError):
            return resp(400, {'error': 'id некорректен'})
        report = fetch_report_with_items(rid)
        if not report:
            return resp(404, {'error': 'Отчёт не найден'})
        return resp(200, {'report': report})

    if method == 'GET':
        days = int(qs.get('days', '30'))
        users = fetch_all_users()
        exception_ids = fetch_exception_ids()
        inactive = classify_users(users, days, exception_ids)

        return resp(200, {
            'total_active_users': len(users),
            'inactive_count': len(inactive),
            'days_threshold': days,
            'users': inactive,
            'exceptions_count': len(exception_ids),
        })

    if method == 'POST':
        body = json.loads(event.get('body', '{}'))
        post_action = body.get('action')

        if post_action == 'add_exception':
            if not is_admin(payload):
                return resp(403, {'error': 'Доступ только для администратора'})
            bx_id = body.get('bitrix_user_id')
            if not bx_id:
                return resp(400, {'error': 'bitrix_user_id обязателен'})
            add_exception(
                bitrix_user_id=str(bx_id),
                full_name=body.get('full_name', ''),
                email=body.get('email', ''),
                position=body.get('position', ''),
                reason=body.get('reason', ''),
                added_by_user_id=payload.get('user_id') or payload.get('id'),
                added_by_name=payload.get('full_name') or payload.get('username') or '',
            )
            return resp(200, {'ok': True})

        if post_action == 'remove_exception':
            if not is_admin(payload):
                return resp(403, {'error': 'Доступ только для администратора'})
            bx_id = body.get('bitrix_user_id')
            if not bx_id:
                return resp(400, {'error': 'bitrix_user_id обязателен'})
            remove_exception(str(bx_id))
            return resp(200, {'ok': True})

        mode = body.get('mode')
        user_ids = body.get('user_ids', [])
        days_threshold = int(body.get('days', 30))

        users = fetch_all_users()
        exception_ids = fetch_exception_ids()
        inactive = classify_users(users, days_threshold, exception_ids)
        info_by_id = {str(u['id']): u for u in inactive}

        if mode == 'by_ids' and user_ids:
            targets = [str(x) for x in user_ids]
        elif mode in ('all', 'never_logged', 'long_inactive'):
            if mode == 'all':
                targets = [u['id'] for u in inactive]
            elif mode == 'never_logged':
                targets = [u['id'] for u in inactive if u['days_inactive'] is None]
            elif mode == 'long_inactive':
                targets = [u['id'] for u in inactive if u['days_inactive'] is not None]
            else:
                targets = []
        else:
            return resp(400, {'error': 'Укажите mode: all, never_logged, long_inactive или by_ids'})

        targets = [str(t) for t in targets]
        skipped_targets = [t for t in targets if t in exception_ids]
        active_targets = [t for t in targets if t not in exception_ids]

        started_by_user_id = payload.get('user_id') or payload.get('id')
        started_by_name = payload.get('full_name') or payload.get('username') or ''
        report_id = create_report(started_by_user_id, started_by_name, mode, days_threshold)
        report_items = []

        deactivated = 0
        errors = []

        for uid in active_targets:
            info = info_by_id.get(uid, {})
            base = {
                'id': uid,
                'name': info.get('name', ''),
                'email': info.get('email', ''),
                'position': info.get('position', ''),
                'last_login': info.get('last_login'),
                'days_inactive': info.get('days_inactive'),
            }
            try:
                result = deactivate_user(uid, email=info.get('email', ''))
                bitrix_res = result.get('bitrix') or {}
                email_res = result.get('email')
                email_status = ''
                email_message = ''
                if email_res is not None:
                    email_status = 'disabled' if email_res['success'] else 'error'
                    email_message = email_res['message']
                elif info.get('email'):
                    email_status = 'skipped'
                    email_message = 'ISPmanager не настроен или email пуст'
                if bitrix_res.get('result'):
                    deactivated += 1
                    item = {
                        **base,
                        'status': 'deactivated',
                        'error_text': '',
                        'email_status': email_status,
                        'email_message': email_message,
                    }
                else:
                    err_text = str(bitrix_res)
                    errors.append({'id': uid, 'error': err_text})
                    item = {
                        **base,
                        'status': 'error',
                        'error_text': err_text,
                        'email_status': email_status,
                        'email_message': email_message,
                    }
            except BaseException as e:
                err_text = str(e)
                errors.append({'id': uid, 'error': err_text})
                item = {**base, 'status': 'error', 'error_text': err_text}
            save_report_item(report_id, item)
            report_items.append(item)

        for uid in skipped_targets:
            info = info_by_id.get(uid, {})
            item = {
                'id': uid,
                'name': info.get('name', ''),
                'email': info.get('email', ''),
                'position': info.get('position', ''),
                'last_login': info.get('last_login'),
                'days_inactive': info.get('days_inactive'),
                'status': 'skipped',
                'error_text': 'В исключениях',
            }
            save_report_item(report_id, item)
            report_items.append(item)

        update_report_counters(
            report_id,
            total_requested=len(targets),
            deactivated=deactivated,
            errors=len(errors),
            skipped=len(skipped_targets),
        )

        normalized_items = [
            {
                'bitrix_user_id': it['id'],
                'full_name': it['name'],
                'email': it['email'],
                'position': it['position'],
                'last_login': it['last_login'],
                'days_inactive': it['days_inactive'],
                'status': it['status'],
                'error_text': it.get('error_text', ''),
                'email_status': it.get('email_status', ''),
                'email_message': it.get('email_message', ''),
            }
            for it in report_items
        ]

        return resp(200, {
            'deactivated': deactivated,
            'total_requested': len(targets),
            'skipped_excluded': len(skipped_targets),
            'errors': errors[:20],
            'report_id': report_id,
            'report': {
                'id': report_id,
                'started_by_name': started_by_name,
                'started_at': datetime.now(timezone.utc).isoformat(),
                'mode': mode,
                'days_threshold': days_threshold,
                'total_requested': len(targets),
                'deactivated_count': deactivated,
                'errors_count': len(errors),
                'skipped_count': len(skipped_targets),
                'items': normalized_items,
            },
        })

    return resp(405, {'error': 'Method not allowed'})