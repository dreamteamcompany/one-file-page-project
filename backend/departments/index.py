"""
API для управления подразделениями с древовидной структурой.
DELETE — физическое удаление с каскадом дочерних.
PATCH — деактивация/активация с каскадом дочерних.
"""
import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from utils import json_dumps
from orgchart import route as orgchart_route


DSN = os.environ.get('DATABASE_URL')
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Id, X-Endpoint',
}


def make_response(status_code, body=None):
    headers = {'Content-Type': 'application/json', **CORS_HEADERS}
    if body is None:
        return {'statusCode': status_code, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}
    serialized = json_dumps(body) if isinstance(body, (dict, list)) else json.dumps(body)
    return {'statusCode': status_code, 'headers': headers, 'body': serialized, 'isBase64Encoded': False}


def get_descendant_ids(cur, dept_id):
    cur.execute(
        """
        WITH RECURSIVE descendants AS (
            SELECT id FROM departments WHERE id = %s
            UNION ALL
            SELECT d.id FROM departments d
            JOIN descendants ds ON d.parent_id = ds.id
        )
        SELECT id FROM descendants
        """,
        (dept_id,)
    )
    return [row['id'] for row in cur.fetchall()]


def handle_get(cur, query_params):
    dept_id = query_params.get('id')
    include_inactive = query_params.get('include_inactive') == 'true'

    if dept_id:
        cur.execute('SELECT * FROM departments WHERE id = %s', (dept_id,))
        dept = cur.fetchone()
        if not dept:
            return make_response(404, {'error': 'Department not found'})
        return make_response(200, dict(dept))

    if include_inactive:
        cur.execute('SELECT * FROM departments ORDER BY company_id, name')
    else:
        cur.execute('SELECT * FROM departments WHERE is_active = true ORDER BY company_id, name')
    return make_response(200, [dict(row) for row in cur.fetchall()])


def handle_post(cur, conn, data):
    cur.execute(
        """
        INSERT INTO departments (company_id, parent_id, name, code, description)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING *
        """,
        (data.get('company_id'), data.get('parent_id'), data.get('name'), data.get('code'), data.get('description'))
    )
    dept = dict(cur.fetchone())

    if data.get('position_ids'):
        for pos_id in data['position_ids']:
            cur.execute('INSERT INTO department_positions (department_id, position_id) VALUES (%s, %s)', (dept['id'], pos_id))

    conn.commit()
    return make_response(201, dept)


def handle_put(cur, conn, dept_id, data):
    if not dept_id:
        return make_response(400, {'error': 'Department ID required'})

    cur.execute(
        """
        UPDATE departments
        SET company_id = %s, parent_id = %s, name = %s, code = %s, description = %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        RETURNING *
        """,
        (data.get('company_id'), data.get('parent_id'), data.get('name'), data.get('code'), data.get('description'), dept_id)
    )
    dept = cur.fetchone()
    if not dept:
        return make_response(404, {'error': 'Department not found'})

    if 'position_ids' in data:
        cur.execute('DELETE FROM department_positions WHERE department_id = %s', (dept_id,))
        for pos_id in data['position_ids']:
            cur.execute('INSERT INTO department_positions (department_id, position_id) VALUES (%s, %s)', (dept_id, pos_id))

    conn.commit()
    return make_response(200, dict(dept))


def handle_patch(cur, conn, dept_id, data):
    """PATCH: смена is_active (каскадно) или is_hidden (только сам отдел)."""
    if not dept_id:
        return make_response(400, {'error': 'Department ID required'})

    cur.execute('SELECT id FROM departments WHERE id = %s', (dept_id,))
    if not cur.fetchone():
        return make_response(404, {'error': 'Department not found'})

    if 'is_hidden' in data:
        is_hidden = bool(data.get('is_hidden'))
        cur.execute(
            'UPDATE departments SET is_hidden = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s RETURNING *',
            (is_hidden, dept_id)
        )
        dept = cur.fetchone()
        conn.commit()
        action_word = 'скрыто' if is_hidden else 'показано'
        return make_response(200, {'message': f'Подразделение {action_word}', 'department': dict(dept)})

    is_active = data.get('is_active')
    if is_active is None:
        return make_response(400, {'error': 'is_active or is_hidden field required'})

    ids = get_descendant_ids(cur, int(dept_id))
    placeholders = ','.join(['%s'] * len(ids))
    cur.execute(
        f'UPDATE departments SET is_active = %s, updated_at = CURRENT_TIMESTAMP WHERE id IN ({placeholders})',
        [is_active] + ids
    )
    conn.commit()

    affected = len(ids)
    action_word = 'активировано' if is_active else 'деактивировано'
    return make_response(200, {'message': f'{action_word} подразделений: {affected}', 'affected_ids': ids})


def _count_users_in_departments(cur, dept_ids):
    """Сколько активных сотрудников привязано к данным отделам."""
    if not dept_ids:
        return 0
    placeholders = ','.join(['%s'] * len(dept_ids))
    cur.execute(
        f'SELECT COUNT(*) AS cnt FROM users WHERE department_id IN ({placeholders}) AND COALESCE(is_active, true) = true',
        dept_ids
    )
    row = cur.fetchone()
    return int(row['cnt']) if row else 0


def handle_delete(cur, conn, dept_id, query_params=None):
    """
    Физическое удаление подразделения.
    mode=cascade (по умолчанию) — удалить отдел вместе со всеми дочерними.
    mode=reparent — удалить только сам отдел, прямых детей перевести на его родителя.
    Блокируется, если в затрагиваемых отделах есть активные сотрудники.
    """
    if not dept_id:
        return make_response(400, {'error': 'Department ID required'})

    mode = (query_params or {}).get('mode', 'cascade')
    if mode not in ('cascade', 'reparent'):
        return make_response(400, {'error': 'mode must be cascade or reparent'})

    cur.execute('SELECT id, parent_id FROM departments WHERE id = %s', (dept_id,))
    target = cur.fetchone()
    if not target:
        return make_response(404, {'error': 'Department not found'})

    dept_id_int = int(dept_id)

    if mode == 'reparent':
        # Удаляем только сам отдел. Проверяем сотрудников только в нём.
        affected_ids = [dept_id_int]
    else:
        affected_ids = get_descendant_ids(cur, dept_id_int)

    users_count = _count_users_in_departments(cur, affected_ids)
    if users_count > 0:
        return make_response(409, {
            'error': 'department_has_users',
            'message': f'В подразделении есть сотрудники ({users_count}). Сначала перенесите их в другой отдел.',
            'users_count': users_count,
        })

    if mode == 'reparent':
        new_parent = target['parent_id']
        # Дети текущего отдела переходят к его родителю
        cur.execute(
            'UPDATE departments SET parent_id = %s, updated_at = CURRENT_TIMESTAMP WHERE parent_id = %s',
            (new_parent, dept_id_int)
        )
        cur.execute('DELETE FROM department_positions WHERE department_id = %s', (dept_id_int,))
        # Разрываем самоссылку на всякий случай и удаляем сам отдел
        cur.execute('UPDATE departments SET parent_id = NULL WHERE id = %s', (dept_id_int,))
        cur.execute('DELETE FROM departments WHERE id = %s', (dept_id_int,))
        conn.commit()
        return make_response(200, {
            'message': 'Подразделение удалено, дочерние перепривязаны',
            'deleted_ids': [dept_id_int],
            'mode': 'reparent',
        })

    # cascade — старое поведение
    placeholders = ','.join(['%s'] * len(affected_ids))
    cur.execute(f'DELETE FROM department_positions WHERE department_id IN ({placeholders})', affected_ids)
    cur.execute(
        f"""
        WITH RECURSIVE ordered AS (
            SELECT id, 0 as depth FROM departments WHERE id = %s
            UNION ALL
            SELECT d.id, o.depth + 1 FROM departments d JOIN ordered o ON d.parent_id = o.id
        )
        SELECT id FROM ordered ORDER BY depth DESC
        """,
        (dept_id,)
    )
    ordered_ids = [row['id'] for row in cur.fetchall()]
    for did in ordered_ids:
        cur.execute('UPDATE departments SET parent_id = NULL WHERE id = %s', (did,))
    cur.execute(f'DELETE FROM departments WHERE id IN ({placeholders})', affected_ids)

    conn.commit()
    return make_response(200, {
        'message': f'Удалено подразделений: {len(affected_ids)}',
        'deleted_ids': affected_ids,
        'mode': 'cascade',
    })


def handler(event: dict, context) -> dict:
    """API подразделений: GET/POST/PUT/PATCH/DELETE."""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return make_response(200)

    try:
        conn = psycopg2.connect(DSN)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        query_params = event.get('queryStringParameters') or {}
        dept_id = query_params.get('id')

        # Маршрутизация эндпоинтов "Оргструктуры"
        orgchart_resp = orgchart_route(event, cur, conn)
        if orgchart_resp is not None:
            return orgchart_resp

        if method == 'GET':
            return handle_get(cur, query_params)
        elif method == 'POST':
            data = json.loads(event.get('body', '{}'))
            return handle_post(cur, conn, data)
        elif method == 'PUT':
            data = json.loads(event.get('body', '{}'))
            return handle_put(cur, conn, dept_id, data)
        elif method == 'PATCH':
            data = json.loads(event.get('body', '{}'))
            return handle_patch(cur, conn, dept_id, data)
        elif method == 'DELETE':
            return handle_delete(cur, conn, dept_id, query_params)
        else:
            return make_response(405, {'error': 'Method not allowed'})

    except Exception as e:
        import traceback
        print(f"[ERROR] {type(e).__name__}: {e}")
        print(traceback.format_exc())
        return make_response(500, {'error': str(e)})
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()