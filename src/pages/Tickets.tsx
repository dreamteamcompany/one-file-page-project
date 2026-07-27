/**
 * Страница управления заявками
 * Рефакторинг: разделено по Single Responsibility Principle
 * - Поиск вынесен в useTicketsSearch
 * - Режим просмотра в useTicketsView
 * - Bulk операции в useBulkTicketOperations
 * - UI переключения в TicketsViewToggle
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTicketsData } from '@/hooks/useTicketsData';
import { useTicketForm } from '@/hooks/useTicketForm';
import { useBulkTicketActions } from '@/hooks/useBulkTicketActions';
import { useTicketsView } from '@/hooks/useTicketsView';
import { useTicketsInterface } from '@/hooks/useTicketsInterface';
import { useBulkTicketOperations } from '@/hooks/useBulkTicketOperations';
import InterfaceSwitcher from '@/components/tickets/InterfaceSwitcher';
import TicketsWorkspace from '@/components/tickets/workspace/TicketsWorkspace';
import PageLayout from '@/components/layout/PageLayout';
import AppHeader from '@/components/layout/AppHeader';
import TicketsSearchBar from '@/components/tickets/TicketsSearchBar';
import TicketsViewToggle from '@/components/tickets/TicketsViewToggle';
import TicketCountersBar from '@/components/tickets/TicketCountersBar';
import TicketForm from '@/components/tickets/TicketForm';
import TicketsList from '@/components/tickets/TicketsList';
import TicketsKanban from '@/components/tickets/TicketsKanban';
import BulkActionsBar from '@/components/tickets/BulkActionsBar';
import { API_URL, apiFetch } from '@/utils/api';
import TicketsFilters, { TicketsFilterPanel, type TicketsFiltersValue, type TicketsFilterOptions } from '@/components/tickets/TicketsFilters';
import { getDeadlineSeverity } from '@/utils/dateFormat';

type CounterRole = 'assignee' | 'customer' | 'approver' | 'mentions' | 'overdue';

const CLOSED_STATUSES = ['закрыта', 'закрыт', 'решена', 'решён', 'решен', 'выполнена', 'выполнен', 'отклонена', 'отменена'];

const isOverdueTicket = (ticket: { due_date?: string; status_name?: string }): boolean => {
  const status = (ticket.status_name || '').trim().toLowerCase();
  if (CLOSED_STATUSES.includes(status)) return false;
  return getDeadlineSeverity(ticket.due_date)?.overdue === true;
};

interface BulkUser {
  id: number;
  full_name?: string;
  username?: string;
}

interface BulkExecutorGroup {
  id: number;
  name: string;
}

const EXECUTOR_GROUPS_URL = 'https://functions.poehali.dev/a52eb50f-38cf-4887-aead-cc77f01ca416';

const Tickets = () => {
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

  // Справочники для выпадающих фильтров: подгружаем один раз.
  // Откладываем их на ~1.2с, чтобы не конкурировать с основным bootstrap-
  // запросом (заявки + справочники) за лимит запросов БД. Фильтры —
  // второстепенные данные, их не страшно подгрузить чуть позже.
  const filterDictsLoaded = useRef(false);
  useEffect(() => {
    if (!token || filterDictsLoaded.current) return;
    filterDictsLoaded.current = true;

    const timer = setTimeout(() => {
      if (statusesCountRef.current === 0) loadDictionaries();
      if (services.length === 0 || ticketServices.length === 0) loadServices();

      apiFetch(`${API_URL}?endpoint=users&system_roles=executor`, { headers: { 'X-Auth-Token': token } })
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setFilterAssignees(data.filter((u: { is_active?: boolean }) => u.is_active !== false));
        })
        .catch(() => {});

      apiFetch(`${API_URL}?endpoint=users&system_roles=user`, { headers: { 'X-Auth-Token': token } })
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setFilterCreators(data.filter((u: { is_active?: boolean }) => u.is_active !== false));
        })
        .catch(() => {});

      apiFetch(EXECUTOR_GROUPS_URL, { headers: { 'X-Auth-Token': token } })
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          const list = Array.isArray(data) ? data : data?.groups || [];
          setFilterGroups(list);
        })
        .catch(() => {});
    }, 1200);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const userLabel = (u: BulkUser) => (u.full_name || u.username || `#${u.id}`);

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
  if (!canViewTickets) {
    return null;
  }

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

  const SORT_OPTIONS: { value: string; label: string }[] = [
    { value: 'created_at', label: 'Дате создания' },
    { value: 'due_date', label: 'Дедлайну' },
    { value: 'status', label: 'Статусу' },
    { value: 'assignee', label: 'Исполнителю' },
    { value: 'creator', label: 'Заказчику' },
    { value: 'executor_group', label: 'Группе исполнителей' },
    { value: 'service', label: 'Услуге' },
    { value: 'ticket_service', label: 'Сервису' },
  ];

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

  return (
    <PageLayout menuOpen={menuOpen} setMenuOpen={setMenuOpen}>
      <AppHeader
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        actions={<InterfaceSwitcher value={ticketsInterface} onChange={setInterface} />}
      />

      <div className="w-full flex flex-col flex-1">
        {ticketsInterface === 'workspace' ? (
          <>
          <TicketsWorkspace
            tickets={filteredTickets}
            loading={loading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            currentUserId={user?.id}
            overdueCount={overdueCount}
            closedCount={closedCount}
            onReloadList={() => loadTickets(page)}
            filters={searchFilters as TicketsFiltersValue}
            onRemoveFilter={handleRemoveFilter}
            sortBy={sortBy}
            onSortByChange={handleSortByChange}
            sortDir={sortDir}
            onSortDirToggle={handleSortDirToggle}
            sortOptions={SORT_OPTIONS}
            bulkMode={canBulkActions}
            selectedTicketIds={selectedTicketIds}
            onToggleTicket={toggleTicketSelection}
            onToggleAll={toggleAllTickets}
            activeRole={workspaceActiveRole}
            onSelectRole={(role) => setCounterRole(role)}
            assignedCount={assignedToMeCount}
            canCreate={hasPermission('tickets', 'create')}
            onCreateTicket={handleCreateTicket}
            filtersSlot={
              <TicketsFilters
                value={searchFilters as TicketsFiltersValue}
                onChange={handleFiltersChange}
                compact
                expanded={filtersOpen}
                onExpandedChange={setFiltersOpen}
              />
            }
            filterPanelSlot={
              <TicketsFilterPanel
                value={searchFilters as TicketsFiltersValue}
                onChange={handleFiltersChange}
                expanded={filtersOpen}
                onExpandedChange={setFiltersOpen}
                options={filterOptions}
              />
            }
          />
          <div className="hidden">
            <TicketForm
              dialogOpen={dialogOpen}
              setDialogOpen={setDialogOpen}
              formData={formData}
              setFormData={setFormData}
              categories={categories}
              priorities={priorities}
              statuses={statuses}
              departments={departments}
              customFields={customFields}
              services={services}
              ticketServices={ticketServices}
              handleSubmit={handleSubmit}
              onDialogOpen={handleFormOpen}
              canCreate={false}
            />
          </div>
          {canBulkActions && selectedCount > 0 && (
            <BulkActionsBar
              selectedCount={selectedCount}
              statuses={statuses}
              priorities={priorities}
              users={bulkUsers}
              executorGroups={bulkExecutorGroups}
              isAdmin={isAdmin}
              onChangeStatus={handleChangeStatus}
              onChangePriority={handleChangePriority}
              onChangeExecutor={handleChangeExecutor}
              onChangeExecutorGroup={handleChangeExecutorGroup}
              onAddWatchers={handleAddWatchers}
              onDelete={handleDelete}
              onCancel={clearSelection}
            />
          )}
          </>
        ) : (
        <>
        <TicketsViewToggle
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          bulkMode={bulkMode}
          onBulkModeToggle={handleBulkModeToggle}
          showArchived={showArchived}
          onToggleArchived={toggleArchived}
          showHidden={showHidden}
          onToggleHidden={toggleHidden}
          hiddenCount={hiddenCount}
          hideWaiting={hideWaiting}
          onToggleHideWaiting={toggleHideWaiting}
          showAll={showAll}
          onToggleShowAll={toggleShowAll}
          showWatching={showWatching}
          onToggleWatching={toggleWatching}
          showSubordinates={showSubordinates}
          hasSubordinates={hasSubordinates}
          onToggleSubordinates={toggleSubordinates}
          canBulkActions={canBulkActions}
        />


          <TicketCountersBar activeRole={counterRole} onSelectRole={setCounterRole} />

          {!showArchived && !showHidden && <div className="w-fit mt-3">
            <TicketForm
              dialogOpen={dialogOpen}
              setDialogOpen={setDialogOpen}
              formData={formData}
              setFormData={setFormData}
              categories={categories}
              priorities={priorities}
              statuses={statuses}
              departments={departments}
              customFields={customFields}
              services={services}
              ticketServices={ticketServices}
              handleSubmit={handleSubmit}
              onDialogOpen={handleFormOpen}
              canCreate={hasPermission('tickets', 'create')}
            />
          </div>}

          <div className="sticky top-0 z-20 mt-4 sm:mt-6 bg-[#0f1535]/95 [.light_&]:bg-[#f3f3f9]/95 backdrop-blur-sm py-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-[30px] lg:px-[30px]">
            <TicketsSearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortBy={sortBy}
              onSortByChange={handleSortByChange}
              sortDir={sortDir}
              onSortDirToggle={handleSortDirToggle}
              sortOptions={SORT_OPTIONS}
              filtersValue={searchFilters as TicketsFiltersValue}
              onFiltersChange={handleFiltersChange}
              filterOptions={filterOptions}
              showControls={viewMode === 'list'}
            />
          </div>

          {viewMode === 'list' ? (
            <div className="mt-4">
              <TicketsList
                tickets={filteredTickets}
                loading={loading}
                onTicketClick={(ticket) => window.open(`${window.location.origin}/tickets/${ticket.id}`, '_blank', 'noopener')}
                selectedTicketIds={selectedTicketIds}
                onToggleTicket={toggleTicketSelection}
                onToggleAll={toggleAllTickets}
                bulkMode={bulkMode}
                currentUserId={user?.id}
                page={page}
                totalPages={totalPages}
                totalTickets={totalTickets}
                onPageChange={(p) => loadTickets(p)}
                pageSize={pageSize}
                pageSizeOptions={pageSizeOptions}
                onPageSizeChange={changePageSize}
              />
              
              {bulkMode && selectedCount > 0 && (
                <BulkActionsBar
                  selectedCount={selectedCount}
                  statuses={statuses}
                  priorities={priorities}
                  users={bulkUsers}
                  executorGroups={bulkExecutorGroups}
                  isAdmin={isAdmin}
                  onChangeStatus={handleChangeStatus}
                  onChangePriority={handleChangePriority}
                  onChangeExecutor={handleChangeExecutor}
                  onChangeExecutorGroup={handleChangeExecutorGroup}
                  onAddWatchers={handleAddWatchers}
                  onDelete={handleDelete}
                  onCancel={() => {
                    clearSelection();
                    disableBulkMode();
                  }}
                />
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0">
            <TicketsKanban
              tickets={filteredTickets}
              statuses={statuses}
              loading={loading}
              onUpdateStatus={async (ticketId, statusId) => {
                try {
                  await apiFetch('/tickets', {
                    method: 'PUT',
                    body: JSON.stringify({ id: ticketId, status_id: statusId }),
                  });
                  loadTickets();
                } catch (error) {
                  console.error('Error updating status:', error);
                }
              }}
            />
            </div>
          )}
        </>
        )}
      </div>

      <footer className="mt-auto pt-8 py-4 text-center text-xs text-muted-foreground border-t border-border/40">
        © 2026 Команда Мечты
      </footer>
    </PageLayout>
  );
};

export default Tickets;