# Техническая карта Helpdesk

Состояние репозитория: коммит <code>e066f9fe2f63f226d82ca9adcc4c95049ad012cd</code>.  
Связанные схемы: [diagrams.md](./diagrams.md).

## Как читать карту

- <code>[CONFIRMED]</code> — утверждение непосредственно подтверждено кодом или сводкой в <code>audit/notes</code>.
- <code>[INFERRED]</code> — вывод следует из нескольких подтверждённых фактов, но не задан системой явно.
- <code>[UNKNOWN]</code> — в репозитории недостаточно данных; требуется проверка рабочей среды.
- Ссылки вида <code>path:line</code> указывают на исходное доказательство. Номера строк относятся к указанному коммиту.

Исследованы frontend, backend, конфигурация, миграции и только сводки <code>audit/notes/</code>. Сырые результаты из <code>audit/quality/</code> и <code>audit/security/</code> не читались. Исходный код не изменялся. Доступа к рабочей DB, панели функций, хранилищу, журналам и фактическим расписаниям нет.

---

# L1 — проект за 5 минут

## Что это за система

<code>[CONFIRMED]</code> Это клиентское React/Vite SPA и набор из 43 независимо развёртываемых Python serverless-функций. Браузер обращается прямо к URL функций платформы; функции исполняют встроенный SQL в PostgreSQL и синхронно вызывают внешние API. Собственного HTTP-сервера, единого backend-приложения, ORM и общего слоя репозиториев нет (точка запуска SPA: <code>index.html:53-54</code>, <code>src/main.tsx:21-23</code>; реестр функций: <code>backend/func2url.json:2-44</code>; ABI: например <code>backend/api-tickets/index.py:1570</code>).

Краткая фактическая схема:

    Браузер
      → Vite/React SPA
      → apiFetch, прямой fetch или func2url.json
      → шлюз функций текущей платформы
      → handler(event, context)
      → встроенная бизнес-логика + прямой SQL
      → PostgreSQL
      ↘ Bitrix24 / MAX / RouterAI / GigaChat / ISPmanager / LanCloud
      ↘ S3/CDN текущей платформы / Web Push

Полная схема: [A. Общая архитектура](./diagrams.md#a-общая-архитектура).

## Числа, которые определяют устройство

| Наблюдение | Значение | Доказательство |
|---|---:|---|
| Файлы TypeScript/TSX в <code>src</code> | 487 | <code>[CONFIRMED]</code> подсчёт дерева репозитория |
| Компоненты TypeScript/TSX | 338 | <code>[CONFIRMED]</code> подсчёт <code>src/components</code> |
| Хуки | 37 | <code>[CONFIRMED]</code> подсчёт <code>src/hooks</code> |
| Объявления frontend-маршрутов | 40: 39 конкретных и <code>*</code> | <code>src/App.tsx:74-113</code> |
| Физические точки входа serverless-функций | 43 | <code>backend/func2url.json:2-44</code> |
| Python-файлы backend | 100 | <code>[CONFIRMED]</code> подсчёт дерева |
| Версионные SQL-миграции | 265 | <code>db_migrations/V0001__create_payments_table.sql:1</code> — <code>db_migrations/V0265__notifications_rule_id.sql:1</code> |
| Декларативные <code>tests.json</code> | 44 файла | <code>[CONFIRMED]</code> подсчёт дерева; прохождение не утверждается |

## Центральные узлы

1. <code>backend/api-tickets/index.py</code> — физически одна функция, логически 28 API-разделов: тикеты, SLA, согласования, наблюдатели, четыре панели показателей, начальная загрузка, полная карточка и настройки статусов (<code>backend/api-tickets/index.py:1606-1664</code>).
2. <code>src/utils/api.ts</code> — адреса функций, логическая маршрутизация, JWT-заголовок, кеш и повторные попытки; часть frontend обходит этот модуль (<code>src/utils/api.ts:1-86</code>, <code>src/utils/api.ts:134-175</code>, <code>src/utils/api.ts:184-263</code>).
3. PostgreSQL — общий интеграционный слой между физически отдельными функциями; почти каждая функция имеет собственный код подключения и прямой SQL (<code>backend/shared_utils.py:42-52</code>).
4. <code>create-employee-account</code> — учётные записи, интеграционные настройки, Bitrix, почта, ISPmanager, LanCloud и RouterAI в одном модуле (<code>backend/create-employee-account/index.py:1537</code>).
5. <code>automation-dispatcher</code> — DB-расписание плюс HTTP-вызов других функций по жёстко заданным URL (<code>backend/automation-dispatcher/index.py:13-15</code>, <code>backend/automation-dispatcher/index.py:143-193</code>).
6. Frontend — насыщенный клиент и частичный слой сборки API. Он координирует составные операции, а часть правил создания, массовых действий, закрытой заявки и видимости не закреплена на backend; подробная матрица — в [разделе 4.6](#46-фактическая-граница-ответственности-frontend-и-backend).

<code>[INFERRED]</code> Система распределена по развёртыванию, но частично монолитна по данным и бизнес-логике: функции изолированы процессами, однако связаны одной схемой PostgreSQL, общим JWT-контрактом и прямыми знаниями о таблицах.

---

# L2 — архитектура за 30 минут

## 1. Значимое дерево проекта

    .
    ├── index.html                 вход HTML, скрипты платформы, Метрика, корень SPA
    ├── package.json               зависимости frontend и команды сборки
    ├── vite.config.ts             настройка Vite/dev; псевдоним @ → src
    ├── src/
    │   ├── main.tsx               запуск React и общий обработчик Enter
    │   ├── App.tsx                провайдеры и 40 объявлений Route
    │   ├── contexts/
    │   │   └── AuthContext.tsx    пользователь, токен, активная роль, проверки прав
    │   ├── utils/
    │   │   ├── api.ts             маршрутизация API, токен, кеш и повторы
    │   │   └── bootstrapCache.ts  пятиминутный кеш справочников тикета
    │   ├── hooks/                 данные и действия страниц; преобладают тикеты
    │   ├── pages/                 страницы маршрутов и 17 старых страниц без маршрута
    │   ├── components/
    │   │   ├── tickets/           форма, карточка, комментарии, рабочая область
    │   │   ├── dashboard2/        четыре активные панели показателей
    │   │   ├── kb/                компоненты интерфейса базы знаний
    │   │   ├── layout/            общий каркас, шапка и боковая панель
    │   │   ├── notifications/     колокольчик и запрос разрешения Web Push
    │   │   └── ui/                локальная библиотека компонентов Radix/Tailwind
    │   ├── services/
    │   │   └── bulkTicketsService.ts
    │   └── types/                 общие структуры данных frontend
    ├── public/
    │   ├── manifest.json          метаданные PWA и значки из CDN платформы
    │   └── sw.js                  кеш, push и события нажатия на уведомление
    ├── backend/
    │   ├── func2url.json          имена → 43 URL функций платформы
    │   ├── shared_utils.py        пример копии общих средств JWT/DB/HTTP
    │   ├── auth/                  вход по паролю, me, обновление, уведомления
    │   ├── api-general/           пользователи, роли, права и справочники
    │   ├── api-tickets/           ядро тикетов, SLA, панели, назначение
    │   ├── api-ticket-comments/   комментарии, прочтение, файлы, доставка ботами
    │   ├── api-knowledge-base/    база знаний и клиент S3
    │   ├── api-ai-training/       правила, примеры и проверки AI
    │   ├── api-classify-ticket/   RouterAI/GigaChat и запасной классификатор
    │   ├── automation*/           административный API и диспетчер расписания
    │   ├── bitrix-*/              OAuth, синхронизация, уведомления, неактивные
    │   └── ...                    меньшие каталоги CRUD, заданий и функций
    ├── db_migrations/
    │   ├── V0001...V0265         схема, данные и эксплуатационные миграции
    │   └── down/                  одна явная миграция отката
    └── audit/
        ├── notes/                 разрешённые сводки инструментов проверки
        └── architecture/          эта карта и диаграммы

<code>[CONFIRMED]</code> <code>package.json</code> содержит только <code>dev</code>, <code>build</code>, <code>build:dev</code>, <code>lint</code> и <code>preview</code> (<code>package.json:6-12</code>). Dockerfile, Compose, IaC, CI/CD и средство применения миграций не найдены. <code>[UNKNOWN]</code> Как на платформе устроены размещение SPA, обработка прямых ссылок, развёртывание функций и применение миграций в рабочей среде.

## 2. Фактические границы компонентов

| Граница | Что реально находится внутри | Как пересекается |
|---|---|---|
| Браузер / frontend | React-страницы, хуки, локальное состояние, JWT в хранилище браузера | Прямые HTTPS-вызовы URL функций |
| API-слой frontend | Частично <code>apiFetch</code>, частично прямой <code>fetch</code>, частично импорт <code>func2url.json</code> | <code>X-Auth-Token</code>, JSON, параметры <code>endpoint/action</code> |
| Платформа функций | Маршрутизация по URL и запуск <code>handler(event, context)</code> | Событие с <code>httpMethod</code>, заголовками, параметрами и телом |
| Backend-функция | Маршрутизация, авторизация, SQL, бизнес-правила и интеграции часто в одном файле | Прямой PostgreSQL и синхронный HTTP |
| PostgreSQL | Общая модель пользователей, тикетов, SLA, уведомлений, автоматизации, KB | Прямой SQL; схема и <code>search_path</code> являются частью контракта |
| Внешние системы | Bitrix, MAX, AI, почтовые панели, S3/CDN, Web Push | Встроенные клиенты и жёстко заданные URL |

<code>[CONFIRMED]</code> Локальная среда исполнения HTTP отсутствует: все 43 каталога используют ABI <code>handler(event, context)</code>. <code>[CONFIRMED]</code> В <code>api-tickets</code> есть отдельные вспомогательные модули, но главный обработчик по-прежнему содержит чтение, создание, обновление, удаление, права, транзакции и побочные эффекты (<code>backend/api-tickets/index.py:1805</code>, <code>audit/notes/lizard-summary.txt:12-20</code>).

## 3. Реальные точки входа

### 3.1 Запуск браузерного приложения и события

| Точка входа | Файл / функция | Тип | Следующие вызовы |
|---|---|---|---|
| HTML-документ | <code>index.html:53-54</code> | загрузка SPA | <code>src/main.tsx</code> |
| Корень React | <code>src/main.tsx:21-23</code> | запуск frontend | <code>App</code> |
| Общий <code>keydown</code> | <code>src/main.tsx:5-19</code> | событие DOM | предотвращает неявную отправку по Enter |
| Маршрутизатор | <code>src/App.tsx:71-116</code> | маршрутизация frontend | лениво загружаемые страницы / <code>ProtectedRoute</code> |
| Установка SW | <code>public/sw.js:7-12</code> | событие сервис-воркера | кеширует <code>/</code> и <code>/index.html</code> |
| Получение через SW | <code>public/sw.js:14-34</code> | событие сервис-воркера | сначала кеш, затем сеть |
| Активация SW | <code>public/sw.js:36-49</code> | событие сервис-воркера | удаляет старые кеши |
| Push в SW | <code>public/sw.js:51-66</code> | событие push | показывает уведомление |
| Нажатие на уведомление | <code>public/sw.js:68-72</code> | событие нажатия | открывает URL из данных события |

<code>[UNKNOWN]</code> В репозитории нет <code>navigator.serviceWorker.register</code>; регистрация может выполняться внешним скриптом платформы либо push-путь не завершён.

### 3.2 Все frontend-маршруты

Все 40 объявлений находятся в <code>src/App.tsx:74-113</code>. «Вход» означает проверку пользователя через активный <code>src/components/ProtectedRoute.tsx:10-51</code>; это не доказательство backend-разрешения.

| Маршрут | Страница / назначение | Маршрутная защита |
|---|---|---|
| <code>/login</code> | <code>Login</code> | публичный |
| <code>/auth/bitrix/callback</code> | <code>BitrixCallback</code> | публичный обратный вызов OAuth |
| <code>/</code> | <code>Dashboard2</code> | <code>dashboard.read</code> |
| <code>/users</code> | пользователи | <code>users.read</code> |
| <code>/roles</code> | роли | <code>roles.read</code> |
| <code>/custom-fields</code> | пользовательские поля | <code>custom_fields.read</code> |
| <code>/log-analyzer</code> | анализатор логов | вход |
| <code>/settings</code> | каталог настроек | вход |
| <code>/settings/automation</code> | задания и запуски | вход; backend дополнительно требует admin |
| <code>/settings/integrations</code> | Bitrix/почтовые настройки | вход |
| <code>/settings/notifications</code> | шаблоны уведомлений | вход |
| <code>/settings/response-control</code> | контроль ответа | <code>response_control.read</code> |
| <code>/knowledge-base</code> | база знаний | вход |
| <code>/tickets</code> | список/рабочая область заявок | вход; страница проверяет права на тикеты |
| <code>/tickets/:id</code> | полная карточка | вход; страница проверяет права на тикеты |
| <code>/ticket-services</code> | виды услуг | вход |
| <code>/ticket-services-management</code> | управление услугами | вход |
| <code>/ticket-service-categories</code> | категории услуг | вход |
| <code>/access-checklist-services</code> | услуги с чек-листом | вход |
| <code>/ticket-statuses</code> | статусы | вход |
| <code>/ticket-priorities</code> | приоритеты | вход |
| <code>/ticket-watcher-rules</code> | правила наблюдателей | <code>ticket_priorities.read</code>; вероятное несоответствие |
| <code>/sla</code> | правила SLA | вход |
| <code>/sla-service-mappings</code> | связи SLA и услуг | вход |
| <code>/service-providers</code> | поставщики услуг | вход |
| <code>/field-registry</code> | реестр полей | вход |
| <code>/services</code> | сервисы | вход |
| <code>/custom-field-groups</code> | группы полей | вход |
| <code>/service-field-mappings</code> | связи полей с услугами | вход |
| <code>/companies</code> | компании | вход |
| <code>/departments</code> | подразделения | вход |
| <code>/positions</code> | должности | вход |
| <code>/executor-groups</code> | группы исполнителей | <code>executor_groups.read</code> |
| <code>/executor-assignments</code> | правила назначения | <code>executor_groups.read</code> |
| <code>/work-schedules</code> | графики | <code>executor_groups.read</code> |
| <code>/ai-training</code> | обучение классификатора | вход |
| <code>/bitrix-inactive-users</code> | неактивные сотрудники | вход |
| <code>/org-chart</code> | оргструктура | вход |
| <code>/reply-templates</code> | шаблоны ответов | вход |
| <code>*</code> | <code>NotFound</code> | публичный запасной маршрут |

<code>[CONFIRMED]</code> 17 верхнеуровневых страниц не подключены к маршрутизатору: <code>ApprovalsHistory</code>, <code>ApprovedPayments</code>, <code>AuditLogs</code>, <code>Categories</code>, <code>CategoryPayments</code>, <code>Contractors</code>, <code>CustomerDepartments</code>, <code>Index</code>, <code>LegalEntities</code>, <code>Payments</code>, <code>PendingApprovals</code>, <code>PlannedPayments</code>, <code>RejectedPayments</code>, <code>SavingReasons</code>, <code>Savings</code>, <code>SlaAnalytics</code>, <code>TicketTemplates</code>. Ссылка на <code>/sla-analytics</code> есть в настройках, но маршрута нет (<code>src/pages/Settings.tsx:153-156</code>, <code>src/App.tsx:74-113</code>).

### 3.3 Все 43 физические backend-точки входа

«Нет прикладной проверки» означает отсутствие проверки в Python-коде. <code>[UNKNOWN]</code> Может ли шлюз текущей платформы ограничивать вызов снаружи.

| Точка входа | Файл / функция | Вход и маршрутизация | Следующие вызовы / внешние зависимости | Прикладная защита |
|---|---|---|---|---|
| <code>auth</code> | <code>backend/auth/index.py:19</code>, <code>handler</code> | вход, <code>me</code>, обновление, данные панелей/уведомлений/услуг | сервисы auth/data → PostgreSQL → JWT | вход публичный; остальное JWT |
| <code>api-general</code> | <code>backend/api-general/index.py:17</code>, <code>handler</code> | 10 ресурсов справочников и доступа | обработчики ресурсов → PostgreSQL | JWT; RBAC неравномерен |
| <code>users-search</code> | <code>backend/users-search/index.py:9</code>, <code>handler</code> | GET-поиск упоминаний | пользователи → PostgreSQL | JWT |
| <code>reset-password</code> | <code>backend/reset-password/index.py:12</code>, <code>handler</code> | любой не-OPTIONS вызов | меняет пароль администратора в PostgreSQL | нет |
| <code>companies</code> | <code>backend/companies/index.py:14</code>, <code>handler</code> | CRUD | PostgreSQL | нет |
| <code>departments</code> | <code>backend/departments/index.py:239</code>, <code>handler</code> | старый CRUD/PATCH и ветвь оргструктуры | PostgreSQL | смешанная |
| <code>positions</code> | <code>backend/positions/index.py:14</code>, <code>handler</code> | CRUD | PostgreSQL | нет |
| <code>department-positions</code> | <code>backend/department-positions/index.py:19</code>, <code>handler</code> | GET связей | PostgreSQL | нет |
| <code>bitrix-auth</code> | <code>backend/bitrix-auth/index.py:25</code>, <code>handler</code> | <code>get-auth-url</code>, обратный вызов | OAuth/профиль/подразделения Bitrix → пользователи/роли → JWT | публичный поток OAuth |
| <code>bitrix-sync-departments</code> | <code>backend/bitrix-sync-departments/index.py:563</code>, <code>handler</code> | POST синхронизации | webhook Bitrix → подразделения/должности/пользователи | нет |
| <code>bitrix-sync-positions</code> | <code>backend/bitrix-sync-positions/index.py:266</code>, <code>handler</code> | POST синхронизации | Bitrix → должности/пользователи | нет |
| <code>bitrix-sync-heads</code> | <code>backend/bitrix-sync-heads/index.py:270</code>, <code>handler</code> | POST синхронизации | Bitrix → руководители подразделений/пользователи | нет |
| <code>create-employee-account</code> | <code>backend/create-employee-account/index.py:1537</code>, <code>handler</code> | настройки, сохранение, проверка, домены, анализ, создание | PostgreSQL, RouterAI, Bitrix, ISPmanager, LanCloud | административные действия с JWT; основное создание без JWT |
| <code>bitrix-inactive-users</code> | <code>backend/bitrix-inactive-users/index.py:589</code>, <code>handler</code> | анализ, исключения, отчёты, деактивация | Bitrix, ISPmanager, PostgreSQL | JWT; admin не во всех мутациях |
| <code>api-tickets</code> | <code>backend/api-tickets/index.py:1570</code>, <code>handler</code> | 28 логических endpoint | модули тикетов/SLA/исполнителей/панелей, PostgreSQL, Bitrix/MAX | JWT внутри доменов; RBAC выборочный |
| <code>api-ticket-comments</code> | <code>backend/api-ticket-comments/index.py:178</code>, <code>handler</code> | CRUD, отметка прочтения, закрепление, inline-получение | PostgreSQL, Bitrix/MAX | JWT |
| <code>api-ticket-history</code> | <code>backend/api-ticket-history/index.py:27</code>, <code>handler</code> | GET по ticket_id | PostgreSQL | JWT |
| <code>api-bulk-tickets</code> | <code>backend/api-bulk-tickets/index.py:124</code>, <code>handler</code> | удаление, статус, приоритет, исполнитель, группа, наблюдатели | PostgreSQL, уведомитель Bitrix | JWT; нет проверки каждого ID |
| <code>api-services</code> | <code>backend/api-services/index.py:9</code>, <code>handler</code> | CRUD услуг | PostgreSQL | JWT |
| <code>api-field-groups</code> | <code>backend/api-field-groups/index.py:9</code>, <code>handler</code> | CRUD групп/полей | PostgreSQL | мутации без общей JWT-проверки |
| <code>api-service-field-mappings</code> | <code>backend/api-service-field-mappings/index.py:9</code>, <code>handler</code> | CRUD связей | PostgreSQL | нет |
| <code>api-executor-groups</code> | <code>backend/api-executor-groups/index.py:9</code>, <code>handler</code> | CRUD, участники, связи, справочник | PostgreSQL | JWT |
| <code>api-executor-assignments</code> | <code>backend/api-executor-assignments/index.py:12</code>, <code>handler</code> | справочник, назначения групп и пользователей | PostgreSQL | JWT |
| <code>api-work-schedules</code> | <code>backend/api-work-schedules/index.py:6</code>, <code>handler</code> | CRUD графиков | PostgreSQL | JWT |
| <code>api-watcher-rules</code> | <code>backend/api-watcher-rules/index.py:22</code>, <code>handler</code> | CRUD, применение, заполнение существующих данных | PostgreSQL, Bitrix/MAX | JWT |
| <code>api-reply-templates</code> | <code>backend/api-reply-templates/index.py:22</code>, <code>handler</code> | CRUD личных/общих шаблонов | PostgreSQL | JWT + владелец/admin |
| <code>tickets-counters</code> | <code>backend/tickets-counters/index.py:10</code>, <code>handler</code> | GET счётчиков непрочитанного | PostgreSQL | JWT |
| <code>tickets-mark-read</code> | <code>backend/tickets-mark-read/index.py:12</code>, <code>handler</code> | POST для тикета/всех | просмотры + уведомления | JWT |
| <code>tickets-overdue-checker</code> | <code>backend/tickets-overdue-checker/index.py:15</code>, <code>handler</code> | HTTP по расписанию/событию | просроченные тикеты → уведомления/правила статусов | нет |
| <code>ticket-auto-close</code> | <code>backend/ticket-auto-close/index.py:15</code>, <code>handler</code> | HTTP по расписанию/событию | тикеты/статусы/история | нет |
| <code>reassign-by-schedule</code> | <code>backend/reassign-by-schedule/index.py:30</code>, <code>handler</code> | HTTP по расписанию/событию | графики/нагрузка → тикеты/история | нет |
| <code>upload-file</code> | <code>backend/upload-file/index.py:69</code>, <code>handler</code> | POST: предзагрузка URL или base64 | S3/CDN платформы | нет |
| <code>api-knowledge-base</code> | <code>backend/api-knowledge-base/index.py:621</code>, <code>handler</code> | 12 endpoint базы знаний | PostgreSQL, S3/CDN платформы | JWT; запись по вспомогательной проверке роли |
| <code>api-ai-training</code> | <code>backend/api-ai-training/index.py:89</code>, <code>handler</code> | примеры, правила, статистика, журналы, проверки и переиндексация | PostgreSQL, GigaChat, URL классификатора | JWT |
| <code>api-classify-ticket</code> | <code>backend/api-classify-ticket/index.py:743</code>, <code>handler</code> | POST: описание, проверка или очередь | PostgreSQL, RouterAI, GigaChat, запасной классификатор по словам | нет |
| <code>api-improve-comment</code> | <code>backend/api-improve-comment/index.py:72</code>, <code>handler</code> | POST текста | GigaChat | нет |
| <code>automation</code> | <code>backend/automation/index.py:355</code>, <code>handler</code> | список, настройка, запуски, ручной запуск | таблицы автоматизации → URL функций | JWT + admin |
| <code>automation-dispatcher</code> | <code>backend/automation-dispatcher/index.py:196</code>, <code>handler</code> | HTTP cron/события | готовые к запуску задания → жёстко заданные URL | нет |
| <code>bitrix-notify</code> | <code>backend/bitrix-notify/index.py:21</code>, <code>handler</code> | comment_added | PostgreSQL → Bitrix webhook | нет |
| <code>push-notifications</code> | <code>backend/push-notifications/index.py:13</code>, <code>handler</code> | подписка/отправка push | старая схема DB → pywebpush | нет |
| <code>process-scheduled-payments</code> | <code>backend/process-scheduled-payments/index.py:150</code>, <code>handler</code> | HTTP по расписанию/событию | запланированные платежи в старой схеме | нет |
| <code>collect-logs</code> | <code>backend/collect-logs/index.py:11</code>, <code>handler</code> | сбор по HTTP/событию | таблицы журналов; демонстрационный генератор | нет |
| <code>log-analyzer</code> | <code>backend/log-analyzer/index.py:10</code>, <code>handler</code> | загрузка, список, записи, статистика | таблицы журналов PostgreSQL | нет |

### 3.4 Внутренняя маршрутизация крупных функций

| Функция | Логические endpoint/actions |
|---|---|
| <code>auth</code> | login, me, refresh, budget-breakdown, dashboard-stats, notifications, ticket-services, ticket-service-categories (<code>backend/auth/index.py:35-77</code>) |
| <code>api-general</code> | users, roles, permissions, user-permissions, categories, contractors, legal_entities, customer_departments, system_settings, notification_templates (<code>backend/api-general/index.py:40-62</code>) |
| <code>api-tickets</code> | tickets; service categories/dictionaries/services/mappings; statuses/priorities; SLA/rules/mappings/budgets/analytics; approvals/confirmation/watchers; full/bootstrap/stats; four dashboard; escalation; access checklist; response control; status-notify operators (<code>backend/api-tickets/index.py:1606-1664</code>) |
| <code>api-ticket-comments</code> | GET/POST/PUT/DELETE и actions mark-read, toggle-pin, get-inline (<code>backend/api-ticket-comments/index.py:193-221</code>) |
| <code>api-knowledge-base</code> | categories, tags, articles, article, search, comments, files, like, favorite, view, ticket-link, popular (<code>backend/api-knowledge-base/index.py:634-661</code>) |
| <code>api-ai-training</code> | examples, rules, stats, logs, pending_reviews, reindex, clear, bulk_enqueue, definitions, recheck (<code>backend/api-ai-training/index.py:98-126</code>) |
| <code>api-bulk-tickets</code> | delete, change_status, change_priority, change_executor, change_executor_group, add_watchers (<code>backend/api-bulk-tickets/index.py:145-161</code>, <code>backend/api-bulk-tickets/index.py:258</code>) |
| <code>automation</code> | jobs, runs, update schedule/params, manual trigger (<code>backend/automation/index.py:372-444</code>) |

## 4. Frontend-архитектура

### 4.1 Корневой граф и состояние

<code>[CONFIRMED]</code> Порядок провайдеров:

    ErrorBoundary
      → QueryClientProvider
      → AuthProvider
      → ImageLightboxProvider
      → Toaster + Sonner + PushNotificationPrompt
      → BrowserRouter
      → Suspense
      → Routes

Доказательство: <code>src/App.tsx:63-120</code>. Все страницы, кроме <code>Login</code>, загружаются через <code>lazy</code> (<code>src/App.tsx:12-52</code>).

| Вид состояния | Где хранится | Особенности |
|---|---|---|
| Пользователь/JWT/активная роль | <code>AuthContext</code> | JWT в localStorage или sessionStorage; active role в sessionStorage (<code>src/contexts/AuthContext.tsx:60-115</code>) |
| Справочники списка тикетов | local state + <code>bootstrapCache</code> | кеш на 5 минут, привязан к отпечатку токена (<code>src/utils/bootstrapCache.ts:7-56</code>) |
| Большинство страниц | <code>useState/useEffect</code> и domain hooks | собственного глобального domain store нет |
| TanStack Query | глобально подключён | используется точечно, а не как единый слой данных (<code>src/App.tsx:60-66</code>) |
| Выбор интерфейса/фильтров | localStorage и локальное состояние | URL обычно не воспроизводит состояние экрана |
| Уведомления | периодический опрос + события браузера | колокольчик, счётчики и отметка прочтения — разные endpoint |

<code>[CONFIRMED]</code> <code>ProtectedRoute</code> проверяет вход всегда, а конкретное право — только когда передан <code>requiredPermission</code> (<code>src/components/ProtectedRoute.tsx:10-51</code>). Второй <code>src/components/auth/ProtectedRoute.tsx:12-27</code> существует, но активный <code>App.tsx</code> импортирует другой файл (<code>src/App.tsx:8</code>).

<code>[CONFIRMED]</code> Правила frontend-доступа не полностью едины: активный guard считает администратором наличие любой роли с именем Admin/Администратор (<code>src/components/ProtectedRoute.tsx:31-48</code>), а <code>AuthContext.hasPermission</code> при нескольких ролях использует выбранную active role (<code>src/contexts/AuthContext.tsx:313-347</code>).

### 4.2 Домены frontend

| Домен | Основные страницы/компоненты | Данные и backend |
|---|---|---|
| Вход и сессия | <code>Login</code>, <code>BitrixCallback</code>, <code>AuthContext</code> | auth, bitrix-auth |
| Панели показателей | <code>Dashboard2</code>, хуки операций/SLA/услуг/команды | четыре логических endpoint внутри api-tickets |
| Список тикетов | <code>Tickets</code>, <code>useTicketsPage</code>, classic/workspace | tickets-bootstrap, tickets, dictionaries, users/groups |
| Карточка тикета | <code>TicketDetails</code>, <code>useTicketDetailsPage</code>, <code>useTicketData</code>, <code>useTicketActions</code> | tickets-full, tickets, comments, history, mark-read |
| Создание тикета | <code>useTicketFormLogic</code>, шаги формы | settings, classifier, field mappings, upload, tickets, comments |
| Комментарии/файлы | <code>TicketComments</code>, <code>useTicketCommentsLogic</code>, <code>useFileUploader</code> | comments, upload-file, history |
| Уведомления | <code>NotificationBell</code>, counters, Push prompt | auth notifications, counters, mark-read, Web Push |
| SLA/исполнители | страницы SLA, groups, assignments, schedules | api-tickets и отдельные CRUD-функции |
| База знаний | <code>KnowledgeBase</code> и вложенные KB-модули | api-knowledge-base, S3/CDN |
| Оргструктура/пользователи | Users/Roles/Companies/Departments/Positions/OrgChart | api-general и отдельные org-функции |
| Автоматизация/интеграции | Settings, AutomationSettings, IntegrationsSettings, BitrixInactiveUsers | automation, create-employee-account, Bitrix functions |
| Обучение AI | <code>AiTraining</code>, вкладки и диалоги | api-ai-training и классификатор |

### 4.3 Фактический API-слой

<code>[CONFIRMED]</code> Одновременно применяются четыре способа вызова:

1. <code>apiFetch</code> с логическим endpoint и <code>ENDPOINT_MAP</code>;
2. <code>apiFetch</code> на полный жёстко заданный URL;
3. прямой <code>fetch</code>;
4. импорт frontend-кодом <code>backend/func2url.json</code>.

<code>apiFetch</code> переписывает относительный путь или параметр запроса <code>endpoint</code> на URL функции, добавляет <code>X-Auth-Token</code> и повторяет только GET/HEAD при 500/502/503/504 (<code>src/utils/api.ts:184-263</code>). <code>cachedJsonFetch</code> хранит данные в памяти по ключу URL и объединяет параллельные запросы (<code>src/utils/api.ts:134-165</code>).

<code>[CONFIRMED]</code> Конфигурация frontend через переменные <code>import.meta.env</code> не используется; адреса встраиваются в сборку. Основные URL находятся в <code>src/utils/api.ts:1-74</code>, но прямые адреса остаются, например в <code>src/hooks/useTicketData.ts:199-200</code>, <code>src/hooks/useTicketData.ts:257-258</code> и <code>src/components/notifications/PushNotificationPrompt.tsx:43</code>.

<code>[INFERRED]</code> Повторы могут умножаться: <code>loadTickets</code> имеет собственный цикл до четырёх вызовов (<code>src/hooks/useTicketsData.ts:140-156</code>), а каждый GET через <code>apiFetch</code> имеет до двух попыток (<code>src/utils/api.ts:248-263</code>). При устойчивой ошибке одно действие UI способно породить до восьми сетевых запросов.

### 4.4 Ключевые frontend-цепочки

**Обычный вход**

    Login.handleSubmit
      → AuthContext.login
      → apiFetch(auth?endpoint=login)
      → токен + пользователь
      → localStorage/sessionStorage
      → /tickets

Доказательства: <code>src/pages/Login.tsx:23-35</code>, <code>src/contexts/AuthContext.tsx:274-310</code>.

**Восстановление сессии**

    App → AuthProvider.checkAuth
      → хранилище браузера
      → при отсутствии BroadcastChannel request-token
      → auth?endpoint=me
      → пользователь или выход
      → refresh каждые 6 часов

Доказательства: <code>src/contexts/AuthContext.tsx:157-235</code>, <code>src/contexts/AuthContext.tsx:254-272</code>.

**Список тикетов**

    /tickets → Tickets → useTicketsPage → useTicketsData
      → tickets-bootstrap
      → tickets + dictionaries + users + groups + counters
      → classic или workspace
      → при ошибке отдельные запасные запросы

Доказательства: <code>src/pages/Tickets.tsx:16-36</code>, <code>src/hooks/useTicketsData.ts:252-312</code>.

**Открытие тикета**

    /tickets/:id → useTicketDetailsPage → useTicketData.loadTicketFull
      → tickets-full
      → тикет + комментарии + история + согласования
      → statuses/users/groups
      → tickets-mark-read

Доказательства: <code>src/pages/ticket-details/useTicketDetailsPage.ts:21-84</code>, <code>src/hooks/useTicketData.ts:68-107</code>.

**Создание тикета**

    форма
      → system_settings.classification_mode
      → AI classifier или ручной выбор
      → связи и группы дополнительных полей
      → upload-file
      → POST tickets
      → фоновая классификация с <code>queue_only</code>
      → POST comments для прикрепления файлов
      → /tickets/:id

Доказательства: <code>src/components/tickets/useTicketFormLogic.ts:64-78</code>, <code>src/components/tickets/useTicketFormLogic.ts:116-167</code>, <code>src/hooks/useTicketForm.ts:42-150</code>.

**Изменение, назначение и комментарий**

Статус, исполнитель, группа, срок и содержание идут через <code>PUT tickets</code>; после успеха перечитываются тикет и история (<code>src/hooks/useTicketActions.ts:63-95</code>, <code>src/hooks/useTicketActions.ts:194-314</code>). Комментарий сначала загружает файлы, затем POST-ит URL вложений в comments и перечитывает комментарии (<code>src/hooks/useTicketActions.ts:21-60</code>, <code>src/hooks/useFileUploader.ts:47-99</code>).

### 4.5 Frontend-узлы высокой связанности

- <code>src/pages/tickets/useTicketsPage.ts:22-420</code> агрегирует данные, фильтры, права, форму, два интерфейса и массовые действия.
- <code>src/pages/ticket-details/useTicketDetailsPage.ts:9-325</code> агрегирует данные, действия, правила закрытой заявки, подтверждение и навигацию.
- <code>src/hooks/useTicketsData.ts:25-466</code> одновременно управляет начальной загрузкой, отдельными запросами, фильтрами, пагинацией, кешем и повторами.
- <code>src/hooks/useTicketData.ts:24-426</code> объединяет полную карточку с отдельными запасными путями комментариев/истории/пользователей/групп.
- <code>src/utils/api.ts:1-264</code> централен, но не является единственной границей сети.
- <code>PaymentsSidebar</code> остаётся в общем каркасе и запускает старый опрос платежей, хотя endpoint платежей заглушён (<code>src/utils/api.ts:104-132</code>).

### 4.6 Фактическая граница ответственности frontend и backend

<code>[CONFIRMED]</code> Frontend здесь — не только слой представления. Он также знает физические URL функций, собирает данные из нескольких API, управляет кешем, повторами и запасными путями, а также координирует часть составных бизнес-сценариев (<code>src/utils/api.ts:1-263</code>, <code>src/hooks/useTicketsData.ts:93-173</code>, <code>src/hooks/useTicketData.ts:68-405</code>, <code>src/hooks/useTicketForm.ts:42-150</code>).

<code>[CONFIRMED]</code> Ядро тикета не перенесено в браузер: backend проверяет обязательные поля, выбирает исполнителя, считает SLA, применяет часть правил статуса и чек-листа, пишет историю и создаёт уведомления (<code>backend/api-tickets/index.py:2330-2619</code>, <code>backend/api-tickets/index.py:2621-3256</code>, <code>backend/api-ticket-comments/index.py:506-711</code>). Проблема не в полном замещении backend, а в том, что некоторые обязательные правила остаются только в frontend или по-разному реализованы в обычном и массовом API.

| Граница | Фактическое поведение | Архитектурный вывод |
|---|---|---|
| Отображение и локальное состояние | Маршруты, формы, фильтры, состояния загрузки, отмена устаревших запросов и сообщения пользователю находятся в React-коде (<code>src/App.tsx:63-120</code>, <code>src/hooks/useTicketData.ts:68-107</code>) | Обычная и обоснованная ответственность frontend |
| Топология API и сборка данных | Frontend знает URL функций, объединяет ответы и поддерживает запасные цепочки; backend уже имеет объединённые <code>tickets-bootstrap</code> и <code>tickets-full</code> (<code>src/utils/api.ts:1-86</code>, <code>src/hooks/useTicketData.ts:348-405</code>, <code>backend/api-tickets/index.py:4483-4629</code>, <code>backend/api-tickets/index.py:4632-4803</code>) | Frontend фактически частично выполняет роль слоя сборки ответов API; это увеличивает связанность и стоимость переноса |
| Создание тикета | Браузер связывает классификацию, загрузку файлов, <code>POST tickets</code>, повторную классификацию и <code>POST comments</code>; сбой прикрепления файлов после создания тикета только показывает предупреждение (<code>src/hooks/useTicketForm.ts:69-150</code>, <code>src/hooks/useFileUploader.ts:47-115</code>) | Составное изменение и его частичные отказы координируются в недоверенном клиенте; backend должен владеть этим сценарием либо явными компенсациями |
| Права на создание и массовые действия | Frontend проверяет <code>tickets.create</code>, <code>tickets.update/remove</code> и административную роль; <code>POST tickets</code> и корневой обработчик <code>api-bulk-tickets</code> требуют только валидный JWT (<code>src/hooks/useTicketForm.ts:49-65</code>, <code>src/hooks/useBulkTicketOperations.ts:17-207</code>, <code>backend/api-tickets/index.py:1805-1810</code>, <code>backend/api-tickets/index.py:2330-2619</code>, <code>backend/api-bulk-tickets/index.py:124-578</code>) | Если эти права обязательны, они не закреплены backend и обходятся прямым HTTP-вызовом |
| Доступ к конкретному тикету | Список тикетов фильтруется backend по правам и участию, но <code>tickets-full</code> после пустого ответа тикета всё равно читает историю, согласования и комментарии; отдельный API комментариев также не проверяет участие в тикете (<code>backend/api-tickets/index.py:1868-1965</code>, <code>backend/api-tickets/index.py:4672-4803</code>, <code>backend/api-ticket-comments/index.py:357-503</code>) | Проверка маршрута и интерфейса не заменяет серверную проверку доступа к конкретному тикету |
| Закрытая заявка | Frontend блокирует изменение статуса, назначения, срока, содержания и комментариев; обычный <code>PUT tickets</code> и <code>POST comments</code> не имеют общего запрета по <code>is_closed</code> (<code>src/pages/ticket-details/useTicketDetailsPage.ts:100-185</code>, <code>backend/api-tickets/index.py:2621-2681</code>, <code>backend/api-ticket-comments/index.py:521-547</code>) | Инвариант жизненного цикла сейчас зависит от браузера |
| Видимость услуг и скрытые комментарии | Frontend фильтрует <code>visible_to_user_ids</code> и скрывает переключатель внутреннего комментария, но backend возвращает весь каталог и принимает <code>is_internal</code> из запроса (<code>src/components/tickets/useTicketFormLogic.ts:48-62</code>, <code>src/components/tickets/TicketDetailsContent.tsx:147-150</code>, <code>backend/api-tickets/index.py:3819-3868</code>, <code>backend/api-ticket-comments/index.py:169-175</code>, <code>backend/api-ticket-comments/index.py:506-547</code>) | Если это ограничение доступа, а не только удобство интерфейса, оно не закреплено на backend |
| Группа и исполнитель | При смене группы frontend явно добавляет <code>assigned_to = null</code>, но обычный backend при отдельном изменении <code>executor_group_id</code> только записывает новое значение (<code>src/hooks/useTicketActions.ts:222-253</code>, <code>backend/api-tickets/index.py:2930-2936</code>) | Согласованность группы и исполнителя зависит от конкретного клиента |
| Массовые изменения | <code>api-bulk-tickets</code> напрямую обновляет статус, приоритет, исполнителя или группу (<code>backend/api-bulk-tickets/index.py:258-358</code>, <code>backend/api-bulk-tickets/index.py:360-521</code>) | Он не использует ту же доменную реализацию, что обычный <code>PUT tickets</code>; правила SLA, назначения, уведомлений и проверок могут расходиться |

<code>[CONFIRMED]</code> Выбранная активная роль влияет на права в интерфейсе, но не передаётся в backend; backend читает роли пользователя из DB (<code>src/contexts/AuthContext.tsx:313-347</code>, <code>backend/api-tickets/index.py:1868-1895</code>). <code>[UNKNOWN]</code> Должна ли активная роль быть только режимом отображения или серверным ограничением полномочий.

<code>[CONFIRMED]</code> <code>upload-file</code> и <code>api-classify-ticket</code> не выполняют локальную проверку JWT (<code>backend/upload-file/index.py:69-92</code>, <code>backend/api-classify-ticket/index.py:743-764</code>). <code>[UNKNOWN]</code> Защищает ли их шлюз текущей платформы. Даже если защита шлюза есть, в репозитории не видно проверки права на конкретное действие.

<code>[INFERRED]</code> Frontend перегружен в двух разных смыслах: как браузерный слой сборки ответов API и как частично доверенная граница бизнес-правил. Целевая граница должна быть иной: frontend может повторять проверки для быстрой обратной связи, но backend должен оставаться единственным источником решений о доступе, переходах состояния, связях сущностей и составных изменениях. Это не требует полного переписывания: границу можно укреплять постепенно, начав с общей серверной проверки доступа к тикету и единой доменной реализации обычных и массовых операций.

## 5. Backend по фактическим доменам

| Домен | Точки входа | Бизнес-логика / данные | Потребители и зависимости |
|---|---|---|---|
| Идентификация и сессия | auth, bitrix-auth | пользователи, роли, права, bcrypt, JWT | весь frontend и почти все API |
| Пользователи/RBAC | api-general, users-search | пользователи, роли, матрица прав | настройки, упоминания, фильтры тикетов |
| Ядро тикетов | api-tickets, bulk | CRUD, видимость, жизненный цикл, поля, услуги | список, карточка, панели, задания |
| Комментарии/история | comments, history | ответы, внутренние комментарии, прочтение, файлы, события аудита | карточка, боты, уведомления |
| Исполнители/графики | группы/назначения/графики/reassign | прямое/групповое назначение, смены, балансировка нагрузки | создание/изменение тикета, автоматизация |
| SLA/контроль | подмодули api-tickets, overdue checker | связи, сроки, пауза/возобновление, бюджеты, нарушения | жизненный цикл тикета, панели |
| Уведомления | auth notifications, counters, mark-read, push, клиенты ботов | уведомления/просмотры/прочтение в DB + доставка | колокольчик, счётчики, Bitrix/MAX/Web Push |
| Справочники/оргструктура | general, companies/departments/positions, Bitrix sync | компании, подразделения, должности, пользователи | маршрутизация, поля, оргструктура, auth |
| База знаний | api-knowledge-base | статьи, категории, теги, комментарии, файлы, связи с тикетом | интерфейс KB, S3/CDN, пользователи/тикеты |
| AI | classifier, training, improve-comment | правила, примеры, проверки, журналы, RouterAI, embeddings | создание тикета, обучение, редактор |
| Автоматизация | automation, dispatcher, auto-close, overdue, reassign | расписания/запуски в DB и изменения по расписанию | административный UI, HTTP-вызовы функций |
| Учётные записи/интеграции | create employee, inactive users, Bitrix notify | Bitrix, почтовые панели, зашифрованные настройки | шапка тикета, настройки, действия admin |
| Старые финансы/журналы | scheduled payments, collect-logs, log-analyzer | платежи и журналы в старой схеме | в основном страницы без маршрута; LogAnalyzer активен |

### 5.1 Ядро тикетов как фактический модуль

<code>[CONFIRMED]</code> Вход <code>handler</code> открывает DB-соединение и передаёт запрос во внутренний <code>_route</code>; GET получает до трёх DB-попыток при ограничении частоты (<code>backend/api-tickets/index.py:1570-1604</code>). <code>handle_tickets</code> содержит GET/POST/PUT/DELETE (<code>backend/api-tickets/index.py:1805</code>).

Создание:

    POST tickets
      → JWT + проверка Pydantic
      → обязательные дополнительные поля
      → выбор прямого/группового исполнителя
      → сроки решения/ответа SLA
      → INSERT tickets
      → связи услуг + чек-лист + дополнительные поля + просмотры + уведомления
      → фиксация транзакции
      → журнал группы
      → Bitrix/MAX + правила наблюдателей
      → 201 + тикет

Доказательства: <code>backend/api-tickets/index.py:2330-2619</code>.

Обновление:

    PUT tickets
      → текущая строка
      → проверка прав для конкретного поля
      → правила статуса/чек-листа/SLA/назначения
      → тикет + связи + дополнительные поля + история + уведомления
      → фиксация транзакции
      → Bitrix/MAX + правила наблюдателей

Доказательства: <code>backend/api-tickets/index.py:2621-3256</code>. <code>[CONFIRMED]</code> Это не единая матрица правил: проверки встроены в отдельные ветви изменения содержания, статуса, исполнителя и срока (<code>backend/api-tickets/index.py:2649-2681</code>, <code>backend/api-tickets/index.py:2761-2776</code>).

### 5.2 Комментарии

    POST comment
      → JWT
      → поиск тикета
      → комментарий + строки вложений + история
      → при необходимости возобновление ожидания ответа/SLA
      → mentions → watchers
      → внутренние уведомления + просмотр тикета
      → фиксация транзакции
      → Bitrix/MAX без гарантии доставки
      → 201 + комментарий

Доказательства: <code>backend/api-ticket-comments/index.py:506-711</code>. Внутренний комментарий фильтрует получателей по роли (<code>backend/api-ticket-comments/index.py:638-662</code>).

### 5.3 Назначение и SLA

<code>[CONFIRMED]</code> Резолвер использует прямое назначение по услуге, затем группу, активного участника, рабочий график и текущую нагрузку (<code>backend/api-tickets/executor_assignment_resolver.py:16-200</code>). При создании тикета он вызывается до расчёта SLA (<code>backend/api-tickets/index.py:2379-2427</code>).

<code>[CONFIRMED]</code> SLA выбирается по связям услуг, задаёт <code>due_date</code>/<code>response_due_date</code>, меняется при переходах статусов и учитывает журнал группы/нарушения. Эти правила распределены между <code>sla_resolver.py</code>, <code>sla_handler.py</code>, <code>group_tracking_service.py</code> и главным <code>handle_tickets</code>.

### 5.4 Общий служебный код

<code>[CONFIRMED]</code> Общий на вид <code>shared_utils.py</code> не является одним пакетом: найдено 18 физических копий и 10 вариантов содержимого. Типовой вариант задаёт JWT, DB connection, CORS и query helpers (<code>backend/shared_utils.py:12-98</code>). jscpd подтверждает полные копии между <code>api-general</code>, <code>api-services</code>, <code>api-tickets</code> и корнем (<code>audit/notes/jscpd-summary.txt:87-102</code>).

<code>[INFERRED]</code> Статических циклов Python-импортов между каталогами функций не выявлено. Граф среды исполнения имеет обратные HTTP-рёбра: <code>automation-dispatcher → другие функции</code> и <code>api-ai-training → classifier</code>. Общая DB создаёт более сильную логическую связанность, чем импорты.

## 6. Аутентификация и авторизация

### 6.1 Парольный поток

<code>[CONFIRMED]</code> <code>auth?endpoint=login</code> не требует токена; остальные ветви auth требуют <code>X-Auth-Token</code> (<code>backend/auth/index.py:35-51</code>). Вход:

1. разбирает имя пользователя и пароль;
2. загружает пользователя, роли и права;
3. проверяет <code>PLAIN:</code> либо bcrypt;
4. при удачном старом входе заменяет открытое значение на bcrypt;
5. обновляет <code>last_login</code>;
6. выпускает HS256 JWT на 7 дней.

Доказательства: <code>backend/auth/auth_service.py:16-89</code>, <code>backend/auth/jwt_service.py:14-35</code>.

<code>[CONFIRMED]</code> Токен обновления или серверная сессия не хранится: обновление проверяет активного пользователя и выпускает новый JWT (<code>backend/auth/auth_service.py:125-141</code>). Централизованного отзыва токена нет.

### 6.2 Bitrix OAuth

    Браузер → get-auth-url → авторизация Bitrix
      → /auth/bitrix/callback
      → обмен code на oauth.bitrix.info
      → user.current + department.get
      → поиск/создание локального пользователя
      → own JWT

Доказательства: frontend <code>src/pages/Login.tsx:38-58</code>, <code>src/pages/BitrixCallback.tsx:20-40</code>; backend <code>backend/bitrix-auth/index.py:44-143</code>, <code>backend/bitrix-auth/index.py:146-215</code>.

<code>[CONFIRMED]</code> Новый пользователь допускается только как руководитель подразделения, а автоматически зарегистрированный пользователь может быть деактивирован после потери этого статуса (<code>backend/bitrix-auth/index.py:94-115</code>). <code>[CONFIRMED]</code> <code>redirect_uri</code> принимается из запроса; state/PKCE в этом OAuth-потоке не найден (<code>backend/bitrix-auth/index.py:44-64</code>).

### 6.3 Матрица проверок

| Уровень | Реальная проверка | Ограничение |
|---|---|---|
| Маршрут frontend | пользователь, иногда право | обходится прямым API-вызовом; не граница безопасности |
| Действие frontend | <code>hasPermission</code> перед частью действий | неодинаково для разных страниц |
| Общий backend JWT | локальные копии <code>verify_token</code> | копии расходятся; часть функций не вызывает |
| RBAC backend | SQL к ролям/правам внутри обработчика | выборочно по ресурсам/ветвям |
| DB | обычные SQL-права | RLS и права рабочей среды <code>[UNKNOWN]</code> |
| Шлюз платформы | возможная IAM/URL-защита | <code>[UNKNOWN]</code> |

Подтверждённые расхождения:

- <code>auth</code> и <code>bitrix-auth</code> имеют резервный секрет JWT, тогда как типовой <code>shared_utils</code> требует переменную окружения (<code>backend/auth/jwt_service.py:11</code>, <code>backend/bitrix-auth/index.py:11-13</code>, <code>backend/shared_utils.py:17-23</code>).
- <code>api-general</code> проверяет JWT глобально, но RBAC применён внутри отдельных handlers, не ко всем ресурсам (<code>backend/api-general/index.py:25-60</code>).
- <code>tickets-full</code>, comments и history требуют JWT, но доступ к конкретному ticket_id проверяется непоследовательно (<code>backend/api-tickets/index.py:4632-4781</code>, <code>backend/api-ticket-comments/index.py:357-503</code>, <code>backend/api-ticket-history/index.py:27-84</code>).
- Bulk API после JWT выполняет действие над переданными ID без проверки каждого тикета (<code>backend/api-bulk-tickets/index.py:124-161</code>).
- Загрузка, классификатор, улучшение комментария, push, задания по расписанию и несколько CRUD оргструктуры/интеграций не имеют прикладной JWT-проверки.

### 6.4 Очевидная критическая проблема

<code>[CONFIRMED]</code> <code>reset-password.handler</code> без JWT меняет пароль фиксированной административной записи на известное значение и возвращает этот пароль в HTTP-ответе (<code>backend/reset-password/index.py:12-65</code>). <code>[UNKNOWN]</code> Доступен ли URL публично и есть ли внешняя защита шлюза. Если доступен, это критическая проблема.

Также требуют немедленной проверки шлюза/IAM: основное создание в <code>create-employee-account</code> (<code>backend/create-employee-account/index.py:1537-1602</code>), загрузка файлов (<code>backend/upload-file/index.py:69-92</code>), Bitrix sync и обработчики cron.

## 7. Карта PostgreSQL

### 7.1 Подключение и схема

Основной контракт: <code>DATABASE_URL</code>, <code>MAIN_DB_SCHEMA</code>, <code>JWT_SECRET</code>. Типовая копия создаёт <code>RealDictCursor</code> и задаёт путь поиска <code>schema,public</code> (<code>backend/shared_utils.py:12-23</code>, <code>backend/shared_utils.py:42-52</code>).

Но контракт не един:

- auth имеет собственный сервис DB (<code>backend/auth/database_service.py:11-17</code>);
- reset-password ожидает <code>DSN</code> (<code>backend/reset-password/database_service.py:9-15</code>);
- <code>automation-dispatcher</code> выполняет неквалифицированные запросы и полагается на <code>search_path</code> DB (<code>backend/automation-dispatcher/index.py:76-86</code>);
- bulk имеет запасное значение схемы <code>t_p67567221_one_file_page_projec</code> (<code>backend/api-bulk-tickets/index.py:15</code>);
- push и платежи по расписанию жёстко используют старую <code>t_p61788166_html_to_frontend</code> (<code>backend/push-notifications/index.py:62-68</code>, <code>backend/process-scheduled-payments/index.py:12-13</code>).

<code>[UNKNOWN]</code> Реальный <code>search_path</code>, права DB, расширения и применённый номер миграции в рабочей среде.

### 7.2 Сущность → таблицы → модули кода

| Сущность | Основные таблицы | Основные модули |
|---|---|---|
| Пользователь/RBAC | users, roles, permissions, user_roles, role_permissions | auth, api-general, bitrix-auth, users-search |
| Оргструктура | companies, departments, positions, department_positions | CRUD оргструктуры, Bitrix sync, auth, фильтры тикетов |
| Тикет | tickets, ticket_statuses, ticket_priorities, ticket_categories | api-tickets, bulk, задания по расписанию |
| Услуга/поля | ticket_services, services, mappings, ticket_custom_fields, values, field groups | api-tickets, api-services, функции полей/связей |
| Комментарий/история | ticket_comments, comment_attachments, ticket_comment_reads, ticket_history | комментарии, история, tickets-full |
| Участие/согласование | ticket_watchers, watcher_rules, ticket_approvers, ticket_approvals, ticket_views | api-tickets, комментарии, счётчики, правила наблюдателей |
| Исполнитель | executor_groups, members, group/user service mappings, work_schedules | resolver, API групп/назначений/графиков, reassign |
| SLA | sla_rules, service mappings, priority times, group budgets, ticket_group_log, sla_violations | модули SLA в api-tickets, overdue, панели |
| Уведомление | notifications, notification_templates, status notify rules/users | тикеты/комментарии, колокольчик auth, счётчики, overdue |
| База знаний | kb_categories, articles, tags, files, comments, likes, favorites, views, ticket links | api-knowledge-base |
| AI | ai_training_examples/rules, classification_logs, pending_reviews, definitions | классификатор, обучение |
| Автоматизация | automation_jobs, automation_runs | automation, dispatcher |
| Интеграции | integration_settings, таблицы отчётов/исключений Bitrix | создание учётных записей, неактивные пользователи |
| Старые финансы/журналы | payments/planned payments, таблицы анализатора журналов | платежи по расписанию, функции журналов, страницы без маршрута |

Базовые определения: auth <code>db_migrations/V0059__create_auth_system.sql:1-61</code>; ядро тикетов <code>db_migrations/V0060__create_tickets_system.sql:1-80</code>; группы исполнителей <code>db_migrations/V0112__create_executor_groups_tables.sql:2-32</code>; KB <code>db_migrations/V0206__knowledge_base_foundation.sql:3-100</code>; автоматизация <code>db_migrations/V0222__create_automation_jobs_and_runs.sql:1-34</code>; настройки интеграций <code>db_migrations/V0252__create_integration_settings_table.sql:1-8</code>.

### 7.3 Транзакции

<code>[CONFIRMED]</code> Транзакции ручные и локальны конкретной функции. При создании тикета первая фиксация происходит до журнала групп и внешних уведомлений (<code>backend/api-tickets/index.py:2557-2615</code>). При создании комментария DB фиксируется до Bitrix/MAX (<code>backend/api-ticket-comments/index.py:667-708</code>).

<code>[INFERRED]</code> Общей транзакции DB + внешний API и журнала исходящих событий нет. Поэтому внешний сбой не отменяет бизнес-операцию, а повтор запроса может создать дублирующий внешний эффект. Это согласуется с обработкой ошибок без гарантии доставки через <code>try/except</code>, но фактическая частота сбоев <code>[UNKNOWN]</code>.

<code>[CONFIRMED]</code> В репозитории нет механизма применения/учёта миграций. 265 файлов включают DDL и эксплуатационные исправления данных; считать их автоматически воспроизводимой цепочкой без пробного прогона нельзя.

## 8. Потоки данных

| Объект | Фактический поток |
|---|---|
| Пользователь | пароль или профиль Bitrix → пользователи/роли/права → JWT → AuthContext → проверки frontend/API |
| JWT | auth/Bitrix → токен HS256 → хранилище браузера → <code>X-Auth-Token</code> → локальная <code>verify_token</code>; сессии в DB нет |
| Тикет | форма → необязательный выбор AI/услуги → проверка → исполнитель/SLA → тикет/связи/поля/чек-лист/просмотры/уведомления → боты → frontend |
| Комментарий | редактор/файлы → URL CDN → комментарии/файлы/история → восстановление SLA/статуса → упоминания/наблюдатели/уведомления → боты → UI |
| Исполнитель | прямая связь → групповая связь → активные участники → график → текущая нагрузка → assigned_to/executor_group_id → история/уведомления |
| Группа | связи группы/участника/услуги → группа тикета → ticket_group_log → бюджет/нарушения SLA группы → панель |
| SLA | связи услуг/приоритет → сроки → пауза/возобновление/переходы статуса → длительность/нарушения группы → аналитика |
| Уведомление | событие тикета/комментария/задания → notifications → колокольчик/счётчики/прочтение; параллельно Bitrix/MAX; Web Push отдельным путём |
| AI | текст тикета/каталог/обучение → ответ RouterAI; необязательный embedding GigaChat → проверенная классификация → журналы/ожидающая проверка → форма |
| Bitrix | OAuth/webhook → профиль/подразделения/пользователи → локальные пользователи/структура; локальное событие тикета/учётки → API/бот Bitrix |
| Файл | base64 из браузера или presigned PUT → S3 платформы → полный URL CDN → строка файла комментария/KB в DB → прямое получение браузером |

Диаграммы: [создание тикета](./diagrams.md#g3-создание-тикета-с-ai-и-файлами), [комментарий](./diagrams.md#g5-комментарий-и-уведомления), [домены данных](./diagrams.md#c-граф-зависимостей-backend).

## 9. Внешние интеграции

| Система | Назначение | Точки входа / клиент | Аутентификация | Данные | Критичность |
|---|---|---|---|---|---|
| PostgreSQL | основное состояние всех доменов | почти все обработчики Python | DSN/пользователь DB | пользователи, тикеты, настройки, KB, запуски | Критическая |
| Шлюз функций платформы | HTTP и запуск 43 обработчиков | все frontend и межфункциональные URL | <code>[UNKNOWN]</code> | все запросы/ответы API | Критическая |
| S3/CDN платформы | файлы комментариев, KB, статические значки | upload-file, KB, HTML/SW | ключи AWS/предварительная подпись | файлы и публичные URL | Высокая |
| Bitrix24 OAuth | вход пользователей | bitrix-auth | идентификатор/секрет клиента, auth code | профиль, руководитель подразделения | Критическая для входа через Bitrix |
| Bitrix webhook/REST | структура, сотрудники, блокировка, учётные записи | sync/inactive/create account | webhook/token доступа | персональные данные, подразделения, учётки | Высокая |
| Bitrix Bot | уведомления о тикетах | копии модулей-уведомителей | обновление OAuth бота | метаданные и ссылки тикета/комментария | Средняя/высокая |
| MAX Bot API | уведомления | копии max_bot_notifier | token в заголовке/параметре | метаданные и ссылки тикета/комментария | Средняя |
| RouterAI | классификация/анализ учёток | классификатор, создание учёток | ключ Bearer API | описания, каталог, возможно комментарии | Высокая для AI; CRUD не блокирует |
| GigaChat | embeddings и улучшение комментариев | функции AI | Basic OAuth → Bearer | текст/embeddings | Средняя |
| ISPmanager / REG.RU | домены почты, создание/отключение ящика | создание учёток, неактивные пользователи | логин/пароль в потоке API | данные учёток/почты | Высокая для создания учёток |
| LanCloud | путь домена/сессии KZ | создание учёток | PKCE/cookies/логин | контекст домена/учётки | Средняя; создание частично демонстрационное |
| Web Push | доставка push в браузер | push-notifications + сервис-воркер | VAPID | подписка и данные уведомления | Низкая/средняя; сейчас есть расхождения |
| Яндекс.Метрика | аналитика браузера | <code>index.html:56-97</code> | идентификатор счётчика | телеметрия браузера | Низкая |
| Google Fonts | доставка шрифта | <code>index.html:16-19</code> | нет | сетевые метаданные/шрифт | Низкая |
| Скрипты платформы в браузере | маршрутизация/телеметрия/инспекция | <code>index.html:29-39</code> | зависит от платформы | поведение <code>[UNKNOWN]</code> | Высокая для проверки миграции |

### 9.1 Интеграционные цепочки

**Bitrix OAuth:** <code>Браузер → bitrix-auth → oauth.bitrix.info → portal user.current/department.get → пользователи/роли PostgreSQL → локальный JWT</code> (<code>backend/bitrix-auth/index.py:146-215</code>).

**Синхронизация Bitrix:** <code>cron/admin → функция синхронизации → webhook Bitrix → вставка/обновление/архив подразделений, должностей и пользователей</code> (<code>backend/bitrix-sync-departments/index.py:563-650</code>).

**Боты:** <code>фиксация тикета/комментария в DB → SQL получателей → Bitrix OAuth/imbot и MAX botapi</code>. Получатели, форматирование и доставка смешаны в копиях уведомителей (<code>backend/api-tickets/bitrix_bot_notifier.py:84-238</code>, <code>backend/api-tickets/max_bot_notifier.py:127-354</code>).

**Классификатор AI:** <code>описание → каталоги/обучение в DB → необязательное векторное представление GigaChat → модель RouterAI → проверка → журналы/ожидающая проверка</code> (<code>backend/api-classify-ticket/index.py:743-874</code>). При отсутствии RouterAI есть запасной путь по ключевым словам и обучающим данным (<code>backend/api-classify-ticket/index.py:767-807</code>).

**Создание учётных записей:** <code>тикет/настройки → расшифровка integration_settings → анализ RouterAI → ISPmanager/LanCloud + пользователь/приглашение Bitrix</code> (<code>backend/create-employee-account/index.py:1537-1602</code>). <code>[CONFIRMED]</code> Этот модуль смешивает бизнес-правила, учётные данные, сетевые клиенты и компенсацию частичных результатов.

**Хранилище:** <code>браузер → upload-file → S3 платформы → URL CDN платформы → comment_attachments/файл KB → браузер</code> (<code>backend/upload-file/index.py:95-129</code>, <code>backend/api-ticket-comments/index.py:551-566</code>, <code>backend/api-knowledge-base/index.py:439-476</code>).

<code>[CONFIRMED]</code> Telegram-клиент в исследованном коде не найден. Это утверждение относится только к репозиторию; внешняя автоматизация <code>[UNKNOWN]</code>.

# L3 — архитектура для изменения системы

## 10. Граф зависимостей и центральные узлы

### 10.1 Компонентная матрица

| Компонент | От чего зависит | Кто зависит от него | Связанность | Критичность | Сложность изменения |
|---|---|---|---|---|---|
| <code>index.html</code> + <code>src/main.tsx</code> | сборка Vite, DOM, браузерные скрипты платформы | всё SPA | Низкая внутри кода, высокая к платформе | Критическая для запуска UI | Средняя: каркас мал, но скрипты маршрутизации зависят от платформы |
| <code>src/App.tsx</code> | React Router, QueryClient, провайдеры Auth/Theme/Ticket | все страницы и проверки маршрутов | Высокая по композиции | Критическая | Средняя: 40 маршрутов и порядок провайдеров |
| <code>AuthContext</code> | хранилище браузера, BroadcastChannel, API auth, формат токена | проверки маршрутов, страницы, почти все API-вызовы | Очень высокая | Критическая | Высокая: меняет вход, обновление сессии и синхронизацию вкладок |
| <code>src/utils/api.ts</code> | <code>func2url.json</code>, жёстко заданные URL, <code>fetch</code>, токен | хуки, сервисы и часть страниц | Очень высокая, но не является единственным API-клиентом | Критическая | Высокая: рядом существуют ещё три способа вызова |
| Тикеты во frontend: <code>useTicketsData</code>, <code>useTicketData</code>, <code>useTicketActions</code> | api-tickets, комментарии, история, пользователь auth | Index, TicketDetail, компоненты тикетов | Высокая | Критическая | Высокая: несколько форматов ответа и запасные запросы |
| Форма тикета | каталоги, классификатор, загрузчик, создание тикета | создание тикета | Высокая по сценарию | Критическая | Высокая: AI необязателен, связи DB обязательны |
| <code>backend/auth</code> | PostgreSQL, bcrypt, секрет JWT | функция auth, проверки маршрутов через токен | Высокая | Критическая | Высокая: локальные копии проверки токена должны остаться совместимыми |
| <code>bitrix-auth</code> | Bitrix OAuth/REST, PostgreSQL, JWT | вход через Bitrix | Высокая внешняя | Критическая для этого способа входа | Высокая: обратный вызов и правила портала внешние |
| <code>api-general</code> | PostgreSQL, права, несколько обработчиков | справочники и административный UI | Средняя/высокая | Высокая | Средняя/высокая: общий мультиплексор скрывает разные домены |
| <code>api-tickets</code> | PostgreSQL, auth, SLA, назначения, боты, правила наблюдателей | почти весь основной UI, панели, задания | Максимальная | Критическая | Очень высокая: 28 внутренних ветвей, транзакции и побочные эффекты |
| <code>api-ticket-comments</code> | PostgreSQL, состояние тикета, SLA, боты, URL файлов | TicketDetail, уведомления/история | Очень высокая | Критическая | Высокая: создание комментария меняет несколько доменов |
| <code>api-ticket-history</code> | PostgreSQL, токен | TicketDetail/UI аудита | Средняя | Высокая | Средняя |
| Вспомогательные средства исполнителей/SLA и API | пользователи, группы, графики, услуги, статусы тикетов | создание/изменение тикета, панели, автоматизация | Высокая через DB | Критическая | Высокая: правила распределены между Python и схемой |
| <code>api-watcher-rules</code> | тикеты, пользователи/группы, графики, уведомления, боты | автоматическое назначение и обработка старых данных | Высокая | Высокая | Высокая: массовые изменения и повторная обработка |
| <code>automation</code> + dispatcher | automation_jobs/runs, три заданных URL, cron | Bitrix sync, inactive users и перераспределение | Высокая эксплуатационная | Высокая | Высокая: нет подтверждённых блокировок и гарантий идемпотентности |
| Задания обслуживания тикетов | tickets/statuses/history/notifications | внешнее расписание <code>[UNKNOWN]</code>, операционный SLA | Средняя через DB | Высокая | Средняя/высокая |
| <code>upload-file</code> | учётные данные S3 платформы, соглашение URL CDN | комментарии, KB, получение файла браузером | Высокая внешняя | Высокая | Высокая: URL хранилища сохраняется как данные |
| <code>api-knowledge-base</code> | PostgreSQL, auth, S3/CDN | UI базы знаний | Высокая | Высокая | Высокая: метаданные и объект должны мигрировать согласованно |
| Уведомители ботов | настройки интеграций, HTTP Bitrix/MAX, пользователи/тикеты | потоки тикетов/комментариев/наблюдателей | Высокая и дублированная | Средняя/высокая | Высокая: нет единой точки доставки |
| Функции синхронизации Bitrix | webhook/token, подразделения/должности/пользователи | профиль auth, назначение, UI оргструктуры | Высокая внешняя и через DB | Высокая | Высокая: внешний справочник влияет на локальные ключи |
| <code>create-employee-account</code> | настройки DB, шифрование, RouterAI, ISPmanager, LanCloud, Bitrix | создание учётных записей | Максимальная внешняя | Высокая | Очень высокая: распределённая операция без общей транзакции |
| Функции AI | обучение/каталог DB, RouterAI, GigaChat | форма тикета, обучение, инструменты комментария | Средняя для ядра, высокая внешняя | Средняя | Высокая внутри функций; ядро может работать без части AI |
| Схема PostgreSQL + 265 миграций | поведение PostgreSQL платформы, путь поиска, исторический порядок | все backend-компоненты | Максимальная | Критическая | Очень высокая: это фактический общий контракт |
| <code>public/sw.js</code> | события push/notificationclick, URL приложения | Web Push UX | Низкая | Низкая/средняя | Средняя: регистрация worker в репозитории не найдена |

Основание для центральных frontend-узлов: <code>src/App.tsx:63-120</code>, <code>src/contexts/AuthContext.tsx:60-115</code>, <code>src/utils/api.ts:20-93</code>. Основание для backend-центра: маршрутизация <code>backend/api-tickets/index.py:1606-1664</code>, главный обработчик <code>backend/api-tickets/index.py:1805</code> и создание тикета <code>backend/api-tickets/index.py:2330-2619</code>.

### 10.2 Форма фактического графа

<code>[CONFIRMED]</code> На уровне исходников это не набор независимых микросервисов. Это SPA и 43 отдельно развёртываемые функции, связанные общей схемой PostgreSQL, общим JWT-форматом, жёстко заданными HTTP-адресами и копиями служебного кода. Изоляция развертывания есть; изоляции данных и доменных контрактов почти нет.

Основные рёбра:

1. <code>Браузер → AuthContext → auth/bitrix-auth → PostgreSQL → JWT → хранилище браузера</code>.
2. <code>Браузер → api.ts/прямой fetch/сервисы → шлюз функций → обработчик Python</code>.
3. <code>api-tickets/комментарии/наблюдатели/задания → общие таблицы тикетов → таблицы истории/уведомлений/SLA</code>.
4. <code>тикет/комментарий/наблюдатель → копия уведомителя → Bitrix/MAX</code>.
5. <code>загрузка/KB → S3 платформы → сохранённый URL CDN → браузер</code>.
6. <code>диспетчер → жёстко заданный URL функции → задание обслуживания → тикеты/история/уведомления</code>.
7. <code>синхронизация Bitrix → пользователи/подразделения/должности → auth/назначение/UI</code>.
8. <code>классификатор/обучение/создание учёток → внешний AI → проверенный или частично интерпретированный результат → DB/UI</code>.

<code>[CONFIRMED]</code> Основные связи между функциями проходят не через импорты Python, а через HTTP и общие таблицы. Поэтому обычный статический граф импортов недооценивает связанность. Схемы: [общая архитектура](./diagrams.md#a-общая-архитектура), [backend-зависимости](./diagrams.md#c-граф-зависимостей-backend).

### 10.3 Циклы, узкие места и неявные контракты

| Вид | Наблюдение | Следствие |
|---|---|---|
| Цикл сессии | токен → <code>/me</code> → пользователь/права → проверка маршрута → маршрут → следующий API-вызов с токеном | Ошибка auth или несовместимый JWT блокирует почти всё SPA |
| Цикл автоматизации тикета | состояние тикета → правило/задание → назначение/статус/история/уведомление → новое состояние | Нужны идемпотентность и точная исходная модель переходов; фактическая защита <code>[UNKNOWN]</code> |
| Цикл интеграционного справочника | подразделения/пользователи Bitrix → локальная DB → назначение/auth → действия пользователя → уведомления Bitrix | Рассинхронизация Bitrix влияет не только на интеграционный экран |
| Узкое место | <code>api-tickets.handle_tickets</code> обслуживает большую часть ядра и панелей | Ошибка или медленный запрос имеет широкий радиус воздействия |
| Узкое место | единая схема PostgreSQL | отказ DB/расхождение схемы останавливает почти все функции |
| Узкое место | шлюз функций платформы и топология URL | смена домена/идентификатора требует согласованного изменения разных клиентов |
| Неявный контракт | числовые/строковые ID статусов, ролей, приоритетов и кодов полей читаются из DB | миграции и начальные данные рабочей среды являются частью поведения |
| Неявный контракт | полный URL CDN записывается в DB | перенос bucket без совместимого URL ломает старые вложения |
| Неявный контракт | структуры ответов по-разному обрабатываются хуками/сервисами | «эквивалентный» новый API должен сохранять не только код состояния |

## 11. Критические пути исполнения

Ниже — не перечень каждого метода, а пути, сбой которых меняет доступность или корректность основных функций Helpdesk.

| № | Запуск и цепочка | DB / внешняя система | Результат | Основные режимы отказа |
|---:|---|---|---|---|
| 1 | HTML → <code>src/main.tsx</code> → <code>App</code> → провайдеры → маршрутизатор (<code>index.html:53-54</code>, <code>src/main.tsx:21-23</code>, <code>src/App.tsx:63-120</code>) | браузерные скрипты платформы, статические ресурсы | SPA готово, маршрут выбран | ошибка загрузки сборки/скрипта; маршрутизация платформы; ошибка провайдера |
| 2 | Форма входа → обработчик auth → <code>handle_login</code> → проверка пароля → JWT (<code>backend/auth/index.py:19-86</code>, <code>backend/auth/auth_service.py:16-69</code>) | пользователи, роли, права | токен + пользователь → хранилище/AuthContext | неверные учётные данные; неактивный пользователь; настройка JWT/DB |
| 3 | Обратный вызов Bitrix → <code>bitrix-auth</code> → обмен OAuth → профиль/подразделения → локальный пользователь → JWT (<code>backend/bitrix-auth/index.py:146-215</code>) | Bitrix OAuth/REST; пользователи/подразделения | локальная сессия | неверный обратный адрес; истёкший код; сбой портала/API/DB |
| 4 | Загрузка SPA/событие вкладки → поиск токена → auth <code>me</code> → состояние пользователя → проверка маршрута (<code>src/contexts/AuthContext.tsx:157-235</code>, <code>src/components/ProtectedRoute.tsx:10-51</code>) | API auth; хранилище браузера/BroadcastChannel | разрешённый маршрут или вход | устаревший токен; API недоступен; расхождение прав |
| 5 | Страница тикетов → <code>useTicketsData</code> → начальная загрузка/список → <code>api-tickets</code> (<code>src/hooks/useTicketsData.ts:93-173</code>, <code>src/hooks/useTicketsData.ts:252-312</code>) | тикеты, пользователи, статусы, услуги и справочники | список, фильтры, счётчики | тяжёлый SQL; несовместимый ответ; неполная начальная загрузка |
| 6 | Открытие <code>/tickets/:id</code> → точка API полной карточки → комментарии/история (<code>src/hooks/useTicketData.ts:68-107</code>, <code>backend/api-tickets/index.py:4632-4781</code>) | граф тикета, комментарии, история, связи | полная карточка | одна тяжёлая агрегация; N+1/ограничение времени; запасной путь тоже недоступен |
| 7 | Отправка формы → необязательные классификация/загрузка → создание → проверка/назначение/SLA → транзакция нескольких таблиц → уведомления/боты (<code>src/hooks/useTicketForm.ts:42-150</code>, <code>backend/api-tickets/index.py:2330-2619</code>) | тикеты, связи, чек-лист, поля, просмотры, уведомления; AI/S3/боты | созданный тикет | ошибка проверки/назначения; откат DB; внешние эффекты после фиксации |
| 8 | Описание → <code>api-classify-ticket</code> → каталоги/обучение → необязательный GigaChat → RouterAI → проверка/запасной путь (<code>backend/api-classify-ticket/index.py:743-874</code>) | обучение/каталог AI; RouterAI/GigaChat | предложенная категория/услуга/важность | сбой модели/сети/TLS; неверный ответ; запасной классификатор |
| 9 | Выбор файла → запрос base64 → <code>upload-file</code> → запись S3 → URL CDN (<code>backend/upload-file/index.py:69-129</code>) | S3/CDN платформы | URL передаётся в комментарий/KB | размер/память; учётные данные; объект загружен, запись DB не создана |
| 10 | Изменение/статус → <code>useTicketActions</code> → ветвь обновления → доступ/статус/SLA/история/уведомление (<code>src/hooks/useTicketActions.ts:63-95</code>, <code>backend/api-tickets/index.py:2621-3256</code>) | тикеты, статусы, история, SLA, уведомления | новая версия тикета | потерянное параллельное изменение; недопустимый переход; уведомление не доставлено |
| 11 | Назначение → resolver пользователя/группы → активные пользователи/график/нагрузка → тикет/история (<code>src/hooks/useTicketActions.ts:194-254</code>, <code>backend/api-tickets/executor_assignment_resolver.py:1</code>) | назначения, группы, пользователи, графики, тикеты | исполнитель или группа | нет подходящего активного участника; устаревшая нагрузка; часовой пояс/график |
| 12 | Отправка комментария → создание → строки файлов/SLA/статус/история → упоминания/наблюдатели/уведомления → боты (<code>backend/api-ticket-comments/index.py:506-711</code>) | комментарии, файлы, тикеты, история, уведомления; Bitrix/MAX | комментарий виден в карточке | откат DB; URL уже загружен; сбой бота после фиксации |
| 13 | Карточка тикета → точка API истории → проверка JWT → фильтр внутренних событий по роли (<code>backend/api-ticket-history/index.py:27-87</code>) | <code>ticket_history/users</code> | временная шкала изменений | доступ к самому <code>ticket_id</code> отдельно не проверяется; ошибка DB |
| 14 | Шапка/счётчик → счётчики; нажатие → отметка прочтения (<code>backend/tickets-counters/index.py:10-80</code>, <code>backend/tickets-mark-read/index.py:12-89</code>) | уведомления/метки прочтения | счётчик и состояние прочтения | счётчики расходятся со списком; расхождение auth/схемы |
| 15 | Событие администратора/правила → правила наблюдателей → совпадение/обработка старых данных → назначение/уведомление/боты (<code>backend/api-watcher-rules/index.py:583-755</code>) | правила, тикеты, назначения, графики | массово применённые правила | повторная обработка; слишком широкое условие; частично выполненный пакет |
| 16 | Cron/HTTP → диспетчер → готовые задания → URL Bitrix sync или reassign → запись запуска; inactive-users автоматически возвращает ошибку (<code>backend/automation-dispatcher/index.py:13-32</code>, <code>backend/automation-dispatcher/index.py:143-193</code>) | automation_jobs/runs; шлюз платформы | запущены поддержанные задания | cron не вызван; двойной запуск; превышено время; URL изменился |
| 17 | Независимый HTTP по расписанию/событию → reassign/auto-close/overdue → изменение тикета/история/уведомление (<code>backend/reassign-by-schedule/index.py:30-170</code>, <code>backend/ticket-auto-close/index.py:15-77</code>, <code>backend/tickets-overdue-checker/index.py:15-125</code>) | тикеты/статусы/история/уведомления | обслуживание жизненного цикла | фактическое расписание неизвестно; неверные начальные статусы; повторный побочный эффект |
| 18 | Cron/admin → синхронизация Bitrix → страницы REST → вставка/обновление/архив оргструктуры (<code>backend/bitrix-sync-departments/index.py:563-650</code>) | Bitrix; подразделения/должности/пользователи | локальная оргструктура обновлена | ограничение частоты; неполный обход страниц; ошибочное архивирование; учётные данные |
| 19 | Admin/расписание → неактивные пользователи → проверки и блокировка Bitrix/hosting → отчёт (<code>backend/bitrix-inactive-users/index.py:589-820</code>) | Bitrix, API хостинга, локальные пользователи/журналы | учётные записи обработаны | частичное необратимое внешнее действие; повтор; сбой сети/auth |
| 20 | Запрос создания учётки → расшифровка настроек → анализ → шаги ISPmanager/LanCloud/Bitrix → результат (<code>backend/create-employee-account/index.py:1537-1602</code>) | integration_settings; RouterAI; хостинг; Bitrix | созданные учётные записи/отчёт | частичный успех без общего отката; секреты/настройка/сеть |

<code>[INFERRED]</code> Режимы отказа в последней колонке получены из порядка операций и границ систем; это не статистика инцидентов рабочей среды. Журналы, трассировки, задержка p95 и доли ошибок недоступны: <code>[UNKNOWN]</code>, требуется проверка.

## 12. Архитектурные узлы риска

### 12.1 Монолитное ядро тикетов внутри serverless-оболочки

<code>[CONFIRMED]</code> <code>api-tickets</code> — физически одна функция с 28 ветвями и несколькими встроенными доменами панелей/SLA/admin (<code>backend/api-tickets/index.py:1606-1664</code>). <code>handle_tickets</code> имеет NLOC 708, CCN 337 и длину 1485 строк по Lizard (<code>audit/notes/lizard-summary.txt:12-20</code>).

<code>[INFERRED]</code> Граница развертывания создаёт видимость отдельного сервиса, но реальный радиус изменения определяется этим обработчиком и общей схемой. Это главный кандидат на тесты фиксации текущего поведения и постепенное разделение, но само по себе не основание для полного переписывания.

### 12.2 Скопированный общий код вместо единого контракта

<code>[CONFIRMED]</code> В backend найдены 18 локальных файлов <code>shared_utils.py</code> с 10 вариантами содержимого, а также копии уведомителей Bitrix/MAX. JSCPD показывает идентичные блоки <code>api-general/shared_utils.py ↔ api-services/api-tickets/backend shared_utils</code> (<code>audit/notes/jscpd-summary.txt:87-102</code>) и копии уведомителей между функциями тикетов/комментариев/наблюдателей (<code>audit/notes/jscpd-summary.txt:118-121</code>).

<code>[INFERRED]</code> Исправление auth, CORS, подключения DB или доставки сообщения в одной копии не гарантирует исправления остальных. При текущей модели отдельной сборки функций это также может быть сознательной упаковкой; устранять дублирование нужно вместе с новым способом поставки общего пакета.

### 12.3 Общая схема и прямой SQL как скрытая шина

<code>[CONFIRMED]</code> Функции напрямую читают и меняют общие таблицы; репозиторий содержит 265 последовательно именованных миграций, но средство их применения и состояние развёртывания не найдены. Bulk API по умолчанию использует схему <code>t_p67567221_one_file_page_projec</code>, а платежи по расписанию и push жёстко обращаются к старой <code>t_p61788166_html_to_frontend</code> (<code>backend/api-bulk-tickets/index.py:15</code>, <code>backend/process-scheduled-payments/index.py:13</code>, <code>backend/push-notifications/index.py:63</code>).

<code>[INFERRED]</code> Главный риск изменения DB — не SQL-синтаксис, а неизвестное фактическое состояние миграций, начальных данных и пути поиска в рабочей среде. Автоматические сигналы о прямом SQL требуют ручной проверки параметризации; количество совпадений не равно количеству SQL-инъекций.

### 12.4 Раздробленная топология API

<code>[CONFIRMED]</code> Frontend использует импорт реестра, централизованную таблицу соответствий, прямые <code>fetch</code> и отдельные сервисные обёртки (<code>src/utils/api.ts:20-93</code>). По репозиторию найдено 54 уникальных URL функций платформы, тогда как <code>backend/func2url.json</code> регистрирует 43 функции (<code>backend/func2url.json:2-44</code>). Для части URL соответствующий исходник или запись реестра не найдены.

11 URL, отсутствующих в реестре:

| ID URL | Потребитель в исходниках | Наблюдение |
|---|---|---|
| <code>20167b17-c827-4e24-b1a1-2ca1571d5bab</code> | <code>src/pages/CategoryPayments.tsx:65</code> | страница без активного маршрута |
| <code>42303a3a-efd9-4863-9d99-b41962f017dc</code> | <code>src/utils/api.ts:63</code> | платежи дополнительно заглушены в <code>src/utils/api.ts:104-106</code> |
| <code>465f29bc-7031-4a0b-a671-05368d234efe</code> | <code>src/components/payments/PaymentForm.tsx:350</code> | источник соответствующей функции не найден |
| <code>5977014b-b187-49a2-8bf6-4ffb51e2aaeb</code> | <code>src/components/dashboard2/Dashboard2EditableLayout.tsx:64</code>, <code>src/components/dashboard2/Dashboard2FullEditableLayout.tsx:95</code> | параллельные реализации панелей; активность <code>[UNKNOWN]</code> |
| <code>8f2170d4-9167-4354-85a1-4478c2403dfd</code> | <code>src/pages/Contractors.tsx:92</code>, <code>src/components/tickets/useTicketDetailsLogic.ts:257</code> и старые финансовые страницы | старый многоресурсный API; исходник по URL не найден |
| <code>a0000b1e-3d3e-4094-b08e-2893df500d3f</code> | <code>src/pages/PlannedPayments.tsx:68</code>, <code>src/hooks/usePlannedPaymentForm.ts:71</code> | потребители без активного маршрута |
| <code>acbb6915-96bf-4e7f-ab66-c34c3fa4b26c</code> | <code>src/pages/LogAnalyzer.tsx:35</code> | локальный <code>collect-logs</code> зарегистрирован под другим URL |
| <code>b79dfca0-9f01-41a8-92bb-7a6d9212d2f1</code> | <code>src/components/payments/ApprovedPaymentDetailsModal.tsx:68</code> | источник соответствующей функции не найден |
| <code>cc67e884-8946-4bcd-939d-ea3c195a6598</code> | <code>src/components/notifications/PushNotificationPrompt.tsx:43</code> | локальный <code>push-notifications</code> зарегистрирован под другим URL |
| <code>dd221a88-cc33-4a30-a59f-830b0a41862f</code> | <code>src/pages/LogAnalyzer.tsx:34</code> | локальный <code>log-analyzer</code> зарегистрирован под другим URL |
| <code>eeefc720-2351-43cd-804d-44fbd748ab8f</code> | <code>src/components/settings/ScheduledPaymentsSettings.tsx:18</code> | локальный обработчик <code>scheduled-payments</code> зарегистрирован под другим URL |

<code>[CONFIRMED]</code> Список получен сравнением URL в исходниках с 43 значениями <code>func2url.json</code>. Отсутствие записи реестра не доказывает, что endpoint активен или мёртв: часть потребителей не подключена к маршрутам, но Push и Log Analyzer доступны из активного дерева.

<code>[INFERRED]</code> Любая миграция шлюза требует сначала получить таблицу соответствий URL рабочей среды → функция → потребитель. Иначе «неиспользуемый» URL может оставаться активным через сборку браузера, cron или внешний webhook.

### 12.5 Непоследовательная проверка доступа

<code>[CONFIRMED]</code> Есть корневая проверка маршрута и вторая проверка с отличающимся поведением (<code>src/components/ProtectedRoute.tsx:10-51</code>, <code>src/components/auth/ProtectedRoute.tsx:12-27</code>). Backend-функции по-разному проверяют токен/роль, а некоторые интеграционные и файловые точки API не выполняют локальную проверку доступа.

<code>[CONFIRMED]</code> Разрыв проходит и по границе frontend/backend: права на создание и массовые действия, запрет изменения закрытой заявки, видимость услуг и часть объектных проверок выполняются в интерфейсе, но не всегда повторяются в backend. Доказательства и оценка по каждой группе приведены в [разделе 4.6](#46-фактическая-граница-ответственности-frontend-и-backend) и на [отдельной схеме](./diagrams.md#b2-фактическая-граница-ответственности-frontend-и-backend).

<code>[CONFIRMED]</code> Критический отдельный дефект: <code>reset-password</code> без проверки вызывающего меняет пароль фиксированного пользователя <code>admin</code> на известное значение и возвращает его в ответе (<code>backend/reset-password/index.py:12-65</code>). Его нужно закрыть немедленно независимо от архитектурной программы.

### 12.6 Хранилище встроено в модель данных

<code>[CONFIRMED]</code> Backend возвращает URL CDN платформы, а комментарии/KB сохраняют URL в PostgreSQL (<code>backend/upload-file/index.py:95-129</code>, <code>backend/api-ticket-comments/index.py:551-566</code>, <code>backend/api-knowledge-base/index.py:439-476</code>).

<code>[INFERRED]</code> Переключения места загрузки недостаточно: старые объекты и сохранённые URL образуют отдельный поток миграции с перенаправлением/прокси или массовой перезаписью.

### 12.7 Фоновые задания без подтверждённой эксплуатационной модели

<code>[CONFIRMED]</code> Диспетчер вычисляет задания, которым пора запуститься. В коде заданы три URL, но автоматический путь вызывает синхронизацию Bitrix и перераспределение; для неактивных пользователей он намеренно возвращает ошибку о ручном запуске (<code>backend/automation-dispatcher/index.py:13-32</code>, <code>backend/automation-dispatcher/index.py:143-193</code>). Миграции описывают таблицы автоматизации и регистрацию задания перераспределения (<code>db_migrations/V0222__create_automation_jobs_and_runs.sql:1-49</code>, <code>db_migrations/V0245__register_reassign_by_schedule_job.sql:1-15</code>).

<code>[UNKNOWN]</code> Требуется проверить, кто реально вызывает диспетчер, какие расписания включены, есть ли внешние повторы/блокировка, как обрабатывается превышение времени и какой часовой пояс используется в рабочей среде.

### 12.8 Распределённые внешние операции

<code>[CONFIRMED]</code> Потоки создания учётных записей и обработки неактивных пользователей последовательно обращаются к нескольким внешним системам и локальной DB (<code>backend/create-employee-account/index.py:1537-1602</code>, <code>backend/bitrix-inactive-users/index.py:589-820</code>).

<code>[INFERRED]</code> DB-транзакция не может откатить созданный почтовый ящик или действие Bitrix. Для безопасного изменения нужны журнал шагов, идемпотентные ключи и явные компенсации; текущая полнота этих механизмов <code>[UNKNOWN]</code>.

### 12.9 Frontend: параллельные реализации и разрыв навигации

<code>[CONFIRMED]</code> В <code>src/pages</code> есть страницы, не подключённые к 40 маршрутам; <code>Settings</code> ссылается на <code>/sla-analytics</code>, но маршрут отсутствует (<code>src/pages/Settings.tsx:153-156</code>, <code>src/App.tsx:74-113</code>). Для панелей, проверок маршрутов и некоторых экранов тикетов/платежей существуют параллельные реализации.

<code>[INFERRED]</code> Это увеличивает стоимость анализа последствий изменений: наличие файла не доказывает использование в среде исполнения, а навигационная ссылка не доказывает доступность маршрута.

### 12.10 Поставка и наблюдаемость

<code>[CONFIRMED]</code> В репозитории не найдены Docker/IaC/CI, единое средство применения миграций или конфигурация собственной среды исполнения HTTP. <code>tests.json</code> рядом с функциями являются декларативными примерами; доказательств их запуска и прохождения нет.

<code>[UNKNOWN]</code> Требуется проверить панель платформы: она может содержать конфигурацию развёртывания, секреты, расписания, защиту шлюза, повторы и журналы, которых нет в коммите.

## 13. Что добавляют результаты инструментов проверки

В этом разделе использованы только подготовленные сводки из <code>audit/notes</code>; сырые результаты из <code>audit/quality</code> и <code>audit/security</code> намеренно не открывались.

| Инструмент | Подтверждённый результат сводки | Архитектурный вывод | Ограничение интерпретации |
|---|---|---|---|
| Lizard | 139 предупреждений в 55 файлах; максимум CCN 337/NLOC 708 у <code>api-tickets.handle_tickets</code>; далее bulk, users, inactive users, создание учёток и comments (<code>audit/notes/lizard-summary.txt:1-39</code>) | Риск изменений концентрируется в ядре тикетов и интеграционных оркестраторах; их нужно покрывать тестами до разделения | Метрика сложности не доказывает дефект и не выбирает новую архитектуру |
| JSCPD | 472 клона, 8220 строк, 7,94%; Python 11,15%, TSX 7,29%, TypeScript 4,32% (<code>audit/notes/jscpd-summary.txt:1-21</code>) | Дублирование сквозного кода объясняет расхождение поведения auth/DB/уведомителей; административные страницы frontend также шаблонно повторяются | Генерируемый/упаковочный повтор и осмысленно похожий UI требуют отдельной оценки |
| Ruff | 1143 замечания: 629 по модернизации, 249 по слишком широким исключениям, 34 по безопасности; больше всего в тикетах/комментариях/наблюдателях/учётках/синхронизации (<code>audit/notes/ruff-summary.txt:1-18</code>, <code>audit/notes/ruff-summary.txt:37-79</code>) | Широкие <code>except</code> затрудняют понимание отказов именно в центральных путях; массовая модернизация не должна смешиваться с архитектурным изменением | 1143 — не число ошибок исполнения; большая часть относится к стилю/совместимости |
| SonarQube | 1042 замечания: 956 «запахов кода», 58 ошибок, 28 уязвимостей; 3 <code>BLOCKER</code> — «функция всегда возвращает один результат» (<code>audit/notes/sonarqube-summary.txt:1-14</code>, <code>audit/notes/sonarqube-summary.txt:90-108</code>) | Снова выделяются создание учёток, тикеты, KB, неактивные пользователи и AI; проверка TLS имеет конкретные подтверждаемые сигналы | Важность инструмента нельзя напрямую приравнивать к влиянию на бизнес; <code>BLOCKER</code> здесь не означает остановку системы |
| Semgrep | 991 совпадение, преобладают прямой/форматированный SQL; отдельно 7 случаев отключённой проверки сертификата (<code>audit/notes/semgrep-summary.txt:4-24</code>) | Нужны выборочная проверка подстановок SQL и немедленное устранение <code>verify=False</code> в сетевых клиентах | Сканер также выдал 983 предупреждения/ошибки движка, 977 из-за оператора только для Pro; прогон не является полностью успешным (<code>audit/notes/semgrep-summary.txt:67-94</code>) |
| OSV-Scanner | 20 групп результатов, 46 затронутых экземпляров пакетов, 255 совпадений и 61 уникальный ID уязвимости; часто повторяются PyJWT 2.0/2.8 и requests 2.31 (<code>audit/notes/osv-summary.txt:1-31</code>, <code>audit/notes/osv-summary.txt:50-51</code>) | Зависимости каждой функции нужно свести в перечень и обновлять согласованно; JWT/requests входят в критические пути auth/интеграций | 255 не означает 255 уникальных уязвимостей; применимость каждой версии к развёрнутой функции <code>[UNKNOWN]</code> |
| Gitleaks | один кандидат <code>generic-api-key</code> в функции создания учёток (<code>audit/notes/gitleaks-summary.txt:1-12</code>) | Модуль создания учёток нуждается в ручной проверке границы секретов/настроек | Одна эвристика не доказывает действующий секрет; значение и актуальная строка должны быть проверены без публикации |

### 13.1 Совместный вывод

1. <code>[CONFIRMED]</code> Независимые инструменты сходятся на одном наборе файлов: <code>api-tickets</code>, комментарии, правила наблюдателей, создание учёток, синхронизация/неактивные пользователи Bitrix, KB и AI. Это повышает уверенность, что именно они требуют наибольшей осторожности при изменении.
2. <code>[CONFIRMED]</code> Основная масса автоматических замечаний — сложность, дублирование, модернизация, широкие исключения и подозрительные SQL-вызовы. Их нельзя суммировать в единое «число дефектов».
3. <code>[CONFIRMED]</code> Есть конкретный межинструментальный сигнал по отключённой TLS-проверке: SonarQube и Semgrep указывают на AI HTTP-клиенты; код содержит <code>verify=False</code>, например <code>backend/api-ai-training/index.py:31</code> и <code>backend/api-classify-ticket/index.py:132</code>.
4. <code>[INFERRED]</code> Результаты поддерживают постепенное выделение границ и общий пакет инфраструктурного кода. Они не доказывают, что полное переписывание дешевле или безопаснее.
5. <code>[INFERRED]</code> Перед крупной переделкой максимальную отдачу дадут: закрытие endpoint сброса, проверка TLS, фиксация зависимостей, тесты текущего поведения критических путей, единый слой auth/DB/ошибок и наблюдаемость внешних шагов.

## 14. Матрица последствий изменений

| Что меняется | Прямо затронутые узлы | Вторичный эффект | Что зафиксировать до изменения |
|---|---|---|---|
| Секрет/поля/заголовок JWT | auth, bitrix-auth, локальные <code>verify_token</code>, AuthContext | все защищённые маршруты frontend и функции | состав полей, TTL, допустимое расхождение часов, имя заголовка, поведение старого токена |
| Правила/хеширование пароля | сервис auth, reset-password, создание пользователей | вход существующих пользователей, процедуры поддержки | параметры bcrypt, старые хеши, сброс, неактивные пользователи |
| URL/домен функции | <code>func2url.json</code>, <code>api.ts</code>, прямой fetch, сервисы, диспетчер, обратные вызовы | весь API, cron и внешние webhooks | полная таблица 54 URL, потребители, CORS, методы, ограничения времени |
| ABI <code>event/context</code> | все 43 обработчика | разбор метода/пути/тела/параметров, заголовки ответа | представительные события и ответы для каждой группы |
| Схема/путь поиска DB | все функции Python, особенно три места с жёстким значением схемы | миграции, SQL, пул подключений | имя/версия рабочей схемы, роли, расширения, начальные данные |
| Структура ответа тикета | хуки/страницы/компоненты тикетов, боты и задания | списки, карточка, панели, уведомления | снимки JSON для списка/полной карточки/создания/изменения/начала |
| Начальные статусы/приоритеты | изменение, SLA, задания, наблюдатели, подписи/фильтры frontend | переходы, сроки, автоматизация и отчёты | ID/коды, разрешённые переходы, конечные состояния |
| Модель исполнителя/группы | назначения, resolver, графики, тикеты, панели | владелец SLA, история, уведомления | приоритет прямого/группового назначения, активность, часовой пояс, пустая группа |
| Модель комментария/файла | API комментариев, полная карточка, история, загрузчик, KB | восстановление SLA, упоминания, боты, старые URL | порядок, видимость, ограничения, политика доступа по URL |
| Bucket S3/основа CDN | upload-file, KB, комментарии, ресурсы HTML/SW | все исторические файлы и закешированные ссылки | перечень объектов, ACL, формат ключа, колонки URL в DB, план перенаправления |
| Доставка ботами | копии уведомителей Bitrix/MAX, настройки интеграций | опыт пользователей тикетов/комментариев/наблюдателей | правила получателей, повторы, формат, ограничения частоты, дедупликация |
| Связи оргструктуры Bitrix | auth, функции синхронизации, пользователи/подразделения/должности | назначения, права, создание учёток | внешние ID, правила архивирования, обход страниц, владелец обратного вызова/webhook |
| Расписания автоматизации | диспетчер, таблицы автоматизации и отдельно опубликованные функции обслуживания | Bitrix sync/inactive/reassign; auto-close/overdue зависят от внешнего расписания <code>[UNKNOWN]</code> | владелец cron, часовой пояс, блокировки, повторы, прошлый/следующий запуск |
| Маршрут/базовый путь SPA | <code>index.html</code>, маршруты App, скрипты маршрутизации платформы, сервис-воркер | обновление/прямые ссылки, нажатия на уведомления | правила перенаправления хостинга, базовый URL, отсутствующие/мёртвые маршруты |
| Поведение общих средств | 18 локальных копий/вариантов | CORS, auth, сериализация, ошибки DB во всех функциях | карта вариантов и контрактные тесты до объединения |

### 14.1 Наиболее опасные сочетания изменений

- <code>JWT + топология URL</code>: одновременная замена auth и шлюза API лишает возможности быстро различить проблемы маршрутизации и совместимости токена.
- <code>Схема DB + ответ тикета</code>: смена таблиц вместе с контрактом JSON затрагивает backend и все хуки тикетов; безопаснее сохранять совместимый внешний ответ.
- <code>S3 + схема файлов</code>: без периода двойного чтения или перенаправления старые ссылки становятся недоступны сразу.
- <code>Планировщик + логика задания</code>: перенос расписания одновременно с изменением правил создаёт риск пропуска и двойного выполнения.
- <code>Синхронизация Bitrix + назначение</code>: изменение внешних идентификаторов может незаметно изменить множество назначений.

<code>[INFERRED]</code> Для каждого сочетания предпочтительны независимые переключатели и возможность отката. Это архитектурный вывод из связей; фактическая поддержка переключателей функций и разделения трафика на текущей платформе <code>[UNKNOWN]</code>.

## 15. Шпаргалка архитектора

Краткая сводка масштаба:

| Срез | Что зафиксировано |
|---|---|
| Основные домены frontend | 12 групп в [разделе 4.2](#42-домены-frontend): от входа/сессии до AI |
| Основные домены backend | 13 фактических групп в [разделе 5](#5-backend-по-фактическим-доменам), включая старые финансы/журналы |
| Точки входа | 40 маршрутов frontend, 43 зарегистрированные HTTP-функции и 9 входов запуска/событий браузера и сервис-воркера; это разные множества, их не следует складывать в «число API» |
| Критический общий код | <code>AuthContext</code>, <code>src/utils/api.ts</code>, 18 копий <code>shared_utils.py</code> с 10 вариантами содержимого, общий JWT-контракт и общая схема PostgreSQL |
| Основные внешние системы | Bitrix24, MAX, RouterAI, GigaChat, ISPmanager/REG.RU, LanCloud, S3/CDN платформы, Web Push, Метрика и браузерные ресурсы платформы |
| Главные цепочки | 20 путей в [разделе 11](#11-критические-пути-исполнения) и 8 подробных графов в [диаграммах](./diagrams.md#g-критические-графы-вызовов) |
| Архитектурные узлы риска | <code>api-tickets.handle_tickets</code>, создание учёток, комментарии, правила наблюдателей, синхронизация Bitrix, раздробленный API-слой, скопированный служебный код |
| Узлы безопасности | незащищённый сброс известного пароля, неодинаковые проверки доступа, отключённая проверка TLS, кандидат Gitleaks; доступность через шлюз и действительность секрета остаются <code>[UNKNOWN]</code> |
| Узлы сложности миграции | ABI <code>handler(event, context)</code>, 54 URL функций, состояние DB/миграций, две жёстко заданные схемы, сохранённые URL CDN, планировщик и неатомарные внешние операции |

### 15.1 Куда смотреть в первую очередь

| Вопрос | Начальная точка | Следующий слой |
|---|---|---|
| Почему не открывается приложение? | <code>index.html:29-54</code>, <code>src/main.tsx:21-23</code> | <code>src/App.tsx:63-120</code>, перенаправление хостинга/скрипты платформы |
| Почему пользователь не вошёл? | <code>src/contexts/AuthContext.tsx:157-235</code> | <code>backend/auth/index.py:19-86</code> или <code>backend/bitrix-auth/index.py:146-215</code> |
| Кто разрешает страницу? | <code>src/components/ProtectedRoute.tsx:10-51</code> | права из ответа auth <code>me</code> |
| Какой URL вызывает frontend? | <code>src/utils/api.ts:20-93</code> | прямой <code>fetch</code>, <code>src/services</code>, <code>backend/func2url.json:2-44</code> |
| Откуда берётся список тикетов? | <code>src/hooks/useTicketsData.ts:93-173</code> | <code>backend/api-tickets/index.py:1805</code> |
| Как собирается карточка? | <code>src/hooks/useTicketData.ts:68-107</code> | <code>backend/api-tickets/index.py:4632-4781</code>, комментарии/история |
| Где создаётся тикет? | <code>src/hooks/useTicketForm.ts:42-150</code> | <code>backend/api-tickets/index.py:2330-2619</code> |
| Где меняется статус/SLA? | <code>src/hooks/useTicketActions.ts:63-95</code> | <code>backend/api-tickets/index.py:2621-3256</code>, средства SLA |
| Где создаётся комментарий? | компоненты/действия комментария тикета | <code>backend/api-ticket-comments/index.py:506-711</code> |
| Почему назначен этот исполнитель? | UI/действие назначения | <code>backend/api-tickets/executor_assignment_resolver.py:1</code>, таблицы групп/графиков |
| Кто запустил фоновое задание? | <code>backend/automation-dispatcher/index.py:196-235</code> | планировщик платформы <code>[UNKNOWN]</code>, <code>automation_jobs/runs</code> |
| Куда ушло уведомление? | строка уведомления / вызов уведомителя | локальные уведомления, копии уведомителей Bitrix/MAX |
| Где физически лежит файл? | URL в строке файла/KB | <code>backend/upload-file/index.py:95-129</code>, S3/CDN платформы |
| Откуда берётся оргструктура? | таблицы подразделений/пользователей | функции синхронизации Bitrix и внешние ID |
| Какие DB-изменения предполагались? | соответствующая таблице миграция | применённые миграции рабочей среды <code>[UNKNOWN]</code> |

### 15.2 Инварианты, которые нельзя ломать незаметно

1. JWT должен одинаково пониматься выпускающими функциями auth, всеми проверками backend и состоянием сессии frontend.
2. ID пользователя из токена должен совпадать с локальными пользователями/ролями/правами и связью Bitrix.
3. Создание/изменение тикета обязано сохранять согласованность основной строки, связей, полей, чек-листа, истории, SLA и уведомлений.
4. Идентификаторы статуса/приоритета/услуги/исполнителя являются данными DB, а не только константами TypeScript/Python.
5. Комментарий может менять SLA/статус и запускать уведомления; это не изолированное добавление текста.
6. Файл считается доступным только если согласованы объект, политика CDN и URL в DB.
7. Повторный вызов планировщика/webhook не должен повторять необратимый внешний эффект; фактическое соблюдение <code>[UNKNOWN]</code>.
8. Совместимость API включает метод, разбор пути/параметров, CORS, заголовок auth, код состояния и структуру JSON.

### 15.3 Что не следует принимать за доказанный факт

- Наличие <code>tests.json</code> не означает, что тесты запускались или проходят.
- Наличие миграции не означает, что она применена в рабочей среде.
- Наличие файла страницы не означает, что до неё существует маршрут.
- Регистрация функции в <code>func2url.json</code> не означает, что она вызывается; найденный URL без регистрации не означает, что он мёртв.
- Граница serverless-функции не означает независимый домен или отдельное владение данными.
- <code>200</code> от диспетчера не доказывает успешное завершение задания, если результат вызываемой функции не проверен.
- Число замечаний сканера не равно числу подтверждённых дефектов или уязвимостей.

### 15.4 Модель чтения L1 / L2 / L3

- **L1, 5 минут:** [назначение, числа и центральные узлы](#l1--проект-за-5-минут). Ответ: «что это за система и где её сердце».
- **L2, 30 минут:** [границы, точки входа и домены](#l2--архитектура-за-30-минут). Ответ: «из чего она реально состоит и как идёт основной запрос».
- **L3, 1–2 часа:** [граф зависимостей](#10-граф-зависимостей-и-центральные-узлы), [критические пути](#11-критические-пути-исполнения), [узлы риска](#12-архитектурные-узлы-риска) и [последствия изменений](#14-матрица-последствий-изменений). Ответ: «что затронет изменение и что проверять перед ним».

## 16. Открытые вопросы

Все вопросы ниже имеют статус <code>[UNKNOWN]</code> и требуют панели рабочей среды, DB, журналов или владельца процесса.

1. Какой домен/шлюз сейчас обслуживает каждый из 54 найденных URL и какие 43 записи реестра действительно активны?
2. Кто вызывает <code>automation-dispatcher</code>, синхронизацию Bitrix, обработку неактивных пользователей и платежные задания; каковы выражения cron, часовой пояс, повторы и ограничения времени?
3. Какая схема PostgreSQL фактически используется: значение <code>MAIN_DB_SCHEMA</code>/<code>search_path</code>, <code>t_p67567221_one_file_page_projec</code> или старая <code>t_p61788166_html_to_frontend</code>?
4. Какие из 265 миграций применены, в каком порядке и есть ли ручные изменения DB/начальные данные вне репозитория?
5. Каковы объём DB, размеры основных таблиц, индексы, расширения, предел подключений, backup/PITR и цели восстановления?
6. Какие переменные окружения/секреты заданы каждой функции? Файлы зависимостей и настройки репозитория не образуют полного перечня.
7. Как шлюз платформы формирует <code>event</code>/<code>context</code>, нормализует заголовки/параметры/тело и ограничивает размер запроса/ответа?
8. Какие точки API защищены аутентификацией шлюза, списком разрешённых IP или секретом, даже если локальной проверки токена нет?
9. Каков полный перечень объектов S3, ACL, политика предварительной подписи/жизненного цикла/CORS, максимальный файл и соответствие URL в DB?
10. Зарегистрирован ли <code>public/sw.js</code> внешним скриптом/средой исполнения и используются ли реальные подписки Web Push?
11. Какие URL обратных вызовов OAuth и webhooks Bitrix активны и кто владеет их переключением?
12. Активны ли URL без записи реестра, старые платежные endpoint и ссылка <code>/sla-analytics</code>?
13. Какие требования к доставке Bitrix/MAX: повторы, ограничение частоты, порядок, дедупликация и допустимая потеря?
14. Есть ли трассировки/структурированные журналы рабочей среды, сквозной ID и метрики по 20 критическим путям?
15. Какие <code>tests.json</code> реально запускаются платформой и какие отдельные интеграционные/e2e-наборы существуют?
16. Является ли кандидат Gitleaks действующими учётными данными или ложным/устаревшим совпадением?
17. Каковы фактические роли, права и административные процедуры сброса пароля?
18. Как компенсируются частичные результаты создания учёток/обработки неактивных пользователей после сбоя внешней системы?

## 17. Границы достоверности и полнота карты

### Подтверждено этим исследованием

- точка запуска браузера, дерево провайдеров и 40 объявленных маршрутов frontend;
- 43 записи реестра backend и соответствующие локальные обработчики;
- внутренние ветви крупных мультиплексоров, включая 28 ветвей <code>api-tickets</code>;
- основные цепочки тикетов/auth/комментариев/файлов/уведомлений/назначений/Bitrix/заданий;
- 265 файлов миграций и ключевые доменные таблицы;
- способы вызова API, жёстко заданные URL платформы и межфункциональные вызовы;
- внешние клиенты, которые присутствуют непосредственно в исходниках;
- архитектурно значимые выводы семи сводок <code>audit/notes</code>.

### Выведено из кода, но требует проверки на работающей системе

- реальные узкие места по доступности и задержкам;
- риск двойной обработки заданий/webhooks;
- полнота компенсации внешних операций;
- фактическое использование не подключённых страниц и URL вне реестра;
- порядок и стоимость переноса конкретных наборов данных DB/файлов.

### Не определено по репозиторию

- топология рабочей среды и конфигурация панели платформы;
- применённое состояние DB, объём и качество данных;
- активные расписания, секреты, обратные вызовы и правила шлюза;
- фактическая нагрузка, SLA/SLO, ошибки, задержки и инциденты;
- прохождение тестов и соответствие развёртывания текущему коммиту.

Карта описывает коммит <code>e066f9fe2f63f226d82ca9adcc4c95049ad012cd</code>. Она фиксирует наблюдаемую архитектуру, а не желаемое целевое состояние.
