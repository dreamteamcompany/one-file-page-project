import { useEffect, useState } from 'react';
import { apiFetch, getApiUrl } from '@/utils/api';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ChecklistService {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
}

const ENDPOINT = 'access-checklist-services';

const AccessChecklistServices = () => {
  const { toast } = useToast();
  const [services, setServices] = useState<ChecklistService[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChecklistService | null>(null);
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<ChecklistService | null>(null);

  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) setMenuOpen(false);
  };

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await apiFetch(`${getApiUrl(ENDPOINT)}?endpoint=${ENDPOINT}`);
      if (!res.ok) {
        setLoadError('Не удалось загрузить справочник');
        return;
      }
      const data = await res.json();
      setServices(Array.isArray(data.services) ? data.services : []);
    } catch {
      setLoadError('Нет связи с сервером. Справочник не загружен');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setIsActive(true);
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (service: ChecklistService) => {
    setEditing(service);
    setName(service.name);
    setIsActive(service.is_active);
    setFormError('');
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setFormError('Укажите название сервиса');
      return;
    }
    if (trimmed.length > 255) {
      setFormError('Название не должно превышать 255 символов');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const url = editing
        ? `${getApiUrl(ENDPOINT)}?endpoint=${ENDPOINT}&id=${editing.id}`
        : `${getApiUrl(ENDPOINT)}?endpoint=${ENDPOINT}`;

      const res = await apiFetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, is_active: isActive }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data?.error || 'Не удалось сохранить сервис');
        return;
      }

      toast({
        title: editing ? 'Сервис обновлён' : 'Сервис добавлен',
        description: editing
          ? 'Изменения применятся только к новым заявкам'
          : 'Новый пункт появится в чек-листах новых заявок',
      });
      setDialogOpen(false);
      load();
    } catch {
      setFormError('Нет связи с сервером. Изменения не сохранены');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (service: ChecklistService) => {
    try {
      const res = await apiFetch(
        `${getApiUrl(ENDPOINT)}?endpoint=${ENDPOINT}&id=${service.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: !service.is_active }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: 'Не удалось изменить',
          description: data?.error || 'Попробуйте ещё раз',
          variant: 'destructive',
        });
        return;
      }
      load();
    } catch {
      toast({
        title: 'Нет связи с сервером',
        description: 'Изменение не сохранено',
        variant: 'destructive',
      });
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = services[index + direction];
    const current = services[index];
    if (!target || !current) return;

    try {
      await Promise.all([
        apiFetch(`${getApiUrl(ENDPOINT)}?endpoint=${ENDPOINT}&id=${current.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: target.sort_order }),
        }),
        apiFetch(`${getApiUrl(ENDPOINT)}?endpoint=${ENDPOINT}&id=${target.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: current.sort_order }),
        }),
      ]);
      load();
    } catch {
      toast({
        title: 'Не удалось изменить порядок',
        description: 'Попробуйте ещё раз',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await apiFetch(
        `${getApiUrl(ENDPOINT)}?endpoint=${ENDPOINT}&id=${deleteTarget.id}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: 'Не удалось удалить',
          description: data?.error || 'Попробуйте ещё раз',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Сервис удалён',
        description: 'В уже созданных заявках пункт остаётся на месте',
      });
      load();
    } catch {
      toast({
        title: 'Нет связи с сервером',
        description: 'Сервис не удалён',
        variant: 'destructive',
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex min-h-screen">
      <PaymentsSidebar
        menuOpen={menuOpen}
        dictionariesOpen={dictionariesOpen}
        setDictionariesOpen={setDictionariesOpen}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        handleTouchStart={handleTouchStart}
        handleTouchMove={handleTouchMove}
        handleTouchEnd={handleTouchEnd}
      />

      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main className={`${collapsed ? 'lg:ml-[70px]' : 'lg:ml-[250px]'} p-4 md:p-6 lg:p-[30px] min-h-screen flex-1 overflow-x-hidden max-w-full transition-all duration-300`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMenuOpen(true)}
              title="Меню"
              aria-label="Меню"
            >
              <Icon name="Menu" size={24} />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">Чек-лист блокировки доступов</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Список сервисов, из которых удаляют учётную запись увольняющегося сотрудника.
                Изменения влияют только на новые заявки.
              </p>
            </div>
          </div>
          <Button className="gap-2 w-full sm:w-auto" onClick={openCreate}>
            <Icon name="Plus" size={18} />
            Добавить сервис
          </Button>
        </div>

        {loading && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <Icon name="Loader2" size={20} className="animate-spin mx-auto mb-2" />
              Загрузка справочника…
            </CardContent>
          </Card>
        )}

        {!loading && loadError && (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-destructive mb-3 flex items-center justify-center gap-2">
                <Icon name="AlertCircle" size={18} />
                {loadError}
              </p>
              <Button variant="outline" onClick={load}>
                Повторить
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !loadError && services.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Icon name="ListChecks" size={32} className="mx-auto mb-3 opacity-50" />
              <p>Пока нет ни одного сервиса</p>
              <Button variant="outline" className="mt-3" onClick={openCreate}>
                Добавить первый
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !loadError && services.length > 0 && (
          <div className="space-y-2">
            {services.map((service, index) => (
              <Card key={service.id} className={service.is_active ? '' : 'opacity-60'}>
                <CardContent className="p-3 md:p-4 flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      title="Переместить выше"
                      aria-label="Переместить выше"
                    >
                      <Icon name="ChevronUp" size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === services.length - 1}
                      onClick={() => move(index, 1)}
                      title="Переместить ниже"
                      aria-label="Переместить ниже"
                    >
                      <Icon name="ChevronDown" size={14} />
                    </Button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium break-words">{service.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {service.is_active ? 'Попадает в новые заявки' : 'Отключён'}
                    </p>
                  </div>

                  <Switch
                    checked={service.is_active}
                    onCheckedChange={() => toggleActive(service)}
                    aria-label={service.is_active ? 'Отключить сервис' : 'Включить сервис'}
                  />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(service)}
                    title="Редактировать"
                    aria-label="Редактировать"
                  >
                    <Icon name="Pencil" size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setDeleteTarget(service)}
                    title="Удалить"
                    aria-label="Удалить"
                  >
                    <Icon name="Trash2" size={15} />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editing ? 'Редактировать сервис' : 'Новый сервис'}</DialogTitle>
              <DialogDescription>
                Пункт появится в чек-листах новых заявок на блокировку доступа
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="service-name">Название сервиса</Label>
                <Input
                  id="service-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (formError) setFormError('');
                  }}
                  maxLength={255}
                  placeholder="Например: Битрикс РФ"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch id="service-active" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="service-active" className="font-normal cursor-pointer">
                  Включать в чек-лист новых заявок
                </Label>
              </div>

              {formError && (
                <p className="text-sm text-destructive flex items-center gap-1.5">
                  <Icon name="AlertCircle" size={14} />
                  {formError}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Сохранение…' : editing ? 'Сохранить' : 'Добавить'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сервис?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.name}» перестанет попадать в новые заявки.
              В уже созданных заявках пункт останется на месте вместе с отметками.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AccessChecklistServices;
