import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import Logo from '@/components/ui/Logo';
import { usePendingApprovals } from '@/hooks/usePendingApprovals';

interface PaymentsSidebarProps {
  menuOpen: boolean;
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
      className={`w-[250px] border-r border-white/10 dark:border-white/10 light:border-gray-200 fixed left-0 top-0 h-screen z-50 transition-all lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <a href="/" className="flex items-center gap-3 px-5 py-5 pb-[30px] border-b border-white/10 dark:border-white/10 light:border-gray-200 flex-shrink-0">
        <Logo className="h-8 w-auto text-white dark:text-white light:text-gray-900" />
      </a>
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/5 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/10">
        <ul className="px-[15px] py-5 space-y-1 pb-4">
        <li>
          <Link to="/" className={`flex items-center gap-3 px-[15px] py-3 rounded-lg ${isActive('/') ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}>
            <Icon name="Home" size={20} />
            <span>Дашборд</span>
          </Link>
        </li>
        {hasPermission('payments', 'read') && (
          <>
            <li>
              <Link to="/payments" className={`flex items-center gap-3 px-[15px] py-3 rounded-lg ${isActive('/payments') ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}>
                <Icon name="CreditCard" size={20} />
                <span>Платежи</span>
              </Link>
            </li>
            <li>
              <Link to="/planned-payments" className={`flex items-center gap-3 px-[15px] py-3 rounded-lg ${isActive('/planned-payments') ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}>
                <Icon name="CalendarClock" size={20} />
                <span>Запланированные платежи</span>
              </Link>
            </li>
            <li>
              <Link to="/pending-approvals" className={`flex items-center justify-between px-[15px] py-3 rounded-lg ${isActive('/pending-approvals') ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}>
                <div className="flex items-center gap-3">
                  <Icon name="ClipboardCheck" size={20} />
                  <span>На согласовании</span>
                </div>
                {pendingCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </Link>
            </li>
            <li>
              <Link to="/savings" className={`flex items-center gap-3 px-[15px] py-3 rounded-lg ${isActive('/savings') ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}>
                <Icon name="PiggyBank" size={20} />
                <span>Реестр экономии</span>
              </Link>
            </li>
          </>
        )}
        <li>
          <button 
            onClick={() => setTicketsOpen((prev: boolean) => !prev)}
            className="w-full flex items-center justify-between px-[15px] py-3 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <div className="flex items-center gap-3">
              <Icon name="Ticket" size={20} />
              <span>Заявки</span>
            </div>
            <Icon 
              name="ChevronDown" 
              size={16} 
              className={`transition-transform ${ticketsOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {ticketsOpen && (
            <div className="mt-1 space-y-1">
              <Link 
                to="/tickets" 
                className={`flex items-center gap-3 px-[15px] py-2 ml-[35px] rounded-lg ${isActive('/tickets') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}
              >
                <Icon name="List" size={18} />
                <span>Список заявок</span>
              </Link>
              <Link 
                to="/ticket-services" 
                className={`flex items-center gap-3 px-[15px] py-2 ml-[35px] rounded-lg ${isActive('/ticket-services') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}
              >
                <Icon name="Wrench" size={18} />
                <span>Услуги заявок</span>
              </Link>
              <Link 
                to="/service-providers" 
                className={`flex items-center gap-3 px-[15px] py-2 ml-[35px] rounded-lg ${isActive('/service-providers') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}
              >
                <Icon name="Network" size={18} />
                <span>Сервисы услуг</span>
              </Link>
              <Link 
                to="/ticket-service-categories" 
                className={`flex items-center gap-3 px-[15px] py-2 ml-[35px] rounded-lg ${isActive('/ticket-service-categories') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}
              >
                <Icon name="FolderTree" size={18} />
                <span>Категории услуг (заявки)</span>
              </Link>
            </div>
          )}
        </li>
        <li>
          <button 
            onClick={() => setDictionariesOpen(!dictionariesOpen)}
            className="w-full flex items-center justify-between px-[15px] py-3 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <div className="flex items-center gap-3">
              <Icon name="BookOpen" size={20} />
              <span>Справочники</span>
            </div>
            <Icon 
              name="ChevronDown" 
              size={16} 
              className={`transition-transform ${dictionariesOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {dictionariesOpen && (
            <div className="mt-1 space-y-1">
              <Link 
                to="/legal-entities" 
                className={`flex items-center gap-3 px-[15px] py-2 ml-[35px] rounded-lg ${isActive('/legal-entities') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}
              >
                <Icon name="Building2" size={18} />
                <span>Юридические лица</span>
              </Link>
              <Link 
                to="/categories" 
                className={`flex items-center gap-3 px-[15px] py-2 ml-[35px] rounded-lg ${isActive('/categories') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}
              >
                <Icon name="Tag" size={18} />
                <span>Категории платежей</span>
              </Link>
              <button 
                onClick={() => navigate('/custom-fields')}
                className={`w-full flex items-center gap-3 px-[15px] py-2 ml-[35px] rounded-lg ${isActive('/custom-fields') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}
              >
                <Icon name="Settings" size={18} />
                <span>Дополнительные поля</span>
              </button>
              <button 
                onClick={() => navigate('/contractors')}
                className={`w-full flex items-center gap-3 px-[15px] py-2 ml-[35px] rounded-lg ${isActive('/contractors') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}
              >
                <Icon name="Briefcase" size={18} />
                <span>Контрагенты</span>
              </button>
              <button 
                onClick={() => navigate('/customer-departments')}
                className={`w-full flex items-center gap-3 px-[15px] py-2 ml-[35px] rounded-lg ${isActive('/customer-departments') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}
              >
                <Icon name="Building" size={18} />
                <span>Отделы-заказчики</span>
              </button>
              <button 
                onClick={() => navigate('/services')}
                className={`w-full flex items-center gap-3 px-[15px] py-2 ml-[35px] rounded-lg ${isActive('/services') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}
              >
                <Icon name="Box" size={18} />
                <span>Сервисы</span>
              </button>
              <button 
                onClick={() => navigate('/saving-reasons')}
                className={`w-full flex items-center gap-3 px-[15px] py-2 ml-[35px] rounded-lg ${isActive('/saving-reasons') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}
              >
                <Icon name="Target" size={18} />
                <span>Причины экономии</span>
              </button>
            </div>
          )}
        </li>
        <li>
          <button 
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-full flex items-center justify-between px-[15px] py-3 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <div className="flex items-center gap-3">
              <Icon name="Settings" size={20} />
              <span>Настройки</span>
            </div>
            <Icon 
              name="ChevronDown" 
              size={16} 
              className={`transition-transform ${settingsOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {settingsOpen && (
            <div className="mt-1 space-y-1">
              <Link
                to="/settings"
                className={`flex items-center gap-3 px-[15px] py-2 ml-[35px] rounded-lg ${isActive('/settings') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}
              >
                <Icon name="Sliders" size={18} />
                <span>Основные настройки</span>
              </Link>
              <Link
                to="/users"
                className={`flex items-center gap-3 px-[15px] py-2 ml-[35px] rounded-lg ${isActive('/users') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}
              >
                <Icon name="Users" size={18} />
                <span>Пользователи</span>
              </Link>
              <Link
                to="/roles"
                className={`flex items-center gap-3 px-[15px] py-2 ml-[35px] rounded-lg ${isActive('/roles') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}
              >
                <Icon name="Shield" size={18} />
                <span>Права доступа</span>
              </Link>
              <Link
                to="/approvals-history"
                className={`flex items-center gap-3 px-[15px] py-2 ml-[35px] rounded-lg ${isActive('/approvals-history') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}
              >
                <Icon name="FileCheck" size={18} />
                <span>История согласований</span>
              </Link>
              <Link
                to="/audit-logs"
                className={`flex items-center gap-3 px-[15px] py-2 ml-[35px] rounded-lg ${isActive('/audit-logs') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}
              >
                <Icon name="History" size={18} />
                <span>История изменений</span>
              </Link>
              <Link
                to="/log-analyzer"
                className={`flex items-center gap-3 px-[15px] py-2 ml-[35px] rounded-lg ${isActive('/log-analyzer') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`}
              >
                <Icon name="FileText" size={18} />
                <span>Анализатор логов</span>
              </Link>
            </div>
          )}
        </li>
      </ul>
      </div>
      
      <div className="flex-shrink-0 border-t border-white/10 p-4 space-y-3">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
        >
          <div className="flex items-center gap-2">
            <Icon name={theme === 'dark' ? 'Moon' : 'Sun'} size={18} />
            <span className="text-sm">{theme === 'dark' ? 'Темная тема' : 'Светлая тема'}</span>
          </div>
          <Icon name="ChevronRight" size={16} />
        </button>
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{user?.full_name}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 border-white/10 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20"
          onClick={handleLogout}
        >
          <Icon name="LogOut" size={16} />
          Выйти
        </Button>
      </div>
    </aside>
  );
};

export default PaymentsSidebar;