import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Icon from '@/components/ui/icon';
import { ApiResponse, DeactivateMode } from './types';

interface BitrixPageHeaderProps {
  tab: 'inactive' | 'exceptions' | 'reports';
  data: ApiResponse | null;
  visibleInactiveCount: number;
  neverLoggedCount: number;
  longInactiveCount: number;
  deactivating: boolean;
  isAdmin: boolean;
  onConfirmDeactivate: (mode: DeactivateMode) => void;
  onOpenAddException: () => void;
}

const BitrixPageHeader = ({
  tab,
  data,
  visibleInactiveCount,
  neverLoggedCount,
  longInactiveCount,
  deactivating,
  isAdmin,
  onConfirmDeactivate,
  onOpenAddException,
}: BitrixPageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} title="Назад к настройкам" aria-label="Назад к настройкам">
          <Icon name="ArrowLeft" size={20} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Неактивные пользователи Битрикс24</h1>
          <p className="text-sm text-muted-foreground">
            Сотрудники, которые не заходили в Битрикс за указанный период
          </p>
        </div>
      </div>
      {tab === 'inactive' && data && visibleInactiveCount > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-2" disabled={deactivating}>
              {deactivating ? (
                <Icon name="Loader2" size={16} className="animate-spin" />
              ) : (
                <Icon name="UserMinus" size={16} />
              )}
              Уволить
              <Icon name="ChevronDown" size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onConfirmDeactivate('all')} className="gap-2">
              <Icon name="Users" size={14} />
              Всех ({visibleInactiveCount})
            </DropdownMenuItem>
            {neverLoggedCount > 0 && (
              <DropdownMenuItem onClick={() => onConfirmDeactivate('never_logged')} className="gap-2">
                <Icon name="UserX" size={14} />
                Никогда не заходили ({neverLoggedCount})
              </DropdownMenuItem>
            )}
            {longInactiveCount > 0 && (
              <DropdownMenuItem onClick={() => onConfirmDeactivate('long_inactive')} className="gap-2">
                <Icon name="Clock" size={14} />
                Долго не заходили ({longInactiveCount})
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {tab === 'exceptions' && isAdmin && (
        <Button size="sm" className="gap-2" onClick={onOpenAddException}>
          <Icon name="Plus" size={16} />
          Добавить в исключения
        </Button>
      )}
    </header>
  );
};

export default BitrixPageHeader;