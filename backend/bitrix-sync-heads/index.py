import json
import os
import requests
from typing import Dict, Any, List, Optional, Set
import psycopg2
from psycopg2.extras import RealDictCursor


CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, Authorization, X-Endpoint',
    'Access-Control-Max-Age': '86400',
}

DEFAULT_ROLE_ID = 7  # Роль "Пользователь"


def _webhook() -> str:
    url = os.environ.get('BITRIX24_WEBHOOK_URL')
    if not url:
        raise ValueError('BITRIX24_WEBHOOK_URL не настроен')
    return url.rstrip('/')


def fetch_all_departments() -> List[Dict[str, Any]]:
    """Загружает все отделы из Bitrix24 вместе с полем UF_HEAD (руководитель)."""
    all_departments: List[Dict[str, Any]] = []
    seen_ids: Set[str] = set()
    start = 0
    iteration = 0

    while iteration < 200:
        iteration += 1
        resp = requests.post(
            f"{_webhook()}/department.get",
            json={'start': start},
            headers={'Content-Type': 'application/json'},
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        result = data.get('result') or []
        total = data.get('total', 0)
        next_start = data.get('next')

        if not result:
            break

        new_in_batch = 0
        for d in result:
            bid = str(d.get('ID'))
            if bid not in seen_ids:
                seen_ids.add(bid)
                all_departments.append(d)
                new_in_batch += 1

        if new_in_batch == 0:
            break
        if next_start is None:
            break
        start = int(next_start)
        if len(all_departments) >= total > 0:
            break

    print(f"[bitrix-sync-heads] Отделов загружено: {len(all_departments)}")
    return all_departments


def fetch_users_by_ids(bitrix_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Загружает данные сотрудников из Bitrix24 по списку ID.

    Возвращает map: bitrix_id (str) -> данные пользователя.
    """
    result_map: Dict[str, Dict[str, Any]] = {}
    if not bitrix_ids:
        return result_map

    for bid in bitrix_ids:
        try:
            resp = requests.post(
                f"{_webhook()}/user.get",
                json={
                    'ID': bid,
                    'SELECT': ['ID', 'NAME', 'LAST_NAME', 'SECOND_NAME', 'EMAIL',
                               'PERSONAL_PHOTO', 'WORK_POSITION', 'UF_DEPARTMENT', 'ACTIVE'],
                },
                headers={'Content-Type': 'application/json'},
                timeout=20,
            )
            resp.raise_for_status()
            data = resp.json()
            rows = data.get('result') or []
            if rows:
                u = rows[0]
                result_map[str(u.get('ID'))] = u
        except Exception as e:
            print(f"[bitrix-sync-heads] WARN: не удалось загрузить user ID={bid}: {e}")

    print(f"[bitrix-sync-heads] Руководителей загружено из Bitrix: {len(result_map)}")
    return result_map


def sync_heads_to_users(
    departments: List[Dict[str, Any]],
    company_id: int,
) -> Dict[str, Any]:
    """Создаёт/обновляет пользователей-руководителей отделов и деактивирует бывших."""
    dsn = os.environ.get('DATABASE_URL')
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    stats = {
        'heads_in_bitrix': 0,
        'users_created': 0,
        'users_updated': 0,
        'users_deactivated': 0,
    }

    try:
        # Множество bitrix_id руководителей из UF_HEAD
        head_bitrix_ids: Set[str] = set()
        for d in departments:
            head = d.get('UF_HEAD')
            if head and str(head) not in ('0', '', 'None'):
                head_bitrix_ids.add(str(head))

        stats['heads_in_bitrix'] = len(head_bitrix_ids)
        print(f"[bitrix-sync-heads] Уникальных руководителей в Bitrix: {len(head_bitrix_ids)}")

        # Загружаем данные руководителей из Bitrix
        heads_data = fetch_users_by_ids(list(head_bitrix_ids))

        # Карта отделов: bitrix_id отдела -> наш department.id
        cursor.execute(
            f'''SELECT id, bitrix_id FROM {schema}.departments
                WHERE company_id = %s AND bitrix_id IS NOT NULL''',
            (company_id,),
        )
        dept_map: Dict[str, int] = {row['bitrix_id']: row['id'] for row in cursor.fetchall()}

        for bid, u in heads_data.items():
            first = (u.get('NAME') or '').strip()
            last = (u.get('LAST_NAME') or '').strip()
            full_name = f"{first} {last}".strip()
            email = (u.get('EMAIL') or '').strip().lower()
            photo_url = u.get('PERSONAL_PHOTO') or ''
            position = (u.get('WORK_POSITION') or '').strip()

            if not email:
                email = f"bitrix_{bid}@local"
            if not full_name:
                full_name = email

            uf_dept = u.get('UF_DEPARTMENT') or []
            if not isinstance(uf_dept, list):
                uf_dept = [uf_dept]
            primary_dept_id: Optional[int] = None
            for d in uf_dept:
                mapped = dept_map.get(str(d))
                if mapped is not None:
                    primary_dept_id = mapped
                    break

            # Ищем пользователя по bitrix_user_id, затем по email
            cursor.execute(
                f"SELECT id, is_active FROM {schema}.users WHERE bitrix_user_id = %s",
                (bid,),
            )
            row = cursor.fetchone()
            if not row:
                cursor.execute(
                    f"SELECT id, is_active FROM {schema}.users WHERE LOWER(email) = %s",
                    (email,),
                )
                row = cursor.fetchone()

            if row:
                user_id = row['id']
                cursor.execute(
                    f'''UPDATE {schema}.users
                        SET full_name = %s,
                            photo_url = CASE WHEN %s <> '' THEN %s ELSE photo_url END,
                            position = CASE WHEN %s <> '' THEN %s ELSE position END,
                            department_id = COALESCE(%s, department_id),
                            company_id = COALESCE(company_id, %s),
                            bitrix_user_id = %s,
                            is_bitrix_head = TRUE,
                            is_active = TRUE,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s''',
                    (full_name, photo_url, photo_url, position, position,
                     primary_dept_id, company_id, bid, user_id),
                )
                stats['users_updated'] += 1
            else:
                # Генерируем уникальный username
                base_username = email.split('@')[0]
                username = base_username
                counter = 1
                while True:
                    cursor.execute(
                        f"SELECT id FROM {schema}.users WHERE username = %s",
                        (username,),
                    )
                    if not cursor.fetchone():
                        break
                    username = f"{base_username}_{counter}"
                    counter += 1

                cursor.execute(
                    f'''INSERT INTO {schema}.users
                        (username, email, full_name, photo_url, position, password_hash,
                         is_active, auto_registered, bitrix_user_id, is_bitrix_head,
                         company_id, department_id, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, 'BITRIX_OAUTH', TRUE, TRUE, %s, TRUE,
                                %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        RETURNING id''',
                    (username, email, full_name, photo_url, position, bid,
                     company_id, primary_dept_id),
                )
                user_id = cursor.fetchone()['id']
                stats['users_created'] += 1

            # Назначаем роль "Пользователь"
            cursor.execute(
                f'''INSERT INTO {schema}.user_roles (user_id, role_id)
                    VALUES (%s, %s)
                    ON CONFLICT DO NOTHING''',
                (user_id, DEFAULT_ROLE_ID),
            )

        # Деактивируем тех, кто раньше был руководителем (is_bitrix_head=TRUE),
        # но больше им не является.
        actual_bids = list(heads_data.keys())
        if actual_bids:
            cursor.execute(
                f'''UPDATE {schema}.users
                    SET is_bitrix_head = FALSE, is_active = FALSE, updated_at = CURRENT_TIMESTAMP
                    WHERE is_bitrix_head = TRUE
                      AND bitrix_user_id IS NOT NULL
                      AND NOT (bitrix_user_id = ANY(%s))''',
                (actual_bids,),
            )
        else:
            cursor.execute(
                f'''UPDATE {schema}.users
                    SET is_bitrix_head = FALSE, is_active = FALSE, updated_at = CURRENT_TIMESTAMP
                    WHERE is_bitrix_head = TRUE''',
            )
        stats['users_deactivated'] = cursor.rowcount or 0

        conn.commit()
        print(f"[bitrix-sync-heads] Готово: {stats}")
        return stats

    except Exception as e:
        print(f"[bitrix-sync-heads] ОШИБКА: {e}")
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def handler(event: dict, context) -> dict:
    """Синхронизация руководителей отделов из Bitrix24 в пользователей проекта.

    Берёт UF_HEAD каждого отдела, создаёт/обновляет пользователей с ролью
    "Пользователь". Бывших руководителей деактивирует.

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

        if not os.environ.get('BITRIX24_WEBHOOK_URL'):
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'BITRIX24_WEBHOOK_URL не настроен'}),
                'isBase64Encoded': False,
            }

        departments = fetch_all_departments()
        stats = sync_heads_to_users(departments, int(company_id))

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'success': True, 'stats': stats}),
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
        print(f"[bitrix-sync-heads] handler error: {e}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Ошибка синхронизации руководителей: {str(e)}'}),
            'isBase64Encoded': False,
        }
