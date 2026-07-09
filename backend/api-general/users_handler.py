import json
import sys
import os
import bcrypt
from models import UserRequest
from shared_utils import response
from permissions_middleware import check_permission

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')

def log(msg):
    print(msg, file=sys.stderr, flush=True)


def save_subordinates(cur, target_user_id, department_ids, user_ids):
    """Пересохраняет подчинённых пользователя (отделы и конкретных сотрудников)."""
    cur.execute(f"DELETE FROM {SCHEMA}.user_subordinate_departments WHERE user_id=%s", (target_user_id,))
    for dep_id in set(department_ids or []):
        cur.execute(
            f"INSERT INTO {SCHEMA}.user_subordinate_departments (user_id, department_id) VALUES (%s, %s)",
            (target_user_id, dep_id)
        )
    cur.execute(f"DELETE FROM {SCHEMA}.user_subordinates WHERE user_id=%s", (target_user_id,))
    for sub_id in set(user_ids or []):
        if int(sub_id) == int(target_user_id):
            continue
        cur.execute(
            f"INSERT INTO {SCHEMA}.user_subordinates (user_id, subordinate_user_id) VALUES (%s, %s)",
            (target_user_id, sub_id)
        )

def handle_users(method, event, conn, payload):
    user_id = payload.get('user_id')
    if not user_id:
        return response(401, {'error': 'User ID not found in token'})
    
    cur = conn.cursor()
    try:
        if method == 'GET':
            # Список пользователей доступен любому авторизованному пользователю
            # (нужен для выбора наблюдателя/исполнителя в заявках).
            # Чувствительные поля (password_hash) не выгружаются, см. user_cols ниже.
            params = event.get('queryStringParameters', {}) or {}
            target_user_id = params.get('id')

            # Безопасный набор колонок — БЕЗ password_hash.
            user_cols = (
                "u.id, u.email, u.full_name, u.username, u.position, u.photo_url, "
                "u.is_active, u.can_login, u.company_id, u.department_id, u.position_id, "
                "u.bitrix_user_id, u.max_user_id, u.bypass_department_head_check, u.external_id, u.external_source, "
                "u.auto_registered, u.is_bitrix_head, u.last_login, u.created_at, u.updated_at"
            )

            if target_user_id:
                cur.execute(
                    f"SELECT {user_cols} FROM {SCHEMA}.users u WHERE u.id = %s",
                    (target_user_id,)
                )
                user = cur.fetchone()
                if not user:
                    return response(404, {'error': 'User not found'})
                user_dict = dict(user)
                cur.execute(
                    f"SELECT department_id FROM {SCHEMA}.user_subordinate_departments WHERE user_id = %s",
                    (target_user_id,)
                )
                user_dict['subordinate_department_ids'] = [r['department_id'] for r in cur.fetchall()]
                cur.execute(
                    f"SELECT subordinate_user_id FROM {SCHEMA}.user_subordinates WHERE user_id = %s",
                    (target_user_id,)
                )
                user_dict['subordinate_user_ids'] = [r['subordinate_user_id'] for r in cur.fetchall()]
                return response(200, user_dict)
            else:
                # Опциональный фильтр по системным ролям: ?system_roles=admin,executor
                system_roles_param = (params.get('system_roles') or '').strip()
                having_clause = ''
                query_args = ()
                if system_roles_param:
                    wanted = [s.strip().lower() for s in system_roles_param.split(',') if s.strip()]
                    if wanted:
                        placeholders = ','.join(['%s'] * len(wanted))
                        having_clause = (
                            f"HAVING bool_or(LOWER(COALESCE(r.system_role, '')) IN ({placeholders}))"
                        )
                        query_args = tuple(wanted)

                cur.execute(f"""
                    SELECT {user_cols},
                           COALESCE(json_agg(DISTINCT jsonb_build_object(
                                'id', r.id, 'name', r.name, 'system_role', r.system_role))
                                    FILTER (WHERE r.id IS NOT NULL), '[]') as roles
                    FROM {SCHEMA}.users u
                    LEFT JOIN {SCHEMA}.user_roles ur ON u.id = ur.user_id
                    LEFT JOIN {SCHEMA}.roles r ON ur.role_id = r.id
                    GROUP BY u.id
                    {having_clause}
                    ORDER BY u.id
                """, query_args)
                users = cur.fetchall()
                return response(200, [dict(u) for u in users])
        
        elif method == 'POST':
            # Проверка права на создание пользователей
            if not check_permission(conn, user_id, 'users', 'create'):
                return response(403, {'error': 'Access denied', 'message': 'No permission to create users'})
            
            body = json.loads(event.get('body', '{}'))
            log(f"[CREATE USER] Received body: {json.dumps(body)}")
            
            try:
                req = UserRequest(**body)
                log(f"[CREATE USER] Validated request: username={req.username}, full_name={req.full_name}")
            except Exception as validation_error:
                log(f"[CREATE USER] Validation error: {str(validation_error)}")
                return response(400, {'error': 'Validation error', 'details': str(validation_error)})
            
            log(f"[CREATE USER] Checking password: {req.password is not None}")
            
            if not req.password:
                log("[CREATE USER] Password is missing")
                return response(400, {'error': 'Password required'})
            
            log("[CREATE USER] About to hash password")
            
            try:
                password_hash = bcrypt.hashpw(req.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                log(f"[CREATE USER] Password hashed successfully")
                
                email_value = req.email if req.email else f"no-email-{req.username}@placeholder.local"
                bitrix_id_value = req.bitrix_user_id if req.bitrix_user_id else None
                max_id_value = req.max_user_id if req.max_user_id else None

                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE username = %s", (req.username,))
                if cur.fetchone():
                    return response(409, {'error': 'Username already taken', 'message': f'Логин "{req.username}" уже занят'})
                if req.email:
                    cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email = %s", (req.email,))
                    if cur.fetchone():
                        return response(409, {'error': 'Email already taken', 'message': f'Пользователь с почтой "{req.email}" уже существует'})
                if bitrix_id_value:
                    cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE bitrix_user_id = %s", (bitrix_id_value,))
                    if cur.fetchone():
                        return response(409, {'error': 'Bitrix ID already taken', 'message': f'Битрикс ID "{bitrix_id_value}" уже используется'})

                insert_query = f"""
                    INSERT INTO {SCHEMA}.users 
                    (username, password_hash, full_name, position, email, photo_url, bitrix_user_id, max_user_id, department_id, is_active, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, NOW(), NOW())
                    RETURNING id
                """
                log(f"[CREATE USER] About to execute INSERT, username={req.username}")
                
                cur.execute(insert_query, (
                    req.username, 
                    password_hash, 
                    req.full_name, 
                    req.position if req.position else '', 
                    email_value, 
                    req.photo_url if req.photo_url else '',
                    bitrix_id_value,
                    max_id_value,
                    req.department_id,
                ))
                
                new_user_id = cur.fetchone()['id']
                log(f"[CREATE USER] User created with ID: {new_user_id}")
                
                for role_id in req.role_ids:
                    log(f"[CREATE USER] Assigning role {role_id} to user {new_user_id}")
                    cur.execute(f"INSERT INTO {SCHEMA}.user_roles (user_id, role_id) VALUES (%s, %s)", (new_user_id, role_id))
                
                save_subordinates(cur, new_user_id, req.subordinate_department_ids, req.subordinate_user_ids)
                
                conn.commit()
                log(f"[CREATE USER] Transaction committed successfully")
                return response(201, {'id': new_user_id, 'message': 'User created'})
            except Exception as insert_error:
                conn.rollback()
                err_name = type(insert_error).__name__
                err_str = str(insert_error)
                log(f"[CREATE USER] Insert error: {err_name}: {err_str}")
                if 'unique' in err_str.lower() or err_name in ('UniqueViolation', 'IntegrityError'):
                    msg = 'Такой пользователь уже существует'
                    low = err_str.lower()
                    if 'username' in low:
                        msg = f'Логин "{req.username}" уже занят'
                    elif 'email' in low:
                        msg = f'Пользователь с почтой "{req.email}" уже существует'
                    elif 'bitrix' in low:
                        msg = 'Битрикс ID уже используется'
                    return response(409, {'error': 'Duplicate user', 'message': msg})
                return response(500, {'error': 'Failed to create user', 'details': err_str})
        
        elif method == 'PUT':
            # Проверка права на редактирование пользователей
            if not check_permission(conn, user_id, 'users', 'update'):
                return response(403, {'error': 'Access denied', 'message': 'No permission to update users'})
            
            params = event.get('queryStringParameters', {}) or {}
            target_user_id = params.get('id')
            if not target_user_id:
                return response(400, {'error': 'User ID required'})
            
            body = json.loads(event.get('body', '{}'))

            if 'is_active' in body and len(body) == 1:
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET is_active=%s, updated_at=NOW() WHERE id=%s",
                    (body['is_active'], target_user_id)
                )
                conn.commit()
                return response(200, {'message': 'User status updated'})

            if 'bypass_department_head_check' in body and len(body) == 1:
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET bypass_department_head_check=%s, updated_at=NOW() WHERE id=%s",
                    (body['bypass_department_head_check'], target_user_id)
                )
                conn.commit()
                return response(200, {'message': 'Bypass department head check updated'})

            try:
                req = UserRequest(**body)
            except Exception as validation_error:
                log(f"[UPDATE USER] Validation error: {str(validation_error)}")
                return response(400, {'error': 'Validation error', 'details': str(validation_error)})

            email_value = req.email if req.email else f"no-email-{target_user_id}@placeholder.local"
            bitrix_id_value = req.bitrix_user_id if req.bitrix_user_id else None
            max_id_value = req.max_user_id if req.max_user_id else None

            try:
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.users WHERE username = %s AND id <> %s",
                    (req.username, target_user_id)
                )
                if cur.fetchone():
                    return response(409, {'error': 'Username already taken', 'message': f'Логин "{req.username}" уже занят'})
                if req.email:
                    cur.execute(
                        f"SELECT id FROM {SCHEMA}.users WHERE email = %s AND id <> %s",
                        (req.email, target_user_id)
                    )
                    if cur.fetchone():
                        return response(409, {'error': 'Email already taken', 'message': f'Пользователь с почтой "{req.email}" уже существует'})
                if bitrix_id_value:
                    cur.execute(
                        f"SELECT id FROM {SCHEMA}.users WHERE bitrix_user_id = %s AND id <> %s",
                        (bitrix_id_value, target_user_id)
                    )
                    if cur.fetchone():
                        return response(409, {'error': 'Bitrix ID already taken', 'message': f'Битрикс ID "{bitrix_id_value}" уже используется'})

                if req.password:
                    password_hash = bcrypt.hashpw(req.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                    cur.execute(f"""
                        UPDATE {SCHEMA}.users 
                        SET username=%s, password_hash=%s, full_name=%s, position=%s, email=%s, photo_url=%s, bitrix_user_id=%s, max_user_id=%s, department_id=%s
                        WHERE id=%s
                    """, (req.username, password_hash, req.full_name, req.position, email_value, req.photo_url, bitrix_id_value, max_id_value, req.department_id, target_user_id))
                else:
                    cur.execute(f"""
                        UPDATE {SCHEMA}.users 
                        SET username=%s, full_name=%s, position=%s, email=%s, photo_url=%s, bitrix_user_id=%s, max_user_id=%s, department_id=%s
                        WHERE id=%s
                    """, (req.username, req.full_name, req.position, email_value, req.photo_url, bitrix_id_value, max_id_value, req.department_id, target_user_id))

                cur.execute(f"DELETE FROM {SCHEMA}.user_roles WHERE user_id=%s", (target_user_id,))
                for role_id in req.role_ids:
                    cur.execute(f"INSERT INTO {SCHEMA}.user_roles (user_id, role_id) VALUES (%s, %s)", (target_user_id, role_id))

                save_subordinates(cur, target_user_id, req.subordinate_department_ids, req.subordinate_user_ids)

                conn.commit()
                return response(200, {'message': 'User updated'})
            except Exception as update_error:
                conn.rollback()
                err_name = type(update_error).__name__
                err_str = str(update_error)
                log(f"[UPDATE USER] Update error: {err_name}: {err_str}")
                if 'unique' in err_str.lower() or err_name in ('UniqueViolation', 'IntegrityError'):
                    msg = 'Такой пользователь уже существует'
                    low = err_str.lower()
                    if 'username' in low:
                        msg = f'Логин "{req.username}" уже занят'
                    elif 'email' in low:
                        msg = f'Пользователь с почтой "{req.email}" уже существует'
                    elif 'bitrix' in low:
                        msg = 'Битрикс ID уже используется'
                    return response(409, {'error': 'Duplicate user', 'message': msg})
                return response(500, {'error': 'Failed to update user', 'details': err_str})
        
        elif method == 'DELETE':
            # Проверка права на удаление пользователей
            if not check_permission(conn, user_id, 'users', 'remove'):
                return response(403, {'error': 'Access denied', 'message': 'No permission to delete users'})
            
            body = json.loads(event.get('body', '{}'))
            target_user_id = body.get('id')
            if not target_user_id:
                return response(400, {'error': 'User ID required'})
            
            # Проверяем, есть ли связанные заявки
            cur.execute(f"SELECT COUNT(*) as count FROM {SCHEMA}.tickets WHERE created_by=%s OR assigned_to=%s", (target_user_id, target_user_id))
            ticket_count = cur.fetchone()['count']
            if ticket_count > 0:
                return response(400, {'error': f'Cannot delete user with {ticket_count} related tickets'})
            
            # Удаляем связи с ролями (можно удалить безопасно)
            cur.execute(f"DELETE FROM {SCHEMA}.user_roles WHERE user_id=%s", (target_user_id,))
            
            # Удаляем пользователя
            cur.execute(f"DELETE FROM {SCHEMA}.users WHERE id=%s", (target_user_id,))
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