"""Авторизация через Битрикс24 OAuth 2.0"""
import json
import os
import urllib.request
import urllib.parse
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt
from datetime import datetime, timedelta

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'super_secret_key_change_me')

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Id, Authorization, X-Endpoint',
}

DEFAULT_ROLE_ID = 7


def handler(event, context):
    """Обработка OAuth авторизации через Битрикс24"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')

    if action == 'get-auth-url':
        return handle_get_auth_url(params)

    if action == 'callback':
        return handle_callback(event)

    return response(400, {'error': 'Unknown action'})


def handle_get_auth_url(params):
    """Возвращает URL для редиректа на Битрикс24 OAuth"""
    portal_url = os.environ.get('BITRIX24_PORTAL_URL', '').rstrip('/')
    client_id = os.environ.get('BITRIX24_CLIENT_ID', '')

    if not portal_url:
        return response(500, {'error': 'BITRIX24_PORTAL_URL не настроен'})
    if not client_id:
        return response(500, {'error': 'BITRIX24_CLIENT_ID не настроен'})

    redirect_uri = params.get('redirect_uri', '')
    if not redirect_uri:
        return response(400, {'error': 'redirect_uri is required'})

    auth_url = (
        f"{portal_url}/oauth/authorize/"
        f"?client_id={client_id}"
        f"&response_type=code"
        f"&redirect_uri={urllib.parse.quote(redirect_uri, safe='')}"
    )
    return response(200, {'auth_url': auth_url})


def handle_callback(event):
    """Обмен кода на токен, получение профиля, создание/вход пользователя"""
    body = json.loads(event.get('body', '{}'))
    code = body.get('code', '')
    redirect_uri = body.get('redirect_uri', '')

    if not code:
        return response(400, {'error': 'code is required'})

    token_data = exchange_code(code, redirect_uri)
    if not token_data:
        return response(401, {'error': 'Не удалось получить токен от Битрикс24'})

    access_token = token_data.get('access_token')
    if not access_token:
        return response(401, {'error': 'Битрикс24 не вернул access_token'})

    bitrix_user = get_bitrix_user(access_token)
    if not bitrix_user:
        return response(401, {'error': 'Не удалось получить профиль пользователя из Битрикс24'})

    bitrix_user_id = str(bitrix_user.get('ID', ''))

    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        existing_user = find_user_by_email(conn, bitrix_user)

        if not existing_user:
            if not is_department_head(access_token, bitrix_user_id):
                return response(403, {
                    'error': 'Автоматическая регистрация доступна только руководителям отделов. Обратитесь к администратору для создания учётной записи.'
                })
        elif not existing_user.get('is_active'):
            return response(403, {
                'error': 'Учётная запись отключена. Обратитесь к администратору.'
            })
        elif existing_user.get('auto_registered') and not existing_user.get('bypass_department_head_check'):
            if not is_department_head(access_token, bitrix_user_id):
                cur = conn.cursor()
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (existing_user['id'],)
                )
                conn.commit()
                cur.close()
                print(f"[Bitrix OAuth] User {existing_user['id']} deactivated: no longer department head")
                return response(403, {
                    'error': 'Вы больше не являетесь руководителем отдела. Учётная запись отключена. Обратитесь к администратору.'
                })

        user = find_or_create_user(conn, bitrix_user)
        jwt_token = create_jwt(user['id'], user['username'])

        cur = conn.cursor()
        cur.execute(
            f"UPDATE {SCHEMA}.users SET last_login = CURRENT_TIMESTAMP WHERE id = %s",
            (user['id'],)
        )
        conn.commit()
        cur.close()

        return response(200, {
            'token': jwt_token,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'full_name': user['full_name'],
                'photo_url': user.get('photo_url', ''),
                'is_active': user['is_active'],
                'last_login': user.get('last_login'),
                'roles': user.get('roles', []),
                'permissions': user.get('permissions', []),
            }
        })
    finally:
        conn.close()


def exchange_code(code, redirect_uri):
    """Обменивает код авторизации на access_token через сервер авторизации Битрикс24"""
    client_id = os.environ.get('BITRIX24_CLIENT_ID', '')
    client_secret = os.environ.get('BITRIX24_CLIENT_SECRET', '')

    params = urllib.parse.urlencode({
        'grant_type': 'authorization_code',
        'client_id': client_id,
        'client_secret': client_secret,
        'code': code,
        'redirect_uri': redirect_uri,
    })
    url = f"https://oauth.bitrix.info/oauth/token/?{params}"

    try:
        req = urllib.request.Request(url, method='GET')
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode()
            print(f"[Bitrix OAuth] Token response: {raw[:300]}")
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ''
        print(f"[Bitrix OAuth] Token exchange HTTP {e.code}: {body[:500]}")
        return None
    except Exception as e:
        print(f"[Bitrix OAuth] Token exchange error: {e}")
        return None


def get_bitrix_user(access_token, member_id=''):
    """Получает профиль текущего пользователя из Битрикс24"""
    portal_url = os.environ.get('BITRIX24_PORTAL_URL', '').rstrip('/')
    url = f"{portal_url}/rest/user.current?auth={access_token}"
    print(f"[Bitrix OAuth] Getting user from: {portal_url}/rest/user.current")
    try:
        req = urllib.request.Request(url, method='GET')
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode()
            print(f"[Bitrix OAuth] User response: {raw[:300]}")
            data = json.loads(raw)
            return data.get('result')
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ''
        print(f"[Bitrix OAuth] Get user HTTP {e.code}: {body[:500]}")
        return None
    except Exception as e:
        print(f"[Bitrix OAuth] Get user error: {e}")
        return None


def is_department_head(access_token, bitrix_user_id):
    """Проверяет, является ли пользователь руководителем хотя бы одного отдела в Битрикс24"""
    portal_url = os.environ.get('BITRIX24_PORTAL_URL', '').rstrip('/')
    url = f"{portal_url}/rest/department.get?auth={access_token}&UF_HEAD={bitrix_user_id}"
    print(f"[Bitrix OAuth] Checking if user {bitrix_user_id} is department head")
    try:
        req = urllib.request.Request(url, method='GET')
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode()
            print(f"[Bitrix OAuth] Department head check response: {raw[:500]}")
            data = json.loads(raw)
            departments = data.get('result', [])
            if departments:
                dept_names = [d.get('NAME', '?') for d in departments]
                print(f"[Bitrix OAuth] User {bitrix_user_id} is head of: {dept_names}")
                return True
            return False
    except Exception as e:
        print(f"[Bitrix OAuth] Department head check error: {e}")
        return False


def find_user_by_email(conn, bitrix_user):
    """Проверяет, существует ли пользователь с таким email или bitrix_user_id в системе."""
    email = (bitrix_user.get('EMAIL') or '').strip().lower()
    bitrix_id = str(bitrix_user.get('ID', ''))
    if not email:
        email = f"bitrix_{bitrix_id}@local"

    cur = conn.cursor()
    cur.execute(
        f"SELECT id, auto_registered, is_active, bypass_department_head_check FROM {SCHEMA}.users WHERE bitrix_user_id = %s",
        (bitrix_id,)
    )
    result = cur.fetchone()
    if not result:
        cur.execute(
            f"SELECT id, auto_registered, is_active, bypass_department_head_check FROM {SCHEMA}.users WHERE LOWER(email) = %s",
            (email,)
        )
        result = cur.fetchone()
    cur.close()
    return result


def find_or_create_user(conn, bitrix_user):
    """Ищет пользователя по email или создаёт нового"""
    email = (bitrix_user.get('EMAIL') or '').strip().lower()
    bitrix_id = str(bitrix_user.get('ID', ''))
    first_name = bitrix_user.get('NAME', '')
    last_name = bitrix_user.get('LAST_NAME', '')
    full_name = f"{first_name} {last_name}".strip() or email
    photo_url = bitrix_user.get('PERSONAL_PHOTO', '') or ''

    if not email:
        email = f"bitrix_{bitrix_id}@local"

    cur = conn.cursor()

    cur.execute(f"""
        SELECT u.id, u.username, u.email, u.full_name, u.photo_url, u.is_active, u.last_login,
               COALESCE(json_agg(DISTINCT jsonb_build_object(
                   'id', r.id, 'name', r.name, 'description', r.description, 'system_role', r.system_role
               )) FILTER (WHERE r.id IS NOT NULL), '[]') as roles,
               COALESCE(json_agg(DISTINCT jsonb_build_object(
                   'name', p.name, 'resource', p.resource, 'action', p.action
               )) FILTER (WHERE p.id IS NOT NULL), '[]') as permissions
        FROM {SCHEMA}.users u
        LEFT JOIN {SCHEMA}.user_roles ur ON u.id = ur.user_id
        LEFT JOIN {SCHEMA}.roles r ON ur.role_id = r.id
        LEFT JOIN {SCHEMA}.role_permissions rp ON r.id = rp.role_id
        LEFT JOIN {SCHEMA}.permissions p ON rp.permission_id = p.id
        WHERE u.bitrix_user_id = %s
        GROUP BY u.id
    """, (bitrix_id,))

    user = cur.fetchone()

    if not user:
        cur.execute(f"""
            SELECT u.id, u.username, u.email, u.full_name, u.photo_url, u.is_active, u.last_login,
                   COALESCE(json_agg(DISTINCT jsonb_build_object(
                       'id', r.id, 'name', r.name, 'description', r.description, 'system_role', r.system_role
                   )) FILTER (WHERE r.id IS NOT NULL), '[]') as roles,
                   COALESCE(json_agg(DISTINCT jsonb_build_object(
                       'name', p.name, 'resource', p.resource, 'action', p.action
                   )) FILTER (WHERE p.id IS NOT NULL), '[]') as permissions
            FROM {SCHEMA}.users u
            LEFT JOIN {SCHEMA}.user_roles ur ON u.id = ur.user_id
            LEFT JOIN {SCHEMA}.roles r ON ur.role_id = r.id
            LEFT JOIN {SCHEMA}.role_permissions rp ON r.id = rp.role_id
            LEFT JOIN {SCHEMA}.permissions p ON rp.permission_id = p.id
            WHERE LOWER(u.email) = %s
            GROUP BY u.id
        """, (email,))
        user = cur.fetchone()

    if user:
        updates = []
        params = []
        if photo_url and photo_url != user.get('photo_url', ''):
            updates.append("photo_url = %s")
            params.append(photo_url)
            user['photo_url'] = photo_url
        if bitrix_id:
            updates.append("bitrix_user_id = %s")
            params.append(bitrix_id)
        if email and user.get('email', '').endswith('@placeholder.local'):
            updates.append("email = %s")
            params.append(email)
            user['email'] = email
        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(user['id'])
            cur.execute(
                f"UPDATE {SCHEMA}.users SET {', '.join(updates)} WHERE id = %s",
                tuple(params)
            )
            conn.commit()
        cur.close()
        return user

    username = email.split('@')[0]
    base_username = username
    counter = 1
    while True:
        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE username = %s", (username,))
        if not cur.fetchone():
            break
        username = f"{base_username}_{counter}"
        counter += 1

    cur.execute(f"""
        INSERT INTO {SCHEMA}.users (username, email, full_name, photo_url, password_hash, is_active, auto_registered, bitrix_user_id, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, true, true, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
    """, (username, email, full_name, photo_url, 'BITRIX_OAUTH', bitrix_id))

    new_user_id = cur.fetchone()['id']

    cur.execute(f"""
        INSERT INTO {SCHEMA}.user_roles (user_id, role_id)
        VALUES (%s, %s)
        ON CONFLICT DO NOTHING
    """, (new_user_id, DEFAULT_ROLE_ID))

    conn.commit()

    cur.execute(f"""
        SELECT u.id, u.username, u.email, u.full_name, u.photo_url, u.is_active, u.last_login,
               COALESCE(json_agg(DISTINCT jsonb_build_object(
                   'id', r.id, 'name', r.name, 'description', r.description, 'system_role', r.system_role
               )) FILTER (WHERE r.id IS NOT NULL), '[]') as roles,
               COALESCE(json_agg(DISTINCT jsonb_build_object(
                   'name', p.name, 'resource', p.resource, 'action', p.action
               )) FILTER (WHERE p.id IS NOT NULL), '[]') as permissions
        FROM {SCHEMA}.users u
        LEFT JOIN {SCHEMA}.user_roles ur ON u.id = ur.user_id
        LEFT JOIN {SCHEMA}.roles r ON ur.role_id = r.id
        LEFT JOIN {SCHEMA}.role_permissions rp ON r.id = rp.role_id
        LEFT JOIN {SCHEMA}.permissions p ON rp.permission_id = p.id
        WHERE u.id = %s
        GROUP BY u.id
    """, (new_user_id,))

    user = cur.fetchone()
    cur.close()
    return user


def create_jwt(user_id, username):
    """Создаёт JWT токен"""
    payload = {
        'user_id': user_id,
        'username': username,
        'exp': datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def response(status, data):
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps(data, ensure_ascii=False, default=str)
    }