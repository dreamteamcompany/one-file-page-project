"""Аналитика обращений по факту вопроса: линии → сервисы → типы вопросов"""
from typing import Dict, Any, List
from datetime import date, datetime, timedelta, time as dt_time
from shared_utils import response, verify_token, SCHEMA

# Состав отделов (id пользователей) — по факту работы, а не по справочнику групп.
LINE_MEMBERS: Dict[str, List[int]] = {
    '1-я линия': [3, 4, 20, 393, 381],
    '2-я линия ТП': [5],
    'Отдел Ильи': [68, 70, 67, 69, 383, 66, 65],
    'Отдел МИС': [14, 13, 208],
}

LINE_ORDER = ['1-я линия', '2-я линия ТП', 'Отдел Ильи', 'Отдел МИС',
              'Прочие исполнители', 'Исполнитель не назначен']

SERVICE_CASE = """
CASE
  WHEN x ~ '(^|[^а-яёa-z])мис([^а-яёa-z]|$)|план лечения|журнал запис|наряд.?заказ|запис. на прием|резервирован' THEN 'МИС'
  WHEN x ~ 'битрикс|bitrix|воронк|(^|[^а-яёa-z])лид|сделк|стади' THEN 'Битрикс / CRM'
  WHEN x ~ 'телефон|звонк|дозвон|ватс|whatsapp|вазап|этикетк|заспамлен|рассылк|(^|[^а-яёa-z])смс|sms|номер' THEN 'Телефония и рассылки'
  WHEN x ~ '(^|[^а-яёa-z])зуп|(^|[^а-яёa-z])бух|1с|ncalayer|документооборот' THEN '1С / Бухгалтерия / ЗУП'
  WHEN x ~ 'vpn|впн|удаленк|удал.нн|уд\\.стол|интернет|wi-?fi|сетев.* папк' THEN 'VPN / сеть / удалёнка'
  WHEN x ~ 'серв[ае]р|терминал|хостинг|виртуалк' THEN 'Серверы и инфраструктура'
  WHEN x ~ 'сайт|домен|tilda|тильда|антифрод|капча' THEN 'Сайты и домены'
  WHEN x ~ 'чат.?бот|(^|[^а-яёa-z])бот|n8n|автоматизаци|hr-?партн' THEN 'Боты и автоматизации'
  WHEN x ~ 'почт|email|e-mail' THEN 'Почта'
  WHEN x ~ 'принтер|печат|сканер|картридж|монитор|компьютер|ноутбук|оборудован|касс' THEN 'Оборудование'
  ELSE 'Сервис не определён'
END
"""

ISSUE_CASE = """
CASE
  WHEN x ~ 'заблокир|увольн|уволен|удалит. (сотрудник|польз)|удалить польз|отключит. доступ' THEN 'Блокировка при увольнении'
  WHEN x ~ 'не могу (войти|зайти)|не получается (войти|зайти)|ошибка (при )?вход|не заходит|выкинуло|заблокирована учет|разблок|забыл. пароль|сброс.* пароль|смен.* пароль|восстановить доступ' THEN 'Вход и пароли'
  WHEN x ~ 'прав[аоы]|доступ|учетн|учетк|аккаунт|создать польз|создать учет|логин' THEN 'Доступы и права'
  WHEN x ~ 'не работает|ошибк|не открывается|не проводятся|не подтягива|виснет|вис[ня]|непредвиденная|сбой|не приходят|не формир' THEN 'Ошибки и сбои'
  WHEN x ~ 'настро|добавить|измен|поменя|обнов|установ|создать|подключ' THEN 'Настройка и доработки'
  ELSE 'Другое'
END
"""


def _month_bounds(month: str) -> tuple:
    year, mon = int(month[:4]), int(month[5:7])
    start = date(year, mon, 1)
    end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
    return start.isoformat(), end.isoformat()


def _line_case() -> str:
    parts = []
    for line, ids in LINE_MEMBERS.items():
        ids_str = ','.join(str(int(i)) for i in ids)
        parts.append(f"WHEN assigned_to IN ({ids_str}) THEN '{line}'")
    return ('CASE ' + ' '.join(parts) +
            " WHEN assigned_to IS NULL THEN 'Исполнитель не назначен'"
            " ELSE 'Прочие исполнители' END")


WEEKS_MONTH = '2026-08'
RU_MONTHS_GEN = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн',
                 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']


def _weeks_rows(conn, month: str) -> List[Dict[str, Any]]:
    """Недельная нагрузка: сколько заявок было в работе и сколько из них новых."""
    start, end = _month_bounds(month)
    ids = ','.join(str(int(i)) for line in LINE_MEMBERS.values() for i in line)
    cur = conn.cursor()
    cur.execute(f"""
        SELECT w.ws AS w_start,
               (w.we - 1) AS w_end,
               COUNT(*) FILTER (WHERE t.created_at >= w.ws) AS created,
               COUNT(*) AS active
        FROM (
            SELECT gs::date AS ws,
                   LEAST((gs + INTERVAL '7 days')::date, %s::date) AS we
            FROM generate_series(
                %s::date, (%s::date - 1), INTERVAL '7 days'
            ) gs
        ) w
        JOIN {SCHEMA}.tickets t
          ON t.created_at < w.we
         AND t.assigned_to IN ({ids})
        LEFT JOIN (
            SELECT ticket_id, MAX(created_at) AS done_at
            FROM {SCHEMA}.ticket_history
            WHERE field_name = 'status_id' AND new_value IN ('Решена', 'Отменена')
            GROUP BY ticket_id
        ) d ON d.ticket_id = t.id
        WHERE d.done_at IS NULL OR d.done_at >= w.ws
        GROUP BY 1, 2
        ORDER BY 1
    """, (end, start, end))

    weeks = []
    for r in cur.fetchall():
        a, b = r['w_start'], r['w_end']
        label = f"{a.day}–{b.day} {RU_MONTHS_GEN[b.month - 1]}"
        created, active = int(r['created']), int(r['active'])
        weeks.append({'label': label, 'count': active, 'created': created,
                      'carried': active - created, 'days': (b - a).days + 1})
    return weeks


# ---- Среднее время первого ответа с учётом рабочего времени ----

# Если у исполнителя не заведён график — считаем 07:00-16:00 все семь дней:
# поддержка работает и в выходные, обнулять их было бы занижением.
DEFAULT_SCHEDULE = {d: [(7 * 60, 16 * 60)] for d in range(7)}


def _load_schedules(conn) -> Dict[int, Dict[int, List[tuple]]]:
    """График работы по каждому исполнителю: день недели -> интервалы в минутах."""
    cur = conn.cursor()
    cur.execute(f"""
        SELECT user_id, day_of_week, start_time, end_time
        FROM {SCHEMA}.work_schedules
        WHERE is_active = true
        ORDER BY user_id, day_of_week, start_time
    """)
    out: Dict[int, Dict[int, List[tuple]]] = {}
    for r in cur.fetchall():
        st, en = r['start_time'], r['end_time']
        a = st.hour * 60 + st.minute
        b = en.hour * 60 + en.minute
        if b <= a:
            continue
        out.setdefault(int(r['user_id']), {}).setdefault(int(r['day_of_week']), []).append((a, b))
    return out


def _business_minutes(start, end, sched: Dict[int, List[tuple]]) -> float:
    """Минуты между двумя моментами, попавшие в рабочие часы исполнителя."""
    if end <= start:
        return 0.0
    total = 0.0
    day = start.date()
    last_day = end.date()
    guard = 0
    while day <= last_day and guard < 400:
        guard += 1
        for a, b in sched.get(day.weekday(), []):
            w_start = datetime.combine(day, dt_time(a // 60, a % 60))
            w_end = datetime.combine(day, dt_time(b // 60, b % 60))
            lo = max(w_start, start)
            hi = min(w_end, end)
            if hi > lo:
                total += (hi - lo).total_seconds() / 60
        day += timedelta(days=1)
    return total


def _first_response_rows(conn, month: str) -> Dict[str, Any]:
    """Время первого ответа сотрудника по неделям месяца, в рабочих минутах."""
    start, end = _month_bounds(month)
    ids = ','.join(str(int(i)) for line in LINE_MEMBERS.values() for i in line)
    cur = conn.cursor()
    cur.execute(f"""
        SELECT t.id, t.created_at, t.assigned_to,
               MIN(c.created_at) FILTER (
                   WHERE c.user_id <> t.created_by
                     AND COALESCE(c.is_internal, false) = false
               ) AS first_reply
        FROM {SCHEMA}.tickets t
        LEFT JOIN {SCHEMA}.ticket_comments c
               ON c.ticket_id = t.id AND c.created_at >= t.created_at
        WHERE t.created_at >= %s AND t.created_at < %s
          AND t.assigned_to IN ({ids})
        GROUP BY t.id, t.created_at, t.assigned_to
    """, (start, end))
    rows = cur.fetchall()

    schedules = _load_schedules(conn)
    buckets: Dict[int, List[float]] = {}
    no_reply = 0

    for r in rows:
        if not r['first_reply']:
            no_reply += 1
            continue
        sched = schedules.get(int(r['assigned_to'])) or DEFAULT_SCHEDULE
        mins = _business_minutes(r['created_at'], r['first_reply'], sched)
        wk = min((r['created_at'].day - 1) // 7 + 1, 5)
        buckets.setdefault(wk, []).append(mins)

    weeks = []
    for wk in sorted(buckets):
        vals = sorted(buckets[wk])
        n = len(vals)
        mid = n // 2
        median = vals[mid] if n % 2 else (vals[mid - 1] + vals[mid]) / 2
        d1 = (wk - 1) * 7 + 1
        d2 = min(d1 + 6, (date.fromisoformat(end) - timedelta(days=1)).day)
        weeks.append({
            'label': f"{d1}–{d2} {RU_MONTHS_GEN[int(month[5:7]) - 1]}",
            'avgMinutes': round(sum(vals) / n, 1),
            'medianMinutes': round(median, 1),
            'count': n,
        })

    replied = [m for v in buckets.values() for m in v]
    avg_all = round(sum(replied) / len(replied), 1) if replied else 0
    return {'weeks': weeks, 'avgMinutes': avg_all,
            'answered': len(replied), 'noReply': no_reply}


# ---- Время решения и причины долгого закрытия ----

DONE_STATUSES_PLAIN = ['Решена', 'Отменена']
DONE_STATUSES = tuple(f"'{s}'" for s in DONE_STATUSES_PLAIN)

# Кто держит заявку в каждом статусе: мы или пользователь.
OUR_STATUSES = ['В работе', 'Новая', 'Открыта повторно', 'На согласовании']
CLIENT_STATUSES = ['Ожидает подтверждения', 'Ожидает ответа']
PAUSE_STATUSES = ['Приостановлена']


def _resolution_rows(conn, month: str) -> Dict[str, Any]:
    """Время от создания до решения по неделям месяца, в часах."""
    start, end = _month_bounds(month)
    ids = ','.join(str(int(i)) for line in LINE_MEMBERS.values() for i in line)
    done = ', '.join(DONE_STATUSES)
    cur = conn.cursor()
    cur.execute(f"""
        SELECT t.id, t.created_at, t.assigned_to,
               MIN(h.created_at) FILTER (
                   WHERE h.field_name = 'status_id' AND h.new_value IN ({done})
               ) AS solved_at
        FROM {SCHEMA}.tickets t
        LEFT JOIN {SCHEMA}.ticket_history h ON h.ticket_id = t.id
        WHERE t.created_at >= %s AND t.created_at < %s
          AND t.assigned_to IN ({ids})
        GROUP BY t.id, t.created_at, t.assigned_to
    """, (start, end))
    rows = cur.fetchall()

    schedules = _load_schedules(conn)
    buckets: Dict[int, List[tuple]] = {}
    totals: Dict[int, int] = {}
    for r in rows:
        wk = min((r['created_at'].day - 1) // 7 + 1, 5)
        totals[wk] = totals.get(wk, 0) + 1
        if not r['solved_at'] or r['solved_at'] < r['created_at']:
            continue
        cal = (r['solved_at'] - r['created_at']).total_seconds() / 3600
        sched = schedules.get(int(r['assigned_to'])) or DEFAULT_SCHEDULE
        work = _business_minutes(r['created_at'], r['solved_at'], sched) / 60
        buckets.setdefault(wk, []).append((cal, work))

    last_day = (date.fromisoformat(end) - timedelta(days=1)).day
    mon_name = RU_MONTHS_GEN[int(month[5:7]) - 1]
    weeks, all_cal, all_work = [], [], []
    for wk in sorted(totals):
        vals = buckets.get(wk) or []
        n = len(vals)
        if not n:
            continue
        cal = sorted(v[0] for v in vals)
        work = sorted(v[1] for v in vals)
        mid = n // 2
        med_cal = cal[mid] if n % 2 else (cal[mid - 1] + cal[mid]) / 2
        med_work = work[mid] if n % 2 else (work[mid - 1] + work[mid]) / 2
        d1 = (wk - 1) * 7 + 1
        weeks.append({'label': f"{d1}–{min(d1 + 6, last_day)} {mon_name}",
                      'avgHours': round(sum(cal) / n, 1),
                      'medianHours': round(med_cal, 1),
                      'avgWorkHours': round(sum(work) / n, 1),
                      'medianWorkHours': round(med_work, 1),
                      'count': n,
                      'total': totals.get(wk, n),
                      'pending': max(totals.get(wk, n) - n, 0)})
        all_cal += cal
        all_work += work

    n = len(all_cal)
    total_all = sum(totals.values())
    return {'weeks': weeks, 'count': n, 'total': total_all,
            'pending': max(total_all - n, 0),
            'avgHours': round(sum(all_cal) / n, 1) if n else 0,
            'avgWorkHours': round(sum(all_work) / n, 1) if n else 0}


def _rating_rows(conn, month: str) -> Dict[str, Any]:
    """Средняя оценка пользователей и распределение по звёздам."""
    start, end = _month_bounds(month)
    ids = ','.join(str(int(i)) for line in LINE_MEMBERS.values() for i in line)
    cur = conn.cursor()
    cur.execute(f"""
        SELECT COUNT(*) AS total,
               COUNT(rating) AS rated,
               ROUND(AVG(rating)::numeric, 2) AS avg_rating
        FROM {SCHEMA}.tickets
        WHERE created_at >= %s AND created_at < %s
          AND assigned_to IN ({ids})
    """, (start, end))
    head = cur.fetchone()

    cur.execute(f"""
        SELECT rating, COUNT(*) AS n
        FROM {SCHEMA}.tickets
        WHERE created_at >= %s AND created_at < %s
          AND assigned_to IN ({ids}) AND rating IS NOT NULL
        GROUP BY rating
    """, (start, end))
    by_star = {int(r['rating']): int(r['n']) for r in cur.fetchall()}

    rated = int(head['rated'] or 0)
    total = int(head['total'] or 0)
    dist = [{'stars': s, 'count': by_star.get(s, 0),
             'share': round(by_star.get(s, 0) / rated * 100, 1) if rated else 0}
            for s in range(5, 0, -1)]
    low = sum(by_star.get(s, 0) for s in (1, 2))

    return {'avg': float(head['avg_rating'] or 0), 'rated': rated, 'total': total,
            'coverage': round(rated / total * 100, 1) if total else 0,
            'low': low, 'distribution': dist}


def _reopened_rows(conn, month: str) -> Dict[str, Any]:
    """Заявки, которые пришлось открывать повторно, по неделям месяца."""
    start, end = _month_bounds(month)
    ids = ','.join(str(int(i)) for line in LINE_MEMBERS.values() for i in line)
    cur = conn.cursor()
    cur.execute(f"""
        SELECT LEAST((EXTRACT(DAY FROM t.created_at)::int - 1) / 7 + 1, 5) AS wk,
               COUNT(DISTINCT t.id) FILTER (WHERE r.ticket_id IS NOT NULL) AS reopened,
               COUNT(DISTINCT t.id) FILTER (WHERE d.ticket_id IS NOT NULL) AS total
        FROM {SCHEMA}.tickets t
        LEFT JOIN (
            SELECT DISTINCT ticket_id
            FROM {SCHEMA}.ticket_history
            WHERE field_name = 'status_id' AND new_value = 'Открыта повторно'
        ) r ON r.ticket_id = t.id
        LEFT JOIN (
            SELECT DISTINCT ticket_id
            FROM {SCHEMA}.ticket_history
            WHERE field_name = 'status_id' AND new_value IN ('Решена', 'Отменена')
        ) d ON d.ticket_id = t.id
        WHERE t.created_at >= %s AND t.created_at < %s
          AND t.assigned_to IN ({ids})
        GROUP BY wk
        ORDER BY wk
    """, (start, end))

    last_day = (date.fromisoformat(end) - timedelta(days=1)).day
    mon_name = RU_MONTHS_GEN[int(month[5:7]) - 1]
    weeks, tot_re, tot_all = [], 0, 0
    for r in cur.fetchall():
        wk, re_n, all_n = int(r['wk']), int(r['reopened']), int(r['total'])
        d1 = (wk - 1) * 7 + 1
        weeks.append({'label': f"{d1}–{min(d1 + 6, last_day)} {mon_name}",
                      'count': re_n, 'total': all_n,
                      'share': round(re_n / all_n * 100, 1) if all_n else 0})
        tot_re += re_n
        tot_all += all_n

    cur.execute(f"""
        SELECT COUNT(*) AS events
        FROM {SCHEMA}.ticket_history h
        JOIN {SCHEMA}.tickets t ON t.id = h.ticket_id
        WHERE h.field_name = 'status_id' AND h.new_value = 'Открыта повторно'
          AND t.created_at >= %s AND t.created_at < %s
          AND t.assigned_to IN ({ids})
    """, (start, end))
    events = int(cur.fetchone()['events'] or 0)

    return {'weeks': weeks, 'count': tot_re, 'total': tot_all, 'events': events,
            'share': round(tot_re / tot_all * 100, 1) if tot_all else 0}


def _delay_reasons(conn, month: str) -> Dict[str, Any]:
    """Чей ход: сколько пользователь ждёт нас, а мы — пользователя."""
    start, end = _month_bounds(month)
    ids = ','.join(str(int(i)) for line in LINE_MEMBERS.values() for i in line)
    staff = set(int(i) for line in LINE_MEMBERS.values() for i in line)
    cur = conn.cursor()

    cur.execute(f"""
        SELECT t.id, t.created_by, t.assigned_to, t.created_at,
               COALESCE(t.closed_at, d.done_at) AS closed_at,
               c.user_id, c.created_at AS at
        FROM {SCHEMA}.tickets t
        LEFT JOIN (
            SELECT ticket_id, MAX(created_at) AS done_at
            FROM {SCHEMA}.ticket_history
            WHERE field_name = 'status_id' AND new_value IN ('Решена', 'Отменена')
            GROUP BY ticket_id
        ) d ON d.ticket_id = t.id
        LEFT JOIN {SCHEMA}.ticket_comments c
               ON c.ticket_id = t.id AND c.is_internal = false
        WHERE t.created_at >= %s AND t.created_at < %s
          AND t.assigned_to IN ({ids})
        ORDER BY t.id, c.created_at
    """, (start, end))

    tickets: Dict[int, Dict[str, Any]] = {}
    for r in cur.fetchall():
        tk = tickets.setdefault(int(r['id']), {
            'created_by': r['created_by'], 'assigned_to': r['assigned_to'],
            'created_at': r['created_at'], 'closed_at': r['closed_at'], 'msgs': []})
        if r['at'] is not None:
            tk['msgs'].append((r['at'], int(r['user_id'])))

    schedules = _load_schedules(conn)
    now = datetime.now()

    # side -> накопленные часы; отдельно копим «ходы» для средних
    acc = {'our': {'hours': 0.0, 'workHours': 0.0, 'periods': 0},
           'client': {'hours': 0.0, 'workHours': 0.0, 'periods': 0}}
    first_wait: List[float] = []
    open_our = 0

    for tk in tickets.values():
        sched = schedules.get(int(tk['assigned_to'])) or DEFAULT_SCHEDULE
        author = int(tk['created_by']) if tk['created_by'] is not None else -1
        finish = tk['closed_at'] or now

        # Ход переходит к нам с момента создания заявки.
        turn = 'our'
        mark = tk['created_at']
        is_first = True

        for at, uid in tk['msgs']:
            if at < mark or at > finish:
                continue
            side = 'our' if (uid in staff and uid != author) else 'client'
            if side == turn:
                cal = (at - mark).total_seconds() / 3600
                if cal >= 0:
                    acc[turn]['hours'] += cal
                    acc[turn]['workHours'] += _business_minutes(mark, at, sched) / 60
                    acc[turn]['periods'] += 1
                    if is_first and turn == 'our':
                        first_wait.append(cal)
                        is_first = False
                mark = at
                turn = 'client' if turn == 'our' else 'our'

        if finish > mark:
            cal = (finish - mark).total_seconds() / 3600
            acc[turn]['hours'] += cal
            acc[turn]['workHours'] += _business_minutes(mark, finish, sched) / 60
            acc[turn]['periods'] += 1
            if tk['closed_at'] is None and turn == 'our':
                open_our += 1

    labels = {'our': 'Пользователь ждёт нас', 'client': 'Мы ждём пользователя'}
    out = []
    for side in ('our', 'client'):
        a = acc[side]
        if a['periods'] == 0:
            continue
        out.append({
            'side': side, 'label': labels[side],
            'hours': round(a['hours'], 1), 'workHours': round(a['workHours'], 1),
            'periods': a['periods'],
            'avgHours': round(a['hours'] / a['periods'], 1),
            'avgWorkHours': round(a['workHours'] / a['periods'], 1),
            'items': [],
        })

    total = sum(g['hours'] for g in out)
    total_work = sum(g['workHours'] for g in out)
    for g in out:
        g['share'] = round(g['hours'] / total * 100, 1) if total else 0
        g['workShare'] = round(g['workHours'] / total_work * 100, 1) if total_work else 0
    out.sort(key=lambda g: -g['hours'])

    fw = sorted(first_wait)
    fw_med = 0.0
    if fw:
        mid = len(fw) // 2
        fw_med = fw[mid] if len(fw) % 2 else (fw[mid - 1] + fw[mid]) / 2

    return {'groups': out, 'totalHours': round(total, 1),
            'totalWorkHours': round(total_work, 1),
            'tickets': len(tickets),
            'firstWaitMedian': round(fw_med, 1),
            'openOnUs': open_our}



def handle_topics_analytics(method: str, event: Dict[str, Any], conn) -> Dict[str, Any]:
    """Аналитика заявок за месяц: линии → сервисы → типы вопросов"""
    if not verify_token(event):
        return response(401, {'error': 'Требуется авторизация'})

    if method != 'GET':
        return response(405, {'error': 'Метод не поддерживается'})

    params = event.get('queryStringParameters') or {}
    month = params.get('month') or '2026-08'

    # month=all — разрез за всю историю заявок, без ограничения по датам.
    all_time = month == 'all'

    if not all_time:
        if (len(month) != 7 or month[4] != '-'
                or not month[:4].isdigit() or not month[5:].isdigit()
                or not 1 <= int(month[5:]) <= 12):
            return response(400, {'error': 'Некорректный месяц, ожидается YYYY-MM или all'})

    where_sql = '' if all_time else 'WHERE created_at >= %s AND created_at < %s'
    args = () if all_time else _month_bounds(month)

    cur = conn.cursor()
    cur.execute(f"""
        SELECT line, service, issue, COUNT(*) AS cnt
        FROM (
            SELECT {_line_case()} AS line,
                   {SERVICE_CASE} AS service,
                   {ISSUE_CASE} AS issue
            FROM (
                SELECT assigned_to,
                       LOWER(COALESCE(title, '') || ' ' ||
                             COALESCE(REGEXP_REPLACE(description, '!\\[\\]\\([^)]*\\)', '', 'g'), '')) AS x
                FROM {SCHEMA}.tickets
                {where_sql}
            ) s
        ) q
        GROUP BY line, service, issue
    """, args)
    rows = cur.fetchall()

    total = 0
    lines: Dict[str, Dict[str, Any]] = {}

    for r in rows:
        line, service, issue = r['line'], r['service'], r['issue']
        cnt = int(r['cnt'])
        total += cnt
        ln = lines.setdefault(line, {'name': line, 'count': 0, '_services': {}})
        ln['count'] += cnt
        sv = ln['_services'].setdefault(service, {'name': service, 'count': 0, '_issues': {}})
        sv['count'] += cnt
        sv['_issues'][issue] = sv['_issues'].get(issue, 0) + cnt

    ordered = []
    for name in LINE_ORDER:
        if name in lines:
            ordered.append(lines.pop(name))
    ordered.extend(sorted(lines.values(), key=lambda l: -l['count']))

    for ln in ordered:
        services = sorted(ln.pop('_services').values(), key=lambda s: -s['count'])
        for sv in services:
            sv['issues'] = sorted(
                ({'name': k, 'count': v} for k, v in sv.pop('_issues').items()),
                key=lambda i: -i['count']
            )
        ln['services'] = services

    weeks = _weeks_rows(conn, WEEKS_MONTH)
    first_response = _first_response_rows(conn, WEEKS_MONTH)

    return response(200, {'month': month, 'total': total, 'lines': ordered,
                          'weeksMonth': WEEKS_MONTH, 'weeks': weeks,
                          'firstResponse': first_response,
                          'resolution': _resolution_rows(conn, WEEKS_MONTH),
                          'delayReasons': _delay_reasons(conn, WEEKS_MONTH),
                          'rating': _rating_rows(conn, WEEKS_MONTH),
                          'reopened': _reopened_rows(conn, WEEKS_MONTH)})