# Промпт для Codex: архитектурный анализ и план постепенной миграции с Poekhali

## Цель

Проведи глубокий архитектурный анализ проекта и подготовь практический план постепенной миграции backend/serverless-инфраструктуры с Poekhali на нашу собственную инфраструктуру.

Нужно не просто описать текущую систему, а:
- подтвердить реальную архитектуру по коду;
- найти реальные риски миграции;
- предложить переходную архитектуру, где Poekhali и наша инфраструктура временно работают одновременно;
- определить, как построить «мост» между ними;
- найти проблемы, о которых мы ещё не подумали;
- дать практический порядок действий, сроки и человеко-часы.

---

# 1. Источники

Изучи проект целиком, особенно:

- `backend/`
- `src/`
- `backend/func2url.json`
- общие utility-модули
- конфигурацию
- SQL/PostgreSQL
- JWT/auth
- межфункциональные HTTP-вызовы
- cron/scheduler/automation
- Bitrix и другие внешние интеграции
- frontend API routing
- архитектурную документацию
- `audit/notes/`

## Важно про audit

В `audit/` есть raw-результаты Semgrep, SonarQube, Ruff, jscpd, Lizard, OSV, Gitleaks и т.п.

**Не загружай целиком raw JSON/отчёты в контекст**, если соответствующее резюме уже есть в `audit/notes/`.

Используй `audit/notes/` как основной источник результатов аудита. Raw-файлы открывай только точечно для проверки конкретных спорных утверждений.

---

# 2. Проверь текущую архитектуру

Самостоятельно подтверди или опровергни:

- frontend — React/Vite SPA;
- backend состоит из Python serverless-функций;
- функции выполняются на Poekhali;
- URL из `backend/func2url.json` соответствуют endpoint'ам Poekhali;
- Python-код в `backend/<function>/` является исходным кодом соответствующих функций;
- функции используют PostgreSQL;
- несколько функций работают с общей БД/схемой;
- между функциями есть прямые HTTP-вызовы;
- frontend может обращаться напрямую к функциям;
- существует общий JWT/auth-контракт;
- `api-tickets` — крупный логический центр;
- `create-employee-account` — крупный интеграционный узел;
- `automation-dispatcher` вызывает другие функции;
- система имеет признаки distributed monolith.

Для каждого важного утверждения используй:

- `[CONFIRMED]`
- `[INFERRED]`
- `[UNKNOWN]`

Приводи `file.py:line`.

---

# 3. Главная задача: переходный мост Poekhali → наша инфраструктура

Спроектируй безопасную архитектуру постепенного переноса.

Базовая идея:

```text
                         Internet
                            |
                            v
                     +-------------+
                     | API Gateway |
                     +------+------+
                            |
              +-------------+-------------+
              |                           |
              v                           v
        +-----------+               +-----------+
        | Poekhali  |               | Our infra |
        +-----+-----+               +-----+-----+
              |                           |
              +-------------+-------------+
                            |
                            v
                       PostgreSQL
```

Но **не считай эту схему правильной автоматически**.

Рассмотри минимум:

### Вариант A
Gateway → Poekhali / Our infrastructure

### Вариант B
Gateway → migration/router layer → Poekhali / Our infrastructure

### Вариант C
Gateway постепенно заменяет endpoint за endpoint'ом.

### Вариант D
Reverse proxy перед существующими Poekhali endpoint'ами.

### Вариант E
Другой вариант, который ты считаешь лучшим.

Для каждого:
- схема работы;
- routing;
- миграция endpoint;
- rollback;
- плюсы;
- минусы;
- риски;
- сложность.

Выбери рекомендуемый вариант.

---

# 4. API Gateway

Определи:

- где его разместить;
- что он принимает;
- как маршрутизирует;
- где хранить routing table;
- как помечать migrated/not migrated;
- как передавать JWT;
- как передавать headers;
- CORS;
- timeout;
- retry;
- 4xx/5xx;
- health checks;
- request/correlation ID;
- logging;
- metrics;
- rate limiting;
- security;
- rollback.

Отдельно сравни:

- Nginx;
- Traefik;
- HAProxy;
- небольшой собственный router;
- полноценный API Gateway.

Ответь, нужен ли вообще полноценный gateway или на первом этапе достаточно reverse proxy.

---

# 5. PostgreSQL

Это критически важная часть анализа.

Если переносим одну функцию на наши серверы:

- может ли она продолжить использовать PostgreSQL Poekhali?
- нужно ли сразу переносить БД?
- как организовать сетевой доступ?
- нужно ли VPN/private network?
- насколько вырастет latency?
- что будет с connection pooling?
- транзакциями?
- concurrent access?
- timeouts?
- отказом связи?

Затем исследуй варианты переноса БД:

- streaming replication;
- logical replication;
- CDC;
- read replica;
- dual-write;
- постепенный cutover;
- primary/standby.

Объясни, почему опасен простой dual-write без специальной стратегии.

---

# 6. Dependency Graph

Построй карту зависимостей backend.

Для каждой функции по возможности определить:

- кто вызывает её;
- кого вызывает она;
- какие таблицы читает;
- какие таблицы пишет;
- какие внешние API использует;
- env variables;
- auth;
- критичность;
- можно ли переносить независимо.

Особенно найди:

- циклические зависимости;
- DB coupling;
- hardcoded Poekhali URLs;
- функции, которые после переноса будут зависеть от старых функций;
- функции, которые образуют естественные migration groups.

Сделай Mermaid/ASCII dependency graph.

---

# 7. Критический переходный сценарий

Проанализируй ситуацию:

```text
Frontend
   |
Gateway
   |
   +--> Our function-A
   |
   +--> Poekhali function-B
   |
   +--> Poekhali function-C
```

И:

```text
Our function-A
       |
       +--> Poekhali function-B
```

Ответь:

- допустима ли такая схема;
- нужно ли backend-to-backend traffic направлять через gateway;
- нужен ли отдельный internal service routing;
- как убрать hardcoded Poekhali URLs;
- нужен ли service discovery;
- как переключать target;
- как сделать rollback.

---

# 8. Distributed Systems Risks

Отдельно исследуй:

- partial failure;
- network partition;
- retries;
- duplicate requests;
- idempotency;
- duplicate side effects;
- race conditions;
- distributed transactions;
- eventual consistency;
- ordering;
- timeout propagation;
- cascading failures;
- circuit breakers;
- bulkheads;
- queues;
- locks;
- cron duplication.

Особенно ответь:

> Что произойдёт, если одна и та же автоматизация случайно одновременно будет выполняться на Poekhali и нашей инфраструктуре?

---

# 9. Auth / Security

Проверь:

- JWT;
- secrets;
- service-to-service auth;
- frontend → gateway;
- gateway → backend;
- backend → backend;
- backend → external APIs.

Предложи target-схему.

Отдельно:
- достаточно ли существующего JWT;
- нужен ли internal service token;
- где хранить секреты;
- как ротировать;
- как не доверять публичным endpoint'ам.

---

# 10. Конфигурация

Найди:

- hardcoded URLs;
- Poekhali URLs;
- DB strings;
- API keys;
- external endpoints;
- cron;
- callbacks;
- feature flags.

Предложи механизм вроде:

```text
FUNCTION_A_TARGET=our
FUNCTION_B_TARGET=poekhali
```

или лучший вариант.

---

# 11. Observability

Определи минимальный набор, который надо иметь **до первого production cutover**:

- structured logs;
- request ID;
- correlation ID;
- metrics;
- latency;
- error rate;
- dependency latency;
- retries;
- timeouts;
- health checks;
- tracing.

Нужно уметь увидеть полный путь:

```text
request abc123
  ↓
Gateway
  ↓
function-A [OUR]
  ↓
function-B [POEKHALI]
  ↓
PostgreSQL
```

---

# 12. Security audit

Используя `audit/notes/`, проверь:

- SQL injection;
- secrets;
- TLS verification;
- SSRF;
- auth bypass;
- CORS;
- exposed endpoints;
- service-to-service trust;
- public DB;
- logging sensitive data.

Не считай выводы автоматических сканеров абсолютной истиной: важные выводы проверь по исходникам.

---

# 13. Какую функцию переносить первой

Составь ranking.

Критерии:

- количество зависимостей;
- критичность;
- сложность;
- DB coupling;
- внешние API;
- количество вызывающих;
- количество вызываемых;
- rollback;
- ущерб при ошибке;
- observability.

Выдай:

1. лучшего кандидата;
2. 3–5 альтернатив;
3. что нельзя брать первым;
4. что оставить напоследок.

---

# 14. Пошаговый migration roadmap

Составь конкретный план.

## Этап 0 — inventory

- функции;
- зависимости;
- API contracts;
- DB;
- secrets;
- env;
- внешние интеграции.

## Этап 1 — инфраструктура

- серверы;
- Docker;
- reverse proxy/gateway;
- TLS;
- logging;
- monitoring;
- deployment;
- доступ к PostgreSQL.

## Этап 2 — migration layer

- routing;
- Poekhali adapter;
- our backend adapter;
- feature flags;
- rollback.

## Этап 3 — первая функция

- deploy;
- config;
- auth;
- DB;
- dependencies;
- tests;
- cutover;
- monitoring;
- rollback.

## Этап 4 — группы функций

Переносить согласно dependency graph.

## Этап 5 — DB

Опиши, когда и как переносить PostgreSQL.

## Этап 6 — отключение Poekhali

Критерии готовности и порядок выключения.

Скорректируй этот roadmap согласно фактической архитектуре.

---

# 15. Rollback

Для каждого этапа опиши:

```text
Failure
  ↓
traffic → old implementation
  ↓
verify
  ↓
rollback complete
```

Учти:
- уже изменённые данные;
- DB migrations;
- schema compatibility;
- side effects;
- внешние API;
- повторные запросы.

---

# 16. Что мы забыли?

Отдельный раздел:

# Проблемы, о которых мы ещё не подумали

Самостоятельно найди минимум 10 дополнительных рисков.

Особенно проверь:

- DNS;
- TLS/certificates;
- secrets;
- cron;
- webhooks;
- callback URLs;
- CORS;
- IP allowlists;
- Bitrix;
- email;
- ISPmanager;
- storage;
- cache;
- sessions;
- JWT;
- timezones;
- background jobs;
- rate limits;
- vendor-specific behavior;
- deployment;
- rollback;
- monitoring;
- data consistency.

---

# 17. Оценка сроков и человеко-часов

Оцени диапазонами:

- migration bridge;
- gateway;
- первая функция;
- 5 функций;
- 20 функций;
- полный migration.

Разбей:
- architecture;
- infrastructure;
- gateway;
- CI/CD;
- observability;
- security;
- DB;
- backend migration;
- testing;
- frontend;
- documentation;
- operations.

Не создавай ложную точность. Для каждой оценки укажи assumptions.

---

# 18. Target Architecture

Сделай минимум:

1. общую архитектурную диаграмму;
2. backend dependency graph;
3. migration topology;
4. request flow;
5. DB topology;
6. rollback flow.

Используй Mermaid, где это уместно.

---

# 19. Финальный verdict

Ответь прямо:

1. Является ли система distributed monolith?
2. Главная ли проблема — shared DB?
3. Нужен ли API Gateway до начала миграции?
4. Нужно ли сначала переносить БД?
5. Можно ли перенести одну функцию, оставив DB на Poekhali?
6. Может ли функция на нашей инфраструктуре вызывать Poekhali-функцию?
7. Должен ли backend-to-backend traffic идти через gateway?
8. Какую функцию переносить первой?
9. Что нельзя переносить первым?
10. Какой минимальный production stack нужен для первой функции?
11. Какую migration architecture выбрать?
12. Какие 5 рисков наиболее опасны?
13. Что обязательно сделать до первого production cutover?

---

# Формат результата

```text
01. Executive Summary
02. Current Architecture
03. Confirmed / Inferred / Unknown
04. Dependency Graph
05. Migration Risks
06. API Gateway Options
07. Recommended Gateway Architecture
08. PostgreSQL Strategy
09. Network & Distributed Systems Risks
10. Auth & Security
11. Observability
12. Migration Strategy
13. First Function Selection
14. Rollback Strategy
15. Problems We Haven't Considered
16. Timeline & Person-Hours
17. Target Architecture
18. First 30/60/90 Days
19. Final Verdict
20. Open Questions
```

## Требования к достоверности

Для важных утверждений указывай `file.py:line`.

Используй метки:

- `[CONFIRMED]`
- `[INFERRED]`
- `[UNKNOWN]`
- `[RISK]`
- `[RECOMMENDATION]`

Не выдавай предположение за факт.

Если исходники не позволяют доказать утверждение — прямо напиши `[UNKNOWN]`.

Главное: **не просто опиши проект. Спроектируй безопасный переходный период между Poekhali и нашей инфраструктурой и найди проблемы, возникающие именно из-за одновременной работы двух инфраструктур.**
