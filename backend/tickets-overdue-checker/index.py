"""
Фоновая задача: пометка просроченных заявок и создание уведомлений 'overdue'.
Запускается по расписанию (cron). Идемпотентна — для одной заявки уведомление 'overdue' создаётся один раз в сутки.
"""
import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from status_notify import run_status_notifications

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA')


def handler(event: dict, context) -> dict:
    """Проверка просроченных заявок и рассылка уведомлений"""
    conn = psycopg2.connect(
        DATABASE_URL,
        cursor_factory=RealDictCursor,
        options=f'-c search_path={SCHEMA},public'
    )
    cur = conn.cursor()

    created_overdue = 0
    notified_users = set()

    try:
        cur.execute(f"""
            SELECT t.id, t.title, t.assigned_to, t.created_by, t.due_date,
                   COALESCE(s.is_closed, false) AS is_closed
            FROM {SCHEMA}.tickets t
            LEFT JOIN {SCHEMA}.ticket_statuses s ON s.id = t.status_id
            WHERE t.due_date IS NOT NULL
              AND t.due_date < NOW()
              AND COALESCE(s.is_closed, false) = false
        """)
        overdue_tickets = cur.fetchall()

        overdue_ids = [int(tk['id']) for tk in overdue_tickets]

        watchers_map = {}
        sent_map = {}
        if overdue_ids:
            cur.execute(f"""
                SELECT ticket_id, user_id FROM {SCHEMA}.ticket_watchers
                WHERE ticket_id = ANY(%s) AND user_id IS NOT NULL
            """, (overdue_ids,))
            for w in cur.fetchall():
                watchers_map.setdefault(int(w['ticket_id']), set()).add(int(w['user_id']))

            cur.execute(f"""
                SELECT ticket_id, user_id FROM {SCHEMA}.notifications
                WHERE ticket_id = ANY(%s)
                  AND event_type = 'overdue'
                  AND created_at > NOW() - INTERVAL '24 hours'
            """, (overdue_ids,))
            for r in cur.fetchall():
                sent_map.setdefault(int(r['ticket_id']), set()).add(int(r['user_id']))

        overdue_rows = []
        for tk in overdue_tickets:
            ticket_id = int(tk['id'])
            recipients = set()
            if tk['assigned_to']:
                recipients.add(int(tk['assigned_to']))
            if tk['created_by']:
                recipients.add(int(tk['created_by']))
            recipients |= watchers_map.get(ticket_id, set())
            recipients -= sent_map.get(ticket_id, set())

            if not recipients:
                continue

            message = f"Заявка #{ticket_id} «{tk['title']}» просрочена"
            for uid in recipients:
                overdue_rows.append((uid, ticket_id, message))
                notified_users.add(uid)

        if overdue_rows:
            CHUNK = 500
            for i in range(0, len(overdue_rows), CHUNK):
                chunk = overdue_rows[i:i + CHUNK]
                values_sql = ','.join(["(%s, %s, 'overdue', 'overdue', %s, false, NOW())"] * len(chunk))
                args = []
                for uid, tid, msg in chunk:
                    args.extend([uid, tid, msg])
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.notifications
                        (user_id, ticket_id, type, event_type, message, is_read, created_at)
                    VALUES {values_sql}
                """, args)
                created_overdue += len(chunk)

        conn.commit()

        status_stats = {}
        try:
            status_stats = run_status_notifications(cur, SCHEMA)
            conn.commit()
        except Exception as e:
            conn.rollback()
            import traceback
            print(f"[status-notify] error: {e}\n{traceback.format_exc()}")
            status_stats = {'error': str(e)}

        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
            'body': json.dumps({
                'overdue_tickets': len(overdue_tickets),
                'notifications_created': created_overdue,
                'users_notified': len(notified_users),
                'status_notifications': status_stats,
            })
        }
    except Exception as e:
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)})
        }
    finally:
        cur.close()
        conn.close()