import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getApiUrl, cachedJsonFetch } from '@/utils/api';
import PageLayout from '@/components/layout/PageLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { GroupBudgetItem } from '@/components/sla/SlaGroupBudgets';
import SlaCard from './sla/SlaCard';
import SlaFormDialog from './sla/SlaFormDialog';
import SlaCopyDialog from './sla/SlaCopyDialog';
import {
  PriorityTime,
  SLAItem,
  TicketStatus,
  TicketPriority,
  DEFAULT_FORM,
} from './sla/types';

const SLA = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [slas, setSlas] = useState<SLAItem[]>([]);
  const [statuses, setStatuses] = useState<TicketStatus[]>([]);
  const [priorities, setPriorities] = useState<TicketPriority[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSla, setEditingSla] = useState<SLAItem | null>(null);
  const [formData, setFormData] = useState({ ...DEFAULT_FORM });
  const [priorityTimes, setPriorityTimes] = useState<PriorityTime[]>([]);
  const [priorityTimesEnabled, setPriorityTimesEnabled] = useState(false);
  const [groupBudgets, setGroupBudgets] = useState<GroupBudgetItem[]>([]);
  const [groupBudgetsValid, setGroupBudgetsValid] = useState(true);
  const [expandedSla, setExpandedSla] = useState<number | null>(null);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);

  useEffect(() => {
    if (!hasPermission('sla', 'read')) {
      navigate('/tickets');
      return;
    }
    loadSlas();
    loadStatuses();
    loadPriorities();
  }, [hasPermission, navigate]);

  if (!hasPermission('sla', 'read')) return null;

  const loadSlas = () => {
    apiFetch(`${getApiUrl('sla')}?endpoint=sla`)
      .then(res => res.json())
      .then((data) => {
        setSlas(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setSlas([]);
        setLoading(false);
      });
  };

  // Справочники статусов и приоритетов здесь только для выпадающих списков —
  // берём их из общего кэша (10 минут), а не отдельным запросом при каждом входе.
  const DICT_TTL_MS = 10 * 60 * 1000;

  const loadStatuses = () => {
    cachedJsonFetch<TicketStatus[]>(
      `${getApiUrl('ticket-statuses')}?endpoint=ticket-statuses`, {}, DICT_TTL_MS,
    )
      .then((data) => setStatuses(Array.isArray(data) ? data : []))
      .catch(() => setStatuses([]));
  };

  const loadPriorities = () => {
    cachedJsonFetch<TicketPriority[]>(
      `${getApiUrl('ticket-priorities')}?endpoint=ticket-priorities`, {}, DICT_TTL_MS,
    )
      .then((data) => setPriorities(Array.isArray(data) ? data : []))
      .catch(() => setPriorities([]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const requiredPermission = editingSla ? 'update' : 'create';
    if (!hasPermission('sla', requiredPermission)) return;

    if (priorityTimesEnabled && priorityTimes.length === 0) {
      alert('Включены времена по приоритетам, но ни один приоритет не добавлен');
      return;
    }

    if (!groupBudgetsValid) {
      alert('Сумма бюджетов групп превышает общий SLA. Уменьшите время у одной из групп.');
      return;
    }

    const url = `${getApiUrl('sla')}?endpoint=sla`;
    const method = editingSla ? 'PUT' : 'POST';

    const submitData = {
      ...(editingSla ? { id: editingSla.id } : {}),
      ...formData,
      priority_times: priorityTimesEnabled ? priorityTimes : [],
    };

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitData),
    });

    if (res.ok) {
      const result = await res.json();
      const slaId = editingSla?.id || result.id;

      if (slaId && groupBudgets.length > 0) {
        const budgetRes = await apiFetch(`${getApiUrl('sla-group-budgets')}?endpoint=sla-group-budgets`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sla_id: slaId, budgets: groupBudgets }),
        });

        if (!budgetRes.ok) {
          const budgetError = await budgetRes.json();
          alert(`Ошибка сохранения бюджетов групп: ${budgetError.error || 'Неизвестная ошибка'}`);
        }
      }

      setDialogOpen(false);
      setEditingSla(null);
      setFormData({ ...DEFAULT_FORM });
      setPriorityTimes([]);
      setPriorityTimesEnabled(false);
      setGroupBudgets([]);
      loadSlas();
    } else {
      const errData = await res.json();
      alert(errData.error || 'Ошибка сохранения SLA');
    }
  };

  const handleEdit = (sla: SLAItem) => {
    if (!hasPermission('sla', 'update')) return;
    setEditingSla(sla);
    setFormData({
      name: sla.name,
      response_time_minutes: sla.response_time_minutes,
      response_notification_minutes: sla.response_notification_minutes,
      no_response_minutes: sla.no_response_minutes || 1440,
      no_response_status_id: sla.no_response_status_id,
      resolution_time_minutes: sla.resolution_time_minutes,
      resolution_notification_minutes: sla.resolution_notification_minutes,
      use_work_schedule: sla.use_work_schedule || false,
    });

    if (sla.priority_times && sla.priority_times.length > 0) {
      setPriorityTimesEnabled(true);
      setPriorityTimes(sla.priority_times.map(pt => ({
        priority_id: pt.priority_id,
        response_time_minutes: pt.response_time_minutes,
        response_notification_minutes: pt.response_notification_minutes,
        resolution_time_minutes: pt.resolution_time_minutes,
        resolution_notification_minutes: pt.resolution_notification_minutes,
      })));
    } else {
      setPriorityTimesEnabled(false);
      setPriorityTimes([]);
    }

    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!hasPermission('sla', 'remove')) return;
    if (!confirm('Вы уверены, что хотите удалить это SLA?')) return;

    const res = await apiFetch(`${getApiUrl('sla')}?endpoint=sla`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });

    if (res.ok) {
      loadSlas();
    } else {
      const data = await res.json();
      alert(data.error || 'Не удалось удалить SLA');
    }
  };

  const handleCopy = async (sourceId: number) => {
    if (!hasPermission('sla', 'create')) return;
    const res = await apiFetch(`${getApiUrl('sla')}?endpoint=sla`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ copy_from_id: sourceId }),
    });
    if (res.ok) {
      loadSlas();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Не удалось скопировать SLA');
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingSla(null);
      setFormData({ ...DEFAULT_FORM });
      setPriorityTimes([]);
      setPriorityTimesEnabled(false);
      setGroupBudgets([]);
    }
  };

  const getStatusName = (statusId?: number) => {
    if (!statusId) return '—';
    return statuses.find(s => s.id === statusId)?.name || '—';
  };

  const handlePriorityTimesToggle = (checked: boolean) => {
    setPriorityTimesEnabled(checked);
    if (checked && priorityTimes.length === 0 && priorities.length > 0) {
      setPriorityTimes(priorities.map(p => ({
        priority_id: p.id,
        response_time_minutes: formData.response_time_minutes,
        response_notification_minutes: formData.response_notification_minutes,
        resolution_time_minutes: formData.resolution_time_minutes,
        resolution_notification_minutes: formData.resolution_notification_minutes,
      })));
    }
    if (!checked) {
      setPriorityTimes([]);
    }
  };

  const updatePriorityTime = (priorityId: number, updates: Partial<PriorityTime>) => {
    setPriorityTimes(prev => prev.map(pt =>
      pt.priority_id === priorityId ? { ...pt, ...updates } : pt
    ));
  };

  const addPriorityTime = (priorityId: number) => {
    setPriorityTimes(prev => [...prev, {
      priority_id: priorityId,
      response_time_minutes: formData.response_time_minutes,
      response_notification_minutes: formData.response_notification_minutes,
      resolution_time_minutes: formData.resolution_time_minutes,
      resolution_notification_minutes: formData.resolution_notification_minutes,
    }]);
  };

  const removePriorityTime = (priorityId: number) => {
    setPriorityTimes(prev => prev.filter(pt => pt.priority_id !== priorityId));
  };

  const usedPriorityIds = priorityTimes.map(pt => pt.priority_id);
  const availablePriorities = priorities.filter(p => !usedPriorityIds.includes(p.id));

  const toggleExpand = (id: number) => {
    setExpandedSla(expandedSla === id ? null : id);
  };

  return (
    <PageLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="p-2 hover:bg-accent/30 rounded-lg transition-colors">
            <Icon name="ArrowLeft" size={20} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">SLA</h1>
            <p className="text-muted-foreground text-sm">
              Соглашения об уровне обслуживания
            </p>
          </div>
        </div>
        {hasPermission('sla', 'create') && (
          <div className="flex gap-2">
            {slas.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setCopyDialogOpen(true)}
              >
                <Icon name="Copy" size={18} className="mr-2" />
                Копировать
              </Button>
            )}
            <Button
              onClick={() => { setEditingSla(null); setPriorityTimes([]); setPriorityTimesEnabled(false); setGroupBudgets([]); setDialogOpen(true); }}
              className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
            >
              <Icon name="Plus" size={20} className="mr-2" />
              Создать SLA
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : slas.length === 0 ? (
        <Card className="bg-card/50 border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Icon name="Clock" size={64} className="text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">SLA не найдены</h3>
            <p className="text-muted-foreground mb-4 text-center">
              Создайте первое соглашение об уровне обслуживания
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {slas.map((sla) => (
            <SlaCard
              key={sla.id}
              sla={sla}
              expanded={expandedSla === sla.id}
              onToggle={() => toggleExpand(sla.id)}
              onEdit={() => handleEdit(sla)}
              onDelete={() => handleDelete(sla.id)}
              getStatusName={getStatusName}
              canEdit={hasPermission('sla', 'update')}
              canDelete={hasPermission('sla', 'remove')}
            />
          ))}
        </div>
      )}

      <SlaFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        editingSla={editingSla}
        formData={formData}
        setFormData={setFormData}
        statuses={statuses}
        priorities={priorities}
        priorityTimes={priorityTimes}
        priorityTimesEnabled={priorityTimesEnabled}
        onPriorityTimesToggle={handlePriorityTimesToggle}
        updatePriorityTime={updatePriorityTime}
        addPriorityTime={addPriorityTime}
        removePriorityTime={removePriorityTime}
        availablePriorities={availablePriorities}
        groupBudgets={groupBudgets}
        setGroupBudgets={setGroupBudgets}
        onGroupBudgetsValidChange={setGroupBudgetsValid}
        groupBudgetsValid={groupBudgetsValid}
        onSubmit={handleSubmit}
        onClose={() => handleDialogClose(false)}
      />

      <SlaCopyDialog
        open={copyDialogOpen}
        onOpenChange={setCopyDialogOpen}
        slas={slas}
        onCopy={handleCopy}
      />
    </PageLayout>
  );
};

export default SLA;