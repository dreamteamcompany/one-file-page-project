import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';

export type ExportTable = {
  name: string;
  rows: number;
  size_bytes: number;
  is_log: boolean;
};

type Props = {
  tables: ExportTable[];
  selected: string | null;
  disabled: boolean;
  onSelect: (name: string) => void;
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
};

const CsvExportTablePicker = ({ tables, selected, disabled, onSelect }: Props) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter((t) => t.name.toLowerCase().includes(q));
  }, [tables, query]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Icon
          name="Search"
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск таблицы"
          disabled={disabled}
          className="pl-8 h-9 text-sm"
        />
      </div>

      <div className="max-h-56 overflow-y-auto rounded-lg border border-border/50 divide-y divide-border/40">
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground p-3">Ничего не найдено</p>
        )}
        {filtered.map((t) => (
          <button
            key={t.name}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(t.name)}
            className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 transition-colors disabled:opacity-60 ${
              selected === t.name ? 'bg-sky-500/10' : 'hover:bg-muted/50'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <Icon
                name={selected === t.name ? 'CircleCheck' : 'Circle'}
                size={14}
                className={selected === t.name ? 'text-sky-600 shrink-0' : 'text-muted-foreground shrink-0'}
              />
              <span className="text-sm truncate">{t.name}</span>
              {t.is_log && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                  журнал
                </span>
              )}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">
              ~{t.rows.toLocaleString('ru-RU')} · {formatSize(t.size_bytes)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CsvExportTablePicker;
