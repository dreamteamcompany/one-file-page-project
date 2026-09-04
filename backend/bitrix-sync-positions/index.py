import json
import os
import requests
from typing import Dict, Any, List, Optional, Tuple
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values


CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, Authorization, X-Endpoint',
    'Access-Control-Max-Age': '86400',
}


def fetch_all_bitrix_users() -> List[Dict[str, Any]]:
    webhook_url = os.environ.get('BITRIX24_WEBHOOK_URL')
    if not webhook_url:
        raise ValueError('BITRIX24_WEBHOOK_URL не настроен')

    all_users: List[Dict[str, Any]] = []
    seen_ids: set = set()
    start = 0
    max_iterations = 500
    iteration = 0

    while iteration < max_iterations:
        iteration += 1
        url = f"{webhook_url.rstrip('/')}/user.get"
        payload = {
            'start': start,
            'ACTIVE': True,
            'FILTER': {'ACTIVE': True},
            'SELECT': ['ID', 'WORK_POSITION', 'UF_DEPARTMENT'],
        }

        response = requests.post(
            url,
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        result = data.get('result') or []
        total = data.get('total', 0)
        next_start = data.get('next')

        if not result:
            break

        new_in_batch = 0
        for u in result:
            uid = str(u.get('ID'))
            if uid and uid not in seen_ids:
                seen_ids.add(uid)
                all_users.append(u)
                new_in_batch += 1

        print(
            f"[bitrix-sync-positions] start={start}: получено {len(result)} (новых {new_in_batch}), "
            f"всего {len(all_users)}/{total}, next={next_start}"
        )

        if new_in_batch == 0:
            break

        if next_start is None:
            break
        start = int(next_start)

        if len(all_users) >= total > 0:
            break

    print(f"[bitrix-sync-positions] Итого пользователей: {len(all_users)}")
    return all_users


def sync_positions_and_users(
    bitrix_users: List[Dict[str, Any]],
    company_id: int,
) -> Dict[str, Any]:
    dsn = os.environ.get('DATABASE_URL')
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    stats = {
        'positions_created': 0,
        'positions_updated': 0,
        'department_links_created': 0,
        'department_links_deleted': 0,
        'users_updated': 0,
        'users_skipped': 0,
    }

    try:
        cursor.execute(
            f'''SELECT id, bitrix_id FROM {schema}.departments
                WHERE company_id = %s AND bitrix_id IS NOT NULL''',
            (company_id,),
        )
        dept_map: Dict[str, int] = {row['bitrix_id']: row['id'] for row in cursor.fetchall()}
        print(f"[bitrix-sync-positions] Отделов в мапе: {len(dept_map)}")

        position_to_depts: Dict[str, set] = {}
        user_to_info: Dict[str, Tuple[str, Optional[int]]] = {}

        for u in bitrix_users:
            bid = str(u.get('ID') or '').strip()
            if not bid:
                continue
            pos_name = (u.get('WORK_POSITION') or '').strip()
            uf_dept = u.get('UF_DEPARTMENT') or []
            if not isinstance(uf_dept, list):
                uf_dept = [uf_dept]

            our_dept_ids: List[int] = []
            for d in uf_dept:
                our_id = dept_map.get(str(d))
                if our_id is not None:
                    our_dept_ids.append(our_id)

            primary_dept_id = our_dept_ids[0] if our_dept_ids else None

            if pos_name:
                if pos_name not in position_to_depts:
                    position_to_depts[pos_name] = set()
                for did in our_dept_ids:
                    position_to_depts[pos_name].add(did)
                user_to_info[bid] = (pos_name, primary_dept_id)
            else:
                user_to_info[bid] = ('', primary_dept_id)

        print(f"[bitrix-sync-positions] Уникальных должностей: {len(position_to_depts)}")

        pos_id_map: Dict[str, int] = {}
        if position_to_depts:
            all_names = list(position_to_depts.keys())
            cursor.execute(
                f'SELECT id, name FROM {schema}.positions WHERE name = ANY(%s)',
                (all_names,),
            )
            for row in cursor.fetchall():
                pos_id_map[row['name']] = row['id']

            existing_ids = list(pos_id_map.values())
            new_names = [n for n in all_names if n not in pos_id_map]

            if existing_ids:
                cursor.execute(
                    f'''UPDATE {schema}.positions
                        SET is_active = true, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ANY(%s)''',
                    (existing_ids,),
                )
                stats['positions_updated'] = len(existing_ids)

            if new_names:
                rows = execute_values(
                    cursor,
                    f'''INSERT INTO {schema}.positions
                        (name, is_active, created_at, updated_at)
                        VALUES %s
                        RETURNING id, name''',
                    [(n, True) for n in new_names],
                    template='(%s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
                    fetch=True,
                )
                for r in rows:
                    pos_id_map[r[1]] = r[0]
                stats['positions_created'] = len(new_names)

        # Полная пересборка: удаляем все связи отделов компании, потом вставляем актуальные
        company_dept_ids = list(dept_map.values())
        if company_dept_ids:
            cursor.execute(
                f'''DELETE FROM {schema}.department_positions
                    WHERE department_id = ANY(%s)''',
                (company_dept_ids,),
            )
            deleted_links = cursor.rowcount or 0
            stats['department_links_deleted'] = deleted_links
            print(f"[bitrix-sync-positions] Удалено старых связей: {deleted_links}")

        link_rows: List[Tuple[int, int]] = []
        seen_links: set = set()
        for name, dept_ids in position_to_depts.items():
            pos_id = pos_id_map.get(name)
            if pos_id is None:
                continue
            for did in dept_ids:
                key = (did, pos_id)
                if key in seen_links:
                    continue
                seen_links.add(key)
                link_rows.append(key)

        if link_rows:
            execute_values(
                cursor,
                f'''INSERT INTO {schema}.department_positions
                    (department_id, position_id, created_at)
                    VALUES %s
                    ON CONFLICT (department_id, position_id) DO NOTHING''',
                link_rows,
                template='(%s, %s, CURRENT_TIMESTAMP)',
            )
            stats['department_links_created'] = cursor.rowcount or 0

        if user_to_info:
            bids = list(user_to_info.keys())
            cursor.execute(
                f'''SELECT id, bitrix_user_id, position_id, department_id
                    FROM {schema}.users
                    WHERE bitrix_user_id = ANY(%s)''',
                (bids,),
            )
            our_users = {row['bitrix_user_id']: dict(row) for row in cursor.fetchall()}

            update_rows: List[Tuple[int, Optional[int], Optional[int]]] = []
            for bid, (pos_name, primary_dept_id) in user_to_info.items():
                row = our_users.get(bid)
                if row is None:
                    stats['users_skipped'] += 1
                    continue
                pos_id = pos_id_map.get(pos_name) if pos_name else None
                new_dept_id = primary_dept_id if primary_dept_id is not None else row.get('department_id')
                new_pos_id = pos_id if pos_id is not None else row.get('position_id')
                if new_pos_id == row.get('position_id') and new_dept_id == row.get('department_id'):
                    continue
                update_rows.append((row['id'], new_pos_id, new_dept_id))

            if update_rows:
                execute_values(
                    cursor,
                    f'''UPDATE {schema}.users AS u
                        SET position_id = v.position_id,
                            department_id = v.department_id,
                            updated_at = CURRENT_TIMESTAMP
                        FROM (VALUES %s) AS v(id, position_id, department_id)
                        WHERE u.id = v.id''',
                    update_rows,
                    template='(%s, %s::int, %s::int)',
                )
                stats['users_updated'] = len(update_rows)

        conn.commit()
        print(f"[bitrix-sync-positions] Sync ОК: {stats}")
        return stats

    except Exception as e:
        print(f"[bitrix-sync-positions] ОШИБКА: {e}")
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def handler(event: dict, context) -> dict:
    """Синхронизация должностей из Bitrix24: тянет пользователей (user.get),
    создаёт/обновляет positions, связывает с отделами, проставляет position_id
    и department_id сотрудникам.

    POST body: { "company_id": int }
    """
    if isinstance(event, str):
        event = json.loads(event)

    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False,
        }

    try:
        body_str = event.get('body', '{}')
        body = json.loads(body_str) if isinstance(body_str, str) else (body_str or {})
        company_id = body.get('company_id')

        if not company_id:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'company_id обязателен'}),
                'isBase64Encoded': False,
            }

        webhook_url = os.environ.get('BITRIX24_WEBHOOK_URL')
        if not webhook_url:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'BITRIX24_WEBHOOK_URL не настроен'}),
                'isBase64Encoded': False,
            }

        bitrix_users = fetch_all_bitrix_users()
        stats = sync_positions_and_users(bitrix_users, int(company_id)) if bitrix_users else {
            'positions_created': 0,
            'positions_updated': 0,
            'department_links_created': 0,
            'department_links_deleted': 0,
            'users_updated': 0,
            'users_skipped': 0,
        }

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': True,
                'total_users_in_bitrix': len(bitrix_users),
                'stats': stats,
            }),
            'isBase64Encoded': False,
        }

    except ValueError as e:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False,
        }
    except Exception as e:
        print(f"[bitrix-sync-positions] handler error: {e}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Ошибка синхронизации должностей: {str(e)}'}),
            'isBase64Encoded': False,
        }