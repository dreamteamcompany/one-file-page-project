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
  const full = weeks.filter((w) => w.days >= 7);
  const base = full.length ? full : weeks;
  const totals = base.reduce(
    (a, w) => ({ cnt: a.cnt + w.count, un: a.un + w.unresolved }),
    { cnt: 0, un: 0 },
  );
  const avgShare = totals.cnt > 0 ? totals.un / totals.cnt : 0;

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
              Закрыты за 3 дня
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-rose-500" />
              Дольше 3 дней
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
                  title={`${w.label}: пришло ${w.count}, дольше 3 дней ${w.unresolved}`}
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

        <div className="flex items-start gap-2.5 mt-5 p-3 rounded-lg bg-muted">
          <Icon name="Info" size={16} className="text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            Поток заявок за месяц вырос с {weeks[1]?.count ?? weeks[0].count} до{' '}
            {full[full.length - 1]?.count ?? weeks[0].count} в неделю. Красным — заявки, на
            которые ушло больше 3 дней: их доля держится около{' '}
            <b>{Math.round(avgShare * 100)}%</b> и по неделям почти не меняется. Неполные
            недели по краям месяца показаны бледным — по ним рано судить.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyTicketsChart;