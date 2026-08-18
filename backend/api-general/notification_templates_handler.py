import json
from shared_utils import response, SCHEMA

HASHTAGS = [
    {'tag': '#номер_заявки', 'label': 'Номер заявки', 'example': '10245'},
    {'tag': '#тема_заявки', 'label': 'Тема заявки', 'example': 'Не работает принтер'},
    {'tag': '#последний_комментарий', 'label': 'Последний комментарий', 'example': 'Проверьте, пожалуйста, кабель'},
    {'tag': '#автор_комментария', 'label': 'Автор последнего комментария', 'example': 'Иванов Иван'},
    {'tag': '#статус', 'label': 'Статус заявки', 'example': 'В работе'},
    {'tag': '#приоритет', 'label': 'Приоритет заявки', 'example': 'Высокий'},
    {'tag': '#ответственный', 'label': 'Ответственный исполнитель', 'example': 'Петров Пётр'},
    {'tag': '#автор_заявки', 'label': 'Автор заявки', 'example': 'Сидорова Анна'},
    {'tag': '#срок', 'label': 'Срок решения', 'example': '20.08.2026 18:00'},
    {'tag': '#ссылка_на_заявку', 'label': 'Ссылка на заявку', 'example': '/tickets/10245'},
]


def _is_admin(cur, user_id):
    cur.execute(
        "SELECT 1 FROM {0}.user_roles ur JOIN {0}.roles r ON r.id = ur.role_id "
        "WHERE ur.user_id = %s AND r.system_role = 'admin' LIMIT 1".format(SCHEMA),
        (user_id,)
    )
    return cur.fetchone() is not None


def handle_notification_templates(method, event, conn, payload):
    """Справочник шаблонов текстов уведомлений с хэштегами-подстановками"""
    params = event.get('queryStringParameters', {}) or {}
    user_id = payload.get('user_id')
    cur = conn.cursor()
    is_admin = _is_admin(cur, user_id)

    if method == 'GET':
        q = (params.get('q') or '').strip()
        where = ''
        args = []
        if q:
            where = "WHERE (nt.name ILIKE %s OR nt.content ILIKE %s)"
            args = ['%' + q + '%', '%' + q + '%']

        cur.execute(
            "SELECT nt.id, nt.name, nt.content, nt.description, nt.is_active, "
            "nt.created_by, nt.created_at, nt.updated_at, u.full_name AS author_name "
            "FROM {0}.notification_templates nt "
            "LEFT JOIN {0}.users u ON u.id = nt.created_by "
            "{1} ORDER BY nt.is_active DESC, nt.name ASC".format(SCHEMA, where),
            args
        )
        items = [dict(r) for r in cur.fetchall()]
        return response(200, {'templates': items, 'hashtags': HASHTAGS, 'can_edit': is_admin})

    if not is_admin:
        return response(403, {'error': 'Изменять уведомления может только администратор'})

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        name = (body.get('name') or '').strip()
        content = (body.get('content') or '').strip()
        description = (body.get('description') or '').strip() or None
        is_active = bool(body.get('is_active', True))

        if not name:
            return response(400, {'error': 'Название уведомления обязательно'})
        if not content:
            return response(400, {'error': 'Текст уведомления обязателен'})

        cur.execute(
            "INSERT INTO {}.notification_templates (name, content, description, is_active, created_by) "
            "VALUES (%s, %s, %s, %s, %s) "
            "RETURNING id, name, content, description, is_active, created_by, created_at, updated_at".format(SCHEMA),
            (name, content, description, is_active, user_id)
        )
        tmpl = dict(cur.fetchone())
        conn.commit()
        return response(201, tmpl)

    if method == 'PUT':
        tmpl_id = params.get('id')
        if not tmpl_id or not str(tmpl_id).isdigit():
            return response(400, {'error': 'Не указан id уведомления'})

        cur.execute(
            "SELECT * FROM {}.notification_templates WHERE id = %s".format(SCHEMA),
            (int(tmpl_id),)
        )
        tmpl = cur.fetchone()
        if not tmpl:
            return response(404, {'error': 'Уведомление не найдено'})

        body = json.loads(event.get('body') or '{}')
        name = (body.get('name') or tmpl['name']).strip()
        content = (body.get('content') or tmpl['content']).strip()
        description = body.get('description', tmpl['description'])
        if isinstance(description, str):
            description = description.strip() or None
        is_active = bool(body.get('is_active', tmpl['is_active']))

        cur.execute(
            "UPDATE {}.notification_templates SET name = %s, content = %s, description = %s, "
            "is_active = %s, updated_at = NOW() WHERE id = %s "
            "RETURNING id, name, content, description, is_active, created_by, created_at, updated_at".format(SCHEMA),
            (name, content, description, is_active, int(tmpl_id))
        )
        updated = dict(cur.fetchone())
        conn.commit()
        return response(200, updated)

    if method == 'DELETE':
        tmpl_id = params.get('id')
        if not tmpl_id or not str(tmpl_id).isdigit():
            return response(400, {'error': 'Не указан id уведомления'})

        cur.execute(
            "DELETE FROM {}.notification_templates WHERE id = %s".format(SCHEMA),
            (int(tmpl_id),)
        )
        deleted = cur.rowcount
        conn.commit()
        if not deleted:
            return response(404, {'error': 'Уведомление не найдено'})
        return response(200, {'ok': True})

    return response(405, {'error': 'Method not allowed'})
