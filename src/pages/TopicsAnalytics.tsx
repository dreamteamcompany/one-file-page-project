import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getApiUrl } from '@/utils/api';
import PageLayout from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

export interface IssueRow {
  name: string;
  count: number;
}

export interface ServiceRow {
  name: string;
  count: number;
  issues: IssueRow[];
}

export interface LineRow {
  name: string;
  count: number;
  services: ServiceRow[];
}

export interface TopicsData {
  month: string;
  total: number;
  lines: LineRow[];
}

const LINE_ICONS: Record<string, string> = {
  '1-я линия': 'Headset',
  '2-я линия ТП': 'Wrench',
  'Отдел Ильи': 'ServerCog',
  'Отдел МИС': 'Stethoscope',
  'Прочие исполнители': 'Users',
  'Исполнитель не назначен': 'CircleHelp',
};

const SERVICE_ICONS: Record<string, string> = {
  'МИС': 'Stethoscope',
  'Битрикс / CRM': 'LayoutGrid',
  'Телефония и рассылки': 'Phone',
  '1С / Бухгалтерия / ЗУП': 'Calculator',
  'VPN / сеть / удалёнка': 'Network',
  'Серверы и инфраструктура': 'Server',
  'Сайты и домены': 'Globe',
  'Боты и автоматизации': 'Bot',
  'Почта': 'Mail',
  'Оборудование': 'Printer',
  'Сервис не определён': 'CircleHelp',
};

const percent = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

/** Показываем только подразделения из утверждённых списков, в этом порядке. */
const VISIBLE_LINES = ['1-я линия', '2-я линия ТП', 'Отдел Ильи', 'Отдел МИС'];

const MONTH = '2026-08';

const TopicsAnalytics = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<TopicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openLines, setOpenLines] = useState<Record<string, boolean>>({});
  const [openServices, setOpenServices] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await apiFetch(
          `${getApiUrl('topics-analytics')}?endpoint=topics-analytics&month=${MONTH}`
        );
        if (!res.ok) throw new Error('bad response');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (cancelled) return;
        setData(null);
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleLine = (name: string) =>
    setOpenLines((prev) => ({ ...prev, [name]: !prev[name] }));

  const toggleService = (key: string) =>
    setOpenServices((prev) => ({ ...prev, [key]: !prev[key] }));

  // Оставляем только утверждённые подразделения; заявки без исполнителя
  // и у сотрудников вне списков в отчёт не попадают.
  const visibleLines = (data?.lines ?? [])
    .filter((l) => VISIBLE_LINES.includes(l.name))
    .sort((a, b) => VISIBLE_LINES.indexOf(a.name) - VISIBLE_LINES.indexOf(b.name));

  const visibleTotal = visibleLines.reduce((sum, l) => sum + l.count, 0);

  return (
    <PageLayout>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-accent/30 rounded-lg transition-colors"
          aria-label="Назад"
        >
          <Icon name="ArrowLeft" size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold">Аналитика обращений</h1>
          <p className="text-muted-foreground text-sm">
            Август 2026 — по сути вопроса, а не по выбранному сервису
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="py-10 text-center">
            <Icon name="TriangleAlert" size={32} className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">Не удалось загрузить аналитику</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && data && (
        <>
          <Card className="mb-6">
            <CardContent className="py-6 flex items-center gap-5">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon name="Inbox" size={28} className="text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Всего заявок за август</p>
                <p className="text-4xl font-bold">{visibleTotal}</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {visibleLines.map((line) => {
              const lineOpen = !!openLines[line.name];
              return (
                <Card key={line.name} className="overflow-hidden">
                  <button
                    onClick={() => toggleLine(line.name)}
                    className="w-full flex items-center gap-3 px-4 py-4 hover:bg-accent/20 transition-colors text-left"
                  >
                    <Icon
                      name={lineOpen ? 'ChevronDown' : 'ChevronRight'}
                      size={18}
                      className="text-muted-foreground shrink-0"
                    />
                    <Icon
                      name={LINE_ICONS[line.name] || 'Users'}
                      fallback="Users"
                      size={20}
                      className="text-primary shrink-0"
                    />
                    <span className="font-semibold flex-1">{line.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {percent(line.count, visibleTotal)}%
                    </span>
                    <span className="text-lg font-bold tabular-nums w-16 text-right">
                      {line.count}
                    </span>
                  </button>

                  {lineOpen && (
                    <div className="border-t border-border/60 bg-black/5 [.light_&]:bg-black/[0.02]">
                      {line.services.map((service) => {
                        const key = `${line.name}::${service.name}`;
                        const serviceOpen = !!openServices[key];
                        return (
                          <div key={key} className="border-b border-border/40 last:border-b-0">
                            <button
                              onClick={() => toggleService(key)}
                              className="w-full flex items-center gap-3 pl-10 pr-4 py-3 hover:bg-accent/20 transition-colors text-left"
                            >
                              <Icon
                                name={serviceOpen ? 'ChevronDown' : 'ChevronRight'}
                                size={16}
                                className="text-muted-foreground shrink-0"
                              />
                              <Icon
                                name={SERVICE_ICONS[service.name] || 'Box'}
                                fallback="Box"
                                size={18}
                                className="text-muted-foreground shrink-0"
                              />
                              <span className="flex-1 text-sm">{service.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {percent(service.count, line.count)}%
                              </span>
                              <span className="font-semibold tabular-nums w-16 text-right">
                                {service.count}
                              </span>
                            </button>

                            {serviceOpen && (
                              <div className="pb-2">
                                {service.issues.map((issue) => (
                                  <div
                                    key={`${key}::${issue.name}`}
                                    className="flex items-center gap-3 pl-[4.5rem] pr-4 py-2"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                                    <span className="flex-1 text-sm text-muted-foreground">
                                      {issue.name}
                                    </span>
                                    <span className="text-sm tabular-nums w-16 text-right">
                                      {issue.count}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <Card className="mt-3">
            <div className="flex items-center gap-3 px-4 py-4">
              <span className="w-[18px] shrink-0" />
              <Icon name="Sigma" size={20} className="text-primary shrink-0" />
              <span className="font-bold flex-1">Итого</span>
              <span className="text-sm text-muted-foreground">100%</span>
              <span className="text-lg font-bold tabular-nums w-16 text-right">
                {visibleTotal}
              </span>
            </div>
          </Card>

          <p className="text-xs text-muted-foreground mt-6 leading-relaxed">
            Август 2026. Подразделение определяется по исполнителю заявки, сервис и тип
            вопроса — по тексту обращения; каждая заявка учтена один раз. Заявки без
            исполнителя и у сотрудников вне списков подразделений не учитываются.
          </p>
        </>
      )}
    </PageLayout>
  );
};

export default TopicsAnalytics;