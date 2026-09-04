"""
API для авторизации и получения общих данных
Разделено по Single Responsibility Principle
"""
from auth_service import handle_login, handle_me, handle_refresh
from data_service import (
    handle_budget_breakdown,
    handle_dashboard_stats,
    handle_notifications,
    handle_mark_notifications_read,
    handle_ticket_services,
    handle_ticket_service_categories
)
from jwt_service import verify_token
from http_service import http_response, format_service_response
from database_service import get_db_connection


def _endpoint_from(event):
    """X-Endpoint из заголовка, иначе query-параметр (общий адрес = один CORS-preflight)."""
    headers = event.get('headers') or {}
    for k, v in headers.items():
        if k.lower() == 'x-endpoint' and v:
            return str(v)
    return (event.get('queryStringParameters') or {}).get('endpoint', '')


def handler(event, context):
    """Обработка запросов авторизации и общих данных"""
    
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return http_response(200, {'message': 'OK'})
    
    params = event.get('queryStringParameters') or {}
    endpoint = _endpoint_from(event)
    
    try:
        conn = get_db_connection()
    except Exception as e:
        return http_response(500, {'error': 'Database connection failed'})
    
    try:
        if endpoint == 'login':
            result = handle_login(event, conn)
            return format_service_response(result)
        
        payload = verify_token(event)
        
        if not payload and endpoint != 'login':
            return http_response(401, {'error': 'Требуется авторизация'})
        
        if endpoint == 'me':
            result = handle_me(conn, payload)
            return format_service_response(result)
        
        elif endpoint == 'refresh':
            result = handle_refresh(conn, payload)
            return format_service_response(result)
        
        elif endpoint == 'budget-breakdown':
            result = handle_budget_breakdown(conn)
            return format_service_response(result)
        
        elif endpoint == 'dashboard-stats':
            result = handle_dashboard_stats(conn)
            return format_service_response(result)
        
        elif endpoint == 'notifications':
            if method == 'PUT':
                result = handle_mark_notifications_read(conn, payload['user_id'], event)
            else:
                result = handle_notifications(conn, payload['user_id'])
            return format_service_response(result)
        
        elif endpoint == 'ticket-services':
            result = handle_ticket_services(conn)
            return format_service_response(result)
        
        elif endpoint == 'ticket-service-categories':
            result = handle_ticket_service_categories(conn)
            return format_service_response(result)
        
        else:
            return http_response(404, {'error': f'Unknown endpoint: {endpoint}'})
    
    except Exception as e:
        return http_response(500, {'error': str(e)})
    
    finally:
        try:
            conn.close()
        except:
            pass