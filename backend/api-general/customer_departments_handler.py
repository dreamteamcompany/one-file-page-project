import json
import sys
from models import CustomerDepartmentRequest
from shared_utils import response

def log(msg):
    print(msg, file=sys.stderr, flush=True)

def handle_customer_departments(method, event, conn):
    cur = conn.cursor()
    try:
        if method == 'GET':
            cur.execute("SELECT * FROM customer_departments ORDER BY id")
            departments = cur.fetchall()
            return response(200, [dict(d) for d in departments])
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            req = CustomerDepartmentRequest(**body)
            
            cur.execute("""
                INSERT INTO customer_departments (name, description)
                VALUES (%s, %s) RETURNING id
            """, (req.name, req.description))
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
            
            cur.execute("""
                UPDATE customer_departments SET name=%s, description=%s
                WHERE id=%s
            """, (req.name, req.description, dept_id))
            conn.commit()
            return response(200, {'message': 'Department updated'})
        
        elif method == 'DELETE':
            params = event.get('queryStringParameters', {}) or {}
            dept_id = params.get('id')
            if not dept_id:
                return response(400, {'error': 'Department ID required'})
            
            cur.execute("DELETE FROM customer_departments WHERE id=%s", (dept_id,))
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
