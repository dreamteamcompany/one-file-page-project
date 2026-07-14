"""
Фоновая задача: перераспределение открытых заявок по рабочему графику.
Запускается по расписанию (cron, например каждые 5-10 минут).

Логика (только для групп с auto_assign_type = 'working'):
- Берём открытые (не закрытые) заявки, назначенные на участников таких групп.
- Если у текущего исполнителя сейчас НЕ его рабочая смена (нет активной записи
  в work_schedules на текущий момент по МСК), а в группе есть коллеги, которые
  СЕЙЧАС на смене — передаём заявку наименее загруженному из работающих коллег.
- Если на смене в группе никого нет — оставляем заявку как есть.
- Балансировка по нагрузке: получатель — тот, у кого меньше всего активных заявок
  (по статусам с count_for_distribution = true).
- Каждая передача фиксируется записью в ticket_history.

Вторая ветка (бесхозные заявки):
- Берём открытые заявки без исполнителя (assigned_to IS NULL), но с группой
  типа 'working'. Если в группе сейчас кто-то на смене — назначаем наименее
  загруженному. Так подхватываются заявки, созданные когда на смене никого не было.
"""
import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timezone, timedelta

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA')


def handler(event: dict, context) -> dict:
    """Перераспределение заявок при окончании рабочего дня исполнителя"""
    conn = psycopg2.connect(
        DATABASE_URL,
        cursor_factory=RealDictCursor,
        options=f'-c search_path={SCHEMA},public'
    )
    cur = conn.cursor()

    now_msk = datetime.now(timezone.utc) + timedelta(hours=3)
    current_day = now_msk.weekday()
    current_time = now_msk.strftime('%H:%M:%S')

    reassigned = 0
    details = []

    try:
        cur.execute(f"""
            SELECT t.id AS ticket_id, t.assigned_to, t.executor_group_id,
                   g.id AS group_id, g.balance_mode
            FROM {SCHEMA}.tickets t
            JOIN {SCHEMA}.ticket_statuses st ON st.id = t.status_id
            JOIN {SCHEMA}.executor_group_members gm ON gm.user_id = t.assigned_to
            JOIN {SCHEMA}.executor_groups g ON g.id = gm.group_id
                AND g.is_active = true
                AND g.auto_assign_type = 'working'
            WHERE t.assigned_to IS NOT NULL
              AND COALESCE(t.is_archived, false) = false
              AND COALESCE(st.is_closed, false) = false
              AND NOT EXISTS (
                  SELECT 1 FROM {SCHEMA}.work_schedules ws
                  WHERE ws.user_id = t.assigned_to
                    AND ws.day_of_week = %s
                    AND ws.is_active = true
                    AND ws.start_time <= %s::time
                    AND ws.end_time > %s::time
              )
            ORDER BY t.id
        """, (current_day, current_time, current_time))
        candidates = cur.fetchall()

        for tk in candidates:
            ticket_id = tk['ticket_id']
            group_id = tk['group_id']
            old_user = tk['assigned_to']

            new_user = _pick_working_member(
                cur, group_id, current_day, current_time, exclude_user=old_user
            )
            if not new_user or new_user == old_user:
                continue

            cur.execute(f"""
                UPDATE {SCHEMA}.tickets
                SET assigned_to = %s, updated_at = NOW()
                WHERE id = %s
            """, (new_user, ticket_id))

            old_name = _user_name(cur, old_user)
            new_name = _user_name(cur, new_user)
            cur.execute(f"""
                INSERT INTO {SCHEMA}.ticket_history
                    (ticket_id, user_id, field_name, old_value, new_value, created_at)
                VALUES (%s, NULL, 'assigned_to', %s, %s, NOW())
            """, (ticket_id, old_name, f"{new_name} (передано: окончание смены)"))

            reassigned += 1
            details.append({'ticket_id': ticket_id, 'from': old_user, 'to': new_user})

        cur.execute(f"""
            SELECT t.id AS ticket_id, t.executor_group_id AS group_id
            FROM {SCHEMA}.tickets t
            JOIN {SCHEMA}.ticket_statuses st ON st.id = t.status_id
            JOIN {SCHEMA}.executor_groups g ON g.id = t.executor_group_id
                AND g.is_active = true
                AND g.auto_assign_type = 'working'
            WHERE t.assigned_to IS NULL
              AND t.executor_group_id IS NOT NULL
              AND COALESCE(t.is_archived, false) = false
              AND COALESCE(st.is_closed, false) = false
            ORDER BY t.id
        """)
        unassigned = cur.fetchall()

        assigned = 0
        for tk in unassigned:
            ticket_id = tk['ticket_id']
            group_id = tk['group_id']

            new_user = _pick_working_member(
                cur, group_id, current_day, current_time, exclude_user=0
            )
            if not new_user:
                continue

            cur.execute(f"""
                UPDATE {SCHEMA}.tickets
                SET assigned_to = %s, updated_at = NOW()
                WHERE id = %s AND assigned_to IS NULL
            """, (new_user, ticket_id))

            new_name = _user_name(cur, new_user)
            cur.execute(f"""
                INSERT INTO {SCHEMA}.ticket_history
                    (ticket_id, user_id, field_name, old_value, new_value, created_at)
                VALUES (%s, NULL, 'assigned_to', %s, %s, NOW())
            """, (ticket_id, 'Не назначен', f"{new_name} (назначено: выход на смену)"))

            assigned += 1
            details.append({'ticket_id': ticket_id, 'from': None, 'to': new_user})

        conn.commit()
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
            'body': json.dumps({
                'checked': len(candidates),
                'reassigned': reassigned,
                'unassigned_checked': len(unassigned),
                'assigned': assigned,
                'details': details,
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


def _pick_working_member(cur, group_id, current_day, current_time, exclude_user):
    """Выбирает участника группы, который СЕЙЧАС на смене, с минимальной нагрузкой.
    Нагрузка = число активных заявок (статусы с count_for_distribution = true)."""
    cur.execute(f"""
        SELECT m.user_id, m.is_lead, COALESCE(tc.ticket_count, 0) AS ticket_count
        FROM {SCHEMA}.executor_group_members m
        JOIN {SCHEMA}.users u ON u.id = m.user_id AND u.is_active = true
        JOIN {SCHEMA}.work_schedules ws ON ws.user_id = m.user_id
            AND ws.day_of_week = %s
            AND ws.is_active = true
            AND ws.start_time <= %s::time
            AND ws.end_time > %s::time
        LEFT JOIN (
            SELECT assigned_to, COUNT(*) AS ticket_count
            FROM {SCHEMA}.tickets t
            JOIN {SCHEMA}.ticket_statuses s ON s.id = t.status_id
                AND s.count_for_distribution = true
            WHERE COALESCE(t.is_archived, false) = false
            GROUP BY assigned_to
        ) tc ON tc.assigned_to = m.user_id
        WHERE m.group_id = %s AND m.user_id <> %s
        ORDER BY ticket_count ASC, m.is_lead DESC, RANDOM()
        LIMIT 1
    """, (current_day, current_time, current_time, group_id, exclude_user))
    row = cur.fetchone()
    return row['user_id'] if row else None


def _user_name(cur, user_id):
    if not user_id:
        return 'Не назначен'
    cur.execute(f"""
        SELECT COALESCE(full_name, username) AS name
        FROM {SCHEMA}.users WHERE id = %s
    """, (user_id,))
    row = cur.fetchone()
    return row['name'] if row else f'#{user_id}'