import { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getApiUrl } from '@/utils/api';
import PageLayout from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import WeeklyTicketsChart from '@/components/analytics/WeeklyTicketsChart';
import FirstResponseChart from '@/components/analytics/FirstResponseChart';
import ResolutionTimeChart from '@/components/analytics/ResolutionTimeChart';
import DelayReasonsChart from '@/components/analytics/DelayReasonsChart';
import RatingChart from '@/components/analytics/RatingChart';
import ReopenedChart from '@/components/analytics/ReopenedChart';

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

export interface WeekRow {
  label: string;
  count: number;
  created: number;
  carried: number;
  days: number;
}

export interface FirstResponseWeek {
  label: string;
  avgMinutes: number;
  medianMinutes: number;
  count: number;
}

export interface FirstResponseData {
  weeks: FirstResponseWeek[];
  avgMinutes: number;
  answered: number;
  noReply: number;
}

export interface ResolutionWeek {
  label: string;
  avgHours: number;
  medianHours: number;
  avgWorkHours: number;
  medianWorkHours: number;
  count: number;
  total: number;
  pending: number;
}

export interface ResolutionData {
  weeks: ResolutionWeek[];
  avgHours: number;
  avgWorkHours: number;
  count: number;
  total: number;
  pending: number;
}

export interface DelayItem {
  status: string;
  hours: number;
  workHours: number;
  avgHours: number;
  avgWorkHours: number;
  periods: number;
}

export interface DelayGroup {
  side: 'our' | 'client';
  label: string;
  hours: number;
  workHours: number;
  share: number;
  workShare: number;
  periods: number;
  avgHours: number;
  avgWorkHours: number;
  items: DelayItem[];
}

export interface DelayReasonsData {
  groups: DelayGroup[];
  totalHours: number;
  totalWorkHours: number;
  tickets: number;
  firstWaitMedian: number;
  openOnUs: number;
}

export interface RatingBucket {
  stars: number;
  count: number;
  share: number;
}

export interface RatingData {
  avg: number;
  rated: number;
  total: number;
  coverage: number;
  low: number;
  distribution: RatingBucket[];
}

export interface ReopenedWeek {
  label: string;
  count: number;
  total: number;
  share: number;
}

export interface ReopenedData {
  weeks: ReopenedWeek[];
  count: number;
  total: number;
  events: number;
  share: number;
}

export interface TopicsData {
  month: string;
  total: number;
  lines: LineRow[];
  weeksMonth?: string;
  weeks?: WeekRow[];
  firstResponse?: FirstResponseData;
  resolution?: ResolutionData;
  delayReasons?: DelayReasonsData;
  rating?: RatingData;
  reopened?: ReopenedData;
}

/** Показываем только подразделения из утверждённых списков, в этом порядке. */
const VISIBLE_LINES = ['1-я линия', '2-я линия ТП', 'Отдел Ильи', 'Отдел МИС'];

const PERIOD = 'all';

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
          `${getApiUrl('topics-analytics')}?endpoint=topics-analytics&month=${PERIOD}`
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
            За всё время — по сути вопроса, а не по выбранному сервису
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
          <WeeklyTicketsChart weeks={data.weeks ?? []} />

          {data.firstResponse && <FirstResponseChart data={data.firstResponse} />}

          {data.resolution && <ResolutionTimeChart data={data.resolution} />}

          {data.delayReasons && <DelayReasonsChart data={data.delayReasons} />}

          {data.rating && <RatingChart data={data.rating} />}

          {data.reopened && <ReopenedChart data={data.reopened} />}

          <h2 className="text-lg font-bold mb-3">Итог по вашим спискам</h2>

          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-accent/30 [.light_&]:bg-black/[0.04]">
                  <th className="text-left font-semibold px-4 py-3">Подразделение</th>
                  <th className="text-left font-semibold px-4 py-3 w-40">Заявок</th>
                </tr>
              </thead>
              <tbody>
                {visibleLines.map((line) => {
                  const lineOpen = !!openLines[line.name];
                  return (
                    <Fragment key={line.name}>
                      <tr
                        onClick={() => toggleLine(line.name)}
                        className="border-t border-border cursor-pointer hover:bg-accent/20 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <Icon
                              name={lineOpen ? 'ChevronDown' : 'ChevronRight'}
                              size={16}
                              className="text-muted-foreground shrink-0"
                            />
                            {line.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{line.count}</td>
                      </tr>

                      {lineOpen &&
                        line.services.map((service) => {
                          const key = `${line.name}::${service.name}`;
                          const serviceOpen = !!openServices[key];
                          return (
                            <Fragment key={key}>
                              <tr
                                onClick={() => toggleService(key)}
                                className="border-t border-border/50 cursor-pointer bg-black/10 [.light_&]:bg-black/[0.02] hover:bg-accent/20 transition-colors"
                              >
                                <td className="px-4 py-2.5 pl-10">
                                  <span className="flex items-center gap-2 text-muted-foreground">
                                    <Icon
                                      name={serviceOpen ? 'ChevronDown' : 'ChevronRight'}
                                      size={14}
                                      className="shrink-0"
                                    />
                                    {service.name}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                                  {service.count}
                                </td>
                              </tr>

                              {serviceOpen &&
                                service.issues.map((issue) => (
                                  <tr
                                    key={`${key}::${issue.name}`}
                                    className="border-t border-border/30 bg-black/20 [.light_&]:bg-black/[0.04]"
                                  >
                                    <td className="px-4 py-2 pl-[4.5rem] text-muted-foreground">
                                      {issue.name}
                                    </td>
                                    <td className="px-4 py-2 tabular-nums text-muted-foreground">
                                      {issue.count}
                                    </td>
                                  </tr>
                                ))}
                            </Fragment>
                          );
                        })}
                    </Fragment>
                  );
                })}

                <tr className="border-t border-border bg-accent/20 [.light_&]:bg-black/[0.03]">
                  <td className="px-4 py-3 font-bold">Итого</td>
                  <td className="px-4 py-3 font-bold tabular-nums">{visibleTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
            За всё время. Подразделение определяется по исполнителю заявки, сервис и тип
            вопроса — по тексту обращения; каждая заявка учтена один раз. Заявки без
            исполнителя и у сотрудников вне списков подразделений не учитываются.
          </p>
        </>
      )}
    </PageLayout>
  );
};

export default TopicsAnalytics;