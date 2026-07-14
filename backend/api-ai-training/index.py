"""API для управления обучением AI — примеры заявок, правила и генерация эмбеддингов"""
import json
import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
import requests
from shared_utils import response, get_db_connection, verify_token, handle_options, get_query_param, SCHEMA

GIGACHAT_AUTH_KEY = os.environ.get('GIGACHAT_AUTH_KEY')
USE_EMBEDDINGS = os.environ.get('USE_EMBEDDINGS', 'false').lower() == 'true'
CLASSIFY_URL = os.environ.get('CLASSIFY_URL', 'https://functions.poehali.dev/b1d49417-fb02-4b11-9656-d30b68924b54')

_token_cache = {'token': None, 'expires_at': 0}


def get_gigachat_token():
    now = time.time()
    if _token_cache['token'] and _token_cache['expires_at'] > now + 60:
        return _token_cache['token']

    resp = requests.post(
        'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
        headers={
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'RqUID': str(uuid.uuid4()),
            'Authorization': f'Basic {GIGACHAT_AUTH_KEY}',
        },
        data={'scope': 'GIGACHAT_API_PERS'},
        verify=False,
        timeout=(2, 4),
    )
    resp.raise_for_status()
    data = resp.json()
    _token_cache['token'] = data['access_token']
    _token_cache['expires_at'] = data.get('expires_at', now + 1800) / 1000 if data.get('expires_at', 0) > 1000000000000 else data.get('expires_at', now + 1800)
    return _token_cache['token']


def generate_embedding(text, token=None):
    if not token:
        token = get_gigachat_token()
    resp = requests.post(
        'https://gigachat.devices.sberbank.ru/api/v1/embeddings',
        headers={
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f'Bearer {token}',
        },
        json={
            'model': 'Embeddings',
            'input': [text[:512]],
        },
        verify=False,
        timeout=(2, 15),
    )
    resp.raise_for_status()
    data = resp.json()
    return data['data'][0]['embedding']


def safe_generate_embedding(text, token=None):
    if not USE_EMBEDDINGS:
        return None, None
    try:
        return generate_embedding(text, token), None
    except requests.exceptions.HTTPError as e:
        code = e.response.status_code if e.response is not None else 0
        if code == 402:
            msg = 'Лимит GigaChat API исчерпан (402 Payment Required). Пополните баланс или дождитесь обновления лимита.'
        elif code == 401:
            msg = 'Ошибка авторизации GigaChat API (401). Проверьте GIGACHAT_AUTH_KEY.'
        elif code == 429:
            msg = 'Превышен лимит запросов GigaChat API (429). Попробуйте позже.'
        else:
            msg = f'Ошибка GigaChat API ({code}): {e}'
        print(f'[ai-training] Embedding error: {msg}')
        return None, msg
    except requests.exceptions.Timeout:
        msg = 'GigaChat API не отвечает (таймаут). Попробуйте позже.'
        print(f'[ai-training] Embedding error: {msg}')
        return None, msg
    except BaseException as e:
        print(f'[ai-training] Embedding error: {e}')
        return None, str(e)


def handler(event, context):
    """CRUD для примеров и правил обучения AI-классификатора с генерацией эмбеддингов"""
    if event.get('httpMethod') == 'OPTIONS':
        return handle_options()

    payload = verify_token(event)
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})

    method = event.get('httpMethod', 'GET')
    endpoint = get_query_param(event, 'endpoint', '')

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        if endpoint == 'examples':
            return handle_examples(method, event, cur, conn)
        elif endpoint == 'rules':
            return handle_rules(method, event, cur, conn)
        elif endpoint == 'stats':
            return handle_stats(cur)
        elif endpoint == 'logs':
            return handle_logs(method, event, cur, conn)
        elif endpoint == 'pending_reviews':
            return handle_pending_reviews(method, event, cur, conn)
        elif endpoint == 'reindex':
            return handle_reindex(cur, conn, event)
        elif endpoint == 'clear':
            return handle_clear(method, event, cur, conn)
        elif endpoint == 'bulk_enqueue':
            return handle_bulk_enqueue(method, event, cur, conn)
        elif endpoint == 'definitions':
            return handle_definitions(method, event, cur, conn)
        else:
            return response(400, {'error': 'Укажите endpoint: examples, rules, stats, logs, pending_reviews, reindex или clear'})
    finally:
        cur.close()
        conn.close()


def handle_clear(method, event, cur, conn):
    if method != 'POST':
        return response(405, {'error': 'Только POST'})
    body = json.loads(event.get('body', '{}'))
    sections = body.get('sections', [])
    if not isinstance(sections, list) or not sections:
        return response(400, {'error': 'Укажите sections: pending_reviews, examples, rules'})

    table_map = {
        'pending_reviews': 'ai_pending_reviews',
        'examples': 'ai_training_examples',
        'rules': 'ai_training_rules',
    }
    cleared = {}
    for section in sections:
        table = table_map.get(section)
        if not table:
            continue
        cur.execute(f"DELETE FROM {SCHEMA}.{table} RETURNING id")
        cleared[section] = len(cur.fetchall())
    conn.commit()
    return response(200, {'cleared': cleared})


def handle_definitions(method, event, cur, conn):
    if method == 'GET':
        cur.execute(f"""
            SELECT id, term, description, created_at, updated_at
            FROM {SCHEMA}.ai_definitions
            ORDER BY term ASC
        """)
        return response(200, [dict(r) for r in cur.fetchall()])

    if method == 'POST':
        body = json.loads(event.get('body', '{}'))
        term = (body.get('term') or '').strip()
        description = (body.get('description') or '').strip()
        if not term or not description:
            return response(400, {'error': 'term и description обязательны'})
        cur.execute(f"""
            INSERT INTO {SCHEMA}.ai_definitions (term, description)
            VALUES (%s, %s)
            RETURNING id, term, description, created_at, updated_at
        """, (term, description))
        conn.commit()
        return response(201, dict(cur.fetchone()))

    if method == 'PUT':
        body = json.loads(event.get('body', '{}'))
        def_id = body.get('id')
        term = (body.get('term') or '').strip()
        description = (body.get('description') or '').strip()
        if not def_id or not term or not description:
            return response(400, {'error': 'id, term и description обязательны'})
        cur.execute(f"""
            UPDATE {SCHEMA}.ai_definitions
            SET term = %s, description = %s, updated_at = NOW()
            WHERE id = %s
            RETURNING id, term, description, created_at, updated_at
        """, (term, description, def_id))
        conn.commit()
        row = cur.fetchone()
        if not row:
            return response(404, {'error': 'Определение не найдено'})
        return response(200, dict(row))

    if method == 'DELETE':
        def_id = get_query_param(event, 'id', '')
        if not def_id:
            body = json.loads(event.get('body', '{}'))
            def_id = body.get('id')
        if not def_id:
            return response(400, {'error': 'id обязателен'})
        cur.execute(f"DELETE FROM {SCHEMA}.ai_definitions WHERE id = %s RETURNING id", (int(def_id),))
        conn.commit()
        row = cur.fetchone()
        if not row:
            return response(404, {'error': 'Определение не найдено'})
        return response(200, {'ok': True, 'id': row['id']})

    return response(405, {'error': 'Method not allowed'})


def count_bulk_candidates(cur):
    cur.execute(f"""
        SELECT COUNT(*) AS cnt
        FROM {SCHEMA}.tickets t
        WHERE COALESCE(t.external_source, '') <> 'vsdesk'
          AND NOT EXISTS (
              SELECT 1 FROM {SCHEMA}.ai_pending_reviews pr WHERE pr.source_ticket_id = t.id
          )
    """)
    return cur.fetchone()['cnt']


def handle_bulk_enqueue(method, event, cur, conn):
    if method == 'GET':
        remaining = count_bulk_candidates(cur)
        cur.execute(f"""
            SELECT COUNT(*) AS total
            FROM {SCHEMA}.tickets t
            WHERE COALESCE(t.external_source, '') <> 'vsdesk'
        """)
        total = cur.fetchone()['total']
        return response(200, {'remaining': remaining, 'total': total})

    if method != 'POST':
        return response(405, {'error': 'Только GET или POST'})

    body = json.loads(event.get('body', '{}'))
    batch_size = min(int(body.get('batch_size', 5)), 10)

    cur.execute(f"""
        SELECT t.id, t.title, t.description
        FROM {SCHEMA}.tickets t
        WHERE COALESCE(t.external_source, '') <> 'vsdesk'
          AND NOT EXISTS (
              SELECT 1 FROM {SCHEMA}.ai_pending_reviews pr WHERE pr.source_ticket_id = t.id
          )
        ORDER BY t.id ASC
        LIMIT {batch_size}
    """)
    tickets = [dict(r) for r in cur.fetchall()]

    enqueued = 0
    errors = 0
    for t in tickets:
        parts = [p for p in [t.get('title'), t.get('description')] if p and str(p).strip()]
        description = '. '.join(parts).strip() or (t.get('title') or f"Заявка №{t['id']}")
        try:
            resp = requests.post(
                CLASSIFY_URL,
                json={'description': description[:2000], 'source_ticket_id': t['id'], 'queue_only': True},
                timeout=(5, 60),
            )
            if resp.status_code == 200:
                enqueued += 1
            else:
                errors += 1
                print(f"[bulk_enqueue] ticket {t['id']} status {resp.status_code}")
        except Exception as e:
            errors += 1
            print(f"[bulk_enqueue] ticket {t['id']} error: {e}")

    remaining = count_bulk_candidates(cur)
    return response(200, {
        'enqueued': enqueued,
        'errors': errors,
        'remaining': remaining,
        'done': remaining == 0 or len(tickets) == 0,
    })


def handle_examples(method, event, cur, conn):
    if method == 'GET':
        cur.execute(f"""
            SELECT e.id, e.description, e.ticket_service_id, e.service_ids,
                   e.created_at, e.updated_at, e.is_auto, e.clarifying_questions,
                   ts.name as ticket_service_name,
                   CASE WHEN e.embedding IS NOT NULL THEN true ELSE false END as has_embedding
            FROM {SCHEMA}.ai_training_examples e
            LEFT JOIN {SCHEMA}.ticket_services ts ON ts.id = e.ticket_service_id
            ORDER BY e.created_at DESC
        """)
        examples = [dict(r) for r in cur.fetchall()]

        svc_ids = set()
        for ex in examples:
            if ex['service_ids']:
                svc_ids.update(ex['service_ids'])

        service_names = {}
        if svc_ids:
            ids_str = ','.join(str(i) for i in svc_ids)
            cur.execute(f"SELECT id, name FROM {SCHEMA}.services WHERE id IN ({ids_str})")
            for r in cur.fetchall():
                service_names[r['id']] = r['name']

        for ex in examples:
            ex['service_names'] = [service_names.get(sid, '') for sid in (ex['service_ids'] or [])]

        return response(200, examples)

    elif method == 'POST':
        body = json.loads(event.get('body', '{}'))
        description = body.get('description', '').strip()
        ticket_service_id = body.get('ticket_service_id')
        service_ids = body.get('service_ids', [])
        clarifying_questions = [str(q).strip() for q in (body.get('clarifying_questions') or []) if str(q).strip()]

        if not description or not ticket_service_id:
            return response(400, {'error': 'description и ticket_service_id обязательны'})

        embedding, emb_error = safe_generate_embedding(description)
        embedding_json = json.dumps(embedding) if embedding else None

        cur.execute(f"""
            INSERT INTO {SCHEMA}.ai_training_examples (description, ticket_service_id, service_ids, clarifying_questions, embedding)
            VALUES (%s, %s, %s, %s::jsonb, %s::jsonb)
            RETURNING id, description, ticket_service_id, service_ids, clarifying_questions, created_at
        """, (description, ticket_service_id, service_ids, json.dumps(clarifying_questions), embedding_json))
        conn.commit()
        result = dict(cur.fetchone())
        result['has_embedding'] = embedding is not None
        if emb_error:
            result['embedding_error'] = emb_error
        return response(201, result)

    elif method == 'PUT':
        body = json.loads(event.get('body', '{}'))
        example_id = body.get('id')
        if not example_id:
            return response(400, {'error': 'id обязателен'})

        fields = []
        values = []
        need_reembed = False

        if 'description' in body:
            fields.append('description = %s')
            values.append(body['description'].strip())
            need_reembed = True
        if 'ticket_service_id' in body:
            fields.append('ticket_service_id = %s')
            values.append(body['ticket_service_id'])
        if 'service_ids' in body:
            fields.append('service_ids = %s')
            values.append(body['service_ids'])
        if 'clarifying_questions' in body:
            cq = [str(q).strip() for q in (body.get('clarifying_questions') or []) if str(q).strip()]
            fields.append('clarifying_questions = %s::jsonb')
            values.append(json.dumps(cq))

        if not fields:
            return response(400, {'error': 'Нет полей для обновления'})

        if need_reembed:
            new_desc = body.get('description', '').strip()
            embedding, emb_error = safe_generate_embedding(new_desc)
            embedding_json = json.dumps(embedding) if embedding else None
            fields.append('embedding = %s::jsonb')
            values.append(embedding_json)

        fields.append('updated_at = NOW()')
        values.append(example_id)

        cur.execute(f"""
            UPDATE {SCHEMA}.ai_training_examples
            SET {', '.join(fields)}
            WHERE id = %s
            RETURNING id, description, ticket_service_id, service_ids, clarifying_questions, updated_at
        """, values)
        conn.commit()
        row = cur.fetchone()
        if not row:
            return response(404, {'error': 'Пример не найден'})
        result = dict(row)
        result['has_embedding'] = need_reembed and embedding is not None
        return response(200, result)

    elif method == 'DELETE':
        body = json.loads(event.get('body', '{}'))
        example_id = body.get('id')
        if not example_id:
            return response(400, {'error': 'id обязателен'})

        cur.execute(f"DELETE FROM {SCHEMA}.ai_training_examples WHERE id = %s RETURNING id", (example_id,))
        conn.commit()
        row = cur.fetchone()
        if not row:
            return response(404, {'error': 'Пример не найден'})
        return response(200, {'deleted': True, 'id': row['id']})

    return response(405, {'error': 'Method not allowed'})


def _reindex_one(ex_id, description, token):
    embedding, emb_error = safe_generate_embedding(description, token)
    return ex_id, embedding, emb_error


def handle_reindex(cur, conn, event):
    body = {}
    if event.get('body'):
        try:
            body = json.loads(event.get('body') or '{}')
        except BaseException:
            body = {}
    batch_size = int(body.get('batch_size') or get_query_param(event, 'batch_size', '10'))
    force = bool(body.get('force', False))

    cur.execute(f"SELECT COUNT(*) as c FROM {SCHEMA}.ai_training_examples")
    total_all = cur.fetchone()['c']

    if not USE_EMBEDDINGS:
        return response(200, {
            'reindexed': 0,
            'errors': 0,
            'total': total_all,
            'processed_in_batch': 0,
            'remaining': 0,
            'done': True,
            'disabled': True,
            'error_reason': 'Векторная индексация отключена (USE_EMBEDDINGS=false). Классификация работает через keyword-поиск.',
        })

    if force:
        where_clause = ''
    else:
        where_clause = 'WHERE embedding IS NULL'

    cur.execute(f"""
        SELECT id, description FROM {SCHEMA}.ai_training_examples
        {where_clause}
        ORDER BY id
        LIMIT {batch_size}
    """)
    examples = [dict(r) for r in cur.fetchall()]

    if not examples:
        return response(200, {
            'reindexed': 0,
            'errors': 0,
            'total': total_all,
            'processed_in_batch': 0,
            'remaining': 0,
            'done': True,
        })

    if force:
        cur.execute(f"SELECT COUNT(*) as c FROM {SCHEMA}.ai_training_examples")
        remaining_before = cur.fetchone()['c']
    else:
        cur.execute(f"SELECT COUNT(*) as c FROM {SCHEMA}.ai_training_examples WHERE embedding IS NULL")
        remaining_before = cur.fetchone()['c']

    try:
        token = get_gigachat_token()
    except requests.exceptions.HTTPError as e:
        code = e.response.status_code if e.response is not None else 0
        if code == 402:
            reason = 'Лимит GigaChat API исчерпан. Пополните баланс или дождитесь обновления лимита.'
        elif code == 401:
            reason = 'Ошибка авторизации GigaChat. Проверьте ключ GIGACHAT_AUTH_KEY.'
        else:
            reason = f'Ошибка GigaChat API при получении токена ({code}).'
        print(f'[ai-training] Token error: {e}')
        return response(200, {
            'reindexed': 0,
            'errors': len(examples),
            'total': total_all,
            'processed_in_batch': len(examples),
            'remaining': remaining_before,
            'done': True,
            'error_reason': reason,
        })
    except BaseException as e:
        print(f'[ai-training] Token error: {e}')
        return response(200, {
            'reindexed': 0,
            'errors': len(examples),
            'total': total_all,
            'processed_in_batch': len(examples),
            'remaining': remaining_before,
            'done': True,
            'error_reason': f'Не удалось подключиться к GigaChat: {e}',
        })

    reindexed = 0
    errors = 0
    error_details = []

    workers = min(3, len(examples))
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(_reindex_one, ex['id'], ex['description'], token): ex['id']
            for ex in examples
        }

        for future in futures:
            ex_id = futures[future]
            try:
                rid, embedding, emb_error = future.result(timeout=25)
                if embedding:
                    embedding_json = json.dumps(embedding)
                    cur.execute(f"""
                        UPDATE {SCHEMA}.ai_training_examples
                        SET embedding = %s::jsonb
                        WHERE id = %s
                    """, (embedding_json, rid))
                    conn.commit()
                    reindexed += 1
                else:
                    errors += 1
                    error_details.append(f'id={rid}: {emb_error}')
                    print(f'[ai-training] Reindex failed for id={rid}: {emb_error}')
            except BaseException as e:
                errors += 1
                error_details.append(f'id={ex_id}: {e}')
                print(f'[ai-training] Reindex exception for id={ex_id}: {e}')

    cur.execute(f"SELECT COUNT(*) as c FROM {SCHEMA}.ai_training_examples WHERE embedding IS NULL")
    remaining_after = cur.fetchone()['c']

    result = {
        'reindexed': reindexed,
        'errors': errors,
        'total': total_all,
        'processed_in_batch': len(examples),
        'remaining': remaining_after,
        'done': remaining_after == 0 or (errors == len(examples) and reindexed == 0),
    }
    if error_details:
        result['error_details'] = error_details[:5]
        first_error = error_details[0] if error_details else ''
        if '402' in first_error or 'Payment Required' in first_error:
            result['error_reason'] = 'Лимит GigaChat API исчерпан. Пополните баланс или дождитесь обновления лимита.'
        elif '401' in first_error:
            result['error_reason'] = 'Ошибка авторизации GigaChat. Проверьте ключ GIGACHAT_AUTH_KEY.'
        elif '429' in first_error:
            result['error_reason'] = 'Превышен лимит запросов GigaChat. Попробуйте через несколько минут.'
        elif 'таймаут' in first_error.lower() or 'timed out' in first_error.lower() or 'timeout' in first_error.lower():
            result['error_reason'] = 'GigaChat API не отвечает. Попробуйте позже.'
        else:
            result['error_reason'] = 'Ошибка при генерации эмбеддингов. Подробности в логах.'
    return response(200, result)


def handle_rules(method, event, cur, conn):
    if method == 'GET':
        cur.execute(f"""
            SELECT id, rule_text, is_active, created_at, updated_at
            FROM {SCHEMA}.ai_training_rules
            ORDER BY created_at DESC
        """)
        return response(200, [dict(r) for r in cur.fetchall()])

    elif method == 'POST':
        body = json.loads(event.get('body', '{}'))
        rule_text = body.get('rule_text', '').strip()

        if not rule_text:
            return response(400, {'error': 'rule_text обязателен'})

        cur.execute(f"""
            INSERT INTO {SCHEMA}.ai_training_rules (rule_text, is_active)
            VALUES (%s, %s)
            RETURNING id, rule_text, is_active, created_at
        """, (rule_text, body.get('is_active', True)))
        conn.commit()
        return response(201, dict(cur.fetchone()))

    elif method == 'PUT':
        body = json.loads(event.get('body', '{}'))
        rule_id = body.get('id')
        if not rule_id:
            return response(400, {'error': 'id обязателен'})

        fields = []
        values = []
        if 'rule_text' in body:
            fields.append('rule_text = %s')
            values.append(body['rule_text'].strip())
        if 'is_active' in body:
            fields.append('is_active = %s')
            values.append(body['is_active'])

        if not fields:
            return response(400, {'error': 'Нет полей для обновления'})

        fields.append('updated_at = NOW()')
        values.append(rule_id)

        cur.execute(f"""
            UPDATE {SCHEMA}.ai_training_rules
            SET {', '.join(fields)}
            WHERE id = %s
            RETURNING id, rule_text, is_active, updated_at
        """, values)
        conn.commit()
        row = cur.fetchone()
        if not row:
            return response(404, {'error': 'Правило не найдено'})
        return response(200, dict(row))

    elif method == 'DELETE':
        body = json.loads(event.get('body', '{}'))
        rule_id = body.get('id')
        if not rule_id:
            return response(400, {'error': 'id обязателен'})

        cur.execute(f"DELETE FROM {SCHEMA}.ai_training_rules WHERE id = %s RETURNING id", (rule_id,))
        conn.commit()
        row = cur.fetchone()
        if not row:
            return response(404, {'error': 'Правило не найдено'})
        return response(200, {'deleted': True, 'id': row['id']})

    return response(405, {'error': 'Method not allowed'})


def handle_pending_reviews(method, event, cur, conn):
    if method == 'GET':
        cur.execute(f"""
            SELECT pr.id, pr.description, pr.ticket_service_id, pr.service_ids,
                   pr.ticket_service_name, pr.service_names, pr.confidence,
                   pr.status, pr.created_at, pr.clarifying_questions, pr.source_ticket_id,
                   ts.name as ts_name_joined
            FROM {SCHEMA}.ai_pending_reviews pr
            LEFT JOIN {SCHEMA}.ticket_services ts ON ts.id = pr.ticket_service_id
            WHERE pr.status = 'pending'
            ORDER BY (pr.confidence IS NULL), pr.confidence ASC, pr.created_at DESC
        """)
        reviews = [dict(r) for r in cur.fetchall()]

        svc_ids = set()
        for rv in reviews:
            if rv['service_ids']:
                svc_ids.update(rv['service_ids'])

        service_names_map = {}
        if svc_ids:
            ids_str = ','.join(str(i) for i in svc_ids)
            cur.execute(f"SELECT id, name FROM {SCHEMA}.services WHERE id IN ({ids_str})")
            for r in cur.fetchall():
                service_names_map[r['id']] = r['name']

        for rv in reviews:
            if rv['ts_name_joined']:
                rv['ticket_service_name'] = rv['ts_name_joined']
            del rv['ts_name_joined']
            rv['service_names'] = [service_names_map.get(sid, '') for sid in (rv['service_ids'] or [])]

        return response(200, reviews)

    elif method == 'POST':
        body = json.loads(event.get('body', '{}'))
        action = body.get('action', '')
        review_id = body.get('id')

        if action == 'approve':
            if not review_id:
                return response(400, {'error': 'id обязателен'})

            cur.execute(f"""
                UPDATE {SCHEMA}.ai_pending_reviews
                SET status = 'approved', reviewed_at = NOW()
                WHERE id = %s AND status = 'pending'
                RETURNING id, description, ticket_service_id, service_ids, clarifying_questions
            """, (review_id,))
            conn.commit()
            row = cur.fetchone()
            if not row:
                return response(404, {'error': 'Запись не найдена или уже обработана'})

            questions = body.get('clarifying_questions', row['clarifying_questions']) or []
            embedding, _ = safe_generate_embedding(row['description'])
            embedding_json = json.dumps(embedding) if embedding else None
            cur.execute(f"""
                INSERT INTO {SCHEMA}.ai_training_examples
                (description, ticket_service_id, service_ids, is_auto, clarifying_questions, embedding)
                VALUES (%s, %s, %s, true, %s::jsonb, %s::jsonb)
            """, (row['description'], row['ticket_service_id'], row['service_ids'],
                  json.dumps(questions), embedding_json))
            conn.commit()

            return response(200, {'ok': True, 'id': row['id']})

        elif action == 'correct':
            if not review_id:
                return response(400, {'error': 'id обязателен'})

            ticket_service_id = body.get('ticket_service_id')
            service_ids = body.get('service_ids', [])

            if not ticket_service_id:
                return response(400, {'error': 'ticket_service_id обязателен'})

            cur.execute(f"""
                UPDATE {SCHEMA}.ai_pending_reviews
                SET status = 'corrected', reviewed_at = NOW(),
                    ticket_service_id = %s, service_ids = %s
                WHERE id = %s AND status = 'pending'
                RETURNING id, description, clarifying_questions
            """, (ticket_service_id, service_ids, review_id))
            conn.commit()
            row = cur.fetchone()
            if not row:
                return response(404, {'error': 'Запись не найдена или уже обработана'})

            questions = body.get('clarifying_questions', row['clarifying_questions']) or []
            embedding, _ = safe_generate_embedding(row['description'])
            embedding_json = json.dumps(embedding) if embedding else None
            cur.execute(f"""
                INSERT INTO {SCHEMA}.ai_training_examples
                (description, ticket_service_id, service_ids, is_auto, clarifying_questions, embedding)
                VALUES (%s, %s, %s, true, %s::jsonb, %s::jsonb)
            """, (row['description'], ticket_service_id, service_ids,
                  json.dumps(questions), embedding_json))
            conn.commit()

            return response(200, {'ok': True, 'id': row['id']})

        elif action == 'reject':
            if not review_id:
                return response(400, {'error': 'id обязателен'})

            cur.execute(f"""
                UPDATE {SCHEMA}.ai_pending_reviews
                SET status = 'rejected', reviewed_at = NOW()
                WHERE id = %s AND status = 'pending'
                RETURNING id
            """, (review_id,))
            conn.commit()
            row = cur.fetchone()
            if not row:
                return response(404, {'error': 'Запись не найдена или уже обработана'})

            return response(200, {'ok': True, 'id': row['id']})

        elif action == 'approve_all':
            cur.execute(f"""
                SELECT id, description, ticket_service_id, service_ids, clarifying_questions
                FROM {SCHEMA}.ai_pending_reviews
                WHERE status = 'pending'
            """)
            pending = [dict(r) for r in cur.fetchall()]

            if not pending:
                return response(200, {'ok': True, 'count': 0})

            for rv in pending:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.ai_training_examples
                    (description, ticket_service_id, service_ids, is_auto, clarifying_questions)
                    VALUES (%s, %s, %s, true, %s::jsonb)
                """, (rv['description'], rv['ticket_service_id'], rv['service_ids'],
                      json.dumps(rv['clarifying_questions'] or [])))

            cur.execute(f"""
                UPDATE {SCHEMA}.ai_pending_reviews
                SET status = 'approved', reviewed_at = NOW()
                WHERE status = 'pending'
            """)
            conn.commit()

            return response(200, {'ok': True, 'count': len(pending)})

        return response(400, {'error': 'Неизвестный action. Допустимые: approve, correct, reject, approve_all'})

    return response(405, {'error': 'Method not allowed'})


def handle_stats(cur):
    cur.execute(f"SELECT COUNT(*) as count FROM {SCHEMA}.ai_training_examples")
    examples_count = cur.fetchone()['count']

    cur.execute(f"SELECT COUNT(*) as count FROM {SCHEMA}.ai_training_rules WHERE is_active = true")
    rules_count = cur.fetchone()['count']

    cur.execute(f"SELECT COUNT(*) as count FROM {SCHEMA}.ai_training_examples WHERE embedding IS NOT NULL")
    indexed_count = cur.fetchone()['count']

    cur.execute(f"SELECT COUNT(*) as count FROM {SCHEMA}.ai_training_examples WHERE is_auto = true")
    auto_count = cur.fetchone()['count']

    cur.execute(f"SELECT COUNT(*) as count FROM {SCHEMA}.ai_pending_reviews WHERE status = 'pending'")
    pending_reviews_count = cur.fetchone()['count']

    cur.execute(f"SELECT COUNT(*) as count FROM {SCHEMA}.ai_pending_reviews")
    total_reviews = cur.fetchone()['count']

    reviewed_count = total_reviews - pending_reviews_count
    training_progress = round(reviewed_count / total_reviews * 100) if total_reviews > 0 else 0

    cur.execute(f"SELECT COUNT(*) as count FROM {SCHEMA}.ai_definitions")
    definitions_count = cur.fetchone()['count']

    return response(200, {
        'examples_count': examples_count,
        'active_rules_count': rules_count,
        'indexed_count': indexed_count,
        'auto_count': auto_count,
        'pending_reviews_count': pending_reviews_count,
        'reviewed_count': reviewed_count,
        'total_reviews': total_reviews,
        'training_progress': training_progress,
        'definitions_count': definitions_count,
    })


def handle_logs(method, event, cur, conn):
    if method == 'POST':
        body = json.loads(event.get('body', '{}'))
        description = body.get('description', '')[:500]
        error_message = body.get('error_message', '')[:500]
        duration_ms = body.get('duration_ms', 0)

        cur.execute(f"""
            INSERT INTO {SCHEMA}.ai_classification_logs
            (description, success, error_message, duration_ms, test_mode)
            VALUES (%s, false, %s, %s, false)
        """, (description, error_message, duration_ms))
        conn.commit()
        return response(201, {'ok': True})

    if method != 'GET':
        return response(405, {'error': 'Method not allowed'})

    limit = int(get_query_param(event, 'limit', '20'))
    offset = int(get_query_param(event, 'offset', '0'))
    success_filter = get_query_param(event, 'success', None)

    where_clause = ''
    if success_filter is not None:
        where_clause = f"WHERE success = {'true' if success_filter == 'true' else 'false'}"

    cur.execute(f"SELECT COUNT(*) as total FROM {SCHEMA}.ai_classification_logs {where_clause}")
    total = cur.fetchone()['total']

    cur.execute(f"""
        SELECT id, description, ticket_service_id, ticket_service_name,
               service_ids, service_names, confidence, success, error_message,
               raw_response, examples_used, rules_used, duration_ms,
               test_mode, created_at
        FROM {SCHEMA}.ai_classification_logs
        {where_clause}
        ORDER BY created_at DESC
        LIMIT {limit} OFFSET {offset}
    """)
    logs = [dict(r) for r in cur.fetchall()]

    cur.execute(f"SELECT COUNT(*) as c FROM {SCHEMA}.ai_classification_logs WHERE success = true")
    success_count = cur.fetchone()['c']

    cur.execute(f"SELECT COUNT(*) as c FROM {SCHEMA}.ai_classification_logs WHERE success = false")
    error_count = cur.fetchone()['c']

    cur.execute(f"SELECT AVG(confidence) as avg FROM {SCHEMA}.ai_classification_logs WHERE success = true AND confidence IS NOT NULL")
    avg_row = cur.fetchone()
    avg_confidence = round(avg_row['avg']) if avg_row['avg'] else 0

    return response(200, {
        'logs': logs,
        'total': total,
        'success_count': success_count,
        'fail_count': error_count,
        'avg_confidence': avg_confidence,
    })