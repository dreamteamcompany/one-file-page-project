"""
Рассылка напоминаний по статусам заявок.
Для статусов с включённой настройкой notify_enabled проверяет две ситуации:
1) Исполнитель ещё не отвечал — отсчёт N часов идёт от времени создания заявки.
2) Исполнитель отвечал — отсчёт N часов идёт от его последнего комментария.
Текст берётся из шаблона уведомления с подстановкой хэштегов.
"""

EVENT_TYPE = 'status_reminder'


def _fmt_dt(value) -> str:
    if not value:
        return ''
    try:
        return value.strftime('%d.%m.%Y %H:%M')
    except Exception:
        return str(value)


def _render(template: str, ctx: dict) -> str:
    text = template or ''
    for tag, value in ctx.items():
        text = text.replace(tag, value if value else '')
    return text.strip()


def run_status_notifications(cur, schema: str) -> dict:
    """Создаёт напоминания по статусам заявок. Возвращает статистику."""
    created = 0
    checked_tickets = 0
    notified_users = set()

    cur.execute(f"""
        SELECT s.id, s.name, s.notify_interval_hours, s.notify_group_id,
               nt.content AS template_content
        FROM {schema}.ticket_statuses s
        JOIN {schema}.notification_templates nt ON nt.id = s.notify_template_id
        WHERE COALESCE(s.notify_enabled, false) = true
          AND s.notify_interval_hours IS NOT NULL
          AND s.notify_interval_hours > 0
          AND s.notify_group_id IS NOT NULL
          AND COALESCE(nt.is_active, false) = true
    """)
    statuses = cur.fetchall()

    for st in statuses:
        hours = int(st['notify_interval_hours'])
        group_id = int(st['notify_group_id'])

        cur.execute(f"""
            SELECT user_id FROM {schema}.executor_group_members WHERE group_id = %s
        """, (group_id,))
        operator_ids = [int(r['user_id']) for r in cur.fetchall() if r['user_id']]
        if not operator_ids:
            continue

        # Порог по времени считаем прямо в SQL — возвращаем только "созревшие" заявки.
        # Точка отсчёта:
        #   1) оператор не отвечал        -> создание заявки
        #   2) последний ответил оператор -> его последний комментарий
        #   3) последний ответил заказчик -> его комментарий (ждём ответа оператора)
        cur.execute(f"""
            SELECT t.id, t.title, t.created_at, t.assigned_to, t.due_date,
                   p.name AS priority_name,
                   au.full_name AS assignee_name,
                   cu.full_name AS author_name,
                   lc.comment AS last_comment,
                   lcu.full_name AS last_comment_author,
                   CASE
                       WHEN lc.user_id IS NOT NULL AND NOT (lc.user_id = ANY(%s)) THEN 'customer_waiting'
                       WHEN op.last_op_at IS NOT NULL THEN 'operator_silent'
                       ELSE 'no_reply'
                   END AS trigger_kind
            FROM {schema}.tickets t
            LEFT JOIN {schema}.ticket_priorities p ON p.id = t.priority_id
            LEFT JOIN {schema}.users au ON au.id = t.assigned_to
            LEFT JOIN {schema}.users cu ON cu.id = t.created_by
            LEFT JOIN LATERAL (
                SELECT c.comment, c.user_id, c.created_at
                FROM {schema}.ticket_comments c
                WHERE c.ticket_id = t.id
                ORDER BY c.created_at DESC
                LIMIT 1
            ) lc ON true
            LEFT JOIN {schema}.users lcu ON lcu.id = lc.user_id
            LEFT JOIN LATERAL (
                SELECT MAX(c2.created_at) AS last_op_at
                FROM {schema}.ticket_comments c2
                WHERE c2.ticket_id = t.id
                  AND c2.user_id = ANY(%s)
            ) op ON true
            WHERE t.status_id = %s
              AND COALESCE(t.is_archived, false) = false
              AND (NOW() - (
                    CASE
                        WHEN lc.user_id IS NOT NULL AND NOT (lc.user_id = ANY(%s)) THEN lc.created_at
                        ELSE COALESCE(op.last_op_at, t.created_at)
                    END
                  )) >= (%s * INTERVAL '1 hour')
        """, (operator_ids, operator_ids, st['id'], operator_ids, hours))
        tickets = cur.fetchall()
        checked_tickets += len(tickets)

        if not tickets:
            continue

        ticket_ids = [int(tk['id']) for tk in tickets]

        # Наблюдатели по всем заявкам разом
        watchers_map = {}
        cur.execute(f"""
            SELECT ticket_id, user_id FROM {schema}.ticket_watchers
            WHERE ticket_id = ANY(%s) AND user_id IS NOT NULL
        """, (ticket_ids,))
        for w in cur.fetchall():
            watchers_map.setdefault(int(w['ticket_id']), set()).add(int(w['user_id']))

        # Уже отправленные напоминания за период — тоже одним запросом
        sent_map = {}
        cur.execute(f"""
            SELECT ticket_id, user_id FROM {schema}.notifications
            WHERE ticket_id = ANY(%s)
              AND event_type = %s
              AND created_at > NOW() - (%s * INTERVAL '1 hour')
        """, (ticket_ids, EVENT_TYPE, hours))
        for r in cur.fetchall():
            sent_map.setdefault(int(r['ticket_id']), set()).add(int(r['user_id']))

        rows_to_insert = []
        for tk in tickets:
            tid = int(tk['id'])

            recipients = set(operator_ids)
            if tk['assigned_to']:
                recipients.add(int(tk['assigned_to']))
            recipients |= watchers_map.get(tid, set())
            recipients -= sent_map.get(tid, set())

            if not recipients:
                continue

            ctx = {
                '#номер_заявки': str(tid),
                '#тема_заявки': tk['title'] or '',
                '#последний_комментарий': (tk['last_comment'] or '')[:300],
                '#автор_комментария': tk['last_comment_author'] or '',
                '#статус': st['name'] or '',
                '#приоритет': tk['priority_name'] or '',
                '#ответственный': tk['assignee_name'] or '',
                '#автор_заявки': tk['author_name'] or '',
                '#срок': _fmt_dt(tk['due_date']),
                '#ссылка_на_заявку': f"/tickets/{tid}",
            }
            message = _render(st['template_content'], ctx)
            if not message:
                continue

            for uid in recipients:
                rows_to_insert.append((uid, tid, message))
                notified_users.add(uid)

        # Вставка пачкой — один запрос на статус
        if rows_to_insert:
            CHUNK = 500
            for i in range(0, len(rows_to_insert), CHUNK):
                chunk = rows_to_insert[i:i + CHUNK]
                values_sql = ','.join(['(%s, %s, %s, %s, %s, false, NOW())'] * len(chunk))
                args = []
                for uid, tid, message in chunk:
                    args.extend([uid, tid, EVENT_TYPE, EVENT_TYPE, message])
                cur.execute(f"""
                    INSERT INTO {schema}.notifications
                        (user_id, ticket_id, type, event_type, message, is_read, created_at)
                    VALUES {values_sql}
                """, args)
                created += len(chunk)

    return {
        'statuses_with_notify': len(statuses),
        'tickets_checked': checked_tickets,
        'notifications_created': created,
        'users_notified': len(notified_users),
    }