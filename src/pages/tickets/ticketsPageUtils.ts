import { getDeadlineSeverity } from '@/utils/dateFormat';

export type CounterRole = 'assignee' | 'customer' | 'approver' | 'mentions' | 'overdue';

export const CLOSED_STATUSES = ['закрыта', 'закрыт', 'решена', 'решён', 'решен', 'выполнена', 'выполнен', 'отклонена', 'отменена'];

export const isOverdueTicket = (ticket: { due_date?: string; status_name?: string }): boolean => {
  const status = (ticket.status_name || '').trim().toLowerCase();
  if (CLOSED_STATUSES.includes(status)) return false;
  return getDeadlineSeverity(ticket.due_date)?.overdue === true;
};

export interface BulkUser {
  id: number;
  full_name?: string;
  username?: string;
}

export interface BulkExecutorGroup {
  id: number;
  name: string;
}

export const EXECUTOR_GROUPS_URL = 'https://functions.poehali.dev/a52eb50f-38cf-4887-aead-cc77f01ca416';

export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'created_at', label: 'Дате создания' },
  { value: 'due_date', label: 'Дедлайну' },
  { value: 'status', label: 'Статусу' },
  { value: 'assignee', label: 'Исполнителю' },
  { value: 'creator', label: 'Заказчику' },
  { value: 'executor_group', label: 'Группе исполнителей' },
  { value: 'service', label: 'Услуге' },
  { value: 'ticket_service', label: 'Сервису' },
];

export const userLabel = (u: BulkUser) => (u.full_name || u.username || `#${u.id}`);
