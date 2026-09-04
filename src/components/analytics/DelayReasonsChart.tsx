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
  pause: { bar: 'bg-slate-400', text: 'text-slate-400', icon: 'Pause' },
};

const DelayReasonsChart = ({ data }: DelayReasonsChartProps) => {
  const [mode, setMode] = useState<TimeMode>('calendar');
  const groups = data.groups ?? [];
  if (!groups.length) return null;

  const work = mode === 'work';
  const share = (g: DelayGroup) => (work ? g.workShare : g.share);
  const hours = (g: DelayGroup) => (work ? g.workHours : g.hours);
  const total = work ? data.totalWorkHours : data.totalHours;

  const our = groups.find((g) => g.side === 'our');
  const client = groups.find((g) => g.side === 'client');

  return (
    <Card className="mb-6">
      <CardContent className="py-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-bold">Причины длительного закрытия заявок</h2>
            <p className="text-muted-foreground text-sm">
              Где заявки простаивают: у нас или у пользователя, август
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

        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.side}>
              <div className="flex items-center gap-2 mb-2">
                <Icon name={STYLE[g.side].icon} size={16} className={STYLE[g.side].text} />
                <span className="font-semibold text-sm">{g.label}</span>
                <span className="text-xs text-muted-foreground">
                  {fmtHours(hours(g))} всего
                </span>
              </div>
              <div className="space-y-1.5 pl-6">
                {g.items.map((it) => (
                  <div key={it.status} className="flex items-center gap-3 text-xs">
                    <span className="w-40 shrink-0 truncate">{it.status}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all ${STYLE[g.side].bar}`}
                        style={{
                          width: `${Math.min(
                            ((work ? it.workHours : it.hours) / Math.max(total, 1)) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="w-28 shrink-0 text-right text-muted-foreground tabular-nums">
                      в среднем {fmtHours(work ? it.avgWorkHours : it.avgHours)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {our && client && (
          <div className="flex items-start gap-2.5 mt-6 p-3 rounded-lg bg-muted/50">
            <Icon name="Lightbulb" size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              {share(client) > share(our) ? (
                <>
                  Больше всего времени заявки висят в ожидании пользователя —{' '}
                  <b>{share(client)}%</b> против <b>{share(our)}%</b> у нас. Это статус
                  «Ожидает подтверждения»: работа сделана, но человек не закрывает заявку.
                  Ускорить можно автозакрытием по таймеру, а не силами сотрудников.
                </>
              ) : (
                <>
                  Основная задержка на нашей стороне — <b>{share(our)}%</b> времени против{' '}
                  <b>{share(client)}%</b> в ожидании пользователя. Смотреть нужно на
                  загрузку исполнителей, а не на дисциплину заявителей.
                </>
              )}{' '}
              {work
                ? 'Показаны часы внутри смен исполнителей по их графикам; дежурные выходные учтены.'
                : 'Показаны все часы подряд, включая ночи и выходные.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DelayReasonsChart;