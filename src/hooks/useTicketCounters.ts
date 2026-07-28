import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TICKETS_COUNTERS_URL } from '@/utils/api';
import useVisiblePolling from '@/hooks/useVisiblePolling';

export interface TicketCounters {
  total: number;
  unique_tickets: number;
  by_role: {
    customer: number;
    assignee: number;
    watcher: number;
    approver: number;
  };
  by_event: {
    comment: number;
    mention: number;
    status_change: number;
    deadline_change: number;
    assignment_change: number;
    acceptance: number;
    overdue: number;
    other: number;
  };
  overdue: number;
}

const EMPTY: TicketCounters = {
  total: 0,
  unique_tickets: 0,
  by_role: { customer: 0, assignee: 0, watcher: 0, approver: 0 },
  by_event: {
    comment: 0,
    mention: 0,
    status_change: 0,
    deadline_change: 0,
    assignment_change: 0,
    acceptance: 0,
    overdue: 0,
    other: 0,
  },
  overdue: 0,
};

export const useTicketCounters = (pollMs = 300000) => {
  const { token, user } = useAuth();
  const [counters, setCounters] = useState<TicketCounters>(EMPTY);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token || !user) return;
    try {
      setLoading(true);
      const res = await fetch(TICKETS_COUNTERS_URL, {
        headers: { 'X-Auth-Token': token },
      });
      if (res.ok) {
        const data = await res.json();
        setCounters({ ...EMPTY, ...data });
      }
    } catch (e) {
      console.error('[useTicketCounters] failed:', e);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    refresh();
    const onRefresh = () => refresh();
    window.addEventListener('notifications:refresh', onRefresh);
    return () => {
      window.removeEventListener('notifications:refresh', onRefresh);
    };
  }, [refresh]);

  useVisiblePolling(refresh, pollMs, !!token && !!user);

  return { counters, loading, refresh };
};

export default useTicketCounters;