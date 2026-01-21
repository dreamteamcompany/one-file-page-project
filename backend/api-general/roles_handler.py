import json
import sys
from models import RoleRequest
from shared_utils import response

def log(msg):
    print(msg, file=sys.stderr, flush=True)

def handle_roles(method, event, conn, payload):
    cur = conn.cursor()
    try:
        if method == 'GET':
            cur.execute("""
                SELECT r.*, 
                       COALESCE(json_agg(DISTINCT jsonb_build_object(
                           'id', p.id, 'name', p.name, 'resource', p.resource, 'action', p.action
                       )) FILTER (WHERE p.id IS NOT NULL), '[]') as permissions
                FROM roles r
                LEFT JOIN role_permissions rp ON r.id = rp.role_id
                LEFT JOIN permissions p ON rp.permission_id = p.id
                GROUP BY r.id
                ORDER BY r.id
            """)
            roles = cur.fetchall()
            return response(200, [dict(r) for r in roles])
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            req = RoleRequest(**body)
            
            cur.execute("INSERT INTO roles (name, description) VALUES (%s, %s) RETURNING id",
                       (req.name, req.description))
            role_id = cur.fetchone()['id']
            
            for perm_id in req.permission_ids:
                cur.execute("INSERT INTO role_permissions (role_id, permission_id) VALUES (%s, %s)",
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
            
            cur.execute("UPDATE roles SET name=%s, description=%s WHERE id=%s",
                       (req.name, req.description, role_id))
            cur.execute("DELETE FROM role_permissions WHERE role_id=%s", (role_id,))
            
            for perm_id in req.permission_ids:
                cur.execute("INSERT INTO role_permissions (role_id, permission_id) VALUES (%s, %s)",
                           (role_id, perm_id))
            
            conn.commit()
            return response(200, {'message': 'Role updated'})
        
        elif method == 'DELETE':
            params = event.get('queryStringParameters', {}) or {}
            role_id = params.get('id')
            if not role_id:
                return response(400, {'error': 'Role ID required'})
            
            cur.execute("DELETE FROM roles WHERE id=%s", (role_id,))
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
