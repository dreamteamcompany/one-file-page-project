"""
Общие утилиты для backend функций
"""
import os
import psycopg2

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA')

cors_headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-Endpoint',
    'Access-Control-Max-Age': '86400',
}

def get_db_connection():
    """Подключение к БД с установкой search_path"""
    conn = psycopg2.connect(
        DATABASE_URL,
        options=f'-c search_path={SCHEMA},public'
    )
    return conn
