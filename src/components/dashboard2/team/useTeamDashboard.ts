import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/utils/api';
import { PeriodType } from '../ops/useOpsDashboard';

export interface TeamKpi {
  engineers: number;
  closed: number;
  closed_delta: number;
  avg_resolve: string;
  sla_compliance: number;
  sla_delta: number;
  csat: number;
  csat_delta: number;
}

export interface EngineerRating {
  id: number;
  name: string;
  photo: string;
  closed: number;
  avg_resolve: string;
  sla: number;
  rating: number;
}

export interface WorkloadItem {
  id: number;
  name: string;
  active: number;
}

export interface DistributionItem {
  name: string;
  count: number;
  percent: number;
}

export interface PerformancePoint {
  day: string;
  closed: number;
  sla: number;
}

export interface EscalationPoint {
  day: string;
  count: number;
  avg_minutes: number;
}

export interface EscalationDirection {
  series: EscalationPoint[];
  total: number;
  avg: string;
}

export type EscalationDirectionKey = '1_2' | '1_3' | '2_3';

export interface TeamDashboardData {
  kpi: TeamKpi;
  engineers_rating: EngineerRating[];
  workload: WorkloadItem[];
  distribution: DistributionItem[];
  distribution_total: number;
  performance: PerformancePoint[];
  escalations: EscalationPoint[];
  escalations_total: number;
  escalations_avg: string;
  escalation_directions: Record<EscalationDirectionKey, EscalationDirection>;
}

const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const useTeamDashboard = (period: PeriodType, dateFrom?: Date, dateTo?: Date) => {
  const { token } = useAuth();
  const [data, setData] = useState<TeamDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    if (period === 'custom' && (!dateFrom || !dateTo)) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let url = `${getApiUrl('dashboard-team')}?endpoint=dashboard-team&period=${period}`;
      if (period === 'custom' && dateFrom && dateTo) {
        url += `&from_date=${formatDate(dateFrom)}&to_date=${formatDate(dateTo)}`;
      }
      const response = await fetch(url, { headers: { 'X-Auth-Token': token } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      setData(json);
    } catch (e) {
      console.error('Failed to fetch team dashboard:', e);
    } finally {
      setLoading(false);
    }
  }, [token, period, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, refresh: fetchData };
};

export default useTeamDashboard;