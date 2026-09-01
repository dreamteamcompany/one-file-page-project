"""
Аналитика заявок по факту обращения.
GET /analytics-topics?month=2026-08 → всего заявок, разбивка по линиям,
внутри каждой линии — по сервисам, внутри сервиса — по типу вопроса.
Линия определяется по исполнителю заявки (состав отделов задан в LINE_MEMBERS).
"""
from typing import Dict, Any, List
from datetime import date
from shared_utils import response, get_db_connection, verify_token, handle_options, SCHEMA

# Состав отделов (id пользователей). Задан вручную по факту работы сотрудников,
# а не по группам исполнителей в справочнике.
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
    end = date(year + (mon == 12), 1 if mon == 12 else mon + 1, 1)
    return start.isoformat(), end.isoformat()


def _line_sql() -> str:
    parts = []
    for line, ids in LINE_MEMBERS.items():
        ids_str = ','.join(str(i) for i in ids)
        parts.append(f"WHEN assigned_to IN ({ids_str}) THEN '{line}'")
    return ('CASE ' + ' '.join(parts) +
            " WHEN assigned_to IS NULL THEN 'Исполнитель не назначен'"
            " ELSE 'Прочие исполнители' END")


def handler(event: dict, context) -> dict:
    """Аналитика заявок за месяц: линии → сервисы → типы вопросов"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return handle_options()

    if method != 'GET':
        return response(405, {'error': 'Method not allowed'})

    if not verify_token(event):
        return response(401, {'error': 'Требуется авторизация'})

    params = event.get('queryStringParameters') or {}
    month = params.get('month') or '2026-08'
    if len(month) != 7 or month[4] != '-' or not month[:4].isdigit() or not month[5:].isdigit():
        return response(400, {'error': 'Некорректный месяц, ожидается YYYY-MM'})

    start, end = _month_bounds(month)

    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(f"""
            SELECT line, service, issue, COUNT(*) AS cnt
            FROM (
                SELECT {_line_sql()} AS line,
                       {SERVICE_CASE} AS service,
                       {ISSUE_CASE} AS issue
                FROM (
                    SELECT assigned_to,
                           LOWER(COALESCE(title, '') || ' ' ||
                                 COALESCE(REGEXP_REPLACE(description, '!\\[\\]\\([^)]*\\)', '', 'g'), '')) AS x
                    FROM {SCHEMA}.tickets
                    WHERE created_at >= %s AND created_at < %s
                ) s
            ) q
            GROUP BY line, service, issue
        """, (start, end))
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()

    total = 0
    lines: Dict[str, Dict[str, Any]] = {}

    for r in rows:
        line, service, issue, cnt = r['line'], r['service'], r['issue'], int(r['cnt'])
        total += cnt
        ln = lines.setdefault(line, {'name': line, 'count': 0, '_services': {}})
        ln['count'] += cnt
        sv = ln['_services'].setdefault(service, {'name': service, 'count': 0, '_issues': {}})
        sv['count'] += cnt
        sv['_issues'][issue] = sv['_issues'].get(issue, 0) + cnt

    result_lines = []
    for name in LINE_ORDER:
        if name not in lines:
            continue
        ln = lines.pop(name)
        result_lines.append(ln)
    result_lines.extend(sorted(lines.values(), key=lambda l: -l['count']))

    for ln in result_lines:
        services = sorted(ln.pop('_services').values(), key=lambda s: -s['count'])
        for sv in services:
            sv['issues'] = sorted(
                ({'name': k, 'count': v} for k, v in sv.pop('_issues').items()),
                key=lambda i: -i['count']
            )
        ln['services'] = services

    return response(200, {'month': month, 'total': total, 'lines': result_lines})
