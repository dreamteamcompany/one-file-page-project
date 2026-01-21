import json
import sys
from models import CategoryRequest
from shared_utils import response

def log(msg):
    print(msg, file=sys.stderr, flush=True)

def handle_categories(method, event, conn):
    cur = conn.cursor()
    try:
        if method == 'GET':
            cur.execute("SELECT * FROM categories ORDER BY id")
            categories = cur.fetchall()
            return response(200, [dict(c) for c in categories])
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            req = CategoryRequest(**body)
            
            cur.execute("INSERT INTO categories (name, icon) VALUES (%s, %s) RETURNING id",
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
            
            cur.execute("UPDATE categories SET name=%s, icon=%s WHERE id=%s",
                       (req.name, req.icon, cat_id))
            conn.commit()
            return response(200, {'message': 'Category updated'})
        
        elif method == 'DELETE':
            params = event.get('queryStringParameters', {}) or {}
            cat_id = params.get('id')
            if not cat_id:
                return response(400, {'error': 'Category ID required'})
            
            cur.execute("DELETE FROM categories WHERE id=%s", (cat_id,))
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
