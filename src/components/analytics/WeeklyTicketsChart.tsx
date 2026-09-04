import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import type { WeekRow } from '@/pages/TopicsAnalytics';

interface WeeklyTicketsChartProps {
  weeks: WeekRow[];
}

/**
 * Недельная нагрузка августа. Высота столбца — сколько заявок было в работе,
 * внутри выделены новые: хвост с прошлых недель почти вдвое больше потока.
 */
const WeeklyTicketsChart = ({ weeks }: WeeklyTicketsChartProps) => {
  if (!weeks.length) return null;

  const max = Math.max(...weeks.map((w) => w.count), 1);
  const full = weeks.filter((w) => w.days >= 7);
  const base = full.length ? full : weeks;
  const peak = base.reduce((a, b) => (b.count > a.count ? b : a));
  const ratio = peak.created > 0 ? peak.count / peak.created : 0;

  return (
    <Card className="mb-6">
      <CardContent className="py-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h2 className="font-bold">Заявки в работе по неделям, август</h2>
            <p className="text-muted-foreground text-sm">Только ваши подразделения</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-primary" />
              Новые за неделю
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-400" />
              Перешли с прошлых недель
            </span>
          </div>
        </div>

        <div className="flex items-end justify-between gap-2 sm:gap-4 h-56">
          {weeks.map((w) => {
            const partial = w.days < 7;
            const carriedShare = w.count > 0 ? w.carried / w.count : 0;
            return (
              <div
                key={w.label}
                className="flex-1 flex flex-col items-center gap-2 h-full justify-end"
              >
                <span className="text-sm font-semibold tabular-nums">
                  {w.count}
                  <span className="text-primary font-normal"> / {w.created}</span>
                </span>
                <div
                  className={`w-full rounded-t-md overflow-hidden flex flex-col ${
                    partial ? 'opacity-40' : ''
                  }`}
                  style={{ height: `${Math.max((w.count / max) * 100, 3)}%` }}
                  title={`${w.label}: в работе ${w.count}, из них новых ${w.created}, перешло с прошлых недель ${w.carried}`}
                >
                  <div
                    className="bg-amber-400 w-full"
                    style={{ height: `${carriedShare * 100}%` }}
                  />
                  <div className="bg-primary w-full flex-1" />
                </div>
                <span className="text-[11px] sm:text-xs text-muted-foreground text-center leading-tight">
                  {w.label}
                  {partial && <span className="block opacity-70">{w.days} дн.</span>}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-start gap-2.5 mt-5 p-3 rounded-lg bg-amber-400/10">
          <Icon name="Layers" size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            Нагрузка примерно в <b>{ratio.toFixed(1)} раза</b> выше потока новых заявок: на
            пиковой неделе <b>{peak.label}</b> в работе было <b>{peak.count}</b> заявок, а
            новых пришло только <b>{peak.created}</b>. Остальное — хвост, перешедший с
            прошлых недель. Неполные недели по краям месяца показаны бледным.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyTicketsChart;
