"""Эндпоинты для страницы 'Оргструктура' (дерево отделов + сотрудники)."""
import json
import os
import jwt
from typing import Any, Dict, List, Optional

from utils import json_dumps


JWT_SECRET = os.environ.get('JWT_SECRET', '')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Id, X-Endpoint',
}


def _resp(status: int, body: Any) -> Dict[str, Any]:
    headers = {'Content-Type': 'application/json', **CORS_HEADERS}
    return {
        'statusCode': status,
        'headers': headers,
        'body': json_dumps(body) if isinstance(body, (dict, list)) else json.dumps(body),
        'isBase64Encoded': False,
    }


def _verify_token(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    headers = event.get('headers') or {}
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
    if not token or not JWT_SECRET:
        return None
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except Exception:
        return None


def _is_admin(cur, user_id: int) -> bool:
    if not user_id:
        return False
    try:
        cur.execute(
            """
            SELECT 1 FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = %s
              AND (r.system_role = 'admin' OR r.name IN ('Администратор','Admin','admin'))
            LIMIT 1
            """,
            (user_id,),
        )
        return cur.fetchone() is not None
    except Exception:
        return False


def _safe_int(v: Any) -> Optional[int]:
    try:
        return int(v) if v is not None and v != '' else None
    except Exception:
        return None


def handle_tree(cur) -> Dict[str, Any]:
    """Возвращает компании (корни) + отделы под ними."""
    # Компании
    cur.execute(
        """
        SELECT c.id, c.name,
               (SELECT COUNT(*) FROM users WHERE company_id = c.id AND is_active = true) AS members_count,
               (SELECT COUNT(*) FROM departments WHERE company_id = c.id AND is_active = true AND parent_id IS NULL) AS root_departments_count
        FROM companies c
        WHERE COALESCE(c.is_active, true) = true
        ORDER BY c.name
        """
    )
    companies = [dict(r) for r in cur.fetchall()]

    # Отделы
    cur.execute(
        """
        SELECT d.id, d.name, d.parent_id, d.head_user_id, d.company_id,
               d.is_active,
               u.id AS head_id, u.full_name AS head_name,
               u.position AS head_position, u.photo_url AS head_photo,
               (SELECT COUNT(*) FROM users WHERE department_id = d.id AND is_active = true) AS members_count,
               (SELECT COUNT(*) FROM departments WHERE parent_id = d.id AND is_active = true) AS children_count
        FROM departments d
        LEFT JOIN users u ON u.id = d.head_user_id
        WHERE d.is_active = true
        ORDER BY COALESCE(d.parent_id, 0), d.name
        """
    )
    departments = [dict(r) for r in cur.fetchall()]

    return _resp(200, {'companies': companies, 'departments': departments})


def handle_department_users(cur, dept_id: int) -> Dict[str, Any]:
    """Возвращает руководителя и всех сотрудников отдела."""
    if not dept_id:
        return _resp(400, {'error': 'dept_id required'})
    cur.execute(
        """
        SELECT d.id, d.name, d.head_user_id
        FROM departments d WHERE d.id = %s
        """,
        (dept_id,),
    )
    dept = cur.fetchone()
    if not dept:
        return _resp(404, {'error': 'Отдел не найден'})

    cur.execute(
        """
        SELECT id, full_name, username, email, position, photo_url, is_active
        FROM users
        WHERE department_id = %s AND is_active = true
        ORDER BY full_name
        """,
        (dept_id,),
    )
    members = [dict(r) for r in cur.fetchall()]

    head = None
    head_id = dept['head_user_id']
    if head_id:
        cur.execute(
            "SELECT id, full_name, username, email, position, photo_url FROM users WHERE id = %s",
            (head_id,),
        )
        h = cur.fetchone()
        if h:
            head = dict(h)

    return _resp(200, {
        'department': dict(dept),
        'head': head,
        'members': members,
    })


def handle_search_users(cur, query: str) -> Dict[str, Any]:
    """Поиск сотрудников по имени/должности."""
    q = (query or '').strip()
    if not q:
        return _resp(200, [])
    like = '%' + q.replace('%', '\\%').replace('_', '\\_') + '%'
    cur.execute(
        """
        SELECT u.id, u.full_name, u.position, u.photo_url, u.department_id,
               d.name AS department_name
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.is_active = true
          AND (u.full_name ILIKE %s OR u.position ILIKE %s)
        ORDER BY u.full_name
        LIMIT 30
        """,
        (like, like),
    )
    return _resp(200, [dict(r) for r in cur.fetchall()])


def handle_me_department(cur, user_id: int) -> Dict[str, Any]:
    """Возвращает отдел текущего пользователя — для кнопки 'Найти меня'."""
    cur.execute("SELECT department_id FROM users WHERE id = %s", (user_id,))
    row = cur.fetchone()
    return _resp(200, {'department_id': (row or {}).get('department_id')})


def handle_create_dept(cur, conn, data: Dict[str, Any]) -> Dict[str, Any]:
    name = (data.get('name') or '').strip()
    if not name:
        return _resp(400, {'error': 'Название обязательно'})
    parent_id = _safe_int(data.get('parent_id'))
    head_user_id = _safe_int(data.get('head_user_id'))
    company_id = _safe_int(data.get('company_id'))
    cur.execute(
        """
        INSERT INTO departments (name, parent_id, head_user_id, company_id, is_active)
        VALUES (%s, %s, %s, %s, true)
        RETURNING id, name, parent_id, head_user_id, company_id
        """,
        (name, parent_id, head_user_id, company_id),
    )
    new_dept = dict(cur.fetchone())
    conn.commit()
    return _resp(201, new_dept)


def handle_update_dept(cur, conn, dept_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    if not dept_id:
        return _resp(400, {'error': 'id required'})
    fields = []
    params: List[Any] = []
    if 'name' in data:
        name = (data.get('name') or '').strip()
        if not name:
            return _resp(400, {'error': 'Название не может быть пустым'})
        fields.append('name = %s')
        params.append(name)
    if 'parent_id' in data:
        new_parent = _safe_int(data.get('parent_id'))
        if new_parent == dept_id:
            return _resp(400, {'error': 'Отдел не может быть родителем сам себе'})
        if new_parent:
            cur.execute(
                """
                WITH RECURSIVE descendants AS (
                    SELECT id FROM departments WHERE id = %s
                    UNION ALL
                    SELECT d.id FROM departments d
                    JOIN descendants ds ON d.parent_id = ds.id
                )
                SELECT 1 FROM descendants WHERE id = %s LIMIT 1
                """,
                (dept_id, new_parent),
            )
            if cur.fetchone():
                return _resp(400, {'error': 'Нельзя сделать родителем подотдел'})
        fields.append('parent_id = %s')
        params.append(new_parent)
    if 'head_user_id' in data:
        fields.append('head_user_id = %s')
        params.append(_safe_int(data.get('head_user_id')))
    if not fields:
        return _resp(400, {'error': 'Нет полей для обновления'})
    fields.append('updated_at = CURRENT_TIMESTAMP')
    params.append(dept_id)
    cur.execute(
        f"UPDATE departments SET {', '.join(fields)} WHERE id = %s RETURNING id, name, parent_id, head_user_id",
        params,
    )
    row = cur.fetchone()
    if not row:
        return _resp(404, {'error': 'Отдел не найден'})
    conn.commit()
    return _resp(200, dict(row))


def handle_delete_dept(cur, conn, dept_id: int) -> Dict[str, Any]:
    if not dept_id:
        return _resp(400, {'error': 'id required'})
    cur.execute(
        "SELECT COUNT(*) AS c FROM users WHERE department_id = %s AND is_active = true",
        (dept_id,),
    )
    if (cur.fetchone() or {}).get('c', 0) > 0:
        return _resp(400, {'error': 'В отделе есть сотрудники — сначала переместите их'})
    cur.execute(
        "SELECT COUNT(*) AS c FROM departments WHERE parent_id = %s AND is_active = true",
        (dept_id,),
    )
    if (cur.fetchone() or {}).get('c', 0) > 0:
        return _resp(400, {'error': 'У отдела есть подотделы — сначала удалите их'})
    cur.execute("UPDATE departments SET is_active = false WHERE id = %s", (dept_id,))
    conn.commit()
    return _resp(200, {'ok': True})


def handle_create_company(cur, conn, data: Dict[str, Any]) -> Dict[str, Any]:
    name = (data.get('name') or '').strip()
    if not name:
        return _resp(400, {'error': 'Название обязательно'})
    cur.execute(
        "INSERT INTO companies (name, is_active) VALUES (%s, true) RETURNING id, name",
        (name,),
    )
    row = dict(cur.fetchone())
    conn.commit()
    return _resp(201, row)


def handle_update_company(cur, conn, company_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    if not company_id:
        return _resp(400, {'error': 'id required'})
    name = (data.get('name') or '').strip()
    if not name:
        return _resp(400, {'error': 'Название не может быть пустым'})
    cur.execute(
        "UPDATE companies SET name = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s RETURNING id, name",
        (name, company_id),
    )
    row = cur.fetchone()
    if not row:
        return _resp(404, {'error': 'Компания не найдена'})
    conn.commit()
    return _resp(200, dict(row))


def handle_delete_company(cur, conn, company_id: int) -> Dict[str, Any]:
    if not company_id:
        return _resp(400, {'error': 'id required'})
    cur.execute(
        "SELECT COUNT(*) AS c FROM departments WHERE company_id = %s AND is_active = true",
        (company_id,),
    )
    if (cur.fetchone() or {}).get('c', 0) > 0:
        return _resp(400, {'error': 'У компании есть отделы — сначала переместите их'})
    cur.execute(
        "SELECT COUNT(*) AS c FROM users WHERE company_id = %s AND is_active = true",
        (company_id,),
    )
    if (cur.fetchone() or {}).get('c', 0) > 0:
        return _resp(400, {'error': 'В компании есть сотрудники'})
    cur.execute("UPDATE companies SET is_active = false WHERE id = %s", (company_id,))
    conn.commit()
    return _resp(200, {'ok': True})


def handle_move_department(cur, conn, data: Dict[str, Any]) -> Dict[str, Any]:
    """Перенос корневого отдела в другую компанию (или 'без компании')."""
    dept_id = _safe_int(data.get('department_id'))
    company_id = _safe_int(data.get('company_id'))
    if not dept_id:
        return _resp(400, {'error': 'department_id required'})
    cur.execute("SELECT id FROM departments WHERE id = %s AND is_active = true", (dept_id,))
    if not cur.fetchone():
        return _resp(404, {'error': 'Отдел не найден'})
    if company_id is not None:
        cur.execute("SELECT id FROM companies WHERE id = %s", (company_id,))
        if not cur.fetchone():
            return _resp(404, {'error': 'Компания не найдена'})
    # При перемещении в другую компанию отдел становится корневым (parent_id = NULL)
    cur.execute(
        "UPDATE departments SET company_id = %s, parent_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
        (company_id, dept_id),
    )
    conn.commit()
    return _resp(200, {'ok': True, 'department_id': dept_id, 'company_id': company_id})


def handle_move_user(cur, conn, data: Dict[str, Any]) -> Dict[str, Any]:
    user_id = _safe_int(data.get('user_id'))
    dept_id = _safe_int(data.get('department_id'))
    if not user_id:
        return _resp(400, {'error': 'user_id required'})
    cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
    if not cur.fetchone():
        return _resp(404, {'error': 'Пользователь не найден'})
    if dept_id:
        cur.execute("SELECT id FROM departments WHERE id = %s AND is_active = true", (dept_id,))
        if not cur.fetchone():
            return _resp(404, {'error': 'Отдел не найден'})
    cur.execute(
        "UPDATE users SET department_id = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
        (dept_id, user_id),
    )
    conn.commit()
    return _resp(200, {'ok': True, 'user_id': user_id, 'department_id': dept_id})


def route(event: Dict[str, Any], cur, conn) -> Optional[Dict[str, Any]]:
    """Вернёт ответ если запрос относится к оргструктуре, иначе None."""
    qs = event.get('queryStringParameters') or {}
    endpoint = (qs.get('endpoint') or '').strip()
    if not endpoint:
        return None

    method = event.get('httpMethod', 'GET')

    # GET tree / users / search / me доступны всем авторизованным (просмотр)
    if endpoint in ('orgchart-tree', 'department-users', 'search-users', 'me-department'):
        payload = _verify_token(event)
        if not payload:
            return _resp(401, {'error': 'Требуется авторизация'})
        if endpoint == 'orgchart-tree' and method == 'GET':
            return handle_tree(cur)
        if endpoint == 'department-users' and method == 'GET':
            return handle_department_users(cur, _safe_int(qs.get('id')))
        if endpoint == 'search-users' and method == 'GET':
            return handle_search_users(cur, qs.get('q') or '')
        if endpoint == 'me-department' and method == 'GET':
            return handle_me_department(cur, _safe_int(payload.get('user_id')))
        return _resp(405, {'error': 'Method not allowed'})

    # Write-операции — только админ
    if endpoint in (
        'create-dept', 'update-dept', 'delete-dept', 'move-user',
        'create-company', 'update-company', 'delete-company', 'move-department',
    ):
        payload = _verify_token(event)
        if not payload:
            return _resp(401, {'error': 'Требуется авторизация'})
        user_id = _safe_int(payload.get('user_id'))
        if not _is_admin(cur, user_id or 0):
            return _resp(403, {'error': 'Недостаточно прав'})

        body = {}
        if event.get('body'):
            try:
                body = json.loads(event['body'])
            except Exception:
                return _resp(400, {'error': 'Невалидный JSON'})

        if endpoint == 'create-dept' and method == 'POST':
            return handle_create_dept(cur, conn, body)
        if endpoint == 'update-dept' and method in ('PUT', 'PATCH'):
            return handle_update_dept(cur, conn, _safe_int(qs.get('id')), body)
        if endpoint == 'delete-dept' and method == 'DELETE':
            return handle_delete_dept(cur, conn, _safe_int(qs.get('id')))
        if endpoint == 'move-user' and method in ('POST', 'PUT'):
            return handle_move_user(cur, conn, body)
        if endpoint == 'create-company' and method == 'POST':
            return handle_create_company(cur, conn, body)
        if endpoint == 'update-company' and method in ('PUT', 'PATCH'):
            return handle_update_company(cur, conn, _safe_int(qs.get('id')), body)
        if endpoint == 'delete-company' and method == 'DELETE':
            return handle_delete_company(cur, conn, _safe_int(qs.get('id')))
        if endpoint == 'move-department' and method in ('POST', 'PUT'):
            return handle_move_department(cur, conn, body)
        return _resp(405, {'error': 'Method not allowed'})

    return None