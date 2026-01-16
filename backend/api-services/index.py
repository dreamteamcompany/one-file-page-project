"""
API для работы с сервисами (services)
Облегченная версия для быстрого деплоя
"""
import json
import os
import jwt
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any, Optional

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p67567221_one_file_page_projec')

def response(status_code: int, body: Any) -> Dict[str, Any]:
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, Authorization',
            'Access-Control-Max-Age': '86400',
        },
        'body': json.dumps(body, ensure_ascii=False, default=str),
        'isBase64Encoded': False
    }

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        raise Exception('DATABASE_URL not found')
    return psycopg2.connect(dsn, options=f'-c search_path={SCHEMA},public')

def verify_token(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
    if not token:
        return None
    
    secret = os.environ.get('JWT_SECRET')
    if not secret:
        return None
    
    try:
        payload = jwt.decode(token, secret, algorithms=['HS256'])
        return payload
    except:
        return None

def handler(event, context):
    """API эндпоинт для services"""
    
    if event.get('httpMethod') == 'OPTIONS':
        return response(200, {'message': 'OK'})
    
    method = event.get('httpMethod', 'GET')
    payload = verify_token(event)
    
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    
    try:
        conn = get_db_connection()
    except Exception as e:
        return response(500, {'error': 'Database connection failed'})
    
    try:
        if method == 'GET':
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(f"""
                SELECT 
                    s.id,
                    s.name,
                    s.description,
                    s.intermediate_approver_id,
                    s.final_approver_id,
                    s.customer_department_id,
                    s.created_at,
                    s.updated_at,
                    u1.full_name as intermediate_approver_name,
                    u2.full_name as final_approver_name,
                    cd.name as customer_department_name
                FROM {SCHEMA}.services s
                LEFT JOIN {SCHEMA}.users u1 ON s.intermediate_approver_id = u1.id
                LEFT JOIN {SCHEMA}.users u2 ON s.final_approver_id = u2.id
                LEFT JOIN {SCHEMA}.customer_departments cd ON s.customer_department_id = cd.id
                ORDER BY s.name
            """)
            
            services = [dict(row) for row in cur.fetchall()]
            cur.close()
            
            return response(200, services)
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            
            name = body.get('name')
            description = body.get('description', '')
            intermediate_approver_id = body.get('intermediate_approver_id')
            final_approver_id = body.get('final_approver_id')
            customer_department_id = body.get('customer_department_id')
            
            if not name:
                return response(400, {'error': 'Название сервиса обязательно'})
            
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(f"""
                INSERT INTO {SCHEMA}.services (
                    name, 
                    description, 
                    intermediate_approver_id, 
                    final_approver_id,
                    customer_department_id,
                    created_at, 
                    updated_at
                )
                VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                RETURNING id, name, description, intermediate_approver_id, 
                          final_approver_id, customer_department_id, created_at, updated_at
            """, (name, description, intermediate_approver_id, final_approver_id, customer_department_id))
            
            new_service = dict(cur.fetchone())
            conn.commit()
            cur.close()
            
            return response(201, new_service)
        
        else:
            return response(405, {'error': 'Method not allowed'})
    
    except Exception as e:
        return response(500, {'error': str(e)})
    
    finally:
        try:
            conn.close()
        except:
            pass