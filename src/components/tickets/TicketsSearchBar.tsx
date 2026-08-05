import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import TicketsFilters, { TicketsFilterPanel, TicketsFiltersValue, TicketsFilterOptions } from './TicketsFilters';

interface SortOption {
  value: string;
  label: string;
}

interface TicketsSearchBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  sortDir: 'asc' | 'desc';
  onSortDirToggle: () => void;
  sortOptions: SortOption[];
  filtersValue: TicketsFiltersValue;
  onFiltersChange: (next: TicketsFiltersValue) => void;
  filterOptions?: TicketsFilterOptions;
  showControls?: boolean;
}

const TicketsSearchBar = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortByChange,
  sortDir,
  onSortDirToggle,
  sortOptions,
  filtersValue,
  onFiltersChange,
  filterOptions,
  showControls = true,
}: TicketsSearchBarProps) => {
  const currentSortLabel = sortOptions.find((o) => o.value === sortBy)?.label || 'Сортировка';
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="w-full">
      {/* Строка поиска + иконки сортировки/фильтра */}
      <div className="flex items-center gap-2 sm:gap-3 bg-card border border-border rounded-[15px] px-3 sm:px-5 py-2 sm:py-3">
        <Icon name="Search" size={18} className="text-muted-foreground shrink-0" />
        <Input
          type="text"
          placeholder="Поиск по заявкам..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto text-sm sm:text-base flex-1 min-w-0"
        />

        {showControls && (
          <div className="flex items-center gap-1 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title={`Сортировка: ${currentSortLabel}`}
                  aria-label={`Сортировка: ${currentSortLabel}`}
                >
                  <Icon name="ArrowUpDown" size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[60vh] overflow-y-auto">
                {sortOptions.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => onSortByChange(opt.value)}
                    className={opt.value === sortBy ? 'bg-accent' : ''}
                  >
                    {opt.label}
                    {opt.value === sortBy && <Icon name="Check" size={14} className="ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onSortDirToggle}
              title={sortDir === 'asc' ? 'По возрастанию' : 'По убыванию'}
              aria-label={sortDir === 'asc' ? 'Сортировка по возрастанию' : 'Сортировка по убыванию'}
            >
              <Icon name={sortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} size={18} />
            </Button>

            <TicketsFilters
              value={filtersValue}
              onChange={onFiltersChange}
              align="right"
              compact
              expanded={filtersOpen}
              onExpandedChange={setFiltersOpen}
            />
          </div>
        )}
      </div>
      <p className="mt-1.5 px-3 sm:px-5 text-[11px] sm:text-xs text-muted-foreground leading-snug">
        Ищет по теме, описанию, доп. полям, комментариям, участникам, номеру, дате, сервису и услуге
      </p>

      {showControls && (
        <div className="mt-2">
          <TicketsFilterPanel
            value={filtersValue}
            onChange={onFiltersChange}
            expanded={filtersOpen}
            onExpandedChange={setFiltersOpen}
            options={filterOptions}
          />
        </div>
      )}
    </div>
  );
};

export default TicketsSearchBar;