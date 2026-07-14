import Icon from '@/components/ui/icon';
import { TeamKpi } from './useTeamDashboard';

interface TeamKpiRowProps {
  kpi?: TeamKpi;
  loading: boolean;
}

const TeamKpiRow = ({ kpi, loading }: TeamKpiRowProps) => {
  const cards = [
    {
      label: 'Всего инженеров',
      value: kpi ? String(kpi.engineers) : '—',
      sub: '',
      tone: 'neutral' as const,
    },
    {
      label: 'Закрыто заявок',
      value: kpi ? kpi.closed.toLocaleString('ru-RU') : '—',
      sub: kpi ? `${kpi.closed_delta >= 0 ? '+' : ''}${kpi.closed_delta} к прошлому периоду` : '',
      tone: kpi && kpi.closed_delta >= 0 ? ('up' as const) : ('down' as const),
    },
    {
      label: 'Среднее время решения',
      value: kpi ? kpi.avg_resolve : '—',
      sub: '',
      tone: 'up' as const,
    },
    {
      label: 'SLA соблюдено (команда)',
      value: kpi ? `${kpi.sla_compliance}%` : '—',
      sub: kpi ? `+${kpi.sla_delta}%` : '',
      tone: 'up' as const,
    },
    {
      label: 'Оценка клиентов (CSAT)',
      value: kpi ? `${kpi.csat.toFixed(2)} / 5` : '—',
      sub: kpi ? `+${kpi.csat_delta}` : '',
      tone: 'up' as const,
      stars: true,
      rating: kpi?.csat ?? 0,
    },
  ];

  const toneClass = (tone: 'up' | 'down' | 'neutral') =>
    tone === 'up' ? 'text-emerald-500' : tone === 'down' ? 'text-red-500' : 'text-muted-foreground';

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
          <div className="text-xs text-muted-foreground">{c.label}</div>
          <div className="text-2xl font-bold text-foreground leading-none">{loading ? '—' : c.value}</div>
          {c.stars && !loading && (
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Icon key={s} name="Star" size={13} className={s <= Math.round(c.rating ?? 0) ? 'text-amber-400' : 'text-muted-foreground/30'} />
              ))}
            </div>
          )}
          {c.sub && <div className={`text-xs font-medium ${toneClass(c.tone)}`}>{c.sub}</div>}
        </div>
      ))}
    </div>
  );
};

export default TeamKpiRow;