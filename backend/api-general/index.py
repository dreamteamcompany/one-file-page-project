import json
import os
import sys
import jwt
import bcrypt
import psycopg2
from psycopg2.extras import RealDictCursor
from pydantic import BaseModel, Field

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p67567221_one_file_page_projec')
JWT_SECRET = os.environ.get('JWT_SECRET', 'super_secret_key_change_me')
DATABASE_URL = os.environ.get('DATABASE_URL')

def log(msg):
    print(msg, file=sys.stderr, flush=True)

def response(status: int, data: dict):
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
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

def verify_token(event: dict) -> dict | None:
    headers = event.get('headers', {})
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
    
    if not token:
        return None
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except:
        return None

class UserRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(default=None)
    full_name: str = Field(..., min_length=1)
    position: str = Field(default='')
    role_ids: list[int] = Field(default=[])
    photo_url: str = Field(default='')
    email: str = Field(default='')

class RoleRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(default='')
    permission_ids: list[int] = Field(default=[])

class CategoryRequest(BaseModel):
    name: str = Field(..., min_length=1)
    icon: str = Field(default='Tag')

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

class LegalEntityRequest(BaseModel):
    name: str = Field(..., min_length=1)
    inn: str = Field(default='')
    kpp: str = Field(default='')
    address: str = Field(default='')

class CustomerDepartmentRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(default='')

def handle_users(method, event, conn):
    cur = conn.cursor()
    try:
        if method == 'GET':
            params = event.get('queryStringParameters', {}) or {}
            user_id = params.get('id')
            
            if user_id:
                cur.execute(f"SELECT * FROM {SCHEMA}.users WHERE id = %s", (user_id,))
                user = cur.fetchone()
                if not user:
                    return response(404, {'error': 'User not found'})
                return response(200, dict(user))
            else:
                cur.execute(f"""
                    SELECT u.*, 
                           COALESCE(json_agg(DISTINCT jsonb_build_object('id', r.id, 'name', r.name)) 
                                    FILTER (WHERE r.id IS NOT NULL), '[]') as roles
                    FROM {SCHEMA}.users u
                    LEFT JOIN {SCHEMA}.user_roles ur ON u.id = ur.user_id
                    LEFT JOIN {SCHEMA}.roles r ON ur.role_id = r.id
                    GROUP BY u.id
                    ORDER BY u.id
                """)
                users = cur.fetchall()
                return response(200, [dict(u) for u in users])
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            req = UserRequest(**body)
            
            if not req.password:
                return response(400, {'error': 'Password required'})
            
            password_hash = bcrypt.hashpw(req.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            cur.execute(f"""
                INSERT INTO {SCHEMA}.users (username, password_hash, full_name, position, email, photo_url)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
            """, (req.username, password_hash, req.full_name, req.position, req.email, req.photo_url))
            user_id = cur.fetchone()['id']
            
            for role_id in req.role_ids:
                cur.execute(f"INSERT INTO {SCHEMA}.user_roles (user_id, role_id) VALUES (%s, %s)", (user_id, role_id))
            
            conn.commit()
            return response(201, {'id': user_id, 'message': 'User created'})
        
        elif method == 'PUT':
            params = event.get('queryStringParameters', {}) or {}
            user_id = params.get('id')
            if not user_id:
                return response(400, {'error': 'User ID required'})
            
            body = json.loads(event.get('body', '{}'))
            req = UserRequest(**body)
            
            if req.password:
                password_hash = bcrypt.hashpw(req.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                cur.execute(f"""
                    UPDATE {SCHEMA}.users 
                    SET username=%s, password_hash=%s, full_name=%s, position=%s, email=%s, photo_url=%s
                    WHERE id=%s
                """, (req.username, password_hash, req.full_name, req.position, req.email, req.photo_url, user_id))
            else:
                cur.execute(f"""
                    UPDATE {SCHEMA}.users 
                    SET username=%s, full_name=%s, position=%s, email=%s, photo_url=%s
                    WHERE id=%s
                """, (req.username, req.full_name, req.position, req.email, req.photo_url, user_id))
            
            cur.execute(f"DELETE FROM {SCHEMA}.user_roles WHERE user_id=%s", (user_id,))
            for role_id in req.role_ids:
                cur.execute(f"INSERT INTO {SCHEMA}.user_roles (user_id, role_id) VALUES (%s, %s)", (user_id, role_id))
            
            conn.commit()
            return response(200, {'message': 'User updated'})
        
        elif method == 'DELETE':
            params = event.get('queryStringParameters', {}) or {}
            user_id = params.get('id')
            if not user_id:
                return response(400, {'error': 'User ID required'})
            
            cur.execute(f"DELETE FROM {SCHEMA}.users WHERE id=%s", (user_id,))
            conn.commit()
            return response(200, {'message': 'User deleted'})
        
        else:
            return response(405, {'error': 'Method not allowed'})
    
    except Exception as e:
        conn.rollback()
        log(f"Error in handle_users: {str(e)}")
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_roles(method, event, conn, payload):
    cur = conn.cursor()
    try:
        if method == 'GET':
            cur.execute(f"""
                SELECT r.*, 
                       COALESCE(json_agg(DISTINCT jsonb_build_object(
                           'id', p.id, 'name', p.name, 'resource', p.resource, 'action', p.action
                       )) FILTER (WHERE p.id IS NOT NULL), '[]') as permissions
                FROM {SCHEMA}.roles r
                LEFT JOIN {SCHEMA}.role_permissions rp ON r.id = rp.role_id
                LEFT JOIN {SCHEMA}.permissions p ON rp.permission_id = p.id
                GROUP BY r.id
                ORDER BY r.id
            """)
            roles = cur.fetchall()
            return response(200, [dict(r) for r in roles])
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            req = RoleRequest(**body)
            
            cur.execute(f"INSERT INTO {SCHEMA}.roles (name, description) VALUES (%s, %s) RETURNING id",
                       (req.name, req.description))
            role_id = cur.fetchone()['id']
            
            for perm_id in req.permission_ids:
                cur.execute(f"INSERT INTO {SCHEMA}.role_permissions (role_id, permission_id) VALUES (%s, %s)",
                           (role_id, perm_id))
            
            conn.commit()
            return response(201, {'id': role_id, 'message': 'Role created'})
        
        elif method == 'PUT':
            params = event.get('queryStringParameters', {}) or {}
            role_id = params.get('id')
            if not role_id:
                return response(400, {'error': 'Role ID required'})
            
            body = json.loads(event.get('body', '{}'))
            req = RoleRequest(**body)
            
            cur.execute(f"UPDATE {SCHEMA}.roles SET name=%s, description=%s WHERE id=%s",
                       (req.name, req.description, role_id))
            cur.execute(f"DELETE FROM {SCHEMA}.role_permissions WHERE role_id=%s", (role_id,))
            
            for perm_id in req.permission_ids:
                cur.execute(f"INSERT INTO {SCHEMA}.role_permissions (role_id, permission_id) VALUES (%s, %s)",
                           (role_id, perm_id))
            
            conn.commit()
            return response(200, {'message': 'Role updated'})
        
        elif method == 'DELETE':
            params = event.get('queryStringParameters', {}) or {}
            role_id = params.get('id')
            if not role_id:
                return response(400, {'error': 'Role ID required'})
            
            cur.execute(f"DELETE FROM {SCHEMA}.roles WHERE id=%s", (role_id,))
            conn.commit()
            return response(200, {'message': 'Role deleted'})
        
        else:
            return response(405, {'error': 'Method not allowed'})
    
    except Exception as e:
        conn.rollback()
        log(f"Error in handle_roles: {str(e)}")
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_categories(method, event, conn):
    cur = conn.cursor()
    try:
        if method == 'GET':
            cur.execute(f"SELECT * FROM {SCHEMA}.categories ORDER BY id")
            categories = cur.fetchall()
            return response(200, [dict(c) for c in categories])
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            req = CategoryRequest(**body)
            
            cur.execute(f"INSERT INTO {SCHEMA}.categories (name, icon) VALUES (%s, %s) RETURNING id",
                       (req.name, req.icon))
            cat_id = cur.fetchone()['id']
            conn.commit()
            return response(201, {'id': cat_id, 'message': 'Category created'})
        
        elif method == 'PUT':
            params = event.get('queryStringParameters', {}) or {}
            cat_id = params.get('id')
            if not cat_id:
                return response(400, {'error': 'Category ID required'})
            
            body = json.loads(event.get('body', '{}'))
            req = CategoryRequest(**body)
            
            cur.execute(f"UPDATE {SCHEMA}.categories SET name=%s, icon=%s WHERE id=%s",
                       (req.name, req.icon, cat_id))
            conn.commit()
            return response(200, {'message': 'Category updated'})
        
        elif method == 'DELETE':
            params = event.get('queryStringParameters', {}) or {}
            cat_id = params.get('id')
            if not cat_id:
                return response(400, {'error': 'Category ID required'})
            
            cur.execute(f"DELETE FROM {SCHEMA}.categories WHERE id=%s", (cat_id,))
            conn.commit()
            return response(200, {'message': 'Category deleted'})
        
        else:
            return response(405, {'error': 'Method not allowed'})
    
    except Exception as e:
        conn.rollback()
        log(f"Error in handle_categories: {str(e)}")
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_contractors(method, event, conn, payload):
    cur = conn.cursor()
    try:
        if method == 'GET':
            cur.execute(f"SELECT * FROM {SCHEMA}.contractors ORDER BY id")
            contractors = cur.fetchall()
            return response(200, [dict(c) for c in contractors])
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            req = ContractorRequest(**body)
            
            cur.execute(f"""
                INSERT INTO {SCHEMA}.contractors 
                (name, inn, kpp, ogrn, legal_address, actual_address, phone, email, contact_person,
                 bank_name, bank_bik, bank_account, correspondent_account, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """, (req.name, req.inn, req.kpp, req.ogrn, req.legal_address, req.actual_address,
                  req.phone, req.email, req.contact_person, req.bank_name, req.bank_bik,
                  req.bank_account, req.correspondent_account, req.notes))
            contractor_id = cur.fetchone()['id']
            conn.commit()
            return response(201, {'id': contractor_id, 'message': 'Contractor created'})
        
        elif method == 'PUT':
            params = event.get('queryStringParameters', {}) or {}
            contractor_id = params.get('id')
            if not contractor_id:
                return response(400, {'error': 'Contractor ID required'})
            
            body = json.loads(event.get('body', '{}'))
            req = ContractorRequest(**body)
            
            cur.execute(f"""
                UPDATE {SCHEMA}.contractors 
                SET name=%s, inn=%s, kpp=%s, ogrn=%s, legal_address=%s, actual_address=%s,
                    phone=%s, email=%s, contact_person=%s, bank_name=%s, bank_bik=%s,
                    bank_account=%s, correspondent_account=%s, notes=%s
                WHERE id=%s
            """, (req.name, req.inn, req.kpp, req.ogrn, req.legal_address, req.actual_address,
                  req.phone, req.email, req.contact_person, req.bank_name, req.bank_bik,
                  req.bank_account, req.correspondent_account, req.notes, contractor_id))
            conn.commit()
            return response(200, {'message': 'Contractor updated'})
        
        elif method == 'DELETE':
            params = event.get('queryStringParameters', {}) or {}
            contractor_id = params.get('id')
            if not contractor_id:
                return response(400, {'error': 'Contractor ID required'})
            
            cur.execute(f"DELETE FROM {SCHEMA}.contractors WHERE id=%s", (contractor_id,))
            conn.commit()
            return response(200, {'message': 'Contractor deleted'})
        
        else:
            return response(405, {'error': 'Method not allowed'})
    
    except Exception as e:
        conn.rollback()
        log(f"Error in handle_contractors: {str(e)}")
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_legal_entities(method, event, conn, payload):
    cur = conn.cursor()
    try:
        if method == 'GET':
            cur.execute(f"SELECT * FROM {SCHEMA}.legal_entities ORDER BY id")
            entities = cur.fetchall()
            return response(200, [dict(e) for e in entities])
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            req = LegalEntityRequest(**body)
            
            cur.execute(f"INSERT INTO {SCHEMA}.legal_entities (name, inn, kpp, address) VALUES (%s, %s, %s, %s) RETURNING id",
                       (req.name, req.inn, req.kpp, req.address))
            entity_id = cur.fetchone()['id']
            conn.commit()
            return response(201, {'id': entity_id, 'message': 'Legal entity created'})
        
        elif method == 'PUT':
            params = event.get('queryStringParameters', {}) or {}
            entity_id = params.get('id')
            if not entity_id:
                return response(400, {'error': 'Legal entity ID required'})
            
            body = json.loads(event.get('body', '{}'))
            req = LegalEntityRequest(**body)
            
            cur.execute(f"UPDATE {SCHEMA}.legal_entities SET name=%s, inn=%s, kpp=%s, address=%s WHERE id=%s",
                       (req.name, req.inn, req.kpp, req.address, entity_id))
            conn.commit()
            return response(200, {'message': 'Legal entity updated'})
        
        elif method == 'DELETE':
            params = event.get('queryStringParameters', {}) or {}
            entity_id = params.get('id')
            if not entity_id:
                return response(400, {'error': 'Legal entity ID required'})
            
            cur.execute(f"DELETE FROM {SCHEMA}.legal_entities WHERE id=%s", (entity_id,))
            conn.commit()
            return response(200, {'message': 'Legal entity deleted'})
        
        else:
            return response(405, {'error': 'Method not allowed'})
    
    except Exception as e:
        conn.rollback()
        log(f"Error in handle_legal_entities: {str(e)}")
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_customer_departments(method, event, conn, payload):
    cur = conn.cursor()
    try:
        if method == 'GET':
            cur.execute(f"SELECT * FROM {SCHEMA}.customer_departments ORDER BY id")
            depts = cur.fetchall()
            return response(200, [dict(d) for d in depts])
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            req = CustomerDepartmentRequest(**body)
            
            cur.execute(f"INSERT INTO {SCHEMA}.customer_departments (name, description) VALUES (%s, %s) RETURNING id",
                       (req.name, req.description))
            dept_id = cur.fetchone()['id']
            conn.commit()
            return response(201, {'id': dept_id, 'message': 'Department created'})
        
        elif method == 'PUT':
            params = event.get('queryStringParameters', {}) or {}
            dept_id = params.get('id')
            if not dept_id:
                return response(400, {'error': 'Department ID required'})
            
            body = json.loads(event.get('body', '{}'))
            req = CustomerDepartmentRequest(**body)
            
            cur.execute(f"UPDATE {SCHEMA}.customer_departments SET name=%s, description=%s WHERE id=%s",
                       (req.name, req.description, dept_id))
            conn.commit()
            return response(200, {'message': 'Department updated'})
        
        elif method == 'DELETE':
            params = event.get('queryStringParameters', {}) or {}
            dept_id = params.get('id')
            if not dept_id:
                return response(400, {'error': 'Department ID required'})
            
            cur.execute(f"DELETE FROM {SCHEMA}.customer_departments WHERE id=%s", (dept_id,))
            conn.commit()
            return response(200, {'message': 'Department deleted'})
        
        else:
            return response(405, {'error': 'Method not allowed'})
    
    except Exception as e:
        conn.rollback()
        log(f"Error in handle_customer_departments: {str(e)}")
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handler(event, context):
    """Обработка запросов для справочников: users, roles, categories, contractors, legal_entities, customer_departments"""
    
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return response(200, {'message': 'OK'})
    
    params = event.get('queryStringParameters') or {}
    endpoint = params.get('endpoint', '')
    
    log(f"API-General handler - endpoint: {endpoint}, method: {method}")
    
    try:
        conn = get_db_connection()
    except Exception as e:
        log(f"Database connection error: {str(e)}")
        return response(500, {'error': 'Database connection failed'})
    
    try:
        payload = verify_token(event)
        
        if endpoint == 'users':
            return handle_users(method, event, conn)
        
        elif endpoint == 'roles':
            if not payload:
                return response(401, {'error': 'Требуется авторизация'})
            return handle_roles(method, event, conn, payload)
        
        elif endpoint == 'categories':
            return handle_categories(method, event, conn)
        
        elif endpoint == 'contractors':
            return handle_contractors(method, event, conn, payload)
        
        elif endpoint == 'legal_entities':
            return handle_legal_entities(method, event, conn, payload)
        
        elif endpoint == 'customer_departments':
            return handle_customer_departments(method, event, conn, payload)
        
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