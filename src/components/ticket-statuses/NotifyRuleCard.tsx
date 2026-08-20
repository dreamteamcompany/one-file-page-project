import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import NotifyOperatorsPicker, {
  OperatorOption,
} from '@/components/ticket-statuses/NotifyOperatorsPicker';

export interface NotifyRule {
  id?: number;
  template_id: number | null;
  interval_hours: string;
  is_active: boolean;
  user_ids: number[];
}

interface TemplateOption {
  id: number;
  name: string;
  is_active: boolean;
}

interface Props {
  rule: NotifyRule;
  index: number;
  templates: TemplateOption[];
  operators: OperatorOption[];
  onChange: (patch: Partial<NotifyRule>) => void;
  onRemove: () => void;
}

const NotifyRuleCard = ({
  rule,
  index,
  templates,
  operators,
  onChange,
  onRemove,
}: Props) => (
  <div
    className={`rounded-lg border p-3 space-y-3 ${
      rule.is_active ? 'border-border' : 'border-dashed opacity-70'
    }`}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium">Уведомление {index + 1}</span>
      <div className="flex items-center gap-2">
        <Switch
          checked={rule.is_active}
          onCheckedChange={(v) => onChange({ is_active: v })}
          aria-label="Включить уведомление"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-500 hover:text-red-500"
          onClick={onRemove}
          title="Удалить уведомление"
          aria-label="Удалить уведомление"
        >
          <Icon name="Trash2" size={16} />
        </Button>
      </div>
    </div>

    <div className="space-y-1.5">
      <Label className="text-sm">Шаблон уведомления</Label>
      <Select
        value={rule.template_id ? String(rule.template_id) : ''}
        onValueChange={(v) => onChange({ template_id: Number(v) })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Выберите шаблон" />
        </SelectTrigger>
        <SelectContent>
          {templates.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              Нет активных шаблонов — создайте их в Настройках → Уведомления
            </div>
          ) : (
            templates.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>

    <div className="space-y-1.5">
      <Label className="text-sm">Операторы</Label>
      <NotifyOperatorsPicker
        operators={operators}
        selectedIds={rule.user_ids}
        onChange={(ids) => onChange({ user_ids: ids })}
      />
    </div>

    <div className="space-y-1.5">
      <Label className="text-sm">Периодичность, часов</Label>
      <Input
        type="number"
        min={1}
        max={8760}
        value={rule.interval_hours}
        onChange={(e) => onChange({ interval_hours: e.target.value })}
        placeholder="Например: 24"
      />
    </div>
  </div>
);

export default NotifyRuleCard;
