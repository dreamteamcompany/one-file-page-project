import json
import os
import sys
import jwt 
import bcrypt
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
# Deploy version: v2.4 - using stderr for logging

SCHEMA = 't_p61788166_html_to_frontend'
VERSION = '2.4.0'

def log(msg):
    print(msg, file=sys.stderr, flush=True)

# Pydantic models for validation
class PaymentRequest(BaseModel):
    category_id: int = Field(..., gt=0)
    amount: float = Field(..., gt=0)
    description: str = Field(default='')
    payment_date: str = Field(default='')
    legal_entity_id: int = Field(default=None)
    contractor_id: int = Field(default=None)
    department_id: int = Field(default=None)
    service_id: int = Field(default=None)
    invoice_number: str = Field(default=None)
    invoice_date: str = Field(default=None)

class CategoryRequest(BaseModel):
    name: str = Field(..., min_length=1)
    icon: str = Field(default='Tag')

class LegalEntityRequest(BaseModel):
    name: str = Field(..., min_length=1)
    inn: str = Field(default='')
    kpp: str = Field(default='')
    address: str = Field(default='')

class CustomFieldRequest(BaseModel):
    name: str = Field(..., min_length=1)
    field_type: str = Field(..., pattern='^(text|select|file|toggle)$')
    options: str = Field(default='')

class ContractorRequest(BaseModel):
    name: str = Field(..., min_length=1)
    inn: str = Field(default='')
    kpp: str = Field(default='')
    ogrn: str = Field(default='')
    legal_address: str = Field(default='')
    actual_address: str = Field(default='')
    phone: str = Field(default='')
    email: str = Field(default='')
    contact_person: str = Field(default='')
    bank_name: str = Field(default='')
    bank_bik: str = Field(default='')
    bank_account: str = Field(default='')
    correspondent_account: str = Field(default='')
    notes: str = Field(default='')

class CustomerDepartmentRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(default='')

class RoleRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(default='')
    permission_ids: list[int] = Field(default=[])

class PermissionRequest(BaseModel):
    name: str = Field(..., min_length=1)
    resource: str = Field(..., min_length=1)
    action: str = Field(..., min_length=1)
    description: str = Field(default='')

class ApprovalActionRequest(BaseModel):
    payment_id: int = Field(..., gt=0)
    action: str = Field(..., pattern='^(approve|reject)$')
    comment: str = Field(default='')

class ServiceRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(default='')
    intermediate_approver_id: int = Field(..., gt=0)
    final_approver_id: int = Field(..., gt=0)
    customer_department_id: Optional[int] = None
    category_id: Optional[int] = None

class SavingRequest(BaseModel):
    service_id: int = Field(..., gt=0)
    description: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    frequency: str = Field(..., pattern='^(once|monthly|quarterly|yearly)$')
    currency: str = Field(default='RUB')
    employee_id: int = Field(..., gt=0)
    saving_reason_id: Optional[int] = None

class SavingReasonRequest(BaseModel):
    name: str = Field(..., min_length=1)
    icon: str = Field(default='Target')

# Utility functions
def response(status_code: int, body: Any) -> Dict[str, Any]:
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
        },
        'body': json.dumps(body, ensure_ascii=False, default=str),
        'isBase64Encoded': False
    }

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        raise Exception('DATABASE_URL not found')
    return psycopg2.connect(dsn)

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
    
    cur.execute("""
        SELECT u.id, u.username, u.email, u.full_name, u.is_active, u.last_login
        FROM users u
        WHERE u.id = %s AND u.is_active = true
    """, (user_id,))
    
    user = cur.fetchone()
    if not user:
        cur.close()
        return None
    
    cur.execute("""
        SELECT DISTINCT p.name, p.resource, p.action
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = %s
    """, (user_id,))
    
    permissions = [dict(row) for row in cur.fetchall()]
    
    cur.execute("""
        SELECT r.id, r.name, r.description
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = %s
    """, (user_id,))
    
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

def verify_token_and_permission(event: Dict[str, Any], conn, required_permission: str):
    token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
    if not token:
        return None, response(401, {'error': 'Требуется авторизация'})
    
    secret = os.environ.get('JWT_SECRET')
    if not secret:
        return None, response(500, {'error': 'Server configuration error'})
    
    try:
        payload = jwt.decode(token, secret, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return None, response(401, {'error': 'Токен истек'})
    except jwt.InvalidTokenError:
        return None, response(401, {'error': 'Недействительный токен'})
    
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Проверяем, является ли пользователь администратором
    cur.execute("""
        SELECT r.name
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = %s
    """, (payload['user_id'],))
    
    roles = [row['name'] for row in cur.fetchall()]
    
    # Если у пользователя роль администратора - даём полный доступ
    if 'Администратор' in roles or 'Admin' in roles:
        cur.close()
        return payload, None
    
    # Иначе проверяем конкретное разрешение
    cur.execute("""
        SELECT DISTINCT p.name
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = %s
    """, (payload['user_id'],))
    
    permissions = [row['name'] for row in cur.fetchall()]
    cur.close()
    
    if required_permission not in permissions:
        return None, response(403, {'error': 'Недостаточно прав'})
    
    return payload, None

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
    """Создание записи в audit log"""
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
    
    result = cur.fetchone()
    cur.close()
    return result['name'] if result else 'user'

# Main handler
def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Главный обработчик всех API эндпоинтов"""
    log(f"[HANDLER START] Event keys: {list(event.keys())}")
    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    endpoint = params.get('endpoint', '')
    
    log(f"[DEBUG v2.4] Method={method} Endpoint={endpoint} Params={params}")
    
    if method == 'OPTIONS':
        return response(200, {})
    
    conn = get_db_connection()
    
    try:
        # Auth endpoints
        if endpoint == 'login':
            return handle_login(event, conn)
        elif endpoint == 'register':
            return handle_register(event, conn)
        elif endpoint == 'me':
            return handle_me(event, conn)
        
        # User management
        elif endpoint == 'users':
            return handle_users(method, event, conn)
        
        # API endpoints
        elif endpoint == 'payments':
            return handle_payments(method, event, conn)
        elif endpoint == 'categories':
            return handle_categories(method, event, conn)
        elif endpoint == 'ticket_service_categories':
            return handle_ticket_service_categories(method, event, conn)
        elif endpoint == 'stats':
            return handle_stats(event, conn)
        elif endpoint == 'legal-entities':
            return handle_legal_entities(method, event, conn)
        elif endpoint == 'custom-fields':
            return handle_custom_fields(method, event, conn)
        elif endpoint == 'contractors':
            return handle_contractors(method, event, conn)
        elif endpoint == 'customer_departments':
            return handle_customer_departments(method, event, conn)
        elif endpoint == 'roles':
            return handle_roles(method, event, conn)
        elif endpoint == 'permissions':
            return handle_permissions(method, event, conn)
        elif endpoint == 'approvals':
            return handle_approvals(method, event, conn)
        elif endpoint == 'services':
            return handle_services(method, event, conn)
        elif endpoint == 'comments':
            token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
            if not token:
                return response(401, {'error': 'Authentication required'})
            payload = verify_jwt_token(token)
            if not payload:
                return response(401, {'error': 'Invalid token'})
            current_user = get_user_with_permissions(conn, payload['user_id'])
            if not current_user:
                return response(401, {'error': 'User not found'})
            return handle_comments(method, event, conn, current_user)
        elif endpoint == 'comment-likes':
            token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
            if not token:
                return response(401, {'error': 'Authentication required'})
            payload = verify_jwt_token(token)
            if not payload:
                return response(401, {'error': 'Invalid token'})
            current_user = get_user_with_permissions(conn, payload['user_id'])
            if not current_user:
                return response(401, {'error': 'User not found'})
            return handle_comment_likes(method, event, conn, current_user)
        elif endpoint == 'audit-logs':
            token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
            if not token:
                return response(401, {'error': 'Authentication required'})
            payload = verify_jwt_token(token)
            if not payload:
                return response(401, {'error': 'Invalid token'})
            return handle_audit_logs(method, event, conn, payload)
        elif endpoint == 'tickets-api':
            token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
            if not token:
                return response(401, {'error': 'Authentication required'})
            payload = verify_jwt_token(token)
            if not payload:
                return response(401, {'error': 'Invalid token'})
            return handle_tickets_api(method, event, conn, payload)
        elif endpoint == 'ticket-dictionaries-api':
            token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
            if not token:
                return response(401, {'error': 'Authentication required'})
            payload = verify_jwt_token(token)
            if not payload:
                return response(401, {'error': 'Invalid token'})
            return handle_ticket_dictionaries_api(method, event, conn, payload)
        elif endpoint == 'ticket-comments-api':
            token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
            if not token:
                return response(401, {'error': 'Authentication required'})
            payload = verify_jwt_token(token)
            if not payload:
                return response(401, {'error': 'Invalid token'})
            return handle_ticket_comments_api(method, event, conn, payload)
        elif endpoint == 'comment-reactions':
            token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
            if not token:
                return response(401, {'error': 'Authentication required'})
            payload = verify_jwt_token(token)
            if not payload:
                return response(401, {'error': 'Invalid token'})
            return handle_comment_reactions(method, event, conn, payload)
        elif endpoint == 'upload-file':
            token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
            if not token:
                return response(401, {'error': 'Authentication required'})
            payload = verify_jwt_token(token)
            if not payload:
                return response(401, {'error': 'Invalid token'})
            return handle_upload_file(event, conn, payload)
        
        return response(404, {'error': 'Endpoint not found'})
    
    finally:
        conn.close()

# Auth handlers
def handle_login(event: Dict[str, Any], conn) -> Dict[str, Any]:
    body_data = json.loads(event.get('body', '{}'))
    username = body_data.get('username', '').strip()
    password = body_data.get('password', '')
    
    if not username or not password:
        return response(400, {'error': 'Логин и пароль обязательны'})
    
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, email, username, password_hash, full_name, is_active
        FROM users
        WHERE username = %s
    """, (username,))
    
    user = cur.fetchone()
    cur.close()
    
    if not user:
        return response(401, {'error': 'Неверный логин или пароль'})
    
    if not user['is_active']:
        return response(403, {'error': 'Пользователь деактивирован'})
    
    if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return response(401, {'error': 'Неверный логин или пароль'})
    
    cur = conn.cursor()
    cur.execute("""
        UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = %s
    """, (user['id'],))
    conn.commit()
    cur.close()
    
    token = create_jwt_token(user['id'], user['email'])
    user_data = get_user_with_permissions(conn, user['id'])
    
    return response(200, {
        'token': token,
        'user': user_data
    })

def handle_register(event: Dict[str, Any], conn) -> Dict[str, Any]:
    token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
    if not token:
        return response(401, {'error': 'Требуется авторизация'})
    
    payload = verify_jwt_token(token)
    if not payload:
        return response(401, {'error': 'Недействительный токен'})
    
    admin_user = get_user_with_permissions(conn, payload['user_id'])
    if not admin_user:
        return response(403, {'error': 'Доступ запрещен'})
    
    has_permission = any(p['name'] == 'users.create' for p in admin_user['permissions'])
    if not has_permission:
        return response(403, {'error': 'Недостаточно прав для создания пользователей'})
    
    body_data = json.loads(event.get('body', '{}'))
    username = body_data.get('username', '').strip()
    email = body_data.get('email', '').strip().lower()
    password = body_data.get('password', '')
    full_name = body_data.get('full_name', '').strip()
    role_id = body_data.get('role_id')
    
    if not username or not email or not password or not full_name:
        return response(400, {'error': 'Логин, email, пароль и имя обязательны'})
    
    if len(password) < 4:
        return response(400, {'error': 'Пароль должен быть не менее 4 символов'})
    
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute("""
            INSERT INTO users (username, email, password_hash, full_name, is_active)
            VALUES (%s, %s, %s, %s, true)
            RETURNING id, username, email, full_name, is_active, created_at
        """, (username, email, password_hash, full_name))
        
        new_user = cur.fetchone()
        
        if role_id:
            cur.execute("""
                INSERT INTO user_roles (user_id, role_id, assigned_by)
                VALUES (%s, %s, %s)
            """, (new_user['id'], role_id, admin_user['id']))
        
        conn.commit()
        cur.close()
        
        return response(201, {
            'id': new_user['id'],
            'username': new_user['username'],
            'email': new_user['email'],
            'full_name': new_user['full_name'],
            'is_active': new_user['is_active'],
            'created_at': new_user['created_at']
        })
    except psycopg2.IntegrityError:
        conn.rollback()
        cur.close()
        return response(409, {'error': 'Пользователь с таким email уже существует'})

def handle_me(event: Dict[str, Any], conn) -> Dict[str, Any]:
    token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
    if not token:
        return response(401, {'error': 'Требуется авторизация'})
    
    payload = verify_jwt_token(token)
    if not payload:
        return response(401, {'error': 'Недействительный токен'})
    
    user_data = get_user_with_permissions(conn, payload['user_id'])
    if not user_data:
        return response(404, {'error': 'Пользователь не найден'})
    
    return response(200, user_data)

# User management handler
def handle_users(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    if method == 'GET':
        user_payload, error = verify_token_and_permission(event, conn, 'users.read')
        if error:
            return error
        
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT 
                u.id, u.username, u.full_name, u.position, u.photo_url, u.is_active, 
                u.created_at, u.last_login,
                COALESCE(
                    array_agg(json_build_object('id', r.id, 'name', r.name)) FILTER (WHERE r.id IS NOT NULL),
                    ARRAY[]::json[]
                ) as roles
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        """)
        
        users = [dict(row) for row in cur.fetchall()]
        cur.close()
        
        return response(200, users)
    
    elif method == 'POST':
        user_payload, error = verify_token_and_permission(event, conn, 'users.create')
        if error:
            return error
        
        body_data = json.loads(event.get('body', '{}'))
        username = body_data.get('username', '').strip()
        password = body_data.get('password', '')
        full_name = body_data.get('full_name', '').strip()
        position = body_data.get('position', '').strip()
        photo_url = body_data.get('photo_url', '').strip()
        role_ids = body_data.get('role_ids', [])
        
        if not username or not password or not full_name:
            return response(400, {'error': 'Логин, пароль и имя обязательны'})
        
        if len(password) < 4:
            return response(400, {'error': 'Пароль должен быть не менее 4 символов'})
        
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cur.execute("""
                INSERT INTO users (username, password_hash, full_name, position, photo_url, email, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, true)
                RETURNING id, username, full_name, position, photo_url, is_active, created_at
            """, (username, password_hash, full_name, position, photo_url, username + '@example.com'))
            
            new_user = cur.fetchone()
            
            if role_ids:
                for role_id in role_ids:
                    cur.execute("""
                        INSERT INTO user_roles (user_id, role_id, assigned_by)
                        VALUES (%s, %s, %s)
                    """, (new_user['id'], role_id, user_payload['user_id']))
            
            conn.commit()
            
            cur.execute("""
                SELECT 
                    u.id, u.username, u.full_name, u.position, u.photo_url, u.is_active, 
                    u.created_at, u.last_login,
                    COALESCE(
                        array_agg(json_build_object('id', r.id, 'name', r.name)) FILTER (WHERE r.id IS NOT NULL),
                        ARRAY[]::json[]
                    ) as roles
                FROM users u
                LEFT JOIN user_roles ur ON u.id = ur.user_id
                LEFT JOIN roles r ON ur.role_id = r.id
                WHERE u.id = %s
                GROUP BY u.id
            """, (new_user['id'],))
            
            created_user = cur.fetchone()
            cur.close()
            
            return response(201, dict(created_user))
        except psycopg2.IntegrityError as e:
            conn.rollback()
            cur.close()
            return response(409, {'error': 'Пользователь с таким логином уже существует'})
    
    elif method == 'PUT':
        user_payload, error = verify_token_and_permission(event, conn, 'users.update')
        if error:
            return error
        
        query_params = event.get('queryStringParameters', {}) or {}
        user_id = query_params.get('id')
        
        if not user_id:
            return response(400, {'error': 'ID пользователя обязателен'})
        
        body_data = json.loads(event.get('body', '{}'))
        
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        if 'is_active' in body_data:
            cur.execute("""
                UPDATE users SET is_active = %s
                WHERE id = %s
                RETURNING id, username, full_name, position, photo_url, is_active
            """, (body_data['is_active'], user_id))
            
            updated_user = cur.fetchone()
            conn.commit()
            cur.close()
            
            return response(200, dict(updated_user))
        
        username = body_data.get('username', '').strip()
        full_name = body_data.get('full_name', '').strip()
        position = body_data.get('position', '').strip()
        photo_url = body_data.get('photo_url', '').strip()
        password = body_data.get('password')
        role_ids = body_data.get('role_ids')
        
        if not username or not full_name:
            return response(400, {'error': 'Логин и имя обязательны'})
        
        try:
            cur.execute("""
                UPDATE users 
                SET username = %s, full_name = %s, position = %s, photo_url = %s
                WHERE id = %s
            """, (username, full_name, position, photo_url, user_id))
            
            if password and len(password) >= 4:
                password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (password_hash, user_id))
            
            if role_ids is not None:
                cur.execute("DELETE FROM user_roles WHERE user_id = %s", (user_id,))
                for role_id in role_ids:
                    cur.execute("""
                        INSERT INTO user_roles (user_id, role_id, assigned_by)
                        VALUES (%s, %s, %s)
                    """, (user_id, role_id, user_payload['user_id']))
            
            conn.commit()
            
            cur.execute("""
                SELECT 
                    u.id, u.username, u.full_name, u.position, u.photo_url, u.is_active, 
                    u.created_at, u.last_login,
                    COALESCE(
                        array_agg(json_build_object('id', r.id, 'name', r.name)) FILTER (WHERE r.id IS NOT NULL),
                        ARRAY[]::json[]
                    ) as roles
                FROM users u
                LEFT JOIN user_roles ur ON u.id = ur.user_id
                LEFT JOIN roles r ON ur.role_id = r.id
                WHERE u.id = %s
                GROUP BY u.id
            """, (user_id,))
            
            updated_user = cur.fetchone()
            cur.close()
            
            return response(200, dict(updated_user))
            
        except psycopg2.IntegrityError as e:
            conn.rollback()
            cur.close()
            if 'username' in str(e):
                return response(409, {'error': 'Пользователь с таким логином уже существует'})
            return response(409, {'error': 'Пользователь с таким email уже существует'})
    
    elif method == 'DELETE':
        user_payload, error = verify_token_and_permission(event, conn, 'users.delete')
        if error:
            return error
        
        query_params = event.get('queryStringParameters', {}) or {}
        user_id = query_params.get('id')
        
        if not user_id:
            return response(400, {'error': 'ID пользователя обязателен'})
        
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cur.execute("DELETE FROM user_roles WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM users WHERE id = %s RETURNING id, username", (user_id,))
            deleted_user = cur.fetchone()
            
            if not deleted_user:
                cur.close()
                return response(404, {'error': 'Пользователь не найден'})
            
            conn.commit()
            cur.close()
            
            return response(200, {'message': 'Пользователь удалён', 'id': deleted_user['id']})
        except Exception as e:
            conn.rollback()
            cur.close()
            return response(500, {'error': f'Ошибка при удалении: {str(e)}'})
    
    return response(405, {'error': 'Метод не поддерживается'})

def handle_users_list(method: str, event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Упрощённый endpoint для получения списка пользователей (без проверки прав)"""
    if method != 'GET':
        return response(405, {'error': 'Метод не поддерживается'})
    
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(f"""
            SELECT id, username, full_name
            FROM {SCHEMA}.users
            WHERE is_active = true
            ORDER BY full_name
        """)
        
        users_data = cur.fetchall()
        users = [dict(row) for row in users_data]
        
        return response(200, {'users': users})
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        cur.close()

# API handlers (simplified for context - keeping core logic)
def handle_categories(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            payload, error = verify_token_and_permission(event, conn, 'categories.read')
            if error:
                return error
            
            cur.execute('SELECT id, name, icon, created_at FROM categories ORDER BY name')
            rows = cur.fetchall()
            categories = [
                {
                    'id': row[0],
                    'name': row[1],
                    'icon': row[2],
                    'created_at': row[3].isoformat() if row[3] else None
                }
                for row in rows
            ]
            return response(200, categories)
        
        elif method == 'POST':
            payload, error = verify_token_and_permission(event, conn, 'categories.create')
            if error:
                return error
            
            body = json.loads(event.get('body', '{}'))
            cat_req = CategoryRequest(**body)
            
            cur.execute(
                "INSERT INTO categories (name, icon) VALUES (%s, %s) RETURNING id, name, icon, created_at",
                (cat_req.name, cat_req.icon)
            )
            row = cur.fetchone()
            conn.commit()
            
            return response(201, {
                'id': row[0],
                'name': row[1],
                'icon': row[2],
                'created_at': row[3].isoformat() if row[3] else None
            })
        
        elif method == 'PUT':
            body = json.loads(event.get('body', '{}'))
            category_id = body.get('id')
            cat_req = CategoryRequest(**body)
            
            if not category_id:
                return response(400, {'error': 'ID is required'})
            
            cur.execute(
                "UPDATE categories SET name = %s, icon = %s WHERE id = %s RETURNING id, name, icon, created_at",
                (cat_req.name, cat_req.icon, category_id)
            )
            row = cur.fetchone()
            
            if not row:
                return response(404, {'error': 'Category not found'})
            
            conn.commit()
            
            return response(200, {
                'id': row[0],
                'name': row[1],
                'icon': row[2],
                'created_at': row[3].isoformat() if row[3] else None
            })
        
        elif method == 'DELETE':
            payload, error = verify_token_and_permission(event, conn, 'categories.delete')
            if error:
                return error
            
            params = event.get('queryStringParameters', {})
            category_id = params.get('id')
            
            if not category_id:
                return response(400, {'error': 'ID is required'})
            
            cur.execute('SELECT COUNT(*) FROM payments WHERE category_id = %s', (category_id,))
            count = cur.fetchone()[0]
            
            if count > 0:
                return response(400, {'error': 'Cannot delete category with existing payments'})
            
            cur.execute('DELETE FROM categories WHERE id = %s', (category_id,))
            conn.commit()
            
            return response(200, {'success': True})
        
        return response(405, {'error': 'Method not allowed'})
    
    finally:
        cur.close()

def handle_ticket_service_categories(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            cur.execute(f'SELECT id, name, icon, created_at FROM {SCHEMA}.ticket_service_categories ORDER BY name')
            rows = cur.fetchall()
            categories = [
                {
                    'id': row[0],
                    'name': row[1],
                    'icon': row[2],
                    'created_at': row[3].isoformat() if row[3] else None
                }
                for row in rows
            ]
            return response(200, categories)
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            cat_req = CategoryRequest(**body)
            
            cur.execute(
                f"INSERT INTO {SCHEMA}.ticket_service_categories (name, icon) VALUES (%s, %s) RETURNING id, name, icon, created_at",
                (cat_req.name, cat_req.icon)
            )
            row = cur.fetchone()
            conn.commit()
            
            return response(201, {
                'id': row[0],
                'name': row[1],
                'icon': row[2],
                'created_at': row[3].isoformat() if row[3] else None
            })
        
        elif method == 'PUT':
            body = json.loads(event.get('body', '{}'))
            category_id = body.get('id')
            cat_req = CategoryRequest(**body)
            
            if not category_id:
                return response(400, {'error': 'ID is required'})
            
            cur.execute(
                f"UPDATE {SCHEMA}.ticket_service_categories SET name = %s, icon = %s WHERE id = %s RETURNING id, name, icon, created_at",
                (cat_req.name, cat_req.icon, category_id)
            )
            row = cur.fetchone()
            
            if not row:
                return response(404, {'error': 'Category not found'})
            
            conn.commit()
            
            return response(200, {
                'id': row[0],
                'name': row[1],
                'icon': row[2],
                'created_at': row[3].isoformat() if row[3] else None
            })
        
        elif method == 'DELETE':
            params = event.get('queryStringParameters', {})
            category_id = params.get('id')
            
            if not category_id:
                return response(400, {'error': 'ID is required'})
            
            cur.execute(f'DELETE FROM {SCHEMA}.ticket_service_categories WHERE id = %s', (category_id,))
            conn.commit()
            
            return response(200, {'success': True})
        
        return response(405, {'error': 'Method not allowed'})
    
    finally:
        cur.close()

def handle_saving_reasons(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            payload, error = verify_token_and_permission(event, conn, 'categories.read')
            if error:
                return error
            
            cur.execute('SELECT id, name, icon, created_at FROM saving_reasons WHERE is_active = true ORDER BY name')
            rows = cur.fetchall()
            reasons = [
                {
                    'id': row[0],
                    'name': row[1],
                    'icon': row[2],
                    'created_at': row[3].isoformat() if row[3] else None
                }
                for row in rows
            ]
            return response(200, reasons)
        
        elif method == 'POST':
            payload, error = verify_token_and_permission(event, conn, 'categories.create')
            if error:
                return error
            
            body = json.loads(event.get('body', '{}'))
            reason_req = SavingReasonRequest(**body)
            
            cur.execute(
                "INSERT INTO saving_reasons (name, icon) VALUES (%s, %s) RETURNING id, name, icon, created_at",
                (reason_req.name, reason_req.icon)
            )
            row = cur.fetchone()
            conn.commit()
            
            return response(201, {
                'id': row[0],
                'name': row[1],
                'icon': row[2],
                'created_at': row[3].isoformat() if row[3] else None
            })
        
        elif method == 'PUT':
            payload, error = verify_token_and_permission(event, conn, 'categories.update')
            if error:
                return error
            
            body = json.loads(event.get('body', '{}'))
            reason_id = body.get('id')
            reason_req = SavingReasonRequest(**body)
            
            if not reason_id:
                return response(400, {'error': 'ID is required'})
            
            cur.execute(
                "UPDATE saving_reasons SET name = %s, icon = %s WHERE id = %s RETURNING id, name, icon, created_at",
                (reason_req.name, reason_req.icon, reason_id)
            )
            row = cur.fetchone()
            
            if not row:
                return response(404, {'error': 'Saving reason not found'})
            
            conn.commit()
            
            return response(200, {
                'id': row[0],
                'name': row[1],
                'icon': row[2],
                'created_at': row[3].isoformat() if row[3] else None
            })
        
        elif method == 'DELETE':
            payload, error = verify_token_and_permission(event, conn, 'categories.delete')
            if error:
                return error
            
            params = event.get('queryStringParameters', {})
            reason_id = params.get('id')
            
            if not reason_id:
                return response(400, {'error': 'ID is required'})
            
            cur.execute('DELETE FROM saving_reasons WHERE id = %s', (reason_id,))
            conn.commit()
            
            return response(200, {'success': True})
        
        return response(405, {'error': 'Method not allowed'})
    
    finally:
        cur.close()

def handle_payments(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            payload, error = verify_token_and_permission(event, conn, 'payments.read')
            if error:
                return error
            
            cur.execute(f"""
                SELECT 
                    p.id, 
                    p.category_id,
                    c.name as category_name,
                    c.icon as category_icon,
                    p.amount, 
                    p.description, 
                    p.payment_date,
                    p.created_at,
                    p.legal_entity_id,
                    le.name as legal_entity_name,
                    p.contractor_id,
                    ct.name as contractor_name,
                    p.department_id,
                    cd.name as department_name,
                    p.status,
                    p.created_by,
                    u.username as created_by_name,
                    p.submitted_at,
                    p.tech_director_approved_at,
                    p.tech_director_approved_by,
                    p.ceo_approved_at,
                    p.ceo_approved_by,
                    p.service_id,
                    s.name as service_name,
                    s.description as service_description,
                    p.invoice_number,
                    p.invoice_date
                FROM {SCHEMA}.payments p
                LEFT JOIN {SCHEMA}.categories c ON p.category_id = c.id
                LEFT JOIN {SCHEMA}.legal_entities le ON p.legal_entity_id = le.id
                LEFT JOIN {SCHEMA}.contractors ct ON p.contractor_id = ct.id
                LEFT JOIN {SCHEMA}.customer_departments cd ON p.department_id = cd.id
                LEFT JOIN {SCHEMA}.users u ON p.created_by = u.id
                LEFT JOIN {SCHEMA}.services s ON p.service_id = s.id
                ORDER BY p.payment_date DESC
            """)
            rows = cur.fetchall()
            payments = [
                {
                    'id': row[0],
                    'category_id': row[1],
                    'category_name': row[2],
                    'category_icon': row[3],
                    'amount': float(row[4]),
                    'description': row[5],
                    'payment_date': row[6].isoformat() if row[6] else None,
                    'created_at': row[7].isoformat() if row[7] else None,
                    'legal_entity_id': row[8],
                    'legal_entity_name': row[9],
                    'contractor_id': row[10],
                    'contractor_name': row[11],
                    'department_id': row[12],
                    'department_name': row[13],
                    'status': row[14],
                    'created_by': row[15],
                    'created_by_name': row[16],
                    'submitted_at': row[17].isoformat() if row[17] else None,
                    'tech_director_approved_at': row[18].isoformat() if row[18] else None,
                    'tech_director_approved_by': row[19],
                    'ceo_approved_at': row[20].isoformat() if row[20] else None,
                    'ceo_approved_by': row[21],
                    'service_id': row[22],
                    'service_name': row[23],
                    'service_description': row[24],
                    'invoice_number': row[25],
                    'invoice_date': row[26].isoformat() if row[26] else None
                }
                for row in rows
            ]
            
            # Load custom fields for each payment
            for payment in payments:
                cur.execute(f"""
                    SELECT cf.id, cf.name, cf.field_type, cfv.value
                    FROM {SCHEMA}.custom_field_values cfv
                    JOIN {SCHEMA}.custom_fields cf ON cfv.custom_field_id = cf.id
                    WHERE cfv.payment_id = %s
                """, (payment['id'],))
                custom_fields = cur.fetchall()
                payment['custom_fields'] = [
                    {
                        'id': cf[0],
                        'name': cf[1],
                        'field_type': cf[2],
                        'value': cf[3]
                    }
                    for cf in custom_fields
                ]
            
            return response(200, payments)
        
        elif method == 'POST':
            payload, error = verify_token_and_permission(event, conn, 'payments.create')
            if error:
                return error
            
            try:
                body = json.loads(event.get('body', '{}'))
                pay_req = PaymentRequest(**body)
            except Exception as e:
                return response(400, {'error': f'Validation error: {str(e)}'})
            
            payment_date = pay_req.payment_date if pay_req.payment_date else datetime.now().isoformat()
            
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            try:
                cur.execute(
                    f"""SELECT name FROM {SCHEMA}.categories WHERE id = %s""",
                    (pay_req.category_id,)
                )
                category = cur.fetchone()
                if not category:
                    cur.close()
                    return response(400, {'error': 'Category not found'})
                
                category_name = category['name']
                
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.payments (category, category_id, amount, description, payment_date, legal_entity_id, contractor_id, department_id, service_id, invoice_number, invoice_date, created_by, status) 
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'draft') 
                       RETURNING id, category_id, amount, description, payment_date, created_at, legal_entity_id, contractor_id, department_id, service_id, invoice_number, invoice_date, status, created_by""",
                    (category_name, pay_req.category_id, pay_req.amount, pay_req.description, payment_date, 
                     pay_req.legal_entity_id, pay_req.contractor_id, pay_req.department_id, pay_req.service_id, 
                     pay_req.invoice_number, pay_req.invoice_date, payload['user_id'])
                )
                row = cur.fetchone()
                payment_id = row['id']
                
                # Save custom field values
                custom_fields_data = body.get('custom_fields', {})
                if custom_fields_data:
                    for field_id_str, field_value in custom_fields_data.items():
                        field_id = int(field_id_str)
                        cur.execute(
                            f"INSERT INTO {SCHEMA}.custom_field_values (payment_id, custom_field_id, value) VALUES (%s, %s, %s)",
                            (payment_id, field_id, str(field_value))
                        )
                
                conn.commit()
                
                # Audit log
                cur.execute(f"SELECT username FROM {SCHEMA}.users WHERE id = %s", (payload['user_id'],))
                username_row = cur.fetchone()
                username = username_row['username'] if username_row else 'Unknown'
                
                payment_data = {
                    'id': row['id'],
                    'category_id': row['category_id'],
                    'amount': float(row['amount']),
                    'description': row['description'],
                    'payment_date': row['payment_date'].isoformat() if row['payment_date'] else None,
                    'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                    'legal_entity_id': row['legal_entity_id'],
                    'contractor_id': row['contractor_id'],
                    'department_id': row['department_id'],
                    'service_id': row['service_id'],
                    'invoice_number': row['invoice_number'],
                    'invoice_date': row['invoice_date'].isoformat() if row['invoice_date'] else None,
                    'status': row['status'],
                    'created_by': row['created_by']
                }
                
                create_audit_log(
                    conn,
                    'payment',
                    row['id'],
                    'created',
                    payload['user_id'],
                    username,
                    new_values=payment_data
                )
                
                cur.close()
                return response(201, payment_data)
            except Exception as e:
                import traceback
                error_details = traceback.format_exc()
                print(f"Payment creation error: {str(e)}")
                print(f"Full traceback: {error_details}")
                conn.rollback()
                cur.close()
                return response(500, {'error': f'Database error: {str(e)}', 'details': error_details})
        
        elif method == 'PUT':
            payload, error = verify_token_and_permission(event, conn, 'payments.update')
            if error:
                return error
            
            body = json.loads(event.get('body', '{}'))
            payment_id = body.get('id')
            
            if not payment_id:
                return response(400, {'error': 'ID is required'})
            
            pay_req = PaymentRequest(**body)
            
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Получаем старое состояние
            cur.execute(f"SELECT * FROM {SCHEMA}.payments WHERE id = %s", (payment_id,))
            old_payment = cur.fetchone()
            
            if not old_payment:
                cur.close()
                return response(404, {'error': 'Payment not found'})
            
            cur.execute(
                f"""UPDATE {SCHEMA}.payments 
                   SET category_id = %s, amount = %s, description = %s, payment_date = %s, 
                       legal_entity_id = %s, contractor_id = %s, department_id = %s
                   WHERE id = %s 
                   RETURNING id, category_id, amount, description, payment_date, created_at, legal_entity_id, contractor_id, department_id""",
                (pay_req.category_id, pay_req.amount, pay_req.description, pay_req.payment_date,
                 pay_req.legal_entity_id, pay_req.contractor_id, pay_req.department_id, payment_id)
            )
            row = cur.fetchone()
            conn.commit()
            
            # Audit log
            cur.execute(f"SELECT username FROM {SCHEMA}.users WHERE id = %s", (payload['user_id'],))
            username_row = cur.fetchone()
            username = username_row['username'] if username_row else 'Unknown'
            
            new_payment_data = {
                'id': row['id'],
                'category_id': row['category_id'],
                'amount': float(row['amount']),
                'description': row['description'],
                'payment_date': row['payment_date'].isoformat() if row['payment_date'] else None,
                'legal_entity_id': row['legal_entity_id'],
                'contractor_id': row['contractor_id'],
                'department_id': row['department_id']
            }
            
            # Вычисляем изменённые поля
            changed_fields = {}
            for key in ['category_id', 'amount', 'description', 'payment_date', 'legal_entity_id', 'contractor_id', 'department_id']:
                old_val = old_payment.get(key)
                new_val = row[key] if key in row else None
                
                if key == 'amount':
                    old_val = float(old_val) if old_val else None
                    new_val = float(new_val) if new_val else None
                elif key == 'payment_date':
                    old_val = old_val.isoformat() if old_val else None
                    new_val = new_val.isoformat() if new_val else None
                
                if old_val != new_val:
                    changed_fields[key] = {'old': old_val, 'new': new_val}
            
            if changed_fields:
                create_audit_log(
                    conn,
                    'payment',
                    payment_id,
                    'updated',
                    payload['user_id'],
                    username,
                    changed_fields=changed_fields,
                    old_values=dict(old_payment),
                    new_values=new_payment_data
                )
            
            cur.close()
            return response(200, new_payment_data)
        
        elif method == 'DELETE':
            payload, error = verify_token_and_permission(event, conn, 'payments.delete')
            if error:
                return error
            
            params = event.get('queryStringParameters', {})
            payment_id = params.get('id')
            
            if not payment_id:
                return response(400, {'error': 'ID is required'})
            
            cur.execute('DELETE FROM payments WHERE id = %s', (payment_id,))
            conn.commit()
            
            return response(200, {'success': True})
        
        return response(405, {'error': 'Method not allowed'})
    
    finally:
        cur.close()

def handle_stats(method: str, conn) -> Dict[str, Any]:
    if method != 'GET':
        return response(405, {'error': 'Method not allowed'})
    
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT 
                c.id,
                c.name,
                c.icon,
                COALESCE(SUM(p.amount), 0) as total
            FROM categories c
            LEFT JOIN payments p ON c.id = p.category_id
            GROUP BY c.id, c.name, c.icon
            ORDER BY total DESC
        """)
        
        rows = cur.fetchall()
        stats = [
            {
                'id': row[0],
                'name': row[1],
                'icon': row[2],
                'total': float(row[3])
            }
            for row in rows
        ]
        
        cur.execute('SELECT COALESCE(SUM(amount), 0) as grand_total FROM payments')
        grand_total = float(cur.fetchone()[0])
        
        return response(200, {
            'categories': stats,
            'grand_total': grand_total
        })
    
    finally:
        cur.close()

def handle_legal_entities(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            payload, error = verify_token_and_permission(event, conn, 'legal_entities.read')
            if error:
                return error
            
            cur.execute('SELECT id, name, inn, kpp, address, created_at FROM legal_entities ORDER BY name')
            rows = cur.fetchall()
            entities = [
                {
                    'id': row[0],
                    'name': row[1],
                    'inn': row[2] or '',
                    'kpp': row[3] or '',
                    'address': row[4] or '',
                    'created_at': row[5].isoformat() if row[5] else None
                }
                for row in rows
            ]
            return response(200, entities)
        
        elif method == 'POST':
            payload, error = verify_token_and_permission(event, conn, 'legal_entities.create')
            if error:
                return error
            
            body = json.loads(event.get('body', '{}'))
            entity_req = LegalEntityRequest(**body)
            
            cur.execute(
                "INSERT INTO legal_entities (name, inn, kpp, address) VALUES (%s, %s, %s, %s) RETURNING id, name, inn, kpp, address, created_at",
                (entity_req.name, entity_req.inn, entity_req.kpp, entity_req.address)
            )
            row = cur.fetchone()
            conn.commit()
            
            return response(201, {
                'id': row[0],
                'name': row[1],
                'inn': row[2] or '',
                'kpp': row[3] or '',
                'address': row[4] or '',
                'created_at': row[5].isoformat() if row[5] else None
            })
        
        elif method == 'PUT':
            payload, error = verify_token_and_permission(event, conn, 'legal_entities.update')
            if error:
                return error
            
            body = json.loads(event.get('body', '{}'))
            entity_id = body.get('id')
            entity_req = LegalEntityRequest(**body)
            
            if not entity_id:
                return response(400, {'error': 'ID is required'})
            
            cur.execute(
                "UPDATE legal_entities SET name = %s, inn = %s, kpp = %s, address = %s WHERE id = %s RETURNING id, name, inn, kpp, address, created_at",
                (entity_req.name, entity_req.inn, entity_req.kpp, entity_req.address, entity_id)
            )
            row = cur.fetchone()
            
            if not row:
                return response(404, {'error': 'Legal entity not found'})
            
            conn.commit()
            
            return response(200, {
                'id': row[0],
                'name': row[1],
                'inn': row[2] or '',
                'kpp': row[3] or '',
                'address': row[4] or '',
                'created_at': row[5].isoformat() if row[5] else None
            })
        
        elif method == 'DELETE':
            payload, error = verify_token_and_permission(event, conn, 'legal_entities.delete')
            if error:
                return error
            
            body_data = json.loads(event.get('body', '{}'))
            entity_id = body_data.get('id')
            
            cur.execute("DELETE FROM legal_entities WHERE id = %s RETURNING id", (entity_id,))
            row = cur.fetchone()
            
            if not row:
                return response(404, {'error': 'Legal entity not found'})
            
            conn.commit()
            return response(200, {'message': 'Legal entity deleted'})
        
        return response(405, {'error': 'Method not allowed'})
    
    finally:
        cur.close()

def handle_custom_fields(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            payload, error = verify_token_and_permission(event, conn, 'custom_fields.read')
            if error:
                return error
            
            cur.execute('SELECT id, name, field_type, options, created_at FROM custom_fields ORDER BY created_at DESC')
            rows = cur.fetchall()
            fields = [
                {
                    'id': row[0],
                    'name': row[1],
                    'field_type': row[2],
                    'options': row[3] or '',
                    'created_at': row[4].isoformat() if row[4] else None
                }
                for row in rows
            ]
            return response(200, fields)
        
        elif method == 'POST':
            payload, error = verify_token_and_permission(event, conn, 'custom_fields.create')
            if error:
                return error
            
            body = json.loads(event.get('body', '{}'))
            field_req = CustomFieldRequest(**body)
            
            cur.execute(
                "INSERT INTO custom_fields (name, field_type, options) VALUES (%s, %s, %s) RETURNING id, name, field_type, options, created_at",
                (field_req.name, field_req.field_type, field_req.options)
            )
            row = cur.fetchone()
            conn.commit()
            
            return response(201, {
                'id': row[0],
                'name': row[1],
                'field_type': row[2],
                'options': row[3] or '',
                'created_at': row[4].isoformat() if row[4] else None
            })
        
        elif method == 'PUT':
            payload, error = verify_token_and_permission(event, conn, 'custom_fields.update')
            if error:
                return error
            
            body = json.loads(event.get('body', '{}'))
            field_id = body.get('id')
            field_req = CustomFieldRequest(**body)
            
            if not field_id:
                return response(400, {'error': 'ID is required'})
            
            cur.execute(
                "UPDATE custom_fields SET name = %s, field_type = %s, options = %s WHERE id = %s RETURNING id, name, field_type, options, created_at",
                (field_req.name, field_req.field_type, field_req.options, field_id)
            )
            row = cur.fetchone()
            
            if not row:
                return response(404, {'error': 'Custom field not found'})
            
            conn.commit()
            
            return response(200, {
                'id': row[0],
                'name': row[1],
                'field_type': row[2],
                'options': row[3] or '',
                'created_at': row[4].isoformat() if row[4] else None
            })
        
        elif method == 'DELETE':
            payload, error = verify_token_and_permission(event, conn, 'custom_fields.delete')
            if error:
                return error
            
            body_data = json.loads(event.get('body', '{}'))
            field_id = body_data.get('id')
            
            cur.execute("DELETE FROM custom_fields WHERE id = %s RETURNING id", (field_id,))
            row = cur.fetchone()
            
            if not row:
                return response(404, {'error': 'Custom field not found'})
            
            conn.commit()
            return response(200, {'message': 'Custom field deleted'})
        
        return response(405, {'error': 'Method not allowed'})
    
    finally:
        cur.close()

def handle_contractors(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            payload, error = verify_token_and_permission(event, conn, 'contractors.read')
            if error:
                return error
            
            cur.execute('''SELECT id, name, inn, kpp, ogrn, legal_address, actual_address, phone, email, 
                          contact_person, bank_name, bank_bik, bank_account, correspondent_account, notes, created_at 
                          FROM contractors ORDER BY name''')
            rows = cur.fetchall()
            contractors = [
                {
                    'id': row[0],
                    'name': row[1],
                    'inn': row[2] or '',
                    'kpp': row[3] or '',
                    'ogrn': row[4] or '',
                    'legal_address': row[5] or '',
                    'actual_address': row[6] or '',
                    'phone': row[7] or '',
                    'email': row[8] or '',
                    'contact_person': row[9] or '',
                    'bank_name': row[10] or '',
                    'bank_bik': row[11] or '',
                    'bank_account': row[12] or '',
                    'correspondent_account': row[13] or '',
                    'notes': row[14] or '',
                    'created_at': row[15].isoformat() if row[15] else None
                }
                for row in rows
            ]
            return response(200, contractors)
        
        elif method == 'POST':
            payload, error = verify_token_and_permission(event, conn, 'contractors.create')
            if error:
                return error
            
            body = json.loads(event.get('body', '{}'))
            cont_req = ContractorRequest(**body)
            
            cur.execute(
                """INSERT INTO contractors (name, inn, kpp, ogrn, legal_address, actual_address, phone, email, 
                   contact_person, bank_name, bank_bik, bank_account, correspondent_account, notes) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) 
                   RETURNING id, name, inn, kpp, ogrn, legal_address, actual_address, phone, email, 
                   contact_person, bank_name, bank_bik, bank_account, correspondent_account, notes, created_at""",
                (cont_req.name, cont_req.inn, cont_req.kpp, cont_req.ogrn, cont_req.legal_address,
                 cont_req.actual_address, cont_req.phone, cont_req.email, cont_req.contact_person,
                 cont_req.bank_name, cont_req.bank_bik, cont_req.bank_account, cont_req.correspondent_account, cont_req.notes)
            )
            row = cur.fetchone()
            conn.commit()
            
            return response(201, {
                'id': row[0],
                'name': row[1],
                'inn': row[2] or '',
                'kpp': row[3] or '',
                'ogrn': row[4] or '',
                'legal_address': row[5] or '',
                'actual_address': row[6] or '',
                'phone': row[7] or '',
                'email': row[8] or '',
                'contact_person': row[9] or '',
                'bank_name': row[10] or '',
                'bank_bik': row[11] or '',
                'bank_account': row[12] or '',
                'correspondent_account': row[13] or '',
                'notes': row[14] or '',
                'created_at': row[15].isoformat() if row[15] else None
            })
        
        elif method == 'PUT':
            payload, error = verify_token_and_permission(event, conn, 'contractors.update')
            if error:
                return error
            
            body = json.loads(event.get('body', '{}'))
            contractor_id = body.get('id')
            cont_req = ContractorRequest(**body)
            
            if not contractor_id:
                return response(400, {'error': 'ID is required'})
            
            cur.execute(
                """UPDATE contractors SET name = %s, inn = %s, kpp = %s, ogrn = %s, legal_address = %s, 
                   actual_address = %s, phone = %s, email = %s, contact_person = %s, bank_name = %s, 
                   bank_bik = %s, bank_account = %s, correspondent_account = %s, notes = %s 
                   WHERE id = %s 
                   RETURNING id, name, inn, kpp, ogrn, legal_address, actual_address, phone, email, 
                   contact_person, bank_name, bank_bik, bank_account, correspondent_account, notes, created_at""",
                (cont_req.name, cont_req.inn, cont_req.kpp, cont_req.ogrn, cont_req.legal_address,
                 cont_req.actual_address, cont_req.phone, cont_req.email, cont_req.contact_person,
                 cont_req.bank_name, cont_req.bank_bik, cont_req.bank_account, cont_req.correspondent_account,
                 cont_req.notes, contractor_id)
            )
            row = cur.fetchone()
            
            if not row:
                return response(404, {'error': 'Contractor not found'})
            
            conn.commit()
            
            return response(200, {
                'id': row[0],
                'name': row[1],
                'inn': row[2] or '',
                'kpp': row[3] or '',
                'ogrn': row[4] or '',
                'legal_address': row[5] or '',
                'actual_address': row[6] or '',
                'phone': row[7] or '',
                'email': row[8] or '',
                'contact_person': row[9] or '',
                'bank_name': row[10] or '',
                'bank_bik': row[11] or '',
                'bank_account': row[12] or '',
                'correspondent_account': row[13] or '',
                'notes': row[14] or '',
                'created_at': row[15].isoformat() if row[15] else None
            })
        
        elif method == 'DELETE':
            payload, error = verify_token_and_permission(event, conn, 'contractors.delete')
            if error:
                return error
            
            body_data = json.loads(event.get('body', '{}'))
            contractor_id = body_data.get('id')
            
            cur.execute("DELETE FROM contractors WHERE id = %s RETURNING id", (contractor_id,))
            row = cur.fetchone()
            
            if not row:
                return response(404, {'error': 'Contractor not found'})
            
            conn.commit()
            return response(200, {'message': 'Contractor deleted'})
        
        return response(405, {'error': 'Method not allowed'})
    
    finally:
        cur.close()

def handle_roles(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            payload, error = verify_token_and_permission(event, conn, 'roles.read')
            if error:
                return error
            
            params = event.get('queryStringParameters') or {}
            role_id = params.get('id')
            
            if role_id:
                cur.execute(
                    f'SELECT id, name, description, created_at FROM {SCHEMA}.roles WHERE id = %s',
                    (role_id,)
                )
                row = cur.fetchone()
                if not row:
                    return response(404, {'error': 'Role not found'})
                
                cur.execute(
                    f'''SELECT p.id, p.name, p.resource, p.action, p.description 
                       FROM {SCHEMA}.permissions p 
                       JOIN {SCHEMA}.role_permissions rp ON p.id = rp.permission_id 
                       WHERE rp.role_id = %s''',
                    (role_id,)
                )
                perm_rows = cur.fetchall()
                
                return response(200, {
                    'id': row[0],
                    'name': row[1],
                    'description': row[2],
                    'created_at': row[3].isoformat() if row[3] else None,
                    'permissions': [{
                        'id': pr[0],
                        'name': pr[1],
                        'resource': pr[2],
                        'action': pr[3],
                        'description': pr[4]
                    } for pr in perm_rows]
                })
            
            cur.execute(f'SELECT id, name, description, created_at FROM {SCHEMA}.roles ORDER BY id')
            rows = cur.fetchall()
            result = []
            for row in rows:
                cur.execute(
                    f'''SELECT p.id, p.name, p.resource, p.action, p.description 
                       FROM {SCHEMA}.permissions p 
                       JOIN {SCHEMA}.role_permissions rp ON p.id = rp.permission_id 
                       WHERE rp.role_id = %s''',
                    (row[0],)
                )
                perm_rows = cur.fetchall()
                
                cur.execute(f'SELECT COUNT(*) FROM {SCHEMA}.user_roles WHERE role_id = %s', (row[0],))
                user_count = cur.fetchone()[0]
                
                result.append({
                    'id': row[0],
                    'name': row[1],
                    'description': row[2],
                    'created_at': row[3].isoformat() if row[3] else None,
                    'user_count': user_count,
                    'permissions': [{
                        'id': pr[0],
                        'name': pr[1],
                        'resource': pr[2],
                        'action': pr[3],
                        'description': pr[4]
                    } for pr in perm_rows]
                })
            return response(200, result)
        
        elif method == 'POST':
            payload, error = verify_token_and_permission(event, conn, 'roles.create')
            if error:
                return error
            
            body = json.loads(event.get('body', '{}'))
            role_req = RoleRequest(**body)
            
            cur.execute(
                f"INSERT INTO {SCHEMA}.roles (name, description) VALUES (%s, %s) RETURNING id, name, description, created_at",
                (role_req.name, role_req.description)
            )
            row = cur.fetchone()
            role_id = row[0]
            
            for perm_id in role_req.permission_ids:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.role_permissions (role_id, permission_id) VALUES (%s, %s)",
                    (role_id, perm_id)
                )
            
            conn.commit()
            
            return response(201, {
                'id': row[0],
                'name': row[1],
                'description': row[2],
                'created_at': row[3].isoformat() if row[3] else None
            })
        
        elif method == 'PUT':
            payload, error = verify_token_and_permission(event, conn, 'roles.update')
            if error:
                return error
            
            body = json.loads(event.get('body', '{}'))
            role_id = body.get('id')
            role_req = RoleRequest(**body)
            
            if not role_id:
                return response(400, {'error': 'ID is required'})
            
            cur.execute(
                f"UPDATE {SCHEMA}.roles SET name = %s, description = %s WHERE id = %s RETURNING id, name, description, created_at",
                (role_req.name, role_req.description, role_id)
            )
            row = cur.fetchone()
            
            if not row:
                return response(404, {'error': 'Role not found'})
            
            cur.execute(f"DELETE FROM {SCHEMA}.role_permissions WHERE role_id = %s", (role_id,))
            
            for perm_id in role_req.permission_ids:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.role_permissions (role_id, permission_id) VALUES (%s, %s)",
                    (role_id, perm_id)
                )
            
            conn.commit()
            
            return response(200, {
                'id': row[0],
                'name': row[1],
                'description': row[2],
                'created_at': row[3].isoformat() if row[3] else None
            })
        
        elif method == 'DELETE':
            payload, error = verify_token_and_permission(event, conn, 'roles.delete')
            if error:
                return error
            
            body_data = json.loads(event.get('body', '{}'))
            role_id = body_data.get('id')
            
            if not role_id:
                return response(400, {'error': 'ID is required'})
            
            cur.execute(f'SELECT COUNT(*) FROM {SCHEMA}.user_roles WHERE role_id = %s', (role_id,))
            user_count = cur.fetchone()[0]
            
            if user_count > 0:
                return response(400, {'error': 'Cannot delete role with assigned users'})
            
            cur.execute(f"DELETE FROM {SCHEMA}.role_permissions WHERE role_id = %s", (role_id,))
            cur.execute(f"DELETE FROM {SCHEMA}.roles WHERE id = %s RETURNING id", (role_id,))
            row = cur.fetchone()
            
            if not row:
                return response(404, {'error': 'Role not found'})
            
            conn.commit()
            return response(200, {'message': 'Role deleted'})
        
        return response(405, {'error': 'Method not allowed'})
    
    finally:
        cur.close()

def handle_permissions(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            payload, error = verify_token_and_permission(event, conn, 'permissions.read')
            if error:
                return error
            
            cur.execute(f'SELECT id, name, resource, action, description, created_at FROM {SCHEMA}.permissions ORDER BY resource, action')
            rows = cur.fetchall()
            permissions = [
                {
                    'id': row[0],
                    'name': row[1],
                    'resource': row[2],
                    'action': row[3],
                    'description': row[4] or '',
                    'created_at': row[5].isoformat() if row[5] else None
                }
                for row in rows
            ]
            return response(200, permissions)
        
        elif method == 'POST':
            payload, error = verify_token_and_permission(event, conn, 'permissions.create')
            if error:
                return error
            
            body = json.loads(event.get('body', '{}'))
            perm_req = PermissionRequest(**body)
            
            cur.execute(
                f"INSERT INTO {SCHEMA}.permissions (name, resource, action, description) VALUES (%s, %s, %s, %s) RETURNING id, name, resource, action, description, created_at",
                (perm_req.name, perm_req.resource, perm_req.action, perm_req.description)
            )
            row = cur.fetchone()
            conn.commit()
            
            return response(201, {
                'id': row[0],
                'name': row[1],
                'resource': row[2],
                'action': row[3],
                'description': row[4] or '',
                'created_at': row[5].isoformat() if row[5] else None
            })
        
        elif method == 'PUT':
            payload, error = verify_token_and_permission(event, conn, 'permissions.update')
            if error:
                return error
            
            body = json.loads(event.get('body', '{}'))
            perm_id = body.get('id')
            perm_req = PermissionRequest(**body)
            
            if not perm_id:
                return response(400, {'error': 'ID is required'})
            
            cur.execute(
                f"UPDATE {SCHEMA}.permissions SET name = %s, resource = %s, action = %s, description = %s WHERE id = %s RETURNING id, name, resource, action, description, created_at",
                (perm_req.name, perm_req.resource, perm_req.action, perm_req.description, perm_id)
            )
            row = cur.fetchone()
            
            if not row:
                return response(404, {'error': 'Permission not found'})
            
            conn.commit()
            
            return response(200, {
                'id': row[0],
                'name': row[1],
                'resource': row[2],
                'action': row[3],
                'description': row[4] or '',
                'created_at': row[5].isoformat() if row[5] else None
            })
        
        elif method == 'DELETE':
            payload, error = verify_token_and_permission(event, conn, 'permissions.delete')
            if error:
                return error
            
            body_data = json.loads(event.get('body', '{}'))
            perm_id = body_data.get('id')
            
            if not perm_id:
                return response(400, {'error': 'ID is required'})
            
            cur.execute(f"DELETE FROM {SCHEMA}.role_permissions WHERE permission_id = %s", (perm_id,))
            cur.execute(f"DELETE FROM {SCHEMA}.permissions WHERE id = %s RETURNING id", (perm_id,))
            row = cur.fetchone()
            
            if not row:
                return response(404, {'error': 'Permission not found'})
            
            conn.commit()
            return response(200, {'message': 'Permission deleted'})
        
        return response(405, {'error': 'Method not allowed'})
    
    finally:
        cur.close()

def handle_customer_departments(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            payload, error = verify_token_and_permission(event, conn, 'customer_departments.read')
            if error:
                return error
            
            cur.execute('SELECT id, name, description, is_active, created_at FROM customer_departments WHERE is_active = true ORDER BY name')
            rows = cur.fetchall()
            departments = [
                {
                    'id': row[0],
                    'name': row[1],
                    'description': row[2] or '',
                    'is_active': row[3],
                    'created_at': row[4].isoformat() if row[4] else None
                }
                for row in rows
            ]
            return response(200, departments)
        
        elif method == 'POST':
            payload, error = verify_token_and_permission(event, conn, 'customer_departments.create')
            if error:
                return error
            
            body = json.loads(event.get('body', '{}'))
            dept_req = CustomerDepartmentRequest(**body)
            
            cur.execute(
                "INSERT INTO customer_departments (name, description) VALUES (%s, %s) RETURNING id, name, description, is_active, created_at",
                (dept_req.name, dept_req.description)
            )
            row = cur.fetchone()
            conn.commit()
            
            return response(201, {
                'id': row[0],
                'name': row[1],
                'description': row[2] or '',
                'is_active': row[3],
                'created_at': row[4].isoformat() if row[4] else None
            })
        
        elif method == 'PUT':
            payload, error = verify_token_and_permission(event, conn, 'customer_departments.update')
            if error:
                return error
            
            body = json.loads(event.get('body', '{}'))
            dept_id = body.get('id')
            dept_req = CustomerDepartmentRequest(**body)
            
            if not dept_id:
                return response(400, {'error': 'ID is required'})
            
            cur.execute(
                "UPDATE customer_departments SET name = %s, description = %s WHERE id = %s RETURNING id, name, description, is_active, created_at",
                (dept_req.name, dept_req.description, dept_id)
            )
            row = cur.fetchone()
            
            if not row:
                return response(404, {'error': 'Department not found'})
            
            conn.commit()
            
            return response(200, {
                'id': row[0],
                'name': row[1],
                'description': row[2] or '',
                'is_active': row[3],
                'created_at': row[4].isoformat() if row[4] else None
            })
        
        elif method == 'DELETE':
            payload, error = verify_token_and_permission(event, conn, 'customer_departments.remove')
            if error:
                return error
            
            body_data = json.loads(event.get('body', '{}'))
            dept_id = body_data.get('id')
            
            cur.execute("DELETE FROM customer_departments WHERE id = %s RETURNING id", (dept_id,))
            row = cur.fetchone()
            
            if not row:
                return response(404, {'error': 'Department not found'})
            
            conn.commit()
            return response(200, {'message': 'Department deleted'})
        
        return response(405, {'error': 'Method not allowed'})
    
    finally:
        cur.close()

def handle_approvals(method: str, event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    
    if method == 'POST':
        body_data = json.loads(event.get('body', '{}'))
        payment_id = body_data.get('payment_id')
        
        if not payment_id:
            return response(400, {'error': 'payment_id обязателен'})
        
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute(f"""
            SELECT p.status, p.created_by, p.service_id, 
                   s.intermediate_approver_id, s.final_approver_id
            FROM {SCHEMA}.payments p
            LEFT JOIN {SCHEMA}.services s ON p.service_id = s.id
            WHERE p.id = %s
        """, (payment_id,))
        
        payment = cur.fetchone()
        if not payment:
            cur.close()
            return response(404, {'error': 'Платеж не найден'})
        
        if payment['status'] != 'draft':
            cur.close()
            return response(400, {'error': 'Платеж уже отправлен на согласование'})
        
        if not payment['service_id']:
            cur.close()
            return response(400, {'error': 'Для отправки на согласование необходимо указать сервис'})
        
        cur.execute(f"""
            UPDATE {SCHEMA}.payments 
            SET status = 'pending_ceo', submitted_at = NOW()
            WHERE id = %s
        """, (payment_id,))
        
        cur.execute(f"""
            INSERT INTO {SCHEMA}.approvals (payment_id, approver_id, approver_role, action, comment)
            VALUES (%s, %s, 'creator', 'submitted', 'Отправлено на согласование')
        """, (payment_id, payload['user_id']))
        
        conn.commit()
        cur.close()
        
        return response(200, {'message': 'Платеж отправлен на согласование', 'status': 'pending_ceo'})
    
    elif method == 'PUT':
        body_data = json.loads(event.get('body', '{}'))
        
        req = ApprovalActionRequest(**body_data)
        user_id = payload['user_id']
        user_role = get_user_role(conn, user_id)
        
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute(f"""
            SELECT p.status, p.service_id, 
                   s.intermediate_approver_id, s.final_approver_id
            FROM {SCHEMA}.payments p
            LEFT JOIN {SCHEMA}.services s ON p.service_id = s.id
            WHERE p.id = %s
        """, (req.payment_id,))
        
        payment = cur.fetchone()
        if not payment:
            cur.close()
            return response(404, {'error': 'Платеж не найден'})
        
        current_status = payment['status']
        intermediate_approver = payment.get('intermediate_approver_id')
        final_approver = payment.get('final_approver_id')
        
        if current_status == 'pending_ceo' and user_id == final_approver:
            if req.action == 'approve':
                new_status = 'approved'
                cur.execute(f"""
                    UPDATE {SCHEMA}.payments 
                    SET status = %s, ceo_approved_at = NOW(), ceo_approved_by = %s
                    WHERE id = %s
                """, (new_status, user_id, req.payment_id))
            else:
                new_status = 'rejected'
                cur.execute(f"""
                    UPDATE {SCHEMA}.payments 
                    SET status = %s, ceo_approved_at = NOW(), ceo_approved_by = %s
                    WHERE id = %s
                """, (new_status, user_id, req.payment_id))
        
        else:
            cur.close()
            return response(403, {'error': 'У вас нет прав для этого действия'})
        
        try:
            print(f"[DEBUG] Inserting approval: payment_id={req.payment_id}, user_id={user_id}, user_role={user_role}, action={req.action}, comment={req.comment}")
            cur.execute(f"""
                INSERT INTO {SCHEMA}.approvals (payment_id, approver_id, approver_role, action, comment)
                VALUES (%s, %s, %s, %s, %s)
            """, (req.payment_id, user_id, user_role, req.action, req.comment))
            
            conn.commit()
        except Exception as e:
            print(f"[ERROR] Error saving to DB: {str(e)}")
            conn.rollback()
            cur.close()
            return response(500, {'error': f'Error saving to DB: {str(e)}'})
        
        # Audit log
        cur.execute(f"SELECT username FROM {SCHEMA}.users WHERE id = %s", (user_id,))
        username_row = cur.fetchone()
        username = username_row['username'] if username_row else 'Unknown'
        
        action_name = 'approved' if req.action == 'approve' else 'rejected'
        create_audit_log(
            conn,
            'payment',
            req.payment_id,
            action_name,
            user_id,
            username,
            changed_fields={'status': {'old': current_status, 'new': new_status}},
            metadata={'comment': req.comment, 'role': user_role}
        )
        
        cur.close()
        
        return response(200, {'message': 'Решение принято', 'status': new_status})
    
    elif method == 'GET':
        params = event.get('queryStringParameters') or {}
        payment_id = params.get('payment_id')
        
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        if payment_id:
            cur.execute(f"""
                SELECT a.*, u.full_name as approver_name
                FROM {SCHEMA}.approvals a
                JOIN {SCHEMA}.users u ON a.approver_id = u.id
                WHERE a.payment_id = %s
                ORDER BY a.created_at DESC
            """, (payment_id,))
        else:
            cur.execute(f"""
                SELECT a.*, u.full_name as approver_name, p.amount, p.description
                FROM {SCHEMA}.approvals a
                JOIN {SCHEMA}.users u ON a.approver_id = u.id
                JOIN {SCHEMA}.payments p ON a.payment_id = p.id
                ORDER BY a.created_at DESC
                LIMIT 100
            """)
        
        approvals = [dict(row) for row in cur.fetchall()]
        cur.close()
        
        return response(200, approvals)
    
    return response(405, {'error': 'Метод не поддерживается'})

def handle_services(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        if method == 'GET':
            payload, error = verify_token_and_permission(event, conn, 'services.read')
            if error:
                return error
            
            cur.execute(f"""
                SELECT 
                    s.id, s.name, s.description, 
                    s.intermediate_approver_id, s.final_approver_id,
                    s.customer_department_id, s.category_id,
                    s.created_at, s.updated_at,
                    u1.full_name as intermediate_approver_name,
                    u2.full_name as final_approver_name,
                    cd.name as customer_department_name,
                    c.name as category_name,
                    c.icon as category_icon
                FROM {SCHEMA}.services s
                LEFT JOIN {SCHEMA}.users u1 ON s.intermediate_approver_id = u1.id
                LEFT JOIN {SCHEMA}.users u2 ON s.final_approver_id = u2.id
                LEFT JOIN {SCHEMA}.customer_departments cd ON s.customer_department_id = cd.id
                LEFT JOIN {SCHEMA}.ticket_service_categories c ON s.category_id = c.id
                ORDER BY s.created_at DESC
            """)
            rows = cur.fetchall()
            services = [dict(row) for row in rows]
            return response(200, {'services': services})
        
        elif method == 'POST':
            payload, error = verify_token_and_permission(event, conn, 'services.create')
            if error:
                return error
            
            body = json.loads(event.get('body', '{}'))
            service_req = ServiceRequest(**body)
            
            cur.execute(
                f"""INSERT INTO {SCHEMA}.services 
                   (name, description, intermediate_approver_id, final_approver_id, customer_department_id, category_id, created_at, updated_at) 
                   VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW()) 
                   RETURNING id, name, description, intermediate_approver_id, final_approver_id, customer_department_id, category_id, created_at""",
                (service_req.name, service_req.description, 
                 service_req.intermediate_approver_id, service_req.final_approver_id,
                 service_req.customer_department_id, service_req.category_id)
            )
            row = cur.fetchone()
            conn.commit()
            
            return response(201, {
                'id': row['id'],
                'name': row['name'],
                'description': row['description'],
                'intermediate_approver_id': row['intermediate_approver_id'],
                'final_approver_id': row['final_approver_id'],
                'customer_department_id': row['customer_department_id'],
                'category_id': row['category_id'],
                'created_at': row['created_at'].isoformat() if row['created_at'] else None
            })
        
        elif method == 'PUT':
            payload, error = verify_token_and_permission(event, conn, 'services.update')
            if error:
                return error
            
            params = event.get('queryStringParameters') or {}
            service_id = params.get('id')
            
            if not service_id:
                return response(400, {'error': 'ID is required'})
            
            body = json.loads(event.get('body', '{}'))
            service_req = ServiceRequest(**body)
            
            cur.execute(
                f"""UPDATE {SCHEMA}.services 
                   SET name = %s, description = %s, 
                       intermediate_approver_id = %s, final_approver_id = %s,
                       customer_department_id = %s, category_id = %s,
                       updated_at = NOW()
                   WHERE id = %s 
                   RETURNING id, name, description, intermediate_approver_id, final_approver_id, customer_department_id, category_id, updated_at""",
                (service_req.name, service_req.description,
                 service_req.intermediate_approver_id, service_req.final_approver_id,
                 service_req.customer_department_id, service_req.category_id, service_id)
            )
            row = cur.fetchone()
            
            if not row:
                return response(404, {'error': 'Service not found'})
            
            conn.commit()
            
            return response(200, {
                'id': row['id'],
                'name': row['name'],
                'description': row['description'],
                'intermediate_approver_id': row['intermediate_approver_id'],
                'final_approver_id': row['final_approver_id'],
                'customer_department_id': row['customer_department_id'],
                'category_id': row['category_id'],
                'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None
            })
        
        elif method == 'DELETE':
            try:
                payload, error = verify_token_and_permission(event, conn, 'services.delete')
                if error:
                    return error
                
                params = event.get('queryStringParameters') or {}
                service_id = params.get('id')
                
                log(f"[DELETE SERVICE] Attempting to delete service_id={service_id}")
                
                if not service_id:
                    return response(400, {'error': 'ID is required'})
                
                cur.execute(f"SELECT COUNT(*) as cnt FROM {SCHEMA}.payments WHERE service_id = %s", (service_id,))
                payment_count = cur.fetchone()['cnt']
                
                cur.execute(f"SELECT COUNT(*) as cnt FROM {SCHEMA}.savings WHERE service_id = %s", (service_id,))
                saving_count = cur.fetchone()['cnt']
                
                log(f"[DELETE SERVICE] Dependencies: payments={payment_count}, savings={saving_count}")
                
                if payment_count > 0:
                    cur.execute(f"UPDATE {SCHEMA}.payments SET service_id = NULL WHERE service_id = %s", (service_id,))
                    log(f"[DELETE SERVICE] Detached {payment_count} payments")
                
                if saving_count > 0:
                    cur.execute(f"UPDATE {SCHEMA}.savings SET service_id = NULL WHERE service_id = %s", (service_id,))
                    log(f"[DELETE SERVICE] Detached {saving_count} savings")
                
                cur.execute(f"DELETE FROM {SCHEMA}.services WHERE id = %s RETURNING id, name", (service_id,))
                row = cur.fetchone()
                
                if not row:
                    return response(404, {'error': 'Service not found'})
                
                create_audit_log(
                    conn,
                    entity_type='service',
                    entity_id=service_id,
                    action='delete',
                    user_id=payload['user_id'],
                    username=payload.get('email', 'unknown'),
                    old_values={'id': row['id'], 'name': row['name']},
                    metadata={'detached_payments': payment_count, 'detached_savings': saving_count}
                )
                
                conn.commit()
                log(f"[DELETE SERVICE] Successfully deleted service_id={service_id}")
                
                message = f"Услуга удалена"
                if payment_count > 0 or saving_count > 0:
                    message += f" (отвязано: платежей {payment_count}, экономий {saving_count})"
                
                return response(200, {'message': message, 'detached_payments': payment_count, 'detached_savings': saving_count})
            except Exception as e:
                conn.rollback()
                log(f"[DELETE SERVICE ERROR] {str(e)}")
                return response(500, {'error': f'Ошибка при удалении услуги: {str(e)}'})
        
        return response(405, {'error': 'Method not allowed'})
    
    except Exception as e:
        log(f"[HANDLE_SERVICES ERROR] {str(e)}")
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_savings(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        if method == 'GET':
            payload, error = verify_token_and_permission(event, conn, 'payments.read')
            if error:
                return error
            
            cur.execute(f"""
                SELECT 
                    s.id, s.service_id, s.description, s.amount, s.frequency, 
                    s.currency, s.employee_id, s.saving_reason_id, s.created_at,
                    srv.name as service_name,
                    u.full_name as employee_name,
                    sr.name as saving_reason_name,
                    sr.icon as saving_reason_icon
                FROM {SCHEMA}.savings s
                LEFT JOIN {SCHEMA}.services srv ON s.service_id = srv.id
                LEFT JOIN {SCHEMA}.users u ON s.employee_id = u.id
                LEFT JOIN {SCHEMA}.saving_reasons sr ON s.saving_reason_id = sr.id
                ORDER BY s.created_at DESC
            """)
            
            rows = cur.fetchall()
            return response(200, [dict(row) for row in rows])
        
        elif method == 'POST':
            payload, error = verify_token_and_permission(event, conn, 'payments.create')
            if error:
                return error
            
            body = json.loads(event.get('body', '{}'))
            saving_req = SavingRequest(**body)
            
            cur.execute(
                f"""INSERT INTO {SCHEMA}.savings 
                   (service_id, description, amount, frequency, currency, employee_id, saving_reason_id) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s) 
                   RETURNING id, service_id, description, amount, frequency, currency, employee_id, saving_reason_id, created_at""",
                (saving_req.service_id, saving_req.description, saving_req.amount, 
                 saving_req.frequency, saving_req.currency, saving_req.employee_id, saving_req.saving_reason_id)
            )
            
            row = cur.fetchone()
            conn.commit()
            
            return response(201, dict(row))
        
        elif method == 'DELETE':
            payload, error = verify_token_and_permission(event, conn, 'payments.delete')
            if error:
                return error
            
            params = event.get('queryStringParameters') or {}
            saving_id = params.get('id')
            
            if not saving_id:
                return response(400, {'error': 'ID is required'})
            
            cur.execute(f"DELETE FROM {SCHEMA}.savings WHERE id = %s RETURNING id", (saving_id,))
            row = cur.fetchone()
            
            if not row:
                return response(404, {'error': 'Saving not found'})
            
            conn.commit()
            return response(200, {'message': 'Saving deleted'})
        
        return response(405, {'error': 'Method not allowed'})
    
    finally:
        cur.close()

def handle_stats(event: Dict[str, Any], conn) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')
    
    if method != 'GET':
        return response(405, {'error': 'Метод не разрешен'})
    
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute(f"""
            SELECT 
                COUNT(*) as total_payments,
                COALESCE(SUM(amount), 0) as total_amount,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
            FROM {SCHEMA}.payments
        """)
        
        stats_data = dict(cur.fetchone())
        
        cur.execute(f"""
            SELECT 
                c.id,
                c.name,
                c.icon,
                COUNT(p.id) as payment_count,
                COALESCE(SUM(p.amount), 0) as total_amount
            FROM {SCHEMA}.categories c
            LEFT JOIN {SCHEMA}.payments p ON c.id = p.category_id
            GROUP BY c.id, c.name, c.icon
            ORDER BY total_amount DESC
        """)
        
        category_stats = [dict(row) for row in cur.fetchall()]
        
        cur.execute(f"""
            SELECT 
                d.id,
                d.name,
                d.description,
                COUNT(p.id) as payment_count,
                COALESCE(SUM(p.amount), 0) as total_amount
            FROM {SCHEMA}.customer_departments d
            LEFT JOIN {SCHEMA}.payments p ON d.id = p.department_id
            GROUP BY d.id, d.name, d.description
            ORDER BY total_amount DESC
        """)
        
        department_stats = [dict(row) for row in cur.fetchall()]
        
        cur.close()
        
        return response(200, {
            'stats': {
                'total_payments': stats_data['total_payments'],
                'total_amount': float(stats_data['total_amount']),
                'pending_count': stats_data['pending_count'],
                'approved_count': stats_data['approved_count'],
                'rejected_count': stats_data['rejected_count']
            },
            'category_stats': [{
                'id': c['id'],
                'name': c['name'],
                'icon': c['icon'],
                'payment_count': c['payment_count'],
                'total_amount': float(c['total_amount'])
            } for c in category_stats],
            'department_stats': [{
                'id': d['id'],
                'name': d['name'],
                'description': d['description'],
                'payment_count': d['payment_count'],
                'total_amount': float(d['total_amount'])
            } for d in department_stats]
        })
        
    except Exception as e:
        cur.close()
        return response(500, {'error': str(e)})

# Comments handlers
def handle_comments(method: str, event: Dict[str, Any], conn, current_user: Dict[str, Any]) -> Dict[str, Any]:
    if method == 'GET':
        payment_id = event.get('queryStringParameters', {}).get('payment_id')
        if not payment_id:
            return response(400, {'error': 'payment_id is required'})
        
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            cur.execute(f"""
                SELECT 
                    c.id,
                    c.payment_id,
                    c.user_id,
                    u.username,
                    u.full_name,
                    c.parent_comment_id,
                    c.comment_text,
                    c.created_at,
                    c.updated_at,
                    (SELECT COUNT(*) FROM {SCHEMA}.comment_likes WHERE comment_id = c.id) as likes_count,
                    EXISTS(SELECT 1 FROM {SCHEMA}.comment_likes WHERE comment_id = c.id AND user_id = %s) as user_liked
                FROM {SCHEMA}.payment_comments c
                JOIN {SCHEMA}.users u ON c.user_id = u.id
                WHERE c.payment_id = %s
                ORDER BY c.created_at ASC
            """, (current_user['id'], int(payment_id)))
            
            comments = cur.fetchall()
            cur.close()
            
            return response(200, [dict(c) for c in comments])
        except Exception as e:
            if cur:
                cur.close()
            return response(500, {'error': str(e)})
    
    elif method == 'POST':
        try:
            body = json.loads(event.get('body', '{}'))
            payment_id = body.get('payment_id')
            comment_text = body.get('comment_text', '').strip()
            parent_comment_id = body.get('parent_comment_id')
            
            if not payment_id or not comment_text:
                return response(400, {'error': 'payment_id and comment_text are required'})
            
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            cur.execute(f"""
                INSERT INTO {SCHEMA}.payment_comments 
                (payment_id, user_id, parent_comment_id, comment_text)
                VALUES (%s, %s, %s, %s)
                RETURNING id, payment_id, user_id, parent_comment_id, comment_text, created_at
            """, (payment_id, current_user['id'], parent_comment_id, comment_text))
            
            new_comment = cur.fetchone()
            conn.commit()
            cur.close()
            
            return response(201, dict(new_comment))
        except Exception as e:
            conn.rollback()
            if cur:
                cur.close()
            return response(500, {'error': str(e)})
    
    return response(405, {'error': 'Method not allowed'})

def handle_comment_likes(method: str, event: Dict[str, Any], conn, current_user: Dict[str, Any]) -> Dict[str, Any]:
    if method == 'POST':
        try:
            body = json.loads(event.get('body', '{}'))
            comment_id = body.get('comment_id')
            
            if not comment_id:
                return response(400, {'error': 'comment_id is required'})
            
            cur = conn.cursor()
            
            cur.execute(f"""
                INSERT INTO {SCHEMA}.comment_likes (comment_id, user_id)
                VALUES (%s, %s)
                ON CONFLICT (comment_id, user_id) DO NOTHING
            """, (comment_id, current_user['id']))
            
            conn.commit()
            cur.close()
            
            return response(200, {'success': True})
        except Exception as e:
            conn.rollback()
            if cur:
                cur.close()
            return response(500, {'error': str(e)})
    
    elif method == 'DELETE':
        try:
            body = json.loads(event.get('body', '{}'))
            comment_id = body.get('comment_id')
            
            if not comment_id:
                return response(400, {'error': 'comment_id is required'})
            
            cur = conn.cursor()
            
            cur.execute(f"""
                DELETE FROM {SCHEMA}.comment_likes
                WHERE comment_id = %s AND user_id = %s
            """, (comment_id, current_user['id']))
            
            conn.commit()
            cur.close()
            
            return response(200, {'success': True})
        except Exception as e:
            conn.rollback()
            if cur:
                cur.close()
            return response(500, {'error': str(e)})
    
    return response(405, {'error': 'Method not allowed'})

def handle_audit_logs(method: str, event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    '''Обработка запросов к audit logs'''
    if method == 'GET':
        params = event.get('queryStringParameters', {})
        entity_type = params.get('entity_type')
        entity_id = params.get('entity_id')
        user_id = params.get('user_id')
        action = params.get('action')
        limit = int(params.get('limit', 100))
        offset = int(params.get('offset', 0))
        
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            query = f"SELECT * FROM {SCHEMA}.audit_logs WHERE 1=1"
            query_params = []
            
            if entity_type:
                query += " AND entity_type = %s"
                query_params.append(entity_type)
            
            if entity_id:
                query += " AND entity_id = %s"
                query_params.append(int(entity_id))
            
            if user_id:
                query += " AND user_id = %s"
                query_params.append(int(user_id))
            
            if action:
                query += " AND action = %s"
                query_params.append(action)
            
            query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
            query_params.extend([limit, offset])
            
            cur.execute(query, tuple(query_params))
            logs = cur.fetchall()
            
            result = [dict(log) for log in logs]
            cur.close()
            
            return response(200, result)
        except Exception as e:
            if cur:
                cur.close()
            return response(500, {'error': str(e)})
    
    return response(405, {'error': 'Method not allowed'})

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''Главная функция-роутер для обработки всех запросов'''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    try:
        conn = get_db_connection()
    except Exception as e:
        return response(500, {'error': f'Database connection failed: {str(e)}'})
    
    try:
        endpoint = event.get('queryStringParameters', {}).get('endpoint', '')
        
        if endpoint == 'login' and method == 'POST':
            return handle_login(event, conn)
        
        if endpoint == 'health':
            return response(200, {'status': 'healthy'})
        
        payload = verify_token(event)
        if not payload:
            conn.close()
            return response(401, {'error': 'Unauthorized'})
        
        if endpoint == 'me':
            user_data = get_user_with_permissions(conn, payload['user_id'])
            conn.close()
            if not user_data:
                return response(404, {'error': 'User not found'})
            return response(200, user_data)
        
        if endpoint == 'payments':
            result = handle_payments(method, event, conn)
        elif endpoint == 'categories':
            result = handle_categories(method, event, conn)
        elif endpoint == 'legal-entities':
            result = handle_legal_entities(method, event, conn)
        elif endpoint == 'contractors':
            result = handle_contractors(method, event, conn)
        elif endpoint == 'customer-departments' or endpoint == 'customer_departments' or endpoint == 'departments':
            result = handle_customer_departments(method, event, conn)
        elif endpoint == 'custom-fields':
            result = handle_custom_fields(method, event, conn)
        elif endpoint == 'services':
            result = handle_services(method, event, conn)
        elif endpoint == 'savings':
            result = handle_savings(method, event, conn)
        elif endpoint == 'saving-reasons':
            result = handle_saving_reasons(method, event, conn)
        elif endpoint == 'users':
            result = handle_users(method, event, conn)
        elif endpoint == 'roles':
            result = handle_roles(method, event, conn)
        elif endpoint == 'permissions':
            result = handle_permissions(method, event, conn)
        elif endpoint == 'approvals':
            result = handle_approvals(method, event, conn, payload)
        elif endpoint == 'stats':
            result = handle_stats(method, event, conn)
        elif endpoint == 'comments':
            user_data = get_user_with_permissions(conn, payload['user_id'])
            result = handle_comments(method, event, conn, user_data)
        elif endpoint == 'comment-likes':
            user_data = get_user_with_permissions(conn, payload['user_id'])
            result = handle_comment_likes(method, event, conn, user_data)
        elif endpoint == 'audit-logs':
            result = handle_audit_logs(method, event, conn, payload)
        elif endpoint == 'tickets' or endpoint == 'tickets-api':
            result = handle_tickets_api(method, event, conn, payload)
        elif endpoint == 'ticket-dictionaries-api':
            result = handle_ticket_dictionaries_api(method, event, conn, payload)
        elif endpoint == 'ticket-comments-api':
            result = handle_ticket_comments_api(method, event, conn, payload)
        elif endpoint == 'ticket-history':
            result = handle_ticket_history(method, event, conn, payload)
        elif endpoint == 'users-list':
            result = handle_users_list(method, event, conn, payload)
        elif endpoint == 'tickets-bulk-actions':
            result = handle_tickets_bulk_actions(method, event, conn, payload)
        elif endpoint == 'notifications':
            result = handle_notifications(method, event, conn, payload)
        elif endpoint == 'dashboard-layout':
            result = handle_dashboard_layout(method, event, conn, payload)
        elif endpoint == 'dashboard-stats':
            result = handle_dashboard_stats(method, event, conn, payload)
        elif endpoint == 'budget-breakdown':
            result = handle_budget_breakdown(method, event, conn, payload)
        elif endpoint == 'savings-dashboard':
            result = handle_savings_dashboard(method, event, conn, payload)
        else:
            result = response(404, {'error': f'Endpoint not found: {endpoint}'})
        
        conn.close()
        return result
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error: {str(e)}")
        print(f"Traceback: {error_details}")
        conn.close()
        return response(500, {'error': str(e), 'details': error_details})

# Tickets handlers
def handle_tickets_api(method: str, event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Обработчик для управления заявками"""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    user_id = payload['user_id']
    
    try:
        if method == 'GET':
            query_params = event.get('queryStringParameters') or {}
            search = query_params.get('search', '')
            
            query = f"""
                SELECT 
                    t.id, t.title, t.description, t.due_date,
                    t.category_id, c.name as category_name, c.icon as category_icon,
                    t.priority_id, p.name as priority_name, p.level as priority_level, p.color as priority_color,
                    t.status_id, s.name as status_name, s.color as status_color,
                    t.department_id, d.name as department_name,
                    t.created_by, u.username as creator_name, u.email as creator_email,
                    t.assigned_to, ua.username as assignee_name, ua.email as assignee_email,
                    t.created_at, t.updated_at,
                    t.has_response,
                    COALESCE((
                        SELECT COUNT(*) 
                        FROM {SCHEMA}.ticket_comments tc 
                        WHERE tc.ticket_id = t.id 
                        AND tc.is_read = FALSE 
                        AND tc.user_id != %s
                    ), 0) as unread_comments
                FROM {SCHEMA}.tickets t
                LEFT JOIN {SCHEMA}.ticket_categories c ON t.category_id = c.id
                LEFT JOIN {SCHEMA}.ticket_priorities p ON t.priority_id = p.id
                LEFT JOIN {SCHEMA}.ticket_statuses s ON t.status_id = s.id
                LEFT JOIN {SCHEMA}.departments d ON t.department_id = d.id
                LEFT JOIN {SCHEMA}.users u ON t.created_by = u.id
                LEFT JOIN {SCHEMA}.users ua ON t.assigned_to = ua.id
                WHERE 1=1
            """
            
            params = [user_id]
            if search:
                query += " AND (t.title ILIKE %s OR t.description ILIKE %s OR c.name ILIKE %s)"
                search_pattern = f'%{search}%'
                params.extend([search_pattern, search_pattern, search_pattern])
            
            query += " ORDER BY t.created_at DESC"
            
            cur.execute(query, params)
            tickets = []
            for row in cur.fetchall():
                # Безопасная обработка дат с проверкой на корректность
                def safe_date_format(date_value):
                    if not date_value:
                        return None
                    try:
                        # Проверяем, что год в разумных пределах (1900-2100)
                        if hasattr(date_value, 'year') and (date_value.year < 1900 or date_value.year > 2100):
                            return None
                        return date_value.isoformat()
                    except:
                        return None
                
                tickets.append({
                    'id': row['id'],
                    'title': row['title'],
                    'description': row['description'],
                    'due_date': safe_date_format(row['due_date']),
                    'category_id': row['category_id'],
                    'category_name': row['category_name'],
                    'category_icon': row['category_icon'],
                    'priority_id': row['priority_id'],
                    'priority_name': row['priority_name'],
                    'priority_color': row['priority_color'],
                    'status_id': row['status_id'],
                    'status_name': row['status_name'],
                    'status_color': row['status_color'],
                    'department_id': row['department_id'],
                    'department_name': row['department_name'],
                    'created_by': row['created_by'],
                    'creator_name': row['creator_name'],
                    'creator_email': row['creator_email'],
                    'assigned_to': row['assigned_to'],
                    'assignee_name': row['assignee_name'],
                    'assignee_email': row['assignee_email'],
                    'created_at': safe_date_format(row['created_at']),
                    'updated_at': safe_date_format(row['updated_at']),
                    'unread_comments': row['unread_comments']
                })
            
            return response(200, {'tickets': tickets})
        
        elif method == 'POST':
            data = json.loads(event.get('body', '{}'))
            
            title = data.get('title')
            description = data.get('description')
            category_id = data.get('category_id')
            priority_id = data.get('priority_id')
            department_id = data.get('department_id')
            due_date = data.get('due_date')
            
            if not title or not description:
                return response(400, {'error': 'Название и описание обязательны'})
            
            cur.execute(f"""
                INSERT INTO {SCHEMA}.tickets (title, description, category_id, priority_id, department_id, due_date, created_by, status_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 1)
                RETURNING id
            """, (title, description, category_id, priority_id, department_id, due_date, user_id))
            
            ticket_id = cur.fetchone()['id']
            conn.commit()
            
            # Записываем в audit_logs
            cur.execute(f"""
                SELECT username FROM {SCHEMA}.users WHERE id = %s
            """, (user_id,))
            username = cur.fetchone()['username']
            
            cur.execute(f"""
                INSERT INTO {SCHEMA}.audit_logs 
                (entity_type, entity_id, action, user_id, username, new_values)
                VALUES ('ticket', %s, 'created', %s, %s, %s::jsonb)
            """, (ticket_id, user_id, username, json.dumps({'title': title, 'description': description})))
            conn.commit()
            
            return response(201, {'id': ticket_id, 'message': 'Заявка создана'})
        
        elif method == 'PUT':
            data = json.loads(event.get('body', '{}'))
            ticket_id = data.get('ticket_id')
            
            if not ticket_id:
                return response(400, {'error': 'ID заявки не указан'})
            
            # Получаем текущие значения для сравнения
            cur.execute(f"""
                SELECT title, description, status_id, assigned_to, priority_id, category_id, department_id, due_date 
                FROM {SCHEMA}.tickets WHERE id = %s
            """, (ticket_id,))
            old_data = cur.fetchone()
            
            title = data.get('title')
            description = data.get('description')
            status_id = data.get('status_id')
            assigned_to = data.get('assigned_to')
            priority_id = data.get('priority_id')
            category_id = data.get('category_id')
            department_id = data.get('department_id')
            due_date = data.get('due_date')
            
            update_parts = []
            params = []
            changed_fields = {}
            
            # Проверяем изменение заголовка
            if title is not None and title != old_data['title']:
                update_parts.append('title = %s')
                params.append(title)
                changed_fields['title'] = {'old': old_data['title'], 'new': title}
            
            # Проверяем изменение описания
            if description is not None and description != old_data['description']:
                update_parts.append('description = %s')
                params.append(description)
                changed_fields['description'] = {'old': old_data['description'], 'new': description}
            
            # Проверяем изменение приоритета
            if priority_id is not None and priority_id != old_data['priority_id']:
                update_parts.append('priority_id = %s')
                params.append(priority_id)
                
                if old_data['priority_id']:
                    cur.execute(f"SELECT name FROM {SCHEMA}.ticket_priorities WHERE id = %s", (old_data['priority_id'],))
                    old_priority = cur.fetchone()
                else:
                    old_priority = None
                    
                cur.execute(f"SELECT name FROM {SCHEMA}.ticket_priorities WHERE id = %s", (priority_id,))
                new_priority = cur.fetchone()
                
                changed_fields['priority'] = {
                    'old': old_priority['name'] if old_priority else None,
                    'new': new_priority['name'] if new_priority else None
                }
            
            # Проверяем изменение категории
            if category_id is not None and category_id != old_data['category_id']:
                update_parts.append('category_id = %s')
                params.append(category_id)
                
                if old_data['category_id']:
                    cur.execute(f"SELECT name FROM {SCHEMA}.ticket_categories WHERE id = %s", (old_data['category_id'],))
                    old_category = cur.fetchone()
                else:
                    old_category = None
                    
                cur.execute(f"SELECT name FROM {SCHEMA}.ticket_categories WHERE id = %s", (category_id,))
                new_category = cur.fetchone()
                
                changed_fields['category'] = {
                    'old': old_category['name'] if old_category else None,
                    'new': new_category['name'] if new_category else None
                }
            
            # Проверяем изменение отдела
            if department_id is not None and department_id != old_data['department_id']:
                update_parts.append('department_id = %s')
                params.append(department_id)
                
                if old_data['department_id']:
                    cur.execute(f"SELECT name FROM {SCHEMA}.departments WHERE id = %s", (old_data['department_id'],))
                    old_dept = cur.fetchone()
                else:
                    old_dept = None
                    
                cur.execute(f"SELECT name FROM {SCHEMA}.departments WHERE id = %s", (department_id,))
                new_dept = cur.fetchone()
                
                changed_fields['department'] = {
                    'old': old_dept['name'] if old_dept else None,
                    'new': new_dept['name'] if new_dept else None
                }
            
            # Проверяем изменение дедлайна
            if due_date is not None and str(due_date) != str(old_data['due_date']):
                update_parts.append('due_date = %s')
                params.append(due_date)
                changed_fields['due_date'] = {'old': str(old_data['due_date']) if old_data['due_date'] else None, 'new': str(due_date)}
            
            if status_id is not None and status_id != old_data['status_id']:
                update_parts.append('status_id = %s')
                params.append(status_id)
                
                # Получаем названия статусов
                cur.execute(f"SELECT name FROM {SCHEMA}.ticket_statuses WHERE id = %s", (old_data['status_id'],))
                old_status = cur.fetchone()
                cur.execute(f"SELECT name FROM {SCHEMA}.ticket_statuses WHERE id = %s", (status_id,))
                new_status = cur.fetchone()
                
                changed_fields['status'] = {
                    'old': old_status['name'] if old_status else None,
                    'new': new_status['name'] if new_status else None
                }
            
            if 'assigned_to' in data and assigned_to != old_data['assigned_to']:
                update_parts.append('assigned_to = %s')
                params.append(assigned_to)
                
                # Получаем имена пользователей
                if old_data['assigned_to']:
                    cur.execute(f"SELECT username FROM {SCHEMA}.users WHERE id = %s", (old_data['assigned_to'],))
                    old_assignee = cur.fetchone()
                else:
                    old_assignee = None
                
                if assigned_to:
                    cur.execute(f"SELECT username FROM {SCHEMA}.users WHERE id = %s", (assigned_to,))
                    new_assignee = cur.fetchone()
                else:
                    new_assignee = None
                
                changed_fields['assigned_to'] = {
                    'old': old_assignee['username'] if old_assignee else None,
                    'new': new_assignee['username'] if new_assignee else None
                }
            
            if not update_parts:
                return response(400, {'error': 'Нет данных для обновления'})
            
            update_parts.append('updated_at = CURRENT_TIMESTAMP')
            params.append(ticket_id)
            
            cur.execute(f"""
                UPDATE {SCHEMA}.tickets 
                SET {', '.join(update_parts)}
                WHERE id = %s
            """, tuple(params))
            conn.commit()
            
            # Записываем в audit_logs
            if changed_fields:
                cur.execute(f"""
                    SELECT username FROM {SCHEMA}.users WHERE id = %s
                """, (user_id,))
                username = cur.fetchone()['username']
                
                action = 'status_changed' if 'status' in changed_fields else 'assigned' if 'assigned_to' in changed_fields else 'updated'
                
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.audit_logs 
                    (entity_type, entity_id, action, user_id, username, changed_fields)
                    VALUES ('ticket', %s, %s, %s, %s, %s::jsonb)
                """, (ticket_id, action, user_id, username, json.dumps(changed_fields)))
                conn.commit()
            
            return response(200, {'message': 'Заявка обновлена'})
        
        return response(405, {'error': 'Метод не поддерживается'})
    
    except Exception as e:
        conn.rollback()
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_ticket_dictionaries_api(method: str, event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Обработчик для получения справочников заявок"""
    if method != 'GET':
        return response(405, {'error': 'Только GET запросы'})
    
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute(f"SELECT id, name, icon FROM {SCHEMA}.ticket_categories ORDER BY name")
        categories = [dict(row) for row in cur.fetchall()]
        
        cur.execute(f"SELECT id, name, level FROM {SCHEMA}.ticket_priorities ORDER BY level DESC")
        priorities = [dict(row) for row in cur.fetchall()]
        
        cur.execute(f"SELECT id, name, color FROM {SCHEMA}.ticket_statuses ORDER BY id")
        statuses = [dict(row) for row in cur.fetchall()]
        
        cur.execute(f"SELECT id, name, description FROM {SCHEMA}.departments ORDER BY name")
        departments = [dict(row) for row in cur.fetchall()]
        
        return response(200, {
            'categories': categories,
            'priorities': priorities,
            'statuses': statuses,
            'departments': departments,
            'custom_fields': []
        })
    
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_users_list(method: str, event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Обработчик для получения списка пользователей"""
    if method != 'GET':
        return response(405, {'error': 'Только GET запросы'})
    
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute(f"SELECT id, username as name, email, role FROM {SCHEMA}.users ORDER BY username")
        users = [dict(row) for row in cur.fetchall()]
        
        return response(200, {'users': users})
    
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_ticket_comments_api(method: str, event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Обработчик для комментариев к заявкам"""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    user_id = payload['user_id']
    
    try:
        if method == 'GET':
            query_params = event.get('queryStringParameters') or {}
            ticket_id = query_params.get('ticket_id')
            
            if not ticket_id:
                return response(400, {'error': 'ticket_id обязателен'})
            
            # Помечаем все комментарии в заявке как прочитанные для текущего пользователя
            cur.execute(f"""
                UPDATE {SCHEMA}.ticket_comments 
                SET is_read = TRUE
                WHERE ticket_id = %s AND user_id != %s AND is_read = FALSE
            """, (ticket_id, user_id))
            conn.commit()
            
            cur.execute(f"""
                SELECT 
                    tc.id, tc.ticket_id, tc.user_id, tc.comment, tc.is_internal, tc.created_at,
                    tc.parent_comment_id, tc.mentioned_user_ids,
                    u.username as user_name, u.email as user_email
                FROM {SCHEMA}.ticket_comments tc
                LEFT JOIN {SCHEMA}.users u ON tc.user_id = u.id
                WHERE tc.ticket_id = %s
                ORDER BY tc.created_at DESC
            """, (ticket_id,))
            
            comments = []
            for row in cur.fetchall():
                comment_id = row['id']
                
                # Загружаем вложения
                cur.execute(f"""
                    SELECT id, filename, url, size
                    FROM {SCHEMA}.comment_attachments
                    WHERE comment_id = %s
                    ORDER BY created_at ASC
                """, (comment_id,))
                attachments = [dict(a) for a in cur.fetchall()]
                
                # Загружаем реакции с агрегацией
                cur.execute(f"""
                    SELECT emoji, COUNT(*) as count, ARRAY_AGG(user_id) as users
                    FROM {SCHEMA}.comment_reactions
                    WHERE comment_id = %s
                    GROUP BY emoji
                """, (comment_id,))
                reactions = [{'emoji': r['emoji'], 'count': r['count'], 'users': r['users']} for r in cur.fetchall()]
                
                comments.append({
                    'id': row['id'],
                    'ticket_id': row['ticket_id'],
                    'user_id': row['user_id'],
                    'user_name': row['user_name'],
                    'user_email': row['user_email'],
                    'comment': row['comment'],
                    'is_internal': row['is_internal'],
                    'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                    'parent_comment_id': row['parent_comment_id'],
                    'mentioned_user_ids': row['mentioned_user_ids'] or [],
                    'attachments': attachments,
                    'reactions': reactions
                })
            
            return response(200, {'comments': comments})
        
        elif method == 'POST':
            data = json.loads(event.get('body', '{}'))
            
            ticket_id = data.get('ticket_id')
            comment_text = data.get('comment')
            is_internal = data.get('is_internal', False)
            is_ping = data.get('is_ping', False)
            attachments = data.get('attachments', [])
            parent_comment_id = data.get('parent_comment_id')
            mentioned_user_ids = data.get('mentioned_user_ids', [])
            
            if not ticket_id:
                return response(400, {'error': 'ticket_id обязателен'})
            
            if is_ping:
                cur.execute(f"""
                    SELECT assigned_to, created_by 
                    FROM {SCHEMA}.tickets 
                    WHERE id = %s
                """, (ticket_id,))
                
                ticket_info = cur.fetchone()
                if not ticket_info:
                    return response(404, {'error': 'Заявка не найдена'})
                
                if ticket_info['created_by'] != user_id:
                    return response(403, {'error': 'Только заказчик может запросить статус'})
                
                if not ticket_info['assigned_to']:
                    return response(400, {'error': 'У заявки нет назначенного исполнителя'})
                
                comment_text = '🔔 Заказчик запросил обновление статуса заявки'
            elif not comment_text:
                return response(400, {'error': 'comment обязателен'})
            
            cur.execute(f"""
                INSERT INTO {SCHEMA}.ticket_comments (ticket_id, user_id, comment, is_internal, parent_comment_id, mentioned_user_ids)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, created_at
            """, (ticket_id, user_id, comment_text, is_internal, parent_comment_id, mentioned_user_ids))
            
            result = cur.fetchone()
            comment_id = result['id']
            
            # Сохраняем вложения
            for attachment in attachments:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.comment_attachments (comment_id, filename, url, size)
                    VALUES (%s, %s, %s, %s)
                """, (comment_id, attachment['filename'], attachment['url'], attachment['size']))
            
            # Записываем в audit_logs
            cur.execute(f"""
                SELECT username FROM {SCHEMA}.users WHERE id = %s
            """, (user_id,))
            username = cur.fetchone()['username']
            
            cur.execute(f"""
                INSERT INTO {SCHEMA}.audit_logs 
                (entity_type, entity_id, action, user_id, username, metadata)
                VALUES ('ticket', %s, 'comment_added', %s, %s, %s::jsonb)
            """, (ticket_id, user_id, username, json.dumps({'is_ping': is_ping})))
            
            conn.commit()
            
            # Обновляем has_response если комментарий от исполнителя (не от заказчика)
            cur.execute(f"""
                UPDATE {SCHEMA}.tickets 
                SET updated_at = CURRENT_TIMESTAMP,
                    has_response = CASE 
                        WHEN assigned_to = %s AND created_by != %s THEN TRUE
                        ELSE has_response
                    END
                WHERE id = %s
            """, (user_id, user_id, ticket_id,))
            conn.commit()
            
            return response(201, {
                'id': result['id'],
                'created_at': result['created_at'].isoformat() if result['created_at'] else None,
                'message': 'Пинг отправлен' if is_ping else 'Комментарий добавлен'
            })
        
        return response(405, {'error': 'Метод не поддерживается'})
    
    except Exception as e:
        conn.rollback()
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_comment_reactions(method: str, event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Обработчик для реакций на комментарии"""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    user_id = payload['user_id']
    
    try:
        if method == 'POST':
            data = json.loads(event.get('body', '{}'))
            comment_id = data.get('comment_id')
            emoji = data.get('emoji')
            
            if not comment_id or not emoji:
                return response(400, {'error': 'comment_id и emoji обязательны'})
            
            # Проверяем, есть ли уже такая реакция от этого пользователя
            cur.execute(f"""
                SELECT id FROM {SCHEMA}.comment_reactions
                WHERE comment_id = %s AND user_id = %s AND emoji = %s
            """, (comment_id, user_id, emoji))
            
            existing = cur.fetchone()
            
            if existing:
                # Удаляем реакцию (toggle)
                cur.execute(f"""
                    DELETE FROM {SCHEMA}.comment_reactions
                    WHERE id = %s
                """, (existing['id'],))
                conn.commit()
                return response(200, {'message': 'Реакция удалена'})
            else:
                # Добавляем реакцию
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.comment_reactions (comment_id, user_id, emoji)
                    VALUES (%s, %s, %s)
                """, (comment_id, user_id, emoji))
                conn.commit()
                return response(201, {'message': 'Реакция добавлена'})
        
        return response(405, {'error': 'Метод не поддерживается'})
    
    except Exception as e:
        conn.rollback()
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_upload_file(event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Загрузка файла в S3"""
    import boto3
    import base64
    from datetime import datetime
    
    try:
        # Получаем данные из JSON body
        data = json.loads(event.get('body', '{}'))
        filename = data.get('filename', 'file')
        base64_data = data.get('data', '')
        content_type = data.get('content_type', 'application/octet-stream')
        
        if not base64_data:
            return response(400, {'error': 'Файл не предоставлен'})
        
        # Декодируем base64
        file_data = base64.b64decode(base64_data)
        
        # Генерируем безопасное имя файла
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        safe_filename = f"{timestamp}_{filename}"
        
        # Загружаем в S3
        s3 = boto3.client('s3',
            endpoint_url='https://bucket.poehali.dev',
            aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
            aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
        )
        
        s3_key = f"attachments/{safe_filename}"
        s3.put_object(
            Bucket='files', 
            Key=s3_key, 
            Body=file_data,
            ContentType=content_type
        )
        
        # Формируем URL
        cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{s3_key}"
        
        return response(200, {'url': cdn_url})
    
    except Exception as e:
        return response(500, {'error': str(e)})

def handle_ticket_history(method: str, event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Получение истории изменений заявки из audit_logs"""
    if method != 'GET':
        return response(405, {'error': 'Метод не поддерживается'})
    
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        query_params = event.get('queryStringParameters') or {}
        ticket_id = query_params.get('ticket_id')
        
        if not ticket_id:
            return response(400, {'error': 'ticket_id обязателен'})
        
        cur.execute(f"""
            SELECT 
                id,
                action,
                username,
                changed_fields,
                old_values,
                new_values,
                metadata,
                created_at
            FROM {SCHEMA}.audit_logs
            WHERE entity_type = 'ticket' AND entity_id = %s
            ORDER BY created_at DESC
        """, (ticket_id,))
        
        logs = cur.fetchall()
        
        return response(200, {'logs': logs if logs else []})
    
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_tickets_bulk_actions(method: str, event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Массовые операции над заявками"""
    if method != 'POST':
        return response(405, {'error': 'Метод не поддерживается'})
    
    cur = conn.cursor(cursor_factory=RealDictCursor)
    user_id = payload['user_id']
    
    try:
        body = json.loads(event.get('body', '{}'))
        ticket_ids = body.get('ticket_ids', [])
        action = body.get('action')
        
        if not ticket_ids or not action:
            return response(400, {'error': 'Не указаны ticket_ids или action'})
        
        results = []
        
        if action == 'change_status':
            status_id = body.get('status_id')
            if not status_id:
                return response(400, {'error': 'Не указан status_id'})
            
            for ticket_id in ticket_ids:
                try:
                    cur.execute(
                        f'UPDATE {SCHEMA}.tickets SET status_id = %s, updated_at = NOW() WHERE id = %s',
                        (status_id, ticket_id)
                    )
                    results.append({'ticket_id': ticket_id, 'success': True})
                except Exception as e:
                    results.append({'ticket_id': ticket_id, 'success': False, 'error': str(e)})
        
        elif action == 'change_priority':
            priority_id = body.get('priority_id')
            if not priority_id:
                return response(400, {'error': 'Не указан priority_id'})
            
            for ticket_id in ticket_ids:
                try:
                    cur.execute(
                        f'UPDATE {SCHEMA}.tickets SET priority_id = %s, updated_at = NOW() WHERE id = %s',
                        (priority_id, ticket_id)
                    )
                    results.append({'ticket_id': ticket_id, 'success': True})
                except Exception as e:
                    results.append({'ticket_id': ticket_id, 'success': False, 'error': str(e)})
        
        elif action == 'delete':
            for ticket_id in ticket_ids:
                try:
                    cur.execute(f'DELETE FROM {SCHEMA}.ticket_comments WHERE ticket_id = %s', (ticket_id,))
                    cur.execute(f'DELETE FROM {SCHEMA}.tickets WHERE id = %s', (ticket_id,))
                    results.append({'ticket_id': ticket_id, 'success': True})
                except Exception as e:
                    results.append({'ticket_id': ticket_id, 'success': False, 'error': str(e)})
        
        else:
            return response(400, {'error': f'Неизвестное действие: {action}'})
        
        conn.commit()
        
        success_count = sum(1 for r in results if r['success'])
        
        return response(200, {
            'success': True,
            'total': len(ticket_ids),
            'successful': success_count,
            'failed': len(ticket_ids) - success_count,
            'results': results
        })
    
    except Exception as e:
        conn.rollback()
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_notifications(method: str, event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Управление уведомлениями пользователей"""
    user_id = payload['user_id']
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        if method == 'GET':
            params = event.get('queryStringParameters') or {}
            unread_only = params.get('unread_only') == 'true'
            limit = int(params.get('limit', 50))
            
            query = f"""
                SELECT 
                    n.id,
                    n.ticket_id,
                    n.type,
                    n.message,
                    n.is_read,
                    n.created_at,
                    t.title as ticket_title
                FROM {SCHEMA}.notifications n
                LEFT JOIN {SCHEMA}.tickets t ON n.ticket_id = t.id
                WHERE n.user_id = %s
            """
            
            if unread_only:
                query += " AND n.is_read = false"
            
            query += " ORDER BY n.created_at DESC LIMIT %s"
            
            cur.execute(query, (user_id, limit))
            notifications = cur.fetchall()
            
            cur.execute(f"""
                SELECT COUNT(*) as unread_count
                FROM {SCHEMA}.notifications
                WHERE user_id = %s AND is_read = false
            """, (user_id,))
            
            unread_count = cur.fetchone()['unread_count']
            
            return response(200, {
                'notifications': [dict(n) for n in notifications],
                'unread_count': unread_count
            })
        
        elif method == 'PUT':
            body = json.loads(event.get('body', '{}'))
            notification_ids = body.get('notification_ids', [])
            mark_all = body.get('mark_all', False)
            
            if mark_all:
                cur.execute(f"""
                    UPDATE {SCHEMA}.notifications
                    SET is_read = true
                    WHERE user_id = %s AND is_read = false
                """, (user_id,))
            elif notification_ids:
                cur.execute(f"""
                    UPDATE {SCHEMA}.notifications
                    SET is_read = true
                    WHERE id = ANY(%s) AND user_id = %s
                """, (notification_ids, user_id))
            else:
                return response(400, {'error': 'notification_ids or mark_all is required'})
            
            conn.commit()
            affected_rows = cur.rowcount
            
            return response(200, {'message': f'Отмечено как прочитанные: {affected_rows}'})
        
        else:
            return response(405, {'error': 'Метод не поддерживается'})
    
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_dashboard_layout(method: str, event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Сохранение и загрузка расположения карточек дашборда"""
    user_id = payload['user_id']
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        if method == 'GET':
            cur.execute(
                f"SELECT card_id, x, y, width, height FROM {SCHEMA}.dashboard_layouts WHERE user_id = %s",
                (user_id,)
            )
            rows = cur.fetchall()
            layouts = [dict(row) for row in rows]
            
            return response(200, {'layouts': layouts})
        
        elif method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            layouts = body_data.get('layouts', [])
            
            for layout in layouts:
                cur.execute(
                    f"""
                    INSERT INTO {SCHEMA}.dashboard_layouts (user_id, card_id, x, y, width, height, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                    ON CONFLICT (user_id, card_id)
                    DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y, width = EXCLUDED.width, 
                                  height = EXCLUDED.height, updated_at = CURRENT_TIMESTAMP
                    """,
                    (user_id, layout['id'], layout['x'], layout['y'], layout['width'], layout['height'])
                )
            
            conn.commit()
            
            return response(200, {'success': True, 'message': 'Расположение сохранено'})
        
        else:
            return response(405, {'error': 'Метод не поддерживается'})
    
    except Exception as e:
        conn.rollback()
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_dashboard_stats(method: str, event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Статистика для главной карточки дашборда"""
    if method != 'GET':
        return response(405, {'error': 'Метод не поддерживается'})
    
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute(f"""
            SELECT 
                COALESCE(SUM(amount), 0) as total_amount,
                COUNT(*) as total_count
            FROM {SCHEMA}.payments
            WHERE EXTRACT(MONTH FROM payment_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                AND EXTRACT(YEAR FROM payment_date) = EXTRACT(YEAR FROM CURRENT_DATE)
        """)
        
        current_month = cur.fetchone()
        
        cur.execute(f"""
            SELECT 
                COALESCE(SUM(amount), 0) as total_amount
            FROM {SCHEMA}.payments
            WHERE EXTRACT(MONTH FROM payment_date) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')
                AND EXTRACT(YEAR FROM payment_date) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')
        """)
        
        previous_month = cur.fetchone()
        
        total_amount = float(current_month['total_amount'])
        total_count = current_month['total_count']
        previous_amount = float(previous_month['total_amount'])
        
        if previous_amount > 0:
            change_percent = round(((total_amount - previous_amount) / previous_amount) * 100, 1)
            is_increase = change_percent > 0
        else:
            change_percent = 0
            is_increase = False
        
        return response(200, {
            'total_amount': total_amount,
            'total_count': total_count,
            'change_percent': abs(change_percent),
            'is_increase': is_increase
        })
    
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_budget_breakdown(method: str, event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Детальная разбивка IT бюджета по категориям"""
    if method != 'GET':
        return response(405, {'error': 'Метод не поддерживается'})
    
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute(f"""
            SELECT 
                c.id as category_id,
                c.name,
                c.icon,
                COALESCE(SUM(p.amount), 0) as amount,
                COUNT(p.id) as payment_count
            FROM {SCHEMA}.categories c
            LEFT JOIN {SCHEMA}.payments p ON c.id = p.category_id
            GROUP BY c.id, c.name, c.icon
            HAVING COALESCE(SUM(p.amount), 0) > 0
            ORDER BY amount DESC
        """)
        
        categories = cur.fetchall()
        total_budget = sum(float(cat['amount']) for cat in categories)
        
        result = []
        for cat in categories:
            amount = float(cat['amount'])
            percentage = round((amount / total_budget * 100), 1) if total_budget > 0 else 0
            
            cur.execute(f"""
                SELECT 
                    COALESCE(s.name, 'Без сервиса') as service,
                    p.amount,
                    p.status
                FROM {SCHEMA}.payments p
                LEFT JOIN {SCHEMA}.services s ON p.service_id = s.id
                WHERE p.category_id = %s
                ORDER BY p.amount DESC
                LIMIT 5
            """, (cat['category_id'],))
            
            payments = [{'service': row['service'], 'amount': float(row['amount']), 'status': row['status']} 
                       for row in cur.fetchall()]
            
            result.append({
                'category_id': cat['category_id'],
                'name': cat['name'],
                'icon': cat['icon'],
                'amount': amount,
                'percentage': percentage,
                'payments': payments
            })
        
        return response(200, result)
    
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_savings_dashboard(method: str, event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Статистика экономии для дашборда"""
    if method != 'GET':
        return response(405, {'error': 'Метод не поддерживается'})
    
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute(f"""
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(amount), 0) as total_amount
            FROM {SCHEMA}.savings
        """)
        
        stats = cur.fetchone()
        
        cur.execute(f"""
            SELECT 
                cd.name as department_name,
                SUM(s.amount) as total_saved
            FROM {SCHEMA}.savings s
            JOIN {SCHEMA}.services srv ON s.service_id = srv.id
            LEFT JOIN {SCHEMA}.customer_departments cd ON srv.customer_department_id = cd.id
            GROUP BY cd.name
            ORDER BY total_saved DESC
            LIMIT 3
        """)
        
        top_departments = [dict(row) for row in cur.fetchall()]
        
        return response(200, {
            'total_amount': float(stats['total_amount']),
            'count': stats['count'],
            'top_departments': [{
                'department_name': dept['department_name'] or 'Не указан',
                'total_saved': float(dept['total_saved'])
            } for dept in top_departments]
        })
    
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        cur.close()