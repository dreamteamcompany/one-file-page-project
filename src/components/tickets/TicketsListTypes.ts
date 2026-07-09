import { getDeadlineSeverity } from '@/utils/dateFormat';

export interface CustomField {
  id: number;
  name: string;
  field_type: string;
  value: string;
}

export interface TicketService {
  id: number;
  name: string;
}

export interface Service {
  id: number;
  name: string;
  category_name?: string;
}

export interface Ticket {
  id: number;
  title: string;
  description?: string;
  category_name?: string;
  category_icon?: string;
  priority_id?: number;
  priority_name?: string;
  priority_color?: string;
  status_id?: number;
  status_name?: string;
  status_color?: string;
  department_name?: string;
  service_name?: string;
  due_date?: string;
  created_at?: string;
  custom_fields?: CustomField[];
  customer_name?: string;
  creator_name?: string;
  creator_photo_url?: string;
  assigned_to_name?: string;
  assignee_name?: string;
  assignee_photo_url?: string;
  assigned_to?: number;
  created_by?: number;
  unread_comments?: number;
  unread_count?: number;
  unread_mentions?: number;
  has_new?: boolean;
  client_replied?: boolean;
  client_replied_at?: string;
  ticket_service?: TicketService;
  services?: Service[];
  last_comment?: TicketLastComment | null;
}

export interface TicketLastComment {
  id: number;
  comment: string;
  created_at: string;
  is_internal?: boolean;
  author_name?: string;
  author_email?: string;
  author_photo_url?: string;
}

export interface TicketsListProps {
  tickets: Ticket[];
  loading: boolean;
  onTicketClick: (ticket: Ticket) => void;
  selectedTicketIds?: number[];
  onToggleTicket?: (ticketId: number) => void;
  onToggleAll?: (ticketIds: number[], allSelected: boolean) => void;
  bulkMode?: boolean;
  currentUserId?: number;
  page?: number;
  totalPages?: number;
  totalTickets?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (size: number) => void;
}

export interface DeadlineProgress {
  percent: number;
  color: string;
  label: string;
}

export const getDeadlineProgress = (dueDate?: string): DeadlineProgress | null => {
  const s = getDeadlineSeverity(dueDate);
  if (!s) return null;
  return { percent: s.percent, color: s.color, label: s.label };
};