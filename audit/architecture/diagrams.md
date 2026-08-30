# Диаграммы фактической архитектуры Helpdesk

**Состояние кода:** коммит <code>e066f9fe2f63f226d82ca9adcc4c95049ad012cd</code>  
**Основной документ:** [Техническая карта проекта](./project-map.md)

## Обозначения

- <code>[CONFIRMED]</code> — связь непосредственно видна в исходниках или миграциях.
- <code>[INFERRED]</code> — вывод следует из порядка вызовов и границ компонентов.
- <code>[UNKNOWN]</code> — настройка рабочей среды отсутствует в репозитории.
- Сплошная стрелка — подтверждённый вызов или поток данных.
- Пунктирная стрелка — внешний запуск или эксплуатационная связь, которую нужно проверить.

Диаграммы показывают наблюдаемое состояние, а не предлагаемую целевую архитектуру. Узлы намеренно сгруппированы по реальным границам: браузер, шлюз текущей платформы, отдельно развёртываемые Python-функции, общая схема PostgreSQL, файловое хранилище и внешние API.

## Навигация

1. [A. Общая архитектура](#a-общая-архитектура)
2. [B. Типичный API-запрос](#b-типичный-api-запрос)
3. [B2. Граница ответственности frontend и backend](#b2-фактическая-граница-ответственности-frontend-и-backend)
4. [C. Граф зависимостей backend](#c-граф-зависимостей-backend)
5. [D. Аутентификация и авторизация](#d-аутентификация-и-авторизация)
6. [E. Жизненный цикл тикета](#e-жизненный-цикл-тикета)
7. [F. Карта интеграций](#f-карта-интеграций)
8. [G. Критические графы вызовов](#g-критические-графы-вызовов)
9. [H. Логическая карта DB](#h-логическая-карта-db)

## A. Общая архитектура

```mermaid
flowchart LR
    Person["Пользователь"]

    subgraph Browser["Браузер"]
        HTML["index.html<br/>скрипты платформы"]
        SPA["React SPA<br/>40 маршрутов"]
        AuthState["AuthContext<br/>токен и пользователь"]
        ApiClients["api.ts + прямой fetch<br/>хуки + сервисы"]
        SW["сервис-воркер<br/>события push"]
    end

    subgraph Vendor["Текущая платформа"]
        Static["Статическая публикация<br/>и маршрутизация SPA"]
        Gateway["Шлюз функций<br/>event, context"]
        Cron["Планировщик<br/>UNKNOWN"]
    end

    subgraph Functions["43 serverless-функции"]
        AuthFns["auth<br/>bitrix-auth"]
        TicketFns["api-tickets<br/>комментарии/история"]
        DomainFns["general, KB, исполнители<br/>наблюдатели, AI"]
        IntegrFns["синхронизация/боты Bitrix<br/>подготовка учётных записей"]
        Dispatcher["автоматизация<br/>диспетчер/задания"]
        Upload["upload-file"]
    end

    subgraph Data["Состояние"]
        PG[("PostgreSQL<br/>общая схема")]
        S3[("S3 платформы")]
        CDN["CDN платформы"]
    end

    subgraph External["Внешние системы"]
        Bitrix["Bitrix24"]
        Bots["Боты Bitrix / MAX"]
        AI["RouterAI / GigaChat"]
        Hosting["ISPmanager / REG.RU<br/>LanCloud"]
        Push["Сервис Web Push"]
    end

    Person --> HTML
    Static --> HTML
    HTML --> SPA
    SPA --> AuthState
    SPA --> ApiClients
    ApiClients --> Gateway
    AuthState --> ApiClients

    Gateway --> AuthFns
    Gateway --> TicketFns
    Gateway --> DomainFns
    Gateway --> IntegrFns
    Gateway --> Dispatcher
    Gateway --> Upload

    AuthFns --> PG
    TicketFns --> PG
    DomainFns --> PG
    IntegrFns --> PG
    Dispatcher --> PG

    Upload --> S3
    DomainFns --> S3
    S3 --> CDN
    CDN --> SPA

    AuthFns <--> Bitrix
    IntegrFns <--> Bitrix
    TicketFns --> Bots
    DomainFns --> Bots
    DomainFns <--> AI
    IntegrFns <--> AI
    IntegrFns <--> Hosting
    DomainFns --> Push
    Push --> SW
    SW --> SPA

    Cron -.->|фактическое расписание UNKNOWN| Dispatcher
    Dispatcher -->|HTTP через шлюз| Gateway
    Bitrix -->|обратный вызов OAuth и webhooks| Gateway
```

**Проверка по коду.** Запуск браузера: <code>index.html:29-54</code>, <code>src/main.tsx:21-23</code>; корень SPA: <code>src/App.tsx:63-120</code>; реестр: <code>backend/func2url.json:2-44</code>; средства DB: <code>backend/shared_utils.py:12-52</code>; S3/CDN: <code>backend/upload-file/index.py:60-129</code>; диспетчер: <code>backend/automation-dispatcher/index.py:143-235</code>.

**Вывод.** <code>[CONFIRMED]</code> Функции раздельно публикуются, но образуют одну систему через общую DB, JWT и HTTP-адреса. <code>[UNKNOWN]</code> Статическая публикация, шлюз и планировщик показаны как граница платформы; их фактическая конфигурация рабочей среды в коммите отсутствует.

## B. Типичный API-запрос

```mermaid
sequenceDiagram
    actor U as Пользователь
    participant SPA as React SPA
    participant AC as AuthContext
    participant CL as API-клиент
    participant GW as Шлюз платформы
    participant FN as Обработчик Python
    participant DB as PostgreSQL
    participant EX as Внешний API

    U->>SPA: действие в интерфейсе
    SPA->>AC: получить токен и права
    AC-->>SPA: X-Auth-Token
    SPA->>CL: метод, точка API, тело/параметры
    CL->>GW: HTTPS-запрос
    GW->>FN: handler(event, context)
    FN->>FN: разобрать метод/путь/параметры/тело
    opt Локальная проверка предусмотрена функцией
        FN->>FN: проверить JWT / роль / право
    end
    FN->>DB: SQL
    DB-->>FN: строки / фиксация / ошибка
    opt У операции есть внешний побочный эффект
        FN->>EX: Bitrix, бот, AI, S3 или хостинг
        EX-->>FN: внешний ответ
    end
    FN-->>GW: код статуса, заголовки, тело JSON
    GW-->>CL: HTTP-ответ
    CL-->>SPA: разобранный ответ
    SPA-->>U: новое состояние или ошибка
```

<code>[CONFIRMED]</code> Контракт <code>handler(event, context)</code> повторяется во всех 43 зарегистрированных функциях. Разбор события и проверка токена не централизованы: примеры <code>backend/auth/index.py:19-86</code>, <code>backend/api-tickets/index.py:1570-1604</code>, <code>backend/upload-file/index.py:69-92</code>.

<code>[INFERRED]</code> Шлюз может добавлять собственную защиту, CORS или преобразование события, но это нельзя подтвердить по репозиторию.

## B2. Фактическая граница ответственности frontend и backend

```mermaid
flowchart LR
    User["Пользователь"]
    Direct["Прямой HTTP-вызов<br/>минует правила интерфейса"]

    subgraph Frontend["Frontend — насыщенный клиент"]
        UI["Маршруты, формы<br/>и локальное состояние"]
        ClientRules["Правила интерфейса<br/>создание/массовые действия<br/>активная роль, закрытие, видимость"]
        Composition["Слой сборки ответов API<br/>URL, кеш, повторы<br/>и запасные пути"]
        Mutation["Составные изменения<br/>классификация + файл<br/>+ тикет + комментарий"]
    end

    subgraph Backend["Backend — владелец большей части правил"]
        Gateway["Шлюз бессерверных функций"]
        Core["Ядро тикета<br/>обязательные поля, SLA<br/>назначение, статусы<br/>история, уведомления"]
        Gaps["Неполные проверки<br/>массовые действия: только JWT<br/>доступ к тикету / is_closed<br/>загрузка и классификатор: без проверки JWT"]
    end

    DB[("PostgreSQL")]
    External["S3 / ИИ / боты"]

    User --> UI
    UI --> ClientRules
    ClientRules --> Composition
    UI --> Mutation
    Mutation --> Composition
    Composition --> Gateway
    Direct --> Gateway
    Gateway --> Core
    Gateway --> Gaps
    Core --> DB
    Gaps --> DB
    Core --> External
    Gaps --> External
    ClientRules -.->|"часть правил не повторяется"| Gaps
```

<code>[CONFIRMED]</code> Диаграмма показывает две разные роли frontend: обоснованную логику интерфейса и перегруженную сборку ответов API/составных изменений. Факты: топология API и повторы — <code>src/utils/api.ts:1-263</code>, <code>src/hooks/useTicketsData.ts:93-173</code>; создание тикета — <code>src/hooks/useTicketForm.ts:69-150</code>; запрет интерфейса для закрытой заявки — <code>src/pages/ticket-details/useTicketDetailsPage.ts:100-185</code>.

<code>[CONFIRMED]</code> Backend остаётся владельцем большей части ядра тикета (<code>backend/api-tickets/index.py:2330-3256</code>), но не все правила, выполняемые во frontend, закреплены на сервере: <code>POST tickets</code> и массовый API требуют только JWT (<code>backend/api-tickets/index.py:1805-1810</code>, <code>backend/api-tickets/index.py:2330-2619</code>, <code>backend/api-bulk-tickets/index.py:124-578</code>), общего запрета изменения закрытого тикета нет (<code>backend/api-tickets/index.py:2621-2681</code>, <code>backend/api-ticket-comments/index.py:521-547</code>), а <code>upload-file</code> и классификатор не проверяют JWT локально (<code>backend/upload-file/index.py:69-92</code>, <code>backend/api-classify-ticket/index.py:743-764</code>). Возможная защита шлюза остаётся <code>[UNKNOWN]</code>.

<code>[INFERRED]</code> Прямой HTTP-вызов минует все проверки интерфейса, поэтому frontend не может быть границей авторизации и целостности. Полная таблица разрывов и целевая граница описаны в [разделе 4.6 карты](./project-map.md#46-фактическая-граница-ответственности-frontend-и-backend).

## C. Граф зависимостей backend

```mermaid
flowchart TB
    Gateway["Шлюз функций"]

    subgraph Identity["Идентификация"]
        Auth["auth"]
        BitrixAuth["bitrix-auth"]
        General["api-general<br/>пользователи и справочники"]
    end

    subgraph TicketDomain["Ядро тикетов"]
        Tickets["api-tickets<br/>28 внутренних ветвей"]
        Comments["api-ticket-comments"]
        History["api-ticket-history"]
        Bulk["api-bulk-tickets"]
        Executors["группы исполнителей<br/>назначения, графики"]
        Watchers["api-watcher-rules"]
        Reassign["перераспределение<br/>по графику"]
        OtherMaintenance["автозакрытие<br/>проверка просрочки"]
    end

    subgraph Content["Контент"]
        Upload["upload-file"]
        KB["api-knowledge-base"]
        AITrain["обучение AI"]
        Classifier["api-classify-ticket"]
        Improve["api-improve-comment"]
    end

    subgraph Integration["Интеграции и задания"]
        Automation["automation"]
        Dispatcher["automation-dispatcher"]
        Sync["функции синхронизации Bitrix"]
        Inactive["bitrix-inactive-users"]
        Provision["create-employee-account"]
        Notifiers["Копии уведомителей Bitrix/MAX"]
    end

    DB[("Общая схема PostgreSQL")]
    Store[("S3/CDN платформы")]
    Ext["Внешние API"]

    Gateway --> Auth
    Gateway --> BitrixAuth
    Gateway --> General
    Gateway --> Tickets
    Gateway --> Comments
    Gateway --> History
    Gateway --> Bulk
    Gateway --> Executors
    Gateway --> Watchers
    Gateway --> Reassign
    Gateway --> OtherMaintenance
    Gateway --> Upload
    Gateway --> KB
    Gateway --> AITrain
    Gateway --> Classifier
    Gateway --> Improve
    Gateway --> Automation
    Gateway --> Dispatcher
    Gateway --> Sync
    Gateway --> Inactive
    Gateway --> Provision

    Auth --> DB
    BitrixAuth --> DB
    General --> DB
    Tickets --> DB
    Comments --> DB
    History --> DB
    Bulk --> DB
    Executors --> DB
    Watchers --> DB
    Reassign --> DB
    OtherMaintenance --> DB
    KB --> DB
    AITrain --> DB
    Classifier --> DB
    Automation --> DB
    Dispatcher --> DB
    Sync --> DB
    Inactive --> DB
    Provision --> DB

    Tickets --> Executors
    Tickets --> Notifiers
    Comments --> Notifiers
    Watchers --> Notifiers
    AITrain -->|HTTP| Classifier
    Automation -->|HTTP| Sync
    Automation -->|HTTP| Inactive
    Automation -->|HTTP| Reassign
    Dispatcher -->|HTTP: синхронизация или перераспределение| Gateway

    Upload --> Store
    KB --> Store
    BitrixAuth --> Ext
    Classifier --> Ext
    Improve --> Ext
    Sync --> Ext
    Inactive --> Ext
    Provision --> Ext
    Notifiers --> Ext
```

**Проверка по коду.** Маршрутизация ядра тикетов: <code>backend/api-tickets/index.py:1606-1664</code>; комментарии: <code>backend/api-ticket-comments/index.py:178-223</code>; ручные вызовы автоматизации: <code>backend/automation/index.py:284-352</code>; вызовы диспетчера: <code>backend/automation-dispatcher/index.py:143-193</code>; обучение AI вызывает классификатор по URL: <code>backend/api-ai-training/index.py:89-129</code>.

**Вывод.** <code>[CONFIRMED]</code> PostgreSQL — наиболее центральный узел. <code>automation</code> вручную вызывает только перераспределение, синхронизацию должностей и обработку неактивных пользователей; автозакрытие и проверка просрочки опубликованы отдельно, а источник их запуска <code>[UNKNOWN]</code>.

## D. Аутентификация и авторизация

```mermaid
flowchart TD
    Start["Страница входа"] --> Choice{"Способ входа"}

    Choice -->|пароль| Login["auth: вход"]
    Login --> UserLookup["пользователи + роли + права"]
    UserLookup --> Password["проверка bcrypt"]
    Password --> JWT["HS256 JWT"]

    Choice -->|Bitrix OAuth| Callback["обратный вызов bitrix-auth"]
    Callback --> OAuth["oauth.bitrix.info"]
    OAuth --> Profile["профиль + подразделение Bitrix"]
    Profile --> LocalUser["локальный пользователь / роли"]
    LocalUser --> JWT

    JWT --> Storage["localStorage или sessionStorage"]
    Storage --> Context["AuthContext"]
    Context --> Me["auth: me"]
    Me --> SessionUser["пользователь + роли + права"]
    SessionUser --> Guard["ProtectedRoute"]
    Guard -->|разрешено| Page["Защищённая страница"]
    Guard -->|нет токена/права| Denied["вход или отказ в UI"]

    OtherTab["Другая вкладка"] <--> Channel["BroadcastChannel"]
    Channel <--> Context
    Timer["Обновление через 6 часов"] --> Me

    Untrusted["Запрос без локальной auth"] --> Reset["reset-password"]
    Reset --> KnownPassword["установить известный пароль"]
    KnownPassword --> UserLookup

    classDef risk fill:#ffe0e0,stroke:#b00020,stroke-width:2px
    class Reset,KnownPassword risk
```

**Проверка по коду.** Пароль/JWT: <code>backend/auth/auth_service.py:16-141</code>, <code>backend/auth/jwt_service.py:11-35</code>; Bitrix: <code>backend/bitrix-auth/index.py:146-215</code>; сессия frontend: <code>src/contexts/AuthContext.tsx:60-115</code>, <code>src/contexts/AuthContext.tsx:157-235</code>, <code>src/contexts/AuthContext.tsx:254-347</code>; проверка маршрута: <code>src/components/ProtectedRoute.tsx:10-51</code>.

**Критический факт.** <code>[CONFIRMED]</code> Красная ветвь реализована в <code>backend/reset-password/index.py:12-65</code>: локальной проверки вызывающего нет, устанавливается и возвращается известный пароль. Диаграмма не утверждает, что шлюз платформы не защищает URL; правило шлюза <code>[UNKNOWN]</code>.

## E. Жизненный цикл тикета

```mermaid
flowchart TD
    Create["POST tickets"] --> Validate["права + проверка данных"]
    Validate --> Resolve["выбор услуги / исполнителя / SLA"]
    Resolve --> Persist["тикет + связи + поля<br/>чек-лист + просмотры"]
    Persist --> Current["Текущее состояние<br/>status_id из DB"]

    Current --> Event{"Событие"}
    Event -->|ручной PUT| Manual["статус, исполнитель, группа<br/>содержание или срок"]
    Event -->|комментарий| Comment["comment + mentions<br/>возможное изменение SLA/status"]
    Event -->|правило наблюдателя| Rule["назначение / действие наблюдателя"]
    Event -->|функция обслуживания| Job["перераспределение, автозакрытие<br/>проверка просрочки"]

    Manual --> Transition["Проверки перехода<br/>и доступа"]
    Comment --> Transition
    Rule --> Transition
    Job --> Transition

    Transition --> SLA["пауза/возобновление/пересчёт SLA"]
    SLA --> Update["UPDATE tickets<br/>и связанные таблицы"]
    Update --> History["ticket_history / журнал группы"]
    History --> Notify["внутренние уведомления<br/>Bitrix/MAX без гарантии доставки"]
    Notify --> Terminal{"Конечное состояние<br/>по данным и логике?"}
    Terminal -->|нет| Current
    Terminal -->|да| Archive["закрыт/архивирован<br/>конкретный статус определяется DB"]
```

**Проверка по коду.** Create: <code>backend/api-tickets/index.py:2330-2619</code>; update: <code>backend/api-tickets/index.py:2621-3256</code>; comment: <code>backend/api-ticket-comments/index.py:506-711</code>; status dictionaries: <code>backend/api-tickets/index.py:3640</code>; maintenance entry points: <code>backend/reassign-by-schedule/index.py:30</code>, <code>backend/ticket-auto-close/index.py:15</code>, <code>backend/tickets-overdue-checker/index.py:15</code>.

**Вывод.** <code>[CONFIRMED]</code> Точные переходы нельзя честно изобразить фиксированным набором названий: часть поведения опирается на строки <code>ticket_statuses</code>, связи SLA и начальные данные рабочей среды. Поэтому диаграмма показывает механизм перехода, а не выдуманную конечную машину состояний.

## F. Карта интеграций

```mermaid
flowchart LR
    subgraph Local["Helpdesk"]
        BA["bitrix-auth"]
        BS["синхронизация / неактивные пользователи Bitrix"]
        BN["Копии уведомителя Bitrix"]
        MN["Копии уведомителя MAX"]
        CL["AI classifier/training"]
        IC["Улучшение комментария"]
        PA["Подготовка учётных записей/настройки"]
        UF["upload-file / файлы KB"]
        PN["push-notifications"]
        Web["index.html / SPA"]
    end

    BitrixOAuth["Bitrix OAuth"]
    BitrixRest["Bitrix REST / webhooks"]
    BitrixBot["Bitrix Bot API"]
    MaxApi["MAX Bot API"]
    Router["RouterAI"]
    Giga["GigaChat"]
    Isp["ISPmanager / REG.RU"]
    Lan["LanCloud"]
    S3["S3/CDN платформы"]
    Push["Сервис Web Push"]
    Metrika["Яндекс.Метрика"]
    Fonts["Google Fonts"]
    VendorJS["Браузерные скрипты платформы"]

    BA <--> BitrixOAuth
    BA <--> BitrixRest
    BS <--> BitrixRest
    BN --> BitrixBot
    MN --> MaxApi
    CL <--> Router
    CL <--> Giga
    IC <--> Giga
    PA <--> Router
    PA <--> BitrixRest
    PA <--> Isp
    PA <--> Lan
    UF <--> S3
    PN --> Push
    Web --> Metrika
    Web --> Fonts
    Web --> VendorJS
```

| Граница | Что пересекает её | Где подтверждено |
|---|---|---|
| Bitrix OAuth/REST | код авторизации, токен, профиль, подразделения, пользователи | <code>backend/bitrix-auth/index.py:146-215</code>, <code>backend/bitrix-sync-departments/index.py:563-650</code> |
| API ботов | получатели, текст тикета/комментария и ссылки | <code>backend/api-tickets/bitrix_bot_notifier.py:84-238</code>, <code>backend/api-tickets/max_bot_notifier.py:127-354</code> |
| AI | описания, справочники/обучающие данные и созданный результат | <code>backend/api-classify-ticket/index.py:743-874</code>, <code>backend/api-improve-comment/index.py:72-96</code> |
| Системы хостинга/учётных записей | контекст домена/учётной записи и учётные данные | <code>backend/create-employee-account/index.py:245-951</code> |
| S3/CDN | байты файла, ключ объекта и полный сохраняемый URL | <code>backend/upload-file/index.py:95-151</code>, <code>backend/api-knowledge-base/index.py:439-476</code> |
| Сторонние системы браузера | аналитика, запросы шрифтов и скрипты платформы | <code>index.html:16-39</code>, <code>index.html:56-97</code> |

<code>[CONFIRMED]</code> Интеграция Telegram в исследованном исходном коде не найдена. <code>[UNKNOWN]</code> Она может существовать вне коммита.

## G. Критические графы вызовов

### G1. Загрузка списка и начальных справочников

```mermaid
flowchart LR
    Route["/ или /tickets"] --> Hook["useTicketsData"]
    Hook --> Token["токен AuthContext"]
    Hook --> Bootstrap["tickets-bootstrap"]
    Hook --> List["тикеты + фильтры + страницы"]
    Hook --> Counters["счётчик needs_my_reply"]
    Bootstrap --> API["apiFetch"]
    List --> Retry["до 4 попыток<br/>для 500/502/503/504"]
    Counters --> API
    Retry --> API
    API --> Gateway["шлюз функций"]
    Gateway --> Tickets["api-tickets"]
    Tickets --> Auth["проверка токена / доступа"]
    Auth --> DB[("tickets + dictionaries<br/>users/services/statuses")]
    DB --> Response["ответ JSON"]
    Response --> UI["список, фильтры, счётчики"]
    Retry -->|все попытки неуспешны| Keep["оставить предыдущий список"]
```

Проверено по <code>src/hooks/useTicketsData.ts:80-173</code>, <code>src/hooks/useTicketsData.ts:252-312</code>, <code>backend/api-tickets/index.py:4483-4629</code>. <code>[CONFIRMED]</code> При неуспехе список намеренно не очищается; это повышает устойчивость UI, но пользователь может видеть устаревшие данные.

### G2. Открытие полной карточки

```mermaid
flowchart LR
    Route["/tickets/:id"] --> Hook["useTicketData"]
    Hook --> Full["GET endpoint=tickets-full"]
    Full --> API["api-tickets"]
    API --> Access["проверки доступа к тикету"]
    Access --> DB[("ticket + mappings + participants<br/>comments + history + approvals")]
    DB --> Bundle["объединённый JSON"]
    Bundle --> Race{"id всё ещё тот же?"}
    Race -->|да| State["ticket/comments/history<br/>approvals/participants"]
    Race -->|нет| Ignore["игнорировать ответ"]
    Full -->|ошибка| Preserve["не очищать последний<br/>успешный снимок"]
    Hook --> Dictionaries["отдельные вызовы справочников/пользователей"]
    Dictionaries --> State
```

Проверено по <code>src/hooks/useTicketData.ts:68-145</code>, <code>backend/api-tickets/index.py:4632-4781</code>. <code>[CONFIRMED]</code> Комментарии берутся из объединённого ответа; отдельный запасной путь относится прежде всего к справочнику статусов, если основной ответ успешен, но пуст.

### G3. Создание тикета с AI и файлами

```mermaid
flowchart TD
    Form["Форма тикета"] --> Permission["проверка права frontend + токен"]
    Form --> Suggest["опциональная AI-подсказка<br/>категории/услуги"]
    Form --> UploadHook["useFileUploader"]
    UploadHook --> Base64["FileReader → base64"]
    Base64 --> Inline["POST upload-file"]
    Inline --> Put["функция записывает объект в S3"]
    Put --> FileUrl["URL CDN"]

    Permission --> Post["POST endpoint=tickets"]
    Suggest --> Post
    Post --> Create["создание в api-tickets"]
    Create --> Validate["проверка + услуга<br/>исполнитель + SLA"]
    Validate --> Tx["DB transaction:<br/>ticket, mappings, fields,<br/>checklist, views, notifications"]
    Tx --> Commit["фиксация DB"]
    Commit --> TicketId["ID тикета"]
    TicketId --> Shadow["без ожидания ответа<br/>фоновая классификация"]
    TicketId --> HasFiles{"Есть готовые URL?"}
    FileUrl --> HasFiles
    HasFiles -->|да| AttachmentComment["POST пустого comment<br/>с attachments"]
    HasFiles -->|нет| Navigate["перейти к карточке"]
    AttachmentComment --> Navigate
    Commit --> Bots["журнал группы / боты / правила наблюдателей"]
```

Проверено по <code>src/hooks/useTicketForm.ts:42-150</code>, <code>src/components/tickets/useTicketFormLogic.ts:64-167</code>, <code>src/hooks/useFileUploader.ts:26-99</code>, <code>backend/upload-file/index.py:132-164</code>, <code>backend/api-tickets/index.py:2330-2619</code>.

Ключевой вывод: <code>[CONFIRMED]</code> фиксация тикета, комментарий с вложениями, фоновая классификация, вызовы ботов и правила наблюдателей не являются одной сквозной транзакцией. Форма явно допускает результат «тикет создан, файлы не прикреплены».

### G4. Обновление, статус и назначение

```mermaid
flowchart TD
    UI["Действие TicketDetail"] --> Kind{"Вид изменения"}
    Kind --> Status["status_id"]
    Kind --> User["assigned_to"]
    Kind --> Group["executor_group_id<br/>и очистка assigned_to"]
    Kind --> Content["заголовок, описание,<br/>поля, услуги"]
    Kind --> Due["due_date"]
    Status --> PUT["PUT endpoint=tickets"]
    User --> PUT
    Group --> PUT
    Content --> PUT
    Due --> PUT
    PUT --> Core["изменение api-tickets"]
    Core --> Auth["проверки прав/доступа"]
    Auth --> Resolve["правила статуса/SLA/назначения"]
    Resolve --> DB[("tickets + mappings<br/>history + SLA")]
    DB --> Notify["уведомления / боты<br/>если предусмотрено ветвью"]
    Notify --> Reload["перезагрузить полную карточку<br/>и историю"]
```

Проверено по <code>src/hooks/useTicketActions.ts:63-95</code>, <code>src/hooks/useTicketActions.ts:194-314</code>, <code>backend/api-tickets/index.py:2621-3256</code>. <code>[INFERRED]</code> Без версии/ETag в показанных данных frontend параллельные изменения могут перезаписывать друг друга; фактическая частота <code>[UNKNOWN]</code>.

### G5. Комментарий и уведомления

```mermaid
flowchart TD
    Editor["Текст / reply / mentions"] --> Upload["опциональная загрузка файлов"]
    Upload --> URLs["готовые URL CDN"]
    Editor --> Post["POST api-ticket-comments"]
    URLs --> Post
    Post --> Auth["токен + доступ к тикету"]
    Auth --> Insert["ticket_comments<br/>comment_attachments"]
    Insert --> SideDB["reads/history/SLA/status<br/>mentions/watchers/notifications"]
    SideDB --> Commit["фиксация DB"]
    Commit --> Bitrix["уведомитель Bitrix"]
    Commit --> Max["уведомитель MAX"]
    Commit --> Response["ответ с комментарием"]
    Response --> Reload["перезагрузить комментарии"]
    Bitrix -->|ошибка| BestEffort["операция DB уже сохранена"]
    Max -->|ошибка| BestEffort
```

Проверено по <code>src/hooks/useTicketActions.ts:21-60</code>, <code>backend/api-ticket-comments/index.py:506-711</code>. <code>[CONFIRMED]</code> DB фиксируется до вызовов ботов (<code>backend/api-ticket-comments/index.py:667-708</code>), поэтому доставка уведомления не является частью атомарности комментария.

### G6. Автоматизация и отдельные фоновые функции

```mermaid
flowchart TD
    Admin["AutomationSettings"] --> Manual["обработчик automation<br/>JWT + администратор"]
    Manual --> Jobs[("automation_jobs")]
    Manual --> Trigger["ручной execute_job"]
    Trigger --> Sync["bitrix_sync_positions URL"]
    Trigger --> Inactive["bitrix_inactive_users URL<br/>с токеном администратора"]
    Trigger --> Reassign["reassign_by_schedule URL"]
    Trigger --> Runs[("automation_runs")]

    Cron["Планировщик платформы<br/>UNKNOWN"] -.-> Dispatcher["automation-dispatcher<br/>без локальной auth"]
    Dispatcher --> Due["выбрать задания к запуску"]
    Due --> AutoChoice{"job_key"}
    AutoChoice -->|bitrix_sync_positions| Sync
    AutoChoice -->|reassign_by_schedule| Reassign
    AutoChoice -->|bitrix_inactive_users| Refuse["записать ошибку:<br/>нужен ручной запуск"]
    Sync --> Runs
    Reassign --> Runs
    Refuse --> Runs

    OtherCron["Отдельный планировщик<br/>UNKNOWN"] -.-> Close["ticket-auto-close"]
    OtherCron -.-> Overdue["tickets-overdue-checker"]
    Close --> TicketDB[("tickets/history")]
    Overdue --> TicketDB
    Reassign --> TicketDB
```

Проверено по <code>backend/automation/index.py:284-352</code>, <code>backend/automation/index.py:355-446</code>, <code>backend/automation-dispatcher/index.py:143-235</code>, <code>db_migrations/V0222__create_automation_jobs_and_runs.sql:1-49</code>.

<code>[CONFIRMED]</code> DB-диспетчер не вызывает автозакрытие и проверку просрочки. <code>[UNKNOWN]</code> Вызываются ли эти отдельные функции внешним планировщиком и вызывается ли сам диспетчер раз в минуту так, как обещает строка документации.

### G7. Подготовка учётных записей и настройки интеграций

```mermaid
flowchart TD
    Request["запрос create-employee-account"] --> Action{"действие / метод"}

    Action -->|settings, save, test,<br/>list_domains, analyze_ticket| Protected["проверить токен"]
    Protected --> Admin{"требуемая роль<br/>в конкретном обработчике"}
    Admin --> Settings[("integration_settings<br/>зашифрованные секреты")]
    Protected --> Analyze["анализ RouterAI"]

    Action -->|обычный POST create| Create["handle_create<br/>без локальной проверки токена"]
    Create --> Context["RU/KZ portal<br/>mail domain и identity"]
    Context --> Isp["ISPmanager / REG.RU"]
    Context --> Lan["LanCloud session path"]
    Context --> Bitrix["пользователь/приглашение Bitrix"]
    Isp --> Result["составной результат"]
    Lan --> Result
    Bitrix --> Result
    Analyze --> Result
    Settings --> Result
    Result --> Partial{"Все внешние шаги успешны?"}
    Partial -->|нет| Report["частичный результат / ошибка"]
    Partial -->|да| Success["данные созданных учёток"]
```

Проверено по <code>backend/create-employee-account/index.py:245-382</code>, <code>backend/create-employee-account/index.py:816-951</code>, <code>backend/create-employee-account/index.py:1537-1602</code>. <code>[CONFIRMED]</code> Ветка обычного создания в корневом обработчике уходит в <code>handle_create(body)</code> без предшествующего <code>verify_token</code>. Возможная защита на уровне шлюза <code>[UNKNOWN]</code>.

### G8. База знаний и файлы тикета

```mermaid
flowchart TB
    subgraph TicketFile["Вложения тикета"]
        TF["Файл из браузера"] --> Base64["FileReader → base64"]
        Base64 --> Inline["POST upload-file"]
        Inline --> S3Put["функция → S3"]
        S3Put --> TUrl["URL CDN платформы"]
        TUrl --> Comment["API комментариев"]
        Comment --> AttachDB[("comment_attachments")]
    end

    subgraph KBFile["Файл базы знаний"]
        KF["Base64 из браузера"] --> KB["файлы api-knowledge-base"]
        KB --> Permission["токен + can_write"]
        Permission --> Put["S3 put_object"]
        Put --> KUrl["CDN_BASE + ключ объекта"]
        KUrl --> FileRow[("kb_article_files")]
        FileRow --> KResponse["id + URL"]
        Delete["DELETE строки файла"] --> FileRow
        Delete -.->|S3 delete не найден в ветви| Orphan["объект может остаться"]
    end

    AttachDB --> BrowserRead["GET браузера по URL CDN"]
    FileRow --> BrowserRead
```

Проверено по <code>src/hooks/useFileUploader.ts:26-99</code>, <code>backend/upload-file/index.py:69-164</code>, <code>backend/api-ticket-comments/index.py:551-566</code>, <code>backend/api-knowledge-base/index.py:439-485</code>.

<code>[CONFIRMED]</code> Активный загрузчик тикетов и KB передают base64 через функции. Универсальная точка API дополнительно умеет выдать подписанный URL для PUT (<code>backend/upload-file/index.py:95-129</code>), но его использование во frontend не найдено. KB DELETE удаляет строку DB; вызова удаления объекта S3 в этой ветви нет.

## H. Логическая карта DB

Это сокращённая карта доменных связей, а не полный DDL всех 265 миграций.

```mermaid
erDiagram
    USERS ||--o{ USER_ROLES : имеет
    ROLES ||--o{ USER_ROLES : назначена
    ROLES ||--o{ ROLE_PERMISSIONS : выдаёт
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : включено

    USERS ||--o{ TICKETS : создаёт_или_ведёт
    TICKET_STATUSES ||--o{ TICKETS : классифицирует
    TICKET_PRIORITIES ||--o{ TICKETS : задаёт_важность
    TICKET_CATEGORIES ||--o{ TICKETS : задаёт_категорию

    TICKETS ||--o{ TICKET_COMMENTS : содержит
    TICKET_COMMENTS ||--o{ COMMENT_ATTACHMENTS : имеет
    TICKETS ||--o{ TICKET_HISTORY : записывает
    TICKETS ||--o{ TICKET_WATCHERS : наблюдается
    TICKETS ||--o{ TICKET_VIEWS : просматривается
    TICKETS ||--o{ NOTIFICATIONS : вызывает

    TICKETS ||--o{ TICKET_TO_SERVICE_MAPPINGS : связывает
    TICKET_SERVICES ||--o{ TICKET_TO_SERVICE_MAPPINGS : выбрана
    TICKETS ||--o{ TICKET_CUSTOM_FIELD_VALUES : имеет
    TICKET_CUSTOM_FIELDS ||--o{ TICKET_CUSTOM_FIELD_VALUES : определяет

    EXECUTOR_GROUPS ||--o{ EXECUTOR_GROUP_MEMBERS : содержит
    USERS ||--o{ EXECUTOR_GROUP_MEMBERS : участвует
    EXECUTOR_GROUPS ||--o{ EXECUTOR_GROUP_SERVICE_MAPPINGS : обслуживает
    TICKET_SERVICES ||--o{ EXECUTOR_GROUP_SERVICE_MAPPINGS : сопоставлена

    KB_CATEGORIES ||--o{ KB_ARTICLES : группирует
    KB_ARTICLES ||--o{ KB_ARTICLE_FILES : имеет
    KB_ARTICLES ||--o{ KB_ARTICLE_COMMENTS : обсуждается
    KB_ARTICLES ||--o{ KB_ARTICLE_TAGS : помечается
    KB_TAGS ||--o{ KB_ARTICLE_TAGS : обозначает
    KB_ARTICLES ||--o{ KB_ARTICLE_TICKETS : связано
    TICKETS ||--o{ KB_ARTICLE_TICKETS : ссылается

    AUTOMATION_JOBS ||--o{ AUTOMATION_RUNS : создаёт
```

**Проверка по миграциям.** RBAC: <code>db_migrations/V0059__create_auth_system.sql:1-61</code>; тикеты/комментарии/дополнительные поля: <code>db_migrations/V0060__create_tickets_system.sql:1-80</code>; услуги: <code>db_migrations/V0064__create_services_tables.sql:1-35</code>; группы исполнителей: <code>db_migrations/V0112__create_executor_groups_tables.sql:1-32</code>; KB: <code>db_migrations/V0206__knowledge_base_foundation.sql:3-100</code>; автоматизация: <code>db_migrations/V0222__create_automation_jobs_and_runs.sql:1-49</code>.

<code>[CONFIRMED]</code> Связи упрощены до главных сущностей. Например, tickets имеет несколько ролей пользователя, SLA и согласования/наблюдатели добавлены поздними миграциями, а часть ранних таблиц переопределялась последующими файлами. Фактически применённый DDL рабочей среды <code>[UNKNOWN]</code>.

## Проверка самих диаграмм

Диаграммы сверены с:

- 40 маршрутами <code>src/App.tsx:74-113</code>;
- 43 записями реестра <code>backend/func2url.json:2-44</code>;
- 28 ветвями <code>api-tickets</code> в <code>backend/api-tickets/index.py:1606-1664</code>;
- хуками frontend основных потоков;
- корневыми <code>handler(event, context)</code> и прямыми межфункциональными вызовами;
- ключевыми миграциями и таблицами.

Ограничения:

1. Даже корректный синтаксис Mermaid не подтверждает связь среды исполнения; источником истины остаются указанные строки кода.
2. Стрелка к DB означает фактический доступ SQL, а не отдельную границу репозитория/сервиса.
3. Пунктирные рёбра планировщика/шлюза намеренно имеют статус <code>[UNKNOWN]</code>.
4. Вызовы ботов и часть внешних действий выполняются после фиксации DB; стрелки не означают общую транзакцию.
5. Диаграмма жизненного цикла не фиксирует названия/ID статусов без проверки начальных данных рабочей среды.
