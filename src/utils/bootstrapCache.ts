// Кеш справочников из bootstrap-запроса страницы «Мои заявки».
// Хранит только редко меняющиеся данные (статусы, приоритеты, категории,
// отделы, доп. поля, услуги, исполнители, заявители, группы), чтобы при
// открытии страницы мгновенно показать их из localStorage и не дёргать БД
// каждый раз. Заявки и счётчики НЕ кешируются — они всегда свежие.

const CACHE_KEY = 'tickets_bootstrap_dicts';
const TTL_MS = 5 * 60 * 1000; // 5 минут

export interface BootstrapDicts {
  dictionaries: Record<string, unknown>;
  ticket_services: unknown[];
  executors: unknown[];
  creators: unknown[];
  groups: unknown[];
  has_subordinates: boolean;
}

interface CachedEnvelope {
  ts: number;
  token: string;
  data: BootstrapDicts;
}

// Короткий отпечаток токена, чтобы кеш одного пользователя не подхватил другой.
const tokenFingerprint = (token: string): string => token.slice(-16);

export const readBootstrapCache = (token: string | null): BootstrapDicts | null => {
  if (!token) return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedEnvelope = JSON.parse(raw);
    if (parsed.token !== tokenFingerprint(token)) return null;
    if (Date.now() - parsed.ts > TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

export const writeBootstrapCache = (token: string | null, data: BootstrapDicts): void => {
  if (!token) return;
  try {
    const envelope: CachedEnvelope = {
      ts: Date.now(),
      token: tokenFingerprint(token),
      data,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(envelope));
  } catch {
    // localStorage переполнен/недоступен — просто не кешируем.
  }
};

export const clearBootstrapCache = (): void => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ничего не делаем
  }
};
