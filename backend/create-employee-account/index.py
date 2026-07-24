import base64
import hashlib
import html as html_lib
import http.cookiejar
import json
import logging
import os
import re
import secrets
import string
import urllib.request
import urllib.parse
import urllib.error
import ssl

import jwt
import psycopg2
from cryptography.fernet import Fernet


logger = logging.getLogger('create-employee-account')
logger.setLevel(logging.INFO)

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


def build_login_variants(first_name: str, last_name: str):
    """Варианты логина по приоритету: ipetrov, затем i.petrov."""
    fn = translit(first_name)
    ln = translit(last_name)
    initial = fn[0] if fn else ''
    variants = []
    primary = f"{initial}{ln}".strip('.') or 'user'
    variants.append(primary)
    if initial and ln:
        alt = f"{initial}.{ln}"
        if alt not in variants:
            variants.append(alt)
    return variants


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
    targets = body.get('targets')
    if targets is None:
        targets = ['bitrix', 'email']

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

    selected_domain = (body.get('domain') or '').strip().lower()

    if portal == 'kz':
        domain = selected_domain or get_setting(fernet, stored, 'mail_domain_kz', 'CORP_MAIL_DOMAIN_KZ') or 'company.kz'
        bitrix_url = get_setting(fernet, stored, 'bitrix_webhook_kz', 'BITRIX24_WEBHOOK_URL_KZ')
    else:
        domain = (selected_domain
                  or get_setting(fernet, stored, 'mail_domain_ru', 'CORP_MAIL_DOMAIN_RU')
                  or os.environ.get('CORP_MAIL_DOMAIN', 'company.ru'))
        bitrix_url = get_setting(fernet, stored, 'bitrix_webhook_ru', 'BITRIX24_WEBHOOK_URL')

    login_variants = build_login_variants(first_name, last_name)
    login = login_variants[0]
    email = f"{login}@{domain}"
    full_name = ' '.join(p for p in [last_name, first_name, middle_name] if p)

    position = (body.get('position') or '').strip()
    phone = (body.get('phone') or '').strip()
    city = (body.get('city') or '').strip()
    gender = (body.get('gender') or '').strip()
    birth_date = (body.get('birth_date') or '').strip()
    hire_date = (body.get('hire_date') or '').strip()

    # Отделы: поддерживаем список departments[] и старое поле department.
    departments = _normalize_str_list(body.get('departments'))
    for d in _normalize_str_list(body.get('department')):
        if d.lower() not in {x.lower() for x in departments}:
            departments.append(d)
    heads = _normalize_str_list(body.get('heads'))

    accounts = []
    # Единый пароль для всех учёток сотрудника (почта = Битрикс).
    shared_password = gen_password()
    if 'email' in targets:
        mail_password = shared_password
        if portal == 'ru':
            isp_url = get_setting(fernet, stored, 'ispmgr_url', 'ISPMGR_URL')
            isp_login = get_setting(fernet, stored, 'ispmgr_login', 'ISPMGR_LOGIN')
            isp_password = get_setting(fernet, stored, 'ispmgr_password', 'ISPMGR_PASSWORD')
            # Подбираем свободный логин: ipetrov -> i.petrov. Если оба заняты — ошибка.
            m_ok, m_msg = False, 'Не удалось создать ящик'
            all_taken = True
            for candidate in login_variants:
                c_ok, c_msg, c_code = create_ispmanager_mailbox(
                    isp_url, isp_login, isp_password, domain, candidate, mail_password,
                )
                if c_ok:
                    login = candidate
                    email = f"{login}@{domain}"
                    m_ok, m_msg = True, c_msg
                    all_taken = False
                    break
                m_msg = c_msg
                if c_code == 'exists':
                    continue  # логин занят — пробуем следующий вариант
                all_taken = False  # это не "занято", а другая ошибка
                break
            if not m_ok and all_taken:
                m_msg = (
                    f'Все варианты логина заняты (пробовали: '
                    f'{", ".join(login_variants)}). Укажите логин вручную.'
                )
            accounts.append({
                'system': 'email', 'title': 'Корпоративная почта',
                'login': email, 'password': mail_password,
                'url': isp_url or f'https://mail.{domain}',
                'status': 'created' if m_ok else 'error',
                'error': '' if m_ok else m_msg,
            })
        else:
            accounts.append({
                'system': 'email', 'title': 'Корпоративная почта',
                'login': email, 'password': mail_password,
                'url': f'https://mail.{domain}',
                'status': 'demo',
                'error': '',
            })
    if 'bitrix' in targets:
        bx_password = shared_password
        portal_url = ''
        if bitrix_url:
            m = re.match(r'(https?://[^/]+)', bitrix_url)
            portal_url = m.group(1) if m else bitrix_url
        ok, message, bitrix_id = create_bitrix_user(
            bitrix_url, email, bx_password, first_name, last_name,
            middle_name=middle_name, position=position, phone=phone,
            departments=departments, heads=heads,
            city=city, gender=gender, birth_date=birth_date, hire_date=hire_date,
        )
        accounts.append({
            'system': 'bitrix', 'title': 'Битрикс24',
            'login': email, 'password': bx_password,
            'url': portal_url,
            'status': 'created' if ok else 'error',
            'error': '' if ok else message,
            'bitrix_id': bitrix_id,
        })

    any_failed = any(a['status'] == 'error' for a in accounts)

    return response(200, {
        'ok': not any_failed,
        'portal': portal,
        'employee': {
            'full_name': full_name,
            'position': body.get('position') or '',
            'department': ', '.join(departments),
            'departments': departments,
            'heads': heads,
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


def _http_post(url, params: dict, timeout=15):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    data = urllib.parse.urlencode(params, doseq=True).encode()
    req = urllib.request.Request(url, data=data, headers={
        'User-Agent': 'integration-create',
        'Content-Type': 'application/x-www-form-urlencoded',
    })
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
        return r.getcode(), r.read().decode('utf-8', 'replace')


def _fetch_all_bitrix_departments(webhook_url):
    """Возвращает все отделы Битрикса, обходя постраничную выдачу (по 50)."""
    base = webhook_url.rstrip('/')
    all_deps = []
    start = 0
    for _ in range(100):  # предохранитель: до 5000 отделов
        try:
            code, text = _http_get(
                f"{base}/department.get.json?ORDER[NAME]=ASC&start={start}", timeout=12
            )
            data = json.loads(text) if text else {}
        except Exception:
            break
        chunk = data.get('result', []) or []
        all_deps.extend(chunk)
        nxt = data.get('next')
        if nxt is None:
            break
        start = nxt
    return all_deps


def find_bitrix_department(webhook_url, name):
    """Ищет ID отдела в Битрикс по названию (без учёта регистра). None если не найден."""
    if not name:
        return None
    target = name.strip().lower()
    deps = _fetch_all_bitrix_departments(webhook_url)
    # 1) точное совпадение названия
    for dep in deps:
        if str(dep.get('NAME', '')).strip().lower() == target:
            return dep.get('ID')
    # 2) вхождение подстроки (запасной вариант)
    for dep in deps:
        if target in str(dep.get('NAME', '')).strip().lower():
            return dep.get('ID')
    return None


def _fetch_bitrix_user_by_name(webhook_url, full_name):
    """Ищет пользователя Битрикс по ФИО. Возвращает его ID или None.
    ФИО может быть в любом порядке (Фамилия Имя / Имя Фамилия)."""
    base = webhook_url.rstrip('/')
    parts = [p for p in re.split(r'\s+', (full_name or '').strip()) if p]
    if not parts:
        return None
    # Пробуем разные комбинации фамилии/имени
    combos = []
    if len(parts) >= 2:
        combos.append((parts[0], parts[1]))  # Фамилия Имя
        combos.append((parts[1], parts[0]))  # Имя Фамилия
    for last_name, first_name in combos:
        try:
            q = urllib.parse.urlencode({'FILTER[LAST_NAME]': last_name,
                                        'FILTER[NAME]': first_name})
            code, text = _http_get(f"{base}/user.get.json?{q}", timeout=12)
            data = json.loads(text) if text else {}
            res = data.get('result') or []
            if res:
                return res[0].get('ID')
        except Exception:
            continue
    # Запасной вариант: ищем по одной только фамилии
    try:
        q = urllib.parse.urlencode({'FILTER[LAST_NAME]': parts[0]})
        code, text = _http_get(f"{base}/user.get.json?{q}", timeout=12)
        data = json.loads(text) if text else {}
        res = data.get('result') or []
        if len(res) == 1:
            return res[0].get('ID')
    except Exception:
        pass
    return None


def find_bitrix_department_by_head(webhook_url, head_name):
    """Ищет ID отдела в Битрикс, руководителем (UF_HEAD) которого является
    указанный по ФИО сотрудник. Возвращает ID отдела или None."""
    if not head_name:
        return None
    user_id = _fetch_bitrix_user_by_name(webhook_url, head_name)
    if not user_id:
        return None
    deps = _fetch_all_bitrix_departments(webhook_url)
    for dep in deps:
        if str(dep.get('UF_HEAD', '')).strip() == str(user_id).strip():
            return dep.get('ID')
    return None


def resolve_bitrix_department_ids(webhook_url, departments, heads):
    """Находит ID отделов Битрикс по названиям (departments) и по ФИО
    руководителей (heads). Возвращает (dep_ids, errors).
    dep_ids — список уникальных ID (строки), errors — список пояснений
    по ненайденным отделам/руководителям."""
    dep_ids = []
    errors = []
    seen = set()

    def _add(dep_id):
        if dep_id and str(dep_id) not in seen:
            seen.add(str(dep_id))
            dep_ids.append(str(dep_id))

    for name in (departments or []):
        dep_id = find_bitrix_department(webhook_url, name)
        if dep_id:
            _add(dep_id)
        else:
            errors.append(f'Отдел «{name}» не найден в Битрикс — проверьте название')

    for head in (heads or []):
        dep_id = find_bitrix_department_by_head(webhook_url, head)
        if dep_id:
            _add(dep_id)
        else:
            errors.append(f'Не найден отдел по руководителю «{head}» — проверьте ФИО и что он назначен руководителем отдела в Битрикс')

    return dep_ids, errors


def _to_bitrix_date(value):
    """Приводит дату к формату ДД.ММ.ГГГГ, который принимает Битрикс."""
    if not value:
        return ''
    v = str(value).strip()
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', v)
    if m:
        return f"{m.group(3)}.{m.group(2)}.{m.group(1)}"
    return v


def _to_bitrix_gender(value):
    """Приводит пол к формату Битрикса: M / F."""
    v = str(value or '').strip().lower()
    if v in ('m', 'male', 'м', 'муж', 'мужской'):
        return 'M'
    if v in ('f', 'female', 'ж', 'жен', 'женский'):
        return 'F'
    return ''


def create_bitrix_user(webhook_url, email, password, first_name, last_name,
                       middle_name='', position='', phone='', departments=None,
                       heads=None, city='', gender='', birth_date='', hire_date=''):
    """Создаёт пользователя в Битрикс через user.add. Пользователь может состоять
    сразу в нескольких отделах (departments — названия, heads — ФИО руководителей).
    Возвращает (ok, message, bitrix_id)."""
    if not webhook_url:
        return False, 'Вебхук Битрикс не задан', None
    base = webhook_url.rstrip('/')
    url = f"{base}/user.add.json"

    dep_ids, errors = resolve_bitrix_department_ids(webhook_url, departments, heads)
    if errors:
        return False, '; '.join(errors), None
    if not dep_ids:
        dep_ids = ['1']

    # ВАЖНО (коробочный Битрикс24): пользователь создаётся сразу АКТИВНЫМ, с нашим
    # сгенерированным паролем и БЕЗ письма-приглашения.
    #
    # Почему прошлые версии слали письмо-приглашение:
    #   1) SEND_INFO. Метод user.add при добавлении сотрудника с EMAIL по умолчанию
    #      отправляет письмо с данными для входа. Триггер письма — именно это поле.
    #      Явно ставим SEND_INFO='N' — письмо НЕ отправляется.
    #   2) CONFIRM_CODE. Передача этого ключа (даже пустым '') переводит учётку
    #      в режим «регистрация не подтверждена». Поэтому его здесь НЕТ вообще.
    #   Пароль задаём напрямую в открытом виде (PASSWORD/CONFIRM_PASSWORD),
    #   ACTIVE='Y' — учётка активна, LOGIN=email, EMAIL — контактный адрес.
    params = {
        'LOGIN': email,
        'EMAIL': email,
        'PASSWORD': password,
        'CONFIRM_PASSWORD': password,
        'NAME': first_name,
        'LAST_NAME': last_name,
        'SECOND_NAME': middle_name,
        'WORK_POSITION': position,
        'PERSONAL_MOBILE': phone,
        'ACTIVE': 'Y',
        'EXTRANET': 'N',
        'SEND_INFO': 'N',
    }
    for i, dep_id in enumerate(dep_ids):
        params[f'UF_DEPARTMENT[{i}]'] = dep_id
    if city:
        params['PERSONAL_CITY'] = city
    bx_gender = _to_bitrix_gender(gender)
    if bx_gender:
        params['PERSONAL_GENDER'] = bx_gender
    bx_birth = _to_bitrix_date(birth_date)
    if bx_birth:
        params['PERSONAL_BIRTHDAY'] = bx_birth
    bx_hire = _to_bitrix_date(hire_date)
    if bx_hire:
        params['UF_EMPLOYMENT_DATE'] = bx_hire
    try:
        code, text = _http_post(url, params)
        logger.info('Bitrix user.add resp: %s', (text or '')[:600])
        data = json.loads(text) if text else {}
        if data.get('result'):
            new_id = data['result']
            # П.3 (диагностика): сразу читаем созданного пользователя и логируем
            # ВСЕ поля. Никаких записей (user.update) здесь НЕ делаем, чтобы не
            # инициировать событий, которые могли бы отправить письмо.
            try:
                _, chk_text = _http_get(
                    f"{base}/user.get.json?ID={new_id}", timeout=15
                )
                logger.info('Bitrix user.get resp: %s', (chk_text or '')[:1500])
            except Exception as e:
                logger.info('Bitrix user.get error: %s', e)
            return True, 'Создан в Битрикс', new_id
        if data.get('error'):
            desc = data.get('error_description') or data.get('error')
            return False, f'Битрикс: {desc}', None
        return False, f'Неожиданный ответ Битрикс (HTTP {code})', None
    except urllib.error.HTTPError as e:
        body = ''
        try:
            body = e.read().decode('utf-8', 'replace')
            j = json.loads(body)
            body = j.get('error_description') or j.get('error') or body
        except Exception:
            pass
        return False, f'HTTP {e.code}: {body or "проверьте вебхук и права"}', None
    except urllib.error.URLError as e:
        return False, f'Не удалось подключиться: {e.reason}', None
    except Exception as e:
        return False, f'Ошибка создания: {e}', None


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


LANCLOUD_SIGN = 'https://sign.lancloud.kz'
LANCLOUD_CLIENT_ID = '3A5E1F10-1FFB-45B5-A763-4BC46D02AD47'


def _ssl_ctx():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _pkce_pair():
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b'=').decode()
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b'=').decode()
    return verifier, challenge


def lancloud_login(cp_url, login, password):
    """Вход в LanCloud через OAuth-форму (IdentityServer). Возвращает (opener, error)."""
    cp_base = (cp_url or 'https://cp.lancloud.kz').rstrip('/')
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(cj),
        urllib.request.HTTPSHandler(context=_ssl_ctx()),
    )
    opener.addheaders = [('User-Agent', 'Mozilla/5.0 integration')]

    verifier, challenge = _pkce_pair()
    state = secrets.token_urlsafe(16)
    nonce = secrets.token_urlsafe(16)
    authorize = f"{LANCLOUD_SIGN}/connect/authorize?" + urllib.parse.urlencode({
        'response_type': 'code',
        'client_id': LANCLOUD_CLIENT_ID,
        'state': state,
        'redirect_uri': f'{cp_base}/ru/',
        'scope': 'cloud openid profile offline_access',
        'code_challenge': challenge,
        'code_challenge_method': 'S256',
        'nonce': nonce,
    })

    try:
        r = opener.open(authorize, timeout=20)
        html = r.read().decode('utf-8', 'replace')
        login_url = r.geturl()
    except urllib.error.URLError as e:
        return None, f'Панель авторизации недоступна: {getattr(e, "reason", e)}'
    except Exception as e:
        return None, f'Ошибка запроса авторизации: {e}'

    m = re.search(r'name="__RequestVerificationToken"[^>]*value="([^"]+)"', html)
    if not m:
        return None, 'Не удалось получить форму входа LanCloud (изменилась страница)'
    token = m.group(1)

    # Разбираем ВСЕ поля формы с их реальными значениями (важно для antiforgery и ReturnUrl)
    inputs = re.findall(r'<input\b[^>]*>', html, re.IGNORECASE)
    login_field = None
    pass_field = None
    form_data = {}
    for tag in inputs:
        name_m = re.search(r'name="([^"]+)"', tag)
        if not name_m:
            continue
        name = name_m.group(1)
        type_m = re.search(r'type="([^"]+)"', tag)
        itype = (type_m.group(1) if type_m else 'text').lower()
        val_m = re.search(r'value="([^"]*)"', tag)
        value = val_m.group(1) if val_m else ''
        low = name.lower()
        if itype == 'password' and not pass_field:
            pass_field = name
        elif itype in ('email', 'text') and not login_field and (
            'user' in low or 'email' in low or 'login' in low or 'name' in low
        ):
            login_field = name
        else:
            # hidden/checkbox/token — отправляем как есть, с реальным значением
            if itype == 'checkbox':
                form_data[name] = value or 'false'
            else:
                form_data[name] = value

    if not (login_field and pass_field):
        return None, 'Не удалось распознать поля логина/пароля в форме LanCloud'

    # Раскодируем HTML-сущности в значениях (ReturnUrl часто с &amp;)
    form_data = {k: html_lib.unescape(v) for k, v in form_data.items()}
    form_data['__RequestVerificationToken'] = html_lib.unescape(token)
    form_data[login_field] = login
    form_data[pass_field] = password
    for rk in ('Input.RememberLogin', 'RememberLogin'):
        if rk in form_data:
            form_data[rk] = 'true'

    diag = f'поля: login={login_field}, pass={pass_field}, hidden={list(k for k in form_data if k not in (login_field, pass_field))}'

    body = urllib.parse.urlencode(form_data).encode()
    req = urllib.request.Request(login_url, data=body, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    req.add_header('Origin', LANCLOUD_SIGN)
    req.add_header('Referer', login_url)
    req.add_header('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
    try:
        resp = opener.open(req, timeout=20)
        final_html = resp.read().decode('utf-8', 'replace')
        final_url = resp.geturl()
        code = resp.getcode()
    except urllib.error.HTTPError as e:
        detail = ''
        try:
            detail = e.read().decode('utf-8', 'replace')[:200]
        except Exception:
            pass
        return None, f'HTTP {e.code} при входе в LanCloud ({diag}). {detail}'
    except Exception as e:
        return None, f'Ошибка входа: {e}'

    has_session = any(c.name.startswith('.AspNetCore.Identity') and 'Application' in c.name for c in cj)
    cookies = [c.name for c in cj]
    on_login = '/Account/Login' in final_url
    has_error = 'validation-summary-errors' in final_html or 'field-validation-error' in final_html
    continued = 'connect/authorize' in final_html or 'cp.lancloud.kz' in final_url or 'connect/token' in final_html
    if (has_session or continued) and not (on_login and has_error):
        return opener, ''

    last = f'code={code}, url={final_url[:70]}, session={has_session}, error={has_error}, cookies={cookies}'
    return None, f'Вход не удался. {diag}. {last}'


def check_lancloud(url, login, password):
    if not url or not login or not password:
        return {'ok': False, 'message': 'Заполните URL, логин и пароль LanCloud'}
    opener, err = lancloud_login(url, login, password)
    if opener is None:
        return {'ok': False, 'message': err}
    return {'ok': True, 'message': 'Авторизация через форму успешна'}


def _extract_domains(obj):
    """Рекурсивно собрать доменные имена из произвольной JSON-структуры."""
    found = set()

    def walk(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if k in ('name', 'domain', 'domain_name', '$') and isinstance(v, str):
                    cand = v.strip().lower()
                    if '.' in cand and ' ' not in cand and '@' not in cand:
                        found.add(cand)
                walk(v)
        elif isinstance(node, list):
            for it in node:
                walk(it)

    walk(obj)
    return sorted(found)


def list_ispmanager_domains(url, login, password):
    if not url or not login or not password:
        return None, 'Не заполнены доступы ISPmanager в настройках'
    base = url.rstrip('/')
    # func=emaildomain — список почтовых доменов; email — ящики. Пробуем оба.
    last_err = 'Домены не найдены в ответе ISPmanager'
    for func in ('emaildomain', 'email'):
        q = urllib.parse.urlencode({
            'out': 'json', 'func': func, 'authinfo': f'{login}:{password}',
        })
        try:
            code, text = _http_get(f"{base}/ispmgr?{q}", timeout=15)
        except urllib.error.HTTPError as e:
            last_err = f'HTTP {e.code}: панель ISPmanager недоступна'
            continue
        except urllib.error.URLError as e:
            return None, f'Панель ISPmanager недоступна: {getattr(e, "reason", e)}'
        except Exception as e:
            last_err = f'Ошибка соединения с ISPmanager: {e}'
            continue

        if not text:
            continue
        data = None
        try:
            data = json.loads(text)
        except Exception:
            # ISPmanager иногда отдаёт XML — вытащим домены регуляркой
            names = re.findall(r'name=["\']([a-z0-9.\-]+\.[a-z]{2,})["\']', text.lower())
            names += re.findall(r'<name>\s*([a-z0-9.\-]+\.[a-z]{2,})\s*</name>', text.lower())
            domains = sorted(set(n for n in names if '@' not in n))
            if 'error' in text.lower() and not domains:
                last_err = 'Ошибка авторизации или доступа к почте ISPmanager'
            if domains:
                return domains, ''
            continue

        if isinstance(data, dict) and (data.get('doc', {}).get('error') or data.get('error')):
            last_err = 'Ошибка авторизации или доступа к почте ISPmanager'
            continue
        domains = _extract_domains(data)
        if domains:
            return domains, ''
    return None, last_err


def _isp_parse_error(text):
    """Разбирает ответ ISPmanager. Возвращает (status, message):
    status: 'ok' — успех, 'error' — ошибка с текстом, 'missing' — функция не найдена."""
    if not text:
        return 'ok', 'Ящик создан'
    try:
        data = json.loads(text)
    except Exception:
        low = text.lower()
        if 'error' in low:
            m = re.search(r'<error[^>]*>(.*?)</error>', text, re.S | re.I)
            msg = (m.group(1).strip() if m else 'ошибка создания ящика')
            status = 'missing' if 'missing' in low or 'find the' in low else 'error'
            return status, msg[:200]
        return 'ok', 'Ящик создан'

    if not isinstance(data, dict):
        return 'ok', 'Ящик создан'
    doc = data.get('doc') if isinstance(data.get('doc'), dict) else {}
    err = doc.get('error') or data.get('error')
    if not err:
        return 'ok', 'Ящик создан'
    raw = err
    if isinstance(raw, dict):
        raw = raw.get('msg') or raw.get('$') or raw.get('type') or raw
    if isinstance(raw, dict):
        raw = raw.get('$') or raw.get('msg') or json.dumps(raw, ensure_ascii=False)
    msg = str(raw)
    status = 'missing' if ('missing' in msg.lower() or 'find the' in msg.lower()) else 'error'
    return status, msg[:200]


def create_ispmanager_mailbox(url, login, password, domain, mailbox, mail_password):
    """Создаёт почтовый ящик в ISPmanager. Перебирает возможные имена функции.
    Возвращает (ok, message, code), где code:
    'ok' — создан, 'exists' — ящик уже занят, 'missing_module' — нет модуля почты,
    'error' — прочая ошибка, 'unavailable' — панель недоступна."""
    if not url or not login or not password:
        return False, 'Не заполнены доступы ISPmanager в настройках', 'error'
    if not domain:
        return False, 'Не указан домен почты', 'error'
    base = url.rstrip('/')
    full = f'{mailbox}@{domain}'
    authinfo = f'{login}:{password}'

    # В ISPmanager 6 почтовый ящик — дочерний объект почтового домена.
    # Список ящиков отдаётся функцией `email`, поэтому создание/редактирование —
    # `email.edit`, где почтовый домен передаётся как plid (родитель),
    # а имя ящика (без домена) — в поле name. Перебираем возможные имена полей/функций
    # под разные сборки панели (в т.ч. shared-хостинг reg.ru).
    variants = [
        {'func': 'email.edit', 'plid': domain, 'name': mailbox,
         'passwd': mail_password, 'confirm': mail_password, 'sok': 'ok'},
        {'func': 'email.edit', 'elid': domain, 'name': mailbox,
         'passwd': mail_password, 'confirm': mail_password, 'sok': 'ok'},
        {'func': 'email.edit', 'plid': domain, 'name': full,
         'passwd': mail_password, 'confirm': mail_password, 'sok': 'ok'},
        {'func': 'emailbox.edit', 'plid': domain, 'name': mailbox,
         'passwd': mail_password, 'confirm': mail_password, 'sok': 'ok'},
        {'func': 'emailbox.edit', 'elid': domain, 'domain': domain, 'name': mailbox,
         'passwd': mail_password, 'confirm': mail_password, 'sok': 'ok'},
    ]

    # На rest-панели reg.ru рабочий путь — /ispmgr (тот же, что для списка доменов).
    # Старые/иные сборки — /manager/ispmgr. Сначала пробуем рабочий /ispmgr.
    api_paths = ['/ispmgr', '/manager/ispmgr']
    last_msg = 'Не удалось создать ящик'
    all_missing = True  # ни один вариант функции не найден => модуль почты не подключён
    for api_path in api_paths:
      path_missing = False
      for params in variants:
        q = urllib.parse.urlencode(dict(params, out='json', authinfo=authinfo))
        try:
            code, text = _http_get(f"{base}{api_path}?{q}", timeout=20)
        except urllib.error.HTTPError as e:
            try:
                text = e.read().decode('utf-8', 'replace')
            except Exception:
                path_missing = True
                break
        except urllib.error.URLError as e:
            return False, f'Панель ISPmanager недоступна: {getattr(e, "reason", e)}', 'unavailable'
        except Exception as e:
            return False, f'Ошибка соединения с ISPmanager: {e}', 'unavailable'

        status, msg = _isp_parse_error(text)
        logger.info('ISP mailbox try path=%s func=%s -> status=%s resp=%s',
                    api_path, params.get('func'), status, (text or '')[:400])
        if status == 'ok':
            return True, 'Ящик создан', 'ok'
        last_msg = msg
        if status == 'missing':
            continue  # эта функция недоступна — пробуем следующую
        all_missing = False
        low = msg.lower()
        if 'already exist' in low or 'уже сущест' in low:
            return False, f'Почтовый ящик {full} уже существует', 'exists'
        return False, f'ISPmanager: {msg}', 'error'  # реальная ошибка
      if path_missing:
        continue  # этот путь API недоступен — пробуем следующий

    if all_missing:
        return False, (
            'Панель ISPmanager не приняла ни одну команду создания ящика. '
            'Убедитесь, что у пользователя ISPmanager (доступы в Настройки → Интеграции) '
            'есть права на управление почтой этого домена, и что домен '
            f'«{domain}» существует в разделе «Почта» панели.'
        ), 'missing_module'
    return False, (
        f'ISPmanager: {last_msg}. Проверьте, что в URL панели указан адрес с портом '
        f'(например https://sm11.hosting.reg.ru:1500), а у пользователя есть доступ к почте.'
    ), 'error'


def list_lancloud_domains(url, login, password):
    if not url or not login or not password:
        return None, 'Не заполнены доступы LanCloud в настройках'
    opener, err = lancloud_login(url, login, password)
    if opener is None:
        return None, err

    base = (url or 'https://cp.lancloud.kz').rstrip('/')
    api = 'https://api.lancloud.kz'
    candidates = [
        f'{base}/api/exchange/domains',
        f'{base}/api/exchange/accepted-domains',
        f'{base}/api/mail/domains',
        f'{base}/api/domains',
        f'{base}/api/v1/exchange/domains',
        f'{base}/ru/api/exchange/domains',
        f'{api}/exchange/domains',
        f'{api}/api/exchange/domains',
        f'{api}/v1/exchange/domains',
    ]

    def try_json(path):
        req = urllib.request.Request(path)
        req.add_header('Accept', 'application/json, text/plain, */*')
        req.add_header('X-Requested-With', 'XMLHttpRequest')
        req.add_header('Referer', f'{base}/ru/')
        resp = opener.open(req, timeout=20)
        text = resp.read().decode('utf-8', 'replace')
        data = json.loads(text) if text else None
        return _extract_domains(data) if data is not None else []

    errors = []
    for path in candidates:
        try:
            domains = try_json(path)
            if domains:
                return domains, ''
        except urllib.error.HTTPError as e:
            errors.append(f'{e.code}:{path.split("//")[-1][:40]}')
            continue
        except urllib.error.URLError as e:
            errors.append(f'net:{path.split("//")[-1][:30]}')
            continue
        except Exception:
            continue

    # Fallback: попробовать вытащить домены прямо со страницы панели почты
    for page in (f'{base}/ru/', f'{base}/ru/exchange', f'{base}/ru/mail'):
        try:
            req = urllib.request.Request(page)
            req.add_header('Accept', 'text/html,application/xhtml+xml,*/*')
            resp = opener.open(req, timeout=20)
            text = resp.read().decode('utf-8', 'replace')
            found = sorted(set(re.findall(r'@([a-z0-9][a-z0-9.\-]+\.[a-z]{2,})', text.lower())))
            found = [d for d in found if not d.endswith('lancloud.kz')]
            if found:
                return found, ''
        except Exception:
            continue

    return None, f'Не удалось получить домены LanCloud. Проверенные адреса: {", ".join(errors[:5]) or "нет ответа"}'


def handle_list_domains(payload, body):
    if not payload:
        return response(401, {'error': 'Требуется авторизация'})
    if not ENC_KEY:
        return response(500, {'error': 'Не задан ключ шифрования INTEGRATION_ENCRYPTION_KEY'})

    portal = (body.get('portal') or '').strip().lower()
    if portal not in ('ru', 'kz'):
        return response(400, {'error': 'Выберите портал (ru или kz)'})

    fernet = get_fernet()
    try:
        stored = load_settings_raw()
    except Exception:
        stored = {}

    def val(key, env=''):
        return get_setting(fernet, stored, key, env)

    if portal == 'ru':
        domains, err = list_ispmanager_domains(
            val('ispmgr_url', 'ISPMGR_URL'),
            val('ispmgr_login', 'ISPMGR_LOGIN'),
            val('ispmgr_password', 'ISPMGR_PASSWORD'),
        )
    else:
        domains, err = list_lancloud_domains(
            val('lancloud_url'), val('lancloud_login'), val('lancloud_password'),
        )

    if domains is None:
        return response(502, {'error': err})
    return response(200, {'portal': portal, 'domains': domains})


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


ROUTERAI_API_KEY = os.environ.get('ROUTERAI_API_KEY', '')
ROUTERAI_URL = 'https://routerai.ru/api/v1/chat/completions'
AI_MODEL = 'google/gemini-2.5-flash'

AI_SYSTEM_PROMPT = (
    "Ты — ассистент ИТ-поддержки. Анализируй заявку целиком: тему, описание, дополнительные поля "
    "и все комментарии. Твоя задача — определить, требуется ли по заявке СОЗДАТЬ НОВУЮ учётную "
    "запись сотрудника (в корпоративном портале Битрикс24 и корпоративной почте), например при "
    "приёме нового сотрудника, оформлении доступа новичку, заведении аккаунта. "
    "Если заявка про другое (сброс пароля, блокировка, увольнение, техническая проблема, вопрос) — "
    "учётку создавать НЕ нужно.\n\n"
    "Извлеки данные НОВОГО сотрудника (для кого создаётся учётка), а НЕ данные автора заявки, "
    "если это разные люди. Данные бери из текста заявки, полей и комментариев.\n\n"
    "Верни СТРОГО JSON без пояснений и markdown, по схеме:\n"
    "{\n"
    '  "needs_account": true|false,\n'
    '  "confidence": 0.0-1.0,\n'
    '  "reason": "краткое обоснование на русском",\n'
    '  "portal": "ru"|"kz"|"",\n'
    '  "fields": {\n'
    '    "last_name": "", "first_name": "", "middle_name": "",\n'
    '    "position": "", "city": "",\n'
    '    "gender": "male"|"female"|"", "phone": "", "birth_date": "", "hire_date": "",\n'
    '    "departments": [], "heads": []\n'
    "  }\n"
    "}\n"
    "Незаполненные текстовые поля оставляй пустой строкой, списки — пустым массивом []. "
    "Даты в формате YYYY-MM-DD. Телефон в исходном виде. Пол определи по имени/отчеству, если явно не указан. "
    "portal='kz' только если явно упомянут Казахстан/КЗ, иначе 'ru'.\n"
    "ВАЖНО про отделы: сотрудника могут добавлять сразу в несколько отделов "
    "(например при подчинении нескольким руководителям). "
    "В \"departments\" перечисли НАЗВАНИЯ всех отделов/подразделений, если они явно указаны в заявке. "
    "В \"heads\" перечисли ФИО всех руководителей, которым подчиняется новый сотрудник, если они указаны "
    "(по каждому руководителю сотрудника добавят в его отдел). "
    "Если указано подчинение двум руководителям — в \"heads\" должно быть два ФИО."
)

AI_ALLOWED_FIELDS = ['last_name', 'first_name', 'middle_name', 'position',
                     'city', 'gender', 'phone', 'birth_date', 'hire_date']


def _normalize_str_list(value):
    """Приводит значение к списку непустых строк без дублей (сохраняя порядок)."""
    if value is None:
        return []
    if isinstance(value, str):
        items = [value]
    elif isinstance(value, (list, tuple)):
        items = list(value)
    else:
        items = [value]
    result = []
    seen = set()
    for item in items:
        s = str(item).strip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(s)
    return result


def load_ticket_context(ticket_id):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            f"SELECT t.title, t.description, u.full_name, u.position, d.name "
            f"FROM {SCHEMA}.tickets t "
            f"LEFT JOIN {SCHEMA}.users u ON u.id = t.created_by "
            f"LEFT JOIN {SCHEMA}.departments d ON d.id = u.department_id "
            f"WHERE t.id = {int(ticket_id)}"
        )
        row = cur.fetchone()
        if not row:
            return None
        ticket = {
            'title': row[0], 'description': row[1],
            'creator_name': row[2], 'creator_position': row[3],
            'creator_department': row[4],
        }
        cur.execute(
            f"SELECT f.name, v.value, f.field_type "
            f"FROM {SCHEMA}.ticket_custom_field_values v "
            f"JOIN {SCHEMA}.ticket_custom_fields f ON f.id = v.field_id "
            f"WHERE v.ticket_id = {int(ticket_id)} AND v.value IS NOT NULL AND v.value <> '' "
            f"ORDER BY f.id"
        )
        custom_fields = [{'name': r[0], 'value': r[1], 'field_type': r[2]} for r in cur.fetchall()]

        # Точные данные из полей заявки (без участия ИИ): отдел/должность/фото
        direct = extract_direct_fields(cur, custom_fields)

        cur.execute(
            f"SELECT c.comment, u.full_name "
            f"FROM {SCHEMA}.ticket_comments c "
            f"LEFT JOIN {SCHEMA}.users u ON u.id = c.user_id "
            f"WHERE c.ticket_id = {int(ticket_id)} "
            f"ORDER BY c.created_at ASC LIMIT 100"
        )
        comments = [{'comment': r[0], 'author': r[1]} for r in cur.fetchall()]
        return {'ticket': ticket, 'custom_fields': custom_fields,
                'comments': comments, 'direct': direct}
    finally:
        conn.close()


def extract_direct_fields(cur, custom_fields):
    """Извлекает точные значения из полей заявки: department_id/position_id (company_structure)
    и URL фото (file). Возвращает dict, который подставляется в форму напрямую."""
    direct = {}
    for f in custom_fields:
        ftype = f.get('field_type')
        value = f.get('value') or ''
        if ftype == 'company_structure':
            try:
                data = json.loads(value)
            except Exception:
                continue
            dep_id = data.get('department_id')
            pos_id = data.get('position_id')
            if dep_id:
                direct['department_id'] = str(dep_id)
                try:
                    cur.execute(f"SELECT name FROM {SCHEMA}.departments WHERE id = {int(dep_id)}")
                    r = cur.fetchone()
                    if r:
                        direct['department_name'] = r[0]
                except Exception:
                    pass
            if pos_id:
                direct['position_id'] = str(pos_id)
                try:
                    cur.execute(f"SELECT name FROM {SCHEMA}.positions WHERE id = {int(pos_id)}")
                    r = cur.fetchone()
                    if r:
                        direct['position_name'] = r[0]
                except Exception:
                    pass
        elif ftype == 'file' and 'фото' in (f.get('name') or '').lower():
            if value.startswith('http'):
                direct['photo_url'] = value
    return direct


def build_ai_prompt(ctx):
    t = ctx['ticket']
    lines = [
        f"Тема заявки: {t.get('title') or ''}",
        f"Описание: {t.get('description') or '(нет)'}",
        "",
        "Данные заявителя (кто создал заявку):",
        f"  ФИО: {t.get('creator_name') or '(нет)'}",
        f"  Должность: {t.get('creator_position') or '(нет)'}",
        f"  Отдел: {t.get('creator_department') or '(нет)'}",
        "",
    ]
    direct = ctx.get('direct') or {}
    if ctx['custom_fields']:
        lines.append("Дополнительные поля заявки:")
        for f in ctx['custom_fields']:
            ftype = f.get('field_type')
            if ftype == 'company_structure':
                parts = []
                if direct.get('department_name'):
                    parts.append(f"отдел «{direct['department_name']}»")
                if direct.get('position_name'):
                    parts.append(f"должность «{direct['position_name']}»")
                lines.append(f"  - {f['name']}: {', '.join(parts) if parts else f['value']}")
            elif ftype == 'file':
                lines.append(f"  - {f['name']}: (прикреплён файл)")
            else:
                lines.append(f"  - {f['name']}: {f['value']}")
        lines.append("")
    if ctx['comments']:
        lines.append("Комментарии (в хронологическом порядке):")
        for c in ctx['comments']:
            text = (c.get('comment') or '').strip()
            if text:
                lines.append(f"  [{c.get('author') or 'Сотрудник'}]: {text}")
    return '\n'.join(lines)


def extract_ai_json(text):
    text = (text or '').strip()
    if text.startswith('```'):
        text = re.sub(r'^```[a-zA-Z]*\n?', '', text)
        text = re.sub(r'\n?```$', '', text).strip()
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r'\{.*\}', text, re.S)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                return None
    return None


def call_ai(prompt_text):
    payload = json.dumps({
        'model': AI_MODEL,
        'messages': [
            {'role': 'system', 'content': AI_SYSTEM_PROMPT},
            {'role': 'user', 'content': prompt_text},
        ],
        'temperature': 0.1,
        'max_tokens': 700,
    }).encode('utf-8')
    req = urllib.request.Request(
        ROUTERAI_URL, data=payload,
        headers={'Content-Type': 'application/json',
                 'Authorization': f'Bearer {ROUTERAI_API_KEY}'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=40) as r:
        data = json.loads(r.read().decode('utf-8'))
    return extract_ai_json(data['choices'][0]['message']['content'])


def normalize_ai_result(raw):
    if not isinstance(raw, dict):
        return {'needs_account': False, 'confidence': 0.0,
                'reason': 'Не удалось разобрать ответ ИИ', 'portal': '', 'fields': {}}
    fields_in = raw.get('fields') or {}
    fields = {}
    for k in AI_ALLOWED_FIELDS:
        v = fields_in.get(k)
        fields[k] = str(v).strip() if v is not None else ''
    if fields.get('gender') not in ('male', 'female'):
        fields['gender'] = ''
    # Отделы: множественный выбор. Поддерживаем и новый departments[], и старый department.
    departments = _normalize_str_list(fields_in.get('departments'))
    legacy_dep = fields_in.get('department')
    for d in _normalize_str_list(legacy_dep):
        if d.lower() not in {x.lower() for x in departments}:
            departments.append(d)
    fields['departments'] = departments
    fields['department'] = departments[0] if departments else ''
    fields['heads'] = _normalize_str_list(fields_in.get('heads'))
    try:
        conf = float(raw.get('confidence', 0))
    except Exception:
        conf = 0.0
    return {
        'needs_account': bool(raw.get('needs_account')),
        'confidence': max(0.0, min(1.0, conf)),
        'reason': str(raw.get('reason') or ''),
        'portal': raw.get('portal') if raw.get('portal') in ('ru', 'kz') else '',
        'fields': fields,
    }


def handle_analyze_ticket(payload, body):
    if not ROUTERAI_API_KEY:
        return response(500, {'error': 'Не задан ключ ROUTERAI_API_KEY'})
    ticket_id = body.get('ticket_id')
    if not ticket_id:
        return response(400, {'error': 'Не указан ticket_id'})
    try:
        ctx = load_ticket_context(ticket_id)
    except Exception as e:
        return response(500, {'error': f'Ошибка чтения заявки: {e}'})
    if not ctx:
        return response(404, {'error': 'Заявка не найдена'})
    try:
        raw = call_ai(build_ai_prompt(ctx))
    except urllib.error.HTTPError as e:
        detail = ''
        try:
            detail = e.read().decode('utf-8', 'replace')[:200]
        except Exception:
            pass
        return response(502, {'error': f'Ошибка ИИ (HTTP {e.code}): {detail}'})
    except urllib.error.URLError as e:
        return response(502, {'error': f'ИИ недоступен: {getattr(e, "reason", e)}'})
    except Exception as e:
        return response(502, {'error': f'Ошибка обращения к ИИ: {e}'})
    result = normalize_ai_result(raw)
    result['direct'] = ctx.get('direct') or {}
    return response(200, result)


def handler(event: dict, context) -> dict:
    '''Учётные записи сотрудников и настройки интеграций (Битрикс/почта РФ и КЗ).

    GET  ?action=settings          — прочитать настройки интеграций (только админ, секреты маскируются).
    POST {action:'save_settings'}  — сохранить настройки (только админ, шифрование в БД).
    POST {action:'test'}           — проверить интеграцию сервиса (bitrix_ru/bitrix_kz/mail_ru/mail_kz).
    POST {action:'list_domains'}   — список доменов почты портала (ru — ISPmanager, kz — LanCloud).
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

    if body.get('action') == 'list_domains':
        payload = verify_token(event)
        if not payload:
            return response(401, {'error': 'Требуется авторизация'})
        return handle_list_domains(payload, body)

    if body.get('action') == 'analyze_ticket':
        payload = verify_token(event)
        if not payload:
            return response(401, {'error': 'Требуется авторизация'})
        return handle_analyze_ticket(payload, body)

    return handle_create(body)