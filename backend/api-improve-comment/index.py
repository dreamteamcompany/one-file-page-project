"""Улучшение текста комментария через GigaChat — переформулирует в профессиональный и вежливый стиль"""
import json
import os
import uuid
import requests

GIGACHAT_AUTH_KEY = os.environ.get('GIGACHAT_AUTH_KEY')

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Id, Authorization, X-Endpoint',
    'Access-Control-Max-Age': '86400',
}

_token_cache = {'token': None, 'expires_at': 0}


def get_gigachat_token():
    import time
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
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    _token_cache['token'] = data['access_token']
    _token_cache['expires_at'] = now + data.get('expires_in', 1800)
    return _token_cache['token']


def improve_text(text: str, token: str) -> str:
    prompt = (
        'Перефразируй следующий текст комментария в профессиональный, вежливый и нейтральный стиль. '
        'Сохрани исходный смысл и суть сообщения. Убери грубость, ненормативную лексику и резкие выражения. '
        'Верни только улучшенный текст без пояснений и кавычек.\n\n'
        f'Текст: {text}'
    )

    resp = requests.post(
        'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}',
        },
        json={
            'model': 'GigaChat',
            'messages': [{'role': 'user', 'content': prompt}],
            'temperature': 0.3,
            'max_tokens': 1024,
        },
        verify=False,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()['choices'][0]['message']['content'].strip()


def handler(event: dict, context) -> dict:
    """Улучшение текста комментария через GigaChat"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Method not allowed'})}

    body = json.loads(event.get('body') or '{}')
    text = (body.get('text') or '').strip()

    if not text:
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Текст не может быть пустым'})}

    if len(text) > 4000:
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Текст слишком длинный (макс. 4000 символов)'})}

    token = get_gigachat_token()
    improved = improve_text(text, token)

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({'improved_text': improved}, ensure_ascii=False),
    }
