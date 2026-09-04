import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import type { ClosedByUserData } from '@/pages/TopicsAnalytics';

interface ClosedByUserChartProps {
  data: ClosedByUserData;
}

const ClosedByUserChart = ({ data }: ClosedByUserChartProps) => {
  const users = data?.users ?? [];
  if (!users.length) return null;

  const max = Math.max(...users.map((u) => u.total), 1);
  const total = data.closed + data.pending;

  return (
    <Card className="mb-6">
      <CardContent className="py-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h2 className="font-bold">Закрытые заявки по исполнителям</h2>
            <p className="text-muted-foreground text-sm">
              Август, по дате закрытия — включая заявки прошлых месяцев
            </p>
            <div className="flex items-center gap-4 mt-2 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                решено и отменено
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-400" />
                ждёт подтверждения
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">{total}</div>
            <div className="text-xs text-muted-foreground">
              {data.closed} закрыто, {data.pending} на подтверждении
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {users.map((u) => (
            <div key={u.name} className="flex items-center gap-3">
              <span className="w-36 sm:w-44 shrink-0 text-xs sm:text-sm truncate" title={u.name}>
                {u.name}
              </span>
              <div className="flex-1 h-7 bg-muted/50 rounded-md overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${(u.closed / max) * 100}%` }}
                  title={`${u.name}: закрыто ${u.closed}`}
                />
                <div
                  className="h-full bg-sky-400"
                  style={{ width: `${(u.pending / max) * 100}%` }}
                  title={`${u.name}: ждёт подтверждения ${u.pending}`}
                />
              </div>
              <span className="w-16 sm:w-20 shrink-0 text-right text-xs sm:text-sm font-semibold tabular-nums">
                {u.total}
              </span>
              <span className="w-24 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums hidden sm:block">
                {u.closed} + {u.pending}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2.5 mt-5 p-3 rounded-lg bg-muted/50">
          <Icon name="Info" size={16} className="shrink-0 mt-0.5 text-muted-foreground" />
          <p className="text-xs leading-relaxed">
            Считается по дате смены статуса — то, что человек реально сделал за август,
            включая заявки, созданные раньше. Голубым показаны заявки, отправленные на
            подтверждение и не закрытые до конца месяца: работа выполнена, но ждёт
            ответа пользователя. Если заявку и отправляли на подтверждение, и закрыли —
            она учтена один раз, как закрытая.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClosedByUserChart;
