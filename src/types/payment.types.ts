export interface PaymentCustomField {
  id: number;
  name: string;
  field_type: string;
  value: string;
}

export interface PaymentCustomFieldDefinition {
  id: number;
  name: string;
  field_type: string;
  options: string;
  is_required?: boolean;
}

export interface Payment {
  id: number;
  category_id: number;
  category_name: string;
  category_icon: string;
  description: string;
  amount: number;
  payment_date?: string;
  planned_date?: string;
  legal_entity_id?: number;
  legal_entity_name?: string;
  status?: string;
  created_by?: number;
  created_by_name?: string;
  service_id?: number;
  service_name?: string;
  service_description?: string;
  contractor_name?: string;
  contractor_id?: number;
  department_name?: string;
  department_id?: number;
  invoice_number?: string;
  invoice_date?: string;
  created_at?: string;
  submitted_at?: string;
  custom_fields?: PaymentCustomField[];
}

export interface PaymentComment {
  id: number;
  payment_id: number;
  user_id: number;
  username: string;
  full_name: string;
  parent_comment_id: number | null;
  comment_text: string;
  created_at: string;
  updated_at: string;
  likes_count: number;
  user_liked: boolean;
}

export interface PaymentAuditLog {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  user_id: number;
  username: string;
  changed_fields: Record<string, { old: any; new: any }> | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface PaymentCategory {
  id: number;
  name: string;
  icon: string;
  description?: string;
}

export interface LegalEntity {
  id: number;
  name: string;
  inn?: string;
  kpp?: string;
  address?: string;
}

export interface Contractor {
  id: number;
  name: string;
  inn?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
}

export interface CustomerDepartment {
  id: number;
  name: string;
  description?: string;
}

export interface PaymentService {
  id: number;
  name: string;
  description: string;
  category_id?: number;
  category_name?: string;
}
