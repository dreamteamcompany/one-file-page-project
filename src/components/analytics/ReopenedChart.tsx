import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import type { ReopenedData } from '@/pages/TopicsAnalytics';

interface ReopenedChartProps {
  data: ReopenedData;
}

const ReopenedChart = ({ data }: ReopenedChartProps) => {
  const weeks = data.weeks ?? [];
  if (!weeks.length) return null;

  const max = Math.max(...weeks.map((w) => w.share), 1);
  const repeated = data.events - data.count;

  return (
    <Card className="mb-6">
      <CardContent className="py-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h2 className="font-bold">Повторно открытые заявки</h2>
            <p className="text-muted-foreground text-sm">
              Закрыли, но пришлось возвращать в работу, август
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">{data.count}</div>
            <div className="text-xs text-muted-foreground">
              {data.share}% от закрытых заявок
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-2 sm:gap-4 h-44">
          {weeks.map((w) => (
            <div
              key={w.label}
              className="flex-1 flex flex-col items-center gap-2 h-full justify-end"
            >
              <span className="text-xs sm:text-sm font-semibold tabular-nums text-center">
                {w.count}
              </span>
              <div
                className="w-full rounded-t-md bg-orange-500"
                style={{ height: `${Math.max((w.share / max) * 100, 3)}%` }}
                title={`${w.label}: ${w.count} из ${w.total} закрытых (${w.share}%)`}
              />
              <span className="text-[11px] sm:text-xs text-muted-foreground text-center leading-tight">
                {w.label}
                <span className="block opacity-70">{w.share}%</span>
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2.5 mt-5 p-3 rounded-lg bg-muted/50">
          <Icon name="RotateCcw" size={16} className="text-orange-500 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            Это заявки, которые побывали в статусе «Открыта повторно»: решение не подошло
            либо проблема вернулась. Высота столбца — доля от закрытых заявок недели, число сверху —
            сколько их было.{' '}
            {repeated > 0 && (
              <>
                {repeated} заявок открывали повторно больше одного раза — это самые
                проблемные случаи.
              </>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReopenedChart;