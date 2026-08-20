import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import Icon from '@/components/ui/icon';

export interface OperatorOption {
  id: number;
  full_name: string;
  email?: string | null;
  groups?: string | null;
}

interface Props {
  operators: OperatorOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

const NotifyOperatorsPicker = ({ operators, selectedIds, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = useMemo(
    () => operators.filter((o) => selectedIds.includes(o.id)),
    [operators, selectedIds],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return operators;
    return operators.filter(
      (o) =>
        (o.full_name || '').toLowerCase().includes(q) ||
        (o.groups || '').toLowerCase().includes(q),
    );
  }, [operators, search]);

  const toggle = (id: number) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {selected.length === 0
                ? 'Выберите операторов'
                : `Выбрано операторов: ${selected.length}`}
            </span>
            <Icon name="ChevronsUpDown" size={16} className="opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Поиск по имени или группе..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList
              className="max-h-[280px] overflow-y-auto overscroll-contain"
              onWheel={(e) => e.stopPropagation()}
            >
              <CommandEmpty>
                {operators.length === 0
                  ? 'Нет сотрудников в группах исполнителей'
                  : 'Никого не найдено'}
              </CommandEmpty>
              <CommandGroup>
                {filtered.map((o) => {
                  const checked = selectedIds.includes(o.id);
                  return (
                    <CommandItem
                      key={o.id}
                      value={String(o.id)}
                      onSelect={() => toggle(o.id)}
                      className="items-start gap-2"
                    >
                      <div
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-input'
                        }`}
                      >
                        {checked && <Icon name="Check" size={12} />}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm">{o.full_name}</div>
                        {o.groups && (
                          <div className="truncate text-xs text-muted-foreground">
                            {o.groups}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((o) => (
            <Badge key={o.id} variant="secondary" className="font-normal gap-1 pr-1">
              {o.full_name}
              <button
                type="button"
                onClick={() => toggle(o.id)}
                className="rounded-full hover:bg-background/60 p-0.5"
                aria-label={`Убрать ${o.full_name}`}
              >
                <Icon name="X" size={12} />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotifyOperatorsPicker;