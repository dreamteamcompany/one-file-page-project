import json
import os
import secrets
import string
import urllib.request
import urllib.parse
import urllib.error
import ssl

import jwt
import psycopg2
from cryptography.fernet import Fernet


JWT_SECRET = os.environ.get('JWT_SECRET', '')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
ENC_KEY = os.environ.get('INTEGRATION_ENCRYPTION_KEY', '')

# Поля настроек интеграций: secret=True — маскируется при чтении в UI
SETTING_FIELDS = [
    {'key': 'bitrix_webhook_ru', 'label': 'Вебхук Битрикс РФ', 'group': 'Битрикс', 'secret': True,
     'hint': 'Полный URL входящего вебхука с правом user. Формат: https://портал.bitrix24.ru/rest/1/КОД/ (со слэшем в конце)'},
    {'key': 'bitrix_webhook_kz', 'label': 'Вебхук Битрикс КЗ', 'group': 'Битрикс', 'secret': True,
     'hint': 'Полный URL входящего вебхука с правом user. Формат: https://портал.bitrix24.kz/rest/1/КОД/ (со слэшем в конце)'},
    {'key': 'mail_domain_ru', 'label': 'Домен почты РФ', 'group': 'Почта РФ (ISPmanager)', 'secret': False,
     'hint': 'Только домен, без @ и https. Например: dreamteamcompany.ru'},
    {'key': 'ispmgr_url', 'label': 'URL ISPmanager', 'group': 'Почта РФ (ISPmanager)', 'secret': False,
     'hint': 'Адрес панели с https и портом. Например: https://mail.reg.ru:1500'},
    {'key': 'ispmgr_login', 'label': 'Логин ISPmanager', 'group': 'Почта РФ (ISPmanager)', 'secret': False,
     'hint': 'Логин учётной записи с правами управления почтой домена'},
    {'key': 'ispmgr_password', 'label': 'Пароль ISPmanager', 'group': 'Почта РФ (ISPmanager)', 'secret': True,
     'hint': 'Пароль от учётной записи ISPmanager'},
    {'key': 'mail_domain_kz', 'label': 'Домен почты КЗ', 'group': 'Почта КЗ (LanCloud)', 'secret': False,
     'hint': 'Только домен, без @ и https. Например: company.kz'},
    {'key': 'lancloud_url', 'label': 'URL LanCloud', 'group': 'Почта КЗ (LanCloud)', 'secret': False,
     'hint': 'Адрес панели с https. Например: https://cp.lancloud.kz'},
    {'key': 'lancloud_login', 'label': 'Логин LanCloud', 'group': 'Почта КЗ (LanCloud)', 'secret': False,
     'hint': 'Логин учётной записи LanCloud (CloudExchange)'},
    {'key': 'lancloud_password', 'label': 'Пароль LanCloud', 'group': 'Почта КЗ (LanCloud)', 'secret': True,
     'hint': 'Пароль от учётной записи LanCloud'},
]
SETTING_MAP = {f['key']: f for f in SETTING_FIELDS}

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


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_fernet():
    return Fernet(ENC_KEY.encode()) if ENC_KEY else None


def verify_token(event):
    headers = event.get('headers', {})
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
    if not token:
        return None
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except Exception:
        return None


def is_admin(payload):
    if not payload:
        return False
    roles = payload.get('roles') or []
    for r in roles:
        if isinstance(r, dict):
            if r.get('system_role') == 'admin' or r.get('name') in ('admin', 'Администратор', 'Admin'):
                return True
        elif r in ('admin', 'Администратор', 'Admin'):
            return True
    user_id = payload.get('user_id') or payload.get('id')
    if not user_id:
        return False
    try:
        conn = get_db()
        try:
            cur = conn.cursor()
            cur.execute(
                f"SELECT 1 FROM {SCHEMA}.user_roles ur "
                f"JOIN {SCHEMA}.roles r ON r.id = ur.role_id "
                f"WHERE ur.user_id = {int(user_id)} "
                f"AND (r.system_role = 'admin' OR r.name IN ('admin', 'Администратор', 'Admin')) LIMIT 1"
            )
            return cur.fetchone() is not None
        finally:
            conn.close()
    except Exception:
        return False


def load_settings_raw():
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT key, value_encrypted FROM {SCHEMA}.integration_settings")
        return {row[0]: row[1] for row in cur.fetchall()}
    finally:
        conn.close()


def decrypt_setting(fernet, enc):
    if not enc or not fernet:
        return ''
    try:
        return fernet.decrypt(enc.encode()).decode()
    except Exception:
        return ''


def get_setting(fernet, stored, key, env_fallback=''):
    """Значение из БД (расшифрованное) или из env, если в БД пусто."""
    val = decrypt_setting(fernet, stored.get(key))
    if val:
        return val
    return os.environ.get(env_fallback, '') if env_fallback else ''


def handle_get_settings(payload):
    if not is_admin(payload):
        return response(403, {'error': 'Доступ только для администраторов'})
    if not ENC_KEY:
        return response(500, {'error': 'Не задан ключ шифрования INTEGRATION_ENCRYPTION_KEY'})
    stored = load_settings_raw()
    fernet = get_fernet()
    fields = []
    for f in SETTING_FIELDS:
        enc = stored.get(f['key'])
        has_value = bool(enc)
        value = ''
        if has_value and not f['secret']:
            value = decrypt_setting(fernet, enc)
        fields.append({
            'key': f['key'], 'label': f['label'], 'group': f['group'],
            'secret': f['secret'], 'has_value': has_value, 'value': value,
            'hint': f.get('hint', ''),
        })
    return response(200, {'fields': fields})


def handle_save_settings(payload, body):
    if not is_admin(payload):
        return response(403, {'error': 'Доступ только для администраторов'})
    if not ENC_KEY:
        return response(500, {'error': 'Не задан ключ шифрования INTEGRATION_ENCRYPTION_KEY'})
    fernet = get_fernet()
    values = body.get('values') or {}
    user_id = payload.get('user_id') or payload.get('id') or 0
    conn = get_db()
    try:
        cur = conn.cursor()
        saved = 0
        for key, raw in values.items():
            if key not in SETTING_MAP:
                continue
            if SETTING_MAP[key]['secret'] and (raw is None or raw == ''):
                continue  # пустой секрет — не затираем
            enc = fernet.encrypt(str(raw if raw is not None else '').encode()).decode()
            cur.execute(
                f"INSERT INTO {SCHEMA}.integration_settings (key, value_encrypted, updated_by, updated_at) "
                f"VALUES (%s, %s, %s, CURRENT_TIMESTAMP) "
                f"ON CONFLICT (key) DO UPDATE SET value_encrypted = EXCLUDED.value_encrypted, "
                f"updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP",
                (key, enc, int(user_id) if user_id else None),
            )
            saved += 1
        conn.commit()
    finally:
        conn.close()
    return response(200, {'ok': True, 'saved': saved})


def handle_create(body):
    portal = (body.get('portal') or '').strip().lower()
    last_name = (body.get('last_name') or '').strip()
    first_name = (body.get('first_name') or '').strip()
    middle_name = (body.get('middle_name') or '').strip()
    targets = body.get('targets') or ['bitrix', 'email']

    if portal not in ('ru', 'kz'):
        return response(400, {'error': 'Выберите портал (ru или kz)'})
    if not last_name or not first_name:
        return response(400, {'error': 'Укажите фамилию и имя'})

    # Настройки из БД (с фолбэком на env-секреты)
    fernet = get_fernet()
    try:
        stored = load_settings_raw()
    except Exception:
        stored = {}

    if portal == 'kz':
        domain = get_setting(fernet, stored, 'mail_domain_kz', 'CORP_MAIL_DOMAIN_KZ') or 'company.kz'
        bitrix_url = get_setting(fernet, stored, 'bitrix_webhook_kz', 'BITRIX24_WEBHOOK_URL_KZ')
    else:
        domain = (get_setting(fernet, stored, 'mail_domain_ru', 'CORP_MAIL_DOMAIN_RU')
                  or os.environ.get('CORP_MAIL_DOMAIN', 'company.ru'))
        bitrix_url = get_setting(fernet, stored, 'bitrix_webhook_ru', 'BITRIX24_WEBHOOK_URL')

    login = build_login(first_name, last_name)
    email = f"{login}@{domain}"
    full_name = ' '.join(p for p in [last_name, first_name, middle_name] if p)

    accounts = []
    if 'email' in targets:
        accounts.append({
            'system': 'email', 'title': 'Корпоративная почта',
            'login': email, 'password': gen_password(),
            'url': f'https://mail.{domain}',
        })
    if 'bitrix' in targets:
        accounts.append({
            'system': 'bitrix', 'title': 'Битрикс24',
            'login': email, 'password': gen_password(),
            'url': bitrix_url,
        })

    return response(200, {
        'ok': True,
        'demo': True,
        'portal': portal,
        'employee': {
            'full_name': full_name,
            'position': body.get('position') or '',
            'department': body.get('department') or '',
            'city': body.get('city') or '',
            'gender': body.get('gender') or '',
            'phone': body.get('phone') or '',
        },
        'accounts': accounts,
    })


def _http_get(url, timeout=10, auth=None):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={'User-Agent': 'integration-check'})
    if auth:
        import base64
        token = base64.b64encode(f"{auth[0]}:{auth[1]}".encode()).decode()
        req.add_header('Authorization', f'Basic {token}')
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
        return r.getcode(), r.read().decode('utf-8', 'replace')


def check_bitrix(webhook_url):
    if not webhook_url:
        return {'ok': False, 'message': 'Вебхук не задан'}
    base = webhook_url.rstrip('/')
    url = f"{base}/profile.json"
    try:
        code, text = _http_get(url, timeout=10)
        data = json.loads(text) if text else {}
        if data.get('result'):
            res = data['result']
            name = res.get('NAME') or res.get('LAST_NAME') or res.get('ID') or ''
            return {'ok': True, 'message': f'Подключение успешно (аккаунт: {name})'.strip()}
        if data.get('error'):
            return {'ok': False, 'message': f"Битрикс вернул ошибку: {data.get('error_description') or data.get('error')}"}
        return {'ok': False, 'message': f'Неожиданный ответ (HTTP {code})'}
    except urllib.error.HTTPError as e:
        return {'ok': False, 'message': f'HTTP {e.code}: проверьте URL вебхука и права'}
    except urllib.error.URLError as e:
        return {'ok': False, 'message': f'Не удалось подключиться: {e.reason}'}
    except Exception as e:
        return {'ok': False, 'message': f'Ошибка проверки: {e}'}


def check_ispmanager(url, login, password):
    if not url or not login or not password:
        return {'ok': False, 'message': 'Заполните URL, логин и пароль ISPmanager'}
    base = url.rstrip('/')
    auth_url = f"{base}/ispmgr?out=json&func=auth&username={urllib.parse.quote(login)}&password={urllib.parse.quote(password)}"
    try:
        code, text = _http_get(auth_url, timeout=12)
        data = json.loads(text) if text else {}
        if data.get('doc', {}).get('auth') or data.get('auth') or ('error' not in json.dumps(data)):
            if 'error' in data or data.get('doc', {}).get('error'):
                return {'ok': False, 'message': 'Неверный логин или пароль'}
            return {'ok': True, 'message': 'Авторизация успешна'}
        return {'ok': False, 'message': 'Неверный логин или пароль'}
    except urllib.error.HTTPError as e:
        return {'ok': False, 'message': f'HTTP {e.code}: панель недоступна или неверный адрес'}
    except urllib.error.URLError as e:
        return {'ok': False, 'message': f'Панель недоступна: {e.reason}'}
    except Exception as e:
        return {'ok': False, 'message': f'Ошибка проверки: {e}'}


def check_lancloud(url, login, password):
    if not url or not login or not password:
        return {'ok': False, 'message': 'Заполните URL, логин и пароль LanCloud'}
    base = url.rstrip('/')
    try:
        code, text = _http_get(base, timeout=12, auth=(login, password))
        if code in (200, 302):
            return {'ok': True, 'message': 'Панель доступна, авторизация принята'}
        if code in (401, 403):
            return {'ok': False, 'message': 'Неверный логин или пароль'}
        return {'ok': False, 'message': f'Неожиданный ответ (HTTP {code})'}
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            return {'ok': False, 'message': 'Неверный логин или пароль'}
        return {'ok': False, 'message': f'HTTP {e.code}: панель недоступна'}
    except urllib.error.URLError as e:
        return {'ok': False, 'message': f'Панель недоступна: {e.reason}'}
    except Exception as e:
        return {'ok': False, 'message': f'Ошибка проверки: {e}'}


def handle_test(payload, body):
    if not is_admin(payload):
        return response(403, {'error': 'Доступ только для администраторов'})
    if not ENC_KEY:
        return response(500, {'error': 'Не задан ключ шифрования INTEGRATION_ENCRYPTION_KEY'})

    service = (body.get('service') or '').strip()
    fernet = get_fernet()
    try:
        stored = load_settings_raw()
    except Exception:
        stored = {}

    def val(key):
        return get_setting(fernet, stored, key)

    if service == 'bitrix_ru':
        result = check_bitrix(val('bitrix_webhook_ru') or os.environ.get('BITRIX24_WEBHOOK_URL', ''))
    elif service == 'bitrix_kz':
        result = check_bitrix(val('bitrix_webhook_kz') or os.environ.get('BITRIX24_WEBHOOK_URL_KZ', ''))
    elif service == 'mail_ru':
        result = check_ispmanager(
            val('ispmgr_url') or os.environ.get('ISPMGR_URL', ''),
            val('ispmgr_login') or os.environ.get('ISPMGR_LOGIN', ''),
            val('ispmgr_password') or os.environ.get('ISPMGR_PASSWORD', ''),
        )
    elif service == 'mail_kz':
        result = check_lancloud(val('lancloud_url'), val('lancloud_login'), val('lancloud_password'))
    else:
        return response(400, {'error': 'Неизвестный сервис'})

    return response(200, {'service': service, **result})


def handler(event: dict, context) -> dict:
    '''Учётные записи сотрудников и настройки интеграций (Битрикс/почта РФ и КЗ).

    GET  ?action=settings          — прочитать настройки интеграций (только админ, секреты маскируются).
    POST {action:'save_settings'}  — сохранить настройки (только админ, шифрование в БД).
    POST {action:'test'}           — проверить интеграцию сервиса (bitrix_ru/bitrix_kz/mail_ru/mail_kz).
    POST (создание)                — сгенерировать учётку сотрудника по выбранному порталу.
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

    params = event.get('queryStringParameters') or {}

    if method == 'GET':
        if params.get('action') == 'settings':
            payload = verify_token(event)
            if not payload:
                return response(401, {'error': 'Требуется авторизация'})
            return handle_get_settings(payload)
        return response(400, {'error': 'Неизвестный запрос'})

    if method != 'POST':
        return response(405, {'error': 'Method not allowed'})

    try:
        body = json.loads(event.get('body') or '{}')
    except (ValueError, TypeError):
        return response(400, {'error': 'Некорректный JSON'})

    if body.get('action') == 'save_settings':
        payload = verify_token(event)
        if not payload:
            return response(401, {'error': 'Требуется авторизация'})
        return handle_save_settings(payload, body)

    if body.get('action') == 'test':
        payload = verify_token(event)
        if not payload:
            return response(401, {'error': 'Требуется авторизация'})
        return handle_test(payload, body)

    return handle_create(body)