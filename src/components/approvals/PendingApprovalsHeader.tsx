import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

interface PendingApprovalsHeaderProps {
  notificationPermission: NotificationPermission;
  requestNotificationPermission: () => Promise<void>;
  setNotificationPermission: (permission: NotificationPermission) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  activeFiltersCount: number;
}

const PendingApprovalsHeader = ({
  notificationPermission,
  requestNotificationPermission,
  setNotificationPermission,
  showFilters,
  setShowFilters,
  activeFiltersCount,
}: PendingApprovalsHeaderProps) => {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h1 className="text-2xl md:text-3xl font-bold">На согласовании</h1>
        <div className="flex items-center gap-2">
          {notificationPermission === 'default' && (
            <Button
              onClick={async () => {
                await requestNotificationPermission();
                if ('Notification' in window) {
                  setNotificationPermission(Notification.permission);
                }
              }}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Icon name="Bell" size={16} />
              <span className="hidden sm:inline">Включить уведомления</span>
            </Button>
          )}
          {notificationPermission === 'granted' && (
            <div className="flex items-center gap-2 text-sm text-green-400">
              <Icon name="BellRing" size={16} />
              <span className="hidden sm:inline">Уведомления включены</span>
            </div>
          )}
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            size="sm"
            className="gap-2 relative"
          >
            <Icon name="Filter" size={16} />
            <span className="hidden sm:inline">Фильтры</span>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>
      </div>
      <p className="text-sm md:text-base text-muted-foreground">
        Платежи, ожидающие вашего решения
      </p>
    </div>
  );
};

export default PendingApprovalsHeader;
