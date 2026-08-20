import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

export interface SummaryRow {
  assigned_to: number | null;
  assignee_name: string;
  total: number;
  no_reply: number;
  operator_silent: number;
  customer_waiting: number;
  still_silent: number;
}

interface Props {
  rows: SummaryRow[];
  activeAssignee: string;
  onSelect: (id: string) => void;
}

const ResponseSummary = ({ rows, activeAssignee, onSelect }: Props) => {
  if (rows.length === 0) return null;

  const max = Math.max(...rows.map((r) => r.total), 1);

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="Users" size={18} className="text-muted-foreground" />
          <h2 className="font-semibold">Сводка по сотрудникам</h2>
          <span className="text-xs text-muted-foreground">
            нажмите на строку, чтобы отфильтровать список
          </span>
        </div>

        <div className="space-y-1.5">
          {rows.map((r) => {
            const id = r.assigned_to ? String(r.assigned_to) : '';
            const active = !!id && activeAssignee === id;
            return (
              <button
                key={`${r.assigned_to ?? 'none'}`}
                onClick={() => id && onSelect(active ? '' : id)}
                className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${
                  active ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/60'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-sm font-medium truncate">{r.assignee_name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.still_silent > 0 && (
                      <Badge
                        variant="outline"
                        className="bg-red-50 text-red-700 border-red-200 text-xs font-normal"
                      >
                        без ответа: {r.still_silent}
                      </Badge>
                    )}
                    <span className="text-sm font-semibold tabular-nums">{r.total}</span>
                  </div>
                </div>
                <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
                  <div
                    className="bg-amber-400"
                    style={{ width: `${(r.no_reply / max) * 100}%` }}
                  />
                  <div
                    className="bg-sky-400"
                    style={{ width: `${(r.operator_silent / max) * 100}%` }}
                  />
                  <div
                    className="bg-rose-400"
                    style={{ width: `${(r.customer_waiting / max) * 100}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Триггер 1
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-sm bg-sky-400" /> Триггер 2
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-sm bg-rose-400" /> Триггер 3
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResponseSummary;
