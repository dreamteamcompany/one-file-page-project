export interface User {
  id: number;
  username?: string;
  name: string;
  email: string;
  role?: string;
  role_name?: string;
  is_active?: boolean;
  created_at?: string;
  last_login?: string;
}

export interface Role {
  id: number;
  name: string;
  description?: string;
  permissions?: string[];
}

export interface NotificationSettings {
  email_notifications: boolean;
  push_notifications: boolean;
  sms_notifications: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortParams {
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  status?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
}
