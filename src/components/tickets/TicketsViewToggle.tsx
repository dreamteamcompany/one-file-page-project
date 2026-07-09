/**
 * Компонент переключения режимов просмотра заявок
 * Single Responsibility: только UI переключения list/kanban/bulk
 */
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';

interface TicketsViewToggleProps {
  viewMode: 'list' | 'kanban';
  onViewModeChange: (mode: 'list' | 'kanban') => void;
  bulkMode: boolean;
  onBulkModeToggle: () => void;
  showArchived: boolean;
  onToggleArchived: (archived: boolean) => void;
  showHidden?: boolean;
  onToggleHidden?: (hidden: boolean) => void;
  hiddenCount?: number;
  hideWaiting?: boolean;
  onToggleHideWaiting?: (value: boolean) => void;
  needsMyReply?: boolean;
  showAll?: boolean;
  onToggleShowAll?: (value: boolean) => void;
  showWatching?: boolean;
  onToggleWatching?: (value: boolean) => void;
  showSubordinates?: boolean;
  hasSubordinates?: boolean;
  onToggleSubordinates?: (value: boolean) => void;
  canBulkActions?: boolean;
}

const TicketsViewToggle = ({
  viewMode,
  onViewModeChange,
  bulkMode,
  onBulkModeToggle,
  showArchived,
  onToggleArchived,
  showHidden = false,
  onToggleHidden,
  hiddenCount = 0,
  hideWaiting = true,
  onToggleHideWaiting,
  needsMyReply = false,
  showAll = false,
  onToggleShowAll,
  showWatching = false,
  onToggleWatching,
  showSubordinates = false,
  hasSubordinates = false,
  onToggleSubordinates,
  canBulkActions = false,
}: TicketsViewToggleProps) => {
  const { hasSystemRole } = useAuth();
  const isPlainUser = hasSystemRole('user') && !hasSystemRole('admin', 'manager');
  const isOpenOrAllActive = !showArchived && !showHidden && !showWatching && !showSubordinates;

  const handleSelectOpen = () => {
    onViewModeChange('list');
    if (showArchived) onToggleArchived(false);
    if (showHidden && onToggleHidden) onToggleHidden(false);
    if (showWatching && onToggleWatching) onToggleWatching(false);
    if (showSubordinates && onToggleSubordinates) onToggleSubordinates(false);
    if (showAll && onToggleShowAll) onToggleShowAll(false);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={isOpenOrAllActive && !showAll ? 'default' : 'outline'}
          size="sm"
          onClick={handleSelectOpen}
          className="flex items-center gap-2"
        >
          <Icon name="List" size={16} />
          <span className="hidden sm:inline">Открытые</span>
        </Button>
        <Button
          variant={showWatching ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            const next = !showWatching;
            onToggleWatching?.(next);
            if (next) {
              if (showArchived) onToggleArchived(false);
              if (showHidden && onToggleHidden) onToggleHidden(false);
              onViewModeChange('list');
            }
          }}
          className="flex items-center gap-2"
        >
          <Icon name="Users" size={16} />
          <span className="hidden sm:inline">Наблюдаю</span>
          <span className="sm:hidden">Наблюдаю</span>
        </Button>
        {hasSubordinates && onToggleSubordinates && (
          <Button
            variant={showSubordinates ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              const next = !showSubordinates;
              onToggleSubordinates(next);
              if (next) {
                if (showArchived) onToggleArchived(false);
                if (showHidden && onToggleHidden) onToggleHidden(false);
                onViewModeChange('list');
              }
            }}
            className="flex items-center gap-2"
          >
            <Icon name="UsersRound" size={16} />
            <span>Заявки сотрудников</span>
          </Button>
        )}
        <Button
          variant={showArchived ? 'default' : 'outline'}
          size="sm"
          onClick={() => { onToggleArchived(!showArchived); if (showHidden && onToggleHidden) onToggleHidden(false); if (!showArchived) onViewModeChange('list'); }}
          className="flex items-center gap-2"
        >
          <Icon name="Archive" size={16} />
          <span className="hidden sm:inline">Архив</span>
        </Button>
        {onToggleHidden && !isPlainUser && (
          <Button
            variant={showHidden ? 'default' : 'outline'}
            size="sm"
            onClick={() => { onToggleHidden(!showHidden); if (showArchived) onToggleArchived(false); if (!showHidden) onViewModeChange('list'); }}
            className="flex items-center gap-2"
          >
            <Icon name="EyeOff" size={16} />
            <span className="hidden sm:inline">Скрытые</span>
            {hiddenCount > 0 && (
              <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {hiddenCount}
              </span>
            )}
          </Button>
        )}

      </div>

      {viewMode === 'list' && !showHidden && canBulkActions && (
        <Button
          variant={bulkMode ? 'default' : 'outline'}
          size="sm"
          onClick={onBulkModeToggle}
          className="flex items-center gap-2 text-sm sm:text-base"
        >
          <Icon name="CheckSquare" size={16} />
          <span className="hidden sm:inline">{bulkMode ? 'Отменить выбор' : 'Массовые действия'}</span>
          <span className="sm:hidden">{bulkMode ? 'Отмена' : 'Массовые'}</span>
        </Button>
      )}
    </div>
  );
};

export default TicketsViewToggle;