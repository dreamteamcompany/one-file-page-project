import { useMemo, useState } from 'react';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export interface FilterComboboxOption {
  value: string;
  label: string;
}

interface FilterComboboxProps {
  options: FilterComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}

const FilterCombobox = ({
  options,
  value,
  onChange,
  placeholder = 'Выберите',
  searchPlaceholder = 'Поиск...',
  emptyText = 'Ничего не найдено',
}: FilterComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const selectedLabel = value
    ? options.find((o) => o.label === value)?.label ?? value
    : '';

  const itemClass =
    'border-0 outline-none ring-0 aria-selected:bg-muted aria-selected:text-foreground data-[selected=true]:bg-muted data-[selected=true]:text-foreground';

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(''); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between px-3 font-normal text-sm"
        >
          <span className={cn('truncate', !selectedLabel && 'text-muted-foreground')}>
            {selectedLabel || placeholder}
          </span>
          {value ? (
            <span
              role="button"
              tabIndex={0}
              className="ml-2 shrink-0 rounded p-0.5 hover:bg-muted"
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onChange(''); } }}
              title="Очистить"
            >
              <Icon name="X" size={14} className="opacity-60" />
            </span>
          ) : (
            <Icon name="ChevronsUpDown" size={16} className="ml-2 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList
            className="max-h-[280px] overflow-y-auto overscroll-contain"
            onWheel={(e) => e.stopPropagation()}
          >
            <CommandEmpty>{emptyText}</CommandEmpty>
            {filtered.map((opt) => (
              <CommandItem
                key={opt.value}
                value={opt.value}
                className={itemClass}
                onSelect={() => {
                  onChange(opt.label);
                  setOpen(false);
                }}
              >
                <Icon
                  name="Check"
                  size={16}
                  className={cn('mr-2 shrink-0', value === opt.label ? 'opacity-100' : 'opacity-0')}
                />
                <span className="truncate">{opt.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default FilterCombobox;
