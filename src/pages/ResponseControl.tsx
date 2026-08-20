import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { apiFetch, getApiUrl } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import TriggerBadge from '@/components/response-control/TriggerBadge';
import ResponseSummary, { SummaryRow } from '@/components/response-control/ResponseSummary';
import ResponseFilters, { Filters } from '@/components/response-control/ResponseFilters';

interface LogItem {
  id: number;
  ticket_id: number;
  ticket_title: string;
  trigger_kind: string;
  interval_hours: number | null;
  reference_at: string | null;
  recipients_count: number;
  created_at: string;
  status_name: string | null;
  group_name: string | null;
  assignee_name: string | null;
  reacted: boolean;
  reacted_at: string | null;
}

const PAGE_SIZE = 50;

const DEFAULT_FILTERS: Filters = {
  days: '30',
  trigger: 'all',
  assignee: 'all',
  status: 'all',
  reaction: 'all',
  q: '',
};

const fmt = (v: string | null) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const hoursSince = (from: string | null, to: string | null) => {
  if (!from) return null;
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, Math.round((end - start) / 3_600_000));
};

const ResponseControl = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [items, setItems] = useState<LogItem[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [assignees, setAssignees] = useState<{ id: number; full_name: string }[]>([]);
  const [statuses, setStatuses] = useState<{ id: number; name: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const load = async (f: Filters, pageIndex: number) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        endpoint: 'response-control',
        days: f.days,
        limit: String(PAGE_SIZE),
        offset: String(pageIndex * PAGE_SIZE),
      });
      if (f.trigger !== 'all') qs.set('trigger', f.trigger);
      if (f.assignee !== 'all') qs.set('assignee', f.assignee);
      if (f.status !== 'all') qs.set('status', f.status);
      if (f.reaction !== 'all') qs.set('reaction', f.reaction);
      if (f.q.trim()) qs.set('q', f.q.trim());

      const res = await apiFetch(`${getApiUrl('response-control')}?${qs.toString()}`);
      if (res.status === 403) {
        setDenied(true);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error || 'Не удалось загрузить данные', variant: 'destructive' });
        return;
      }
      const data = await res.json();
      setItems(data.items || []);
      setSummary(data.summary || []);
      setAssignees(data.assignees || []);
      setStatuses(data.statuses || []);
      setTotal(data.total || 0);
    } catch {
      toast({ title: 'Ошибка соединения', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => load(filters, page), filters.q ? 300 : 0);
    return () => clearTimeout(t);
  }, [filters, page]);

  const patch = (p: Partial<Filters>) => {
    setPage(0);
    setFilters((prev) => ({ ...prev, ...p }));
  };

  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  if (denied) {
    return (
      <PageLayout>
        <Card>
          <CardContent className="py-16 text-center">
            <Icon name="Lock" size={48} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground">У вас нет доступа к этому разделу</p>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="gap-2">
            <Icon name="ArrowLeft" size={16} />
            Назад
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Icon name="AlarmClock" size={26} />
              Контроль реакции
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Заявки, по которым срабатывали напоминания о просроченном ответе
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-sm">
          Всего срабатываний: {total}
        </Badge>
      </header>

      <ResponseFilters
        filters={filters}
        assignees={assignees}
        statuses={statuses}
        onChange={patch}
      />

      <ResponseSummary
        rows={summary}
        activeAssignee={filters.assignee === 'all' ? '' : filters.assignee}
        onSelect={(id) => patch({ assignee: id || 'all' })}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Icon name="Loader2" size={28} className="animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Icon name="BellOff" size={48} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground">
              За выбранный период срабатываний нет
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const waited = hoursSince(it.reference_at, it.reacted_at);
            return (
              <Card
                key={it.id}
                className={`transition-colors ${it.reacted ? '' : 'border-red-200 bg-red-50/40'}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <TriggerBadge kind={it.trigger_kind} />
                        {it.reacted ? (
                          <Badge
                            variant="outline"
                            className="bg-green-100 text-green-800 border-green-200 font-normal"
                          >
                            Ответили
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-red-100 text-red-800 border-red-200 font-normal"
                          >
                            До сих пор без ответа
                          </Badge>
                        )}
                      </div>

                      <button
                        onClick={() => navigate(`/tickets/${it.ticket_id}`)}
                        className="text-left font-medium hover:text-primary transition-colors"
                      >
                        #{it.ticket_id} · {it.ticket_title}
                      </button>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Icon name="User" size={13} />
                          {it.assignee_name || 'Не назначен'}
                        </span>
                        {it.status_name && (
                          <span className="flex items-center gap-1">
                            <Icon name="CircleDot" size={13} />
                            {it.status_name}
                          </span>
                        )}
                        {it.group_name && (
                          <span className="flex items-center gap-1">
                            <Icon name="UsersRound" size={13} />
                            {it.group_name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground sm:text-right shrink-0 space-y-0.5">
                      <div>Уведомление: {fmt(it.created_at)}</div>
                      {waited !== null && (
                        <div className={it.reacted ? '' : 'text-red-600 font-medium'}>
                          {it.reacted ? 'Ответ через' : 'Молчание уже'} {waited} ч
                        </div>
                      )}
                      <div>Получателей: {it.recipients_count}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {maxPage > 0 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <Icon name="ChevronLeft" size={16} />
          </Button>
          <span className="text-sm text-muted-foreground">
            Страница {page + 1} из {maxPage + 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= maxPage}
            onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
          >
            <Icon name="ChevronRight" size={16} />
          </Button>
        </div>
      )}
    </PageLayout>
  );
};

export default ResponseControl;