export interface CustomField {
  id: number;
  name: string;
  field_type: string;
  value: string;
  options?: string;
  is_required?: boolean;
}

export interface Ticket {
  id: number;
  title: string;
  description?: string;
  category_id?: number;
  category_name?: string;
  category_icon?: string;
  priority_id?: number;
  priority_name?: string;
  priority_color?: string;
  status_id?: number;
  status_name?: string;
  status_color?: string;
  department_id?: number;
  department_name?: string;
  service_id?: number;
  service_name?: string;
  created_by: number;
  creator_name?: string;
  creator_email?: string;
  assigned_to?: number;
  assignee_name?: string;
  assignee_email?: string;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
  closed_at?: string;
  custom_fields?: CustomField[];
  unread_comments?: number;
  has_response?: boolean;
}

export interface TicketComment {
  id: number;
  ticket_id: number;
  user_id: number;
  user_name?: string;
  user_email?: string;
  comment: string;
  is_internal: boolean;
  created_at?: string;
  attachments?: {
    id: number;
    filename: string;
    url: string;
    size: number;
  }[];
  reactions?: {
    emoji: string;
    count: number;
    users: number[];
  }[];
}

export interface TicketAuditLog {
  id: number;
  action: string;
  username: string;
  changed_fields?: any;
  old_values?: any;
  new_values?: any;
  metadata?: any;
  created_at: string;
}

export interface TicketFile {
  id: number;
  filename: string;
  url: string;
  size: number;
  uploaded_by?: string;
  uploaded_at?: string;
}

export interface TicketStatus {
  id: number;
  name: string;
  color: string;
  order?: number;
  is_closed?: boolean;
}

export interface TicketPriority {
  id: number;
  name: string;
  level: number;
  color: string;
}

export interface TicketCategory {
  id: number;
  name: string;
  description?: string;
  icon: string;
}

export interface TicketDepartment {
  id: number;
  name: string;
  description?: string;
}

export interface TicketService {
  id: number;
  name: string;
  description: string;
  category_id?: number;
  category_name?: string;
  service_ids?: number[];
}
