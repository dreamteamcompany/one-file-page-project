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
  const { user, logout, hasPermission, activeRole, setActiveRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const { pendingCount } = usePendingApprovals();

  useEffect(() => {
    const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark' | null) ?? 'light';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('light', savedTheme === 'light');
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

  const settingsResources: Array<[string, string]> = [
    ['settings', 'read'],
    ['sla', 'read'],
    ['ticket_services', 'read'],
    ['ticket_service_categories', 'read'],
    ['ticket_statuses', 'read'],
    ['ticket_priorities', 'read'],
    ['executor_groups', 'read'],
    ['companies', 'read'],
    ['departments', 'read'],
    ['positions', 'read'],
    ['field_registry', 'read'],
    ['custom_field_groups', 'read'],
    ['service_field_mappings', 'read'],
    ['users', 'read'],
    ['roles', 'read'],
    ['log_analyzer', 'read'],
  ];
  const canAccessSettings = settingsResources.some(([r, a]) => hasPermission(r, a));

  // «Обращения» — только для админов, независимо от выбранной активной роли.
  const isAdmin = (user?.roles ?? []).some(
    (r) => r.name === 'Администратор' || r.name === 'Admin'
  );

  return (
    <aside 
      style={{ backgroundColor: 'hsl(var(--sidebar-bg))' }}
      className={`${collapsed ? 'w-[70px]' : 'w-[250px]'} border-r border-border fixed left-0 top-0 h-screen z-50 transition-all duration-300 lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between gap-3 px-5 py-5 pb-[30px] border-b border-border flex-shrink-0">
        {!collapsed && (
          <a href={hasPermission('dashboard', 'read') ? '/' : '/tickets'} className="flex-1">
            <div className="bg-transparent [.light_&]:bg-[#0f1729] rounded-lg px-3 py-2 flex items-center justify-center w-full">
              <Logo className="h-8 w-auto" />
            </div>
          </a>
        )}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          <Icon name={collapsed ? 'ChevronRight' : 'ChevronLeft'} size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-accent/30 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-accent/50">
        <ul className={`${collapsed ? 'px-1' : 'px-[15px]'} py-5 space-y-1 pb-4`}>
        {hasPermission('dashboard', 'read') && (
          <li>
            <Link to="/" className={`flex items-center ${collapsed ? 'justify-center px-3 py-4' : 'gap-3 px-[15px] py-3'} rounded-lg ${isActive('/') ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`} title="Аналитика">
              <Icon name="BarChart3" size={22} />
              {!collapsed && <span>Аналитика</span>}
            </Link>
          </li>
        )}
        {isAdmin && (
          <li>
            <Link to="/topics-analytics" className={`flex items-center ${collapsed ? 'justify-center px-3 py-4' : 'gap-3 px-[15px] py-3'} rounded-lg ${isActive('/topics-analytics') ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`} title="Обращения">
              <Icon name="ChartPie" size={22} />
              {!collapsed && <span>Обращения</span>}
            </Link>
          </li>
        )}
        {(hasPermission('tickets', 'view_all') || hasPermission('tickets', 'view_own_only')) && (
          <li>
            <Link to="/tickets" className={`flex items-center ${collapsed ? 'justify-center px-3 py-4' : 'gap-3 px-[15px] py-3'} rounded-lg ${isActive('/tickets') ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`} title="Мои заявки">
              <Icon name="Ticket" size={22} />
              {!collapsed && <span>Мои заявки</span>}
            </Link>
          </li>
        )}

        {hasPermission('knowledge_base', 'read') && (
          <li>
            <Link to="/knowledge-base" className={`flex items-center ${collapsed ? 'justify-center px-3 py-4' : 'gap-3 px-[15px] py-3'} rounded-lg ${isActive('/knowledge-base') ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`} title="База знаний">
              <Icon name="BookOpen" size={22} />
              {!collapsed && <span>База знаний</span>}
            </Link>
          </li>
        )}


        {canAccessSettings && (
          <li>
            <Link to="/settings" className={`flex items-center ${collapsed ? 'justify-center px-3 py-4' : 'gap-3 px-[15px] py-3'} rounded-lg ${isActive('/settings') ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'} transition-colors`} title="Настройки">
              <Icon name="Settings" size={22} />
              {!collapsed && <span>Настройки</span>}
            </Link>
          </li>
        )}

      </ul>
      </div>
      
      <div className="flex-shrink-0 border-t border-border p-4 space-y-3">

        {(user?.roles?.length ?? 0) >= 2 && (
          <div className={`${collapsed ? 'flex justify-center' : ''}`}>
            {collapsed ? (
              <button
                title={`Роль: ${activeRole?.name ?? ''}`}
                className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold"
              >
                {activeRole?.name?.charAt(0) ?? '?'}
              </button>
            ) : (
              <div className="bg-primary/5 rounded-xl p-1 flex gap-1">
                {user!.roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setActiveRole(role)}
                    title={role.description || role.name}
                    className={`flex-1 text-xs font-medium px-2 py-1.5 rounded-lg transition-all duration-200 truncate ${
                      activeRole?.id === role.id
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-primary/10'
                    }`}
                  >
                    {role.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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
            {user?.photo_url ? (
              <img src={user.photo_url} alt={user.full_name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{user?.full_name}</div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
            </div>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className={`w-full ${collapsed ? 'justify-center px-2' : 'justify-start gap-2'} border-border hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20`}
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