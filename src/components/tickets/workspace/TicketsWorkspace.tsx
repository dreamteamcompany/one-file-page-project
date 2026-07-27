/**
 * Новый интерфейс страницы заявок — «рабочее место оператора».
 * KPI-карточки + тулбар (чипсы фильтров, сортировка, режим) + таблица + правая панель деталей.
 * Работает на реальных данных, детали открываются справа без перехода на новую страницу.
 */
import { ReactNode, useMemo, useState } from 'react';
import Icon from '@/components/ui/icon';
import type { Ticket } from '@/types';
import type { TicketsFiltersValue } from '@/components/tickets/TicketsFilters';
import WorkspaceKpiCards, { WorkspaceKpi } from './WorkspaceKpiCards';
import WorkspaceHeader from './WorkspaceHeader';
import WorkspaceToolbar from './WorkspaceToolbar';
import WorkspaceTicketsTable from './WorkspaceTicketsTable';
import WorkspaceDetailsPanel from './WorkspaceDetailsPanel';
import { getSlaBadge } from '@/utils/slaFormat';
import { formatDateOnlyMSK } from '@/utils/dateFormat';

interface SortOption {
  value: string;
  label: string;
}

interface TicketsWorkspaceProps {
  tickets: Ticket[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  currentUserId?: number;
  overdueCount: number;
  closedCount: number;
  onReloadList: () => void;
  // Фильтры и сортировка (серверная логика)
  filters: TicketsFiltersValue;
  onRemoveFilter: (key: keyof TicketsFiltersValue) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  sortDir: 'asc' | 'desc';
  onSortDirToggle: () => void;
  sortOptions: SortOption[];
  // Массовые действия
  bulkMode: boolean;
  selectedTicketIds: number[];
  onToggleTicket: (id: number) => void;
  onToggleAll: (ids: number[], allSelected: boolean) => void;
  // Верхняя строка
  activeRole: 'assignee' | 'overdue' | null;
  onSelectRole: (role: 'assignee' | 'overdue' | null) => void;
  assignedCount: number;
  filtersSlot?: ReactNode;
  filterPanelSlot?: ReactNode;
  onCreateTicket?: () => void;
  canCreate: boolean;
  // Серверная пагинация (сортировка тоже серверная — применяется ко всему списку)
  page: number;
  totalPages: number;
  totalTickets: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const isClosed = (t: Ticket): boolean => !!t.status_is_closed;

// Проверка, что дата приходится на сегодняшний день (по московскому времени).
const isToday = (date?: string): boolean => {
  if (!date) return false;
  const todayStr = formatDateOnlyMSK(new Date());
  return formatDateOnlyMSK(date) === todayStr;
};

const TicketsWorkspace = ({
  tickets,
  loading,
  searchQuery,
  onSearchChange,
  currentUserId,
  overdueCount,
  closedCount,
  onReloadList,
  filters,
  onRemoveFilter,
  sortBy,
  onSortByChange,
  sortDir,
  onSortDirToggle,
  sortOptions,
  bulkMode,
  selectedTicketIds,
  onToggleTicket,
  onToggleAll,
  activeRole,
  onSelectRole,
  assignedCount,
  filtersSlot,
  filterPanelSlot,
  onCreateTicket,
  canCreate,
  page,
  totalPages,
  totalTickets,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: TicketsWorkspaceProps) => {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [gridMode, setGridMode] = useState(false);

  // Пагинация и сортировка — серверные: таблица показывает заявки ровно в том
  // порядке и на той странице, что вернул сервер, без повторной сортировки/нарезки.
  const pagedTickets = tickets;

  const kpi: WorkspaceKpi = useMemo(() => {
    let overdue = overdueCount;
    let slaToday = 0;
    let assignedToMe = 0;
    let waitingResponse = 0;

    for (const t of tickets) {
      if (isClosed(t)) continue;
      const sla = getSlaBadge(t.due_date);
      if (sla) {
        if (sla.overdue && overdueCount === 0) overdue += 1;
        if (!sla.overdue && (sla.color === 'red' || sla.color === 'orange')) slaToday += 1;
      }
      if (t.assigned_to === currentUserId) assignedToMe += 1;
      if (t.status_is_waiting_response) waitingResponse += 1;
    }

    return { overdue, slaToday, assignedToMe, waitingResponse, closed: closedCount };
  }, [tickets, currentUserId, overdueCount, closedCount]);

  // Разбивка «за сегодня» — заявки, созданные сегодня, по тем же категориям.
  const todayKpi: WorkspaceKpi = useMemo(() => {
    let overdue = 0;
    let slaToday = 0;
    let assignedToMe = 0;
    let waitingResponse = 0;
    let closed = 0;

    for (const t of tickets) {
      if (!isToday(t.created_at)) continue;
      if (isClosed(t)) {
        closed += 1;
        continue;
      }
      const sla = getSlaBadge(t.due_date);
      if (sla) {
        if (sla.overdue) overdue += 1;
        else if (sla.color === 'red' || sla.color === 'orange') slaToday += 1;
      }
      if (t.assigned_to === currentUserId) assignedToMe += 1;
      if (t.status_is_waiting_response) waitingResponse += 1;
    }

    return { overdue, slaToday, assignedToMe, waitingResponse, closed };
  }, [tickets, currentUserId]);

  return (
    <div className="flex flex-col gap-4">
      {/* Верхняя строка: заголовок + табы + поиск + фильтры + создать */}
      <WorkspaceHeader
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        assignedCount={assignedCount}
        overdueCount={overdueCount}
        activeRole={activeRole}
        onSelectRole={onSelectRole}
        filtersSlot={filtersSlot}
        filterPanelSlot={filterPanelSlot}
        onCreateTicket={onCreateTicket}
        canCreate={canCreate}
      />

    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_400px]">
      {/* Левая колонка: KPI + тулбар + таблица */}
      <div className="flex min-w-0 flex-col gap-4">
        <WorkspaceKpiCards kpi={kpi} today={todayKpi} />

        {/* Чипсы фильтров + сортировка + режим отображения */}
        <WorkspaceToolbar
          filters={filters}
          onRemoveFilter={onRemoveFilter}
          sortBy={sortBy}
          onSortByChange={onSortByChange}
          sortDir={sortDir}
          onSortDirToggle={onSortDirToggle}
          sortOptions={sortOptions}
          gridMode={gridMode}
          onGridModeChange={setGridMode}
        />

        {gridMode ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-20 text-muted-foreground">
            <Icon name="LayoutGrid" size={40} className="mb-3" />
            <p className="text-sm">Режим доски в разработке</p>
          </div>
        ) : (
          <WorkspaceTicketsTable
            tickets={pagedTickets}
            loading={loading}
            selectedTicketId={selectedTicket?.id ?? null}
            onSelectTicket={setSelectedTicket}
            page={page}
            totalPages={totalPages}
            totalTickets={totalTickets}
            onPageChange={onPageChange}
            bulkMode={bulkMode}
            selectedTicketIds={selectedTicketIds}
            onToggleTicket={onToggleTicket}
            onToggleAll={onToggleAll}
            pageSize={pageSize}
            onPageSizeChange={onPageSizeChange}
          />
        )}
      </div>

      {/* Правая колонка: детали заявки */}
      <div className="xl:sticky xl:top-4 xl:min-h-[calc(100vh-2rem)]">
        {selectedTicket ? (
          <WorkspaceDetailsPanel
            key={selectedTicket.id}
            ticketId={selectedTicket.id}
            onClose={() => setSelectedTicket(null)}
            onChanged={onReloadList}
          />
        ) : (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card text-muted-foreground">
            <Icon name="MousePointerClick" size={40} className="mb-3" />
            <p className="text-sm">Выберите заявку, чтобы увидеть детали</p>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

export default TicketsWorkspace;