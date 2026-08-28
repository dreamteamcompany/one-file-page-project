import { FN } from '@/config/backend';
/**
 * Сервис для массовых операций с заявками
 * Single Responsibility: только API вызовы для bulk actions
 */

const BULK_TICKETS_URL = FN.BULK_TICKETS;

interface BulkActionResult {
  successful: number;
  total: number;
  error?: string;
}

export const bulkTicketsService = {
  async changeStatus(ticketIds: number[], statusId: number, token: string): Promise<BulkActionResult> {
    const response = await fetch(BULK_TICKETS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token,
      },
      body: JSON.stringify({
        ticket_ids: ticketIds,
        action: 'change_status',
        status_id: statusId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Ошибка изменения статуса');
    }

    return result;
  },

  async changePriority(ticketIds: number[], priorityId: number, token: string): Promise<BulkActionResult> {
    const response = await fetch(BULK_TICKETS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token,
      },
      body: JSON.stringify({
        ticket_ids: ticketIds,
        action: 'change_priority',
        priority_id: priorityId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Ошибка изменения приоритета');
    }

    return result;
  },

  async assignTickets(ticketIds: number[], userId: number, token: string): Promise<BulkActionResult> {
    const response = await fetch(BULK_TICKETS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token,
      },
      body: JSON.stringify({
        ticket_ids: ticketIds,
        action: 'assign',
        user_id: userId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Ошибка назначения заявок');
    }

    return result;
  },

  async changeExecutor(ticketIds: number[], userId: number | null, token: string): Promise<BulkActionResult> {
    const response = await fetch(BULK_TICKETS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token,
      },
      body: JSON.stringify({
        ticket_ids: ticketIds,
        action: 'change_executor',
        user_id: userId,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Ошибка смены исполнителя');
    }
    return result;
  },

  async changeExecutorGroup(ticketIds: number[], groupId: number | null, token: string): Promise<BulkActionResult> {
    const response = await fetch(BULK_TICKETS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token,
      },
      body: JSON.stringify({
        ticket_ids: ticketIds,
        action: 'change_executor_group',
        group_id: groupId,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Ошибка смены группы исполнителей');
    }
    return result;
  },

  async addWatchers(ticketIds: number[], userIds: number[], token: string): Promise<BulkActionResult & { inserted?: number }> {
    const response = await fetch(BULK_TICKETS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token,
      },
      body: JSON.stringify({
        ticket_ids: ticketIds,
        action: 'add_watchers',
        user_ids: userIds,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Ошибка добавления наблюдателей');
    }
    return result;
  },

  async deleteTickets(ticketIds: number[], token: string): Promise<BulkActionResult> {
    const response = await fetch(BULK_TICKETS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token,
      },
      body: JSON.stringify({
        ticket_ids: ticketIds,
        action: 'delete',
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Ошибка удаления заявок');
    }

    return result;
  },
};