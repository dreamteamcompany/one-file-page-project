import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { fmtHours } from '@/components/analytics/ResolutionTimeChart';
import TimeModeToggle, { type TimeMode } from '@/components/analytics/TimeModeToggle';
import type { DelayReasonsData, DelayGroup } from '@/pages/TopicsAnalytics';

interface DelayReasonsChartProps {
  data: DelayReasonsData;
}

const STYLE: Record<DelayGroup['side'], { bar: string; text: string; icon: string }> = {
  our: { bar: 'bg-rose-500', text: 'text-rose-500', icon: 'UserCog' },
  client: { bar: 'bg-amber-500', text: 'text-amber-500', icon: 'UserRound' },
};

const DelayReasonsChart = ({ data }: DelayReasonsChartProps) => {
  const [mode, setMode] = useState<TimeMode>('work');
  const groups = data.groups ?? [];
  if (!groups.length) return null;

  const work = mode === 'work';
  const share = (g: DelayGroup) => (work ? g.workShare : g.share);
  const hours = (g: DelayGroup) => (work ? g.workHours : g.hours);
  const avg = (g: DelayGroup) => (work ? g.avgWorkHours : g.avgHours);
  const tAvg = (g: DelayGroup) => (work ? g.ticketAvgWorkHours : g.ticketAvgHours);
  const tMed = (g: DelayGroup) => (work ? g.ticketMedWorkHours : g.ticketMedHours);


  return (
    <Card className="mb-6">
      <CardContent className="py-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-bold">Кто кого ждёт в переписке</h2>
            <p className="text-muted-foreground text-sm">
              Чей ход: время до ответа другой стороны, август — новые и переходящие
            </p>
          </div>
          <TimeModeToggle value={mode} onChange={setMode} />
        </div>

        <div className="flex h-4 rounded-full overflow-hidden mb-3">
          {groups.map((g) => (
            <div
              key={g.side}
              className={`${STYLE[g.side].bar} transition-all`}
              style={{ width: `${share(g)}%` }}
              title={`${g.label}: ${share(g)}%`}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 mb-6 text-xs">
          {groups.map((g) => (
            <span key={g.side} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-sm ${STYLE[g.side].bar}`} />
              {g.label} — <b>{share(g)}%</b>
            </span>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.side} className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Icon name={STYLE[g.side].icon} size={16} className={STYLE[g.side].text} />
                <span className="font-semibold text-sm">{g.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <div className="text-2xl font-bold tabular-nums leading-tight">
                    {fmtHours(tAvg(g))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    в среднем на заявку
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold tabular-nums leading-tight">
                    {fmtHours(tMed(g))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    медиана по заявкам
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {g.tickets} заявок · {fmtHours(avg(g))} на одно ожидание ·{' '}
                {g.periods} ожиданий на {fmtHours(hours(g))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default DelayReasonsChart;