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


def fetch_all_bitrix_departments() -> List[Dict[str, Any]]:
    """Получает ВСЕ подразделения из Bitrix24 с автоматической пагинацией.

    Bitrix24 REST API ограничивает выдачу 50 элементами за запрос.
    Используем параметр START для пагинации, пока не получим все.
    """
    webhook_url = os.environ.get('BITRIX24_WEBHOOK_URL')
    if not webhook_url:
        raise ValueError('BITRIX24_WEBHOOK_URL не настроен')

    all_departments: List[Dict[str, Any]] = []
    seen_ids: set = set()
    start = 0
    max_iterations = 200
    iteration = 0

    print(f"[bitrix-sync] Загружаем все отделы из Bitrix24")

    while iteration < max_iterations:
        iteration += 1
        url = f"{webhook_url.rstrip('/')}/department.get"
        # Bitrix24 REST требует параметр пагинации именно строчными буквами: "start"
        # Также НЕ добавляем sort/order — для department.get они ломают пагинацию
        payload = {'start': start}

        response = requests.post(
            url,
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()

        result = data.get('result') or []
        total = data.get('total', 0)
        next_start = data.get('next')

        if not result:
            print(f"[bitrix-sync] Пустой ответ на start={start}, завершаем")
            break

        batch_ids = [str(d.get('ID')) for d in result]
        first_id = batch_ids[0] if batch_ids else None
        last_id = batch_ids[-1] if batch_ids else None
        new_in_batch = [bid for bid in batch_ids if bid not in seen_ids]

        print(
            f"[bitrix-sync] start={start}: получено {len(result)} (новых {len(new_in_batch)}), "
            f"первый ID={first_id}, последний ID={last_id}, next={next_start}, всего {len(all_departments) + len(new_in_batch)}/{total}"
        )

        if not new_in_batch:
            msg = (
                f"Bitrix REST возвращает повторяющиеся ID на start={start}. "
                f"Пагинация не работает. Уникальных отделов получено: {len(seen_ids)}. "
                f"Ответ Bitrix: total={total}, next={next_start}, first_id={first_id}, last_id={last_id}."
            )
            print(f"[bitrix-sync] STOP: {msg}")
            raise RuntimeError(msg)

        for d in result:
            bid = str(d.get('ID'))
            if bid not in seen_ids:
                seen_ids.add(bid)
                all_departments.append(d)

        if next_start is None:
            print(f"[bitrix-sync] next отсутствует — пагинация завершена")
            break
        start = int(next_start)

        if len(all_departments) >= total > 0:
            print(f"[bitrix-sync] Собрали все {total} отделов — завершаем")
            break

    print(f"[bitrix-sync] Итого загружено отделов: {len(all_departments)}")
    return all_departments


def topological_sort(
    departments: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Топологически сортирует отделы: родители идут перед детьми.

    Возвращает (отсортированный_список, проблемные_отделы).
    Проблемные — это отделы, чьи родители не найдены в списке (или циклы).
    """
    by_id: Dict[str, Dict[str, Any]] = {}
    for dept in departments:
        bid = str(dept.get('ID'))
        by_id[bid] = dept

    sorted_list: List[Dict[str, Any]] = []
    problematic: List[Dict[str, Any]] = []
    visited: Dict[str, str] = {}  # bid -> "white" / "gray" / "black"

    def visit(bid: str, path: List[str]) -> bool:
        """DFS-обход. Возвращает True если успех, False если цикл."""
        state = visited.get(bid, 'white')
        if state == 'black':
            return True
        if state == 'gray':
            print(f"[bitrix-sync] ЦИКЛ обнаружен в иерархии: {' -> '.join(path + [bid])}")
            return False

        visited[bid] = 'gray'
        dept = by_id.get(bid)
        if dept is None:
            visited[bid] = 'black'
            return True

        parent_bid = str(dept.get('PARENT')) if dept.get('PARENT') else None
        if parent_bid and parent_bid in by_id:
            if not visit(parent_bid, path + [bid]):
                visited[bid] = 'black'
                return False

        visited[bid] = 'black'
        sorted_list.append(dept)
        return True

    for dept in departments:
        bid = str(dept.get('ID'))
        ok = visit(bid, [])
        if not ok:
            problematic.append(dept)

    return sorted_list, problematic


def sync_departments_to_db(
    departments: List[Dict[str, Any]],
    company_id: int,
) -> Dict[str, Any]:
    """Синхронизирует подразделения из Bitrix24 в базу данных.

    Алгоритм:
    1. Топологически сортируем отделы (родители впереди).
    2. UPSERT в один проход: всегда сохраняем bitrix_id, name, parent_id (если родитель уже в БД).
    3. Дополнительный проход: для отделов, у которых родитель появился позже, обновляем parent_id.
    4. Архивация: отделы с bitrix_id, которых нет в выгрузке, помечаем is_archived=true.
    5. Отделы без bitrix_id (созданные вручную) НЕ ТРОГАЕМ.
    """
    print(f"[bitrix-sync] Начинаем sync в БД для {len(departments)} отделов, company_id={company_id}")

    dsn = os.environ.get('DATABASE_URL')
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    stats = {
        'created': 0,
        'updated': 0,
        'archived': 0,
        'restored': 0,
        'orphaned': 0,
        'cycles': 0,
    }

    try:
        # 1) Загружаем существующие отделы из БД (только с bitrix_id и в той же компании)
        cursor.execute(
            f'''
            SELECT id, bitrix_id, parent_id, name, is_archived
            FROM {schema}.departments
            WHERE company_id = %s AND bitrix_id IS NOT NULL
            ''',
            (company_id,),
        )
        existing_rows = cursor.fetchall()
        existing_by_bid: Dict[str, Dict[str, Any]] = {
            row['bitrix_id']: dict(row) for row in existing_rows
        }
        print(f"[bitrix-sync] В БД уже {len(existing_by_bid)} отделов c bitrix_id")

        # 2) Топологическая сортировка отделов из Битрикса
        sorted_depts, problematic = topological_sort(departments)
        if problematic:
            stats['cycles'] = len(problematic)
            print(f"[bitrix-sync] Проблемных (циклы/недостающие родители): {len(problematic)}")

        # bitrix_id -> наш departments.id (заполняется по мере UPSERT)
        bitrix_id_map: Dict[str, int] = {
            bid: row['id'] for bid, row in existing_by_bid.items()
        }

        # 3) Проход в топологическом порядке: для каждого отдела — UPDATE или INSERT
        for dept in sorted_depts:
            bid = str(dept.get('ID'))
            name = (dept.get('NAME') or '').strip() or f'Отдел {bid}'
            parent_bid = str(dept.get('PARENT')) if dept.get('PARENT') else None

            # Маппим parent_id из bitrix_id_map (родитель уже обработан благодаря топологии)
            our_parent_id: Optional[int] = None
            if parent_bid:
                our_parent_id = bitrix_id_map.get(parent_bid)
                if our_parent_id is None:
                    # Родитель не найден (его нет в Битриксе и в нашей БД) — оставляем как корневой
                    stats['orphaned'] += 1
                    print(f"[bitrix-sync] WARN: отдел bitrix_id={bid} ('{name}') — родитель bitrix_id={parent_bid} не найден")

            existing = existing_by_bid.get(bid)
            if existing:
                # UPDATE: имя, parent_id, активность, разархивируем если был архивный
                was_archived = existing.get('is_archived', False)
                cursor.execute(
                    f'''
                    UPDATE {schema}.departments
                    SET name = %s,
                        parent_id = %s,
                        is_active = true,
                        is_archived = false,
                        archived_at = NULL,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    ''',
                    (name, our_parent_id, existing['id']),
                )
                stats['updated'] += 1
                if was_archived:
                    stats['restored'] += 1
            else:
                # INSERT нового отдела
                cursor.execute(
                    f'''
                    INSERT INTO {schema}.departments
                        (company_id, name, code, bitrix_id, parent_id, is_active, is_archived, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING id
                    ''',
                    (company_id, name, f'BITRIX_{bid}', bid, our_parent_id),
                )
                new_id = cursor.fetchone()['id']
                bitrix_id_map[bid] = new_id
                stats['created'] += 1

        # 4) Архивация: отделы, у которых есть bitrix_id, но которых нет в свежей выгрузке
        synced_bids = {str(d.get('ID')) for d in departments}
        to_archive_ids = [
            row['id']
            for bid, row in existing_by_bid.items()
            if bid not in synced_bids and not row.get('is_archived', False)
        ]
        if to_archive_ids:
            cursor.execute(
                f'''
                UPDATE {schema}.departments
                SET is_archived = true,
                    archived_at = CURRENT_TIMESTAMP,
                    is_active = false,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ANY(%s)
                ''',
                (to_archive_ids,),
            )
            stats['archived'] = len(to_archive_ids)
            print(f"[bitrix-sync] Архивировано {stats['archived']} отделов, которых больше нет в Битриксе")

        conn.commit()
        print(f"[bitrix-sync] Sync ОК: {stats}")
        return {
            'stats': stats,
            'total_in_bitrix': len(departments),
            'synced_count': stats['created'] + stats['updated'],
        }

    except Exception as e:
        print(f"[bitrix-sync] ОШИБКА в sync_departments_to_db: {e}")
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def fetch_all_bitrix_users() -> List[Dict[str, Any]]:
    """Загружает ВСЕ активные пользователи из Bitrix24 с пагинацией.

    Использует метод user.get. Возвращает список словарей с полями
    ID, NAME, LAST_NAME, EMAIL, WORK_POSITION, UF_DEPARTMENT (список ID отделов),
    ACTIVE и др.
    """
    webhook_url = os.environ.get('BITRIX24_WEBHOOK_URL')
    if not webhook_url:
        raise ValueError('BITRIX24_WEBHOOK_URL не настроен')

    all_users: List[Dict[str, Any]] = []
    seen_ids: set = set()
    start = 0
    max_iterations = 500
    iteration = 0

    print(f"[bitrix-sync] Загружаем всех пользователей из Bitrix24")

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
            print(f"[bitrix-sync] user.get: пустой ответ на start={start}, завершаем")
            break

        new_in_batch = 0
        for u in result:
            uid = str(u.get('ID'))
            if uid and uid not in seen_ids:
                seen_ids.add(uid)
                all_users.append(u)
                new_in_batch += 1

        print(
            f"[bitrix-sync] user.get start={start}: получено {len(result)} (новых {new_in_batch}), "
            f"всего {len(all_users)}/{total}, next={next_start}"
        )

        if new_in_batch == 0:
            print(f"[bitrix-sync] user.get: больше нет новых пользователей, стоп")
            break

        if next_start is None:
            break
        start = int(next_start)

        if len(all_users) >= total > 0:
            break

    print(f"[bitrix-sync] Итого загружено пользователей: {len(all_users)}")
    return all_users


def sync_positions_and_users(
    bitrix_users: List[Dict[str, Any]],
    company_id: int,
) -> Dict[str, Any]:
    """Создаёт/обновляет должности из WORK_POSITION пользователей Битрикс,
    привязывает их к отделам, проставляет position_id сотрудникам.

    Алгоритм:
    1. Загружаем мапу bitrix_id отделов -> наш departments.id (для company_id).
    2. Из bitrix_users собираем уникальные названия должностей и для каждой —
       множество отделов (по UF_DEPARTMENT), а также соответствие
       bitrix_user_id -> (position_name, primary_dept_bitrix_id).
    3. Для каждой должности — UPSERT в positions по уникальному name.
    4. Для каждой пары (department_id, position_id) — INSERT в department_positions
       (с ON CONFLICT DO NOTHING — UNIQUE(department_id, position_id)).
    5. Для каждого пользователя в users (по bitrix_user_id) обновляем position_id
       и department_id (если ещё не задан или пуст).
    """
    print(f"[bitrix-sync] Sync должностей и пользователей, всего из Bitrix: {len(bitrix_users)}")

    dsn = os.environ.get('DATABASE_URL')
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    stats = {
        'positions_created': 0,
        'positions_updated': 0,
        'department_links_created': 0,
        'users_updated': 0,
        'users_skipped': 0,
    }

    try:
        # 1) Мапа bitrix_id -> departments.id
        cursor.execute(
            f'''
            SELECT id, bitrix_id FROM {schema}.departments
            WHERE company_id = %s AND bitrix_id IS NOT NULL
            ''',
            (company_id,),
        )
        dept_map: Dict[str, int] = {row['bitrix_id']: row['id'] for row in cursor.fetchall()}
        print(f"[bitrix-sync] В мапе отделов: {len(dept_map)}")

        # 2) Сбор должностей и связей
        # position_name -> set(our_dept_ids)
        position_to_depts: Dict[str, set] = {}
        # bitrix_user_id -> (position_name, our_primary_dept_id|None)
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
                d_bid = str(d)
                our_id = dept_map.get(d_bid)
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
                # Без должности, но возможно надо обновить отдел
                user_to_info[bid] = ('', primary_dept_id)

        print(f"[bitrix-sync] Уникальных должностей из Битрикс: {len(position_to_depts)}")

        # 3) UPSERT positions одним батчем
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

        # 4) department_positions — все связи одним INSERT с ON CONFLICT
        link_rows: List[Tuple[int, int]] = []
        for name, dept_ids in position_to_depts.items():
            pos_id = pos_id_map.get(name)
            if pos_id is None:
                continue
            for did in dept_ids:
                link_rows.append((did, pos_id))

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

        # 5) Обновляем users одним батчем через VALUES JOIN
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
        print(f"[bitrix-sync] Sync должностей ОК: {stats}")
        return stats

    except Exception as e:
        print(f"[bitrix-sync] ОШИБКА в sync_positions_and_users: {e}")
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def handler(event: dict, context) -> dict:
    """API синхронизации подразделений и должностей из Bitrix24.

    POST body: { "company_id": int }
    1. Загружает все отделы из Битрикса, делает UPSERT, архивирует удалённые.
    2. Загружает всех пользователей, собирает должности (WORK_POSITION),
       создаёт уникальные записи в positions, привязывает к отделам через
       department_positions, проставляет position_id сотрудникам в users
       (поиск по bitrix_user_id).
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
                'body': json.dumps({'error': 'BITRIX24_WEBHOOK_URL не настроен в секретах'}),
                'isBase64Encoded': False,
            }

        departments = fetch_all_bitrix_departments()

        if not departments:
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': True,
                    'synced_count': 0,
                    'has_more': False,
                    'stats': {'created': 0, 'updated': 0, 'archived': 0, 'restored': 0, 'orphaned': 0, 'cycles': 0},
                    'message': 'Нет отделов в Bitrix24 для синхронизации',
                }),
                'isBase64Encoded': False,
            }

        result = sync_departments_to_db(departments, int(company_id))

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': True,
                'synced_count': result['synced_count'],
                'total_in_bitrix': result['total_in_bitrix'],
                'stats': result['stats'],
                'has_more': False,
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
        print(f"[bitrix-sync] handler error: {e}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Ошибка синхронизации: {str(e)}'}),
            'isBase64Encoded': False,
        }