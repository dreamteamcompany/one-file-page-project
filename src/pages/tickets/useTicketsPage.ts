import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTicketsData } from '@/hooks/useTicketsData';
import { useTicketForm } from '@/hooks/useTicketForm';
import { useBulkTicketActions } from '@/hooks/useBulkTicketActions';
import { useTicketsView } from '@/hooks/useTicketsView';
import { useTicketsInterface } from '@/hooks/useTicketsInterface';
import { useBulkTicketOperations } from '@/hooks/useBulkTicketOperations';
import { API_URL, apiFetch } from '@/utils/api';
import type { TicketsFiltersValue, TicketsFilterOptions } from '@/components/tickets/TicketsFilters';
import {
  CLOSED_STATUSES,
  EXECUTOR_GROUPS_URL,
  isOverdueTicket,
  userLabel,
  type BulkExecutorGroup,
  type BulkUser,
  type CounterRole,
} from './ticketsPageUtils';

export const useTicketsPage = () => {
  const { user, hasPermission, hasExactPermission, hasSystemRole, token } = useAuth();
  const canBulkActions = hasExactPermission('tickets', 'bulk_actions');
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkUsers, setBulkUsers] = useState<BulkUser[]>([]);
  const [bulkExecutorGroups, setBulkExecutorGroups] = useState<BulkExecutorGroup[]>([]);
  const [filterAssignees, setFilterAssignees] = useState<BulkUser[]>([]);
  const [filterCreators, setFilterCreators] = useState<BulkUser[]>([]);
  const [filterGroups, setFilterGroups] = useState<BulkExecutorGroup[]>([]);
  const isAdmin = hasSystemRole('admin');

  const {
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
    pageSize,
    pageSizeOptions,
    changePageSize,
    loadTickets,
    loadDictionaries,
    loadServices,
    showArchived,
    showHidden,
    hiddenCount,
    hideWaiting,
    showAll,
    showWatching,
    showSubordinates,
    hasSubordinates,
    filterExecutors: bootstrapExecutors,
    filterCreators: bootstrapCreators,
    filterGroups: bootstrapGroups,
    sortBy,
    sortDir,
    setSortBy,
    setSortDir,
    searchFilters,
    setSearchFilters,
    toggleArchived,
    toggleHidden,
    toggleHideWaiting,
    toggleShowAll,
    toggleWatching,
    toggleSubordinates,
  } = useTicketsData();

  const { viewMode, setViewMode, bulkMode, toggleBulkMode, disableBulkMode } = useTicketsView();
  const { ui: ticketsInterface, setInterface } = useTicketsInterface();

  // Актуальное кол-во статусов для отложенных проверок внутри setTimeout
  // (иначе замыкание видит пустой массив и шлёт лишний запрос).
  const statusesCountRef = useRef(0);
  useEffect(() => { statusesCountRef.current = statuses.length; }, [statuses.length]);
  const filterAssigneesRef = useRef(0);
  useEffect(() => { filterAssigneesRef.current = filterAssignees.length; }, [filterAssignees.length]);
  const filterCreatorsRef = useRef(0);
  useEffect(() => { filterCreatorsRef.current = filterCreators.length; }, [filterCreators.length]);
  const filterGroupsRef = useRef(0);
  useEffect(() => { filterGroupsRef.current = filterGroups.length; }, [filterGroups.length]);
  // Поиск выполняется на сервере (по теме, описанию, доп. полям, комментариям,
  // участникам, номеру, дате, сервису и услуге) — см. эффект ниже.
  const searchedTickets = tickets;

  const [counterRole, setCounterRole] = useState<CounterRole | null>(null);

  const filteredTickets = useMemo(() => {
    if (counterRole === 'overdue') {
      return searchedTickets.filter(isOverdueTicket);
    }
    if (counterRole === 'mentions') {
      return searchedTickets.filter((t) => !!t.unread_mentions && t.unread_mentions > 0);
    }
    if (counterRole === 'assignee') {
      return searchedTickets.filter((t) => t.assigned_to === user?.id);
    }
    if (counterRole === 'customer') {
      return searchedTickets.filter((t) => t.created_by === user?.id);
    }
    return searchedTickets;
  }, [searchedTickets, counterRole, user?.id]);

  const overdueCount = useMemo(() => filteredTickets.filter(isOverdueTicket).length, [filteredTickets]);
  const assignedToMeCount = useMemo(
    () => filteredTickets.filter((t) => t.assigned_to === user?.id).length,
    [filteredTickets, user?.id]
  );
  const closedCount = useMemo(
    () => filteredTickets.filter((t) => {
      const status = (t.status_name || '').trim().toLowerCase();
      return t.status_is_closed || CLOSED_STATUSES.includes(status);
    }).length,
    [filteredTickets]
  );

  const {
    selectedTicketIds,
    selectedCount,
    toggleTicketSelection,
    toggleAllTickets,
    clearSelection,
  } = useBulkTicketActions();

  const {
    dialogOpen,
    setDialogOpen,
    formData,
    setFormData,
    handleSubmit,
  } = useTicketForm(customFields, loadTickets);

  const {
    handleChangeStatus,
    handleChangePriority,
    handleChangeExecutor,
    handleChangeExecutorGroup,
    handleAddWatchers,
    handleDelete,
  } = useBulkTicketOperations(selectedTicketIds, () => loadTickets(page), clearSelection);

  const bulkDataNeeded = bulkMode || (ticketsInterface === 'workspace' && canBulkActions);

  useEffect(() => {
    if (!isAdmin || !token || !bulkDataNeeded) return;
    if (bulkUsers.length === 0) {
      apiFetch(`${API_URL}?endpoint=users`, { headers: { 'X-Auth-Token': token } })
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          if (Array.isArray(data)) {
            setBulkUsers(data.filter((u: { is_active?: boolean }) => u.is_active !== false));
          }
        })
        .catch(() => {});
    }
    if (bulkExecutorGroups.length === 0) {
      apiFetch(EXECUTOR_GROUPS_URL, { headers: { 'X-Auth-Token': token } })
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          const list = Array.isArray(data) ? data : data?.groups || [];
          setBulkExecutorGroups(list);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, token, bulkDataNeeded]);

  // В новом интерфейсе справочники статусов/приоритетов нужны сразу
  // (для панели массовых действий и селектов в деталях).
  useEffect(() => {
    if (ticketsInterface !== 'workspace') return;
    // Даём bootstrap шанс заполнить справочники сам. Догружаем только если
    // через 1.5с их всё ещё нет (bootstrap не отработал).
    const timer = setTimeout(() => {
      if (statusesCountRef.current === 0) loadDictionaries();
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketsInterface]);

  // Справочники исполнителей / заявителей / групп для фильтров теперь приходят
  // прямо из bootstrap (одним запросом) — заполняем локальные состояния из них.
  useEffect(() => {
    if (bootstrapExecutors.length > 0) setFilterAssignees(bootstrapExecutors);
  }, [bootstrapExecutors]);
  useEffect(() => {
    if (bootstrapCreators.length > 0) setFilterCreators(bootstrapCreators);
  }, [bootstrapCreators]);
  useEffect(() => {
    if (bootstrapGroups.length > 0) setFilterGroups(bootstrapGroups);
  }, [bootstrapGroups]);

  // Фолбэк: если bootstrap не отдал справочники фильтров (старый ответ или
  // сбой) — через ~2с догружаем их отдельными запросами, как раньше.
  const filterDictsLoaded = useRef(false);
  useEffect(() => {
    if (!token || filterDictsLoaded.current) return;
    filterDictsLoaded.current = true;

    const timer = setTimeout(() => {
      if (statusesCountRef.current === 0) loadDictionaries();
      if (services.length === 0 || ticketServices.length === 0) loadServices();

      if (filterAssigneesRef.current === 0) {
        apiFetch(`${API_URL}?endpoint=users&system_roles=executor`, { headers: { 'X-Auth-Token': token } })
          .then((r) => (r.ok ? r.json() : []))
          .then((data) => {
            if (Array.isArray(data)) setFilterAssignees(data.filter((u: { is_active?: boolean }) => u.is_active !== false));
          })
          .catch(() => {});
      }

      if (filterCreatorsRef.current === 0) {
        apiFetch(`${API_URL}?endpoint=users&system_roles=user`, { headers: { 'X-Auth-Token': token } })
          .then((r) => (r.ok ? r.json() : []))
          .then((data) => {
            if (Array.isArray(data)) setFilterCreators(data.filter((u: { is_active?: boolean }) => u.is_active !== false));
          })
          .catch(() => {});
      }

      if (filterGroupsRef.current === 0) {
        apiFetch(EXECUTOR_GROUPS_URL, { headers: { 'X-Auth-Token': token } })
          .then((r) => (r.ok ? r.json() : []))
          .then((data) => {
            const list = Array.isArray(data) ? data : data?.groups || [];
            setFilterGroups(list);
          })
          .catch(() => {});
      }
    }, 2000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filterOptions: TicketsFilterOptions = useMemo(() => ({
    statuses: statuses.map((s) => ({ value: String(s.id), label: s.name })),
    assignees: filterAssignees.map((u) => ({ value: String(u.id), label: userLabel(u) })),
    creators: filterCreators.map((u) => ({ value: String(u.id), label: userLabel(u) })),
    executorGroups: filterGroups.map((g) => ({ value: String(g.id), label: g.name })),
    services: services.map((s) => ({ value: String(s.id), label: s.name })),
    ticketServices: ticketServices.map((s) => ({ value: String(s.id), label: s.name })),
  }), [statuses, filterAssignees, filterCreators, filterGroups, services, ticketServices]);

  useEffect(() => {
    // Проверяем, есть ли ЛЮБОЕ право на просмотр заявок
    const canViewTickets = hasPermission('tickets', 'view_all') || hasPermission('tickets', 'view_own_only');
    if (!canViewTickets) {
      navigate('/login');
    }
  }, [hasPermission, navigate]);

  // Серверный поиск по содержанию с задержкой ввода (debounce).
  const searchDebounceFirstRun = useRef(true);
  useEffect(() => {
    if (searchDebounceFirstRun.current) {
      searchDebounceFirstRun.current = false;
      return;
    }
    const handle = setTimeout(() => {
      const q = searchQuery.trim();
      const merged = { ...searchFilters };
      if (q) merged.search_content = q;
      else delete merged.search_content;
      setSearchFilters(merged);
      loadTickets(1, undefined, undefined, undefined, undefined, undefined, undefined, sortBy, sortDir, merged);
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Проверяем, есть ли ЛЮБОЕ право на просмотр заявок
  const canViewTickets = hasPermission('tickets', 'view_all') || hasPermission('tickets', 'view_own_only');

  const handleFormOpen = () => {
    loadDictionaries();
    loadServices();
  };

  const handleBulkModeToggle = () => {
    toggleBulkMode();
    if (bulkMode) {
      clearSelection();
    }
  };

  const handleSortByChange = (value: string) => {
    setSortBy(value);
    loadTickets(1, undefined, undefined, undefined, undefined, undefined, undefined, value, sortDir);
  };

  const handleSortDirToggle = () => {
    const next: 'asc' | 'desc' = sortDir === 'asc' ? 'desc' : 'asc';
    setSortDir(next);
    loadTickets(1, undefined, undefined, undefined, undefined, undefined, undefined, sortBy, next);
  };

  const handleFiltersChange = (next: TicketsFiltersValue) => {
    const normalized: Record<string, string> = {};
    Object.entries(next).forEach(([k, v]) => {
      if (typeof v === 'string' && v.trim() !== '') normalized[k] = v.trim();
    });
    setSearchFilters(normalized);
    loadTickets(1, undefined, undefined, undefined, undefined, undefined, undefined, sortBy, sortDir, normalized);
  };

  const handleRemoveFilter = (key: keyof TicketsFiltersValue) => {
    const next: Record<string, string> = { ...searchFilters };
    delete next[key];
    if (key === 'search_content') setSearchQuery('');
    setSearchFilters(next);
    loadTickets(1, undefined, undefined, undefined, undefined, undefined, undefined, sortBy, sortDir, next);
  };

  const handleCreateTicket = () => {
    handleFormOpen();
    setDialogOpen(true);
  };

  // Верхние табы нового интерфейса используют только assignee/overdue.
  const workspaceActiveRole: 'assignee' | 'overdue' | null =
    counterRole === 'assignee' || counterRole === 'overdue' ? counterRole : null;

  return {
    user,
    hasPermission,
    canBulkActions,
    canViewTickets,
    isAdmin,
    menuOpen,
    setMenuOpen,
    searchQuery,
    setSearchQuery,
    filtersOpen,
    setFiltersOpen,
    bulkUsers,
    bulkExecutorGroups,
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
    pageSize,
    pageSizeOptions,
    changePageSize,
    loadTickets,
    showArchived,
    showHidden,
    hiddenCount,
    hideWaiting,
    showAll,
    showWatching,
    showSubordinates,
    hasSubordinates,
    sortBy,
    sortDir,
    searchFilters,
    toggleArchived,
    toggleHidden,
    toggleHideWaiting,
    toggleShowAll,
    toggleWatching,
    toggleSubordinates,
    viewMode,
    setViewMode,
    bulkMode,
    disableBulkMode,
    ticketsInterface,
    setInterface,
    counterRole,
    setCounterRole,
    filteredTickets,
    overdueCount,
    assignedToMeCount,
    closedCount,
    selectedTicketIds,
    selectedCount,
    toggleTicketSelection,
    toggleAllTickets,
    clearSelection,
    dialogOpen,
    setDialogOpen,
    formData,
    setFormData,
    handleSubmit,
    handleChangeStatus,
    handleChangePriority,
    handleChangeExecutor,
    handleChangeExecutorGroup,
    handleAddWatchers,
    handleDelete,
    filterOptions,
    handleFormOpen,
    handleBulkModeToggle,
    handleSortByChange,
    handleSortDirToggle,
    handleFiltersChange,
    handleRemoveFilter,
    handleCreateTicket,
    workspaceActiveRole,
  };
};
