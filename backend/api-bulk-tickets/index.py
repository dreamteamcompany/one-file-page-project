"""
API для массовых операций с заявками
"""
import json
import os
import sys
import jwt
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any, Optional

def log(msg):
    print(msg, file=sys.stderr, flush=True)

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p67567221_one_file_page_projec')

def response(status_code: int, body: Any) -> Dict[str, Any]:
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, Authorization',
            'Access-Control-Max-Age': '86400',
        },
        'body': json.dumps(body, ensure_ascii=False, default=str),
        'isBase64Encoded': False
    }

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        raise Exception('DATABASE_URL not found')
    return psycopg2.connect(dsn, options=f'-c search_path={SCHEMA},public')

def get_name_by_id(cur, table: str, id_val) -> Optional[str]:
    """Получить name по id из справочной таблицы (ticket_statuses, ticket_priorities, executor_groups)"""
    if id_val is None:
        return None
    try:
        cur.execute(f"SELECT name FROM {SCHEMA}.{table} WHERE id = %s", (id_val,))
        row = cur.fetchone()
        if not row:
            return str(id_val)
        return row[0] if not isinstance(row, dict) else row['name']
    except Exception:
        return str(id_val)


def get_user_full_name(cur, user_id) -> Optional[str]:
    """Получить full_name пользователя по id"""
    if user_id is None:
        return None
    try:
        cur.execute(f"SELECT full_name FROM {SCHEMA}.users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        if not row:
            return str(user_id)
        return row[0] if not isinstance(row, dict) else row['full_name']
    except Exception:
        return str(user_id)


def log_bulk_history(cur, ticket_ids: list, user_id: int, field_name: str,
                     old_values_by_ticket: Dict[int, Optional[str]],
                     new_value: Optional[str]) -> None:
    """Записать одинаковое изменение поля для группы заявок в ticket_history.

    old_values_by_ticket: {ticket_id: старое_значение_строкой}
    new_value: новое значение строкой (одинаковое для всех)
    """
    if not ticket_ids:
        return
    try:
        for tid in ticket_ids:
            old_val = old_values_by_ticket.get(tid)
            if old_val == new_value:
                continue
            cur.execute(
                f"""INSERT INTO {SCHEMA}.ticket_history
                    (ticket_id, user_id, field_name, old_value, new_value, created_at)
                    VALUES (%s, %s, %s, %s, %s, NOW())""",
                (tid, user_id, field_name, old_val, new_value)
            )
    except Exception as e:
        log(f"[BULK-TICKETS] history insert error: {e}")


def fetch_old_values(cur, ticket_ids: list, column: str) -> Dict[int, Any]:
    """Получить старые значения поля для пакета заявок: {ticket_id: value}"""
    if not ticket_ids:
        return {}
    placeholders = ','.join(['%s'] * len(ticket_ids))
    cur.execute(
        f"SELECT id, {column} FROM {SCHEMA}.tickets WHERE id IN ({placeholders})",
        ticket_ids
    )
    rows = cur.fetchall()
    result = {}
    for r in rows:
        if isinstance(r, dict):
            result[r['id']] = r.get(column)
        else:
            result[r[0]] = r[1]
    return result


def verify_token(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
    if not token:
        return None
    
    secret = os.environ.get('JWT_SECRET')
    if not secret:
        return None
    
    try:
        payload = jwt.decode(token, secret, algorithms=['HS256'])
        return payload
    except:
        return None

def handler(event, context):
    """API эндпоинт для массовых операций с заявками"""
    
    if event.get('httpMethod') == 'OPTIONS':
        return response(200, {'message': 'OK'})
    
    method = event.get('httpMethod', 'POST')
    
    if method != 'POST':
        return response(405, {'error': 'Только POST метод разрешен'})
    
    payload = verify_token(event)
    
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    
    try:
        conn = get_db_connection()
    except Exception as e:
        return response(500, {'error': 'Database connection failed'})
    
    try:
        body = json.loads(event.get('body', '{}'))
        action = body.get('action')
        ticket_ids = body.get('ticket_ids', [])
        
        log(f"[BULK-TICKETS] Action: {action}, IDs count: {len(ticket_ids)}")
        
        if not ticket_ids:
            return response(400, {'error': 'Не указаны ID заявок'})
        
        if not action:
            return response(400, {'error': 'Не указано действие'})
        
        cur = conn.cursor()
        successful = 0
        
        if action == 'delete':
            # Массовое удаление заявок
            placeholders = ','.join(['%s'] * len(ticket_ids))
            log(f"[BULK-TICKETS] Deleting tickets: {ticket_ids}")
            
            # Удаляем все связанные записи перед удалением заявок
            try:
                cur.execute(f"DELETE FROM {SCHEMA}.notifications WHERE ticket_id IN ({placeholders})", ticket_ids)
                log(f"[BULK-TICKETS] Deleted notifications: {cur.rowcount}")
            except Exception as e:
                log(f"[BULK-TICKETS] Error deleting notifications: {e}")
            
            try:
                cur.execute(f"DELETE FROM {SCHEMA}.ticket_history WHERE ticket_id IN ({placeholders})", ticket_ids)
                log(f"[BULK-TICKETS] Deleted history: {cur.rowcount}")
            except Exception as e:
                log(f"[BULK-TICKETS] Error deleting history: {e}")
            
            try:
                cur.execute(f"""
                    DELETE FROM {SCHEMA}.comment_attachments
                    WHERE comment_id IN (SELECT id FROM {SCHEMA}.ticket_comments WHERE ticket_id IN ({placeholders}))
                """, ticket_ids)
                log(f"[BULK-TICKETS] Deleted comment attachments: {cur.rowcount}")
            except Exception as e:
                log(f"[BULK-TICKETS] Error deleting comment attachments: {e}")
            
            try:
                cur.execute(f"""
                    DELETE FROM {SCHEMA}.comment_reactions
                    WHERE comment_id IN (SELECT id FROM {SCHEMA}.ticket_comments WHERE ticket_id IN ({placeholders}))
                """, ticket_ids)
                log(f"[BULK-TICKETS] Deleted comment reactions: {cur.rowcount}")
            except Exception as e:
                log(f"[BULK-TICKETS] Error deleting comment reactions: {e}")
            
            try:
                cur.execute(f"DELETE FROM {SCHEMA}.ticket_comments WHERE ticket_id IN ({placeholders})", ticket_ids)
                log(f"[BULK-TICKETS] Deleted comments: {cur.rowcount}")
            except Exception as e:
                log(f"[BULK-TICKETS] Error deleting comments: {e}")
            
            try:
                cur.execute(f"DELETE FROM {SCHEMA}.ticket_to_service_mappings WHERE ticket_id IN ({placeholders})", ticket_ids)
                log(f"[BULK-TICKETS] Deleted service mappings: {cur.rowcount}")
            except Exception as e:
                log(f"[BULK-TICKETS] Error deleting mappings: {e}")
            
            try:
                cur.execute(f"DELETE FROM {SCHEMA}.ticket_custom_field_values WHERE ticket_id IN ({placeholders})", ticket_ids)
                log(f"[BULK-TICKETS] Deleted custom fields: {cur.rowcount}")
            except Exception as e:
                log(f"[BULK-TICKETS] Error deleting custom fields: {e}")
            
            try:
                cur.execute(f"DELETE FROM {SCHEMA}.ticket_approvals WHERE ticket_id IN ({placeholders})", ticket_ids)
                log(f"[BULK-TICKETS] Deleted approvals: {cur.rowcount}")
            except Exception as e:
                log(f"[BULK-TICKETS] Error deleting approvals: {e}")
            
            try:
                cur.execute(f"DELETE FROM {SCHEMA}.ticket_watchers WHERE ticket_id IN ({placeholders})", ticket_ids)
                log(f"[BULK-TICKETS] Deleted watchers: {cur.rowcount}")
            except Exception as e:
                log(f"[BULK-TICKETS] Error deleting watchers: {e}")
            
            try:
                cur.execute(f"DELETE FROM {SCHEMA}.ticket_group_log WHERE ticket_id IN ({placeholders})", ticket_ids)
                log(f"[BULK-TICKETS] Deleted group log: {cur.rowcount}")
            except Exception as e:
                log(f"[BULK-TICKETS] Error deleting group log: {e}")
            
            try:
                cur.execute(f"DELETE FROM {SCHEMA}.sla_violations WHERE ticket_id IN ({placeholders})", ticket_ids)
                log(f"[BULK-TICKETS] Deleted SLA violations: {cur.rowcount}")
            except Exception as e:
                log(f"[BULK-TICKETS] Error deleting SLA violations: {e}")
            
            try:
                cur.execute(f"DELETE FROM {SCHEMA}.ticket_service_mappings WHERE ticket_id IN ({placeholders})", ticket_ids)
                log(f"[BULK-TICKETS] Deleted service mappings (old): {cur.rowcount}")
            except Exception as e:
                log(f"[BULK-TICKETS] Error deleting service mappings (old): {e}")
            
            # Теперь удаляем сами заявки
            cur.execute(f"DELETE FROM {SCHEMA}.tickets WHERE id IN ({placeholders})", ticket_ids)
            successful = cur.rowcount
            conn.commit()
            
            log(f"[BULK-TICKETS] Successfully deleted {successful} tickets")
            
            return response(200, {
                'total': len(ticket_ids),
                'successful': successful,
                'message': f'Удалено {successful} заявок'
            })
        
        elif action == 'change_status':
            status_id = body.get('status_id')
            if not status_id:
                return response(400, {'error': 'Не указан status_id'})

            try:
                status_id_int = int(status_id)
            except (TypeError, ValueError):
                return response(400, {'error': 'status_id должен быть числом'})

            cur.execute(f"SELECT id, is_closed FROM {SCHEMA}.ticket_statuses WHERE id = %s", (status_id_int,))
            status_row = cur.fetchone()
            if not status_row:
                log(f"[BULK-TICKETS] Status {status_id_int} not found in ticket_statuses")
                return response(400, {
                    'error': f'Статус #{status_id_int} не существует. Обновите страницу и выберите статус заново.'
                })
            archive_val = bool(status_row[1])

            try:
                ticket_ids_int = [int(x) for x in ticket_ids]
            except (TypeError, ValueError):
                return response(400, {'error': 'ticket_ids должны быть числами'})

            # Чек-лист блокировки доступов: заявку нельзя закрыть или отправить
            # на подтверждение, пока есть неотмеченные пункты.
            cur.execute(
                f"""
                SELECT COALESCE(is_closed, false) OR COALESCE(is_pending_confirmation, false) AS blocking
                FROM {SCHEMA}.ticket_statuses WHERE id = %s
                """,
                (status_id_int,),
            )
            _blocking_row = cur.fetchone()
            if _blocking_row and _blocking_row[0]:
                ph = ','.join(['%s'] * len(ticket_ids_int))
                cur.execute(
                    f"""
                    SELECT t.id, COUNT(i.id) AS pending
                    FROM {SCHEMA}.tickets t
                    JOIN {SCHEMA}.ticket_to_service_mappings m ON m.ticket_id = t.id
                    JOIN {SCHEMA}.ticket_services ts ON ts.id = m.ticket_service_id
                    JOIN {SCHEMA}.ticket_access_checklist_items i
                      ON i.ticket_id = t.id AND i.status = 'pending'
                    WHERE t.id IN ({ph})
                      AND COALESCE(ts.requires_access_checklist, false) = true
                    GROUP BY t.id
                    ORDER BY t.id
                    """,
                    ticket_ids_int,
                )
                blocked_rows = cur.fetchall()
                if blocked_rows:
                    blocked_ids = [str(r[0]) for r in blocked_rows]
                    return response(409, {
                        'error': (
                            'Нельзя закрыть заявки с незаполненным чек-листом блокировки '
                            f'доступов: №{", №".join(blocked_ids)}'
                        ),
                        'code': 'access_checklist_pending',
                        'blocked_ticket_ids': [r[0] for r in blocked_rows],
                    })

            old_status_ids = fetch_old_values(cur, ticket_ids_int, 'status_id')
            new_status_name = get_name_by_id(cur, 'ticket_statuses', status_id_int)
            old_status_names = {
                tid: get_name_by_id(cur, 'ticket_statuses', old_id) if old_id else None
                for tid, old_id in old_status_ids.items()
            }

            placeholders = ','.join(['%s'] * len(ticket_ids_int))
            try:
                cur.execute(f"""
                    UPDATE {SCHEMA}.tickets
                    SET status_id = %s, is_archived = %s, updated_at = NOW()
                    WHERE id IN ({placeholders})
                """, [status_id_int, archive_val] + ticket_ids_int)
                successful = cur.rowcount

                log_bulk_history(
                    cur, ticket_ids_int, payload.get('user_id'),
                    'status_id', old_status_names, new_status_name
                )

                conn.commit()
            except psycopg2.errors.ForeignKeyViolation as fk_err:
                conn.rollback()
                log(f"[BULK-TICKETS] FK violation on change_status: {fk_err}")
                return response(400, {
                    'error': 'Невозможно применить статус: связанные данные некорректны. Обновите страницу.'
                })
            except Exception as upd_err:
                conn.rollback()
                log(f"[BULK-TICKETS] Update error on change_status: {upd_err}")
                return response(500, {'error': f'Ошибка обновления: {upd_err}'})

            return response(200, {
                'total': len(ticket_ids_int),
                'successful': successful,
                'message': f'Обновлено {successful} заявок'
            })
        
        elif action == 'change_priority':
            priority_id = body.get('priority_id')
            if not priority_id:
                return response(400, {'error': 'Не указан priority_id'})

            try:
                priority_id_int = int(priority_id)
                ticket_ids_int = [int(x) for x in ticket_ids]
            except (TypeError, ValueError):
                return response(400, {'error': 'priority_id и ticket_ids должны быть числами'})

            cur.execute(f"SELECT 1 FROM {SCHEMA}.ticket_priorities WHERE id = %s", (priority_id_int,))
            if not cur.fetchone():
                return response(400, {
                    'error': f'Приоритет #{priority_id_int} не существует. Обновите страницу.'
                })

            old_priority_ids = fetch_old_values(cur, ticket_ids_int, 'priority_id')
            new_priority_name = get_name_by_id(cur, 'ticket_priorities', priority_id_int)
            old_priority_names = {
                tid: get_name_by_id(cur, 'ticket_priorities', old_id) if old_id else None
                for tid, old_id in old_priority_ids.items()
            }

            placeholders = ','.join(['%s'] * len(ticket_ids_int))
            try:
                cur.execute(f"""
                    UPDATE {SCHEMA}.tickets
                    SET priority_id = %s, updated_at = NOW()
                    WHERE id IN ({placeholders})
                """, [priority_id_int] + ticket_ids_int)
                successful = cur.rowcount

                log_bulk_history(
                    cur, ticket_ids_int, payload.get('user_id'),
                    'priority_id', old_priority_names, new_priority_name
                )

                conn.commit()
            except psycopg2.errors.ForeignKeyViolation as fk_err:
                conn.rollback()
                log(f"[BULK-TICKETS] FK violation on change_priority: {fk_err}")
                return response(400, {
                    'error': 'Невозможно применить приоритет: связанные данные некорректны.'
                })
            except Exception as upd_err:
                conn.rollback()
                log(f"[BULK-TICKETS] Update error on change_priority: {upd_err}")
                return response(500, {'error': f'Ошибка обновления: {upd_err}'})

            return response(200, {
                'total': len(ticket_ids_int),
                'successful': successful,
                'message': f'Обновлено {successful} заявок'
            })

        elif action == 'change_executor':
            user_id = body.get('user_id')

            try:
                ticket_ids_int = [int(x) for x in ticket_ids]
                user_id_int = int(user_id) if user_id else None
            except (TypeError, ValueError):
                return response(400, {'error': 'user_id и ticket_ids должны быть числами'})

            if user_id_int is not None:
                cur.execute(f"SELECT 1 FROM {SCHEMA}.users WHERE id = %s", (user_id_int,))
                if not cur.fetchone():
                    return response(400, {
                        'error': f'Пользователь #{user_id_int} не найден.'
                    })

            old_executor_ids = fetch_old_values(cur, ticket_ids_int, 'assigned_to')
            new_executor_name = get_user_full_name(cur, user_id_int) if user_id_int else 'Снят с назначения'
            old_executor_names = {
                tid: (get_user_full_name(cur, old_id) if old_id else 'Не назначен')
                for tid, old_id in old_executor_ids.items()
            }

            placeholders = ','.join(['%s'] * len(ticket_ids_int))
            try:
                cur.execute(f"""
                    UPDATE {SCHEMA}.tickets
                    SET assigned_to = %s, updated_at = NOW()
                    WHERE id IN ({placeholders})
                """, [user_id_int] + ticket_ids_int)
                successful = cur.rowcount

                log_bulk_history(
                    cur, ticket_ids_int, payload.get('user_id'),
                    'assigned_to', old_executor_names, new_executor_name
                )

                conn.commit()
            except psycopg2.errors.ForeignKeyViolation as fk_err:
                conn.rollback()
                log(f"[BULK-TICKETS] FK violation on change_executor: {fk_err}")
                return response(400, {'error': 'Невозможно назначить исполнителя.'})
            except Exception as upd_err:
                conn.rollback()
                log(f"[BULK-TICKETS] Update error on change_executor: {upd_err}")
                return response(500, {'error': f'Ошибка обновления: {upd_err}'})

            return response(200, {
                'total': len(ticket_ids_int),
                'successful': successful,
                'message': f'Обновлено {successful} заявок'
            })

        elif action == 'change_executor_group':
            group_id = body.get('group_id')

            try:
                ticket_ids_int = [int(x) for x in ticket_ids]
                group_id_int = int(group_id) if group_id else None
            except (TypeError, ValueError):
                return response(400, {'error': 'group_id и ticket_ids должны быть числами'})

            if group_id_int is not None:
                cur.execute(f"SELECT 1 FROM {SCHEMA}.executor_groups WHERE id = %s", (group_id_int,))
                if not cur.fetchone():
                    return response(400, {
                        'error': f'Группа #{group_id_int} не существует.'
                    })

            old_group_ids = fetch_old_values(cur, ticket_ids_int, 'executor_group_id')
            new_group_name = (get_name_by_id(cur, 'executor_groups', group_id_int)
                              if group_id_int else 'Снята')
            old_group_names = {
                tid: (get_name_by_id(cur, 'executor_groups', old_id) if old_id else 'Не назначена')
                for tid, old_id in old_group_ids.items()
            }

            placeholders = ','.join(['%s'] * len(ticket_ids_int))
            try:
                cur.execute(f"""
                    UPDATE {SCHEMA}.tickets
                    SET executor_group_id = %s, updated_at = NOW()
                    WHERE id IN ({placeholders})
                """, [group_id_int] + ticket_ids_int)
                successful = cur.rowcount

                log_bulk_history(
                    cur, ticket_ids_int, payload.get('user_id'),
                    'executor_group_id', old_group_names, new_group_name
                )

                conn.commit()
            except psycopg2.errors.ForeignKeyViolation as fk_err:
                conn.rollback()
                log(f"[BULK-TICKETS] FK violation on change_executor_group: {fk_err}")
                return response(400, {'error': 'Невозможно назначить группу.'})
            except Exception as upd_err:
                conn.rollback()
                log(f"[BULK-TICKETS] Update error on change_executor_group: {upd_err}")
                return response(500, {'error': f'Ошибка обновления: {upd_err}'})

            return response(200, {
                'total': len(ticket_ids_int),
                'successful': successful,
                'message': f'Обновлено {successful} заявок'
            })

        elif action == 'add_watchers':
            user_ids = body.get('user_ids', [])
            if not user_ids:
                return response(400, {'error': 'Не указаны пользователи-наблюдатели'})

            inserted = 0
            # Список реальных вставок для последующих уведомлений в Битрикс
            actually_added: list = []  # [(ticket_id, user_id), ...]
            for tid in ticket_ids:
                for uid in user_ids:
                    try:
                        cur.execute(
                            f"INSERT INTO {SCHEMA}.ticket_watchers (ticket_id, user_id) "
                            f"VALUES (%s, %s) ON CONFLICT (ticket_id, user_id) DO NOTHING",
                            (tid, uid)
                        )
                        rc = cur.rowcount
                        inserted += rc
                        if rc > 0:
                            actually_added.append((int(tid), int(uid)))
                    except Exception as e:
                        log(f"[BULK-TICKETS] watcher insert error t={tid} u={uid}: {e}")

            cur.execute(
                f"UPDATE {SCHEMA}.tickets SET updated_at = NOW() WHERE id IN ({','.join(['%s']*len(ticket_ids))})",
                ticket_ids
            )
            conn.commit()

            # Битрикс-уведомления для реально добавленных наблюдателей
            if actually_added:
                try:
                    from bitrix_bot_notifier import notify_watcher_added
                    headers = event.get('headers') or {}
                    app_origin = headers.get('Origin') or headers.get('origin') or ''
                    actor_id = int(payload.get('user_id') or 0)
                    for t_id, u_id in actually_added:
                        if u_id == actor_id:
                            continue
                        try:
                            notify_watcher_added(
                                cur, SCHEMA, t_id, u_id,
                                actor_user_id=actor_id,
                                app_origin=app_origin,
                            )
                        except Exception as bot_err:
                            log(f"[bitrix-bot] watcher_added (bulk) failed t={t_id} u={u_id}: {bot_err}")
                except Exception as imp_err:
                    log(f"[bitrix-bot] import notifier failed: {imp_err}")

            return response(200, {
                'total': len(ticket_ids),
                'successful': len(ticket_ids),
                'inserted': inserted,
                'message': f'Добавлено наблюдателей: {inserted}'
            })

        else:
            return response(400, {'error': f'Неизвестное действие: {action}'})
    
    except Exception as e:
        log(f"[BULK-TICKETS] Fatal error: {e}")
        import traceback
        log(traceback.format_exc())
        return response(500, {'error': str(e)})
    
    finally:
        try:
            conn.close()
        except:
            pass