import json
import os
import secrets
import string


TRANSLIT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
}


def translit(text: str) -> str:
    result = []
    for ch in (text or '').lower():
        if ch in TRANSLIT:
            result.append(TRANSLIT[ch])
        elif ch.isalnum():
            result.append(ch)
    return ''.join(result)


def build_login(first_name: str, last_name: str) -> str:
    fn = translit(first_name)
    ln = translit(last_name)
    initial = fn[0] if fn else ''
    return f"{initial}{ln}".strip('.') or 'user'


def gen_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + '!@#$%*'
    while True:
        pwd = ''.join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.islower() for c in pwd) and any(c.isupper() for c in pwd)
                and any(c.isdigit() for c in pwd)):
            return pwd


def response(status: int, body: dict) -> dict:
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'isBase64Encoded': False,
        'body': json.dumps(body, ensure_ascii=False),
    }


def handler(event: dict, context) -> dict:
    '''Создание учётной записи сотрудника (Битрикс + корпоративная почта).

    Пока работает в режиме заглушки: генерирует логин по ФИО и пароли,
    не выполняя реальных вызовов к Битрикс/ISPmanager.
    '''
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    if method != 'POST':
        return response(405, {'error': 'Method not allowed'})

    try:
        body = json.loads(event.get('body') or '{}')
    except (ValueError, TypeError):
        return response(400, {'error': 'Некорректный JSON'})

    last_name = (body.get('last_name') or '').strip()
    first_name = (body.get('first_name') or '').strip()
    middle_name = (body.get('middle_name') or '').strip()
    targets = body.get('targets') or ['bitrix', 'email']

    if not last_name or not first_name:
        return response(400, {'error': 'Укажите фамилию и имя'})

    domain = os.environ.get('CORP_MAIL_DOMAIN', 'company.ru')
    login = build_login(first_name, last_name)
    email = f"{login}@{domain}"

    full_name = ' '.join(p for p in [last_name, first_name, middle_name] if p)

    accounts = []

    if 'email' in targets:
        accounts.append({
            'system': 'email',
            'title': 'Корпоративная почта',
            'login': email,
            'password': gen_password(),
            'url': f'https://mail.{domain}',
        })

    if 'bitrix' in targets:
        accounts.append({
            'system': 'bitrix',
            'title': 'Битрикс24',
            'login': email,
            'password': gen_password(),
            'url': '',
        })

    return response(200, {
        'ok': True,
        'demo': True,
        'employee': {
            'full_name': full_name,
            'position': body.get('position') or '',
            'department': body.get('department') or '',
        },
        'accounts': accounts,
    })
