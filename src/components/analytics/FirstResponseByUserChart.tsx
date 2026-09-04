import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import type { FirstResponseByUserData } from '@/pages/TopicsAnalytics';

interface FirstResponseByUserChartProps {
  data: FirstResponseByUserData;
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

const FirstResponseByUserChart = ({ data }: FirstResponseByUserChartProps) => {
  const [workTime, setWorkTime] = useState(true);
  const users = data?.users ?? [];
  if (!users.length) return null;

  const avgOf = (u: (typeof users)[number]) =>
    workTime ? u.avgWorkMinutes : u.avgMinutes;
  const medianOf = (u: (typeof users)[number]) =>
    workTime ? u.medianWorkMinutes : u.medianMinutes;

  // Кто не ответил ни разу — в конец: их среднее равно нулю и они бы
  // ошибочно возглавили список как «самые быстрые».
  const sorted = [...users].sort((a, b) => {
    if (!a.answered !== !b.answered) return a.answered ? -1 : 1;
    return avgOf(a) - avgOf(b);
  });
  const max = Math.max(...sorted.map(avgOf), 1);
  const teamAvg = workTime ? data.avgWorkMinutes : data.avgMinutes;

  return (
    <Card className="mb-6">
      <CardContent className="py-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h2 className="font-bold">Время первого ответа по исполнителям</h2>
            <p className="text-muted-foreground text-sm">
              Август, от создания заявки до первого ответа сотрудника
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex rounded-lg bg-muted p-0.5 text-xs">
              <button
                onClick={() => setWorkTime(true)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  workTime ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'
                }`}
              >
                рабочее
              </button>
              <button
                onClick={() => setWorkTime(false)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  !workTime ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'
                }`}
              >
                календарное
              </button>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums">{fmt(teamAvg)}</div>
              <div className="text-xs text-muted-foreground">в среднем по отделу</div>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {sorted.map((u) => {
            const avg = avgOf(u);
            const share = Math.max((avg / max) * 100, 1.5);
            const slow = avg > teamAvg;
            return (
              <div key={u.name} className="flex items-center gap-3">
                <span className="w-36 sm:w-44 shrink-0 text-xs sm:text-sm truncate" title={u.name}>
                  {u.name}
                </span>
                <div className="flex-1 h-7 bg-muted/50 rounded-md overflow-hidden">
                  <div
                    className={`h-full rounded-md ${slow ? 'bg-amber-500' : 'bg-primary'}`}
                    style={{ width: `${share}%` }}
                    title={`${u.name}: среднее ${fmt(avg)}, медиана ${fmt(
                      medianOf(u)
                    )}, ответов ${u.answered}, без ответа ${u.noReply}`}
                  />
                </div>
                <span className="w-24 sm:w-28 shrink-0 text-right text-xs sm:text-sm font-semibold tabular-nums">
                  {u.answered ? fmt(avg) : <span className="text-muted-foreground font-normal">нет ответов</span>}
                </span>
                <span className="w-16 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums hidden sm:block">
                  {u.answered} шт
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-start gap-2.5 mt-5 p-3 rounded-lg bg-muted/50">
          <Icon name="Info" size={16} className="shrink-0 mt-0.5 text-muted-foreground" />
          <p className="text-xs leading-relaxed">
            {workTime
              ? 'Рабочее время: ночи и выходные вычтены по личному графику сотрудника — видно чистую скорость работы.'
              : 'Календарное время: все часы подряд, включая ночи и выходные — так ожидание видит пользователь.'}{' '}
            Оранжевым отмечены те, кто отвечает медленнее среднего по отделу. Наведите
            на полосу — покажет медиану и число заявок. У кого мало заявок, среднее
            легко смещается одним-двумя случаями.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default FirstResponseByUserChart;