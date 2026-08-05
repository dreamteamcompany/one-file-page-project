import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getApiUrl } from '@/utils/api';
import PageLayout from '@/components/layout/PageLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SLA {
  id: number;
  name: string;
  response_time_minutes: number;
  resolution_time_minutes: number;
}

interface TicketService {
  id: number;
  name: string;
}

interface Service {
  id: number;
  name: string;
}

interface Mapping {
  id: number;
  sla_id: number;
  ticket_service_id: number | null;
  service_id: number | null;
  sla_name: string;
  ticket_service_name: string | null;
  service_name: string | null;
  response_time_minutes: number;
  resolution_time_minutes: number;
  response_notification_minutes: number;
  resolution_notification_minutes: number;
  created_at: string;
}

const formatTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} мин`;
  if (mins === 0) return `${hours} ч`;
  return `${hours} ч ${mins} мин`;
};

const SlaServiceMappings = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [slas, setSlas] = useState<SLA[]>([]);
  const [ticketServices, setTicketServices] = useState<TicketService[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<Mapping | null>(null);
  const [formData, setFormData] = useState({
    sla_id: '',
    ticket_service_id: '',
    service_id: '',
  });

  useEffect(() => {
    if (!hasPermission('sla', 'read')) {
      navigate('/tickets');
      return;
    }
    loadAll();
  }, [hasPermission, navigate]);

  if (!hasPermission('sla', 'read')) return null;

  const loadAll = () => {
    Promise.all([
      loadMappings(),
      loadSlas(),
      loadTicketServices(),
      loadServices(),
    ]).finally(() => setLoading(false));
  };

  const loadMappings = () =>
    apiFetch(`${getApiUrl('sla-service-mappings')}?endpoint=sla-service-mappings`)
      .then(r => r.json())
      .then(data => setMappings(Array.isArray(data) ? data : []))
      .catch(() => setMappings([]));

  const loadSlas = () =>
    apiFetch(`${getApiUrl('sla')}?endpoint=sla`)
      .then(r => r.json())
      .then(data => setSlas(Array.isArray(data) ? data : []))
      .catch(() => setSlas([]));

  const loadTicketServices = () =>
    apiFetch(`${getApiUrl('ticket_services')}?endpoint=ticket_services`)
      .then(r => r.json())
      .then(data => setTicketServices(Array.isArray(data) ? data : []))
      .catch(() => setTicketServices([]));

  const loadServices = () =>
    apiFetch(`${getApiUrl('services')}?endpoint=services`)
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data?.services || [];
        setServices(list);
      })
      .catch(() => setServices([]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sla_id) return;

    const body: Record<string, unknown> = {
      sla_id: Number(formData.sla_id),
      ticket_service_id: formData.ticket_service_id ? Number(formData.ticket_service_id) : null,
      service_id: formData.service_id ? Number(formData.service_id) : null,
    };

    if (editingMapping) body.id = editingMapping.id;

    const method = editingMapping ? 'PUT' : 'POST';
    const res = await apiFetch(`${getApiUrl('sla-service-mappings')}?endpoint=sla-service-mappings`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setDialogOpen(false);
      resetForm();
      loadMappings();
    } else {
      const data = await res.json();
      alert(data.error || 'Ошибка сохранения');
    }
  };

  const handleEdit = (m: Mapping) => {
    setEditingMapping(m);
    setFormData({
      sla_id: String(m.sla_id),
      ticket_service_id: m.ticket_service_id ? String(m.ticket_service_id) : '',
      service_id: m.service_id ? String(m.service_id) : '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить эту связь?')) return;
    const res = await apiFetch(`${getApiUrl('sla-service-mappings')}?endpoint=sla-service-mappings`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) loadMappings();
    else {
      const data = await res.json();
      alert(data.error || 'Ошибка удаления');
    }
  };

  const resetForm = () => {
    setEditingMapping(null);
    setFormData({ sla_id: '', ticket_service_id: '', service_id: '' });
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetForm();
  };

  return (
    <PageLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/sla')} className="p-2 hover:bg-accent/30 rounded-lg transition-colors">
            <Icon name="ArrowLeft" size={20} />
          </button>
          <div>
            <h1 className="text-lg md:text-xl font-bold">Связь SLA с услугами</h1>
            <p className="text-xs text-muted-foreground">Привязка соглашений к комбинациям услуга + сервис</p>
          </div>
        </div>
        {hasPermission('sla', 'create') && (
          <Button
            onClick={() => { resetForm(); setDialogOpen(true); }}
            className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
          >
            <Icon name="Plus" size={20} className="mr-2" />
            Добавить связь
          </Button>
        )}
      </div>

      <p className="text-muted-foreground text-sm mb-4">
        Всего связей: {mappings.length}
      </p>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : mappings.length === 0 ? (
        <Card className="bg-card/50 border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Icon name="Link" size={64} className="text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Связи не настроены</h3>
            <p className="text-muted-foreground mb-4 text-center">
              Привяжите SLA к комбинациям услуга + сервис
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mappings.map((m) => (
            <Card key={m.id} className="bg-card/50 border-border hover:border-border/80 transition-all">
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Icon name="Clock" size={18} className="text-primary" />
                    <span className="font-semibold text-sm">{m.sla_name}</span>
                  </div>
                  <div className="flex gap-1">
                    {hasPermission('sla', 'update') && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(m)} title="Редактировать" aria-label="Редактировать">
                        <Icon name="Pencil" size={14} />
                      </Button>
                    )}
                    {hasPermission('sla', 'remove') && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-500/10" onClick={() => handleDelete(m.id)} title="Удалить" aria-label="Удалить">
                        <Icon name="Trash2" size={14} />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  {m.ticket_service_name && (
                    <div className="flex items-center gap-2">
                      <Icon name="Wrench" size={14} className="text-muted-foreground" />
                      <span>{m.ticket_service_name}</span>
                    </div>
                  )}
                  {m.service_name && (
                    <div className="flex items-center gap-2">
                      <Icon name="Building2" size={14} className="text-muted-foreground" />
                      <span>{m.service_name}</span>
                    </div>
                  )}
                  <div className="flex gap-4 pt-2 border-t border-border text-muted-foreground">
                    <span>Реакция: {formatTime(m.response_time_minutes)}</span>
                    <span>Решение: {formatTime(m.resolution_time_minutes)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMapping ? 'Редактировать связь' : 'Добавить связь'}</DialogTitle>
            <DialogDescription>Привяжите SLA к комбинации услуга + сервис</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>SLA</Label>
              <Select value={formData.sla_id} onValueChange={(v) => setFormData({ ...formData, sla_id: v })}>
                <SelectTrigger><SelectValue placeholder="Выберите SLA" /></SelectTrigger>
                <SelectContent>
                  {slas.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Услуга (необязательно)</Label>
              <Select value={formData.ticket_service_id || 'none'} onValueChange={(v) => setFormData({ ...formData, ticket_service_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Любая услуга" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Любая услуга</SelectItem>
                  {ticketServices.map(ts => (
                    <SelectItem key={ts.id} value={String(ts.id)}>{ts.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Сервис (необязательно)</Label>
              <Select value={formData.service_id || 'none'} onValueChange={(v) => setFormData({ ...formData, service_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Любой сервис" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Любой сервис</SelectItem>
                  {services.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={!formData.sla_id}>
                {editingMapping ? 'Сохранить' : 'Добавить'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default SlaServiceMappings;