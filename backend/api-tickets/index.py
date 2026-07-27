"""
API для работы с заявками (tickets) и категориями сервисов (service_categories)
"""
import json
import re
import traceback
from typing import Dict, Any, Optional, Set, List
from pydantic import BaseModel, Field
from shared_utils import response, get_db_connection, verify_token, handle_options, get_endpoint, SCHEMA
from group_tracking_service import open_log_entry, track_assignment_change, track_ticket_closed


# Лимит размера ответа Cloud Functions (~4 МБ). Чтобы гарантированно влезть,
# вырезаем огромные inline base64-изображения из текста комментариев в bundle-ответе.
_MAX_INLINE_DATA_URI_BYTES = 30 * 1024
_DATA_URI_RE = re.compile(r'!\[([^\]]*)\]\((data:[^;)]+;base64,[^\)]+)\)')
_RAW_DATA_URI_RE = re.compile(r'(data:[^;)\s]+;base64,[A-Za-z0-9+/=]+)')


def _strip_heavy_inline_images(text: str, comment_id: int) -> str:
    """Заменяет тяжёлые data:base64 картинки в markdown-тексте плейсхолдером."""
    if not text or 'base64,' not in text:
        return text

    def md_repl(m):
        alt = m.group(1) or 'image'
        data_uri = m.group(2)
        if len(data_uri) > _MAX_INLINE_DATA_URI_BYTES:
            return f'![{alt}](inline://comment/{comment_id})'
        return m.group(0)

    out = _DATA_URI_RE.sub(md_repl, text)

    def raw_repl(m):
        data_uri = m.group(1)
        if len(data_uri) > _MAX_INLINE_DATA_URI_BYTES:
            return '[вложение слишком большое — открыть из заявки]'
        return data_uri

    out = _RAW_DATA_URI_RE.sub(raw_repl, out)
    return out


def _get_user_role_info(cur, user_id: int) -> Dict[str, Any]:
    """Возвращает информацию о ролях пользователя: список role_id и флаг is_admin"""
    cur.execute(
        f"""
        SELECT ur.role_id, r.system_role
        FROM {SCHEMA}.user_roles ur
        JOIN {SCHEMA}.roles r ON r.id = ur.role_id
        WHERE ur.user_id = %s
        """,
        (user_id,)
    )
    rows = cur.fetchall()
    role_ids = [r['role_id'] for r in rows]
    is_admin = any((r.get('system_role') or '').lower() == 'admin' for r in rows)
    return {'role_ids': role_ids, 'is_admin': is_admin}


def _can_see_internal(cur, user_id: int) -> bool:
    """Скрытые (внутренние) комментарии видят только Администратор и Исполнитель"""
    if not user_id:
        return False
    cur.execute(f"""
        SELECT r.name, r.system_role
        FROM {SCHEMA}.user_roles ur
        JOIN {SCHEMA}.roles r ON r.id = ur.role_id
        WHERE ur.user_id = %s
    """, (int(user_id),))
    for row in cur.fetchall():
        name = (row.get('name') or '').strip().lower()
        system_role = (row.get('system_role') or '').strip().lower()
        if system_role in ('admin', 'executor') or name in ('admin', 'администратор', 'исполнитель'):
            return True
    return False


def _filter_statuses_by_role(statuses: List[Dict[str, Any]], role_info: Dict[str, Any],
                              status_role_map: Dict[int, List[int]]) -> List[Dict[str, Any]]:
    """Оставляет только статусы, доступные роли пользователя.

    Правила:
    - admin видит все статусы;
    - если у статуса нет ни одной привязанной роли — статус скрыт у всех (кроме admin);
    - иначе статус виден, если у пользователя есть хотя бы одна разрешённая роль.
    """
    if role_info.get('is_admin'):
        return statuses
    user_roles = set(role_info.get('role_ids') or [])
    out = []
    for st in statuses:
        allowed = set(status_role_map.get(st['id'], []))
        if not allowed:
            continue
        if allowed & user_roles:
            out.append(st)
    return out


def _load_status_role_map(cur) -> Dict[int, List[int]]:
    """Возвращает {status_id: [role_id, ...]}"""
    cur.execute(f"SELECT status_id, role_id FROM {SCHEMA}.ticket_status_roles")
    res: Dict[int, List[int]] = {}
    for row in cur.fetchall():
        res.setdefault(row['status_id'], []).append(row['role_id'])
    return res


def _replace_status_roles(cur, status_id: int, role_ids: List[int]) -> None:
    """Перезаписывает связи статуса с ролями"""
    cur.execute(f"DELETE FROM {SCHEMA}.ticket_status_roles WHERE status_id = %s", (status_id,))
    clean = []
    seen = set()
    for rid in role_ids or []:
        try:
            r = int(rid)
        except (TypeError, ValueError):
            continue
        if r in seen:
            continue
        seen.add(r)
        clean.append(r)
    for rid in clean:
        cur.execute(
            f"INSERT INTO {SCHEMA}.ticket_status_roles (status_id, role_id) VALUES (%s, %s)",
            (status_id, rid)
        )


def _ticket_participants(cur, ticket_id: int, created_by: Optional[int] = None,
                          assigned_to: Optional[int] = None) -> Set[int]:
    """Возвращает все user_id, которые участвуют в заявке"""
    ids: Set[int] = set()
    if created_by:
        ids.add(created_by)
    if assigned_to:
        ids.add(assigned_to)

    cur.execute(f"SELECT user_id FROM {SCHEMA}.ticket_watchers WHERE ticket_id = %s", (ticket_id,))
    ids.update(r['user_id'] for r in cur.fetchall())

    cur.execute(f"SELECT approver_id FROM {SCHEMA}.ticket_approvers WHERE ticket_id = %s", (ticket_id,))
    ids.update(r['approver_id'] for r in cur.fetchall())
    return ids


def _notify(cur, recipients: Set[int], actor_id: int, ticket_id: int,
            event_type: str, message: str, payload: Optional[dict] = None) -> None:
    """Создаёт notifications для списка получателей (исключая актора)"""
    targets = [uid for uid in recipients if uid and uid != actor_id]
    if not targets:
        return
    payload_json = json.dumps(payload) if payload else None
    for uid in targets:
        try:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.notifications
                (user_id, ticket_id, type, message, is_read, event_type, actor_id, payload, created_at)
                VALUES (%s, %s, %s, %s, false, %s, %s, %s, NOW())
            """, (uid, ticket_id, event_type, message, event_type, actor_id, payload_json))
        except Exception as e:
            print(f"[notify] failed for user {uid}: {e}")
from priorities_handler import handle_ticket_priorities
from sla_handler import handle_sla, handle_sla_priority_times
from sla_group_budgets_handler import handle_sla_group_budgets
from sla_service_mappings_handler import handle_sla_service_mappings, resolve_sla_for_ticket
from sla_analytics_handler import handle_sla_analytics
from executor_assignment_resolver import resolve_executor, resolve_executor_group
from bitrix_bot_notifier import notify_executor_assigned, notify_watcher_added
from max_bot_notifier import (
    notify_executor_assigned as max_notify_executor_assigned,
    notify_watcher_added as max_notify_watcher_added,
)


def _resolve_watcher_target_user_ids(cur, targets: List[Dict[str, Any]]) -> List[int]:
    """Разворачивает targets правил (user/group/role) в плоский список user_id."""
    user_ids: Set[int] = set()
    user_targets = [t['target_id'] for t in targets if t['target_type'] == 'user']
    group_targets = [t['target_id'] for t in targets if t['target_type'] == 'group']
    role_targets = [t['target_id'] for t in targets if t['target_type'] == 'role']

    for uid in user_targets:
        if uid:
            user_ids.add(int(uid))

    if group_targets:
        ids_csv = ','.join(str(int(x)) for x in group_targets)
        cur.execute(f"""
            SELECT user_id FROM {SCHEMA}.executor_group_members
            WHERE group_id IN ({ids_csv})
        """)
        for r in cur.fetchall():
            user_ids.add(int(r['user_id']))

    if role_targets:
        ids_csv = ','.join(str(int(x)) for x in role_targets)
        cur.execute(f"""
            SELECT ur.user_id FROM {SCHEMA}.user_roles ur
            WHERE ur.role_id IN ({ids_csv})
        """)
        for r in cur.fetchall():
            user_ids.add(int(r['user_id']))

    return list(user_ids)


def _apply_watcher_rules(conn, ticket_id: int, trigger: str, app_origin: str = '') -> List[int]:
    """Применяет правила наблюдателей к заявке (trigger='create' или 'update').
    Возвращает список добавленных user_id."""
    if trigger not in ('create', 'update'):
        return []

    cur = conn.cursor()
    try:
        cur.execute(f"""
            SELECT id, category_id, department_id, priority_id, executor_group_id, assigned_to, created_by
            FROM {SCHEMA}.tickets WHERE id = %s
        """, (ticket_id,))
        ticket = cur.fetchone()
        if not ticket:
            return []

        trigger_field = 'trigger_on_create' if trigger == 'create' else 'trigger_on_update'
        cur.execute(f"""
            SELECT id, category_id, department_id, priority_id, executor_group_id, assignee_id, match_mode
            FROM {SCHEMA}.ticket_watcher_rules
            WHERE is_active = true AND {trigger_field} = true
        """)
        rules = [dict(r) for r in cur.fetchall()]

        matched_ids: List[int] = []
        for r in rules:
            mode = str(r.get('match_mode') or 'AND').upper()
            conditions = [
                (r.get('category_id'), ticket.get('category_id')),
                (r.get('department_id'), ticket.get('department_id')),
                (r.get('priority_id'), ticket.get('priority_id')),
                (r.get('executor_group_id'), ticket.get('executor_group_id')),
                (r.get('assignee_id'), ticket.get('assigned_to')),
            ]
            non_empty = [(rv, tv) for rv, tv in conditions if rv]
            if not non_empty:
                continue
            if mode == 'OR':
                if not any(rv == tv for rv, tv in non_empty):
                    continue
            else:
                if not all(rv == tv for rv, tv in non_empty):
                    continue
            matched_ids.append(r['id'])

        if not matched_ids:
            return []

        ids_csv = ','.join(str(int(x)) for x in matched_ids)
        cur.execute(f"""
            SELECT rule_id, target_type, target_id
            FROM {SCHEMA}.ticket_watcher_rule_targets
            WHERE rule_id IN ({ids_csv})
        """)
        targets = [dict(t) for t in cur.fetchall()]
        user_ids = _resolve_watcher_target_user_ids(cur, targets)
        creator_id = ticket.get('created_by')

        added: List[int] = []
        for uid in user_ids:
            if not uid:
                continue
            if creator_id and uid == creator_id:
                continue
            cur.execute(f"""
                INSERT INTO {SCHEMA}.ticket_watchers (ticket_id, user_id)
                VALUES (%s, %s)
                ON CONFLICT (ticket_id, user_id) DO NOTHING
                RETURNING user_id
            """, (ticket_id, uid))
            row = cur.fetchone()
            if row:
                added.append(int(row['user_id']))

        conn.commit()

        for uid in added:
            try:
                notify_watcher_added(cur, SCHEMA, int(ticket_id), int(uid), app_origin=app_origin)
            except Exception as bot_err:
                print(f"[watcher-rules] bitrix notif failed t={ticket_id} u={uid}: {bot_err}")
            try:
                max_notify_watcher_added(cur, SCHEMA, int(ticket_id), int(uid), app_origin=app_origin)
            except Exception as bot_err:
                print(f"[watcher-rules] MAX notif failed t={ticket_id} u={uid}: {bot_err}")

        return added
    finally:
        try:
            cur.close()
        except Exception:
            pass


class TicketRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = Field(default='')
    status_id: Optional[int] = None
    priority_id: Optional[int] = None
    assigned_to: Optional[int] = None
    service_ids: list[int] = Field(default=[])
    custom_fields: dict = Field(default={})
    ticket_service_id: Optional[int] = None

class ServiceCategoryRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(default='')
    icon: str = Field(default='Folder')

class CategoryRequest(BaseModel):
    name: str = Field(..., min_length=1)
    icon: str = Field(default='Tag')

def handle_tickets_created_stats(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    """Подсчёт количества созданных заявок за выбранный период.

    Параметры (queryStringParameters):
      period — today | week | month | year | custom (по умолчанию month)
      from_date, to_date — даты в формате YYYY-MM-DD (для period=custom)

    Возвращает: { count, prev_count, change_percent, is_increase }
    """
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})

    if method != 'GET':
        return response(405, {'error': 'Только GET запросы'})

    params = event.get('queryStringParameters', {}) or {}
    period = (params.get('period') or 'month').strip().lower()

    period_sql = {
        'today': "date_trunc('day', NOW())",
        'week': "date_trunc('week', NOW())",
        'month': "date_trunc('month', NOW())",
        'year': "date_trunc('year', NOW())",
    }

    cur = conn.cursor()
    try:
        if period == 'custom':
            from_date = (params.get('from_date') or '').strip()
            to_date = (params.get('to_date') or '').strip()
            if not from_date or not to_date:
                return response(400, {'error': 'from_date и to_date обязательны для period=custom'})
            cur.execute(f"""
                SELECT COUNT(*) AS cnt
                FROM {SCHEMA}.tickets
                WHERE created_at >= %s::date
                  AND created_at < (%s::date + INTERVAL '1 day')
            """, (from_date, to_date))
            count = cur.fetchone()['cnt']
            return response(200, {
                'count': count,
                'prev_count': None,
                'change_percent': None,
                'is_increase': False,
            })

        trunc = period_sql.get(period, period_sql['month'])
        unit = {'today': 'day', 'week': 'week', 'month': 'month', 'year': 'year'}.get(period, 'month')

        cur.execute(f"""
            SELECT
                COUNT(*) FILTER (
                    WHERE created_at >= {trunc}
                ) AS current_count,
                COUNT(*) FILTER (
                    WHERE created_at >= {trunc} - INTERVAL '1 {unit}'
                      AND created_at < {trunc}
                ) AS prev_count
            FROM {SCHEMA}.tickets
            WHERE created_at >= {trunc} - INTERVAL '1 {unit}'
        """)
        row = cur.fetchone()
        current_count = row['current_count'] or 0
        prev_count = row['prev_count'] or 0

        if prev_count > 0:
            change_percent = round((current_count - prev_count) / prev_count * 100, 1)
        elif current_count > 0:
            change_percent = 100.0
        else:
            change_percent = 0.0

        return response(200, {
            'count': current_count,
            'prev_count': prev_count,
            'change_percent': change_percent,
            'is_increase': current_count >= prev_count,
        })
    finally:
        cur.close()


def handle_tickets_rating_stats(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    """Средняя оценка заявок за выбранный период (по полю rating, 1-5).

    Параметры (queryStringParameters):
      period — today | week | month | year | custom (по умолчанию month)
      from_date, to_date — даты YYYY-MM-DD (для period=custom)

    Считает по дате закрытия (closed_at), а если она пуста — по created_at.
    Возвращает: { avg_rating, rated_count }
    """
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})

    if method != 'GET':
        return response(405, {'error': 'Только GET запросы'})

    params = event.get('queryStringParameters', {}) or {}
    period = (params.get('period') or 'month').strip().lower()

    period_sql = {
        'today': "date_trunc('day', NOW())",
        'week': "date_trunc('week', NOW())",
        'month': "date_trunc('month', NOW())",
        'year': "date_trunc('year', NOW())",
    }

    date_expr = "COALESCE(closed_at, created_at)"

    cur = conn.cursor()
    try:
        if period == 'custom':
            from_date = (params.get('from_date') or '').strip()
            to_date = (params.get('to_date') or '').strip()
            if not from_date or not to_date:
                return response(400, {'error': 'from_date и to_date обязательны для period=custom'})
            cur.execute(f"""
                SELECT AVG(rating)::numeric(10,2) AS avg_rating, COUNT(*) AS rated_count
                FROM {SCHEMA}.tickets
                WHERE rating IS NOT NULL
                  AND {date_expr} >= %s::date
                  AND {date_expr} < (%s::date + INTERVAL '1 day')
            """, (from_date, to_date))
        else:
            trunc = period_sql.get(period, period_sql['month'])
            cur.execute(f"""
                SELECT AVG(rating)::numeric(10,2) AS avg_rating, COUNT(*) AS rated_count
                FROM {SCHEMA}.tickets
                WHERE rating IS NOT NULL
                  AND {date_expr} >= {trunc}
            """)

        row = cur.fetchone()
        avg_rating = float(row['avg_rating']) if row['avg_rating'] is not None else 0.0
        rated_count = row['rated_count'] or 0

        return response(200, {
            'avg_rating': round(avg_rating, 2),
            'rated_count': rated_count,
        })
    finally:
        cur.close()


def _fmt_duration(seconds: Optional[float]) -> str:
    """Форматирует длительность в человекочитаемый вид: '12 мин' или '4 ч 18 мин'."""
    if seconds is None:
        return '—'
    seconds = float(seconds)
    if seconds <= 0:
        return '—'
    total_min = int(round(seconds / 60.0))
    hours = total_min // 60
    mins = total_min % 60
    if hours > 0:
        return f"{hours} ч {mins:02d} мин"
    return f"{mins} мин"


def handle_dashboard_ops(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    """Операционный дашборд: KPI, динамика заявок, критические, возраст, нагрузка, каналы.

    Параметры (queryStringParameters):
      period — today | week | month | year | custom (по умолчанию month)
      from_date, to_date — даты YYYY-MM-DD (для period=custom)

    Возвращает единый JSON для дашборда "Операционный центр".
    """
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    if method != 'GET':
        return response(405, {'error': 'Только GET запросы'})

    params = event.get('queryStringParameters', {}) or {}
    period = (params.get('period') or 'month').strip().lower()

    period_sql = {
        'today': "date_trunc('day', NOW())",
        'week': "date_trunc('week', NOW())",
        'month': "date_trunc('month', NOW())",
        'year': "date_trunc('year', NOW())",
    }

    if period == 'custom':
        from_date = (params.get('from_date') or '').strip()
        to_date = (params.get('to_date') or '').strip()
        if not from_date or not to_date:
            return response(400, {'error': 'from_date и to_date обязательны для period=custom'})
        start_expr = "%(from_date)s::date"
        end_expr = "(%(to_date)s::date + INTERVAL '1 day')"
        prev_start_expr = "(%(from_date)s::date - (%(to_date)s::date - %(from_date)s::date) - INTERVAL '1 day')"
        prev_end_expr = "%(from_date)s::date"
    else:
        trunc = period_sql.get(period, period_sql['month'])
        unit = {'today': 'day', 'week': 'week', 'month': 'month', 'year': 'year'}.get(period, 'month')
        start_expr = trunc
        end_expr = "NOW()"
        prev_start_expr = f"{trunc} - INTERVAL '1 {unit}'"
        prev_end_expr = trunc

    qp = {'from_date': params.get('from_date'), 'to_date': params.get('to_date')}

    cur = conn.cursor()
    try:
        # 1) KPI
        cur.execute(f"""
            SELECT
                COUNT(*) FILTER (
                    WHERE NOT COALESCE(s.is_closed, false) AND NOT t.is_archived
                ) AS active_count,
                COUNT(*) FILTER (
                    WHERE t.created_at >= date_trunc('day', NOW())
                ) AS new_today,
                COUNT(*) FILTER (
                    WHERE NOT COALESCE(s.is_closed, false) AND NOT t.is_archived
                      AND t.due_date IS NOT NULL AND t.due_date < NOW()
                ) AS overdue_sla,
                COUNT(*) FILTER (
                    WHERE COALESCE(s.is_reopened, false)
                      AND t.created_at >= {start_expr} AND t.created_at < {end_expr}
                ) AS reopened_count
            FROM {SCHEMA}.tickets t
            LEFT JOIN {SCHEMA}.ticket_statuses s ON s.id = t.status_id
        """, qp)
        k = cur.fetchone()

        # Среднее время ответа и решения за период
        cur.execute(f"""
            SELECT
                AVG(EXTRACT(EPOCH FROM (t.confirmation_sent_at - t.created_at)))
                    FILTER (WHERE t.confirmation_sent_at IS NOT NULL) AS avg_response_sec,
                AVG(EXTRACT(EPOCH FROM (t.closed_at - t.created_at)))
                    FILTER (WHERE t.closed_at IS NOT NULL) AS avg_resolve_sec
            FROM {SCHEMA}.tickets t
            WHERE t.created_at >= {start_expr} AND t.created_at < {end_expr}
        """, qp)
        tm = cur.fetchone()

        # Предыдущий период для дельт активных/новых
        cur.execute(f"""
            SELECT
                COUNT(*) FILTER (WHERE t.created_at >= {start_expr} AND t.created_at < {end_expr}) AS cur_created,
                COUNT(*) FILTER (WHERE t.created_at >= {prev_start_expr} AND t.created_at < {prev_end_expr}) AS prev_created
            FROM {SCHEMA}.tickets t
        """, qp)
        d = cur.fetchone()
        cur_created = d['cur_created'] or 0
        prev_created = d['prev_created'] or 0
        created_delta = cur_created - prev_created

        kpi = {
            'active': int(k['active_count'] or 0),
            'new_today': int(k['new_today'] or 0),
            'overdue_sla': int(k['overdue_sla'] or 0),
            'avg_response': _fmt_duration(tm['avg_response_sec']),
            'avg_resolve': _fmt_duration(tm['avg_resolve_sec']),
            'reopened': int(k['reopened_count'] or 0),
            'created_delta': int(created_delta),
        }

        # 2) Динамика по дням: создано / закрыто
        cur.execute(f"""
            WITH days AS (
                SELECT generate_series(
                    date_trunc('day', {start_expr}),
                    date_trunc('day', {end_expr} - INTERVAL '1 second'),
                    INTERVAL '1 day'
                )::date AS d
            )
            SELECT
                days.d AS day,
                (SELECT COUNT(*) FROM {SCHEMA}.tickets t
                    WHERE t.created_at::date = days.d) AS created,
                (SELECT COUNT(*) FROM {SCHEMA}.tickets t
                    WHERE t.closed_at::date = days.d) AS closed
            FROM days
            ORDER BY days.d
        """, qp)
        dynamics = []
        running = 0
        for r in cur.fetchall():
            created = int(r['created'] or 0)
            closed = int(r['closed'] or 0)
            running += created - closed
            dynamics.append({
                'day': r['day'].strftime('%d.%m'),
                'created': created,
                'closed': closed,
                'open': max(running, 0),
            })

        # 3) Критические заявки (высокий/критический приоритет, активные, просроченные первыми)
        cur.execute(f"""
            SELECT t.id, t.title,
                   COALESCE(u.full_name, u.email, 'Клиент') AS author,
                   t.due_date,
                   EXTRACT(EPOCH FROM (NOW() - t.created_at)) AS age_sec
            FROM {SCHEMA}.tickets t
            LEFT JOIN {SCHEMA}.ticket_statuses s ON s.id = t.status_id
            LEFT JOIN {SCHEMA}.ticket_priorities p ON p.id = t.priority_id
            LEFT JOIN {SCHEMA}.users u ON u.id = t.created_by
            WHERE NOT COALESCE(s.is_closed, false) AND NOT t.is_archived
              AND (LOWER(COALESCE(p.name,'')) IN ('критический','высокий')
                   OR (t.due_date IS NOT NULL AND t.due_date < NOW()))
            ORDER BY (t.due_date IS NOT NULL AND t.due_date < NOW()) DESC, t.created_at ASC
            LIMIT 5
        """)
        critical = []
        for r in cur.fetchall():
            critical.append({
                'id': r['id'],
                'title': r['title'],
                'author': r['author'],
                'age': _fmt_duration(float(r['age_sec']) if r['age_sec'] is not None else None) + ' назад',
            })

        # 4) Возраст активных заявок
        cur.execute(f"""
            SELECT
                COUNT(*) FILTER (WHERE NOW() - t.created_at < INTERVAL '1 hour') AS lt1h,
                COUNT(*) FILTER (WHERE NOW() - t.created_at >= INTERVAL '1 hour'
                                   AND NOW() - t.created_at < INTERVAL '4 hour') AS h1_4,
                COUNT(*) FILTER (WHERE NOW() - t.created_at >= INTERVAL '4 hour'
                                   AND NOW() - t.created_at < INTERVAL '24 hour') AS h4_24,
                COUNT(*) FILTER (WHERE NOW() - t.created_at >= INTERVAL '24 hour') AS gt24h
            FROM {SCHEMA}.tickets t
            LEFT JOIN {SCHEMA}.ticket_statuses s ON s.id = t.status_id
            WHERE NOT COALESCE(s.is_closed, false) AND NOT t.is_archived
        """)
        a = cur.fetchone()
        age_total = (a['lt1h'] or 0) + (a['h1_4'] or 0) + (a['h4_24'] or 0) + (a['gt24h'] or 0)

        def _pct(v):
            return round((v or 0) / age_total * 100) if age_total else 0

        age_buckets = [
            {'label': 'До 1 часа', 'count': int(a['lt1h'] or 0), 'percent': _pct(a['lt1h'])},
            {'label': '1 – 4 часа', 'count': int(a['h1_4'] or 0), 'percent': _pct(a['h1_4'])},
            {'label': '4 – 24 часа', 'count': int(a['h4_24'] or 0), 'percent': _pct(a['h4_24'])},
            {'label': 'Более 24 часов', 'count': int(a['gt24h'] or 0), 'percent': _pct(a['gt24h'])},
        ]

        # 5) Нагрузка по часам (день недели x час) за период
        cur.execute(f"""
            SELECT EXTRACT(DOW FROM t.created_at)::int AS dow,
                   EXTRACT(HOUR FROM t.created_at)::int AS hour,
                   COUNT(*) AS cnt
            FROM {SCHEMA}.tickets t
            WHERE t.created_at >= {start_expr} AND t.created_at < {end_expr}
            GROUP BY 1, 2
        """, qp)
        # dow: 0=Вс..6=Сб → переведём в Пн..Вс
        heatmap = {}
        max_load = 0
        for r in cur.fetchall():
            dow = r['dow']
            row_idx = 6 if dow == 0 else dow - 1  # Пн=0 .. Вс=6
            cnt = int(r['cnt'] or 0)
            heatmap[f"{row_idx}-{r['hour']}"] = cnt
            if cnt > max_load:
                max_load = cnt

        # 6) Каналы (распределение по приоритетам как доступное измерение)
        cur.execute(f"""
            SELECT COALESCE(p.name, 'Без приоритета') AS name, COUNT(*) AS cnt
            FROM {SCHEMA}.tickets t
            LEFT JOIN {SCHEMA}.ticket_priorities p ON p.id = t.priority_id
            WHERE t.created_at >= {start_expr} AND t.created_at < {end_expr}
            GROUP BY 1
            ORDER BY cnt DESC
        """, qp)
        ch_rows = cur.fetchall()
        ch_total = sum(int(r['cnt'] or 0) for r in ch_rows) or 1
        channels = [{
            'name': r['name'],
            'count': int(r['cnt'] or 0),
            'percent': round(int(r['cnt'] or 0) / ch_total * 100),
        } for r in ch_rows]

        return response(200, {
            'kpi': kpi,
            'dynamics': dynamics,
            'critical': critical,
            'age_buckets': age_buckets,
            'heatmap': heatmap,
            'heatmap_max': max_load,
            'channels': channels,
        })
    finally:
        cur.close()


def handle_dashboard_sla(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    """Дашборд "SLA и качество".

    SLA-метрики (соблюдение, в срок/просрочено, по приоритетам, просроченные,
    мини-графики времени) — пока заглушки.
    CSAT, распределение оценок и среднее время первого ответа/решения — из БД.
    """
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    if method != 'GET':
        return response(405, {'error': 'Только GET запросы'})

    params = event.get('queryStringParameters', {}) or {}
    period = (params.get('period') or 'month').strip().lower()

    period_sql = {
        'today': "date_trunc('day', NOW())",
        'week': "date_trunc('week', NOW())",
        'month': "date_trunc('month', NOW())",
        'year': "date_trunc('year', NOW())",
    }

    if period == 'custom':
        from_date = (params.get('from_date') or '').strip()
        to_date = (params.get('to_date') or '').strip()
        if not from_date or not to_date:
            return response(400, {'error': 'from_date и to_date обязательны для period=custom'})
        start_expr = "%(from_date)s::date"
        end_expr = "(%(to_date)s::date + INTERVAL '1 day')"
    else:
        trunc = period_sql.get(period, period_sql['month'])
        start_expr = trunc
        end_expr = "NOW()"

    qp = {'from_date': params.get('from_date'), 'to_date': params.get('to_date')}

    cur = conn.cursor()
    try:
        # Среднее время первого ответа (по первому внешнему комментарию)
        cur.execute(f"""
            SELECT AVG(EXTRACT(EPOCH FROM (fc.first_reply - t.created_at))) AS avg_sec
            FROM {SCHEMA}.tickets t
            JOIN LATERAL (
                SELECT MIN(c.created_at) AS first_reply
                FROM {SCHEMA}.ticket_comments c
                WHERE c.ticket_id = t.id AND c.user_id <> t.created_by AND NOT COALESCE(c.is_internal, false)
            ) fc ON fc.first_reply IS NOT NULL
            WHERE t.created_at >= {start_expr} AND t.created_at < {end_expr}
        """, qp)
        first_resp_sec = cur.fetchone()['avg_sec']

        # Среднее время решения
        cur.execute(f"""
            SELECT AVG(EXTRACT(EPOCH FROM (t.closed_at - t.created_at))) AS avg_sec
            FROM {SCHEMA}.tickets t
            WHERE t.closed_at IS NOT NULL
              AND t.created_at >= {start_expr} AND t.created_at < {end_expr}
        """, qp)
        resolve_sec = cur.fetchone()['avg_sec']

        # CSAT и распределение оценок
        cur.execute(f"""
            SELECT rating, COUNT(*) AS cnt
            FROM {SCHEMA}.tickets t
            WHERE rating IS NOT NULL
              AND COALESCE(t.closed_at, t.created_at) >= {start_expr}
              AND COALESCE(t.closed_at, t.created_at) < {end_expr}
            GROUP BY rating
        """, qp)
        rating_map = {int(r['rating']): int(r['cnt']) for r in cur.fetchall()}
        total_rated = sum(rating_map.values())
        csat = round(
            sum(star * cnt for star, cnt in rating_map.items()) / total_rated, 2
        ) if total_rated else 0.0

        rating_distribution = []
        for star in range(5, 0, -1):
            cnt = rating_map.get(star, 0)
            rating_distribution.append({
                'star': star,
                'count': cnt,
                'percent': round(cnt / total_rated * 100) if total_rated else 0,
            })
        rating_histogram = [
            {'star': star, 'count': rating_map.get(star, 0)} for star in range(1, 6)
        ]

        # Мини-графики (тренды) — заглушки
        def _stub_trend(base: int, n: int = 14):
            return [{'i': i, 'v': base + (i % 5) - 2} for i in range(n)]

        return response(200, {
            # SLA — заглушки
            'sla_compliance': {'value': 97.4, 'delta': 2.1, 'is_increase': True},
            'sla_split': {'on_time': 1416, 'on_time_pct': 97.4, 'overdue': 34, 'overdue_pct': 2.6},
            'sla_by_priority': [
                {'name': 'Критичный', 'percent': 92, 'color': '#ef4444'},
                {'name': 'Высокий', 'percent': 95, 'color': '#f59e0b'},
                {'name': 'Средний', 'percent': 98, 'color': '#22c55e'},
                {'name': 'Низкий', 'percent': 99, 'color': '#22c55e'},
            ],
            'overdue_total': {'value': 8, 'delta': -2, 'is_increase': False},
            'first_response': {
                'value': _fmt_duration(first_resp_sec),
                'delta': '-5 мин',
                'is_increase': False,
                'trend': _stub_trend(12),
            },
            'resolution': {
                'value': _fmt_duration(resolve_sec),
                'delta': '-1 ч 02 мин',
                'is_increase': False,
                'trend': _stub_trend(10),
            },
            'overdue_trend': _stub_trend(8),
            # CSAT — реальные данные
            'csat': {'value': csat, 'delta': 0.15, 'is_increase': True},
            'csat_histogram': rating_histogram,
            'rating_total': total_rated,
            'rating_distribution': rating_distribution,
        })
    finally:
        cur.close()


def handle_dashboard_services(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    """Дашборд "Аналитика услуг" — на реальных привязках заявок к услугам.

    Источник: ticket_to_service_mappings + ticket_services + tickets.
    """
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    if method != 'GET':
        return response(405, {'error': 'Только GET запросы'})

    params = event.get('queryStringParameters', {}) or {}
    period = (params.get('period') or 'month').strip().lower()

    period_sql = {
        'today': "date_trunc('day', NOW())",
        'week': "date_trunc('week', NOW())",
        'month': "date_trunc('month', NOW())",
        'year': "date_trunc('year', NOW())",
    }

    if period == 'custom':
        from_date = (params.get('from_date') or '').strip()
        to_date = (params.get('to_date') or '').strip()
        if not from_date or not to_date:
            return response(400, {'error': 'from_date и to_date обязательны для period=custom'})
        start_expr = "%(from_date)s::date"
        end_expr = "(%(to_date)s::date + INTERVAL '1 day')"
        prev_start_expr = "(%(from_date)s::date - (%(to_date)s::date - %(from_date)s::date) - INTERVAL '1 day')"
        prev_end_expr = "%(from_date)s::date"
    else:
        trunc = period_sql.get(period, period_sql['month'])
        unit = {'today': 'day', 'week': 'week', 'month': 'month', 'year': 'year'}.get(period, 'month')
        start_expr = trunc
        end_expr = "NOW()"
        prev_start_expr = f"{trunc} - INTERVAL '1 {unit}'"
        prev_end_expr = trunc

    qp = {'from_date': params.get('from_date'), 'to_date': params.get('to_date')}

    base_join = f"""
        FROM {SCHEMA}.ticket_to_service_mappings m
        JOIN {SCHEMA}.ticket_services ts ON ts.id = m.ticket_service_id
        JOIN {SCHEMA}.tickets t ON t.id = m.ticket_id
        LEFT JOIN {SCHEMA}.ticket_statuses s ON s.id = t.status_id
        WHERE t.created_at >= {start_expr} AND t.created_at < {end_expr}
    """

    cur = conn.cursor()
    try:
        # Общее число привязанных заявок за период (для долей)
        cur.execute(f"SELECT COUNT(*) AS cnt {base_join}", qp)
        total_tickets = int(cur.fetchone()['cnt'] or 0) or 1

        # Топ услуг + метрики
        cur.execute(f"""
            SELECT ts.id, ts.name,
                   COUNT(*) AS cnt,
                   AVG(EXTRACT(EPOCH FROM (t.closed_at - t.created_at)))
                       FILTER (WHERE t.closed_at IS NOT NULL) AS avg_resolve_sec,
                   COUNT(*) FILTER (WHERE COALESCE(s.is_reopened, false)) AS reopened
            {base_join}
            GROUP BY ts.id, ts.name
            ORDER BY cnt DESC
            LIMIT 10
        """, qp)
        services_rows = cur.fetchall()

        # Предыдущий период — для изменения
        cur.execute(f"""
            SELECT ts.id, COUNT(*) AS cnt
            FROM {SCHEMA}.ticket_to_service_mappings m
            JOIN {SCHEMA}.ticket_services ts ON ts.id = m.ticket_service_id
            JOIN {SCHEMA}.tickets t ON t.id = m.ticket_id
            WHERE t.created_at >= {prev_start_expr} AND t.created_at < {prev_end_expr}
            GROUP BY ts.id
        """, qp)
        prev_map = {r['id']: int(r['cnt'] or 0) for r in cur.fetchall()}

        def _cost_level(avg_sec):
            if avg_sec is None:
                return {'label': 'Низкая', 'tone': 'low'}
            hrs = float(avg_sec) / 3600.0
            if hrs >= 4:
                return {'label': 'Высокая', 'tone': 'high'}
            if hrs >= 1:
                return {'label': 'Средняя', 'tone': 'mid'}
            return {'label': 'Низкая', 'tone': 'low'}

        top_services = []
        high_volume = []
        cost_services = []
        for r in services_rows:
            cnt = int(r['cnt'] or 0)
            prev = prev_map.get(r['id'], 0)
            if prev > 0:
                change = round((cnt - prev) / prev * 100)
            elif cnt > 0:
                change = 100
            else:
                change = 0
            avg_sec = r['avg_resolve_sec']
            reopened = int(r['reopened'] or 0)
            top_services.append({
                'name': r['name'],
                'count': cnt,
                'share': round(cnt / total_tickets * 100),
            })
            high_volume.append({
                'name': r['name'],
                'count': cnt,
                'change': change,
                'avg_resolve': _fmt_duration(avg_sec),
                'reopened': reopened,
                'reopened_pct': round(reopened / cnt * 100, 1) if cnt else 0.0,
            })
            cost_services.append({
                'name': r['name'],
                'cost': _cost_level(avg_sec),
            })

        # Топ проблем — по заголовкам заявок
        cur.execute(f"""
            SELECT t.title AS title, COUNT(*) AS cnt
            {base_join}
            GROUP BY t.title
            ORDER BY cnt DESC
            LIMIT 6
        """, qp)
        top_problems = [{'title': r['title'], 'count': int(r['cnt'] or 0)} for r in cur.fetchall()]

        # Динамика по топ-5 услугам (по дням)
        top5_ids = [r['id'] for r in services_rows[:5]]
        top5_names = {r['id']: r['name'] for r in services_rows[:5]}
        dynamics = []
        if top5_ids:
            ids_csv = ','.join(str(int(i)) for i in top5_ids)
            cur.execute(f"""
                SELECT t.created_at::date AS day, ts.id AS sid, COUNT(*) AS cnt
                {base_join}
                  AND ts.id IN ({ids_csv})
                GROUP BY day, ts.id
                ORDER BY day
            """, qp)
            by_day = {}
            for r in cur.fetchall():
                day = r['day'].strftime('%d.%m')
                by_day.setdefault(day, {})[r['sid']] = int(r['cnt'] or 0)
            for day, vals in by_day.items():
                point = {'day': day}
                for sid in top5_ids:
                    point[f's{sid}'] = vals.get(sid, 0)
                dynamics.append(point)

        dynamics_series = [{'key': f's{sid}', 'name': top5_names[sid]} for sid in top5_ids]

        return response(200, {
            'top_services': top_services[:5],
            'top_problems': top_problems,
            'dynamics': dynamics,
            'dynamics_series': dynamics_series,
            'high_volume': high_volume,
            'cost_services': cost_services,
        })
    finally:
        cur.close()


def handle_dashboard_team(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    """Дашборд "Производительность команды".

    KPI, рейтинг инженеров, нагрузка, распределение по линиям, динамика — из БД.
    SLA соблюдение — заглушка (нет реальных SLA-данных).
    """
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    if method != 'GET':
        return response(405, {'error': 'Только GET запросы'})

    params = event.get('queryStringParameters', {}) or {}
    period = (params.get('period') or 'month').strip().lower()

    period_sql = {
        'today': "date_trunc('day', NOW())",
        'week': "date_trunc('week', NOW())",
        'month': "date_trunc('month', NOW())",
        'year': "date_trunc('year', NOW())",
    }

    if period == 'custom':
        from_date = (params.get('from_date') or '').strip()
        to_date = (params.get('to_date') or '').strip()
        if not from_date or not to_date:
            return response(400, {'error': 'from_date и to_date обязательны для period=custom'})
        start_expr = "%(from_date)s::date"
        end_expr = "(%(to_date)s::date + INTERVAL '1 day')"
        prev_start_expr = "(%(from_date)s::date - (%(to_date)s::date - %(from_date)s::date) - INTERVAL '1 day')"
        prev_end_expr = "%(from_date)s::date"
    else:
        trunc = period_sql.get(period, period_sql['month'])
        unit = {'today': 'day', 'week': 'week', 'month': 'month', 'year': 'year'}.get(period, 'month')
        start_expr = trunc
        end_expr = "NOW()"
        prev_start_expr = f"{trunc} - INTERVAL '1 {unit}'"
        prev_end_expr = trunc

    qp = {'from_date': params.get('from_date'), 'to_date': params.get('to_date')}

    cur = conn.cursor()
    try:
        # KPI: всего инженеров (с назначенными заявками), закрыто за период, ср.время, CSAT
        cur.execute(f"SELECT COUNT(DISTINCT assigned_to) AS cnt FROM {SCHEMA}.tickets WHERE assigned_to IS NOT NULL")
        engineers = int(cur.fetchone()['cnt'] or 0)

        # "Закрыто" = в архиве ИЛИ статус "Ожидает подтверждения" (is_pending_confirmation),
        # дата закрытия = COALESCE(closed_at, updated_at).
        cur.execute(f"""
            SELECT
                COUNT(*) FILTER (
                    WHERE (t.is_archived OR COALESCE(s.is_pending_confirmation, false))
                      AND COALESCE(t.closed_at, t.updated_at) >= {start_expr}
                      AND COALESCE(t.closed_at, t.updated_at) < {end_expr}
                ) AS closed_cur,
                COUNT(*) FILTER (
                    WHERE (t.is_archived OR COALESCE(s.is_pending_confirmation, false))
                      AND COALESCE(t.closed_at, t.updated_at) >= {prev_start_expr}
                      AND COALESCE(t.closed_at, t.updated_at) < {prev_end_expr}
                ) AS closed_prev,
                AVG(EXTRACT(EPOCH FROM (COALESCE(t.closed_at, t.updated_at) - t.created_at))) FILTER (
                    WHERE (t.is_archived OR COALESCE(s.is_pending_confirmation, false))
                      AND COALESCE(t.closed_at, t.updated_at) >= {start_expr}
                      AND COALESCE(t.closed_at, t.updated_at) < {end_expr}
                ) AS avg_resolve_sec
            FROM {SCHEMA}.tickets t
            LEFT JOIN {SCHEMA}.ticket_statuses s ON s.id = t.status_id
        """, qp)
        kr = cur.fetchone()
        closed_cur = int(kr['closed_cur'] or 0)
        closed_prev = int(kr['closed_prev'] or 0)
        closed_delta = closed_cur - closed_prev

        cur.execute(f"""
            SELECT AVG(rating)::numeric(10,2) AS csat, COUNT(*) AS rated
            FROM {SCHEMA}.tickets
            WHERE rating IS NOT NULL
              AND COALESCE(closed_at, created_at) >= {start_expr}
              AND COALESCE(closed_at, created_at) < {end_expr}
        """, qp)
        cr = cur.fetchone()
        csat = float(cr['csat']) if cr['csat'] is not None else 0.0

        kpi = {
            'engineers': engineers,
            'closed': closed_cur,
            'closed_delta': closed_delta,
            'avg_resolve': _fmt_duration(kr['avg_resolve_sec']),
            'sla_compliance': 97.4,
            'sla_delta': 2.1,
            'csat': round(csat, 2),
            'csat_delta': 0.15,
        }

        # Рейтинг инженеров и нагрузка.
        # "Закрыто" = в архиве ИЛИ статус "Ожидает подтверждения" (is_pending_confirmation),
        #   фильтр по дате закрытия COALESCE(closed_at, updated_at) в выбранном периоде.
        # "Активные" = все статусы, КРОМЕ: закрытых (is_closed), "Ожидает подтверждения",
        #   "Приостановлена" (is_paused) и архива — без фильтра по дате (текущие).
        # Среднее время решения — только по закрытым в периоде.
        cur.execute(f"""
            SELECT u.id, u.full_name, u.photo_url,
                   COUNT(*) FILTER (
                       WHERE (t.is_archived OR COALESCE(s.is_pending_confirmation, false))
                         AND COALESCE(t.closed_at, t.updated_at) >= {start_expr}
                         AND COALESCE(t.closed_at, t.updated_at) < {end_expr}
                   ) AS closed,
                   AVG(EXTRACT(EPOCH FROM (COALESCE(t.closed_at, t.updated_at) - t.created_at))) FILTER (
                       WHERE (t.is_archived OR COALESCE(s.is_pending_confirmation, false))
                         AND COALESCE(t.closed_at, t.updated_at) >= {start_expr}
                         AND COALESCE(t.closed_at, t.updated_at) < {end_expr}
                   ) AS avg_resolve_sec,
                   (AVG(t.rating) FILTER (
                       WHERE t.rating IS NOT NULL
                         AND COALESCE(t.closed_at, t.updated_at) >= {start_expr}
                         AND COALESCE(t.closed_at, t.updated_at) < {end_expr}
                   ))::numeric(10,2) AS avg_rating,
                   COUNT(*) FILTER (
                       WHERE NOT COALESCE(s.is_closed, false)
                         AND NOT COALESCE(s.is_pending_confirmation, false)
                         AND NOT COALESCE(s.is_paused, false)
                         AND NOT t.is_archived
                   ) AS active
            FROM {SCHEMA}.tickets t
            JOIN {SCHEMA}.users u ON u.id = t.assigned_to
            LEFT JOIN {SCHEMA}.ticket_statuses s ON s.id = t.status_id
            GROUP BY u.id, u.full_name, u.photo_url
            HAVING COUNT(*) FILTER (
                       WHERE (t.is_archived OR COALESCE(s.is_pending_confirmation, false))
                         AND COALESCE(t.closed_at, t.updated_at) >= {start_expr}
                         AND COALESCE(t.closed_at, t.updated_at) < {end_expr}
                   ) > 0
                OR COUNT(*) FILTER (
                       WHERE NOT COALESCE(s.is_closed, false)
                         AND NOT COALESCE(s.is_pending_confirmation, false)
                         AND NOT COALESCE(s.is_paused, false)
                         AND NOT t.is_archived
                   ) > 0
            ORDER BY closed DESC, active DESC
            LIMIT 8
        """, qp)
        engineers_rating = []
        workload = []
        for r in cur.fetchall():
            avg_rating = float(r['avg_rating']) if r['avg_rating'] is not None else 0.0
            engineers_rating.append({
                'id': r['id'],
                'name': r['full_name'],
                'photo': r['photo_url'] or '',
                'closed': int(r['closed'] or 0),
                'avg_resolve': _fmt_duration(r['avg_resolve_sec']),
                'sla': 97,
                'rating': round(avg_rating, 1),
            })
            workload.append({
                'id': r['id'],
                'name': r['full_name'],
                'active': int(r['active'] or 0),
            })
        workload.sort(key=lambda x: x['active'], reverse=True)
        workload = workload[:5]

        # Распределение закрытых заявок по линиям (executor_groups)
        cur.execute(f"""
            SELECT COALESCE(eg.name, 'Без линии') AS name, COUNT(*) AS cnt
            FROM {SCHEMA}.tickets t
            LEFT JOIN {SCHEMA}.ticket_statuses s ON s.id = t.status_id
            LEFT JOIN {SCHEMA}.executor_groups eg ON eg.id = t.executor_group_id
            WHERE COALESCE(s.is_closed, false)
              AND t.closed_at >= {start_expr} AND t.closed_at < {end_expr}
            GROUP BY eg.name
            ORDER BY cnt DESC
            LIMIT 6
        """, qp)
        dist_rows = cur.fetchall()
        dist_total = sum(int(r['cnt'] or 0) for r in dist_rows)
        distribution = [{
            'name': r['name'],
            'count': int(r['cnt'] or 0),
            'percent': round(int(r['cnt'] or 0) / dist_total * 100) if dist_total else 0,
        } for r in dist_rows]

        # Динамика производительности: закрыто по дням + SLA % (заглушка-тренд)
        cur.execute(f"""
            SELECT gs::date AS day,
                   (SELECT COUNT(*) FROM {SCHEMA}.tickets t WHERE t.closed_at::date = gs::date) AS closed
            FROM generate_series(
                date_trunc('day', {start_expr}),
                date_trunc('day', {end_expr} - INTERVAL '1 second'),
                INTERVAL '1 day'
            ) AS gs
            ORDER BY gs
        """, qp)
        performance = []
        for idx, r in enumerate(cur.fetchall()):
            performance.append({
                'day': r['day'].strftime('%d.%m'),
                'date': r['day'].strftime('%Y-%m-%d'),
                'closed': int(r['closed'] or 0),
                'sla': 90 + (idx % 8),
            })

        # Эскалации между линиями по дням для направлений 1->2, 1->3, 2->3.
        # Для каждого направления считаем ДВА события (каждое отдельно):
        #  (а) смена группы заявки на целевую линию (ticket_group_log);
        #  (б) назначение исполнителем сотрудника целевой линии
        #      (ticket_history, field_name='assigned_to', матч по ФИО).
        # Время до эскалации считаем от попадания заявки на исходную линию
        # (последний assigned_at исходной линии до момента события).
        # Рабочее время между двумя моментами по единому окну Пн-Пт 09:00-18:00.
        # Возвращает секунды: суммируем пересечение каждого дня диапазона с окном 9-18,
        # только для будних дней (DOW 1..5). Ночи и выходные не учитываются.
        def work_seconds(start_col: str, end_col: str) -> str:
            return f"""(
                SELECT COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM (
                    LEAST(d + TIME '18:00', {end_col}) - GREATEST(d + TIME '09:00', {start_col})
                )))), 0)
                FROM generate_series(
                    date_trunc('day', {start_col}),
                    date_trunc('day', {end_col}),
                    INTERVAL '1 day'
                ) AS d
                WHERE {end_col} > {start_col}
                  AND EXTRACT(DOW FROM d) BETWEEN 1 AND 5
                  AND LEAST(d + TIME '18:00', {end_col}) > GREATEST(d + TIME '09:00', {start_col})
            )"""

        def build_escalations(from_line: str, to_line: str):
            cur.execute(f"""
                SELECT day::date AS day,
                       COUNT(*) AS escalations,
                       AVG(elapsed_sec) AS avg_sec
                FROM (
                    -- (а) смена группы: заявка была на исходной линии и передана на целевую
                    SELECT
                        l1.released_at AS day,
                        {work_seconds('l1.assigned_at', 'l1.released_at')} AS elapsed_sec
                    FROM {SCHEMA}.ticket_group_log l1
                    JOIN {SCHEMA}.executor_groups g1 ON g1.id = l1.executor_group_id
                    WHERE g1.name ILIKE %(from_line)s
                      AND l1.released_at IS NOT NULL
                      AND l1.released_at >= {start_expr} AND l1.released_at < {end_expr}
                      AND EXISTS (
                          SELECT 1 FROM {SCHEMA}.ticket_group_log l2
                          JOIN {SCHEMA}.executor_groups g2 ON g2.id = l2.executor_group_id
                          WHERE l2.ticket_id = l1.ticket_id
                            AND g2.name ILIKE %(to_line)s
                            AND l2.assigned_at >= l1.released_at - INTERVAL '2 minute'
                      )

                    UNION ALL

                    -- (б) исполнителем назначен сотрудник целевой линии
                    SELECT
                        h.created_at AS day,
                        {work_seconds('l1.assigned_at', 'h.created_at')} AS elapsed_sec
                    FROM {SCHEMA}.ticket_history h
                    JOIN {SCHEMA}.users u ON u.full_name = h.new_value
                    JOIN {SCHEMA}.executor_group_members m ON m.user_id = u.id
                    JOIN {SCHEMA}.executor_groups g2 ON g2.id = m.group_id AND g2.name ILIKE %(to_line)s
                    JOIN LATERAL (
                        SELECT l.assigned_at
                        FROM {SCHEMA}.ticket_group_log l
                        JOIN {SCHEMA}.executor_groups g1 ON g1.id = l.executor_group_id
                        WHERE l.ticket_id = h.ticket_id
                          AND g1.name ILIKE %(from_line)s
                          AND l.assigned_at <= h.created_at
                        ORDER BY l.assigned_at DESC
                        LIMIT 1
                    ) l1 ON TRUE
                    WHERE h.field_name = 'assigned_to'
                      AND h.created_at >= {start_expr} AND h.created_at < {end_expr}
                ) events
                GROUP BY day::date
                ORDER BY day
            """, {**qp, 'from_line': from_line, 'to_line': to_line})
            by_day = {r['day']: r for r in cur.fetchall()}

            series = []
            total = 0
            avg_sec_sum = 0.0
            avg_weight = 0
            for p in performance:
                match = None
                for d, r in by_day.items():
                    if d.strftime('%d.%m') == p['day']:
                        match = r
                        break
                cnt = int(match['escalations']) if match else 0
                avg_sec = float(match['avg_sec']) if match and match['avg_sec'] is not None else 0.0
                series.append({
                    'day': p['day'],
                    'date': p['date'],
                    'count': cnt,
                    'avg_minutes': round(avg_sec / 60.0, 1),
                })
                total += cnt
                if cnt:
                    avg_sec_sum += avg_sec * cnt
                    avg_weight += cnt
            overall_avg_sec = avg_sec_sum / avg_weight if avg_weight else 0.0
            return {
                'series': series,
                'total': total,
                'avg': _fmt_duration(overall_avg_sec),
            }

        esc_1_2 = build_escalations('1-я линия', '2-я линия')
        esc_1_3 = build_escalations('1-я линия', '3-я линия')
        esc_2_3 = build_escalations('2-я линия', '3-я линия')

        # Время от СОЗДАНИЯ заявки до первого попадания на 3-ю линию.
        # Событие = самое раннее из (а) назначение на группу "3-я линия"
        # и (б) назначение исполнителем сотрудника 3-й линии. Считаем рабочие часы
        # от t.created_at до этого события. Только по дошедшим до 3-й линии заявкам.
        cur.execute(f"""
            SELECT ev.first_l3::date AS day,
                   COUNT(*) AS cnt,
                   AVG({work_seconds('t.created_at', 'ev.first_l3')}) AS avg_sec
            FROM (
                SELECT ticket_id, MIN(event_at) AS first_l3
                FROM (
                    SELECT l.ticket_id, l.assigned_at AS event_at
                    FROM {SCHEMA}.ticket_group_log l
                    JOIN {SCHEMA}.executor_groups g ON g.id = l.executor_group_id
                    WHERE g.name ILIKE '3-я линия'

                    UNION ALL

                    SELECT h.ticket_id, h.created_at AS event_at
                    FROM {SCHEMA}.ticket_history h
                    JOIN {SCHEMA}.users u ON u.full_name = h.new_value
                    JOIN {SCHEMA}.executor_group_members m ON m.user_id = u.id
                    JOIN {SCHEMA}.executor_groups g ON g.id = m.group_id AND g.name ILIKE '3-я линия'
                    WHERE h.field_name = 'assigned_to'
                ) src
                GROUP BY ticket_id
            ) ev
            JOIN {SCHEMA}.tickets t ON t.id = ev.ticket_id
            WHERE ev.first_l3 >= {start_expr} AND ev.first_l3 < {end_expr}
              AND ev.first_l3 > t.created_at
            GROUP BY ev.first_l3::date
            ORDER BY day
        """, qp)
        l3_by_day = {r['day']: r for r in cur.fetchall()}
        l3_series = []
        l3_total = 0
        l3_avg_sum = 0.0
        l3_avg_weight = 0
        for p in performance:
            match = None
            for d, r in l3_by_day.items():
                if d.strftime('%d.%m') == p['day']:
                    match = r
                    break
            cnt = int(match['cnt']) if match else 0
            avg_sec = float(match['avg_sec']) if match and match['avg_sec'] is not None else 0.0
            l3_series.append({
                'day': p['day'],
                'date': p['date'],
                'count': cnt,
                'avg_minutes': round(avg_sec / 60.0, 1),
            })
            l3_total += cnt
            if cnt:
                l3_avg_sum += avg_sec * cnt
                l3_avg_weight += cnt
        time_to_l3 = {
            'series': l3_series,
            'total': l3_total,
            'avg': _fmt_duration(l3_avg_sum / l3_avg_weight if l3_avg_weight else 0.0),
        }

        return response(200, {
            'kpi': kpi,
            'engineers_rating': engineers_rating,
            'workload': workload,
            'distribution': distribution,
            'distribution_total': dist_total,
            'performance': performance,
            # Обратная совместимость: 1->2 в прежних полях
            'escalations': esc_1_2['series'],
            'escalations_total': esc_1_2['total'],
            'escalations_avg': esc_1_2['avg'],
            'escalation_directions': {
                '1_2': esc_1_2,
                '1_3': esc_1_3,
                '2_3': esc_2_3,
            },
            'time_to_l3': time_to_l3,
        })
    finally:
        cur.close()


def handle_escalation_tickets(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    """Топ-10 заявок с наибольшим временем ожидания до эскалации за конкретный день.

    Параметры: direction (1_2|1_3|2_3), day (YYYY-MM-DD).
    Время ожидания — рабочее (Пн-Пт 09:00-18:00) от попадания на исходную линию.
    """
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    if method != 'GET':
        return response(405, {'error': 'Только GET запросы'})

    params = event.get('queryStringParameters', {}) or {}
    direction = (params.get('direction') or '1_2').strip()
    day = (params.get('day') or '').strip()
    if not day:
        return response(400, {'error': 'Параметр day обязателен (YYYY-MM-DD)'})

    def work_seconds(start_col: str, end_col: str) -> str:
        return f"""(
            SELECT COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM (
                LEAST(d + TIME '18:00', {end_col}) - GREATEST(d + TIME '09:00', {start_col})
            )))), 0)
            FROM generate_series(date_trunc('day', {start_col}), date_trunc('day', {end_col}), INTERVAL '1 day') AS d
            WHERE {end_col} > {start_col}
              AND EXTRACT(DOW FROM d) BETWEEN 1 AND 5
              AND LEAST(d + TIME '18:00', {end_col}) > GREATEST(d + TIME '09:00', {start_col})
        )"""

    # Топ-10 заявок от создания до первого попадания на 3-ю линию за день
    if direction == 'to_l3':
        cur = conn.cursor()
        try:
            cur.execute(f"""
                SELECT t.id, t.title,
                       {work_seconds('t.created_at', 'ev.first_l3')} AS elapsed_sec,
                       u.full_name AS executor,
                       s.name AS status_name, s.color AS status_color
                FROM (
                    SELECT ticket_id, MIN(event_at) AS first_l3
                    FROM (
                        SELECT l.ticket_id, l.assigned_at AS event_at
                        FROM {SCHEMA}.ticket_group_log l
                        JOIN {SCHEMA}.executor_groups g ON g.id = l.executor_group_id
                        WHERE g.name ILIKE '3-я линия'
                        UNION ALL
                        SELECT h.ticket_id, h.created_at AS event_at
                        FROM {SCHEMA}.ticket_history h
                        JOIN {SCHEMA}.users u ON u.full_name = h.new_value
                        JOIN {SCHEMA}.executor_group_members m ON m.user_id = u.id
                        JOIN {SCHEMA}.executor_groups g ON g.id = m.group_id AND g.name ILIKE '3-я линия'
                        WHERE h.field_name = 'assigned_to'
                    ) src
                    GROUP BY ticket_id
                ) ev
                JOIN {SCHEMA}.tickets t ON t.id = ev.ticket_id
                LEFT JOIN {SCHEMA}.users u ON u.id = t.assigned_to
                LEFT JOIN {SCHEMA}.ticket_statuses s ON s.id = t.status_id
                WHERE ev.first_l3::date = %(day)s::date
                  AND ev.first_l3 > t.created_at
                ORDER BY elapsed_sec DESC
                LIMIT 10
            """, {'day': day})
            tickets = []
            for r in cur.fetchall():
                tickets.append({
                    'id': r['id'],
                    'title': r['title'],
                    'wait': _fmt_duration(float(r['elapsed_sec']) if r['elapsed_sec'] is not None else 0.0),
                    'wait_seconds': float(r['elapsed_sec']) if r['elapsed_sec'] is not None else 0.0,
                    'executor': r['executor'] or 'Не назначен',
                    'status': r['status_name'] or '—',
                    'status_color': r['status_color'] or '#94a3b8',
                })
            return response(200, {'day': day, 'direction': direction, 'tickets': tickets})
        finally:
            cur.close()

    lines = {
        '1_2': ('1-я линия', '2-я линия'),
        '1_3': ('1-я линия', '3-я линия'),
        '2_3': ('2-я линия', '3-я линия'),
    }
    if direction not in lines:
        return response(400, {'error': 'Некорректное направление'})
    from_line, to_line = lines[direction]

    cur = conn.cursor()
    try:
        cur.execute(f"""
            SELECT t.id, t.title, e.elapsed_sec, e.event_at,
                   u.full_name AS executor,
                   s.name AS status_name, s.color AS status_color
            FROM (
                SELECT l1.ticket_id, l1.released_at AS event_at,
                       {work_seconds('l1.assigned_at', 'l1.released_at')} AS elapsed_sec
                FROM {SCHEMA}.ticket_group_log l1
                JOIN {SCHEMA}.executor_groups g1 ON g1.id = l1.executor_group_id
                WHERE g1.name ILIKE %(from_line)s
                  AND l1.released_at IS NOT NULL
                  AND l1.released_at::date = %(day)s::date
                  AND EXISTS (
                      SELECT 1 FROM {SCHEMA}.ticket_group_log l2
                      JOIN {SCHEMA}.executor_groups g2 ON g2.id = l2.executor_group_id
                      WHERE l2.ticket_id = l1.ticket_id
                        AND g2.name ILIKE %(to_line)s
                        AND l2.assigned_at >= l1.released_at - INTERVAL '2 minute'
                  )

                UNION ALL

                SELECT h.ticket_id, h.created_at AS event_at,
                       {work_seconds('l1.assigned_at', 'h.created_at')} AS elapsed_sec
                FROM {SCHEMA}.ticket_history h
                JOIN {SCHEMA}.users u ON u.full_name = h.new_value
                JOIN {SCHEMA}.executor_group_members m ON m.user_id = u.id
                JOIN {SCHEMA}.executor_groups g2 ON g2.id = m.group_id AND g2.name ILIKE %(to_line)s
                JOIN LATERAL (
                    SELECT l.assigned_at
                    FROM {SCHEMA}.ticket_group_log l
                    JOIN {SCHEMA}.executor_groups g1 ON g1.id = l.executor_group_id
                    WHERE l.ticket_id = h.ticket_id
                      AND g1.name ILIKE %(from_line)s
                      AND l.assigned_at <= h.created_at
                    ORDER BY l.assigned_at DESC
                    LIMIT 1
                ) l1 ON TRUE
                WHERE h.field_name = 'assigned_to'
                  AND h.created_at::date = %(day)s::date
            ) e
            JOIN {SCHEMA}.tickets t ON t.id = e.ticket_id
            LEFT JOIN {SCHEMA}.users u ON u.id = t.assigned_to
            LEFT JOIN {SCHEMA}.ticket_statuses s ON s.id = t.status_id
            ORDER BY e.elapsed_sec DESC
            LIMIT 10
        """, {'from_line': from_line, 'to_line': to_line, 'day': day})

        tickets = []
        for r in cur.fetchall():
            tickets.append({
                'id': r['id'],
                'title': r['title'],
                'wait': _fmt_duration(float(r['elapsed_sec']) if r['elapsed_sec'] is not None else 0.0),
                'wait_seconds': float(r['elapsed_sec']) if r['elapsed_sec'] is not None else 0.0,
                'executor': r['executor'] or 'Не назначен',
                'status': r['status_name'] or '—',
                'status_color': r['status_color'] or '#94a3b8',
            })

        return response(200, {'day': day, 'direction': direction, 'tickets': tickets})
    finally:
        cur.close()


def handler(event: dict, context) -> dict:
    """API для работы с заявками и категориями сервисов"""
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return handle_options()
    
    endpoint = get_endpoint(event)
    
    try:
        conn = get_db_connection()
    except Exception as e:
        return response(500, {'error': f'Database connection failed: {str(e)}'})
    
    try:
        if endpoint == 'tickets':
            return handle_tickets(method, event, conn)
        elif endpoint == 'service_categories':
            return handle_service_categories(method, event, conn)
        elif endpoint == 'ticket-dictionaries-api':
            return handle_ticket_dictionaries(method, event, conn)
        elif endpoint == 'ticket_services':
            return handle_ticket_services(method, event, conn)
        elif endpoint == 'ticket-statuses':
            return handle_ticket_statuses(method, event, conn)
        elif endpoint == 'ticket-priorities':
            return handle_ticket_priorities(method, event, conn)
        elif endpoint == 'sla':
            return handle_sla(method, event, conn)
        elif endpoint == 'sla-service-mappings':
            return handle_sla_service_mappings(method, event, conn)
        elif endpoint == 'sla-group-budgets':
            return handle_sla_group_budgets(method, event, conn)
        elif endpoint == 'sla-priority-times':
            return handle_sla_priority_times(method, event, conn)
        elif endpoint == 'sla-analytics':
            return handle_sla_analytics(method, event, conn)
        elif endpoint == 'ticket-approvals':
            return handle_ticket_approvals(method, event, conn)
        elif endpoint == 'ticket_service_mappings':
            return handle_ticket_service_mappings(method, event, conn)
        elif endpoint == 'ticket-confirmation':
            return handle_ticket_confirmation(method, event, conn)
        elif endpoint == 'ticket-watchers':
            return handle_ticket_watchers(method, event, conn)
        elif endpoint == 'tickets-full':
            return handle_tickets_full(method, event, conn)
        elif endpoint == 'tickets-bootstrap':
            return handle_tickets_bootstrap(method, event, conn)
        elif endpoint == 'tickets-created-stats':
            return handle_tickets_created_stats(method, event, conn)
        elif endpoint == 'tickets-rating-stats':
            return handle_tickets_rating_stats(method, event, conn)
        elif endpoint == 'dashboard-ops':
            return handle_dashboard_ops(method, event, conn)
        elif endpoint == 'dashboard-sla':
            return handle_dashboard_sla(method, event, conn)
        elif endpoint == 'dashboard-services':
            return handle_dashboard_services(method, event, conn)
        elif endpoint == 'dashboard-team':
            return handle_dashboard_team(method, event, conn)
        elif endpoint == 'escalation-tickets':
            return handle_escalation_tickets(method, event, conn)
        else:
            return response(400, {'error': 'Unknown endpoint'})
    finally:
        try:
            conn.close()
        except:
            pass

def _load_org_structure_cache(cur) -> dict:
    """Загружает справочники компаний, подразделений и должностей одним набором
    запросов, чтобы резолвить company_structure без обращений к БД в цикле.

    Возвращает {'companies': {id: name}, 'departments': {id: (name, parent_id)},
    'positions': {id: name}}.
    """
    companies = {}
    cur.execute(f"SELECT id, name FROM {SCHEMA}.companies")
    for row in cur.fetchall():
        companies[row['id']] = row['name']

    departments = {}
    cur.execute(f"SELECT id, name, parent_id FROM {SCHEMA}.departments")
    for row in cur.fetchall():
        departments[row['id']] = (row['name'], row['parent_id'])

    positions = {}
    cur.execute(f"SELECT id, name FROM {SCHEMA}.positions")
    for row in cur.fetchall():
        positions[row['id']] = row['name']

    return {'companies': companies, 'departments': departments, 'positions': positions}


def resolve_company_structure(value_json: str, cur, org_cache: dict = None) -> dict:
    try:
        data = json.loads(value_json)
    except (json.JSONDecodeError, TypeError):
        return {'display_value': value_json}

    if org_cache is None:
        org_cache = _load_org_structure_cache(cur)

    companies = org_cache.get('companies', {})
    departments = org_cache.get('departments', {})
    positions = org_cache.get('positions', {})

    result = {}
    if data.get('company_id'):
        name = companies.get(data['company_id'])
        if name:
            result['company'] = name
    if data.get('department_id'):
        dept_chain = []
        dept_id = data['department_id']
        seen = set()
        while dept_id and dept_id not in seen:
            seen.add(dept_id)
            dept = departments.get(dept_id)
            if not dept:
                break
            dept_chain.append(dept[0])
            dept_id = dept[1]
        dept_chain.reverse()
        result['department'] = ' → '.join(dept_chain) if dept_chain else None
    if data.get('position_id'):
        name = positions.get(data['position_id'])
        if name:
            result['position'] = name

    parts = [v for v in [result.get('company'), result.get('department')] if v]
    result['display_value'] = ' → '.join(parts) if parts else value_json
    return result


def resolve_custom_field_values(fields: list, cur, org_cache: dict = None) -> list:
    needs_org = any(
        f.get('field_type') == 'company_structure' and f.get('value')
        for f in fields
    )
    if needs_org and org_cache is None:
        org_cache = _load_org_structure_cache(cur)

    resolved = []
    for field in fields:
        if field.get('field_type') == 'company_structure' and field.get('value'):
            struct = resolve_company_structure(field['value'], cur, org_cache)
            field['display_value'] = struct['display_value']
            if struct.get('position'):
                resolved.append(dict(field))
                resolved.append({
                    'id': f"{field['id']}_position",
                    'name': 'Должность',
                    'field_type': 'text',
                    'value': struct['position'],
                    'display_value': struct['position'],
                })
                continue
        else:
            field['display_value'] = field.get('value', '')
        resolved.append(field)
    return resolved


def handle_tickets(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    
    user_id = payload.get('user_id')

    if method == 'GET':
        query_params = event.get('queryStringParameters', {}) or {}
        # Пользователи без права видеть скрытые комментарии не должны узнавать
        # даже о факте их существования (флаги "есть новый ответ")
        _internal_cur = conn.cursor()
        _hide_internal = not _can_see_internal(_internal_cur, user_id)
        _internal_cur.close()
        _internal_filter = ' AND {alias}.is_internal = false' if _hide_internal else ''
        
        ticket_id_param = query_params.get('ticket_id')
        status_id = query_params.get('status_id')
        priority_id = query_params.get('priority_id')
        assigned_to = query_params.get('assigned_to')
        created_by = query_params.get('created_by')
        service_id = query_params.get('service_id')
        is_archived = query_params.get('is_archived')
        is_hidden = query_params.get('is_hidden')
        hide_waiting = query_params.get('hide_waiting')
        show_all = query_params.get('show_all')
        needs_my_reply = query_params.get('needs_my_reply')
        is_watcher = query_params.get('is_watcher')
        is_subordinates = query_params.get('is_subordinates')
        from_date = query_params.get('from_date')
        to_date = query_params.get('to_date')
        page = max(1, int(query_params.get('page', 1)))
        limit = min(100, max(1, int(query_params.get('limit', 50))))
        offset = (page - 1) * limit

        # Сортировка списка заявок. Whitelist допустимых полей.
        sort_by_param = (query_params.get('sort_by') or 'created_at').strip()
        sort_dir_param = (query_params.get('sort_dir') or 'desc').strip().lower()
        sort_dir_sql = 'ASC' if sort_dir_param == 'asc' else 'DESC'
        nulls_sql = 'NULLS FIRST' if sort_dir_sql == 'ASC' else 'NULLS LAST'

        sort_map = {
            'created_at': 't.created_at',
            'due_date': 't.due_date',
            'assignee': 'u1.full_name',
            'creator': 'u2.full_name',
            'status': 's.name',
            'executor_group': 'eg.name',
            'service': '(SELECT MIN(s2.name) FROM ' + SCHEMA + '.ticket_to_service_mappings tsm2 '
                       'JOIN ' + SCHEMA + '.services s2 ON s2.id = tsm2.service_id '
                       'WHERE tsm2.ticket_id = t.id)',
            'ticket_service': '(SELECT MIN(ts2.name) FROM ' + SCHEMA + '.ticket_to_service_mappings tsm3 '
                              'JOIN ' + SCHEMA + '.ticket_services ts2 ON ts2.id = tsm3.ticket_service_id '
                              'WHERE tsm3.ticket_id = t.id)',
        }
        sort_field_sql = sort_map.get(sort_by_param, 't.created_at')
        order_by_clause = f"ORDER BY {sort_field_sql} {sort_dir_sql} {nulls_sql}, t.id DESC"
        
        cur = conn.cursor()
        
        cur.execute(f"""
            SELECT p.resource, p.action
            FROM {SCHEMA}.permissions p
            JOIN {SCHEMA}.role_permissions rp ON p.id = rp.permission_id
            JOIN {SCHEMA}.user_roles ur ON rp.role_id = ur.role_id
            WHERE ur.user_id = %s
        """, (user_id,))
        user_permissions = [dict(row) for row in cur.fetchall()]
        
        view_all_tickets = any(
            p['resource'] == 'tickets' and p['action'] == 'view_all' 
            for p in user_permissions
        )
        view_own_only = any(
            p['resource'] == 'tickets' and p['action'] == 'view_own_only' 
            for p in user_permissions
        )

        cur.execute(f"""
            SELECT 1 FROM {SCHEMA}.user_roles ur
            JOIN {SCHEMA}.roles r ON r.id = ur.role_id
            WHERE ur.user_id = %s AND r.system_role = 'admin'
            LIMIT 1
        """, (user_id,))
        is_admin = cur.fetchone() is not None
        
        if not view_all_tickets and not view_own_only:
            return response(200, {'tickets': [], 'total': 0, 'page': page, 'limit': limit, 'pages': 0})

        cur.execute(f"""
            SELECT 1 FROM {SCHEMA}.user_roles ur
            JOIN {SCHEMA}.roles r ON r.id = ur.role_id
            WHERE ur.user_id = %s AND r.restrict_to_groups = true
            LIMIT 1
        """, (user_id,))
        restrict_to_groups = cur.fetchone() is not None

        restricted_user_ids = None
        if restrict_to_groups:
            cur.execute(f"""
                SELECT DISTINCT egm.user_id
                FROM {SCHEMA}.user_roles ur
                JOIN {SCHEMA}.roles r ON r.id = ur.role_id AND r.restrict_to_groups = true
                JOIN {SCHEMA}.role_visible_groups rvg ON rvg.role_id = r.id
                JOIN {SCHEMA}.executor_group_members egm ON egm.group_id = rvg.group_id
                WHERE ur.user_id = %s
            """, (user_id,))
            restricted_user_ids = [row['user_id'] for row in cur.fetchall()]
        
        where_clause = "WHERE 1=1"
        params = []

        if restricted_user_ids is not None:
            # Ограничение по группам: показываем заявки, где исполнитель входит в
            # видимые группы роли. НО пользователь всегда видит заявки, в которых
            # сам является участником (автор, исполнитель, наблюдатель, согласующий),
            # даже если исполнитель не из его группы.
            if restricted_user_ids:
                placeholders = ','.join(['%s'] * len(restricted_user_ids))
                where_clause += f""" AND (
                    t.assigned_to IN ({placeholders})
                    OR t.created_by = %s
                    OR t.assigned_to = %s
                    OR EXISTS (SELECT 1 FROM {SCHEMA}.ticket_watchers tw WHERE tw.ticket_id = t.id AND tw.user_id = %s)
                    OR EXISTS (SELECT 1 FROM {SCHEMA}.ticket_approvals ta WHERE ta.ticket_id = t.id AND ta.approver_id = %s)
                )"""
                params.extend(restricted_user_ids)
                params.extend([user_id, user_id, user_id, user_id])
            else:
                where_clause += f""" AND (
                    t.created_by = %s
                    OR t.assigned_to = %s
                    OR EXISTS (SELECT 1 FROM {SCHEMA}.ticket_watchers tw WHERE tw.ticket_id = t.id AND tw.user_id = %s)
                    OR EXISTS (SELECT 1 FROM {SCHEMA}.ticket_approvals ta WHERE ta.ticket_id = t.id AND ta.approver_id = %s)
                )"""
                params.extend([user_id, user_id, user_id, user_id])
        
        if not view_all_tickets and view_own_only and is_subordinates != 'true':
            where_clause += f""" AND (
                t.created_by = %s 
                OR t.assigned_to = %s
                OR EXISTS (SELECT 1 FROM {SCHEMA}.ticket_watchers tw WHERE tw.ticket_id = t.id AND tw.user_id = %s)
                OR EXISTS (SELECT 1 FROM {SCHEMA}.ticket_approvals ta WHERE ta.ticket_id = t.id AND ta.approver_id = %s)
                OR (t.executor_group_id IS NOT NULL AND t.assigned_to IS NULL AND EXISTS (
                    SELECT 1 FROM {SCHEMA}.executor_group_members egm 
                    WHERE egm.group_id = t.executor_group_id AND egm.user_id = %s
                ))
                OR EXISTS (
                    SELECT 1 FROM {SCHEMA}.user_subordinates usub
                    WHERE usub.user_id = %s AND usub.subordinate_user_id = t.created_by
                )
                OR EXISTS (
                    SELECT 1 FROM {SCHEMA}.user_subordinate_departments usd
                    JOIN {SCHEMA}.users cu ON cu.id = t.created_by
                    WHERE usd.user_id = %s AND cu.department_id = usd.department_id
                )
            )"""
            params.extend([user_id, user_id, user_id, user_id, user_id, user_id, user_id])
        
        if status_id:
            where_clause += " AND t.status_id = %s"
            params.append(int(status_id))
        if priority_id:
            where_clause += " AND t.priority_id = %s"
            params.append(int(priority_id))
        if assigned_to:
            where_clause += " AND t.assigned_to = %s"
            params.append(int(assigned_to))
        if created_by:
            where_clause += " AND t.created_by = %s"
            params.append(int(created_by))
        if ticket_id_param:
            where_clause += " AND t.id = %s"
            params.append(int(ticket_id_param))
        if service_id:
            where_clause += " AND EXISTS (SELECT 1 FROM {SCHEMA}.ticket_to_service_mappings tsm2 WHERE tsm2.ticket_id = t.id AND tsm2.ticket_service_id = %s)".format(SCHEMA=SCHEMA)
            params.append(int(service_id))
        if not ticket_id_param and show_all != 'true':
            if is_hidden == 'true':
                where_clause += f" AND t.is_archived = false AND EXISTS (SELECT 1 FROM {SCHEMA}.ticket_statuses hs WHERE hs.id = t.status_id AND hs.is_pending_confirmation = true)"
                if not is_admin:
                    where_clause += " AND t.assigned_to = %s"
                    params.append(user_id)
            elif is_archived == 'true':
                where_clause += f" AND NOT EXISTS (SELECT 1 FROM {SCHEMA}.ticket_statuses ps WHERE ps.id = t.status_id AND ps.is_pending_confirmation = true) AND (t.is_archived = true OR EXISTS (SELECT 1 FROM {SCHEMA}.ticket_statuses cs WHERE cs.id = t.status_id AND cs.is_closed = true))"
            else:
                where_clause += f" AND t.is_archived = false AND NOT EXISTS (SELECT 1 FROM {SCHEMA}.ticket_statuses cs WHERE cs.id = t.status_id AND cs.is_closed = true)"
                if is_admin or is_subordinates == 'true':
                    where_clause += f" AND NOT EXISTS (SELECT 1 FROM {SCHEMA}.ticket_statuses hs WHERE hs.id = t.status_id AND hs.is_pending_confirmation = true)"
                else:
                    where_clause += f" AND NOT EXISTS (SELECT 1 FROM {SCHEMA}.ticket_statuses hs WHERE hs.id = t.status_id AND hs.is_pending_confirmation = true AND t.assigned_to = %s)"
                    params.append(user_id)
        if from_date:
            where_clause += " AND t.created_at >= %s"
            params.append(from_date)
        if to_date:
            where_clause += " AND t.created_at <= %s"
            params.append(to_date)
        if hide_waiting == 'true' and show_all != 'true':
            where_clause += f" AND NOT EXISTS (SELECT 1 FROM {SCHEMA}.ticket_statuses wst WHERE wst.id = t.status_id AND wst.is_waiting_response = true)"
        if needs_my_reply == 'true':
            where_clause += f"""
                AND t.assigned_to = %s
                AND EXISTS (
                    SELECT 1 FROM {SCHEMA}.ticket_comments tcnr
                    WHERE tcnr.ticket_id = t.id
                      AND tcnr.is_internal = false
                      AND tcnr.user_id = t.created_by
                      AND tcnr.created_at = (
                          SELECT MAX(tcnr2.created_at) FROM {SCHEMA}.ticket_comments tcnr2
                          WHERE tcnr2.ticket_id = t.id AND tcnr2.is_internal = false
                      )
                )
            """
            params.append(user_id)
        if is_watcher == 'true':
            where_clause += f"""
                AND EXISTS (
                    SELECT 1 FROM {SCHEMA}.ticket_watchers twf
                    WHERE twf.ticket_id = t.id AND twf.user_id = %s
                )
            """
            params.append(user_id)
        if is_subordinates == 'true':
            # Заявки, где заказчик (создатель) — подчинённый текущего пользователя:
            # либо конкретный сотрудник, либо любой сотрудник из подчинённого отдела.
            where_clause += f"""
                AND (
                    EXISTS (
                        SELECT 1 FROM {SCHEMA}.user_subordinates usub
                        WHERE usub.user_id = %s AND usub.subordinate_user_id = t.created_by
                    )
                    OR EXISTS (
                        SELECT 1 FROM {SCHEMA}.user_subordinate_departments usd
                        JOIN {SCHEMA}.users cu ON cu.id = t.created_by
                        WHERE usd.user_id = %s AND cu.department_id = usd.department_id
                    )
                )
            """
            params.extend([user_id, user_id])

        # Поисковые фильтры по текстовым полям (ILIKE)
        search_assignee = (query_params.get('search_assignee') or '').strip()
        search_creator = (query_params.get('search_creator') or '').strip()
        search_status = (query_params.get('search_status') or '').strip()
        search_executor_group = (query_params.get('search_executor_group') or '').strip()
        search_service = (query_params.get('search_service') or '').strip()
        search_ticket_service = (query_params.get('search_ticket_service') or '').strip()
        search_content = (query_params.get('search_content') or '').strip()
        due_from = (query_params.get('due_from') or '').strip()
        due_to = (query_params.get('due_to') or '').strip()

        if search_assignee:
            where_clause += f""" AND EXISTS (
                SELECT 1 FROM {SCHEMA}.users uf
                WHERE uf.id = t.assigned_to
                  AND (uf.full_name ILIKE %s OR uf.username ILIKE %s)
            )"""
            params.extend([f"%{search_assignee}%", f"%{search_assignee}%"])
        if search_creator:
            where_clause += f""" AND EXISTS (
                SELECT 1 FROM {SCHEMA}.users uc
                WHERE uc.id = t.created_by
                  AND (uc.full_name ILIKE %s OR uc.username ILIKE %s)
            )"""
            params.extend([f"%{search_creator}%", f"%{search_creator}%"])
        if search_status:
            where_clause += f""" AND EXISTS (
                SELECT 1 FROM {SCHEMA}.ticket_statuses sf
                WHERE sf.id = t.status_id AND sf.name ILIKE %s
            )"""
            params.append(f"%{search_status}%")
        if search_executor_group:
            where_clause += f""" AND EXISTS (
                SELECT 1 FROM {SCHEMA}.executor_groups egf
                WHERE egf.id = t.executor_group_id AND egf.name ILIKE %s
            )"""
            params.append(f"%{search_executor_group}%")
        if search_service:
            where_clause += f""" AND EXISTS (
                SELECT 1 FROM {SCHEMA}.ticket_to_service_mappings tsmf
                JOIN {SCHEMA}.services sff ON sff.id = tsmf.service_id
                WHERE tsmf.ticket_id = t.id AND sff.name ILIKE %s
            )"""
            params.append(f"%{search_service}%")
        if search_ticket_service:
            where_clause += f""" AND EXISTS (
                SELECT 1 FROM {SCHEMA}.ticket_to_service_mappings tsmf2
                JOIN {SCHEMA}.ticket_services tsf ON tsf.id = tsmf2.ticket_service_id
                WHERE tsmf2.ticket_id = t.id AND tsf.name ILIKE %s
            )"""
            params.append(f"%{search_ticket_service}%")
        if search_content:
            # Ищем по содержанию: title, description, доп. поля, номер, дата,
            # комментарии, участники (заказчик/исполнитель/наблюдатели), сервис, услуга
            like = f"%{search_content}%"
            where_clause += f""" AND (
                t.title ILIKE %s
                OR t.description ILIKE %s
                OR CAST(t.id AS TEXT) ILIKE %s
                OR TO_CHAR(t.created_at, 'YYYY-MM-DD') ILIKE %s
                OR EXISTS (
                    SELECT 1 FROM {SCHEMA}.ticket_custom_field_values tcfv
                    WHERE tcfv.ticket_id = t.id AND tcfv.value ILIKE %s
                )
                OR EXISTS (
                    SELECT 1 FROM {SCHEMA}.ticket_comments tc
                    WHERE tc.ticket_id = t.id AND tc.comment ILIKE %s
                )
                OR EXISTS (
                    SELECT 1 FROM {SCHEMA}.users up
                    WHERE up.id IN (t.created_by, t.assigned_to)
                      AND (up.full_name ILIKE %s OR up.username ILIKE %s)
                )
                OR EXISTS (
                    SELECT 1 FROM {SCHEMA}.ticket_watchers tw
                    JOIN {SCHEMA}.users uw ON uw.id = tw.user_id
                    WHERE tw.ticket_id = t.id
                      AND (uw.full_name ILIKE %s OR uw.username ILIKE %s)
                )
                OR EXISTS (
                    SELECT 1 FROM {SCHEMA}.ticket_to_service_mappings tsmc
                    JOIN {SCHEMA}.services ssc ON ssc.id = tsmc.service_id
                    WHERE tsmc.ticket_id = t.id AND ssc.name ILIKE %s
                )
                OR EXISTS (
                    SELECT 1 FROM {SCHEMA}.ticket_to_service_mappings tsmc2
                    JOIN {SCHEMA}.ticket_services tssc ON tssc.id = tsmc2.ticket_service_id
                    WHERE tsmc2.ticket_id = t.id AND tssc.name ILIKE %s
                )
            )"""
            params.extend([like] * 12)
        if due_from:
            where_clause += " AND t.due_date >= %s"
            params.append(due_from)
        if due_to:
            where_clause += " AND t.due_date <= %s"
            params.append(due_to)
        
        count_query = f"SELECT COUNT(*) AS total FROM {SCHEMA}.tickets t {where_clause}"
        cur.execute(count_query, params)
        total = cur.fetchone()['total']
        
        main_query = f"""
            SELECT t.id, t.title, t.description, t.status_id, t.priority_id,
                   t.assigned_to, t.created_by, t.created_at, t.updated_at,
                   t.department_id, t.due_date, t.executor_group_id,
                   t.confirmation_sent_at, t.rating, t.rejection_reason,
                   t.previous_status_id,
                   s.name as status_name, s.color as status_color, s.is_closed as status_is_closed,
                   s.is_waiting_response as status_is_waiting_response,
                   COALESCE(s.is_pending_confirmation, false) as status_is_pending_confirmation,
                   COALESCE(s.is_reopened, false) as status_is_reopened,
                   p.name as priority_name, p.color as priority_color,
                   u1.username as assignee_email, u1.full_name as assignee_name, u1.photo_url as assignee_photo_url,
                   u2.username as creator_email, u2.full_name as creator_name, u2.photo_url as creator_photo_url,
                   cdept.name as creator_department_name,
                   eg.name as executor_group_name,
                   (
                       SELECT EXISTS(
                           SELECT 1 FROM {SCHEMA}.ticket_comments tccr
                           WHERE tccr.ticket_id = t.id
                             AND tccr.user_id <> {int(user_id)}
                             {_internal_filter.format(alias='tccr')}
                             AND tccr.created_at > COALESCE(
                                 (SELECT tv2.last_seen_at FROM {SCHEMA}.ticket_views tv2
                                  WHERE tv2.user_id = {int(user_id)} AND tv2.ticket_id = t.id),
                                 'epoch'::timestamp
                             )
                       )
                   ) AS client_replied,
                   (
                       SELECT MAX(tccrt.created_at) FROM {SCHEMA}.ticket_comments tccrt
                       WHERE tccrt.ticket_id = t.id
                         AND tccrt.user_id <> {int(user_id)}
                         {_internal_filter.format(alias='tccrt')}
                         AND tccrt.created_at > COALESCE(
                             (SELECT tv3.last_seen_at FROM {SCHEMA}.ticket_views tv3
                              WHERE tv3.user_id = {int(user_id)} AND tv3.ticket_id = t.id),
                             'epoch'::timestamp
                         )
                   ) AS client_replied_at,
                   (
                       SELECT COUNT(*) FROM {SCHEMA}.notifications nu
                       WHERE nu.ticket_id = t.id AND nu.user_id = {int(user_id)} AND nu.is_read = false
                   ) AS unread_count,
                   (
                       SELECT COUNT(*) FROM {SCHEMA}.notifications nu2
                       WHERE nu2.ticket_id = t.id AND nu2.user_id = {int(user_id)}
                         AND nu2.is_read = false AND nu2.event_type = 'mention'
                   ) AS unread_mentions,
                   (
                       SELECT EXISTS(
                           SELECT 1 FROM {SCHEMA}.ticket_comments tcnew
                           WHERE tcnew.ticket_id = t.id
                             AND tcnew.user_id <> {int(user_id)}
                             {_internal_filter.format(alias='tcnew')}
                             AND tcnew.created_at > COALESCE(
                                 (SELECT tv.last_seen_at FROM {SCHEMA}.ticket_views tv
                                  WHERE tv.user_id = {int(user_id)} AND tv.ticket_id = t.id),
                                 'epoch'::timestamp
                             )
                       )
                   ) AS has_new
            FROM {SCHEMA}.tickets t
            LEFT JOIN {SCHEMA}.ticket_statuses s ON t.status_id = s.id
            LEFT JOIN {SCHEMA}.ticket_priorities p ON t.priority_id = p.id
            LEFT JOIN {SCHEMA}.users u1 ON t.assigned_to = u1.id
            LEFT JOIN {SCHEMA}.users u2 ON t.created_by = u2.id
            LEFT JOIN {SCHEMA}.departments cdept ON cdept.id = u2.department_id
            LEFT JOIN {SCHEMA}.executor_groups eg ON t.executor_group_id = eg.id
            {where_clause}
            {order_by_clause}
            LIMIT %s OFFSET %s
        """
        cur.execute(main_query, params + [limit, offset])
        tickets = [dict(row) for row in cur.fetchall()]
        
        if tickets:
            ticket_ids = [t['id'] for t in tickets]
            ticket_id_map = {t['id']: t for t in tickets}
            for t in tickets:
                t['services'] = []
                t['ticket_service'] = None
                t['custom_fields'] = []
                t['sla_violation_count'] = 0
            
            ids_str = ','.join(str(int(i)) for i in ticket_ids)
            
            cur.execute(f"""
                SELECT tsm.ticket_id, s.id, s.name, sc.name as category_name
                FROM {SCHEMA}.ticket_to_service_mappings tsm
                JOIN {SCHEMA}.services s ON s.id = tsm.service_id
                LEFT JOIN {SCHEMA}.service_categories sc ON s.category_id = sc.id
                WHERE tsm.ticket_id IN ({ids_str}) AND tsm.service_id IS NOT NULL
            """)
            for row in cur.fetchall():
                r = dict(row)
                tid = r.pop('ticket_id')
                if tid in ticket_id_map:
                    ticket_id_map[tid]['services'].append(r)
            
            cur.execute(f"""
                SELECT tsm.ticket_id, ts.id, ts.name
                FROM {SCHEMA}.ticket_to_service_mappings tsm
                JOIN {SCHEMA}.ticket_services ts ON ts.id = tsm.ticket_service_id
                WHERE tsm.ticket_id IN ({ids_str}) AND tsm.ticket_service_id IS NOT NULL
                ORDER BY tsm.ticket_id, tsm.id
            """)
            for row in cur.fetchall():
                r = dict(row)
                tid = r.pop('ticket_id')
                if tid in ticket_id_map and ticket_id_map[tid]['ticket_service'] is None:
                    ticket_id_map[tid]['ticket_service'] = r
            
            cur.execute(f"""
                SELECT tcfv.ticket_id, cf.id, cf.name, cf.field_type, tcfv.value, cf.hide_label
                FROM {SCHEMA}.ticket_custom_field_values tcfv
                JOIN {SCHEMA}.ticket_custom_fields cf ON tcfv.field_id = cf.id
                WHERE tcfv.ticket_id IN ({ids_str})
            """)
            cf_by_ticket = {}
            for row in cur.fetchall():
                r = dict(row)
                tid = r.pop('ticket_id')
                cf_by_ticket.setdefault(tid, []).append(r)
            org_cache = None
            if any(
                f.get('field_type') == 'company_structure' and f.get('value')
                for fields in cf_by_ticket.values() for f in fields
            ):
                org_cache = _load_org_structure_cache(cur)
            for tid, fields in cf_by_ticket.items():
                if tid in ticket_id_map:
                    ticket_id_map[tid]['custom_fields'] = resolve_custom_field_values(fields, cur, org_cache)
            
            cur.execute(f"""
                SELECT ticket_id, COUNT(*) AS cnt
                FROM {SCHEMA}.sla_violations
                WHERE ticket_id IN ({ids_str})
                GROUP BY ticket_id
            """)
            for row in cur.fetchall():
                r = dict(row)
                if r['ticket_id'] in ticket_id_map:
                    ticket_id_map[r['ticket_id']]['sla_violation_count'] = r['cnt']

            for t in tickets:
                t['last_comment'] = None
            last_comment_internal_filter = _internal_filter.format(alias='lc')
            cur.execute(f"""
                SELECT DISTINCT ON (lc.ticket_id)
                       lc.ticket_id, lc.id, lc.comment, lc.created_at, lc.is_internal,
                       u.full_name AS author_name, u.username AS author_email,
                       u.photo_url AS author_photo_url
                FROM {SCHEMA}.ticket_comments lc
                LEFT JOIN {SCHEMA}.users u ON u.id = lc.user_id
                WHERE lc.ticket_id IN ({ids_str})
                  {last_comment_internal_filter}
                ORDER BY lc.ticket_id, lc.created_at DESC, lc.id DESC
            """)
            for row in cur.fetchall():
                r = dict(row)
                tid = r.pop('ticket_id')
                if tid not in ticket_id_map:
                    continue
                text = r.get('comment') or ''
                r['comment'] = _strip_heavy_inline_images(text, r.get('id') or 0)
                if r.get('created_at') is not None:
                    r['created_at'] = str(r['created_at'])
                ticket_id_map[tid]['last_comment'] = r
        
        cur.close()
        pages = (total + limit - 1) // limit
        return response(200, {'tickets': tickets, 'total': total, 'page': page, 'limit': limit, 'pages': pages})
    
    elif method == 'POST':
        body = json.loads(event.get('body', '{}'))
        

        try:
            data = TicketRequest(**body)
        except Exception as e:
            return response(400, {'error': f'Validation error: {str(e)}'})
        
        cur = conn.cursor()
        
        status_id = data.status_id
        if not status_id:
            cur.execute(f"SELECT id FROM {SCHEMA}.ticket_statuses WHERE is_open = true LIMIT 1")
            open_status = cur.fetchone()
            if open_status:
                status_id = open_status['id']
        
        priority_id = data.priority_id
        if not priority_id:
            cur.execute(f"SELECT id FROM {SCHEMA}.ticket_priorities ORDER BY id LIMIT 1")
            default_priority = cur.fetchone()
            if default_priority:
                priority_id = default_priority['id']
        
        resolved_ts_id = data.ticket_service_id
        if not resolved_ts_id and data.service_ids:
            cur.execute(f"""
                SELECT ticket_service_id FROM {SCHEMA}.ticket_service_mappings
                WHERE service_id = %s LIMIT 1
            """, (data.service_ids[0],))
            ts_row = cur.fetchone()
            resolved_ts_id = ts_row['ticket_service_id'] if ts_row else None

        assigned_to = data.assigned_to
        executor_group_id = None
        try:
            if not assigned_to and resolved_ts_id:
                assigned_to = resolve_executor(cur, SCHEMA, resolved_ts_id, data.service_ids)

            if resolved_ts_id:
                executor_group_id = resolve_executor_group(cur, SCHEMA, resolved_ts_id, data.service_ids)

            if not assigned_to and not executor_group_id:
                cur.execute(
                    f"SELECT value FROM {SCHEMA}.system_settings WHERE key = 'default_executor_group_id'"
                )
                ds_row = cur.fetchone()
                default_group_raw = (ds_row['value'] if ds_row else None) or ''
                if str(default_group_raw).strip().isdigit():
                    default_group_id = int(str(default_group_raw).strip())
                    cur.execute(
                        f"SELECT id FROM {SCHEMA}.executor_groups WHERE id = %s AND is_active = true",
                        (default_group_id,)
                    )
                    if cur.fetchone():
                        executor_group_id = default_group_id

            if executor_group_id and not assigned_to:
                from executor_assignment_resolver import pick_member_for_group
                picked = pick_member_for_group(cur, SCHEMA, executor_group_id)
                if picked:
                    assigned_to = picked
        except Exception as e:
            print(f"[TICKETS] executor resolve error on create: {e}\n{traceback.format_exc()}")
            conn.rollback()
            assigned_to = data.assigned_to
            executor_group_id = None

        due_date_sql = 'NULL'
        response_due_date_sql = 'NULL'
        try:
            sla = resolve_sla_for_ticket(cur, data.ticket_service_id, data.service_ids)
            if sla:
                if sla.get('resolution_time_minutes'):
                    due_date_sql = f"NOW() + INTERVAL '{int(sla['resolution_time_minutes'])} minutes'"
                if sla.get('response_time_minutes'):
                    response_due_date_sql = f"NOW() + INTERVAL '{int(sla['response_time_minutes'])} minutes'"
        except Exception as e:
            print(f"[TICKETS] SLA resolve error on create: {e}\n{traceback.format_exc()}")
            conn.rollback()
            due_date_sql = 'NULL'
            response_due_date_sql = 'NULL'

        # Дедлайн по умолчанию: если SLA не задал срок решения и заявка создаётся
        # без указанного дедлайна — ставим N рабочих дней (по умолчанию 1),
        # пропуская субботу и воскресенье. Кол-во дней настраивается в админке.
        if due_date_sql == 'NULL':
            default_due_days = 1
            cur.execute(
                f"SELECT value FROM {SCHEMA}.system_settings WHERE key = 'default_due_working_days'"
            )
            dd_row = cur.fetchone()
            dd_raw = (dd_row['value'] if dd_row else None) or ''
            if str(dd_raw).strip().isdigit() and 1 <= int(str(dd_raw).strip()) <= 30:
                default_due_days = int(str(dd_raw).strip())
            due_date_sql = (
                "(SELECT MAX(d)::timestamp FROM ("
                "  SELECT d FROM generate_series("
                "    NOW() + INTERVAL '1 day', NOW() + INTERVAL '90 days', INTERVAL '1 day'"
                "  ) AS d"
                "  WHERE EXTRACT(ISODOW FROM d) < 6"
                "  ORDER BY d"
                f"  LIMIT {default_due_days}"
                ") sub)"
            )
        
        try:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.tickets 
                (title, description, status_id, priority_id, assigned_to, executor_group_id, created_by, due_date, response_due_date, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, {due_date_sql}, {response_due_date_sql}, NOW(), NOW())
                RETURNING id, title, description, status_id, priority_id, assigned_to, executor_group_id, created_by, due_date, response_due_date, created_at, updated_at
            """, (
                data.title,
                data.description,
                status_id,
                priority_id,
                assigned_to,
                executor_group_id,
                payload['user_id']
            ))
        except Exception as e:
            print(f"[TICKETS] INSERT ticket error on create: {e}\n{traceback.format_exc()}")
            conn.rollback()
            cur.close()
            return response(400, {'error': 'Не удалось создать заявку. Проверьте выбранные параметры.'})
        
        ticket = dict(cur.fetchone())
        ticket['auto_assigned'] = (assigned_to is not None and data.assigned_to is None)
        ticket['auto_group_assigned'] = (executor_group_id is not None)
        
        # Привязываем сервисы (из таблицы services)
        if data.service_ids:
            explicit_ts_id = data.ticket_service_id
            for service_id in data.service_ids:
                try:
                    if explicit_ts_id:
                        ts_id = explicit_ts_id
                    else:
                        cur.execute(f"""
                            SELECT ticket_service_id FROM {SCHEMA}.ticket_service_mappings
                            WHERE service_id = %s
                            LIMIT 1
                        """, (service_id,))
                        mapping = cur.fetchone()
                        ts_id = mapping['ticket_service_id'] if mapping else None
                    
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.ticket_to_service_mappings (ticket_id, service_id, ticket_service_id)
                        VALUES (%s, %s, %s)
                        ON CONFLICT DO NOTHING
                    """, (ticket['id'], service_id, ts_id))
                except Exception as e:
                    print(f"[TICKETS] Error linking service {service_id}: {e}")
                    conn.rollback()
                    cur.close()
                    return response(400, {'error': f'Сервис с ID {service_id} не найден'})
        elif data.ticket_service_id:
            try:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.ticket_to_service_mappings (ticket_id, service_id, ticket_service_id)
                    VALUES (%s, NULL, %s)
                    ON CONFLICT DO NOTHING
                """, (ticket['id'], data.ticket_service_id))
            except Exception as e:
                print(f"[TICKETS] Error linking ticket_service {data.ticket_service_id}: {e}")
                conn.rollback()
                cur.close()
                return response(400, {'error': f'Услуга с ID {data.ticket_service_id} не найдена'})
        
        # Сохраняем кастомные поля
        if data.custom_fields:
            for field_id, value in data.custom_fields.items():
                if not str(field_id).isdigit():
                    continue
                try:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.ticket_custom_field_values (ticket_id, field_id, value)
                        VALUES (%s, %s, %s)
                    """, (ticket['id'], int(field_id), value))
                except Exception as e:
                    print(f"[TICKETS] Error saving custom field {field_id}: {e}")
                    # Продолжаем, не критично

        # Создатель «уже видел» свою заявку
        try:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.ticket_views (user_id, ticket_id, last_seen_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (user_id, ticket_id) DO UPDATE SET last_seen_at = NOW()
            """, (payload['user_id'], ticket['id']))
        except Exception as e:
            print(f"[TICKETS] ticket_views init error: {e}")

        # Уведомляем назначенного исполнителя о новой заявке
        try:
            participants = _ticket_participants(cur, ticket['id'],
                                                created_by=ticket.get('created_by'),
                                                assigned_to=ticket.get('assigned_to'))
            preview = (data.title or '')[:120]
            _notify(cur, participants, payload['user_id'], ticket['id'],
                    'assignment_change', f'Новая заявка: {preview}')
        except Exception as e:
            print(f"[TICKETS] notify on create error: {e}")

        conn.commit()

        # Фиксируем начало работы группы в ticket_group_log
        if executor_group_id:
            try:
                open_log_entry(cur, ticket['id'], executor_group_id, payload['user_id'])
                conn.commit()
            except Exception as e:
                print(f"[TICKETS] group_log open error on create: {e}")

        # Загружаем связанные сервисы для ответа
        cur.execute(f"""
            SELECT s.id, s.name, sc.name as category_name
            FROM {SCHEMA}.services s
            JOIN {SCHEMA}.ticket_to_service_mappings tsm ON s.id = tsm.service_id
            LEFT JOIN {SCHEMA}.service_categories sc ON s.category_id = sc.id
            WHERE tsm.ticket_id = %s AND tsm.service_id IS NOT NULL
        """, (ticket['id'],))
        ticket['services'] = [dict(row) for row in cur.fetchall()]
        
        # Загружаем услугу (ticket_service) для ответа
        cur.execute(f"""
            SELECT DISTINCT ts.id, ts.name
            FROM {SCHEMA}.ticket_services ts
            JOIN {SCHEMA}.ticket_to_service_mappings tsm ON ts.id = tsm.ticket_service_id
            WHERE tsm.ticket_id = %s AND tsm.ticket_service_id IS NOT NULL
            LIMIT 1
        """, (ticket['id'],))
        ticket_service = cur.fetchone()
        ticket['ticket_service'] = dict(ticket_service) if ticket_service else None
        
        if ticket.get('assigned_to'):
            cur.execute(f"""
                SELECT full_name, username as email
                FROM {SCHEMA}.users WHERE id = %s
            """, (ticket['assigned_to'],))
            assignee = cur.fetchone()
            if assignee:
                ticket['assignee_name'] = assignee['full_name']
                ticket['assignee_email'] = assignee['email']
            
            try:
                origin = (event.get('headers', {}).get('Origin') or event.get('headers', {}).get('origin') or '').rstrip('/')
                notify_executor_assigned(cur, SCHEMA, ticket['id'], ticket['assigned_to'], origin)
            except Exception as e:
                print(f"[TICKETS] Bitrix notification error on create: {e}")
            try:
                origin = (event.get('headers', {}).get('Origin') or event.get('headers', {}).get('origin') or '').rstrip('/')
                max_notify_executor_assigned(cur, SCHEMA, ticket['id'], ticket['assigned_to'], origin)
            except Exception as e:
                print(f"[TICKETS] MAX notification error on create: {e}")

        try:
            origin_for_rules = (event.get('headers', {}).get('Origin') or event.get('headers', {}).get('origin') or '').rstrip('/')
            added_watchers = _apply_watcher_rules(conn, ticket['id'], 'create', app_origin=origin_for_rules)
            if added_watchers:
                print(f"[watcher-rules] CREATE ticket {ticket['id']}: added watchers {added_watchers}")
        except Exception as wr_err:
            print(f"[watcher-rules] CREATE error for ticket {ticket['id']}: {wr_err}")

        cur.close()
        
        return response(201, ticket)
    
    elif method == 'PUT':
        body = json.loads(event.get('body', '{}'))
        ticket_id = body.get('id')
        if not ticket_id:
            return response(400, {'error': 'Ticket ID required'})
        
        cur = conn.cursor()
        
        # Получаем текущее состояние заявки для логирования изменений
        cur.execute(f"""
            SELECT t.title, t.description, t.status_id, t.priority_id, t.assigned_to,
                   t.due_date, t.response_due_date, t.executor_group_id,
                   t.previous_status_id, t.sla_paused_at, t.sla_paused_total_seconds,
                   t.created_by, t.is_archived,
                   ts.is_waiting_response AS current_is_waiting,
                   COALESCE(ts.is_paused, false) AS current_is_paused,
                   COALESCE(ts.is_closed, false) AS current_is_closed,
                   COALESCE(ts.is_pending_confirmation, false) AS current_is_pending
            FROM {SCHEMA}.tickets t
            LEFT JOIN {SCHEMA}.ticket_statuses ts ON ts.id = t.status_id
            WHERE t.id = %s
        """, (ticket_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            return response(404, {'error': 'Ticket not found'})
        old_ticket = dict(row)

        # Право на редактирование содержания заявки (title, description, custom_fields, service_ids)
        # Имеют: пользователи с правом tickets.edit_content, администраторы и автор заявки
        def _can_edit_content() -> bool:
            if old_ticket.get('created_by') == user_id:
                return True
            cur.execute(f"""
                SELECT 1
                FROM {SCHEMA}.user_roles ur
                JOIN {SCHEMA}.roles r ON r.id = ur.role_id
                LEFT JOIN {SCHEMA}.role_permissions rp ON rp.role_id = ur.role_id
                LEFT JOIN {SCHEMA}.permissions p ON p.id = rp.permission_id
                WHERE ur.user_id = %s
                  AND (
                        (p.resource = 'tickets' AND p.action = 'edit_content')
                        OR r.name IN ('Администратор', 'Admin')
                      )
                LIMIT 1
            """, (user_id,))
            return cur.fetchone() is not None

        # Проверка прав на редактирование содержания (только если реально что-то меняется)
        _content_changed_title = 'title' in body and body.get('title') != old_ticket.get('title')
        _content_changed_desc = 'description' in body and body.get('description') != old_ticket.get('description')
        _content_changed_services = ('service_ids' in body) or ('ticket_service_id' in body)
        _content_changed_cf = 'custom_fields' in body
        _content_field_changed = (
            _content_changed_title or _content_changed_desc
            or _content_changed_services or _content_changed_cf
        )

        if _content_field_changed and not _can_edit_content():
            cur.close()
            return response(403, {'error': 'Недостаточно прав для редактирования содержания заявки'})

        # Если пришёл ticket_service_id, разворачиваем его в service_ids
        if 'ticket_service_id' in body and 'service_ids' not in body:
            ts_id = body.get('ticket_service_id')
            if ts_id:
                cur.execute(
                    f"SELECT service_id FROM {SCHEMA}.ticket_service_mappings WHERE ticket_service_id = %s",
                    (int(ts_id),),
                )
                body['service_ids'] = [r['service_id'] for r in cur.fetchall()]
            else:
                body['service_ids'] = []

        # Резолвим имена для истории
        def get_user_name(user_id):
            if not user_id:
                return None
            cur.execute(f"SELECT full_name FROM {SCHEMA}.users WHERE id = %s", (user_id,))
            r = cur.fetchone()
            return r['full_name'] if r else str(user_id)

        def get_status_name(status_id):
            if not status_id:
                return None
            cur.execute(f"SELECT name FROM {SCHEMA}.ticket_statuses WHERE id = %s", (status_id,))
            r = cur.fetchone()
            return r['name'] if r else str(status_id)

        def get_group_name(group_id):
            if not group_id:
                return None
            cur.execute(f"SELECT name FROM {SCHEMA}.executor_groups WHERE id = %s", (group_id,))
            r = cur.fetchone()
            return r['name'] if r else str(group_id)

        def get_priority_name(priority_id):
            if not priority_id:
                return None
            cur.execute(f"SELECT name FROM {SCHEMA}.ticket_priorities WHERE id = %s", (priority_id,))
            r = cur.fetchone()
            return r['name'] if r else str(priority_id)

        update_fields = []
        params = []
        history_entries = []
        
        if 'title' in body:
            update_fields.append("title = %s")
            params.append(body['title'])
        
        if 'description' in body:
            update_fields.append("description = %s")
            params.append(body['description'])

        # Сводная запись в истории при изменении содержания
        if _content_field_changed:
            history_entries.append(('content', '', 'Содержание изменено'))
        
        if body.get('action') == 'reopen':
            reopen_reason = body.get('reopen_reason', '').strip()
            if not reopen_reason:
                cur.close()
                return response(400, {'error': 'Необходимо указать причину повторного открытия'})
            cur.execute(
                f"SELECT id FROM {SCHEMA}.ticket_statuses WHERE is_reopened = true ORDER BY id LIMIT 1"
            )
            reopen_status = cur.fetchone()
            if not reopen_status:
                cur.close()
                return response(400, {'error': 'Не найден статус с флагом "Открыта повторно"'})
            reopen_status_id = reopen_status['id']
            history_entries.append(('status_id', get_status_name(old_ticket['status_id']), get_status_name(reopen_status_id)))
            history_entries.append(('reopen_reason', '', reopen_reason))
            update_fields.append("status_id = %s")
            params.append(reopen_status_id)
            update_fields.append("is_archived = false")
            update_fields.append("reopen_reason = %s")
            params.append(reopen_reason)

        elif 'status_id' in body:
            if body['status_id'] != old_ticket['status_id']:
                # Проверка прав: имеет ли пользователь роль, которой разрешён новый статус.
                # Админ может ставить любой статус. Для остальных статус должен быть привязан
                # хотя бы к одной из ролей пользователя в ticket_status_roles.
                role_info = _get_user_role_info(cur, user_id)
                if not role_info.get('is_admin'):
                    cur.execute(
                        f"SELECT role_id FROM {SCHEMA}.ticket_status_roles WHERE status_id = %s",
                        (body['status_id'],),
                    )
                    allowed_roles = {r['role_id'] for r in cur.fetchall()}
                    user_roles = set(role_info.get('role_ids') or [])
                    if not allowed_roles or not (allowed_roles & user_roles):
                        cur.close()
                        return response(403, {'error': 'Недостаточно прав для установки этого статуса'})
                history_entries.append(('status_id', get_status_name(old_ticket['status_id']), get_status_name(body['status_id'])))
            update_fields.append("status_id = %s")
            params.append(body['status_id'])
            cur.execute(
                f"SELECT is_closed, is_waiting_response, COALESCE(is_paused, false) AS is_paused, "
                f"COALESCE(is_pending_confirmation, false) AS is_pending_confirmation "
                f"FROM {SCHEMA}.ticket_statuses WHERE id = %s",
                (body['status_id'],),
            )
            new_status = cur.fetchone()
            if new_status:
                update_fields.append("is_archived = %s")
                params.append(bool(new_status['is_closed']))

                if new_status['is_closed'] and not old_ticket.get('is_archived'):
                    try:
                        track_ticket_closed(cur, ticket_id, payload['user_id'])
                    except Exception as e:
                        print(f"[TICKETS] group_log close error: {e}")

                # Таймер SLA приостанавливается, если новый статус: ожидает ответа,
                # ожидает подтверждения, приостановлен или закрыт.
                is_pausing = bool(
                    new_status['is_waiting_response']
                    or new_status['is_pending_confirmation']
                    or new_status['is_paused']
                    or new_status['is_closed']
                )
                was_pausing = bool(
                    old_ticket.get('current_is_waiting')
                    or old_ticket.get('current_is_pending')
                    or old_ticket.get('current_is_paused')
                    or old_ticket.get('current_is_closed')
                )
                was_closed = bool(old_ticket.get('current_is_closed'))
                # Повторное открытие = выход из закрытого статуса в активный (не на паузе).
                reopening_to_open = was_closed and not is_pausing

                if is_pausing and not was_pausing:
                    # Вход в состояние паузы: фиксируем момент остановки таймера.
                    update_fields.append("previous_status_id = %s")
                    params.append(old_ticket['status_id'])
                    update_fields.append("sla_paused_at = NOW()")
                    update_fields.append("waiting_reminder_sent_at = NULL")
                elif reopening_to_open:
                    # Повторное открытие закрытой заявки: срок считается заново по SLA.
                    cur.execute(f"""
                        SELECT service_id, ticket_service_id
                        FROM {SCHEMA}.ticket_to_service_mappings
                        WHERE ticket_id = %s
                    """, (ticket_id,))
                    svc_rows = cur.fetchall()
                    svc_ids = [r['service_id'] for r in svc_rows if r['service_id']]
                    ts_id = next((r['ticket_service_id'] for r in svc_rows if r['ticket_service_id']), None)
                    sla = resolve_sla_for_ticket(cur, ts_id, svc_ids)
                    if sla and sla.get('resolution_time_minutes'):
                        update_fields.append(
                            f"due_date = NOW() + INTERVAL '{int(sla['resolution_time_minutes'])} minutes'"
                        )
                    if sla and sla.get('response_time_minutes'):
                        update_fields.append(
                            f"response_due_date = NOW() + INTERVAL '{int(sla['response_time_minutes'])} minutes'"
                        )
                    update_fields.append("sla_paused_at = NULL")
                    update_fields.append("sla_paused_total_seconds = 0")
                    update_fields.append("previous_status_id = NULL")
                    update_fields.append("waiting_reminder_sent_at = NULL")
                elif (not is_pausing) and was_pausing:
                    # Снятие паузы (не из закрытого статуса): сдвигаем дедлайн на длительность паузы.
                    if old_ticket.get('sla_paused_at'):
                        cur.execute(
                            "SELECT EXTRACT(EPOCH FROM (NOW() - %s))::INTEGER AS sec",
                            (old_ticket['sla_paused_at'],),
                        )
                        paused_sec = cur.fetchone()['sec'] or 0
                        update_fields.append(
                            "sla_paused_total_seconds = COALESCE(sla_paused_total_seconds, 0) + %s"
                        )
                        params.append(paused_sec)
                        update_fields.append(
                            "due_date = CASE WHEN due_date IS NOT NULL THEN due_date + (%s || ' seconds')::INTERVAL ELSE NULL END"
                        )
                        params.append(paused_sec)
                        update_fields.append(
                            "response_due_date = CASE WHEN response_due_date IS NOT NULL THEN response_due_date + (%s || ' seconds')::INTERVAL ELSE NULL END"
                        )
                        params.append(paused_sec)
                    update_fields.append("sla_paused_at = NULL")
                    update_fields.append("previous_status_id = NULL")
                    update_fields.append("waiting_reminder_sent_at = NULL")
        
        if 'priority_id' in body:
            if body['priority_id'] != old_ticket['priority_id']:
                history_entries.append(('priority_id', get_priority_name(old_ticket['priority_id']), get_priority_name(body['priority_id'])))
            update_fields.append("priority_id = %s")
            params.append(body['priority_id'])
        
        if 'assigned_to' in body:
            if body['assigned_to'] != old_ticket['assigned_to']:
                cur.execute(f"""
                    SELECT 1
                    FROM {SCHEMA}.permissions p
                    JOIN {SCHEMA}.role_permissions rp ON p.id = rp.permission_id
                    JOIN {SCHEMA}.user_roles ur ON rp.role_id = ur.role_id
                    JOIN {SCHEMA}.roles r ON r.id = ur.role_id
                    WHERE ur.user_id = %s
                      AND (
                            (p.resource = 'tickets' AND p.action = 'assign_executor')
                            OR r.name IN ('Администратор', 'Admin')
                          )
                    LIMIT 1
                """, (user_id,))
                if not cur.fetchone():
                    cur.close()
                    return response(403, {'error': 'Недостаточно прав для смены исполнителя'})
                history_entries.append(('assigned_to', get_user_name(old_ticket['assigned_to']) or 'Не назначен', get_user_name(body['assigned_to']) or 'Снят с назначения'))
            update_fields.append("assigned_to = %s")
            params.append(body['assigned_to'])

            # Автоматически проставляем группу исполнителя
            new_user_id = body['assigned_to']
            if new_user_id and 'executor_group_id' not in body:
                cur.execute(f"""
                    SELECT egm.group_id
                    FROM {SCHEMA}.executor_group_members egm
                    JOIN {SCHEMA}.executor_groups eg ON eg.id = egm.group_id AND eg.is_active = true
                    WHERE egm.user_id = %s
                    ORDER BY eg.id
                    LIMIT 1
                """, (new_user_id,))
                auto_group = cur.fetchone()
                auto_group_id = auto_group['group_id'] if auto_group else None
                old_group_id = old_ticket.get('executor_group_id')
                if auto_group_id != old_group_id:
                    history_entries.append(('executor_group_id',
                        get_group_name(old_group_id) or 'Не назначена',
                        get_group_name(auto_group_id) or 'Снята'))
                    update_fields.append("executor_group_id = %s")
                    params.append(auto_group_id)
            elif not new_user_id and 'executor_group_id' not in body:
                # Исполнитель снят — снимаем группу
                old_group_id = old_ticket.get('executor_group_id')
                if old_group_id:
                    history_entries.append(('executor_group_id', get_group_name(old_group_id) or str(old_group_id), 'Снята'))
                    update_fields.append("executor_group_id = NULL")

        if 'executor_group_id' in body:
            old_group = old_ticket.get('executor_group_id')
            new_group = body['executor_group_id']
            if new_group != old_group:
                history_entries.append(('executor_group_id', get_group_name(old_group) or 'Не назначена', get_group_name(new_group) or 'Снята'))
            update_fields.append("executor_group_id = %s")
            params.append(new_group if new_group else None)
        
        if 'due_date' in body:
            old_due_date_str = old_ticket['due_date'].isoformat() if old_ticket['due_date'] else None
            new_due_date_str = body['due_date']
            if new_due_date_str != old_due_date_str:
                cur.execute(f"""
                    SELECT 1
                    FROM {SCHEMA}.permissions p
                    JOIN {SCHEMA}.role_permissions rp ON p.id = rp.permission_id
                    JOIN {SCHEMA}.user_roles ur ON rp.role_id = ur.role_id
                    JOIN {SCHEMA}.roles r ON r.id = ur.role_id
                    WHERE ur.user_id = %s
                      AND (
                            (p.resource = 'tickets' AND p.action = 'edit_deadline')
                            OR r.name IN ('Администратор', 'Admin')
                          )
                    LIMIT 1
                """, (user_id,))
                if not cur.fetchone():
                    cur.close()
                    return response(403, {'error': 'Недостаточно прав для редактирования дедлайна'})
                history_entries.append(('due_date', old_due_date_str if old_due_date_str else 'Не установлен', new_due_date_str if new_due_date_str else 'Удален'))
            update_fields.append("due_date = %s")
            params.append(body['due_date'])
        
        _has_side_updates = ('service_ids' in body) or ('custom_fields' in body)
        if not update_fields and not _has_side_updates:
            cur.close()
            return response(400, {'error': 'No fields to update'})

        if update_fields:
            update_fields.append("updated_at = NOW()")
            params.append(ticket_id)

            cur.execute(f"""
                UPDATE {SCHEMA}.tickets 
                SET {', '.join(update_fields)}
                WHERE id = %s
                RETURNING id, title, description, status_id, priority_id, assigned_to, due_date, response_due_date, created_by, created_at, updated_at
            """, params)
            ticket = dict(cur.fetchone())
        else:
            # Только побочные обновления (services / custom_fields) — апдейтим updated_at и читаем заявку
            cur.execute(f"""
                UPDATE {SCHEMA}.tickets SET updated_at = NOW() WHERE id = %s
                RETURNING id, title, description, status_id, priority_id, assigned_to, due_date, response_due_date, created_by, created_at, updated_at
            """, (ticket_id,))
            ticket = dict(cur.fetchone())
        
        # Добавляем записи в историю
        for field_name, old_value, new_value in history_entries:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.ticket_history 
                (ticket_id, user_id, field_name, old_value, new_value, created_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
            """, (ticket_id, payload['user_id'], field_name, old_value, new_value))

        if body.get('action') == 'reopen':
            reopen_reason_text = body.get('reopen_reason', '').strip()
            cur.execute(
                f"SELECT full_name FROM {SCHEMA}.users WHERE id = %s",
                (payload['user_id'],)
            )
            user_row = cur.fetchone()
            user_full_name = (user_row['full_name'] if user_row and user_row.get('full_name') else '').strip() or 'Пользователь'
            reopen_comment = f"{user_full_name} возобновил заявку по причине: {reopen_reason_text}"
            cur.execute(f"""
                INSERT INTO {SCHEMA}.ticket_comments
                (ticket_id, user_id, comment, is_internal, requires_response, created_at)
                VALUES (%s, %s, %s, false, false, NOW())
            """, (ticket_id, payload['user_id'], reopen_comment))

        if 'service_ids' in body:
            cur.execute(f"DELETE FROM {SCHEMA}.ticket_to_service_mappings WHERE ticket_id = %s", (ticket_id,))
            for service_id in body['service_ids']:
                # Получаем ticket_service_id для этого сервиса
                cur.execute(f"""
                    SELECT ticket_service_id FROM {SCHEMA}.ticket_service_mappings
                    WHERE service_id = %s
                    LIMIT 1
                """, (service_id,))
                mapping = cur.fetchone()
                ticket_service_id = mapping['ticket_service_id'] if mapping else None
                
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.ticket_to_service_mappings (ticket_id, service_id, ticket_service_id)
                    VALUES (%s, %s, %s)
                """, (ticket_id, service_id, ticket_service_id))
        
        if 'custom_fields' in body:
            cur.execute("DELETE FROM ticket_custom_field_values WHERE ticket_id = %s", (ticket_id,))
            for field_id, value in body['custom_fields'].items():
                # Пропускаем виртуальные поля (например "1_position") — это
                # производные поля для отображения, у них нет числового id и
                # своей строки в БД. int() на них падал с ValueError.
                if not str(field_id).isdigit():
                    continue
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.ticket_custom_field_values (ticket_id, field_id, value)
                    VALUES (%s, %s, %s)
                """, (ticket_id, int(field_id), value))

        # === Уведомления об изменениях ===
        try:
            new_assigned_to = body.get('assigned_to', old_ticket.get('assigned_to'))
            participants = _ticket_participants(
                cur, ticket_id,
                created_by=ticket.get('created_by'),
                assigned_to=new_assigned_to,
            )
            actor_id = payload['user_id']
            ticket_title = ticket.get('title') or ''
            preview = ticket_title[:80]

            for field_name, old_value, new_value in history_entries:
                if field_name == 'status_id':
                    cur.execute(
                        f"SELECT name, is_closed FROM {SCHEMA}.ticket_statuses WHERE id = %s",
                        (body.get('status_id'),),
                    )
                    new_st = cur.fetchone()
                    new_st_name = new_st['name'] if new_st else new_value
                    is_acceptance = bool(new_st and new_st.get('is_closed'))
                    event_type = 'acceptance' if is_acceptance else 'status_change'
                    msg = f'Статус «{new_st_name}» — {preview}'
                    _notify(cur, participants, actor_id, ticket_id, event_type, msg,
                            payload={'old': old_value, 'new': new_value})

                elif field_name == 'due_date':
                    _notify(cur, participants, actor_id, ticket_id,
                            'deadline_change',
                            f'Изменён срок выполнения — {preview}',
                            payload={'old': old_value, 'new': new_value})

                elif field_name == 'assigned_to':
                    targets = participants.copy()
                    if body.get('assigned_to'):
                        targets.add(body['assigned_to'])
                    _notify(cur, targets, actor_id, ticket_id,
                            'assignment_change',
                            f'Сменился ответственный — {preview}',
                            payload={'old': old_value, 'new': new_value})
        except Exception as notify_err:
            import traceback
            print(f"[TICKETS] notify on update error: {notify_err}\n{traceback.format_exc()}")

        # Авто-добавление наблюдателей при смене исполнителя
        # по правилам ticket_watcher_rules с trigger_on_executor_change=true
        try:
            if (
                'assigned_to' in body
                and body['assigned_to'] != old_ticket.get('assigned_to')
                and old_ticket.get('assigned_to')
            ):
                prev_assignee = old_ticket['assigned_to']
                new_assignee = body.get('assigned_to')
                creator_id = ticket.get('created_by') or old_ticket.get('created_by')

                t_cat = body['category_id'] if 'category_id' in body else old_ticket.get('category_id')
                t_dept = body['department_id'] if 'department_id' in body else old_ticket.get('department_id')
                t_prio = body['priority_id'] if 'priority_id' in body else old_ticket.get('priority_id')
                t_grp = body['executor_group_id'] if 'executor_group_id' in body else old_ticket.get('executor_group_id')

                cur.execute(f"""
                    SELECT id, category_id, department_id, priority_id,
                           executor_group_id, assignee_id, match_mode
                    FROM {SCHEMA}.ticket_watcher_rules
                    WHERE is_active = true AND trigger_on_executor_change = true
                """)
                exec_rules = [dict(r) for r in cur.fetchall()]

                matched_ids = []
                for r in exec_rules:
                    # Условие assignee_id сверяем с НОВЫМ исполнителем заявки
                    conditions = [
                        (r['category_id'], t_cat),
                        (r['department_id'], t_dept),
                        (r['priority_id'], t_prio),
                        (r['executor_group_id'], t_grp),
                        (r['assignee_id'], new_assignee),
                    ]
                    non_empty = [(rv, tv) for rv, tv in conditions if rv]
                    if not non_empty:
                        continue
                    mode = str(r.get('match_mode') or 'AND').upper()
                    if mode == 'OR':
                        ok = any(rv == tv for rv, tv in non_empty)
                    else:
                        ok = all(rv == tv for rv, tv in non_empty)
                    if ok:
                        matched_ids.append(r['id'])

                if matched_ids:
                    # Бывший исполнитель добавляется всегда (даже если он —
                    # создатель заявки), исключаем только нового исполнителя
                    forced_users = set()
                    if prev_assignee and prev_assignee != new_assignee:
                        forced_users.add(int(prev_assignee))

                    # Адресаты блока «То» из правил (user/group/role)
                    target_users = set()
                    ids_csv = ','.join(str(int(x)) for x in matched_ids)
                    cur.execute(f"""
                        SELECT target_type, target_id
                        FROM {SCHEMA}.ticket_watcher_rule_targets
                        WHERE rule_id IN ({ids_csv})
                    """)
                    rule_targets = [dict(t) for t in cur.fetchall()]

                    group_ids = [t['target_id'] for t in rule_targets if t['target_type'] == 'group']
                    role_ids = [t['target_id'] for t in rule_targets if t['target_type'] == 'role']
                    for t in rule_targets:
                        if t['target_type'] == 'user' and t['target_id']:
                            target_users.add(int(t['target_id']))
                    if group_ids:
                        gids_csv = ','.join(str(int(x)) for x in group_ids)
                        cur.execute(f"""
                            SELECT user_id FROM {SCHEMA}.executor_group_members
                            WHERE group_id IN ({gids_csv})
                        """)
                        for rr in cur.fetchall():
                            target_users.add(int(rr['user_id']))
                    if role_ids:
                        rids_csv = ','.join(str(int(x)) for x in role_ids)
                        cur.execute(f"""
                            SELECT user_id FROM {SCHEMA}.user_roles
                            WHERE role_id IN ({rids_csv})
                        """)
                        for rr in cur.fetchall():
                            target_users.add(int(rr['user_id']))

                    # Для адресатов из «То» — пропускаем создателя и нового исполнителя
                    for uid in target_users:
                        if not uid:
                            continue
                        if creator_id and uid == creator_id:
                            continue
                        if new_assignee and uid == new_assignee:
                            continue
                        forced_users.add(int(uid))

                    for uid in forced_users:
                        cur.execute(f"""
                            INSERT INTO {SCHEMA}.ticket_watchers (ticket_id, user_id, added_at)
                            VALUES (%s, %s, NOW())
                            ON CONFLICT (ticket_id, user_id) DO NOTHING
                        """, (ticket_id, uid))
        except Exception as wexc:
            print(f"[TICKETS] auto-watcher on executor change error: {wexc}")

        # Актор «увидел» изменение (его собственное)
        try:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.ticket_views (user_id, ticket_id, last_seen_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (user_id, ticket_id) DO UPDATE SET last_seen_at = NOW()
            """, (payload['user_id'], ticket_id))
        except Exception as e:
            print(f"[TICKETS] ticket_views update error: {e}")

        # Обновляем ticket_group_log при смене группы или исполнителя
        try:
            group_changed = 'executor_group_id' in body and body['executor_group_id'] != old_ticket.get('executor_group_id')
            assignee_changed = 'assigned_to' in body and body['assigned_to'] != old_ticket.get('assigned_to')
            if group_changed:
                old_gid = old_ticket.get('executor_group_id')
                new_gid = body.get('executor_group_id')
                if old_gid:
                    from group_tracking_service import close_active_log_entry
                    close_active_log_entry(cur, ticket_id, payload['user_id'])
                if new_gid:
                    open_log_entry(cur, ticket_id, new_gid, payload['user_id'])
            elif assignee_changed:
                track_assignment_change(
                    cur, ticket_id,
                    old_ticket.get('assigned_to'),
                    body.get('assigned_to'),
                    payload['user_id']
                )
        except Exception as e:
            print(f"[TICKETS] group_log update error: {e}")

        conn.commit()
        
        if 'assigned_to' in body and body['assigned_to'] and body['assigned_to'] != old_ticket.get('assigned_to'):
            try:
                origin = (event.get('headers', {}).get('Origin') or event.get('headers', {}).get('origin') or '').rstrip('/')
                notify_executor_assigned(cur, SCHEMA, ticket_id, body['assigned_to'], origin)
            except Exception as e:
                print(f"[TICKETS] Bitrix notification error on assign: {e}")
            try:
                origin = (event.get('headers', {}).get('Origin') or event.get('headers', {}).get('origin') or '').rstrip('/')
                max_notify_executor_assigned(cur, SCHEMA, ticket_id, body['assigned_to'], origin)
            except Exception as e:
                print(f"[TICKETS] MAX notification error on assign: {e}")

        try:
            origin_for_rules = (event.get('headers', {}).get('Origin') or event.get('headers', {}).get('origin') or '').rstrip('/')
            added_watchers = _apply_watcher_rules(conn, ticket_id, 'update', app_origin=origin_for_rules)
            if added_watchers:
                print(f"[watcher-rules] UPDATE ticket {ticket_id}: added watchers {added_watchers}")
        except Exception as wr_err:
            print(f"[watcher-rules] UPDATE error for ticket {ticket_id}: {wr_err}")

        cur.close()
        
        return response(200, ticket)
    
    elif method == 'DELETE':
        body = json.loads(event.get('body', '{}'))
        ticket_id = body.get('id')
        if not ticket_id:
            return response(400, {'error': 'Ticket ID required'})
        
        cur = conn.cursor()
        
        # Сначала удаляем вложения и реакции к комментариям
        cur.execute(f"""
            DELETE FROM {SCHEMA}.comment_attachments
            WHERE comment_id IN (SELECT id FROM {SCHEMA}.ticket_comments WHERE ticket_id = %s)
        """, (ticket_id,))
        cur.execute(f"""
            DELETE FROM {SCHEMA}.comment_reactions
            WHERE comment_id IN (SELECT id FROM {SCHEMA}.ticket_comments WHERE ticket_id = %s)
        """, (ticket_id,))
        cur.execute(f"DELETE FROM {SCHEMA}.ticket_comments WHERE ticket_id = %s", (ticket_id,))
        cur.execute(f"DELETE FROM {SCHEMA}.ticket_to_service_mappings WHERE ticket_id = %s", (ticket_id,))
        cur.execute(f"DELETE FROM {SCHEMA}.ticket_custom_field_values WHERE ticket_id = %s", (ticket_id,))
        cur.execute(f"DELETE FROM {SCHEMA}.tickets WHERE id = %s", (ticket_id,))
        
        conn.commit()
        cur.close()
        
        return response(200, {'message': 'Заявка удалена'})
    
    return response(405, {'error': 'Method not allowed'})

def handle_service_categories(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    
    if method == 'GET':
        cur = conn.cursor()
        cur.execute(f'SELECT id, name, icon, created_at FROM {SCHEMA}.ticket_service_categories ORDER BY name')
        categories = [dict(row) for row in cur.fetchall()]
        cur.close()
        return response(200, categories)
    
    elif method == 'POST':
        body = json.loads(event.get('body', '{}'))
        
        try:
            data = ServiceCategoryRequest(**body)
        except Exception as e:
            return response(400, {'error': f'Validation error: {str(e)}'})
        
        cur = conn.cursor()
        
        cur.execute(f"""
            INSERT INTO {SCHEMA}.ticket_service_categories (name, icon)
            VALUES (%s, %s)
            RETURNING id, name, icon, created_at
        """, (data.name, data.icon))
        
        category = dict(cur.fetchone())
        conn.commit()
        cur.close()
        
        return response(201, category)
    
    elif method == 'PUT':
        body = json.loads(event.get('body', '{}'))
        category_id = body.get('id')
        if not category_id:
            return response(400, {'error': 'Category ID required'})
        
        update_fields = []
        params = []
        
        if 'name' in body:
            update_fields.append("name = %s")
            params.append(body['name'])
        
        if 'description' in body:
            update_fields.append("description = %s")
            params.append(body['description'])
        
        if 'icon' in body:
            update_fields.append("icon = %s")
            params.append(body['icon'])
        
        params.append(category_id)
        
        cur = conn.cursor()
        
        cur.execute(f"""
            UPDATE {SCHEMA}.ticket_service_categories 
            SET {', '.join(update_fields)}
            WHERE id = %s
            RETURNING id, name, icon, created_at
        """, params)
        
        category = dict(cur.fetchone())
        conn.commit()
        cur.close()
        
        return response(200, category)
    
    elif method == 'DELETE':
        body = json.loads(event.get('body', '{}'))
        category_id = body.get('id')
        if not category_id:
            return response(400, {'error': 'Category ID required'})
        
        cur = conn.cursor()
        cur.execute(f"DELETE FROM {SCHEMA}.ticket_service_categories WHERE id = %s", (category_id,))
        conn.commit()
        cur.close()
        
        return response(200, {'message': 'Категория удалена'})
    
    return response(405, {'error': 'Method not allowed'})

def handle_ticket_dictionaries(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    """Обработчик для получения справочников заявок"""
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    
    if method != 'GET':
        return response(405, {'error': 'Только GET запросы'})
    
    cur = conn.cursor()
    
    try:
        cur.execute(f'SELECT id, name, icon FROM {SCHEMA}.ticket_categories ORDER BY name')
        categories = [dict(row) for row in cur.fetchall()]
        
        cur.execute(f"SELECT id, name, level, color, COALESCE(description, '') as description, COALESCE(is_critical, false) as is_critical FROM {SCHEMA}.ticket_priorities ORDER BY level DESC")
        priorities = [dict(row) for row in cur.fetchall()]
        
        cur.execute(f'SELECT id, name, color, is_closed, is_approval, is_approval_revoked, is_approved, is_waiting_response, is_pending_confirmation, is_in_progress, is_reopened, COALESCE(is_paused, false) AS is_paused FROM {SCHEMA}.ticket_statuses ORDER BY id')
        statuses = [dict(row) for row in cur.fetchall()]
        status_role_map = _load_status_role_map(cur)
        user_id = payload.get('user_id')
        role_info = _get_user_role_info(cur, user_id) if user_id else {'role_ids': [], 'is_admin': False}
        statuses = _filter_statuses_by_role(statuses, role_info, status_role_map)
        
        cur.execute(f'SELECT id, name, description FROM {SCHEMA}.departments ORDER BY name')
        departments = [dict(row) for row in cur.fetchall()]
        
        cur.execute(f'SELECT id, name, field_type, options, is_required FROM {SCHEMA}.ticket_custom_fields ORDER BY name')
        custom_fields = [dict(row) for row in cur.fetchall()]
        
        return response(200, {
            'categories': categories,
            'priorities': priorities,
            'statuses': statuses,
            'departments': departments,
            'custom_fields': custom_fields
        })
    
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_ticket_statuses(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    """Обработчик для управления статусами заявок (ticket_statuses)"""
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    
    if method == 'GET':
        cur = conn.cursor()
        cur.execute(f'SELECT id, name, color, is_closed, is_open, is_approval, is_approval_revoked, is_approved, is_waiting_response, is_pending_confirmation, count_for_distribution, is_in_progress, is_reopened, COALESCE(is_paused, false) AS is_paused FROM {SCHEMA}.ticket_statuses ORDER BY id')
        statuses = [dict(row) for row in cur.fetchall()]
        role_map = _load_status_role_map(cur)
        for st in statuses:
            st['role_ids'] = role_map.get(st['id'], [])
        params = event.get('queryStringParameters') or {}
        if str(params.get('filter_by_role', '')).lower() in ('1', 'true', 'yes'):
            user_id = payload.get('user_id')
            role_info = _get_user_role_info(cur, user_id) if user_id else {'role_ids': [], 'is_admin': False}
            statuses = _filter_statuses_by_role(statuses, role_info, role_map)
        cur.close()
        return response(200, statuses)
    
    elif method == 'POST':
        body = json.loads(event.get('body', '{}'))
        name = body.get('name')
        color = body.get('color', '#3b82f6')
        is_closed = body.get('is_closed', False)
        is_open = body.get('is_open', False)
        is_approval = body.get('is_approval', False)
        is_approval_revoked = body.get('is_approval_revoked', False)
        is_approved = body.get('is_approved', False)
        is_waiting_response = body.get('is_waiting_response', False)
        count_for_distribution = body.get('count_for_distribution', False)
        is_in_progress = body.get('is_in_progress', False)
        is_reopened = body.get('is_reopened', False)
        role_ids = body.get('role_ids') or []
        
        if not name:
            return response(400, {'error': 'Name is required'})
        
        cur = conn.cursor()
        
        if is_open:
            cur.execute(f"UPDATE {SCHEMA}.ticket_statuses SET is_open = false WHERE is_open = true")
        
        if is_approval:
            cur.execute(f"UPDATE {SCHEMA}.ticket_statuses SET is_approval = false WHERE is_approval = true")
        
        if is_approval_revoked:
            cur.execute(f"UPDATE {SCHEMA}.ticket_statuses SET is_approval_revoked = false WHERE is_approval_revoked = true")
        
        if is_approved:
            cur.execute(f"UPDATE {SCHEMA}.ticket_statuses SET is_approved = false WHERE is_approved = true")
        
        if is_waiting_response:
            cur.execute(f"UPDATE {SCHEMA}.ticket_statuses SET is_waiting_response = false WHERE is_waiting_response = true")
        
        cur.execute(
            f"INSERT INTO {SCHEMA}.ticket_statuses (name, color, is_closed, is_open, is_approval, is_approval_revoked, is_approved, is_waiting_response, count_for_distribution, is_in_progress, is_reopened) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id, name, color, is_closed, is_open, is_approval, is_approval_revoked, is_approved, is_waiting_response, count_for_distribution, is_in_progress, is_reopened",
            (name, color, is_closed, is_open, is_approval, is_approval_revoked, is_approved, is_waiting_response, count_for_distribution, is_in_progress, is_reopened)
        )
        status = dict(cur.fetchone())
        _replace_status_roles(cur, status['id'], role_ids)
        status['role_ids'] = [int(r) for r in (role_ids or []) if str(r).lstrip('-').isdigit()]
        conn.commit()
        cur.close()
        return response(201, status)
    
    elif method == 'PUT':
        body = json.loads(event.get('body', '{}'))
        status_id = body.get('id')
        name = body.get('name')
        color = body.get('color', '#3b82f6')
        is_closed = body.get('is_closed', False)
        is_open = body.get('is_open', False)
        is_approval = body.get('is_approval', False)
        is_approval_revoked = body.get('is_approval_revoked', False)
        is_approved = body.get('is_approved', False)
        is_waiting_response = body.get('is_waiting_response', False)
        count_for_distribution = body.get('count_for_distribution', False)
        is_in_progress = body.get('is_in_progress', False)
        is_reopened = body.get('is_reopened', False)
        role_ids = body.get('role_ids')
        
        if not status_id or not name:
            return response(400, {'error': 'ID and name are required'})
        
        cur = conn.cursor()
        
        if is_open:
            cur.execute(f"UPDATE {SCHEMA}.ticket_statuses SET is_open = false WHERE is_open = true AND id != %s", (status_id,))
        
        if is_approval:
            cur.execute(f"UPDATE {SCHEMA}.ticket_statuses SET is_approval = false WHERE is_approval = true AND id != %s", (status_id,))
        
        if is_approval_revoked:
            cur.execute(f"UPDATE {SCHEMA}.ticket_statuses SET is_approval_revoked = false WHERE is_approval_revoked = true AND id != %s", (status_id,))
        
        if is_approved:
            cur.execute(f"UPDATE {SCHEMA}.ticket_statuses SET is_approved = false WHERE is_approved = true AND id != %s", (status_id,))
        
        if is_waiting_response:
            cur.execute(f"UPDATE {SCHEMA}.ticket_statuses SET is_waiting_response = false WHERE is_waiting_response = true AND id != %s", (status_id,))
        
        cur.execute(
            f"UPDATE {SCHEMA}.ticket_statuses SET name = %s, color = %s, is_closed = %s, is_open = %s, is_approval = %s, is_approval_revoked = %s, is_approved = %s, is_waiting_response = %s, count_for_distribution = %s, is_in_progress = %s, is_reopened = %s WHERE id = %s RETURNING id, name, color, is_closed, is_open, is_approval, is_approval_revoked, is_approved, is_waiting_response, count_for_distribution, is_in_progress, is_reopened",
            (name, color, is_closed, is_open, is_approval, is_approval_revoked, is_approved, is_waiting_response, count_for_distribution, is_in_progress, is_reopened, status_id)
        )
        status = dict(cur.fetchone())
        
        if not status:
            cur.close()
            return response(404, {'error': 'Status not found'})
        
        if role_ids is not None:
            _replace_status_roles(cur, status_id, role_ids)
        cur.execute(f"SELECT role_id FROM {SCHEMA}.ticket_status_roles WHERE status_id = %s", (status_id,))
        status['role_ids'] = [r['role_id'] for r in cur.fetchall()]
        
        cur.execute(
            f"UPDATE {SCHEMA}.tickets SET is_archived = %s WHERE status_id = %s AND COALESCE(is_archived, false) <> %s",
            (bool(is_closed), status_id, bool(is_closed))
        )
        
        conn.commit()
        cur.close()
        return response(200, status)
    
    elif method == 'DELETE':
        body = json.loads(event.get('body', '{}'))
        status_id = body.get('id')
        
        if not status_id:
            return response(400, {'error': 'ID is required'})
        
        cur = conn.cursor()
        cur.execute(f'DELETE FROM {SCHEMA}.ticket_statuses WHERE id = %s', (status_id,))
        conn.commit()
        cur.close()
        return response(200, {'success': True})
    
    return response(405, {'error': 'Method not allowed'})

def handle_ticket_services(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    """Обработчик для управления услугами заявок (ticket_services)"""
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            cur.execute(f'''
                SELECT ts.id, ts.name, ts.description, ts.ticket_title, ts.category_id, 
                       tsc.name as category_name, ts.created_at 
                FROM {SCHEMA}.ticket_services ts
                LEFT JOIN {SCHEMA}.ticket_service_categories tsc ON ts.category_id = tsc.id
                WHERE ts.is_active = true
                ORDER BY ts.name
            ''')
            rows = cur.fetchall()

            # Без N+1: одним запросом собираем связи для ВСЕХ услуг сразу,
            # затем группируем в памяти. Это резко снижает число обращений
            # к БД (раньше на каждую услугу шло по 2 запроса — упирались
            # в rate limit БД, отсюда были 502 «через раз»).
            mappings_by_service: Dict[Any, list] = {}
            visible_by_service: Dict[Any, list] = {}
            if rows:
                cur.execute(f'''
                    SELECT m.ticket_service_id, m.service_id
                    FROM {SCHEMA}.ticket_service_mappings m
                    JOIN {SCHEMA}.ticket_services ts ON ts.id = m.ticket_service_id
                    WHERE ts.is_active = true
                ''')
                for r in cur.fetchall():
                    mappings_by_service.setdefault(r['ticket_service_id'], []).append(r['service_id'])

                cur.execute(f'''
                    SELECT v.ticket_service_id, v.user_id
                    FROM {SCHEMA}.ticket_service_visible_users v
                    JOIN {SCHEMA}.ticket_services ts ON ts.id = v.ticket_service_id
                    WHERE ts.is_active = true
                ''')
                for r in cur.fetchall():
                    visible_by_service.setdefault(r['ticket_service_id'], []).append(r['user_id'])

            ticket_services = []
            for row in rows:
                ticket_services.append({
                    'id': row['id'],
                    'name': row['name'],
                    'description': row['description'] or '',
                    'ticket_title': row['ticket_title'] or '',
                    'category_id': row['category_id'],
                    'category_name': row['category_name'],
                    'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                    'service_ids': mappings_by_service.get(row['id'], []),
                    'visible_to_user_ids': visible_by_service.get(row['id'], [])
                })
            return response(200, ticket_services)
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            name = body.get('name')
            description = body.get('description', '')
            ticket_title = body.get('ticket_title', '')
            category_id = body.get('category_id')
            service_ids = body.get('service_ids', [])
            visible_to_user_ids = body.get('visible_to_user_ids', [])
            
            if not name:
                return response(400, {'error': 'Name is required'})
            
            cur.execute(
                f"INSERT INTO {SCHEMA}.ticket_services (name, description, ticket_title, category_id) VALUES (%s, %s, %s, %s) RETURNING id, name, description, ticket_title, category_id, created_at",
                (name, description, ticket_title, category_id)
            )
            row = cur.fetchone()
            ticket_service_id = row['id']
            
            for service_id in service_ids:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.ticket_service_mappings (ticket_service_id, service_id) VALUES (%s, %s)",
                    (ticket_service_id, service_id)
                )
            
            for uid in visible_to_user_ids:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.ticket_service_visible_users (ticket_service_id, user_id) VALUES (%s, %s)",
                    (ticket_service_id, uid)
                )
            
            conn.commit()
            
            return response(201, {
                'id': row['id'],
                'name': row['name'],
                'description': row['description'],
                'ticket_title': row['ticket_title'],
                'category_id': row['category_id'],
                'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                'service_ids': service_ids,
                'visible_to_user_ids': visible_to_user_ids
            })
        
        elif method == 'PUT':
            params = event.get('queryStringParameters', {})
            body = json.loads(event.get('body', '{}'))
            ticket_service_id = params.get('id') or body.get('id')
            name = body.get('name')
            description = body.get('description', '')
            ticket_title = body.get('ticket_title', '')
            category_id = body.get('category_id')
            service_ids = body.get('service_ids', [])
            visible_to_user_ids = body.get('visible_to_user_ids', [])
            
            if not ticket_service_id or not name:
                return response(400, {'error': 'ID and name are required'})
            
            cur.execute(
                f"UPDATE {SCHEMA}.ticket_services SET name = %s, description = %s, ticket_title = %s, category_id = %s WHERE id = %s RETURNING id, name, description, ticket_title, category_id, created_at",
                (name, description, ticket_title, category_id, ticket_service_id)
            )
            row = cur.fetchone()
            
            if not row:
                return response(404, {'error': 'Ticket service not found'})
            
            cur.execute(
                f"DELETE FROM {SCHEMA}.ticket_service_mappings WHERE ticket_service_id = %s",
                (ticket_service_id,)
            )
            
            for service_id in service_ids:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.ticket_service_mappings (ticket_service_id, service_id) VALUES (%s, %s)",
                    (ticket_service_id, service_id)
                )
            
            cur.execute(
                f"DELETE FROM {SCHEMA}.ticket_service_visible_users WHERE ticket_service_id = %s",
                (ticket_service_id,)
            )
            
            for uid in visible_to_user_ids:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.ticket_service_visible_users (ticket_service_id, user_id) VALUES (%s, %s)",
                    (ticket_service_id, uid)
                )
            
            conn.commit()
            
            return response(200, {
                'id': row['id'],
                'name': row['name'],
                'description': row['description'],
                'ticket_title': row['ticket_title'],
                'category_id': row['category_id'],
                'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                'service_ids': service_ids,
                'visible_to_user_ids': visible_to_user_ids
            })
        
        elif method == 'DELETE':
            params = event.get('queryStringParameters', {})
            ticket_service_id = params.get('id')
            
            if not ticket_service_id:
                return response(400, {'error': 'ID is required'})
            
            cur.execute(f'SELECT id FROM {SCHEMA}.ticket_services WHERE id = %s', (ticket_service_id,))
            if not cur.fetchone():
                return response(404, {'error': 'Услуга не найдена'})
            
            cur.execute(
                f'SELECT COUNT(*) AS cnt FROM {SCHEMA}.ticket_to_service_mappings WHERE ticket_service_id = %s',
                (ticket_service_id,)
            )
            used_count = cur.fetchone()['cnt']
            
            if used_count > 0:
                return response(409, {
                    'error': f'Услуга используется в заявках ({used_count}) и не может быть удалена. '
                             'Сначала отвяжите услугу от этих заявок.'
                })
            
            for tbl, col in [
                ('ticket_service_mappings', 'ticket_service_id'),
                ('ticket_service_visible_users', 'ticket_service_id'),
                ('executor_group_service_mappings', 'ticket_service_id'),
                ('executor_user_service_mappings', 'ticket_service_id'),
                ('sla_service_mappings', 'ticket_service_id'),
                ('ticket_service_field_mappings', 'ticket_service_id'),
                ('service_category_service_fields', 'service_id'),
                ('ai_training_examples', 'ticket_service_id'),
            ]:
                cur.execute(f'DELETE FROM {SCHEMA}.{tbl} WHERE {col} = %s', (ticket_service_id,))
            
            cur.execute(f'DELETE FROM {SCHEMA}.ticket_services WHERE id = %s', (ticket_service_id,))
            conn.commit()
            
            return response(200, {'success': True})
        
        return response(405, {'error': 'Method not allowed'})
    
    finally:
        cur.close()

def handle_ticket_service_mappings(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    """Обработчик для получения связей услуг и сервисов (ticket_service_mappings)"""
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    
    if method != 'GET':
        return response(405, {'error': 'Только GET запросы'})
    
    cur = conn.cursor()
    
    try:
        cur.execute(f'''
            SELECT id, ticket_service_id, service_id, created_at
            FROM {SCHEMA}.ticket_service_mappings
            ORDER BY ticket_service_id, service_id
        ''')
        mappings = [dict(row) for row in cur.fetchall()]
        print(f'[ticket_service_mappings] Found {len(mappings)} mappings')
        return response(200, mappings)
    
    except Exception as e:
        print(f'[ticket_service_mappings] Error: {str(e)}')
        return response(500, {'error': str(e)})
    finally:
        cur.close()

def handle_ticket_approvals(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    """Обработчик для управления согласованиями заявок"""
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            query_params = event.get('queryStringParameters', {})
            ticket_id = query_params.get('ticket_id')
            
            if not ticket_id:
                return response(400, {'error': 'ticket_id is required'})
            
            cur.execute(f"""
                SELECT ta.id, ta.ticket_id, ta.approver_id, ta.status, ta.comment, 
                       ta.created_at, ta.updated_at,
                       u.full_name as approver_name, u.email as approver_email, u.photo_url as approver_photo_url
                FROM {SCHEMA}.ticket_approvals ta
                LEFT JOIN {SCHEMA}.users u ON ta.approver_id = u.id
                WHERE ta.ticket_id = %s
                ORDER BY ta.created_at DESC
            """, (ticket_id,))
            approvals = [dict(row) for row in cur.fetchall()]
            return response(200, approvals)
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            ticket_id = body.get('ticket_id')
            approver_ids = body.get('approver_ids', [])
            
            if not ticket_id or not approver_ids:
                return response(400, {'error': 'ticket_id and approver_ids are required'})
            
            approver_user_id = payload.get('user_id')
            cur.execute(f"""
                SELECT 1
                FROM {SCHEMA}.permissions p
                JOIN {SCHEMA}.role_permissions rp ON p.id = rp.permission_id
                JOIN {SCHEMA}.user_roles ur ON rp.role_id = ur.role_id
                JOIN {SCHEMA}.roles r ON r.id = ur.role_id
                WHERE ur.user_id = %s
                  AND (
                        (p.resource = 'tickets' AND p.action = 'edit_approvers')
                        OR r.name IN ('Администратор', 'Admin')
                      )
                LIMIT 1
            """, (approver_user_id,))
            if not cur.fetchone():
                return response(403, {'error': 'Недостаточно прав для назначения согласующих'})
            
            for approver_id in approver_ids:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.ticket_approvals (ticket_id, approver_id, status)
                    VALUES (%s, %s, 'pending')
                """, (ticket_id, approver_id))
            
            conn.commit()
            return response(201, {'message': 'Approvers added successfully'})
        
        elif method == 'PUT':
            body = json.loads(event.get('body', '{}'))
            ticket_id = body.get('ticket_id')
            action = body.get('action')
            comment = body.get('comment', '')
            
            if not ticket_id or not action:
                return response(400, {'error': 'ticket_id and action are required'})
            
            if action not in ['approved', 'rejected', 'revoked']:
                return response(400, {'error': 'action must be approved, rejected or revoked'})
            
            # Для отзыва согласования обновляем approved статус
            if action == 'revoked':
                cur.execute(f"""
                    UPDATE {SCHEMA}.ticket_approvals
                    SET status = %s, comment = %s, updated_at = NOW()
                    WHERE ticket_id = %s AND approver_id = %s AND status = 'approved'
                    RETURNING id
                """, (action, comment, ticket_id, payload['user_id']))
            else:
                # Для одобрения/отклонения обновляем pending статус
                cur.execute(f"""
                    UPDATE {SCHEMA}.ticket_approvals
                    SET status = %s, comment = %s, updated_at = NOW()
                    WHERE ticket_id = %s AND approver_id = %s AND status = 'pending'
                    RETURNING id
                """, (action, comment, ticket_id, payload['user_id']))
            
            result = cur.fetchone()
            if not result:
                return response(404, {'error': 'Approval not found or already processed'})
            
            # Получаем все согласования для этой заявки
            cur.execute(f"""
                SELECT status FROM {SCHEMA}.ticket_approvals
                WHERE ticket_id = %s
            """, (ticket_id,))
            all_approvals = [dict(row) for row in cur.fetchall()]
            
            total_approvers = len(all_approvals)
            approved_count = sum(1 for a in all_approvals if a['status'] == 'approved')
            revoked_count = sum(1 for a in all_approvals if a['status'] == 'revoked')
            rejected_count = sum(1 for a in all_approvals if a['status'] == 'rejected')
            
            # Если все согласующие одобрили - переходим в статус "Согласовано"
            if action == 'approved' and (total_approvers == 1 or approved_count == total_approvers):
                cur.execute(f"""
                    SELECT id FROM {SCHEMA}.ticket_statuses
                    WHERE is_approved = true
                    LIMIT 1
                """)
                approved_status = cur.fetchone()
                
                if approved_status:
                    cur.execute(f"""
                        UPDATE {SCHEMA}.tickets
                        SET status_id = %s, updated_at = NOW()
                        WHERE id = %s
                    """, (approved_status['id'], ticket_id))
            
            # Если отозвали или отклонили согласование, проверяем нужно ли менять статус заявки
            elif action in ['revoked', 'rejected']:
                negative_count = revoked_count + rejected_count
                
                # Если единственный согласующий или все отозвали/отклонили - меняем статус
                if total_approvers == 1 or negative_count == total_approvers:
                    # Находим статус "Согласование отозвано"
                    cur.execute(f"""
                        SELECT id FROM {SCHEMA}.ticket_statuses
                        WHERE is_approval_revoked = true
                        LIMIT 1
                    """)
                    revoked_status = cur.fetchone()
                    
                    if revoked_status:
                        cur.execute(f"""
                            UPDATE {SCHEMA}.tickets
                            SET status_id = %s, updated_at = NOW()
                            WHERE id = %s
                        """, (revoked_status['id'], ticket_id))
            
            conn.commit()
            return response(200, {'message': f'Ticket {action} successfully'})
        
        return response(405, {'error': 'Method not allowed'})
    
    finally:
        cur.close()


def handle_ticket_confirmation(method: str, event: dict, conn) -> dict:
    """Обработчик подтверждения выполнения заявки заказчиком"""
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})

    user_id = payload.get('user_id')
    cur = conn.cursor()

    try:
        if method == 'POST':
            body = json.loads(event.get('body', '{}'))
            ticket_id = body.get('ticket_id')
            if not ticket_id:
                return response(400, {'error': 'ticket_id is required'})

            cur.execute(f"SELECT id, assigned_to, created_by, status_id FROM {SCHEMA}.tickets WHERE id = %s", (ticket_id,))
            ticket = cur.fetchone()
            if not ticket:
                return response(404, {'error': 'Заявка не найдена'})
            if ticket['assigned_to'] != user_id:
                return response(403, {'error': 'Только исполнитель может отправить заявку на подтверждение'})

            cur.execute(f"SELECT id FROM {SCHEMA}.ticket_statuses WHERE is_pending_confirmation = TRUE LIMIT 1")
            pending_status = cur.fetchone()
            if not pending_status:
                return response(500, {'error': 'Статус "Ожидает подтверждения" не настроен'})

            cur.execute(f"""
                UPDATE {SCHEMA}.tickets
                SET status_id = %s, confirmation_sent_at = NOW(), updated_at = NOW()
                WHERE id = %s
            """, (pending_status['id'], ticket_id))

            cur.execute(
                f"SELECT id, name FROM {SCHEMA}.ticket_statuses WHERE id = ANY(%s)",
                ([ticket['status_id'], pending_status['id']],),
            )
            _names = {r['id']: r['name'] for r in cur.fetchall()}
            _old_name = _names.get(ticket['status_id']) or str(ticket['status_id'])
            _new_name = _names.get(pending_status['id']) or str(pending_status['id'])
            cur.execute(f"""
                INSERT INTO {SCHEMA}.ticket_history (ticket_id, user_id, field_name, old_value, new_value, created_at)
                VALUES (%s, %s, 'status_id', %s, %s, NOW())
            """, (ticket_id, user_id, _old_name, _new_name))

            conn.commit()
            return response(200, {'message': 'Заявка отправлена на подтверждение заказчику'})

        elif method == 'PUT':
            body = json.loads(event.get('body', '{}'))
            ticket_id = body.get('ticket_id')
            action = body.get('action')
            rating = body.get('rating')
            rejection_reason = body.get('rejection_reason', '')

            if not ticket_id or action not in ('confirm', 'reject'):
                return response(400, {'error': 'ticket_id и action (confirm/reject) обязательны'})

            cur.execute(f"SELECT id, created_by, status_id FROM {SCHEMA}.tickets WHERE id = %s", (ticket_id,))
            ticket = cur.fetchone()
            if not ticket:
                return response(404, {'error': 'Заявка не найдена'})
            if ticket['created_by'] != user_id:
                return response(403, {'error': 'Только заказчик может подтвердить или отклонить заявку'})

            cur.execute(f"SELECT is_pending_confirmation FROM {SCHEMA}.ticket_statuses WHERE id = %s", (ticket['status_id'],))
            current_status = cur.fetchone()
            if not current_status or not current_status['is_pending_confirmation']:
                return response(400, {'error': 'Заявка не находится в статусе ожидания подтверждения'})

            if action == 'confirm':
                if not rating or int(rating) not in range(1, 6):
                    return response(400, {'error': 'Оценка от 1 до 5 обязательна при подтверждении'})

                cur.execute(f"SELECT id FROM {SCHEMA}.ticket_statuses WHERE is_closed = TRUE LIMIT 1")
                closed_status = cur.fetchone()
                if not closed_status:
                    return response(500, {'error': 'Закрытый статус не найден'})

                cur.execute(f"""
                    UPDATE {SCHEMA}.tickets
                    SET status_id = %s, rating = %s, rejection_reason = NULL, updated_at = NOW()
                    WHERE id = %s
                """, (closed_status['id'], int(rating), ticket_id))

                cur.execute(
                    f"SELECT id, name FROM {SCHEMA}.ticket_statuses WHERE id = ANY(%s)",
                    ([ticket['status_id'], closed_status['id']],),
                )
                _names = {r['id']: r['name'] for r in cur.fetchall()}
                _old_name = _names.get(ticket['status_id']) or str(ticket['status_id'])
                _new_name = _names.get(closed_status['id']) or str(closed_status['id'])
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.ticket_history (ticket_id, user_id, field_name, old_value, new_value, created_at)
                    VALUES (%s, %s, 'status_id', %s, %s, NOW())
                """, (ticket_id, user_id, _old_name, _new_name))

                conn.commit()
                return response(200, {'message': 'Заявка подтверждена и закрыта', 'rating': int(rating)})

            else:
                if not rejection_reason.strip():
                    return response(400, {'error': 'Причина отклонения обязательна'})

                cur.execute(f"SELECT id FROM {SCHEMA}.ticket_statuses WHERE is_reopened = TRUE LIMIT 1")
                open_status = cur.fetchone()
                if not open_status:
                    cur.execute(f"SELECT id FROM {SCHEMA}.ticket_statuses WHERE is_open = TRUE LIMIT 1")
                    open_status = cur.fetchone()
                if not open_status:
                    return response(500, {'error': 'Статус для переоткрытой заявки не найден'})

                cur.execute(f"""
                    UPDATE {SCHEMA}.tickets
                    SET status_id = %s, rejection_reason = %s, confirmation_sent_at = NULL, updated_at = NOW()
                    WHERE id = %s
                """, (open_status['id'], rejection_reason.strip(), ticket_id))

                cur.execute(
                    f"SELECT id, name FROM {SCHEMA}.ticket_statuses WHERE id = ANY(%s)",
                    ([ticket['status_id'], open_status['id']],),
                )
                _names = {r['id']: r['name'] for r in cur.fetchall()}
                _old_name = _names.get(ticket['status_id']) or str(ticket['status_id'])
                _new_name = _names.get(open_status['id']) or str(open_status['id'])
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.ticket_history (ticket_id, user_id, field_name, old_value, new_value, created_at)
                    VALUES (%s, %s, 'status_id', %s, %s, NOW())
                """, (ticket_id, user_id, _old_name, _new_name))

                conn.commit()
                return response(200, {'message': 'Заявка возвращена в работу'})

        return response(405, {'error': 'Метод не поддерживается'})

    finally:
        cur.close()


def handle_ticket_watchers(method: str, event: dict, conn) -> dict:
    """Управление наблюдателями заявки (добавление, удаление, просмотр)"""
    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})

    user_id = payload.get('user_id')
    cur = conn.cursor()

    try:
        if method == 'GET':
            query_params = event.get('queryStringParameters', {}) or {}
            ticket_id = query_params.get('ticket_id')
            if not ticket_id:
                return response(400, {'error': 'ticket_id обязателен'})

            cur.execute(f"""
                SELECT tw.id, tw.user_id, tw.added_at,
                       u.full_name, u.username as email, u.photo_url
                FROM {SCHEMA}.ticket_watchers tw
                JOIN {SCHEMA}.users u ON tw.user_id = u.id
                WHERE tw.ticket_id = %s
                ORDER BY tw.added_at
            """, (int(ticket_id),))
            watchers = [dict(row) for row in cur.fetchall()]
            return response(200, {'watchers': watchers})

        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            ticket_id = body.get('ticket_id')
            watcher_user_id = body.get('user_id')
            if not ticket_id or not watcher_user_id:
                return response(400, {'error': 'ticket_id и user_id обязательны'})

            cur.execute(f"SELECT id FROM {SCHEMA}.tickets WHERE id = %s", (ticket_id,))
            if not cur.fetchone():
                return response(404, {'error': 'Заявка не найдена'})

            cur.execute(f"""
                INSERT INTO {SCHEMA}.ticket_watchers (ticket_id, user_id, added_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (ticket_id, user_id) DO NOTHING
                RETURNING id
            """, (ticket_id, watcher_user_id))
            inserted_row = cur.fetchone()
            really_inserted = bool(inserted_row)

            # Запись в историю заявки (только если реально добавили нового)
            if really_inserted:
                cur.execute(f"SELECT full_name FROM {SCHEMA}.users WHERE id = %s", (watcher_user_id,))
                _wn = cur.fetchone()
                watcher_name = _wn['full_name'] if _wn else str(watcher_user_id)
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.ticket_history
                    (ticket_id, user_id, field_name, old_value, new_value, is_internal, created_at)
                    VALUES (%s, %s, 'watcher_added', NULL, %s, false, NOW())
                """, (ticket_id, user_id, watcher_name))

            conn.commit()

            # Уведомление новому наблюдателю
            cur.execute(f"SELECT title FROM {SCHEMA}.tickets WHERE id = %s", (ticket_id,))
            ticket_row = cur.fetchone()
            if ticket_row:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.notifications (user_id, ticket_id, type, message, is_read, created_at)
                    VALUES (%s, %s, 'watcher_added', %s, false, NOW())
                """, (watcher_user_id, ticket_id, f'Вы добавлены как наблюдатель к заявке: {ticket_row["title"]}'))
                conn.commit()

            # Уведомление в Битрикс-бот (только если реально добавили нового, не сами себя)
            if really_inserted and int(watcher_user_id) != int(payload.get('user_id') or 0):
                try:
                    from bitrix_bot_notifier import notify_watcher_added
                    headers = event.get('headers') or {}
                    app_origin = headers.get('Origin') or headers.get('origin') or ''
                    notify_watcher_added(
                        cur, SCHEMA, int(ticket_id), int(watcher_user_id),
                        actor_user_id=int(payload.get('user_id') or 0),
                        app_origin=app_origin,
                    )
                except Exception as bot_err:
                    print(f"[bitrix-bot] watcher_added notification failed: {bot_err}")

                # Уведомление в MAX-бот
                try:
                    headers = event.get('headers') or {}
                    app_origin = headers.get('Origin') or headers.get('origin') or ''
                    max_notify_watcher_added(
                        cur, SCHEMA, int(ticket_id), int(watcher_user_id),
                        actor_user_id=int(payload.get('user_id') or 0),
                        app_origin=app_origin,
                    )
                except Exception as bot_err:
                    print(f"[max-bot] watcher_added notification failed: {bot_err}")

            cur.execute(f"""
                SELECT tw.id, tw.user_id, tw.added_at,
                       u.full_name, u.username as email, u.photo_url
                FROM {SCHEMA}.ticket_watchers tw
                JOIN {SCHEMA}.users u ON tw.user_id = u.id
                WHERE tw.ticket_id = %s
                ORDER BY tw.added_at
            """, (ticket_id,))
            watchers = [dict(row) for row in cur.fetchall()]
            return response(201, {'watchers': watchers})

        elif method == 'DELETE':
            body = json.loads(event.get('body', '{}'))
            ticket_id = body.get('ticket_id')
            watcher_user_id = body.get('user_id')
            if not ticket_id or not watcher_user_id:
                return response(400, {'error': 'ticket_id и user_id обязательны'})

            cur.execute(f"""
                DELETE FROM {SCHEMA}.ticket_watchers
                WHERE ticket_id = %s AND user_id = %s
            """, (ticket_id, watcher_user_id))
            really_deleted = cur.rowcount > 0

            # Запись в историю заявки (только если реально удалили)
            if really_deleted:
                cur.execute(f"SELECT full_name FROM {SCHEMA}.users WHERE id = %s", (watcher_user_id,))
                _wn = cur.fetchone()
                watcher_name = _wn['full_name'] if _wn else str(watcher_user_id)
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.ticket_history
                    (ticket_id, user_id, field_name, old_value, new_value, is_internal, created_at)
                    VALUES (%s, %s, 'watcher_removed', %s, NULL, false, NOW())
                """, (ticket_id, user_id, watcher_name))

            conn.commit()
            return response(200, {'success': True})

        return response(405, {'error': 'Метод не поддерживается'})

    finally:
        cur.close()


def handle_tickets_bootstrap(method: str, event: dict, conn) -> dict:
    """Объединённая стартовая загрузка страницы «Мои заявки» одним вызовом.

    За один поход в БД (одно соединение) возвращает всё для первого рендера,
    чтобы фронт не слал ~6 параллельных запросов и не упирался в rate-limit БД.

    Возвращает: tickets (список с пагинацией), dictionaries (категории,
    приоритеты, статусы, отделы, доп. поля), ticket_services,
    hidden_count, needs_my_reply_count.

    Параметры запроса — те же, что у endpoint=tickets (page, limit, sort_by,
    sort_dir, фильтры, is_archived, hide_waiting и т.д.).
    """
    if method != 'GET':
        return response(405, {'error': 'Only GET method allowed'})

    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})

    base_params = event.get('queryStringParameters', {}) or {}

    def _call(handler_fn, extra_params=None):
        ev = dict(event)
        ev['queryStringParameters'] = {**base_params, **(extra_params or {})}
        try:
            return handler_fn('GET', ev, conn)
        except Exception as e:
            # Второстепенный запрос упал (например, rate limit БД) — не роняем
            # весь bootstrap в 502. Откатываем транзакцию, чтобы соединение
            # осталось рабочим для следующих запросов, и отдаём заглушку.
            try:
                conn.rollback()
            except Exception:
                pass
            print(f"[TICKETS] bootstrap sub-call failed: {e}")
            return response(500, {'error': 'sub-call failed'})

    def _parse(resp, default):
        if resp.get('statusCode') == 200:
            try:
                return json.loads(resp.get('body') or 'null')
            except (json.JSONDecodeError, TypeError):
                return default
        return default

    # 1. Основной список заявок (с текущими фильтрами/сортировкой)
    tickets_resp = _call(handle_tickets)
    if tickets_resp.get('statusCode') in (401, 403):
        return tickets_resp
    tickets_data = _parse(tickets_resp, {'tickets': [], 'total': 0, 'pages': 1})

    # 2. Справочники
    dictionaries = _parse(_call(handle_ticket_dictionaries), {})

    # 3. Услуги заявок
    ticket_services = _parse(_call(handle_ticket_services), [])

    # 4. Счётчики: скрытые и «нужен мой ответ» (limit=1, берём только total)
    hidden_resp = _call(handle_tickets, {'page': '1', 'limit': '1', 'is_hidden': 'true'})
    hidden_count = _parse(hidden_resp, {}).get('total', 0)

    reply_resp = _call(handle_tickets, {'page': '1', 'limit': '1', 'needs_my_reply': 'true'})
    needs_my_reply_count = _parse(reply_resp, {}).get('total', 0)

    # 5. Есть ли у пользователя подчинённые (отделы или конкретные сотрудники)
    has_subordinates = False
    try:
        cur = conn.cursor()
        cur.execute(f"""
            SELECT EXISTS (
                SELECT 1 FROM {SCHEMA}.user_subordinates WHERE user_id = %s
                UNION ALL
                SELECT 1 FROM {SCHEMA}.user_subordinate_departments WHERE user_id = %s
            ) AS has_subs
        """, (payload.get('user_id'), payload.get('user_id')))
        row = cur.fetchone()
        has_subordinates = bool(row['has_subs']) if row else False
        cur.close()
    except Exception:
        has_subordinates = False

    return response(200, {
        'tickets': tickets_data,
        'dictionaries': dictionaries,
        'ticket_services': ticket_services,
        'hidden_count': hidden_count,
        'needs_my_reply_count': needs_my_reply_count,
        'has_subordinates': has_subordinates,
    })


def handle_tickets_full(method: str, event: dict, conn) -> dict:
    """Объединённая загрузка данных заявки одним вызовом.

    Возвращает: ticket, history, approvals, comments, participant_ids, my_last_seen_at
    — за один поход в БД, чтобы снизить нагрузку и количество параллельных
    запросов от фронта (защищает от rate-limit PostgreSQL).

    Параметры:
      ticket_id (обязателен) — id заявки
      include_comments (опционально, default=true) — выключатель для лёгкого режима
    """
    if method != 'GET':
        return response(405, {'error': 'Only GET method allowed'})

    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})

    params = event.get('queryStringParameters', {}) or {}
    ticket_id_raw = params.get('ticket_id')
    if not ticket_id_raw:
        return response(400, {'error': 'ticket_id parameter required'})

    try:
        ticket_id = int(ticket_id_raw)
    except (TypeError, ValueError):
        return response(400, {'error': 'ticket_id must be integer'})

    include_comments_raw = (params.get('include_comments') or 'true').lower()
    include_comments = include_comments_raw not in ('false', '0', 'no')

    user_id = payload.get('user_id')

    ticket_data = None
    history: list = []
    approvals: list = []
    comments: list = []
    participant_ids: list = []
    my_last_seen_at = None

    try:
        ticket_event = dict(event)
        ticket_event['queryStringParameters'] = {
            **(event.get('queryStringParameters') or {}),
            'ticket_id': str(ticket_id),
        }
        tickets_resp = handle_tickets('GET', ticket_event, conn)
        if tickets_resp.get('statusCode') == 200:
            try:
                body = json.loads(tickets_resp.get('body') or '{}')
                tickets_list = body.get('tickets') or []
                if tickets_list:
                    ticket_data = tickets_list[0]
            except (json.JSONDecodeError, TypeError):
                ticket_data = None
        elif tickets_resp.get('statusCode') in (401, 403, 404):
            return tickets_resp

        approvals_resp = handle_ticket_approvals('GET', ticket_event, conn)
        if approvals_resp.get('statusCode') == 200:
            try:
                approvals = json.loads(approvals_resp.get('body') or '[]') or []
            except (json.JSONDecodeError, TypeError):
                approvals = []

        cur = conn.cursor()
        try:
            # Скрытые (внутренние) события истории видят только Администратор и Исполнитель
            history_internal_filter = '' if _can_see_internal(cur, user_id) else 'AND th.is_internal = false'

            # История изменений
            cur.execute(f"""
                SELECT th.id, th.ticket_id, th.user_id, th.field_name,
                       th.old_value, th.new_value, th.created_at,
                       u.username as user_name, u.full_name as user_full_name
                FROM {SCHEMA}.ticket_history th
                LEFT JOIN {SCHEMA}.users u ON th.user_id = u.id
                WHERE th.ticket_id = %s {history_internal_filter}
                ORDER BY th.created_at DESC
            """, (ticket_id,))
            history = [dict(row) for row in cur.fetchall()]

            # Комментарии (облегчённый формат, без read_by/read_by_users —
            # эти данные не критичны для рендера переписки и догружаются
            # отдельным запросом при необходимости)
            if include_comments:
                cur.execute(f"""
                    SELECT 
                        tc.id, tc.ticket_id, tc.user_id, tc.comment,
                        tc.is_internal, tc.created_at,
                        tc.is_pinned, tc.pinned_at, tc.pinned_by,
                        tc.edited_at, tc.edited_by,
                        u.username as user_name,
                        u.full_name as user_full_name,
                        u.photo_url as user_photo_url
                    FROM {SCHEMA}.ticket_comments tc
                    LEFT JOIN {SCHEMA}.users u ON tc.user_id = u.id
                    WHERE tc.ticket_id = %s
                    ORDER BY tc.created_at DESC
                """, (ticket_id,))
                comments = [dict(row) for row in cur.fetchall()]

                # Скрытые (внутренние) комментарии видят только Администратор и Исполнитель
                if not _can_see_internal(cur, user_id):
                    comments = [c for c in comments if not c.get('is_internal')]

                # Вырезаем тяжёлые inline base64-картинки, помечая флагом
                for c in comments:
                    original = c.get('comment') or ''
                    if 'base64,' in original:
                        stripped = _strip_heavy_inline_images(original, c['id'])
                        if stripped != original:
                            c['comment'] = stripped
                            c['has_inline_images'] = True

                comment_ids = [c['id'] for c in comments]
                if comment_ids:
                    ids_csv = ','.join(str(int(i)) for i in comment_ids)
                    attachments_map: Dict[int, List[Dict[str, Any]]] = {cid: [] for cid in comment_ids}
                    cur.execute(f"""
                        SELECT id, comment_id, filename, url, size
                        FROM {SCHEMA}.comment_attachments
                        WHERE comment_id IN ({ids_csv})
                        ORDER BY id ASC
                    """)
                    for r in cur.fetchall():
                        attachments_map.setdefault(r['comment_id'], []).append({
                            'id': r['id'],
                            'filename': r['filename'],
                            'url': r['url'],
                            'size': r['size'],
                        })
                    for c in comments:
                        c['attachments'] = attachments_map.get(c['id'], [])
                else:
                    for c in comments:
                        c['attachments'] = []

                # participant_ids
                pids: Set[int] = set()
                if ticket_data:
                    if ticket_data.get('created_by'):
                        pids.add(ticket_data['created_by'])
                    if ticket_data.get('assigned_to'):
                        pids.add(ticket_data['assigned_to'])
                cur.execute(f"SELECT user_id FROM {SCHEMA}.ticket_watchers WHERE ticket_id = %s", (ticket_id,))
                pids.update(r['user_id'] for r in cur.fetchall())
                cur.execute(f"SELECT approver_id FROM {SCHEMA}.ticket_approvers WHERE ticket_id = %s", (ticket_id,))
                pids.update(r['approver_id'] for r in cur.fetchall())
                participant_ids = sorted(pids)

                # my_last_seen_at
                if user_id:
                    cur.execute(f"""
                        SELECT last_seen_at FROM {SCHEMA}.ticket_views
                        WHERE user_id = %s AND ticket_id = %s
                    """, (user_id, ticket_id))
                    row = cur.fetchone()
                    if row and row.get('last_seen_at'):
                        my_last_seen_at = row['last_seen_at'].isoformat()
        finally:
            cur.close()
    except Exception as e:
        return response(500, {'error': f'tickets-full failed: {str(e)}'})

    return response(200, {
        'ticket': ticket_data,
        'history': history,
        'approvals': approvals,
        'comments': comments,
        'participant_ids': participant_ids,
        'my_last_seen_at': my_last_seen_at,
    })