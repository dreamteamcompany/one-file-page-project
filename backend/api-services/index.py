"""
API для работы с сервисами (services)
Облегченная версия для быстрого деплоя
"""
import json
from typing import Dict, Any
from shared_utils import response, get_db_connection, verify_token, handle_options, SCHEMA

def handler(event, context):
    """API эндпоинт для services"""
    
    if event.get('httpMethod') == 'OPTIONS':
        return handle_options()
    
    method = event.get('httpMethod', 'GET')
    payload = verify_token(event)
    
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    
    try:
        conn = get_db_connection()
    except Exception as e:
        return response(500, {'error': 'Database connection failed'})
    
    try:
        if method == 'GET':
            cur = conn.cursor()
            cur.execute(f"""
                SELECT 
                    s.id,
                    s.name,
                    s.description,
                    s.intermediate_approver_id,
                    s.final_approver_id,
                    s.customer_department_id,
                    s.created_at,
                    s.updated_at,
                    u1.full_name as intermediate_approver_name,
                    u2.full_name as final_approver_name,
                    cd.name as customer_department_name
                FROM {SCHEMA}.services s
                LEFT JOIN {SCHEMA}.users u1 ON s.intermediate_approver_id = u1.id
                LEFT JOIN {SCHEMA}.users u2 ON s.final_approver_id = u2.id
                LEFT JOIN {SCHEMA}.customer_departments cd ON s.customer_department_id = cd.id
                WHERE s.is_system = FALSE
                ORDER BY s.name
            """)
            
            services = [dict(row) for row in cur.fetchall()]

            # Видимость сервисов забираем ОДНИМ запросом (было N+1: отдельный
            # запрос на каждый сервис — под нагрузкой это давало всплеск
            # запросов к БД и упор в rate-limit → ошибки 500).
            visible_map: Dict[int, list] = {}
            cur.execute(f"SELECT service_id, user_id FROM {SCHEMA}.service_visible_users")
            for r in cur.fetchall():
                visible_map.setdefault(r['service_id'], []).append(r['user_id'])
            for svc in services:
                svc['visible_to_user_ids'] = visible_map.get(svc['id'], [])
            cur.close()

            return response(200, services)
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            
            name = body.get('name')
            description = body.get('description', '')
            intermediate_approver_id = body.get('intermediate_approver_id')
            final_approver_id = body.get('final_approver_id')
            customer_department_id = body.get('customer_department_id')
            category_id = body.get('category_id')
            
            if not name:
                return response(400, {'error': 'Название сервиса обязательно'})
            
            cur = conn.cursor()
            cur.execute(f"""
                INSERT INTO {SCHEMA}.services (
                    name, 
                    description, 
                    intermediate_approver_id, 
                    final_approver_id,
                    customer_department_id,
                    category_id,
                    created_at, 
                    updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
                RETURNING id, name, description, intermediate_approver_id, 
                          final_approver_id, customer_department_id, category_id, created_at, updated_at
            """, (name, description, intermediate_approver_id, final_approver_id, customer_department_id, category_id))
            
            new_service = dict(cur.fetchone())
            visible_to_user_ids = body.get('visible_to_user_ids', [])
            for uid in visible_to_user_ids:
                cur.execute(f"INSERT INTO {SCHEMA}.service_visible_users (service_id, user_id) VALUES (%s, %s)", (new_service['id'], uid))
            new_service['visible_to_user_ids'] = visible_to_user_ids
            conn.commit()
            cur.close()
            
            return response(201, new_service)
        
        elif method == 'PUT':
            service_id = event.get('queryStringParameters', {}).get('id')
            
            if not service_id:
                return response(400, {'error': 'ID сервиса обязателен'})
            
            body = json.loads(event.get('body', '{}'))
            name = body.get('name')
            description = body.get('description', '')
            intermediate_approver_id = body.get('intermediate_approver_id')
            final_approver_id = body.get('final_approver_id')
            customer_department_id = body.get('customer_department_id')
            category_id = body.get('category_id')
            
            if not name:
                return response(400, {'error': 'Название сервиса обязательно'})
            
            cur = conn.cursor()
            cur.execute(f"""
                UPDATE {SCHEMA}.services
                SET name = %s,
                    description = %s,
                    intermediate_approver_id = %s,
                    final_approver_id = %s,
                    customer_department_id = %s,
                    category_id = %s,
                    updated_at = NOW()
                WHERE id = %s
                RETURNING id, name, description, intermediate_approver_id,
                          final_approver_id, customer_department_id, category_id, created_at, updated_at
            """, (name, description, intermediate_approver_id, final_approver_id,
                  customer_department_id, category_id, service_id))
            
            updated = cur.fetchone()
            if not updated:
                cur.close()
                return response(404, {'error': 'Сервис не найден'})
            
            visible_to_user_ids = body.get('visible_to_user_ids', [])
            cur.execute(f"DELETE FROM {SCHEMA}.service_visible_users WHERE service_id = %s", (service_id,))
            for uid in visible_to_user_ids:
                cur.execute(f"INSERT INTO {SCHEMA}.service_visible_users (service_id, user_id) VALUES (%s, %s)", (service_id, uid))
            
            result = dict(updated)
            result['visible_to_user_ids'] = visible_to_user_ids
            conn.commit()
            cur.close()
            
            return response(200, result)
        
        elif method == 'DELETE':
            service_id = event.get('queryStringParameters', {}).get('id')
            
            if not service_id:
                return response(400, {'error': 'ID сервиса обязателен'})
            
            cur = conn.cursor()
            
            cur.execute(f"""
                SELECT 
                  (SELECT COUNT(*) FROM {SCHEMA}.payments WHERE service_id = %s) as payments_count,
                  (SELECT COUNT(*) FROM {SCHEMA}.savings WHERE service_id = %s) as savings_count,
                  (SELECT COUNT(*) FROM {SCHEMA}.ticket_service_mappings WHERE service_id = %s) as mappings_count
            """, (service_id, service_id, service_id))
            
            counts = cur.fetchone()
            errors = []
            if counts[0] > 0:
                errors.append(f'{counts[0]} платежей')
            if counts[1] > 0:
                errors.append(f'{counts[1]} сохранений')
            if counts[2] > 0:
                errors.append(f'{counts[2]} связей с заявками')
            
            if errors:
                cur.close()
                return response(400, {'error': f'Невозможно удалить: есть {", ".join(errors)}'})
            
            cur.execute(f"DELETE FROM {SCHEMA}.services WHERE id = %s", (service_id,))
            conn.commit()
            cur.close()
            
            return response(200, {'message': 'Сервис удален'})
        
        else:
            return response(405, {'error': 'Method not allowed'})
    
    except Exception as e:
        return response(500, {'error': str(e)})
    
    finally:
        try:
            conn.close()
        except:
            pass