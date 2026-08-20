import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import { apiFetch, getApiUrl } from '@/utils/api';
import { OperatorOption } from '@/components/ticket-statuses/NotifyOperatorsPicker';
import NotifyRuleCard, { NotifyRule } from '@/components/ticket-statuses/NotifyRuleCard';

interface TemplateOption {
  id: number;
  name: string;
  content: string;
  is_active: boolean;
}

interface Props {
  open: boolean;
  enabled: boolean;
  rules: NotifyRule[];
  onChange: (patch: {
    notify_enabled?: boolean;
    notify_rules?: NotifyRule[];
  }) => void;
}

export const EMPTY_RULE: NotifyRule = {
  template_id: null,
  interval_hours: '',
  is_active: true,
  user_ids: [],
};

const StatusNotifySettings = ({ open, enabled, rules, onChange }: Props) => {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [operators, setOperators] = useState<OperatorOption[]>([]);

  useEffect(() => {
    if (!open) return;

    apiFetch(`${getApiUrl('notification_templates')}?resource=notification_templates`)
      .then((res) => res.json())
      .then((data) => setTemplates(Array.isArray(data?.templates) ? data.templates : []))
      .catch(() => setTemplates([]));

    apiFetch(`${getApiUrl('status-notify-operators')}?endpoint=status-notify-operators`)
      .then((res) => res.json())
      .then((data) =>
        setOperators(Array.isArray(data?.operators) ? data.operators : []),
      )
      .catch(() => setOperators([]));
  }, [open]);

  const activeTemplates = templates.filter((t) => t.is_active);

  const patchRule = (index: number, patch: Partial<NotifyRule>) => {
    onChange({
      notify_rules: rules.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    });
  };

  const removeRule = (index: number) => {
    onChange({ notify_rules: rules.filter((_, i) => i !== index) });
  };

  const addRule = () => {
    onChange({ notify_rules: [...rules, { ...EMPTY_RULE }] });
  };

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Уведомления</Label>
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
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            {rules.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Уведомлений пока нет — добавьте первое
              </p>
            ) : (
              rules.map((rule, i) => (
                <NotifyRuleCard
                  key={rule.id ?? `new-${i}`}
                  rule={rule}
                  index={i}
                  templates={activeTemplates}
                  operators={operators}
                  onChange={(patch) => patchRule(i, patch)}
                  onRemove={() => removeRule(i)}
                />
              ))
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRule}
              className="w-full gap-2"
            >
              <Icon name="Plus" size={16} />
              Добавить уведомление
            </Button>

            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
              Каждое уведомление работает независимо: свой шаблон, свои операторы
              и своя периодичность
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusNotifySettings;
