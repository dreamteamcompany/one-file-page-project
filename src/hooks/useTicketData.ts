import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL, apiFetch, cachedJsonFetch } from '@/utils/api';
import type { Ticket, TicketComment, TicketAuditLog, TicketStatus, User } from '@/types';
import { FN } from '@/config/backend';

interface ApprovalRow {
  id: number;
  ticket_id: number;
  approver_id: number;
  status: string;
  comment: string | null;
  created_at: string;
  updated_at: string | null;
  approver_name?: string;
  approver_email?: string;
  approver_photo_url?: string | null;
}

interface ExecutorGroup {
  id: number;
  name: string;
}

export const useTicketData = (id: string | undefined, initialTicket: Ticket | null = null) => {
  const { token } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(initialTicket);
  const [statuses, setStatuses] = useState<TicketStatus[]>([]);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [executorUsers, setExecutorUsers] = useState<User[]>([]);
  const [executorGroups, setExecutorGroups] = useState<ExecutorGroup[]>([]);
  const [auditLogs, setAuditLogs] = useState<TicketAuditLog[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [participantIds, setParticipantIds] = useState<number[]>([]);
  const [myLastSeenAt, setMyLastSeenAt] = useState<string | null>(null);
  const commentsAbortRef = useRef<AbortController | null>(null);
  const commentsRequestIdRef = useRef<string | null>(null);
  const historyAbortRef = useRef<AbortController | null>(null);
  const historyRequestIdRef = useRef<string | null>(null);
  // Флаг: bundle уже отдал нам комментарии (значит fallback-запрос не нужен).
  const bundleCommentsReceivedRef = useRef<boolean>(false);

  const loadTicket = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const response = await apiFetch(`${API_URL}?endpoint=tickets&ticket_id=${id}`, {
        headers: {
          'X-Auth-Token': token,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const foundTicket = data.tickets?.[0];
        if (foundTicket) {
          setTicket(foundTicket);
        }
      }
    } catch (error) {
      console.error('Error loading ticket:', error);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const loadTicketFull = async (showLoader = true) => {
    if (!id) return;
    const requestTicketId = id;
    try {
      if (showLoader) setLoading(true);
      setLoadingHistory(true);
      const response = await apiFetch(`${API_URL}?endpoint=tickets-full&ticket_id=${id}`, {
        headers: { 'X-Auth-Token': token },
      });
      if (response.ok) {
        const data = await response.json();
        // Защита от гонок: если за время запроса пользователь успел открыть другую заявку — игнорируем
        if (requestTicketId !== id) return;
        if (data.ticket) setTicket(data.ticket);
        setAuditLogs(Array.isArray(data.history) ? data.history : []);
        setApprovals(Array.isArray(data.approvals) ? data.approvals : []);
        // Объединённый ответ содержит и комментарии — используем их, чтобы
        // не делать отдельный запрос. Так bundle снимает нагрузку с БД.
        if (Array.isArray(data.comments)) {
          setComments(data.comments);
          setLoadingComments(false);
          bundleCommentsReceivedRef.current = true;
        }
        if (Array.isArray(data.participant_ids)) {
          setParticipantIds(data.participant_ids);
        }
        if (typeof data.my_last_seen_at === 'string' || data.my_last_seen_at === null) {
          setMyLastSeenAt(data.my_last_seen_at ?? null);
        }
      }
      // При response.ok === false (например 500) — не очищаем уже отображённые комментарии.
      // apiFetch сам выполнит 3 ретрая с задержками 1с/2с/4с для статусов 500/502/503/504.
    } catch (error) {
      console.error('Error loading ticket-full:', error);
      // При сетевой ошибке также не очищаем данные — оставляем последний успешный снимок
    } finally {
      if (showLoader) setLoading(false);
      setLoadingHistory(false);
    }
  };

  const loadStatuses = async () => {
    let firstOk = false;
    let loaded: TicketStatus[] = [];
    try {
      const data = await cachedJsonFetch<{ statuses?: TicketStatus[] }>(
        `${API_URL}?endpoint=ticket-dictionaries-api`,
        { headers: { 'X-Auth-Token': token } },
      );
      firstOk = true;
      loaded = Array.isArray(data?.statuses) ? data.statuses : [];
    } catch (error) {
      console.error('Error loading statuses (primary):', error);
    }

    // Фолбэк включается ТОЛЬКО если основной endpoint ответил 200, но статусы пустые
    // (например, фильтр по ролям всё срезал). При сетевой ошибке/rate-limit не добиваем бэк.
    if (firstOk && loaded.length === 0) {
      try {
        const fbData = await cachedJsonFetch<TicketStatus[]>(
          `${API_URL}?endpoint=ticket-statuses`,
          { headers: { 'X-Auth-Token': token } },
        );
        if (Array.isArray(fbData)) {
          loaded = fbData;
        }
      } catch (fbErr) {
        console.error('[loadStatuses] fallback error:', fbErr);
      }
    }

    setStatuses(loaded);
  };

  const loadUsers = async () => {
    try {
      const data = await cachedJsonFetch<Array<{ id: number; full_name?: string; username?: string; photo_url?: string; is_active?: boolean }>>(
        `${API_URL}?endpoint=users`,
        { headers: { 'X-Auth-Token': token } },
      );
      const adaptedUsers = Array.isArray(data) ? data
        .filter((u) => u.is_active !== false)
        .map((u) => ({
          id: u.id,
          name: u.full_name || u.username || '',
          email: u.username || '',
          role: '',
          photo_url: u.photo_url || ''
        })) : [];
      setUsers(adaptedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadExecutorUsers = async () => {
    try {
      const data = await cachedJsonFetch<Array<{ id: number; full_name?: string; username?: string; photo_url?: string; is_active?: boolean }>>(
        `${API_URL}?endpoint=users&system_roles=admin,executor`,
        { headers: { 'X-Auth-Token': token } },
      );
      const adaptedUsers = Array.isArray(data) ? data
        .filter((u) => u.is_active !== false)
        .map((u) => ({
          id: u.id,
          name: u.full_name || u.username || '',
          email: u.username || '',
          role: '',
          photo_url: u.photo_url || ''
        })) : [];
      setExecutorUsers(adaptedUsers);
    } catch (error) {
      console.error('Error loading executor users:', error);
    }
  };

  const loadHistory = async (options?: { silent?: boolean; retries?: number }) => {
    if (!id) return;
    const silent = options?.silent ?? false;
    const maxRetries = options?.retries ?? 2;

    if (historyAbortRef.current) {
      historyAbortRef.current.abort();
    }
    const controller = new AbortController();
    historyAbortRef.current = controller;

    const requestTicketId = id;
    historyRequestIdRef.current = requestTicketId;

    if (!silent) setLoadingHistory(true);
    const historyUrl = FN.TICKET_HISTORY;

    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const response = await apiFetch(`${historyUrl}?ticket_id=${requestTicketId}`, {
          headers: {
            'X-Auth-Token': token,
          },
          signal: controller.signal,
        });

        if (historyRequestIdRef.current !== requestTicketId || controller.signal.aborted) {
          return;
        }

        if (response.ok) {
          const data = await response.json();
          if (historyRequestIdRef.current !== requestTicketId || controller.signal.aborted) {
            return;
          }
          setAuditLogs(data.logs || []);
          if (!silent) setLoadingHistory(false);
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        attempt += 1;
        if (attempt > maxRetries) {
          console.error('Error loading history:', error);
          if (historyRequestIdRef.current === requestTicketId && !silent) {
            setLoadingHistory(false);
          }
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      }
    }
  };

  const loadComments = async (options?: { silent?: boolean; retries?: number }) => {
    if (!id) return;
    const silent = options?.silent ?? false;
    const maxRetries = options?.retries ?? 2;

    if (commentsAbortRef.current) {
      commentsAbortRef.current.abort();
    }
    const controller = new AbortController();
    commentsAbortRef.current = controller;

    const requestTicketId = id;
    commentsRequestIdRef.current = requestTicketId;

    if (!silent) setLoadingComments(true);
    const commentsUrl = FN.TICKET_COMMENTS;

    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const response = await apiFetch(`${commentsUrl}?ticket_id=${requestTicketId}`, {
          headers: {
            'X-Auth-Token': token,
          },
          signal: controller.signal,
        });

        if (commentsRequestIdRef.current !== requestTicketId || controller.signal.aborted) {
          return;
        }

        if (response.ok) {
          const data = await response.json();
          if (commentsRequestIdRef.current !== requestTicketId || controller.signal.aborted) {
            return;
          }
          // Не очищаем переписку, если бэкенд вернул пустой/невалидный массив
          // на ретраи — лучше показать прежний снимок, чем пустоту.
          if (Array.isArray(data.comments)) {
            setComments(data.comments);
          }
          if (Array.isArray(data.participant_ids)) {
            setParticipantIds(data.participant_ids);
          }
          if (typeof data.my_last_seen_at === 'string' || data.my_last_seen_at === null) {
            setMyLastSeenAt(data.my_last_seen_at ?? null);
          }
          if (!silent) setLoadingComments(false);
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        attempt += 1;
        if (attempt > maxRetries) {
          // НЕ очищаем список комментариев — пользователь увидит предыдущий снимок.
          console.error('Error loading comments:', error);
          if (commentsRequestIdRef.current === requestTicketId && !silent) {
            setLoadingComments(false);
          }
          return;
        }
        // Задержки между попытками: 1с, 2с, 4с (защита от rate-limit БД).
        const delays = [1000, 2000, 4000];
        const delay = delays[attempt - 1] ?? 4000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  };

  const markCommentsRead = async (commentIds: number[]) => {
    if (!commentIds.length) return;
    try {
      const commentsUrl = FN.TICKET_COMMENTS;
      await apiFetch(`${commentsUrl}?action=mark-read`, {
        method: 'POST',
        headers: {
          'X-Auth-Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment_ids: commentIds }),
      });
    } catch (error) {
      console.error('Error marking comments read:', error);
    }
  };

  const loadExecutorGroups = async () => {
    const EXECUTOR_GROUPS_URL = FN.EXECUTOR_GROUPS;
    try {
      const data = await cachedJsonFetch<ExecutorGroup[] | { groups?: ExecutorGroup[] }>(
        EXECUTOR_GROUPS_URL,
        { headers: { 'X-Auth-Token': token } },
      );
      if (Array.isArray(data)) {
        setExecutorGroups(data);
      } else {
        setExecutorGroups(data?.groups || []);
      }
    } catch (error) {
      console.error('Error loading executor groups:', error);
    }
  };

  useEffect(() => {
    // При смене заявки очищаем переписку (чтобы не показать чужие комменты),
    // но ставим флаг loadingComments=true — UI должен рисовать спиннер, а НЕ «0 комментариев».
    setComments([]);
    setAuditLogs([]);
    setApprovals([]);
    setParticipantIds([]);
    setMyLastSeenAt(null);
    if (id && token) {
      setLoadingComments(true);
      setLoadingHistory(true);
      // Сбрасываем флаг — bundle для новой заявки ещё не пришёл.
      bundleCommentsReceivedRef.current = false;
    }

    if (id && token) {
      // Один объединённый запрос: ticket + history + approvals + comments.
      // Это снимает 3 параллельных запроса в БД и защищает от rate-limit.
      loadTicketFull();
      // Справочники грузятся с кэшем (TTL 5 минут) — не дёргают БД при повторных открытиях заявок.
      loadStatuses();
      loadExecutorGroups();
      loadUsers();
      loadExecutorUsers();

      // Fallback: если bundle через 3с НЕ вернул комментарии
      // (старая версия backend / ретраи всё ещё идут) — догрузим отдельным запросом.
      // В нормальном режиме bundle отвечает за 200-500мс и этот fallback пропускается.
      const tCommentsFallback = setTimeout(() => {
        if (!bundleCommentsReceivedRef.current) {
          loadComments({ silent: true });
        }
      }, 3000);

      return () => {
        clearTimeout(tCommentsFallback);
        if (commentsAbortRef.current) {
          commentsAbortRef.current.abort();
        }
        commentsRequestIdRef.current = null;
        if (historyAbortRef.current) {
          historyAbortRef.current.abort();
        }
        historyRequestIdRef.current = null;
      };
    }

    return () => {
      if (commentsAbortRef.current) {
        commentsAbortRef.current.abort();
      }
      commentsRequestIdRef.current = null;
      if (historyAbortRef.current) {
        historyAbortRef.current.abort();
      }
      historyRequestIdRef.current = null;
    };
  }, [id, token]);

  return {
    ticket,
    statuses,
    comments,
    users,
    executorUsers,
    executorGroups,
    auditLogs,
    approvals,
    loading,
    loadingComments,
    loadingHistory,
    loadTicket,
    loadTicketFull,
    loadComments,
    loadHistory,
    participantIds,
    myLastSeenAt,
    markCommentsRead,
  };
};