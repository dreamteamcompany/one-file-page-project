# Перенос проекта DreamDesk на собственный сервер

> Для воспроизводимого локального запуска текущего состояния через три
> контейнера (`frontend`, `backend`, PostgreSQL) используйте [DOCKER.md](DOCKER.md).
> Эта инструкция ниже относится к ручному развёртыванию на сервере без Compose.

Инструкция под конкретно этот проект: 43 функции, 99 таблиц, 266 миграций,
5 задач по расписанию. Все команды даны целиком — можно копировать построчно.

Обозначения:
- `ВАШ_ДОМЕН` — например `help.company.ru`
- `ПАРОЛЬ_БД` — придуманный вами пароль базы, сохраните его
- Строки, начинающиеся с `#` — комментарии, вводить не нужно

---

## Что должно получиться

```
Браузер → Nginx (443, сертификат) ┬→ /            статичный сайт (React)
                                  └→ /api/<имя>   Python-приложение (43 функции)
                                                        ↓
                                                  PostgreSQL (99 таблиц)
Планировщик cron ─────────────────────────────────→ 5 задач по расписанию
```

---

## Шаг 0. Что подготовить заранее

1. **Сервер (VPS)**: 2 ядра, 4 ГБ RAM, 40 ГБ SSD, Ubuntu 24.04.
   Ориентир 800–1500 ₽/мес. Хостер любой российский.
2. **Домен** и доступ к его DNS-записям.
3. **Значения секретов** — см. Шаг 8. Часть смотрится в текущем проекте,
   часть перевыпускается в самих сервисах.
4. **SSH-доступ** к серверу: IP-адрес, пользователь `root`, пароль или ключ.

---

## Шаг 1. Первый вход на сервер

С вашего компьютера (Терминал на Mac, PowerShell на Windows):

```bash
ssh root@IP_СЕРВЕРА
```

Обновить систему и поставить базовый набор:

```bash
apt update && apt upgrade -y
apt install -y python3 python3-venv python3-pip postgresql nginx git curl ufw
```

Создать отдельного пользователя для приложения (не работать под root):

```bash
adduser --system --group --home /opt/dreamdesk dreamdesk
```

Включить файрвол — наружу открыты только веб и SSH:

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

---

## Шаг 2. Забрать код проекта

В интерфейсе poehali.dev: **Скачать → Подключить GitHub**, авторизоваться,
выбрать репозиторий. Затем на сервере:

```bash
cd /opt/dreamdesk
git clone https://github.com/ВАШ_АККАУНТ/ВАШ_РЕПОЗИТОРИЙ.git app
chown -R dreamdesk:dreamdesk /opt/dreamdesk
```

Проверка — должно быть 43 функции:

```bash
ls /opt/dreamdesk/app/backend/*/index.py | wc -l
```

---

## Шаг 3. Поднять базу данных

Создать базу, пользователя и схему. Схема называется так же, как сейчас,
чтобы не править код:

```bash
sudo -u postgres psql <<'SQL'
CREATE USER dreamdesk WITH PASSWORD 'ПАРОЛЬ_БД';
CREATE DATABASE dreamdesk OWNER dreamdesk;
\c dreamdesk
CREATE SCHEMA t_p67567221_one_file_page_projec AUTHORIZATION dreamdesk;
SQL
```

Строка подключения (понадобится в Шаге 8):

```
postgresql://dreamdesk:ПАРОЛЬ_БД@localhost:5432/dreamdesk
```

---

## Шаг 4. Создать таблицы (266 миграций)

Порядок важен: миграции нумерованные, применять строго по возрастанию.

```bash
cd /opt/dreamdesk/app/db_migrations
for f in $(ls V*.sql | sort -V); do
  echo "--- $f"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d dreamdesk -f "$f" || { echo "ОШИБКА на $f"; break; }
done
```

Проверка — должно быть 99 таблиц:

```bash
sudo -u postgres psql -d dreamdesk -c \
"SELECT count(*) FROM pg_tables WHERE schemaname='t_p67567221_one_file_page_projec';"
```

---

## Шаг 5. Перенести данные (338 МБ)

Данные не входят в код: 11 700 заявок, 389 пользователей, комментарии, история.

Выгрузка из текущей базы. Строку подключения взять в секрете `DATABASE_URL`
(раздел секретов проекта). Выполнять со своего компьютера:

```bash
pg_dump "СТРОКА_ПОДКЛЮЧЕНИЯ_ТЕКУЩЕЙ_БД" \
  --schema=t_p67567221_one_file_page_projec \
  --data-only --no-owner --no-privileges \
  -Fc -f dump.bin
```

Копирование на сервер и загрузка:

```bash
scp dump.bin root@IP_СЕРВЕРА:/tmp/
ssh root@IP_СЕРВЕРА
sudo -u postgres pg_restore -d dreamdesk --data-only --disable-triggers /tmp/dump.bin
```

Проверка — заявок должно быть примерно 11 700:

```bash
sudo -u postgres psql -d dreamdesk -c \
"SELECT count(*) FROM t_p67567221_one_file_page_projec.tickets;"
```

---

## Шаг 6. Настроить резервное копирование

Делать сразу, а не «потом». На платформе копии создавались автоматически,
здесь этого больше нет.

```bash
mkdir -p /var/backups/dreamdesk
cat > /usr/local/bin/dd-backup.sh <<'EOF'
#!/bin/bash
d=$(date +%F)
sudo -u postgres pg_dump -Fc dreamdesk > /var/backups/dreamdesk/db-$d.bin
find /var/backups/dreamdesk -name 'db-*.bin' -mtime +14 -delete
EOF
chmod +x /usr/local/bin/dd-backup.sh
```

Ежедневно в 3:30:

```bash
(crontab -l 2>/dev/null; echo "30 3 * * * /usr/local/bin/dd-backup.sh") | crontab -
```

Копии на том же сервере не спасают от его потери — настройте выгрузку
в другое место (S3, второй сервер).

---

## Шаг 7. Запустить 43 функции

Функции написаны в формате облака: в каждой есть `handler(event, context)`.
Оборачиваем их одним приложением, где каждая доступна по своему адресу.

Виртуальное окружение и зависимости:

```bash
cd /opt/dreamdesk/app
python3 -m venv /opt/dreamdesk/venv
/opt/dreamdesk/venv/bin/pip install --upgrade pip

# Списки зависимостей 43 функций собираются в один. Простое склеивание
# файлов здесь не подходит: у части из них нет переноса строки в конце
# (строки слипнутся), а один пакет встречается с разными версиями —
# pip на таком наборе откажется устанавливать. Берём по одной, самой
# строгой версии каждого пакета.
python3 - <<'PY' > /tmp/req.txt
import glob, re, collections
best = collections.OrderedDict()
for f in sorted(glob.glob('backend/*/requirements.txt')):
    for line in open(f):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        name = re.match(r'[A-Za-z0-9_.-]+', line).group(0).lower()
        # приоритет у точной версии (==), она строже остальных
        if name not in best or ('==' in line and '==' not in best[name]):
            best[name] = line
for v in best.values():
    print(v)
PY

cat /tmp/req.txt          # посмотреть, что получилось
/opt/dreamdesk/venv/bin/pip install -r /tmp/req.txt
/opt/dreamdesk/venv/bin/pip install fastapi uvicorn
```

Файл-обёртка `/opt/dreamdesk/app/server.py`:

```python
"""Запускает функции проекта как единое приложение.

Каждая папка в backend/ с файлом index.py становится адресом /api/<имя>.
Формат event и ответа повторяет облачный, поэтому код функций не меняется.
"""
import importlib.util
import json
import pathlib
import sys

from fastapi import FastAPI, Request
from fastapi.responses import Response

BACKEND = pathlib.Path(__file__).parent / 'backend'
app = FastAPI()
handlers = {}

for d in sorted(BACKEND.iterdir()):
    entry = d / 'index.py'
    if not entry.is_dir() and entry.exists():
        sys.path.insert(0, str(d))          # чтобы работали соседние модули
        spec = importlib.util.spec_from_file_location(f'fn_{d.name}', entry)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        handlers[d.name] = mod.handler


class Ctx:
    request_id = 'local'


@app.api_route('/api/{name}{rest:path}',
               methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
async def call(name: str, rest: str, request: Request):
    fn = handlers.get(name)
    if fn is None:
        return Response(status_code=404, content='unknown function')

    body = (await request.body()).decode('utf-8', 'replace')
    event = {
        'httpMethod': request.method,
        'headers': dict(request.headers),
        'queryStringParameters': dict(request.query_params),
        'body': body,
        'pathParams': {'path': rest},
        'isBase64Encoded': False,
        'requestContext': {
            'identity': {'sourceIp': request.client.host if request.client else ''}
        },
    }

    result = fn(event, Ctx())
    payload = result.get('body', '')
    if not isinstance(payload, str):
        payload = json.dumps(payload, ensure_ascii=False)

    return Response(
        status_code=result.get('statusCode', 200),
        content=payload,
        headers=result.get('headers', {}),
    )
```

Служба, чтобы приложение поднималось при перезагрузке —
`/etc/systemd/system/dreamdesk.service`:

```ini
[Unit]
Description=DreamDesk backend
After=network.target postgresql.service

[Service]
User=dreamdesk
WorkingDirectory=/opt/dreamdesk/app
EnvironmentFile=/opt/dreamdesk/env
ExecStart=/opt/dreamdesk/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## Шаг 8. Прописать секреты

Файл `/opt/dreamdesk/env`. Значения — без кавычек, по одному в строке.

```bash
DATABASE_URL=postgresql://dreamdesk:ПАРОЛЬ_БД@localhost:5432/dreamdesk
MAIN_DB_SCHEMA=t_p67567221_one_file_page_projec
JWT_SECRET=
BITRIX24_PORTAL_URL=https://bitrix.dreamteamcompany.ru
BITRIX24_CLIENT_ID=
BITRIX24_CLIENT_SECRET=
BITRIX24_WEBHOOK_URL=
BITRIX_BOT_ID=
BITRIX_BOT_CLIENT_ID=
BITRIX_BOT_CLIENT_SECRET=
BITRIX_BOT_REFRESH_TOKEN=
MAX_BOT_TOKEN=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
GIGACHAT_AUTH_KEY=
ROUTERAI_API_KEY=
INTEGRATION_ENCRYPTION_KEY=
ISPMGR_URL=
ISPMGR_LOGIN=
ISPMGR_PASSWORD=
VSDESK_LOGIN=
VSDESK_PASSWORD=
CORP_MAIL_DOMAIN=
```

Закрыть файл от посторонних:

```bash
chown dreamdesk:dreamdesk /opt/dreamdesk/env
chmod 600 /opt/dreamdesk/env
```

**Два предупреждения.**

`JWT_SECRET` — перенести ровно то же значение, что сейчас. Если поменять,
все пользователи разом окажутся разлогинены.

`INTEGRATION_ENCRYPTION_KEY` — им зашифрованы пароли интеграций **внутри базы**.
При другом значении эти записи не расшифруются и интеграции откажут.

---

## Шаг 9. Настроить веб-сервер и сертификат

Файл `/etc/nginx/sites-available/dreamdesk`:

```nginx
server {
    listen 80;
    server_name ВАШ_ДОМЕН;

    root /opt/dreamdesk/app/dist;
    index index.html;

    client_max_body_size 25m;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;
    }

    location / {
        try_files $uri $uri/ /index.html;   # обязательно для React-роутинга
    }
}
```

Включить и проверить:

```bash
ln -s /etc/nginx/sites-available/dreamdesk /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Сертификат HTTPS (бесплатный, продлевается сам):

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d ВАШ_ДОМЕН
```

Перед этим A-запись домена должна указывать на IP сервера.

---

## Шаг 10. Переключить адреса функций

Фронтенд берёт адреса из одного файла `backend/func2url.json` (43 записи).
Заменяем облачные адреса на свои:

```bash
cd /opt/dreamdesk/app
cp backend/func2url.json backend/func2url.json.bak
python3 - <<'PY'
import json, pathlib
p = pathlib.Path('backend/func2url.json')
d = json.loads(p.read_text())
d = {k: f'https://ВАШ_ДОМЕН/api/{k}' for k in d}
p.write_text(json.dumps(d, ensure_ascii=False, indent=2))
print('переписано адресов:', len(d))
PY
```

Проверить, что внутри нет чужих адресов:

```bash
grep -c 'functions.poehali.dev' backend/func2url.json || echo "чисто"
```

Отдельно: три функции (`automation-dispatcher`, `automation`, `api-ai-training`)
содержат адреса других функций **прямо в коде**. Их правят вручную:

```bash
grep -rn 'functions.poehali.dev' backend/*/index.py
```

---

## Шаг 11. Собрать сайт

Node.js и сборка:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
cd /opt/dreamdesk/app
npm ci
npm run build          # результат появится в папке dist
```

Запустить бэкенд:

```bash
systemctl daemon-reload
systemctl enable --now dreamdesk
systemctl status dreamdesk --no-pager
```

---

## Шаг 12. Расписание — 5 задач

**Шаг, который чаще всего забывают.** Если пропустить, автоматизация тихо
перестанет работать: ошибок в логах не будет, заметите через недели.

```bash
crontab -e
```

Добавить:

```cron
# Диспетчер автоматизации — каждую минуту
* * * * * curl -s -X POST https://ВАШ_ДОМЕН/api/automation-dispatcher >/dev/null

# Переназначение по графику — каждые 5 минут
*/5 * * * * curl -s -X POST https://ВАШ_ДОМЕН/api/reassign-by-schedule >/dev/null

# Просроченные заявки — раз в час
0 * * * * curl -s -X POST https://ВАШ_ДОМЕН/api/tickets-overdue-checker >/dev/null

# Автозакрытие заявок — ежедневно в 2:00
0 2 * * * curl -s -X POST https://ВАШ_ДОМЕН/api/ticket-auto-close >/dev/null

# Запланированные платежи — ежедневно в 6:00
0 6 * * * curl -s -X POST https://ВАШ_ДОМЕН/api/process-scheduled-payments >/dev/null
```

---

## Шаг 13. Проверка

По порядку, каждый пункт вручную:

1. Сайт открывается по https, замок в адресной строке.
2. Вход по логину и паролю.
3. Список заявок загружается, работает поиск.
4. Создание заявки.
5. Уведомление пришло в Битрикс.
6. Комментарий к заявке.
7. Загрузка файла и База знаний.
8. Дашборды и аналитика SLA.
9. Вход через Битрикс24.
10. **Через сутки** — проверить, что задачи по расписанию отработали.

Если что-то не работает:

```bash
journalctl -u dreamdesk -n 100 --no-pager     # логи бэкенда
tail -50 /var/log/nginx/error.log             # логи веб-сервера
```

---

## Что изменится после переезда

**Ограничение 8 секунд исчезает.** Это особенность облачных функций; обычный
сервер держит запрос столько, сколько нужно. Бюджет уведомлений (4 секунды)
можно оставить — он не мешает, но необходимость в нём отпадает.

**Файлы.** Загрузка и База знаний работают через хранилище платформы. Если
ключи `AWS_*` оставить прежними, всё продолжит работать оттуда. Полная
независимость потребует своего S3-хранилища и переноса файлов.

**Ваша зона ответственности:** резервные копии, обновления безопасности,
продление сертификата, мониторинг доступности.
