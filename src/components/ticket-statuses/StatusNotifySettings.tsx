import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { apiFetch, getApiUrl } from '@/utils/api';

const EXCLUDED_GROUPS = ['исвс'];

interface TemplateOption {
  id: number;
  name: string;
  content: string;
  is_active: boolean;
}

interface GroupOption {
  id: number;
  name: string;
  is_active?: boolean;
}

interface Props {
  open: boolean;
  enabled: boolean;
  templateId: number | null;
  groupId: number | null;
  intervalHours: string;
  onChange: (patch: {
    notify_enabled?: boolean;
    notify_template_id?: number | null;
    notify_group_id?: number | null;
    notify_interval_hours?: string;
  }) => void;
}

const StatusNotifySettings = ({
  open,
  enabled,
  templateId,
  groupId,
  intervalHours,
  onChange,
}: Props) => {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);

  useEffect(() => {
    if (!open) return;

    apiFetch(`${getApiUrl('notification_templates')}?resource=notification_templates`)
      .then((res) => res.json())
      .then((data) => setTemplates(Array.isArray(data?.templates) ? data.templates : []))
      .catch(() => setTemplates([]));

    apiFetch(getApiUrl('executor-groups'))
      .then((res) => res.json())
      .then((data) => {
        const list: GroupOption[] = Array.isArray(data) ? data : [];
        setGroups(
          list.filter(
            (g) =>
              g.is_active !== false &&
              !EXCLUDED_GROUPS.includes((g.name || '').trim().toLowerCase())
          )
        );
      })
      .catch(() => setGroups([]));
  }, [open]);

  const activeTemplates = templates.filter((t) => t.is_active);

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Уведомление</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Регулярная рассылка, пока заявка находится в этом статусе
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => onChange({ notify_enabled: v })}
          />
        </div>

        {enabled && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Шаблон уведомления</Label>
              <Select
                value={templateId ? String(templateId) : ''}
                onValueChange={(v) => onChange({ notify_template_id: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите шаблон" />
                </SelectTrigger>
                <SelectContent>
                  {activeTemplates.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      Нет активных шаблонов — создайте их в Настройках → Уведомления
                    </div>
                  ) : (
                    activeTemplates.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Группа операторов</Label>
              <Select
                value={groupId ? String(groupId) : ''}
                onValueChange={(v) => onChange({ notify_group_id: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите группу исполнителей" />
                </SelectTrigger>
                <SelectContent>
                  {groups.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      Группы не загружены
                    </div>
                  ) : (
                    groups.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Отсчёт начинается от последнего сообщения оператора из этой группы
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Периодичность, часов</Label>
              <Input
                type="number"
                min={1}
                max={8760}
                value={intervalHours}
                onChange={(e) => onChange({ notify_interval_hours: e.target.value })}
                placeholder="Например: 24"
              />
            </div>

            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
              Уведомление уходит повторно каждые указанные часы, пока оператор не ответит
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusNotifySettings;