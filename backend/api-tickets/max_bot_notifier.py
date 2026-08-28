"""Отправка уведомлений через бота в мессенджере MAX (botapi.max.ru)"""
import json
import os
import re
import urllib.request
import urllib.parse
import urllib.error

from notify_budget import has_budget, effective_timeout

MAX_BOT_TOKEN = os.environ.get('MAX_BOT_TOKEN', '')
MAX_API_BASE = 'https://botapi.max.ru'  # старый домен, всё ещё рабочий
# MAX требует токен в заголовке Authorization БЕЗ префикса Bearer


def _strip_bbcode(text: str) -> str:
    """MAX не поддерживает BBcode/HTML — вырезаем теги, оставляя текст."""
    if not text:
        return ''
    text = re.sub(r'\[/?[a-zA-Z]+\]', '', text)
    return text


def _send_max_message(max_user_id: str, text: str, ticket_id: int = None, ticket_url: str = ''):
    """Отправляет сообщение пользователю MAX по user_id.

    MAX Bot API: POST https://botapi.max.ru/messages?access_token=...&user_id=...
    body: {"text": "..."}
    """
    if not MAX_BOT_TOKEN:
        print('[max-bot] MAX_BOT_TOKEN is not set, skipping')
        return
    if not max_user_id:
        return
    if not has_budget():
        print(f'[max-bot] Notify budget exhausted, skip message to {max_user_id}')
        return

    plain = _strip_bbcode(text)

    params = {'user_id': str(max_user_id)}
    url = f"{MAX_API_BASE}/messages?{urllib.parse.urlencode(params)}"

    payload = {'text': plain}

    if ticket_url:
        payload['attachments'] = [{
            'type': 'inline_keyboard',
            'payload': {
                'buttons': [[
                    {
                        'type': 'link',
                        'text': f'📋 Открыть заявку #{ticket_id}' if ticket_id else '📋 Открыть заявку',
                        'url': ticket_url,
                    }
                ]]
            }
        }]

    data = json.dumps(payload, ensure_ascii=False).encode('utf-8')

    try:
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': MAX_BOT_TOKEN,
            },
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=effective_timeout()) as resp:
            body = resp.read().decode('utf-8', errors='replace')
            print(f'[max-bot] Sent to {max_user_id}: HTTP {resp.status}')
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace') if e.fp else ''
        # Запасная отправка через chat_id выполняется только если бюджет
        # ещё не исчерпан: раньше она удваивала ожидание ради редкого случая.
        if e.code == 400 and 'user_id' in body.lower() and has_budget():
            _send_max_message_chat(max_user_id, plain, ticket_id, ticket_url)
            return
        print(f'[max-bot] HTTP {e.code} sending to {max_user_id}: {body[:300]}')
    except Exception as e:
        print(f'[max-bot] Failed to send to {max_user_id}: {e}')


def _send_max_message_chat(chat_id: str, text: str, ticket_id: int = None, ticket_url: str = ''):
    """Фолбэк-отправка через chat_id вместо user_id."""
    if not MAX_BOT_TOKEN:
        return
    if not has_budget():
        print(f'[max-bot] Notify budget exhausted, skip fallback to {chat_id}')
        return
    params = {'chat_id': str(chat_id)}
    url = f"{MAX_API_BASE}/messages?{urllib.parse.urlencode(params)}"
    payload = {'text': text}
    if ticket_url:
        payload['attachments'] = [{
            'type': 'inline_keyboard',
            'payload': {
                'buttons': [[{
                    'type': 'link',
                    'text': f'📋 Открыть заявку #{ticket_id}' if ticket_id else '📋 Открыть заявку',
                    'url': ticket_url,
                }]]
            }
        }]
    data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    try:
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': MAX_BOT_TOKEN,
            },
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=effective_timeout()) as resp:
            print(f'[max-bot] Sent via chat_id to {chat_id}: HTTP {resp.status}')
    except Exception as e:
        print(f'[max-bot] Fallback failed to {chat_id}: {e}')


def _priority_emoji(priority_name: str) -> str:
    name = (priority_name or '').lower()
    if 'критич' in name:
        return '🚨🚨🚨'
    if 'высок' in name:
        return '⚠️⚠️⚠️'
    if 'средн' in name:
        return '🟠🟠🟠'
    return '⚪️⚪️⚪️'


def notify_executor_assigned(cur, schema: str, ticket_id: int, assigned_to_user_id: int, app_origin: str = ''):
    """Уведомляет исполнителя о назначении на заявку — в MAX."""
    if not MAX_BOT_TOKEN:
        print('[max-bot] Not configured, skipping assignment notification')
        return

    cur.execute(f"""
        SELECT t.id, t.title, t.description, t.created_by, t.due_date,
               p.name AS priority_name,
               executor.max_user_id AS executor_max_id,
               executor.full_name AS executor_name,
               creator.full_name AS creator_name,
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
        return
    if not row.get('executor_max_id'):
        print(f'[max-bot] User {assigned_to_user_id} has no max_user_id, skipping')
        return

    cur.execute(f"""
        SELECT ts.name AS ticket_service_name, s.name AS service_name
        FROM {schema}.ticket_to_service_mappings tsm
        LEFT JOIN {schema}.ticket_services ts ON tsm.ticket_service_id = ts.id
        LEFT JOIN {schema}.services s ON tsm.service_id = s.id
        WHERE tsm.ticket_id = %s
        LIMIT 1
    """, (ticket_id,))
    svc = cur.fetchone()

    priority_name = row.get('priority_name') or 'Не указан'
    pe = _priority_emoji(priority_name)
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
            service_line = f"\nУслуга: {' → '.join(parts)}"

    creator_line = ''
    if row.get('creator_name'):
        creator_parts = [row['creator_name']]
        if row.get('creator_company'):
            creator_parts.append(row['creator_company'])
        if row.get('creator_department'):
            creator_parts.append(row['creator_department'])
        creator_line = f"\nЗаказчик: {', '.join(creator_parts)}"

    due_line = ''
    if row.get('due_date'):
        try:
            from datetime import datetime
            due = row['due_date']
            if isinstance(due, str):
                due = datetime.fromisoformat(due.replace('Z', '+00:00'))
            due_line = f"\n\nВыполнить до: {due.strftime('%d.%m.%Y %H:%M')}"
        except Exception:
            due_line = f"\n\nВыполнить до: {row['due_date']}"

    message = (
        f"{pe} Вам назначена заявка #{row['id']} {pe}\n\n"
        f"Приоритет: {pe} {priority_name}"
        f"{service_line}{creator_line}\n\n"
        f"Содержание: {description}{due_line}"
    )

    ticket_url = f"{app_origin.rstrip('/')}/tickets/{row['id']}" if app_origin else ''
    _send_max_message(row['executor_max_id'], message, row['id'], ticket_url)


def notify_watcher_added(cur, schema: str, ticket_id: int, watcher_user_id: int,
                          actor_user_id: int = None, app_origin: str = ''):
    """Уведомляет наблюдателя о добавлении в заявку — в MAX."""
    if not MAX_BOT_TOKEN:
        return
    if not watcher_user_id or watcher_user_id == actor_user_id:
        return

    cur.execute(f"""
        SELECT t.id, t.title,
               watcher.max_user_id AS watcher_max_id,
               watcher.full_name AS watcher_name
        FROM {schema}.tickets t
        JOIN {schema}.users watcher ON watcher.id = %s
        WHERE t.id = %s
    """, (watcher_user_id, ticket_id))

    row = cur.fetchone()
    if not row or not row.get('watcher_max_id'):
        return

    title = row.get('title') or f"Заявка #{row['id']}"
    message = f"👀 Вы назначены наблюдателем в заявке #{row['id']}\n{title}"
    ticket_url = f"{app_origin.rstrip('/')}/tickets/{row['id']}" if app_origin else ''
    _send_max_message(row['watcher_max_id'], message, row['id'], ticket_url)


def send_comment_notifications(cur, schema: str, ticket_id: int, author_user_id: int,
                                comment_text: str, is_internal: bool, app_origin: str = ''):
    """Уведомления о новом комментарии в MAX (всем участникам с max_user_id)."""
    if not MAX_BOT_TOKEN:
        return

    cur.execute(f"""
        SELECT t.id, t.title, t.created_by, t.assigned_to,
               author.full_name AS author_name,
               creator.max_user_id AS creator_max_id,
               executor.max_user_id AS executor_max_id,
               p.name AS priority_name
        FROM {schema}.tickets t
        JOIN {schema}.users author ON author.id = %s
        LEFT JOIN {schema}.users creator ON creator.id = t.created_by
        LEFT JOIN {schema}.users executor ON executor.id = t.assigned_to
        LEFT JOIN {schema}.ticket_priorities p ON t.priority_id = p.id
        WHERE t.id = %s
    """, (author_user_id, ticket_id))

    row = cur.fetchone()
    if not row:
        return

    cur.execute(f"""
        SELECT tw.user_id, u.max_user_id
        FROM {schema}.ticket_watchers tw
        JOIN {schema}.users u ON u.id = tw.user_id
        WHERE tw.ticket_id = %s AND u.max_user_id IS NOT NULL
    """, (ticket_id,))
    watchers = cur.fetchall() or []

    seen = set()
    recipients = []

    def add(max_id, uid):
        if not max_id or uid == author_user_id or max_id in seen:
            return
        seen.add(max_id)
        recipients.append(max_id)

    if is_internal:
        if row['assigned_to']:
            add(row.get('executor_max_id'), row['assigned_to'])
        for w in watchers:
            add(w['max_user_id'], w['user_id'])
    else:
        add(row.get('creator_max_id'), row['created_by'])
        if row['assigned_to']:
            add(row.get('executor_max_id'), row['assigned_to'])
        for w in watchers:
            add(w['max_user_id'], w['user_id'])

    if not recipients:
        return

    # Чистим markdown-картинки
    clean = re.sub(r'!\[[^\]]*\]\([^)]*\)', '', comment_text or '')
    clean = re.sub(r'<img\b[^>]*>', '', clean, flags=re.IGNORECASE)
    clean = re.sub(r'data:[^;\s)]+;base64,[A-Za-z0-9+/=]+', '', clean)
    clean = re.sub(r'\n{3,}', '\n\n', clean).strip()

    preview = clean[:150] + ('...' if len(clean) > 150 else '')
    ticket_title = row['title'] or f"Заявка #{row['id']}"
    pe = _priority_emoji(row.get('priority_name') or '')
    ticket_url = f"{app_origin.rstrip('/')}/tickets/{row['id']}" if app_origin else ''

    for max_id in recipients:
        message = (
            f"{pe} Новый комментарий в заявке #{row['id']}\n"
            f"{ticket_title}\n\n"
            f"{row['author_name']}: {preview}"
        )
        _send_max_message(max_id, message, row['id'], ticket_url)


def notify_status_changed(cur, schema: str, ticket_id: int, actor_user_id: int,
                          old_status: str, new_status: str, app_origin: str = ''):
    """Уведомление о смене статуса заявки — создателю и исполнителю."""
    if not MAX_BOT_TOKEN:
        return
    cur.execute(f"""
        SELECT t.id, t.title, t.created_by, t.assigned_to,
               creator.max_user_id AS creator_max_id,
               executor.max_user_id AS executor_max_id
        FROM {schema}.tickets t
        LEFT JOIN {schema}.users creator ON creator.id = t.created_by
        LEFT JOIN {schema}.users executor ON executor.id = t.assigned_to
        WHERE t.id = %s
    """, (ticket_id,))
    row = cur.fetchone()
    if not row:
        return

    title = row.get('title') or f"Заявка #{row['id']}"
    message = (
        f"🔄 Изменён статус заявки #{row['id']}\n"
        f"{title}\n\n"
        f"{old_status} → {new_status}"
    )
    ticket_url = f"{app_origin.rstrip('/')}/tickets/{row['id']}" if app_origin else ''

    seen = set()
    for uid, max_id in [
        (row['created_by'], row.get('creator_max_id')),
        (row['assigned_to'], row.get('executor_max_id')),
    ]:
        if not max_id or uid == actor_user_id or max_id in seen:
            continue
        seen.add(max_id)
        _send_max_message(max_id, message, row['id'], ticket_url)


def notify_new_ticket(cur, schema: str, ticket_id: int, app_origin: str = ''):
    """Уведомление о новой заявке — пока используется только для исполнителя при создании
    (через notify_executor_assigned). Оставлено для совместимости/будущих сценариев."""
    return