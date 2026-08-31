import sys
from shared_utils import response, get_db_connection, verify_token, handle_options, SCHEMA
from users_handler import handle_users
from roles_handler import handle_roles
from permissions_handler import handle_permissions
from user_permissions_handler import handle_user_permissions
from categories_handler import handle_categories
from contractors_handler import handle_contractors
from legal_entities_handler import handle_legal_entities
from customer_departments_handler import handle_customer_departments
from system_settings_handler import handle_system_settings
from notification_templates_handler import handle_notification_templates
from db_backup_handler import handle_db_backup

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
    # Поддержка обоих параметров: resource и endpoint (для совместимости)
    resource = params.get('resource', '') or params.get('endpoint', '')
    
    if not resource:
        return response(400, {'error': 'Resource or endpoint parameter required'})
    
    conn = get_db_connection()
    if not conn:
        return response(500, {'error': 'Database connection failed'})
    
    try:
        if resource == 'users':
            return handle_users(method, event, conn, payload)
        elif resource == 'roles':
            return handle_roles(method, event, conn, payload)
        elif resource == 'permissions':
            return handle_permissions(method, event, conn)
        elif resource == 'user-permissions':
            return handle_user_permissions(method, event, conn, payload)
        elif resource == 'categories':
            return handle_categories(method, event, conn)
        elif resource == 'contractors':
            return handle_contractors(method, event, conn)
        elif resource == 'legal_entities':
            return handle_legal_entities(method, event, conn)
        elif resource == 'customer_departments':
            return handle_customer_departments(method, event, conn)
        elif resource == 'system_settings':
            return handle_system_settings(method, event, conn, payload)
        elif resource == 'notification_templates':
            return handle_notification_templates(method, event, conn, payload)
        elif resource == 'db_backup':
            return handle_db_backup(method, event, conn, payload)
        else:
            return response(400, {'error': f'Unknown resource: {resource}'})
    
    except Exception as e:
        log(f"Error in handler: {str(e)}")
        return response(500, {'error': str(e)})
    
    finally:
        if conn:
            conn.close()