import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/utils/api';
import { TeamDashboardData, EscalationTicket } from './useTeamDashboard';

interface TeamTimeToL3RowProps {
  data?: TeamDashboardData | null;
  loading: boolean;
}

const formatMinutes = (min: number) => {
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0) return `${h} ч ${String(m).padStart(2, '0')} мин`;
  return `${m} мин`;
};

const TeamTimeToL3Row = ({ data, loading }: TeamTimeToL3RowProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDay, setModalDay] = useState<string>('');
  const [modalTickets, setModalTickets] = useState<EscalationTicket[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const { token } = useAuth();
  const navigate = useNavigate();

  const l3 = data?.time_to_l3;
  const series = l3?.series ?? [];
  const total = l3?.total ?? 0;
  const avg = l3?.avg ?? '—';

  const openTicketsForDay = async (date: string, label: string) => {
    if (!token) return;
    setModalDay(label);
    setModalOpen(true);
    setModalLoading(true);
    setModalTickets([]);
    try {
      const url = `${getApiUrl('dashboard-team')}?endpoint=escalation-tickets&direction=to_l3&day=${date}`;
      const res = await fetch(url, { headers: { 'X-Auth-Token': token } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setModalTickets(json.tickets ?? []);
    } catch (e) {
      console.error('Failed to fetch time-to-L3 tickets:', e);
    } finally {
      setModalLoading(false);
    }
  };

  const handleChartClick = (state: { activePayload?: { payload?: { date?: string; day?: string } }[] }) => {
    const point = state?.activePayload?.[0]?.payload;
    if (point?.date) openTicketsForDay(point.date, point.day ?? point.date);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Время до 3-й линии</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="flex flex-col gap-4">
          <div className="bg-muted/30 border border-border rounded-2xl p-5 flex flex-col gap-2">
            <div className="text-xs text-muted-foreground">Заявок дошло до 3-й линии</div>
            <div className="text-3xl font-bold text-foreground leading-none">{loading ? '—' : total.toLocaleString('ru-RU')}</div>
            <div className="text-xs text-muted-foreground">за выбранный период</div>
          </div>
          <div className="bg-muted/30 border border-border rounded-2xl p-5 flex flex-col gap-2">
            <div className="text-xs text-muted-foreground">Среднее время до 3-й линии</div>
            <div className="text-3xl font-bold text-foreground leading-none">{loading ? '—' : avg}</div>
            <div className="text-xs text-muted-foreground">рабочее время (Пн–Пт 9–18) от создания заявки</div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3 text-xs mb-2">
            <span className="text-muted-foreground">Клик по дню — список заявок с наибольшим временем до 3-й линии</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /> Кол-во заявок</span>
              <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Ср. время</span>
            </div>
          </div>
          <div className="h-48">
            {!loading && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} onClick={handleChartClick} className="cursor-pointer">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={32} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => formatMinutes(v)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={64} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12, color: 'hsl(var(--foreground))' }}
                    formatter={(value: number, name: string) =>
                      name === 'Ср. время' ? [formatMinutes(value), name] : [value, name]
                    }
                  />
                  <Bar yAxisId="left" dataKey="count" name="Кол-во заявок" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line yAxisId="right" type="monotone" dataKey="avg_minutes" name="Ср. время" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Заявки с наибольшим временем до 3-й линии · {modalDay}</DialogTitle>
          </DialogHeader>
          {modalLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Загрузка…</div>
          ) : modalTickets.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Нет заявок за этот день</div>
          ) : (
            <div className="flex flex-col gap-1 max-h-96 overflow-y-auto">
              {modalTickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setModalOpen(false);
                    navigate(`/tickets/${t.id}`);
                  }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="flex flex-col min-w-0 gap-1">
                    <span className="text-sm font-medium text-foreground truncate">{t.title || `Заявка #${t.id}`}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>#{t.id}</span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="User" size={12} />
                        {t.executor}
                      </span>
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: `${t.status_color}22`, color: t.status_color }}
                      >
                        {t.status}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-amber-600 whitespace-nowrap">{t.wait}</span>
                    <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamTimeToL3Row;
