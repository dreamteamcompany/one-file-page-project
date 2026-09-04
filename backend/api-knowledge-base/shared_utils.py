"""Общие утилиты для базы знаний (копия общего паттерна)."""
import json
import os
import jwt
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any, Optional

JWT_SECRET = os.environ.get('JWT_SECRET')
DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA')

if not JWT_SECRET:
    raise RuntimeError('JWT_SECRET environment variable is required')
if not DATABASE_URL:
    raise RuntimeError('DATABASE_URL environment variable is required')
if not SCHEMA:
    raise RuntimeError('MAIN_DB_SCHEMA environment variable is required')


def response(status_code: int, body: Any) -> Dict[str, Any]:
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Id, X-Endpoint, Authorization',
            'Access-Control-Max-Age': '86400',
        },
        'body': json.dumps(body, ensure_ascii=False, default=str),
        'isBase64Encoded': False
    }


def get_db_connection():
    return psycopg2.connect(
        DATABASE_URL,
        cursor_factory=RealDictCursor,
        options=f'-c search_path={SCHEMA},public'
    )


def verify_token(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    headers = event.get('headers', {})
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
    if not token:
        return None
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except Exception:
        return None


def handle_options() -> Dict[str, Any]:
    return response(200, {})


def safe_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    if value is None:
        return default
    try:
        return int(value)
    except Exception:
        return default


def get_query_param(event: Dict[str, Any], name: str, default: Any = None) -> Any:
    return (event.get('queryStringParameters') or {}).get(name, default)


def get_endpoint(event: Dict[str, Any]) -> str:
    """Endpoint из заголовка X-Endpoint, иначе из query-параметров.

    Заголовок нужен, чтобы у справочников был ОДИН адрес: браузер кэширует
    CORS-проверку по адресу, поэтому общий адрес = одна проверка вместо десятков.
    """
    headers = event.get('headers') or {}
    for key, value in headers.items():
        if key.lower() == 'x-endpoint' and value:
            return str(value)
    return get_query_param(event, 'endpoint', '')


def _is_admin_in_db(user_id: int) -> bool:
    """Проверить роль администратора по БД (JWT не содержит ролей)."""
    if not user_id:
        return False
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT 1
                FROM {SCHEMA}.user_roles ur
                JOIN {SCHEMA}.roles r ON r.id = ur.role_id
                WHERE ur.user_id = {int(user_id)}
                  AND (r.system_role = 'admin'
                       OR r.name IN ('Администратор', 'Admin', 'admin'))
                LIMIT 1
                """
            )
            return cur.fetchone() is not None
    except Exception:
        return False
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


def has_role_admin(payload: Dict[str, Any]) -> bool:
    roles = payload.get('roles') or []
    for r in roles:
        name = (r.get('name') if isinstance(r, dict) else str(r)) or ''
        if name in ('Администратор', 'Admin', 'admin'):
            return True
        if isinstance(r, dict) and r.get('system_role') == 'admin':
            return True
    user_id = safe_int(payload.get('user_id'))
    return _is_admin_in_db(user_id) if user_id else False


def can_write(payload: Dict[str, Any]) -> bool:
    return has_role_admin(payload)