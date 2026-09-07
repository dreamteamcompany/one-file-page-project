import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import TimeModeToggle, { type TimeMode } from '@/components/analytics/TimeModeToggle';
import type { ResolutionData } from '@/pages/TopicsAnalytics';

interface ResolutionTimeChartProps {
  data: ResolutionData;
}

/** Часы в «2 д 5 ч» — крупные числа так читаются без пересчёта. */
export const fmtHours = (hours: number) => {
  if (hours < 1) return `${Math.round(hours * 60)} мин`;
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m ? `${h} ч ${m} мин` : `${h} ч`;
  }
  const d = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  return h ? `${d} д ${h} ч` : `${d} д`;
};

const ResolutionTimeChart = ({ data }: ResolutionTimeChartProps) => {
  const [mode, setMode] = useState<TimeMode>('work');
  const weeks = data.weeks ?? [];
  if (!weeks.length) return null;

  const work = mode === 'work';
  const val = (w: (typeof weeks)[number]) => (work ? w.avgWorkHours : w.avgHours);
  const med = (w: (typeof weeks)[number]) => (work ? w.medianWorkHours : w.medianHours);
  const total = work ? data.avgWorkHours : data.avgHours;
  const other = work ? data.avgHours : data.avgWorkHours;
  const max = Math.max(...weeks.map(val), 1);

  return (
    <Card className="mb-6">
      <CardContent className="py-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-bold">Среднее время решения</h2>
            <p className="text-muted-foreground text-sm">
              От создания до статуса «Решена», август — новые и переходящие заявки
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">{fmtHours(total)}</div>
            <div className="text-xs text-muted-foreground">
              {work ? 'рабочих часов' : 'календарного времени'} в среднем
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <TimeModeToggle value={mode} onChange={setMode} />
          <span className="text-xs text-muted-foreground">
            {work ? 'календарное' : 'в рабочих часах'} — {fmtHours(other)}
          </span>
        </div>

        <div className="flex items-end justify-between gap-2 sm:gap-4 h-52">
          {weeks.map((w) => (
            <div
              key={w.label}
              className="flex-1 flex flex-col items-center gap-2 h-full justify-end"
            >
              <span className="text-xs sm:text-sm font-semibold tabular-nums text-center">
                {fmtHours(val(w))}
              </span>
              <div
                className={`w-full rounded-t-md transition-all ${
                  work ? 'bg-teal-500' : 'bg-indigo-500'
                }`}
                style={{ height: `${Math.max((val(w) / max) * 100, 3)}%` }}
                title={`${w.label}: календарное ${fmtHours(w.avgHours)}, рабочее ${fmtHours(
                  w.avgWorkHours
                )}, заявок ${w.count}`}
              />
              <span className="text-[11px] sm:text-xs text-muted-foreground text-center leading-tight">
                {w.label}
                <span className="block opacity-70">медиана {fmtHours(med(w))}</span>
                {w.total > 0 && w.pending / w.total >= 0.15 && (
                  <span className="block text-amber-600">
                    ещё в работе {Math.round((w.pending / w.total) * 100)}%
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ResolutionTimeChart;