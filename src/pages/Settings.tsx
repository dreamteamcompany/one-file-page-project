import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import PageLayout from '@/components/layout/PageLayout';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch, getApiUrl } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import func2url from '../../backend/func2url.json';

const Settings = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [classificationMode, setClassificationMode] = useState<'ai' | 'manual'>('ai');
  const [classificationLoading, setClassificationLoading] = useState(false);
  const [dueDays, setDueDays] = useState('1');
  const [dueDaysLoading, setDueDaysLoading] = useState(false);

  useEffect(() => {
    const loadClassificationMode = async () => {
      try {
        const url = `${getApiUrl('system_settings')}?resource=system_settings&key=classification_mode`;
        const res = await apiFetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.value === 'manual' || data.value === 'ai') {
            setClassificationMode(data.value);
          }
        }
      } catch (e) { console.error(e); }
    };
    loadClassificationMode();
  }, []);

  useEffect(() => {
    const loadDueDays = async () => {
      try {
        const url = `${getApiUrl('system_settings')}?resource=system_settings&key=default_due_working_days`;
        const res = await apiFetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.value && /^\d+$/.test(String(data.value))) {
            setDueDays(String(data.value));
          }
        }
      } catch (e) { console.error(e); }
    };
    loadDueDays();
  }, []);

  const handleSaveDueDays = async () => {
    const n = parseInt(dueDays, 10);
    if (!Number.isInteger(n) || n < 1 || n > 30) {
      toast({ title: 'Введите число от 1 до 30', variant: 'destructive' });
      return;
    }
    setDueDaysLoading(true);
    try {
      const url = `${getApiUrl('system_settings')}?resource=system_settings`;
      const res = await apiFetch(url, {
        method: 'PUT',
        body: JSON.stringify({ key: 'default_due_working_days', value: String(n) }),
      });
      if (res.ok) {
        setDueDays(String(n));
        toast({ title: `Дедлайн по умолчанию: ${n} раб. дн.` });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error || 'Не удалось сохранить настройку', variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Ошибка соединения с сервером', variant: 'destructive' });
    } finally {
      setDueDaysLoading(false);
    }
  };

  const handleClassificationModeToggle = async (checked: boolean) => {
    const newMode = checked ? 'ai' : 'manual';
    const prevMode = classificationMode;
    setClassificationMode(newMode);
    setClassificationLoading(true);
    try {
      const url = `${getApiUrl('system_settings')}?resource=system_settings`;
      const res = await apiFetch(url, {
        method: 'PUT',
        body: JSON.stringify({ key: 'classification_mode', value: newMode }),
      });
      if (res.ok) {
        toast({ title: `Режим классификации: ${newMode === 'ai' ? 'ИИ' : 'Ручной'}` });
      } else {
        setClassificationMode(prevMode);
        const err = await res.json().catch(() => ({}));
        toast({
          title: res.status === 401
            ? 'Необходима авторизация. Обновите страницу и войдите снова.'
            : err.error || 'Не удалось сохранить настройку',
          variant: 'destructive',
        });
      }
    } catch (e) {
      console.error(e);
      setClassificationMode(prevMode);
      toast({ title: 'Ошибка соединения с сервером', variant: 'destructive' });
    } finally {
      setClassificationLoading(false);
    }
  };

  const handleVsdeskSync = async () => {
    setSyncLoading(true);
    setSyncResult(null);
    let offset = 0;
    const limit = 10;
    let totals = { inserted: 0, skipped: 0, filtered: 0, errors: 0, processed: 0, total: 0 };
    let safetyHops = 0;
    try {
      while (true) {
        safetyHops += 1;
        if (safetyHops > 1000) break;
        const res = await fetch(`${func2url['vsdesk-sync']}?action=sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offset, limit }),
        });
        const data = await res.json();
        if (!data.success) {
          setSyncResult({ success: false, message: data.error || 'Ошибка синхронизации' });
          return;
        }
        totals = {
          inserted: totals.inserted + (data.inserted || 0),
          skipped: totals.skipped + (data.skipped || 0),
          filtered: totals.filtered + (data.filtered || 0),
          errors: totals.errors + (data.errors || 0),
          processed: data.processed,
          total: data.total,
        };
        if (data.done || data.batch_size === 0) break;
        offset = data.next_offset;
      }
      setSyncResult({
        success: true,
        message: `Готово. Добавлено: ${totals.inserted}, пропущено: ${totals.skipped}, ошибок: ${totals.errors}`,
      });
    } catch {
      setSyncResult({ success: false, message: 'Ошибка соединения с vsDesk' });
    } finally {
      setSyncLoading(false);
    }
  };

  const settingsAccessResources: Array<[string, string]> = [
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
  const canAccessSettings = settingsAccessResources.some(([r, a]) => hasPermission(r, a));

  useEffect(() => {
    if (!canAccessSettings) {
      navigate('/tickets');
    }
  }, [canAccessSettings, navigate]);

  if (!canAccessSettings) {
    return null;
  }

  const settingsSections = [
    {
      title: 'SLA',
      description: 'Настройка времени реакции и решения для заявок',
      icon: 'Clock',
      color: 'hsl(var(--primary))',
      items: [
        { name: 'Соглашения SLA', path: '/sla', icon: 'Clock', permission: { resource: 'sla', action: 'read' } },
        { name: 'Связь SLA с услугами', path: '/sla-service-mappings', icon: 'Link', permission: { resource: 'sla', action: 'read' } },
        { name: 'Аналитика SLA', path: '/sla-analytics', icon: 'BarChart3', permission: { resource: 'sla', action: 'read' } },
      ],
    },
    {
      title: 'Управление заявками',
      description: 'Услуги, категории, сервисы, статусы и приоритеты',
      icon: 'Ticket',
      color: 'hsl(var(--secondary))',
      items: [
        { name: 'Услуги заявок', path: '/ticket-services-management', icon: 'Wrench', permission: { resource: 'ticket_services', action: 'read' } },
        { name: 'Категории услуг', path: '/ticket-service-categories', icon: 'FolderTree', permission: { resource: 'ticket_service_categories', action: 'read' } },
        { name: 'Сервисы услуг', path: '/ticket-services', icon: 'Building2', permission: { resource: 'ticket_services', action: 'read' } },
        { name: 'Статусы заявок', path: '/ticket-statuses', icon: 'CircleDot', permission: { resource: 'ticket_statuses', action: 'read' } },
        { name: 'Приоритеты заявок', path: '/ticket-priorities', icon: 'AlertCircle', permission: { resource: 'ticket_priorities', action: 'read' } },
        { name: 'Наблюдатели', path: '/ticket-watcher-rules', icon: 'Eye', permission: { resource: 'ticket_priorities', action: 'read' } },
        { name: 'Шаблоны ответов', path: '/reply-templates', icon: 'MessageSquare', permission: { resource: 'ticket_priorities', action: 'read' } },
      ],
    },
    {
      title: 'Управление исполнителями',
      description: 'Группы, привязка исполнителей к услугам и графики работы',
      icon: 'UsersRound',
      color: 'hsl(var(--warning))',
      items: [
        { name: 'Группы исполнителей', path: '/executor-groups', icon: 'UsersRound', permission: { resource: 'executor_groups', action: 'read' } },
        { name: 'Привязка исполнителей', path: '/executor-assignments', icon: 'UserCheck', permission: { resource: 'executor_groups', action: 'read' } },
        { name: 'Графики работы', path: '/work-schedules', icon: 'Calendar', permission: { resource: 'executor_groups', action: 'read' } },
      ],
    },
    {
      title: 'Структура компании',
      description: 'Компании, подразделения и должности',
      icon: 'Building2',
      color: 'hsl(var(--accent))',
      items: [
        { name: 'Компании', path: '/companies', icon: 'Building2', permission: { resource: 'companies', action: 'read' } },
        { name: 'Подразделения', path: '/departments', icon: 'Network', permission: { resource: 'departments', action: 'read' } },
        { name: 'Должности', path: '/positions', icon: 'Briefcase', permission: { resource: 'positions', action: 'read' } },
        { name: 'Оргструктура', path: '/org-chart', icon: 'GitBranch', permission: { resource: 'departments', action: 'read' } },
      ],
    },
    {
      title: 'Управление полями',
      description: 'Реестр полей, группы и связь с услугами',
      icon: 'Database',
      color: 'hsl(var(--success))',
      items: [
        { name: 'Реестр полей', path: '/field-registry', icon: 'Database', permission: { resource: 'field_registry', action: 'read' } },
        { name: 'Группы полей', path: '/custom-field-groups', icon: 'Layers', permission: { resource: 'custom_field_groups', action: 'read' } },
        { name: 'Связь услуг с полями', path: '/service-field-mappings', icon: 'Link', permission: { resource: 'service_field_mappings', action: 'read' } },
      ],
    },
    {
      title: 'Пользователи',
      description: 'Управление пользователями системы',
      icon: 'Users',
      color: 'hsl(var(--primary))',
      path: '/users',
      permission: { resource: 'users', action: 'read' },
    },
    {
      title: 'Права доступа',
      description: 'Роли и разрешения пользователей',
      icon: 'Shield',
      color: 'hsl(var(--secondary))',
      path: '/roles',
      permission: { resource: 'roles', action: 'read' },
    },
    {
      title: 'Обучение AI',
      description: 'Примеры заявок и правила для автоматической классификации',
      icon: 'Sparkles',
      color: 'hsl(280, 80%, 55%)',
      path: '/ai-training',
      permission: { resource: 'settings', action: 'read' },
    },
    {
      title: 'Неактивные в Битрикс',
      description: 'Пользователи, которые не заходили в Битрикс24',
      icon: 'UserX',
      color: 'hsl(25, 80%, 55%)',
      path: '/bitrix-inactive-users',
      permission: { resource: 'settings', action: 'read' },
    },
    {
      title: 'Автоматизация',
      description: 'Периодический запуск синхронизации и проверок',
      icon: 'Zap',
      color: 'hsl(160, 70%, 45%)',
      path: '/settings/automation',
      permission: { resource: 'settings', action: 'read' },
    },
    {
      title: 'Анализатор логов',
      description: 'Просмотр и анализ системных логов',
      icon: 'FileText',
      color: 'hsl(var(--accent))',
      path: '/log-analyzer',
      permission: { resource: 'log_analyzer', action: 'read' },
    },
  ];

  return (
    <PageLayout>
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Основные настройки</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Управление данными проекта
          </p>
        </div>
      </header>

      {hasPermission('settings', 'read') && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-orange-500/10">
                <Icon name="RefreshCw" size={20} className="text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-base">Интеграции</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Синхронизация данных с внешними системами
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center">
                  <Icon name="Server" size={16} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">vsDesk</p>
                  <p className="text-xs text-muted-foreground">Заявки, комментарии, файлы, история, наблюдатели</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {syncResult && (
                  <span className={`text-xs ${syncResult.success ? 'text-green-500' : 'text-red-500'}`}>
                    {syncResult.message}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/settings/vsdesk')}
                  className="gap-2"
                >
                  <Icon name="Settings" size={14} />
                  Настроить
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleVsdeskSync}
                  disabled={syncLoading}
                  className="gap-2"
                >
                  <Icon name={syncLoading ? 'Loader2' : 'RefreshCw'} size={14} className={syncLoading ? 'animate-spin' : ''} />
                  {syncLoading ? 'Синхронизация...' : 'Синхронизировать'}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 mt-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-purple-500/10 flex items-center justify-center">
                  <Icon name="UserPlus" size={16} className="text-purple-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Учётные записи сотрудников</p>
                  <p className="text-xs text-muted-foreground">Вебхуки Битрикс и корпоративная почта (РФ и КЗ)</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/settings/integrations')}
                className="gap-2"
              >
                <Icon name="Settings" size={14} />
                Настроить
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {hasPermission('settings', 'read') && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/10">
                <Icon name="Sparkles" size={20} className="text-purple-500" />
              </div>
              <div>
                <CardTitle className="text-base">Классификация заявок</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Выберите способ определения услуги и сервиса при создании заявки
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center ${classificationMode === 'ai' ? 'bg-purple-500/10' : 'bg-blue-500/10'}`}>
                  <Icon name={classificationMode === 'ai' ? 'Sparkles' : 'ListChecks'} size={16} className={classificationMode === 'ai' ? 'text-purple-500' : 'text-blue-500'} />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {classificationMode === 'ai' ? 'AI-классификация' : 'Ручной выбор'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {classificationMode === 'ai'
                      ? 'ИИ автоматически определяет услугу и сервис по описанию'
                      : 'Пользователь сам выбирает услугу и сервис из списков'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="classification-mode" className="text-xs text-muted-foreground">
                  {classificationMode === 'ai' ? 'AI' : 'Ручной'}
                </Label>
                <Switch
                  id="classification-mode"
                  checked={classificationMode === 'ai'}
                  onCheckedChange={handleClassificationModeToggle}
                  disabled={classificationLoading}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasPermission('settings', 'read') && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/10">
                <Icon name="CalendarClock" size={20} className="text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-base">Дедлайн по умолчанию</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Если для услуги не задан срок решения по SLA, дедлайн заявки ставится автоматически
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-amber-500/10 flex items-center justify-center">
                  <Icon name="Clock" size={16} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Срок решения по умолчанию</p>
                  <p className="text-xs text-muted-foreground">
                    Количество рабочих дней (выходные не учитываются)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={dueDays}
                  onChange={(e) => setDueDays(e.target.value)}
                  className="h-9 w-20 text-sm"
                />
                <Label className="text-xs text-muted-foreground">раб. дн.</Label>
                <Button
                  size="sm"
                  onClick={handleSaveDueDays}
                  disabled={dueDaysLoading}
                  className="gap-2"
                >
                  <Icon name={dueDaysLoading ? 'Loader2' : 'Check'} size={14} className={dueDaysLoading ? 'animate-spin' : ''} />
                  Сохранить
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {settingsSections.map((section) => {
          const hasAnyPermission = section.permission
            ? hasPermission(section.permission.resource, section.permission.action)
            : section.items?.some(item => hasPermission(item.permission.resource, item.permission.action));

          if (!hasAnyPermission) return null;

          return (
            <Card
              key={section.title}
              className="hover:border-primary/30 transition-colors cursor-pointer group"
              onClick={() => {
                if (section.path) {
                  navigate(section.path);
                }
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${section.color}20` }}
                  >
                    <Icon name={section.icon} size={20} style={{ color: section.color }} />
                  </div>
                  <div>
                    <CardTitle className="text-base group-hover:text-primary transition-colors">
                      {section.title}
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {section.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              {section.items && (
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    {section.items
                      .filter(item => hasPermission(item.permission.resource, item.permission.action))
                      .map((item) => (
                        <button
                          key={item.path}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(item.path);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/50 hover:bg-primary/10 hover:text-primary text-xs text-muted-foreground transition-colors"
                        >
                          <Icon name={item.icon} size={14} />
                          {item.name}
                        </button>
                      ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </PageLayout>
  );
};

export default Settings;