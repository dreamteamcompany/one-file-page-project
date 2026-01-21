import json
import sys
import bcrypt
from models import UserRequest
from shared_utils import response

def log(msg):
    print(msg, file=sys.stderr, flush=True)

def handle_users(method, event, conn):
    cur = conn.cursor()
    try:
        if method == 'GET':
            params = event.get('queryStringParameters', {}) or {}
            user_id = params.get('id')
            
            if user_id:
                cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
                user = cur.fetchone()
                if not user:
                    return response(404, {'error': 'User not found'})
                return response(200, dict(user))
            else:
                cur.execute("""
                    SELECT u.*, 
                           COALESCE(json_agg(DISTINCT jsonb_build_object('id', r.id, 'name', r.name)) 
                                    FILTER (WHERE r.id IS NOT NULL), '[]') as roles
                    FROM users u
                    LEFT JOIN user_roles ur ON u.id = ur.user_id
                    LEFT JOIN roles r ON ur.role_id = r.id
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
            
            cur.execute("""
                INSERT INTO users (username, password_hash, full_name, position, email, photo_url)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
            """, (req.username, password_hash, req.full_name, req.position, req.email, req.photo_url))
            user_id = cur.fetchone()['id']
            
            for role_id in req.role_ids:
                cur.execute("INSERT INTO user_roles (user_id, role_id) VALUES (%s, %s)", (user_id, role_id))
            
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
                cur.execute("""
                    UPDATE users 
                    SET username=%s, password_hash=%s, full_name=%s, position=%s, email=%s, photo_url=%s
                    WHERE id=%s
                """, (req.username, password_hash, req.full_name, req.position, req.email, req.photo_url, user_id))
            else:
                cur.execute("""
                    UPDATE users 
                    SET username=%s, full_name=%s, position=%s, email=%s, photo_url=%s
                    WHERE id=%s
                """, (req.username, req.full_name, req.position, req.email, req.photo_url, user_id))
            
            cur.execute("DELETE FROM user_roles WHERE user_id=%s", (user_id,))
            for role_id in req.role_ids:
                cur.execute("INSERT INTO user_roles (user_id, role_id) VALUES (%s, %s)", (user_id, role_id))
            
            conn.commit()
            return response(200, {'message': 'User updated'})
        
        elif method == 'DELETE':
            params = event.get('queryStringParameters', {}) or {}
            user_id = params.get('id')
            if not user_id:
                return response(400, {'error': 'User ID required'})
            
            cur.execute("DELETE FROM users WHERE id=%s", (user_id,))
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
