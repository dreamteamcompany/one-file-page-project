import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { TeamDashboardData } from './useTeamDashboard';

interface TeamEscalationRowProps {
  data?: TeamDashboardData | null;
  loading: boolean;
}

const TeamEscalationRow = ({ data, loading }: TeamEscalationRowProps) => {
  const esc = data?.escalations ?? [];
  const total = data?.escalations_total ?? 0;
  const avg = data?.escalations_avg ?? '—';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="flex flex-col gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-2">
          <div className="text-xs text-muted-foreground">Эскалаций 1-я → 2-я линия</div>
          <div className="text-3xl font-bold text-foreground leading-none">{loading ? '—' : total.toLocaleString('ru-RU')}</div>
          <div className="text-xs text-muted-foreground">за выбранный период</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-2">
          <div className="text-xs text-muted-foreground">Среднее время до эскалации</div>
          <div className="text-3xl font-bold text-foreground leading-none">{loading ? '—' : avg}</div>
          <div className="text-xs text-muted-foreground">от попадания на 1-ю линию</div>
        </div>
      </div>

      <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Эскалации 1-я → 2-я линия по дням</h3>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /> Кол-во эскалаций</span>
            <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Ср. время (мин)</span>
          </div>
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
  );
};

export default TeamEscalationRow;