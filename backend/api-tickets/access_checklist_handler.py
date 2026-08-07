"""
Чек-лист блокировки доступов.

Список сервисов, из которых нужно удалить/заблокировать учётную запись
увольняющегося сотрудника. Привязан к конкретной заявке и создаётся только
для услуг с признаком requires_access_checklist.

Главное правило: заявку нельзя перевести в закрывающий статус, пока есть
пункты в статусе pending.
"""
from typing import Dict, Any, List, Optional

from shared_utils import response, verify_token, SCHEMA

# Допустимые статусы пункта чек-листа
STATUS_PENDING = 'pending'
STATUS_DONE = 'done'
STATUS_NOT_APPLICABLE = 'not_applicable'
ALLOWED_STATUSES = (STATUS_PENDING, STATUS_DONE, STATUS_NOT_APPLICABLE)


# ---------------------------------------------------------------------------
# Вспомогательные функции (используются и из index.py)
# ---------------------------------------------------------------------------

def ticket_requires_checklist(cur, ticket_id: int) -> bool:
    """Требует ли заявка чек-лист блокировки доступов.

    Определяется признаком requires_access_checklist у привязанной услуги,
    без привязки к названию услуги.
    """
    cur.execute(
        f"""
        SELECT 1
        FROM {SCHEMA}.ticket_to_service_mappings m
        JOIN {SCHEMA}.ticket_services ts ON ts.id = m.ticket_service_id
        WHERE m.ticket_id = %s
          AND COALESCE(ts.requires_access_checklist, false) = true
        LIMIT 1
        """,
        (ticket_id,),
    )
    return cur.fetchone() is not None


def service_requires_checklist(cur, ticket_service_id: Optional[int]) -> bool:
    """Требует ли конкретная услуга чек-лист блокировки доступов."""
    if not ticket_service_id:
        return False
    cur.execute(
        f"""
        SELECT COALESCE(requires_access_checklist, false) AS req
        FROM {SCHEMA}.ticket_services
        WHERE id = %s
        """,
        (int(ticket_service_id),),
    )
    row = cur.fetchone()
    return bool(row and row['req'])


def ensure_checklist_items(cur, ticket_id: int) -> int:
    """Создаёт пункты чек-листа для заявки, если их ещё нет.

    Возвращает количество созданных пунктов. Повторный вызов ничего не меняет,
    поэтому уже проставленные отметки не теряются при смене типа заявки
    туда-обратно.
    """
    cur.execute(
        f"SELECT COUNT(*) AS cnt FROM {SCHEMA}.ticket_access_checklist_items WHERE ticket_id = %s",
        (ticket_id,),
    )
    row = cur.fetchone()
    if row and int(row['cnt']) > 0:
        return 0

    # Состав чек-листа фиксируется на момент создания: новые сервисы
    # в справочнике на уже существующие заявки не влияют.
    cur.execute(
        f"""
        INSERT INTO {SCHEMA}.ticket_access_checklist_items
            (ticket_id, service_id, service_name, sort_order, status)
        SELECT %s, s.id, s.name, s.sort_order, %s
        FROM {SCHEMA}.access_checklist_services s
        WHERE s.is_active = true
        ORDER BY s.sort_order, s.id
        """,
        (ticket_id, STATUS_PENDING),
    )
    return cur.rowcount or 0


def sync_checklist_for_ticket(cur, ticket_id: int) -> int:
    """Создаёт чек-лист, если заявка этого требует. Иначе ничего не делает.

    Пункты никогда не удаляются: при смене услуги на другую чек-лист просто
    перестаёт показываться, а данные сохраняются.
    """
    if not ticket_requires_checklist(cur, ticket_id):
        return 0
    return ensure_checklist_items(cur, ticket_id)


def get_pending_items(cur, ticket_id: int) -> List[Dict[str, Any]]:
    """Незакрытые пункты чек-листа заявки."""
    cur.execute(
        f"""
        SELECT id, service_name
        FROM {SCHEMA}.ticket_access_checklist_items
        WHERE ticket_id = %s AND status = %s
        ORDER BY sort_order, id
        """,
        (ticket_id, STATUS_PENDING),
    )
    return list(cur.fetchall())


def check_can_close(cur, ticket_id: int, new_status_id: int) -> Optional[Dict[str, Any]]:
    """Проверяет, можно ли перевести заявку в указанный статус.

    Возвращает готовый ответ с ошибкой, если переход запрещён, иначе None.
    Блокируются статусы: закрывающие (is_closed) и «ожидает подтверждения»
    (is_pending_confirmation).
    """
    cur.execute(
        f"""
        SELECT name,
               COALESCE(is_closed, false) AS is_closed,
               COALESCE(is_pending_confirmation, false) AS is_pending_confirmation
        FROM {SCHEMA}.ticket_statuses
        WHERE id = %s
        """,
        (int(new_status_id),),
    )
    status = cur.fetchone()
    if not status:
        return None

    if not (status['is_closed'] or status['is_pending_confirmation']):
        return None

    if not ticket_requires_checklist(cur, ticket_id):
        return None

    pending = get_pending_items(cur, ticket_id)
    if not pending:
        return None

    names = [p['service_name'] for p in pending]
    return response(409, {
        'error': (
            f'Нельзя перевести заявку в статус «{status["name"]}»: '
            f'в чек-листе блокировки доступов не отмечено пунктов — {len(names)}'
        ),
        'code': 'access_checklist_pending',
        'pending_items': names,
        'pending_count': len(names),
    })


# ---------------------------------------------------------------------------
# Права
# ---------------------------------------------------------------------------

def _is_admin(cur, user_id: int) -> bool:
    cur.execute(
        f"""
        SELECT 1
        FROM {SCHEMA}.user_roles ur
        JOIN {SCHEMA}.roles r ON r.id = ur.role_id
        WHERE ur.user_id = %s AND lower(COALESCE(r.system_role, '')) = 'admin'
        LIMIT 1
        """,
        (int(user_id),),
    )
    return cur.fetchone() is not None


def _is_support(cur, user_id: int) -> bool:
    """Сотрудник поддержки: исполнитель или администратор по системной роли."""
    cur.execute(
        f"""
        SELECT r.name, r.system_role
        FROM {SCHEMA}.user_roles ur
        JOIN {SCHEMA}.roles r ON r.id = ur.role_id
        WHERE ur.user_id = %s
        """,
        (int(user_id),),
    )
    for row in cur.fetchall():
        system_role = (row.get('system_role') or '').strip().lower()
        name = (row.get('name') or '').strip().lower()
        if system_role in ('admin', 'executor') or name in ('admin', 'администратор', 'исполнитель'):
            return True
    return False


def can_view_checklist(cur, ticket_id: int, user_id: int) -> bool:
    """Чек-лист — внутренняя кухня поддержки, заявитель его не видит."""
    if _is_support(cur, user_id):
        return True
    cur.execute(
        f"SELECT assigned_to FROM {SCHEMA}.tickets WHERE id = %s",
        (int(ticket_id),),
    )
    row = cur.fetchone()
    return bool(row and row.get('assigned_to') == int(user_id))


def can_edit_checklist(cur, ticket_id: int, user_id: int) -> bool:
    """Отмечать пункты может исполнитель заявки, поддержка и администраторы."""
    return can_view_checklist(cur, ticket_id, user_id)


# ---------------------------------------------------------------------------
# HTTP-обработчики
# ---------------------------------------------------------------------------

def _serialize_items(cur, ticket_id: int) -> List[Dict[str, Any]]:
    cur.execute(
        f"""
        SELECT i.id, i.service_id, i.service_name, i.sort_order, i.status,
               i.comment, i.completed_by_user_id, i.completed_at,
               u.full_name AS completed_by_name, u.username AS completed_by_username
        FROM {SCHEMA}.ticket_access_checklist_items i
        LEFT JOIN {SCHEMA}.users u ON u.id = i.completed_by_user_id
        WHERE i.ticket_id = %s
        ORDER BY i.sort_order, i.id
        """,
        (int(ticket_id),),
    )
    return list(cur.fetchall())


def handle_ticket_access_checklist(method: str, event: dict, conn) -> dict:
    """Чек-лист блокировки доступов конкретной заявки.

    GET  ?endpoint=ticket-access-checklist&ticket_id=123 — получить пункты
    PUT  ?endpoint=ticket-access-checklist&item_id=45    — изменить статус пункта
    """
    import json

    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    user_id = int(payload['user_id'])

    params = event.get('queryStringParameters') or {}
    cur = conn.cursor()

    try:
        if method == 'GET':
            ticket_id = params.get('ticket_id')
            if not ticket_id:
                return response(400, {'error': 'Не указан ticket_id'})
            ticket_id = int(ticket_id)

            required = ticket_requires_checklist(cur, ticket_id)
            if not required or not can_view_checklist(cur, ticket_id, user_id):
                # Заявитель и заявки без чек-листа: блок не показываем
                return response(200, {'required': False, 'items': [], 'can_edit': False})

            items = _serialize_items(cur, ticket_id)
            pending = sum(1 for i in items if i['status'] == STATUS_PENDING)
            return response(200, {
                'required': True,
                'items': items,
                'total': len(items),
                'completed': len(items) - pending,
                'pending': pending,
                'can_edit': can_edit_checklist(cur, ticket_id, user_id),
            })

        if method == 'PUT':
            item_id = params.get('item_id')
            if not item_id:
                return response(400, {'error': 'Не указан item_id'})
            item_id = int(item_id)

            body = json.loads(event.get('body') or '{}')
            new_status = (body.get('status') or '').strip()
            comment = body.get('comment')
            comment = comment.strip() if isinstance(comment, str) else None

            if new_status not in ALLOWED_STATUSES:
                return response(400, {'error': 'Недопустимый статус пункта'})

            if new_status == STATUS_NOT_APPLICABLE and not comment:
                return response(400, {
                    'error': 'Для статуса «Не применимо» нужно указать комментарий',
                    'code': 'comment_required',
                })

            cur.execute(
                f"SELECT ticket_id FROM {SCHEMA}.ticket_access_checklist_items WHERE id = %s",
                (item_id,),
            )
            item = cur.fetchone()
            if not item:
                return response(404, {'error': 'Пункт чек-листа не найден'})

            ticket_id = int(item['ticket_id'])
            if not can_edit_checklist(cur, ticket_id, user_id):
                return response(403, {'error': 'Недостаточно прав для изменения чек-листа'})

            if new_status == STATUS_PENDING:
                cur.execute(
                    f"""
                    UPDATE {SCHEMA}.ticket_access_checklist_items
                    SET status = %s, comment = %s,
                        completed_by_user_id = NULL, completed_at = NULL,
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (STATUS_PENDING, comment, item_id),
                )
            else:
                cur.execute(
                    f"""
                    UPDATE {SCHEMA}.ticket_access_checklist_items
                    SET status = %s, comment = %s,
                        completed_by_user_id = %s, completed_at = NOW(),
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (new_status, comment, user_id, item_id),
                )

            conn.commit()
            items = _serialize_items(cur, ticket_id)
            pending = sum(1 for i in items if i['status'] == STATUS_PENDING)
            return response(200, {
                'required': True,
                'items': items,
                'total': len(items),
                'completed': len(items) - pending,
                'pending': pending,
                'can_edit': True,
            })

        return response(405, {'error': 'Метод не поддерживается'})
    finally:
        cur.close()


def handle_access_checklist_services(method: str, event: dict, conn) -> dict:
    """Справочник сервисов чек-листа. Редактирование — только администратор.

    GET    ?endpoint=access-checklist-services
    POST   ?endpoint=access-checklist-services
    PUT    ?endpoint=access-checklist-services&id=5
    DELETE ?endpoint=access-checklist-services&id=5
    """
    import json

    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    user_id = int(payload['user_id'])

    params = event.get('queryStringParameters') or {}
    cur = conn.cursor()

    try:
        if method == 'GET':
            cur.execute(
                f"""
                SELECT id, name, sort_order, is_active, created_at, updated_at
                FROM {SCHEMA}.access_checklist_services
                ORDER BY sort_order, id
                """
            )
            return response(200, {'services': list(cur.fetchall())})

        if not _is_admin(cur, user_id):
            return response(403, {'error': 'Справочник может изменять только администратор'})

        if method == 'POST':
            body = json.loads(event.get('body') or '{}')
            name = (body.get('name') or '').strip()
            if not name:
                return response(400, {'error': 'Укажите название сервиса'})
            if len(name) > 255:
                return response(400, {'error': 'Название не должно превышать 255 символов'})

            sort_order = body.get('sort_order')
            if sort_order is None:
                cur.execute(
                    f"SELECT COALESCE(MAX(sort_order), 0) + 10 AS next FROM {SCHEMA}.access_checklist_services"
                )
                sort_order = int(cur.fetchone()['next'])

            cur.execute(
                f"""
                INSERT INTO {SCHEMA}.access_checklist_services (name, sort_order, is_active)
                VALUES (%s, %s, %s)
                RETURNING id, name, sort_order, is_active
                """,
                (name, int(sort_order), bool(body.get('is_active', True))),
            )
            created = cur.fetchone()
            conn.commit()
            return response(201, dict(created))

        if method == 'PUT':
            service_id = params.get('id')
            if not service_id:
                return response(400, {'error': 'Не указан id сервиса'})
            body = json.loads(event.get('body') or '{}')

            fields, values = [], []
            if 'name' in body:
                name = (body.get('name') or '').strip()
                if not name:
                    return response(400, {'error': 'Укажите название сервиса'})
                if len(name) > 255:
                    return response(400, {'error': 'Название не должно превышать 255 символов'})
                fields.append('name = %s')
                values.append(name)
            if 'sort_order' in body:
                fields.append('sort_order = %s')
                values.append(int(body['sort_order']))
            if 'is_active' in body:
                fields.append('is_active = %s')
                values.append(bool(body['is_active']))

            if not fields:
                return response(400, {'error': 'Нет полей для обновления'})

            fields.append('updated_at = NOW()')
            values.append(int(service_id))
            cur.execute(
                f"""
                UPDATE {SCHEMA}.access_checklist_services
                SET {', '.join(fields)}
                WHERE id = %s
                RETURNING id, name, sort_order, is_active
                """,
                values,
            )
            updated = cur.fetchone()
            if not updated:
                return response(404, {'error': 'Сервис не найден'})
            conn.commit()
            return response(200, dict(updated))

        if method == 'DELETE':
            service_id = params.get('id')
            if not service_id:
                return response(400, {'error': 'Не указан id сервиса'})
            # Пункты уже созданных заявок сохраняются: у них service_id обнуляется,
            # название хранится в самой строке пункта.
            cur.execute(
                f"UPDATE {SCHEMA}.ticket_access_checklist_items SET service_id = NULL WHERE service_id = %s",
                (int(service_id),),
            )
            cur.execute(
                f"DELETE FROM {SCHEMA}.access_checklist_services WHERE id = %s RETURNING id",
                (int(service_id),),
            )
            deleted = cur.fetchone()
            if not deleted:
                return response(404, {'error': 'Сервис не найден'})
            conn.commit()
            return response(200, {'success': True, 'id': deleted['id']})

        return response(405, {'error': 'Метод не поддерживается'})
    finally:
        cur.close()
