import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import type { WeekRow } from '@/pages/TopicsAnalytics';

interface WeeklyTicketsChartProps {
  weeks: WeekRow[];
}

/**
 * Заявки по неделям августа. Неполные недели (месяц начался/кончился в середине)
 * помечаем, чтобы их низкий столбик не читался как спад нагрузки.
 */
const WeeklyTicketsChart = ({ weeks }: WeeklyTicketsChartProps) => {
  if (!weeks.length) return null;

  const max = Math.max(...weeks.map((w) => w.count), 1);

  const full = weeks.filter((w) => w.days === 7);
  const first = full[0]?.count ?? 0;
  const last = full[full.length - 1]?.count ?? 0;
  const growth = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
  const hasTrend = full.length >= 2 && first > 0;

  return (
    <Card className="mb-6">
      <CardContent className="py-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="font-bold">Заявки по неделям, август</h2>
            <p className="text-muted-foreground text-sm">
              Только ваши подразделения
            </p>
          </div>
          {hasTrend && (
            <div
              className={`flex items-center gap-1.5 text-sm font-semibold shrink-0 ${
                growth >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              <Icon name={growth >= 0 ? 'TrendingUp' : 'TrendingDown'} size={16} />
              {growth >= 0 ? '+' : ''}
              {growth}%
            </div>
          )}
        </div>

        <div className="flex items-end justify-between gap-2 sm:gap-4 h-52">
          {weeks.map((w) => {
            const partial = w.days < 7;
            return (
              <div
                key={w.label}
                className="flex-1 flex flex-col items-center gap-2 h-full justify-end"
              >
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    partial ? 'text-muted-foreground' : ''
                  }`}
                >
                  {w.count}
                </span>
                <div
                  className={`w-full rounded-t-md transition-all ${
                    partial ? 'bg-primary/30' : 'bg-primary'
                  }`}
                  style={{ height: `${Math.max((w.count / max) * 100, 3)}%` }}
                  title={`${w.label}: ${w.count} заявок${
                    partial ? ` (неполная неделя, ${w.days} дн.)` : ''
                  }`}
                />
                <span className="text-[11px] sm:text-xs text-muted-foreground text-center leading-tight">
                  {w.label}
                  {partial && <span className="block opacity-70">{w.days} дн.</span>}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground mt-5 leading-relaxed">
          Бледные столбцы — неполные недели на стыке месяцев, их нельзя сравнивать
          с остальными напрямую. Рост посчитан по полным неделям.
        </p>
      </CardContent>
    </Card>
  );
};

export default WeeklyTicketsChart;
