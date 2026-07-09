import { getDeadlineSeverity } from '@/utils/dateFormat';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  photo_url?: string;
}

export interface ExecutorGroup {
  id: number;
  name: string;
}

export interface Status {
  id: number;
  name: string;
  color: string;
  is_closed: boolean;
  is_approval?: boolean;
  is_approved?: boolean;
  is_in_progress?: boolean;
  is_reopened?: boolean;
  is_waiting_response?: boolean;
  order?: number;
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
  previous_status_id?: number | null;
  department_name?: string;
  created_by: number;
  creator_name?: string;
  creator_email?: string;
  assigned_to?: number;
  assignee_name?: string;
  assignee_email?: string;
  assignee_photo_url?: string;
  due_date?: string;
  response_due_date?: string;
  created_at?: string;
  updated_at?: string;
  closed_at?: string;
  executor_group_id?: number;
  executor_group_name?: string;
  ticket_service?: {
    id: number;
    name: string;
  };
  services?: Array<{
    id: number;
    name: string;
    category_name?: string;
  }>;
}

export interface DeadlineInfo {
  color: string;
  label: string;
  urgent: boolean;
}

export const getDeadlineInfo = (dueDate?: string): DeadlineInfo | null => {
  const s = getDeadlineSeverity(dueDate);
  if (!s) return null;
  return { color: s.color, label: s.label, urgent: s.urgent };
};