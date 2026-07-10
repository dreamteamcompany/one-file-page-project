import { AutomationRun, formatDate } from './types';
import AutomationStatusBadge from './AutomationStatusBadge';

interface AutomationJobHistoryProps {
  runs: AutomationRun[];
}

const AutomationJobHistory = ({ runs }: AutomationJobHistoryProps) => {
  return (
    <div className="border border-border/50 rounded-md overflow-hidden">
      {runs.length === 0 ? (
        <div className="p-4 text-center text-xs text-muted-foreground">
          Запусков пока не было
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-3 py-2">Время</th>
                <th className="px-3 py-2">Тип</th>
                <th className="px-3 py-2">Кем</th>
                <th className="px-3 py-2">Статус</th>
                <th className="px-3 py-2">Длительность</th>
                <th className="px-3 py-2">Результат</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.started_at)}</td>
                  <td className="px-3 py-2">
                    {r.trigger_type === 'manual' ? 'Вручную' : 'Авто'}
                  </td>
                  <td className="px-3 py-2">{r.started_by_name || '—'}</td>
                  <td className="px-3 py-2"><AutomationStatusBadge status={r.status} /></td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)} с` : '—'}
                  </td>
                  <td className="px-3 py-2 max-w-[400px] truncate" title={r.message}>
                    {r.message || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AutomationJobHistory;
