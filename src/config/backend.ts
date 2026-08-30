/**
 * ЕДИНАЯ ТОЧКА НАСТРОЙКИ АДРЕСОВ BACKEND.
 *
 * При переносе проекта на свой хост правьте ТОЛЬКО этот файл.
 * Раньше адреса были разбросаны по 27 файлам (65 мест) — теперь все здесь.
 *
 * Вариант 1 (быстрый). Если ваш сервер отдаёт функции по тем же путям,
 * задайте в .env одну переменную — и всё:
 *     VITE_FUNCTIONS_BASE=https://api.mycompany.ru
 *
 * Вариант 2 (полный). Замените значения в FUNCTION_IDS ниже на свои пути,
 * например: TICKETS: 'tickets', COMMENTS: 'ticket-comments'.
 *
 * Отдельный адрес можно переопределить точечно, не трогая остальные:
 *     VITE_FN_TICKETS=https://api.mycompany.ru/v2/tickets
 */

/** Базовый адрес, на котором развёрнуты backend-функции. */
export const FUNCTIONS_BASE: string =
  import.meta.env.VITE_FUNCTIONS_BASE || 'https://functions.poehali.dev';

/**
 * Идентификаторы (или пути) функций.
 * Ключ — понятное имя, значение — то, что подставляется после базового адреса.
 */
const FUNCTION_IDS = {
  /** Авторизация: вход, текущий пользователь, обновление токена */
  AUTH: '390bc680-77ff-4e34-a383-c92f6b67d723',
  /** Общий справочник: пользователи, роли, права, настройки, шаблоны */
  GENERAL: 'adff2697-72f0-4316-9424-1f79ff8ed3cc',
  /** Заявки: список, дашборды, статусы, приоритеты, SLA */
  TICKETS: '42feebee-e551-4872-901b-0512a2085c1a',
  /** Комментарии к заявкам */
  TICKET_COMMENTS: '5de559ba-3637-4418-aea0-26c373f191c3',
  /** История изменений заявки */
  TICKET_HISTORY: '429bf640-f15c-4a4f-b791-a7437061ba87',
  /** Массовые операции над заявками */
  BULK_TICKETS: '582ca427-5c6d-4995-b1b5-f4f206c12a07',
  /** Счётчики заявок */
  TICKETS_COUNTERS: 'bcc93198-ef8f-4b7f-b1b7-25ed7616922c',
  /** Отметка заявок прочитанными */
  TICKETS_MARK_READ: '91bd6009-4bdd-4161-9e0d-ea3a03bf70c0',
  /** Автоклассификация заявки */
  CLASSIFY_TICKET: 'b1d49417-fb02-4b11-9656-d30b68924b54',
  /** Правила наблюдателей */
  WATCHER_RULES: 'b6560f3c-5899-486e-83da-00fe16d0dd2f',
  /** Услуги */
  SERVICES: '2cfd72d5-c228-4dc9-af9b-f592d65be207',
  /** Компании */
  COMPANIES: '9ce1d908-bb39-4250-a1e3-8930ac0307de',
  /** Отделы */
  DEPARTMENTS: 'b5550e9f-c621-44b8-b4e5-3128ed44acff',
  /** Должности */
  POSITIONS: '176c438b-4080-43b6-b98d-21b4d7f54109',
  /** Связка отдел—должность */
  DEPT_POSITIONS: '7c79f9e7-a51d-454b-b470-599ff9ed8527',
  /** Группы дополнительных полей */
  FIELD_GROUPS: 'c481d806-6ef1-4d9e-bf34-8f6370a5554b',
  /** Сопоставление полей и услуг */
  SERVICE_FIELD_MAPPINGS: 'bc96bbe3-687c-4427-86c7-6c6bb2b3e61b',
  /** Группы исполнителей */
  EXECUTOR_GROUPS: 'a52eb50f-38cf-4887-aead-cc77f01ca416',
  /** Назначение исполнителей */
  EXECUTOR_ASSIGNMENTS: 'bb7f3193-fa1a-4243-b236-08b2795bd696',
  /** Графики работы */
  WORK_SCHEDULES: '8db7a0da-8978-4e99-8d6b-45d47fc080c2',
  /** Поиск пользователей */
  USERS_SEARCH: 'f8b49a39-1f3e-4195-9d9f-521b0cfca73d',
  /** Загрузка файлов */
  UPLOAD_FILE: '3d20e803-c39e-4d0f-84c2-6c5eb7bb1af7',
  /** Создание учётной записи сотрудника */
  CREATE_ACCOUNT: '30868c2a-0677-4a5e-b668-e78c5d7f918a',
  /** Шаблоны ответов */
  REPLY_TEMPLATES: 'e8c6cf6d-aedc-4045-a4ba-aa51437849c1',
  /** База знаний */
  KNOWLEDGE_BASE: '4927dd34-be70-4780-94dd-35622fc7d8fd',
  /** Настройки автоматизации */
  AUTOMATION: '2aacfd88-8589-4d6e-ace1-540fb6324434',
  /** Обучение классификатора */
  AI_TRAINING: '1c8f10ba-1def-440e-b5b8-b36840076c65',
  /** Улучшение текста комментария */
  IMPROVE_COMMENT: '1af31b9b-b0f5-4104-9def-0de1fcd0d53d',

  /** Авторизация через Битрикс24 */
  BITRIX_AUTH: '1ba4ba6c-50e0-4458-b7e4-4464ffcff093',
  /** Синхронизация отделов из Битрикс24 */
  BITRIX_SYNC_DEPARTMENTS: '1f366079-778d-425e-a0ba-378f356dceae',
  /** Синхронизация должностей из Битрикс24 */
  BITRIX_SYNC_POSITIONS: '554d2115-1c37-4955-b544-bc0a5df0b466',
  /** Синхронизация руководителей из Битрикс24 */
  BITRIX_SYNC_HEADS: 'd76a8ec5-152f-427f-802c-ebf292c0f3e8',
  /** Неактивные пользователи Битрикс24 */
  BITRIX_INACTIVE_USERS: '7bf1dc65-32dd-447a-a33e-8b1a7bed5b07',

  /** Анализатор логов */
  LOG_ANALYZER: 'dd221a88-cc33-4a30-a59f-830b0a41862f',
  /** Сбор логов */
  COLLECT_LOGS: 'acbb6915-96bf-4e7f-ab66-c34c3fa4b26c',
  /** Push-уведомления (подписка) */
  PUSH_NOTIFICATIONS: 'cc67e884-8946-4bcd-939d-ea3c195a6598',

  /** Финансовый модуль: подрядчики, согласования, экономия, категории */
  FINANCE: '8f2170d4-9167-4354-85a1-4478c2403dfd',
  /** Раскладка дашборда */
  DASHBOARD_LAYOUT: '5977014b-b187-49a2-8bf6-4ffb51e2aaeb',
  /** Плановые платежи */
  PLANNED_PAYMENTS: 'a0000b1e-3d3e-4094-b08e-2893df500d3f',
  /** Платежи по категории */
  CATEGORY_PAYMENTS: '20167b17-c827-4e24-b1a1-2ca1571d5bab',
  /** Согласованные платежи (детали) */
  APPROVED_PAYMENT_DETAILS: 'b79dfca0-9f01-41a8-92bb-7a6d9212d2f1',
  /** Форма платежа */
  PAYMENT_FORM: '465f29bc-7031-4a0b-a671-05368d234efe',
  /** Настройки регулярных платежей */
  SCHEDULED_PAYMENTS: 'eeefc720-2351-43cd-804d-44fbd748ab8f',
  /** Платежи (модуль отключён в apiFetch) */
  PAYMENTS: '42303a3a-efd9-4863-9d99-b41962f017dc',
} as const;

export type FunctionKey = keyof typeof FUNCTION_IDS;

/**
 * Собирает итоговый адрес функции.
 * Приоритет: точечная переменная VITE_FN_<KEY> → базовый адрес + идентификатор.
 */
const buildUrl = (key: FunctionKey): string => {
  const override = import.meta.env[`VITE_FN_${key}`];
  if (override) return String(override);
  const base = FUNCTIONS_BASE.replace(/\/+$/, '');
  return `${base}/${FUNCTION_IDS[key]}`;
};

/** Готовые адреса всех backend-функций. */
export const FN = Object.freeze(
  Object.fromEntries(
    (Object.keys(FUNCTION_IDS) as FunctionKey[]).map((k) => [k, buildUrl(k)]),
  ) as Record<FunctionKey, string>,
);

export default FN;
