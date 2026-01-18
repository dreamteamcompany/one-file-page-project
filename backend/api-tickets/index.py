"""
API для работы с заявками (tickets) и категориями сервисов (service_categories)
"""
import json
import os
import jwt
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p67567221_one_file_page_projec')

class TicketRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = Field(default='')
    status_id: int = Field(..., gt=0)
    priority_id: int = Field(..., gt=0)
    assigned_to: Optional[int] = None
    service_ids: list[int] = Field(default=[])
    custom_fields: dict = Field(default={})

class ServiceCategoryRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(default='')
    icon: str = Field(default='Folder')

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
    return psycopg2.connect(dsn, cursor_factory=RealDictCursor, options=f'-c search_path={SCHEMA},public')

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

def handler(event: dict, context) -> dict:
    """API для работы с заявками и категориями сервисов"""
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return response(200, {})
    
    endpoint = event.get('queryStringParameters', {}).get('endpoint', '')
    
    try:
        conn = get_db_connection()
    except Exception as e:
        return response(500, {'error': f'Database connection failed: {str(e)}'})
    
    try:
        if endpoint == 'tickets':
            return handle_tickets(method, event, conn)
        elif endpoint == 'service_categories':
            return handle_service_categories(method, event, conn)
        else:
            return response(400, {'error': 'Unknown endpoint'})
    finally:
        try:
            conn.close()
        except:
            pass

def handle_tickets(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    
    if method == 'GET':
        query_params = event.get('queryStringParameters', {})
        
        status_id = query_params.get('status_id')
        priority_id = query_params.get('priority_id')
        assigned_to = query_params.get('assigned_to')
        created_by = query_params.get('created_by')
        service_id = query_params.get('service_id')
        from_date = query_params.get('from_date')
        to_date = query_params.get('to_date')
        
        cur = conn.cursor()
        
        query = """
            SELECT DISTINCT t.*, 
                   s.name as status_name, s.color as status_color,
                   p.name as priority_name, p.color as priority_color,
                   u1.username as assigned_to_name,
                   u2.username as created_by_name
            FROM tickets t
            LEFT JOIN ticket_statuses s ON t.status_id = s.id
            LEFT JOIN ticket_priorities p ON t.priority_id = p.id
            LEFT JOIN users u1 ON t.assigned_to = u1.id
            LEFT JOIN users u2 ON t.created_by = u2.id
            LEFT JOIN ticket_service_mappings tsm ON t.id = tsm.ticket_id
            WHERE 1=1
        """
        
        params = []
        
        if status_id:
            query += " AND t.status_id = %s"
            params.append(int(status_id))
        
        if priority_id:
            query += " AND t.priority_id = %s"
            params.append(int(priority_id))
        
        if assigned_to:
            query += " AND t.assigned_to = %s"
            params.append(int(assigned_to))
        
        if created_by:
            query += " AND t.created_by = %s"
            params.append(int(created_by))
        
        if service_id:
            query += " AND tsm.service_id = %s"
            params.append(int(service_id))
        
        if from_date:
            query += " AND t.created_at >= %s"
            params.append(from_date)
        
        if to_date:
            query += " AND t.created_at <= %s"
            params.append(to_date)
        
        query += " ORDER BY t.created_at DESC"
        
        cur.execute(query, params)
        tickets = [dict(row) for row in cur.fetchall()]
        
        for ticket in tickets:
            cur.execute("""
                SELECT s.id, s.name, sc.name as category_name
                FROM services s
                JOIN ticket_service_mappings tsm ON s.id = tsm.service_id
                LEFT JOIN service_categories sc ON s.category_id = sc.id
                WHERE tsm.ticket_id = %s
            """, (ticket['id'],))
            ticket['services'] = [dict(row) for row in cur.fetchall()]
            
            cur.execute("""
                SELECT cf.id, cf.name, cf.field_type, tcfv.value
                FROM ticket_custom_field_values tcfv
                JOIN ticket_custom_fields cf ON tcfv.field_id = cf.id
                WHERE tcfv.ticket_id = %s
            """, (ticket['id'],))
            ticket['custom_fields'] = [dict(row) for row in cur.fetchall()]
        
        cur.close()
        return response(200, {'tickets': tickets})
    
    elif method == 'POST':
        body = json.loads(event.get('body', '{}'))
        
        try:
            data = TicketRequest(**body)
        except Exception as e:
            return response(400, {'error': f'Validation error: {str(e)}'})
        
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO tickets 
            (title, description, status_id, priority_id, assigned_to, created_by, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
            RETURNING id, title, description, status_id, priority_id, assigned_to, created_by, created_at, updated_at
        """, (
            data.title,
            data.description,
            data.status_id,
            data.priority_id,
            data.assigned_to,
            payload['user_id']
        ))
        
        ticket = dict(cur.fetchone())
        
        for service_id in data.service_ids:
            cur.execute("""
                INSERT INTO ticket_service_mappings (ticket_id, service_id)
                VALUES (%s, %s)
            """, (ticket['id'], service_id))
        
        for field_id, value in data.custom_fields.items():
            cur.execute("""
                INSERT INTO ticket_custom_field_values (ticket_id, field_id, value)
                VALUES (%s, %s, %s)
            """, (ticket['id'], int(field_id), value))
        
        conn.commit()
        cur.close()
        
        return response(201, ticket)
    
    elif method == 'PUT':
        body = json.loads(event.get('body', '{}'))
        ticket_id = body.get('id')
        if not ticket_id:
            return response(400, {'error': 'Ticket ID required'})
        
        cur = conn.cursor()
        
        update_fields = []
        params = []
        
        if 'title' in body:
            update_fields.append("title = %s")
            params.append(body['title'])
        
        if 'description' in body:
            update_fields.append("description = %s")
            params.append(body['description'])
        
        if 'status_id' in body:
            update_fields.append("status_id = %s")
            params.append(body['status_id'])
        
        if 'priority_id' in body:
            update_fields.append("priority_id = %s")
            params.append(body['priority_id'])
        
        if 'assigned_to' in body:
            update_fields.append("assigned_to = %s")
            params.append(body['assigned_to'])
        
        update_fields.append("updated_at = NOW()")
        params.append(ticket_id)
        
        cur.execute(f"""
            UPDATE tickets 
            SET {', '.join(update_fields)}
            WHERE id = %s
            RETURNING id, title, description, status_id, priority_id, assigned_to, created_by, created_at, updated_at
        """, params)
        
        ticket = dict(cur.fetchone())
        
        if 'service_ids' in body:
            cur.execute("DELETE FROM ticket_service_mappings WHERE ticket_id = %s", (ticket_id,))
            for service_id in body['service_ids']:
                cur.execute("""
                    INSERT INTO ticket_service_mappings (ticket_id, service_id)
                    VALUES (%s, %s)
                """, (ticket_id, service_id))
        
        if 'custom_fields' in body:
            cur.execute("DELETE FROM ticket_custom_field_values WHERE ticket_id = %s", (ticket_id,))
            for field_id, value in body['custom_fields'].items():
                cur.execute("""
                    INSERT INTO ticket_custom_field_values (ticket_id, field_id, value)
                    VALUES (%s, %s, %s)
                """, (ticket_id, int(field_id), value))
        
        conn.commit()
        cur.close()
        
        return response(200, ticket)
    
    elif method == 'DELETE':
        body = json.loads(event.get('body', '{}'))
        ticket_id = body.get('id')
        if not ticket_id:
            return response(400, {'error': 'Ticket ID required'})
        
        cur = conn.cursor()
        
        cur.execute("DELETE FROM ticket_service_mappings WHERE ticket_id = %s", (ticket_id,))
        cur.execute("DELETE FROM ticket_custom_field_values WHERE ticket_id = %s", (ticket_id,))
        cur.execute("DELETE FROM tickets WHERE id = %s", (ticket_id,))
        
        conn.commit()
        cur.close()
        
        return response(200, {'message': 'Заявка удалена'})
    
    return response(405, {'error': 'Method not allowed'})

def handle_service_categories(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    
    if method == 'GET':
        cur = conn.cursor()
        cur.execute('SELECT id, name, description, icon, created_at FROM service_categories ORDER BY name')
        categories = [dict(row) for row in cur.fetchall()]
        cur.close()
        return response(200, categories)
    
    elif method == 'POST':
        body = json.loads(event.get('body', '{}'))
        
        try:
            data = ServiceCategoryRequest(**body)
        except Exception as e:
            return response(400, {'error': f'Validation error: {str(e)}'})
        
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO service_categories (name, description, icon)
            VALUES (%s, %s, %s)
            RETURNING id, name, description, icon, created_at
        """, (data.name, data.description, data.icon))
        
        category = dict(cur.fetchone())
        conn.commit()
        cur.close()
        
        return response(201, category)
    
    elif method == 'PUT':
        body = json.loads(event.get('body', '{}'))
        category_id = body.get('id')
        if not category_id:
            return response(400, {'error': 'Category ID required'})
        
        update_fields = []
        params = []
        
        if 'name' in body:
            update_fields.append("name = %s")
            params.append(body['name'])
        
        if 'description' in body:
            update_fields.append("description = %s")
            params.append(body['description'])
        
        if 'icon' in body:
            update_fields.append("icon = %s")
            params.append(body['icon'])
        
        params.append(category_id)
        
        cur = conn.cursor()
        
        cur.execute(f"""
            UPDATE service_categories 
            SET {', '.join(update_fields)}
            WHERE id = %s
            RETURNING id, name, description, icon, created_at
        """, params)
        
        category = dict(cur.fetchone())
        conn.commit()
        cur.close()
        
        return response(200, category)
    
    elif method == 'DELETE':
        body = json.loads(event.get('body', '{}'))
        category_id = body.get('id')
        if not category_id:
            return response(400, {'error': 'Category ID required'})
        
        cur = conn.cursor()
        cur.execute("DELETE FROM service_categories WHERE id = %s", (category_id,))
        conn.commit()
        cur.close()
        
        return response(200, {'message': 'Категория удалена'})
    
    return response(405, {'error': 'Method not allowed'})