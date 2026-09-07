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
  const [mode, setMode] = useState<TimeMode>('calendar');
  const groups = data.groups ?? [];
  if (!groups.length) return null;

  const work = mode === 'work';
  const share = (g: DelayGroup) => (work ? g.workShare : g.share);
  const hours = (g: DelayGroup) => (work ? g.workHours : g.hours);
  const avg = (g: DelayGroup) => (work ? g.avgWorkHours : g.avgHours);

  const our = groups.find((g) => g.side === 'our');
  const client = groups.find((g) => g.side === 'client');

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
              <div className="text-2xl font-bold tabular-nums mb-1">
                {fmtHours(avg(g))}
              </div>
              <div className="text-xs text-muted-foreground">
                в среднем на одно ожидание · всего {g.periods} ожиданий на{' '}
                {fmtHours(hours(g))}
              </div>
            </div>
          ))}
        </div>

        {our && client && (
          <div className="flex items-start gap-2.5 mt-6 p-3 rounded-lg bg-muted/50">
            <Icon name="Lightbulb" size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              Ход переходит к нам, когда пишет заявитель, и к нему — когда отвечает
              сотрудник. Пока ход наш, человек сидит и ждёт ответа.{' '}
              {share(our) >= share(client) ? (
                <>
                  Сейчас <b>{share(our)}%</b> всего времени переписки люди ждут нас против{' '}
                  <b>{share(client)}%</b>, когда ждём мы. Первого ответа обычно ждут{' '}
                  {fmtHours(data.firstWaitMedian)}.
                </>
              ) : (
                <>
                  Сейчас <b>{share(client)}%</b> времени мы ждём ответа заявителей против{' '}
                  <b>{share(our)}%</b>, когда ждут нас. Первого ответа обычно ждут{' '}
                  {fmtHours(data.firstWaitMedian)}.
                </>
              )}{' '}
              {data.openOnUs > 0 && (
                <>
                  Прямо сейчас <b>{data.openOnUs}</b> незакрытых заявок висят с ходом за
                  нами.{' '}
                </>
              )}
              {work
                ? 'Показаны часы внутри смен исполнителей по их графикам.'
                : 'Показаны все часы подряд, включая ночи.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DelayReasonsChart;