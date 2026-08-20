"""
Раздел «Контроль реакции»: журнал срабатываний триггеров напоминаний по заявкам.
Показывает, по каким заявкам уходили уведомления, какой триггер сработал,
кто исполнитель и отреагировал ли он после уведомления.
Доступ по праву response_control.read (или роли администратора).
"""
from shared_utils import response, verify_token, SCHEMA

TRIGGER_LABELS = {
    'no_reply': 'Триггер 1 — нет ответа исполнителя',
    'operator_silent': 'Триггер 2 — исполнитель молчит',
    'customer_waiting': 'Триггер 3 — заказчик ждёт ответа',
}

# Отреагировал ли исполнитель после уведомления:
# ищем комментарий любого сотрудника группы позже времени срабатывания
_REACTED_EXISTS = f"""
    EXISTS (
        SELECT 1 FROM {SCHEMA}.ticket_comments c
        JOIN {SCHEMA}.executor_group_members m ON m.user_id = c.user_id
        WHERE c.ticket_id = l.ticket_id
          AND m.group_id = l.group_id
          AND c.created_at > l.created_at
    )
"""


def _has_access(cur, user_id: int) -> bool:
    cur.execute(f"""
        SELECT 1
        FROM {SCHEMA}.user_roles ur
        JOIN {SCHEMA}.roles r ON r.id = ur.role_id
        LEFT JOIN {SCHEMA}.role_permissions rp ON rp.role_id = r.id
        LEFT JOIN {SCHEMA}.permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = %s
          AND (r.system_role = 'admin'
               OR (p.resource = 'response_control' AND p.action = 'read'))
        LIMIT 1
    """, (user_id,))
    return cur.fetchone() is not None


def _build_filters(params: dict):
    where = []
    args = []

    try:
        days_int = max(1, min(365, int(params.get('days') or 30)))
    except (TypeError, ValueError):
        days_int = 30
    where.append("l.created_at >= NOW() - (%s * INTERVAL '1 day')")
    args.append(days_int)

    kind = (params.get('trigger') or '').strip()
    if kind in TRIGGER_LABELS:
        where.append("l.trigger_kind = %s")
        args.append(kind)

    assignee = (params.get('assignee') or '').strip()
    if assignee.isdigit():
        where.append("l.assigned_to = %s")
        args.append(int(assignee))

    status = (params.get('status') or '').strip()
    if status.isdigit():
        where.append("l.status_id = %s")
        args.append(int(status))

    reaction = (params.get('reaction') or '').strip()
    if reaction == 'reacted':
        where.append(_REACTED_EXISTS)
    elif reaction == 'silent':
        where.append(f"NOT {_REACTED_EXISTS}")

    q = (params.get('q') or '').strip()
    if q:
        if q.isdigit():
            where.append("(l.ticket_id = %s OR t.title ILIKE %s)")
            args.extend([int(q), f"%{q}%"])
        else:
            where.append("t.title ILIKE %s")
            args.append(f"%{q}%")

    return " AND ".join(where), args, days_int


def handle_response_control(method: str, event: dict, conn) -> dict:
    """Журнал срабатываний триггеров напоминаний и сводка по сотрудникам"""
    if method != 'GET':
        return response(405, {'error': 'Метод не поддерживается'})

    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})

    cur = conn.cursor()
    if not _has_access(cur, payload.get('user_id')):
        return response(403, {'error': 'Нет доступа к разделу'})

    params = event.get('queryStringParameters') or {}
    where_sql, args, days_int = _build_filters(params)

    try:
        limit = max(1, min(200, int(params.get('limit') or 50)))
        offset = max(0, int(params.get('offset') or 0))
    except (TypeError, ValueError):
        limit, offset = 50, 0

    cur.execute(f"""
        SELECT COUNT(*) AS cnt
        FROM {SCHEMA}.ticket_response_log l
        JOIN {SCHEMA}.tickets t ON t.id = l.ticket_id
        WHERE {where_sql}
    """, args)
    total = int(cur.fetchone()['cnt'])

    cur.execute(f"""
        SELECT l.id, l.ticket_id, l.trigger_kind, l.interval_hours,
               l.reference_at, l.recipients_count, l.created_at,
               t.title AS ticket_title,
               s.name AS status_name,
               g.name AS group_name,
               au.full_name AS assignee_name,
               {_REACTED_EXISTS} AS reacted,
               (
                   SELECT MIN(c.created_at) FROM {SCHEMA}.ticket_comments c
                   JOIN {SCHEMA}.executor_group_members m ON m.user_id = c.user_id
                   WHERE c.ticket_id = l.ticket_id
                     AND m.group_id = l.group_id
                     AND c.created_at > l.created_at
               ) AS reacted_at
        FROM {SCHEMA}.ticket_response_log l
        JOIN {SCHEMA}.tickets t ON t.id = l.ticket_id
        LEFT JOIN {SCHEMA}.ticket_statuses s ON s.id = l.status_id
        LEFT JOIN {SCHEMA}.executor_groups g ON g.id = l.group_id
        LEFT JOIN {SCHEMA}.users au ON au.id = l.assigned_to
        WHERE {where_sql}
        ORDER BY l.created_at DESC
        LIMIT %s OFFSET %s
    """, args + [limit, offset])

    items = []
    for r in cur.fetchall():
        row = dict(r)
        row['trigger_label'] = TRIGGER_LABELS.get(row['trigger_kind'], row['trigger_kind'])
        items.append(row)

    cur.execute(f"""
        SELECT COALESCE(au.full_name, 'Не назначен') AS assignee_name,
               l.assigned_to,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE l.trigger_kind = 'no_reply') AS no_reply,
               COUNT(*) FILTER (WHERE l.trigger_kind = 'operator_silent') AS operator_silent,
               COUNT(*) FILTER (WHERE l.trigger_kind = 'customer_waiting') AS customer_waiting,
               COUNT(*) FILTER (WHERE NOT {_REACTED_EXISTS}) AS still_silent
        FROM {SCHEMA}.ticket_response_log l
        JOIN {SCHEMA}.tickets t ON t.id = l.ticket_id
        LEFT JOIN {SCHEMA}.users au ON au.id = l.assigned_to
        WHERE {where_sql}
        GROUP BY l.assigned_to, au.full_name
        ORDER BY total DESC
        LIMIT 50
    """, args)
    summary = [dict(r) for r in cur.fetchall()]

    cur.execute(f"""
        SELECT DISTINCT u.id, u.full_name
        FROM {SCHEMA}.ticket_response_log l
        JOIN {SCHEMA}.users u ON u.id = l.assigned_to
        ORDER BY u.full_name
    """)
    assignees = [dict(r) for r in cur.fetchall()]

    cur.execute(f"""
        SELECT DISTINCT s.id, s.name
        FROM {SCHEMA}.ticket_response_log l
        JOIN {SCHEMA}.ticket_statuses s ON s.id = l.status_id
        ORDER BY s.name
    """)
    statuses = [dict(r) for r in cur.fetchall()]

    return response(200, {
        'items': items,
        'total': total,
        'limit': limit,
        'offset': offset,
        'days': days_int,
        'summary': summary,
        'assignees': assignees,
        'statuses': statuses,
        'trigger_labels': TRIGGER_LABELS,
    })
