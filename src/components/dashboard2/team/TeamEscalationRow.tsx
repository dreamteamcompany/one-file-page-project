import { useState } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { TeamDashboardData, EscalationDirectionKey } from './useTeamDashboard';

interface TeamEscalationRowProps {
  data?: TeamDashboardData | null;
  loading: boolean;
}

const DIRECTIONS: { key: EscalationDirectionKey; label: string; from: string }[] = [
  { key: '1_2', label: '1-я → 2-я', from: '1-ю' },
  { key: '1_3', label: '1-я → 3-я', from: '1-ю' },
  { key: '2_3', label: '2-я → 3-я', from: '2-ю' },
];

const TeamEscalationRow = ({ data, loading }: TeamEscalationRowProps) => {
  const [dir, setDir] = useState<EscalationDirectionKey>('1_2');

  const current = DIRECTIONS.find((d) => d.key === dir) ?? DIRECTIONS[0];
  const dirData = data?.escalation_directions?.[dir];
  const esc = dirData?.series ?? [];
  const total = dirData?.total ?? 0;
  const avg = dirData?.avg ?? '—';

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Эскалации между линиями</h3>
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
          {DIRECTIONS.map((d) => (
            <button
              key={d.key}
              onClick={() => setDir(d.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                dir === d.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="flex flex-col gap-4">
          <div className="bg-muted/30 border border-border rounded-2xl p-5 flex flex-col gap-2">
            <div className="text-xs text-muted-foreground">Эскалаций {current.label} линия</div>
            <div className="text-3xl font-bold text-foreground leading-none">{loading ? '—' : total.toLocaleString('ru-RU')}</div>
            <div className="text-xs text-muted-foreground">за выбранный период</div>
          </div>
          <div className="bg-muted/30 border border-border rounded-2xl p-5 flex flex-col gap-2">
            <div className="text-xs text-muted-foreground">Среднее время до эскалации</div>
            <div className="text-3xl font-bold text-foreground leading-none">{loading ? '—' : avg}</div>
            <div className="text-xs text-muted-foreground">рабочее время (Пн–Пт 9–18) от попадания на {current.from} линию</div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="flex items-center justify-end gap-3 text-xs mb-2">
            <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /> Кол-во эскалаций</span>
            <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Ср. время (мин)</span>
          </div>
          <div className="h-48">
            {!loading && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={esc} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={32} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12, color: 'hsl(var(--foreground))' }} />
                  <Bar yAxisId="left" dataKey="count" name="Кол-во эскалаций" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line yAxisId="right" type="monotone" dataKey="avg_minutes" name="Ср. время (мин)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamEscalationRow;