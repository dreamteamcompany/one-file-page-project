import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/utils/api';

export interface CustomField {
  id: number;
  name: string;
  field_type: string;
  value: string;
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
}

export interface Comment {
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

export interface AuditLog {
  id: number;
  action: string;
  username: string;
  changed_fields?: any;
  old_values?: any;
  new_values?: any;
  metadata?: any;
  created_at: string;
}

export interface Status {
  id: number;
  name: string;
  color: string;
  order: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role?: string;
}

export const useTicketData = (id: string | undefined, initialTicket: Ticket | null = null) => {
  const { token } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(initialTicket);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(!initialTicket);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadTicket = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}?endpoint=tickets-api`, {
        headers: {
          'X-Auth-Token': token,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const foundTicket = data.tickets?.find((t: Ticket) => t.id === Number(id));
        if (foundTicket) {
          setTicket(foundTicket);
        }
      }
    } catch (error) {
      console.error('Error loading ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatuses = async () => {
    try {
      const response = await fetch(`${API_URL}?endpoint=ticket-dictionaries-api`, {
        headers: {
          'X-Auth-Token': token,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setStatuses(data.statuses || []);
      }
    } catch (error) {
      console.error('Error loading statuses:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch(`${API_URL}?endpoint=users`, {
        headers: {
          'X-Auth-Token': token,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const adaptedUsers = Array.isArray(data) ? data.map((u: any) => ({
          id: u.id,
          name: u.full_name || u.username,
          email: u.username,
          role: ''
        })) : [];
        setUsers(adaptedUsers);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await fetch(`${API_URL}?endpoint=ticket-history&ticket_id=${id}`, {
        headers: {
          'X-Auth-Token': token,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadComments = async () => {
    try {
      setLoadingComments(true);
      const response = await fetch(`${API_URL}?endpoint=ticket-comments-api&ticket_id=${id}`, {
        headers: {
          'X-Auth-Token': token,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadTicket();
      loadStatuses();
      loadComments();
      loadUsers();
      loadHistory();
    }
  }, [id]);

  return {
    ticket,
    statuses,
    comments,
    users,
    auditLogs,
    loading,
    loadingComments,
    loadingHistory,
    loadTicket,
    loadComments,
    loadHistory,
  };
};
