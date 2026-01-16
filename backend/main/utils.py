"""Utility functions for authentication, database connection, and logging"""
import json
import os
import sys
import jwt
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p67567221_one_file_page_projec')

def log(msg):
    print(msg, file=sys.stderr, flush=True)

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

def create_jwt_token(user_id: int, email: str) -> str:
    secret = os.environ.get('JWT_SECRET')
    if not secret:
        raise Exception('JWT_SECRET not configured')
    
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.utcnow() + timedelta(days=7),
        'iat': datetime.utcnow()
    }
    
    return jwt.encode(payload, secret, algorithm='HS256')

def verify_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    secret = os.environ.get('JWT_SECRET')
    if not secret:
        return None
    
    try:
        payload = jwt.decode(token, secret, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_user_with_permissions(conn, user_id: int) -> Optional[Dict[str, Any]]:
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute(
        f"SELECT u.id, u.username, u.email, u.full_name, u.is_active, u.last_login FROM {SCHEMA}.users u WHERE u.id = %s AND u.is_active = true",
        (user_id,)
    )
    
    user = cur.fetchone()
    if not user:
        cur.close()
        return None
    
    cur.execute(
        f"SELECT DISTINCT p.name, p.resource, p.action FROM {SCHEMA}.permissions p JOIN {SCHEMA}.role_permissions rp ON p.id = rp.permission_id JOIN {SCHEMA}.user_roles ur ON rp.role_id = ur.role_id WHERE ur.user_id = %s",
        (user_id,)
    )
    
    permissions = [dict(row) for row in cur.fetchall()]
    
    cur.execute(
        f"SELECT r.id, r.name, r.description FROM {SCHEMA}.roles r JOIN {SCHEMA}.user_roles ur ON r.id = ur.role_id WHERE ur.user_id = %s",
        (user_id,)
    )
    
    roles = [dict(row) for row in cur.fetchall()]
    
    cur.close()
    
    return {
        'id': user['id'],
        'username': user['username'],
        'email': user['email'],
        'full_name': user['full_name'],
        'is_active': user['is_active'],
        'last_login': user['last_login'],
        'roles': roles,
        'permissions': permissions
    }

def create_audit_log(
    conn,
    entity_type: str,
    entity_id: int,
    action: str,
    user_id: int,
    username: str,
    changed_fields: Optional[Dict] = None,
    old_values: Optional[Dict] = None,
    new_values: Optional[Dict] = None,
    metadata: Optional[Dict] = None
):
    cur = conn.cursor()
    try:
        cur.execute(f"""
            INSERT INTO {SCHEMA}.audit_logs 
            (entity_type, entity_id, action, user_id, username, changed_fields, old_values, new_values, metadata)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            entity_type,
            entity_id,
            action,
            user_id,
            username,
            json.dumps(changed_fields) if changed_fields else None,
            json.dumps(old_values) if old_values else None,
            json.dumps(new_values) if new_values else None,
            json.dumps(metadata) if metadata else None
        ))
        conn.commit()
    except Exception as e:
        print(f"Failed to create audit log: {e}")
    finally:
        cur.close()

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

def get_user_role(conn, user_id: int) -> str:
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(f"""
        SELECT r.name 
        FROM {SCHEMA}.roles r
        JOIN {SCHEMA}.user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = %s
        LIMIT 1
    """, (user_id,))
    
    row = cur.fetchone()
    cur.close()
    return row['name'] if row else 'employee'
