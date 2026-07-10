import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

export type TicketsFiltersValue = {
  search_assignee?: string;
  search_creator?: string;
  search_status?: string;
  search_executor_group?: string;
  search_service?: string;
  search_ticket_service?: string;
  search_content?: string;
  due_from?: string;
  due_to?: string;
};

interface Props {
  value: TicketsFiltersValue;
  onChange: (next: TicketsFiltersValue) => void;
  debounceMs?: number;
  align?: 'left' | 'right';
  compact?: boolean;
  expanded?: boolean;
  onExpandedChange?: (next: boolean) => void;
}

const FIELDS: { key: keyof TicketsFiltersValue; label: string; placeholder: string; type?: 'text' | 'date' }[] = [
  { key: 'search_content', label: 'Содержание', placeholder: 'Поиск по заголовку, описанию и доп. полям' },
  { key: 'search_assignee', label: 'Исполнитель', placeholder: 'ФИО или email' },
  { key: 'search_creator', label: 'Заказчик', placeholder: 'ФИО или email' },
  { key: 'search_status', label: 'Статус', placeholder: 'Название статуса' },
  { key: 'search_executor_group', label: 'Группа исполнителей', placeholder: 'Название группы' },
  { key: 'search_service', label: 'Услуга', placeholder: 'Название услуги' },
  { key: 'search_ticket_service', label: 'Сервис', placeholder: 'Название сервиса' },
  { key: 'due_from', label: 'Дедлайн с', placeholder: '', type: 'date' },
  { key: 'due_to', label: 'Дедлайн по', placeholder: '', type: 'date' },
];

const FIELD_LABEL: Record<string, string> = FIELDS.reduce((acc, f) => {
  acc[f.key] = f.label;
  return acc;
}, {} as Record<string, string>);

const formatChipValue = (key: keyof TicketsFiltersValue, val: string) => {
  if ((key === 'due_from' || key === 'due_to') && val) {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('ru-RU');
  }
  return val;
};

const TicketsFilters = ({
  value,
  onChange,
  debounceMs = 400,
  align = 'left',
  compact = false,
  expanded: expandedProp,
  onExpandedChange,
}: Props) => {
  const [local, setLocal] = useState<TicketsFiltersValue>(value);
  const [expandedInner, setExpandedInner] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isControlled = expandedProp !== undefined;
  const expanded = isControlled ? expandedProp : expandedInner;
  const setExpanded = (next: boolean) => {
    if (!isControlled) setExpandedInner(next);
    onExpandedChange?.(next);
  };

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const scheduleEmit = (next: TicketsFiltersValue) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(next);
    }, debounceMs);
  };

  const handleFieldChange = (key: keyof TicketsFiltersValue, val: string) => {
    const next = { ...local, [key]: val };
    setLocal(next);
    scheduleEmit(next);
  };

  const handleReset = () => {
    const empty: TicketsFiltersValue = {};
    setLocal(empty);
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange(empty);
  };

  const handleRemoveOne = (key: keyof TicketsFiltersValue) => {
    const next = { ...local };
    delete next[key];
    setLocal(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange(next);
  };

  const activeEntries = (Object.entries(local) as [keyof TicketsFiltersValue, string | undefined][])
    .filter(([, v]) => (v || '').trim() !== '');
  const activeCount = activeEntries.length;

  const triggerButton = compact ? (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 relative"
      onClick={() => setExpanded(!expanded)}
      title="Фильтры"
    >
      <Icon name="Filter" size={18} />
      {activeCount > 0 && (
        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center text-[10px] leading-none rounded-full bg-primary text-primary-foreground w-4 h-4">
          {activeCount}
        </span>
      )}
    </Button>
  ) : (
    <Button
      variant="outline"
      size="sm"
      className="h-9"
      onClick={() => setExpanded(!expanded)}
      title="Фильтры"
    >
      <Icon name="Filter" size={16} className="mr-2" />
      Фильтры
      {activeCount > 0 && (
        <span className="ml-2 inline-flex items-center justify-center text-xs rounded-full bg-primary text-primary-foreground px-2 py-0.5">
          {activeCount}
        </span>
      )}
    </Button>
  );

  const panel = expanded ? (
    <div className="w-full bg-card border border-border rounded-[15px] shadow-sm p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon name="Filter" size={16} className="text-muted-foreground" />
          Фильтры заявок
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center text-[11px] rounded-full bg-primary/10 text-primary px-2 py-0.5">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleReset}>
              <Icon name="X" size={14} className="mr-1" />
              Сбросить всё
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded(false)} title="Свернуть">
            <Icon name="ChevronUp" size={18} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
            <Input
              type={f.type || 'text'}
              value={local[f.key] || ''}
              placeholder={f.placeholder}
              onChange={(e) => handleFieldChange(f.key, e.target.value)}
              className="h-9 text-sm px-3"
            />
          </div>
        ))}
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
          <span className="text-xs text-muted-foreground">Активные:</span>
          {activeEntries.map(([key, val]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted pl-2.5 pr-1.5 py-1 text-xs text-foreground"
            >
              <span className="text-muted-foreground">{FIELD_LABEL[key]}:</span>
              <span className="font-medium max-w-[160px] truncate">{formatChipValue(key, val || '')}</span>
              <button
                onClick={() => handleRemoveOne(key)}
                className="inline-flex items-center justify-center rounded-full hover:bg-background/80 p-0.5 transition-colors"
                title="Убрать фильтр"
              >
                <Icon name="X" size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  ) : null;

  // Режим панели: кнопку и панель размещает родитель через FilterTrigger / панель ниже.
  // По умолчанию (не compact) рендерим кнопку + панель сразу под ней.
  if (compact) {
    return triggerButton;
  }

  return (
    <div className={`w-full flex flex-col gap-3`}>
      <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : ''}`}>
        {triggerButton}
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="h-9" onClick={handleReset}>
            <Icon name="X" size={14} className="mr-1" />
            Сбросить
          </Button>
        )}
      </div>
      {panel}
    </div>
  );
};

export default TicketsFilters;

export const TicketsFilterPanel = ({
  value,
  onChange,
  expanded,
  onExpandedChange,
  debounceMs,
}: Pick<Props, 'value' | 'onChange' | 'expanded' | 'onExpandedChange' | 'debounceMs'>) => {
  const [local, setLocal] = useState<TicketsFiltersValue>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const scheduleEmit = (next: TicketsFiltersValue) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(next);
    }, debounceMs ?? 400);
  };

  const handleFieldChange = (key: keyof TicketsFiltersValue, val: string) => {
    const next = { ...local, [key]: val };
    setLocal(next);
    scheduleEmit(next);
  };

  const handleReset = () => {
    const empty: TicketsFiltersValue = {};
    setLocal(empty);
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange(empty);
  };

  const handleRemoveOne = (key: keyof TicketsFiltersValue) => {
    const next = { ...local };
    delete next[key];
    setLocal(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange(next);
  };

  const activeEntries = (Object.entries(local) as [keyof TicketsFiltersValue, string | undefined][])
    .filter(([, v]) => (v || '').trim() !== '');
  const activeCount = activeEntries.length;

  if (!expanded) return null;

  return (
    <div className="w-full bg-card border border-border rounded-[15px] shadow-sm p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon name="Filter" size={16} className="text-muted-foreground" />
          Фильтры заявок
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center text-[11px] rounded-full bg-primary/10 text-primary px-2 py-0.5">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleReset}>
              <Icon name="X" size={14} className="mr-1" />
              Сбросить всё
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onExpandedChange?.(false)}
            title="Свернуть"
          >
            <Icon name="ChevronUp" size={18} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
            <Input
              type={f.type || 'text'}
              value={local[f.key] || ''}
              placeholder={f.placeholder}
              onChange={(e) => handleFieldChange(f.key, e.target.value)}
              className="h-9 text-sm px-3"
            />
          </div>
        ))}
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
          <span className="text-xs text-muted-foreground">Активные:</span>
          {activeEntries.map(([key, val]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted pl-2.5 pr-1.5 py-1 text-xs text-foreground"
            >
              <span className="text-muted-foreground">{FIELD_LABEL[key]}:</span>
              <span className="font-medium max-w-[160px] truncate">{formatChipValue(key, val || '')}</span>
              <button
                onClick={() => handleRemoveOne(key)}
                className="inline-flex items-center justify-center rounded-full hover:bg-background/80 p-0.5 transition-colors"
                title="Убрать фильтр"
              >
                <Icon name="X" size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
