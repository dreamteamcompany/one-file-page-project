import sys
from shared_utils import response, get_db_connection, verify_token, handle_options, SCHEMA
from users_handler import handle_users
from roles_handler import handle_roles
from categories_handler import handle_categories
from contractors_handler import handle_contractors
from legal_entities_handler import handle_legal_entities
from customer_departments_handler import handle_customer_departments

def log(msg):
    print(msg, file=sys.stderr, flush=True)

def handler(event, context):
    '''API для управления справочниками: пользователи, роли, категории, контрагенты, юр.лица, отделы'''
    
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return handle_options()
    
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Unauthorized'})
    
    params = event.get('queryStringParameters', {}) or {}
    resource = params.get('resource', '')
    
    if not resource:
        return response(400, {'error': 'Resource parameter required'})
    
    conn = get_db_connection()
    if not conn:
        return response(500, {'error': 'Database connection failed'})
    
    try:
        if resource == 'users':
            return handle_users(method, event, conn)
        elif resource == 'roles':
            return handle_roles(method, event, conn, payload)
        elif resource == 'categories':
            return handle_categories(method, event, conn)
        elif resource == 'contractors':
            return handle_contractors(method, event, conn)
        elif resource == 'legal_entities':
            return handle_legal_entities(method, event, conn)
        elif resource == 'customer_departments':
            return handle_customer_departments(method, event, conn)
        else:
            return response(400, {'error': f'Unknown resource: {resource}'})
    
    except Exception as e:
        log(f"Error in handler: {str(e)}")
        return response(500, {'error': str(e)})
    
    finally:
        if conn:
            conn.close()