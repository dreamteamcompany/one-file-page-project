import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import type { WeekRow } from '@/pages/TopicsAnalytics';

interface WeeklyTicketsChartProps {
  weeks: WeekRow[];
}

/**
 * Заявки по неделям августа. Столбец делится на решённые и зависшие —
 * поток заявок рос плавно, а вот доля незакрытых к концу месяца дала завал.
 */
const WeeklyTicketsChart = ({ weeks }: WeeklyTicketsChartProps) => {
  if (!weeks.length) return null;

  const max = Math.max(...weeks.map((w) => w.count), 1);
  const share = (w: WeekRow) => (w.count > 0 ? w.unresolved / w.count : 0);
  const worst = weeks.reduce((a, b) => (share(b) > share(a) ? b : a));

  return (
    <Card className="mb-6">
      <CardContent className="py-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h2 className="font-bold">Заявки по неделям, август</h2>
            <p className="text-muted-foreground text-sm">Только ваши подразделения</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-primary" />
              Решены
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-rose-500" />
              Зависли
            </span>
          </div>
        </div>

        <div className="flex items-end justify-between gap-2 sm:gap-4 h-56">
          {weeks.map((w) => {
            const partial = w.days < 7;
            return (
              <div
                key={w.label}
                className="flex-1 flex flex-col items-center gap-2 h-full justify-end"
              >
                <span className="text-sm font-semibold tabular-nums">
                  {w.count}
                  {w.unresolved > 0 && (
                    <span className="text-rose-500 font-normal"> / {w.unresolved}</span>
                  )}
                </span>
                <div
                  className={`w-full rounded-t-md overflow-hidden flex flex-col ${
                    partial ? 'opacity-40' : ''
                  }`}
                  style={{ height: `${Math.max((w.count / max) * 100, 3)}%` }}
                  title={`${w.label}: всего ${w.count}, зависли ${w.unresolved}`}
                >
                  <div
                    className="bg-rose-500 w-full"
                    style={{ height: `${share(w) * 100}%` }}
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

        <div className="flex items-start gap-2.5 mt-5 p-3 rounded-lg bg-rose-500/10">
          <Icon name="TriangleAlert" size={16} className="text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            Завал виден не в потоке заявок, а в зависших: на неделе <b>{worst.label}</b> без
            решения осталось <b>{Math.round(share(worst) * 100)}%</b> заявок против 2% в
            начале месяца. Приходило их примерно столько же — их перестали успевать закрывать.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyTicketsChart;
