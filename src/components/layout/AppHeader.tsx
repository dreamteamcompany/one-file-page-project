import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface AppHeaderProps {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  actions?: React.ReactNode;
}

const AppHeader = ({ menuOpen, setMenuOpen, actions }: AppHeaderProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMenuToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    setMenuOpen(!menuOpen);
    setTimeout(() => target.blur(), 0);
  };

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={handleMenuToggle}
          title="Меню"
          aria-label="Меню"
        >
          <Icon name="Menu" size={24} />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Мои заявки</h1>
      </div>

      <div className="flex items-center gap-3">
        {actions}
        <NotificationBell />
        <div className="flex items-center gap-2 text-foreground">
          <span className="text-sm">{user?.username || 'User'}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Выйти"
            aria-label="Выйти"
          >
            <Icon name="LogOut" size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AppHeader;