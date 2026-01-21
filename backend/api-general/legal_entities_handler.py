import json
import sys
from models import LegalEntityRequest
from shared_utils import response

def log(msg):
    print(msg, file=sys.stderr, flush=True)

def handle_legal_entities(method, event, conn):
    cur = conn.cursor()
    try:
        if method == 'GET':
            cur.execute("SELECT * FROM legal_entities ORDER BY id")
            entities = cur.fetchall()
            return response(200, [dict(e) for e in entities])
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            req = LegalEntityRequest(**body)
            
            cur.execute("""
                INSERT INTO legal_entities (name, inn, kpp, address)
                VALUES (%s, %s, %s, %s) RETURNING id
            """, (req.name, req.inn, req.kpp, req.address))
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
            
            cur.execute("""
                UPDATE legal_entities SET name=%s, inn=%s, kpp=%s, address=%s
                WHERE id=%s
            """, (req.name, req.inn, req.kpp, req.address, entity_id))
            conn.commit()
            return response(200, {'message': 'Legal entity updated'})
        
        elif method == 'DELETE':
            params = event.get('queryStringParameters', {}) or {}
            entity_id = params.get('id')
            if not entity_id:
                return response(400, {'error': 'Legal entity ID required'})
            
            cur.execute("DELETE FROM legal_entities WHERE id=%s", (entity_id,))
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
