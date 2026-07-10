/**
 * Верхняя строка нового интерфейса заявок (по эталону):
 * заголовок + табы «Назначено мне / Просрочено» + поиск + Фильтры + Создать заявку.
 */
import { ReactNode } from 'react';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';

interface WorkspaceHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  assignedCount: number;
  overdueCount: number;
  activeRole: 'assignee' | 'overdue' | null;
  onSelectRole: (role: 'assignee' | 'overdue' | null) => void;
  filtersSlot?: ReactNode;
  filterPanelSlot?: ReactNode;
  onCreateTicket?: () => void;
  canCreate: boolean;
}

const WorkspaceHeader = ({
  searchQuery,
  onSearchChange,
  assignedCount,
  overdueCount,
  activeRole,
  onSelectRole,
  filtersSlot,
  filterPanelSlot,
  onCreateTicket,
  canCreate,
}: WorkspaceHeaderProps) => {
  return (
    <div className="flex flex-col gap-3">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      {/* Заголовок + табы */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">Заявки</h1>
        <button
          type="button"
          onClick={() => onSelectRole(activeRole === 'assignee' ? null : 'assignee')}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            activeRole === 'assignee'
              ? 'bg-blue-500 text-white'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
          }`}
        >
          Назначено мне
          <span className="rounded-full bg-white/30 px-1.5 text-xs font-bold">{assignedCount}</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectRole(activeRole === 'overdue' ? null : 'overdue')}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            activeRole === 'overdue'
              ? 'bg-red-500 text-white'
              : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
          }`}
        >
          Просрочено
          <span className="rounded-full bg-white/30 px-1.5 text-xs font-bold">{overdueCount}</span>
        </button>
      </div>

      {/* Поиск + Фильтры + Создать */}
      <div className="flex items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Icon
            name="Search"
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Поиск по заявкам..."
            className="pl-9"
          />
        </div>

        {filtersSlot}

        {canCreate && (
          <button
            type="button"
            onClick={onCreateTicket}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-sm font-medium text-white shadow-sm hover:from-violet-700 hover:to-indigo-700"
          >
            <Icon name="Plus" size={18} />
            <span className="hidden sm:inline">Создать заявку</span>
          </button>
        )}
      </div>
    </div>
    {filterPanelSlot}
    </div>
  );
};

export default WorkspaceHeader;