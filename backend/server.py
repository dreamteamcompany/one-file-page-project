"""HTTP-адаптер для запуска serverless-функций вне платформы vendor-а."""

import importlib.util
import json
import os
import pathlib
import sys
from typing import Any

import psycopg2
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response


BACKEND = pathlib.Path(__file__).resolve().parent
EXPECTED_HANDLERS = int(os.environ.get("EXPECTED_HANDLERS", "43"))
EXPECTED_TABLES = int(os.environ.get("EXPECTED_TABLES", "102"))
DATABASE_URL = os.environ.get("DATABASE_URL", "")
MAIN_DB_SCHEMA = os.environ.get(
    "MAIN_DB_SCHEMA", "t_p67567221_one_file_page_projec"
)

app = FastAPI(title="DreamDesk compatibility API", docs_url=None, redoc_url=None)

allowed_origins = [
    value.strip()
    for value in os.environ.get(
        "ALLOWED_ORIGINS", "http://127.0.0.1:4173,http://localhost:4173"
    ).split(",")
    if value.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

handlers: dict[str, Any] = {}
load_errors: dict[str, str] = {}
uuid_aliases: dict[str, str] = {}

with (BACKEND / "func2url.json").open(encoding="utf-8") as registry_file:
    for function_name, function_url in json.load(registry_file).items():
        uuid_aliases[function_url.rstrip("/").rsplit("/", 1)[-1]] = function_name

# Во frontend сохранились три более новых UUID, которых нет в func2url.json.
uuid_aliases.update(
    {
        "acbb6915-96bf-4e7f-ab66-c34c3fa4b26c": "collect-logs",
        "cc67e884-8946-4bcd-939d-ea3c195a6598": "push-notifications",
        "dd221a88-cc33-4a30-a59f-830b0a41862f": "log-analyzer",
    }
)

# Эти адреса используются frontend, но соответствующих каталогов backend в
# репозитории нет. Отдельный список позволяет отличить отсутствие исходника от
# опечатки в URL.
missing_source_aliases = {
    "8f2170d4-9167-4354-85a1-4478c2403dfd": "finance",
    "5977014b-b187-49a2-8bf6-4ffb51e2aaeb": "dashboard-layout",
    "a0000b1e-3d3e-4094-b08e-2893df500d3f": "planned-payments",
    "20167b17-c827-4e24-b1a1-2ca1571d5bab": "category-payments",
    "b79dfca0-9f01-41a8-92bb-7a6d9212d2f1": "approved-payment-details",
    "465f29bc-7031-4a0b-a671-05368d234efe": "payment-form",
    "eeefc720-2351-43cd-804d-44fbd748ab8f": "scheduled-payments",
    "42303a3a-efd9-4863-9d99-b41962f017dc": "payments",
}

missing_source_endpoints = {
    "stats": "finance",
    "payments": "payments",
    "approvals": "finance",
    "planned-payments": "planned-payments",
    "saving-reasons": "finance",
    "savings": "finance",
    "audit-logs": "finance",
    "comments": "finance payment comments",
    "comment-likes": "finance payment comments",
    "comment-reactions": "legacy comment reactions",
}

# Старые и уже закешированные frontend-сборки строят часть запросов от UUID
# функции auth и передают настоящую операцию в `?endpoint=...`. Платформенный
# frontend-маршрутизатор должен выбирать нужную функцию, но локальная сборка до
# исправления могла этого не сделать. Этот слой совместимости не меняет API и
# защищает основные справочники и заявки от ошибочного вызова auth.
AUTH_ENDPOINT_ROUTES = {
    **{
        endpoint: "api-general"
        for endpoint in (
            "users",
            "roles",
            "permissions",
            "user-permissions",
            "categories",
            "contractors",
            "legal_entities",
            "legal-entities",
            "customer_departments",
            "system_settings",
            "notification_templates",
        )
    },
    **{
        endpoint: "api-tickets"
        for endpoint in (
            "tickets",
            "tickets-full",
            "tickets-bootstrap",
            "tickets-created-stats",
            "tickets-rating-stats",
            "dashboard-ops",
            "dashboard-sla",
            "dashboard-services",
            "dashboard-team",
            "escalation-tickets",
            "service_categories",
            "ticket-dictionaries-api",
            "ticket_services",
            "ticket_service_mappings",
            "ticket-statuses",
            "ticket-priorities",
            "sla",
            "sla-service-mappings",
            "sla-group-budgets",
            "sla-priority-times",
            "sla-analytics",
            "ticket-approvals",
            "ticket-confirmation",
            "ticket-watchers",
            "ticket-access-checklist",
            "access-checklist-services",
            "response-control",
            "status-notify-operators",
        )
    },
    "services": "api-services",
    "companies": "companies",
    "departments": "departments",
    "positions": "positions",
    "department-positions": "department-positions",
    "field-groups": "api-field-groups",
    "custom-fields": "api-field-groups",
    "service-field-mappings": "api-service-field-mappings",
    "executor-groups": "api-executor-groups",
    "executor-assignments": "api-executor-assignments",
    "work-schedules": "api-work-schedules",
    "watcher-rules": "api-watcher-rules",
}


def is_backend_module(module: Any) -> bool:
    paths: list[str] = []
    file_path = getattr(module, "__file__", None)
    if file_path:
        paths.append(file_path)
    paths.extend(getattr(module, "__path__", ()) or ())
    for raw_path in paths:
        try:
            pathlib.Path(raw_path).resolve().relative_to(BACKEND)
            return True
        except (OSError, ValueError):
            pass
    return False


def purge_function_dependencies() -> None:
    """Не даёт одноимённым utils/config разных функций смешаться в sys.modules."""
    for module_name, module in list(sys.modules.items()):
        if module_name == __name__ or module_name.startswith("fn_"):
            continue
        if module is not None and is_backend_module(module):
            sys.modules.pop(module_name, None)


for function_dir in sorted(BACKEND.iterdir()):
    entry = function_dir / "index.py"
    if not entry.is_file():
        continue
    purge_function_dependencies()
    original_path = list(sys.path)
    try:
        sys.path.insert(0, str(function_dir))
        module_name = f"fn_{function_dir.name.replace('-', '_')}"
        spec = importlib.util.spec_from_file_location(module_name, entry)
        if spec is None or spec.loader is None:
            raise ImportError(f"cannot create import spec for {entry}")
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        handlers[function_dir.name] = module.handler
    except Exception as exc:  # noqa: BLE001 — ошибка должна попасть в /health
        load_errors[function_dir.name] = f"{type(exc).__name__}: {exc}"
    finally:
        sys.path[:] = original_path


class Context:
    request_id = "docker-local"


def database_health() -> tuple[bool, str]:
    if not DATABASE_URL:
        return False, "DATABASE_URL is not configured"
    try:
        with psycopg2.connect(DATABASE_URL, connect_timeout=3) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT count(*)
                    FROM information_schema.tables
                    WHERE table_schema = %s AND table_type = 'BASE TABLE'
                    """,
                    (MAIN_DB_SCHEMA,),
                )
                table_count = int(cursor.fetchone()[0])
        if table_count != EXPECTED_TABLES:
            return False, f"expected {EXPECTED_TABLES} tables, found {table_count}"
        return True, "ok"
    except Exception as exc:  # noqa: BLE001 — текст нужен для диагностики готовности
        return False, f"{type(exc).__name__}: {exc}"


@app.get("/health")
def health() -> JSONResponse:
    db_ok, db_status = database_health()
    handlers_ok = len(handlers) == EXPECTED_HANDLERS and not load_errors
    payload = {
        "status": "ok" if db_ok and handlers_ok else "error",
        "database": db_status,
        "loaded_handlers": len(handlers),
        "expected_handlers": EXPECTED_HANDLERS,
        "load_errors": load_errors,
    }
    return JSONResponse(payload, status_code=200 if db_ok and handlers_ok else 503)


@app.api_route(
    "/api/{name}{rest:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def call(name: str, rest: str, request: Request) -> Response:
    requested_function = uuid_aliases.get(name, name)
    endpoint = request.query_params.get("endpoint", "")
    if requested_function == "auth" and endpoint in missing_source_endpoints:
        return JSONResponse(
            {
                "error": "Исходник endpoint отсутствует в репозитории",
                "function": missing_source_endpoints[endpoint],
                "endpoint": endpoint,
            },
            status_code=501,
        )
    if requested_function == "auth" and endpoint in AUTH_ENDPOINT_ROUTES:
        requested_function = AUTH_ENDPOINT_ROUTES[endpoint]
    function = handlers.get(requested_function)
    if function is None:
        missing_name = missing_source_aliases.get(name)
        if missing_name:
            return JSONResponse(
                {
                    "error": "Исходник endpoint отсутствует в репозитории",
                    "function": missing_name,
                },
                status_code=501,
            )
        return JSONResponse(
            {"error": "Неизвестная backend-функция", "function": requested_function},
            status_code=404,
        )

    body = (await request.body()).decode("utf-8", "replace")
    event = {
        "httpMethod": request.method,
        "headers": dict(request.headers),
        "queryStringParameters": dict(request.query_params),
        "body": body,
        "pathParams": {"path": rest},
        "isBase64Encoded": False,
        "requestContext": {
            "identity": {"sourceIp": request.client.host if request.client else ""}
        },
    }

    try:
        result = function(event, Context())
    except Exception as exc:  # noqa: BLE001 — сохраняем контракт адаптера
        return JSONResponse(
            {
                "error": f"{type(exc).__name__}: {exc}",
                "function": requested_function,
            },
            status_code=500,
        )

    if not isinstance(result, dict):
        return JSONResponse(
            {"error": "Обработчик вернул ответ неизвестного формата"},
            status_code=500,
        )
    payload = result.get("body", "")
    if not isinstance(payload, str):
        payload = json.dumps(payload, ensure_ascii=False)
    return Response(
        status_code=result.get("statusCode", 200),
        content=payload,
        headers=result.get("headers", {}),
    )
