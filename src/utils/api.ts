// Адреса backend-функций задаются в одном месте — src/config/backend.ts
import { FN } from '@/config/backend';

const AUTH_API = FN.AUTH;
const GENERAL_API = FN.GENERAL;
const TICKETS_API = FN.TICKETS;
const COMPANIES_API = FN.COMPANIES;
const DEPARTMENTS_API = FN.DEPARTMENTS;
const POSITIONS_API = FN.POSITIONS;
const DEPT_POSITIONS_API = FN.DEPT_POSITIONS;
const FIELD_GROUPS_API = FN.FIELD_GROUPS;
const SERVICE_FIELD_MAPPINGS_API = FN.SERVICE_FIELD_MAPPINGS;
const EXECUTOR_GROUPS_API = FN.EXECUTOR_GROUPS;
const EXECUTOR_ASSIGNMENTS_API = FN.EXECUTOR_ASSIGNMENTS;
const WORK_SCHEDULES_API = FN.WORK_SCHEDULES;
const CLASSIFY_TICKET_API = FN.CLASSIFY_TICKET;
const WATCHER_RULES_API = FN.WATCHER_RULES;
export const UPLOAD_FILE_URL = FN.UPLOAD_FILE;
export const TICKETS_COUNTERS_URL = FN.TICKETS_COUNTERS;
export const TICKETS_MARK_READ_URL = FN.TICKETS_MARK_READ;
export const USERS_SEARCH_URL = FN.USERS_SEARCH;

const ENDPOINT_MAP: Record<string, string> = {
  'login': AUTH_API,
  'me': AUTH_API,
  'refresh': AUTH_API,
  'users': GENERAL_API,
  'roles': GENERAL_API,
  'permissions': GENERAL_API,
  'user-permissions': GENERAL_API,
  'categories': GENERAL_API,
  'contractors': GENERAL_API,
  'legal_entities': GENERAL_API,
  'customer_departments': GENERAL_API,
  'system_settings': GENERAL_API,
  'notification_templates': GENERAL_API,
  'tickets': TICKETS_API,
  'tickets-full': TICKETS_API,
  'tickets-bootstrap': TICKETS_API,
  'tickets-created-stats': TICKETS_API,
  'tickets-rating-stats': TICKETS_API,
  'dashboard-ops': TICKETS_API,
  'dashboard-sla': TICKETS_API,
  'dashboard-services': TICKETS_API,
  'dashboard-team': TICKETS_API,
  'api-tickets': TICKETS_API,
  'service_categories': TICKETS_API,
  'ticket-dictionaries-api': TICKETS_API,
  'ticket_services': TICKETS_API,
  'ticket_service_mappings': TICKETS_API,
  'ticket-statuses': TICKETS_API,
  'ticket-priorities': TICKETS_API,
  'sla': TICKETS_API,
  'sla-service-mappings': TICKETS_API,
  'sla-group-budgets': TICKETS_API,
  'sla-priority-times': TICKETS_API,
  'sla-analytics': TICKETS_API,
  'ticket-approvals': TICKETS_API,
  'ticket-confirmation': TICKETS_API,
  'ticket-watchers': TICKETS_API,
  'ticket-access-checklist': TICKETS_API,
  'access-checklist-services': TICKETS_API,
  'response-control': TICKETS_API,
  'status-notify-operators': TICKETS_API,
  'services': FN.SERVICES,
  'payments': FN.PAYMENTS,
  'companies': COMPANIES_API,
  'departments': DEPARTMENTS_API,
  'positions': POSITIONS_API,
  'department-positions': DEPT_POSITIONS_API,
  'field-groups': FIELD_GROUPS_API,
  'service-field-mappings': SERVICE_FIELD_MAPPINGS_API,
  'executor-groups': EXECUTOR_GROUPS_API,
  'executor-assignments': EXECUTOR_ASSIGNMENTS_API,
  'work-schedules': WORK_SCHEDULES_API,
  'watcher-rules': WATCHER_RULES_API,
};

export const API_URL = AUTH_API;
export const FIELD_GROUPS_URL = FIELD_GROUPS_API;
export const SERVICE_FIELD_MAPPINGS_URL = SERVICE_FIELD_MAPPINGS_API;
export const CLASSIFY_TICKET_URL = CLASSIFY_TICKET_API;

export const getApiUrl = (endpoint?: string): string => {
  if (endpoint && ENDPOINT_MAP[endpoint]) {
    return ENDPOINT_MAP[endpoint];
  }
  return AUTH_API;
};

const getAuthToken = (): string | null => {
  const rememberMe = localStorage.getItem('remember_me') === 'true';
  return rememberMe 
    ? localStorage.getItem('auth_token')
    : sessionStorage.getItem('auth_token');
};

// 500 включён в список ретраев потому что PostgreSQL под нагрузкой
// отдаёт rate-limit ошибки, которые backend-функции конвертируют в 500.
// Короткая пауза + повтор обычно решает проблему.
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);
const MAX_RETRY_ATTEMPTS = 2;
// Задержки между попытками: 1с (затем 2с). Меньше попыток и пауз,
// чтобы зависший/таймаутящий запрос не держал интерфейс на десятки секунд.
const RETRY_DELAYS_MS = [1000, 2000];

const DISABLED_ENDPOINTS = new Set(['payments']);
// Берём хвост адреса из конфига, чтобы при смене хоста список не «протух».
const DISABLED_FUNCTION_IDS = new Set(
  [FN.PAYMENTS.split('/').filter(Boolean).pop()].filter(Boolean) as string[],
);

const isDisabledUrl = (url: string): boolean => {
  if (!url) return false;
  if (url.startsWith('/')) {
    const parts = url.split('?');
    const pathParts = parts[0].split('/').filter(Boolean);
    if (pathParts[0] && DISABLED_ENDPOINTS.has(pathParts[0])) return true;
  }
  for (const id of DISABLED_FUNCTION_IDS) {
    if (url.includes(id)) return true;
  }
  try {
    const u = new URL(url, 'https://placeholder.local');
    const endpoint = u.searchParams.get('endpoint');
    if (endpoint && DISABLED_ENDPOINTS.has(endpoint)) return true;
  } catch {
    // ignore
  }
  return false;
};

const makeStubResponse = (): Response => {
  return new Response(JSON.stringify([]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

type CacheEntry = { data: unknown; expiresAt: number };
const responseCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

export const cachedJsonFetch = async <T = unknown>(
  url: string,
  options: RequestInit = {},
  ttlMs: number = 5 * 60 * 1000,
): Promise<T> => {
  const key = url;
  const now = Date.now();
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    try {
      const resp = await apiFetch(url, options);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      responseCache.set(key, { data, expiresAt: Date.now() + ttlMs });
      return data;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);
  return promise as Promise<T>;
};

export const invalidateCache = (urlSubstring?: string) => {
  if (!urlSubstring) {
    responseCache.clear();
    return;
  }
  for (const k of Array.from(responseCache.keys())) {
    if (k.includes(urlSubstring)) responseCache.delete(k);
  }
};

const isRetryableMethod = (method?: string): boolean => {
  const m = (method || 'GET').toUpperCase();
  return m === 'GET' || m === 'HEAD';
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  if (isDisabledUrl(url)) {
    return makeStubResponse();
  }

  const token = getAuthToken();
  
  const headers: HeadersInit = {
    ...options.headers,
  };
  
  if (token) {
    headers['X-Auth-Token'] = token;
  }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let finalUrl = url;
  
  if (url.startsWith('/')) {
    const parts = url.split('?');
    const pathParts = parts[0].split('/').filter(Boolean);
    const endpoint = pathParts[0];
    const queryString = parts[1] || '';
    
    if (ENDPOINT_MAP[endpoint]) {
      const baseUrl = ENDPOINT_MAP[endpoint];
      
      if (pathParts.length > 1) {
        const id = pathParts[1];
        finalUrl = queryString 
          ? `${baseUrl}?id=${id}&${queryString}`
          : `${baseUrl}?id=${id}`;
      } else {
        finalUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;
      }
    }
  } else {
    try {
      const urlObj = new URL(url);
      const endpoint = urlObj.searchParams.get('endpoint');
      
      if (endpoint && ENDPOINT_MAP[endpoint]) {
        const newBase = ENDPOINT_MAP[endpoint];
        finalUrl = newBase + urlObj.search;
      }
    } catch (e) {
      console.error('[API] URL parsing error:', e);
    }
  }

  const fetchInit: RequestInit = {
    ...options,
    headers,
  };

  const canRetry = isRetryableMethod(options.method) && !options.signal?.aborted;

  if (!canRetry) {
    return fetch(finalUrl, fetchInit);
  }

  let lastResponse: Response | null = null;
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    if (options.signal?.aborted) {
      return fetch(finalUrl, fetchInit);
    }
    const response = await fetch(finalUrl, fetchInit);
    if (!RETRYABLE_STATUSES.has(response.status)) {
      return response;
    }
    lastResponse = response;
    if (attempt < MAX_RETRY_ATTEMPTS) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 4000;
      await sleep(delay);
    }
  }
  return lastResponse as Response;
};