export interface ServiceCategory {
  id: number;
  name: string;
  icon?: string;
}

export interface Service {
  id: number;
  name: string;
  description?: string;
  intermediate_approver_id?: number;
  final_approver_id?: number;
}

export interface FieldGroup {
  id: number;
  name: string;
  description?: string;
  field_ids: number[];
}

export interface ServiceFieldMapping {
  id: number;
  service_category_id: number; // Actually ticket_service_id (from ticket_services table)
  service_id: number; // From services table (approval workflows)
  field_group_ids: number[];
  created_at?: string;
  updated_at?: string;
}