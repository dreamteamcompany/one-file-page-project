import { Card, CardContent } from '@/components/ui/card';
import type { ReopenedData } from '@/pages/TopicsAnalytics';

interface ReopenedChartProps {
  data: ReopenedData;
}

const ReopenedChart = ({ data }: ReopenedChartProps) => {
  const weeks = data.weeks ?? [];
  if (!weeks.length) return null;

  const max = Math.max(...weeks.map((w) => w.share), 1);

  return (
    <Card className="mb-6">
      <CardContent className="py-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h2 className="font-bold">Повторно открытые заявки</h2>
            <p className="text-muted-foreground text-sm">
              Закрыли, но пришлось возвращать в работу, август — новые и переходящие
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
      </CardContent>
    </Card>
  );
};

export default ReopenedChart;