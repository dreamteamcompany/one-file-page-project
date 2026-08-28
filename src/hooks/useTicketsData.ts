import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL, apiFetch } from '@/utils/api';
import { readBootstrapCache, writeBootstrapCache, type BootstrapDicts } from '@/utils/bootstrapCache';
import type {
  Ticket,
  CustomField,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketDepartment,
  TicketService,
} from '@/types';

const DEFAULT_TICKETS_PER_PAGE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const getInitialPageSize = (): number => {
  const saved = Number(localStorage.getItem('tickets_page_size'));
  return PAGE_SIZE_OPTIONS.includes(saved as (typeof PAGE_SIZE_OPTIONS)[number])
    ? saved
    : DEFAULT_TICKETS_PER_PAGE;
};

export const useTicketsData = () => {
  const { token } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [priorities, setPriorities] = useState<TicketPriority[]>([]);
  const [statuses, setStatuses] = useState<TicketStatus[]>([]);
  const [departments, setDepartments] = useState<TicketDepartment[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [services, setServices] = useState<TicketService[]>([]);
  const [ticketServices, setTicketServices] = useState<TicketService[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(getInitialPageSize);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTickets, setTotalTickets] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [hideWaiting, setHideWaiting] = useState<boolean>(() => {
    const saved = localStorage.getItem('tickets_hide_waiting');
    return saved === null ? true : saved === 'true';
  });
  const [needsMyReply, setNeedsMyReply] = useState<boolean>(false);
  const [needsMyReplyCount, setNeedsMyReplyCount] = useState(0);
  const [showAll, setShowAll] = useState<boolean>(false);
  const [showWatching, setShowWatching] = useState<boolean>(false);
  const [showSubordinates, setShowSubordinates] = useState<boolean>(false);
  const [hasSubordinates, setHasSubordinates] = useState<boolean>(false);
  const [filterExecutors, setFilterExecutors] = useState<{ id: number; full_name?: string; username?: string }[]>([]);
  const [filterCreators, setFilterCreators] = useState<{ id: number; full_name?: string; username?: string }[]>([]);
  const [filterGroups, setFilterGroups] = useState<{ id: number; name: string }[]>([]);
  const showSubordinatesRef = useRef(false);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [searchFilters, setSearchFilters] = useState<Record<string, string>>({});

  // Счётчики бейджей приходят из bootstrap при открытии страницы. Повторный
  // запрос нужен только чтобы цифра не «застыла» надолго, поэтому чаще чем
  // раз в 60 секунд не дёргаем — переключение вкладок больше не создаёт вызов.
  const COUNTERS_MIN_INTERVAL_MS = 60000;
  const hiddenCountAtRef = useRef(0);
  const needsReplyCountAtRef = useRef(0);

  const loadHiddenCount = useCallback(async (force = false) => {
    if (!token) return;
    const now = Date.now();
    if (!force && now - hiddenCountAtRef.current < COUNTERS_MIN_INTERVAL_MS) return;
    hiddenCountAtRef.current = now;
    try {
      const res = await apiFetch(
        `${API_URL}?endpoint=tickets&page=1&limit=1&is_hidden=true&count_only=true`,
        { headers: { 'X-Auth-Token': token } }
      );
      if (res.ok) {
        const data = await res.json();
        setHiddenCount(data.total || 0);
      }
    } catch {
      // ignore
    }
  }, [token]);

  const loadNeedsMyReplyCount = useCallback(async (force = false) => {
    if (!token) return;
    const now = Date.now();
    if (!force && now - needsReplyCountAtRef.current < COUNTERS_MIN_INTERVAL_MS) return;
    needsReplyCountAtRef.current = now;
    try {
      const res = await apiFetch(
        `${API_URL}?endpoint=tickets&page=1&limit=1&needs_my_reply=true&count_only=true`,
        { headers: { 'X-Auth-Token': token } }
      );
      if (res.ok) {
        const data = await res.json();
        setNeedsMyReplyCount(data.total || 0);
      }
    } catch {
      // ignore
    }
  }, [token]);

  const loadTickets = useCallback(async (targetPage = 1, isArchived?: boolean, isHidden?: boolean, hideWaitingArg?: boolean, needsMyReplyArg?: boolean, showAllArg?: boolean, showWatchingArg?: boolean, sortByArg?: string, sortDirArg?: 'asc' | 'desc', filtersArg?: Record<string, string>) => {
    if (!token) return;

    const archived = isArchived !== undefined ? isArchived : showArchived;
    const hidden = isHidden !== undefined ? isHidden : showHidden;
    const skipWaiting = hideWaitingArg !== undefined ? hideWaitingArg : hideWaiting;
    const onlyMyReply = needsMyReplyArg !== undefined ? needsMyReplyArg : needsMyReply;
    const all = showAllArg !== undefined ? showAllArg : showAll;
    const watching = showWatchingArg !== undefined ? showWatchingArg : showWatching;
    const sortByValue = sortByArg !== undefined ? sortByArg : sortBy;
    const sortDirValue = sortDirArg !== undefined ? sortDirArg : sortDir;
    const filters = filtersArg !== undefined ? filtersArg : searchFilters;
    setLoading(true);
    try {
      let url = `${API_URL}?endpoint=tickets&page=${targetPage}&limit=${pageSize}&sort_by=${encodeURIComponent(sortByValue)}&sort_dir=${sortDirValue}`;
      const allowedFilterKeys = [
        'search_content',
        'search_assignee', 'search_creator', 'search_status',
        'search_executor_group', 'search_service', 'search_ticket_service',
        'due_from', 'due_to',
      ];
      for (const key of allowedFilterKeys) {
        const v = (filters?.[key] || '').trim();
        if (v) url += `&${key}=${encodeURIComponent(v)}`;
      }
      if (showSubordinatesRef.current) {
        url += '&is_subordinates=true&is_archived=false';
        if (skipWaiting) {
          url += '&hide_waiting=true';
        }
      } else if (watching) {
        url += `&is_archived=${archived}&is_watcher=true`;
        if (skipWaiting) {
          url += '&hide_waiting=true';
        }
      } else if (all) {
        url += '&show_all=true';
      } else if (hidden) {
        url += '&is_hidden=true';
      } else if (onlyMyReply) {
        url += `&is_archived=${archived}&needs_my_reply=true`;
      } else {
        url += `&is_archived=${archived}`;
        if (skipWaiting) {
          url += '&hide_waiting=true';
        }
      }
      // Ретраи на случай rate-limit БД (500/502/503/504): пробуем несколько
      // раз с нарастающей паузой, чтобы список не пропадал из-за временной
      // перегрузки базы.
      let response: Response | null = null;
      let data: { tickets?: Ticket[]; pages?: number; total?: number } | null = null;
      const MAX_ATTEMPTS = 4;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        response = await apiFetch(url, { headers: { 'X-Auth-Token': token } });
        if (response.ok) {
          data = await response.json();
          break;
        }
        if (![500, 502, 503, 504].includes(response.status) || attempt === MAX_ATTEMPTS - 1) {
          break;
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }

      if (data) {
        setTickets(data.tickets || []);
        setTotalPages(data.pages || 1);
        setTotalTickets(data.total || 0);
        setPage(targetPage);
      } else {
        // Не затираем уже показанный список — просто логируем, чтобы у
        // пользователя не появлялось «Нет заявок» из-за сбоя загрузки.
        console.error('Tickets response not OK:', response?.status);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  }, [token, showArchived, showHidden, hideWaiting, needsMyReply, showAll, showWatching, sortBy, sortDir, searchFilters, pageSize]);

  const loadServices = useCallback(async () => {
    if (!token) return;

    try {
      const categoriesResponse = await apiFetch(`${API_URL}?endpoint=ticket_services`, {
        headers: { 'X-Auth-Token': token },
      });

      if (categoriesResponse.ok) {
        const data = await categoriesResponse.json();
        setTicketServices(data || []);
      }

      const servicesResponse = await apiFetch(`${API_URL}?endpoint=services`, {
        headers: { 'X-Auth-Token': token },
      });

      if (servicesResponse.ok) {
        const data = await servicesResponse.json();
        setServices(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load services:', err);
    }
  }, [token]);

  const loadDictionaries = useCallback(async () => {
    if (!token) return;

    try {
      const response = await apiFetch(`${API_URL}?endpoint=ticket-dictionaries-api`, {
        headers: { 'X-Auth-Token': token },
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
        setPriorities(data.priorities || []);
        setStatuses(data.statuses || []);
        setDepartments(data.departments || []);
        setCustomFields(data.custom_fields || []);
      } else {
        console.error('Dictionaries response not OK:', response.status, await response.text());
        setPriorities([
          { id: 1, name: 'Низкий', level: 1, color: '#6b7280' },
          { id: 2, name: 'Средний', level: 2, color: '#3b82f6' },
          { id: 3, name: 'Высокий', level: 3, color: '#f97316' },
          { id: 4, name: 'Критический', level: 4, color: '#ef4444' }
        ]);
        setStatuses([
          { id: 1, name: 'Новая', color: '#3b82f6', is_closed: false },
          { id: 2, name: 'В работе', color: '#eab308', is_closed: false },
          { id: 3, name: 'Ожидание', color: '#f97316', is_closed: false },
          { id: 4, name: 'Решена', color: '#22c55e', is_closed: true },
          { id: 5, name: 'Закрыта', color: '#6b7280', is_closed: true }
        ]);
      }
    } catch (err) {
      console.error('Failed to load dictionaries:', err);
    }
  }, [token]);

  // Применяет справочники (из кеша или свежего ответа) к состоянию.
  const applyDicts = useCallback((d: BootstrapDicts) => {
    const dict = (d.dictionaries || {}) as Record<string, unknown[]>;
    setCategories((dict.categories as never[]) || []);
    setPriorities((dict.priorities as never[]) || []);
    setStatuses((dict.statuses as never[]) || []);
    setDepartments((dict.departments as never[]) || []);
    setCustomFields((dict.custom_fields as never[]) || []);
    setTicketServices((d.ticket_services as never[]) || []);
    setHasSubordinates(!!d.has_subordinates);
    if (Array.isArray(d.executors)) setFilterExecutors(d.executors as never[]);
    if (Array.isArray(d.creators)) setFilterCreators(d.creators as never[]);
    if (Array.isArray(d.groups)) setFilterGroups(d.groups as never[]);
  }, []);

  const loadBootstrap = useCallback(async () => {
    if (!token) return;
    // Мгновенно показываем справочники из кеша (если свежие) — страница
    // рисуется сразу, без ожидания ответа сервера.
    const cached = readBootstrapCache(token);
    if (cached) applyDicts(cached);
    setLoading(true);
    try {
      const skipWaiting = hideWaiting;
      let url = `${API_URL}?endpoint=tickets-bootstrap&page=1&limit=${pageSize}&sort_by=${encodeURIComponent(sortBy)}&sort_dir=${sortDir}&is_archived=false`;
      if (skipWaiting) url += '&hide_waiting=true';

      // Ретраи bootstrap при rate-limit БД, чтобы не срываться в фолбэк
      // (который шлёт лавину отдельных запросов и ещё сильнее грузит базу).
      let res: Response | null = null;
      const MAX_ATTEMPTS = 4;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        res = await apiFetch(url, { headers: { 'X-Auth-Token': token } });
        if (res.ok) break;
        if (![500, 502, 503, 504].includes(res.status) || attempt === MAX_ATTEMPTS - 1) {
          throw new Error(`bootstrap ${res.status}`);
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
      if (!res || !res.ok) {
        throw new Error('bootstrap failed');
      }
      const data = await res.json();

      const t = data.tickets || {};
      setTickets(t.tickets || []);
      setTotalPages(t.pages || 1);
      setTotalTickets(t.total || 0);
      setPage(1);

      const dicts: BootstrapDicts = {
        dictionaries: data.dictionaries || {},
        ticket_services: data.ticket_services || [],
        executors: Array.isArray(data.executors) ? data.executors : [],
        creators: Array.isArray(data.creators) ? data.creators : [],
        groups: Array.isArray(data.groups) ? data.groups : [],
        has_subordinates: !!data.has_subordinates,
      };
      applyDicts(dicts);
      writeBootstrapCache(token, dicts);

      setHiddenCount(data.hidden_count || 0);
      setNeedsMyReplyCount(data.needs_my_reply_count || 0);
      // Счётчики уже актуальны — отмечаем время, чтобы переключение вкладок
      // сразу после загрузки не слало повторные запросы за теми же числами.
      hiddenCountAtRef.current = Date.now();
      needsReplyCountAtRef.current = Date.now();
      setLoading(false);

      // services грузим отдельно в фоне (отдельная функция, нужна реже — для форм)
      loadServices();
    } catch (err) {
      console.error('Bootstrap failed, fallback to separate requests:', err);
      // Фолбэк на старую схему, чтобы страница не осталась пустой
      loadTickets(1);
      loadDictionaries();
      loadServices();
      loadHiddenCount(true);
      loadNeedsMyReplyCount(true);
    }
  }, [token, hideWaiting, sortBy, sortDir, pageSize, applyDicts, loadServices, loadTickets, loadDictionaries, loadHiddenCount, loadNeedsMyReplyCount]);

  useEffect(() => {
    if (token) {
      loadBootstrap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const pageSizeInitRef = useRef(true);
  useEffect(() => {
    if (pageSizeInitRef.current) {
      pageSizeInitRef.current = false;
      return;
    }
    if (token) {
      loadTickets(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  const toggleArchived = useCallback((archived: boolean) => {
    setShowArchived(archived);
    setShowHidden(false);
    setShowAll(false);
    setShowWatching(false);
    showSubordinatesRef.current = false;
    setShowSubordinates(false);
    setPage(1);
    loadTickets(1, archived, false, undefined, undefined, false, false);
    loadHiddenCount();
  }, [loadTickets, loadHiddenCount]);

  const toggleHidden = useCallback((hidden: boolean) => {
    setShowHidden(hidden);
    setShowArchived(false);
    setShowAll(false);
    setShowWatching(false);
    showSubordinatesRef.current = false;
    setShowSubordinates(false);
    setPage(1);
    loadTickets(1, false, hidden, undefined, undefined, false, false);
  }, [loadTickets]);

  const toggleHideWaiting = useCallback((value: boolean) => {
    setHideWaiting(value);
    localStorage.setItem('tickets_hide_waiting', String(value));
    setPage(1);
    loadTickets(1, undefined, undefined, value);
  }, [loadTickets]);

  const toggleNeedsMyReply = useCallback((value: boolean) => {
    setNeedsMyReply(value);
    setShowArchived(false);
    setShowHidden(false);
    setShowAll(false);
    setShowWatching(false);
    showSubordinatesRef.current = false;
    setShowSubordinates(false);
    setPage(1);
    loadTickets(1, false, false, undefined, value, false, false);
  }, [loadTickets]);

  const toggleShowAll = useCallback((value: boolean) => {
    setShowAll(value);
    setShowArchived(false);
    setShowHidden(false);
    setNeedsMyReply(false);
    setShowWatching(false);
    showSubordinatesRef.current = false;
    setShowSubordinates(false);
    setPage(1);
    loadTickets(1, false, false, undefined, false, value, false);
  }, [loadTickets]);

  const toggleWatching = useCallback((value: boolean) => {
    setShowWatching(value);
    setShowArchived(false);
    setShowHidden(false);
    setShowAll(false);
    setNeedsMyReply(false);
    showSubordinatesRef.current = false;
    setShowSubordinates(false);
    setPage(1);
    loadTickets(1, false, false, undefined, false, false, value);
  }, [loadTickets]);

  const toggleSubordinates = useCallback((value: boolean) => {
    showSubordinatesRef.current = value;
    setShowSubordinates(value);
    setShowArchived(false);
    setShowHidden(false);
    setShowAll(false);
    setNeedsMyReply(false);
    setShowWatching(false);
    setPage(1);
    loadTickets(1, false, false, undefined, false, false, false);
  }, [loadTickets]);

  const changePageSize = useCallback((value: number) => {
    if (!PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number])) return;
    setPageSize(value);
    localStorage.setItem('tickets_page_size', String(value));
    setPage(1);
  }, []);

  return {
    tickets,
    categories,
    priorities,
    statuses,
    departments,
    customFields,
    services,
    ticketServices,
    loading,
    page,
    pageSize,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    changePageSize,
    totalPages,
    totalTickets,
    showArchived,
    showHidden,
    hiddenCount,
    hideWaiting,
    needsMyReply,
    needsMyReplyCount,
    showAll,
    showWatching,
    showSubordinates,
    hasSubordinates,
    filterExecutors,
    filterCreators,
    filterGroups,
    sortBy,
    sortDir,
    setSortBy,
    setSortDir,
    searchFilters,
    setSearchFilters,
    loadTickets,
    loadDictionaries,
    loadServices,
    toggleArchived,
    toggleHidden,
    toggleHideWaiting,
    toggleNeedsMyReply,
    toggleShowAll,
    toggleWatching,
    toggleSubordinates,
    loadHiddenCount,
    loadNeedsMyReplyCount,
  };
};