const AUTH_API = 'https://functions.poehali.dev/390bc680-77ff-4e34-a383-c92f6b67d723';
const GENERAL_API = 'https://functions.poehali.dev/adff2697-72f0-4316-9424-1f79ff8ed3cc';
const TICKETS_API = 'https://functions.poehali.dev/42feebee-e551-4872-901b-0512a2085c1a';
const COMPANIES_API = 'https://functions.poehali.dev/9ce1d908-bb39-4250-a1e3-8930ac0307de';
const DEPARTMENTS_API = 'https://functions.poehali.dev/b5550e9f-c621-44b8-b4e5-3128ed44acff';
const POSITIONS_API = 'https://functions.poehali.dev/176c438b-4080-43b6-b98d-21b4d7f54109';
const DEPT_POSITIONS_API = 'https://functions.poehali.dev/7c79f9e7-a51d-454b-b470-599ff9ed8527';
const FIELD_GROUPS_API = 'https://functions.poehali.dev/c481d806-6ef1-4d9e-bf34-8f6370a5554b';
const SERVICE_FIELD_MAPPINGS_API = 'https://functions.poehali.dev/bc96bbe3-687c-4427-86c7-6c6bb2b3e61b';
const EXECUTOR_GROUPS_API = 'https://functions.poehali.dev/a52eb50f-38cf-4887-aead-cc77f01ca416';
const EXECUTOR_ASSIGNMENTS_API = 'https://functions.poehali.dev/bb7f3193-fa1a-4243-b236-08b2795bd696';
const WORK_SCHEDULES_API = 'https://functions.poehali.dev/8db7a0da-8978-4e99-8d6b-45d47fc080c2';
const CLASSIFY_TICKET_API = 'https://functions.poehali.dev/b1d49417-fb02-4b11-9656-d30b68924b54';
const WATCHER_RULES_API = 'https://functions.poehali.dev/b6560f3c-5899-486e-83da-00fe16d0dd2f';
export const UPLOAD_FILE_URL = 'https://functions.poehali.dev/3d20e803-c39e-4d0f-84c2-6c5eb7bb1af7';
export const TICKETS_COUNTERS_URL = 'https://functions.poehali.dev/bcc93198-ef8f-4b7f-b1b7-25ed7616922c';
export const TICKETS_MARK_READ_URL = 'https://functions.poehali.dev/91bd6009-4bdd-4161-9e0d-ea3a03bf70c0';
export const USERS_SEARCH_URL = 'https://functions.poehali.dev/f8b49a39-1f3e-4195-9d9f-521b0cfca73d';

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
  'services': 'https://functions.poehali.dev/2cfd72d5-c228-4dc9-af9b-f592d65be207',
  'payments': 'https://functions.poehali.dev/42303a3a-efd9-4863-9d99-b41962f017dc',
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
const DISABLED_FUNCTION_IDS = new Set(['42303a3a-efd9-4863-9d99-b41962f017dc']);

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