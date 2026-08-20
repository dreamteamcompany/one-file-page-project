import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Icon from '@/components/ui/icon';

export interface Filters {
  days: string;
  trigger: string;
  assignee: string;
  status: string;
  reaction: string;
  q: string;
}

interface Option {
  id: number;
  name?: string;
  full_name?: string;
}

interface Props {
  filters: Filters;
  assignees: Option[];
  statuses: Option[];
  onChange: (patch: Partial<Filters>) => void;
}

const ResponseFilters = ({ filters, assignees, statuses, onChange }: Props) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
    <div className="relative lg:col-span-1">
      <Icon
        name="Search"
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        value={filters.q}
        onChange={(e) => onChange({ q: e.target.value })}
        placeholder="Номер или тема"
        className="pl-9"
      />
    </div>

    <Select value={filters.days} onValueChange={(v) => onChange({ days: v })}>
      <SelectTrigger>
        <SelectValue placeholder="Период" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1">За сутки</SelectItem>
        <SelectItem value="7">За неделю</SelectItem>
        <SelectItem value="30">За месяц</SelectItem>
        <SelectItem value="90">За 3 месяца</SelectItem>
        <SelectItem value="365">За год</SelectItem>
      </SelectContent>
    </Select>

    <Select value={filters.trigger} onValueChange={(v) => onChange({ trigger: v })}>
      <SelectTrigger>
        <SelectValue placeholder="Триггер" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Все триггеры</SelectItem>
        <SelectItem value="no_reply">Триггер 1 — нет ответа</SelectItem>
        <SelectItem value="operator_silent">Триггер 2 — исполнитель молчит</SelectItem>
        <SelectItem value="customer_waiting">Триггер 3 — заказчик ждёт</SelectItem>
      </SelectContent>
    </Select>

    <Select value={filters.assignee} onValueChange={(v) => onChange({ assignee: v })}>
      <SelectTrigger>
        <SelectValue placeholder="Исполнитель" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Все исполнители</SelectItem>
        {assignees.map((a) => (
          <SelectItem key={a.id} value={String(a.id)}>
            {a.full_name || a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>

    <div className="grid grid-cols-2 gap-2">
      <Select value={filters.status} onValueChange={(v) => onChange({ status: v })}>
        <SelectTrigger>
          <SelectValue placeholder="Статус" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все статусы</SelectItem>
          {statuses.map((s) => (
            <SelectItem key={s.id} value={String(s.id)}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.reaction} onValueChange={(v) => onChange({ reaction: v })}>
        <SelectTrigger>
          <SelectValue placeholder="Реакция" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Любая реакция</SelectItem>
          <SelectItem value="silent">Без ответа</SelectItem>
          <SelectItem value="reacted">Ответили</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
);

export default ResponseFilters;
