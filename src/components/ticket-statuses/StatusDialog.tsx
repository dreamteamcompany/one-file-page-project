import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Icon from '@/components/ui/icon';
import { apiFetch, API_URL } from '@/utils/api';
import type { TicketStatus, StatusFormData } from '@/hooks/useTicketStatuses';
import StatusNotifySettings from './StatusNotifySettings';

interface RoleOption {
  id: number;
  name: string;
  system_role?: string | null;
}

const predefinedColors = [
  { name: 'Серый', value: '#6b7280' },
  { name: 'Синий', value: '#3b82f6' },
  { name: 'Зелёный', value: '#22c55e' },
  { name: 'Жёлтый', value: '#eab308' },
  { name: 'Оранжевый', value: '#f97316' },
  { name: 'Красный', value: '#ef4444' },
  { name: 'Фиолетовый', value: '#a855f7' },
  { name: 'Розовый', value: '#ec4899' },
];

const STATUS_TYPES = [
  { value: 'is_open', label: 'Открытый', desc: 'заявка открыта' },
  { value: 'is_approval', label: 'Согласование', desc: 'на согласовании' },
  { value: 'is_approved', label: 'Согласовано', desc: 'согласована всеми' },
  { value: 'is_approval_revoked', label: 'Отозвано', desc: 'согласование отозвано' },
  { value: 'is_waiting_response', label: 'Ожидание', desc: 'ожидает ответа исполнителя' },
  { value: 'is_awaiting_confirmation', label: 'Подтверждение', desc: 'ожидает подтверждения заказчика' },
  { value: 'is_closed', label: 'Закрытый', desc: 'заявка завершена' },
] as const;

type StatusTypeValue = typeof STATUS_TYPES[number]['value'];

interface StatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingStatus: TicketStatus | null;
  onSave: (
    formData: StatusFormData,
    editingStatus: TicketStatus | null
  ) => Promise<boolean>;
  onReset: () => void;
}

const getActiveType = (formData: Record<string, boolean>): StatusTypeValue | '' => {
  for (const st of STATUS_TYPES) {
    if (formData[st.value]) return st.value;
  }
  return '';
};

const StatusDialog = ({
  open,
  onOpenChange,
  editingStatus,
  onSave,
  onReset,
}: StatusDialogProps) => {
  const defaultFormData: StatusFormData = {
    name: '',
    color: '#3b82f6',
    is_closed: false,
    is_open: false,
    is_approval: false,
    is_approval_revoked: false,
    is_approved: false,
    is_waiting_response: false,
    is_awaiting_confirmation: false,
    count_for_distribution: false,
    is_in_progress: false,
    is_reopened: false,
    role_ids: [],
    notify_enabled: false,
    notify_template_id: null,
    notify_interval_hours: '',
    notify_group_id: null,
    notify_user_ids: [],
    notify_rules: [],
  };

  const [formData, setFormData] = useState(defaultFormData);
  const [roles, setRoles] = useState<RoleOption[]>([]);

  useEffect(() => {
    if (!open) return;
    apiFetch(`${API_URL}?endpoint=roles`)
      .then((res) => res.json())
      .then((data) => {
        setRoles(Array.isArray(data) ? data : []);
      })
      .catch(() => setRoles([]));
  }, [open]);

  useEffect(() => {
    if (editingStatus) {
      setFormData({
        name: editingStatus.name,
        color: editingStatus.color,
        is_closed: editingStatus.is_closed,
        is_open: editingStatus.is_open || false,
        is_approval: editingStatus.is_approval || false,
        is_approval_revoked: editingStatus.is_approval_revoked || false,
        is_approved: editingStatus.is_approved || false,
        is_waiting_response: editingStatus.is_waiting_response || false,
        is_awaiting_confirmation: editingStatus.is_awaiting_confirmation || false,
        count_for_distribution: editingStatus.count_for_distribution || false,
        is_in_progress: editingStatus.is_in_progress || false,
        is_reopened: editingStatus.is_reopened || false,
        role_ids: editingStatus.role_ids ? [...editingStatus.role_ids] : [],
        notify_enabled: editingStatus.notify_enabled || false,
        notify_template_id: editingStatus.notify_template_id ?? null,
        notify_interval_hours:
          editingStatus.notify_interval_hours != null
            ? String(editingStatus.notify_interval_hours)
            : '',
        notify_group_id: editingStatus.notify_group_id ?? null,
        notify_user_ids: editingStatus.notify_user_ids
          ? [...editingStatus.notify_user_ids]
          : [],
        notify_rules: (editingStatus.notify_rules || []).map((r) => ({
          id: r.id,
          template_id: r.template_id ?? null,
          interval_hours: r.interval_hours != null ? String(r.interval_hours) : '',
          is_active: r.is_active !== false,
          user_ids: r.user_ids ? [...r.user_ids] : [],
        })),
      });
    } else {
      setFormData(defaultFormData);
    }
  }, [editingStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.notify_enabled) {
      const rules = formData.notify_rules || [];
      if (rules.length === 0) {
        alert('Добавьте хотя бы одно уведомление');
        return;
      }
      for (let i = 0; i < rules.length; i += 1) {
        const r = rules[i];
        if (!r.template_id) {
          alert(`Уведомление ${i + 1}: выберите шаблон`);
          return;
        }
        if (!r.user_ids || r.user_ids.length === 0) {
          alert(`Уведомление ${i + 1}: выберите хотя бы одного оператора`);
          return;
        }
        const hours = parseInt(r.interval_hours, 10);
        if (!Number.isFinite(hours) || hours < 1 || hours > 8760) {
          alert(`Уведомление ${i + 1}: укажите периодичность в часах (от 1 до 8760)`);
          return;
        }
      }
    }
    const success = await onSave(formData, editingStatus);
    if (success) {
      onOpenChange(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setFormData(defaultFormData);
    onReset();
  };

  const handleDialogClose = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      resetForm();
    }
  };

  const handleTypeChange = (value: string) => {
    const resetFlags: Record<string, boolean> = {};
    for (const st of STATUS_TYPES) {
      resetFlags[st.value] = st.value === value;
    }
    setFormData((prev) => ({ ...prev, ...resetFlags }));
  };

  const activeType = getActiveType(formData as unknown as Record<string, boolean>);

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 gap-2 w-full sm:w-auto">
          <Icon name="Plus" size={18} />
          <span className="sm:inline">Добавить статус</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingStatus ? 'Редактировать статус' : 'Новый статус'}
          </DialogTitle>
          <DialogDescription>
            {editingStatus
              ? 'Измените данные статуса'
              : 'Добавьте новый статус заявки'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Название</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Название статуса"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Цвет</Label>
            <div className="grid grid-cols-4 gap-2">
              {predefinedColors.map((colorOption) => (
                <button
                  key={colorOption.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: colorOption.value })}
                  className={`h-12 rounded-lg border-2 transition-all hover:scale-105 ${
                    formData.color === colorOption.value
                      ? 'border-foreground shadow-lg'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: colorOption.value }}
                  title={colorOption.name}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Label htmlFor="custom-color" className="text-sm">Свой цвет:</Label>
              <input
                id="custom-color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="h-10 w-20 rounded cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">{formData.color}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Тип статуса</Label>
            <RadioGroup value={activeType} onValueChange={handleTypeChange} className="grid grid-cols-2 gap-2">
              {STATUS_TYPES.map((st) => (
                <label
                  key={st.value}
                  htmlFor={st.value}
                  className={`flex items-start gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                    activeType === st.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/30'
                  }`}
                >
                  <RadioGroupItem value={st.value} id={st.value} className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-tight">{st.label}</div>
                    <div className="text-xs text-muted-foreground leading-tight mt-0.5">{st.desc}</div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="count_for_distribution"
                  checked={formData.count_for_distribution}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, count_for_distribution: checked as boolean })
                  }
                />
                <Label
                  htmlFor="count_for_distribution"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Учитывать при распределении заявок
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 ml-6">
                Заявки в этом статусе учитываются при балансировке нагрузки между исполнителями
              </p>
            </div>

            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_in_progress"
                  checked={formData.is_in_progress}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_in_progress: checked as boolean })
                  }
                />
                <Label
                  htmlFor="is_in_progress"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  В работе
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 ml-6">
                Заявка с этим статусом считается взятой в работу
              </p>
            </div>

            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_reopened"
                  checked={formData.is_reopened}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_reopened: checked as boolean })
                  }
                />
                <Label
                  htmlFor="is_reopened"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Открыта повторно
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 ml-6">
                Заявка с этим статусом считается переоткрытой
              </p>
            </div>
          </div>

          <StatusNotifySettings
            open={open}
            enabled={formData.notify_enabled}
            rules={formData.notify_rules}
            onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
          />

          <div className="space-y-2">
            <Label>Доступно для ролей</Label>
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Выберите роли, которым будет виден этот статус. Если не выбрана ни одна роль —
                статус скрыт у всех, кроме администратора.
              </p>
              {roles.length === 0 ? (
                <p className="text-xs text-muted-foreground">Роли не загружены</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {roles.map((role) => {
                    const checked = formData.role_ids.includes(role.id);
                    const isAdminRole = (role.system_role || '').toLowerCase() === 'admin';
                    return (
                      <label
                        key={role.id}
                        htmlFor={`role-${role.id}`}
                        className={`flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer transition-colors ${
                          checked
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/30'
                        } ${isAdminRole ? 'opacity-70' : ''}`}
                      >
                        <Checkbox
                          id={`role-${role.id}`}
                          checked={checked || isAdminRole}
                          disabled={isAdminRole}
                          onCheckedChange={(c) => {
                            if (isAdminRole) return;
                            setFormData((prev) => ({
                              ...prev,
                              role_ids: c
                                ? [...prev.role_ids, role.id]
                                : prev.role_ids.filter((id) => id !== role.id),
                            }));
                          }}
                        />
                        <span className="truncate">{role.name}</span>
                        {isAdminRole && (
                          <span className="ml-auto text-[10px] text-muted-foreground">всегда</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">
              {editingStatus ? 'Сохранить' : 'Создать'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogClose(false)}
            >
              Отмена
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default StatusDialog;