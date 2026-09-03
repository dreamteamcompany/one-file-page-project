import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import type { FirstResponseData } from '@/pages/TopicsAnalytics';

interface FirstResponseChartProps {
  data: FirstResponseData;
}

/** Минуты в «2 ч 15 мин» — так число читается без пересчёта в уме. */
const fmt = (minutes: number) => {
  const m = Math.round(minutes);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h < 24) return rest ? `${h} ч ${rest} мин` : `${h} ч`;
  const d = Math.floor(h / 24);
  return `${d} д ${h % 24} ч`;
};

const FirstResponseChart = ({ data }: FirstResponseChartProps) => {
  const weeks = data.weeks ?? [];
  if (!weeks.length) return null;

  const max = Math.max(...weeks.map((w) => w.avgMinutes), 1);
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  const worse = last.avgMinutes > first.avgMinutes;

  return (
    <Card className="mb-6">
      <CardContent className="py-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h2 className="font-bold">Среднее время первого ответа</h2>
            <p className="text-muted-foreground text-sm">
              Только рабочие часы исполнителя, август
            </p>
            <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[11px] bg-teal-500/10 text-teal-600 dark:text-teal-400">
              рабочее время
            </span>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">{fmt(data.avgMinutes)}</div>
            <div className="text-xs text-muted-foreground">в среднем за месяц</div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-2 sm:gap-4 h-52">
          {weeks.map((w) => (
            <div
              key={w.label}
              className="flex-1 flex flex-col items-center gap-2 h-full justify-end"
            >
              <span className="text-xs sm:text-sm font-semibold tabular-nums text-center">
                {fmt(w.avgMinutes)}
              </span>
              <div
                className="w-full rounded-t-md bg-primary"
                style={{ height: `${Math.max((w.avgMinutes / max) * 100, 3)}%` }}
                title={`${w.label}: среднее ${fmt(w.avgMinutes)}, медиана ${fmt(
                  w.medianMinutes
                )}, заявок ${w.count}`}
              />
              <span className="text-[11px] sm:text-xs text-muted-foreground text-center leading-tight">
                {w.label}
                <span className="block opacity-70">медиана {fmt(w.medianMinutes)}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2.5 mt-5 p-3 rounded-lg bg-muted/50">
          <Icon
            name={worse ? 'TrendingUp' : 'TrendingDown'}
            size={16}
            className={`shrink-0 mt-0.5 ${worse ? 'text-rose-500' : 'text-emerald-500'}`}
          />
          <p className="text-xs leading-relaxed">
            Ночь, выходные и время вне смены исполнителя не считаются — заявка, пришедшая в
            пятницу вечером, «ждёт» только с утра понедельника. Медиана обычно сильно ниже
            среднего: несколько забытых заявок тянут среднее вверх. Ответили на{' '}
            {data.answered} заявок, без ответа осталось {data.noReply}.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default FirstResponseChart;