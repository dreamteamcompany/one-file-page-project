"""
API для управления группами и реестром дополнительных полей заявок.
Параметр ?entity=fields переключает на работу с реестром полей.
"""
import json
from shared_utils import get_db_connection, cors_headers


def handler(event: dict, context) -> dict:
    """Обработчик API для групп полей и реестра полей"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                **cors_headers,
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            'body': '',
            'isBase64Encoded': False
        }

    params = event.get('queryStringParameters') or {}
    entity = params.get('entity') or (
        'fields' if params.get('endpoint') == 'custom-fields' else 'groups'
    )

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        body = {}
        if method in ('POST', 'PUT', 'DELETE'):
            body = json.loads(event.get('body', '{}'))

        if entity == 'fields':
            result = route_fields(method, cur, conn, body)
        else:
            result = route_groups(method, cur, conn, body)

        cur.close()
        conn.close()

        data, status = result if isinstance(result, tuple) else (result, 200)

        return {
            'statusCode': status,
            'headers': {**cors_headers, 'Content-Type': 'application/json'},
            'body': json.dumps(data, ensure_ascii=False, default=str),
            'isBase64Encoded': False
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {**cors_headers, 'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)}, ensure_ascii=False),
            'isBase64Encoded': False
        }


def route_groups(method, cur, conn, body):
    if method == 'GET':
        return get_groups(cur)
    if method == 'POST':
        return create_group(cur, conn, body)
    if method == 'PUT':
        return update_group(cur, conn, body)
    if method == 'DELETE':
        return delete_group(cur, conn, body)
    return {'error': 'Method not allowed'}, 405


def route_fields(method, cur, conn, body):
    if method == 'GET':
        return get_fields(cur)
    if method == 'POST':
        return create_field(cur, conn, body)
    if method == 'PUT':
        return update_field(cur, conn, body)
    if method == 'DELETE':
        return delete_field(cur, conn, body)
    return {'error': 'Method not allowed'}, 405


def get_groups(cur):
    cur.execute("""
        SELECT
            g.id, g.name, g.description, g.created_at, g.updated_at,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', f.id,
                        'name', f.name,
                        'field_type', f.field_type,
                        'is_required', f.is_required,
                        'options', f.options,
                        'hide_label', f.hide_label
                    ) ORDER BY gf.id
                ) FILTER (WHERE f.id IS NOT NULL),
                '[]'
            ) as fields
        FROM ticket_custom_field_groups g
        LEFT JOIN ticket_custom_field_group_fields gf ON g.id = gf.group_id
        LEFT JOIN ticket_custom_fields f ON gf.field_id = f.id
        GROUP BY g.id, g.name, g.description, g.created_at, g.updated_at
        ORDER BY g.id DESC
    """)

    return [
        {
            'id': r[0], 'name': r[1], 'description': r[2],
            'created_at': r[3], 'updated_at': r[4], 'fields': r[5]
        }
        for r in cur.fetchall()
    ]


def create_group(cur, conn, body):
    name = body.get('name')
    if not name:
        return {'error': 'Name is required'}, 400

    cur.execute(
        "INSERT INTO ticket_custom_field_groups (name, description) VALUES (%s, %s) RETURNING id",
        (name, body.get('description', ''))
    )
    group_id = cur.fetchone()[0]

    for field_id in body.get('field_ids', []):
        cur.execute(
            "INSERT INTO ticket_custom_field_group_fields (group_id, field_id) VALUES (%s, %s)",
            (group_id, field_id)
        )

    conn.commit()
    return {'id': group_id, 'message': 'Group created successfully'}


def update_group(cur, conn, body):
    group_id = body.get('id')
    name = body.get('name')
    if not group_id or not name:
        return {'error': 'ID and name are required'}, 400

    cur.execute(
        "UPDATE ticket_custom_field_groups SET name = %s, description = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
        (name, body.get('description', ''), group_id)
    )
    cur.execute("DELETE FROM ticket_custom_field_group_fields WHERE group_id = %s", (group_id,))

    for field_id in body.get('field_ids', []):
        cur.execute(
            "INSERT INTO ticket_custom_field_group_fields (group_id, field_id) VALUES (%s, %s)",
            (group_id, field_id)
        )

    conn.commit()
    return {'message': 'Group updated successfully'}


def delete_group(cur, conn, body):
    group_id = body.get('id')
    if not group_id:
        return {'error': 'ID is required'}, 400

    cur.execute("DELETE FROM ticket_custom_field_groups WHERE id = %s", (group_id,))
    conn.commit()
    return {'message': 'Group deleted successfully'}


def get_fields(cur):
    cur.execute(
        "SELECT id, name, field_type, options, is_required, hide_label, created_at "
        "FROM ticket_custom_fields ORDER BY id DESC"
    )
    return [
        {
            'id': r[0], 'name': r[1], 'field_type': r[2],
            'options': json.loads(r[3]) if r[3] else [],
            'is_required': r[4], 'hide_label': r[5], 'created_at': r[6]
        }
        for r in cur.fetchall()
    ]


def create_field(cur, conn, body):
    name = body.get('name')
    field_type = body.get('field_type', 'text')
    if not name:
        return {'error': 'Name is required'}, 400

    options = body.get('options')
    options_json = json.dumps(options, ensure_ascii=False) if options else None

    cur.execute(
        "INSERT INTO ticket_custom_fields (name, field_type, options, is_required, hide_label) "
        "VALUES (%s, %s, %s, %s, %s) RETURNING id, name, field_type, options, is_required, hide_label, created_at",
        (name, field_type, options_json, body.get('is_required', False), body.get('hide_label', False))
    )
    r = cur.fetchone()
    conn.commit()

    return {
        'id': r[0], 'name': r[1], 'field_type': r[2],
        'options': json.loads(r[3]) if r[3] else [],
        'is_required': r[4], 'hide_label': r[5], 'created_at': r[6]
    }


def update_field(cur, conn, body):
    field_id = body.get('id')
    name = body.get('name')
    if not field_id or not name:
        return {'error': 'ID and name are required'}, 400

    options = body.get('options')
    options_json = json.dumps(options, ensure_ascii=False) if options else None

    cur.execute(
        "UPDATE ticket_custom_fields SET name = %s, field_type = %s, options = %s, is_required = %s, hide_label = %s "
        "WHERE id = %s RETURNING id, name, field_type, options, is_required, hide_label, created_at",
        (name, body.get('field_type', 'text'), options_json, body.get('is_required', False), body.get('hide_label', False), field_id)
    )
    r = cur.fetchone()
    if not r:
        return {'error': 'Field not found'}, 404

    conn.commit()
    return {
        'id': r[0], 'name': r[1], 'field_type': r[2],
        'options': json.loads(r[3]) if r[3] else [],
        'is_required': r[4], 'hide_label': r[5], 'created_at': r[6]
    }


def delete_field(cur, conn, body):
    field_id = body.get('id')
    if not field_id:
        return {'error': 'ID is required'}, 400

    cur.execute("DELETE FROM ticket_custom_fields WHERE id = %s", (field_id,))
    conn.commit()
    return {'message': 'Field deleted successfully'}
