"""Отправка уведомлений через чат-бота DreamDesk в Битрикс24"""
import json
import os
import urllib.request
import urllib.parse

from notify_budget import has_budget, effective_timeout

BITRIX_PORTAL_URL = os.environ.get('BITRIX24_PORTAL_URL', '').rstrip('/')
BITRIX_BOT_ID = os.environ.get('BITRIX_BOT_ID', '')
BITRIX_BOT_CLIENT_ID = os.environ.get('BITRIX_BOT_CLIENT_ID', '')
BITRIX_BOT_CLIENT_SECRET = os.environ.get('BITRIX_BOT_CLIENT_SECRET', '')
BITRIX_BOT_REFRESH_TOKEN = os.environ.get('BITRIX_BOT_REFRESH_TOKEN', '')

_bot_access_token = None


def _get_bot_token() -> str:
    global _bot_access_token
    if _bot_access_token:
        return _bot_access_token

    if not BITRIX_BOT_REFRESH_TOKEN or not BITRIX_BOT_CLIENT_ID or not BITRIX_BOT_CLIENT_SECRET:
        print("[bitrix-bot] Missing bot credentials for token refresh")
        return ''

    params = urllib.parse.urlencode({
        'grant_type': 'refresh_token',
        'client_id': BITRIX_BOT_CLIENT_ID,
        'client_secret': BITRIX_BOT_CLIENT_SECRET,
        'refresh_token': BITRIX_BOT_REFRESH_TOKEN,
    })
    url = f"https://oauth.bitrix.info/oauth/token/?{params}"

    # Обновление токена было самым долгим единичным ожиданием (10 секунд) —
    # одного такого запроса хватало, чтобы сорвать весь вызов по таймауту.
    timeout = effective_timeout()
    if timeout <= 0:
        print("[bitrix-bot] Notify budget exhausted, skip token refresh")
        return ''

    try:
        req = urllib.request.Request(url, method='GET')
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode())
            _bot_access_token = data.get('access_token', '')
            new_refresh = data.get('refresh_token', '')
            if new_refresh:
                print(f"[bitrix-bot] Token refreshed ok")
            return _bot_access_token
    except Exception as e:
        print(f"[bitrix-bot] Token refresh failed: {e}")
        return ''


def _send_bot_message(access_token: str, bitrix_user_id: str, message: str, keyboard: list = None):
    # Бюджет проверяем перед каждым получателем: при нескольких наблюдателях
    # ожидания складываются, и без ограничения вызов уходит в таймаут.
    if not has_budget():
        print(f"[bitrix-bot] Notify budget exhausted, skip message to {bitrix_user_id}")
        return

    url = f"{BITRIX_PORTAL_URL}/rest/imbot.message.add.json?auth={access_token}"

    payload = {
        'BOT_ID': BITRIX_BOT_ID,
        'DIALOG_ID': bitrix_user_id,
        'MESSAGE': message,
    }

    if keyboard:
        payload['KEYBOARD'] = keyboard

    data = json.dumps(payload).encode('utf-8')

    try:
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
        with urllib.request.urlopen(req, timeout=effective_timeout()) as r:
            result = json.loads(r.read().decode())
            print(f"[bitrix-bot] Message sent to {bitrix_user_id}: {result.get('result', 'unknown')}")
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ''
        print(f"[bitrix-bot] HTTP {e.code} sending to {bitrix_user_id}: {body[:300]}")
    except Exception as e:
        print(f"[bitrix-bot] Failed to send to {bitrix_user_id}: {e}")


def _priority_emoji(priority_name: str) -> str:
    name = priority_name.lower()
    if 'критич' in name:
        return '🚨🚨🚨'
    if 'высок' in name:
        return '⚠️⚠️⚠️'
    if 'средн' in name:
        return '🟠🟠🟠'
    return '⚪️⚪️⚪️'


def notify_executor_assigned(cur, schema: str, ticket_id: int, assigned_to_user_id: int, app_origin: str = ''):
    """Уведомляет исполнителя о назначении на заявку"""
    if not BITRIX_BOT_ID or not BITRIX_PORTAL_URL:
        print(f"[bitrix-bot] Bot not configured, skipping assignment notification")
        return

    cur.execute(f"""
        SELECT t.id, t.title, t.description, t.created_by, t.due_date,
               p.name AS priority_name,
               executor.bitrix_user_id AS executor_bitrix_id,
               executor.full_name AS executor_name,
               creator.full_name AS creator_name,
               creator.position AS creator_position,
               comp.name AS creator_company,
               dept.name AS creator_department
        FROM {schema}.tickets t
        LEFT JOIN {schema}.ticket_priorities p ON t.priority_id = p.id
        JOIN {schema}.users executor ON executor.id = %s
        LEFT JOIN {schema}.users creator ON creator.id = t.created_by
        LEFT JOIN {schema}.companies comp ON comp.id = creator.company_id
        LEFT JOIN {schema}.departments dept ON dept.id = creator.department_id
        WHERE t.id = %s
    """, (assigned_to_user_id, ticket_id))

    row = cur.fetchone()
    if not row:
        print(f"[bitrix-bot] Ticket {ticket_id} or user {assigned_to_user_id} not found")
        return

    if not row.get('executor_bitrix_id'):
        print(f"[bitrix-bot] User {assigned_to_user_id} has no bitrix_user_id, skipping")
        return

    cur.execute(f"""
        SELECT ts.name AS ticket_service_name, s.name AS service_name, sc.name AS category_name
        FROM {schema}.ticket_to_service_mappings tsm
        LEFT JOIN {schema}.ticket_services ts ON tsm.ticket_service_id = ts.id
        LEFT JOIN {schema}.services s ON tsm.service_id = s.id
        LEFT JOIN {schema}.service_categories sc ON s.category_id = sc.id
        WHERE tsm.ticket_id = %s
        LIMIT 1
    """, (ticket_id,))
    svc = cur.fetchone()

    access_token = _get_bot_token()
    if not access_token:
        print("[bitrix-bot] Failed to get access token for assignment notification")
        return

    priority_name = row.get('priority_name') or 'Не указан'
    priority_emoji = _priority_emoji(priority_name)
    description = (row.get('description') or '')[:200]
    if len(row.get('description') or '') > 200:
        description += '...'

    service_line = ''
    if svc:
        parts = []
        if svc.get('ticket_service_name'):
            parts.append(svc['ticket_service_name'])
        if svc.get('service_name'):
            parts.append(svc['service_name'])
        if parts:
            service_line = f"\n[b]Услуга:[/b] {' → '.join(parts)}"

    creator_line = ''
    if row.get('creator_name'):
        creator_parts = [row['creator_name']]
        if row.get('creator_company'):
            creator_parts.append(row['creator_company'])
        if row.get('creator_department'):
            creator_parts.append(row['creator_department'])
        creator_line = f"\n[b]Заказчик:[/b] {', '.join(creator_parts)}"

    due_line = ''
    if row.get('due_date'):
        try:
            from datetime import datetime
            due = row['due_date']
            if isinstance(due, str):
                due = datetime.fromisoformat(due.replace('Z', '+00:00'))
            due_line = f"\n\n[b]Необходимо выполнить до:[/b] {due.strftime('%d.%m.%Y %H:%M')}"
        except Exception:
            due_line = f"\n\n[b]Необходимо выполнить до:[/b] {row['due_date']}"

    message = (
        f"{priority_emoji} [b]Вам назначена заявка #{row['id']}[/b] {priority_emoji}\n\n"
        f"[b]Приоритет:[/b] {priority_emoji} {priority_name} {priority_emoji}"
        f"{service_line}"
        f"{creator_line}\n\n"
        f"[b]Содержание:[/b] {description}"
        f"{due_line}"
    )

    keyboard = []
    if app_origin:
        ticket_url = f"{app_origin}/tickets/{row['id']}"
        keyboard = [
            {
                "TEXT": f"📋 Открыть заявку #{row['id']}",
                "LINK": ticket_url,
                "BG_COLOR": "#3B82F6",
                "TEXT_COLOR": "#FFFFFF",
                "DISPLAY": "LINE",
                "BLOCK": "Y"
            }
        ]

    _send_bot_message(access_token, row['executor_bitrix_id'], message, keyboard)
    print(f"[bitrix-bot] Assignment notification sent for ticket {ticket_id} to user {assigned_to_user_id}")


def notify_watcher_added(cur, schema: str, ticket_id: int, watcher_user_id: int,
                          actor_user_id: int = None, app_origin: str = ''):
    """Уведомляет пользователя о том, что его назначили наблюдателем в заявке.
    Краткое сообщение + кнопка 'Открыть заявку'.
    """
    if not BITRIX_BOT_ID or not BITRIX_PORTAL_URL:
        print("[bitrix-bot] Bot not configured, skipping watcher notification")
        return

    if not watcher_user_id or watcher_user_id == actor_user_id:
        return

    cur.execute(f"""
        SELECT t.id, t.title,
               watcher.bitrix_user_id AS watcher_bitrix_id,
               watcher.full_name AS watcher_name
        FROM {schema}.tickets t
        JOIN {schema}.users watcher ON watcher.id = %s
        WHERE t.id = %s
    """, (watcher_user_id, ticket_id))

    row = cur.fetchone()
    if not row:
        print(f"[bitrix-bot] Ticket {ticket_id} or watcher {watcher_user_id} not found")
        return

    if not row.get('watcher_bitrix_id'):
        print(f"[bitrix-bot] Watcher {watcher_user_id} has no bitrix_user_id, skipping")
        return

    access_token = _get_bot_token()
    if not access_token:
        print("[bitrix-bot] Failed to get token for watcher notification")
        return

    title = row.get('title') or f"Заявка #{row['id']}"
    message = (
        f"👀 [b]Вы назначены наблюдателем в заявке #{row['id']}[/b]\n"
        f"{title}"
    )

    keyboard = []
    if app_origin:
        ticket_url = f"{app_origin}/tickets/{row['id']}"
        keyboard = [
            {
                "TEXT": f"📋 Открыть заявку #{row['id']}",
                "LINK": ticket_url,
                "BG_COLOR": "#3B82F6",
                "TEXT_COLOR": "#FFFFFF",
                "DISPLAY": "LINE",
                "BLOCK": "Y",
            }
        ]

    _send_bot_message(access_token, row['watcher_bitrix_id'], message, keyboard)
    print(f"[bitrix-bot] Watcher notification sent for ticket {ticket_id} to user {watcher_user_id}")