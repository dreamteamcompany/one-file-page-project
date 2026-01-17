import json
import os
import jwt
import bcrypt
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta

JWT_SECRET = os.environ.get('JWT_SECRET', 'super_secret_key_change_me')
DATABASE_URL = os.environ.get('DATABASE_URL')

def log(message: str):
    print(f"[AUTH] {message}", flush=True)

def response(status: int, data: dict):
    """Create standardized API response"""
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Id, Authorization'
        },
        'body': json.dumps(data, ensure_ascii=False, default=str)
    }

def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

def create_token(user_id: int, username: str) -> str:
    """Create JWT token"""
    payload = {
        'user_id': user_id,
        'username': username,
        'exp': datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def verify_token(event: dict) -> dict | None:
    """Verify JWT token from headers"""
    headers = event.get('headers', {})
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
    
    if not token:
        return None
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        log("Token expired")
        return None
    except jwt.InvalidTokenError as e:
        log(f"Invalid token: {str(e)}")
        return None

def handle_login(event: dict, conn):
    """Handle user login"""
    try:
        body = json.loads(event.get('body', '{}'))
        username = body.get('username', '').strip()
        password = body.get('password', '')
        
        log(f"Login attempt for username: {username}")
        
        if not username or not password:
            return response(400, {'error': 'Требуются имя пользователя и пароль'})
        
        cur = conn.cursor()
        cur.execute("""
            SELECT u.id, u.username, u.email, u.full_name, u.password_hash, u.is_active,
                   COALESCE(json_agg(DISTINCT jsonb_build_object(
                       'id', r.id, 
                       'name', r.name,
                       'description', r.description
                   )) FILTER (WHERE r.id IS NOT NULL), '[]') as roles,
                   COALESCE(json_agg(DISTINCT jsonb_build_object(
                       'name', p.name,
                       'resource', p.resource,
                       'action', p.action
                   )) FILTER (WHERE p.id IS NOT NULL), '[]') as permissions
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            WHERE u.username = %s
            GROUP BY u.id
        """, (username,))
        
        user = cur.fetchone()
        cur.close()
        
        if not user:
            log(f"User not found: {username}")
            return response(401, {'error': 'Неверное имя пользователя или пароль'})
        
        if not user['is_active']:
            log(f"Inactive user attempted login: {username}")
            return response(403, {'error': 'Учетная запись отключена'})
        
        if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            log(f"Invalid password for user: {username}")
            return response(401, {'error': 'Неверное имя пользователя или пароль'})
        
        cur = conn.cursor()
        cur.execute("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = %s", (user['id'],))
        conn.commit()
        cur.close()
        
        token = create_token(user['id'], user['username'])
        
        log(f"Login successful for user: {username}")
        
        return response(200, {
            'token': token,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'full_name': user['full_name'],
                'is_active': user['is_active'],
                'last_login': user.get('last_login'),
                'roles': user['roles'] if user['roles'] else [],
                'permissions': user['permissions'] if user['permissions'] else []
            }
        })
    
    except Exception as e:
        log(f"Login error: {str(e)}")
        import traceback
        log(traceback.format_exc())
        return response(500, {'error': str(e)})

def handle_me(event: dict, conn, payload: dict):
    """Get current user info"""
    try:
        user_id = payload['user_id']
        
        cur = conn.cursor()
        cur.execute("""
            SELECT u.id, u.username, u.email, u.full_name, u.is_active, u.last_login,
                   COALESCE(json_agg(DISTINCT jsonb_build_object(
                       'id', r.id,
                       'name', r.name,
                       'description', r.description
                   )) FILTER (WHERE r.id IS NOT NULL), '[]') as roles,
                   COALESCE(json_agg(DISTINCT jsonb_build_object(
                       'name', p.name,
                       'resource', p.resource,
                       'action', p.action
                   )) FILTER (WHERE p.id IS NOT NULL), '[]') as permissions
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            WHERE u.id = %s
            GROUP BY u.id
        """, (user_id,))
        
        user = cur.fetchone()
        cur.close()
        
        if not user:
            return response(404, {'error': 'Пользователь не найден'})
        
        return response(200, {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'full_name': user['full_name'],
            'is_active': user['is_active'],
            'last_login': user['last_login'],
            'roles': user['roles'] if user['roles'] else [],
            'permissions': user['permissions'] if user['permissions'] else []
        })
    
    except Exception as e:
        log(f"Me error: {str(e)}")
        return response(500, {'error': str(e)})

def handle_refresh(event: dict, conn, payload: dict):
    """Refresh JWT token"""
    try:
        user_id = payload['user_id']
        username = payload['username']
        
        cur = conn.cursor()
        cur.execute("SELECT is_active FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        cur.close()
        
        if not user or not user['is_active']:
            return response(401, {'error': 'Недействительный токен'})
        
        new_token = create_token(user_id, username)
        
        return response(200, {'token': new_token})
    
    except Exception as e:
        log(f"Refresh error: {str(e)}")
        return response(500, {'error': str(e)})

def handler(event, context):
    """Обработка запросов авторизации (login, me, refresh)"""
    
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return response(200, {'message': 'OK'})
    
    params = event.get('queryStringParameters') or {}
    endpoint = params.get('endpoint', '')
    
    log(f"Auth handler - endpoint: {endpoint}, method: {method}")
    
    try:
        conn = get_db_connection()
    except Exception as e:
        log(f"Database connection error: {str(e)}")
        return response(500, {'error': 'Database connection failed'})
    
    try:
        if endpoint == 'login':
            return handle_login(event, conn)
        
        payload = verify_token(event)
        
        if endpoint == 'me':
            if not payload:
                return response(401, {'error': 'Требуется авторизация'})
            return handle_me(event, conn, payload)
        
        elif endpoint == 'refresh':
            if not payload:
                return response(401, {'error': 'Требуется авторизация'})
            return handle_refresh(event, conn, payload)
        
        else:
            return response(404, {'error': f'Unknown endpoint: {endpoint}'})
    
    except Exception as e:
        log(f"Handler error: {str(e)}")
        import traceback
        log(traceback.format_exc())
        return response(500, {'error': str(e)})
    
    finally:
        try:
            conn.close()
        except:
            pass
