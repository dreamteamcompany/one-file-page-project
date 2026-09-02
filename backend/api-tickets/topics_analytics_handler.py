"""Аналитика обращений по факту вопроса: линии → сервисы → типы вопросов"""
from typing import Dict, Any, List
from datetime import date
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
    """Недельная динамика заявок внутри месяца, только по нашим подразделениям."""
    start, end = _month_bounds(month)
    ids = ','.join(str(int(i)) for line in LINE_MEMBERS.values() for i in line)
    cur = conn.cursor()
    cur.execute(f"""
        SELECT GREATEST(DATE_TRUNC('week', t.created_at)::date, %s::date) AS w_start,
               LEAST((DATE_TRUNC('week', t.created_at) + INTERVAL '6 days')::date,
                     (%s::date - 1)) AS w_end,
               COUNT(*) AS cnt,
               COUNT(*) FILTER (
                   WHERE s.name IS NULL OR s.name NOT IN ('Решена', 'Отменена')
               ) AS unresolved
        FROM {SCHEMA}.tickets t
        LEFT JOIN {SCHEMA}.ticket_statuses s ON s.id = t.status_id
        WHERE t.created_at >= %s AND t.created_at < %s
          AND t.assigned_to IN ({ids})
        GROUP BY 1, 2
        ORDER BY 1
    """, (start, end, start, end))

    weeks = []
    for r in cur.fetchall():
        a, b = r['w_start'], r['w_end']
        label = f"{a.day}–{b.day} {RU_MONTHS_GEN[b.month - 1]}"
        cnt, unresolved = int(r['cnt']), int(r['unresolved'])
        weeks.append({'label': label, 'count': cnt, 'unresolved': unresolved,
                      'resolved': cnt - unresolved, 'days': (b - a).days + 1})
    return weeks


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

    return response(200, {'month': month, 'total': total, 'lines': ordered,
                          'weeksMonth': WEEKS_MONTH, 'weeks': weeks})