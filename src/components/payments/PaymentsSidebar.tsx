import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import Logo from '@/components/ui/Logo';
import { usePendingApprovals } from '@/hooks/usePendingApprovals';

interface PaymentsSidebarProps {
  menuOpen: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  dictionariesOpen: boolean;
  setDictionariesOpen: (open: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: () => void;
}

const PaymentsSidebar = ({
  menuOpen,
  collapsed,
  onToggleCollapse,
  dictionariesOpen,
  setDictionariesOpen,
  settingsOpen,
  setSettingsOpen,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
}: PaymentsSidebarProps) => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [ticketsOpen, setTicketsOpen] = useState(true);
  const { pendingCount } = usePendingApprovals();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('light', savedTheme === 'light');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('light', newTheme === 'light');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <aside 
      style={{ backgroundColor: 'hsl(var(--sidebar-bg))' }}
      className={`${collapsed ? 'w-[70px]' : 'w-[250px]'} border-r border-white/10 dark:border-white/10 light:border-gray-200 fixed left-0 top-0 h-screen z-50 transition-all duration-300 lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between gap-3 px-5 py-5 pb-[30px] border-b border-white/10 dark:border-white/10 light:border-gray-200 flex-shrink-0">
        {!collapsed && <a href="/"><Logo className="h-8 w-auto text-white dark:text-white light:text-gray-900" /></a>}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          <Icon name={collapsed ? 'ChevronRight' : 'ChevronLeft'} size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/5 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/10">
        <ul className={`${collapsed ? 'px-1' : 'px-[15px]'} py-5 space-y-1 pb-4`}>
        <li>
          <Link to="/" className={`flex items-center ${collapsed ? 'justify-center px-3 py-4' : 'gap-3 px-[15px] py-3'} rounded-lg ${isActive('/') ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`} title="Дашборд">
            <Icon name="Home" size={22} />
            {!collapsed && <span>Дашборд</span>}
          </Link>
        </li>
        <li>
          <button
            onClick={() => setTicketsOpen(!ticketsOpen)}
            className={`w-full flex items-center ${collapsed ? 'justify-center px-3 py-4' : 'justify-between px-[15px] py-3'} rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors`}
            title="Заявки"
          >
            <div className="flex items-center gap-3">
              <Icon name="Ticket" size={22} />
              {!collapsed && <span>Заявки</span>}
            </div>
            {!collapsed && <Icon name={ticketsOpen ? 'ChevronDown' : 'ChevronRight'} size={16} />}
          </button>
          {ticketsOpen && (
            <ul className={`${collapsed ? 'hidden' : 'ml-3 mt-1 space-y-1'}`}>
              <li>
                <Link to="/tickets" className={`flex items-center gap-3 px-[15px] py-2 rounded-lg text-sm ${isActive('/tickets') ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}>
                  <Icon name="List" size={18} />
                  <span>Все заявки</span>
                </Link>
              </li>
              <li>
                <Link to="/ticket-services" className={`flex items-center gap-3 px-[15px] py-2 rounded-lg text-sm ${isActive('/ticket-services') ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}>
                  <Icon name="Wrench" size={18} />
                  <span>Услуги заявок</span>
                </Link>
              </li>
              <li>
                <Link to="/ticket-service-categories" className={`flex items-center gap-3 px-[15px] py-2 rounded-lg text-sm ${isActive('/ticket-service-categories') ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}>
                  <Icon name="FolderTree" size={18} />
                  <span>Категории услуг</span>
                </Link>
              </li>
            </ul>
          )}
        </li>
        {hasPermission('users', 'read') && (
          <li>
            <Link to="/users" className={`flex items-center ${collapsed ? 'justify-center px-3 py-4' : 'gap-3 px-[15px] py-3'} rounded-lg ${isActive('/users') ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`} title="Пользователи">
              <Icon name="Users" size={22} />
              {!collapsed && <span>Пользователи</span>}
            </Link>
          </li>
        )}
        {hasPermission('roles', 'read') && (
          <li>
            <Link to="/roles" className={`flex items-center ${collapsed ? 'justify-center px-3 py-4' : 'gap-3 px-[15px] py-3'} rounded-lg ${isActive('/roles') ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`} title="Права доступа">
              <Icon name="Shield" size={22} />
              {!collapsed && <span>Права доступа</span>}
            </Link>
          </li>
        )}
        <li>
          <Link to="/settings" className={`flex items-center ${collapsed ? 'justify-center px-3 py-4' : 'gap-3 px-[15px] py-3'} rounded-lg ${isActive('/settings') ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`} title="Настройки">
            <Icon name="Settings" size={22} />
            {!collapsed && <span>Настройки</span>}
          </Link>
        </li>
        <li>
          <Link to="/log-analyzer" className={`flex items-center ${collapsed ? 'justify-center px-3 py-4' : 'gap-3 px-[15px] py-3'} rounded-lg ${isActive('/log-analyzer') ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`} title="Анализатор логов">
            <Icon name="FileText" size={22} />
            {!collapsed && <span>Анализатор логов</span>}
          </Link>
        </li>
      </ul>
      </div>
      
      <div className="flex-shrink-0 border-t border-white/10 p-4 space-y-3">
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-3 py-2 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors`}
          title={theme === 'dark' ? 'Темная тема' : 'Светлая тема'}
        >
          {collapsed ? (
            <Icon name={theme === 'dark' ? 'Moon' : 'Sun'} size={18} />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Icon name={theme === 'dark' ? 'Moon' : 'Sun'} size={18} />
                <span className="text-sm">{theme === 'dark' ? 'Темная тема' : 'Светлая тема'}</span>
              </div>
              <Icon name="ChevronRight" size={16} />
            </>
          )}
        </button>
        {!collapsed && (
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{user?.full_name}</div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
            </div>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className={`w-full ${collapsed ? 'justify-center px-2' : 'justify-start gap-2'} border-white/10 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20`}
          onClick={handleLogout}
          title="Выйти"
        >
          <Icon name="LogOut" size={16} />
          {!collapsed && 'Выйти'}
        </Button>
      </div>
    </aside>
  );
};

export default PaymentsSidebar;