# Локальный запуск DreamDesk через Docker Compose

Compose запускает три сервиса:

- `frontend` — собранный React и Nginx;
- `backend` — HTTP-адаптер для 43 Python-функций;
- `db` — PostgreSQL 18 с постоянным томом.

Снаружи доступен только frontend: <http://127.0.0.1:4173>. Запросы
`/api/*` Nginx передаёт во внутренний backend, поэтому отдельная настройка
CORS для браузера не нужна.

## Подготовленные локальные файлы

- `.env` — локальные секреты и параметры подключения, не добавляется в Git;
- `docker/postgres/seed.dump` — снимок текущей исправленной БД, не добавляется
  в Git;
- `docker/postgres/source-row-counts.tsv` — контрольные количества строк,
  также не добавляется в Git.

Для переноса на другой компьютер эти файлы нужно передать отдельно защищённым
способом. Шаблон настроек находится в `.env.example`.

Снимок автоматически восстанавливается только при первом создании тома. Все
последующие запуски используют данные из именованного тома `dreamdesk-db`.
Миграции из `db_migrations` автоматически не запускаются: их последовательное
применение не воспроизводит фактическое исправленное состояние текущей БД.

## Запуск и проверка

```bash
docker compose up -d --build
docker compose ps
```

После перехода всех сервисов в состояние `healthy` открыть:

```text
http://127.0.0.1:4173
```

Для текущего снимка доступна учётная запись `admin`. При первом входе после
смены `JWT_SECRET` потребуется заново ввести пароль.

Проверить Nginx и backend:

```bash
curl --fail http://127.0.0.1:4173/healthz
docker compose exec backend python -c "import json,urllib.request; print(json.load(urllib.request.urlopen('http://127.0.0.1:8000/health')))"
```

## Управление

Посмотреть журналы:

```bash
docker compose logs -f
docker compose logs -f backend
docker compose logs -f db
```

Остановить сервисы, сохранив БД:

```bash
docker compose down
```

Запустить снова без пересборки:

```bash
docker compose up -d
```

Пересобрать после изменения кода:

```bash
docker compose up -d --build
```

## Резервная копия работающей БД

```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-privileges' > dreamdesk-backup.dump
sha256sum dreamdesk-backup.dump
```

Проверить содержимое копии:

```bash
docker compose exec -T db pg_restore --list < dreamdesk-backup.dump
```

## Восстановление исходного снимка

Инициализационный снимок не применяется поверх существующей БД. Чтобы начать
заново с `docker/postgres/seed.dump`, нужно удалить постоянный том:

```bash
docker compose down --volumes
docker compose up -d
```

**`docker compose down --volumes` необратимо удаляет все изменения БД, сделанные
после первого запуска. Перед этой командой обязательно создайте резервную
копию.**

## Ограничения локального окружения

- Планировщик фоновых заданий не запускается отдельным сервисом.
- Существующие ссылки на файлы в vendor CDN сохранены как данные БД.
- Для новой загрузки файлов нужны действующие `AWS_ACCESS_KEY_ID` и
  `AWS_SECRET_ACCESS_KEY`.
- Bitrix, AI и push-функции требуют соответствующих ключей в `.env`; без них
  login, заявки и справочники продолжают работать.
- Для расшифровки ранее сохранённых настроек интеграций нужен исходный
  `INTEGRATION_ENCRYPTION_KEY`.
- Если frontend обращается к endpoint, исходника которого нет в репозитории,
  backend возвращает `501` с явным описанием причины.
