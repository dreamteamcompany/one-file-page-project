"""
Общие утилиты для всех backend функций
Используется для унификации работы с JWT, БД и ответами API
"""
import json
import os
import jwt
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any, Optional

# Получаем переменные окружения БЕЗ дефолтных значений
JWT_SECRET = os.environ.get('JWT_SECRET')
DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA')

# Проверка критичных переменных
if not JWT_SECRET:
    raise RuntimeError('JWT_SECRET environment variable is required')
if not DATABASE_URL:
    raise RuntimeError('DATABASE_URL environment variable is required')
if not SCHEMA:
    raise RuntimeError('MAIN_DB_SCHEMA environment variable is required')


def response(status_code: int, body: Any) -> Dict[str, Any]:
    """Стандартизированный ответ API с CORS заголовками"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Id, Authorization',
            'Access-Control-Max-Age': '86400',
        },
        'body': json.dumps(body, ensure_ascii=False, default=str),
        'isBase64Encoded': False
    }


def get_db_connection():
    """
    Подключение к БД с RealDictCursor и установкой search_path
    Возвращает connection с настроенной схемой
    """
    conn = psycopg2.connect(
        DATABASE_URL,
        cursor_factory=RealDictCursor,
        options=f'-c search_path={SCHEMA},public'
    )
    return conn


def verify_token(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Проверка JWT токена из заголовков
    Возвращает payload или None при ошибке
    """
    headers = event.get('headers', {})
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
    
    if not token:
        return None
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def handle_options() -> Dict[str, Any]:
    """Стандартная обработка OPTIONS запроса для CORS"""
    return response(200, {})


def safe_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    """Безопасное преобразование в int"""
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def get_query_param(event: Dict[str, Any], param_name: str, default: Any = None) -> Any:
    """Безопасное получение query параметра"""
    params = event.get('queryStringParameters') or {}
    return params.get(param_name, default)


def get_endpoint(event: Dict[str, Any]) -> str:
    """Получение endpoint из query параметров"""
    return get_query_param(event, 'endpoint', '')
