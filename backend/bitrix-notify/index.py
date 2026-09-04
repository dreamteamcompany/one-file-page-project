"""Отправка уведомлений в личный чат Битрикс24"""
import json
import os
import urllib.request
import urllib.parse
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA')
BITRIX_WEBHOOK_URL = os.environ.get('BITRIX24_WEBHOOK_URL', '').rstrip('/')

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-Endpoint',
}


def handler(event, context):
    """Отправка уведомлений в Битрикс24 чат при событиях в заявках"""
    if event.get('httpMethod') == 'OPTIONS':
        return resp(200, '')

    if event.get('httpMethod') != 'POST':
        return resp(405, {'error': 'Method not allowed'})

    raw_body = event.get('body') or ''
    if not raw_body or not raw_body.strip():
        return resp(400, {'error': 'Empty body'})
    body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
    action = body.get('action', '')

    if action == 'comment_added':
        return handle_comment_notification(body)

    return resp(400, {'error': 'Unknown action'})


def handle_comment_notification(body):
    """Уведомление о новом комментарии в заявке"""
    ticket_id = body.get('ticket_id')
    comment_text = body.get('comment_text', '')
    author_user_id = body.get('author_user_id')
    is_internal = body.get('is_internal', False)

    if not ticket_id or not author_user_id:
        return resp(400, {'error': 'ticket_id and author_user_id required'})

    if not BITRIX_WEBHOOK_URL:
        return resp(200, {'sent': False, 'reason': 'BITRIX24_WEBHOOK_URL not configured'})

    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        cur = conn.cursor()

        cur.execute(f"""
            SELECT t.id, t.title, t.created_by, t.assigned_to,
                   author.full_name AS author_name,
                   author.bitrix_user_id AS author_bitrix_id,
                   creator.full_name AS creator_name,
                   creator.bitrix_user_id AS creator_bitrix_id,
                   executor.full_name AS executor_name,
                   executor.bitrix_user_id AS executor_bitrix_id
            FROM {SCHEMA}.tickets t
            JOIN {SCHEMA}.users author ON author.id = %s
            LEFT JOIN {SCHEMA}.users creator ON creator.id = t.created_by
            LEFT JOIN {SCHEMA}.users executor ON executor.id = t.assigned_to
            WHERE t.id = %s
        """, (author_user_id, ticket_id))

        row = cur.fetchone()
        if not row:
            cur.close()
            return resp(404, {'error': 'Ticket not found'})

        # Загружаем наблюдателей с их bitrix_user_id
        cur.execute(f"""
            SELECT tw.user_id, u.bitrix_user_id
            FROM {SCHEMA}.ticket_watchers tw
            JOIN {SCHEMA}.users u ON u.id = tw.user_id
            WHERE tw.ticket_id = %s AND u.bitrix_user_id IS NOT NULL
        """, (ticket_id,))
        watchers = cur.fetchall()

        recipients = collect_recipients(row, author_user_id, is_internal, watchers)

        if not recipients:
            cur.close()
            return resp(200, {'sent': False, 'reason': 'No Bitrix recipients'})

        preview = comment_text[:150] + ('...' if len(comment_text) > 150 else '')
        ticket_title = row['title'] or f"Заявка #{row['id']}"

        sent_count = 0
        errors = []

        for r in recipients:
            message = (
                f"[b]Новый комментарий в заявке #{row['id']}[/b]\n"
                f"{ticket_title}\n\n"
                f"[b]{row['author_name']}[/b]: {preview}"
            )

            ok, err = send_bitrix_notification(r['bitrix_id'], message)
            if ok:
                sent_count += 1
            elif err:
                errors.append(err)

        cur.close()
        return resp(200, {
            'sent': sent_count > 0,
            'sent_count': sent_count,
            'total_recipients': len(recipients),
            'errors': errors if errors else None
        })
    finally:
        conn.close()


def collect_recipients(row, author_user_id, is_internal, watchers=None):
    """Определяет, кому отправить уведомление"""
    recipients = []
    seen_bitrix_ids = set()

    def add(bitrix_id, role):
        if bitrix_id and bitrix_id not in seen_bitrix_ids:
            seen_bitrix_ids.add(bitrix_id)
            recipients.append({'bitrix_id': bitrix_id, 'role': role})

    if is_internal:
        if row['assigned_to'] and row['assigned_to'] != author_user_id:
            add(row.get('executor_bitrix_id'), 'executor')
        return recipients

    if row['created_by'] != author_user_id:
        add(row.get('creator_bitrix_id'), 'creator')

    if row['assigned_to'] and row['assigned_to'] != author_user_id:
        add(row.get('executor_bitrix_id'), 'executor')

    for w in (watchers or []):
        if w['user_id'] != author_user_id:
            add(w['bitrix_user_id'], 'watcher')

    return recipients


def send_bitrix_notification(bitrix_user_id, message):
    """Отправляет личное сообщение пользователю в Битрикс24 чат"""
    url = f"{BITRIX_WEBHOOK_URL}/im.message.add.json"

    payload = json.dumps({
        'DIALOG_ID': bitrix_user_id,
        'MESSAGE': message
    }).encode('utf-8')

    try:
        req = urllib.request.Request(
            url,
            data=payload,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            result = json.loads(r.read().decode())
            if result.get('result'):
                return True, None
            return False, f"Bitrix returned: {json.dumps(result)[:200]}"
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ''
        err = f"Bitrix HTTP {e.code}: {body[:200]}"
        print(f"[bitrix-notify] {err}")
        return False, err
    except Exception as e:
        err = f"Bitrix error: {str(e)}"
        print(f"[bitrix-notify] {err}")
        return False, err


def resp(status, body):
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, ensure_ascii=False, default=str) if isinstance(body, dict) else body
    }