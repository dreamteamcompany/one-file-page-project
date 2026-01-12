import json
import os
from typing import Dict, Any
import psycopg2

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Очистка всех данных проекта: удаляет содержимое всех таблиц, 
    кроме системных (users, roles, permissions).
    """
    method: str = event.get('httpMethod', 'POST')
    
    # CORS OPTIONS
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Only POST allowed'}),
            'isBase64Encoded': False
        }
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    
    try:
        # Список таблиц для очистки (все кроме системных)
        tables_to_clear = [
            'payments',
            'approvals',
            'audit_logs',
            'savings',
            'legal_entities',
            'categories',
            'custom_fields',
            'custom_field_values',
            'payment_custom_field_values',
            'payment_custom_values',
            'contractors',
            'customer_departments',
            'services',
            'saving_reasons',
            'payment_comments',
            'comment_likes',
            'log_files',
            'log_entries',
            'log_statistics',
            'dashboard_layouts'
        ]
        
        cleared_count = 0
        
        with conn.cursor() as cur:
            for table in tables_to_clear:
                try:
                    # TRUNCATE быстрее чем DELETE и сбрасывает счётчики
                    cur.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE")
                    cleared_count += 1
                except Exception as e:
                    # Если таблица не существует, пропускаем
                    print(f"Failed to clear {table}: {e}")
            
            conn.commit()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'tables_cleared': cleared_count,
                'message': 'Все данные успешно удалены'
            }),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    
    finally:
        conn.close()
