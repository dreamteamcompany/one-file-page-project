import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getApiUrl } from '@/utils/api';

export type AccessChecklistStatus = 'pending' | 'done' | 'not_applicable';

export interface AccessChecklistItem {
  id: number;
  service_id: number | null;
  service_name: string;
  sort_order: number;
  status: AccessChecklistStatus;
  comment: string | null;
  completed_by_user_id: number | null;
  completed_at: string | null;
  completed_by_name: string | null;
  completed_by_username: string | null;
}

interface ChecklistResponse {
  required: boolean;
  items: AccessChecklistItem[];
  total?: number;
  completed?: number;
  pending?: number;
  can_edit: boolean;
}

export const useAccessChecklist = (ticketId: number) => {
  const [items, setItems] = useState<AccessChecklistItem[]>([]);
  const [required, setRequired] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await apiFetch(
        `${getApiUrl('ticket-access-checklist')}?endpoint=ticket-access-checklist&ticket_id=${ticketId}`
      );
      if (!res.ok) {
        setLoadError('Не удалось загрузить чек-лист блокировки доступов');
        return;
      }
      const data: ChecklistResponse = await res.json();
      setRequired(!!data.required);
      setItems(data.items || []);
      setCanEdit(!!data.can_edit);
    } catch {
      setLoadError('Нет связи с сервером. Чек-лист не загружен');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateItem = useCallback(
    async (
      itemId: number,
      status: AccessChecklistStatus,
      comment?: string | null
    ): Promise<{ ok: boolean; error?: string }> => {
      setSavingId(itemId);
      try {
        const res = await apiFetch(
          `${getApiUrl('ticket-access-checklist')}?endpoint=ticket-access-checklist&item_id=${itemId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, comment: comment ?? null }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { ok: false, error: data?.error || 'Не удалось сохранить изменение' };
        }
        setItems(data.items || []);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Нет связи с сервером. Изменение не сохранено' };
      } finally {
        setSavingId(null);
      }
    },
    []
  );

  const total = items.length;
  const pending = items.filter((i) => i.status === 'pending').length;
  const completed = total - pending;

  return {
    items,
    required,
    canEdit,
    loading,
    loadError,
    savingId,
    total,
    completed,
    pending,
    reload: load,
    updateItem,
  };
};

export default useAccessChecklist;
