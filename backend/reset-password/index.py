"""
Временная функция для сброса пароля admin
"""
import json
import os
import bcrypt
from database_service import get_db_connection

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')


def handler(event, context):
    """Сброс пароля для admin"""
    
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Endpoint'
            },
            'body': ''
        }
    
    try:
        # Генерируем новый хеш для пароля "admin123"
        password = "admin123"
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Подключаемся к БД
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Обновляем пароль
        cur.execute(
            f"UPDATE {SCHEMA}.users SET password_hash = %s WHERE username = 'admin'",
            (password_hash,)
        )
        conn.commit()
        
        # Проверяем обновление
        cur.execute(f"SELECT username, password_hash FROM {SCHEMA}.users WHERE username = 'admin'")
        user = cur.fetchone()
        
        cur.close()
        conn.close()
        
        # Проверяем, что новый пароль работает
        is_valid = bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8'))
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'message': 'Password reset successful',
                'username': user['username'],
                'password_verified': is_valid,
                'new_password': password
            }, ensure_ascii=False)
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)}, ensure_ascii=False)
        }
