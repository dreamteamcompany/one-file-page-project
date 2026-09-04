"""
API для работы с комментариями к заявкам
"""
import json
import os
import re
import gzip
import base64
import urllib.request
import urllib.parse
from typing import Dict, Any, List, Set
from pydantic import BaseModel, Field
from shared_utils import response, get_db_connection, verify_token, handle_options, SCHEMA
from max_bot_notifier import send_comment_notifications as max_send_comment_notifications

MENTION_RE = re.compile(r'@([a-zA-Z0-9_.\-]+)')

# Удаление markdown-изображений из текста (для уведомлений в Битрикс).
# Покрывает: ![alt](data:...), ![alt](url), <img src="...">, голые data:...;base64,...
_MD_IMG_RE = re.compile(r'!\[[^\]]*\]\([^)]*\)')
_HTML_IMG_RE = re.compile(r'<img\b[^>]*>', re.IGNORECASE)
_BARE_DATA_URI_RE = re.compile(r'data:[^;\s)]+;base64,[A-Za-z0-9+/=]+')


def _strip_markdown_images(text: str) -> str:
    """Полностью вырезает изображения (markdown/html/base64) из текста без замены."""
    if not text:
        return text
    out = _MD_IMG_RE.sub('', text)
    out = _HTML_IMG_RE.sub('', out)
    out = _BARE_DATA_URI_RE.sub('', out)
    out = re.sub(r'[ \t]+\n', '\n', out)
    out = re.sub(r'\n{3,}', '\n\n', out)
    return out.strip()

# Лимит размера ответа Cloud Functions (~4 МБ). Чтобы гарантированно влезть,
# вырезаем огромные inline base64-изображения из текста комментариев и заменяем
# их специальным маркером. Фронтенд (если потребуется) подгрузит оригиналы
# отдельным запросом по id комментария (action=get-inline).
_MAX_INLINE_DATA_URI_BYTES = 30 * 1024  # 30 КБ — порог, выше — заменяем плейсхолдером
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
            return f'[вложение слишком большое — открыть из заявки]'
        return data_uri

    out = _RAW_DATA_URI_RE.sub(raw_repl, out)
    return out


def response_safe(status_code: int, body: Any) -> Dict[str, Any]:
    """Обычный JSON-ответ с CORS заголовками."""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Id, Authorization, X-Endpoint',
            'Access-Control-Max-Age': '86400',
        },
        'body': json.dumps(body, ensure_ascii=False, default=str),
        'isBase64Encoded': False,
    }


def _participants(cur, ticket_id: int, ticket: Dict[str, Any]) -> Set[int]:
    """Возвращает множество user_id всех участников заявки"""
    ids: Set[int] = set()
    if ticket.get('created_by'):
        ids.add(ticket['created_by'])
    if ticket.get('assigned_to'):
        ids.add(ticket['assigned_to'])

    cur.execute(f"SELECT user_id FROM {SCHEMA}.ticket_watchers WHERE ticket_id = %s", (ticket_id,))
    ids.update(r['user_id'] for r in cur.fetchall())

    cur.execute(f"SELECT approver_id FROM {SCHEMA}.ticket_approvers WHERE ticket_id = %s", (ticket_id,))
    ids.update(r['approver_id'] for r in cur.fetchall())
    return ids


def _resolve_mentions(cur, comment: str) -> List[Dict[str, Any]]:
    """Парсит @username из текста и возвращает [{user_id, username}] существующих юзеров"""
    usernames = set(MENTION_RE.findall(comment or ''))
    if not usernames:
        return []
    cur.execute(
        f"SELECT id, username FROM {SCHEMA}.users WHERE username = ANY(%s) AND is_active = true",
        (list(usernames),),
    )
    return [dict(row) for row in cur.fetchall()]


def _resolve_mention_ids(cur, user_ids: List[int]) -> Set[int]:
    """Возвращает множество id существующих активных пользователей из явного списка"""
    ids = [int(uid) for uid in (user_ids or []) if uid]
    if not ids:
        return set()
    cur.execute(
        f"SELECT id FROM {SCHEMA}.users WHERE id = ANY(%s) AND is_active = true",
        (ids,),
    )
    return {r['id'] for r in cur.fetchall()}


def _add_watcher_if_missing(cur, ticket_id: int, user_id: int) -> bool:
    """Добавляет юзера в наблюдатели если его там нет. True если добавили."""
    cur.execute(
        f"SELECT 1 FROM {SCHEMA}.ticket_watchers WHERE ticket_id = %s AND user_id = %s",
        (ticket_id, user_id),
    )
    if cur.fetchone():
        return False
    cur.execute(
        f"INSERT INTO {SCHEMA}.ticket_watchers (ticket_id, user_id, added_at) VALUES (%s, %s, NOW())",
        (ticket_id, user_id),
    )
    return True


def _create_notification(cur, user_id: int, ticket_id: int, event_type: str,
                         actor_id: int, message: str, comment_id: int = None,
                         payload: Dict[str, Any] = None) -> None:
    """Создаёт запись в notifications для конкретного юзера"""
    cur.execute(f"""
        INSERT INTO {SCHEMA}.notifications
        (user_id, ticket_id, type, message, is_read, event_type, actor_id, comment_id, payload, created_at)
        VALUES (%s, %s, %s, %s, false, %s, %s, %s, %s, NOW())
    """, (
        user_id, ticket_id, event_type, message,
        event_type, actor_id, comment_id,
        json.dumps(payload) if payload else None,
    ))

BITRIX_PORTAL_URL = os.environ.get('BITRIX24_PORTAL_URL', '').rstrip('/')
BITRIX_BOT_ID = os.environ.get('BITRIX_BOT_ID', '')
BITRIX_BOT_CLIENT_ID = os.environ.get('BITRIX_BOT_CLIENT_ID', '')
BITRIX_BOT_CLIENT_SECRET = os.environ.get('BITRIX_BOT_CLIENT_SECRET', '')
BITRIX_BOT_REFRESH_TOKEN = os.environ.get('BITRIX_BOT_REFRESH_TOKEN', '')

_bot_access_token = None


class AttachmentInput(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    url: str = Field(..., min_length=1, max_length=2000)
    size: int = Field(default=0, ge=0)


class CommentRequest(BaseModel):
    ticket_id: int = Field(..., gt=0)
    comment: str = Field(default='', max_length=10_000_000)
    is_internal: bool = Field(default=False)
    attachments: List[AttachmentInput] = Field(default_factory=list)
    parent_comment_id: int = Field(default=None)
    mentioned_user_ids: List[int] = Field(default_factory=list)


def handler(event: dict, context) -> dict:
    """API для работы с комментариями к заявкам"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return handle_options()

    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})

    conn = get_db_connection()
    if not conn:
        return response(500, {'error': 'Database connection failed'})

    try:
        params = event.get('queryStringParameters') or {}
        action = (params.get('action') or '').lower()

        if method == 'POST' and action == 'mark-read':
            return handle_mark_read(event, conn, payload)

        if method == 'POST' and action == 'toggle-pin':
            return handle_toggle_pin(event, conn, payload)

        if method == 'GET' and action == 'get-inline':
            return handle_get_inline(event, conn, payload)

        if method == 'GET':
            try:
                return handle_get_comments(event, conn, payload)
            except Exception as e:
                import traceback
                tb = traceback.format_exc()
                print(f"[api-ticket-comments][GET] FATAL: {e}\n{tb}")
                return response(500, {'error': f'Internal error: {type(e).__name__}: {e}'})
        elif method == 'POST':
            return handle_create_comment(event, conn, payload)
        elif method == 'PUT':
            return handle_edit_comment(event, conn, payload)
        elif method == 'DELETE':
            return handle_delete_comment(event, conn, payload)
        else:
            return response(405, {'error': 'Method not allowed'})
    finally:
        conn.close()


def handle_mark_read(event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Отмечает комментарии как прочитанные текущим пользователем (батчем)"""
    user_id = payload.get('user_id')
    if not user_id:
        return response(401, {'error': 'Требуется авторизация'})

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return response(400, {'error': 'Invalid JSON'})

    raw_ids = body.get('comment_ids') or []
    if not isinstance(raw_ids, list):
        return response(400, {'error': 'comment_ids must be a list'})

    comment_ids: List[int] = []
    for v in raw_ids:
        try:
            iv = int(v)
            if iv > 0:
                comment_ids.append(iv)
        except (TypeError, ValueError):
            continue

    if not comment_ids:
        return response(200, {'marked': 0})

    cur = conn.cursor()
    ids_csv = ','.join(str(i) for i in comment_ids)
    cur.execute(f"""
        SELECT id FROM {SCHEMA}.ticket_comments
        WHERE id IN ({ids_csv}) AND user_id <> %s
    """, (int(user_id),))
    valid_ids = [r['id'] for r in cur.fetchall()]

    marked = 0
    for cid in valid_ids:
        cur.execute(f"""
            INSERT INTO {SCHEMA}.ticket_comment_reads (comment_id, user_id, read_at)
            VALUES (%s, %s, NOW())
            ON CONFLICT (comment_id, user_id) DO NOTHING
        """, (cid, int(user_id)))
        marked += cur.rowcount or 0

    conn.commit()
    cur.close()
    return response(200, {'marked': marked, 'total': len(valid_ids)})


def handle_toggle_pin(event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Закрепить или открепить комментарий. Доступно любому авторизованному пользователю."""
    user_id = payload.get('user_id')
    if not user_id:
        return response(401, {'error': 'Требуется авторизация'})

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return response(400, {'error': 'Invalid JSON'})

    try:
        comment_id = int(body.get('comment_id'))
    except (TypeError, ValueError):
        return response(400, {'error': 'comment_id is required'})

    cur = conn.cursor()
    cur.execute(
        f"SELECT id, ticket_id, is_pinned FROM {SCHEMA}.ticket_comments WHERE id = %s",
        (comment_id,),
    )
    row = cur.fetchone()
    if not row:
        cur.close()
        return response(404, {'error': 'Comment not found'})

    new_state = not bool(row['is_pinned'])
    if new_state:
        cur.execute(
            f"""UPDATE {SCHEMA}.ticket_comments
                SET is_pinned = TRUE, pinned_at = NOW(), pinned_by = %s
                WHERE id = %s""",
            (int(user_id), comment_id),
        )
    else:
        cur.execute(
            f"""UPDATE {SCHEMA}.ticket_comments
                SET is_pinned = FALSE, pinned_at = NULL, pinned_by = NULL
                WHERE id = %s""",
            (comment_id,),
        )

    conn.commit()
    cur.close()
    return response(200, {
        'comment_id': comment_id,
        'is_pinned': new_state,
    })


def handle_get_inline(event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Возвращает полный текст комментария с inline base64 картинками.
    Используется фронтендом для подгрузки картинок по требованию (когда has_inline_images=true).
    """
    params = event.get('queryStringParameters') or {}
    try:
        comment_id = int(params.get('comment_id'))
    except (TypeError, ValueError):
        return response(400, {'error': 'comment_id required'})

    cur = conn.cursor()
    cur.execute(
        f"SELECT id, comment, is_internal FROM {SCHEMA}.ticket_comments WHERE id = %s",
        (comment_id,),
    )
    row = cur.fetchone()
    if not row:
        cur.close()
        return response(404, {'error': 'Comment not found'})

    # Скрытый комментарий доступен только Администратору и Исполнителю
    if row['is_internal'] and not _can_see_internal(cur, payload.get('user_id')):
        cur.close()
        return response(404, {'error': 'Comment not found'})

    cur.close()
    return response(200, {
        'id': row['id'],
        'comment': row['comment'],
    })


def handle_get_comments(event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Получение комментариев к заявке"""
    params = event.get('queryStringParameters', {}) or {}
    ticket_id = params.get('ticket_id')

    if not ticket_id:
        return response(400, {'error': 'ticket_id parameter required'})

    user_id = payload.get('user_id')
    tid = int(ticket_id)
    cur = conn.cursor()

    cur.execute(f"""
        SELECT 
            tc.id, tc.ticket_id, tc.user_id, tc.comment,
            tc.is_internal, tc.created_at,
            tc.is_pinned, tc.pinned_at, tc.pinned_by,
            tc.edited_at, tc.edited_by,
            tc.parent_comment_id, tc.mentioned_user_ids,
            u.username as user_name,
            u.full_name as user_full_name,
            u.photo_url as user_photo_url
        FROM {SCHEMA}.ticket_comments tc
        LEFT JOIN {SCHEMA}.users u ON tc.user_id = u.id
        WHERE tc.ticket_id = %s
        ORDER BY tc.created_at DESC
    """, (tid,))

    comments = [dict(row) for row in cur.fetchall()]

    # Скрытые (внутренние) комментарии видят только Администратор и Исполнитель
    if not _can_see_internal(cur, user_id):
        comments = [c for c in comments if not c.get('is_internal')]

    # Вырезаем тяжёлые inline base64-картинки, чтобы ответ влез в лимит Cloud Functions.
    # Помечаем такие комментарии флагом has_inline_images=true, фронтенд может
    # запросить полный текст отдельным запросом ?action=get-inline&comment_id=...
    for c in comments:
        original = c.get('comment') or ''
        if 'base64,' in original:
            stripped = _strip_heavy_inline_images(original, c['id'])
            if stripped != original:
                c['comment'] = stripped
                c['has_inline_images'] = True

    comment_ids = [c['id'] for c in comments]
    reads_map: Dict[int, List[int]] = {cid: [] for cid in comment_ids}
    if comment_ids:
        ids_csv = ','.join(str(int(i)) for i in comment_ids)
        cur.execute(f"""
            SELECT comment_id, user_id FROM {SCHEMA}.ticket_comment_reads
            WHERE comment_id IN ({ids_csv})
        """)
        for r in cur.fetchall():
            reads_map.setdefault(r['comment_id'], []).append(r['user_id'])

    for c in comments:
        author = c['user_id']
        explicit = set(reads_map.get(c['id'], []))
        explicit.add(author)
        c['read_by'] = sorted(explicit)

    # Для последнего (самого нового) комментария отдаём расширенную информацию
    # о прочитавших: ФИО, фото, время прочтения — для индикатора «Просмотрено: ...».
    # Автора комментария в этот список не включаем (он не «читал» — он написал).
    if comments:
        latest = comments[0]  # ORDER BY created_at DESC => первый — самый новый
        latest_id = latest['id']
        cur.execute(f"""
            SELECT r.user_id, r.read_at,
                   u.full_name, u.username, u.photo_url
            FROM {SCHEMA}.ticket_comment_reads r
            LEFT JOIN {SCHEMA}.users u ON u.id = r.user_id
            WHERE r.comment_id = %s AND r.user_id <> %s
            ORDER BY r.read_at ASC
        """, (latest_id, latest['user_id']))
        latest['read_by_users'] = [
            {
                'user_id': r['user_id'],
                'full_name': r.get('full_name') or r.get('username') or '',
                'photo_url': r.get('photo_url'),
                'read_at': r['read_at'].isoformat() if r.get('read_at') else None,
            }
            for r in cur.fetchall()
        ]

    attachments_map: Dict[int, List[Dict[str, Any]]] = {cid: [] for cid in comment_ids}
    if comment_ids:
        ids_csv = ','.join(str(int(i)) for i in comment_ids)
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

    my_last_seen_at = None
    if user_id:
        cur.execute(f"""
            SELECT last_seen_at FROM {SCHEMA}.ticket_views
            WHERE user_id = %s AND ticket_id = %s
        """, (user_id, tid))
        row = cur.fetchone()
        if row:
            my_last_seen_at = row['last_seen_at']

    cur.execute(f"""
        SELECT created_by, assigned_to FROM {SCHEMA}.tickets WHERE id = %s
    """, (tid,))
    t_row = cur.fetchone() or {}
    participant_ids = set()
    if t_row.get('created_by'):
        participant_ids.add(t_row['created_by'])
    if t_row.get('assigned_to'):
        participant_ids.add(t_row['assigned_to'])
    cur.execute(f"SELECT user_id FROM {SCHEMA}.ticket_watchers WHERE ticket_id = %s", (tid,))
    participant_ids.update(r['user_id'] for r in cur.fetchall())
    cur.execute(f"SELECT approver_id FROM {SCHEMA}.ticket_approvers WHERE ticket_id = %s", (tid,))
    participant_ids.update(r['approver_id'] for r in cur.fetchall())

    participants_seen = {}
    if participant_ids:
        ids_list = ','.join(str(int(i)) for i in participant_ids)
        cur.execute(f"""
            SELECT user_id, last_seen_at FROM {SCHEMA}.ticket_views
            WHERE ticket_id = %s AND user_id IN ({ids_list})
        """, (tid,))
        for r in cur.fetchall():
            participants_seen[r['user_id']] = r['last_seen_at'].isoformat() if r['last_seen_at'] else None

    cur.close()

    return response(200, {
        'comments': comments,
        'my_last_seen_at': my_last_seen_at.isoformat() if my_last_seen_at else None,
        'participants_seen': participants_seen,
        'participant_ids': sorted(participant_ids),
    })


def handle_create_comment(event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Создание комментария к заявке"""
    body = json.loads(event.get('body', '{}'))

    try:
        data = CommentRequest(**body)
    except Exception as e:
        return response(400, {'error': f'Validation error: {str(e)}'})

    if not (data.comment or '').strip() and not data.attachments:
        return response(400, {'error': 'Comment text or attachments are required'})

    user_id = payload['user_id']
    cur = conn.cursor()

    cur.execute(f"""
        SELECT t.id, t.assigned_to, t.created_by, t.status_id,
               t.previous_status_id, t.sla_paused_at, t.sla_paused_total_seconds,
               ts.is_reopened, ts.is_waiting_response
        FROM {SCHEMA}.tickets t
        JOIN {SCHEMA}.ticket_statuses ts ON ts.id = t.status_id
        WHERE t.id = %s
    """, (data.ticket_id,))
    ticket = cur.fetchone()
    if not ticket:
        cur.close()
        return response(404, {'error': 'Ticket not found'})

    if ticket['is_reopened'] and ticket['assigned_to'] == user_id:
        cur.close()
        return response(403, {'error': 'Для добавления комментария необходимо сначала принять заявку в работу'})

    cur.execute(f"""
        INSERT INTO {SCHEMA}.ticket_comments 
        (ticket_id, user_id, comment, is_internal, parent_comment_id, mentioned_user_ids, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, NOW())
        RETURNING id, ticket_id, user_id, comment, is_internal, parent_comment_id, mentioned_user_ids, created_at
    """, (
        data.ticket_id, user_id, data.comment or '', data.is_internal,
        data.parent_comment_id,
        data.mentioned_user_ids or None,
    ))

    comment = dict(cur.fetchone())

    saved_attachments: List[Dict[str, Any]] = []
    for att in data.attachments:
        cur.execute(f"""
            INSERT INTO {SCHEMA}.comment_attachments (comment_id, filename, url, size, created_at)
            VALUES (%s, %s, %s, %s, NOW())
            RETURNING id, filename, url, size
        """, (comment['id'], att.filename, att.url, att.size))
        row = cur.fetchone()
        if row:
            saved_attachments.append({
                'id': row['id'],
                'filename': row['filename'],
                'url': row['url'],
                'size': row['size'],
            })
    comment['attachments'] = saved_attachments

    cur.execute(f"""
        INSERT INTO {SCHEMA}.ticket_history 
        (ticket_id, user_id, field_name, old_value, new_value, is_internal, created_at)
        VALUES (%s, %s, 'comment', NULL, %s, %s, NOW())
    """, (data.ticket_id, user_id, f'Добавлен комментарий: {data.comment[:50]}...', data.is_internal))

    is_author_creator = ticket['created_by'] == user_id
    if (
        ticket['is_waiting_response']
        and is_author_creator
        and not data.is_internal
        and ticket['previous_status_id']
    ):
        paused_seconds_to_add = 0
        if ticket['sla_paused_at']:
            cur.execute(
                "SELECT EXTRACT(EPOCH FROM (NOW() - %s))::INTEGER AS sec",
                (ticket['sla_paused_at'],),
            )
            paused_seconds_to_add = cur.fetchone()['sec'] or 0

        cur.execute(f"""
            UPDATE {SCHEMA}.tickets
            SET updated_at = NOW(),
                status_id = %s,
                previous_status_id = NULL,
                sla_paused_at = NULL,
                sla_paused_total_seconds = COALESCE(sla_paused_total_seconds, 0) + %s,
                due_date = CASE WHEN due_date IS NOT NULL
                                THEN due_date + (%s || ' seconds')::INTERVAL
                                ELSE NULL END,
                response_due_date = CASE WHEN response_due_date IS NOT NULL
                                         THEN response_due_date + (%s || ' seconds')::INTERVAL
                                         ELSE NULL END,
                waiting_reminder_sent_at = NULL
            WHERE id = %s
        """, (ticket['previous_status_id'], paused_seconds_to_add,
              paused_seconds_to_add, paused_seconds_to_add, data.ticket_id))

        cur.execute(
            f"SELECT id, name FROM {SCHEMA}.ticket_statuses WHERE id = ANY(%s)",
            ([ticket['status_id'], ticket['previous_status_id']],),
        )
        _status_names_map = {row['id']: row['name'] for row in cur.fetchall()}
        _old_status_name = _status_names_map.get(ticket['status_id']) or str(ticket['status_id'])
        _new_status_name = _status_names_map.get(ticket['previous_status_id']) or str(ticket['previous_status_id'])
        cur.execute(f"""
            INSERT INTO {SCHEMA}.ticket_history
            (ticket_id, user_id, field_name, old_value, new_value, created_at)
            VALUES (%s, %s, 'status_id', %s, %s, NOW())
        """, (data.ticket_id, user_id, _old_status_name, _new_status_name))
    else:
        cur.execute(f"""
            UPDATE {SCHEMA}.tickets
            SET updated_at = NOW()
            WHERE id = %s
        """, (data.ticket_id,))

    try:
        comment_id = comment.get('id')
        comment_text = data.comment or ''
        clean_preview_text = _strip_markdown_images(comment_text)
        preview = (clean_preview_text[:120] + '...') if len(clean_preview_text) > 120 else clean_preview_text

        mentioned = _resolve_mentions(cur, clean_preview_text)
        mentioned_ids = {m['id'] for m in mentioned}
        # Явно переданные с фронта id упомянутых (надёжнее парсинга @имени из текста)
        mentioned_ids |= _resolve_mention_ids(cur, data.mentioned_user_ids)
        mentioned_ids.discard(user_id)

        # В скрытом (внутреннем) комментарии нельзя упоминать тех, кто не видит скрытые
        # (обычных пользователей) — иначе им утечёт текст через уведомления/наблюдение
        if data.is_internal:
            mentioned_ids = {m_id for m_id in mentioned_ids if _can_see_internal(cur, m_id)}

        # Любой упомянутый автоматически становится наблюдателем заявки
        for m_id in mentioned_ids:
            _add_watcher_if_missing(cur, data.ticket_id, m_id)

        if not data.is_internal:
            participants = _participants(cur, data.ticket_id, ticket)
            recipients = participants - {user_id} - mentioned_ids
            for rid in recipients:
                _create_notification(
                    cur, rid, data.ticket_id, 'comment', user_id,
                    f'Новый комментарий: {preview}',
                    comment_id=comment_id,
                )

        for m_id in mentioned_ids:
            _create_notification(
                cur, m_id, data.ticket_id, 'mention', user_id,
                f'Вас упомянули в комментарии: {preview}',
                comment_id=comment_id,
            )
    except Exception as notify_err:
        import traceback
        print(f"[notifications] Error: {notify_err}\n{traceback.format_exc()}")

    cur.execute(f"""
        INSERT INTO {SCHEMA}.ticket_views (user_id, ticket_id, last_seen_at)
        VALUES (%s, %s, NOW())
        ON CONFLICT (user_id, ticket_id) DO UPDATE SET last_seen_at = NOW()
    """, (user_id, data.ticket_id))

    conn.commit()

    cur.execute(f"""
        SELECT username as user_name, full_name as user_full_name, photo_url as user_photo_url
        FROM {SCHEMA}.users WHERE id = %s
    """, (user_id,))
    user_data = dict(cur.fetchone())
    comment.update(user_data)

    try:
        headers = event.get('headers', {})
        origin = headers.get('Origin') or headers.get('origin') or headers.get('Referer') or headers.get('referer') or ''
        if origin:
            origin = origin.rstrip('/')
            parts = origin.replace('https://', '').replace('http://', '')
            if '/' in parts:
                origin = origin.split('/')[0] + '//' + origin.split('/')[2]
        print(f"[bitrix-bot] Sending notification for ticket {data.ticket_id}, author {user_id}")
        send_bitrix_notifications(cur, data.ticket_id, user_id, data.comment, data.is_internal, origin)
    except Exception as e:
        import traceback
        print(f"[bitrix-bot] Error: {e}\n{traceback.format_exc()}")

    try:
        headers = event.get('headers', {})
        origin = headers.get('Origin') or headers.get('origin') or headers.get('Referer') or headers.get('referer') or ''
        if origin:
            origin = origin.rstrip('/')
            parts = origin.replace('https://', '').replace('http://', '')
            if '/' in parts:
                origin = origin.split('/')[0] + '//' + origin.split('/')[2]
        print(f"[max-bot] Sending notification for ticket {data.ticket_id}, author {user_id}")
        max_send_comment_notifications(cur, SCHEMA, data.ticket_id, user_id, data.comment, data.is_internal, origin)
    except Exception as e:
        import traceback
        print(f"[max-bot] Error: {e}\n{traceback.format_exc()}")

    cur.close()
    return response(201, comment)


def _is_admin_user(cur, user_id: int) -> bool:
    """Проверяет, является ли пользователь администратором по ролям из БД"""
    cur.execute(f"""
        SELECT r.name, r.system_role
        FROM {SCHEMA}.user_roles ur
        JOIN {SCHEMA}.roles r ON r.id = ur.role_id
        WHERE ur.user_id = %s
    """, (int(user_id),))
    for row in cur.fetchall():
        name = (row.get('name') or '').strip().lower()
        system_role = (row.get('system_role') or '').strip().lower()
        if system_role == 'admin' or name in ('admin', 'администратор'):
            return True
    return False


def _can_see_internal(cur, user_id: int) -> bool:
    """Скрытые комментарии видят только Администратор и Исполнитель"""
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


def handle_edit_comment(event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Редактирование комментария (только администратор). Можно менять текст и дату создания."""
    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return response(400, {'error': 'Invalid JSON'})

    try:
        comment_id = int(body.get('comment_id') or body.get('id') or 0)
    except (TypeError, ValueError):
        return response(400, {'error': 'comment_id is required'})
    if comment_id <= 0:
        return response(400, {'error': 'comment_id is required'})

    new_text = body.get('comment')
    new_created_at = body.get('created_at')

    if new_text is None and new_created_at is None:
        return response(400, {'error': 'Nothing to update'})

    user_id = payload['user_id']
    cur = conn.cursor()

    if not _is_admin_user(cur, user_id):
        cur.close()
        return response(403, {'error': 'Редактировать комментарии может только администратор'})

    cur.execute(f"""
        SELECT id, ticket_id, comment, created_at, is_internal
        FROM {SCHEMA}.ticket_comments WHERE id = %s
    """, (comment_id,))
    row = cur.fetchone()
    if not row:
        cur.close()
        return response(404, {'error': 'Comment not found'})

    updates: List[str] = []
    args: List[Any] = []
    changed_text = False
    changed_date = False

    if new_text is not None:
        new_text_str = str(new_text)
        if len(new_text_str) > 20000:
            cur.close()
            return response(400, {'error': 'Comment is too long'})
        if not new_text_str.strip():
            cur.execute(
                f"SELECT 1 FROM {SCHEMA}.comment_attachments WHERE comment_id = %s LIMIT 1",
                (comment_id,),
            )
            if not cur.fetchone():
                cur.close()
                return response(400, {'error': 'Текст комментария не может быть пустым'})
        if new_text_str != (row['comment'] or ''):
            updates.append('comment = %s')
            args.append(new_text_str)
            changed_text = True

    if new_created_at is not None:
        try:
            cur.execute("SELECT %s::timestamptz AS ts", (str(new_created_at),))
            parsed = cur.fetchone()['ts']
        except Exception:
            cur.close()
            return response(400, {'error': 'Invalid created_at format'})
        if parsed != row['created_at']:
            updates.append('created_at = %s')
            args.append(parsed)
            changed_date = True

    if not updates:
        cur.close()
        return response(200, {'message': 'Без изменений', 'id': comment_id})

    updates.append('edited_at = NOW()')
    updates.append('edited_by = %s')
    args.append(int(user_id))
    args.append(comment_id)

    cur.execute(
        f"UPDATE {SCHEMA}.ticket_comments SET {', '.join(updates)} WHERE id = %s",
        tuple(args),
    )

    history_parts = []
    if changed_text:
        history_parts.append('текст')
    if changed_date:
        history_parts.append('дата')
    history_msg = f"Изменён комментарий ({', '.join(history_parts)})"

    cur.execute(f"""
        INSERT INTO {SCHEMA}.ticket_history 
        (ticket_id, user_id, field_name, old_value, new_value, is_internal, created_at)
        VALUES (%s, %s, 'comment', %s, %s, %s, NOW())
    """, (row['ticket_id'], user_id, (row['comment'] or '')[:200], history_msg, row.get('is_internal', False)))

    cur.execute(f"""
        SELECT 
            tc.id, tc.ticket_id, tc.user_id, tc.comment,
            tc.is_internal, tc.created_at,
            tc.is_pinned, tc.pinned_at, tc.pinned_by,
            tc.edited_at, tc.edited_by,
            tc.parent_comment_id, tc.mentioned_user_ids,
            u.username as user_name,
            u.full_name as user_full_name,
            u.photo_url as user_photo_url
        FROM {SCHEMA}.ticket_comments tc
        LEFT JOIN {SCHEMA}.users u ON tc.user_id = u.id
        WHERE tc.id = %s
    """, (comment_id,))
    updated = cur.fetchone()

    conn.commit()
    cur.close()

    result = dict(updated) if updated else {'id': comment_id}
    for key in ('created_at', 'edited_at', 'pinned_at'):
        v = result.get(key)
        if v and hasattr(v, 'isoformat'):
            result[key] = v.isoformat()
    return response(200, {'message': 'Комментарий обновлён', 'comment': result})


def handle_delete_comment(event: Dict[str, Any], conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Удаление комментария (только администратор)"""
    body: Dict[str, Any] = {}
    raw_body = event.get('body')
    if raw_body:
        try:
            body = json.loads(raw_body)
        except Exception:
            body = {}

    params = event.get('queryStringParameters') or {}
    comment_id = body.get('id') or body.get('comment_id') or params.get('id') or params.get('comment_id')

    try:
        comment_id = int(comment_id)
    except (TypeError, ValueError):
        return response(400, {'error': 'Comment ID required'})

    user_id = payload['user_id']
    cur = conn.cursor()

    if not _is_admin_user(cur, user_id):
        cur.close()
        return response(403, {'error': 'Удалять комментарии может только администратор'})

    cur.execute(f"""
        SELECT user_id, ticket_id, is_internal FROM {SCHEMA}.ticket_comments WHERE id = %s
    """, (comment_id,))

    comment = cur.fetchone()
    if not comment:
        cur.close()
        return response(404, {'error': 'Comment not found'})

    cur.execute(
        f"DELETE FROM {SCHEMA}.ticket_comment_reads WHERE comment_id = %s",
        (comment_id,),
    )
    cur.execute(
        f"DELETE FROM {SCHEMA}.notifications WHERE comment_id = %s",
        (comment_id,),
    )
    cur.execute(f"DELETE FROM {SCHEMA}.ticket_comments WHERE id = %s", (comment_id,))

    cur.execute(f"""
        INSERT INTO {SCHEMA}.ticket_history 
        (ticket_id, user_id, field_name, old_value, new_value, is_internal, created_at)
        VALUES (%s, %s, 'comment', 'Удален комментарий', NULL, %s, NOW())
    """, (comment['ticket_id'], user_id, comment.get('is_internal', False)))

    conn.commit()
    cur.close()
    return response(200, {'message': 'Комментарий удален', 'id': comment_id})


def _priority_emoji(priority_name: str) -> str:
    name = priority_name.lower()
    if 'критич' in name:
        return '🚨🚨🚨'
    if 'высок' in name:
        return '⚠️⚠️⚠️'
    if 'средн' in name:
        return '🟠🟠🟠'
    return '⚪️⚪️⚪️'


def send_bitrix_notifications(cur, ticket_id: int, author_user_id: int, comment_text: str, is_internal: bool, app_origin: str = ''):
    """Отправляет уведомления через чат-бота DreamDesk в Битрикс24"""
    if not BITRIX_BOT_ID or not BITRIX_PORTAL_URL:
        print(f"[bitrix-bot] Bot not configured (BOT_ID={bool(BITRIX_BOT_ID)}, PORTAL={bool(BITRIX_PORTAL_URL)})")
        return

    cur.execute(f"""
        SELECT t.id, t.title, t.created_by, t.assigned_to,
               author.full_name AS author_name,
               creator.bitrix_user_id AS creator_bitrix_id,
               executor.bitrix_user_id AS executor_bitrix_id,
               p.name AS priority_name
        FROM {SCHEMA}.tickets t
        JOIN {SCHEMA}.users author ON author.id = %s
        LEFT JOIN {SCHEMA}.users creator ON creator.id = t.created_by
        LEFT JOIN {SCHEMA}.users executor ON executor.id = t.assigned_to
        LEFT JOIN {SCHEMA}.ticket_priorities p ON t.priority_id = p.id
        WHERE t.id = %s
    """, (author_user_id, ticket_id))

    row = cur.fetchone()
    if not row:
        return

    cur.execute(f"""
        SELECT tw.user_id, u.bitrix_user_id
        FROM {SCHEMA}.ticket_watchers tw
        JOIN {SCHEMA}.users u ON u.id = tw.user_id
        WHERE tw.ticket_id = %s AND u.bitrix_user_id IS NOT NULL
    """, (ticket_id,))
    watchers = cur.fetchall() or []

    # Для скрытых комментариев исключаем наблюдателей, не имеющих права видеть скрытые
    if is_internal:
        watchers = [w for w in watchers if _can_see_internal(cur, w['user_id'])]

    recipients = _collect_recipients(row, author_user_id, is_internal, watchers)
    if not recipients:
        print(f"[bitrix-bot] No recipients for ticket {ticket_id}")
        return

    clean_text = _strip_markdown_images(comment_text or '')
    preview = clean_text[:150] + ('...' if len(clean_text) > 150 else '')
    ticket_title = row['title'] or f"Заявка #{row['id']}"

    ticket_url = ''
    if app_origin:
        ticket_url = f"{app_origin}/tickets/{row['id']}"

    access_token = _get_bot_token()
    if not access_token:
        print("[bitrix-bot] Failed to get access token")
        return

    priority_emoji = _priority_emoji(row.get('priority_name') or '')

    for r in recipients:
        message = (
            f"{priority_emoji} [b]Новый комментарий в заявке #{row['id']}[/b]\n"
            f"{ticket_title}\n\n"
            f"[b]{row['author_name']}[/b]: {preview}"
        )

        keyboard = []
        if ticket_url:
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

        _send_bot_message(access_token, r['bitrix_id'], message, keyboard)


def _collect_recipients(row, author_user_id: int, is_internal: bool, watchers=None) -> List[dict]:
    """Определяет получателей уведомления"""
    recipients = []
    seen = set()

    def add(bitrix_id, role):
        if bitrix_id and bitrix_id not in seen:
            seen.add(bitrix_id)
            recipients.append({'bitrix_id': bitrix_id, 'role': role})

    if is_internal:
        if row['assigned_to'] and row['assigned_to'] != author_user_id:
            add(row.get('executor_bitrix_id'), 'executor')
        for w in (watchers or []):
            if w['user_id'] != author_user_id:
                add(w['bitrix_user_id'], 'watcher')
        return recipients

    if row['created_by'] != author_user_id:
        add(row.get('creator_bitrix_id'), 'creator')

    if row['assigned_to'] and row['assigned_to'] != author_user_id:
        add(row.get('executor_bitrix_id'), 'executor')

    for w in (watchers or []):
        if w['user_id'] != author_user_id:
            add(w['bitrix_user_id'], 'watcher')

    return recipients


def _get_bot_token() -> str:
    """Получает access_token для бота, обновляя через refresh_token"""
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

    try:
        req = urllib.request.Request(url, method='GET')
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            _bot_access_token = data.get('access_token', '')
            new_refresh = data.get('refresh_token', '')
            if new_refresh:
                print(f"[bitrix-bot] Token refreshed. New refresh_token: {new_refresh[:20]}...")
            return _bot_access_token
    except Exception as e:
        print(f"[bitrix-bot] Token refresh failed: {e}")
        return ''


def _send_bot_message(access_token: str, bitrix_user_id: str, message: str, keyboard: list = None):
    """Отправляет сообщение от имени чат-бота DreamDesk"""
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
        with urllib.request.urlopen(req, timeout=5) as r:
            result = json.loads(r.read().decode())
            print(f"[bitrix-bot] Message sent to {bitrix_user_id}: {result.get('result', 'unknown')}")
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ''
        print(f"[bitrix-bot] HTTP {e.code} sending to {bitrix_user_id}: {body[:300]}")
    except Exception as e:
        print(f"[bitrix-bot] Failed to send to {bitrix_user_id}: {e}")