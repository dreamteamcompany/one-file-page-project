import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import type { RatingData } from '@/pages/TopicsAnalytics';

interface RatingChartProps {
  data: RatingData;
}

const RatingChart = ({ data }: RatingChartProps) => {
  const dist = data.distribution ?? [];
  if (!data.rated) return null;

  const max = Math.max(...dist.map((d) => d.count), 1);

  return (
    <Card className="mb-6">
      <CardContent className="py-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h2 className="font-bold">Средняя оценка</h2>
            <p className="text-muted-foreground text-sm">
              Оценки пользователей, август — новые и переходящие заявки
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <Icon name="Star" size={22} className="text-amber-400 fill-amber-400" />
              <span className="text-2xl font-bold tabular-nums">
                {data.avg.toFixed(2)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">из 5 баллов</div>
          </div>
        </div>

        <div className="space-y-2">
          {dist.map((d) => (
            <div key={d.stars} className="flex items-center gap-3 text-xs">
              <span className="w-12 shrink-0 flex items-center gap-1 tabular-nums">
                {d.stars}
                <Icon name="Star" size={12} className="text-amber-400 fill-amber-400" />
              </span>
              <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    d.stars >= 4 ? 'bg-emerald-500' : d.stars === 3 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${d.count ? Math.max((d.count / max) * 100, 1.5) : 0}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-muted-foreground tabular-nums">
                {d.count} · {d.share}%
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2.5 mt-5 p-3 rounded-lg bg-muted/50">
          <Icon name="Info" size={16} className="text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            Оценку поставили на {data.rated} заявок из {data.total} — это {data.coverage}%.
            Молчание обычно означает «нормально», поэтому средний балл слегка завышен:
            недовольные пишут чаще довольных.{' '}
            {data.low > 0 && (
              <>
                Резко негативных оценок (1–2 балла) — <b>{data.low}</b>, их стоит разобрать
                поимённо.
              </>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default RatingChart;
