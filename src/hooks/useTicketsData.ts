import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL, apiFetch } from '@/utils/api';
import type {
  Ticket,
  CustomField,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketDepartment,
  TicketService,
} from '@/types';

const TICKETS_PER_PAGE = 6;

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
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [searchFilters, setSearchFilters] = useState<Record<string, string>>({});

  const loadHiddenCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch(
        `${API_URL}?endpoint=tickets&page=1&limit=1&is_hidden=true`,
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

  const loadNeedsMyReplyCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch(
        `${API_URL}?endpoint=tickets&page=1&limit=1&needs_my_reply=true`,
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
      let url = `${API_URL}?endpoint=tickets&page=${targetPage}&limit=${TICKETS_PER_PAGE}&sort_by=${encodeURIComponent(sortByValue)}&sort_dir=${sortDirValue}`;
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
      if (watching) {
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
      const response = await apiFetch(url, { headers: { 'X-Auth-Token': token } });

      if (response.ok) {
        const data = await response.json();
        setTickets(data.tickets || []);
        setTotalPages(data.pages || 1);
        setTotalTickets(data.total || 0);
        setPage(targetPage);
      } else {
        console.error('Tickets response not OK:', response.status, await response.text());
        setTickets([]);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [token, showArchived, showHidden, hideWaiting, needsMyReply, showAll, showWatching, sortBy, sortDir, searchFilters]);

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

  const loadBootstrap = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const skipWaiting = hideWaiting;
      let url = `${API_URL}?endpoint=tickets-bootstrap&page=1&limit=${TICKETS_PER_PAGE}&sort_by=${encodeURIComponent(sortBy)}&sort_dir=${sortDir}&is_archived=false`;
      if (skipWaiting) url += '&hide_waiting=true';

      const res = await apiFetch(url, { headers: { 'X-Auth-Token': token } });
      if (!res.ok) {
        throw new Error(`bootstrap ${res.status}`);
      }
      const data = await res.json();

      const t = data.tickets || {};
      setTickets(t.tickets || []);
      setTotalPages(t.pages || 1);
      setTotalTickets(t.total || 0);
      setPage(1);

      const dict = data.dictionaries || {};
      setCategories(dict.categories || []);
      setPriorities(dict.priorities || []);
      setStatuses(dict.statuses || []);
      setDepartments(dict.departments || []);
      setCustomFields(dict.custom_fields || []);

      setTicketServices(data.ticket_services || []);
      setHiddenCount(data.hidden_count || 0);
      setNeedsMyReplyCount(data.needs_my_reply_count || 0);
      setLoading(false);

      // services грузим отдельно в фоне (отдельная функция, нужна реже — для форм)
      loadServices();
    } catch (err) {
      console.error('Bootstrap failed, fallback to separate requests:', err);
      // Фолбэк на старую схему, чтобы страница не осталась пустой
      loadTickets(1);
      loadDictionaries();
      loadServices();
      loadHiddenCount();
      loadNeedsMyReplyCount();
    }
  }, [token, hideWaiting, sortBy, sortDir, loadServices, loadTickets, loadDictionaries, loadHiddenCount, loadNeedsMyReplyCount]);

  useEffect(() => {
    if (token) {
      loadBootstrap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const toggleArchived = useCallback((archived: boolean) => {
    setShowArchived(archived);
    setShowHidden(false);
    setShowAll(false);
    setShowWatching(false);
    setPage(1);
    loadTickets(1, archived, false, undefined, undefined, false, false);
    loadHiddenCount();
  }, [loadTickets, loadHiddenCount]);

  const toggleHidden = useCallback((hidden: boolean) => {
    setShowHidden(hidden);
    setShowArchived(false);
    setShowAll(false);
    setShowWatching(false);
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
    setPage(1);
    loadTickets(1, false, false, undefined, value, false, false);
  }, [loadTickets]);

  const toggleShowAll = useCallback((value: boolean) => {
    setShowAll(value);
    setShowArchived(false);
    setShowHidden(false);
    setNeedsMyReply(false);
    setShowWatching(false);
    setPage(1);
    loadTickets(1, false, false, undefined, false, value, false);
  }, [loadTickets]);

  const toggleWatching = useCallback((value: boolean) => {
    setShowWatching(value);
    setShowArchived(false);
    setShowHidden(false);
    setShowAll(false);
    setNeedsMyReply(false);
    setPage(1);
    loadTickets(1, false, false, undefined, false, false, value);
  }, [loadTickets]);

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
    loadHiddenCount,
    loadNeedsMyReplyCount,
  };
};